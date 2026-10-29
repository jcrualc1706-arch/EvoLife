import * as THREE from 'three';
import { CameraController } from './CameraController';
import { GAME_CONFIG } from './config';
import {
  ADAPTATION_CATALOG,
  INITIAL_INSTALLED_ADAPTATIONS,
  computeStackedMultiplier,
  normalizeAdaptationId,
} from './evolutionData';
import { FoodManager } from './FoodManager';
import { FossilMeteorManager } from './FossilMeteorManager';
import { InputController } from './InputController';
import { PlayerCell } from './PlayerCell';
import { PredatorManager } from './PredatorManager';
import { SceneEnvironment } from './SceneEnvironment';
import {
  CellBodyShape,
  CellColorTheme,
  CellularEvolutionSlot,
  CellularGrowthStage,
  DEFAULT_GAME_SETTINGS,
  DEFAULT_ORGAN_MORPHOLOGY,
  DietType,
  DiscoveryState,
  EvolutionaryStage,
  GameSettings,
  GameStatus,
  GameUISnapshot,
  GenesisConfig,
  InnateTraitId,
  InputState,
  PlacedOrganInstance,
  PlacedOrganMorphology,
  PlayerStats,
  PredatorBehaviorState,
  UnlockedBannerNotification,
} from './types';

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly environment: SceneEnvironment;
  private readonly player: PlayerCell;
  private readonly cameraController: CameraController;
  private readonly foodManager: FoodManager;
  private readonly fossilMeteorManager: FossilMeteorManager;
  private readonly predatorManager: PredatorManager;
  private readonly inputController: InputController;
  private readonly timer: THREE.Timer;

  private status: GameStatus = 'menu';
  private settings: GameSettings = { ...DEFAULT_GAME_SETTINGS };
  private stats: PlayerStats;
  private recentEventMessage: string | null = null;
  private eventMessageTimer = 0;
  private unlockedBannerNotification: UnlockedBannerNotification | null = null;
  private unlockedBannerTimer = 0;

  public readonly preparedEvolutionCatalog: CellularEvolutionSlot[];
  private readonly discoveredAdaptationIds = new Set<string>();
  private installedAdaptations: Record<string, number> = {};
  private readonly unlockedSlotIds = new Set<string>();
  private selectedPlacedInstanceId: string | null = null;
  private organInstanceCounter = 1;
  private static readonly STORAGE_KEY = 'evolife_cellular_save_v1';
  private static readonly SETTINGS_STORAGE_KEY = 'evolife_settings_v1';
  private lastFrameExecutionMs = 0;
  private lastGameplayPointerPos = { x: 0, y: 0, active: false };

  // 3D Spore Workshop Interactive Raycasting & Drag State
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly editorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly planeHitPoint = new THREE.Vector3();
  private draggingCatalogAdaptationId: string | null = null;
  private repositioningInstanceId: string | null = null;
  private repositionStartScreenPos = { x: 0, y: 0 };
  private isActivelyRepositioning = false;
  private draggingSpineArrow: 'arrow_front' | 'arrow_rear' | null = null;
  private draggingOrientationInstanceId: string | null = null;
  private hoveredVertebraIndex: number | null = null;
  private hoveredVertebraSegmentIndex: 0 | 1 | 2 | null = null;
  private isRightClickOrbiting = false;
  private orbitLastClientPos = { x: 0, y: 0 };

  private animationFrameId: number | null = null;
  private uiSyncAccumulator = 0;
  private elapsedActiveTime = 0;
  private electricCooldownTimer = 0;
  private poisonSpawnCooldownTimer = 0;
  private acidSpitCooldownTimer = 0;
  private socializeCooldownTimer = 0;
  private matingCallTimer = 0;
  private wasAbilityPressed = false;
  private wasSocializePressed = false;
  private stillnessTimer = 0;
  private suctionDrainAccumulator = 0;
  private currentBiomeName = 'Pradera Bioluminiscente';
  private completedQuestStep: 0 | 1 | 2 | 3 | 4 = 0;
  private isEvaluatingQuests = false;
  private nearestSpeciesName = 'Mandíbula Rápida';
  private nearestPredatorState: PredatorBehaviorState = 'DEAMBULAR';
  private nearestPredatorDistance = 999;
  private nearestHasUncataloguedGene = false;

  private readonly onUISnapshot: (snapshot: GameUISnapshot) => void;
  private readonly boundResize: () => void;
  private readonly boundContextLost: (e: Event) => void;
  private readonly boundContextMenu: (e: MouseEvent) => void;
  private readonly boundPointerDown: (e: PointerEvent) => void;
  private readonly boundPointerMove: (e: PointerEvent) => void;
  private readonly boundPointerUp: (e: PointerEvent) => void;
  private readonly boundWheel: (e: WheelEvent) => void;
  private readonly boundEditorKeyDown: (e: KeyboardEvent) => void;

  constructor(
    container: HTMLElement,
    onUISnapshot: (snapshot: GameUISnapshot) => void
  ) {
    this.container = container;
    this.onUISnapshot = onUISnapshot;

    this.preparedEvolutionCatalog = ADAPTATION_CATALOG.map((def) => ({
      ...def,
      costAdn: def.dnaCost,
      unlocked: false,
      discoveryState:
        def.discoverySource === 'initial'
          ? 'discovered_unbought'
          : 'locked_hidden',
      installedStacks: 0,
    }));

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isHeadless,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      isHeadless ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !isHeadless;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(this.renderer.domElement);

    this.environment = new SceneEnvironment(this.renderer);
    this.player = new PlayerCell(this.environment.scene);
    this.cameraController = new CameraController(width / Math.max(height, 1));
    this.foodManager = new FoodManager(this.environment.scene);
    this.fossilMeteorManager = new FossilMeteorManager(this.environment.scene);
    this.predatorManager = new PredatorManager(this.environment.scene);
    this.inputController = new InputController(
      () => this.togglePause(),
      () => this.toggleEditor()
    );

    this.stats = this.createInitialStats();
    this.loadSettingsFromLocalStorage();
    this.applySettingsToEngine();
    this.resetAdaptationStateToInitial();
    this.loadFromLocalStorage();
    this.syncCatalogAndOrganismState();
    this.syncWorldStageScale(this.stats.growthStage, true);

    if (this.stats.evolutionaryStage === 'creature_stage') {
      this.currentBiomeName = 'Costa Terrestre Primigenia';
    } else {
      this.currentBiomeName = this.environment.getBiomeAt(
        this.player.position.x,
        this.player.position.z
      ).name;
    }

    this.timer = new THREE.Timer();
    this.timer.connect(document);

    this.renderer.compile(this.environment.scene, this.cameraController.camera);

    this.boundResize = this.handleResize.bind(this);
    this.boundContextLost = (e: Event) => {
      e.preventDefault();
    };
    this.boundContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    this.boundPointerDown = this.handleCanvasPointerDown.bind(this);
    this.boundPointerMove = this.handleWindowPointerMove.bind(this);
    this.boundPointerUp = this.handleWindowPointerUp.bind(this);
    this.boundWheel = this.handleCanvasWheel.bind(this);
    this.boundEditorKeyDown = this.handleEditorKeyDown.bind(this);

    window.addEventListener('resize', this.boundResize);
    window.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerup', this.boundPointerUp);
    window.addEventListener('keydown', this.boundEditorKeyDown);
    this.renderer.domElement.addEventListener(
      'contextmenu',
      this.boundContextMenu
    );
    this.renderer.domElement.addEventListener(
      'pointerdown',
      this.boundPointerDown
    );
    this.renderer.domElement.addEventListener('wheel', this.boundWheel, {
      passive: false,
    });
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.boundContextLost,
      false
    );

    this.emitUISnapshot();
    this.startLoop();
  }

  private static getGrowthStageFromAdn(totalAdn: number): CellularGrowthStage {
    if (totalAdn >= 320) return 5;
    if (totalAdn >= 210) return 4;
    if (totalAdn >= 120) return 3;
    if (totalAdn >= 50) return 2;
    return 1;
  }

  private static getNextStageAdnThreshold(stage: CellularGrowthStage): number {
    if (stage === 1) return 50;
    if (stage === 2) return 120;
    if (stage === 3) return 210;
    return 320;
  }

  private static getArenaRadiusForStage(stage: CellularGrowthStage): number {
    if (stage === 1) return 90;
    if (stage === 2) return 135;
    if (stage === 3) return 180;
    if (stage === 4) return 220;
    return 250;
  }

  private syncWorldStageScale(
    stage: CellularGrowthStage,
    reseedFood = false
  ): void {
    const activeRadius = GameEngine.getArenaRadiusForStage(stage);
    this.stats.activeArenaRadius = activeRadius;
    this.player.setGrowthStage(stage);
    this.environment.setGrowthStageDepthLayer(stage);
    this.predatorManager.setPlayerGrowthStage(stage);
    this.foodManager.setChloroplastTreeLocations(
      this.environment.getChloroplastTreePositions(activeRadius),
      activeRadius
    );
    if (reseedFood) {
      this.foodManager.resetAll();
    }
  }

  private createDefaultPlacedOrgans(
    initialDiet: DietType = 'herbivore'
  ): PlacedOrganInstance[] {
    const mouthAdaptationId =
      initialDiet === 'carnivore'
        ? 'mouth_jaw'
        : initialDiet === 'omnivore'
        ? 'mouth_proboscis'
        : 'mouth_filter';

    return [
      {
        instanceId: `organ_init_${mouthAdaptationId}`,
        adaptationId: mouthAdaptationId,
        angle: Math.PI,
        axialOffset: -0.95,
        mirrorSymmetry: false,
        orientationYaw: 0,
        orientationPitch: 0,
        morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
      },
      {
        instanceId: 'organ_init_flagellum',
        adaptationId: 'simple_flagellum',
        angle: 0,
        axialOffset: 0.95,
        mirrorSymmetry: false,
        orientationYaw: 0,
        orientationPitch: 0,
        morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
      },
      {
        instanceId: 'organ_init_eyes',
        adaptationId: 'eye_photoreceptor',
        angle: Math.PI * 0.78,
        axialOffset: -0.75,
        mirrorSymmetry: true,
        orientationYaw: 0,
        orientationPitch: 0,
        morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
      },
    ];
  }

  private getDefaultPlacementForAdaptation(
    rawId: string,
    stackIndex: number
  ): { angle: number; axialOffset: number; mirrorSymmetry: boolean } {
    const id = normalizeAdaptationId(rawId);
    if (
      id === 'mouth_filter' ||
      id === 'mouth_jaw' ||
      id === 'mouth_proboscis' ||
      id === 'mouth_radula' ||
      id === 'mouth_suction_cup' ||
      id === 'mouth_crusher_mandibles' ||
      id === 'mouth_filter_baleen' ||
      id === 'mouth_needle_proboscis' ||
      id === 'weapon_rotary_drill' ||
      id === 'weapon_harpoon_cell' ||
      id === 'weapon_flash_photophore' ||
      id === 'defense_chitin_shield_plate' ||
      id === 'sense_abyssal_biolum_probe'
    ) {
      return { angle: Math.PI, axialOffset: -0.96, mirrorSymmetry: false };
    }
    if (
      id === 'simple_flagellum' ||
      id === 'movement_whip_flagella' ||
      id === 'movement_reactive_nozzle' ||
      id === 'weapon_tail_club'
    ) {
      if (stackIndex === 0 && id !== 'movement_whip_flagella') {
        return { angle: 0, axialOffset: 0.96, mirrorSymmetry: false };
      }
      return {
        angle: 0.35 + stackIndex * 0.22,
        axialOffset: 0.85,
        mirrorSymmetry: true,
      };
    }
    if (id === 'hydro_siphon') {
      return { angle: 0.42, axialOffset: 0.82, mirrorSymmetry: true };
    }
    if (
      id === 'cilia_waves' ||
      id === 'movement_ribbon_fin' ||
      id === 'movement_macro_cilia_skirt' ||
      id === 'sense_lateral_line_vibrissae' ||
      id === 'defense_mucus_gland' ||
      id === 'weapon_caustic_acid_blister'
    ) {
      return {
        angle: Math.PI * (0.45 + stackIndex * 0.16),
        axialOffset: 0.0,
        mirrorSymmetry: true,
      };
    }
    if (id === 'chitin_spike' || id === 'defense_silica_spicules') {
      const angles = [Math.PI * 0.84, Math.PI * 0.56, Math.PI * 0.34, 0.28];
      const angle = angles[stackIndex % angles.length];
      return {
        angle,
        axialOffset: Math.cos(angle),
        mirrorSymmetry: true,
      };
    }
    if (id === 'poison_gland') {
      if (stackIndex === 0) {
        return { angle: 0, axialOffset: 0.88, mirrorSymmetry: false };
      }
      return { angle: 0.48, axialOffset: 0.78, mirrorSymmetry: true };
    }
    if (id === 'electric_cell') {
      return { angle: Math.PI * 0.52, axialOffset: 0.0, mirrorSymmetry: true };
    }
    if (
      id === 'eye_photoreceptor' ||
      id === 'eye_stalks' ||
      id === 'sense_stalk_compound_eye' ||
      id === 'sense_electro_sensor_pores'
    ) {
      return { angle: Math.PI * 0.78, axialOffset: -0.75, mirrorSymmetry: true };
    }
    if (id === 'chemoreceptor' || id === 'sense_antenna_chemoreceptor') {
      return { angle: Math.PI * 0.88, axialOffset: -0.88, mirrorSymmetry: true };
    }
    if (
      id === 'membrane_armor' ||
      id === 'defense_hydrothermal_carapace' ||
      id === 'defense_camouflage_chromatophores' ||
      id === 'movement_pneumatic_vesicle'
    ) {
      return {
        angle: stackIndex === 0 ? Math.PI * 0.65 : Math.PI * 0.35,
        axialOffset: stackIndex === 0 ? -0.35 : 0.35,
        mirrorSymmetry: true,
      };
    }
    if (id === 'chloroplast_1' || id === 'neutralizer_vesicle') {
      return {
        angle: Math.PI * (0.48 + stackIndex * 0.2),
        axialOffset: 0.1,
        mirrorSymmetry: true,
      };
    }
    if (id === 'vocal_crest') {
      return { angle: Math.PI, axialOffset: -0.55, mirrorSymmetry: false };
    }
    if (id === 'grasping_arms' || id === 'acid_spit') {
      return { angle: Math.PI * 0.72, axialOffset: -0.6, mirrorSymmetry: true };
    }
    if (id === 'wings_1') {
      return { angle: Math.PI * 0.5, axialOffset: 0.0, mirrorSymmetry: true };
    }
    return { angle: Math.PI * 0.5, axialOffset: 0.0, mirrorSymmetry: true };
  }

  private createInitialStats(genesis?: GenesisConfig): PlayerStats {
    const initialDiet: DietType = genesis?.initialDiet ?? 'herbivore';
    const innateTrait: InnateTraitId =
      genesis?.innateTrait ?? 'elastic_membrane';
    const initialColor: CellColorTheme =
      genesis?.colorTheme ??
      (innateTrait === 'abyssal_bioluminescence'
        ? 'violet'
        : initialDiet === 'carnivore'
        ? 'crimson'
        : initialDiet === 'omnivore'
        ? 'cyan'
        : 'emerald');

    return {
      speciesName: genesis?.speciesName?.trim().slice(0, 28) || 'Organismo Primigenio',
      bodyShape: genesis?.bodyShape ?? 'fusiforme',
      colorTheme: initialColor,
      spineSegments: 1,
      spineLength: 1.0,
      torsoRadii: [1.0, 1.0, 1.0],
      placedOrgans: this.createDefaultPlacedOrgans(initialDiet),
      evolutionaryStage: 'cell_stage',
      innateTrait,
      health: GAME_CONFIG.PLAYER.INITIAL_HEALTH,
      maxHealth: GAME_CONFIG.PLAYER.MAX_HEALTH,
      energy: GAME_CONFIG.PLAYER.INITIAL_ENERGY,
      maxEnergy: GAME_CONFIG.PLAYER.MAX_ENERGY,
      adn: GAME_CONFIG.PLAYER.INITIAL_ADN,
      totalAdnEarned: GAME_CONFIG.PLAYER.INITIAL_ADN,
      growthStage: 1,
      nextStageAdnThreshold: 50,
      activeArenaRadius: 90,
      diet: initialDiet,
      foodEaten: 0,
      survivalTime: 0,
      isStarving: false,
      isBoosting: false,
      boostCooldownRatio: 1,
      abilityCooldownRatio: 1,
      activeStatusEffect: null,
      speed: 0,
      damageFlashTime: 0,
      hasEyes: true,
      attackPower: 5,
      poisonLevel: 0,
      electricLevel: 0,
      defensePercent: 0,
      visionLevel: 1,
    };
  }

  private resetAdaptationStateToInitial(genesis?: GenesisConfig): void {
    this.discoveredAdaptationIds.clear();
    for (const def of ADAPTATION_CATALOG) {
      if (def.discoverySource === 'initial') {
        this.discoveredAdaptationIds.add(def.id);
      }
    }
    const initialDiet = genesis?.initialDiet ?? 'herbivore';
    this.stats.placedOrgans = this.createDefaultPlacedOrgans(initialDiet);
    this.selectedPlacedInstanceId = null;
    for (const org of this.stats.placedOrgans) {
      this.discoveredAdaptationIds.add(normalizeAdaptationId(org.adaptationId));
    }
  }

  private getStacks(adaptationId: string): number {
    const norm = normalizeAdaptationId(adaptationId);
    return this.installedAdaptations[norm] ?? 0;
  }

  private getCustomMutatedOrganCount(): number {
    let count = 0;
    for (const [id, stacks] of Object.entries(this.installedAdaptations)) {
      if (stacks <= 0) continue;
      const initialBase = INITIAL_INSTALLED_ADAPTATIONS[id] ?? 0;
      if (stacks > initialBase) {
        count += stacks - initialBase;
      }
    }
    return count;
  }

  /**
   * Synchronizes `installedAdaptations` stack counts from `this.stats.placedOrgans`,
   * updates all catalog discovery/installed states, recalculates attributes, and updates the 3D player cell.
   */
  private syncCatalogAndOrganismState(): void {
    // Recompute installedAdaptations from placedOrgans
    const countsFromPlaced: Record<string, number> = {};
    for (const org of this.stats.placedOrgans) {
      const normId = normalizeAdaptationId(org.adaptationId);
      countsFromPlaced[normId] = (countsFromPlaced[normId] ?? 0) + 1;
    }
    this.installedAdaptations = countsFromPlaced;

    this.unlockedSlotIds.clear();

    for (const slot of this.preparedEvolutionCatalog) {
      const stacks = Math.max(
        0,
        Math.min(slot.maxStacks, this.installedAdaptations[slot.id] ?? 0)
      );
      this.installedAdaptations[slot.id] = stacks;
      slot.installedStacks = stacks;
      slot.unlocked = stacks > 0;

      if (stacks > 0) {
        this.unlockedSlotIds.add(slot.id);
        this.discoveredAdaptationIds.add(slot.id);
      }

      const isDiscovered =
        slot.discoverySource === 'initial' ||
        this.discoveredAdaptationIds.has(slot.id);

      const nextState: DiscoveryState =
        stacks > 0
          ? 'installed'
          : isDiscovered
          ? 'discovered_unbought'
          : 'locked_hidden';

      slot.discoveryState = nextState;
    }

    this.stats.diet = this.computeCurrentDiet();
    this.stats.hasEyes =
      this.getStacks('eye_photoreceptor') > 0 ||
      this.getStacks('eye_stalks') > 0 ||
      this.getStacks('sense_stalk_compound_eye') > 0 ||
      this.getStacks('sense_abyssal_biolum_probe') > 0;

    const innateFogBonus =
      this.stats.innateTrait === 'abyssal_bioluminescence' ? 0.72 : 1.0;

    if (this.getStacks('sense_abyssal_biolum_probe') > 0) {
      this.environment.setVisionFogMultiplier(0.55 * innateFogBonus);
    } else if (this.getStacks('eye_stalks') > 0) {
      this.environment.setVisionFogMultiplier(0.7 * innateFogBonus);
    } else if (this.getStacks('sense_electro_sensor_pores') > 0) {
      this.environment.setVisionFogMultiplier(0.8 * innateFogBonus);
    } else if (this.stats.hasEyes) {
      this.environment.setVisionFogMultiplier(1.0 * innateFogBonus);
    } else {
      this.environment.setVisionFogMultiplier(1.45 * innateFogBonus);
    }

    this.recalculateVitalCaps();
    this.player.syncEvolutionParts(this.installedAdaptations);
    this.player.syncPlacedOrgans(
      this.stats.placedOrgans,
      this.selectedPlacedInstanceId
    );
  }

  public discoverAdaptation(
    adaptationId: string,
    silent = false,
    sourceLabel = 'Hallazgo Genético'
  ): boolean {
    const normId = normalizeAdaptationId(adaptationId);
    const slot = this.preparedEvolutionCatalog.find((s) => s.id === normId);

    // Strict guard: only unlock if the adaptation genuinely exists and is currently in 'locked_hidden' state
    if (
      !slot ||
      slot.discoveryState !== 'locked_hidden' ||
      this.discoveredAdaptationIds.has(normId) ||
      slot.installedStacks > 0
    ) {
      return false;
    }

    this.discoveredAdaptationIds.add(normId);
    slot.discoveryState = 'discovered_unbought';

    if (!silent) {
      this.unlockedBannerNotification = {
        id: `unlock_${slot.id}_${Date.now()}`,
        adaptationId: slot.id,
        name: slot.name,
        statSummary: slot.statSummary,
        sourceLabel,
      };
      this.unlockedBannerTimer = 5.4;
      this.setEventMessage(
        `¡NUEVA ADAPTACIÓN AISLADA: ${slot.name.toUpperCase()}! Disponible en el Taller 3D [E].`
      );
      this.saveToLocalStorage();
    }
    return true;
  }

  private discoverRandomFromMeteorite(): void {
    const lockedSlots = this.preparedEvolutionCatalog.filter(
      (slot) =>
        slot.stage === 'cell_stage' &&
        slot.discoveryState === 'locked_hidden' &&
        !this.discoveredAdaptationIds.has(slot.id) &&
        slot.installedStacks === 0
    );

    if (lockedSlots.length > 0) {
      const chosen =
        lockedSlots[Math.floor(Math.random() * lockedSlots.length)];
      this.discoverAdaptation(chosen.id, false, 'Meteorito Fosilizado');
      this.addAdn(15);
    } else {
      // All cellular adaptations already discovered: do not trigger banner, only discrete +45 ADN HUD message
      this.addAdn(45);
      this.setEventMessage('+45 ADN (Fósil catalogado)');
      this.saveToLocalStorage();
    }
  }

  private saveToLocalStorage(): void {
    if (this.status === 'gameover' || this.stats.health <= 0) return;
    try {
      const payload = {
        stats: {
          speciesName: this.stats.speciesName,
          bodyShape: this.stats.bodyShape,
          colorTheme: this.stats.colorTheme,
          spineSegments: this.stats.spineSegments,
          spineLength: this.stats.spineLength,
          torsoRadii: this.stats.torsoRadii,
          placedOrgans: this.stats.placedOrgans,
          evolutionaryStage: this.stats.evolutionaryStage,
          innateTrait: this.stats.innateTrait,
          health: this.stats.health,
          energy: this.stats.energy,
          adn: this.stats.adn,
          totalAdnEarned: this.stats.totalAdnEarned,
          growthStage: this.stats.growthStage,
          foodEaten: this.stats.foodEaten,
          survivalTime: this.stats.survivalTime,
        },
        unlockedSlotIds: Array.from(this.unlockedSlotIds),
        discoveredAdaptationIds: Array.from(this.discoveredAdaptationIds),
        installedAdaptations: this.installedAdaptations,
        completedQuestStep: this.completedQuestStep,
      };
      localStorage.setItem(GameEngine.STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota or private mode errors
    }
  }

  private loadFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(GameEngine.STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.stats ||
        typeof parsed.stats.health !== 'number' ||
        parsed.stats.health <= 0
      ) {
        return;
      }

      if (Array.isArray(parsed.discoveredAdaptationIds)) {
        for (const rawId of parsed.discoveredAdaptationIds) {
          if (typeof rawId === 'string') {
            this.discoveredAdaptationIds.add(normalizeAdaptationId(rawId));
          }
        }
      }

      // Restore placedOrgans or migrate from installedAdaptations
      if (
        Array.isArray(parsed.stats.placedOrgans) &&
        parsed.stats.placedOrgans.length > 0
      ) {
        const restoredPlaced: PlacedOrganInstance[] = [];
        for (const item of parsed.stats.placedOrgans) {
          if (item && typeof item.adaptationId === 'string') {
            const normId = normalizeAdaptationId(item.adaptationId);
            this.discoveredAdaptationIds.add(normId);
            const rawMorph = item.morphology;
            const restoredMorph: PlacedOrganMorphology = {
              scaleOverall: THREE.MathUtils.clamp(
                Number(rawMorph?.scaleOverall) || 1.0,
                0.5,
                2.2
              ),
              scaleWidth: THREE.MathUtils.clamp(
                Number(rawMorph?.scaleWidth) || 1.0,
                0.5,
                2.0
              ),
              scaleHeight: THREE.MathUtils.clamp(
                Number(rawMorph?.scaleHeight) || 1.0,
                0.5,
                2.5
              ),
              colorOverride:
                typeof rawMorph?.colorOverride === 'string' &&
                rawMorph.colorOverride.trim().length > 0
                  ? rawMorph.colorOverride.trim()
                  : undefined,
            };
            const yaw =
              Number(item.orientationYaw ?? item.localYaw) || 0;
            const pitch =
              Number(item.orientationPitch ?? item.localPitch) || 0;
            restoredPlaced.push({
              instanceId:
                typeof item.instanceId === 'string'
                  ? item.instanceId
                  : `organ_restored_${this.organInstanceCounter++}`,
              adaptationId: normId,
              angle: Number(item.angle) || 0,
              axialOffset: Number(item.axialOffset) || 0,
              mirrorSymmetry: Boolean(item.mirrorSymmetry),
              orientationYaw: yaw,
              orientationPitch: pitch,
              localYaw: yaw,
              localPitch: pitch,
              morphology: restoredMorph,
            });
          }
        }
        this.stats.placedOrgans = restoredPlaced;
      } else if (
        parsed.installedAdaptations &&
        typeof parsed.installedAdaptations === 'object'
      ) {
        const migratedPlaced: PlacedOrganInstance[] = [];
        for (const [rawKey, rawVal] of Object.entries(
          parsed.installedAdaptations
        )) {
          const normKey = normalizeAdaptationId(rawKey);
          const count = Math.max(0, Math.floor(Number(rawVal) || 0));
          for (let c = 0; c < count; c++) {
            const defPos = this.getDefaultPlacementForAdaptation(normKey, c);
            migratedPlaced.push({
              instanceId: `organ_mig_${normKey}_${c}_${this.organInstanceCounter++}`,
              adaptationId: normKey,
              angle: defPos.angle,
              axialOffset: defPos.axialOffset,
              mirrorSymmetry: defPos.mirrorSymmetry,
              orientationYaw: 0,
              orientationPitch: 0,
              morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
            });
            this.discoveredAdaptationIds.add(normKey);
          }
        }
        this.stats.placedOrgans =
          migratedPlaced.length > 0
            ? migratedPlaced
            : this.createDefaultPlacedOrgans();
      }

      if (
        typeof parsed.stats.speciesName === 'string' &&
        parsed.stats.speciesName.trim().length > 0
      ) {
        this.stats.speciesName = parsed.stats.speciesName.trim().slice(0, 28);
      }

      const shapeRaw = parsed.stats.bodyShape;
      this.stats.bodyShape =
        shapeRaw === 'esferico' || shapeRaw === 'alargado'
          ? shapeRaw
          : 'fusiforme';

      const colorRaw = parsed.stats.colorTheme;
      this.stats.colorTheme =
        colorRaw === 'emerald' || colorRaw === 'crimson' || colorRaw === 'violet'
          ? colorRaw
          : 'cyan';

      const spineRaw = Number(parsed.stats.spineSegments);
      this.stats.spineSegments =
        spineRaw === 3 ? 3 : spineRaw === 2 ? 2 : 1;

      const spineLengthRaw = Number(parsed.stats.spineLength);
      this.stats.spineLength = !Number.isNaN(spineLengthRaw) && spineLengthRaw >= 0.75
        ? THREE.MathUtils.clamp(spineLengthRaw, 0.75, 1.75)
        : this.stats.spineSegments === 3
        ? 1.44
        : this.stats.spineSegments === 2
        ? 1.22
        : 1.0;

      if (
        Array.isArray(parsed.stats.torsoRadii) &&
        parsed.stats.torsoRadii.length === 3
      ) {
        this.stats.torsoRadii = [
          THREE.MathUtils.clamp(Number(parsed.stats.torsoRadii[0]) || 1.0, 0.6, 1.55),
          THREE.MathUtils.clamp(Number(parsed.stats.torsoRadii[1]) || 1.0, 0.6, 1.55),
          THREE.MathUtils.clamp(Number(parsed.stats.torsoRadii[2]) || 1.0, 0.6, 1.55),
        ];
      }

      const evoStageRaw = parsed.stats.evolutionaryStage;
      const validEvoStage: EvolutionaryStage =
        evoStageRaw === 'creature_stage' ? 'creature_stage' : 'cell_stage';
      this.stats.evolutionaryStage = validEvoStage;

      const traitRaw = parsed.stats.innateTrait;
      this.stats.innateTrait =
        traitRaw === 'thermophilic_cytoplasm' ||
        traitRaw === 'voracious_chemotaxis' ||
        traitRaw === 'abyssal_bioluminescence'
          ? traitRaw
          : 'elastic_membrane';

      this.stats.adn = Math.max(0, Number(parsed.stats.adn) || 0);
      this.stats.totalAdnEarned = Math.max(
        this.stats.adn,
        Number(parsed.stats.totalAdnEarned) || 0
      );

      const stageRaw = Number(parsed.stats.growthStage);
      const computedStage = GameEngine.getGrowthStageFromAdn(
        this.stats.totalAdnEarned
      );
      const validStage: CellularGrowthStage =
        validEvoStage === 'creature_stage'
          ? 5
          : stageRaw >= 1 && stageRaw <= 5
          ? (Math.max(stageRaw, computedStage) as CellularGrowthStage)
          : computedStage;

      this.stats.growthStage = validStage;
      this.stats.nextStageAdnThreshold =
        GameEngine.getNextStageAdnThreshold(validStage);
      this.stats.activeArenaRadius =
        GameEngine.getArenaRadiusForStage(validStage);
      this.stats.foodEaten = Math.max(0, Number(parsed.stats.foodEaten) || 0);
      this.stats.survivalTime = Math.max(
        0,
        Number(parsed.stats.survivalTime) || 0
      );
      this.elapsedActiveTime = this.stats.survivalTime;

      this.syncCatalogAndOrganismState();

      this.stats.health = Math.min(
        this.stats.maxHealth,
        Math.max(1, Number(parsed.stats.health) || this.stats.maxHealth)
      );
      this.stats.energy = Math.min(
        this.stats.maxEnergy,
        Math.max(10, Number(parsed.stats.energy) || this.stats.maxEnergy)
      );

      const questStep = Number(parsed.completedQuestStep);
      if (
        questStep === 0 ||
        questStep === 1 ||
        questStep === 2 ||
        questStep === 3 ||
        questStep === 4
      ) {
        this.completedQuestStep = questStep;
      }

      this.player.applyMorphology(
        this.stats.bodyShape,
        this.stats.colorTheme,
        validEvoStage === 'creature_stage',
        this.stats.spineSegments,
        this.stats.spineLength,
        this.stats.torsoRadii
      );
      this.environment.setStageEnvironment(validEvoStage);
      this.predatorManager.setStageMode(validEvoStage);
      this.syncWorldStageScale(validStage, false);
      this.evaluateQuests(true);
      this.setEventMessage('Partida evolutiva restaurada automáticamente');
    } catch {
      // Ignore corrupt storage data
    }
  }

  private clearLocalStorage(): void {
    try {
      localStorage.removeItem(GameEngine.STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  public hasSavedGame(): boolean {
    try {
      const raw = localStorage.getItem(GameEngine.STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(
        parsed &&
          typeof parsed === 'object' &&
          parsed.stats &&
          typeof parsed.stats.health === 'number' &&
          parsed.stats.health > 0
      );
    } catch {
      return false;
    }
  }

  public continueSavedGame(): void {
    if (this.hasSavedGame()) {
      this.loadFromLocalStorage();
      this.syncCatalogAndOrganismState();
    }
    this.status = 'playing';
    this.player.setEditorMode(false);
    this.inputController.resetInputs();
    this.timer.update();
    this.setEventMessage(
      `Evolución reanudada: ${this.stats.speciesName || 'Organismo Primigenio'}`
    );
    this.emitUISnapshot();
  }

  public startNewGame(genesisConfig?: GenesisConfig): void {
    this.restartGame(genesisConfig);
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public saveAndExitToMenu(): void {
    if (this.status === 'editing' || this.matingCallTimer > 0) {
      this.setEditorSandboxIsolation(false);
      this.player.setEditorMode(false);
      this.cameraController.resetEditorOrbit();
    }
    this.saveToLocalStorage();
    this.matingCallTimer = 0;
    this.player.hideMateCell();
    this.inputController.resetInputs();
    this.status = 'menu';
    this.emitUISnapshot();
  }

  private loadSettingsFromLocalStorage(): void {
    try {
      const raw = localStorage.getItem(GameEngine.SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      this.settings = {
        ...DEFAULT_GAME_SETTINGS,
        ...parsed,
      };
    } catch {
      this.settings = { ...DEFAULT_GAME_SETTINGS };
    }
  }

  private saveSettingsToLocalStorage(): void {
    try {
      localStorage.setItem(
        GameEngine.SETTINGS_STORAGE_KEY,
        JSON.stringify(this.settings)
      );
    } catch {
      // Ignore storage errors
    }
  }

  private applySettingsToEngine(): void {
    const isHeadless =
      navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    if (!isHeadless) {
      const maxDpr =
        this.settings.graphicsQuality === 'low'
          ? 1
          : this.settings.graphicsQuality === 'medium'
          ? 1.5
          : 2;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
      this.renderer.shadowMap.enabled =
        this.settings.graphicsQuality !== 'low';
      this.renderer.toneMappingExposure =
        this.settings.graphicsQuality === 'high' ? 1.12 : 1.05;
    }
    this.environment.setParticleQuality(this.settings.graphicsQuality);
    this.environment.setUserFogDistancePercent(
      this.settings.fogDistancePercent
    );
  }

  public updateSettings(partialSettings: Partial<GameSettings>): void {
    this.settings = {
      ...this.settings,
      ...partialSettings,
    };
    this.saveSettingsToLocalStorage();
    this.applySettingsToEngine();
    this.emitUISnapshot();
  }

  public resetSettingsToDefault(): void {
    this.settings = { ...DEFAULT_GAME_SETTINGS };
    this.saveSettingsToLocalStorage();
    this.applySettingsToEngine();
    this.emitUISnapshot();
  }

  private evaluateQuests(silent = false): boolean {
    if (this.isEvaluatingQuests) return false;
    this.isEvaluatingQuests = true;
    let questAdvanced = false;

    const customOrgansCount = this.getCustomMutatedOrganCount();

    try {
      if (this.completedQuestStep === 0 && this.stats.totalAdnEarned >= 20) {
        this.completedQuestStep = 1;
        questAdvanced = true;
        this.addAdn(10);
        if (!silent) {
          this.setEventMessage(
            '¡Misión 1 completada: Primeros Nutrientes! (+10 ADN de recompensa)'
          );
        }
      }

      if (this.completedQuestStep === 1 && customOrgansCount >= 1) {
        this.completedQuestStep = 2;
        questAdvanced = true;
        this.addAdn(15);
        if (!silent) {
          this.setEventMessage(
            '¡Misión 2 completada: Adaptación Morfológica! (+15 ADN de recompensa)'
          );
        }
      }

      if (
        this.completedQuestStep === 2 &&
        this.stats.growthStage >= 3 &&
        customOrgansCount >= 2
      ) {
        this.completedQuestStep = 3;
        questAdvanced = true;
        this.addAdn(20);
        if (!silent) {
          this.setEventMessage(
            '¡Misión 3 completada: Complejo Pluricelular! (+20 ADN de recompensa)'
          );
        }
      }

      if (
        this.completedQuestStep === 3 &&
        (this.stats.growthStage >= 5 || this.stats.totalAdnEarned >= 320)
      ) {
        this.completedQuestStep = 4;
        questAdvanced = true;
        if (!silent) {
          this.setEventMessage(
            '¡Etapa 5/5 Leviatán Celular alcanzada! Cerebro Primitivo desarrollado: Listo para la Transición Terrestre'
          );
        }
      }

      if (questAdvanced && !silent) {
        this.saveToLocalStorage();
      }
    } finally {
      this.isEvaluatingQuests = false;
    }

    return questAdvanced;
  }

  private getActiveQuestInfo(): { title: string; progressText: string } {
    const customOrgansCount = this.getCustomMutatedOrganCount();

    if (this.stats.evolutionaryStage === 'creature_stage') {
      return {
        title: 'Estadio de Criatura Terrestre · Dominio Costero',
        progressText:
          'Explora la Costa Terrestre, descansa en el Nido Central (0,0), planea con Alas (Espacio) o pulsa C para Socializar',
      };
    }
    if (this.completedQuestStep === 0) {
      const current = Math.min(20, this.stats.totalAdnEarned);
      return {
        title: 'Misión 1/4 · Brote de Cloroplastos',
        progressText: `Acumula 20 ADN totales (${current}/20 ADN) · Recompensa: +10 ADN`,
      };
    }
    if (this.completedQuestStep === 1) {
      const organs = Math.min(1, customOrgansCount);
      return {
        title: 'Misión 2/4 · Adaptación Morfológica',
        progressText: `Aísla Nódulos Genéticos y ensambla 1 adaptación en el Taller 3D [E] (${organs}/1) · Recompensa: +15 ADN`,
      };
    }
    if (this.completedQuestStep === 2) {
      const organs = Math.min(2, customOrgansCount);
      const stageStatus =
        this.stats.growthStage >= 3
          ? 'Etapa 3/5 OK'
          : 'Alcanza Etapa 3/5 (120 ADN)';
      return {
        title: 'Misión 3/4 · Complejo Pluricelular',
        progressText: `${stageStatus} y ensambla 2 adaptaciones (${organs}/2) · Recompensa: +20 ADN`,
      };
    }
    if (this.completedQuestStep === 3) {
      const currentAdn = Math.min(320, this.stats.totalAdnEarned);
      const stageStatus =
        this.stats.growthStage >= 5
          ? 'Etapa 5/5 OK'
          : `Etapa ${this.stats.growthStage}/5 (Meta: 320 ADN)`;
      return {
        title: 'Misión 4/4 · Leviatán Celular y Cerebro Primitivo',
        progressText: `${stageStatus} · Acumula 320 ADN totales (${currentAdn}/320 ADN)`,
      };
    }
    return {
      title: 'Culminación Celular (Etapa 5/5) · Cerebro Primitivo Activo',
      progressText:
        '¡Pulsa E y activa "Evolucionar a Criatura Terrestre" para desarrollar patas y salir a la costa!',
    };
  }

  private computeCurrentDiet(): DietType {
    const hasOmnivoreOrgan =
      this.getStacks('mouth_proboscis') > 0 ||
      this.getStacks('mouth_suction_cup') > 0;
    const hasCarnivoreOrgan =
      this.getStacks('mouth_jaw') > 0 ||
      this.getStacks('mouth_crusher_mandibles') > 0 ||
      this.getStacks('mouth_needle_proboscis') > 0;
    const hasHerbivoreOrChloro =
      this.getStacks('chloroplast_1') > 0 ||
      this.getStacks('mouth_filter') > 0 ||
      this.getStacks('mouth_radula') > 0 ||
      this.getStacks('mouth_filter_baleen') > 0;

    if (hasOmnivoreOrgan || (hasCarnivoreOrgan && hasHerbivoreOrChloro)) {
      return 'omnivore';
    }
    if (hasCarnivoreOrgan) {
      return 'carnivore';
    }
    return 'herbivore';
  }

  private recalculateVitalCaps(): void {
    const healthByStage: Record<CellularGrowthStage, number> = {
      1: 0,
      2: 15,
      3: 30,
      4: 50,
      5: 75,
    };
    const growthHealthBonus = healthByStage[this.stats.growthStage] ?? 0;

    const armorStacks = this.getStacks('membrane_armor');
    const armorHealthBonus = Math.round(
      40 * computeStackedMultiplier(armorStacks)
    );
    const neutralizerStacks = this.getStacks('neutralizer_vesicle');
    const neutralizerBonus = neutralizerStacks > 0 ? 25 : 0;
    const hydrothermalCarapaceBonus =
      this.getStacks('defense_hydrothermal_carapace') > 0 ? 35 : 0;
    const shieldPlateHealthBonus =
      this.getStacks('defense_chitin_shield_plate') > 0 ? 15 : 0;

    this.stats.maxHealth =
      GAME_CONFIG.PLAYER.MAX_HEALTH +
      growthHealthBonus +
      armorHealthBonus +
      neutralizerBonus +
      hydrothermalCarapaceBonus +
      shieldPlateHealthBonus;
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health);

    const chloroStacks = this.getStacks('chloroplast_1');
    const chloroEnergyBonus = Math.round(
      30 * computeStackedMultiplier(chloroStacks)
    );
    const pneumaticBonus =
      this.getStacks('movement_pneumatic_vesicle') > 0 ? 15 : 0;
    const thermophilicBonus =
      this.stats.innateTrait === 'thermophilic_cytoplasm' ? 15 : 0;
    this.stats.maxEnergy =
      GAME_CONFIG.PLAYER.MAX_ENERGY +
      chloroEnergyBonus +
      pneumaticBonus +
      thermophilicBonus;
    this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy);

    // Quantitative Attributes for Top-Right Spore Workshop Panel
    const jawStacks = this.getStacks('mouth_jaw');
    const proboscisStacks = this.getStacks('mouth_proboscis');
    const crusherStacks = this.getStacks('mouth_crusher_mandibles');
    const needleProboscisStacks = this.getStacks('mouth_needle_proboscis');
    const spikeStacks = this.getStacks('chitin_spike');
    const harpoonStacks = this.getStacks('weapon_harpoon_cell');
    const drillStacks = this.getStacks('weapon_rotary_drill');
    const acidBlisterStacks = this.getStacks('weapon_caustic_acid_blister');
    const tailClubStacks = this.getStacks('weapon_tail_club');
    const silicaSpiculeStacks = this.getStacks('defense_silica_spicules');
    const armsStacks = this.getStacks('grasping_arms');
    const acidStacks = this.getStacks('acid_spit');
    const poisonStacks = this.getStacks('poison_gland');
    const electricStacks = this.getStacks('electric_cell');
    const flashPhotophoreStacks = this.getStacks('weapon_flash_photophore');
    const eyePhotoStacks = this.getStacks('eye_photoreceptor');
    const eyeStalksStacks = this.getStacks('eye_stalks');
    const compoundEyeStacks = this.getStacks('sense_stalk_compound_eye');
    const antennaChemoStacks = this.getStacks('sense_antenna_chemoreceptor');
    const electroPoresStacks = this.getStacks('sense_electro_sensor_pores');
    const lateralLineStacks = this.getStacks('sense_lateral_line_vibrissae');
    const biolumProbeStacks = this.getStacks('sense_abyssal_biolum_probe');
    const chemoStacks = this.getStacks('chemoreceptor');

    const rawAttack =
      5 +
      jawStacks * 20 +
      proboscisStacks * 12 +
      crusherStacks * 18 +
      needleProboscisStacks * 15 +
      spikeStacks * 15 +
      harpoonStacks * 14 +
      drillStacks * 16 +
      acidBlisterStacks * 15 +
      tailClubStacks * 20 +
      silicaSpiculeStacks * 8 +
      armsStacks * 18 +
      acidStacks * 15;
    // Carnivore serrated mandible bonus (+15% bite damage)
    this.stats.attackPower =
      jawStacks > 0 ? Math.round(rawAttack * 1.15) : rawAttack;
    this.stats.poisonLevel =
      poisonStacks + acidStacks + acidBlisterStacks * 2;
    this.stats.electricLevel = electricStacks + flashPhotophoreStacks;

    const mucusRed = this.getStacks('defense_mucus_gland') > 0 ? 15 : 0;
    const hydroCarapaceRed =
      this.getStacks('defense_hydrothermal_carapace') > 0 ? 25 : 0;
    const shieldPlateRed =
      this.getStacks('defense_chitin_shield_plate') > 0 ? 20 : 0;
    const camoRed =
      this.getStacks('defense_camouflage_chromatophores') > 0 ? 12 : 0;
    const lateralRed = lateralLineStacks > 0 ? 10 : 0;
    const elasticMembraneRed =
      this.stats.innateTrait === 'elastic_membrane' ? 20 : 0;

    this.stats.defensePercent = Math.round(
      Math.min(
        80,
        30 * computeStackedMultiplier(armorStacks) +
          (neutralizerStacks > 0 ? 10 : 0) +
          spikeStacks * 5 +
          silicaSpiculeStacks * 8 +
          mucusRed +
          hydroCarapaceRed +
          shieldPlateRed +
          camoRed +
          lateralRed +
          elasticMembraneRed
      )
    );
    this.stats.visionLevel =
      (eyeStalksStacks > 0 ? 2 : eyePhotoStacks > 0 ? 1 : 0) +
      chemoStacks +
      compoundEyeStacks +
      antennaChemoStacks +
      electroPoresStacks +
      lateralLineStacks +
      (biolumProbeStacks > 0 ? 2 : 0) +
      (this.stats.innateTrait === 'abyssal_bioluminescence' ? 1 : 0);
  }

  private addAdn(amount: number): boolean {
    if (amount <= 0) return false;
    this.stats.adn += amount;
    this.stats.totalAdnEarned += amount;

    const total = this.stats.totalAdnEarned;
    const targetStage = GameEngine.getGrowthStageFromAdn(total);
    this.stats.nextStageAdnThreshold =
      GameEngine.getNextStageAdnThreshold(targetStage);

    let stageUp = false;
    if (targetStage > this.stats.growthStage) {
      const prevMax = this.stats.maxHealth;
      this.stats.growthStage = targetStage;
      this.syncWorldStageScale(targetStage, false);
      this.recalculateVitalCaps();
      const bonus = Math.max(0, this.stats.maxHealth - prevMax);
      this.stats.health = Math.min(
        this.stats.maxHealth,
        this.stats.health + bonus
      );

      const stageMessages: Record<CellularGrowthStage, string> = {
        1: 'Etapa 1/5: Micro-Organismo',
        2: '¡Evolución Celular! Etapa 2/5: Célula Desarrollada (+15 Vida Máx. · Fumarolas y Colonias Nv.2)',
        3: '¡Evolución Celular! Etapa 3/5: Complejo Pluricelular (+30 Vida Máx. · Árboles de Cloroplastos Nv.3)',
        4: '¡Evolución Celular! Etapa 4/5: Macro-Célula Dominante (+50 Vida Máx. · Fosa Abisal y Bosques Nv.4)',
        5: '¡Culminación Celular! Etapa 5/5: Leviatán Celular (+75 Vida Máx. · Cerebro Primitivo Desbloqueado)',
      };
      this.setEventMessage(stageMessages[targetStage]);
      stageUp = true;
    }

    const questCompleted = this.evaluateQuests();
    if (!questCompleted) {
      this.saveToLocalStorage();
    }

    return stageUp || questCompleted;
  }

  // --- 3D SPORE WORKSHOP DRAG & DROP, SPINE SCULPTING & RAYCASTING METHODS ---

  private updateRaycasterFromClientCoords(clientX: number, clientY: number): boolean {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.cameraController.camera);
    this.editorPlane.constant = -this.player.position.y;
    return this.raycaster.ray.intersectPlane(
      this.editorPlane,
      this.planeHitPoint
    ) !== null;
  }

  public startCatalogDrag(rawAdaptationId: string): void {
    if (this.status !== 'editing') return;
    const normId = normalizeAdaptationId(rawAdaptationId);
    const slot = this.preparedEvolutionCatalog.find((s) => s.id === normId);
    if (!slot || slot.discoveryState === 'locked_hidden') return;
    this.draggingCatalogAdaptationId = normId;
  }

  public selectPlacedOrgan(instanceId: string | null): void {
    this.selectedPlacedInstanceId = instanceId;
    this.player.syncPlacedOrgans(
      this.stats.placedOrgans,
      this.selectedPlacedInstanceId
    );
    this.emitUISnapshot();
  }

  public updatePlacedOrganMorphology(
    instanceId: string,
    partialMorphology: Partial<PlacedOrganMorphology>
  ): void {
    const target = this.stats.placedOrgans.find(
      (o) => o.instanceId === instanceId
    );
    if (!target) return;

    const cur = target.morphology ?? { ...DEFAULT_ORGAN_MORPHOLOGY };
    const nextMorph: PlacedOrganMorphology = {
      scaleOverall:
        partialMorphology.scaleOverall !== undefined
          ? THREE.MathUtils.clamp(partialMorphology.scaleOverall, 0.5, 2.2)
          : cur.scaleOverall,
      scaleWidth:
        partialMorphology.scaleWidth !== undefined
          ? THREE.MathUtils.clamp(partialMorphology.scaleWidth, 0.5, 2.0)
          : cur.scaleWidth,
      scaleHeight:
        partialMorphology.scaleHeight !== undefined
          ? THREE.MathUtils.clamp(partialMorphology.scaleHeight, 0.5, 2.5)
          : cur.scaleHeight,
      colorOverride:
        'colorOverride' in partialMorphology
          ? partialMorphology.colorOverride
          : cur.colorOverride,
    };

    target.morphology = nextMorph;
    this.player.syncPlacedOrgans(
      this.stats.placedOrgans,
      this.selectedPlacedInstanceId
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public updatePlacedOrganOrientation(
    instanceId: string,
    yaw: number,
    pitch: number
  ): void {
    const target = this.stats.placedOrgans.find(
      (o) => o.instanceId === instanceId
    );
    if (!target) return;

    const clampedYaw = THREE.MathUtils.clamp(yaw, -Math.PI * 0.65, Math.PI * 0.65);
    const clampedPitch = THREE.MathUtils.clamp(
      pitch,
      -Math.PI * 0.45,
      Math.PI * 0.45
    );
    target.orientationYaw = clampedYaw;
    target.orientationPitch = clampedPitch;
    target.localYaw = clampedYaw;
    target.localPitch = clampedPitch;

    this.player.syncPlacedOrgans(
      this.stats.placedOrgans,
      this.selectedPlacedInstanceId
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public resetPlacedOrganMorphology(instanceId: string): void {
    const target = this.stats.placedOrgans.find(
      (o) => o.instanceId === instanceId
    );
    if (!target) return;

    target.orientationYaw = 0;
    target.orientationPitch = 0;
    target.localYaw = 0;
    target.localPitch = 0;
    target.morphology = { ...DEFAULT_ORGAN_MORPHOLOGY };

    this.player.syncPlacedOrgans(
      this.stats.placedOrgans,
      this.selectedPlacedInstanceId
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public removePlacedOrganByInstanceId(instanceId: string): boolean {
    const idx = this.stats.placedOrgans.findIndex(
      (o) => o.instanceId === instanceId
    );
    if (idx === -1) return false;

    const removed = this.stats.placedOrgans[idx];
    const slot = this.preparedEvolutionCatalog.find(
      (s) => s.id === normalizeAdaptationId(removed.adaptationId)
    );
    const refundAdn = slot ? slot.costAdn : 0;

    this.stats.placedOrgans.splice(idx, 1);
    this.stats.adn += refundAdn;
    if (this.selectedPlacedInstanceId === instanceId) {
      this.selectedPlacedInstanceId = null;
    }

    this.syncCatalogAndOrganismState();
    this.saveToLocalStorage();
    if (slot) {
      this.setEventMessage(
        `Pieza vendida: ${slot.name} (+${refundAdn} ADN reembolsado)`
      );
    }
    this.emitUISnapshot();
    return true;
  }

  public setSpineLength(length: number): void {
    this.stats.spineLength = THREE.MathUtils.clamp(length, 0.75, 1.75);
    this.stats.spineSegments =
      this.stats.spineLength >= 1.32 ? 3 : this.stats.spineLength >= 1.12 ? 2 : 1;
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      this.stats.evolutionaryStage === 'creature_stage',
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public setTorsoRadius(segmentIndex: 0 | 1 | 2, radius: number): void {
    const nextRadii: [number, number, number] = [...this.stats.torsoRadii];
    nextRadii[segmentIndex] = THREE.MathUtils.clamp(radius, 0.6, 1.55);
    this.stats.torsoRadii = nextRadii;
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      this.stats.evolutionaryStage === 'creature_stage',
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  private handleCanvasPointerDown(e: PointerEvent): void {
    if (this.status !== 'editing') return;

    // Right mouse button (button === 2): start manual 3D camera orbit
    if (e.button === 2) {
      e.preventDefault();
      this.isRightClickOrbiting = true;
      this.orbitLastClientPos = { x: e.clientX, y: e.clientY };
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
    }

    if (e.button !== 0) return;

    this.updateRaycasterFromClientCoords(e.clientX, e.clientY);

    // 0. Check if clicking the floating Spore Orientation Gizmo sphere in front of the selected organ
    const gizmoObj = this.player.getOrientationGizmoObject();
    if (gizmoObj && this.selectedPlacedInstanceId) {
      const gizmoHits = this.raycaster.intersectObject(gizmoObj, true);
      if (gizmoHits.length > 0) {
        this.draggingOrientationInstanceId = this.selectedPlacedInstanceId;
        this.player.setOrientationGizmoHovered(true);
        this.renderer.domElement.style.cursor = 'grabbing';
        return;
      }
    }

    // 1. Check if clicking one of the 3D Spine Stretch Arrows ('arrow_front' or 'arrow_rear')
    const arrowHits = this.raycaster.intersectObjects(
      this.player.getEditorArrowObjects(),
      true
    );
    if (arrowHits.length > 0) {
      let obj: THREE.Object3D | null = arrowHits[0].object;
      while (obj && !obj.userData.editorHandle) {
        obj = obj.parent;
      }
      const handle = obj?.userData.editorHandle as
        | 'arrow_front'
        | 'arrow_rear'
        | undefined;
      if (handle) {
        this.draggingSpineArrow = handle;
        this.player.setHoveredSpineControl(handle, null);
        return;
      }
    }

    // 2. Check if clicking an already-placed 3D organ on the cell membrane
    const organHits = this.raycaster.intersectObjects(
      this.player.getPlacedOrganRootObjects(),
      true
    );
    if (organHits.length > 0) {
      let obj: THREE.Object3D | null = organHits[0].object;
      while (obj && !obj.userData.placedInstanceId) {
        obj = obj.parent;
      }
      const hitInstanceId = obj?.userData.placedInstanceId as string | undefined;
      if (hitInstanceId) {
        this.selectPlacedOrgan(hitInstanceId);
        this.repositioningInstanceId = hitInstanceId;
        this.repositionStartScreenPos = { x: e.clientX, y: e.clientY };
        this.isActivelyRepositioning = false;
        return;
      }
    }

    // 3. Check if clicking one of the internal vertebrae directly
    const vertebraHits = this.raycaster.intersectObjects(
      this.player.getVertebraObjects(),
      true
    );
    if (vertebraHits.length > 0) {
      let vObj: THREE.Object3D | null = vertebraHits[0].object;
      while (vObj && vObj.userData.vertebraIndex === undefined) {
        vObj = vObj.parent;
      }
      const vIdx =
        typeof vObj?.userData.vertebraIndex === 'number'
          ? (vObj.userData.vertebraIndex as number)
          : null;
      const segIdx =
        typeof vObj?.userData.spineSegmentIndex === 'number'
          ? (vObj.userData.spineSegmentIndex as 0 | 1 | 2)
          : null;
      this.hoveredVertebraIndex = vIdx;
      this.hoveredVertebraSegmentIndex = segIdx;
      this.player.setHoveredSpineControl(null, vIdx);
      return;
    }

    // Clicked empty space on canvas: deselect current placed organ (hides orientation gizmo)
    if (this.selectedPlacedInstanceId !== null) {
      this.selectPlacedOrgan(null);
    }
  }

  private handleWindowPointerMove(e: PointerEvent): void {
    this.lastGameplayPointerPos = {
      x: e.clientX,
      y: e.clientY,
      active: true,
    };

    if (this.status !== 'editing') return;

    // Case 0: Manual 3D Camera Orbit while holding Right Click
    if (this.isRightClickOrbiting) {
      if ((e.buttons & 2) === 0) {
        this.isRightClickOrbiting = false;
        this.renderer.domElement.style.cursor = 'default';
      } else {
        const dx = e.clientX - this.orbitLastClientPos.x;
        const dy = e.clientY - this.orbitLastClientPos.y;
        this.orbitLastClientPos = { x: e.clientX, y: e.clientY };
        const inv = this.settings.invertEditorCamera ? -1 : 1;
        this.cameraController.orbitEditorCamera(
          -dx * 0.0075 * inv,
          dy * 0.0065 * inv
        );
        return;
      }
    }

    const hasPlaneHit = this.updateRaycasterFromClientCoords(
      e.clientX,
      e.clientY
    );
    if (!hasPlaneHit) return;

    // Case A0: Dragging the floating Spore Orientation Gizmo sphere to rotate the selected organ (and its mirror twin)
    if (this.draggingOrientationInstanceId) {
      const targetOrg = this.stats.placedOrgans.find(
        (o) => o.instanceId === this.draggingOrientationInstanceId
      );
      if (targetOrg) {
        const nextYaw = this.player.computeOrganLocalYawFromWorldPoint(
          targetOrg,
          this.planeHitPoint
        );
        targetOrg.orientationYaw = nextYaw;
        targetOrg.localYaw = nextYaw;
        this.player.syncPlacedOrgans(
          this.stats.placedOrgans,
          this.selectedPlacedInstanceId
        );
      }
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
    }

    // Case A: Dragging a 3D Spine Stretch Arrow to elongate/shorten the torso
    if (this.draggingSpineArrow) {
      const localPt = this.planeHitPoint.clone();
      this.player.group.worldToLocal(localPt);
      const targetLen = THREE.MathUtils.clamp(
        (Math.abs(localPt.z) - 0.45) / 1.38,
        0.75,
        1.75
      );
      this.setSpineLength(targetLen);
      return;
    }

    // Case B: Dragging a new adaptation card from the Left Palette onto the 3D Cell
    if (this.draggingCatalogAdaptationId) {
      const proj = this.player.projectWorldPointToMembrane(this.planeHitPoint);
      const effectiveSymmetry = this.settings.autoBilateralSymmetry
        ? proj.mirrorSymmetry
        : false;
      const slot = this.preparedEvolutionCatalog.find(
        (s) => s.id === this.draggingCatalogAdaptationId
      );
      const canInstall =
        Boolean(slot) &&
        slot!.discoveryState !== 'locked_hidden' &&
        slot!.installedStacks < slot!.maxStacks &&
        this.stats.adn >= slot!.costAdn &&
        proj.normalizedRadiusDistance <= 2.4;

      if (proj.normalizedRadiusDistance <= 2.8) {
        this.player.setDragPreview(
          this.draggingCatalogAdaptationId,
          proj.angle,
          effectiveSymmetry,
          canInstall
        );
      } else {
        this.player.setDragPreview(null, 0, false, false);
      }
      return;
    }

    // Case C: Repositioning an existing 3D organ on the cell membrane (or dragging it off to sell)
    if (this.repositioningInstanceId) {
      const moveDist = Math.hypot(
        e.clientX - this.repositionStartScreenPos.x,
        e.clientY - this.repositionStartScreenPos.y
      );
      if (moveDist > 6) {
        this.isActivelyRepositioning = true;
      }
      if (this.isActivelyRepositioning) {
        const proj = this.player.projectWorldPointToMembrane(this.planeHitPoint);
        const effectiveSymmetry = this.settings.autoBilateralSymmetry
          ? proj.mirrorSymmetry
          : false;
        const targetOrg = this.stats.placedOrgans.find(
          (o) => o.instanceId === this.repositioningInstanceId
        );
        if (targetOrg) {
          if (proj.normalizedRadiusDistance <= 2.15) {
            targetOrg.angle = proj.angle;
            targetOrg.axialOffset = proj.axialOffset;
            targetOrg.mirrorSymmetry = effectiveSymmetry;
            this.player.syncPlacedOrgans(
              this.stats.placedOrgans,
              this.selectedPlacedInstanceId
            );
            this.player.setDragPreview(null, 0, false, false);
          } else {
            // Show red invalid preview indicating release will sell/uninstall the organ
            this.player.setDragPreview(
              targetOrg.adaptationId,
              proj.angle,
              false,
              false
            );
          }
        }
      }
      return;
    }

    // Case D: Hover feedback on Orientation Gizmo, 3D Spine Arrows & Internal Vertebrae
    const gizmoObj = this.player.getOrientationGizmoObject();
    if (gizmoObj) {
      const gizmoHits = this.raycaster.intersectObject(gizmoObj, true);
      if (gizmoHits.length > 0) {
        this.player.setOrientationGizmoHovered(true);
        this.hoveredVertebraIndex = null;
        this.hoveredVertebraSegmentIndex = null;
        this.player.setHoveredSpineControl(null, null);
        this.renderer.domElement.style.cursor = 'grab';
        return;
      }
    }
    this.player.setOrientationGizmoHovered(false);

    const arrowHits = this.raycaster.intersectObjects(
      this.player.getEditorArrowObjects(),
      true
    );
    if (arrowHits.length > 0) {
      let obj: THREE.Object3D | null = arrowHits[0].object;
      while (obj && !obj.userData.editorHandle) {
        obj = obj.parent;
      }
      const handle = obj?.userData.editorHandle as
        | 'arrow_front'
        | 'arrow_rear'
        | null;
      this.hoveredVertebraIndex = null;
      this.hoveredVertebraSegmentIndex = null;
      this.player.setHoveredSpineControl(handle ?? null, null);
      this.renderer.domElement.style.cursor = 'ns-resize';
      return;
    }

    // Direct Raycast against the small internal vertebrae inside the cell
    const vertebraHits = this.raycaster.intersectObjects(
      this.player.getVertebraObjects(),
      true
    );
    if (vertebraHits.length > 0) {
      let vObj: THREE.Object3D | null = vertebraHits[0].object;
      while (vObj && vObj.userData.vertebraIndex === undefined) {
        vObj = vObj.parent;
      }
      const vIdx =
        typeof vObj?.userData.vertebraIndex === 'number'
          ? (vObj.userData.vertebraIndex as number)
          : null;
      const segIdx =
        typeof vObj?.userData.spineSegmentIndex === 'number'
          ? (vObj.userData.spineSegmentIndex as 0 | 1 | 2)
          : null;
      this.hoveredVertebraIndex = vIdx;
      this.hoveredVertebraSegmentIndex = segIdx;
      this.player.setHoveredSpineControl(null, vIdx);
      this.renderer.domElement.style.cursor = 'ns-resize';
      return;
    }

    this.hoveredVertebraIndex = null;
    this.hoveredVertebraSegmentIndex = null;
    this.player.setHoveredSpineControl(null, null);
    this.renderer.domElement.style.cursor = 'default';
  }

  private handleWindowPointerUp(e: PointerEvent): void {
    if (this.isRightClickOrbiting && (e.button === 2 || (e.buttons & 2) === 0)) {
      this.isRightClickOrbiting = false;
      this.renderer.domElement.style.cursor = 'default';
    }

    if (this.status !== 'editing') {
      this.draggingCatalogAdaptationId = null;
      this.repositioningInstanceId = null;
      this.draggingSpineArrow = null;
      this.draggingOrientationInstanceId = null;
      this.isRightClickOrbiting = false;
      return;
    }

    if (this.draggingOrientationInstanceId) {
      this.draggingOrientationInstanceId = null;
      this.player.setOrientationGizmoHovered(false);
      this.renderer.domElement.style.cursor = 'default';
      this.saveToLocalStorage();
      this.emitUISnapshot();
    }

    if (this.draggingSpineArrow) {
      this.draggingSpineArrow = null;
      this.saveToLocalStorage();
      this.emitUISnapshot();
    }

    if (this.draggingCatalogAdaptationId) {
      const dragId = this.draggingCatalogAdaptationId;
      this.draggingCatalogAdaptationId = null;
      this.player.setDragPreview(null, 0, false, false);

      if (this.updateRaycasterFromClientCoords(e.clientX, e.clientY)) {
        const proj = this.player.projectWorldPointToMembrane(this.planeHitPoint);
        const effectiveSymmetry = this.settings.autoBilateralSymmetry
          ? proj.mirrorSymmetry
          : false;
        if (proj.normalizedRadiusDistance <= 2.4) {
          this.installOrganAtPosition(
            dragId,
            proj.angle,
            proj.axialOffset,
            effectiveSymmetry
          );
        }
      }
    }

    if (this.repositioningInstanceId) {
      const repId = this.repositioningInstanceId;
      const wasMoved = this.isActivelyRepositioning;
      this.repositioningInstanceId = null;
      this.isActivelyRepositioning = false;
      this.player.setDragPreview(null, 0, false, false);

      if (wasMoved && this.updateRaycasterFromClientCoords(e.clientX, e.clientY)) {
        const proj = this.player.projectWorldPointToMembrane(this.planeHitPoint);
        if (proj.normalizedRadiusDistance > 2.15) {
          // Dragged off the cell -> Sell/Uninstall with 100% DNA refund!
          this.removePlacedOrganByInstanceId(repId);
        } else {
          this.saveToLocalStorage();
          this.emitUISnapshot();
        }
      }
    }
  }

  private handleCanvasWheel(e: WheelEvent): void {
    if (this.status !== 'editing') return;
    e.preventDefault();

    this.updateRaycasterFromClientCoords(e.clientX, e.clientY);

    let targetSegIdx: 0 | 1 | 2 | null = this.hoveredVertebraSegmentIndex;
    let targetVertebraIdx: number | null = this.hoveredVertebraIndex;

    if (targetSegIdx === null) {
      const vertebraHits = this.raycaster.intersectObjects(
        this.player.getVertebraObjects(),
        true
      );
      if (vertebraHits.length > 0) {
        let vObj: THREE.Object3D | null = vertebraHits[0].object;
        while (vObj && vObj.userData.vertebraIndex === undefined) {
          vObj = vObj.parent;
        }
        if (typeof vObj?.userData.vertebraIndex === 'number') {
          targetVertebraIdx = vObj.userData.vertebraIndex as number;
        }
        if (typeof vObj?.userData.spineSegmentIndex === 'number') {
          targetSegIdx = vObj.userData.spineSegmentIndex as 0 | 1 | 2;
        }
      }
    }

    if (targetSegIdx !== null) {
      const deltaRadius = e.deltaY < 0 ? 0.065 : -0.065;
      const currentRadius = this.stats.torsoRadii[targetSegIdx];
      this.hoveredVertebraIndex = targetVertebraIdx;
      this.hoveredVertebraSegmentIndex = targetSegIdx;
      this.player.setHoveredSpineControl(null, targetVertebraIdx);
      this.setTorsoRadius(targetSegIdx, currentRadius + deltaRadius);
      return;
    }

    // If not hovering a vertebra, check if hovering or selecting a placed 3D organ -> wheel scales scaleOverall!
    let targetOrganId: string | null = null;
    const organHits = this.raycaster.intersectObjects(
      this.player.getPlacedOrganRootObjects(),
      true
    );
    if (organHits.length > 0) {
      let obj: THREE.Object3D | null = organHits[0].object;
      while (obj && !obj.userData.placedInstanceId) {
        obj = obj.parent;
      }
      if (typeof obj?.userData.placedInstanceId === 'string') {
        targetOrganId = obj.userData.placedInstanceId;
      }
    }
    if (!targetOrganId && this.selectedPlacedInstanceId) {
      targetOrganId = this.selectedPlacedInstanceId;
    }

    if (targetOrganId) {
      const targetOrg = this.stats.placedOrgans.find(
        (o) => o.instanceId === targetOrganId
      );
      if (targetOrg) {
        const curScale = targetOrg.morphology?.scaleOverall ?? 1.0;
        const deltaScale = e.deltaY < 0 ? 0.08 : -0.08;
        this.selectPlacedOrgan(targetOrganId);
        this.updatePlacedOrganMorphology(targetOrganId, {
          scaleOverall: THREE.MathUtils.clamp(curScale + deltaScale, 0.5, 2.2),
        });
      }
    }
  }

  private handleEditorKeyDown(e: KeyboardEvent): void {
    if (this.status !== 'editing') return;
    const activeTag = document.activeElement?.tagName.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea') return;

    if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      this.selectedPlacedInstanceId
    ) {
      e.preventDefault();
      this.removePlacedOrganByInstanceId(this.selectedPlacedInstanceId);
    }
  }

  public rotateEditorCamera(deltaRadians: number): void {
    this.cameraController.rotateEditorOrbit(deltaRadians);
  }

  public setSpeciesName(name: string): void {
    const cleaned = name.slice(0, 28);
    this.stats.speciesName = cleaned;
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public setBodyShape(shape: CellBodyShape): void {
    this.stats.bodyShape = shape;
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      this.stats.evolutionaryStage === 'creature_stage',
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public setColorTheme(theme: CellColorTheme): void {
    this.stats.colorTheme = theme;
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      this.stats.evolutionaryStage === 'creature_stage',
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public setSpineSegments(segments: 1 | 2 | 3): void {
    this.stats.spineSegments = segments;
    this.stats.spineLength =
      segments === 3 ? 1.44 : segments === 2 ? 1.22 : 1.0;
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      this.stats.evolutionaryStage === 'creature_stage',
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public evolveToCreatureStage(): void {
    if (this.stats.evolutionaryStage === 'creature_stage') {
      this.closeEditor();
      return;
    }

    this.stats.evolutionaryStage = 'creature_stage';
    this.stats.growthStage = 5;
    this.stats.totalAdnEarned = Math.max(320, this.stats.totalAdnEarned);
    this.completedQuestStep = 4;

    this.setEditorSandboxIsolation(false);
    this.player.setEditorMode(false);
    this.syncWorldStageScale(5, false);
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      true,
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii
    );
    this.syncCatalogAndOrganismState();
    this.stats.health = this.stats.maxHealth;
    this.stats.energy = this.stats.maxEnergy;
    this.stats.isStarving = false;

    this.player.position.set(0, 0, 5.2);
    this.player.updateEditorIdle(0, this.elapsedActiveTime);

    this.environment.setStageEnvironment('creature_stage');
    this.predatorManager.setStageMode('creature_stage');
    this.currentBiomeName = 'Nido de la Especie (Regeneración Activa)';

    this.status = 'playing';
    this.matingCallTimer = 0;
    this.player.hideMateCell();
    this.inputController.resetInputs();
    this.timer.update();

    this.setEventMessage(
      `¡Transición Terrestre completada! ${this.stats.speciesName || 'Tu especie'} camina sobre la Costa Terrestre`
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  /**
   * Activates or deactivates total ecosystem isolation and the 3D Spore Petri Dish Sandbox.
   * When `active === true`, hides all predators, food, meteorites, and water particles,
   * cancels any active predator pursuit, and pushes nearby predators to a safe distance.
   */
  private setEditorSandboxIsolation(active: boolean): void {
    this.environment.setEditorSandboxMode(active, this.player.position);
    this.predatorManager.setEcosystemVisible(!active, this.player.position);
    this.foodManager.setEcosystemVisible(!active);
    this.fossilMeteorManager.setEcosystemVisible(!active);

    if (active) {
      this.nearestPredatorState = 'DEAMBULAR';
      this.nearestPredatorDistance = 999;
      this.nearestHasUncataloguedGene = false;
      this.stats.damageFlashTime = 0;
    }
  }

  public togglePause(): void {
    if (this.status === 'gameover' || this.status === 'menu') return;

    if (this.status === 'editing') {
      this.closeEditor();
      return;
    }

    if (this.status === 'playing') {
      this.status = 'paused';
      if (this.matingCallTimer > 0) {
        this.matingCallTimer = 0;
        this.setEditorSandboxIsolation(false);
      }
      this.player.hideMateCell();
      this.inputController.resetInputs();
      this.saveToLocalStorage();
    } else if (this.status === 'paused') {
      this.status = 'playing';
      this.timer.update();
    }
    this.emitUISnapshot();
  }

  public toggleEditor(): void {
    if (this.status === 'gameover' || this.status === 'menu') return;

    if (this.status === 'editing') {
      this.closeEditor();
      return;
    }

    if (this.status === 'paused') {
      this.status = 'editing';
      this.matingCallTimer = 0;
      this.setEditorSandboxIsolation(true);
      this.cameraController.resetEditorOrbit();
      this.player.setEditorMode(true);
      this.inputController.resetInputs();
      this.emitUISnapshot();
      return;
    }

    if (this.matingCallTimer > 0) {
      this.matingCallTimer = 0;
      this.status = 'editing';
      this.setEditorSandboxIsolation(true);
      this.cameraController.resetEditorOrbit();
      this.player.hideMateCell();
      this.player.setEditorMode(true);
      this.inputController.resetInputs();
      this.emitUISnapshot();
      return;
    }

    // Isolate predators, food & hazards immediately when starting the mating call
    this.predatorManager.setEcosystemVisible(false, this.player.position);
    this.foodManager.setEcosystemVisible(false);
    this.fossilMeteorManager.setEcosystemVisible(false);
    this.nearestPredatorState = 'DEAMBULAR';
    this.nearestPredatorDistance = 999;
    this.stats.damageFlashTime = 0;

    this.matingCallTimer = 0.85;
    this.player.startMatingCall();
    this.setEventMessage(
      this.stats.evolutionaryStage === 'creature_stage'
        ? 'Llamada de apareamiento terrestre: Pareja acudiendo al nido...'
        : 'Llamada de apareamiento: Pareja celular acudiendo...'
    );
    this.emitUISnapshot();
  }

  public closeEditor(): void {
    if (this.status === 'editing' || this.matingCallTimer > 0) {
      if (!this.stats.speciesName.trim()) {
        this.stats.speciesName = 'Organismo Primigenio';
      }
      this.status = 'playing';
      this.matingCallTimer = 0;
      this.draggingCatalogAdaptationId = null;
      this.repositioningInstanceId = null;
      this.draggingSpineArrow = null;
      this.draggingOrientationInstanceId = null;
      this.hoveredVertebraIndex = null;
      this.hoveredVertebraSegmentIndex = null;
      this.isRightClickOrbiting = false;
      this.selectedPlacedInstanceId = null;
      this.renderer.domElement.style.cursor = 'default';
      this.setEditorSandboxIsolation(false);
      this.player.setEditorMode(false);
      this.player.hideMateCell();
      this.cameraController.resetEditorOrbit();
      this.timer.update();
      this.saveToLocalStorage();
      this.emitUISnapshot();
    }
  }

  public installOrganAtPosition(
    rawSlotId: string,
    angle: number,
    axialOffset: number,
    mirrorSymmetry: boolean
  ): boolean {
    const slotId = normalizeAdaptationId(rawSlotId);
    const slot = this.preparedEvolutionCatalog.find((s) => s.id === slotId);
    if (!slot) {
      return false;
    }

    if (slot.discoveryState === 'locked_hidden') {
      this.setEventMessage(
        'Patrón genético bloqueado: Aísla primero un Nódulo Genético en el ecosistema'
      );
      this.emitUISnapshot();
      return false;
    }

    if (
      slot.stage === 'creature_stage' &&
      this.stats.evolutionaryStage === 'cell_stage'
    ) {
      return false;
    }

    const currentStacks = this.installedAdaptations[slot.id] ?? 0;
    if (currentStacks >= slot.maxStacks || this.stats.adn < slot.costAdn) {
      return false;
    }

    const prevMaxHealth = this.stats.maxHealth;
    const prevMaxEnergy = this.stats.maxEnergy;

    this.stats.adn -= slot.costAdn;
    const newInstance: PlacedOrganInstance = {
      instanceId: `organ_${slot.id}_${Date.now()}_${this.organInstanceCounter++}`,
      adaptationId: slot.id,
      angle,
      axialOffset,
      mirrorSymmetry,
      orientationYaw: 0,
      orientationPitch: 0,
      localYaw: 0,
      localPitch: 0,
      morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
    };
    this.stats.placedOrgans.push(newInstance);
    this.selectedPlacedInstanceId = newInstance.instanceId;
    this.syncCatalogAndOrganismState();

    const healthDelta = Math.max(0, this.stats.maxHealth - prevMaxHealth);
    const energyDelta = Math.max(0, this.stats.maxEnergy - prevMaxEnergy);
    if (healthDelta > 0) {
      this.stats.health = Math.min(
        this.stats.maxHealth,
        this.stats.health + healthDelta
      );
    }
    if (energyDelta > 0) {
      this.stats.energy = Math.min(
        this.stats.maxEnergy,
        this.stats.energy + energyDelta
      );
      this.stats.isStarving = false;
    }

    const questCompleted = this.evaluateQuests();
    if (!questCompleted) {
      const stackSuffix =
        slot.maxStacks > 1
          ? ` (Copia ${this.installedAdaptations[slot.id]}/${slot.maxStacks})`
          : '';
      this.setEventMessage(`Adaptación ensamblada: ${slot.name}${stackSuffix}`);
      this.saveToLocalStorage();
    }
    this.emitUISnapshot();
    return true;
  }

  public unlockEvolutionSlot(rawSlotId: string): boolean {
    const slotId = normalizeAdaptationId(rawSlotId);
    const currentStacks = this.installedAdaptations[slotId] ?? 0;
    const defaultPos = this.getDefaultPlacementForAdaptation(
      slotId,
      currentStacks
    );
    return this.installOrganAtPosition(
      slotId,
      defaultPos.angle,
      defaultPos.axialOffset,
      defaultPos.mirrorSymmetry
    );
  }

  public refundEvolutionSlot(rawSlotId: string): boolean {
    const slotId = normalizeAdaptationId(rawSlotId);
    // Find last placed organ matching slotId
    for (let i = this.stats.placedOrgans.length - 1; i >= 0; i--) {
      if (
        normalizeAdaptationId(this.stats.placedOrgans[i].adaptationId) === slotId
      ) {
        return this.removePlacedOrganByInstanceId(
          this.stats.placedOrgans[i].instanceId
        );
      }
    }
    return false;
  }

  public resumeGame(): void {
    if (this.status === 'paused' || this.status === 'editing') {
      this.closeEditor();
      this.status = 'playing';
      this.timer.update();
      this.emitUISnapshot();
    }
  }

  public restartGame(genesisConfig?: GenesisConfig): void {
    this.clearLocalStorage();
    this.status = 'playing';
    this.stats = this.createInitialStats(genesisConfig);
    this.resetAdaptationStateToInitial(genesisConfig);
    this.completedQuestStep = 0;
    this.currentBiomeName = 'Pradera de Cloroplastos';
    this.elapsedActiveTime = 0;
    this.electricCooldownTimer = 0;
    this.poisonSpawnCooldownTimer = 0;
    this.acidSpitCooldownTimer = 0;
    this.socializeCooldownTimer = 0;
    this.matingCallTimer = 0;
    this.wasAbilityPressed = false;
    this.wasSocializePressed = false;
    this.recentEventMessage = `¡Génesis completada: ${this.stats.speciesName}! Etapa 1/5: Micro-Organismo`;
    this.eventMessageTimer = 3.5;
    this.unlockedBannerNotification = null;
    this.unlockedBannerTimer = 0;

    this.inputController.resetInputs();
    this.setEditorSandboxIsolation(false);
    this.environment.setStageEnvironment('cell_stage');
    this.predatorManager.setStageMode('cell_stage');
    this.player.reset();
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      false,
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii
    );
    this.syncCatalogAndOrganismState();
    this.stats.health = this.stats.maxHealth;
    this.stats.energy = this.stats.maxEnergy;
    this.syncWorldStageScale(1, true);
    this.cameraController.resetImmediate(
      this.player.position,
      this.player.headingAngle
    );
    this.fossilMeteorManager.resetAll();
    this.predatorManager.resetAll();

    this.timer.reset();
    this.timer.update();
    this.emitUISnapshot();
  }

  public setTouchControl(key: keyof InputState, active: boolean): void {
    if (this.status !== 'playing') return;
    this.inputController.setControlState(key, active);
  }

  private startLoop(): void {
    const tick = (timestamp: number) => {
      this.animationFrameId = requestAnimationFrame(tick);
      this.updateFrame(timestamp);
    };
    this.animationFrameId = requestAnimationFrame(tick);
  }

  private updateFrame(timestamp?: number): void {
    if (timestamp !== undefined && this.settings.fpsLimit !== 'unlimited') {
      const targetIntervalMs =
        this.settings.fpsLimit === '30' ? 1000 / 30 : 1000 / 60;
      if (timestamp - this.lastFrameExecutionMs < targetIntervalMs - 1.5) {
        return;
      }
      this.lastFrameExecutionMs = timestamp;
    }

    this.timer.update(timestamp);
    const rawDelta = this.timer.getDelta();
    const delta = Math.min(rawDelta, 0.1);

    // Ambient 3D Ocean Cinematic Mode while on the Main Menu ('menu')
    if (this.status === 'menu') {
      const menuDelta = delta * 0.45;
      this.elapsedActiveTime += menuDelta;
      this.player.updateEditorIdle(menuDelta, this.elapsedActiveTime);
      this.foodManager.update(
        menuDelta,
        this.elapsedActiveTime,
        new THREE.Vector3(9999, 0, 9999),
        'herbivore',
        false,
        false,
        false,
        false
      );
      this.predatorManager.update(
        menuDelta,
        this.elapsedActiveTime,
        new THREE.Vector3(9999, 0, 9999),
        false,
        false,
        false,
        () => {},
        [],
        false,
        0,
        false,
        false,
        [],
        false,
        false,
        false,
        this.discoveredAdaptationIds,
        0
      );
      this.cameraController.updateMenuCinematic(
        delta,
        this.player,
        this.elapsedActiveTime
      );
      this.environment.update(
        this.elapsedActiveTime,
        menuDelta,
        this.player.position.x,
        this.player.position.z
      );
      this.renderer.render(
        this.environment.scene,
        this.cameraController.camera
      );
      return;
    }

    // Live 3D Spore Workshop Mode while inside the Editor ('editing')
    if (this.status === 'editing') {
      this.elapsedActiveTime += delta;
      this.player.updateEditorIdle(delta, this.elapsedActiveTime);
      this.cameraController.update(
        delta,
        this.player,
        true,
        this.elapsedActiveTime
      );
      this.environment.update(
        this.elapsedActiveTime,
        delta,
        this.player.position.x,
        this.player.position.z
      );
      this.renderer.render(
        this.environment.scene,
        this.cameraController.camera
      );
      return;
    }

    if (this.status === 'playing') {
      this.elapsedActiveTime += delta;
      this.stats.survivalTime = this.elapsedActiveTime;

      let forceUIEmit = false;
      const isCreatureStage =
        this.stats.evolutionaryStage === 'creature_stage';

      const jawStacks = this.getStacks('mouth_jaw');
      const proboscisStacks = this.getStacks('mouth_proboscis');
      const filterStacks = this.getStacks('mouth_filter');
      const radulaStacks = this.getStacks('mouth_radula');
      const suctionCupStacks = this.getStacks('mouth_suction_cup');
      const crusherStacks = this.getStacks('mouth_crusher_mandibles');
      const baleenStacks = this.getStacks('mouth_filter_baleen');
      const needleProboscisStacks = this.getStacks('mouth_needle_proboscis');

      const flagellumStacks = this.getStacks('simple_flagellum');
      const ciliaStacks = this.getStacks('cilia_waves');
      const siphonStacks = this.getStacks('hydro_siphon');
      const ribbonFinStacks = this.getStacks('movement_ribbon_fin');
      const macroCiliaSkirtStacks = this.getStacks('movement_macro_cilia_skirt');
      const whipFlagellaStacks = this.getStacks('movement_whip_flagella');
      const pneumaticVesicleStacks = this.getStacks('movement_pneumatic_vesicle');
      const reactiveNozzleStacks = this.getStacks('movement_reactive_nozzle');

      const chloroplastStacks = this.getStacks('chloroplast_1');
      const poisonStacks = this.getStacks('poison_gland');
      const spikeStacks = this.getStacks('chitin_spike');
      const harpoonStacks = this.getStacks('weapon_harpoon_cell');
      const rotaryDrillStacks = this.getStacks('weapon_rotary_drill');
      const acidBlisterStacks = this.getStacks('weapon_caustic_acid_blister');
      const flashPhotophoreStacks = this.getStacks('weapon_flash_photophore');
      const tailClubStacks = this.getStacks('weapon_tail_club');

      const armorStacks = this.getStacks('membrane_armor');
      const neutralizerStacks = this.getStacks('neutralizer_vesicle');
      const silicaSpiculeStacks = this.getStacks('defense_silica_spicules');
      const mucusGlandStacks = this.getStacks('defense_mucus_gland');
      const hydroCarapaceStacks = this.getStacks('defense_hydrothermal_carapace');
      const chitinShieldStacks = this.getStacks('defense_chitin_shield_plate');
      const camoChromatophoreStacks = this.getStacks('defense_camouflage_chromatophores');

      const electricStacks = this.getStacks('electric_cell');
      const vocalStacks = this.getStacks('vocal_crest');
      const armsStacks = this.getStacks('grasping_arms');
      const acidStacks = this.getStacks('acid_spit');
      const chemoreceptorStacks =
        this.getStacks('chemoreceptor') +
        this.getStacks('sense_antenna_chemoreceptor');
      const lateralLineStacks = this.getStacks('sense_lateral_line_vibrissae');

      const hasJaw =
        jawStacks > 0 || crusherStacks > 0 || needleProboscisStacks > 0;
      const hasProboscis = proboscisStacks > 0 || suctionCupStacks > 0;
      const hasFilterMouth = filterStacks > 0 || baleenStacks > 0;
      const hasChloroplast = chloroplastStacks > 0;
      const hasPoisonGland = poisonStacks > 0 || acidBlisterStacks > 0;
      const hasElectricCell = electricStacks > 0;
      const hasFlashPhotophore = flashPhotophoreStacks > 0;
      const hasVocalCrest = vocalStacks > 0;
      const hasGraspingArms =
        armsStacks > 0 || harpoonStacks > 0 || rotaryDrillStacks > 0;
      const hasAcidSpit = acidStacks > 0;

      if (this.electricCooldownTimer > 0) {
        this.electricCooldownTimer = Math.max(
          0,
          this.electricCooldownTimer - delta
        );
      }
      if (this.poisonSpawnCooldownTimer > 0) {
        this.poisonSpawnCooldownTimer = Math.max(
          0,
          this.poisonSpawnCooldownTimer - delta
        );
      }
      if (this.acidSpitCooldownTimer > 0) {
        this.acidSpitCooldownTimer = Math.max(
          0,
          this.acidSpitCooldownTimer - delta
        );
      }
      if (this.socializeCooldownTimer > 0) {
        this.socializeCooldownTimer = Math.max(
          0,
          this.socializeCooldownTimer - delta
        );
      }

      // 1. Update Player Movement & Propulsion
      const canBoost =
        this.stats.energy >= GAME_CONFIG.PLAYER.MIN_ENERGY_FOR_BOOST;

      const totalTailPropulsion = flagellumStacks + whipFlagellaStacks + reactiveNozzleStacks;
      const flagellumSpeedFactor =
        totalTailPropulsion === 0
          ? 0.85
          : flagellumStacks <= 1 && whipFlagellaStacks === 0 && reactiveNozzleStacks === 0
          ? 1.0
          : 1.0 +
            0.22 * computeStackedMultiplier(Math.max(0, flagellumStacks - 1)) +
            0.3 * computeStackedMultiplier(whipFlagellaStacks) +
            (reactiveNozzleStacks > 0 ? 0.35 : 0);

      const ciliaSpeedBonus =
        0.08 * computeStackedMultiplier(ciliaStacks) +
        0.12 * computeStackedMultiplier(ribbonFinStacks) +
        (macroCiliaSkirtStacks > 0 ? 0.06 : 0);
      const siphonSpeedBonus = siphonStacks > 0 ? 0.1 : 0;
      const armorWeightPenalty =
        0.05 * armorStacks +
        (crusherStacks > 0 ? 0.08 : 0);
      const spikeWeightPenalty = 0.03 * spikeStacks;

      const netSpeedFactor = Math.max(
        0.65,
        flagellumSpeedFactor +
          ciliaSpeedBonus +
          siphonSpeedBonus -
          armorWeightPenalty -
          spikeWeightPenalty
      );

      const bioluminescenceSpeedBonus =
        this.stats.innateTrait === 'abyssal_bioluminescence' ? 1.15 : 1.0;
      const speedMultiplier =
        netSpeedFactor *
        (isCreatureStage ? 1.12 : 1.0) *
        bioluminescenceSpeedBonus;
      const turnMultiplier =
        Math.max(
          0.55,
          1.0 +
            0.35 * computeStackedMultiplier(ciliaStacks) +
            0.2 * computeStackedMultiplier(ribbonFinStacks) +
            (macroCiliaSkirtStacks > 0 ? 0.5 : 0) +
            (lateralLineStacks > 0 ? 0.15 : 0) +
            (flagellumStacks >= 2 ? 0.15 : 0) -
            (suctionCupStacks > 0 ? 0.1 : 0) -
            (hydroCarapaceStacks > 0 ? 0.1 : 0) -
            (tailClubStacks > 0 ? 0.04 : 0) -
            (whipFlagellaStacks > 0 ? 0.05 : 0)
        ) * this.settings.rotationSensitivity;

      if (
        this.settings.steeringMode === 'mouse' &&
        this.lastGameplayPointerPos.active &&
        !this.inputController.state.left &&
        !this.inputController.state.right
      ) {
        if (
          this.updateRaycasterFromClientCoords(
            this.lastGameplayPointerPos.x,
            this.lastGameplayPointerPos.y
          )
        ) {
          const dx = this.planeHitPoint.x - this.player.position.x;
          const dz = this.planeHitPoint.z - this.player.position.z;
          if (dx * dx + dz * dz > 1.2 * 1.2) {
            const targetAngle = Math.atan2(-dx, -dz);
            let diff = targetAngle - this.player.headingAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const maxTurnStep = 3.2 * turnMultiplier * delta;
            this.player.headingAngle += THREE.MathUtils.clamp(
              diff,
              -maxTurnStep,
              maxTurnStep
            );
          }
        }
      }

      const moveResult = this.player.update(
        delta,
        this.elapsedActiveTime,
        this.inputController.state,
        canBoost,
        speedMultiplier,
        turnMultiplier
      );
      this.stats.isBoosting = moveResult.isBoosting;
      this.stats.speed = Math.abs(this.player.currentSpeed);

      // Camouflage Chromatophores: 80% translucency when still for >= 1.5s
      if (
        camoChromatophoreStacks > 0 &&
        !moveResult.isMoving &&
        !moveResult.isBoosting
      ) {
        this.stillnessTimer += delta;
        this.player.setCamouflageActive(this.stillnessTimer >= 1.5);
      } else {
        this.stillnessTimer = 0;
        this.player.setCamouflageActive(false);
      }

      // Suction Cup Osmotic Drain when close to another organism (< 5.2m)
      if (suctionCupStacks > 0 && this.nearestPredatorDistance <= 5.2) {
        this.suctionDrainAccumulator += delta;
        this.stats.energy = Math.min(
          this.stats.maxEnergy,
          this.stats.energy + 6.0 * delta
        );
        if (this.suctionDrainAccumulator >= 1.0) {
          this.suctionDrainAccumulator -= 1.0;
          this.addAdn(3);
          forceUIEmit = true;
        }
      } else {
        this.suctionDrainAccumulator = 0;
      }

      const nearSpeciesNest =
        isCreatureStage &&
        this.environment.isNearNest(
          this.player.position.x,
          this.player.position.z
        );

      const nextBiomeLabel = isCreatureStage
        ? nearSpeciesNest
          ? 'Nido de la Especie (Regeneración Activa)'
          : 'Costa Terrestre Primigenia'
        : this.environment.getBiomeAt(
            this.player.position.x,
            this.player.position.z
          ).name;

      if (nextBiomeLabel !== this.currentBiomeName) {
        this.currentBiomeName = nextBiomeLabel;
        forceUIEmit = true;
      }

      // Check Mating Call courtship completion -> transition to isolated 3D Spore Workshop Sandbox
      if (this.matingCallTimer > 0) {
        this.matingCallTimer -= delta;
        if (this.matingCallTimer <= 0) {
          this.matingCallTimer = 0;
          this.status = 'editing';
          this.setEditorSandboxIsolation(true);
          this.cameraController.resetEditorOrbit();
          this.player.hideMateCell();
          this.player.setEditorMode(true);
          this.inputController.resetInputs();
          this.setEventMessage(
            'Taller Evolutivo 3D activo: Arrastra piezas a tu célula y esculpe la columna'
          );
          this.emitUISnapshot();
          this.renderer.render(
            this.environment.scene,
            this.cameraController.camera
          );
          return;
        }

        // While courtship animation is playing, skip all predator/food/starvation logic so player is 100% safe
        this.cameraController.update(
          delta,
          this.player,
          false,
          this.elapsedActiveTime
        );
        this.environment.update(
          this.elapsedActiveTime,
          delta,
          this.player.position.x,
          this.player.position.z
        );
        this.renderer.render(
          this.environment.scene,
          this.cameraController.camera
        );
        return;
      }

      // 1B. Active Weapons (KeyQ + Auto Poison Trail from world-space nozzles)
      const abilityPressedNow = this.inputController.state.ability;
      const abilityJustTriggered = abilityPressedNow && !this.wasAbilityPressed;
      this.wasAbilityPressed = abilityPressedNow;

      const socializePressedNow = this.inputController.state.socialize;
      const socializeJustTriggered =
        socializePressedNow && !this.wasSocializePressed;
      this.wasSocializePressed = socializePressedNow;

      let electricPulseTriggered = false;
      let socializeTriggered = false;

      if (socializeJustTriggered) {
        if (isCreatureStage) {
          if (this.socializeCooldownTimer <= 0) {
            this.player.triggerSocialWave(hasVocalCrest ? 13.5 : 9.5);
            socializeTriggered = true;
            this.socializeCooldownTimer = 3.5;
          } else {
            this.setEventMessage(
              `Canto Social recargándose (${this.socializeCooldownTimer.toFixed(1)}s)`
            );
            forceUIEmit = true;
          }
        } else {
          this.setEventMessage(
            'Evoluciona al Estadio de Criatura Terrestre para usar Canto Social (C)'
          );
          forceUIEmit = true;
        }
      }

      const predatorClose =
        this.nearestPredatorDistance < 12.0 &&
        (this.nearestPredatorState === 'PERSEGUIR' ||
          this.nearestPredatorState === 'ATACAR');

      if (
        hasPoisonGland &&
        this.poisonSpawnCooldownTimer <= 0 &&
        (moveResult.isBoosting || predatorClose)
      ) {
        this.player.spawnPoisonCloud();
        this.poisonSpawnCooldownTimer = 1.2;
      }

      if (abilityJustTriggered) {
        let usedAnyAbility = false;

        if (hasFlashPhotophore && this.electricCooldownTimer <= 0 && this.stats.energy >= 6) {
          this.stats.energy = Math.max(0, this.stats.energy - 6);
          this.electricCooldownTimer = 4.0;
          this.player.triggerSocialWave(8.0);
          const blindedCount = this.predatorManager.disorientPredatorsInRadius(
            this.player.position,
            8.0
          );
          usedAnyAbility = true;
          this.setEventMessage(
            blindedCount > 0
              ? `¡Fogonazo de Fotóforo Cegador! ${blindedCount} depredador(es) desorientado(s) (2.5s)`
              : 'Fogonazo lumínico de 8m emitido por el Fotóforo Cegador'
          );
          forceUIEmit = true;
        }

        if (hasAcidSpit) {
          if (this.acidSpitCooldownTimer <= 0) {
            if (this.stats.energy >= 8) {
              this.stats.energy = Math.max(0, this.stats.energy - 8);
              this.acidSpitCooldownTimer = 2.5;
              const autoAimTarget = this.predatorManager.findAutoAimTarget(
                this.player.position,
                this.player.headingAngle,
                24.0
              );
              this.player.spawnAcidProjectile(autoAimTarget);
              usedAnyAbility = true;
              this.setEventMessage(
                autoAimTarget
                  ? 'Escupitajo Ácido disparado hacia objetivo frontal'
                  : 'Escupitajo Ácido proyectado al frente'
              );
              forceUIEmit = true;
            } else {
              this.setEventMessage(
                'Energía insuficiente para Escupitajo Ácido (8 Energía)'
              );
              forceUIEmit = true;
            }
          } else {
            this.setEventMessage(
              `Escupitajo Ácido recargándose (${this.acidSpitCooldownTimer.toFixed(1)}s)`
            );
            forceUIEmit = true;
          }
        }

        if (hasElectricCell) {
          if (this.electricCooldownTimer <= 0) {
            if (this.stats.energy >= 12) {
              this.stats.energy = Math.max(0, this.stats.energy - 12);
              this.electricCooldownTimer = 6.0;
              this.player.triggerElectricPulse();
              electricPulseTriggered = true;
              usedAnyAbility = true;
              if (!hasAcidSpit) {
                this.setEventMessage(
                  'Descarga Bioeléctrica emitida (Pulso 9.5m)'
                );
              }
              forceUIEmit = true;
            } else if (!usedAnyAbility) {
              this.setEventMessage(
                'Energía insuficiente para Descarga Bioeléctrica (12 Energía)'
              );
              forceUIEmit = true;
            }
          } else if (!usedAnyAbility) {
            this.setEventMessage(
              `Órgano Bioeléctrico recargándose (${this.electricCooldownTimer.toFixed(1)}s)`
            );
            forceUIEmit = true;
          }
        }

        if (hasPoisonGland && this.poisonSpawnCooldownTimer <= 0) {
          this.player.spawnPoisonCloud();
          this.poisonSpawnCooldownTimer = 1.2;
          if (!usedAnyAbility) {
            this.setEventMessage('Nube tóxica defensiva liberada por los conductos');
            forceUIEmit = true;
          }
          usedAnyAbility = true;
        }

        if (!hasAcidSpit && !hasElectricCell && !hasPoisonGland && !hasFlashPhotophore) {
          this.setEventMessage(
            'Ensambla Fotóforo Cegador, Escupitajo Ácido, Glándula de Veneno u Órgano Bioeléctrico (E) para usar Q'
          );
          forceUIEmit = true;
        }
      }

      if (hasAcidSpit) {
        this.stats.abilityCooldownRatio = Math.max(
          0,
          Math.min(1, 1 - this.acidSpitCooldownTimer / 2.5)
        );
      } else if (hasElectricCell || hasFlashPhotophore) {
        this.stats.abilityCooldownRatio = Math.max(
          0,
          Math.min(1, 1 - this.electricCooldownTimer / 6.0)
        );
      } else if (hasPoisonGland) {
        this.stats.abilityCooldownRatio = Math.max(
          0,
          Math.min(1, 1 - this.poisonSpawnCooldownTimer / 1.2)
        );
      } else {
        this.stats.abilityCooldownRatio = 1;
      }

      if (hasAcidSpit) {
        this.stats.activeStatusEffect = 'Escupitajo Ácido';
      } else if (hasFlashPhotophore) {
        this.stats.activeStatusEffect = 'Fotóforo Cegador';
      } else if (hasElectricCell && hasPoisonGland) {
        this.stats.activeStatusEffect = 'Bioeléctrico + Veneno';
      } else if (hasElectricCell) {
        this.stats.activeStatusEffect = 'Pulso Bioeléctrico';
      } else if (hasPoisonGland) {
        this.stats.activeStatusEffect = 'Glándula de Veneno';
      } else {
        this.stats.activeStatusEffect = null;
      }

      // 2. Energy Consumption & Vent / Nest Regeneration
      const nearThermalVent =
        !isCreatureStage &&
        this.environment.isNearThermalVent(
          this.player.position.x,
          this.player.position.z
        );

      const omnivoreDrainMultiplier =
        this.stats.diet === 'omnivore' ? 1.1 : 1.0;
      const thermophilicDrainMultiplier =
        this.stats.innateTrait === 'thermophilic_cytoplasm' ? 0.8 : 1.0;

      const passiveDrainRate =
        nearThermalVent || nearSpeciesNest || pneumaticVesicleStacks > 0
          ? 0
          : (hasChloroplast
              ? GAME_CONFIG.PLAYER.PASSIVE_ENERGY_DRAIN_PER_SEC * 0.5
              : GAME_CONFIG.PLAYER.PASSIVE_ENERGY_DRAIN_PER_SEC) *
            omnivoreDrainMultiplier *
            thermophilicDrainMultiplier;

      let energyDrain = passiveDrainRate * delta;
      if (
        moveResult.isMoving &&
        !nearThermalVent &&
        !nearSpeciesNest &&
        pneumaticVesicleStacks === 0
      ) {
        const moveDrainFactor = ciliaStacks > 0 ? 0.8 : 1.0;
        energyDrain +=
          GAME_CONFIG.PLAYER.MOVEMENT_ENERGY_DRAIN_PER_SEC *
          moveDrainFactor *
          omnivoreDrainMultiplier *
          thermophilicDrainMultiplier *
          delta;
      }
      if (rotaryDrillStacks > 0 && this.inputController.state.forward) {
        energyDrain += 1.5 * delta;
      }
      if (moveResult.isBoosting) {
        const boostDrainFactor =
          siphonStacks > 0 || whipFlagellaStacks > 0 || reactiveNozzleStacks > 0
            ? 0.65
            : 1.0;
        energyDrain +=
          GAME_CONFIG.PLAYER.BOOST_ENERGY_DRAIN_PER_SEC *
          boostDrainFactor *
          thermophilicDrainMultiplier *
          delta;
      }

      this.stats.energy = Math.max(0, this.stats.energy - energyDrain);

      if (nearThermalVent) {
        const baseVentEnergyRate =
          neutralizerStacks > 0 || hydroCarapaceStacks > 0 ? 6.0 : 3.0;
        const ventEnergyRate =
          baseVentEnergyRate *
          (this.stats.innateTrait === 'thermophilic_cytoplasm' ? 1.25 : 1.0);
        this.stats.energy = Math.min(
          this.stats.maxEnergy,
          this.stats.energy + ventEnergyRate * delta
        );
        if (neutralizerStacks > 0 || hydroCarapaceStacks > 0) {
          this.stats.health = Math.min(
            this.stats.maxHealth,
            this.stats.health + 3.0 * delta
          );
        }
      }

      if (nearSpeciesNest) {
        this.stats.health = Math.min(
          this.stats.maxHealth,
          this.stats.health + 6.0 * delta
        );
        this.stats.energy = Math.min(
          this.stats.maxEnergy,
          this.stats.energy + 6.0 * delta
        );
      }

      // 3. Starvation Consequence
      if (this.stats.energy <= 0) {
        if (!this.stats.isStarving) {
          this.stats.isStarving = true;
          this.setEventMessage('Sin energía: sufriendo daño metabólico');
          forceUIEmit = true;
        }
        this.stats.health = Math.max(
          0,
          this.stats.health - GAME_CONFIG.PLAYER.STARVATION_DAMAGE_PER_SEC * delta
        );
      } else {
        this.stats.isStarving = false;
      }

      // 4. Update Food & Dropped Creature Genetic Nodules
      const foodResult = this.foodManager.update(
        delta,
        this.elapsedActiveTime,
        this.player.position,
        this.stats.diet,
        hasChloroplast,
        hasFilterMouth,
        baleenStacks > 0,
        radulaStacks > 0,
        this.stats.innateTrait === 'voracious_chemotaxis'
      );

      let isolatedNewGene = false;
      for (const drop of foodResult.collectedGeneticDrops) {
        if (
          this.discoverAdaptation(
            drop.adaptationId,
            false,
            `Muestra de ${drop.speciesName}`
          )
        ) {
          isolatedNewGene = true;
        }
      }

      if (
        foodResult.itemsEaten > 0 ||
        foodResult.collectedGeneticDrops.length > 0
      ) {
        const proboscisMult = hasProboscis ? 1.25 : 1.0;
        const thermophilicMult =
          this.stats.innateTrait === 'thermophilic_cytoplasm' ? 1.25 : 1.0;
        const energyMultiplier = proboscisMult * thermophilicMult;
        const finalEnergyGained = Math.round(
          foodResult.energyGained * energyMultiplier
        );

        this.stats.energy = Math.min(
          this.stats.maxEnergy,
          this.stats.energy + finalEnergyGained
        );
        this.stats.foodEaten += foodResult.itemsEaten;
        const leveledUp = this.addAdn(foodResult.adnGained);
        if (!leveledUp && !isolatedNewGene) {
          this.setEventMessage(
            `+${foodResult.adnGained} ADN · +${finalEnergyGained} Energía`
          );
        }
        forceUIEmit = true;
      } else if (foodResult.blockedFoodKind === 'meat' && !this.recentEventMessage) {
        this.setEventMessage(
          'Necesitas Mandíbula Carnívora o Probóscide para digerir carne'
        );
        forceUIEmit = true;
      } else if (foodResult.blockedFoodKind === 'plant' && !this.recentEventMessage) {
        this.setEventMessage(
          'Dieta Carnívora: Evoluciona Boca Herbívora, Probóscide o Cloroplastos para digerir algas'
        );
        forceUIEmit = true;
      }

      if (chemoreceptorStacks > 0) {
        const chemoTarget = this.foodManager.findNearestTargetForChemoreceptor(
          this.player.position,
          this.stats.diet,
          hasChloroplast
        );
        this.player.updateChemoreceptorCompass(
          chemoTarget ? chemoTarget.position : null,
          chemoTarget ? chemoTarget.isGeneticNodule : false,
          this.elapsedActiveTime
        );
      } else {
        this.player.updateChemoreceptorCompass(null, false, this.elapsedActiveTime);
      }

      // 4B. Update 3D Abyssal Fossil Meteorites (Mecánica 1: Descubrimiento por Fósiles)
      if (!isCreatureStage) {
        const meteorResult = this.fossilMeteorManager.update(
          delta,
          this.elapsedActiveTime,
          this.player.position
        );
        if (meteorResult.crackedMeteorCount > 0) {
          for (let m = 0; m < meteorResult.crackedMeteorCount; m++) {
            this.discoverRandomFromMeteorite();
          }
          forceUIEmit = true;
        }
      }

      // 5. Update Trophic Ecosystem with Positional 3D Spike & New Weapon Mechanics
      const hasFrontSpikes =
        this.player.hasFrontSpikes() ||
        rotaryDrillStacks > 0 ||
        harpoonStacks > 0 ||
        needleProboscisStacks > 0;
      const hasRearOrFlankSpikes =
        this.player.hasRearOrFlankSpikes() ||
        silicaSpiculeStacks > 0 ||
        tailClubStacks > 0 ||
        acidBlisterStacks > 0;
      const canCounterAttack =
        hasFrontSpikes &&
        (moveResult.isBoosting || rotaryDrillStacks > 0 || harpoonStacks > 0);
      const effectiveRetaliationSpikes = hasRearOrFlankSpikes
        ? Math.max(
            2,
            spikeStacks + silicaSpiculeStacks + tailClubStacks + acidBlisterStacks
          )
        : 0;

      const canPredateHerbivores = hasJaw || hasProboscis;
      const canDevourWeakenedHunters =
        (this.stats.growthStage >= 3 || crusherStacks > 0) &&
        canPredateHerbivores &&
        moveResult.isBoosting;
      const canHuntWithGraspingArms =
        hasGraspingArms &&
        (isCreatureStage || this.stats.growthStage >= 2 || harpoonStacks > 0 || rotaryDrillStacks > 0) &&
        (moveResult.isBoosting || moveResult.isMoving);
      const isPlayerAirborne = this.player.heightOffset > 1.45;

      const ecosystemResult = this.predatorManager.update(
        delta,
        this.elapsedActiveTime,
        this.player.position,
        canCounterAttack,
        canPredateHerbivores,
        hasProboscis || needleProboscisStacks > 0,
        (killedPos, geneticTraits, speciesName) => {
          this.foodManager.spawnMeatDrop(killedPos);
          // Only drop a special Genetic Nodule if the dead creature carried a part still in 'locked_hidden' state
          const lockedTrait = geneticTraits
            .map((rawId) => normalizeAdaptationId(rawId))
            .find((normId) => {
              const slot = this.preparedEvolutionCatalog.find(
                (s) => s.id === normId
              );
              return (
                slot !== undefined &&
                slot.discoveryState === 'locked_hidden' &&
                !this.discoveredAdaptationIds.has(normId) &&
                slot.installedStacks === 0
              );
            });
          if (lockedTrait) {
            this.foodManager.spawnGeneticNodule(
              killedPos,
              lockedTrait,
              speciesName
            );
          }
        },
        this.player.getActivePoisonClouds(),
        electricPulseTriggered,
        9.5,
        canDevourWeakenedHunters,
        socializeTriggered,
        this.player.getActiveAcidProjectiles(),
        hasVocalCrest,
        canHuntWithGraspingArms,
        isPlayerAirborne,
        this.discoveredAdaptationIds,
        effectiveRetaliationSpikes
      );

      this.nearestSpeciesName = ecosystemResult.nearestSpeciesName;
      this.nearestPredatorState = ecosystemResult.nearestState;
      this.nearestPredatorDistance = ecosystemResult.nearestDistance;
      this.nearestHasUncataloguedGene =
        ecosystemResult.nearestHasUncataloguedGene;

      if (ecosystemResult.acidHitsPredatorCount > 0) {
        this.addAdn(ecosystemResult.acidHitAdnGained);
        this.setEventMessage(
          `¡Impacto de Escupitajo Ácido! Depredador repelido (+${ecosystemResult.acidHitAdnGained} ADN · Nódulo Genético liberado)`
        );
        forceUIEmit = true;
      }

      if (socializeTriggered) {
        if (ecosystemResult.socializedCount > 0) {
          this.addAdn(ecosystemResult.socialAdnGained);
          if (hasVocalCrest) {
            const energyRecovered = 15 * ecosystemResult.socializedCount;
            this.stats.energy = Math.min(
              this.stats.maxEnergy,
              this.stats.energy + energyRecovered
            );
            this.setEventMessage(
              `¡Alianza con Cresta Vocal Resonante! (+${ecosystemResult.socialAdnGained} ADN · +${energyRecovered} Energía)`
            );
          } else {
            this.setEventMessage(
              `¡Alianza Social establecida con Herbívoro Costero! (+${ecosystemResult.socialAdnGained} ADN de Alianza)`
            );
          }
          forceUIEmit = true;
        } else {
          const radiusText = hasVocalCrest ? '13.5m' : '8.5m';
          const rewardText = hasVocalCrest ? '+35 ADN' : '+20 ADN';
          this.setEventMessage(
            `Canto Social emitido: Acércate a un Herbívoro Costero (< ${radiusText}) para formar alianza (${rewardText})`
          );
          forceUIEmit = true;
        }
      }

      if (ecosystemResult.huntersDevoured > 0) {
        const energyBonus = hasProboscis
          ? Math.round(ecosystemResult.hunterEnergyGained * 1.25)
          : ecosystemResult.hunterEnergyGained;
        this.stats.energy = Math.min(
          this.stats.maxEnergy,
          this.stats.energy + energyBonus
        );
        if (needleProboscisStacks > 0) {
          this.stats.health = Math.min(
            this.stats.maxHealth,
            this.stats.health + 15
          );
          this.addAdn(6);
        }
        this.stats.foodEaten += ecosystemResult.huntersDevoured;
        this.addAdn(ecosystemResult.hunterAdnGained);
        this.setEventMessage(
          canHuntWithGraspingArms
            ? `¡Depredador abatido! (+${ecosystemResult.hunterAdnGained} ADN · Nódulo Genético liberado)`
            : `¡Depredador devorado! (+${ecosystemResult.hunterAdnGained} ADN · Nódulo Genético liberado)`
        );
        forceUIEmit = true;
      }

      if (
        ecosystemResult.stunnedPredatorsCount > 0 ||
        ecosystemResult.electrocutedHerbivoresCount > 0
      ) {
        if (ecosystemResult.electrocutedAdnGained > 0) {
          this.addAdn(ecosystemResult.electrocutedAdnGained);
        }
        const parts: string[] = [];
        if (ecosystemResult.stunnedPredatorsCount > 0) {
          parts.push(
            `${ecosystemResult.stunnedPredatorsCount} depredador(es) ATURDIDO(S) (3.2s)`
          );
        }
        if (ecosystemResult.electrocutedHerbivoresCount > 0) {
          parts.push(
            `${ecosystemResult.electrocutedHerbivoresCount} criatura(s) electrocutada(s) (+${ecosystemResult.electrocutedAdnGained} ADN)`
          );
        }
        this.setEventMessage(`Descarga Bioeléctrica: ${parts.join(' · ')}`);
        forceUIEmit = true;
      } else if (ecosystemResult.poisonedCount > 0 && !this.recentEventMessage) {
        this.setEventMessage(
          'Toxina activa: Depredador envenenado (-45% velocidad)'
        );
        forceUIEmit = true;
      }

      if (ecosystemResult.herbivoresHunted > 0) {
        const energyBonus = hasProboscis
          ? Math.round(ecosystemResult.herbivoreEnergyGained * 1.25)
          : ecosystemResult.herbivoreEnergyGained;

        this.stats.energy = Math.min(
          this.stats.maxEnergy,
          this.stats.energy + energyBonus
        );
        if (needleProboscisStacks > 0) {
          this.stats.health = Math.min(
            this.stats.maxHealth,
            this.stats.health + 10
          );
          this.addAdn(6);
        }
        this.stats.foodEaten += ecosystemResult.herbivoresHunted;
        const leveledUp = this.addAdn(ecosystemResult.herbivoreAdnGained);
        if (!leveledUp) {
          this.setEventMessage(
            `${isCreatureStage ? 'Herbívoro Costero' : 'Célula Filtradora'} devorado (+${ecosystemResult.herbivoreAdnGained} ADN · Nódulo Genético liberado)`
          );
        }
        forceUIEmit = true;
      } else if (
        ecosystemResult.blockedHerbivoreHunt &&
        !this.recentEventMessage
      ) {
        this.setEventMessage(
          'Sintetiza Mandíbula Carnívora o Probóscide (E) para depredar criaturas'
        );
        forceUIEmit = true;
      }

      if (ecosystemResult.repelledLeviathans > 0) {
        const leveledUp = this.addAdn(ecosystemResult.leviathanBonusAdn);
        if (!leveledUp) {
          this.setEventMessage(
            `Coloso Acorazado repelido (+${ecosystemResult.leviathanBonusAdn} ADN · Nódulo Genético liberado)`
          );
        }
        forceUIEmit = true;
      } else if (ecosystemResult.repelledHunters > 0) {
        if (ecosystemResult.leviathanBonusAdn > 0) {
          this.addAdn(ecosystemResult.leviathanBonusAdn);
        }
        if (needleProboscisStacks > 0) {
          this.stats.health = Math.min(
            this.stats.maxHealth,
            this.stats.health + 8
          );
          this.addAdn(6);
        }
        this.setEventMessage(
          'Contraataque defensivo: Depredador herido y Nódulo Genético liberado'
        );
        forceUIEmit = true;
      }

      if (ecosystemResult.totalDamageDealt > 0) {
        // Mucus gland: 40% chance that the bite slips off without dealing damage!
        const mucusSlipped = mucusGlandStacks > 0 && Math.random() < 0.4;
        if (mucusSlipped) {
          this.setEventMessage(
            '¡Mucílago Resbaladizo! El mordisco enemigo resbaló sin causar daño'
          );
          forceUIEmit = true;
        } else {
          const armorDamageRed = Math.min(
            0.75,
            (this.stats.defensePercent ?? 0) / 100
          );
          const frontalShieldRed = chitinShieldStacks > 0 ? 0.15 : 0;
          const totalRed = Math.min(0.8, armorDamageRed + frontalShieldRed);
          const effectiveDamage = Math.max(
            1,
            Math.floor(ecosystemResult.totalDamageDealt * (1 - totalRed))
          );

          this.stats.health = Math.max(0, this.stats.health - effectiveDamage);
          this.stats.damageFlashTime = 0.4;
          if (this.settings.screenShake && !this.settings.reducedMotion) {
            this.cameraController.triggerScreenShake(0.38, 0.32);
          }

          if (acidBlisterStacks > 0) {
            this.player.spawnPoisonCloud();
          }

          if (ecosystemResult.proboscisDrainedAdn > 0) {
            this.addAdn(ecosystemResult.proboscisDrainedAdn);
          }

          if (ecosystemResult.attackerPosition) {
            const baseKnockback =
              ecosystemResult.attackerSpeciesName === 'Megacélula Acorazada' ||
              ecosystemResult.attackerSpeciesName === 'Coloso Acorazado'
                ? 21
                : 16;
            const elasticBounceMult =
              this.stats.innateTrait === 'elastic_membrane' ? 1.28 : 1.0;
            const knockbackStrength =
              (mucusGlandStacks > 0 ? baseKnockback * 0.5 : baseKnockback) *
              elasticBounceMult;
            this.player.applyDamageKnockback(
              ecosystemResult.attackerPosition,
              knockbackStrength
            );
          }
          const attackerLabel =
            ecosystemResult.attackerSpeciesName ?? 'Depredador';
          const drainNote =
            ecosystemResult.proboscisDrainedAdn > 0
              ? ` · +${ecosystemResult.proboscisDrainedAdn} ADN succionado`
              : '';
          this.setEventMessage(
            `Ataque de ${attackerLabel} (-${effectiveDamage} Vida${drainNote})`
          );
          forceUIEmit = true;
        }
      }

      if (this.stats.damageFlashTime > 0) {
        this.stats.damageFlashTime = Math.max(
          0,
          this.stats.damageFlashTime - delta
        );
      }

      if (this.stats.health <= 0) {
        this.stats.health = 0;
        this.status = 'gameover';
        this.matingCallTimer = 0;
        this.player.hideMateCell();
        this.inputController.resetInputs();
        this.footerDeathCleanup();
        forceUIEmit = true;
      }

      this.cameraController.update(
        delta,
        this.player,
        false,
        this.elapsedActiveTime
      );
      this.environment.update(
        this.elapsedActiveTime,
        delta,
        this.player.position.x,
        this.player.position.z
      );

      if (this.eventMessageTimer > 0) {
        this.eventMessageTimer -= delta;
        if (this.eventMessageTimer <= 0) {
          this.recentEventMessage = null;
          forceUIEmit = true;
        }
      }

      if (this.unlockedBannerTimer > 0) {
        this.unlockedBannerTimer -= delta;
        if (this.unlockedBannerTimer <= 0) {
          this.unlockedBannerNotification = null;
          forceUIEmit = true;
        }
      }

      this.uiSyncAccumulator += delta;
      if (forceUIEmit || this.uiSyncAccumulator >= 0.08) {
        this.uiSyncAccumulator = 0;
        this.emitUISnapshot();
      }
    }

    this.renderer.render(this.environment.scene, this.cameraController.camera);
  }

  private footerDeathCleanup(): void {
    this.clearLocalStorage();
    this.setEventMessage('Organismo eliminado');
  }

  private setEventMessage(msg: string): void {
    this.recentEventMessage = msg;
    this.eventMessageTimer = 3.0;
  }

  private emitUISnapshot(): void {
    const questInfo = this.getActiveQuestInfo();
    const readyForLandTransition =
      this.stats.growthStage >= 5 ||
      this.stats.totalAdnEarned >= 320 ||
      this.completedQuestStep >= 4 ||
      this.stats.evolutionaryStage === 'creature_stage';

    this.onUISnapshot({
      status: this.status,
      hasSavedGame: this.hasSavedGame(),
      settings: { ...this.settings },
      stats: {
        ...this.stats,
        torsoRadii: [...this.stats.torsoRadii] as [number, number, number],
        placedOrgans: this.stats.placedOrgans.map((o) => ({ ...o })),
      },
      activeFoodCount: this.foodManager.getActiveCount(),
      totalFoodCapacity: GAME_CONFIG.FOOD.TOTAL_COUNT,
      predatorStates: [],
      nearestSpeciesName: this.nearestSpeciesName,
      nearestPredatorState: this.nearestPredatorState,
      nearestPredatorDistance: this.nearestPredatorDistance,
      nearestHasUncataloguedGene: this.nearestHasUncataloguedGene,
      currentBiomeName: this.currentBiomeName,
      activeQuestTitle: questInfo.title,
      activeQuestProgressText: questInfo.progressText,
      readyForLandTransition,
      recentEventMessage: this.recentEventMessage,
      unlockedBannerNotification: this.unlockedBannerNotification,
      evolutionSlots: this.preparedEvolutionCatalog.map((slot) => ({ ...slot })),
      selectedPlacedInstanceId: this.selectedPlacedInstanceId,
    });
  }

  private handleResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.cameraController.handleResize(width, height);
    this.renderer.setSize(width, height);
  }

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('keydown', this.boundEditorKeyDown);
    this.renderer.domElement.removeEventListener(
      'contextmenu',
      this.boundContextMenu
    );
    this.renderer.domElement.removeEventListener(
      'pointerdown',
      this.boundPointerDown
    );
    this.renderer.domElement.removeEventListener('wheel', this.boundWheel);
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.boundContextLost
    );

    this.inputController.dispose();
    this.timer.dispose();
    this.player.dispose();
    this.foodManager.dispose();
    this.fossilMeteorManager.dispose();
    this.predatorManager.dispose();
    this.environment.dispose();
    this.renderer.dispose();
  }
}
