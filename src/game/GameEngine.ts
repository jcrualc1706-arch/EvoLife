import * as THREE from 'three';
import { AmbientAudioManager, audioManager } from './AudioManager';
import { CameraController } from './CameraController';
import { GAME_CONFIG } from './config';
import {
  ADAPTATION_CATALOG,
  INITIAL_INSTALLED_ADAPTATIONS,
  MAX_CREATURE_COMPLEXITY,
  computeCreatureComplexity,
  computeCreatureStats,
  computeStackedMultiplier,
  getOrganComplexityCost,
  isArmAdaptation,
  isCellOnlyAdaptation,
  isFootAdaptation,
  isHandAdaptation,
  isLegAdaptation,
  normalizeAdaptationId,
} from './evolutionData';
import { FoodManager } from './FoodManager';
import { FossilMeteorManager } from './FossilMeteorManager';
import { InputController } from './InputController';
import { IntroCinematicController } from './IntroCinematicController';
import { MatingSequence } from './MatingSequence';
import { PlayerCell } from './PlayerCell';
import { KinCellEntity, PredatorManager } from './PredatorManager';

import {
  PLANET_CATALOG,
  SaveSystem,
  SlotSavePayload,
} from './SaveSystem';
import {
  CONTINENT_CONFIG,
  SceneEnvironment,
  getLandHeightAt,
} from './SceneEnvironment';
import { SolarSystemView } from './SolarSystemView';
import { TutorialManager } from './TutorialManager';
import {
  BrainCinematicState,
  CellBodyShape,
  CellColorTheme,
  CellularEvolutionSlot,
  CellularGrowthStage,
  CreatureBodyArchetype,
  CreatureMorphologySliders,
  CreaturePaintConfig,
  DEFAULT_CREATURE_MORPHOLOGY,
  DEFAULT_CREATURE_PAINT,
  DEFAULT_CREATURE_STATS,
  DEFAULT_GAME_SETTINGS,
  DEFAULT_ORGAN_MORPHOLOGY,
  DietType,
  DiscoveryState,
  EditorPreviewAction,
  EditorSelectionTarget,
  EvolutionaryStage,
  GameSettings,
  GameStatus,
  BodySegmentConfig,
  BodySegmentId,
  BODY_SEGMENT_ORDER,
  GameUISnapshot,
  GenesisConfig,
  InnateTraitId,
  InputState,
  IntroCinematicState,
  MORPHOLOGY_SCALE_LIMITS,
  PlacedOrganInstance,
  PlacedOrganMorphology,
  PlanetSlotMetadata,
  PlanetTheme,
  PlanetaryTransitionState,
  PlayerStats,
  PredatorBehaviorState,
  SpeciesType,
  SpineVertebraNode,
  StageEvolutionHistory,
  UnlockedBannerNotification,
  createDefaultBodySegments,
  createDefaultSpineNodes,
} from './types';

interface EditorHistorySnapshot {
  spineLength: number;
  spineSegments: 1 | 2 | 3;
  torsoRadii: [number, number, number];
  spineNodes: SpineVertebraNode[];
  bodySegments?: BodySegmentConfig[];
  creatureMorphology?: CreatureMorphologySliders;
  placedOrgans: PlacedOrganInstance[];
  paintConfig: CreaturePaintConfig;
  adn: number;
  bodyShape: CellBodyShape;
  colorTheme: CellColorTheme;
}

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly environment: SceneEnvironment;
  private readonly solarSystemView: SolarSystemView;
  private readonly player: PlayerCell;
  private readonly cameraController: CameraController;
  private readonly foodManager: FoodManager;
  private readonly fossilMeteorManager: FossilMeteorManager;
  private readonly predatorManager: PredatorManager;
  private readonly matingSequence: MatingSequence;
  private readonly inputController: InputController;
  private readonly introCinematicController: IntroCinematicController;
  private readonly timer: THREE.Timer;


  private status: GameStatus = 'menu';
  private activeSlotId = 1;
  private selectedMenuSlotId: number | null = null;
  private hoveredMenuSlotId: number | null = null;
  private planetSlots: PlanetSlotMetadata[] = [];
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
  private selectedBodySegmentId: BodySegmentId | null = 'pecho';
  private selectedSphereIndex: number | null = 2;
  private hoveredBodySegmentId: BodySegmentId | null = null;
  private editorSelectionTarget: EditorSelectionTarget = 'body';
  private organInstanceCounter = 1;
  private static readonly SETTINGS_STORAGE_KEY = 'evolife_settings_v1';
  private lastFrameExecutionMs = 0;
  private lastGameplayPointerPos = { x: 0, y: 0, active: false };

  // 3D Spore Workshop Interactive Raycasting & Drag State
  private readonly raycaster = new THREE.Raycaster();
  private readonly terrainRaycaster: THREE.Raycaster = new THREE.Raycaster();
  private readonly rayDownVector: THREE.Vector3 = new THREE.Vector3(0, -1, 0);
  private readonly pointerNdc = new THREE.Vector2();
  private readonly editorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly planeHitPoint = new THREE.Vector3();
  private draggingCatalogAdaptationId: string | null = null;
  private repositioningInstanceId: string | null = null;
  private repositionStartScreenPos = { x: 0, y: 0 };
  private isActivelyRepositioning = false;
  private draggingSpineArrow: 'arrow_front' | 'arrow_rear' | null = null;
  private draggingOrientationInstanceId: string | null = null;
  private draggingVertebraIndex: number | null = null;
  private vertebraDragStartClient = { x: 0, y: 0 };
  private vertebraDragStartNode: SpineVertebraNode | null = null;
  private vertebraDragStartNodes: SpineVertebraNode[] | null = null;
  private draggingLimbJointRole: 'proximal' | 'middle' | 'distal' | null = null;
  private limbJointDragStartClient = { x: 0, y: 0 };
  private limbJointDragStartMorph: PlacedOrganMorphology | null = null;
  private hoveredVertebraIndex: number | null = null;
  private hoveredVertebraSegmentIndex: 0 | 1 | 2 | null = null;
  private isRightClickOrbiting = false;
  private orbitLastClientPos = { x: 0, y: 0 };
  private readonly editorHistoryStack: EditorHistorySnapshot[] = [];
  private readonly editorRedoStack: EditorHistorySnapshot[] = [];
  private lastWheelHistoryTimestamp = 0;
  private editorPreviewAction: EditorPreviewAction = 'idle';

  private animationFrameId: number | null = null;
  private uiSyncAccumulator = 0;
  private elapsedActiveTime = 0;
  private electricCooldownTimer = 0;
  private poisonSpawnCooldownTimer = 0;
  private acidSpitCooldownTimer = 0;
  private socializeCooldownTimer = 0;
  private matingCallTimer = 0;
  public isMatingCallActive = false;
  public activeMate: KinCellEntity | null = null;
  private mateEchoPingTimer = 0;
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

  // Planetary Atmospheric Entry / Orbital Ascent Cinematic State
  private planetaryTransition: PlanetaryTransitionState | undefined = undefined;
  private introCinematicState: IntroCinematicState | undefined = undefined;
  private brainCinematicState: BrainCinematicState | undefined = undefined;
  private pendingTransitionAction: 'play_saved' | 'new_game' | 'exit_to_menu' | null =
    null;
  private pendingTransitionGenesis: GenesisConfig | undefined = undefined;
  private transitionSwitchedScene = false;

  // Autosave, Checkpoint Respawn & Death Cause Tracking
  private autosaveAccumulator = 0;
  private autosaveBadgeTimer = 0;
  private respawnInvulnerabilityTimer = 0;
  private lastAttackerSpeciesName: string | null = null;
  private deathCauseDescription = 'Colapso de la membrana celular';

  // DevTools / Debug Suite State
  public isGodModeActive = false;
  public isAIFrozen = false;

  // Resumen de Transición Evolutiva (Estilo Timeline de Spore)
  public isEvolutionSummaryOpen = false;
  public stageHistory: StageEvolutionHistory = {
    stageTimeSeconds: 0,
    microbesKilled: 0,
    plantsEaten: 0,
    meatsEaten: 0,
    partsDiscoveredCount: 0,
    editorVisitsCount: 0,
    finalCellSnapshotUrl: undefined,
    earnedTrait: 'omnivore',
  };

  // Gestor del Tutorial Interactivo Pos-Meteorito
  public readonly tutorialManager = new TutorialManager();

  // Gestor de Audio Ambiental ('burbujeo' y 'corrientes' según profundidad y actividad)
  public readonly ambientAudioManager = new AmbientAudioManager(audioManager);

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
    this.cameraController.initMouseListeners(this.renderer.domElement);
    this.foodManager = new FoodManager(this.environment.scene);
    this.foodManager.setObstacleQuery((x, z, r) =>
      this.environment.getNearbyObstacles(x, z, r)
    );
    this.fossilMeteorManager = new FossilMeteorManager(this.environment.scene);
    this.predatorManager = new PredatorManager(this.environment.scene);
    this.predatorManager.setPlayerCellRef(this.player);
    this.predatorManager.setObstacleQuery((x, z, r) =>
      this.environment.getNearbyObstacles(x, z, r)
    );
    this.matingSequence = new MatingSequence(
      this.environment.scene,
      this.cameraController,
      this.environment
    );
    this.inputController = new InputController(

      () => this.togglePause(),
      () => this.toggleEditor()
    );
    this.inputController.attachCanvas(
      this.renderer.domElement,
      (clientX, clientY, outWorldPos) => {
        if (
          this.status !== 'playing' ||
          this.matingCallTimer > 0 ||
          Boolean(this.planetaryTransition?.active)
        ) {
          return false;
        }
        if (!this.updateRaycasterFromClientCoords(clientX, clientY)) {
          return false;
        }
        outWorldPos.copy(this.planeHitPoint);
        return true;
      }
    );

    this.stats = this.createInitialStats();
    this.loadSettingsFromLocalStorage();
    this.applySettingsToEngine();
    this.planetSlots = SaveSystem.loadAllPlanetSlots();
    const colonizedSlots = this.planetSlots.filter((s) => s.hasSave);
    if (colonizedSlots.length > 0) {
      colonizedSlots.sort(
        (a, b) => (b.lastPlayedTimestamp ?? 0) - (a.lastPlayedTimestamp ?? 0)
      );
      this.activeSlotId = colonizedSlots[0].slotId;
    } else {
      this.activeSlotId = 1;
    }

    this.solarSystemView = new SolarSystemView(
      width,
      height,
      this.planetSlots,
      (selectedSlotId, hoveredSlotId) => {
        this.selectedMenuSlotId = selectedSlotId;
        this.hoveredMenuSlotId = hoveredSlotId;
        this.emitUISnapshot();
      }
    );

    this.introCinematicController = new IntroCinematicController(
      this.solarSystemView.scene,
      this.environment.scene
    );

    this.resetAdaptationStateToInitial();
    this.syncActivePlanetPalette(this.activeSlotId);
    this.loadFromLocalStorage(this.activeSlotId);
    this.syncCatalogAndOrganismState();
    this.syncWorldStageScale(this.stats.growthStage, true);
    this.introCinematicController.setMonumentCoreTheme(this.stats.colorTheme);
    this.introCinematicController.setPermanentMonumentVisible(
      this.stats.evolutionaryStage === 'cell_stage'
    );

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
    this.renderer.compile(
      this.solarSystemView.scene,
      this.solarSystemView.camera
    );

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
    if (stage === 1) return 110;
    if (stage === 2) return 165;
    if (stage === 3) return 220;
    if (stage === 4) return 275;
    return GAME_CONFIG.WORLD.ARENA_RADIUS;
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
    this.predatorManager.refreshAllKinClones(this.player);
    this.foodManager.setChloroplastTreeLocations(
      this.environment.getChloroplastTreePositions(activeRadius),
      activeRadius
    );
    if (reseedFood) {
      this.foodManager.resetAll();
    }
  }


  public get playerCell(): PlayerCell {
    return this.player;
  }

  public get playerStats(): PlayerStats {
    return this.stats;
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
        axialOffset: -1.0,
        mirrorSymmetry: false,
        orientationYaw: 0,
        orientationPitch: 0,
        morphology: { scaleOverall: 1.0, scaleWidth: 1.0, scaleHeight: 1.0 },
      },
      {
        instanceId: 'organ_init_eyes',
        adaptationId: 'eye_photoreceptor',
        angle: Math.PI * 0.82,
        axialOffset: -0.65,
        mirrorSymmetry: true,
        orientationYaw: 0,
        orientationPitch: 0,
        morphology: { scaleOverall: 1.0, scaleWidth: 1.0, scaleHeight: 1.0 },
      },
      {
        instanceId: 'organ_init_flagellum',
        adaptationId: 'simple_flagellum',
        angle: 0.0,
        axialOffset: 1.0,
        mirrorSymmetry: false,
        orientationYaw: 0,
        orientationPitch: 0,
        morphology: { scaleOverall: 1.0, scaleWidth: 1.0, scaleHeight: 1.0 },
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
    if (isLegAdaptation(id)) {
      const legAngles = [Math.PI * 0.42, Math.PI * 0.26, Math.PI * 0.56];
      const angle = legAngles[stackIndex % legAngles.length];
      return {
        angle,
        axialOffset: Math.cos(angle),
        mirrorSymmetry: true,
      };
    }
    if (isArmAdaptation(id)) {
      const armAngles = [Math.PI * 0.72, Math.PI * 0.58];
      const angle = armAngles[stackIndex % armAngles.length];
      return {
        angle,
        axialOffset: Math.cos(angle),
        mirrorSymmetry: true,
      };
    }
    if (isHandAdaptation(id)) {
      return {
        angle: Math.PI * 0.72,
        axialOffset: -0.62,
        mirrorSymmetry: true,
      };
    }
    if (isFootAdaptation(id)) {
      return {
        angle: Math.PI * 0.42,
        axialOffset: 0.25,
        mirrorSymmetry: true,
      };
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

    const initialOrgans = this.createDefaultPlacedOrgans(initialDiet);
    const initialSpineNodes = createDefaultSpineNodes(5, 1.0);

    return {
      speciesName: genesis?.speciesName?.trim().slice(0, 28) || 'Organismo Primigenio',
      bodyShape: genesis?.bodyShape ?? 'fusiforme',
      colorTheme: initialColor,
      spineSegments: 1,
      spineLength: 1.0,
      torsoRadii: [1.0, 1.0, 1.0],
      spineNodes: initialSpineNodes,
      bodySegments: createDefaultBodySegments(),
      creatureMorphology: { ...DEFAULT_CREATURE_MORPHOLOGY },
      paintConfig: { ...DEFAULT_CREATURE_PAINT },
      complexityScore: computeCreatureComplexity(initialSpineNodes.length, initialOrgans),
      maxComplexity: MAX_CREATURE_COMPLEXITY,
      symmetryEnabled: this.settings.autoBilateralSymmetry,
      placedOrgans: initialOrgans,
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
      activeArenaRadius: 110,
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
      creatureStats: { ...DEFAULT_CREATURE_STATS },
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
    const mouthAdaptationId =
      initialDiet === 'carnivore'
        ? 'mouth_jaw'
        : initialDiet === 'omnivore'
        ? 'mouth_proboscis'
        : 'mouth_filter';

    this.installedAdaptations = {
      [mouthAdaptationId]: 1,
      eye_photoreceptor: 1,
      simple_flagellum: 1,
    };
    this.unlockedSlotIds.clear();
    this.unlockedSlotIds.add(mouthAdaptationId);
    this.unlockedSlotIds.add('eye_photoreceptor');
    this.unlockedSlotIds.add('simple_flagellum');

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
    const initialMouthId =
      this.stats.diet === 'carnivore'
        ? 'mouth_jaw'
        : this.stats.diet === 'omnivore'
        ? 'mouth_proboscis'
        : 'mouth_filter';

    for (const [id, stacks] of Object.entries(this.installedAdaptations)) {
      if (stacks <= 0) continue;
      const initialBase =
        id === initialMouthId ||
        id === 'simple_flagellum' ||
        id === 'eye_photoreceptor'
          ? 1
          : 0;
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
    if (this.predatorManager) {
      this.predatorManager.refreshAllKinClones(this.player);
    }
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
      audioManager.playMeteorDiscovery();
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
      const payload: SlotSavePayload = {
        stats: {
          speciesName: this.stats.speciesName,
          bodyShape: this.stats.bodyShape,
          colorTheme: this.stats.colorTheme,
          spineSegments: this.stats.spineSegments,
          spineLength: this.stats.spineLength,
          torsoRadii: this.stats.torsoRadii,
          spineNodes: this.stats.spineNodes,
          bodySegments: this.stats.bodySegments,
          creatureMorphology: this.stats.creatureMorphology,
          paintConfig: this.stats.paintConfig,
          placedOrgans: this.stats.placedOrgans,
          evolutionaryStage: this.stats.evolutionaryStage,
          innateTrait: this.stats.innateTrait,
          diet: this.stats.diet,
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
        savedPosition: {
          x: this.player.position.x,
          z: this.player.position.z,
        },
      };
      this.planetSlots = SaveSystem.saveSlotPayload(this.activeSlotId, payload);
      this.solarSystemView?.syncSlots(this.planetSlots);
    } catch {
      // Ignore storage quota or private mode errors
    }
  }

  private loadFromLocalStorage(slotId = this.activeSlotId): void {
    try {
      const parsed = SaveSystem.loadSlotPayload(slotId);
      if (!parsed) {
        return;
      }
      this.activeSlotId = slotId;
      this.discoveredAdaptationIds.clear();

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
              upperJointAngle: THREE.MathUtils.clamp(
                Number(rawMorph?.upperJointAngle) || 0,
                -Math.PI * 0.48,
                Math.PI * 0.48
              ),
              middleJointAngle: THREE.MathUtils.clamp(
                Number(rawMorph?.middleJointAngle) || 0,
                -Math.PI * 0.55,
                Math.PI * 0.55
              ),
              boneLength: THREE.MathUtils.clamp(
                Number(rawMorph?.boneLength) || 1.0,
                0.55,
                1.85
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
              targetSegmentId:
                item.targetSegmentId === 'cabeza' ||
                item.targetSegmentId === 'cuello' ||
                item.targetSegmentId === 'pecho' ||
                item.targetSegmentId === 'abdomen' ||
                item.targetSegmentId === 'cola'
                  ? item.targetSegmentId
                  : undefined,
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

      if (
        Array.isArray(parsed.stats.spineNodes) &&
        parsed.stats.spineNodes.length >= 3
      ) {
        this.stats.spineNodes = parsed.stats.spineNodes.slice(0, 9).map((n) => ({
          x: Number(n.x) || 0,
          y: Number(n.y) || 0,
          z: Number(n.z) || 0,
          radius: THREE.MathUtils.clamp(Number(n.radius) || 1.0, 0.4, 2.5),
          pitch: Number(n.pitch) || 0,
          yaw: Number(n.yaw) || 0,
        }));
      } else {
        this.stats.spineNodes = createDefaultSpineNodes(5, this.stats.spineLength);
      }

      if (
        Array.isArray(parsed.stats.bodySegments) &&
        parsed.stats.bodySegments.length === 5
      ) {
        const defSegs = createDefaultBodySegments();
        this.stats.bodySegments = defSegs.map((def, i) => {
          const rawSeg = parsed.stats.bodySegments?.[i];
          if (!rawSeg) return def;
          return {
            id: def.id,
            label: def.label,
            radius: THREE.MathUtils.clamp(
              Number(rawSeg.radius) || def.radius,
              MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
              MORPHOLOGY_SCALE_LIMITS.bodySegment.max
            ),
            lengthZ: THREE.MathUtils.clamp(Number(rawSeg.lengthZ) || def.lengthZ, 0.5, 2.0),
            pitchAngle: THREE.MathUtils.clamp(Number(rawSeg.pitchAngle) || 0, -0.8, 0.8),
            yawAngle: THREE.MathUtils.clamp(Number(rawSeg.yawAngle) || 0, -0.6, 0.6),
          };
        });
      } else {
        this.stats.bodySegments = createDefaultBodySegments();
      }

      if (
        parsed.stats.creatureMorphology &&
        typeof parsed.stats.creatureMorphology === 'object'
      ) {
        const rawArch = parsed.stats.creatureMorphology.archetype;
        const validArch: CreatureBodyArchetype =
          rawArch === 'bipedo_agil' ||
          rawArch === 'cuadrupedo_robusto' ||
          rawArch === 'reptiliano_rastreador' ||
          rawArch === 'humanoide_erguido' ||
          rawArch === 'serpentino'
            ? rawArch
            : DEFAULT_CREATURE_MORPHOLOGY.archetype;
        this.stats.creatureMorphology = {
          archetype: validArch,
          heightScale: THREE.MathUtils.clamp(
            Number(parsed.stats.creatureMorphology.heightScale) || 1.0,
            0.7,
            1.6
          ),
          widthScale: THREE.MathUtils.clamp(
            Number(parsed.stats.creatureMorphology.widthScale) || 1.0,
            0.6,
            1.8
          ),
          musculatureScale: THREE.MathUtils.clamp(
            Number(parsed.stats.creatureMorphology.musculatureScale) || 1.0,
            0.7,
            1.9
          ),
        };
      } else {
        this.stats.creatureMorphology = { ...DEFAULT_CREATURE_MORPHOLOGY };
      }

      if (parsed.stats.paintConfig && typeof parsed.stats.paintConfig === 'object') {
        this.stats.paintConfig = {
          ...DEFAULT_CREATURE_PAINT,
          ...parsed.stats.paintConfig,
        };
      } else {
        this.stats.paintConfig = { ...DEFAULT_CREATURE_PAINT };
      }

      const evoStageRaw = parsed.stats.evolutionaryStage;
      const validEvoStage: EvolutionaryStage =
        evoStageRaw === 'creature_stage' ? 'creature_stage' : 'cell_stage';
      this.stats.evolutionaryStage = validEvoStage;

      if (validEvoStage === 'creature_stage') {
        for (const def of ADAPTATION_CATALOG) {
          if (def.stage === 'creature_stage' || !isCellOnlyAdaptation(def.id)) {
            this.discoveredAdaptationIds.add(def.id);
          }
        }
      }

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
      } else {
        this.completedQuestStep = 0;
      }

      this.player.applyMorphology(
        this.stats.bodyShape,
        this.stats.colorTheme,
        validEvoStage === 'creature_stage',
        this.stats.spineSegments,
        this.stats.spineLength,
        this.stats.torsoRadii,
        this.stats.spineNodes,
        this.stats.paintConfig,
        this.stats.bodySegments,
        this.stats.creatureMorphology
      );
      this.syncActivePlanetPalette(slotId);
      this.environment.setStageEnvironment(validEvoStage);
      this.predatorManager.setStageMode(validEvoStage);
      this.foodManager.setStageMode(validEvoStage);
      this.introCinematicController?.setMonumentCoreTheme(this.stats.colorTheme);
      this.introCinematicController?.setPermanentMonumentVisible(
        validEvoStage === 'cell_stage'
      );
      this.syncWorldStageScale(validStage, false);
      if (
        parsed.savedPosition &&
        typeof parsed.savedPosition.x === 'number' &&
        typeof parsed.savedPosition.z === 'number' &&
        !Number.isNaN(parsed.savedPosition.x) &&
        !Number.isNaN(parsed.savedPosition.z)
      ) {
        const maxSafeR = Math.max(12, this.stats.activeArenaRadius - 6);
        const rawX = parsed.savedPosition.x;
        const rawZ = parsed.savedPosition.z;
        const dist = Math.hypot(rawX, rawZ);
        if (dist > maxSafeR && dist > 0.01) {
          this.player.position.x = (rawX / dist) * maxSafeR;
          this.player.position.z = (rawZ / dist) * maxSafeR;
        } else {
          this.player.position.x = rawX;
          this.player.position.z = rawZ;
        }
      } else {
        this.player.position.x = 0;
        this.player.position.z = validEvoStage === 'creature_stage' ? 5.2 : 0;
      }
      this.player.position.y =
        validEvoStage === 'creature_stage'
          ? getLandHeightAt(this.player.position.x, this.player.position.z) +
            this.player.getGroundOffset()
          : GAME_CONFIG.WORLD.SWIM_PLANE_Y;
      this.player.group.position.copy(this.player.position);
      this.cameraController.resetImmediate(
        this.player.position,
        this.player.headingAngle,
        validEvoStage === 'creature_stage'
      );
      this.evaluateQuests(true);
      this.setEventMessage('Partida evolutiva restaurada automáticamente');
    } catch {
      // Ignore corrupt storage data
    }
  }

  private clearLocalStorage(slotId = this.activeSlotId): void {
    this.planetSlots = SaveSystem.deleteSlotSave(slotId);
    this.solarSystemView?.syncSlots(this.planetSlots);
  }

  public hasSavedGame(slotId?: number): boolean {
    if (typeof slotId === 'number') {
      return Boolean(
        this.planetSlots.find((s) => s.slotId === slotId && s.hasSave)
      );
    }
    return this.planetSlots.some((s) => s.hasSave);
  }

  public selectMenuPlanetSlot(slotId: number | null): void {
    this.solarSystemView.selectSlot(slotId);
  }

  public setMenuCameraMode(mode: 'title_menu' | 'planet_select'): void {
    this.solarSystemView.setMenuCameraMode(mode);
  }

  public deletePlanetSlot(slotId: number): void {
    this.planetSlots = SaveSystem.deleteSlotSave(slotId);
    this.solarSystemView.syncSlots(this.planetSlots);
    this.emitUISnapshot();
  }

  private syncActivePlanetPalette(slotId = this.activeSlotId): void {
    const slotMeta = this.planetSlots.find((s) => s.slotId === slotId);
    const catalogDef = PLANET_CATALOG.find((p) => p.slotId === slotId);
    const slotTheme: PlanetTheme =
      slotMeta?.planetTheme ?? catalogDef?.planetTheme ?? 'oceanic';
    this.environment.applyPlanetPalette(slotTheme);
  }

  private executePlayPlanetSlotImmediate(slotId: number): void {
    const safeSlot = Math.max(1, Math.min(6, Math.floor(slotId)));
    this.activeSlotId = safeSlot;
    this.syncActivePlanetPalette(safeSlot);
    this.loadFromLocalStorage(safeSlot);
    this.syncCatalogAndOrganismState();
    this.status = 'playing';
    this.player.setEditorMode(false);
    this.inputController.resetInputs();
    this.timer.update();
    const planetName =
      this.planetSlots.find((s) => s.slotId === safeSlot)?.planetName ||
      `Mundo ${safeSlot}`;
    this.setEventMessage(
      `${planetName}: Evolución reanudada (${this.stats.speciesName || 'Organismo Primigenio'})`
    );
  }

  private executeStartNewGameImmediate(
    genesisConfig?: GenesisConfig,
    slotId?: number
  ): void {
    const targetSlot =
      typeof slotId === 'number'
        ? Math.max(1, Math.min(6, Math.floor(slotId)))
        : this.selectedMenuSlotId ?? this.activeSlotId;
    this.activeSlotId = targetSlot;
    this.syncActivePlanetPalette(targetSlot);
    this.restartGame(genesisConfig);

    const config: GenesisConfig = genesisConfig ?? {
      speciesName: this.stats.speciesName,
      initialDiet: this.stats.diet,
      innateTrait: this.stats.innateTrait,
      bodyShape: this.stats.bodyShape,
      colorTheme: this.stats.colorTheme,
    };
    SaveSystem.createInitialSaveData(targetSlot, config);
    this.planetSlots = SaveSystem.loadAllPlanetSlots();
    this.solarSystemView?.syncSlots(this.planetSlots);
  }

  public playPlanetSlot(slotId: number): void {
    const safeSlot = Math.max(1, Math.min(6, Math.floor(slotId)));
    this.activeSlotId = safeSlot;

    if (this.status === 'menu') {
      const info = this.solarSystemView.getPlanetAtmosphereInfo(safeSlot);
      this.solarSystemView.selectSlot(safeSlot);
      this.pendingTransitionAction = 'play_saved';
      this.pendingTransitionGenesis = undefined;
      this.transitionSwitchedScene = false;
      this.planetaryTransition = {
        active: true,
        mode: 'entering_planet',
        progress: 0,
        atmosphereOverlayOpacity: 0,
        atmosphereColorHex: info.atmosphereColorHex,
        planetName: info.planetName,
      };
      this.emitUISnapshot();
      return;
    }

    this.executePlayPlanetSlotImmediate(safeSlot);
    this.emitUISnapshot();
  }

  public continueSavedGame(): void {
    const targetSlot = this.selectedMenuSlotId ?? this.activeSlotId;
    this.playPlanetSlot(targetSlot);
  }

  public startNewGame(genesisConfig?: GenesisConfig, slotId?: number): void {
    const targetSlot =
      typeof slotId === 'number'
        ? Math.max(1, Math.min(6, Math.floor(slotId)))
        : this.selectedMenuSlotId ?? this.activeSlotId;
    this.activeSlotId = targetSlot;

    // Initialize the new game species, world scale, and save slot
    this.executeStartNewGameImmediate(genesisConfig, targetSlot);
    // Launch the 3D Spore Panspermia New-Game Intro Cinematic
    this.startIntroCinematic(genesisConfig, targetSlot);
  }

  public startIntroCinematic(
    genesisConfig?: GenesisConfig,
    slotId?: number
  ): void {
    const targetSlot =
      typeof slotId === 'number'
        ? Math.max(1, Math.min(6, Math.floor(slotId)))
        : this.activeSlotId;
    this.activeSlotId = targetSlot;
    this.planetaryTransition = undefined;
    this.pendingTransitionAction = null;
    this.pendingTransitionGenesis = undefined;
    this.transitionSwitchedScene = false;

    const planetTransform =
      this.solarSystemView.getPlanetWorldTransform(targetSlot);
    this.introCinematicController.start(planetTransform, genesisConfig);

    this.status = 'intro_cinematic';
    this.inputController.resetInputs();
    this.timer.reset();
    this.timer.update();

    this.introCinematicState = {
      active: true,
      phase: 0,
      elapsed: 0,
      duration: IntroCinematicController.TOTAL_DURATION,
      fadeOpacity: 1.0,
      cloudOverlayOpacity: 0,
      splashOverlayOpacity: 0,
      atmosphereColorHex: planetTransform.atmosphereColorHex,
      planetName: planetTransform.planetName,
      speciesName: this.stats.speciesName || 'Organismo Primigenio',
      phaseTitle: `Sistema Planetario · ${planetTransform.planetName}`,
      phaseSubtitle:
        'Fragmentos portadores de compuestos prebióticos se aproximan desde el espacio profundo...',
    };

    this.emitUISnapshot();
  }

  public skipIntroCinematic(): void {
    if (this.status !== 'intro_cinematic') return;
    this.completeIntroCinematic(true);
  }

  public syncTutorialUI(): void {
    this.emitUISnapshot();
  }

  public onMeteorCinematicFinished(): void {
    this.tutorialManager.startAfterMeteor();
    this.syncTutorialUI();
  }

  public advanceTutorialFromVitals(): void {
    if (this.tutorialManager.acknowledgeVitalSigns()) {
      this.syncTutorialUI();
    }
  }

  public skipTutorial(): void {
    this.tutorialManager.completeTutorial();
    this.syncTutorialUI();
  }

  private completeIntroCinematic(skipped = false): void {
    this.introCinematicController.finishAndCleanUp(this.player.group);
    this.solarSystemView.restoreAfterIntroCinematic(this.planetSlots);
    this.introCinematicState = undefined;
    this.status = 'playing';

    this.player.position.set(0, GAME_CONFIG.WORLD.SWIM_PLANE_Y, 0);
    this.player.headingAngle = 0;
    this.cameraController.resetImmediate(
      this.player.position,
      this.player.headingAngle
    );
    this.inputController.resetInputs();
    this.timer.update();

    const planetName =
      this.planetSlots.find((s) => s.slotId === this.activeSlotId)?.planetName ||
      `Mundo ${this.activeSlotId}`;
    this.setEventMessage(
      skipped
        ? `¡Génesis completada en ${planetName}! ${this.stats.speciesName} emerge junto al meteorito de origen`
        : `¡Eclosión completada en ${planetName}! ${this.stats.speciesName} despierta en el océano primigenio`
    );
    this.onMeteorCinematicFinished();
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

    const info = this.solarSystemView.getPlanetAtmosphereInfo(this.activeSlotId);
    this.status = 'playing';
    this.pendingTransitionAction = 'exit_to_menu';
    this.transitionSwitchedScene = false;
    this.planetaryTransition = {
      active: true,
      mode: 'exiting_to_orbit',
      progress: 0,
      atmosphereOverlayOpacity: 0,
      atmosphereColorHex: info.atmosphereColorHex,
      planetName: info.planetName,
    };
    this.timer.update();
    this.emitUISnapshot();
  }

  public exitToMenuWithoutSaving(): void {
    if (this.status === 'editing' || this.matingCallTimer > 0) {
      this.setEditorSandboxIsolation(false);
      this.player.setEditorMode(false);
      this.cameraController.resetEditorOrbit();
    }
    this.matingCallTimer = 0;
    this.player.hideMateCell();
    this.inputController.resetInputs();

    // Reload persisted slot metadata without saving recent in-memory changes
    this.planetSlots = SaveSystem.loadAllPlanetSlots();
    this.solarSystemView?.syncSlots(this.planetSlots);

    const info = this.solarSystemView.getPlanetAtmosphereInfo(this.activeSlotId);
    this.status = 'playing';
    this.pendingTransitionAction = 'exit_to_menu';
    this.transitionSwitchedScene = false;
    this.planetaryTransition = {
      active: true,
      mode: 'exiting_to_orbit',
      progress: 0,
      atmosphereOverlayOpacity: 0,
      atmosphereColorHex: info.atmosphereColorHex,
      planetName: info.planetName,
    };
    this.timer.update();
    this.emitUISnapshot();
  }

  public manualSaveGame(): void {
    if (this.status === 'gameover' || this.stats.health <= 0) return;
    this.saveToLocalStorage();
    this.autosaveAccumulator = 0;
    this.autosaveBadgeTimer = 3.5;
    audioManager.playSaveConfirm();
    this.setEventMessage('¡Punto de guardado registrado en el planeta!');
    this.emitUISnapshot();
  }

  public respawnFromLastSave(): void {
    const existingPayload = SaveSystem.loadSlotPayload(this.activeSlotId);
    if (existingPayload) {
      this.loadFromLocalStorage(this.activeSlotId);
    }

    // Ensure healthy respawn vitals at checkpoint so the player never loops in starvation/death
    this.recalculateVitalCaps();
    this.stats.health = this.stats.maxHealth;
    this.stats.energy = Math.max(
      Math.round(this.stats.maxEnergy * 0.8),
      this.stats.energy
    );
    this.stats.isStarving = false;
    this.stats.damageFlashTime = 0;

    this.player.currentSpeed = 0;
    this.player.angularVelocity = 0;
    this.player.isBoosting = false;
    this.player.setEditorMode(false);
    this.player.hideMateCell();

    // Push away nearby predators and grant 3 seconds of blinking invulnerability
    this.predatorManager.clearThreatsAroundRespawn(this.player.position, 28.0);
    this.respawnInvulnerabilityTimer = 3.0;
    this.player.setInvulnerableBlinking(true);

    this.status = 'playing';
    this.matingCallTimer = 0;
    this.autosaveAccumulator = 0;
    if (this.stats.evolutionaryStage === 'creature_stage') {
      this.player.position.set(
        0,
        getLandHeightAt(0, 0) + this.player.getGroundOffset(),
        0
      );
      this.player.headingAngle = 0;
      this.player.mesh.rotation.y = 0; // Mirando hacia adelante (polo norte/eje Z)
      this.player.group.position.copy(this.player.position);
      this.cameraController.syncWithPlayerHeading(this.player.mesh.rotation.y);
    }
    this.cameraController.resetImmediate(
      this.player.position,
      this.player.headingAngle,
      this.stats.evolutionaryStage === 'creature_stage'
    );
    this.inputController.resetInputs();
    this.timer.update();

    // Persist the healthy respawn state immediately
    this.saveToLocalStorage();
    audioManager.playSaveConfirm();
    this.setEventMessage(
      'Reaparición en último punto de guardado (3s de invulnerabilidad activa)'
    );
    this.emitUISnapshot();
  }

  public exitToMenuFromDeath(): void {
    // Preserve the saved slot on the planet so the user can resume it later from the Solar System
    const existingPayload = SaveSystem.loadSlotPayload(this.activeSlotId);
    if (!existingPayload) {
      // If somehow no payload existed yet, restore health and save before exiting
      this.stats.health = this.stats.maxHealth;
      this.stats.energy = this.stats.maxEnergy;
      this.saveToLocalStorage();
    }

    this.respawnInvulnerabilityTimer = 0;
    this.player.setInvulnerableBlinking(false);
    this.matingCallTimer = 0;
    this.player.hideMateCell();
    this.player.setEditorMode(false);
    this.setEditorSandboxIsolation(false);
    this.inputController.resetInputs();

    this.planetSlots = SaveSystem.loadAllPlanetSlots();
    this.solarSystemView.syncSlots(this.planetSlots);
    this.status = 'menu';
    this.timer.update();
    audioManager.playMenuOpenClose();
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
    this.inputController.setSteeringMode(this.settings.steeringMode);
    this.environment.setParticleQuality(this.settings.graphicsQuality);
    this.environment.setUserFogDistancePercent(
      this.settings.fogDistancePercent
    );
    audioManager.syncSettings(
      this.settings.masterVolume,
      this.settings.sfxVolume,
      this.settings.threatAudioAlerts,
      this.settings.ambientVolume
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
    const plantigradeHealthBonus = this.getStacks('leg_plantigrade') * 15;
    const brawnyArmHealthBonus = this.getStacks('arm_brawny') * 10;

    this.stats.maxHealth =
      GAME_CONFIG.PLAYER.MAX_HEALTH +
      growthHealthBonus +
      armorHealthBonus +
      neutralizerBonus +
      hydrothermalCarapaceBonus +
      shieldPlateHealthBonus +
      plantigradeHealthBonus +
      brawnyArmHealthBonus;
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
    const brawnyArms = this.getStacks('arm_brawny');
    const prayingArms = this.getStacks('arm_praying');
    const talonHands = this.getStacks('hand_talons');
    const insectClawHands = this.getStacks('hand_insect_claw');
    const ungulateLegs = this.getStacks('leg_ungulate');
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
      brawnyArms * 10 +
      prayingArms * 18 +
      talonHands * 12 +
      insectClawHands * 14 +
      ungulateLegs * 8 +
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
    const reptilianLegRed = this.getStacks('leg_reptilian') * 10;
    const armoredArmRed = this.getStacks('arm_armored') * 12;
    const clawHandRed = insectClawHands * 5;
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
          reptilianLegRed +
          armoredArmRed +
          clawHandRed +
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

    // Compute Spore Terrestrial Creature Stage Stats (Locomoción, Combate, Social, Agarre)
    this.stats.creatureStats = computeCreatureStats((id) => this.getStacks(id));

    // Compute Spore Complexity Meter (Complejímetro: max 100)
    const activeNodes = this.stats.spineNodes?.length ?? 5;
    this.stats.complexityScore = computeCreatureComplexity(
      activeNodes,
      this.stats.placedOrgans
    );
    this.stats.maxComplexity = MAX_CREATURE_COMPLEXITY;
    this.stats.symmetryEnabled = this.settings.autoBilateralSymmetry;
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

  private captureEditorSnapshot(): EditorHistorySnapshot {
    const fallbackNodes =
      this.stats.spineNodes && this.stats.spineNodes.length >= 3
        ? this.stats.spineNodes
        : createDefaultSpineNodes(5, this.stats.spineLength);
    return {
      spineLength: this.stats.spineLength,
      spineSegments: this.stats.spineSegments,
      torsoRadii: [...this.stats.torsoRadii] as [number, number, number],
      spineNodes: fallbackNodes.map((n) => ({ ...n })),
      bodySegments: (this.stats.bodySegments ?? createDefaultBodySegments()).map((s) => ({ ...s })),
      creatureMorphology: {
        ...(this.stats.creatureMorphology ?? DEFAULT_CREATURE_MORPHOLOGY),
      },
      placedOrgans: this.stats.placedOrgans.map((o) => ({
        ...o,
        morphology: { ...(o.morphology ?? DEFAULT_ORGAN_MORPHOLOGY) },
      })),
      paintConfig: {
        ...(this.stats.paintConfig ?? DEFAULT_CREATURE_PAINT),
      },
      adn: this.stats.adn,
      bodyShape: this.stats.bodyShape,
      colorTheme: this.stats.colorTheme,
    };
  }

  private pushEditorHistorySnapshot(): void {
    if (this.status !== 'editing') return;
    this.editorHistoryStack.push(this.captureEditorSnapshot());
    if (this.editorHistoryStack.length > 20) {
      this.editorHistoryStack.shift();
    }
    this.editorRedoStack.length = 0;
  }

  private applyEditorSnapshot(snap: EditorHistorySnapshot): void {
    this.stats.spineLength = snap.spineLength;
    this.stats.spineSegments = snap.spineSegments;
    this.stats.torsoRadii = [...snap.torsoRadii] as [number, number, number];
    this.stats.spineNodes = snap.spineNodes.map((n) => ({ ...n }));
    if (snap.bodySegments) {
      this.stats.bodySegments = snap.bodySegments.map((s) => ({ ...s }));
    }
    if (snap.creatureMorphology) {
      this.stats.creatureMorphology = { ...snap.creatureMorphology };
    }
    this.stats.placedOrgans = snap.placedOrgans.map((o) => ({
      ...o,
      morphology: { ...(o.morphology ?? DEFAULT_ORGAN_MORPHOLOGY) },
    }));
    this.stats.paintConfig = { ...snap.paintConfig };
    this.stats.adn = snap.adn;
    this.stats.bodyShape = snap.bodyShape;
    this.stats.colorTheme = snap.colorTheme;

    if (
      this.selectedPlacedInstanceId &&
      !this.stats.placedOrgans.some(
        (o) => o.instanceId === this.selectedPlacedInstanceId
      )
    ) {
      this.selectedPlacedInstanceId = null;
    }

    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      this.stats.evolutionaryStage === 'creature_stage',
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii,
      this.stats.spineNodes,
      this.stats.paintConfig,
      this.stats.bodySegments,
      this.stats.creatureMorphology
    );
    this.syncCatalogAndOrganismState();
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public undoEditorAction(): void {
    if (this.status !== 'editing' || this.editorHistoryStack.length === 0) {
      return;
    }
    const previous = this.editorHistoryStack.pop()!;
    this.editorRedoStack.push(this.captureEditorSnapshot());
    if (this.editorRedoStack.length > 20) {
      this.editorRedoStack.shift();
    }
    audioManager.playButtonClick();
    this.applyEditorSnapshot(previous);
    this.setEventMessage('Acción deshecha [Ctrl+Z]');
    this.emitUISnapshot();
  }

  public redoEditorAction(): void {
    if (this.status !== 'editing' || this.editorRedoStack.length === 0) {
      return;
    }
    const next = this.editorRedoStack.pop()!;
    this.editorHistoryStack.push(this.captureEditorSnapshot());
    if (this.editorHistoryStack.length > 20) {
      this.editorHistoryStack.shift();
    }
    audioManager.playButtonClick();
    this.applyEditorSnapshot(next);
    this.setEventMessage('Acción rehecha [Ctrl+Y]');
    this.emitUISnapshot();
  }

  public setEditorPreviewAction(action: EditorPreviewAction): void {
    this.editorPreviewAction = action;
    this.player.setEditorPreviewAction(action);
    audioManager.playButtonClick();
    this.emitUISnapshot();
  }

  public selectPlacedOrgan(instanceId: string | null): void {
    this.selectedPlacedInstanceId = instanceId;
    if (instanceId !== null) {
      this.selectedBodySegmentId = null;
      this.selectedSphereIndex = null;
      this.player.setSelectedSphereIndex(null);
      const org = this.stats.placedOrgans.find(
        (o) => o.instanceId === instanceId
      );
      if (org) {
        const normId = normalizeAdaptationId(org.adaptationId);
        if (isLegAdaptation(normId) || isFootAdaptation(normId)) {
          this.editorSelectionTarget = 'legs';
        } else if (isArmAdaptation(normId) || isHandAdaptation(normId)) {
          this.editorSelectionTarget = 'arms';
        } else {
          this.editorSelectionTarget = 'body';
        }
        this.player.setEditorSelectionTarget(this.editorSelectionTarget);
      }
    }
    // Selección neutra: solo actualiza el resaltado visual del órgano sin recalcular ni alterar position.y
    this.player.setSelectedOrganInstanceId(this.selectedPlacedInstanceId);
    this.emitUISnapshot();
  }

  public selectBodySegment(segmentId: BodySegmentId | null): void {
    this.selectedBodySegmentId = segmentId;
    const idx =
      segmentId !== null ? BODY_SEGMENT_ORDER.indexOf(segmentId) : -1;
    this.selectedSphereIndex = idx >= 0 ? idx : null;

    if (segmentId !== null) {
      this.selectedPlacedInstanceId = null;
      this.editorSelectionTarget = 'body';
      this.player.setEditorSelectionTarget('body');
      this.player.setSelectedOrganInstanceId(null);
    }
    // Selección neutra: no toca position.y ni ejecuta funciones de auto-elevación de patas
    this.player.setSelectedBodySegment(segmentId);
    audioManager.playButtonClick();
    this.emitUISnapshot();
  }

  public selectBodySphere(sphereIndex: number | null): void {
    if (
      sphereIndex === null ||
      sphereIndex < 0 ||
      sphereIndex >= BODY_SEGMENT_ORDER.length
    ) {
      this.selectedSphereIndex = null;
      this.selectedBodySegmentId = null;
      this.player.setSelectedSphereIndex(null);
    } else {
      const safeIdx = Math.round(sphereIndex);
      this.selectedSphereIndex = safeIdx;
      this.selectedBodySegmentId = BODY_SEGMENT_ORDER[safeIdx];
      this.selectedPlacedInstanceId = null;
      this.editorSelectionTarget = 'body';
      this.player.setEditorSelectionTarget('body');
      this.player.setSelectedOrganInstanceId(null);
      this.player.setSelectedSphereIndex(safeIdx);
    }
    audioManager.playButtonClick();
    this.emitUISnapshot();
  }

  public setEditorSelectionTarget(target: EditorSelectionTarget): void {
    this.editorSelectionTarget = target;
    if (target === null) {
      this.selectedPlacedInstanceId = null;
      this.selectedBodySegmentId = null;
      this.selectedSphereIndex = null;
      this.player.setSelectedSphereIndex(null);
      this.player.setSelectedOrganInstanceId(null);
    } else if (target === 'body') {
      if (this.selectedSphereIndex === null) {
        this.selectedSphereIndex = 2; // 'pecho' por defecto
        this.selectedBodySegmentId = 'pecho';
        this.player.setSelectedSphereIndex(2);
      }
      if (this.selectedPlacedInstanceId) {
        const selOrg = this.stats.placedOrgans.find(
          (o) => o.instanceId === this.selectedPlacedInstanceId
        );
        if (
          selOrg &&
          (isLegAdaptation(selOrg.adaptationId) ||
            isFootAdaptation(selOrg.adaptationId) ||
            isArmAdaptation(selOrg.adaptationId) ||
            isHandAdaptation(selOrg.adaptationId))
        ) {
          this.selectedPlacedInstanceId = null;
          this.player.setSelectedOrganInstanceId(null);
        }
      }
    } else if (target === 'legs') {
      this.selectedBodySegmentId = null;
      this.selectedSphereIndex = null;
      this.player.setSelectedSphereIndex(null);
      const firstLeg = this.stats.placedOrgans.find((o) =>
        isLegAdaptation(o.adaptationId)
      );
      if (firstLeg && !this.selectedPlacedInstanceId) {
        this.selectedPlacedInstanceId = firstLeg.instanceId;
      }
      this.player.setSelectedOrganInstanceId(this.selectedPlacedInstanceId);
    } else if (target === 'arms') {
      this.selectedBodySegmentId = null;
      this.selectedSphereIndex = null;
      this.player.setSelectedSphereIndex(null);
      const firstArm = this.stats.placedOrgans.find((o) =>
        isArmAdaptation(o.adaptationId)
      );
      if (firstArm && !this.selectedPlacedInstanceId) {
        this.selectedPlacedInstanceId = firstArm.instanceId;
      }
      this.player.setSelectedOrganInstanceId(this.selectedPlacedInstanceId);
    }
    this.player.setEditorSelectionTarget(target);
    this.emitUISnapshot();
  }

  public getEditorSelectionTarget(): EditorSelectionTarget {
    return this.editorSelectionTarget;
  }

  public adjustBodySphereRadius(sphereIndex: number, delta: number): void {
    const safeIdx = THREE.MathUtils.clamp(Math.round(sphereIndex), 0, 4);
    this.player.adjustBodySphereRadius(safeIdx, delta);
    this.stats.bodySegments = this.player.getBodySegments();

    const seg = this.stats.bodySegments[safeIdx];
    const cab =
      this.stats.bodySegments.find((s) => s.id === 'cabeza')?.radius ?? 1.0;
    const pch =
      this.stats.bodySegments.find((s) => s.id === 'pecho')?.radius ?? 1.0;
    const col =
      this.stats.bodySegments.find((s) => s.id === 'cola')?.radius ?? 1.0;
    this.stats.torsoRadii = [
      THREE.MathUtils.clamp(
        cab,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.max
      ),
      THREE.MathUtils.clamp(
        pch,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.max
      ),
      THREE.MathUtils.clamp(
        col,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.max
      ),
    ];

    if (seg) {
      this.setEventMessage(
        `Radio de ${seg.label}: ${Math.round(seg.radius * 100)}% (Límites: 45% - 220%)`
      );
    }
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public adjustCreatureGroundHeight(deltaY: number): void {
    const nextY = this.player.adjustCreatureGroundHeight(deltaY);
    this.stats.bodyGroundOffsetY = this.player.bodyGroundOffsetY;
    this.setEventMessage(
      `Altura del Cuerpo sobre el Suelo: ${nextY.toFixed(2)}m`
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public adjustLimbThickness(limbId: string, delta: number): void {
    let targetLimbs: PlacedOrganInstance[] = [];
    let isLegGroup = true;

    if (limbId === 'legs' || limbId === 'arms') {
      isLegGroup = limbId === 'legs';
      targetLimbs = this.stats.placedOrgans.filter((o) => {
        const norm = normalizeAdaptationId(o.adaptationId);
        return isLegGroup ? isLegAdaptation(norm) : isArmAdaptation(norm);
      });
    } else {
      const specific = this.stats.placedOrgans.find(
        (o) => o.instanceId === limbId
      );
      if (specific) {
        const norm = normalizeAdaptationId(specific.adaptationId);
        if (isLegAdaptation(norm) || isFootAdaptation(norm)) {
          isLegGroup = true;
          targetLimbs = this.stats.placedOrgans.filter((o) =>
            isLegAdaptation(normalizeAdaptationId(o.adaptationId))
          );
        } else if (isArmAdaptation(norm) || isHandAdaptation(norm)) {
          isLegGroup = false;
          targetLimbs = this.stats.placedOrgans.filter((o) =>
            isArmAdaptation(normalizeAdaptationId(o.adaptationId))
          );
        } else {
          targetLimbs = [specific];
        }
      }
    }

    if (targetLimbs.length === 0) {
      this.setEventMessage(
        isLegGroup
          ? 'No hay piernas equipadas para escalar'
          : 'No hay brazos equipados para escalar'
      );
      this.emitUISnapshot();
      return;
    }

    let lastScalePct = 100;
    for (const limb of targetLimbs) {
      const cur = limb.morphology ?? { ...DEFAULT_ORGAN_MORPHOLOGY };
      const nextScaleOverall = THREE.MathUtils.clamp(
        (cur.scaleOverall ?? 1.0) + delta,
        MORPHOLOGY_SCALE_LIMITS.limbThickness.min,
        MORPHOLOGY_SCALE_LIMITS.limbThickness.max
      );
      const nextScaleWidth = THREE.MathUtils.clamp(
        (cur.scaleWidth ?? 1.0) + delta * 0.5,
        MORPHOLOGY_SCALE_LIMITS.limbThickness.min,
        MORPHOLOGY_SCALE_LIMITS.limbThickness.max
      );
      const nextBoneLength = THREE.MathUtils.clamp(
        (cur.boneLength ?? 1.0) + delta * 0.55,
        MORPHOLOGY_SCALE_LIMITS.limbThickness.min,
        MORPHOLOGY_SCALE_LIMITS.limbThickness.max
      );
      limb.morphology = {
        ...cur,
        scaleOverall: nextScaleOverall,
        scaleWidth: nextScaleWidth,
        boneLength: nextBoneLength,
      };
      lastScalePct = Math.round(nextScaleOverall * 100);
    }

    // Re-sync organs with recomputeBaseClearance = false so the creature height Y does not jump
    this.player.syncPlacedOrgans(
      this.stats.placedOrgans,
      this.selectedPlacedInstanceId,
      false
    );
    this.setEventMessage(
      isLegGroup
        ? `Grosor/Escala de Piernas: ${lastScalePct}% (Límites: 50% - 180%)`
        : `Grosor/Escala de Brazos: ${lastScalePct}% (Límites: 50% - 180%)`
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public adjustLimbScale(limbType: 'legs' | 'arms', deltaScale: number): void {
    this.adjustLimbThickness(limbType, deltaScale);
  }

  public updateBodySegment(
    segmentId: BodySegmentId,
    partial: Partial<BodySegmentConfig>
  ): void {
    const currentSegments =
      this.stats.bodySegments && this.stats.bodySegments.length === 5
        ? this.stats.bodySegments.map((s) => ({ ...s }))
        : createDefaultBodySegments();
    const idx = currentSegments.findIndex((s) => s.id === segmentId);
    if (idx === -1) return;

    const cur = currentSegments[idx];
    currentSegments[idx] = {
      ...cur,
      radius:
        partial.radius !== undefined
          ? THREE.MathUtils.clamp(
              partial.radius,
              MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
              MORPHOLOGY_SCALE_LIMITS.bodySegment.max
            )
          : cur.radius,
      lengthZ:
        partial.lengthZ !== undefined
          ? THREE.MathUtils.clamp(partial.lengthZ, 0.5, 2.0)
          : cur.lengthZ,
      pitchAngle:
        partial.pitchAngle !== undefined
          ? THREE.MathUtils.clamp(partial.pitchAngle, -0.8, 0.8)
          : cur.pitchAngle,
      yawAngle:
        partial.yawAngle !== undefined
          ? THREE.MathUtils.clamp(partial.yawAngle, -0.6, 0.6)
          : cur.yawAngle,
    };

    this.stats.bodySegments = currentSegments;

    // Keep legacy torsoRadii in sync for compatibility
    const cab = currentSegments.find((s) => s.id === 'cabeza')?.radius ?? 1.0;
    const pch = currentSegments.find((s) => s.id === 'pecho')?.radius ?? 1.0;
    const col = currentSegments.find((s) => s.id === 'cola')?.radius ?? 1.0;
    this.stats.torsoRadii = [
      THREE.MathUtils.clamp(
        cab,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.max
      ),
      THREE.MathUtils.clamp(
        pch,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.max
      ),
      THREE.MathUtils.clamp(
        col,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
        MORPHOLOGY_SCALE_LIMITS.bodySegment.max
      ),
    ];

    this.player.setBodySegments(currentSegments);
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public updateCreatureMorphology(
    partial: Partial<CreatureMorphologySliders>
  ): void {
    const isArchetypeChange = partial.archetype !== undefined;
    if (isArchetypeChange) {
      this.pushEditorHistorySnapshot();
      this.stats.bodyGroundOffsetY = 0;
      this.player.bodyGroundOffsetY = 0;
    }
    const cur = this.stats.creatureMorphology ?? {
      ...DEFAULT_CREATURE_MORPHOLOGY,
    };
    const next: CreatureMorphologySliders = {
      archetype: partial.archetype ?? cur.archetype,
      heightScale:
        partial.heightScale !== undefined
          ? THREE.MathUtils.clamp(partial.heightScale, 0.7, 1.6)
          : cur.heightScale,
      widthScale:
        partial.widthScale !== undefined
          ? THREE.MathUtils.clamp(partial.widthScale, 0.6, 1.8)
          : cur.widthScale,
      musculatureScale:
        partial.musculatureScale !== undefined
          ? THREE.MathUtils.clamp(partial.musculatureScale, 0.7, 1.9)
          : cur.musculatureScale,
    };
    this.stats.creatureMorphology = next;
    this.editorSelectionTarget = 'body';
    this.player.setEditorSelectionTarget('body');
    this.player.setCreatureMorphology(next, isArchetypeChange);
    this.saveToLocalStorage();
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

    const normId = normalizeAdaptationId(target.adaptationId);
    const isLimb =
      isLegAdaptation(normId) ||
      isArmAdaptation(normId) ||
      isFootAdaptation(normId) ||
      isHandAdaptation(normId);
    const scaleLimits = isLimb
      ? MORPHOLOGY_SCALE_LIMITS.limbThickness
      : MORPHOLOGY_SCALE_LIMITS.organScale;

    const cur = target.morphology ?? { ...DEFAULT_ORGAN_MORPHOLOGY };
    const nextMorph: PlacedOrganMorphology = {
      scaleOverall:
        partialMorphology.scaleOverall !== undefined
          ? THREE.MathUtils.clamp(
              partialMorphology.scaleOverall,
              scaleLimits.min,
              scaleLimits.max
            )
          : cur.scaleOverall,
      scaleWidth:
        partialMorphology.scaleWidth !== undefined
          ? THREE.MathUtils.clamp(
              partialMorphology.scaleWidth,
              scaleLimits.min,
              scaleLimits.max
            )
          : cur.scaleWidth,
      scaleHeight:
        partialMorphology.scaleHeight !== undefined
          ? THREE.MathUtils.clamp(
              partialMorphology.scaleHeight,
              MORPHOLOGY_SCALE_LIMITS.organScale.min,
              MORPHOLOGY_SCALE_LIMITS.organScale.max
            )
          : cur.scaleHeight,
      upperJointAngle:
        partialMorphology.upperJointAngle !== undefined
          ? THREE.MathUtils.clamp(
              partialMorphology.upperJointAngle,
              -Math.PI * 0.48,
              Math.PI * 0.48
            )
          : cur.upperJointAngle ?? 0,
      middleJointAngle:
        partialMorphology.middleJointAngle !== undefined
          ? THREE.MathUtils.clamp(
              partialMorphology.middleJointAngle,
              -Math.PI * 0.55,
              Math.PI * 0.55
            )
          : cur.middleJointAngle ?? 0,
      boneLength:
        partialMorphology.boneLength !== undefined
          ? THREE.MathUtils.clamp(
              partialMorphology.boneLength,
              MORPHOLOGY_SCALE_LIMITS.limbThickness.min,
              MORPHOLOGY_SCALE_LIMITS.limbThickness.max
            )
          : cur.boneLength ?? 1.0,
      colorOverride:
        'colorOverride' in partialMorphology
          ? partialMorphology.colorOverride
          : cur.colorOverride,
    };

    target.morphology = nextMorph;
    this.player.syncPlacedOrgans(
      this.stats.placedOrgans,
      this.selectedPlacedInstanceId,
      false
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
      this.selectedPlacedInstanceId,
      false
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public resetPlacedOrganMorphology(instanceId: string): void {
    const target = this.stats.placedOrgans.find(
      (o) => o.instanceId === instanceId
    );
    if (!target) return;

    this.pushEditorHistorySnapshot();
    target.orientationYaw = 0;
    target.orientationPitch = 0;
    target.localYaw = 0;
    target.localPitch = 0;
    target.morphology = { ...DEFAULT_ORGAN_MORPHOLOGY };

    this.player.syncPlacedOrgans(
      this.stats.placedOrgans,
      this.selectedPlacedInstanceId,
      false
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public removePlacedOrganByInstanceId(instanceId: string): boolean {
    const idx = this.stats.placedOrgans.findIndex(
      (o) => o.instanceId === instanceId
    );
    if (idx === -1) return false;

    this.pushEditorHistorySnapshot();
    const removed = this.stats.placedOrgans[idx];
    const removedNormId = normalizeAdaptationId(removed.adaptationId);
    const slot = this.preparedEvolutionCatalog.find(
      (s) => s.id === removedNormId
    );
    let totalRefundAdn = slot ? slot.costAdn : 0;

    this.stats.placedOrgans.splice(idx, 1);
    if (this.selectedPlacedInstanceId === instanceId) {
      this.selectedPlacedInstanceId = null;
    }

    // Cascade refund: if removing a leg or arm leaves excess attached feet or hands without a parent limb,
    // automatically detach and refund those dependent feet/hands to the player's DNA budget.
    let cascadedCount = 0;
    if (isLegAdaptation(removedNormId)) {
      const remainingLegs = this.stats.placedOrgans.filter((o) =>
        isLegAdaptation(o.adaptationId)
      ).length;
      for (let i = this.stats.placedOrgans.length - 1; i >= 0; i--) {
        const currentFeet = this.stats.placedOrgans.filter((o) =>
          isFootAdaptation(o.adaptationId)
        ).length;
        if (currentFeet <= remainingLegs) break;
        if (isFootAdaptation(this.stats.placedOrgans[i].adaptationId)) {
          const depOrg = this.stats.placedOrgans[i];
          const depSlot = this.preparedEvolutionCatalog.find(
            (s) => s.id === normalizeAdaptationId(depOrg.adaptationId)
          );
          totalRefundAdn += depSlot ? depSlot.costAdn : 0;
          if (this.selectedPlacedInstanceId === depOrg.instanceId) {
            this.selectedPlacedInstanceId = null;
          }
          this.stats.placedOrgans.splice(i, 1);
          cascadedCount++;
        }
      }
    } else if (isArmAdaptation(removedNormId)) {
      const remainingArms = this.stats.placedOrgans.filter((o) =>
        isArmAdaptation(o.adaptationId)
      ).length;
      for (let i = this.stats.placedOrgans.length - 1; i >= 0; i--) {
        const currentHands = this.stats.placedOrgans.filter((o) =>
          isHandAdaptation(o.adaptationId)
        ).length;
        if (currentHands <= remainingArms) break;
        if (isHandAdaptation(this.stats.placedOrgans[i].adaptationId)) {
          const depOrg = this.stats.placedOrgans[i];
          const depSlot = this.preparedEvolutionCatalog.find(
            (s) => s.id === normalizeAdaptationId(depOrg.adaptationId)
          );
          totalRefundAdn += depSlot ? depSlot.costAdn : 0;
          if (this.selectedPlacedInstanceId === depOrg.instanceId) {
            this.selectedPlacedInstanceId = null;
          }
          this.stats.placedOrgans.splice(i, 1);
          cascadedCount++;
        }
      }
    }

    this.stats.adn += totalRefundAdn;

    this.syncCatalogAndOrganismState();
    this.saveToLocalStorage();
    audioManager.playEvolutionRemove();
    if (slot) {
      const cascadeNote =
        cascadedCount > 0 ? ' (incluye extremidad distal acoplada)' : '';
      this.setEventMessage(
        `Pieza vendida: ${slot.name}${cascadeNote} (+${totalRefundAdn} ADN reembolsado)`
      );
    }
    this.emitUISnapshot();
    return true;
  }

  public setSpineLength(length: number): void {
    this.stats.spineLength = THREE.MathUtils.clamp(length, 0.75, 1.75);
    this.stats.spineSegments =
      this.stats.spineLength >= 1.32 ? 3 : this.stats.spineLength >= 1.12 ? 2 : 1;

    // Dynamically adjust active vertebra count (4..12) when extending/compressing spine
    const desiredCount = THREE.MathUtils.clamp(
      Math.round(4 + ((this.stats.spineLength - 0.75) / 1.0) * 8),
      4,
      12
    );
    const currentNodes =
      this.stats.spineNodes && this.stats.spineNodes.length >= 3
        ? [...this.stats.spineNodes]
        : createDefaultSpineNodes(6, this.stats.spineLength);

    if (desiredCount !== currentNodes.length) {
      // Resample existing posture & elliptical radii smoothly onto `desiredCount` vertebrae
      const resampled: SpineVertebraNode[] = [];
      const halfSpan = 0.86 * this.stats.spineLength;
      for (let i = 0; i < desiredCount; i++) {
        const t = desiredCount > 1 ? i / (desiredCount - 1) : 0.5;
        const srcIdxFloat = t * (currentNodes.length - 1);
        const idx0 = Math.floor(srcIdxFloat);
        const idx1 = Math.min(currentNodes.length - 1, idx0 + 1);
        const frac = srcIdxFloat - idx0;
        const n0 = currentNodes[idx0];
        const n1 = currentNodes[idx1];
        const interpRadius = THREE.MathUtils.lerp(n0.radius, n1.radius, frac);
        const interpRadiusX = THREE.MathUtils.lerp(
          n0.radiusX ?? n0.radius * 0.96,
          n1.radiusX ?? n1.radius * 0.96,
          frac
        );
        const interpRadiusY = THREE.MathUtils.lerp(
          n0.radiusY ?? n0.radius * 0.92,
          n1.radiusY ?? n1.radius * 0.92,
          frac
        );
        resampled.push({
          x: THREE.MathUtils.lerp(n0.x, n1.x, frac),
          y: THREE.MathUtils.lerp(n0.y, n1.y, frac),
          z: THREE.MathUtils.lerp(-halfSpan, halfSpan, t),
          radius: interpRadius,
          radiusX: interpRadiusX,
          radiusY: interpRadiusY,
          rotationRoll: THREE.MathUtils.lerp(
            n0.rotationRoll ?? 0,
            n1.rotationRoll ?? 0,
            frac
          ),
          pitch: THREE.MathUtils.lerp(n0.pitch, n1.pitch, frac),
          yaw: THREE.MathUtils.lerp(n0.yaw, n1.yaw, frac),
        });
      }
      this.stats.spineNodes = resampled;
    } else {
      const halfSpan = 0.86 * this.stats.spineLength;
      this.stats.spineNodes = currentNodes.map((n, i) => {
        const t = currentNodes.length > 1 ? i / (currentNodes.length - 1) : 0.5;
        return {
          ...n,
          z: THREE.MathUtils.lerp(-halfSpan, halfSpan, t),
        };
      });
    }

    this.recalculateVitalCaps();
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      this.stats.evolutionaryStage === 'creature_stage',
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii,
      this.stats.spineNodes,
      this.stats.paintConfig,
      this.stats.bodySegments
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public setVertebraCount(count: number): void {
    this.pushEditorHistorySnapshot();
    const safeCount = THREE.MathUtils.clamp(Math.round(count), 4, 12);
    const nextLen = THREE.MathUtils.clamp(
      0.75 + ((safeCount - 4) / 8) * 1.0,
      0.75,
      1.75
    );
    this.setSpineLength(nextLen);
  }

  public updateVertebraNode(
    index: number,
    partial: Partial<SpineVertebraNode>
  ): void {
    const nodes =
      this.stats.spineNodes && this.stats.spineNodes.length >= 3
        ? this.stats.spineNodes.map((n) => ({ ...n }))
        : createDefaultSpineNodes(6, this.stats.spineLength);
    if (index < 0 || index >= nodes.length) return;

    // Anti-buckling Z bounds: keep vertebra strictly between its anterior and posterior neighbors
    const minZ = index > 0 ? nodes[index - 1].z + 0.11 : -1.75;
    const maxZ = index < nodes.length - 1 ? nodes[index + 1].z - 0.11 : 1.75;

    const cur = nodes[index];
    const nextRadius =
      partial.radius !== undefined
        ? THREE.MathUtils.clamp(partial.radius, 0.35, 2.5)
        : cur.radius;
    const radiusRatio =
      cur.radius > 0.001 ? nextRadius / cur.radius : 1.0;

    nodes[index] = {
      x:
        partial.x !== undefined
          ? THREE.MathUtils.clamp(partial.x, -0.75, 0.75)
          : cur.x,
      y:
        partial.y !== undefined
          ? THREE.MathUtils.clamp(partial.y, -0.65, 1.35)
          : cur.y,
      z:
        partial.z !== undefined
          ? THREE.MathUtils.clamp(partial.z, minZ, maxZ)
          : THREE.MathUtils.clamp(cur.z, minZ, maxZ),
      radius: nextRadius,
      radiusX:
        partial.radiusX !== undefined
          ? THREE.MathUtils.clamp(partial.radiusX, 0.35, 2.5)
          : THREE.MathUtils.clamp(
              (cur.radiusX ?? cur.radius * 0.96) * radiusRatio,
              0.35,
              2.5
            ),
      radiusY:
        partial.radiusY !== undefined
          ? THREE.MathUtils.clamp(partial.radiusY, 0.35, 2.5)
          : THREE.MathUtils.clamp(
              (cur.radiusY ?? cur.radius * 0.92) * radiusRatio,
              0.35,
              2.5
            ),
      rotationRoll:
        partial.rotationRoll !== undefined
          ? partial.rotationRoll
          : cur.rotationRoll ?? 0,
      pitch:
        partial.pitch !== undefined
          ? THREE.MathUtils.clamp(partial.pitch, -Math.PI * 0.45, Math.PI * 0.45)
          : cur.pitch,
      yaw:
        partial.yaw !== undefined
          ? THREE.MathUtils.clamp(partial.yaw, -Math.PI * 0.45, Math.PI * 0.45)
          : cur.yaw,
    };

    // Sync legacy torsoRadii for compatibility
    const t = nodes.length > 1 ? index / (nodes.length - 1) : 0.5;
    const segIdx: 0 | 1 | 2 = t < 0.34 ? 0 : t > 0.66 ? 2 : 1;
    const nextRadii: [number, number, number] = [...this.stats.torsoRadii];
    nextRadii[segIdx] = THREE.MathUtils.clamp(nodes[index].radius, 0.6, 1.55);
    this.stats.torsoRadii = nextRadii;

    this.stats.spineNodes = nodes;
    this.player.setSpineNodes(nodes);
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public applySpinePosturePreset(
    preset: 'quadruped' | 'biped_upright' | 'predator_arch' | 'serpentine'
  ): void {
    this.pushEditorHistorySnapshot();
    const nodes =
      this.stats.spineNodes && this.stats.spineNodes.length >= 3
        ? this.stats.spineNodes.map((n) => ({ ...n }))
        : createDefaultSpineNodes(5, this.stats.spineLength);
    const halfSpan = 0.86 * this.stats.spineLength;

    for (let i = 0; i < nodes.length; i++) {
      const t = nodes.length > 1 ? i / (nodes.length - 1) : 0.5; // 0 = head, 1 = tail
      if (preset === 'biped_upright') {
        // Upright humanoid/bipedal posture: head elevated high, pelvis lower
        nodes[i].x = 0;
        nodes[i].y = THREE.MathUtils.lerp(1.05, -0.15, Math.pow(t, 0.85));
        nodes[i].z = THREE.MathUtils.lerp(-halfSpan * 0.55, halfSpan * 0.75, t);
        nodes[i].pitch = THREE.MathUtils.lerp(-0.55, 0.1, t);
      } else if (preset === 'predator_arch') {
        // Dorsal raptor arch: raised thorax, lowered prowling head and counterbalanced tail
        nodes[i].x = 0;
        nodes[i].y = Math.sin(t * Math.PI) * 0.52 + (1 - t) * 0.22;
        nodes[i].z = THREE.MathUtils.lerp(-halfSpan * 0.92, halfSpan * 0.95, t);
        nodes[i].pitch = Math.cos(t * Math.PI) * 0.32;
      } else if (preset === 'serpentine') {
        // S-curve lateral undulation
        nodes[i].x = Math.sin(t * Math.PI * 2) * 0.34;
        nodes[i].y = Math.cos(t * Math.PI) * 0.18;
        nodes[i].z = THREE.MathUtils.lerp(-halfSpan, halfSpan, t);
        nodes[i].yaw = Math.cos(t * Math.PI * 2) * 0.28;
      } else {
        // 'quadruped' horizontal neutral spine
        nodes[i].x = 0;
        nodes[i].y = Math.sin(t * Math.PI) * 0.08;
        nodes[i].z = THREE.MathUtils.lerp(-halfSpan, halfSpan, t);
        nodes[i].pitch = 0;
        nodes[i].yaw = 0;
      }
    }

    this.stats.spineNodes = nodes;
    this.player.setSpineNodes(nodes);

    // Also update 5-segment modular body posture (pitchAngle & yawAngle)
    const segs =
      this.stats.bodySegments && this.stats.bodySegments.length === 5
        ? this.stats.bodySegments.map((s) => ({ ...s }))
        : createDefaultBodySegments();
    for (const seg of segs) {
      if (preset === 'biped_upright') {
        if (seg.id === 'cuello') seg.pitchAngle = 0.48;
        else if (seg.id === 'cabeza') seg.pitchAngle = 0.28;
        else if (seg.id === 'pecho') seg.pitchAngle = 0.22;
        else if (seg.id === 'abdomen') seg.pitchAngle = -0.15;
        else if (seg.id === 'cola') seg.pitchAngle = 0.25;
        seg.yawAngle = 0;
      } else if (preset === 'predator_arch') {
        if (seg.id === 'cuello') seg.pitchAngle = 0.34;
        else if (seg.id === 'cabeza') seg.pitchAngle = -0.18;
        else if (seg.id === 'pecho') seg.pitchAngle = 0.08;
        else if (seg.id === 'abdomen') seg.pitchAngle = 0.14;
        else if (seg.id === 'cola') seg.pitchAngle = 0.36;
        seg.yawAngle = 0;
      } else if (preset === 'serpentine') {
        if (seg.id === 'cuello') {
          seg.pitchAngle = 0.12;
          seg.yawAngle = 0.28;
        } else if (seg.id === 'cabeza') {
          seg.pitchAngle = 0.05;
          seg.yawAngle = -0.22;
        } else if (seg.id === 'pecho') {
          seg.pitchAngle = 0;
          seg.yawAngle = 0.14;
        } else if (seg.id === 'abdomen') {
          seg.pitchAngle = 0.06;
          seg.yawAngle = -0.26;
        } else if (seg.id === 'cola') {
          seg.pitchAngle = 0.16;
          seg.yawAngle = 0.32;
        }
      } else {
        // 'quadruped' neutral posture
        seg.pitchAngle = 0;
        seg.yawAngle = 0;
      }
    }
    this.stats.bodySegments = segs;
    this.player.setBodySegments(segs);

    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public updatePaintConfig(partial: Partial<CreaturePaintConfig>): void {
    this.pushEditorHistorySnapshot();
    const current = this.stats.paintConfig ?? { ...DEFAULT_CREATURE_PAINT };
    const nextConfig: CreaturePaintConfig = {
      ...current,
      ...partial,
    };
    this.stats.paintConfig = nextConfig;
    this.player.applyPaintConfig(nextConfig);
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public toggleEditorSymmetry(): void {
    const nextSym = !this.settings.autoBilateralSymmetry;
    this.settings.autoBilateralSymmetry = nextSym;
    this.stats.symmetryEnabled = nextSym;
    this.saveSettingsToLocalStorage();
    audioManager.playButtonClick();
    this.setEventMessage(
      nextSym
        ? 'Simetría Bilateral [Tab / A]: ACTIVADA (Doble pieza en espejo)'
        : 'Simetría Bilateral [Tab / A]: DESACTIVADA (Pieza única / Asimétrica)'
    );
    this.emitUISnapshot();
  }

  public setTorsoRadius(segmentIndex: 0 | 1 | 2, radius: number): void {
    const clamped = THREE.MathUtils.clamp(radius, 0.4, 2.5);
    const nextRadii: [number, number, number] = [...this.stats.torsoRadii];
    nextRadii[segmentIndex] = THREE.MathUtils.clamp(clamped, 0.6, 1.55);
    this.stats.torsoRadii = nextRadii;

    // Also update corresponding nodes in spineNodes
    if (this.stats.spineNodes && this.stats.spineNodes.length >= 3) {
      const nodes = this.stats.spineNodes.map((n, idx, arr) => {
        const t = arr.length > 1 ? idx / (arr.length - 1) : 0.5;
        const nodeSeg: 0 | 1 | 2 = t < 0.34 ? 0 : t > 0.66 ? 2 : 1;
        if (nodeSeg === segmentIndex) {
          return { ...n, radius: clamped };
        }
        return { ...n };
      });
      this.stats.spineNodes = nodes;
    }

    // Also update corresponding 5-segment modular body nodes
    const segs =
      this.stats.bodySegments && this.stats.bodySegments.length === 5
        ? this.stats.bodySegments.map((s) => ({ ...s }))
        : createDefaultBodySegments();
    for (const seg of segs) {
      if (segmentIndex === 0 && (seg.id === 'cabeza' || seg.id === 'cuello')) {
        seg.radius = THREE.MathUtils.clamp(
          seg.id === 'cuello' ? clamped * 0.85 : clamped,
          0.4,
          2.0
        );
      } else if (
        segmentIndex === 1 &&
        (seg.id === 'pecho' || seg.id === 'abdomen')
      ) {
        seg.radius = THREE.MathUtils.clamp(clamped, 0.4, 2.0);
      } else if (segmentIndex === 2 && seg.id === 'cola') {
        seg.radius = THREE.MathUtils.clamp(clamped * 0.78, 0.4, 2.0);
      }
    }
    this.stats.bodySegments = segs;

    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      this.stats.evolutionaryStage === 'creature_stage',
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii,
      this.stats.spineNodes,
      this.stats.paintConfig,
      this.stats.bodySegments
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  private handleCanvasPointerDown(e: PointerEvent): void {
    audioManager.unlock();
    if (this.status === 'menu') {
      this.solarSystemView.handlePointerDown(e, this.renderer.domElement);
      return;
    }

    // Right mouse button (button === 2): manual 3D inspection orbit in Evolution Editor ONLY
    if (e.button === 2 && this.status === 'editing') {
      e.preventDefault();
      this.isRightClickOrbiting = true;
      this.orbitLastClientPos = { x: e.clientX, y: e.clientY };
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
    }

    if (this.status !== 'editing') return;

    if (e.button !== 0) return;

    this.updateRaycasterFromClientCoords(e.clientX, e.clientY);

    // 0A. Check if clicking one of the 3D Limb Joint Gizmo spheres ('proximal' | 'middle' | 'distal') on the selected limb
    const limbJointGizmos = this.player.getSelectedLimbJointGizmoObjects();
    if (limbJointGizmos.length > 0 && this.selectedPlacedInstanceId) {
      const jointHits = this.raycaster.intersectObjects(limbJointGizmos, true);
      if (jointHits.length > 0) {
        let jObj: THREE.Object3D | null = jointHits[0].object;
        while (jObj && !jObj.userData.limbJointRole) {
          jObj = jObj.parent;
        }
        const role = jObj?.userData.limbJointRole as
          | 'proximal'
          | 'middle'
          | 'distal'
          | undefined;
        if (role) {
          const targetOrg = this.stats.placedOrgans.find(
            (o) => o.instanceId === this.selectedPlacedInstanceId
          );
          if (targetOrg) {
            this.pushEditorHistorySnapshot();
            audioManager.playButtonClick();
            this.draggingLimbJointRole = role;
            this.limbJointDragStartClient = { x: e.clientX, y: e.clientY };
            this.limbJointDragStartMorph = {
              ...(targetOrg.morphology ?? DEFAULT_ORGAN_MORPHOLOGY),
            };
            this.renderer.domElement.style.cursor = 'grabbing';
            return;
          }
        }
      }
    }

    // 0B. Check if clicking the floating Spore Orientation Gizmo sphere in front of the selected organ
    const gizmoObj = this.player.getOrientationGizmoObject();
    if (gizmoObj && this.selectedPlacedInstanceId) {
      const gizmoHits = this.raycaster.intersectObject(gizmoObj, true);
      if (gizmoHits.length > 0) {
        this.pushEditorHistorySnapshot();
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
        this.pushEditorHistorySnapshot();
        audioManager.playButtonClick();
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
        // Alt + Left Click duplicates the clicked organ immediately if DNA & Complexity allow
        if (e.altKey) {
          const sourceOrg = this.stats.placedOrgans.find(
            (o) => o.instanceId === hitInstanceId
          );
          if (sourceOrg) {
            const slotId = normalizeAdaptationId(sourceOrg.adaptationId);
            const slot = this.preparedEvolutionCatalog.find(
              (s) => s.id === slotId
            );
            const currentStacks = this.installedAdaptations[slotId] ?? 0;
            const effectiveSymmetry = this.settings.autoBilateralSymmetry
              ? sourceOrg.mirrorSymmetry
              : false;
            const addedComplexity = getOrganComplexityCost(
              slotId,
              effectiveSymmetry
            );
            const currentComplexity = this.stats.complexityScore ?? 0;

            if (slot && currentStacks >= slot.maxStacks) {
              this.setEventMessage(
                `Máximo de copias alcanzado para ${slot.name} (${slot.maxStacks}/${slot.maxStacks})`
              );
              this.emitUISnapshot();
              return;
            }
            if (slot && this.stats.adn < slot.costAdn) {
              this.setEventMessage(
                `ADN insuficiente para duplicar ${slot.name} (Requiere ${slot.costAdn} ADN)`
              );
              this.emitUISnapshot();
              return;
            }
            if (currentComplexity + addedComplexity > MAX_CREATURE_COMPLEXITY) {
              this.setEventMessage(
                'Complejímetro al 100%: No se puede duplicar la pieza'
              );
              this.emitUISnapshot();
              return;
            }
            if (slot) {
              this.pushEditorHistorySnapshot();
              this.stats.adn -= slot.costAdn;
              const dupInstance: PlacedOrganInstance = {
                instanceId: `organ_${slot.id}_dup_${Date.now()}_${this.organInstanceCounter++}`,
                adaptationId: slot.id,
                angle: sourceOrg.angle + 0.14,
                axialOffset: THREE.MathUtils.clamp(
                  sourceOrg.axialOffset + 0.12,
                  -0.96,
                  0.96
                ),
                mirrorSymmetry: effectiveSymmetry,
                orientationYaw: sourceOrg.orientationYaw ?? 0,
                orientationPitch: sourceOrg.orientationPitch ?? 0,
                localYaw: sourceOrg.localYaw ?? 0,
                localPitch: sourceOrg.localPitch ?? 0,
                morphology: {
                  ...(sourceOrg.morphology ?? DEFAULT_ORGAN_MORPHOLOGY),
                },
              };
              this.stats.placedOrgans.push(dupInstance);
              this.selectedPlacedInstanceId = dupInstance.instanceId;
              this.syncCatalogAndOrganismState();
              audioManager.playEvolutionEquip();
              this.setEventMessage(
                `Pieza duplicada [Alt+Arrastrar]: ${slot.name} (-${slot.costAdn} ADN)`
              );
              this.repositioningInstanceId = dupInstance.instanceId;
              this.repositionStartScreenPos = { x: e.clientX, y: e.clientY };
              this.isActivelyRepositioning = true;
              this.emitUISnapshot();
              return;
            }
          }
        }

        this.pushEditorHistorySnapshot();
        audioManager.playButtonClick();
        this.selectPlacedOrgan(hitInstanceId);
        this.repositioningInstanceId = hitInstanceId;
        this.repositionStartScreenPos = { x: e.clientX, y: e.clientY };
        this.isActivelyRepositioning = false;
        return;
      }
    }

    // 3. Check if clicking one of the internal vertebrae hit spheres directly (starts 3D Vertebra Flexion Drag)
    const vertebraHits = this.raycaster.intersectObjects(
      this.player.getVertebraObjects(),
      false
    );
    if (vertebraHits.length > 0) {
      const vObj = vertebraHits[0].object;
      const vIdx =
        typeof vObj.userData.vertebraIndex === 'number'
          ? (vObj.userData.vertebraIndex as number)
          : null;
      const segIdx =
        typeof vObj.userData.spineSegmentIndex === 'number'
          ? (vObj.userData.spineSegmentIndex as 0 | 1 | 2)
          : null;
      this.hoveredVertebraIndex = vIdx;
      this.hoveredVertebraSegmentIndex = segIdx;
      this.player.setHoveredSpineControl(null, vIdx);

      if (vIdx !== null && this.stats.spineNodes && this.stats.spineNodes[vIdx]) {
        this.pushEditorHistorySnapshot();
        audioManager.playButtonClick();
        this.draggingVertebraIndex = vIdx;
        this.vertebraDragStartClient = { x: e.clientX, y: e.clientY };
        this.vertebraDragStartNode = { ...this.stats.spineNodes[vIdx] };
        this.vertebraDragStartNodes = this.stats.spineNodes.map((n) => ({
          ...n,
        }));
        this.renderer.domElement.style.cursor = 'grabbing';
      }
      return;
    }

    // 4. Check if clicking one of the 5 modular body spheres ('cabeza' | 'cuello' | 'pecho' | 'abdomen' | 'cola') or cellular capsule
    const segmentHits = this.raycaster.intersectObjects(
      this.player.getBodySegmentObjects(),
      false
    );
    if (segmentHits.length > 0) {
      const segObj = segmentHits[0].object;
      const sphereIdx =
        typeof segObj.userData.sphereIndex === 'number'
          ? (segObj.userData.sphereIndex as number)
          : undefined;
      const segId =
        (segObj.userData.bodySegmentId as BodySegmentId | undefined) ?? 'pecho';

      if (sphereIdx !== undefined) {
        this.selectBodySphere(sphereIdx);
      } else {
        this.selectBodySegment(segId);
      }
      // Selección neutra: NO altera position.y ni ejecuta funciones de auto-elevación de patas
      return;
    }

    // Clicked empty space on podium/canvas: deselect current placed organ, body sphere & contextual target neutrally
    if (this.selectedPlacedInstanceId !== null) {
      this.selectPlacedOrgan(null);
    }
    if (this.selectedSphereIndex !== null || this.selectedBodySegmentId !== null) {
      this.selectBodySphere(null);
    }
    this.setEditorSelectionTarget(null);
  }

  private handleWindowPointerMove(e: PointerEvent): void {
    if (!this.isRightClickOrbiting) {
      this.lastGameplayPointerPos = {
        x: e.clientX,
        y: e.clientY,
        active: true,
      };
    }

    if (this.status === 'menu') {
      this.solarSystemView.handlePointerMove(e, this.renderer.domElement);
      return;
    }

    // Manual 3D Camera Orbit in Editor mode while holding Right Click
    if (this.isRightClickOrbiting) {
      if ((e.buttons & 2) === 0 || this.status !== 'editing') {
        this.isRightClickOrbiting = false;
        this.renderer.domElement.style.cursor = 'default';
      } else {
        const rawDx = e.clientX - this.orbitLastClientPos.x;
        const rawDy = e.clientY - this.orbitLastClientPos.y;
        const dx = rawDx !== 0 ? rawDx : e.movementX || 0;
        const dy = rawDy !== 0 ? rawDy : e.movementY || 0;
        this.orbitLastClientPos = { x: e.clientX, y: e.clientY };
        const inv = this.settings.invertEditorCamera ? -1 : 1;

        this.cameraController.orbitEditorCamera(
          -dx * 0.0075 * inv,
          dy * 0.0065 * inv
        );
        return;
      }
    }

    if (this.status !== 'editing') return;

    // Case 0A: Dragging a 3D Limb Joint Gizmo ring ('proximal' | 'middle' | 'distal')
    if (
      this.draggingLimbJointRole &&
      this.selectedPlacedInstanceId &&
      this.limbJointDragStartMorph
    ) {
      const dx = e.clientX - this.limbJointDragStartClient.x;
      const dy = e.clientY - this.limbJointDragStartClient.y;
      if (this.draggingLimbJointRole === 'proximal') {
        const baseUpper = this.limbJointDragStartMorph.upperJointAngle ?? 0;
        this.updatePlacedOrganMorphology(this.selectedPlacedInstanceId, {
          upperJointAngle: baseUpper - dy * 0.01 + dx * 0.005,
        });
      } else if (this.draggingLimbJointRole === 'middle') {
        const baseMiddle = this.limbJointDragStartMorph.middleJointAngle ?? 0;
        this.updatePlacedOrganMorphology(this.selectedPlacedInstanceId, {
          middleJointAngle: baseMiddle + dy * 0.012 + dx * 0.006,
        });
      } else if (this.draggingLimbJointRole === 'distal') {
        const baseLen = this.limbJointDragStartMorph.boneLength ?? 1.0;
        this.updatePlacedOrganMorphology(this.selectedPlacedInstanceId, {
          boneLength: baseLen + (dx - dy) * 0.006,
        });
      }
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
    }

    // Case 0B: Dragging an internal vertebra in 3D space with Gaussian Falloff to neighboring vertebrae
    if (
      this.draggingVertebraIndex !== null &&
      this.vertebraDragStartNode !== null
    ) {
      const dyScreen = e.clientY - this.vertebraDragStartClient.y;
      const dxScreen = e.clientX - this.vertebraDragStartClient.x;
      const deltaY = -dyScreen * 0.0075;
      const deltaX = this.settings.autoBilateralSymmetry
        ? 0
        : dxScreen * 0.006;
      const deltaPitch = -dyScreen * 0.005;

      const baseNodes =
        this.vertebraDragStartNodes &&
        this.vertebraDragStartNodes.length ===
          (this.stats.spineNodes?.length ?? 0)
          ? this.vertebraDragStartNodes
          : this.stats.spineNodes ?? [];

      if (baseNodes.length >= 3) {
        // Discrete Gaussian damping (selected: 1.0, direct neighbor: 0.45, next neighbor: 0.15)
        const nextNodes: SpineVertebraNode[] = baseNodes.map((startNode, i) => {
          const dist = Math.abs(i - this.draggingVertebraIndex!);
          let weight = 0;
          if (dist === 0) {
            weight = 1.0;
          } else if (dist === 1) {
            weight = 0.45;
          } else if (dist === 2) {
            weight = 0.15;
          } else {
            weight = Math.max(0, 0.15 * Math.pow(0.3, dist - 2));
          }
          return {
            ...startNode,
            x: this.settings.autoBilateralSymmetry
              ? 0
              : THREE.MathUtils.clamp(
                  startNode.x + deltaX * weight,
                  -0.65,
                  0.65
                ),
            y: THREE.MathUtils.clamp(
                startNode.y + deltaY * weight,
                -0.55,
                1.35
              ),
            pitch: THREE.MathUtils.clamp(
              startNode.pitch + deltaPitch * weight,
              -Math.PI * 0.42,
              Math.PI * 0.42
            ),
          };
        });
        this.stats.spineNodes = nextNodes;
        this.player.setSpineNodes(nextNodes);
        this.emitUISnapshot();
      } else {
        const nextY = THREE.MathUtils.clamp(
          this.vertebraDragStartNode.y + deltaY,
          -0.55,
          1.35
        );
        const nextX = this.settings.autoBilateralSymmetry
          ? 0
          : THREE.MathUtils.clamp(
              this.vertebraDragStartNode.x + deltaX,
              -0.65,
              0.65
            );
        const nextPitch = THREE.MathUtils.clamp(
          deltaPitch,
          -Math.PI * 0.42,
          Math.PI * 0.42
        );
        this.updateVertebraNode(this.draggingVertebraIndex, {
          x: nextX,
          y: nextY,
          pitch: nextPitch,
        });
      }
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
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
          this.selectedPlacedInstanceId,
          false
        );
      }
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
    }

    // Case A: Dragging a 3D Spine Stretch Arrow to elongate/shorten the torso and add/fuse vertebrae
    if (this.draggingSpineArrow) {
      const localPt = this.planeHitPoint.clone();
      this.player.group.worldToLocal(localPt);
      const end = this.draggingSpineArrow === 'arrow_front' ? 'head' : 'tail';
      const tractionRes = this.player.handleSpineTractionDrag(end, localPt.z);
      if (tractionRes.changed) {
        this.stats.spineNodes = this.player.getSpineNodes();
        const firstZ = this.stats.spineNodes[0]?.z ?? -1;
        const lastZ =
          this.stats.spineNodes[this.stats.spineNodes.length - 1]?.z ?? 1;
        this.stats.spineLength = THREE.MathUtils.clamp(
          (lastZ - firstZ) * 0.58,
          0.75,
          1.75
        );
        this.recalculateVitalCaps();
        this.emitUISnapshot();
      } else {
        const targetLen = THREE.MathUtils.clamp(
          (Math.abs(localPt.z) - 0.45) / 1.38,
          0.75,
          1.75
        );
        this.setSpineLength(targetLen);
      }
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
      const addedComplexity = getOrganComplexityCost(
        this.draggingCatalogAdaptationId,
        effectiveSymmetry
      );
      const withinComplexity =
        (this.stats.complexityScore ?? 0) + addedComplexity <=
        MAX_CREATURE_COMPLEXITY;
      const canInstall =
        Boolean(slot) &&
        slot!.discoveryState !== 'locked_hidden' &&
        slot!.installedStacks < slot!.maxStacks &&
        this.stats.adn >= slot!.costAdn &&
        withinComplexity &&
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
            let deltaAngle = proj.angle - targetOrg.angle;
            while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
            while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
            targetOrg.angle += deltaAngle * 0.55;
            targetOrg.axialOffset = THREE.MathUtils.lerp(
              targetOrg.axialOffset,
              proj.axialOffset,
              0.55
            );
            targetOrg.mirrorSymmetry = effectiveSymmetry;
            targetOrg.vertebraIndex = proj.vertebraIndex;
            targetOrg.axialT = proj.axialT;
            targetOrg.surfaceAngle = proj.surfaceAngle;
            targetOrg.targetSegmentId = proj.targetSegmentId;
            this.player.syncPlacedOrgans(
              this.stats.placedOrgans,
              this.selectedPlacedInstanceId,
              false
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

    // Case D: Hover feedback on Limb Joint Gizmos, Orientation Gizmo, 3D Spine Arrows & Internal Vertebrae
    const limbGizmos = this.player.getSelectedLimbJointGizmoObjects();
    if (limbGizmos.length > 0) {
      const jHits = this.raycaster.intersectObjects(limbGizmos, true);
      if (jHits.length > 0) {
        this.renderer.domElement.style.cursor = 'grab';
        return;
      }
    }

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

    // Direct non-recursive Raycast against the lightweight internal vertebra hit spheres
    const vertebraHits = this.raycaster.intersectObjects(
      this.player.getVertebraObjects(),
      false
    );
    if (vertebraHits.length > 0) {
      const vObj = vertebraHits[0].object;
      const vIdx =
        typeof vObj.userData.vertebraIndex === 'number'
          ? (vObj.userData.vertebraIndex as number)
          : null;
      const segIdx =
        typeof vObj.userData.spineSegmentIndex === 'number'
          ? (vObj.userData.spineSegmentIndex as 0 | 1 | 2)
          : null;
      this.hoveredVertebraIndex = vIdx;
      this.hoveredVertebraSegmentIndex = segIdx;
      this.player.setHoveredSpineControl(null, vIdx);
      this.renderer.domElement.style.cursor = 'grab';
      return;
    }

    // Check hover over the 5 modular body segments for wireframe contour feedback
    const segmentHits = this.raycaster.intersectObjects(
      this.player.getBodySegmentObjects(),
      false
    );
    if (segmentHits.length > 0) {
      const segId =
        (segmentHits[0].object.userData.bodySegmentId as
          | BodySegmentId
          | undefined) ?? null;
      this.hoveredBodySegmentId = segId;
      this.player.setHoveredBodySegment(segId);
      this.hoveredVertebraIndex = null;
      this.hoveredVertebraSegmentIndex = null;
      this.player.setHoveredSpineControl(null, null);
      this.renderer.domElement.style.cursor = 'pointer';
      return;
    }

    this.hoveredBodySegmentId = null;
    this.player.setHoveredBodySegment(null);
    this.hoveredVertebraIndex = null;
    this.hoveredVertebraSegmentIndex = null;
    this.player.setHoveredSpineControl(null, null);
    this.renderer.domElement.style.cursor = 'default';
  }

  private handleWindowPointerUp(e: PointerEvent): void {
    if (this.status === 'menu') {
      this.solarSystemView.handlePointerUp(e, this.renderer.domElement);
      return;
    }

    if (this.isRightClickOrbiting && (e.button === 2 || (e.buttons & 2) === 0)) {
      this.isRightClickOrbiting = false;
      this.renderer.domElement.style.cursor = 'default';
    }

    if (this.status !== 'editing') {
      this.draggingCatalogAdaptationId = null;
      this.repositioningInstanceId = null;
      this.draggingSpineArrow = null;
      this.draggingOrientationInstanceId = null;
      this.draggingVertebraIndex = null;
      this.vertebraDragStartNode = null;
      this.vertebraDragStartNodes = null;
      this.draggingLimbJointRole = null;
      this.limbJointDragStartMorph = null;
      return;
    }

    if (this.draggingLimbJointRole) {
      this.draggingLimbJointRole = null;
      this.limbJointDragStartMorph = null;
      this.renderer.domElement.style.cursor = 'default';
      this.saveToLocalStorage();
      this.emitUISnapshot();
    }

    if (this.draggingVertebraIndex !== null) {
      this.draggingVertebraIndex = null;
      this.vertebraDragStartNode = null;
      this.vertebraDragStartNodes = null;
      this.renderer.domElement.style.cursor = 'default';
      this.saveToLocalStorage();
      this.emitUISnapshot();
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
            effectiveSymmetry,
            proj.vertebraIndex,
            proj.axialT,
            proj.surfaceAngle,
            proj.targetSegmentId
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
    if (this.status === 'menu') {
      this.solarSystemView.handleWheel(e);
      return;
    }

    if (this.status === 'playing') {
      if (e.deltaY !== 0) {
        this.cameraController.zoomGameplayCamera(e.deltaY > 0 ? 0.08 : -0.08);
        if (this.tutorialManager.recordCameraZoom()) {
          this.syncTutorialUI();
        }
      }
      return;
    }

    if (this.status !== 'editing') return;
    e.preventDefault();

    this.updateRaycasterFromClientCoords(e.clientX, e.clientY);

    const nowMs = performance.now();
    const recordWheelSnapshotIfNeeded = () => {
      if (nowMs - this.lastWheelHistoryTimestamp > 450) {
        this.pushEditorHistorySnapshot();
      }
      this.lastWheelHistoryTimestamp = nowMs;
    };

    if (e.deltaY === 0) return;
    const direction = e.deltaY < 0 ? 1 : -1;

    // 1. Si hay una esfera del cuerpo seleccionada -> Escalar solo su radio dentro de MORPHOLOGY_SCALE_LIMITS.bodySegment
    if (this.selectedSphereIndex !== null) {
      recordWheelSnapshotIfNeeded();
      const delta = direction * MORPHOLOGY_SCALE_LIMITS.bodySegment.step;
      this.adjustBodySphereRadius(this.selectedSphereIndex, delta);
      return;
    }

    // 2. Si hay una extremidad seleccionada (pata o brazo) -> Escalar dentro de MORPHOLOGY_SCALE_LIMITS.limbThickness
    const selectedOrgan = this.selectedPlacedInstanceId
      ? this.stats.placedOrgans.find(
          (o) => o.instanceId === this.selectedPlacedInstanceId
        )
      : undefined;
    const isSelectedOrganLimb = selectedOrgan
      ? isLegAdaptation(selectedOrgan.adaptationId) ||
        isFootAdaptation(selectedOrgan.adaptationId) ||
        isArmAdaptation(selectedOrgan.adaptationId) ||
        isHandAdaptation(selectedOrgan.adaptationId)
      : false;

    const selectedLimbId: string | null = isSelectedOrganLimb
      ? selectedOrgan!.instanceId
      : this.editorSelectionTarget === 'legs'
      ? 'legs'
      : this.editorSelectionTarget === 'arms'
      ? 'arms'
      : null;

    if (selectedLimbId !== null) {
      recordWheelSnapshotIfNeeded();
      const delta = direction * MORPHOLOGY_SCALE_LIMITS.limbThickness.step;
      this.adjustLimbThickness(selectedLimbId, delta);
      return;
    }

    // 3. Si hay otro órgano externo seleccionado (boca, ojo, púa, glándula, etc.) -> Escalar con MORPHOLOGY_SCALE_LIMITS.organScale
    if (selectedOrgan && this.selectedPlacedInstanceId) {
      recordWheelSnapshotIfNeeded();
      const curScale = selectedOrgan.morphology?.scaleOverall ?? 1.0;
      const delta = direction * MORPHOLOGY_SCALE_LIMITS.organScale.step;
      this.updatePlacedOrganMorphology(this.selectedPlacedInstanceId, {
        scaleOverall: THREE.MathUtils.clamp(
          curScale + delta,
          MORPHOLOGY_SCALE_LIMITS.organScale.min,
          MORPHOLOGY_SCALE_LIMITS.organScale.max
        ),
      });
      return;
    }

    // 4. En fase celular (cell_stage), si el objetivo es el cuerpo pero no se apuntó a una esfera concreta:
    if (
      this.stats.evolutionaryStage === 'cell_stage' &&
      this.editorSelectionTarget === 'body'
    ) {
      recordWheelSnapshotIfNeeded();
      const segIdx: 0 | 1 | 2 = this.hoveredVertebraSegmentIndex ?? 1;
      const currentRadius = this.stats.torsoRadii[segIdx];
      this.setTorsoRadius(
        segIdx,
        THREE.MathUtils.clamp(
          currentRadius + direction * MORPHOLOGY_SCALE_LIMITS.bodySegment.step,
          MORPHOLOGY_SCALE_LIMITS.bodySegment.min,
          MORPHOLOGY_SCALE_LIMITS.bodySegment.max
        )
      );
      return;
    }

    // 5. Si no hay nada seleccionado -> Zoom suave de la cámara del podio
    this.cameraController.zoomEditorCamera(-direction * 0.06);
  }

  private handleEditorKeyDown(e: KeyboardEvent): void {
    audioManager.unlock();
    if (this.status === 'intro_cinematic') {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        this.skipIntroCinematic();
      }
      return;
    }

    if (this.status === 'brain_cinematic') {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        this.skipBrainCinematic();
      }
      return;
    }

    if (this.status === 'menu') {
      return;
    }

    if (this.status !== 'editing') return;
    const activeTag = document.activeElement?.tagName.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea') return;

    // Undo / Redo shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
      e.preventDefault();
      if (e.shiftKey) {
        this.redoEditorAction();
      } else {
        this.undoEditorAction();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
      e.preventDefault();
      this.redoEditorAction();
      return;
    }

    // Tab or KeyA toggles Bilateral Symmetry (Simetría Bilateral) in the 3D Workshop
    if (e.key === 'Tab' || e.code === 'KeyA') {
      e.preventDefault();
      this.toggleEditorSymmetry();
      return;
    }

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
    this.pushEditorHistorySnapshot();
    this.stats.bodyShape = shape;
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      this.stats.evolutionaryStage === 'creature_stage',
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii,
      this.stats.spineNodes,
      this.stats.paintConfig,
      this.stats.bodySegments
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public setColorTheme(theme: CellColorTheme): void {
    this.pushEditorHistorySnapshot();
    this.stats.colorTheme = theme;
    this.introCinematicController.setMonumentCoreTheme(theme);
    const themeBaseHex: Record<CellColorTheme, string> = {
      cyan: '#06b6d4',
      emerald: '#10b981',
      crimson: '#f43f5e',
      violet: '#a855f7',
    };
    if (this.stats.paintConfig) {
      this.stats.paintConfig = {
        ...this.stats.paintConfig,
        baseColor: themeBaseHex[theme] ?? '#06b6d4',
      };
    }
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      this.stats.evolutionaryStage === 'creature_stage',
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii,
      this.stats.spineNodes,
      this.stats.paintConfig,
      this.stats.bodySegments
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public setSpineSegments(segments: 1 | 2 | 3): void {
    this.stats.spineSegments = segments;
    const nextLength =
      segments === 3 ? 1.44 : segments === 2 ? 1.22 : 1.0;
    this.setSpineLength(nextLength);
  }

  /**
   * Starts the 3D Spore Brain Evolution Sequence ('brain_cinematic') when transitioning
   * from Stage 5 Cell Stage to the Terrestrial Creature Stage.
   */
  public syncUISnapshot(): void {
    this.emitUISnapshot();
  }

  public triggerEvolutionToCreatureStage(): void {
    if (this.stats.evolutionaryStage === 'creature_stage') {
      this.closeEditor();
      return;
    }

    // 1. Renderizar un frame limpio de la célula y obtener la captura tridimensional antes del cambio
    this.predatorManager.setEcosystemVisible(false, this.player.position);
    this.foodManager.setEcosystemVisible(false);
    this.fossilMeteorManager.setEcosystemVisible(false);
    this.player.hideMateCell();
    this.renderer.render(this.environment.scene, this.cameraController.camera);
    let snapshotDataUrl: string | undefined;
    try {
      snapshotDataUrl = this.renderer.domElement.toDataURL('image/webp');
    } catch {
      snapshotDataUrl = undefined;
    }

    // 2. Determinar el rasgo predominante según el conteo de alimentación
    const trait: DietType =
      this.stageHistory.meatsEaten > this.stageHistory.plantsEaten * 1.5
        ? 'carnivore'
        : this.stageHistory.plantsEaten > this.stageHistory.meatsEaten * 1.5
        ? 'herbivore'
        : 'omnivore';

    this.stageHistory.stageTimeSeconds = Math.max(
      1,
      Math.round(this.stats.survivalTime)
    );
    this.stageHistory.partsDiscoveredCount = this.discoveredAdaptationIds.size;
    this.stageHistory.finalCellSnapshotUrl = snapshotDataUrl;
    this.stageHistory.earnedTrait = trait;

    // 3. Abrir modal de resumen estilo Timeline de Spore
    this.isEvolutionSummaryOpen = true;
    this.inputController.resetInputs();
    this.syncUISnapshot();
  }

  public evolveToCreatureStage(): void {
    if (this.stats.evolutionaryStage === 'creature_stage') {
      this.closeEditor();
      return;
    }
    this.triggerEvolutionToCreatureStage();
  }

  public proceedFromSummaryToLand(): void {
    this.isEvolutionSummaryOpen = false;
    this.stats.diet = this.stageHistory.earnedTrait;

    // Freeze ocean predators/food and close Petri dish overlay so the camera can zoom into the cell's head
    this.setEditorSandboxIsolation(false);
    this.player.setEditorMode(false);
    this.predatorManager.setEcosystemVisible(false, this.player.position);
    this.foodManager.setEcosystemVisible(false);
    this.fossilMeteorManager.setEcosystemVisible(false);
    this.matingCallTimer = 0;
    this.player.hideMateCell();
    this.inputController.resetInputs();

    this.status = 'brain_cinematic';
    this.player.setBrainCinematicActive(true);
    this.player.updateBrainCinematic(0, this.elapsedActiveTime);
    audioManager.playBrainEvolutionSequence();

    this.brainCinematicState = {
      active: true,
      phase: 0,
      progress: 0,
      elapsed: 0,
      duration: 5.5,
      brainVolumeCc: 5,
      synapticActivityHz: 4,
      flashOpacity: 0,
      speciesName: this.stats.speciesName || 'Organismo Primigenio',
      phaseTitle: 'Fase I · Germinación Axonal y Polarización Craneal',
      phaseSubtitle:
        'El núcleo celular hiper-activa sus filamentos dendríticos y proyecta el tallo axonal hacia el polo anterior...',
    };

    this.timer.update();
    this.emitUISnapshot();
  }

  public skipBrainCinematic(): void {
    if (this.status !== 'brain_cinematic') return;
    this.completeBrainCinematic(true);
  }

  private completeBrainCinematic(skipped = false): void {
    this.player.setBrainCinematicActive(false);
    this.brainCinematicState = undefined;
    this.isEvolutionSummaryOpen = false;

    this.stats.evolutionaryStage = 'creature_stage';
    this.stats.growthStage = 5;
    this.stats.totalAdnEarned = Math.max(320, this.stats.totalAdnEarned);
    this.completedQuestStep = 4;

    // 1. Retire strictly microbial/cellular parts (flagella, cilia, internal organelles) with 100% DNA refund
    let refundedCellAdn = 0;
    const retainedOrgans: PlacedOrganInstance[] = [];
    for (const org of this.stats.placedOrgans) {
      const normId = normalizeAdaptationId(org.adaptationId);
      if (isCellOnlyAdaptation(normId)) {
        const slot = this.preparedEvolutionCatalog.find((s) => s.id === normId);
        refundedCellAdn += slot ? slot.costAdn : 15;
      } else {
        retainedOrgans.push(org);
      }
    }
    this.stats.placedOrgans = retainedOrgans;

    // Grant refunded DNA + +90 ADN encephalization bonus for terrestrial limbs
    this.stats.adn += refundedCellAdn + 90;

    // Unlock all terrestrial adaptations + compatible cell-origin budget parts in the Early Creature Creator
    for (const def of ADAPTATION_CATALOG) {
      if (def.stage === 'creature_stage' || !isCellOnlyAdaptation(def.id)) {
        this.discoveredAdaptationIds.add(def.id);
      }
    }

    // Set an arched terrestrial spine posture with 6 vertebrae
    this.stats.spineLength = Math.max(1.25, this.stats.spineLength);
    this.stats.spineSegments = 2;
    this.stats.spineNodes = createDefaultSpineNodes(6, this.stats.spineLength).map(
      (n, idx, arr) => {
        const t = arr.length > 1 ? idx / (arr.length - 1) : 0.5;
        return {
          ...n,
          y: Math.sin(t * Math.PI) * 0.28 + (1 - t) * 0.26,
          pitch: Math.cos(t * Math.PI) * 0.18,
        };
      }
    );

    this.syncWorldStageScale(5, false);
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      true,
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii,
      this.stats.spineNodes,
      this.stats.paintConfig,
      this.stats.bodySegments,
      this.stats.creatureMorphology
    );
    this.syncCatalogAndOrganismState();
    this.player.position.set(
      0,
      getLandHeightAt(0, 0) + this.player.getGroundOffset(),
      0
    );
    this.player.headingAngle = 0;
    this.player.mesh.rotation.y = 0; // Mirando hacia adelante (polo norte/eje Z)
    this.player.group.position.copy(this.player.position);
    this.cameraController.syncWithPlayerHeading(this.player.mesh.rotation.y);
    this.stats.health = this.stats.maxHealth;
    this.stats.energy = this.stats.maxEnergy;
    this.stats.isStarving = false;

    this.environment.setStageEnvironment('creature_stage');
    this.predatorManager.setStageMode('creature_stage');
    this.foodManager.setStageMode('creature_stage');
    this.introCinematicController?.setPermanentMonumentVisible(false);
    this.currentBiomeName = 'Nido Costero Terrestre (Taller de Criatura)';

    // Transition directly into the Terrestrial Creature Workshop on the Coastal Sandy Nest
    this.status = 'editing';
    this.setEditorSandboxIsolation(true);
    this.cameraController.resetEditorOrbit();
    this.player.setEditorMode(true);
    this.player.updateEditorIdle(0, this.elapsedActiveTime);
    this.inputController.resetInputs();
    this.timer.update();

    this.setEventMessage(
      skipped
        ? `¡Creador de Criatura Temprano (+${refundedCellAdn + 90} ADN)! Añade patas de la paleta o confirma para reptar`
        : `¡Cerebro Primitivo absorbido (+${refundedCellAdn + 90} ADN)! Ensambla extremidades o sal a tierra reptando`
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
    this.introCinematicController?.setPermanentMonumentVisible(
      !active && this.stats.evolutionaryStage === 'cell_stage'
    );

    if (active) {
      this.nearestPredatorState = 'DEAMBULAR';
      this.nearestPredatorDistance = 999;
      this.nearestHasUncataloguedGene = false;
      this.stats.damageFlashTime = 0;
    }
  }

  public togglePause(): void {
    if (
      this.status === 'gameover' ||
      this.status === 'menu' ||
      this.status === 'intro_cinematic' ||
      this.status === 'brain_cinematic' ||
      this.status === 'editing'
    ) {
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
      audioManager.playMenuOpenClose();
    } else if (this.status === 'paused') {
      this.status = 'playing';
      this.timer.update();
      audioManager.playMenuOpenClose();
    }
    this.emitUISnapshot();
  }

  public toggleEditor(): void {
    if (
      this.status === 'gameover' ||
      this.status === 'menu' ||
      this.status === 'intro_cinematic' ||
      this.status === 'brain_cinematic' ||
      this.status === 'editing'
    ) {
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

    // En fase celular (cell_stage), iniciar el Llamado de Cortejo a Distancia (Estilo Spore)
    if (this.stats.evolutionaryStage === 'cell_stage') {
      this.triggerMatingCall();
      return;
    }

    // En fase terrestre (creature_stage), transición hacia el nido costero
    this.predatorManager.setEcosystemVisible(false, this.player.position);
    this.foodManager.setEcosystemVisible(false);
    this.fossilMeteorManager.setEcosystemVisible(false);
    this.nearestPredatorState = 'DEAMBULAR';
    this.nearestPredatorDistance = 999;
    this.stats.damageFlashTime = 0;

    if (
      this.tutorialManager.isActive &&
      this.tutorialManager.currentStep === 'evolve_key'
    ) {
      this.tutorialManager.completeTutorial();
    }

    this.matingCallTimer = 0.85;
    this.player.startMatingCall();
    audioManager.playMenuOpenClose();
    this.setEventMessage(
      'Llamada de apareamiento terrestre: Pareja acudiendo al nido...'
    );
    this.emitUISnapshot();
  }

  /**
   * Llamado de Cortejo a Distancia (Mating Call / Quimiotaxis) en cell_stage:
   * Emite ondas acústicas bioluminiscentes y activa un congénere receptivo a media distancia (~55m).
   */
  public triggerMatingCall(): void {
    if (
      this.status !== 'playing' ||
      this.matingSequence.isDancing ||
      this.matingSequence.isHatching
    ) {
      return;
    }

    if (
      this.tutorialManager.isActive &&
      this.tutorialManager.currentStep === 'evolve_key'
    ) {
      this.tutorialManager.completeTutorial();
    }

    // 1. Emitir onda sónica concéntrica desde la posición del jugador
    this.environment.spawnSonarPing(this.player.position, 0x38bdf8);
    audioManager.playSFX('mating_call_emit');

    // 2. Si aún no hay pareja activa receptiva, activar o generar un congénere a ~55 metros
    if (!this.isMatingCallActive || !this.activeMate) {
      this.isMatingCallActive = true;
      const angle = Math.random() * Math.PI * 2;
      const distance = 55.0;
      const maxR = Math.max(45, (this.stats.activeArenaRadius ?? 110) - 14);
      let mx = this.player.position.x + Math.cos(angle) * distance;
      let mz = this.player.position.z + Math.sin(angle) * distance;
      const r = Math.hypot(mx, mz);
      if (r > maxR) {
        mx = (mx / r) * maxR;
        mz = (mz / r) * maxR;
      }
      const matePos = new THREE.Vector3(
        mx,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y,
        mz
      );

      this.activeMate = this.predatorManager.spawnReceptiveMate(
        matePos,
        this.stats
      );
      this.mateEchoPingTimer = 0.35;
    }

    this.setEventMessage(
      'Congénere receptivo ha respondido a tu llamada. ¡Sigue la señal!'
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
      this.isMatingCallActive = false;
      this.activeMate = null;
      this.draggingCatalogAdaptationId = null;
      this.repositioningInstanceId = null;
      this.draggingSpineArrow = null;
      this.draggingOrientationInstanceId = null;
      this.draggingVertebraIndex = null;
      this.vertebraDragStartNode = null;
      this.vertebraDragStartNodes = null;
      this.draggingLimbJointRole = null;
      this.limbJointDragStartMorph = null;
      this.hoveredVertebraIndex = null;
      this.hoveredVertebraSegmentIndex = null;
      this.hoveredBodySegmentId = null;
      this.selectedBodySegmentId = null;
      this.selectedSphereIndex = null;
      this.player.setHoveredBodySegment(null);
      this.player.setSelectedSphereIndex(null);
      this.isRightClickOrbiting = false;
      this.selectedPlacedInstanceId = null;
      this.renderer.domElement.style.cursor = 'default';
      this.setEditorSandboxIsolation(false);
      this.player.setEditorMode(false);
      this.editorPreviewAction = 'idle';
      this.player.setEditorPreviewAction('idle');
      this.player.hideMateCell();
      this.cameraController.resetEditorOrbit();

      // Reconstruir los clones de todas las células de tu especie en el mapa clonando al 100% la estructura actual del jugador
      this.predatorManager.refreshAllKinClones(this.player);

      if (this.stats.evolutionaryStage === 'creature_stage') {
        this.player.controlsLocked = false;
        this.player.mesh.visible = true;
        const groundY = getLandHeightAt(
          this.player.position.x,
          this.player.position.z
        );
        this.player.position.y = groundY + this.player.getGroundOffset();
        this.player.group.position.copy(this.player.position);
        this.cameraController.syncWithPlayerHeading(this.player.mesh.rotation.y);
        this.cameraController.resetImmediate(
          this.player.position,
          this.player.headingAngle,
          true
        );
      } else if (this.matingSequence.eggMesh) {
        // Cinemática de Eclosión del Huevo Primordial Pos-Taller (1.2s)
        this.player.mesh.visible = false;
        this.player.controlsLocked = true;
        this.player.position.copy(this.matingSequence.eggPosition);
        this.player.group.position.copy(this.player.position);

        this.matingSequence.playHatchingSequence(
          () => {
            this.environment.spawnCellBurstFX(
              this.matingSequence.eggPosition,
              '#22d3ee'
            );
            this.player.mesh.visible = true;
            this.player.playBirthAnimation();
          },
          () => {
            this.player.controlsLocked = false;
            this.setEventMessage(
              '¡El huevo ha eclosionado! Una nueva generación emerge al caldo primigenio.'
            );
            this.emitUISnapshot();
          }
        );
      } else {
        this.player.controlsLocked = false;
        this.player.mesh.visible = true;
      }

      this.timer.update();
      this.saveToLocalStorage();
      audioManager.playMenuOpenClose();
      this.emitUISnapshot();
    }
  }


  public installOrganAtPosition(
    rawSlotId: string,
    angle: number,
    axialOffset: number,
    mirrorSymmetry: boolean,
    vertebraIndex?: number,
    axialT?: number,
    surfaceAngle?: number,
    targetSegmentId?: BodySegmentId
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

    const forceBilateral =
      isLegAdaptation(slot.id) ||
      isArmAdaptation(slot.id) ||
      isHandAdaptation(slot.id) ||
      isFootAdaptation(slot.id);
    const effectiveMirror = forceBilateral
      ? this.settings.autoBilateralSymmetry
      : mirrorSymmetry;

    const addedComplexity = getOrganComplexityCost(slot.id, effectiveMirror);
    const currentComplexity = this.stats.complexityScore ?? 0;
    if (currentComplexity + addedComplexity > MAX_CREATURE_COMPLEXITY) {
      this.setEventMessage(
        'Complejímetro al 100%: Retira piezas o vértebras para añadir más adaptaciones'
      );
      this.emitUISnapshot();
      return false;
    }

    const prevMaxHealth = this.stats.maxHealth;
    const prevMaxEnergy = this.stats.maxEnergy;

    const effectiveAngle =
      forceBilateral && Math.abs(Math.sin(angle)) <= 0.18
        ? isLegAdaptation(slot.id) || isFootAdaptation(slot.id)
          ? Math.PI * 0.42
          : Math.PI * 0.72
        : angle;

    // Direct replacement/swap when dropping a new Foot onto a limb that already has a foot
    if (isFootAdaptation(slot.id)) {
      let existingFootIndex = -1;
      if (this.selectedPlacedInstanceId) {
        const selIdx = this.stats.placedOrgans.findIndex(
          (o) => o.instanceId === this.selectedPlacedInstanceId
        );
        if (
          selIdx !== -1 &&
          isFootAdaptation(this.stats.placedOrgans[selIdx].adaptationId)
        ) {
          existingFootIndex = selIdx;
        }
      }
      if (existingFootIndex === -1) {
        let minDiff = 0.65;
        for (let i = 0; i < this.stats.placedOrgans.length; i++) {
          const org = this.stats.placedOrgans[i];
          if (isFootAdaptation(org.adaptationId)) {
            const diff = Math.abs(org.angle - effectiveAngle);
            if (diff < minDiff) {
              minDiff = diff;
              existingFootIndex = i;
            }
          }
        }
      }
      if (existingFootIndex !== -1) {
        this.pushEditorHistorySnapshot();
        this.stats.adn -= slot.costAdn;
        const oldFoot = this.stats.placedOrgans[existingFootIndex];
        oldFoot.adaptationId = slot.id;
        this.selectedPlacedInstanceId = oldFoot.instanceId;
        this.syncCatalogAndOrganismState();
        audioManager.playEvolutionEquip();
        this.setEventMessage(`Pie sustituido: ${slot.name}`);
        this.saveToLocalStorage();
        this.emitUISnapshot();
        return true;
      }
    }

    // Direct replacement/swap when dropping a new Hand onto an arm that already has a hand
    if (isHandAdaptation(slot.id)) {
      let existingHandIndex = -1;
      if (this.selectedPlacedInstanceId) {
        const selIdx = this.stats.placedOrgans.findIndex(
          (o) => o.instanceId === this.selectedPlacedInstanceId
        );
        if (
          selIdx !== -1 &&
          isHandAdaptation(this.stats.placedOrgans[selIdx].adaptationId)
        ) {
          existingHandIndex = selIdx;
        }
      }
      if (existingHandIndex === -1) {
        let minDiff = 0.65;
        for (let i = 0; i < this.stats.placedOrgans.length; i++) {
          const org = this.stats.placedOrgans[i];
          if (isHandAdaptation(org.adaptationId)) {
            const diff = Math.abs(org.angle - effectiveAngle);
            if (diff < minDiff) {
              minDiff = diff;
              existingHandIndex = i;
            }
          }
        }
      }
      if (existingHandIndex !== -1) {
        this.pushEditorHistorySnapshot();
        this.stats.adn -= slot.costAdn;
        const oldHand = this.stats.placedOrgans[existingHandIndex];
        oldHand.adaptationId = slot.id;
        this.selectedPlacedInstanceId = oldHand.instanceId;
        this.syncCatalogAndOrganismState();
        audioManager.playEvolutionEquip();
        this.setEventMessage(`Mano sustituida: ${slot.name}`);
        this.saveToLocalStorage();
        this.emitUISnapshot();
        return true;
      }
    }

    this.pushEditorHistorySnapshot();
    this.stats.adn -= slot.costAdn;
    const newInstance: PlacedOrganInstance = {
      instanceId: `organ_${slot.id}_${Date.now()}_${this.organInstanceCounter++}`,
      adaptationId: slot.id,
      angle: effectiveAngle,
      axialOffset,
      mirrorSymmetry: effectiveMirror,
      orientationYaw: 0,
      orientationPitch: 0,
      localYaw: 0,
      localPitch: 0,
      morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
      vertebraIndex,
      axialT,
      surfaceAngle,
      targetSegmentId,
    };
    this.stats.placedOrgans.push(newInstance);

    // Pre-assemble default Foot (foot_paw) on newly equipped legs
    if (isLegAdaptation(slot.id)) {
      const footInstance: PlacedOrganInstance = {
        instanceId: `organ_foot_paw_${Date.now()}_${this.organInstanceCounter++}`,
        adaptationId: 'foot_paw',
        angle: effectiveAngle,
        axialOffset,
        mirrorSymmetry: effectiveMirror,
        orientationYaw: 0,
        orientationPitch: 0,
        localYaw: 0,
        localPitch: 0,
        morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
        vertebraIndex,
        axialT,
        surfaceAngle,
        targetSegmentId,
      };
      this.stats.placedOrgans.push(footInstance);
      this.discoveredAdaptationIds.add('foot_paw');
    } else if (isArmAdaptation(slot.id)) {
      // Pre-assemble default Hand (hand_primate) on newly equipped arms
      const handInstance: PlacedOrganInstance = {
        instanceId: `organ_hand_primate_${Date.now()}_${this.organInstanceCounter++}`,
        adaptationId: 'hand_primate',
        angle: effectiveAngle,
        axialOffset,
        mirrorSymmetry: effectiveMirror,
        orientationYaw: 0,
        orientationPitch: 0,
        localYaw: 0,
        localPitch: 0,
        morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
        vertebraIndex,
        axialT,
        surfaceAngle,
        targetSegmentId,
      };
      this.stats.placedOrgans.push(handInstance);
      this.discoveredAdaptationIds.add('hand_primate');
    }

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
    audioManager.playEvolutionEquip();
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
    this.syncActivePlanetPalette(this.activeSlotId);
    this.environment.setStageEnvironment('cell_stage');
    this.predatorManager.setStageMode('cell_stage');
    this.foodManager.setStageMode('cell_stage');
    this.introCinematicController?.setMonumentCoreTheme(this.stats.colorTheme);
    this.introCinematicController?.setPermanentMonumentVisible(true);
    this.player.reset();
    this.player.applyMorphology(
      this.stats.bodyShape,
      this.stats.colorTheme,
      false,
      this.stats.spineSegments,
      this.stats.spineLength,
      this.stats.torsoRadii,
      this.stats.spineNodes,
      this.stats.paintConfig,
      this.stats.bodySegments,
      this.stats.creatureMorphology
    );
    this.player.syncPlacedOrgans(this.stats.placedOrgans, null);
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

    this.isEvolutionSummaryOpen = false;
    this.stageHistory = {
      stageTimeSeconds: 0,
      microbesKilled: 0,
      plantsEaten: 0,
      meatsEaten: 0,
      partsDiscoveredCount: 0,
      editorVisitsCount: 0,
      finalCellSnapshotUrl: undefined,
      earnedTrait: 'omnivore',
    };

    this.timer.reset();
    this.timer.update();
    this.emitUISnapshot();
  }

  public setTouchControl(key: keyof InputState, active: boolean): void {
    if (this.status !== 'playing') return;
    this.inputController.setControlState(key, active);
  }

  // --- DEVTOOLS / DEBUG SUITE API ---

  private ensureActiveGameplayForDev(): void {
    if (this.status === 'intro_cinematic') {
      this.introCinematicController.finishAndCleanUp(this.player.group);
      this.solarSystemView.restoreAfterIntroCinematic(this.planetSlots);
      this.introCinematicState = undefined;
    }
    if (this.status === 'brain_cinematic') {
      this.player.setBrainCinematicActive(false);
      this.brainCinematicState = undefined;
    }
    if (this.planetaryTransition?.active) {
      this.cameraController.setAtmosphericAltitudeFactor(0, this.player);
      this.solarSystemView.setPlanetDiveProgress(this.activeSlotId, 0, false);
      this.planetaryTransition = undefined;
      this.pendingTransitionAction = null;
      this.pendingTransitionGenesis = undefined;
      this.transitionSwitchedScene = false;
    }
    if (this.status === 'editing' || this.matingCallTimer > 0) {
      this.matingCallTimer = 0;
      this.setEditorSandboxIsolation(false);
      this.player.setEditorMode(false);
      this.player.hideMateCell();
      this.cameraController.resetEditorOrbit();
    }
    if (
      this.status === 'menu' ||
      this.status === 'paused' ||
      this.status === 'gameover' ||
      this.status === 'intro_cinematic' ||
      this.status === 'brain_cinematic' ||
      this.status === 'editing'
    ) {
      this.status = 'playing';
      this.setEditorSandboxIsolation(false);
      this.inputController.resetInputs();
      this.timer.update();
    }
  }

  public devJumpToStage(
    evolutionaryStage: 'cell_stage' | 'creature_stage',
    growthStage: 1 | 2 | 3 | 4 | 5 = 1
  ): void {
    this.ensureActiveGameplayForDev();
    this.stats.evolutionaryStage = evolutionaryStage;
    this.stats.growthStage = growthStage;

    if (evolutionaryStage === 'creature_stage') {
      this.stats.growthStage = 5;
      this.stats.totalAdnEarned = Math.max(320, this.stats.totalAdnEarned);
      this.stats.adn = Math.max(150, this.stats.adn);
      this.completedQuestStep = 4;
      this.stats.activeArenaRadius = GAME_CONFIG.WORLD.ARENA_RADIUS;

      // Unlock all terrestrial parts
      for (const def of ADAPTATION_CATALOG) {
        if (def.stage === 'creature_stage' || !isCellOnlyAdaptation(def.id)) {
          this.discoveredAdaptationIds.add(def.id);
        }
      }

      // Retire strictly cellular organs and ensure the creature has terrestrial legs if none are installed
      this.stats.placedOrgans = this.stats.placedOrgans.filter(
        (o) => !isCellOnlyAdaptation(normalizeAdaptationId(o.adaptationId))
      );
      const hasAnyLegs = this.stats.placedOrgans.some((o) =>
        isLegAdaptation(o.adaptationId)
      );
      if (!hasAnyLegs) {
        this.stats.placedOrgans.push(
          {
            instanceId: `dev_leg_pair_1_${Date.now()}`,
            adaptationId: 'leg_digitigrade',
            angle: Math.PI * 0.42,
            axialOffset: 0.25,
            mirrorSymmetry: true,
            orientationYaw: 0,
            orientationPitch: 0,
            localYaw: 0,
            localPitch: 0,
            morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
          },
          {
            instanceId: `dev_foot_pair_1_${Date.now()}`,
            adaptationId: 'foot_paw',
            angle: Math.PI * 0.42,
            axialOffset: 0.25,
            mirrorSymmetry: true,
            orientationYaw: 0,
            orientationPitch: 0,
            localYaw: 0,
            localPitch: 0,
            morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
          },
          {
            instanceId: `dev_arm_pair_1_${Date.now()}`,
            adaptationId: 'arm_slender',
            angle: Math.PI * 0.72,
            axialOffset: -0.58,
            mirrorSymmetry: true,
            orientationYaw: 0,
            orientationPitch: 0,
            localYaw: 0,
            localPitch: 0,
            morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
          },
          {
            instanceId: `dev_hand_pair_1_${Date.now()}`,
            adaptationId: 'hand_primate',
            angle: Math.PI * 0.72,
            axialOffset: -0.58,
            mirrorSymmetry: true,
            orientationYaw: 0,
            orientationPitch: 0,
            localYaw: 0,
            localPitch: 0,
            morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
          }
        );
      }

      this.stats.spineLength = Math.max(1.25, this.stats.spineLength);
      this.stats.spineSegments = 2;
      this.stats.spineNodes = createDefaultSpineNodes(
        6,
        this.stats.spineLength
      ).map((n, idx, arr) => {
        const t = arr.length > 1 ? idx / (arr.length - 1) : 0.5;
        return {
          ...n,
          y: Math.sin(t * Math.PI) * 0.28 + (1 - t) * 0.26,
          pitch: Math.cos(t * Math.PI) * 0.18,
        };
      });

      this.syncWorldStageScale(5, false);
      this.environment.setStageEnvironment('creature_stage');
      this.predatorManager.setStageMode('creature_stage');
      this.foodManager.setStageMode('creature_stage');
      this.introCinematicController?.setPermanentMonumentVisible(false);
      this.player.applyMorphology(
        this.stats.bodyShape,
        this.stats.colorTheme,
        true,
        this.stats.spineSegments,
        this.stats.spineLength,
        this.stats.torsoRadii,
        this.stats.spineNodes,
        this.stats.paintConfig,
        this.stats.bodySegments,
        this.stats.creatureMorphology
      );
      this.syncCatalogAndOrganismState();
      this.player.position.set(
        0,
        getLandHeightAt(0, 5.2) + this.player.getGroundOffset(),
        5.2
      );
      this.player.group.position.copy(this.player.position);
      this.currentBiomeName = 'Nido de la Especie (Regeneración Activa)';
      this.setEventMessage(
        'DevTools: Salto instantáneo a Fase de Criatura Terrestre (Nido Costero)'
      );
    } else {
      const stageMinAdn: Record<CellularGrowthStage, number> = {
        1: 0,
        2: 50,
        3: 120,
        4: 210,
        5: 320,
      };
      this.stats.totalAdnEarned = Math.max(
        this.stats.totalAdnEarned,
        stageMinAdn[growthStage]
      );
      this.stats.nextStageAdnThreshold =
        GameEngine.getNextStageAdnThreshold(growthStage);

      // Remove strictly terrestrial limbs when returning to Cell Stage and ensure a flagellum exists
      this.stats.placedOrgans = this.stats.placedOrgans.filter(
        (o) =>
          !isLegAdaptation(o.adaptationId) &&
          !isArmAdaptation(o.adaptationId) &&
          !isFootAdaptation(o.adaptationId) &&
          !isHandAdaptation(o.adaptationId)
      );
      const hasAnyFlagellum = this.stats.placedOrgans.some(
        (o) => normalizeAdaptationId(o.adaptationId) === 'simple_flagellum'
      );
      if (!hasAnyFlagellum) {
        this.stats.placedOrgans.push({
          instanceId: `dev_flagellum_${Date.now()}`,
          adaptationId: 'simple_flagellum',
          angle: 0,
          axialOffset: 0.95,
          mirrorSymmetry: false,
          orientationYaw: 0,
          orientationPitch: 0,
          morphology: { ...DEFAULT_ORGAN_MORPHOLOGY },
        });
      }

      this.environment.setStageEnvironment('cell_stage');
      this.syncWorldStageScale(growthStage, false);
      this.predatorManager.setStageMode('cell_stage');
      this.foodManager.setStageMode('cell_stage');
      this.predatorManager.setPlayerGrowthStage(growthStage);
      this.introCinematicController?.setPermanentMonumentVisible(true);
      this.player.setGrowthStage(growthStage);
      this.player.position.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y;
      this.player.applyMorphology(
        this.stats.bodyShape,
        this.stats.colorTheme,
        false,
        this.stats.spineSegments,
        this.stats.spineLength,
        this.stats.torsoRadii,
        this.stats.spineNodes,
        this.stats.paintConfig
      );
      this.syncCatalogAndOrganismState();
      this.currentBiomeName = this.environment.getBiomeAt(
        this.player.position.x,
        this.player.position.z
      ).name;
      this.setEventMessage(
        `DevTools: Salto instantáneo a Fase Celular · Etapa ${growthStage}/5`
      );
    }

    this.stats.health = this.stats.maxHealth;
    this.stats.energy = this.stats.maxEnergy;
    this.stats.isStarving = false;
    this.cameraController.resetImmediate(
      this.player.position,
      this.player.headingAngle,
      evolutionaryStage === 'creature_stage'
    );
    this.saveToLocalStorage();
    this.emitUISnapshot();
  }

  public devAddAdn(amount: number): void {
    this.stats.adn = Math.max(0, this.stats.adn + amount);
    if (amount > 0) {
      this.stats.totalAdnEarned += amount;
    }
    this.evaluateQuests(true);
    this.saveToLocalStorage();
    this.setEventMessage(
      amount >= 0
        ? `DevTools: +${amount} ADN inyectado (Total: ${this.stats.adn} ADN)`
        : `DevTools: ${amount} ADN ajustado (Total: ${this.stats.adn} ADN)`
    );
    this.emitUISnapshot();
  }

  public devToggleGodMode(): boolean {
    this.isGodModeActive = !this.isGodModeActive;
    if (this.isGodModeActive) {
      this.stats.health = this.stats.maxHealth;
      this.stats.energy = this.stats.maxEnergy;
      this.stats.isStarving = false;
    }
    this.setEventMessage(
      this.isGodModeActive
        ? 'DevTools · Modo Dios ACTIVADO (Invulnerabilidad + Energía Infinita)'
        : 'DevTools · Modo Dios DESACTIVADO'
    );
    this.emitUISnapshot();
    return this.isGodModeActive;
  }

  public devHealFull(): void {
    if (this.status === 'gameover') {
      this.status = 'playing';
    }
    this.recalculateVitalCaps();
    this.stats.health = this.stats.maxHealth;
    this.stats.energy = this.stats.maxEnergy;
    this.stats.isStarving = false;
    this.stats.damageFlashTime = 0;
    this.setEventMessage('DevTools: Salud y Bioenergía restauradas al 100%');
    this.emitUISnapshot();
  }

  public devTeleport(x: number, z: number, label?: string): void {
    this.ensureActiveGameplayForDev();
    this.player.position.x = x;
    this.player.position.z = z;
    this.player.position.y =
      this.stats.evolutionaryStage === 'creature_stage'
        ? getLandHeightAt(x, z) + this.player.getGroundOffset()
        : GAME_CONFIG.WORLD.SWIM_PLANE_Y;
    this.player.group.position.copy(this.player.position);
    this.player.currentSpeed = 0;
    this.cameraController.resetImmediate(
      this.player.position,
      this.player.headingAngle,
      this.stats.evolutionaryStage === 'creature_stage'
    );
    this.currentBiomeName =
      this.stats.evolutionaryStage === 'creature_stage'
        ? this.environment.isNearNest(x, z)
          ? 'Nido de la Especie (Regeneración Activa)'
          : 'Costa Terrestre Primigenia'
        : this.environment.getBiomeAt(x, z).name;
    this.setEventMessage(
      `DevTools: Teletransporte a ${label ?? `(${x}, ${z})`}`
    );
    this.emitUISnapshot();
  }

  public devSetPlanetTheme(theme: PlanetTheme): void {
    this.environment.applyPlanetPalette(theme);
    this.setEventMessage(`DevTools: Bioma Planetario cambiado a "${theme}"`);
    this.emitUISnapshot();
  }

  public devToggleFreezeAI(): boolean {
    this.isAIFrozen = !this.isAIFrozen;
    this.predatorManager.setAIFrozen(this.isAIFrozen);
    this.setEventMessage(
      this.isAIFrozen
        ? 'DevTools: IA del Ecosistema CONGELADA (Depredadores en pausa)'
        : 'DevTools: IA del Ecosistema REANUDADA'
    );
    this.emitUISnapshot();
    return this.isAIFrozen;
  }

  public devUnlockAllAdaptations(): void {
    for (const def of ADAPTATION_CATALOG) {
      this.discoveredAdaptationIds.add(def.id);
    }
    for (const slot of this.preparedEvolutionCatalog) {
      if (slot.installedStacks === 0) {
        slot.discoveryState = 'discovered_unbought';
      }
    }
    this.syncCatalogAndOrganismState();
    this.saveToLocalStorage();
    this.setEventMessage(
      'DevTools: ¡Todas las piezas del catálogo (Celular y Criatura) desbloqueadas!'
    );
    this.emitUISnapshot();
  }

  public devOpenEditorImmediate(): void {
    this.ensureActiveGameplayForDev();
    this.matingCallTimer = 0;
    this.status = 'editing';
    this.setEditorSandboxIsolation(true);
    this.cameraController.resetEditorOrbit();
    this.player.hideMateCell();
    this.player.setEditorMode(true);
    this.inputController.resetInputs();
    this.setEventMessage('DevTools: Taller Evolutivo 3D abierto directamente');
    this.emitUISnapshot();
  }

  public devTriggerBrainCinematic(): void {
    this.ensureActiveGameplayForDev();
    this.stats.evolutionaryStage = 'cell_stage';
    this.evolveToCreatureStage();
  }

  public devSpawnFoodClusterNearPlayer(): void {
    this.ensureActiveGameplayForDev();
    this.foodManager.spawnDevClusterNear(
      this.player.position,
      this.player.headingAngle
    );
    this.setEventMessage(
      'DevTools: Racimo de nutrientes y esporas de ADN generado al frente'
    );
    this.emitUISnapshot();
  }

  public devClearAllEnemies(): void {
    this.predatorManager.clearAllOrganisms();
    this.nearestPredatorState = 'DEAMBULAR';
    this.nearestPredatorDistance = 999;
    this.setEventMessage('DevTools: Mapa vaciado de depredadores y criaturas');
    this.emitUISnapshot();
  }

  public devForceSpawnSpeciesNearPlayer(species: SpeciesType): void {
    this.ensureActiveGameplayForDev();
    const spawnedName = this.predatorManager.forceSpawnSpeciesNearPlayer(
      species,
      this.player.position,
      this.player.headingAngle
    );
    this.setEventMessage(
      `DevTools: Especie "${spawnedName}" generada frente a tu organismo`
    );
    this.emitUISnapshot();
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

    // Handle Active Planetary Cinematic Transition (Atmospheric Dive or Orbital Ascent)
    if (this.planetaryTransition && this.planetaryTransition.active) {
      const transitionDuration = 1.45;
      this.planetaryTransition.progress = Math.min(
        1.0,
        this.planetaryTransition.progress + delta / transitionDuration
      );
      const p = this.planetaryTransition.progress;

      // Bell-curve atmospheric cloud/mist opacity peaking at p = 0.50
      const bellOpacity = Math.sin(p * Math.PI);
      this.planetaryTransition.atmosphereOverlayOpacity = Math.pow(
        Math.max(0, bellOpacity),
        1.15
      );

      if (this.planetaryTransition.mode === 'entering_planet') {
        if (p < 0.5) {
          // Phase 1 (0.0 -> 0.5): Plunge camera from Solar System orbit into the planet's upper cloud layer
          const diveT = p / 0.5;
          this.solarSystemView.setPlanetDiveProgress(
            this.activeSlotId,
            diveT,
            false
          );
        } else {
          // Phase 2 (0.5 -> 1.0): Pierce clouds into the 3D aquatic world & descend onto the player's cell
          if (!this.transitionSwitchedScene) {
            this.transitionSwitchedScene = true;
            this.solarSystemView.setPlanetDiveProgress(
              this.activeSlotId,
              0,
              false
            );
            if (this.pendingTransitionAction === 'new_game') {
              this.executeStartNewGameImmediate(
                this.pendingTransitionGenesis,
                this.activeSlotId
              );
            } else {
              this.executePlayPlanetSlotImmediate(this.activeSlotId);
            }
            this.cameraController.setAtmosphericAltitudeFactor(
              1.0,
              this.player,
              true
            );
          }
          const descendT = 1.0 - (p - 0.5) / 0.5;
          this.cameraController.setAtmosphericAltitudeFactor(
            descendT * descendT,
            this.player,
            false
          );
        }
      } else {
        // 'exiting_to_orbit'
        if (p < 0.5) {
          // Phase 1 (0.0 -> 0.5): Ascend rapidly from water plane toward the cloudy sky
          const ascendT = p / 0.5;
          this.cameraController.setAtmosphericAltitudeFactor(
            ascendT * ascendT,
            this.player,
            false
          );
        } else {
          // Phase 2 (0.5 -> 1.0): Emerge from planet's upper atmosphere into 3D Solar System orbital focus
          if (!this.transitionSwitchedScene) {
            this.transitionSwitchedScene = true;
            this.cameraController.setAtmosphericAltitudeFactor(0, this.player);
            this.status = 'menu';
            this.solarSystemView.selectSlot(this.activeSlotId);
            this.solarSystemView.setPlanetDiveProgress(
              this.activeSlotId,
              1.0,
              true
            );
          }
          const orbitPullOutT = 1.0 - (p - 0.5) / 0.5;
          this.solarSystemView.setPlanetDiveProgress(
            this.activeSlotId,
            orbitPullOutT * orbitPullOutT,
            false
          );
        }
      }

      if (p >= 1.0) {
        this.cameraController.setAtmosphericAltitudeFactor(0, this.player);
        this.solarSystemView.setPlanetDiveProgress(this.activeSlotId, 0, false);
        this.planetaryTransition = undefined;
        this.pendingTransitionAction = null;
        this.pendingTransitionGenesis = undefined;
        this.transitionSwitchedScene = false;
      }

      this.emitUISnapshot();
    }

    // 3D Spore Panspermia New-Game Intro Cinematic ('intro_cinematic')
    if (this.status === 'intro_cinematic') {
      this.elapsedActiveTime += delta;
      this.solarSystemView.updateForIntroCinematic(
        delta,
        this.elapsedActiveTime,
        this.activeSlotId
      );
      this.environment.update(this.elapsedActiveTime, delta, 0, 0);
      this.player.updateEditorIdle(delta, this.elapsedActiveTime);

      const cineRes = this.introCinematicController.update(
        delta,
        this.elapsedActiveTime,
        this.solarSystemView.camera,
        this.cameraController.camera,
        this.player.group,
        this.settings.screenShake && !this.settings.reducedMotion
      );

      this.introCinematicState = cineRes.snapshotState;

      if (cineRes.completed) {
        this.completeIntroCinematic(false);
        this.renderer.render(
          this.environment.scene,
          this.cameraController.camera
        );
        return;
      }

      this.emitUISnapshot();

      if (cineRes.useEnvironmentScene) {
        this.renderer.render(
          this.environment.scene,
          this.cameraController.camera
        );
      } else {
        this.renderer.render(
          this.solarSystemView.scene,
          this.solarSystemView.camera
        );
      }
      return;
    }

    // 3D Spore Brain Evolution Sequence ('brain_cinematic')
    if (this.status === 'brain_cinematic') {
      this.elapsedActiveTime += delta;
      if (!this.brainCinematicState) {
        this.completeBrainCinematic(false);
        return;
      }

      this.brainCinematicState.elapsed += delta;
      const p = Math.min(
        1.0,
        this.brainCinematicState.elapsed / this.brainCinematicState.duration
      );
      this.brainCinematicState.progress = p;

      if (p < 0.25) {
        const t1 = p / 0.25;
        this.brainCinematicState.phase = 0;
        this.brainCinematicState.brainVolumeCc = Math.round(
          THREE.MathUtils.lerp(5, 35, t1)
        );
        this.brainCinematicState.synapticActivityHz = Math.round(
          THREE.MathUtils.lerp(4, 14, t1)
        );
        this.brainCinematicState.phaseTitle =
          'Fase I · Germinación Axonal y Polarización Craneal';
        this.brainCinematicState.phaseSubtitle =
          'El núcleo celular hiper-activa sus filamentos dendríticos y proyecta el tallo axonal hacia el polo anterior...';
      } else if (p < 0.65) {
        const t2 = (p - 0.25) / 0.4;
        this.brainCinematicState.phase = 1;
        this.brainCinematicState.brainVolumeCc = Math.round(
          THREE.MathUtils.lerp(35, 180, t2)
        );
        this.brainCinematicState.synapticActivityHz = Math.round(
          THREE.MathUtils.lerp(14, 29, t2)
        );
        this.brainCinematicState.phaseTitle =
          'Fase II · Expansión de Hemisferios y Girificación Cortical';
        this.brainCinematicState.phaseSubtitle =
          'Los lóbulos cerebrales bilaterales se despliegan y profundizan sus circunvoluciones y surcos sinápticos...';
      } else if (p < 0.85) {
        const t3 = (p - 0.65) / 0.2;
        this.brainCinematicState.phase = 2;
        this.brainCinematicState.brainVolumeCc = Math.round(
          THREE.MathUtils.lerp(180, 220, t3)
        );
        this.brainCinematicState.synapticActivityHz = Math.round(
          THREE.MathUtils.lerp(29, 45, t3)
        );
        this.brainCinematicState.phaseTitle =
          'Fase III · Sobrecarga Sináptica y Despertar de la Consciencia';
        this.brainCinematicState.phaseSubtitle =
          'La vesícula refractiva se disuelve e irradia impulsos motores hacia la columna vertebral del organismo...';
      } else {
        const t4 = (p - 0.85) / 0.15;
        this.brainCinematicState.phase = 3;
        this.brainCinematicState.brainVolumeCc = Math.round(
          THREE.MathUtils.lerp(220, 240, t4)
        );
        this.brainCinematicState.synapticActivityHz = Math.round(
          THREE.MathUtils.lerp(45, 38, t4)
        );
        this.brainCinematicState.phaseTitle =
          'Fase IV · Asimilación Craneal e Integración Somática';
        this.brainCinematicState.phaseSubtitle =
          'El encéfalo desciende y se fusiona con el cráneo para tomar el control motor rumbo al Nido Costero Terrestre...';
      }

      this.brainCinematicState.flashOpacity =
        p > 0.85
          ? Math.pow(Math.sin(((p - 0.85) / 0.15) * Math.PI), 1.15) * 0.92
          : 0;

      this.player.updateBrainCinematic(p, this.elapsedActiveTime);
      this.cameraController.updateBrainCinematic(
        delta,
        this.player,
        p,
        this.elapsedActiveTime
      );
      this.environment.update(
        this.elapsedActiveTime,
        delta,
        this.player.position.x,
        this.player.position.z
      );

      if (p >= 1.0) {
        this.completeBrainCinematic(false);
        this.renderer.render(
          this.environment.scene,
          this.cameraController.camera
        );
        return;
      }

      this.emitUISnapshot();
      this.renderer.render(
        this.environment.scene,
        this.cameraController.camera
      );
      return;
    }

    // 3D Cosmic Orbital Solar System Save-Slot Menu ('menu')
    if (this.status === 'menu') {
      audioManager.transitionMusicTo('menu');
      this.ambientAudioManager.silence(delta);
      this.elapsedActiveTime += delta;
      this.solarSystemView.update(delta, this.elapsedActiveTime);
      this.renderer.render(
        this.solarSystemView.scene,
        this.solarSystemView.camera
      );
      return;
    }

    // Live 3D Spore Workshop Mode while inside the Editor ('editing')
    // Secondary ocean environment simulation is frozen so 100% of GPU/CPU budget renders the Petri Dish creature at 60 FPS
    if (this.status === 'editing') {
      audioManager.transitionMusicTo('editor');
      this.ambientAudioManager.silence(delta);
      this.elapsedActiveTime += delta;
      this.player.updateEditorIdle(delta, this.elapsedActiveTime);
      this.cameraController.update(
        delta,
        this.player,
        true,
        this.elapsedActiveTime
      );
      this.renderer.render(
        this.environment.scene,
        this.cameraController.camera
      );
      return;
    }

    if (this.isEvolutionSummaryOpen) {
      this.renderer.render(
        this.environment.scene,
        this.cameraController.camera
      );
      return;
    }

    if (this.status === 'playing') {
      const inCombatAlert =
        this.nearestPredatorDistance < 18.0 &&
        (this.nearestPredatorState === 'PERSEGUIR' ||
          this.nearestPredatorState === 'ATACAR');
      audioManager.transitionMusicTo(inCombatAlert ? 'combat' : 'ocean');
      // During 'exiting_to_orbit' water ascent phase, only animate camera & environment smoothly
      if (
        this.planetaryTransition?.active &&
        this.planetaryTransition.mode === 'exiting_to_orbit'
      ) {
        this.elapsedActiveTime += delta;
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

      this.elapsedActiveTime += delta;
      this.stats.survivalTime = this.elapsedActiveTime;

      let forceUIEmit = false;

      // Update 3-second Respawn Invulnerability Timer & Blinking State
      if (this.respawnInvulnerabilityTimer > 0) {
        this.respawnInvulnerabilityTimer = Math.max(
          0,
          this.respawnInvulnerabilityTimer - delta
        );
        this.player.setInvulnerableBlinking(
          this.respawnInvulnerabilityTimer > 0
        );
      }

      // Update Discrete Autosave HUD Notification Timer
      if (this.autosaveBadgeTimer > 0) {
        this.autosaveBadgeTimer = Math.max(0, this.autosaveBadgeTimer - delta);
        if (this.autosaveBadgeTimer <= 0) {
          forceUIEmit = true;
        }
      }

      // Periodic 60-Second Checkpoint Autosave during active gameplay
      if (this.matingCallTimer <= 0 && !this.planetaryTransition?.active) {
        this.autosaveAccumulator += delta;
        if (this.autosaveAccumulator >= 60.0) {
          this.autosaveAccumulator = 0;
          this.saveToLocalStorage();
          this.autosaveBadgeTimer = 3.5;
          forceUIEmit = true;
        }
      }

      const isCreatureStage =
        this.stats.evolutionaryStage === 'creature_stage';

      // 0. Actualizar Cinemática de Cortejo / Unión Paralela (1.2s) o Eclosión Pos-Taller antes de mover al jugador
      if (
        this.matingSequence.isCinematicPlaying ||
        this.matingSequence.isHatching
      ) {
        this.matingSequence.update(delta, this.elapsedActiveTime);
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
          this.player.position.z,
          this.cameraController.camera
        );
        this.renderer.render(
          this.environment.scene,
          this.cameraController.camera
        );
        return;
      }

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
        this.isGodModeActive ||
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

      // Keep the 3D swim-plane target position updated while holding left-click in mouse mode as the camera moves
      if (
        this.settings.steeringMode === 'mouse' &&
        this.inputController.isLeftMouseDown
      ) {
        this.inputController.updateHeldPointerWorldTarget();
      }

      // 1. Posición tentativa antes de aplicar el movimiento
      const prevX = this.player.position.x;
      const prevZ = this.player.position.z;

      const nearbyPlayerObstacles = this.environment.getNearbyObstacles(
        prevX,
        prevZ,
        6.5
      );
      const moveResult = this.player.update(
        delta,
        this.elapsedActiveTime,
        this.inputController.state,
        canBoost,
        speedMultiplier,
        turnMultiplier,
        nearbyPlayerObstacles,
        this.settings.steeringMode
      );
      this.stats.isBoosting = moveResult.isBoosting;
      this.stats.speed = Math.abs(this.player.currentSpeed);
      if (this.stats.speed > 0.1) {
        if (this.tutorialManager.recordMovement(this.stats.speed * delta)) {
          forceUIEmit = true;
        }
      }

      if (isCreatureStage) {
        const newX = this.player.position.x;
        const newZ = this.player.position.z;

        // 3. Evaluar la diferencia de elevación entre la posición actual y la siguiente
        const currentGroundY = getLandHeightAt(prevX, prevZ);
        const targetGroundY = getLandHeightAt(newX, newZ);
        const slopeDelta = targetGroundY - currentGroundY;
        const horizontalDist = Math.hypot(newX - prevX, newZ - prevZ);

        // LÍMITE DE PENDIENTE ESCARPADA (Acantilado vertical impenetrable > 65 grados)
        const MAX_SLOPE_RATIO = 2.25;

        if (
          horizontalDist > 0.001 &&
          slopeDelta / horizontalDist > MAX_SLOPE_RATIO
        ) {
          // Intentar deslizamiento tangencial en X o Z antes de bloquear por completo
          const distX = Math.abs(newX - prevX);
          const distZ = Math.abs(newZ - prevZ);
          const slopeX =
            distX > 0.001
              ? (getLandHeightAt(newX, prevZ) - currentGroundY) / distX
              : Infinity;
          const slopeZ =
            distZ > 0.001
              ? (getLandHeightAt(prevX, newZ) - currentGroundY) / distZ
              : Infinity;

          if (slopeX <= MAX_SLOPE_RATIO) {
            this.player.position.x = newX;
            this.player.position.z = prevZ;
          } else if (slopeZ <= MAX_SLOPE_RATIO) {
            this.player.position.x = prevX;
            this.player.position.z = newZ;
          } else {
            this.player.position.x = prevX;
            this.player.position.z = prevZ;
            this.player.currentSpeed *= 0.25;
          }
        } else {
          // Terreno transitable: permitir el movimiento
          this.player.position.x = newX;
          this.player.position.z = newZ;
        }

        // 4. BLOQUEO DE SUELO ESTRICTO (POST-ANIMACIÓN)
        const px = this.player.position.x;
        const pz = this.player.position.z;

        // A) Cota matemática analítica directa (Garantía sin fallos de raycast)
        const mathGroundY = getLandHeightAt(px, pz);

        // B) Cota geométrica precisa con Raycaster contra el chunk visible y seabedMesh
        let actualSurfaceY = mathGroundY;
        const chunkMesh = this.environment.getTerrainMeshAt(px, pz);
        const terrainMesh = this.environment.seabedMesh;

        // Lanzar rayo desde 50 metros arriba para capturar cualquier pico de montaña
        this.terrainRaycaster.set(
          new THREE.Vector3(px, mathGroundY + 50.0, pz),
          this.rayDownVector
        );

        if (chunkMesh) {
          const chunkIntersections = this.terrainRaycaster.intersectObject(
            chunkMesh,
            true
          );
          if (chunkIntersections.length > 0) {
            actualSurfaceY = Math.max(
              actualSurfaceY,
              chunkIntersections[0].point.y
            );
          }
        }
        if (terrainMesh && terrainMesh !== chunkMesh) {
          const intersections = this.terrainRaycaster.intersectObject(
            terrainMesh,
            false
          );
          if (intersections.length > 0) {
            actualSurfaceY = Math.max(actualSurfaceY, intersections[0].point.y);
          }
        }

        const groundY = actualSurfaceY;
        const rootClearance = this.player.getGroundOffset();
        const targetRootY =
          groundY + rootClearance + this.player.heightOffset;

        // Asegurar que la base del torso no baje de la cota mínima antes de medir las extremidades
        if (this.player.position.y < targetRootY) {
          this.player.position.y = targetRootY;
          this.player.isGrounded = true;
          this.player.verticalVelocity = 0;
        }

        // Forzar actualización de matrices de mundo de la criatura para reflejar la rotación de hombros y caderas
        this.player.mesh.updateMatrixWorld(true);

        // Evaluar si alguna mano o pie ha bajado por debajo de la superficie del suelo
        const lowestLimbY = this.player.getLowestLimbWorldY();

        if (lowestLimbY < groundY) {
          // Cuántos metros se ha metido la extremidad dentro de la tierra
          const penetrationDepth = groundY - lowestLimbY;
          // Elevar el torso exactamente esa distancia para que la extremidad descanse sobre la arena
          this.player.position.y += penetrationDepth;
          this.player.isGrounded = true;
          this.player.verticalVelocity = 0;
        } else if (
          this.player.position.y > targetRootY &&
          this.player.isGrounded
        ) {
          // Asegurar que si la criatura está flotando, descienda suavemente hacia el suelo
          this.player.position.y = THREE.MathUtils.lerp(
            this.player.position.y,
            targetRootY,
            Math.min(1.0, delta * 10.0)
          );
        }

        this.player.mesh.updateMatrixWorld(true);
      }

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

      const currentBiome = this.environment.getBiomeAt(
        this.player.position.x,
        this.player.position.z
      );
      const nextBiomeLabel = isCreatureStage
        ? nearSpeciesNest
          ? 'Nido de la Especie (Regeneración Activa)'
          : currentBiome.name
        : currentBiome.name;

      if (nextBiomeLabel !== this.currentBiomeName) {
        this.currentBiomeName = nextBiomeLabel;
        forceUIEmit = true;
      }

      const isNearVentForAudio =
        !isCreatureStage &&
        this.environment.isNearThermalVent(
          this.player.position.x,
          this.player.position.z
        );

      this.ambientAudioManager.update({
        delta,
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
        arenaRadius: this.stats.activeArenaRadius ?? 110,
        growthStage: this.stats.growthStage,
        biomeId: currentBiome.id,
        isNearThermalVent: isNearVentForAudio,
        isCreatureStage,
        currentSpeed: this.player.currentSpeed,
        isBoosting: moveResult.isBoosting,
        inCombatAlert,
        nearestPredatorDistance: this.nearestPredatorDistance,
        isAbilityActive:
          this.isMatingCallActive ||
          this.electricCooldownTimer > 4.2 ||
          this.poisonSpawnCooldownTimer > 2.8,
      });

      if (isCreatureStage) {
        this.updateOceanBoundary(this.player.position, delta);
      }

      // 1A. Seguimiento de Pareja Receptiva durante el Llamado de Cortejo en cell_stage
      if (
        !isCreatureStage &&
        this.isMatingCallActive &&
        this.activeMate
      ) {
        this.mateEchoPingTimer -= delta;
        if (this.mateEchoPingTimer <= 0) {
          this.mateEchoPingTimer = 1.65;
          this.environment.spawnSonarPing(this.activeMate.position, 0xf472b6);
        }

        const distToMate = this.player.position.distanceTo(
          this.activeMate.position
        );
        if (distToMate < 2.5 && !this.matingSequence.isCinematicPlaying) {
          this.isMatingCallActive = false;
          const mateRef = this.activeMate;
          this.matingSequence.playMatingEncounter(
            this.player,
            mateRef,
            () => {
              this.status = 'editing';
              this.stageHistory.editorVisitsCount += 1;
              if (this.matingSequence.eggMesh) {
                this.matingSequence.eggMesh.visible = false;
              }
              this.setEditorSandboxIsolation(true);
              this.cameraController.resetEditorOrbit();
              this.player.hideMateCell();
              this.player.setEditorMode(true);
              this.inputController.resetInputs();
              this.setEventMessage(
                'Taller Evolutivo 3D activo: Modifica el ADN de la siguiente generación'
              );
              this.emitUISnapshot();
            }
          );
          return;
        }
      }

      // Check Mating Call courtship completion -> transition to isolated 3D Spore Workshop Sandbox
      if (this.matingCallTimer > 0) {
        this.matingCallTimer -= delta;
        if (this.matingCallTimer <= 0) {
          this.matingCallTimer = 0;
          this.status = 'editing';
          this.stageHistory.editorVisitsCount += 1;
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
          this.player.position.z,
          this.cameraController.camera
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
          this.triggerMatingCall();
          forceUIEmit = true;
        }
      }


      const predatorClose =
        this.nearestPredatorDistance < 12.0 &&
        (this.nearestPredatorState === 'PERSEGUIR' ||
          this.nearestPredatorState === 'ATACAR');

      if (predatorClose) {
        audioManager.playThreatRoar();
      }

      if (
        hasPoisonGland &&
        this.poisonSpawnCooldownTimer <= 0 &&
        (moveResult.isBoosting || predatorClose)
      ) {
        this.player.spawnPoisonCloud();
        audioManager.playPoisonHiss();
        this.poisonSpawnCooldownTimer = 1.2;
      }

      if (abilityJustTriggered) {
        let usedAnyAbility = false;

        if (hasFlashPhotophore && this.electricCooldownTimer <= 0 && this.stats.energy >= 6) {
          this.stats.energy = Math.max(0, this.stats.energy - 6);
          this.electricCooldownTimer = 4.0;
          this.player.triggerSocialWave(8.0);
          audioManager.playElectricZap();
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
              audioManager.playAcidSplash();
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
              audioManager.playElectricZap();
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
          audioManager.playPoisonHiss();
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
      if (
        rotaryDrillStacks > 0 &&
        (this.inputController.state.forward ||
          (this.inputController.isLeftMouseDown && moveResult.isMoving))
      ) {
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

      if (this.isGodModeActive) {
        this.stats.energy = this.stats.maxEnergy;
        this.stats.health = this.stats.maxHealth;
        this.stats.isStarving = false;
      } else {
        this.stats.energy = Math.max(0, this.stats.energy - energyDrain);
      }

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

      // Curación pasiva dentro del Nido Central de la Especie (distToNest < 8.0m)
      if (isCreatureStage) {
        const distToNest = Math.hypot(
          this.player.position.x,
          this.player.position.z
        );
        if (distToNest < 8.0 || nearSpeciesNest) {
          this.stats.health = Math.min(
            this.stats.maxHealth,
            this.stats.health + 5.0 * delta
          );
          this.stats.energy = Math.min(
            this.stats.maxEnergy,
            this.stats.energy + 6.0 * delta
          );
        }
      }

      // 3. Starvation Consequence
      if (!this.isGodModeActive && this.stats.energy <= 0) {
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
      if (isCreatureStage) {
        this.environment.updateFruitBushes(delta);

        const canEatPlants =
          this.stats.diet === 'herbivore' ||
          this.stats.diet === 'omnivore' ||
          hasChloroplast;
        if (canEatPlants) {
          for (const bush of this.environment.fruitBushes) {
            const distToBush = this.player.position.distanceTo(bush.position);
            if (distToBush < 3.2) {
              const availableFruit = bush.fruits.find((f) => !f.isHarvested);
              if (availableFruit) {
                availableFruit.isHarvested = true;
                availableFruit.mesh.visible = false;
                availableFruit.respawnTimer = 45.0; // 45 segundos en madurar de nuevo

                this.stats.health = Math.min(
                  this.stats.maxHealth,
                  this.stats.health + 20
                );
                this.stats.energy = Math.min(
                  this.stats.maxEnergy,
                  this.stats.energy + 30
                );
                this.stats.foodEaten += 1;
                const leveledUp = this.addAdn(15);
                this.predatorManager.spawnFloatingText(
                  '+15 ADN (Fruta)',
                  this.player.position,
                  '#22c55e'
                );
                if (!leveledUp) {
                  this.setEventMessage(
                    '+15 ADN (Fruta) · +20 Salud · +30 Energía'
                  );
                }
                forceUIEmit = true;
                break; // Recolecta 1 fruta por ciclo de contacto
              }
            }
          }
        }
      }

      const foodResult = this.foodManager.update(
        delta,
        this.elapsedActiveTime,
        this.player.position,
        this.stats.diet,
        hasChloroplast,
        hasFilterMouth,
        baleenStacks > 0,
        radulaStacks > 0,
        this.stats.innateTrait === 'voracious_chemotaxis',
        this.player.currentSpeed,
        this.predatorManager.getActiveOrganismsForFoodCollision()
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
        this.stageHistory.plantsEaten += foodResult.plantsEaten;
        this.stageHistory.meatsEaten += foodResult.meatEaten;

        if (!isCreatureStage && foodResult.plantsEaten > 0) {
          this.stats.health = Math.min(
            this.stats.maxHealth,
            this.stats.health + 4 * foodResult.plantsEaten
          );
        }
        if (foodResult.meatEaten > 0) {
          if (isCreatureStage) {
            this.stats.health = Math.min(
              this.stats.maxHealth,
              this.stats.health + 35 * foodResult.meatEaten
            );
            this.predatorManager.spawnFloatingText(
              '+25 ADN (Carne Fresca)',
              this.player.position,
              '#ef4444'
            );
          } else {
            this.stats.health = Math.min(
              this.stats.maxHealth,
              this.stats.health + 12 * foodResult.meatEaten
            );
          }
        }
        this.stats.foodEaten += foodResult.itemsEaten;
        if (this.tutorialManager.recordFoodEaten()) {
          forceUIEmit = true;
        }
        const leveledUp = this.addAdn(foodResult.adnGained);
        if (!leveledUp && !isolatedNewGene) {
          if (isCreatureStage && foodResult.meatEaten > 0) {
            this.setEventMessage(
              `+${foodResult.adnGained} ADN (Carne Fresca) · +${35 * foodResult.meatEaten} Salud · +${finalEnergyGained} Energía`
            );
          } else {
            this.setEventMessage(
              `+${foodResult.adnGained} ADN · +${finalEnergyGained} Energía`
            );
          }
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

      if (!isCreatureStage && this.isMatingCallActive && this.activeMate) {
        this.player.updateChemoreceptorCompass(
          this.activeMate.position,
          false,
          this.elapsedActiveTime,
          true
        );
      } else if (chemoreceptorStacks > 0) {
        let chemoTarget = this.foodManager.findNearestTargetForChemoreceptor(
          this.player.position,
          this.stats.diet,
          hasChloroplast
        );
        if (
          !chemoTarget &&
          isCreatureStage &&
          (this.stats.diet === 'herbivore' ||
            this.stats.diet === 'omnivore' ||
            hasChloroplast)
        ) {
          let nearestBushDistSq = Infinity;
          for (const bush of this.environment.fruitBushes) {
            if (bush.fruits.some((f) => !f.isHarvested)) {
              const dSq = this.player.position.distanceToSquared(bush.position);
              if (dSq < nearestBushDistSq) {
                nearestBushDistSq = dSq;
                chemoTarget = { position: bush.position, isGeneticNodule: false };
              }
            }
          }
        }
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

      const canPredateHerbivores =
        hasJaw ||
        hasProboscis ||
        (isCreatureStage &&
          (this.stats.diet === 'carnivore' || this.stats.diet === 'omnivore'));
      const canDevourWeakenedHunters =
        (this.stats.growthStage >= 3 || crusherStacks > 0 || isCreatureStage) &&
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
        (
          killedPos,
          geneticTraits,
          speciesName,
          _killedByPlayer,
          creatureTier,
          meatDropCount
        ) => {
          if (!isCreatureStage) {
            this.stageHistory.microbesKilled += 1;
          }
          this.foodManager.spawnMeatDrop(
            killedPos,
            meatDropCount,
            creatureTier ?? 1
          );
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
        effectiveRetaliationSpikes,
        this.player.headingAngle,
        this.stats.attackPower,
        moveResult.isBoosting
      );

      // Apply physical recoil bounce to player when biting or colliding in melee so cells separate cleanly (2.5m-4.0m)
      if (ecosystemResult.playerBounceTargetPosition) {
        this.player.applyCombatBounce(
          ecosystemResult.playerBounceTargetPosition,
          14.5
        );
      }

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

      if (
        !this.isGodModeActive &&
        ecosystemResult.totalDamageDealt > 0 &&
        this.respawnInvulnerabilityTimer <= 0
      ) {
        // Mucus gland: 40% chance that the bite slips off without dealing damage!
        const mucusSlipped = mucusGlandStacks > 0 && Math.random() < 0.4;
        if (mucusSlipped) {
          audioManager.playShieldDeflect();
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

          this.lastAttackerSpeciesName =
            ecosystemResult.attackerSpeciesName ?? 'Depredador Abisal';
          this.stats.health = Math.max(0, this.stats.health - effectiveDamage);
          this.stats.damageFlashTime = 0.4;
          if (
            totalRed >= 0.15 ||
            armorStacks > 0 ||
            chitinShieldStacks > 0 ||
            hydroCarapaceStacks > 0 ||
            silicaSpiculeStacks > 0
          ) {
            audioManager.playShieldDeflect();
          }
          audioManager.playDamageTaken();
          this.predatorManager.spawnFloatingDamageNumber(
            this.player.position,
            effectiveDamage,
            'player_hit'
          );
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
        this.player.position.z,
        this.cameraController.camera
      );
      this.introCinematicController.updatePermanentMonument(
        delta,
        this.elapsedActiveTime,
        this.stats.evolutionaryStage === 'cell_stage' &&
          this.matingCallTimer <= 0
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

  private leviathanEncounterCooldown = 0;

  /**
   * Límite Natural al Estilo Spore: El Leviatán Marino.
   * Si la criatura nada mar adentro hacia las aguas profundas (> SHALLOW_WATER_LIMIT o elevación < -4.0m),
   * emerge el Leviatán Marino y la lanza de vuelta hacia la costa más cercana.
   */
  public updateOceanBoundary(playerPos: THREE.Vector3, dt: number): void {
    if (this.leviathanEncounterCooldown > 0) {
      this.leviathanEncounterCooldown = Math.max(
        0,
        this.leviathanEncounterCooldown - dt
      );
    }

    const distFromCenter = Math.hypot(playerPos.x, playerPos.z);
    const currentElevation = getLandHeightAt(playerPos.x, playerPos.z);

    // 1. Entrada al agua: si se adentra en aguas profundas, alerta y empuje del Leviatán
    if (
      distFromCenter > CONTINENT_CONFIG.SHALLOW_WATER_LIMIT ||
      currentElevation < -4.0
    ) {
      this.triggerLeviathanEncounter(playerPos, dt);
    }
  }

  private triggerLeviathanEncounter(playerPos: THREE.Vector3, dt: number): void {
    // Vibración de cámara y rugido abisal
    this.cameraController.shake(0.6);

    if (this.leviathanEncounterCooldown <= 0) {
      this.leviathanEncounterCooldown = 1.8;
      audioManager.playLeviathanRoar();
      this.environment.triggerLeviathanVisual(playerPos);
      this.setEventMessage(
        '¡PELIGRO ABISAL! El Leviatán Marino custodia el océano profundo y te lanza de vuelta a la costa'
      );
    }

    // Empuje hidrodinámico masivo que lanza al jugador de vuelta a la playa más cercana
    const dirToShore = new THREE.Vector2(-playerPos.x, -playerPos.z).normalize();
    playerPos.x += dirToShore.x * 45.0 * dt;
    playerPos.z += dirToShore.y * 45.0 * dt;
    const shoreGroundY = getLandHeightAt(playerPos.x, playerPos.z);
    playerPos.y = Math.max(shoreGroundY, -0.2) + 2.5;
    this.player.group.position.copy(playerPos);
  }

  private footerDeathCleanup(): void {
    // DO NOT delete localStorage on death so the player can respawn at the last saved checkpoint or return to the Solar System!
    audioManager.playCreatureDeath();
    if (this.stats.isStarving && this.stats.energy <= 0) {
      this.deathCauseDescription =
        'Inanición metabólica: Las reservas de energía celular se agotaron por completo.';
    } else if (this.lastAttackerSpeciesName) {
      this.deathCauseDescription = `Depredación letal por ${this.lastAttackerSpeciesName}: La membrana celular colapsó tras el impacto.`;
    } else {
      this.deathCauseDescription =
        'Colapso estructural de la membrana celular en aguas hostiles.';
    }
    this.setEventMessage('Membrana celular colapsada');
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
      activeSlotId: this.activeSlotId,
      selectedMenuSlotId: this.selectedMenuSlotId,
      hoveredMenuSlotId: this.hoveredMenuSlotId,
      planetSlots: this.planetSlots.map((p) => ({ ...p })),
      settings: { ...this.settings },
      stats: {
        ...this.stats,
        torsoRadii: [...this.stats.torsoRadii] as [number, number, number],
        bodySegments: (this.stats.bodySegments ?? createDefaultBodySegments()).map(
          (s) => ({ ...s })
        ),
        creatureMorphology: {
          ...(this.stats.creatureMorphology ?? DEFAULT_CREATURE_MORPHOLOGY),
        },
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
      selectedBodySegmentId: this.selectedBodySegmentId,
      selectedSphereIndex: this.selectedSphereIndex,
      editorSelectionTarget: this.editorSelectionTarget,
      canUndoEditor: this.editorHistoryStack.length > 0,
      canRedoEditor: this.editorRedoStack.length > 0,
      editorPreviewAction: this.editorPreviewAction,
      planetaryTransition: this.planetaryTransition
        ? { ...this.planetaryTransition }
        : undefined,
      introCinematic: this.introCinematicState
        ? { ...this.introCinematicState }
        : undefined,
      brainCinematic: this.brainCinematicState
        ? { ...this.brainCinematicState }
        : undefined,
      isEvolutionSummaryOpen: this.isEvolutionSummaryOpen,
      stageEvolutionHistory: { ...this.stageHistory },
      tutorialState: this.tutorialManager.getState(),
      autosaveNotificationVisible: this.autosaveBadgeTimer > 0,
      deathCauseDescription: this.deathCauseDescription,
      isGodModeActive: this.isGodModeActive,
      isAIFrozen: this.isAIFrozen,
    });
  }

  private handleResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.cameraController.handleResize(width, height);
    this.solarSystemView.handleResize(width, height);
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

    this.cameraController.disposeMouseListeners();
    this.inputController.dispose();
    this.timer.dispose();
    this.player.dispose();
    this.foodManager.dispose();
    this.fossilMeteorManager.dispose();
    this.predatorManager.dispose();
    this.introCinematicController.dispose();
    this.environment.dispose();
    this.solarSystemView.dispose();
    this.renderer.dispose();
  }
}
