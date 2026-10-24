import * as THREE from 'three';
import { CameraController } from './CameraController';
import { GAME_CONFIG } from './config';
import { FoodManager } from './FoodManager';
import { InputController } from './InputController';
import { PlayerCell } from './PlayerCell';
import { PredatorManager } from './PredatorManager';
import { SceneEnvironment } from './SceneEnvironment';
import {
  CellularEvolutionSlot,
  DietType,
  GameStatus,
  GameUISnapshot,
  InputState,
  PlayerStats,
  PredatorBehaviorState,
} from './types';

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly environment: SceneEnvironment;
  private readonly player: PlayerCell;
  private readonly cameraController: CameraController;
  private readonly foodManager: FoodManager;
  private readonly predatorManager: PredatorManager;
  private readonly inputController: InputController;
  private readonly timer: THREE.Timer;

  private status: GameStatus = 'playing';
  private stats: PlayerStats;
  private recentEventMessage: string | null = null;
  private eventMessageTimer = 0;

  public readonly preparedEvolutionCatalog: CellularEvolutionSlot[] = [
    {
      id: 'mouth_jaw',
      name: 'Mandíbula Aserrada',
      description:
        'Potentes pinzas quitinosas frontales que cambian tu dieta a Carnívora, permitiendo digerir fragmentos de carne y devorar células filtradoras.',
      statSummary: 'Dieta Carnívora · Depreda Células Filtradoras',
      category: 'metabolismo',
      costAdn: 15,
      unlocked: false,
    },
    {
      id: 'mouth_proboscis',
      name: 'Probóscide Succionadora',
      description:
        'Tubo succionador especializado que otorga Dieta Omnívora total (vegetal y carne), +25% de energía por alimento y drena ADN al contacto.',
      statSummary: 'Dieta Omnívora · +25% Energía · Drena ADN',
      category: 'metabolismo',
      costAdn: 25,
      unlocked: false,
    },
    {
      id: 'flagellum_2',
      name: 'Flagelo Bimotor',
      description:
        'Desarrolla un par adicional de flagelos laterales articulados que incrementan el empuje hidrodinámico y la agilidad de maniobra.',
      statSummary: '+25% Velocidad · +15% Giro',
      category: 'locomocion',
      costAdn: 20,
      unlocked: false,
    },
    {
      id: 'chloroplast_1',
      name: 'Cloroplastos Simbióticos',
      description:
        'Integra orgánulos fotosintéticos internos capaces de sintetizar energía de la luz filtrada, reduciendo el gasto basal.',
      statSummary: '-50% Consumo Pasivo · +30 Energía Máx.',
      category: 'metabolismo',
      costAdn: 30,
      unlocked: false,
    },
    {
      id: 'poison_gland',
      name: 'Glándula de Veneno',
      description:
        'Vesícula posterior bioluminiscente que libera nubes tóxicas al usar Impulso (Espacio), al acercarse un depredador (< 12m) o al pulsar Q, ralentizando un 45% y repeliendo amenazas.',
      statSummary: 'Nube Tóxica (Q / Auto <12m) · -45% Vel. Enemiga',
      category: 'defensa',
      costAdn: 35,
      unlocked: false,
    },
    {
      id: 'rostral_spines',
      name: 'Espolones Rostrales',
      description:
        'Añade dos púas frontales calcificadas que permiten embestir con Impulso (Espacio) a los depredadores (< 3.4m) y ahuyentarlos.',
      statSummary: 'Contraataque con Impulso (< 3.4m)',
      category: 'defensa',
      costAdn: 40,
      unlocked: false,
    },
    {
      id: 'membrane_armor',
      name: 'Corteza Quitinizada',
      description:
        'Refuerza el dorso celular con placas quitinosas que amortiguan las mordidas de los depredadores y amplían la vitalidad.',
      statSummary: '+40 Vida Máx. · -30% Daño Recibido',
      category: 'defensa',
      costAdn: 45,
      unlocked: false,
    },
    {
      id: 'electric_cell',
      name: 'Órgano Bioeléctrico',
      description:
        'Nodos bioeléctricos laterales que emiten un pulso de área de 9.5m al pulsar Q (12 Energía, 6s enfriamiento): aturde depredadores 3.2s y electrocuta células filtradoras.',
      statSummary: 'Pulso 9.5m (Tecla Q) · Aturde 3.2s · Electrocuta',
      category: 'defensa',
      costAdn: 50,
      unlocked: false,
    },
  ];

  private readonly unlockedSlotIds = new Set<string>();
  private static readonly STORAGE_KEY = 'evolife_cellular_save_v1';

  private animationFrameId: number | null = null;
  private uiSyncAccumulator = 0;
  private elapsedActiveTime = 0;
  private electricCooldownTimer = 0;
  private poisonSpawnCooldownTimer = 0;
  private matingCallTimer = 0;
  private wasAbilityPressed = false;
  private currentBiomeName = 'Pradera Bioluminiscente';
  private completedQuestStep: 0 | 1 | 2 | 3 | 4 = 0;
  private isEvaluatingQuests = false;
  private nearestSpeciesName = 'Mandíbula Rápida';
  private nearestPredatorState: PredatorBehaviorState = 'DEAMBULAR';
  private nearestPredatorDistance = 999;

  private readonly onUISnapshot: (snapshot: GameUISnapshot) => void;
  private readonly boundResize: () => void;
  private readonly boundContextLost: (e: Event) => void;

  constructor(
    container: HTMLElement,
    onUISnapshot: (snapshot: GameUISnapshot) => void
  ) {
    this.container = container;
    this.onUISnapshot = onUISnapshot;

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

    // Clear container and mount canvas
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(this.renderer.domElement);

    this.environment = new SceneEnvironment(this.renderer);
    this.player = new PlayerCell(this.environment.scene);
    this.cameraController = new CameraController(width / Math.max(height, 1));
    this.foodManager = new FoodManager(this.environment.scene);
    this.predatorManager = new PredatorManager(this.environment.scene);
    this.inputController = new InputController(
      () => this.togglePause(),
      () => this.toggleEditor()
    );

    this.stats = this.createInitialStats();
    this.loadFromLocalStorage();
    this.currentBiomeName = this.environment.getBiomeAt(
      this.player.position.x,
      this.player.position.z
    ).name;

    this.timer = new THREE.Timer();
    this.timer.connect(document);

    // Pre-compile shaders once
    this.renderer.compile(this.environment.scene, this.cameraController.camera);

    this.boundResize = this.handleResize.bind(this);
    this.boundContextLost = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('resize', this.boundResize);
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.boundContextLost,
      false
    );

    this.emitUISnapshot();
    this.startLoop();
  }

  private createInitialStats(): PlayerStats {
    return {
      health: GAME_CONFIG.PLAYER.INITIAL_HEALTH,
      maxHealth: GAME_CONFIG.PLAYER.MAX_HEALTH,
      energy: GAME_CONFIG.PLAYER.INITIAL_ENERGY,
      maxEnergy: GAME_CONFIG.PLAYER.MAX_ENERGY,
      adn: GAME_CONFIG.PLAYER.INITIAL_ADN,
      totalAdnEarned: GAME_CONFIG.PLAYER.INITIAL_ADN,
      growthStage: 1,
      nextStageAdnThreshold: 60,
      diet: 'herbivore',
      foodEaten: 0,
      survivalTime: 0,
      isStarving: false,
      isBoosting: false,
      boostCooldownRatio: 1,
      abilityCooldownRatio: 1,
      activeStatusEffect: null,
      speed: 0,
      damageFlashTime: 0,
    };
  }

  private saveToLocalStorage(): void {
    if (this.status === 'gameover' || this.stats.health <= 0) return;
    try {
      const payload = {
        stats: {
          health: this.stats.health,
          energy: this.stats.energy,
          adn: this.stats.adn,
          totalAdnEarned: this.stats.totalAdnEarned,
          growthStage: this.stats.growthStage,
          foodEaten: this.stats.foodEaten,
          survivalTime: this.stats.survivalTime,
        },
        unlockedSlotIds: Array.from(this.unlockedSlotIds),
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

      this.unlockedSlotIds.clear();
      if (Array.isArray(parsed.unlockedSlotIds)) {
        for (const id of parsed.unlockedSlotIds) {
          if (typeof id === 'string') {
            this.unlockedSlotIds.add(id);
          }
        }
      }

      for (const slot of this.preparedEvolutionCatalog) {
        slot.unlocked = this.unlockedSlotIds.has(slot.id);
      }

      const stageRaw = parsed.stats.growthStage;
      const validStage: 1 | 2 | 3 =
        stageRaw === 3 ? 3 : stageRaw === 2 ? 2 : 1;

      this.stats.growthStage = validStage;
      this.stats.adn = Math.max(0, Number(parsed.stats.adn) || 0);
      this.stats.totalAdnEarned = Math.max(
        this.stats.adn,
        Number(parsed.stats.totalAdnEarned) || 0
      );
      this.stats.nextStageAdnThreshold = validStage === 1 ? 60 : 140;
      this.stats.foodEaten = Math.max(0, Number(parsed.stats.foodEaten) || 0);
      this.stats.survivalTime = Math.max(
        0,
        Number(parsed.stats.survivalTime) || 0
      );
      this.elapsedActiveTime = this.stats.survivalTime;
      this.stats.diet = this.computeCurrentDiet();

      this.recalculateVitalCaps();
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

      this.player.setGrowthStage(validStage);
      this.player.syncEvolutionParts(this.unlockedSlotIds);
      this.evaluateQuests(true);
      this.setEventMessage('Partida celular restaurada automáticamente');
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

  private evaluateQuests(silent = false): boolean {
    if (this.isEvaluatingQuests) return false;
    this.isEvaluatingQuests = true;
    let questAdvanced = false;

    try {
      // Misión 1: Primeros Nutrientes — Acumular 20 ADN totales (+10 ADN de recompensa)
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

      // Misión 2: Adaptación Morfológica — Instalar al menos 1 órgano en el Editor (+15 ADN de recompensa)
      if (this.completedQuestStep === 1 && this.unlockedSlotIds.size >= 1) {
        this.completedQuestStep = 2;
        questAdvanced = true;
        this.addAdn(15);
        if (!silent) {
          this.setEventMessage(
            '¡Misión 2 completada: Adaptación Morfológica! (+15 ADN de recompensa)'
          );
        }
      }

      // Misión 3: Supervivencia y Crecimiento — Alcanzar Fase 2 (60 ADN totales) y desbloquear >= 3 órganos (+20 ADN)
      if (
        this.completedQuestStep === 2 &&
        this.stats.growthStage >= 2 &&
        this.unlockedSlotIds.size >= 3
      ) {
        this.completedQuestStep = 3;
        questAdvanced = true;
        this.addAdn(20);
        if (!silent) {
          this.setEventMessage(
            '¡Misión 3 completada: Supervivencia y Crecimiento! (+20 ADN de recompensa)'
          );
        }
      }

      // Misión 4: Salto Evolutivo: Cerebro Primitivo — Alcanzar Fase 3 y acumular 200 ADN totales
      if (
        this.completedQuestStep === 3 &&
        this.stats.growthStage === 3 &&
        this.stats.totalAdnEarned >= 200
      ) {
        this.completedQuestStep = 4;
        questAdvanced = true;
        if (!silent) {
          this.setEventMessage(
            '¡Salto Evolutivo completado! Cerebro Primitivo desarrollado: Listo para la Transición Terrestre'
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
    if (this.completedQuestStep === 0) {
      const current = Math.min(20, this.stats.totalAdnEarned);
      return {
        title: 'Misión 1/4 · Primeros Nutrientes',
        progressText: `Acumula 20 ADN totales (${current}/20 ADN) · Recompensa: +10 ADN`,
      };
    }
    if (this.completedQuestStep === 1) {
      const organs = Math.min(1, this.unlockedSlotIds.size);
      return {
        title: 'Misión 2/4 · Adaptación Morfológica',
        progressText: `Instala 1 órgano en el Editor con E (${organs}/1 órgano) · Recompensa: +15 ADN`,
      };
    }
    if (this.completedQuestStep === 2) {
      const organs = Math.min(3, this.unlockedSlotIds.size);
      const stageStatus =
        this.stats.growthStage >= 2 ? 'Fase 2 OK' : 'Alcanza Fase 2 (60 ADN)';
      return {
        title: 'Misión 3/4 · Supervivencia y Crecimiento',
        progressText: `${stageStatus} y equipa 3 órganos (${organs}/3) · Recompensa: +20 ADN`,
      };
    }
    if (this.completedQuestStep === 3) {
      const currentAdn = Math.min(200, this.stats.totalAdnEarned);
      const stageStatus =
        this.stats.growthStage === 3 ? 'Fase 3 OK' : 'Alcanza Fase 3 (140 ADN)';
      return {
        title: 'Misión 4/4 · Salto Evolutivo: Cerebro Primitivo',
        progressText: `${stageStatus} y acumula 200 ADN totales (${currentAdn}/200 ADN)`,
      };
    }
    return {
      title: 'Culminación Celular · Cerebro Primitivo Activo',
      progressText:
        '¡Listo para la Transición Terrestre! Has dominado el ecosistema microscópico',
    };
  }

  private computeCurrentDiet(): DietType {
    const hasProboscis = this.unlockedSlotIds.has('mouth_proboscis');
    const hasJaw = this.unlockedSlotIds.has('mouth_jaw');
    const hasChloroplast = this.unlockedSlotIds.has('chloroplast_1');

    if (hasProboscis || (hasJaw && hasChloroplast)) {
      return 'omnivore';
    }
    if (hasJaw) {
      return 'carnivore';
    }
    return 'herbivore';
  }

  private recalculateVitalCaps(): void {
    const growthHealthBonus =
      this.stats.growthStage === 3
        ? 40
        : this.stats.growthStage === 2
        ? 20
        : 0;
    const armorHealthBonus = this.unlockedSlotIds.has('membrane_armor')
      ? 40
      : 0;
    this.stats.maxHealth =
      GAME_CONFIG.PLAYER.MAX_HEALTH + growthHealthBonus + armorHealthBonus;
    this.stats.health = Math.min(this.stats.maxHealth, this.stats.health);

    const chloroEnergyBonus = this.unlockedSlotIds.has('chloroplast_1')
      ? 30
      : 0;
    this.stats.maxEnergy = GAME_CONFIG.PLAYER.MAX_ENERGY + chloroEnergyBonus;
    this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy);
  }

  private addAdn(amount: number): boolean {
    if (amount <= 0) return false;
    this.stats.adn += amount;
    this.stats.totalAdnEarned += amount;

    const total = this.stats.totalAdnEarned;
    const targetStage: 1 | 2 | 3 = total >= 140 ? 3 : total >= 60 ? 2 : 1;
    this.stats.nextStageAdnThreshold = targetStage === 1 ? 60 : 140;

    let stageUp = false;
    if (targetStage > this.stats.growthStage) {
      const prevMax = this.stats.maxHealth;
      this.stats.growthStage = targetStage;
      this.player.setGrowthStage(targetStage);
      this.recalculateVitalCaps();
      const bonus = Math.max(0, this.stats.maxHealth - prevMax);
      this.stats.health = Math.min(
        this.stats.maxHealth,
        this.stats.health + bonus
      );
      if (targetStage === 2) {
        this.setEventMessage(
          '¡Crecimiento Celular! Fase 2/3: Célula Desarrollada (+20 Vida Máx.)'
        );
      } else {
        this.setEventMessage(
          '¡Culminación Celular! Fase 3/3: Organismo Macrocelular (+40 Vida Máx.)'
        );
      }
      stageUp = true;
    }

    const questCompleted = this.evaluateQuests();
    if (!questCompleted) {
      this.saveToLocalStorage();
    }

    return stageUp || questCompleted;
  }

  public togglePause(): void {
    if (this.status === 'gameover') return;

    if (this.status === 'editing') {
      this.status = 'playing';
      this.matingCallTimer = 0;
      this.player.hideMateCell();
      this.timer.update();
      this.emitUISnapshot();
      return;
    }

    if (this.status === 'playing') {
      this.status = 'paused';
      this.matingCallTimer = 0;
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
    if (this.status === 'gameover') return;

    if (this.status === 'editing') {
      this.status = 'playing';
      this.matingCallTimer = 0;
      this.player.hideMateCell();
      this.timer.update();
      this.emitUISnapshot();
      return;
    }

    if (this.status === 'paused') {
      this.status = 'editing';
      this.matingCallTimer = 0;
      this.player.startMatingCall();
      this.inputController.resetInputs();
      this.emitUISnapshot();
      return;
    }

    // In 'playing' status: if already calling mate, skip remaining courtship and open editor immediately
    if (this.matingCallTimer > 0) {
      this.matingCallTimer = 0;
      this.status = 'editing';
      this.inputController.resetInputs();
      this.emitUISnapshot();
      return;
    }

    // Start 0.85s Spore-style Mating Call & Partner Cell approach before opening Editor
    this.matingCallTimer = 0.85;
    this.player.startMatingCall();
    this.setEventMessage(
      'Llamada de apareamiento: Pareja celular acudiendo...'
    );
    this.emitUISnapshot();
  }

  public closeEditor(): void {
    if (this.status === 'editing' || this.matingCallTimer > 0) {
      this.status = 'playing';
      this.matingCallTimer = 0;
      this.player.hideMateCell();
      this.timer.update();
      this.emitUISnapshot();
    }
  }

  public unlockEvolutionSlot(slotId: string): boolean {
    const slot = this.preparedEvolutionCatalog.find((s) => s.id === slotId);
    if (!slot || slot.unlocked || this.stats.adn < slot.costAdn) {
      return false;
    }

    this.stats.adn -= slot.costAdn;
    slot.unlocked = true;
    this.unlockedSlotIds.add(slot.id);
    this.stats.diet = this.computeCurrentDiet();
    this.recalculateVitalCaps();

    if (slot.id === 'chloroplast_1') {
      this.stats.energy = Math.min(this.stats.maxEnergy, this.stats.energy + 30);
      this.stats.isStarving = false;
    } else if (slot.id === 'membrane_armor') {
      this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + 40);
    }

    this.player.syncEvolutionParts(this.unlockedSlotIds);
    const questCompleted = this.evaluateQuests();
    if (!questCompleted) {
      this.setEventMessage(`Evolución completada: ${slot.name}`);
      this.saveToLocalStorage();
    }
    this.emitUISnapshot();
    return true;
  }

  public refundEvolutionSlot(slotId: string): boolean {
    const slot = this.preparedEvolutionCatalog.find((s) => s.id === slotId);
    if (!slot || !slot.unlocked) {
      return false;
    }

    slot.unlocked = false;
    this.unlockedSlotIds.delete(slot.id);
    this.stats.adn += slot.costAdn;
    this.stats.diet = this.computeCurrentDiet();
    this.recalculateVitalCaps();

    this.player.syncEvolutionParts(this.unlockedSlotIds);
    this.saveToLocalStorage();
    this.setEventMessage(
      `Órgano retirado: ${slot.name} (+${slot.costAdn} ADN reembolsado)`
    );
    this.emitUISnapshot();
    return true;
  }

  public resumeGame(): void {
    if (this.status === 'paused' || this.status === 'editing') {
      this.status = 'playing';
      this.matingCallTimer = 0;
      this.player.hideMateCell();
      this.timer.update();
      this.emitUISnapshot();
    }
  }

  public restartGame(): void {
    this.clearLocalStorage();
    this.status = 'playing';
    for (const slot of this.preparedEvolutionCatalog) {
      slot.unlocked = false;
    }
    this.unlockedSlotIds.clear();

    this.stats = this.createInitialStats();
    this.completedQuestStep = 0;
    this.currentBiomeName = 'Pradera Bioluminiscente';
    this.elapsedActiveTime = 0;
    this.electricCooldownTimer = 0;
    this.poisonSpawnCooldownTimer = 0;
    this.matingCallTimer = 0;
    this.wasAbilityPressed = false;
    this.recentEventMessage = 'Nueva generación celular iniciada';
    this.eventMessageTimer = 2.8;

    this.inputController.resetInputs();
    this.player.reset();
    this.cameraController.resetImmediate(
      this.player.position,
      this.player.headingAngle
    );
    this.foodManager.resetAll();
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
    this.timer.update(timestamp);
    const rawDelta = this.timer.getDelta();
    // Clamp delta to avoid large jumps on tab switch
    const delta = Math.min(rawDelta, 0.1);

    if (this.status === 'playing') {
      this.elapsedActiveTime += delta;
      this.stats.survivalTime = this.elapsedActiveTime;

      let forceUIEmit = false;

      const hasJaw = this.unlockedSlotIds.has('mouth_jaw');
      const hasProboscis = this.unlockedSlotIds.has('mouth_proboscis');
      const hasFlagellum2 = this.unlockedSlotIds.has('flagellum_2');
      const hasChloroplast = this.unlockedSlotIds.has('chloroplast_1');
      const hasPoisonGland = this.unlockedSlotIds.has('poison_gland');
      const hasSpines = this.unlockedSlotIds.has('rostral_spines');
      const hasArmor = this.unlockedSlotIds.has('membrane_armor');
      const hasElectricCell = this.unlockedSlotIds.has('electric_cell');

      // Update ability cooldown timers
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

      // 1. Update Player Movement & Propulsion
      const canBoost =
        this.stats.energy >= GAME_CONFIG.PLAYER.MIN_ENERGY_FOR_BOOST;
      const speedMultiplier = hasFlagellum2 ? 1.25 : 1.0;
      const turnMultiplier = hasFlagellum2 ? 1.15 : 1.0;

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

      // Detect Submarine Biome transition
      const biomeInfo = this.environment.getBiomeAt(
        this.player.position.x,
        this.player.position.z
      );
      if (biomeInfo.name !== this.currentBiomeName) {
        this.currentBiomeName = biomeInfo.name;
        forceUIEmit = true;
      }

      // Check Mating Call courtship completion -> transition to Creature Editor
      if (this.matingCallTimer > 0) {
        this.matingCallTimer -= delta;
        if (this.matingCallTimer <= 0) {
          this.matingCallTimer = 0;
          this.status = 'editing';
          this.inputController.resetInputs();
          this.setEventMessage(
            'Pareja celular unida: Configura la nueva puesta genética'
          );
          this.emitUISnapshot();
          this.renderer.render(
            this.environment.scene,
            this.cameraController.camera
          );
          return;
        }
      }

      // 1B. Active Cellular Weapons (KeyQ + Auto Poison Trail)
      const abilityPressedNow = this.inputController.state.ability;
      const abilityJustTriggered = abilityPressedNow && !this.wasAbilityPressed;
      this.wasAbilityPressed = abilityPressedNow;

      let electricPulseTriggered = false;

      // Automatic or Boost-triggered Poison Cloud release (every 1.2s when boosting or threat < 12m)
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

      // Manual KeyQ activation
      if (abilityJustTriggered) {
        let usedAnyAbility = false;

        if (hasElectricCell) {
          if (this.electricCooldownTimer <= 0) {
            if (this.stats.energy >= 12) {
              this.stats.energy = Math.max(0, this.stats.energy - 12);
              this.electricCooldownTimer = 6.0;
              this.player.triggerElectricPulse();
              electricPulseTriggered = true;
              usedAnyAbility = true;
              this.setEventMessage(
                'Descarga Bioeléctrica emitida (Pulso 9.5m)'
              );
              forceUIEmit = true;
            } else {
              this.setEventMessage(
                'Energía insuficiente para Descarga Bioeléctrica (12 Energía)'
              );
              forceUIEmit = true;
            }
          } else {
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
            this.setEventMessage('Nube tóxica defensiva liberada');
            forceUIEmit = true;
          }
          usedAnyAbility = true;
        }

        if (!hasElectricCell && !hasPoisonGland) {
          this.setEventMessage(
            'Evoluciona Glándula de Veneno u Órgano Bioeléctrico (E) para usar Q'
          );
          forceUIEmit = true;
        }
      }

      // Compute HUD abilityCooldownRatio & activeStatusEffect
      if (hasElectricCell) {
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

      if (hasElectricCell && hasPoisonGland) {
        this.stats.activeStatusEffect = 'Bioeléctrico + Veneno';
      } else if (hasElectricCell) {
        this.stats.activeStatusEffect = 'Pulso Bioeléctrico';
      } else if (hasPoisonGland) {
        this.stats.activeStatusEffect = 'Glándula de Veneno';
      } else {
        this.stats.activeStatusEffect = null;
      }

      // 2. Energy Consumption (Passive + Movement + Boost) & Hydrothermal Vent Regeneration
      const nearThermalVent = this.environment.isNearThermalVent(
        this.player.position.x,
        this.player.position.z
      );

      const passiveDrainRate = nearThermalVent
        ? 0
        : hasChloroplast
        ? GAME_CONFIG.PLAYER.PASSIVE_ENERGY_DRAIN_PER_SEC * 0.5
        : GAME_CONFIG.PLAYER.PASSIVE_ENERGY_DRAIN_PER_SEC;

      let energyDrain = passiveDrainRate * delta;
      if (moveResult.isMoving && !nearThermalVent) {
        energyDrain += GAME_CONFIG.PLAYER.MOVEMENT_ENERGY_DRAIN_PER_SEC * delta;
      }
      if (moveResult.isBoosting) {
        energyDrain += GAME_CONFIG.PLAYER.BOOST_ENERGY_DRAIN_PER_SEC * delta;
      }

      this.stats.energy = Math.max(0, this.stats.energy - energyDrain);

      // Hydrothermal Vent Energy Regeneration (+3 Energía/s when swimming near active vent in Fosa Hidrotermal)
      if (nearThermalVent) {
        this.stats.energy = Math.min(
          this.stats.maxEnergy,
          this.stats.energy + 3.0 * delta
        );
      }

      // 3. Starvation Consequence when Energy reaches 0
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

      // 4. Update Food & Check Diet-Filtered Collisions
      const foodResult = this.foodManager.update(
        delta,
        this.elapsedActiveTime,
        this.player.position,
        this.stats.diet
      );

      if (foodResult.itemsEaten > 0) {
        const energyMultiplier = hasProboscis ? 1.25 : 1.0;
        const finalEnergyGained = Math.round(
          foodResult.energyGained * energyMultiplier
        );

        this.stats.energy = Math.min(
          this.stats.maxEnergy,
          this.stats.energy + finalEnergyGained
        );
        this.stats.foodEaten += foodResult.itemsEaten;
        const leveledUp = this.addAdn(foodResult.adnGained);
        if (!leveledUp) {
          this.setEventMessage(
            `+${foodResult.adnGained} ADN · +${finalEnergyGained} Energía`
          );
        }
        forceUIEmit = true;
      } else if (foodResult.blockedFoodKind === 'meat' && !this.recentEventMessage) {
        this.setEventMessage(
          'Necesitas Boca Carnívora (Mandíbula) o Probóscide para digerir carne'
        );
        forceUIEmit = true;
      } else if (foodResult.blockedFoodKind === 'plant' && !this.recentEventMessage) {
        this.setEventMessage(
          'Dieta Carnívora: Evoluciona Probóscide o Cloroplastos para digerir algas'
        );
        forceUIEmit = true;
      }

      // 5. Update Trophic Ecosystem Species (Hunters, Leviathans, Herbivores)
      const canCounterAttack = hasSpines && moveResult.isBoosting;
      const canPredateHerbivores = hasJaw || hasProboscis;
      const canDevourWeakenedHunters =
        this.stats.growthStage === 3 &&
        canPredateHerbivores &&
        moveResult.isBoosting;

      const ecosystemResult = this.predatorManager.update(
        delta,
        this.elapsedActiveTime,
        this.player.position,
        canCounterAttack,
        canPredateHerbivores,
        hasProboscis,
        (killedPos) => this.foodManager.spawnMeatDrop(killedPos),
        this.player.getActivePoisonClouds(),
        electricPulseTriggered,
        9.5,
        canDevourWeakenedHunters
      );

      this.nearestSpeciesName = ecosystemResult.nearestSpeciesName;
      this.nearestPredatorState = ecosystemResult.nearestState;
      this.nearestPredatorDistance = ecosystemResult.nearestDistance;

      // 5A-0. Stage 3 Macrocell devoured a stunned/poisoned Hunter
      if (ecosystemResult.huntersDevoured > 0) {
        const energyBonus = hasProboscis
          ? Math.round(ecosystemResult.hunterEnergyGained * 1.25)
          : ecosystemResult.hunterEnergyGained;
        this.stats.energy = Math.min(
          this.stats.maxEnergy,
          this.stats.energy + energyBonus
        );
        this.stats.foodEaten += ecosystemResult.huntersDevoured;
        this.addAdn(ecosystemResult.hunterAdnGained);
        this.setEventMessage(
          `¡Depredador Mandíbula Rápida devorado! (+${ecosystemResult.hunterAdnGained} ADN · +${energyBonus} Energía)`
        );
        forceUIEmit = true;
      }

      // 5A. Bioelectric pulse feedback
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
            `${ecosystemResult.electrocutedHerbivoresCount} célula(s) electrocutada(s) (+${ecosystemResult.electrocutedAdnGained} ADN)`
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

      // 5B. Herbivore devoured by player
      if (ecosystemResult.herbivoresHunted > 0) {
        const energyBonus = hasProboscis
          ? Math.round(ecosystemResult.herbivoreEnergyGained * 1.25)
          : ecosystemResult.herbivoreEnergyGained;

        this.stats.energy = Math.min(
          this.stats.maxEnergy,
          this.stats.energy + energyBonus
        );
        this.stats.foodEaten += ecosystemResult.herbivoresHunted;
        const leveledUp = this.addAdn(ecosystemResult.herbivoreAdnGained);
        if (!leveledUp) {
          this.setEventMessage(
            `Célula Filtradora devorada (+${ecosystemResult.herbivoreAdnGained} ADN · +${energyBonus} Energía)`
          );
        }
        forceUIEmit = true;
      } else if (
        ecosystemResult.blockedHerbivoreHunt &&
        !this.recentEventMessage
      ) {
        this.setEventMessage(
          'Evoluciona Mandíbula Aserrada o Probóscide (E) para depredar células'
        );
        forceUIEmit = true;
      }

      // 5C. Predator or Leviathan repelled with Rostral Spines
      if (ecosystemResult.repelledLeviathans > 0) {
        const leveledUp = this.addAdn(ecosystemResult.leviathanBonusAdn);
        if (!leveledUp) {
          this.setEventMessage(
            `Megacélula Acorazada repelida (+${ecosystemResult.leviathanBonusAdn} ADN genético)`
          );
        }
        forceUIEmit = true;
      } else if (ecosystemResult.repelledHunters > 0) {
        this.setEventMessage(
          'Contraataque con Espolones Rostrales: Mandíbula Rápida repelida'
        );
        forceUIEmit = true;
      }

      // 5D. Damage taken from Hunter or Leviathan
      if (ecosystemResult.totalDamageDealt > 0) {
        const effectiveDamage = hasArmor
          ? Math.floor(ecosystemResult.totalDamageDealt * 0.7)
          : ecosystemResult.totalDamageDealt;

        this.stats.health = Math.max(0, this.stats.health - effectiveDamage);
        this.stats.damageFlashTime = 0.4;

        if (ecosystemResult.proboscisDrainedAdn > 0) {
          this.addAdn(ecosystemResult.proboscisDrainedAdn);
        }

        if (ecosystemResult.attackerPosition) {
          const knockbackStrength =
            ecosystemResult.attackerSpeciesName === 'Megacélula Acorazada'
              ? 21
              : 16;
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

      if (this.stats.damageFlashTime > 0) {
        this.stats.damageFlashTime = Math.max(
          0,
          this.stats.damageFlashTime - delta
        );
      }

      // 6. Check Death Condition
      if (this.stats.health <= 0) {
        this.stats.health = 0;
        this.status = 'gameover';
        this.matingCallTimer = 0;
        this.player.hideMateCell();
        this.inputController.resetInputs();
        this.footerDeathCleanup();
        forceUIEmit = true;
      }

      // 7. Update Camera & Underwater Environment (with Biome lighting & Hydrothermal bubbles)
      this.cameraController.update(delta, this.player);
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

      // Throttled UI sync (~12 Hz) or immediate on significant event
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
    this.setEventMessage('Organismo celular eliminado');
  }

  private setEventMessage(msg: string): void {
    this.recentEventMessage = msg;
    this.eventMessageTimer = 2.4;
  }

  private emitUISnapshot(): void {
    const questInfo = this.getActiveQuestInfo();
    const readyForLandTransition =
      this.stats.totalAdnEarned >= 200 && this.stats.growthStage === 3;

    this.onUISnapshot({
      status: this.status,
      stats: { ...this.stats },
      activeFoodCount: this.foodManager.getActiveCount(),
      totalFoodCapacity: GAME_CONFIG.FOOD.TOTAL_COUNT,
      predatorStates: [],
      nearestSpeciesName: this.nearestSpeciesName,
      nearestPredatorState: this.nearestPredatorState,
      nearestPredatorDistance: this.nearestPredatorDistance,
      currentBiomeName: this.currentBiomeName,
      activeQuestTitle: questInfo.title,
      activeQuestProgressText: questInfo.progressText,
      readyForLandTransition,
      recentEventMessage: this.recentEventMessage,
      evolutionSlots: this.preparedEvolutionCatalog.map((slot) => ({ ...slot })),
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
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.boundContextLost
    );

    this.inputController.dispose();
    this.timer.dispose();
    this.player.dispose();
    this.foodManager.dispose();
    this.predatorManager.dispose();
    this.environment.dispose();
    this.renderer.dispose();
  }
}
