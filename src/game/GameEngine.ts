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
      id: 'rostral_spines',
      name: 'Espolones Rostrales',
      description:
        'Añade dos púas frontales calcificadas que permiten embestir con Impulso (Espacio) a los depredadores (< 3.4m) y ahuyentarlos.',
      statSummary: 'Contraataque con Impulso (< 3.4m)',
      category: 'defensa',
      costAdn: 40,
      unlocked: false,
    },
  ];

  private readonly unlockedSlotIds = new Set<string>();

  private animationFrameId: number | null = null;
  private uiSyncAccumulator = 0;
  private elapsedActiveTime = 0;
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
      foodEaten: 0,
      survivalTime: 0,
      isStarving: false,
      isBoosting: false,
      boostCooldownRatio: 1,
      speed: 0,
      damageFlashTime: 0,
    };
  }

  public togglePause(): void {
    if (this.status === 'gameover') return;

    if (this.status === 'editing') {
      this.status = 'playing';
      this.timer.update();
      this.emitUISnapshot();
      return;
    }

    if (this.status === 'playing') {
      this.status = 'paused';
      this.inputController.resetInputs();
    } else if (this.status === 'paused') {
      this.status = 'playing';
      // Reset timer delta so resuming doesn't jump
      this.timer.update();
    }
    this.emitUISnapshot();
  }

  public toggleEditor(): void {
    if (this.status === 'gameover') return;

    if (this.status === 'playing' || this.status === 'paused') {
      this.status = 'editing';
      this.inputController.resetInputs();
    } else if (this.status === 'editing') {
      this.status = 'playing';
      this.timer.update();
    }
    this.emitUISnapshot();
  }

  public closeEditor(): void {
    if (this.status === 'editing') {
      this.status = 'playing';
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

    if (slot.id === 'chloroplast_1') {
      this.stats.maxEnergy = 130;
      this.stats.energy = Math.min(130, this.stats.energy + 30);
      this.stats.isStarving = false;
    } else if (slot.id === 'membrane_armor') {
      this.stats.maxHealth = 140;
      this.stats.health = Math.min(140, this.stats.health + 40);
    }

    this.player.syncEvolutionParts(this.unlockedSlotIds);
    this.setEventMessage(`Evolución completada: ${slot.name}`);
    this.emitUISnapshot();
    return true;
  }

  public resumeGame(): void {
    if (this.status === 'paused' || this.status === 'editing') {
      this.status = 'playing';
      this.timer.update();
      this.emitUISnapshot();
    }
  }

  public restartGame(): void {
    this.status = 'playing';
    for (const slot of this.preparedEvolutionCatalog) {
      slot.unlocked = false;
    }
    this.unlockedSlotIds.clear();

    this.stats = this.createInitialStats();
    this.elapsedActiveTime = 0;
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

      const hasFlagellum2 = this.unlockedSlotIds.has('flagellum_2');
      const hasChloroplast = this.unlockedSlotIds.has('chloroplast_1');
      const hasArmor = this.unlockedSlotIds.has('membrane_armor');
      const hasSpines = this.unlockedSlotIds.has('rostral_spines');

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

      // 2. Energy Consumption (Passive + Movement + Boost)
      const passiveDrainRate = hasChloroplast
        ? GAME_CONFIG.PLAYER.PASSIVE_ENERGY_DRAIN_PER_SEC * 0.5
        : GAME_CONFIG.PLAYER.PASSIVE_ENERGY_DRAIN_PER_SEC;

      let energyDrain = passiveDrainRate * delta;
      if (moveResult.isMoving) {
        energyDrain += GAME_CONFIG.PLAYER.MOVEMENT_ENERGY_DRAIN_PER_SEC * delta;
      }
      if (moveResult.isBoosting) {
        energyDrain += GAME_CONFIG.PLAYER.BOOST_ENERGY_DRAIN_PER_SEC * delta;
      }

      this.stats.energy = Math.max(0, this.stats.energy - energyDrain);

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

      // 4. Update Food & Check Nutrient Collisions
      const foodResult = this.foodManager.update(
        delta,
        this.elapsedActiveTime,
        this.player.position
      );

      if (foodResult.itemsEaten > 0) {
        this.stats.energy = Math.min(
          this.stats.maxEnergy,
          this.stats.energy + foodResult.energyGained
        );
        this.stats.adn += foodResult.adnGained;
        this.stats.foodEaten += foodResult.itemsEaten;
        this.setEventMessage(
          `+${foodResult.adnGained} ADN · +${foodResult.energyGained} Energía`
        );
        forceUIEmit = true;
      }

      // 5. Update Predators (DEAMBULAR / PERSEGUIR / ATACAR + Counter-attack)
      const canCounterAttack = hasSpines && moveResult.isBoosting;
      const predatorResult = this.predatorManager.update(
        delta,
        this.elapsedActiveTime,
        this.player.position,
        canCounterAttack
      );

      this.nearestPredatorState = predatorResult.nearestState;
      this.nearestPredatorDistance = predatorResult.nearestDistance;

      if (predatorResult.repelledPredators > 0) {
        this.setEventMessage(
          'Contraataque con Espolones Rostrales: Depredador repelido'
        );
        forceUIEmit = true;
      }

      if (predatorResult.totalDamageDealt > 0) {
        const attacksCount = Math.max(
          1,
          Math.round(
            predatorResult.totalDamageDealt / GAME_CONFIG.PREDATOR.ATTACK_DAMAGE
          )
        );
        const damagePerHit = hasArmor ? 12 : GAME_CONFIG.PREDATOR.ATTACK_DAMAGE;
        const effectiveDamage = attacksCount * damagePerHit;

        this.stats.health = Math.max(0, this.stats.health - effectiveDamage);
        this.stats.damageFlashTime = 0.4;
        if (predatorResult.attackerPosition) {
          this.player.applyDamageKnockback(predatorResult.attackerPosition, 16);
        }
        this.setEventMessage(
          `Ataque de depredador (-${effectiveDamage} Vida)`
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
        this.inputController.resetInputs();
        this.setEventMessage('Organismo celular eliminado');
        forceUIEmit = true;
      }

      // 7. Update Camera & Underwater Environment
      this.cameraController.update(delta, this.player);
      this.environment.update(this.elapsedActiveTime, delta);

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

  private setEventMessage(msg: string): void {
    this.recentEventMessage = msg;
    this.eventMessageTimer = 2.4;
  }

  private emitUISnapshot(): void {
    this.onUISnapshot({
      status: this.status,
      stats: { ...this.stats },
      activeFoodCount: this.foodManager.getActiveCount(),
      totalFoodCapacity: GAME_CONFIG.FOOD.TOTAL_COUNT,
      predatorStates: [],
      nearestPredatorState: this.nearestPredatorState,
      nearestPredatorDistance: this.nearestPredatorDistance,
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
