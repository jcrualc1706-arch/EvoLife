import * as THREE from 'three';
import { audioManager } from './AudioManager';
import { GAME_CONFIG } from './config';
import {
  createOrganVisual,
  organFactory,
  OrganVisualInstance,
} from './OrganFactory3D';
import { PlayerCell, PooledAcidProjectile } from './PlayerCell';
import {
  CONTINENT_CONFIG,
  EnvironmentObstacle,
  getLandHeightAt,
} from './SceneEnvironment';
import { SpatialHashGrid } from './SpatialHashGrid';
import {
  CellularGrowthStage,
  EvolutionaryStage,
  PlayerStats,
  PoisonCloudHazard,
  PredatorBehaviorState,
  PredatorTelemetry,
  SpeciesType,
} from './types';

export interface KinCellEntity {
  id: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  targetHeading: number;
  isMateReceptive: boolean;
  pingTimer?: number;
  wanderTimer?: number;
}


type CreatureAttitude = 'herbivore' | 'neutral' | 'hostile';

interface SpeciesProfile {
  species: SpeciesType;
  name: string;
  tier: 1 | 2 | 3;
  attitude: CreatureAttitude;
  isHerbivore: boolean;
  isSessile?: boolean;
  count: number;
  wanderSpeed: number;
  activeSpeed: number;
  detectionRadius: number;
  loseInterestRadius: number;
  attackRange: number;
  attackDamage: number;
  attackCooldownSec: number;
  scaleMultiplier: number;
  primaryTraits: string[];
}

interface ArticulatedFlagellumChain {
  segments: THREE.Mesh[];
  baseX: number;
  baseY: number;
  baseZ: number;
  baseYaw: number;
  segmentSpacing: number;
  phaseOffset: number;
  amplitude: number;
}

interface AnimatedCiliumEntry {
  mesh: THREE.Mesh;
  baseRotY: number;
  baseRotZ: number;
  phase: number;
  side: 1 | -1;
}

const SPECIES_PROFILES: Record<SpeciesType, SpeciesProfile> = {
  herbivore: {
    species: 'herbivore',
    name: 'Célula Filtradora',
    tier: 1,
    attitude: 'herbivore',
    isHerbivore: true,
    count: 3,
    wanderSpeed: 4.8,
    activeSpeed: 8.8,
    detectionRadius: 14.0,
    loseInterestRadius: 20.5,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 0.85,
    primaryTraits: [
      'cilia_waves',
      'chemoreceptor',
      'movement_macro_cilia_skirt',
      'sense_antenna_chemoreceptor',
    ],
  },
  nematocito: {
    species: 'nematocito',
    name: 'Nematocito Acordonado',
    tier: 1,
    attitude: 'herbivore',
    isHerbivore: true,
    count: 2,
    wanderSpeed: 3.9,
    activeSpeed: 7.4,
    detectionRadius: 15.0,
    loseInterestRadius: 22.0,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 0.92,
    primaryTraits: ['weapon_harpoon_cell', 'sense_stalk_compound_eye', 'simple_flagellum'],
  },
  gasteropodo: {
    species: 'gasteropodo',
    name: 'Gasterópodo Sulfuroso',
    tier: 1,
    attitude: 'herbivore',
    isHerbivore: true,
    count: 2,
    wanderSpeed: 3.0,
    activeSpeed: 5.6,
    detectionRadius: 12.5,
    loseInterestRadius: 18.0,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 0.95,
    primaryTraits: [
      'mouth_radula',
      'mouth_suction_cup',
      'mouth_filter_baleen',
      'cilia_waves',
    ],
  },
  esponja_espicular: {
    species: 'esponja_espicular',
    name: 'Esponja Espicular',
    tier: 1,
    attitude: 'herbivore',
    isHerbivore: true,
    isSessile: true,
    count: 2,
    wanderSpeed: 0,
    activeSpeed: 0,
    detectionRadius: 10.0,
    loseInterestRadius: 15.0,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 0.98,
    primaryTraits: ['defense_silica_spicules', 'chitin_spike'],
  },
  clorofita_solar: {
    species: 'clorofita_solar',
    name: 'Clorofita Solar',
    tier: 1,
    attitude: 'herbivore',
    isHerbivore: true,
    count: 3,
    wanderSpeed: 5.2,
    activeSpeed: 9.8,
    detectionRadius: 16.5,
    loseInterestRadius: 24.0,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 0.82,
    primaryTraits: ['chloroplast_1', 'cilia_waves', 'eye_photoreceptor'],
  },
  fito_medusa: {
    species: 'fito_medusa',
    name: 'Fitomedusa de Cristal',
    tier: 1,
    attitude: 'herbivore',
    isHerbivore: true,
    count: 3,
    wanderSpeed: 3.8,
    activeSpeed: 7.6,
    detectionRadius: 15.0,
    loseInterestRadius: 22.0,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 0.9,
    primaryTraits: ['mouth_filter', 'simple_flagellum', 'chloroplast_1'],
  },
  hunter: {
    species: 'hunter',
    name: 'Mandíbula Rápida',
    tier: 1,
    attitude: 'hostile',
    isHerbivore: false,
    count: 3,
    wanderSpeed: GAME_CONFIG.PREDATOR.WANDER_SPEED,
    activeSpeed: GAME_CONFIG.PREDATOR.CHASE_SPEED,
    detectionRadius: 23.0,
    loseInterestRadius: 32.0,
    attackRange: 3.1,
    attackDamage: 16,
    attackCooldownSec: 1.5,
    scaleMultiplier: 1.0,
    primaryTraits: [
      'mouth_proboscis',
      'chitin_spike',
      'mouth_needle_proboscis',
      'movement_whip_flagella',
    ],
  },
  perforador: {
    species: 'perforador',
    name: 'Perforador Abisal',
    tier: 2,
    attitude: 'hostile',
    isHerbivore: false,
    count: 2,
    wanderSpeed: 5.1,
    activeSpeed: 10.0,
    detectionRadius: 26.0,
    loseInterestRadius: 35.0,
    attackRange: 3.3,
    attackDamage: 20,
    attackCooldownSec: 1.4,
    scaleMultiplier: 1.12,
    primaryTraits: ['weapon_rotary_drill', 'mouth_needle_proboscis', 'simple_flagellum'],
  },
  vibora_fosa: {
    species: 'vibora_fosa',
    name: 'Víbora de Fosa',
    tier: 2,
    attitude: 'hostile',
    isHerbivore: false,
    count: 2,
    wanderSpeed: 4.8,
    activeSpeed: 9.3,
    detectionRadius: 24.5,
    loseInterestRadius: 33.5,
    attackRange: 3.2,
    attackDamage: 19,
    attackCooldownSec: 1.5,
    scaleMultiplier: 1.15,
    primaryTraits: ['weapon_caustic_acid_blister', 'poison_gland', 'acid_spit', 'simple_flagellum'],
  },
  medusa_biolum: {
    species: 'medusa_biolum',
    name: 'Medusa Bioluminiscente',
    tier: 2,
    attitude: 'herbivore',
    isHerbivore: true,
    count: 2,
    wanderSpeed: 4.3,
    activeSpeed: 8.5,
    detectionRadius: 16.5,
    loseInterestRadius: 24.0,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 1.1,
    primaryTraits: [
      'weapon_flash_photophore',
      'electric_cell',
      'movement_ribbon_fin',
    ],
  },
  espora_refulgente: {
    species: 'espora_refulgente',
    name: 'Espora Refulgente',
    tier: 2,
    attitude: 'herbivore',
    isHerbivore: true,
    count: 2,
    wanderSpeed: 4.2,
    activeSpeed: 8.4,
    detectionRadius: 16.0,
    loseInterestRadius: 23.5,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 1.08,
    primaryTraits: ['weapon_flash_photophore', 'eye_stalks', 'cilia_waves'],
  },
  pluricelular_pastador: {
    species: 'pluricelular_pastador',
    name: 'Pluricelular Pastador',
    tier: 2,
    attitude: 'herbivore',
    isHerbivore: true,
    count: 2,
    wanderSpeed: 4.0,
    activeSpeed: 8.0,
    detectionRadius: 15.5,
    loseInterestRadius: 23.0,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 1.18,
    primaryTraits: ['mouth_filter_baleen', 'chloroplast_1', 'simple_flagellum'],
  },
  anquilocelula: {
    species: 'anquilocelula',
    name: 'Anquilocélula de Fondo',
    tier: 2,
    attitude: 'neutral',
    isHerbivore: false,
    count: 2,
    wanderSpeed: 3.5,
    activeSpeed: 7.2,
    detectionRadius: 20.0,
    loseInterestRadius: 28.0,
    attackRange: 3.5,
    attackDamage: 22,
    attackCooldownSec: 1.7,
    scaleMultiplier: 1.25,
    primaryTraits: [
      'weapon_tail_club',
      'defense_chitin_shield_plate',
      'membrane_armor',
      'cilia_waves',
    ],
  },
  quelicerado_abisal: {
    species: 'quelicerado_abisal',
    name: 'Quelicerado de Fosa',
    tier: 2,
    attitude: 'neutral',
    isHerbivore: false,
    count: 2,
    wanderSpeed: 3.8,
    activeSpeed: 8.6,
    detectionRadius: 22.0,
    loseInterestRadius: 30.0,
    attackRange: 3.4,
    attackDamage: 21,
    attackCooldownSec: 1.5,
    scaleMultiplier: 1.18,
    primaryTraits: [
      'mouth_crusher_mandibles',
      'defense_chitin_shield_plate',
      'simple_flagellum',
    ],
  },
  nautilo_espinoso: {
    species: 'nautilo_espinoso',
    name: 'Nautilocefalópodo Espinoso',
    tier: 2,
    attitude: 'neutral',
    isHerbivore: false,
    count: 2,
    wanderSpeed: 3.6,
    activeSpeed: 8.2,
    detectionRadius: 21.0,
    loseInterestRadius: 29.0,
    attackRange: 3.3,
    attackDamage: 19,
    attackCooldownSec: 1.6,
    scaleMultiplier: 1.16,
    primaryTraits: [
      'chitin_spike',
      'membrane_armor',
      'hydro_siphon',
    ],
  },
  aguijon_electrico: {
    species: 'aguijon_electrico',
    name: 'Aguijón Eléctrico',
    tier: 2,
    attitude: 'hostile',
    isHerbivore: false,
    count: 2,
    wanderSpeed: 5.6,
    activeSpeed: 11.2,
    detectionRadius: 27.0,
    loseInterestRadius: 36.0,
    attackRange: 3.4,
    attackDamage: 22,
    attackCooldownSec: 1.35,
    scaleMultiplier: 1.16,
    primaryTraits: [
      'electric_cell',
      'chitin_spike',
      'movement_whip_flagella',
    ],
  },
  nebula_gelatinosa: {
    species: 'nebula_gelatinosa',
    name: 'Nébula Gelatinosa',
    tier: 2,
    attitude: 'herbivore',
    isHerbivore: true,
    count: 2,
    wanderSpeed: 3.2,
    activeSpeed: 6.5,
    detectionRadius: 16.0,
    loseInterestRadius: 24.0,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 1.28,
    primaryTraits: [
      'defense_mucus_gland',
      'defense_camouflage_chromatophores',
      'movement_pneumatic_vesicle',
      'movement_macro_cilia_skirt',
    ],
  },
  mirador_abisal: {
    species: 'mirador_abisal',
    name: 'Mirador Abisal',
    tier: 2,
    attitude: 'herbivore',
    isHerbivore: true,
    count: 2,
    wanderSpeed: 4.3,
    activeSpeed: 8.3,
    detectionRadius: 22.0,
    loseInterestRadius: 30.0,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 1.05,
    primaryTraits: [
      'sense_stalk_compound_eye',
      'sense_abyssal_biolum_probe',
      'sense_electro_sensor_pores',
      'sense_lateral_line_vibrissae',
      'eye_stalks',
      'simple_flagellum',
    ],
  },
  titan_verde: {
    species: 'titan_verde',
    name: 'Coloso Fitoplanctónico',
    tier: 3,
    attitude: 'herbivore',
    isHerbivore: true,
    count: 2,
    wanderSpeed: 3.4,
    activeSpeed: 7.8,
    detectionRadius: 18.0,
    loseInterestRadius: 27.0,
    attackRange: 0,
    attackDamage: 0,
    attackCooldownSec: 0,
    scaleMultiplier: 1.46,
    primaryTraits: [
      'chloroplast_1',
      'sense_stalk_compound_eye',
      'movement_macro_cilia_skirt',
      'membrane_armor',
    ],
  },
  triturador_fumarola: {
    species: 'triturador_fumarola',
    name: 'Triturador de Grieta',
    tier: 3,
    attitude: 'neutral',
    isHerbivore: false,
    count: 2,
    wanderSpeed: 3.3,
    activeSpeed: 7.8,
    detectionRadius: 24.0,
    loseInterestRadius: 34.0,
    attackRange: 3.9,
    attackDamage: 30,
    attackCooldownSec: 1.75,
    scaleMultiplier: 1.52,
    primaryTraits: [
      'mouth_crusher_mandibles',
      'defense_hydrothermal_carapace',
      'weapon_tail_club',
    ],
  },
  bala_fumarola: {
    species: 'bala_fumarola',
    name: 'Bala de Fumarola',
    tier: 3,
    attitude: 'hostile',
    isHerbivore: false,
    count: 2,
    wanderSpeed: 7.0,
    activeSpeed: 13.8,
    detectionRadius: 29.0,
    loseInterestRadius: 40.0,
    attackRange: 3.4,
    attackDamage: 25,
    attackCooldownSec: 1.3,
    scaleMultiplier: 1.32,
    primaryTraits: [
      'movement_reactive_nozzle',
      'movement_whip_flagella',
      'hydro_siphon',
    ],
  },
  leviathan: {
    species: 'leviathan',
    name: 'Megacélula Acorazada',
    tier: 3,
    attitude: 'hostile',
    isHerbivore: false,
    count: 2,
    wanderSpeed: 3.6,
    activeSpeed: 7.4,
    detectionRadius: 23.5,
    loseInterestRadius: 33.0,
    attackRange: 3.8,
    attackDamage: 28,
    attackCooldownSec: 1.8,
    scaleMultiplier: 1.5,
    primaryTraits: [
      'mouth_crusher_mandibles',
      'defense_hydrothermal_carapace',
      'electric_cell',
      'membrane_armor',
      'simple_flagellum',
    ],
  },
  leviatan_sauro: {
    species: 'leviatan_sauro',
    name: 'Leviatán Hendidor',
    tier: 3,
    attitude: 'hostile',
    isHerbivore: false,
    count: 2,
    wanderSpeed: 4.4,
    activeSpeed: 9.6,
    detectionRadius: 28.0,
    loseInterestRadius: 38.0,
    attackRange: 4.0,
    attackDamage: 32,
    attackCooldownSec: 1.6,
    scaleMultiplier: 1.58,
    primaryTraits: [
      'mouth_crusher_mandibles',
      'chitin_spike',
      'movement_whip_flagella',
      'defense_hydrothermal_carapace',
    ],
  },
};

interface OrganismEntity {
  id: number;
  species: SpeciesType;
  speciesName: string;
  profile: SpeciesProfile;
  isSessile: boolean;
  group: THREE.Group;
  position: THREE.Vector3;
  headingAngle: number;
  currentSpeed: number;
  state: PredatorBehaviorState;
  active: boolean;
  respawnTimer: number;
  stunTimer: number;
  poisonTimer: number;
  poisonTickTimer: number;
  provokedTimer: number;
  socialCooldown: number;
  wanderTarget: THREE.Vector3;
  wanderRetargetTimer: number;
  attackCooldown: number;
  lungeTimer: number;
  swimPhase: number;
  maxHealth: number;
  health: number;
  combatRevealTimer: number;
  hitFlashTimer: number;
  biteImmunityTimer: number;
  dyingTimer: number;
  dyingKilledByPlayer: boolean;
  knockbackVelocity: THREE.Vector3;
  healthRingMesh: THREE.Mesh;
  healthRingMat: THREE.ShaderMaterial;
  mandibleLeft: THREE.Object3D | null;
  mandibleRight: THREE.Object3D | null;
  coreMesh: THREE.Mesh;
  organelleMeshes: THREE.Mesh[];
  flagellaChains: ArticulatedFlagellumChain[];
  ciliaMeshes: AnimatedCiliumEntry[];
  electricArcMeshes: THREE.Mesh[];
  tailSegments: THREE.Mesh[];
  attachedOrgans: OrganVisualInstance[];
  cellBodyGroup: THREE.Group;
  landCreatureGroup: THREE.Group;
  landSpeciesName: string;
  landArchetype: 'bipedo_agil' | 'cuadrupedo_robusto' | 'reptiliano_rastreador';
  landLegs: {
    hipGroup: THREE.Group;
    kneeGroup: THREE.Group;
    side: number;
    isRear: boolean;
  }[];
  landArms: THREE.Group[];
  landTailGroup: THREE.Group | null;
  landHeadGroup: THREE.Group | null;
  landLowerJaw: THREE.Object3D | null;
  standingOffset: number;
  verticalVelocity: number;
  packNestIndex: number;
  legsGroup: THREE.Group;
  legs: THREE.Mesh[];
  stateRingMat: THREE.MeshBasicMaterial;
  coreMat: THREE.MeshStandardMaterial;
  geneticTraits: string[];
}

interface FloatingDamagePopup {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  active: boolean;
  life: number;
  maxLife: number;
  velocityY: number;
}

interface DeathBurstParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  velocity: THREE.Vector3;
  active: boolean;
  life: number;
  maxLife: number;
}

const HEALTH_RING_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HEALTH_RING_FRAGMENT_SHADER = /* glsl */ `
  uniform float uHealthRatio;
  uniform float uOpacity;
  uniform float uFlash;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv - vec2(0.5);
    float dist = length(centered);

    // Smooth radial ring mask
    float innerEdge = smoothstep(0.32, 0.35, dist);
    float outerEdge = 1.0 - smoothstep(0.45, 0.48, dist);
    float ringMask = innerEdge * outerEdge;
    if (ringMask <= 0.01) discard;

    // Clockwise angle starting from top (+Y in UV)
    float angle = atan(centered.x, centered.y);
    float normAngle = (angle + 3.14159265) / 6.2831853;

    // Background track (dark crimson-slate translucent)
    vec3 bgCol = vec3(0.06, 0.09, 0.16);
    float bgAlpha = 0.72;

    // Active health arc (bright scarlet-rose #f43f5e -> #ef4444)
    float fillMask = 1.0 - smoothstep(uHealthRatio - 0.012, uHealthRatio + 0.012, normAngle);
    vec3 healthCol = mix(vec3(0.94, 0.22, 0.32), vec3(0.99, 0.44, 0.52), normAngle);
    healthCol = mix(healthCol, vec3(1.0, 0.96, 0.85), uFlash * 0.75);

    // Subtle glowing tip at the edge of current health
    float tipDist = abs(normAngle - uHealthRatio);
    float tipGlow = smoothstep(0.035, 0.0, tipDist) * step(0.02, uHealthRatio);
    healthCol += vec3(1.0, 0.88, 0.75) * tipGlow * 0.65;

    vec3 finalCol = mix(bgCol, healthCol, fillMask);
    float finalAlpha = ringMask * mix(bgAlpha, 0.96, fillMask) * uOpacity;

    gl_FragColor = vec4(finalCol, finalAlpha);
  }
`;

const _toTarget = new THREE.Vector3();
const _forward = new THREE.Vector3();

export class PredatorManager {
  private readonly scene: THREE.Scene;
  private currentStage: EvolutionaryStage = 'cell_stage';
  private playerGrowthStage: CellularGrowthStage = 1;
  private readonly organisms: OrganismEntity[] = [];
  public kinCells: KinCellEntity[] = [];
  private playerCellRef: PlayerCell | null = null;
  private isEcosystemCurrentlyVisible = true;
  private readonly telemetryCache: PredatorTelemetry[] = [];
  private readonly spatialGrid = new SpatialHashGrid<OrganismEntity>();
  private readonly nearbyEntitiesBuffer: OrganismEntity[] = [];
  private readonly sharedGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  private readonly floatingDamagePool: FloatingDamagePopup[] = [];
  private floatingDamageCursor = 0;
  private readonly deathParticlePool: DeathBurstParticle[] = [];
  private deathParticleCursor = 0;
  private getNearbyObstacles?: (
    x: number,
    z: number,
    searchRadius: number
  ) => readonly EnvironmentObstacle[];

  // Shared Geometries
  private predatorBodyGeo!: THREE.BufferGeometry;
  private sphericalBodyGeo!: THREE.BufferGeometry;
  private elongatedBodyGeo!: THREE.BufferGeometry;
  private medusaBellGeo!: THREE.BufferGeometry;
  private spongeTubeGeo!: THREE.BufferGeometry;
  private predatorCoreGeo!: THREE.BufferGeometry;
  private organelleGeo!: THREE.BufferGeometry;
  private mandibleGeo!: THREE.BufferGeometry;
  private mandibleToothGeo!: THREE.BufferGeometry;
  private spineGeo!: THREE.BufferGeometry;
  private eyeGeo!: THREE.BufferGeometry;
  private eyeIrisGeo!: THREE.BufferGeometry;
  private eyePupilGeo!: THREE.BufferGeometry;
  private eyeBrowGeo!: THREE.BufferGeometry;
  private tailGeo!: THREE.BufferGeometry;
  private electricArcGeo!: THREE.BufferGeometry;
  private ringGeo!: THREE.BufferGeometry;
  private healthRingPlaneGeo!: THREE.BufferGeometry;
  private deathSphereGeo!: THREE.BufferGeometry;
  private leviathanPlateGeo!: THREE.BufferGeometry;
  private herbivoreBodyGeo!: THREE.BufferGeometry;
  private herbivoreCiliaGeo!: THREE.BufferGeometry;
  private creatureLegGeo!: THREE.BufferGeometry;

  // Shared Static Materials
  private hunterBodyMat!: THREE.MeshPhysicalMaterial;
  private hunterMandibleMat!: THREE.MeshStandardMaterial;
  private leviathanBodyMat!: THREE.MeshPhysicalMaterial;
  private leviathanMandibleMat!: THREE.MeshStandardMaterial;
  private herbivoreBodyMat!: THREE.MeshPhysicalMaterial;
  private herbivoreCiliaMat!: THREE.MeshStandardMaterial;
  private nematocitoBodyMat!: THREE.MeshPhysicalMaterial;
  private gasteropodoBodyMat!: THREE.MeshPhysicalMaterial;
  private perforadorBodyMat!: THREE.MeshPhysicalMaterial;
  private viboraBodyMat!: THREE.MeshPhysicalMaterial;
  private medusaBodyMat!: THREE.MeshPhysicalMaterial;
  private anquiloBodyMat!: THREE.MeshPhysicalMaterial;
  private esponjaBodyMat!: THREE.MeshPhysicalMaterial;
  private nebulaBodyMat!: THREE.MeshPhysicalMaterial;
  private balaBodyMat!: THREE.MeshPhysicalMaterial;
  private miradorBodyMat!: THREE.MeshPhysicalMaterial;
  private clorofitaBodyMat!: THREE.MeshPhysicalMaterial;
  private esporaBodyMat!: THREE.MeshPhysicalMaterial;
  private pastadorBodyMat!: THREE.MeshPhysicalMaterial;
  private queliceradoBodyMat!: THREE.MeshPhysicalMaterial;
  private trituradorBodyMat!: THREE.MeshPhysicalMaterial;
  private aguijonBodyMat!: THREE.MeshPhysicalMaterial;
  private sauroBodyMat!: THREE.MeshPhysicalMaterial;
  private shellArmorMat!: THREE.MeshStandardMaterial;
  private pearlShellMat!: THREE.MeshStandardMaterial;
  private basaltArmorMat!: THREE.MeshStandardMaterial;
  private eyeScleraMat!: THREE.MeshPhysicalMaterial;
  private predatorEyeMat!: THREE.MeshStandardMaterial;
  private herbivoreEyeMat!: THREE.MeshStandardMaterial;
  private eyePupilMat!: THREE.MeshStandardMaterial;
  private organelleMat!: THREE.MeshStandardMaterial;
  private electricArcMat!: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initSharedAssets();
    this.initCombatVfxPools(scene);
    this.spawnEcosystem(scene);
  }


  public setObstacleQuery(
    queryFn: (
      x: number,
      z: number,
      searchRadius: number
    ) => readonly EnvironmentObstacle[]
  ): void {
    this.getNearbyObstacles = queryFn;
  }

  private resolveEntityObstacleCollisions(
    entity: OrganismEntity,
    effectiveScale: number,
    safeDelta: number
  ): void {
    if (!this.getNearbyObstacles) return;
    const entityRadius = 1.25 * Math.max(0.7, effectiveScale);
    const obstacles = this.getNearbyObstacles(
      entity.position.x,
      entity.position.z,
      entityRadius + 3.8
    );

    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      if (
        this.currentStage !== 'creature_stage' &&
        (entity.position.y < o.minY - 0.4 ||
          entity.position.y > o.maxY + 0.4)
      ) {
        continue;
      }
      const dx = entity.position.x - o.x;
      const dz = entity.position.z - o.z;
      const distSq = dx * dx + dz * dz;
      const minDist = entityRadius + o.radius;

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const nx = dist > 0.0001 ? dx / dist : 1;
        const nz = dist > 0.0001 ? dz / dist : 0;

        // Push AI organism out along the obstacle normal
        entity.position.x = o.x + nx * minDist;
        entity.position.z = o.z + nz * minDist;

        // Project knockback velocity onto the obstacle tangent
        const kbNormal =
          entity.knockbackVelocity.x * nx + entity.knockbackVelocity.z * nz;
        if (kbNormal < 0) {
          entity.knockbackVelocity.x -= kbNormal * nx;
          entity.knockbackVelocity.z -= kbNormal * nz;
        }

        // Deflect heading smoothly along the obstacle tangent so the AI skirts around rocks/trees
        const fx = -Math.sin(entity.headingAngle);
        const fz = -Math.cos(entity.headingAngle);
        const fNormal = fx * nx + fz * nz;

        if (fNormal < 0) {
          let tx = fx - fNormal * nx;
          let tz = fz - fNormal * nz;
          const tLen = Math.hypot(tx, tz);
          if (tLen > 0.001) {
            tx /= tLen;
            tz /= tLen;
          } else {
            // Head-on impact: pick perpendicular tangent based on entity id parity
            const side = entity.id % 2 === 0 ? 1 : -1;
            tx = -nz * side;
            tz = nx * side;
          }

          const tangentHeading = Math.atan2(-tx, -tz);
          let angleDiff = tangentHeading - entity.headingAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          entity.headingAngle += angleDiff * Math.min(1, safeDelta * 9.5);

          if (entity.state === 'DEAMBULAR') {
            entity.wanderTarget.set(
              entity.position.x + tx * 16.0,
              GAME_CONFIG.WORLD.SWIM_PLANE_Y,
              entity.position.z + tz * 16.0
            );
            entity.wanderRetargetTimer = 2.8;
          }
        }
      }
    }
  }

  public setPlayerGrowthStage(stage: CellularGrowthStage): void {
    this.playerGrowthStage = stage;
    for (let i = 0; i < this.organisms.length; i++) {
      const org = this.organisms[i];
      for (let o = 0; o < org.attachedOrgans.length; o++) {
        const unlockedForStage = stage >= 2 || o < 2;
        org.attachedOrgans[o].group.visible = unlockedForStage;
      }
    }
  }

  private initSharedAssets(): void {
    this.predatorBodyGeo = new THREE.CapsuleGeometry(0.84, 1.25, 16, 22);
    this.predatorBodyGeo.rotateX(Math.PI / 2);
    this.predatorBodyGeo.scale(1.06, 0.74, 1.12);

    this.sphericalBodyGeo = new THREE.SphereGeometry(1.18, 22, 18);
    this.sphericalBodyGeo.scale(1.05, 0.76, 1.12);

    this.elongatedBodyGeo = new THREE.CapsuleGeometry(0.68, 2.1, 14, 20);
    this.elongatedBodyGeo.rotateX(Math.PI / 2);
    this.elongatedBodyGeo.scale(0.95, 0.72, 1.15);

    this.medusaBellGeo = new THREE.SphereGeometry(
      1.25,
      20,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.65
    );
    this.medusaBellGeo.rotateX(-Math.PI * 0.35);

    this.spongeTubeGeo = new THREE.CylinderGeometry(0.75, 1.05, 1.85, 16, 3);

    this.predatorCoreGeo = new THREE.IcosahedronGeometry(0.54, 2);
    this.organelleGeo = new THREE.SphereGeometry(0.22, 12, 10);
    this.organelleGeo.scale(1.25, 0.85, 0.95);

    this.mandibleGeo = new THREE.ConeGeometry(0.22, 0.98, 10);
    this.mandibleGeo.rotateX(-Math.PI / 2);

    this.mandibleToothGeo = new THREE.ConeGeometry(0.065, 0.24, 6);
    this.mandibleToothGeo.rotateZ(Math.PI / 2);

    this.spineGeo = new THREE.ConeGeometry(0.16, 0.65, 8);

    this.eyeGeo = new THREE.SphereGeometry(0.22, 14, 14);
    this.eyeIrisGeo = new THREE.SphereGeometry(0.145, 12, 12);
    this.eyePupilGeo = new THREE.SphereGeometry(0.088, 10, 10);
    this.eyeBrowGeo = new THREE.BoxGeometry(0.32, 0.08, 0.24);

    this.tailGeo = new THREE.SphereGeometry(0.24, 12, 10);
    this.tailGeo.scale(0.76, 0.72, 1.62);

    this.electricArcGeo = new THREE.TorusGeometry(0.92, 0.032, 6, 18, Math.PI * 0.85);

    this.ringGeo = new THREE.RingGeometry(1.3, 1.68, 32);
    this.ringGeo.rotateX(-Math.PI / 2);

    this.leviathanPlateGeo = new THREE.DodecahedronGeometry(0.55, 0);
    this.leviathanPlateGeo.scale(1.4, 0.45, 1.1);

    this.herbivoreBodyGeo = new THREE.CapsuleGeometry(0.95, 0.65, 16, 22);
    this.herbivoreBodyGeo.rotateX(Math.PI / 2);

    this.herbivoreCiliaGeo = new THREE.CylinderGeometry(0.035, 0.095, 0.62, 6);
    this.herbivoreCiliaGeo.rotateZ(Math.PI / 2);

    this.creatureLegGeo = new THREE.CapsuleGeometry(0.14, 0.72, 6, 8);
    this.creatureLegGeo.translate(0, -0.36, 0);

    this.healthRingPlaneGeo = new THREE.PlaneGeometry(3.4, 3.4);
    this.healthRingPlaneGeo.rotateX(-Math.PI / 2);

    this.deathSphereGeo = new THREE.SphereGeometry(0.24, 10, 10);

    this.sharedGeometries.push(
      this.predatorBodyGeo,
      this.sphericalBodyGeo,
      this.elongatedBodyGeo,
      this.medusaBellGeo,
      this.spongeTubeGeo,
      this.predatorCoreGeo,
      this.organelleGeo,
      this.mandibleGeo,
      this.mandibleToothGeo,
      this.spineGeo,
      this.eyeGeo,
      this.eyeIrisGeo,
      this.eyePupilGeo,
      this.eyeBrowGeo,
      this.tailGeo,
      this.electricArcGeo,
      this.ringGeo,
      this.healthRingPlaneGeo,
      this.deathSphereGeo,
      this.leviathanPlateGeo,
      this.herbivoreBodyGeo,
      this.herbivoreCiliaGeo,
      this.creatureLegGeo
    );

    // Multi-layered Translucent Outer Membranes (MeshPhysicalMaterial) for all species
    this.hunterBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xe11d48,
      emissive: 0x881337,
      emissiveIntensity: 0.34,
      roughness: 0.16,
      metalness: 0.08,
      transmission: 0.66,
      thickness: 1.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      transparent: true,
      opacity: 0.88,
    });

    this.hunterMandibleMat = new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xe11d48,
      emissiveIntensity: 0.35,
      roughness: 0.22,
      metalness: 0.55,
    });

    this.leviathanBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x6b21a8,
      emissive: 0x3b0764,
      emissiveIntensity: 0.44,
      roughness: 0.18,
      metalness: 0.12,
      transmission: 0.62,
      thickness: 1.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.14,
      transparent: true,
      opacity: 0.9,
    });

    this.leviathanMandibleMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 0.48,
      roughness: 0.2,
      metalness: 0.68,
    });

    this.herbivoreBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x2dd4bf,
      emissive: 0x0d9488,
      emissiveIntensity: 0.32,
      roughness: 0.16,
      metalness: 0.05,
      transmission: 0.72,
      thickness: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.86,
    });

    this.herbivoreCiliaMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xeab308,
      emissiveIntensity: 0.45,
      roughness: 0.32,
    });

    this.nematocitoBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.38,
      roughness: 0.16,
      transmission: 0.72,
      thickness: 1.0,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.85,
    });

    this.gasteropodoBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      emissive: 0x92400e,
      emissiveIntensity: 0.34,
      roughness: 0.18,
      metalness: 0.08,
      transmission: 0.64,
      thickness: 1.15,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88,
    });

    this.perforadorBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      emissive: 0x0369a1,
      emissiveIntensity: 0.42,
      roughness: 0.16,
      metalness: 0.15,
      transmission: 0.66,
      thickness: 1.1,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88,
    });

    this.viboraBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x84cc16,
      emissive: 0x365314,
      emissiveIntensity: 0.45,
      roughness: 0.17,
      transmission: 0.68,
      thickness: 1.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88,
    });

    this.medusaBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.62,
      roughness: 0.12,
      transmission: 0.76,
      thickness: 0.95,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.84,
    });

    this.anquiloBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xd97706,
      emissive: 0x78350f,
      emissiveIntensity: 0.34,
      roughness: 0.18,
      metalness: 0.1,
      transmission: 0.62,
      thickness: 1.25,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.89,
    });

    this.esponjaBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.45,
      roughness: 0.18,
      transmission: 0.68,
      thickness: 1.1,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.86,
    });

    this.nebulaBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xc084fc,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.48,
      roughness: 0.14,
      transmission: 0.74,
      thickness: 1.1,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.84,
    });

    this.balaBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.52,
      roughness: 0.16,
      metalness: 0.18,
      transmission: 0.64,
      thickness: 1.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88,
    });

    this.miradorBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xf472b6,
      emissive: 0xbe185d,
      emissiveIntensity: 0.42,
      roughness: 0.16,
      transmission: 0.7,
      thickness: 1.0,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.87,
    });

    this.clorofitaBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x84cc16,
      emissive: 0x3f6212,
      emissiveIntensity: 0.42,
      roughness: 0.14,
      transmission: 0.76,
      thickness: 0.95,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.86,
    });

    this.esporaBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      emissiveIntensity: 0.48,
      roughness: 0.15,
      transmission: 0.72,
      thickness: 1.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.87,
    });

    this.pastadorBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x15803d,
      emissive: 0x14532d,
      emissiveIntensity: 0.38,
      roughness: 0.16,
      transmission: 0.68,
      thickness: 1.15,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88,
    });

    this.queliceradoBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x475569,
      emissive: 0x1e293b,
      emissiveIntensity: 0.34,
      roughness: 0.22,
      metalness: 0.24,
      transmission: 0.56,
      thickness: 1.2,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.9,
    });

    this.trituradorBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x334155,
      emissive: 0x0f172a,
      emissiveIntensity: 0.36,
      roughness: 0.26,
      metalness: 0.32,
      transmission: 0.5,
      thickness: 1.35,
      clearcoat: 0.95,
      transparent: true,
      opacity: 0.92,
    });

    this.aguijonBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xdb2777,
      emissive: 0x831843,
      emissiveIntensity: 0.48,
      roughness: 0.14,
      metalness: 0.12,
      transmission: 0.68,
      thickness: 1.05,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.88,
    });

    this.sauroBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x991b1b,
      emissive: 0x450a0a,
      emissiveIntensity: 0.52,
      roughness: 0.18,
      metalness: 0.2,
      transmission: 0.58,
      thickness: 1.4,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.92,
    });

    this.shellArmorMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      emissive: 0x451a03,
      emissiveIntensity: 0.28,
      roughness: 0.45,
      metalness: 0.48,
    });

    this.pearlShellMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x64748b,
      emissiveIntensity: 0.32,
      roughness: 0.24,
      metalness: 0.52,
    });

    this.basaltArmorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x0f172a,
      emissiveIntensity: 0.35,
      roughness: 0.55,
      metalness: 0.62,
    });

    this.eyeScleraMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      emissive: 0xe2e8f0,
      emissiveIntensity: 0.18,
      roughness: 0.12,
      clearcoat: 1.0,
    });

    this.predatorEyeMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.15,
      roughness: 0.12,
    });

    this.herbivoreEyeMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.75,
      roughness: 0.14,
    });

    this.eyePupilMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      emissive: 0x020617,
      emissiveIntensity: 0.25,
      roughness: 0.08,
      metalness: 0.2,
    });

    this.organelleMat = new THREE.MeshStandardMaterial({
      color: 0xa7f3d0,
      emissive: 0x10b981,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });

    this.electricArcMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });

    this.disposableMaterials.push(
      this.hunterBodyMat,
      this.hunterMandibleMat,
      this.leviathanBodyMat,
      this.leviathanMandibleMat,
      this.herbivoreBodyMat,
      this.herbivoreCiliaMat,
      this.nematocitoBodyMat,
      this.gasteropodoBodyMat,
      this.perforadorBodyMat,
      this.viboraBodyMat,
      this.medusaBodyMat,
      this.anquiloBodyMat,
      this.esponjaBodyMat,
      this.nebulaBodyMat,
      this.balaBodyMat,
      this.miradorBodyMat,
      this.clorofitaBodyMat,
      this.esporaBodyMat,
      this.pastadorBodyMat,
      this.queliceradoBodyMat,
      this.trituradorBodyMat,
      this.aguijonBodyMat,
      this.sauroBodyMat,
      this.shellArmorMat,
      this.pearlShellMat,
      this.basaltArmorMat,
      this.eyeScleraMat,
      this.predatorEyeMat,
      this.herbivoreEyeMat,
      this.eyePupilMat,
      this.organelleMat,
      this.electricArcMat
    );
  }

  private initCombatVfxPools(scene: THREE.Scene): void {
    // 1. Pool of 20 3D Floating Damage Number Sprites
    for (let i = 0; i < 20; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 192;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      this.disposableMaterials.push(material);

      const sprite = new THREE.Sprite(material);
      sprite.scale.set(2.4, 1.2, 1.0);
      sprite.renderOrder = 25;
      sprite.visible = false;
      scene.add(sprite);

      this.floatingDamagePool.push({
        sprite,
        material,
        texture,
        canvas,
        ctx,
        active: false,
        life: 0,
        maxLife: 0.8,
        velocityY: 2.6,
      });
    }

    // 2. Pool of 48 Bioluminescent Micro-Spheres for Cell Death Rupture Animation
    for (let i = 0; i < 48; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      this.disposableMaterials.push(mat);
      const mesh = new THREE.Mesh(this.deathSphereGeo, mat);
      mesh.visible = false;
      scene.add(mesh);

      this.deathParticlePool.push({
        mesh,
        mat,
        velocity: new THREE.Vector3(),
        active: false,
        life: 0,
        maxLife: 0.65,
      });
    }
  }

  /**
   * Spawns a 3D floating damage number at the given world coordinate that rises along +Y and fades over 0.8s.
   */
  public spawnFloatingDamageNumber(
    worldPos: THREE.Vector3,
    damageAmount: number,
    style: 'enemy_hit' | 'critical_hit' | 'player_hit' = 'enemy_hit'
  ): void {
    const rounded = Math.max(1, Math.round(damageAmount));
    const popup =
      this.floatingDamagePool.find((p) => !p.active) ??
      this.floatingDamagePool[
        this.floatingDamageCursor % this.floatingDamagePool.length
      ];
    this.floatingDamageCursor++;

    const ctx = popup.ctx;
    if (ctx) {
      ctx.clearRect(0, 0, popup.canvas.width, popup.canvas.height);
      ctx.save();
      ctx.font = '900 46px "Space Grotesk", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const text = style === 'critical_hit' ? `-${rounded}!` : `-${rounded}`;
      ctx.shadowColor =
        style === 'player_hit'
          ? 'rgba(225, 29, 72, 0.95)'
          : style === 'critical_hit'
          ? 'rgba(245, 158, 11, 0.95)'
          : 'rgba(239, 68, 68, 0.95)';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeText(text, 96, 48);

      ctx.fillStyle =
        style === 'player_hit'
          ? '#fda4af'
          : style === 'critical_hit'
          ? '#fde047'
          : '#ff4d6d';
      ctx.fillText(text, 96, 48);
      ctx.restore();
      popup.texture.needsUpdate = true;
    }

    const jitterX = (Math.random() - 0.5) * 0.75;
    const jitterZ = (Math.random() - 0.5) * 0.75;
    popup.sprite.position.set(
      worldPos.x + jitterX,
      worldPos.y + 1.55,
      worldPos.z + jitterZ
    );
    const baseScale = style === 'critical_hit' ? 2.85 : 2.35;
    popup.sprite.scale.set(baseScale, baseScale * 0.5, 1);
    popup.material.opacity = 1.0;
    popup.active = true;
    popup.life = 0.8;
    popup.maxLife = 0.8;
    popup.velocityY = style === 'critical_hit' ? 3.1 : 2.45;
    popup.sprite.visible = true;
  }

  public spawnFloatingText(
    text: string,
    worldPos: THREE.Vector3,
    fillColor = '#22c55e'
  ): void {
    const popup =
      this.floatingDamagePool.find((p) => !p.active) ??
      this.floatingDamagePool[
        this.floatingDamageCursor % this.floatingDamagePool.length
      ];
    this.floatingDamageCursor++;

    const ctx = popup.ctx;
    if (ctx) {
      ctx.clearRect(0, 0, popup.canvas.width, popup.canvas.height);
      ctx.save();
      ctx.font = '800 22px "Space Grotesk", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = fillColor;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeText(text, 96, 48);
      ctx.fillStyle = fillColor;
      ctx.fillText(text, 96, 48);
      ctx.restore();
      popup.texture.needsUpdate = true;
    }

    popup.sprite.position.set(worldPos.x, worldPos.y + 1.85, worldPos.z);
    popup.sprite.scale.set(3.4, 1.7, 1);
    popup.material.opacity = 1.0;
    popup.active = true;
    popup.life = 1.1;
    popup.maxLife = 1.1;
    popup.velocityY = 2.1;
    popup.sprite.visible = true;
  }

  private spawnDeathMicroSpheres(
    origin: THREE.Vector3,
    isHerbivore: boolean,
    scaleMultiplier: number
  ): void {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const part =
        this.deathParticlePool.find((p) => !p.active) ??
        this.deathParticlePool[
          this.deathParticleCursor % this.deathParticlePool.length
        ];
      this.deathParticleCursor++;

      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = (4.8 + Math.random() * 5.2) * Math.max(0.8, scaleMultiplier);
      const upSpeed = 0.8 + Math.random() * 1.8;

      part.mesh.position.set(
        origin.x + Math.cos(angle) * 0.35,
        origin.y + 0.2,
        origin.z + Math.sin(angle) * 0.35
      );
      part.velocity.set(
        Math.cos(angle) * speed,
        upSpeed,
        Math.sin(angle) * speed
      );
      part.mat.color.setHex(
        i % 3 === 0
          ? 0xfef08a
          : isHerbivore
          ? 0x2dd4bf
          : 0xfb7185
      );
      part.mat.opacity = 0.95;
      part.mesh.scale.setScalar(0.7 + Math.random() * 0.65);
      part.active = true;
      part.maxLife = 0.55 + Math.random() * 0.25;
      part.life = part.maxLife;
      part.mesh.visible = true;
    }
  }

  private attachOrganToCreature(
    parentGroup: THREE.Group,
    organList: OrganVisualInstance[],
    adaptationId: string,
    x: number,
    y: number,
    z: number,
    rotY = 0,
    scale = 1.0
  ): void {
    const organ = createOrganVisual(adaptationId);
    organ.group.position.set(x, y, z);
    organ.group.rotation.set(0, rotY, 0);
    organ.group.scale.setScalar(scale);
    parentGroup.add(organ.group);
    organList.push(organ);
  }

  /**
   * Builds a multi-layer expressive biological eye (pearlescent sclera + glowing iris + oriented dark pupil + optional brow crest).
   */
  private addExpressiveEye(
    parentGroup: THREE.Group,
    x: number,
    y: number,
    z: number,
    rotY: number,
    scale: number,
    isPredator: boolean,
    withAggressiveBrow = false,
    browMat?: THREE.Material
  ): void {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(x, y, z);
    eyeGroup.rotation.y = rotY;
    eyeGroup.scale.setScalar(scale);

    const sclera = new THREE.Mesh(this.eyeGeo, this.eyeScleraMat);
    eyeGroup.add(sclera);

    const iris = new THREE.Mesh(
      this.eyeIrisGeo,
      isPredator ? this.predatorEyeMat : this.herbivoreEyeMat
    );
    iris.position.set(0, 0.02, -0.11);
    iris.scale.set(1.0, 1.0, 0.7);
    eyeGroup.add(iris);

    const pupil = new THREE.Mesh(this.eyePupilGeo, this.eyePupilMat);
    pupil.position.set(0, 0.03, -0.185);
    pupil.scale.set(isPredator ? 0.68 : 1.05, isPredator ? 1.18 : 0.95, 0.65);
    eyeGroup.add(pupil);

    if (withAggressiveBrow) {
      const brow = new THREE.Mesh(
        this.eyeBrowGeo,
        browMat ?? this.hunterMandibleMat
      );
      brow.position.set(0, 0.16, -0.08);
      brow.rotation.z = x < 0 ? -0.32 : x > 0 ? 0.32 : 0;
      brow.rotation.x = 0.22;
      eyeGroup.add(brow);
    }

    parentGroup.add(eyeGroup);
  }

  /**
   * Adds 3 internal translucent organelles surrounding the pulsating central nucleus so the interior looks alive.
   */
  private addInternalOrganelles(
    parentGroup: THREE.Group,
    organelleList: THREE.Mesh[],
    coreMat: THREE.Material,
    radiusSpread = 0.46
  ): void {
    const offsets: [number, number, number, number][] = [
      [-radiusSpread, 0.08, 0.18, 0.92],
      [radiusSpread * 0.95, -0.06, 0.24, 0.85],
      [0, 0.12, -radiusSpread * 0.85, 0.78],
    ];
    for (let idx = 0; idx < offsets.length; idx++) {
      const [ox, oy, oz, sc] = offsets[idx];
      const mat = idx % 2 === 0 ? this.organelleMat : coreMat;
      const orgMesh = new THREE.Mesh(this.organelleGeo, mat);
      orgMesh.position.set(ox, oy, oz);
      orgMesh.rotation.set(idx * 0.6, idx * 1.1, 0);
      orgMesh.scale.setScalar(sc);
      parentGroup.add(orgMesh);
      organelleList.push(orgMesh);
    }
  }

  /**
   * Adds an articulated multi-segment flagellum chain (3 to 5 linked elliptical segments) that undulates with sinusoidal waves proportional to real speed.
   */
  private addArticulatedFlagellum(
    parentGroup: THREE.Group,
    flagellaChains: ArticulatedFlagellumChain[],
    tailSegments: THREE.Mesh[],
    material: THREE.Material,
    baseX: number,
    baseY: number,
    baseZ: number,
    segmentCount = 4,
    segmentSpacing = 0.36,
    initialScale = 0.95,
    baseYaw = 0,
    amplitude = 0.16,
    phaseOffset = 0
  ): void {
    const segments: THREE.Mesh[] = [];
    for (let s = 0; s < segmentCount; s++) {
      const seg = new THREE.Mesh(this.tailGeo, material);
      const taper = Math.max(0.28, initialScale * (1 - s * (0.72 / segmentCount)));
      seg.scale.setScalar(taper);
      seg.position.set(
        baseX + Math.sin(baseYaw) * (s * segmentSpacing),
        baseY,
        baseZ + s * segmentSpacing
      );
      seg.rotation.y = baseYaw;
      parentGroup.add(seg);
      segments.push(seg);
      tailSegments.push(seg);
    }
    flagellaChains.push({
      segments,
      baseX,
      baseY,
      baseZ,
      baseYaw,
      segmentSpacing,
      amplitude,
      phaseOffset,
    });
  }

  /**
   * Adds rows of vibrating lateral cilia along both sides of an organism.
   */
  private addLateralCiliaRows(
    parentGroup: THREE.Group,
    ciliaList: AnimatedCiliumEntry[],
    material: THREE.Material,
    pairsCount = 4,
    xRadius = 0.96,
    zStart = -0.55,
    zStep = 0.38,
    scale = 0.9
  ): void {
    for (let c = 0; c < pairsCount; c++) {
      const zPos = zStart + c * zStep;
      for (const side of [-1, 1] as const) {
        const cilium = new THREE.Mesh(this.herbivoreCiliaGeo, material);
        cilium.position.set(side * xRadius, -0.04, zPos);
        cilium.scale.setScalar(scale);
        const baseRotZ = side * 0.18;
        const baseRotY = side * 0.25;
        cilium.rotation.set(0, baseRotY, baseRotZ);
        parentGroup.add(cilium);
        ciliaList.push({
          mesh: cilium,
          baseRotZ,
          baseRotY,
          phase: c * 0.85 + (side > 0 ? 0.4 : 0),
          side,
        });
      }
    }
  }

  /**
   * Adds a feathery oral crown of cilia around the anterior mouth of filter-feeding herbivores.
   */
  private addOralCiliaCrown(
    parentGroup: THREE.Group,
    ciliaList: AnimatedCiliumEntry[],
    material: THREE.Material,
    count = 8,
    mouthZ = -1.22,
    crownRadius = 0.42
  ): void {
    for (let k = 0; k < count; k++) {
      const theta = (k / count) * Math.PI * 2;
      const cx = Math.cos(theta) * crownRadius;
      const cy = Math.sin(theta) * (crownRadius * 0.68);
      const cilium = new THREE.Mesh(this.herbivoreCiliaGeo, material);
      cilium.position.set(cx, cy, mouthZ);
      cilium.scale.set(0.68, 0.72, 0.68);
      const side: 1 | -1 = cx >= 0 ? 1 : -1;
      const baseRotY = side * 0.55;
      const baseRotZ = Math.sin(theta) * 0.45;
      cilium.rotation.set(0.35, baseRotY, baseRotZ);
      parentGroup.add(cilium);
      ciliaList.push({
        mesh: cilium,
        baseRotZ,
        baseRotY,
        phase: k * 0.75,
        side,
      });
    }
  }

  /**
   * Builds an articulated serrated chitin mandible pincer with internal teeth for carnivorous hunters and leviathans.
   */
  private buildSerratedMandible(
    side: -1 | 1,
    material: THREE.Material,
    toothMaterial: THREE.Material,
    scaleMultiplier = 1.0
  ): THREE.Group {
    const jawGroup = new THREE.Group();
    const mainBlade = new THREE.Mesh(this.mandibleGeo, material);
    jawGroup.add(mainBlade);

    for (let t = 0; t < 3; t++) {
      const tooth = new THREE.Mesh(this.mandibleToothGeo, toothMaterial);
      tooth.position.set(
        -side * 0.12,
        0,
        -0.25 + t * 0.22
      );
      tooth.rotation.y = side > 0 ? Math.PI : 0;
      jawGroup.add(tooth);
    }

    jawGroup.scale.setScalar(scaleMultiplier);
    return jawGroup;
  }

  /**
   * Adds luminous bioelectric arc rings around the organism for combat discharge effects.
   */
  private addBioelectricArcs(
    parentGroup: THREE.Group,
    arcList: THREE.Mesh[],
    count = 3,
    scale = 1.05
  ): void {
    for (let a = 0; a < count; a++) {
      const arc = new THREE.Mesh(this.electricArcGeo, this.electricArcMat);
      arc.position.set(0, 0.08, 0.05);
      arc.rotation.set(a * 1.05, a * 1.4, a * 0.75);
      arc.scale.setScalar(scale + a * 0.12);
      arc.visible = false;
      parentGroup.add(arc);
      arcList.push(arc);
    }
  }

  private spawnEcosystem(scene: THREE.Scene): void {
    const allSpeciesKeys = Object.keys(SPECIES_PROFILES) as SpeciesType[];
    const spawnOrder: SpeciesType[] = [];
    for (const key of allSpeciesKeys) {
      const count = SPECIES_PROFILES[key].count;
      for (let c = 0; c < count; c++) {
        spawnOrder.push(key);
      }
    }

    for (let i = 0; i < spawnOrder.length; i++) {
      const speciesType = spawnOrder[i];
      const profile = SPECIES_PROFILES[speciesType];
      const isSessile = Boolean(
        profile.isSessile ||
          (profile.wanderSpeed <= 0 && profile.activeSpeed <= 0)
      );
      const group = new THREE.Group();
      group.scale.setScalar(profile.scaleMultiplier);

      let mandibleLeft: THREE.Object3D | null = null;
      let mandibleRight: THREE.Object3D | null = null;
      let coreMesh: THREE.Mesh | null = null;
      const organelleMeshes: THREE.Mesh[] = [];
      const flagellaChains: ArticulatedFlagellumChain[] = [];
      const ciliaMeshes: AnimatedCiliumEntry[] = [];
      const electricArcMeshes: THREE.Mesh[] = [];
      const tailSegments: THREE.Mesh[] = [];
      const attachedOrgans: OrganVisualInstance[] = [];

      const coreMat = new THREE.MeshStandardMaterial({
        color: profile.isHerbivore ? 0xfacc15 : 0xfb7185,
        emissive: profile.isHerbivore
          ? 0x10b981
          : profile.tier === 3
          ? 0xa855f7
          : 0xf43f5e,
        emissiveIntensity: 1.05,
        roughness: 0.25,
      });
      this.disposableMaterials.push(coreMat);

      // Build multi-layered translucent organic 3D morphology + eyes + internal organelles + coherent propulsion
      switch (speciesType) {
        case 'nematocito': {
          // 1. Nematocito Acordonado: Translucent sky-blue sphere + internal core/organelles + harpoon cells + stalked eyes + lateral cilia + twin whip flagella
          const body = new THREE.Mesh(
            this.sphericalBodyGeo,
            this.nematocitoBodyMat
          );
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.44);

          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'weapon_harpoon_cell',
            -0.85,
            0,
            -0.95,
            -0.4,
            1.1
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'weapon_harpoon_cell',
            0.85,
            0,
            -0.95,
            0.4,
            1.1
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'sense_stalk_compound_eye',
            -0.48,
            0.35,
            -0.85,
            -0.2,
            0.95
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'sense_stalk_compound_eye',
            0.48,
            0.35,
            -0.85,
            0.2,
            0.95
          );
          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.56,
              0.24,
              -0.92,
              side * 0.35,
              0.82,
              false
            );
          }
          this.addLateralCiliaRows(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            4,
            1.04,
            -0.45,
            0.34,
            0.85
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.nematocitoBodyMat,
            -0.22,
            0,
            1.28,
            4,
            0.34,
            0.82,
            -0.08,
            0.16,
            0
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.nematocitoBodyMat,
            0.22,
            0,
            1.28,
            4,
            0.34,
            0.82,
            0.08,
            0.16,
            Math.PI * 0.5
          );
          break;
        }

        case 'gasteropodo': {
          // 2. Gasterópodo Sulfuroso: Translucent amber body + dorsal armored chitin shell plates + core/organelles + wide lateral eyes + mouth_radula + ventral cilia + rear flagellum
          const body = new THREE.Mesh(
            this.sphericalBodyGeo,
            this.gasteropodoBodyMat
          );
          body.scale.set(1.15, 0.95, 1.25);
          group.add(body);

          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          coreMesh.position.set(0, -0.05, 0.1);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.48);

          for (let s = 0; s < 3; s++) {
            const plate = new THREE.Mesh(
              this.leviathanPlateGeo,
              this.shellArmorMat
            );
            plate.position.set(0, 0.65 - s * 0.08, -0.35 + s * 0.45);
            group.add(plate);
          }
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'mouth_radula',
            0,
            -0.15,
            -1.35,
            0,
            1.25
          );
          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.68,
              0.25,
              -0.98,
              side * 0.42,
              0.92,
              false
            );
          }
          this.addLateralCiliaRows(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            5,
            1.12,
            -0.65,
            0.34,
            0.88
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.herbivoreCiliaMat,
            0,
            -0.08,
            1.42,
            4,
            0.34,
            0.84,
            0,
            0.14,
            0
          );
          break;
        }

        case 'perforador': {
          // 3. Perforador Abisal: Translucent ice-blue fusiform body + glowing core/organelles + rotary drill on head + convergent stalker eyes + 5-segment high-thrust whip flagellum
          const body = new THREE.Mesh(
            this.predatorBodyGeo,
            this.perforadorBodyMat
          );
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.42);

          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'weapon_rotary_drill',
            0,
            0,
            -1.45,
            0,
            1.35
          );
          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.46,
              0.3,
              -0.88,
              side * 0.14,
              0.95,
              true,
              true,
              this.hunterMandibleMat
            );
          }
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.perforadorBodyMat,
            -0.18,
            0,
            1.38,
            5,
            0.36,
            0.94,
            -0.06,
            0.2,
            0
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.perforadorBodyMat,
            0.18,
            0,
            1.38,
            5,
            0.36,
            0.94,
            0.06,
            0.2,
            Math.PI * 0.65
          );
          break;
        }

        case 'vibora_fosa': {
          // 4. Víbora de Fosa: Translucent venomous green vermiform body + internal core/organelles + slit predator eyes + serrated fangs + 2 acid blisters + 5-segment serpentine flagellum
          const body = new THREE.Mesh(
            this.elongatedBodyGeo,
            this.viboraBodyMat
          );
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          coreMesh.scale.set(0.78, 0.72, 1.25);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.38);

          mandibleLeft = this.buildSerratedMandible(
            -1,
            this.hunterMandibleMat,
            this.eyeScleraMat,
            0.88
          );
          mandibleLeft.position.set(-0.38, -0.05, -1.55);
          mandibleLeft.rotation.y = -0.22;
          group.add(mandibleLeft);

          mandibleRight = this.buildSerratedMandible(
            1,
            this.hunterMandibleMat,
            this.eyeScleraMat,
            0.88
          );
          mandibleRight.position.set(0.38, -0.05, -1.55);
          mandibleRight.rotation.y = 0.22;
          group.add(mandibleRight);

          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.44,
              0.28,
              -1.18,
              side * 0.16,
              0.92,
              true,
              true,
              this.hunterMandibleMat
            );
          }

          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.viboraBodyMat,
            0,
            0,
            1.52,
            5,
            0.44,
            1.08,
            0,
            0.24,
            0
          );

          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'weapon_caustic_acid_blister',
            -0.8,
            0.15,
            -0.2,
            -Math.PI / 2,
            1.2
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'weapon_caustic_acid_blister',
            0.8,
            0.15,
            -0.2,
            Math.PI / 2,
            1.2
          );
          break;
        }

        case 'medusa_biolum': {
          // 5. Medusa Bioluminiscente: Translucent cyan bell + pulsing core/organelles + ring of eyes + flash photophore + ribbon fins + 3 trailing tentacle flagella + bioelectric arcs
          const body = new THREE.Mesh(this.medusaBellGeo, this.medusaBodyMat);
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.42);

          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.54,
              0.22,
              -0.86,
              side * 0.22,
              0.94,
              true
            );
          }

          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'weapon_flash_photophore',
            0,
            0.25,
            -1.05,
            0,
            1.3
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'movement_ribbon_fin',
            -1.0,
            0,
            0,
            -Math.PI / 2,
            1.05
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'movement_ribbon_fin',
            1.0,
            0,
            0,
            Math.PI / 2,
            1.05
          );

          for (const tx of [-0.36, 0, 0.36]) {
            this.addArticulatedFlagellum(
              group,
              flagellaChains,
              tailSegments,
              this.medusaBodyMat,
              tx,
              -0.08,
              0.92,
              4,
              0.38,
              0.78,
              tx * 0.2,
              0.2,
              tx * 2.0
            );
          }
          this.addBioelectricArcs(group, electricArcMeshes, 2, 0.95);
          break;
        }

        case 'anquilocelula': {
          // 6. Anquilocélula de Fondo: Translucent dome + dorsal armor plates + glowing core/organelles + lateral armored eyes + frontal chitin shield + tail club + dual flagella + lateral cilia
          const body = new THREE.Mesh(
            this.sphericalBodyGeo,
            this.anquiloBodyMat
          );
          body.scale.set(1.3, 0.78, 1.2);
          group.add(body);

          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.5);

          for (let s = 0; s < 2; s++) {
            const plate = new THREE.Mesh(
              this.leviathanPlateGeo,
              this.shellArmorMat
            );
            plate.position.set(0, 0.55 - s * 0.06, -0.25 + s * 0.55);
            group.add(plate);
          }

          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.76,
              0.22,
              -0.85,
              side * 0.35,
              0.92,
              true,
              true,
              this.shellArmorMat
            );
          }

          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'defense_chitin_shield_plate',
            0,
            0.05,
            -1.35,
            0,
            1.25
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'weapon_tail_club',
            0,
            0,
            1.45,
            Math.PI,
            1.35
          );
          this.addLateralCiliaRows(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            4,
            1.24,
            -0.5,
            0.36,
            0.9
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.anquiloBodyMat,
            -0.38,
            -0.06,
            1.25,
            3,
            0.34,
            0.8,
            -0.15,
            0.14,
            0
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.anquiloBodyMat,
            0.38,
            -0.06,
            1.25,
            3,
            0.34,
            0.8,
            0.15,
            0.14,
            Math.PI
          );
          break;
        }

        case 'esponja_espicular': {
          // 7. Esponja Espicular (SÉSIL - SIN FLAGELOS NI CILIOS -> VELOCIDAD 0):
          // Crystalline translucent tubular poriferan + glowing core & organelles + central apical watchful eye + radial silica spicules
          const body = new THREE.Mesh(this.spongeTubeGeo, this.esponjaBodyMat);
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.38);

          // Central apical eye and pair of lateral ocelli so it has expressive vision while anchored
          this.addExpressiveEye(group, 0, 0.72, -0.58, 0, 1.08, false);
          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.62,
              0.38,
              -0.52,
              side * 0.45,
              0.78,
              false
            );
          }

          for (let a = 0; a < 4; a++) {
            const ang = (a / 4) * Math.PI * 2 + Math.PI / 4;
            this.attachOrganToCreature(
              group,
              attachedOrgans,
              'defense_silica_spicules',
              Math.sin(ang) * 0.95,
              0.1,
              Math.cos(ang) * 0.95,
              ang,
              1.15
            );
          }
          break;
        }

        case 'nebula_gelatinosa': {
          // 8. Nébula Gelatinosa: Translucent violet globular giant + glowing core & organelles + peaceful wide eyes + mucus glands + oral & lateral cilia + twin undulating flagella
          const body = new THREE.Mesh(
            this.sphericalBodyGeo,
            this.nebulaBodyMat
          );
          body.scale.set(1.25, 0.9, 1.25);
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.52);

          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.66,
              0.28,
              -1.05,
              side * 0.38,
              1.02,
              false
            );
          }

          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'defense_mucus_gland',
            -1.1,
            0,
            -0.25,
            -Math.PI / 2,
            1.25
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'defense_mucus_gland',
            1.1,
            0,
            -0.25,
            Math.PI / 2,
            1.25
          );

          this.addOralCiliaCrown(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            6,
            -1.28,
            0.38
          );
          this.addLateralCiliaRows(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            4,
            1.18,
            -0.55,
            0.38,
            0.92
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.nebulaBodyMat,
            -0.26,
            0,
            1.38,
            4,
            0.36,
            0.88,
            -0.1,
            0.16,
            0
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.nebulaBodyMat,
            0.26,
            0,
            1.38,
            4,
            0.36,
            0.88,
            0.1,
            0.16,
            Math.PI * 0.7
          );
          break;
        }

        case 'bala_fumarola': {
          // 9. Bala de Fumarola: Streamlined translucent hydro-jet hunter + glowing core & organelles + forward convergent eyes + rostral spike + reactive nozzle + twin stabilizing whip flagella
          const body = new THREE.Mesh(this.elongatedBodyGeo, this.balaBodyMat);
          body.scale.set(0.82, 0.78, 1.25);
          group.add(body);

          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          coreMesh.scale.set(0.72, 0.72, 1.2);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.36);

          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.42,
              0.26,
              -1.15,
              side * 0.12,
              0.9,
              true,
              true,
              this.hunterMandibleMat
            );
          }

          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'movement_reactive_nozzle',
            0,
            0,
            1.65,
            Math.PI,
            1.35
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'chitin_spike',
            0,
            0,
            -1.55,
            0,
            1.2
          );

          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.balaBodyMat,
            -0.28,
            0,
            1.55,
            4,
            0.34,
            0.78,
            -0.12,
            0.18,
            0
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.balaBodyMat,
            0.28,
            0,
            1.55,
            4,
            0.34,
            0.78,
            0.12,
            0.18,
            Math.PI * 0.5
          );
          break;
        }

        case 'mirador_abisal': {
          // 10. Mirador Abisal: Translucent magenta body + glowing core/organelles + 3 compound stalked eyes + frontal expressive eyes + biolum probe + lateral cilia + dual flagella
          const body = new THREE.Mesh(
            this.herbivoreBodyGeo,
            this.miradorBodyMat
          );
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.42);

          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.5,
              0.22,
              -0.96,
              side * 0.28,
              0.92,
              false
            );
          }

          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'sense_abyssal_biolum_probe',
            0,
            0.35,
            -1.15,
            0,
            1.25
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'sense_stalk_compound_eye',
            -0.68,
            0.28,
            -0.8,
            -0.35,
            1.15
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'sense_stalk_compound_eye',
            0.68,
            0.28,
            -0.8,
            0.35,
            1.15
          );
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'sense_stalk_compound_eye',
            0,
            0.52,
            -0.55,
            0,
            1.1
          );

          this.addLateralCiliaRows(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            4,
            0.98,
            -0.45,
            0.35,
            0.88
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.miradorBodyMat,
            -0.2,
            0,
            1.28,
            4,
            0.34,
            0.84,
            -0.08,
            0.16,
            0
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.miradorBodyMat,
            0.2,
            0,
            1.28,
            4,
            0.34,
            0.84,
            0.08,
            0.16,
            Math.PI * 0.5
          );
          break;
        }

        case 'hunter':
        case 'leviathan': {
          // 11 & 12. Mandíbula Rápida (hunter) & Megacélula Acorazada (leviathan)
          const isLeviathan = speciesType === 'leviathan';
          const bodyMat = isLeviathan
            ? this.leviathanBodyMat
            : this.hunterBodyMat;
          const accentMat = isLeviathan
            ? this.leviathanMandibleMat
            : this.hunterMandibleMat;

          const bodyMesh = new THREE.Mesh(this.predatorBodyGeo, bodyMat);
          bodyMesh.castShadow = true;
          bodyMesh.receiveShadow = true;
          group.add(bodyMesh);

          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          coreMesh.position.set(0, 0.05, 0.15);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.46);

          // Serrated mandibular pincers with internal chitin teeth
          mandibleLeft = this.buildSerratedMandible(
            -1,
            accentMat,
            this.eyeScleraMat,
            isLeviathan ? 1.32 : 1.05
          );
          mandibleLeft.position.set(isLeviathan ? -0.56 : -0.48, -0.05, -1.35);
          mandibleLeft.rotation.y = -0.25;
          group.add(mandibleLeft);

          mandibleRight = this.buildSerratedMandible(
            1,
            accentMat,
            this.eyeScleraMat,
            isLeviathan ? 1.32 : 1.05
          );
          mandibleRight.position.set(isLeviathan ? 0.56 : 0.48, -0.05, -1.35);
          mandibleRight.rotation.y = 0.25;
          group.add(mandibleRight);

          if (isLeviathan) {
            // Segmented dorsal carapace plates + lateral propulsion fins + bioelectric combat arcs
            for (let s = 0; s < 3; s++) {
              const plate = new THREE.Mesh(this.leviathanPlateGeo, accentMat);
              plate.position.set(0, 0.58 - s * 0.05, -0.35 + s * 0.62);
              group.add(plate);
            }
            this.attachOrganToCreature(
              group,
              attachedOrgans,
              'movement_ribbon_fin',
              -1.02,
              -0.04,
              0.2,
              -Math.PI / 2,
              1.12
            );
            this.attachOrganToCreature(
              group,
              attachedOrgans,
              'movement_ribbon_fin',
              1.02,
              -0.04,
              0.2,
              Math.PI / 2,
              1.12
            );
            this.addBioelectricArcs(group, electricArcMeshes, 3, 1.15);
          } else {
            // Dorsal hydrodynamic spines for Mandíbula Rápida
            for (let s = 0; s < 3; s++) {
              const spine = new THREE.Mesh(this.spineGeo, accentMat);
              spine.position.set(0, 0.65 - s * 0.08, -0.3 + s * 0.55);
              spine.rotation.x = -0.35;
              group.add(spine);
            }
          }

          // Forward-convergent predator eyes with aggressive brow crests
          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * (isLeviathan ? 0.56 : 0.5),
              0.28,
              -0.88,
              side * 0.15,
              isLeviathan ? 0.88 : 1.02,
              true,
              true,
              accentMat
            );
          }

          // Twin articulated whip flagella in the tail (5 segments each) beating at high frequency
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            bodyMat,
            -0.22,
            0,
            1.36,
            5,
            0.36,
            isLeviathan ? 1.08 : 0.96,
            -0.08,
            0.2,
            0
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            bodyMat,
            0.22,
            0,
            1.36,
            5,
            0.36,
            isLeviathan ? 1.08 : 0.96,
            0.08,
            0.2,
            Math.PI * 0.6
          );
          break;
        }

        case 'clorofita_solar': {
          // 14. Clorofita Solar (Herbivore 🟢 Tier 1): Translucent lime-green spherical cell + internal floating chloroplast discs + 1 large peaceful frontal eye + 4 fan-like vibrating cilia
          const body = new THREE.Mesh(
            this.sphericalBodyGeo,
            this.clorofitaBodyMat
          );
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          coreMesh.scale.setScalar(0.86);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.45);
          this.addExpressiveEye(group, 0, 0.22, -1.04, 0, 1.18, false);
          this.addLateralCiliaRows(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            2,
            1.02,
            -0.25,
            0.52,
            1.05
          );
          break;
        }

        case 'fito_medusa': {
          // 15. Fitomedusa de Cristal (Herbivore 🟢 Tier 1): Transparent turquoise gelatinous bell + central abyssal eye + 3 filamentous undulating flagella
          const body = new THREE.Mesh(this.medusaBellGeo, this.herbivoreBodyMat);
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.38);
          this.addExpressiveEye(group, 0, 0.25, -0.92, 0, 1.12, false);
          for (const tx of [-0.32, 0, 0.32]) {
            this.addArticulatedFlagellum(
              group,
              flagellaChains,
              tailSegments,
              this.herbivoreBodyMat,
              tx,
              -0.06,
              0.88,
              4,
              0.35,
              0.74,
              tx * 0.2,
              0.18,
              tx * 1.8
            );
          }
          break;
        }

        case 'espora_refulgente': {
          // 16. Espora Refulgente (Herbivore 🟢 Tier 2): Domed emerald body + yellow bioluminescent photophores + 2 lateral stalked eyes + crown of wheel-beating cilia
          const body = new THREE.Mesh(
            this.sphericalBodyGeo,
            this.esporaBodyMat
          );
          body.scale.set(1.12, 0.92, 1.12);
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.46);
          for (const side of [-1, 1] as const) {
            this.attachOrganToCreature(
              group,
              attachedOrgans,
              'eye_stalks',
              side * 0.62,
              0.32,
              -0.82,
              side * 0.35,
              1.05
            );
            this.addExpressiveEye(
              group,
              side * 0.56,
              0.24,
              -0.96,
              side * 0.32,
              0.9,
              false
            );
          }
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'weapon_flash_photophore',
            0,
            0.35,
            -0.95,
            0,
            1.1
          );
          this.addOralCiliaCrown(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            8,
            -1.18,
            0.42
          );
          this.addLateralCiliaRows(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            4,
            1.08,
            -0.45,
            0.36,
            0.9
          );
          break;
        }

        case 'pluricelular_pastador': {
          // 17. Pluricelular Pastador (Herbivore 🟢 Tier 2): Segmented colony of 3 translucent forest-green lobes + eyes on each segment + baleen filter mouth + 2 thick caudal flagella
          for (let segIdx = 0; segIdx < 3; segIdx++) {
            const lobe = new THREE.Mesh(
              this.sphericalBodyGeo,
              this.pastadorBodyMat
            );
            const lobeScale = 1.0 - segIdx * 0.12;
            lobe.scale.set(0.95 * lobeScale, 0.78 * lobeScale, 0.85 * lobeScale);
            lobe.position.set(0, 0, -0.68 + segIdx * 0.72);
            group.add(lobe);
            for (const side of [-1, 1] as const) {
              this.addExpressiveEye(
                group,
                side * (0.58 * lobeScale),
                0.22,
                -0.88 + segIdx * 0.72,
                side * 0.38,
                0.78 * lobeScale,
                false
              );
            }
          }
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.45);
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'mouth_filter_baleen',
            0,
            -0.08,
            -1.45,
            0,
            1.2
          );
          for (const side of [-1, 1] as const) {
            this.addArticulatedFlagellum(
              group,
              flagellaChains,
              tailSegments,
              this.pastadorBodyMat,
              side * 0.24,
              0,
              1.48,
              4,
              0.36,
              0.92,
              side * 0.1,
              0.18,
              side > 0 ? Math.PI * 0.5 : 0
            );
          }
          break;
        }

        case 'titan_verde': {
          // 18. Coloso Fitoplanctónico (Herbivore 🟢 Tier 3): Large translucent emerald ovoid organism + lateral compound eyes + soft cellulose plates + long rows of feathery cilia
          const body = new THREE.Mesh(
            this.predatorBodyGeo,
            this.esporaBodyMat
          );
          body.scale.set(1.26, 0.92, 1.24);
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          coreMesh.scale.setScalar(1.1);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.54);
          for (let s = 0; s < 3; s++) {
            const plate = new THREE.Mesh(
              this.leviathanPlateGeo,
              this.organelleMat
            );
            plate.position.set(0, 0.58 - s * 0.06, -0.4 + s * 0.55);
            group.add(plate);
          }
          for (const side of [-1, 1] as const) {
            this.attachOrganToCreature(
              group,
              attachedOrgans,
              'sense_stalk_compound_eye',
              side * 0.78,
              0.3,
              -0.92,
              side * 0.4,
              1.2
            );
            this.addExpressiveEye(
              group,
              side * 0.72,
              0.26,
              -1.08,
              side * 0.35,
              1.05,
              false
            );
          }
          this.addOralCiliaCrown(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            10,
            -1.45,
            0.48
          );
          this.addLateralCiliaRows(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            6,
            1.26,
            -0.75,
            0.34,
            1.02
          );
          break;
        }

        case 'quelicerado_abisal': {
          // 19. Quelicerado de Fosa (Neutral ⚪ Tier 2): Flat chitinous deep grey/blue body + folded mouth pincers + 2 small protected eyes + twin rear flagella
          const body = new THREE.Mesh(
            this.sphericalBodyGeo,
            this.queliceradoBodyMat
          );
          body.scale.set(1.28, 0.62, 1.18);
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.44);

          mandibleLeft = this.buildSerratedMandible(
            -1,
            this.pearlShellMat,
            this.eyeScleraMat,
            0.95
          );
          mandibleLeft.position.set(-0.42, -0.05, -1.28);
          mandibleLeft.rotation.y = -0.35;
          group.add(mandibleLeft);

          mandibleRight = this.buildSerratedMandible(
            1,
            this.pearlShellMat,
            this.eyeScleraMat,
            0.95
          );
          mandibleRight.position.set(0.42, -0.05, -1.28);
          mandibleRight.rotation.y = 0.35;
          group.add(mandibleRight);

          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.52,
              0.22,
              -0.92,
              side * 0.2,
              0.82,
              true,
              true,
              this.basaltArmorMat
            );
          }
          this.addLateralCiliaRows(
            group,
            ciliaMeshes,
            this.pearlShellMat,
            4,
            1.22,
            -0.45,
            0.34,
            0.85
          );
          for (const side of [-1, 1] as const) {
            this.addArticulatedFlagellum(
              group,
              flagellaChains,
              tailSegments,
              this.queliceradoBodyMat,
              side * 0.25,
              -0.04,
              1.28,
              4,
              0.34,
              0.82,
              side * 0.1,
              0.16,
              side > 0 ? Math.PI * 0.5 : 0
            );
          }
          break;
        }

        case 'nautilo_espinoso': {
          // 20. Nautilocefalópodo Espinoso (Neutral ⚪ Tier 2): Pearlescent spiral fossil shell over vermiform body + lateral eyes + rostral defensive spike + siphon flagella
          const body = new THREE.Mesh(
            this.elongatedBodyGeo,
            this.queliceradoBodyMat
          );
          body.scale.set(0.95, 0.85, 1.05);
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.42);

          for (let s = 0; s < 3; s++) {
            const shellRing = new THREE.Mesh(
              this.leviathanPlateGeo,
              this.pearlShellMat
            );
            shellRing.position.set(0, 0.56 - s * 0.05, -0.2 + s * 0.42);
            shellRing.scale.setScalar(1.05 - s * 0.14);
            group.add(shellRing);
          }

          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'chitin_spike',
            0,
            0.05,
            -1.48,
            0,
            1.25
          );
          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.52,
              0.24,
              -0.98,
              side * 0.35,
              0.92,
              false
            );
          }
          for (const tx of [-0.22, 0, 0.22]) {
            this.addArticulatedFlagellum(
              group,
              flagellaChains,
              tailSegments,
              this.pearlShellMat,
              tx,
              -0.06,
              1.38,
              4,
              0.34,
              0.78,
              tx * 0.15,
              0.16,
              tx * 2.0
            );
          }
          break;
        }

        case 'triturador_fumarola': {
          // 21. Triturador de Grieta (Neutral ⚪ Tier 3): Heavy armored beast with dark basalt carapace + slow crushing mandibles + armored eyes + heavy tail club & flagella
          const body = new THREE.Mesh(
            this.predatorBodyGeo,
            this.trituradorBodyMat
          );
          body.scale.set(1.24, 0.92, 1.18);
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.5);

          for (let s = 0; s < 3; s++) {
            const plate = new THREE.Mesh(
              this.leviathanPlateGeo,
              this.basaltArmorMat
            );
            plate.position.set(0, 0.62 - s * 0.06, -0.38 + s * 0.58);
            plate.scale.setScalar(1.18);
            group.add(plate);
          }

          mandibleLeft = this.buildSerratedMandible(
            -1,
            this.pearlShellMat,
            this.eyeScleraMat,
            1.35
          );
          mandibleLeft.position.set(-0.58, -0.06, -1.42);
          mandibleLeft.rotation.y = -0.26;
          group.add(mandibleLeft);

          mandibleRight = this.buildSerratedMandible(
            1,
            this.pearlShellMat,
            this.eyeScleraMat,
            1.35
          );
          mandibleRight.position.set(0.58, -0.06, -1.42);
          mandibleRight.rotation.y = 0.26;
          group.add(mandibleRight);

          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.62,
              0.28,
              -0.96,
              side * 0.22,
              0.92,
              true,
              true,
              this.basaltArmorMat
            );
          }
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'weapon_tail_club',
            0,
            0,
            1.52,
            Math.PI,
            1.35
          );
          for (const side of [-1, 1] as const) {
            this.addArticulatedFlagellum(
              group,
              flagellaChains,
              tailSegments,
              this.trituradorBodyMat,
              side * 0.34,
              -0.06,
              1.38,
              4,
              0.36,
              0.92,
              side * 0.14,
              0.16,
              side > 0 ? Math.PI : 0
            );
          }
          break;
        }

        case 'aguijon_electrico': {
          // 22. Aguijón Eléctrico (Hostile 🔴 Tier 2): Elongated violet-red fusiform hunter + feline frontal eyes + caudal stinger + bioelectric discharge rings + whip flagella
          const body = new THREE.Mesh(
            this.elongatedBodyGeo,
            this.aguijonBodyMat
          );
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.42);

          mandibleLeft = this.buildSerratedMandible(
            -1,
            this.hunterMandibleMat,
            this.eyeScleraMat,
            0.96
          );
          mandibleLeft.position.set(-0.42, -0.04, -1.52);
          mandibleLeft.rotation.y = -0.22;
          group.add(mandibleLeft);

          mandibleRight = this.buildSerratedMandible(
            1,
            this.hunterMandibleMat,
            this.eyeScleraMat,
            0.96
          );
          mandibleRight.position.set(0.42, -0.04, -1.52);
          mandibleRight.rotation.y = 0.22;
          group.add(mandibleRight);

          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.44,
              0.28,
              -1.15,
              side * 0.14,
              0.95,
              true,
              true,
              this.hunterMandibleMat
            );
          }
          this.attachOrganToCreature(
            group,
            attachedOrgans,
            'chitin_spike',
            0,
            0.08,
            1.62,
            Math.PI,
            1.28
          );
          this.addBioelectricArcs(group, electricArcMeshes, 3, 1.05);
          for (const side of [-1, 1] as const) {
            this.addArticulatedFlagellum(
              group,
              flagellaChains,
              tailSegments,
              this.aguijonBodyMat,
              side * 0.24,
              0,
              1.48,
              5,
              0.36,
              0.92,
              side * 0.1,
              0.22,
              side > 0 ? Math.PI * 0.6 : 0
            );
          }
          break;
        }

        case 'leviatan_sauro': {
          // 23. Leviatán Hendidor (Hostile 🔴 Tier 3): Colossal apex predator + dark crimson armored head + multiple converging stalker eyes + double serrated mandibles + 3 whip flagella
          const body = new THREE.Mesh(this.predatorBodyGeo, this.sauroBodyMat);
          body.scale.set(1.22, 0.9, 1.28);
          group.add(body);
          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          coreMesh.scale.setScalar(1.15);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.52);

          for (let s = 0; s < 3; s++) {
            const plate = new THREE.Mesh(
              this.leviathanPlateGeo,
              this.hunterMandibleMat
            );
            plate.position.set(0, 0.62 - s * 0.06, -0.42 + s * 0.62);
            plate.scale.setScalar(1.15);
            group.add(plate);
          }

          mandibleLeft = this.buildSerratedMandible(
            -1,
            this.hunterMandibleMat,
            this.eyeScleraMat,
            1.42
          );
          mandibleLeft.position.set(-0.62, -0.05, -1.48);
          mandibleLeft.rotation.y = -0.25;
          group.add(mandibleLeft);

          mandibleRight = this.buildSerratedMandible(
            1,
            this.hunterMandibleMat,
            this.eyeScleraMat,
            1.42
          );
          mandibleRight.position.set(0.62, -0.05, -1.48);
          mandibleRight.rotation.y = 0.25;
          group.add(mandibleRight);

          // Inner secondary pair of serrated fangs
          for (const side of [-1, 1] as const) {
            const innerJaw = this.buildSerratedMandible(
              side,
              this.leviathanMandibleMat,
              this.eyeScleraMat,
              0.92
            );
            innerJaw.position.set(side * 0.32, -0.12, -1.42);
            innerJaw.rotation.y = side * 0.16;
            group.add(innerJaw);
          }

          // Multiple converging stalker eyes (4 eyes)
          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.54,
              0.3,
              -1.02,
              side * 0.14,
              0.96,
              true,
              true,
              this.hunterMandibleMat
            );
            this.addExpressiveEye(
              group,
              side * 0.72,
              0.18,
              -0.72,
              side * 0.28,
              0.76,
              true,
              true,
              this.hunterMandibleMat
            );
          }

          for (const tx of [-0.32, 0, 0.32]) {
            this.addArticulatedFlagellum(
              group,
              flagellaChains,
              tailSegments,
              this.sauroBodyMat,
              tx,
              0,
              1.48,
              5,
              0.38,
              1.05,
              tx * 0.18,
              0.22,
              tx * 1.9
            );
          }
          break;
        }

        default: {
          // HERBIVORE ("Célula Filtradora")
          // Emerald/turquoise translucent capsule + glowing nucleus & chloroplasts + feathery oral cilia wheel + large peaceful lateral eyes + lateral cilia + 2 fine rear flagella
          const bodyMesh = new THREE.Mesh(
            this.herbivoreBodyGeo,
            this.herbivoreBodyMat
          );
          bodyMesh.castShadow = true;
          bodyMesh.receiveShadow = true;
          group.add(bodyMesh);

          coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          coreMesh.scale.setScalar(0.85);
          group.add(coreMesh);
          this.addInternalOrganelles(group, organelleMeshes, coreMat, 0.42);

          // Large peaceful wide-angle lateral eyes
          for (const side of [-1, 1] as const) {
            this.addExpressiveEye(
              group,
              side * 0.56,
              0.26,
              -0.94,
              side * 0.36,
              1.04,
              false
            );
          }

          // Feathery oral cilia crown beating in a wheel around the mouth
          this.addOralCiliaCrown(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            8,
            -1.22,
            0.38
          );

          // Vibrating lateral cilia rows
          this.addLateralCiliaRows(
            group,
            ciliaMeshes,
            this.herbivoreCiliaMat,
            4,
            0.98,
            -0.5,
            0.36,
            0.92
          );

          // 2 fine undulating rear flagella (4 articulated segments each)
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.herbivoreCiliaMat,
            -0.2,
            0,
            1.26,
            4,
            0.33,
            0.78,
            -0.08,
            0.16,
            0
          );
          this.addArticulatedFlagellum(
            group,
            flagellaChains,
            tailSegments,
            this.herbivoreCiliaMat,
            0.2,
            0,
            1.26,
            4,
            0.33,
            0.78,
            0.08,
            0.16,
            Math.PI * 0.65
          );
          break;
        }
      }

      // Wrap all cellular meshes created in switch(speciesType) into cellBodyGroup so they can be cleanly hidden in creature_stage
      const cellBodyGroup = new THREE.Group();
      while (group.children.length > 0) {
        cellBodyGroup.add(group.children[0]);
      }
      group.add(cellBodyGroup);

      // Build Full 3D Terrestrial Creature Model (ARK / Spore Archetype with 5-segment torso, legs, feet, arms, eyes, and jaws/beak)
      const landVisual = this.buildTerrestrialCreatureModel(profile, i);
      landVisual.landCreatureGroup.visible = false;
      group.add(landVisual.landCreatureGroup);

      // Unified Ground Attitude Circle (Green 0x22c55e for Herbivores, White 0xf8fafc for Neutral, Red 0xef4444 for Hostile)
      const initialRingColor =
        profile.attitude === 'herbivore'
          ? 0x22c55e
          : profile.attitude === 'neutral'
          ? 0xf8fafc
          : 0xef4444;
      const stateRingMat = new THREE.MeshBasicMaterial({
        color: initialRingColor,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.disposableMaterials.push(stateRingMat);
      const ringMesh = new THREE.Mesh(this.ringGeo, stateRingMat);
      ringMesh.position.y = -0.95;
      group.add(ringMesh);

      // Legacy fallback group (kept hidden)
      const legsGroup = new THREE.Group();
      legsGroup.visible = false;
      const legs: THREE.Mesh[] = [];
      group.add(legsGroup);

      // 3D Circular Health Bar Ring (ShaderMaterial around/above the organism, visible only when damaged/in combat)
      const healthRingMat = new THREE.ShaderMaterial({
        vertexShader: HEALTH_RING_VERTEX_SHADER,
        fragmentShader: HEALTH_RING_FRAGMENT_SHADER,
        uniforms: {
          uHealthRatio: { value: 1.0 },
          uOpacity: { value: 0.0 },
          uFlash: { value: 0.0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposableMaterials.push(healthRingMat);

      const healthRingMesh = new THREE.Mesh(
        this.healthRingPlaneGeo,
        healthRingMat
      );
      healthRingMesh.position.set(0, 0.82, 0);
      healthRingMesh.visible = false;
      healthRingMesh.renderOrder = 12;
      group.add(healthRingMesh);

      scene.add(group);

      const tierMaxHealth =
        profile.tier === 1
          ? profile.isHerbivore
            ? 32
            : 42
          : profile.tier === 2
          ? 72
          : 125;

      const entity: OrganismEntity = {
        id: i + 1,
        species: speciesType,
        speciesName: profile.name,
        profile,
        isSessile,
        group,
        position: group.position,
        headingAngle: Math.random() * Math.PI * 2,
        currentSpeed: isSessile ? 0 : profile.wanderSpeed,
        state: 'DEAMBULAR',
        active: true,
        respawnTimer: 0,
        stunTimer: 0,
        poisonTimer: 0,
        poisonTickTimer: 0,
        provokedTimer: 0,
        socialCooldown: 0,
        wanderTarget: new THREE.Vector3(),
        wanderRetargetTimer: 0,
        attackCooldown: 0,
        lungeTimer: 0,
        swimPhase: i * 1.15,
        maxHealth: tierMaxHealth,
        health: tierMaxHealth,
        combatRevealTimer: 0,
        hitFlashTimer: 0,
        biteImmunityTimer: 0,
        dyingTimer: 0,
        dyingKilledByPlayer: false,
        knockbackVelocity: new THREE.Vector3(),
        healthRingMesh,
        healthRingMat,
        coreMesh,
        organelleMeshes,
        mandibleLeft,
        mandibleRight,
        tailSegments,
        flagellaChains,
        ciliaMeshes,
        electricArcMeshes,
        attachedOrgans,
        cellBodyGroup,
        landCreatureGroup: landVisual.landCreatureGroup,
        landSpeciesName: landVisual.landSpeciesName,
        landArchetype: landVisual.landArchetype,
        landLegs: landVisual.landLegs,
        landArms: landVisual.landArms,
        landTailGroup: landVisual.landTailGroup,
        landHeadGroup: landVisual.landHeadGroup,
        landLowerJaw: landVisual.landLowerJaw,
        standingOffset: landVisual.standingOffset,
        verticalVelocity: 0,
        packNestIndex: Math.floor(i / 4) % 12,
        legsGroup,
        legs,
        stateRingMat,
        coreMat,
        geneticTraits: [...profile.primaryTraits],
      };

      this.organisms.push(entity);
      this.telemetryCache.push({
        id: entity.id,
        species: entity.species,
        speciesName: entity.speciesName,
        state: 'DEAMBULAR',
        distanceToPlayer: 999,
      });
    }

    this.resetAll();
  }

  /**
   * Computes the world coordinate of one of the 12 secondary rival nests on emergent continental land.
   */
  private getRivalNestCenter(nestIndex: number): { x: number; z: number; y: number } {
    const n = ((nestIndex % 12) + 12) % 12;
    const baseAngle = (n / 12) * Math.PI * 2 + 0.35;
    const ringRadius = n < 6 ? 85 + (n % 3) * 42 : 220 + ((n - 6) % 6) * 75;
    let nx = Math.cos(baseAngle) * ringRadius;
    let nz = Math.sin(baseAngle) * ringRadius;
    let ny = getLandHeightAt(nx, nz);
    if (ny < 0.8) {
      nx = Math.cos(baseAngle) * 95;
      nz = Math.sin(baseAngle) * 95;
      ny = Math.max(0.8, getLandHeightAt(nx, nz));
    }
    return { x: nx, z: nz, y: ny };
  }

  /**
   * Builds a complete 3D terrestrial creature model (ARK / Spore style) using one of the 3 body archetypes
   * (`bipedo_agil`, `cuadrupedo_robusto`, `reptiliano_rastreador`) with opaque scaly/leathery terrestrial skin,
   * 5 chained anatomical segments, articulated legs with feet, forelimbs/claws, binocular/lateral eyes, and jaws/beaks.
   */
  private buildTerrestrialCreatureModel(
    profile: SpeciesProfile,
    index: number
  ): {
    landCreatureGroup: THREE.Group;
    landSpeciesName: string;
    landArchetype: 'bipedo_agil' | 'cuadrupedo_robusto' | 'reptiliano_rastreador';
    landLegs: {
      hipGroup: THREE.Group;
      kneeGroup: THREE.Group;
      side: number;
      isRear: boolean;
    }[];
    landArms: THREE.Group[];
    landTailGroup: THREE.Group | null;
    landHeadGroup: THREE.Group | null;
    landLowerJaw: THREE.Object3D | null;
    standingOffset: number;
  } {
    const landCreatureGroup = new THREE.Group();
    const landLegs: {
      hipGroup: THREE.Group;
      kneeGroup: THREE.Group;
      side: number;
      isRear: boolean;
    }[] = [];
    const landArms: THREE.Group[] = [];

    // 1. Choose Archetype & Terrestrial Name based on ecological role and tier
    let landArchetype: 'bipedo_agil' | 'cuadrupedo_robusto' | 'reptiliano_rastreador';
    let landSpeciesName: string;

    if (profile.isHerbivore) {
      if (profile.tier === 3) {
        landArchetype = 'cuadrupedo_robusto';
        landSpeciesName = 'Braquiosaurio Continental';
      } else if (index % 2 === 0) {
        landArchetype = 'cuadrupedo_robusto';
        landSpeciesName =
          profile.tier === 2
            ? 'Herbívoro Acorazado de Pradera'
            : 'Pastador Cuadrúpedo Costero';
      } else {
        landArchetype = 'bipedo_agil';
        landSpeciesName =
          profile.tier === 2
            ? 'Ornitópodo de Cresta Vocal'
            : 'Corredor Herbívoro Bípedo';
      }
    } else if (profile.attitude === 'neutral') {
      landArchetype =
        index % 2 === 0 ? 'cuadrupedo_robusto' : 'reptiliano_rastreador';
      landSpeciesName =
        profile.tier >= 2
          ? 'Estegosaurio Territorial'
          : 'Rastreador de Espinas';
    } else {
      if (profile.tier === 3) {
        landArchetype = index % 2 === 0 ? 'bipedo_agil' : 'cuadrupedo_robusto';
        landSpeciesName =
          landArchetype === 'bipedo_agil'
            ? 'Tirano Alfa Continental'
            : 'Gorgonópsido Colosal';
      } else if (index % 3 === 0) {
        landArchetype = 'reptiliano_rastreador';
        landSpeciesName = 'Varano Cazador de Maleza';
      } else {
        landArchetype = 'bipedo_agil';
        landSpeciesName =
          profile.tier === 2
            ? 'Terópodo Rapaz de Garras'
            : 'Velocirraptor Costero';
      }
    }

    // 2. Terrestrial Skin & Scale Materials (opaque organic skin, dorsal plates, belly & claws)
    const skinHue = profile.isHerbivore
      ? 0.24 + ((index % 5) - 2) * 0.035
      : profile.attitude === 'neutral'
      ? 0.09 + ((index % 4) - 1.5) * 0.025
      : 0.02 + ((index % 5) - 2) * 0.02;
    const skinSat = profile.isHerbivore ? 0.58 : 0.68;
    const skinLight = profile.tier === 3 ? 0.28 : 0.36 + (index % 3) * 0.04;

    const skinColor = new THREE.Color().setHSL(skinHue, skinSat, skinLight);
    const dorsalColor = skinColor.clone().offsetHSL(-0.02, 0.1, -0.12);
    const hornColor = new THREE.Color(profile.isHerbivore ? 0xfef3c7 : 0xfde68a);

    const skinMat = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.72,
      metalness: 0.06,
    });
    const dorsalMat = new THREE.MeshStandardMaterial({
      color: dorsalColor,
      roughness: 0.58,
      metalness: 0.12,
    });
    const hornMat = new THREE.MeshStandardMaterial({
      color: hornColor,
      roughness: 0.35,
      metalness: 0.15,
    });
    this.disposableMaterials.push(skinMat, dorsalMat, hornMat);

    // 3. Build 5-Segment Chained Torso (pecho, abdomen, cuello, cabeza, cola)
    const isBiped = landArchetype === 'bipedo_agil';
    const isQuad = landArchetype === 'cuadrupedo_robusto';
    const standingOffset = isBiped ? 1.15 : isQuad ? 1.05 : 0.72;

    const torsoGroup = new THREE.Group();
    landCreatureGroup.add(torsoGroup);

    // Pecho & Abdomen
    const chestGeo = new THREE.SphereGeometry(0.62, 16, 14);
    const chestMesh = new THREE.Mesh(chestGeo, skinMat);
    chestMesh.castShadow = true;
    chestMesh.receiveShadow = true;
    if (isBiped) {
      chestMesh.position.set(0, 0.18, -0.25);
      chestMesh.scale.set(0.95, 1.08, 1.35);
      chestMesh.rotation.x = -0.28;
    } else if (isQuad) {
      chestMesh.position.set(0, 0.08, -0.38);
      chestMesh.scale.set(1.22, 1.12, 1.45);
    } else {
      chestMesh.position.set(0, -0.05, -0.32);
      chestMesh.scale.set(1.18, 0.72, 1.48);
    }
    this.sharedGeometries.push(chestGeo);
    torsoGroup.add(chestMesh);

    const abdomenGeo = new THREE.SphereGeometry(0.68, 16, 14);
    const abdomenMesh = new THREE.Mesh(abdomenGeo, skinMat);
    abdomenMesh.castShadow = true;
    abdomenMesh.receiveShadow = true;
    if (isBiped) {
      abdomenMesh.position.set(0, 0.02, 0.38);
      abdomenMesh.scale.set(1.05, 1.12, 1.35);
    } else if (isQuad) {
      abdomenMesh.position.set(0, 0.06, 0.42);
      abdomenMesh.scale.set(1.32, 1.18, 1.48);
    } else {
      abdomenMesh.position.set(0, -0.08, 0.42);
      abdomenMesh.scale.set(1.22, 0.68, 1.42);
    }
    this.sharedGeometries.push(abdomenGeo);
    torsoGroup.add(abdomenMesh);

    // Dorsal Osteoderm Plates along the back
    const plateGeo = new THREE.ConeGeometry(0.16, 0.38, 6);
    this.sharedGeometries.push(plateGeo);
    for (let pIdx = 0; pIdx < 4; pIdx++) {
      const plate = new THREE.Mesh(plateGeo, dorsalMat);
      const pz = -0.55 + pIdx * 0.42;
      const py = (isBiped ? 0.68 - pIdx * 0.06 : isQuad ? 0.76 : 0.36);
      plate.position.set(0, py, pz);
      plate.rotation.x = -0.22;
      plate.scale.set(0.85, 1.0 + (profile.tier === 3 ? 0.45 : 0), 1.3);
      torsoGroup.add(plate);
    }

    // Neck & Head Group (facing -Z)
    const neckGeo = new THREE.CylinderGeometry(0.24, 0.36, 0.75, 10);
    this.sharedGeometries.push(neckGeo);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(
      0,
      isBiped ? 0.56 : isQuad ? 0.46 : 0.14,
      isBiped ? -0.72 : -0.92
    );
    neckMesh.rotation.x = isBiped ? 0.52 : isQuad ? 0.68 : 0.95;
    torsoGroup.add(neckMesh);

    const landHeadGroup = new THREE.Group();
    landHeadGroup.position.set(
      0,
      isBiped ? 0.86 : isQuad ? 0.72 : 0.24,
      isBiped ? -1.02 : -1.32
    );
    torsoGroup.add(landHeadGroup);

    const skullGeo = new THREE.SphereGeometry(0.38, 14, 12);
    this.sharedGeometries.push(skullGeo);
    const skullMesh = new THREE.Mesh(skullGeo, skinMat);
    skullMesh.scale.set(0.95, 0.85, 1.42);
    skullMesh.castShadow = true;
    landHeadGroup.add(skullMesh);

    // Snout / Upper Jaw & Articulated Lower Jaw (or Herbivore Beak)
    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, -0.1, -0.18);
    landHeadGroup.add(jawGroup);

    const lowerJawGeo = new THREE.ConeGeometry(0.24, 0.58, 8);
    lowerJawGeo.rotateX(-Math.PI / 2);
    lowerJawGeo.scale(1.0, 0.48, 1.0);
    lowerJawGeo.translate(0, 0, -0.22);
    this.sharedGeometries.push(lowerJawGeo);
    const lowerJawMesh = new THREE.Mesh(
      lowerJawGeo,
      profile.isHerbivore ? hornMat : dorsalMat
    );
    jawGroup.add(lowerJawMesh);

    if (!profile.isHerbivore) {
      // Serrated carnivore fangs on upper & lower jaws
      const fangGeo = new THREE.ConeGeometry(0.055, 0.22, 6);
      this.sharedGeometries.push(fangGeo);
      for (const side of [-1, 1]) {
        const upperFang = new THREE.Mesh(fangGeo, hornMat);
        upperFang.position.set(side * 0.18, -0.12, -0.42);
        upperFang.rotation.x = Math.PI;
        landHeadGroup.add(upperFang);
      }
    } else {
      // Herbivore horns or cranial vocal crest
      const crestGeo = new THREE.ConeGeometry(0.12, 0.52, 8);
      this.sharedGeometries.push(crestGeo);
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(crestGeo, hornMat);
        horn.position.set(side * 0.22, 0.28, -0.05);
        horn.rotation.set(-0.35, 0, side * -0.35);
        landHeadGroup.add(horn);
      }
    }

    // Terrestrial Eyes with Sclera and Pupil
    const eyeScleraGeo = new THREE.SphereGeometry(0.11, 10, 10);
    const eyePupilGeo = new THREE.SphereGeometry(0.06, 8, 8);
    this.sharedGeometries.push(eyeScleraGeo, eyePupilGeo);
    for (const side of [-1, 1]) {
      const sclera = new THREE.Mesh(eyeScleraGeo, this.eyeScleraMat);
      sclera.position.set(
        side * (profile.isHerbivore ? 0.31 : 0.24),
        0.1,
        -0.24
      );
      landHeadGroup.add(sclera);

      const pupil = new THREE.Mesh(eyePupilGeo, this.eyePupilMat);
      pupil.position.set(
        side * (profile.isHerbivore ? 0.36 : 0.27),
        0.1,
        -0.31
      );
      landHeadGroup.add(pupil);
    }

    // 4. Articulated Tail Group (+Z)
    const landTailGroup = new THREE.Group();
    landTailGroup.position.set(0, isBiped ? 0.05 : -0.04, 0.88);
    torsoGroup.add(landTailGroup);

    const tailBaseGeo = new THREE.ConeGeometry(0.34, 1.45, 10);
    tailBaseGeo.rotateX(Math.PI / 2);
    tailBaseGeo.translate(0, 0, 0.68);
    this.sharedGeometries.push(tailBaseGeo);
    const tailMesh = new THREE.Mesh(tailBaseGeo, skinMat);
    tailMesh.castShadow = true;
    landTailGroup.add(tailMesh);

    if (profile.tier >= 2) {
      const tailClubGeo = new THREE.DodecahedronGeometry(0.26, 1);
      this.sharedGeometries.push(tailClubGeo);
      const tailClub = new THREE.Mesh(tailClubGeo, dorsalMat);
      tailClub.position.set(0, 0, 1.38);
      tailClub.scale.set(1.2, 0.75, 1.3);
      landTailGroup.add(tailClub);
    }

    // 5. Articulated Legs & Three-Toed Terrestrial Feet resting at Y = -standingOffset
    const thighLen = isBiped ? 0.58 : isQuad ? 0.52 : 0.38;
    const shinLen = isBiped ? 0.58 : isQuad ? 0.52 : 0.36;
    const thighGeo = new THREE.CylinderGeometry(0.18, 0.14, thighLen, 9);
    thighGeo.translate(0, -thighLen * 0.5, 0);
    const shinGeo = new THREE.CylinderGeometry(0.13, 0.1, shinLen, 9);
    shinGeo.translate(0, -shinLen * 0.5, 0);
    const footGeo = new THREE.BoxGeometry(0.32, 0.14, 0.48);
    footGeo.translate(0, -0.05, -0.1);
    const clawGeo = new THREE.ConeGeometry(0.05, 0.18, 5);
    clawGeo.rotateX(-Math.PI / 2);
    this.sharedGeometries.push(thighGeo, shinGeo, footGeo, clawGeo);

    const legConfigs: { x: number; y: number; z: number; side: number; isRear: boolean }[] =
      isBiped
        ? [
            { x: -0.52, y: 0.02, z: 0.18, side: -1, isRear: true },
            { x: 0.52, y: 0.02, z: 0.18, side: 1, isRear: true },
          ]
        : [
            {
              x: isQuad ? -0.68 : -0.78,
              y: -0.02,
              z: -0.45,
              side: -1,
              isRear: false,
            },
            {
              x: isQuad ? 0.68 : 0.78,
              y: -0.02,
              z: -0.45,
              side: 1,
              isRear: false,
            },
            {
              x: isQuad ? -0.7 : -0.8,
              y: -0.02,
              z: 0.48,
              side: -1,
              isRear: true,
            },
            {
              x: isQuad ? 0.7 : 0.8,
              y: -0.02,
              z: 0.48,
              side: 1,
              isRear: true,
            },
          ];

    for (const cfg of legConfigs) {
      const hipGroup = new THREE.Group();
      hipGroup.position.set(cfg.x, cfg.y, cfg.z);
      if (landArchetype === 'reptiliano_rastreador') {
        hipGroup.rotation.z = cfg.side * 0.26;
      }
      torsoGroup.add(hipGroup);

      const thighMesh = new THREE.Mesh(thighGeo, skinMat);
      thighMesh.castShadow = true;
      thighMesh.rotation.x = isBiped ? -0.22 : -0.12;
      hipGroup.add(thighMesh);

      const kneeGroup = new THREE.Group();
      kneeGroup.position.set(0, -thighLen, 0.06);
      hipGroup.add(kneeGroup);

      const shinMesh = new THREE.Mesh(shinGeo, dorsalMat);
      shinMesh.castShadow = true;
      shinMesh.rotation.x = isBiped ? 0.24 : 0.12;
      kneeGroup.add(shinMesh);

      const footMesh = new THREE.Mesh(footGeo, dorsalMat);
      footMesh.position.set(0, -shinLen, -0.04);
      footMesh.castShadow = true;
      kneeGroup.add(footMesh);

      for (const toeOffset of [-0.1, 0, 0.1]) {
        const claw = new THREE.Mesh(clawGeo, hornMat);
        claw.position.set(toeOffset, -shinLen - 0.06, -0.32);
        kneeGroup.add(claw);
      }

      landLegs.push({
        hipGroup,
        kneeGroup,
        side: cfg.side,
        isRear: cfg.isRear,
      });
    }

    // 6. Articulated Grasping Forelimbs & Claws for Bipeds
    if (isBiped) {
      const armGeo = new THREE.CylinderGeometry(0.11, 0.08, 0.52, 8);
      armGeo.translate(0, -0.26, 0);
      this.sharedGeometries.push(armGeo);

      for (const side of [-1, 1]) {
        const armGroup = new THREE.Group();
        armGroup.position.set(side * 0.48, 0.22, -0.52);
        armGroup.rotation.set(0.55, 0, side * 0.22);
        torsoGroup.add(armGroup);

        const armMesh = new THREE.Mesh(armGeo, skinMat);
        armMesh.castShadow = true;
        armGroup.add(armMesh);

        for (const cOff of [-0.05, 0.05]) {
          const talon = new THREE.Mesh(clawGeo, hornMat);
          talon.position.set(cOff, -0.52, -0.1);
          armGroup.add(talon);
        }

        landArms.push(armGroup);
      }
    }

    return {
      landCreatureGroup,
      landSpeciesName,
      landArchetype,
      landLegs,
      landArms,
      landTailGroup,
      landHeadGroup,
      landLowerJaw: jawGroup,
      standingOffset,
    };
  }

  /**
   * Animates internal nucleus/organelles, articulated flagella waves proportional to real velocity,
   * vibrating oral/lateral cilia, bioelectric arcs, AND terrestrial walk-cycle (legs, arms, tail, head/jaw).
   */
  private animateBiologicalAnatomy(
    p: OrganismEntity,
    elapsedTime: number,
    safeDelta: number,
    poisonSpeedFactor: number
  ): void {
    const isLand = this.currentStage === 'creature_stage';

    // Advance phase strictly proportional to the organism's real movement velocity
    const speedRatio = Math.min(2.4, Math.max(0.15, p.currentSpeed / 4.2));
    const phaseRate = (3.2 + speedRatio * 7.8) * poisonSpeedFactor;
    p.swimPhase = (p.swimPhase + safeDelta * phaseRate) % (Math.PI * 200);

    if (isLand) {
      // Terrestrial Walk-Cycle Animation (Bipedal or Quadrupedal gait + tail counterbalance + snapping jaw)
      const isMoving = p.currentSpeed > 0.15;
      const strideAmp = isMoving
        ? Math.min(0.68, 0.24 + speedRatio * 0.28)
        : 0.04;
      const walkPhase = p.swimPhase * 0.95;

      for (let l = 0; l < p.landLegs.length; l++) {
        const leg = p.landLegs[l];
        const phaseOffset =
           (leg.side > 0 ? Math.PI : 0) + (leg.isRear ? Math.PI * 0.5 : 0);
        const swing = Math.sin(walkPhase + phaseOffset) * strideAmp;
        const kneeLift = Math.max(0, -Math.cos(walkPhase + phaseOffset)) * strideAmp * 0.85;
        leg.hipGroup.rotation.x = swing;
        leg.kneeGroup.rotation.x = kneeLift;
      }

      for (let a = 0; a < p.landArms.length; a++) {
        const arm = p.landArms[a];
        const sideSign = a === 0 ? -1 : 1;
        const slash =
          p.lungeTimer > 0
            ? -0.75
            : Math.sin(walkPhase + (sideSign > 0 ? 0 : Math.PI)) * 0.24;
        arm.rotation.x = 0.55 + slash;
      }

      if (p.landTailGroup) {
        p.landTailGroup.rotation.y =
          Math.sin(walkPhase * 0.75) * (isMoving ? 0.28 : 0.12);
        p.landTailGroup.rotation.x =
          Math.cos(walkPhase * 1.5) * 0.06;
      }

      if (p.landHeadGroup) {
        p.landHeadGroup.rotation.x =
          Math.sin(walkPhase * 1.5) * (isMoving ? 0.08 : 0.04);
        p.landHeadGroup.rotation.y =
          Math.cos(elapsedTime * 1.8 + p.id) * 0.12;
      }

      if (p.landLowerJaw) {
        const jawOpen =
          p.lungeTimer > 0
            ? 0.55
            : p.state === 'PERSEGUIR' || p.state === 'ATACAR'
            ? 0.22 + Math.abs(Math.sin(elapsedTime * 9.0 + p.id)) * 0.22
            : Math.max(0, Math.sin(elapsedTime * 2.4 + p.id)) * 0.08;
        p.landLowerJaw.rotation.x = jawOpen;
      }
      return;
    }

    // 1. Pulsating bioluminescent nucleus & internal organelles (Cell Stage)
    const pulse = 1.0 + Math.sin(elapsedTime * 3.8 + p.id * 1.3) * 0.11;
    if (p.coreMesh) {
      p.coreMesh.scale.setScalar(pulse);
      p.coreMesh.rotation.y += safeDelta * 0.85;
      p.coreMesh.rotation.z = Math.sin(elapsedTime * 2.1 + p.id) * 0.22;
    }
    for (let o = 0; o < p.organelleMeshes.length; o++) {
      const org = p.organelleMeshes[o];
      const orgPulse = 0.85 + Math.sin(elapsedTime * 4.4 + p.id + o * 1.7) * 0.1;
      org.scale.setScalar(orgPulse);
      org.rotation.x += safeDelta * 0.6;
    }

    // 2. Bioelectric combat arcs (visible when chasing/attacking)
    const showArcs = p.state === 'PERSEGUIR' || p.state === 'ATACAR';
    for (let a = 0; a < p.electricArcMeshes.length; a++) {
      const arc = p.electricArcMeshes[a];
      arc.visible = showArcs;
      if (showArcs) {
        arc.rotation.x += safeDelta * (7.5 + a * 2.2);
        arc.rotation.y -= safeDelta * (6.2 + a * 1.8);
        const flicker = 0.92 + Math.sin(elapsedTime * 28.0 + a * 2.1) * 0.18;
        arc.scale.setScalar(flicker);
      }
    }

    // 3. Biological Rule: Sessile organisms without flagella/cilia do not self-propel in cell_stage
    if (p.isSessile) {
      p.currentSpeed = 0;
      const swayX = Math.sin(elapsedTime * 1.65 + p.id * 0.9) * 0.085;
      const swayZ = Math.cos(elapsedTime * 1.35 + p.id * 1.2) * 0.085;
      p.group.rotation.set(swayX, p.headingAngle, swayZ);
      return;
    }

    // 5. Propagate sinusoidal travelling wave along each articulated flagellum chain
    for (let f = 0; f < p.flagellaChains.length; f++) {
      const chain = p.flagellaChains[f];
      const segs = chain.segments;
      const ampScale = Math.min(1.75, 0.35 + speedRatio * 0.85);
      for (let s = 0; s < segs.length; s++) {
        const seg = segs[s];
        const waveArg = p.swimPhase - s * 0.85 + chain.phaseOffset;
        const lateralWave =
          Math.sin(waveArg) * chain.amplitude * ampScale * (1 + s * 0.38);
        const verticalWave =
          Math.cos(waveArg * 0.5) * chain.amplitude * 0.28 * (1 + s * 0.2);
        seg.position.x =
          chain.baseX +
          Math.sin(chain.baseYaw) * (s * chain.segmentSpacing) +
          lateralWave;
        seg.position.y = chain.baseY + verticalWave;
        seg.rotation.y =
          chain.baseYaw + Math.cos(waveArg) * 0.28 * ampScale;
      }
    }

    // 6. Vibrate oral & lateral cilia proportional to real speed
    for (let c = 0; c < p.ciliaMeshes.length; c++) {
      const entry = p.ciliaMeshes[c];
      const flutter = Math.sin(p.swimPhase * 1.45 + entry.phase);
      entry.mesh.rotation.z = entry.baseRotZ + flutter * 0.34 * entry.side;
      entry.mesh.rotation.y =
        entry.baseRotY + Math.cos(p.swimPhase * 1.45 + entry.phase) * 0.24;
    }
  }

  public setStageMode(stage: EvolutionaryStage): void {
    const stageChanged = this.currentStage !== stage;
    this.currentStage = stage;
    const isLand = stage === 'creature_stage';
    for (let i = 0; i < this.organisms.length; i++) {
      const entity = this.organisms[i];
      entity.cellBodyGroup.visible = !isLand;
      entity.landCreatureGroup.visible = isLand;
      entity.legsGroup.visible = false;
      entity.speciesName = isLand
        ? entity.landSpeciesName
        : entity.profile.name;
      this.telemetryCache[i].speciesName = entity.speciesName;
      entity.verticalVelocity = 0;

      if (stageChanged) {
        this.spawnOrganismAtSafeRadius(entity, i);
      } else {
        entity.position.y = isLand
          ? getLandHeightAt(entity.position.x, entity.position.z) +
            entity.standingOffset * entity.profile.scaleMultiplier
          : GAME_CONFIG.WORLD.SWIM_PLANE_Y;
      }
    }
    for (const kin of this.kinCells) {
      kin.mesh.visible = !isLand && this.isEcosystemCurrentlyVisible;
    }
  }


  private pickWanderTarget(entity: OrganismEntity): void {
    if (this.currentStage === 'creature_stage') {
      // Patrol in a pack around the assigned rival nest or across emergent continental land (y > 0.8)
      const nest = this.getRivalNestCenter(entity.packNestIndex);
      for (let attempt = 0; attempt < 8; attempt++) {
        const roamRadius = 12 + Math.random() * 48;
        const roamAngle = Math.random() * Math.PI * 2;
        const wx = nest.x + Math.cos(roamAngle) * roamRadius;
        const wz = nest.z + Math.sin(roamAngle) * roamRadius;
        const distFromOrigin = Math.hypot(wx, wz);
        const wy = getLandHeightAt(wx, wz);
        if (
          distFromOrigin > 38 &&
          distFromOrigin < CONTINENT_CONFIG.CONTINENT_RADIUS - 80 &&
          wy > 0.65
        ) {
          entity.wanderTarget.set(
            wx,
            wy + entity.standingOffset * entity.profile.scaleMultiplier,
            wz
          );
          entity.wanderRetargetTimer = 4.0 + Math.random() * 4.5;
          return;
        }
      }
      entity.wanderTarget.set(
        nest.x,
        nest.y + entity.standingOffset * entity.profile.scaleMultiplier,
        nest.z
      );
      entity.wanderRetargetTimer = 4.0 + Math.random() * 4.5;
      return;
    }

    const minR = entity.profile.tier === 1 ? 10 : entity.profile.tier === 2 ? 22 : 36;
    const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 14;
    const r = minR + Math.random() * (maxR - minR);
    const angle = Math.random() * Math.PI * 2;
    const wx = Math.cos(angle) * r;
    const wz = Math.sin(angle) * r;
    entity.wanderTarget.set(wx, GAME_CONFIG.WORLD.SWIM_PLANE_Y, wz);
    entity.wanderRetargetTimer = 4.0 + Math.random() * 4.5;
  }

  private spawnOrganismAtSafeRadius(
    entity: OrganismEntity,
    index: number
  ): void {
    const total = this.organisms.length;
    let sx = 0;
    let sz = 0;
    let angle = (index / total) * Math.PI * 2 + Math.random() * 0.5;

    if (this.currentStage === 'creature_stage') {
      // Spawn in packs of 3-5 terrestrial creatures around secondary rival nests on solid emergent land
      const nest = this.getRivalNestCenter(entity.packNestIndex);
      const memberOffsetAngle = ((index % 5) / 5) * Math.PI * 2 + Math.random() * 0.4;
      const memberDist = 5.5 + (index % 4) * 3.8;
      sx = nest.x + Math.cos(memberOffsetAngle) * memberDist;
      sz = nest.z + Math.sin(memberOffsetAngle) * memberDist;
      if (getLandHeightAt(sx, sz) < 0.65) {
        sx = nest.x;
        sz = nest.z;
      }
      angle = memberOffsetAngle;
    } else {
      // Distribute Tiers across the expanded 320m arena: Tier 1 inner/mid, Tier 2 mid/outer, Tier 3 colossi in deep outer reefs
      const minDist =
        entity.profile.tier === 1
          ? 18.0
          : entity.profile.tier === 2
          ? 38.0
          : 75.0;
      const maxExtra =
        entity.profile.tier === 1
          ? 125.0
          : entity.profile.tier === 2
          ? 195.0
          : 225.0;
      const radius = Math.min(
        GAME_CONFIG.WORLD.ARENA_RADIUS - 14,
        minDist + ((index * 23) % maxExtra) + Math.random() * 18
      );
      sx = Math.cos(angle) * radius;
      sz = Math.sin(angle) * radius;
    }

    const spawnFloorY =
      this.currentStage === 'creature_stage'
        ? getLandHeightAt(sx, sz) +
          entity.standingOffset * entity.profile.scaleMultiplier
        : GAME_CONFIG.WORLD.SWIM_PLANE_Y;

    entity.position.set(sx, spawnFloorY, sz);
    entity.verticalVelocity = 0;
    entity.headingAngle = angle + Math.PI / 2;
    this.resolveEntityObstacleCollisions(
      entity,
      entity.profile.scaleMultiplier,
      0.016
    );
    entity.currentSpeed = entity.profile.wanderSpeed;
    entity.state = 'DEAMBULAR';
    entity.active = true;
    entity.respawnTimer = 0;
    entity.stunTimer = 0;
    entity.poisonTimer = 0;
    entity.poisonTickTimer = 0;
    entity.provokedTimer = 0;
    entity.socialCooldown = 0;
    entity.health = entity.maxHealth;
    entity.combatRevealTimer = 0;
    entity.hitFlashTimer = 0;
    entity.biteImmunityTimer = 0;
    entity.dyingTimer = 0;
    entity.dyingKilledByPlayer = false;
    entity.knockbackVelocity.set(0, 0, 0);
    entity.healthRingMesh.visible = false;
    entity.healthRingMat.uniforms.uHealthRatio.value = 1.0;
    entity.healthRingMat.uniforms.uOpacity.value = 0.0;
    entity.group.visible = true;
    entity.attackCooldown = 0;
    entity.lungeTimer = 0;
    this.pickWanderTarget(entity);
    entity.group.rotation.set(0, entity.headingAngle, 0);
  }

  public resetAll(): void {
    this.setStageMode('cell_stage');
    for (let i = 0; i < this.organisms.length; i++) {
      this.spawnOrganismAtSafeRadius(this.organisms[i], i);
    }
    for (const popup of this.floatingDamagePool) {
      popup.active = false;
      popup.sprite.visible = false;
    }
    for (const part of this.deathParticlePool) {
      part.active = false;
      part.mesh.visible = false;
    }
  }

  /**
   * Isolates or restores the entire fauna ecosystem when entering/leaving the 3D Evolution Editor.
   * When `visible === false`, hides all organisms, cancels any active pursuit/attack against the player,
   * and pushes nearby predators to a safe distance so the player can return to the water safely.
   */
  public setEcosystemVisible(
    visible: boolean,
    playerPosition?: THREE.Vector3
  ): void {
    this.isEcosystemCurrentlyVisible = visible;
    if (!visible) {
      for (const popup of this.floatingDamagePool) {
        popup.active = false;
        popup.sprite.visible = false;
      }
      for (const part of this.deathParticlePool) {
        part.active = false;
        part.mesh.visible = false;
      }
    }
    for (const kin of this.kinCells) {
      kin.mesh.visible = visible && this.currentStage === 'cell_stage';
    }
    for (let i = 0; i < this.organisms.length; i++) {
      const p = this.organisms[i];
      p.group.visible = visible && p.active;


      if (!visible && p.active) {
        if (
          p.state === 'PERSEGUIR' ||
          p.state === 'ATACAR' ||
          p.state === 'HUIR'
        ) {
          p.state = 'DEAMBULAR';
        }
        p.lungeTimer = 0;
        p.attackCooldown = Math.max(p.attackCooldown, 2.5);
        p.currentSpeed = p.profile.wanderSpeed * 0.85;

        if (playerPosition) {
          const dx = p.position.x - playerPosition.x;
          const dz = p.position.z - playerPosition.z;
          const distSq = dx * dx + dz * dz;
          const safeRadius = 26.0;
          if (distSq < safeRadius * safeRadius) {
            const angle =
              distSq > 0.01
                ? Math.atan2(dz, dx)
                : (i / this.organisms.length) * Math.PI * 2;
            const pushedDist = safeRadius + 6.0 + (i % 5) * 2.5;
            p.position.x = playerPosition.x + Math.cos(angle) * pushedDist;
            p.position.z = playerPosition.z + Math.sin(angle) * pushedDist;
            const rSq =
              p.position.x * p.position.x + p.position.z * p.position.z;
            const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 6.0;
            if (rSq > maxR * maxR) {
              const r = Math.sqrt(rSq);
              p.position.x = (p.position.x / r) * maxR;
              p.position.z = (p.position.z / r) * maxR;
            }
            p.headingAngle = angle;
            p.group.rotation.set(0, p.headingAngle, 0);
          }
        }
        this.pickWanderTarget(p);
      }
    }
  }

  /**
   * Clears and pushes away any predators around a checkpoint respawn point so the player
   * can safely recover with 3 seconds of invulnerability.
   */
  public clearThreatsAroundRespawn(
    center: THREE.Vector3,
    safeRadius = 28.0
  ): void {
    const safeRadiusSq = safeRadius * safeRadius;
    const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 8.0;

    for (let i = 0; i < this.organisms.length; i++) {
      const p = this.organisms[i];
      if (!p.active) continue;

      p.state = 'DEAMBULAR';
      p.provokedTimer = 0;
      p.lungeTimer = 0;
      p.attackCooldown = Math.max(p.attackCooldown, 3.2);
      p.currentSpeed = p.profile.wanderSpeed * 0.85;

      const dx = p.position.x - center.x;
      const dz = p.position.z - center.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < safeRadiusSq) {
        const angle =
          distSq > 0.01
            ? Math.atan2(dz, dx)
            : (i / this.organisms.length) * Math.PI * 2;
        const pushedDist = safeRadius + 8.0 + (i % 5) * 3.0;
        p.position.x = center.x + Math.cos(angle) * pushedDist;
        p.position.z = center.z + Math.sin(angle) * pushedDist;

        const rSq = p.position.x * p.position.x + p.position.z * p.position.z;
        if (rSq > maxR * maxR) {
          const r = Math.sqrt(rSq);
          p.position.x = (p.position.x / r) * maxR;
          p.position.z = (p.position.z / r) * maxR;
        }
        p.headingAngle = angle;
        p.group.rotation.set(0, p.headingAngle, 0);
        this.pickWanderTarget(p);
      }
    }
  }

  /**
   * Computes a locomotion speed multiplier based on whether the organism explicitly possesses
   * locomotor adaptations (flagella, jet nozzles, cilia, ribbon fins).
   * Organisms without speed organs swim slower so speed feels genuinely earned by morphology.
   */
  private getLocomotionSpeedMultiplier(entity: OrganismEntity): number {
    const traits = entity.geneticTraits;
    const hasHighPropulsion = traits.some(
      (t) =>
        t === 'movement_reactive_nozzle' ||
        t === 'movement_whip_flagella' ||
        t === 'hydro_siphon'
    );
    if (hasHighPropulsion) {
      return 1.12;
    }
    const hasCiliaOrFins = traits.some(
      (t) =>
        t === 'cilia_waves' ||
        t === 'movement_ribbon_fin' ||
        t === 'movement_macro_cilia_skirt' ||
        t === 'simple_flagellum'
    );
    if (hasCiliaOrFins) {
      return 1.02;
    }
    // No explicit locomotor organ installed -> reduced speed (~14% slower on top of rebalanced profile)
    return 0.86;
  }

  public findAutoAimTarget(
    playerPosition: THREE.Vector3,
    headingAngle: number,
    maxRange = 24.0
  ): THREE.Vector3 | null {
    const forwardX = -Math.sin(headingAngle);
    const forwardZ = -Math.cos(headingAngle);

    let bestTarget: THREE.Vector3 | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < this.organisms.length; i++) {
      const p = this.organisms[i];
      if (!p.active) continue;

      const dx = p.position.x - playerPosition.x;
      const dz = p.position.z - playerPosition.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.5 || dist > maxRange) continue;

      const dirX = dx / dist;
      const dirZ = dz / dist;
      const dot = forwardX * dirX + forwardZ * dirZ;
      if (dot >= 0.25) {
        const priorityWeight = p.profile.isHerbivore ? 1.15 : 0.85;
        const score = dist * priorityWeight * (2.0 - dot);
        if (score < bestScore) {
          bestScore = score;
          bestTarget = p.position;
        }
      }
    }

    return bestTarget;
  }

  /**
   * Computes the Spore Depth Plane Staging relative scale & swim plane Y for an organism
   * based on its Tier (1, 2, 3) and the player's current 5-stage `growthStage` (1..5).
   */
  private getTieredScaleAndDepth(entity: OrganismEntity): {
    effectiveScale: number;
    depthOffsetY: number;
  } {
    const base = entity.profile.scaleMultiplier;
    const tier = entity.profile.tier;
    const pStage = this.playerGrowthStage;

    if (pStage === 1) {
      if (tier === 1) return { effectiveScale: base, depthOffsetY: 0 };
      if (tier === 2) return { effectiveScale: base * 1.12, depthOffsetY: -0.3 };
      return { effectiveScale: base * 1.28, depthOffsetY: -1.1 };
    }

    if (pStage === 2) {
      // Stage 2: Tier 1 micro-cells shrink relative to the Stage 2 player
      if (tier === 1) return { effectiveScale: base * 0.76, depthOffsetY: -0.2 };
      if (tier === 2) return { effectiveScale: base * 1.0, depthOffsetY: 0 };
      return { effectiveScale: base * 1.18, depthOffsetY: -0.55 };
    }

    if (pStage === 3) {
      // Stage 3 (Complejo Pluricelular): Tier 1 cells shrink to minor prey; Tier 2 rivals dominate
      if (tier === 1) return { effectiveScale: base * 0.58, depthOffsetY: -0.35 };
      if (tier === 2) return { effectiveScale: base * 0.92, depthOffsetY: 0 };
      return { effectiveScale: base * 1.08, depthOffsetY: -0.2 };
    }

    if (pStage === 4) {
      // Stage 4 (Macro-Célula Dominante): Tier 3 apex rivals rise to the main swim plane
      if (tier === 1) return { effectiveScale: base * 0.46, depthOffsetY: -0.45 };
      if (tier === 2) return { effectiveScale: base * 0.76, depthOffsetY: -0.15 };
      return { effectiveScale: base * 1.02, depthOffsetY: 0 };
    }

    // Stage 5 (Leviatán Celular / Pre-Terrestre): Player towers over Tier 1 & 2; apex colossi battle at scale
    if (tier === 1) return { effectiveScale: base * 0.38, depthOffsetY: -0.55 };
    if (tier === 2) return { effectiveScale: base * 0.64, depthOffsetY: -0.25 };
    return { effectiveScale: base * 1.12, depthOffsetY: 0 };
  }

  public onCreatureKilled(
    deadCreature: OrganismEntity,
    killedByPlayer: boolean,
    onCellKilled?: (
      position: THREE.Vector3,
      geneticTraits: string[],
      speciesName: string,
      killedByPlayer: boolean,
      creatureTier: number,
      meatDropCount: number
    ) => void
  ): void {
    const isLand = this.currentStage === 'creature_stage';
    deadCreature.dyingTimer = isLand ? 0.55 : 0.25;
    deadCreature.dyingKilledByPlayer = killedByPlayer;
    deadCreature.healthRingMesh.visible = false;
    if (killedByPlayer) {
      audioManager.playCreatureDeath();
    }
    this.spawnDeathMicroSpheres(
      deadCreature.position,
      deadCreature.profile.isHerbivore,
      deadCreature.profile.scaleMultiplier
    );

    // Generar entre 2 y 4 filetes de carne fresca en el lugar del cadáver
    const meatDropCount = isLand
      ? 2 + Math.floor(Math.random() * 3)
      : 1 + Math.floor(Math.random() * 3);

    if (onCellKilled) {
      onCellKilled(
        deadCreature.position,
        deadCreature.geneticTraits,
        deadCreature.speciesName,
        killedByPlayer,
        deadCreature.profile.tier,
        meatDropCount
      );
    }
  }

  private applyOrganismDamage(
    p: OrganismEntity,
    damage: number,
    knockbackDirX: number,
    knockbackDirZ: number,
    knockbackStrength: number,
    killedByPlayer: boolean,
    onCellKilled?: (
      position: THREE.Vector3,
      geneticTraits: string[],
      speciesName: string,
      killedByPlayer: boolean,
      creatureTier: number,
      meatDropCount: number
    ) => void,
    isCritical = false
  ): boolean {
    if (p.dyingTimer > 0 || !p.active) return false;

    const actualDamage = Math.max(1, Math.round(damage));
    p.health = Math.max(0, p.health - actualDamage);
    p.combatRevealTimer = 5.0; // Keep circular health bar visible for 5s of combat
    p.hitFlashTimer = 0.22;
    p.biteImmunityTimer = 0.36;

    // Spawn 3D Floating Damage Number at impact coordinate
    this.spawnFloatingDamageNumber(
      p.position,
      actualDamage,
      isCritical ? 'critical_hit' : 'enemy_hit'
    );

    // Physical knockback vector pushing hit organism back ~2.5m-4.0m and braking its speed
    p.currentSpeed *= 0.15;
    p.knockbackVelocity.set(
      knockbackDirX * knockbackStrength,
      0,
      knockbackDirZ * knockbackStrength
    );

    if (killedByPlayer) {
      audioManager.playBiteAttack();
      if (p.profile.attitude === 'herbivore' && p.health > 0) {
        p.state = 'HUIR';
      } else if (p.profile.attitude === 'neutral' && p.health > 0) {
        p.provokedTimer = 14.0;
        p.state = 'PERSEGUIR';
      }
    }

    if (p.health <= 0) {
      this.onCreatureKilled(p, killedByPlayer, onCellKilled);
      return true;
    }

    return false;
  }

  public update(
    delta: number,
    elapsedTime: number,
    playerPosition: THREE.Vector3,
    canCounterAttack = false,
    canPredateHerbivores = false,
    hasProboscis = false,
    onCellKilled?: (
      position: THREE.Vector3,
      geneticTraits: string[],
      speciesName: string,
      killedByPlayer: boolean,
      creatureTier: number,
      meatDropCount: number
    ) => void,
    activePoisonClouds: readonly PoisonCloudHazard[] = [],
    electricPulseTriggered = false,
    electricPulseRadius = 9.5,
    canDevourWeakenedHunters = false,
    socializeTriggered = false,
    activeAcidProjectiles: readonly PooledAcidProjectile[] = [],
    hasVocalCrest = false,
    canHuntWithGraspingArms = false,
    isPlayerAirborne = false,
    discoveredIds?: ReadonlySet<string>,
    chitinSpikeStacks = 0,
    playerHeadingAngle = 0,
    playerAttackPower = 15,
    isPlayerBoosting = false
  ): {
    totalDamageDealt: number;
    attackerPosition: THREE.Vector3 | null;
    attackerSpeciesName: string | null;
    playerBounceTargetPosition: THREE.Vector3 | null;
    repelledHunters: number;
    repelledLeviathans: number;
    leviathanBonusAdn: number;
    proboscisDrainedAdn: number;
    herbivoresHunted: number;
    herbivoreAdnGained: number;
    herbivoreEnergyGained: number;
    huntersDevoured: number;
    hunterAdnGained: number;
    hunterEnergyGained: number;
    predatorKilledHerbivoreCount: number;
    blockedHerbivoreHunt: boolean;
    poisonedCount: number;
    stunnedPredatorsCount: number;
    electrocutedHerbivoresCount: number;
    electrocutedAdnGained: number;
    socializedCount: number;
    socialAdnGained: number;
    acidHitsPredatorCount: number;
    acidHitAdnGained: number;
    telemetry: PredatorTelemetry[];
    nearestSpeciesName: string;
    nearestState: PredatorBehaviorState;
    nearestDistance: number;
    nearestHasUncataloguedGene: boolean;
  } {
    const safeDelta = Math.min(Math.max(delta, 0.001), 0.05);

    let totalDamageDealt = 0;
    let attackerPosition: THREE.Vector3 | null = null;
    let attackerSpeciesName: string | null = null;
    let playerBounceTargetPosition: THREE.Vector3 | null = null;
    let repelledHunters = 0;
    let repelledLeviathans = 0;
    let leviathanBonusAdn = 0;
    let proboscisDrainedAdn = 0;
    let herbivoresHunted = 0;
    let herbivoreAdnGained = 0;
    let herbivoreEnergyGained = 0;
    let huntersDevoured = 0;
    let hunterAdnGained = 0;
    let hunterEnergyGained = 0;
    let predatorKilledHerbivoreCount = 0;
    let blockedHerbivoreHunt = false;
    let poisonedCount = 0;
    let stunnedPredatorsCount = 0;
    let electrocutedHerbivoresCount = 0;
    let electrocutedAdnGained = 0;
    let socializedCount = 0;
    let socialAdnGained = 0;
    let acidHitsPredatorCount = 0;
    let acidHitAdnGained = 0;

    let nearestDistance = Infinity;
    let nearestState: PredatorBehaviorState = 'DEAMBULAR';
    let nearestSpeciesName = 'Mandíbula Rápida';
    let nearestHasUncataloguedGene = false;

    // 0. Update Floating 3D Damage Popups (rise on +Y and fade over 0.8s)
    for (let d = 0; d < this.floatingDamagePool.length; d++) {
      const popup = this.floatingDamagePool[d];
      if (!popup.active) continue;
      popup.life -= safeDelta;
      if (popup.life <= 0) {
        popup.active = false;
        popup.sprite.visible = false;
        continue;
      }
      const progress = 1 - popup.life / popup.maxLife;
      popup.sprite.position.y += popup.velocityY * safeDelta;
      popup.material.opacity = Math.pow(1 - progress, 1.35);
    }

    // 0B. Update Bioluminescent Death Rupture Micro-Spheres
    for (let k = 0; k < this.deathParticlePool.length; k++) {
      const part = this.deathParticlePool[k];
      if (!part.active) continue;
      part.life -= safeDelta;
      if (part.life <= 0) {
        part.active = false;
        part.mesh.visible = false;
        continue;
      }
      const progress = 1 - part.life / part.maxLife;
      part.mesh.position.addScaledVector(part.velocity, safeDelta);
      part.velocity.multiplyScalar(Math.max(0, 1 - safeDelta * 3.8));
      part.mat.opacity = (1 - progress) * 0.92;
      part.mesh.scale.setScalar((1 - progress * 0.65) * 0.9);
    }

    // 0C. Update Conspecific Kin Cells (Población Viva de Congéneres Idénticos en cell_stage)
    this.updateKinCells(safeDelta, elapsedTime, playerPosition);

    // Populate the 32m SpatialHashGrid with all living active organisms for O(1) neighbor lookups
    this.spatialGrid.clear();
    for (let i = 0; i < this.organisms.length; i++) {
      const org = this.organisms[i];
      if (org.active && org.dyingTimer <= 0) {
        this.spatialGrid.insert(org, org.position.x, org.position.z);
      }
    }

    const playerForwardX = -Math.sin(playerHeadingAngle);
    const playerForwardZ = -Math.cos(playerHeadingAngle);


    for (let i = 0; i < this.organisms.length; i++) {
      const p = this.organisms[i];

      if (!p.active) {
        p.respawnTimer -= safeDelta;
        if (p.respawnTimer <= 0) {
          this.spawnOrganismAtSafeRadius(p, i);
        } else {
          this.telemetryCache[i].distanceToPlayer = 999;
          continue;
        }
      }

      const { effectiveScale, depthOffsetY } = this.getTieredScaleAndDepth(p);

      // Handle Death Animation (Ragdoll topple on land vs Swelling rupture in water)
      if (p.dyingTimer > 0) {
        const totalDeathDuration =
          this.currentStage === 'creature_stage' ? 0.55 : 0.25;
        p.dyingTimer = Math.max(0, p.dyingTimer - safeDelta);
        const deathProgress = 1.0 - p.dyingTimer / totalDeathDuration;

        if (this.currentStage === 'creature_stage') {
          // Ragdoll / abatimiento lateral sobre el terreno
          const groundY = getLandHeightAt(p.position.x, p.position.z);
          p.position.y = THREE.MathUtils.lerp(
            p.position.y,
            groundY + 0.25,
            safeDelta * 8.0
          );
          p.group.rotation.z = deathProgress * (Math.PI * 0.48);
          p.group.scale.setScalar(
            effectiveScale * (1.0 - deathProgress * 0.25)
          );
        } else {
          const swellScale = effectiveScale * (1.0 + deathProgress * 0.42);
          p.group.scale.setScalar(swellScale);
        }

        p.stateRingMat.color.setHex(0xffffff);
        p.stateRingMat.opacity = (1.0 - deathProgress) * 0.95;
        p.coreMat.emissive.setHex(0xffffff);
        p.coreMat.emissiveIntensity = 3.2;

        if (p.dyingTimer <= 0) {
          p.active = false;
          p.group.visible = false;
          p.group.rotation.z = 0;
          p.respawnTimer = 7.5;
          p.coreMat.emissive.setHex(p.profile.isHerbivore ? 0x10b981 : 0xf43f5e);
        }
        continue;
      }

      if (p.attackCooldown > 0) {
        p.attackCooldown = Math.max(0, p.attackCooldown - safeDelta);
      }
      if (p.lungeTimer > 0) {
        p.lungeTimer = Math.max(0, p.lungeTimer - safeDelta);
      }
      if (p.poisonTimer > 0) {
        p.poisonTimer = Math.max(0, p.poisonTimer - safeDelta);
      }
      if (p.socialCooldown > 0) {
        p.socialCooldown = Math.max(0, p.socialCooldown - safeDelta);
      }
      if (p.biteImmunityTimer > 0) {
        p.biteImmunityTimer = Math.max(0, p.biteImmunityTimer - safeDelta);
      }
      if (p.hitFlashTimer > 0) {
        p.hitFlashTimer = Math.max(0, p.hitFlashTimer - safeDelta);
      }
      if (p.combatRevealTimer > 0) {
        p.combatRevealTimer = Math.max(0, p.combatRevealTimer - safeDelta);
      }
      if (p.provokedTimer > 0) {
        p.provokedTimer = Math.max(0, p.provokedTimer - safeDelta);
      }

      // Apply physical knockback displacement with water damping
      if (p.knockbackVelocity.lengthSq() > 0.01) {
        p.position.addScaledVector(p.knockbackVelocity, safeDelta);
        p.knockbackVelocity.x = THREE.MathUtils.damp(
          p.knockbackVelocity.x,
          0,
          5.2,
          safeDelta
        );
        p.knockbackVelocity.z = THREE.MathUtils.damp(
          p.knockbackVelocity.z,
          0,
          5.2,
          safeDelta
        );
      }

      // Apply Spore Depth Plane Staging scale & depth offset
      p.group.scale.setScalar(effectiveScale);

      // Update 3D Circular Health Bar Ring (only visible when damaged or in active combat, hides after 5s of calm)
      if (p.combatRevealTimer > 0 && p.health < p.maxHealth) {
        p.healthRingMesh.visible = true;
        const targetRatio = THREE.MathUtils.clamp(
          p.health / p.maxHealth,
          0,
          1
        );
        p.healthRingMat.uniforms.uHealthRatio.value = THREE.MathUtils.damp(
          p.healthRingMat.uniforms.uHealthRatio.value,
          targetRatio,
          14.0,
          safeDelta
        );
        const fadeOut = Math.min(1.0, p.combatRevealTimer / 0.8);
        p.healthRingMat.uniforms.uOpacity.value = fadeOut;
        p.healthRingMat.uniforms.uFlash.value = p.hitFlashTimer / 0.22;
        // Keep ring oriented cleanly despite group Y rotation
        p.healthRingMesh.rotation.y = -p.headingAngle;
      } else {
        p.healthRingMesh.visible = false;
      }

      const dxToPlayer = playerPosition.x - p.position.x;
      const dzToPlayer = playerPosition.z - p.position.z;
      const distToPlayer = Math.sqrt(
        dxToPlayer * dxToPlayer + dzToPlayer * dzToPlayer
      );

      // Check if this organism carries any uncatalogued adaptation for HUD telemetry
      const carriesUncatalogued = discoveredIds
        ? p.geneticTraits.some((traitId) => !discoveredIds.has(traitId))
        : false;

      // Animate attached 3D organs when within visible camera frustum range (< 95m)
      if (distToPlayer <= 95) {
        for (let o = 0; o < p.attachedOrgans.length; o++) {
          p.attachedOrgans[o].animate(elapsedTime, 0.65, p.state !== 'DEAMBULAR');
        }
      }

      // --- 0A-0. ACID SPIT 3D PROJECTILE IMPACT CHECK ---
      let killedByAcid = false;
      for (let a = 0; a < activeAcidProjectiles.length; a++) {
        const proj = activeAcidProjectiles[a];
        if (!proj.active) continue;
        const dxProj = p.position.x - proj.position.x;
        const dzProj = p.position.z - proj.position.z;
        const distProj = Math.sqrt(dxProj * dxProj + dzProj * dzProj);
        const hitRadius =
          proj.radius + (p.profile.tier === 3 ? 2.15 : 1.55);

        if (distProj <= hitRadius) {
          proj.active = false;
          proj.mesh.visible = false;
          p.poisonTimer = 4.0;
          poisonedCount++;

          const vLen = Math.sqrt(
            proj.velocity.x * proj.velocity.x +
              proj.velocity.z * proj.velocity.z
          );
          const pushX = vLen > 0.01 ? proj.velocity.x / vLen : 1;
          const pushZ = vLen > 0.01 ? proj.velocity.z / vLen : 0;

          const acidDamage = Math.max(24, playerAttackPower * 1.45);
          const died = this.applyOrganismDamage(
            p,
            acidDamage,
            pushX,
            pushZ,
            16.5,
            true,
            onCellKilled,
            true
          );

          if (died) {
            if (p.profile.isHerbivore) {
              herbivoresHunted++;
              herbivoreAdnGained += 18;
              herbivoreEnergyGained += 30;
            } else {
              huntersDevoured++;
              hunterAdnGained += 25;
              hunterEnergyGained += 35;
            }
            killedByAcid = true;
            break;
          } else {
            p.headingAngle = Math.atan2(-pushX, -pushZ);
            p.state = 'DEAMBULAR';
            p.attackCooldown = 2.4;
            p.lungeTimer = 0;
            p.wanderTarget.set(
              p.position.x + pushX * 26,
              GAME_CONFIG.WORLD.SWIM_PLANE_Y,
              p.position.z + pushZ * 26
            );
            p.wanderRetargetTimer = 4.2;
            acidHitsPredatorCount++;
            acidHitAdnGained += 8;
            break;
          }
        }
      }
      if (killedByAcid) {
        continue;
      }

      // --- 0A. BIOELECTRIC DISCHARGE SHOCKWAVE HIT (Radius 9.5m) ---
      if (electricPulseTriggered && distToPlayer <= electricPulseRadius) {
        const pushDirX = distToPlayer > 0.01 ? -dxToPlayer / distToPlayer : 1;
        const pushDirZ = distToPlayer > 0.01 ? -dzToPlayer / distToPlayer : 0;
        const shockDamage = p.profile.isHerbivore ? p.maxHealth : Math.max(28, playerAttackPower * 1.5);
        const died = this.applyOrganismDamage(
          p,
          shockDamage,
          pushDirX,
          pushDirZ,
          17.5,
          true,
          onCellKilled,
          true
        );
        if (died) {
          electrocutedHerbivoresCount++;
          electrocutedAdnGained += 14;
          continue;
        } else {
          p.stunTimer = 3.2;
          p.state = 'ATURDIDO';
          p.currentSpeed = 0;
          p.attackCooldown = Math.max(p.attackCooldown, 3.2);
          p.lungeTimer = 0;
          stunnedPredatorsCount++;
        }
      }

      // --- 0B. TOXIC POISON CLOUD HAZARD CONTACT ---
      for (let c = 0; c < activePoisonClouds.length; c++) {
        const cloud = activePoisonClouds[c];
        if (!cloud.active) continue;
        const dxCloud = p.position.x - cloud.position.x;
        const dzCloud = p.position.z - cloud.position.z;
        const distCloud = Math.sqrt(dxCloud * dxCloud + dzCloud * dzCloud);
        const contactRadius = cloud.radius + 1.15;

        if (distCloud <= contactRadius) {
          if (p.poisonTimer <= 0.25) {
            poisonedCount++;
          }
          p.poisonTimer = 3.0;
          p.poisonTickTimer -= safeDelta;

          const invDist = distCloud > 0.01 ? 1 / distCloud : 1;
          const repelStep = 4.6 * safeDelta;
          p.position.x += dxCloud * invDist * repelStep;
          p.position.z += dzCloud * invDist * repelStep;

          if (p.poisonTickTimer <= 0) {
            p.poisonTickTimer = 0.65;
            const diedFromPoison = this.applyOrganismDamage(
              p,
              14,
              dxCloud * invDist,
              dzCloud * invDist,
              10.0,
              true,
              onCellKilled,
              false
            );
            if (diedFromPoison) {
              if (p.profile.isHerbivore) {
                herbivoresHunted++;
                herbivoreAdnGained += 16;
              } else {
                huntersDevoured++;
                hunterAdnGained += 22;
              }
              break;
            }
          }

          if (!p.profile.isHerbivore && p.stunTimer <= 0) {
            p.attackCooldown = Math.max(p.attackCooldown, 0.85);
          }
        }
      }
      if (p.dyingTimer > 0) continue;

      // --- 0B-2. PLAYER MELEE BITE / FRONTAL RAM & PHYSICAL KNOCKBACK ---
      const isStage3AbsorbingTier1 =
        (this.playerGrowthStage >= 3 && p.profile.tier === 1) ||
        (this.playerGrowthStage >= 5 && p.profile.tier === 2);

      // Compute whether this organism is inside the player's frontal bite/attack cone
      const dirFromPlayerX = distToPlayer > 0.01 ? -dxToPlayer / distToPlayer : playerForwardX;
      const dirFromPlayerZ = distToPlayer > 0.01 ? -dzToPlayer / distToPlayer : playerForwardZ;
      const frontalDot =
        playerForwardX * dirFromPlayerX + playerForwardZ * dirFromPlayerZ;
      const isInPlayerFrontalCone = frontalDot >= 0.22;

      const meleeReach =
        (p.profile.tier === 3 ? 3.55 : 2.95) +
        (this.playerGrowthStage - 1) * 0.22;

      const playerHasMeleeCapability =
        canPredateHerbivores ||
        canCounterAttack ||
        canHuntWithGraspingArms ||
        isStage3AbsorbingTier1 ||
        (canDevourWeakenedHunters && (p.stunTimer > 0 || p.poisonTimer > 0));

      if (
        distToPlayer <= meleeReach &&
        p.biteImmunityTimer <= 0 &&
        p.socialCooldown <= 0 &&
        playerHasMeleeCapability &&
        (isInPlayerFrontalCone || canCounterAttack || isStage3AbsorbingTier1)
      ) {
        const pushDirX = distToPlayer > 0.01 ? -dxToPlayer / distToPlayer : playerForwardX;
        const pushDirZ = distToPlayer > 0.01 ? -dzToPlayer / distToPlayer : playerForwardZ;

        // Calculate bite/spike damage
        const baseBiteDmg = Math.max(16, playerAttackPower * 1.15);
        const boostBonus = isPlayerBoosting ? 1.38 : 1.0;
        const macroBonus = isStage3AbsorbingTier1 ? 1.65 : 1.0;
        const totalMeleeDamage = Math.round(baseBiteDmg * boostBonus * macroBonus);

        // Apply physical bounce to player as well so cells separate by 2.5m-4.0m and never overlap
        playerBounceTargetPosition = p.position;

        const died = this.applyOrganismDamage(
          p,
          totalMeleeDamage,
          pushDirX,
          pushDirZ,
          17.5, // ~3.2m physical pushback displacement in water
          true,
          onCellKilled,
          isPlayerBoosting || totalMeleeDamage >= 28
        );

        if (hasProboscis) {
          proboscisDrainedAdn += 4;
        }

        if (died) {
          if (p.profile.isHerbivore) {
            herbivoresHunted++;
            herbivoreAdnGained += p.profile.tier >= 2 ? 24 : 18;
            herbivoreEnergyGained += 30;
          } else {
            huntersDevoured++;
            hunterAdnGained += canHuntWithGraspingArms ? 35 : 25;
            hunterEnergyGained += 38;
          }
          continue;
        } else if (!p.profile.isHerbivore) {
          // Non-lethal hit still pushes and briefly interrupts enemy attack
          p.attackCooldown = Math.max(p.attackCooldown, 1.15);
          p.lungeTimer = 0;
          if (canCounterAttack) {
            if (p.profile.tier === 3) {
              repelledLeviathans++;
              leviathanBonusAdn += 8;
            } else {
              repelledHunters++;
              leviathanBonusAdn += 5;
            }
          }
        }
      }

      // --- 0C. STUNNED STATE ('ATURDIDO') ---
      if (p.stunTimer > 0) {
        p.stunTimer = Math.max(0, p.stunTimer - safeDelta);
        p.state = 'ATURDIDO';
        p.currentSpeed = 0;

        p.stateRingMat.color.setHex(0x38bdf8);
        p.stateRingMat.opacity = 0.9;
        p.coreMat.emissiveIntensity =
          1.8 + Math.sin(elapsedTime * 34.0 + p.id) * 0.6;

        const baseGroundY =
          this.currentStage === 'creature_stage'
            ? getLandHeightAt(p.position.x, p.position.z) +
              p.standingOffset * effectiveScale
            : GAME_CONFIG.WORLD.SWIM_PLANE_Y + depthOffsetY;
        p.position.y =
          baseGroundY + Math.sin(elapsedTime * 28.0 + p.id) * 0.08;
        p.group.rotation.set(
          Math.sin(elapsedTime * 42.0 + p.id) * 0.08,
          p.headingAngle + Math.cos(elapsedTime * 38.0 + p.id) * 0.11,
          Math.sin(elapsedTime * 36.0 + p.id) * 0.08
        );

        if (p.stunTimer <= 0) {
          p.state = 'DEAMBULAR';
          this.pickWanderTarget(p);
        }

        this.telemetryCache[i].state = p.state;
        this.telemetryCache[i].distanceToPlayer = distToPlayer;
        if (distToPlayer < nearestDistance) {
          nearestDistance = distToPlayer;
          nearestState = p.state;
          nearestSpeciesName = p.speciesName;
          nearestHasUncataloguedGene = carriesUncatalogued;
        }
        continue;
      } else if (p.state === 'ATURDIDO') {
        p.state = 'DEAMBULAR';
        this.pickWanderTarget(p);
      }

      // DevTools Freeze AI: hold organisms in place with idle breathing/shader animation and no hostile attacks
      if (this.isAIFrozen) {
        p.state = 'DEAMBULAR';
        p.currentSpeed = 0;
        p.lungeTimer = 0;
        const frozenBaseY =
          this.currentStage === 'creature_stage'
            ? getLandHeightAt(p.position.x, p.position.z) +
              p.standingOffset * effectiveScale
            : GAME_CONFIG.WORLD.SWIM_PLANE_Y + depthOffsetY;
        p.position.y =
          frozenBaseY + Math.sin(elapsedTime * 2.2 + p.id) * 0.1;
        this.animateBiologicalAnatomy(p, elapsedTime, safeDelta, 0.35);
        this.telemetryCache[i].state = p.state;
        this.telemetryCache[i].distanceToPlayer = distToPlayer;
        if (distToPlayer < nearestDistance) {
          nearestDistance = distToPlayer;
          nearestState = p.state;
          nearestSpeciesName = p.speciesName;
          nearestHasUncataloguedGene = carriesUncatalogued;
        }
        continue;
      }

      const poisonSpeedFactor = p.poisonTimer > 0 ? 0.55 : 1.0;

      // Query spatial neighbors around `p` (32m cell + adjacent cells) for O(1) AI interactions
      const neighbors = this.spatialGrid.queryCells(
        p.position.x,
        p.position.z,
        1,
        this.nearbyEntitiesBuffer
      );

      // --- 1. HERBIVORE / DEFENSIVE / FILTER ORGANISM LOGIC ---
      if (p.profile.isHerbivore) {
        const socialRadius = hasVocalCrest ? 13.5 : 8.5;
        const socialReward = hasVocalCrest ? 35 : 20;
        if (
          this.currentStage === 'creature_stage' &&
          socializeTriggered &&
          distToPlayer <= socialRadius &&
          p.socialCooldown <= 0
        ) {
          p.socialCooldown = 10.0;
          p.state = 'DEAMBULAR';
          p.stateRingMat.color.setHex(0x4ade80);
          p.stateRingMat.opacity = 0.9;
          socializedCount++;
          socialAdnGained += socialReward;
        }

        // If player bumps a herbivore without any predatory mouth/weapon, push apart physically
        if (
          distToPlayer <= 2.45 &&
          p.socialCooldown <= 0 &&
          !playerHasMeleeCapability
        ) {
          if (p.profile.attackDamage > 0 && p.attackCooldown <= 0) {
            totalDamageDealt += p.profile.attackDamage;
            attackerPosition = p.position;
            attackerSpeciesName = p.speciesName;
            p.attackCooldown = p.profile.attackCooldownSec;
          }
          const invDist = distToPlayer > 0.01 ? 1 / distToPlayer : 1;
          p.knockbackVelocity.set(
            -dxToPlayer * invDist * 14.0,
            0,
            -dzToPlayer * invDist * 14.0
          );
          playerBounceTargetPosition = p.position;
          blockedHerbivoreHunt = true;
        }

        // Evaluate closest threat using SpatialHashGrid neighbors
        let closestThreatDx = p.socialCooldown > 0 ? 999 : dxToPlayer;
        let closestThreatDz = p.socialCooldown > 0 ? 999 : dzToPlayer;
        let closestThreatDist = p.socialCooldown > 0 ? 999 : distToPlayer;

        for (let j = 0; j < neighbors.length; j++) {
          const other = neighbors[j];
          if (
            !other.active ||
            other.dyingTimer > 0 ||
            other.profile.isHerbivore ||
            other.id === p.id
          ) {
            continue;
          }
          const dxPred = other.position.x - p.position.x;
          const dzPred = other.position.z - p.position.z;
          const distPred = Math.sqrt(dxPred * dxPred + dzPred * dzPred);
          if (distPred < closestThreatDist) {
            closestThreatDist = distPred;
            closestThreatDx = dxPred;
            closestThreatDz = dzPred;
          }
        }

        if (p.state === 'DEAMBULAR') {
          if (closestThreatDist < p.profile.detectionRadius) {
            p.state = 'HUIR';
          }
        } else if (p.state === 'HUIR') {
          if (closestThreatDist > p.profile.loseInterestRadius) {
            p.state = 'DEAMBULAR';
            this.pickWanderTarget(p);
          }
        }

        const locoFactor = this.getLocomotionSpeedMultiplier(p);
        let targetSpeed = p.profile.wanderSpeed * locoFactor * poisonSpeedFactor;
        if (p.state === 'HUIR') {
          _toTarget.set(-closestThreatDx, 0, -closestThreatDz);
          targetSpeed = p.profile.activeSpeed * locoFactor * poisonSpeedFactor;
          p.stateRingMat.color.setHex(0x10b981);
          p.stateRingMat.opacity = 0.85;
          p.coreMat.emissiveIntensity = p.hitFlashTimer > 0 ? 2.4 : 1.3;
        } else {
          p.wanderRetargetTimer -= safeDelta;
          _toTarget.subVectors(p.wanderTarget, p.position);
          _toTarget.y = 0;

          if (_toTarget.lengthSq() < 16.0 || p.wanderRetargetTimer <= 0) {
            this.pickWanderTarget(p);
            _toTarget.subVectors(p.wanderTarget, p.position);
            _toTarget.y = 0;
          }

          p.stateRingMat.color.setHex(0x22c55e);
          p.stateRingMat.opacity = 0.45;
          p.coreMat.emissiveIntensity =
            p.hitFlashTimer > 0 ? 2.2 : p.socialCooldown > 0 ? 1.4 : 0.75;
        }

        const isSessileNow =
          this.currentStage === 'creature_stage' ? false : p.isSessile;
        if (!isSessileNow && _toTarget.lengthSq() > 0.001) {
          const desiredHeading = Math.atan2(-_toTarget.x, -_toTarget.z);
          let angleDiff = desiredHeading - p.headingAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          p.headingAngle +=
            angleDiff *
            Math.min(1, GAME_CONFIG.PREDATOR.TURN_DAMPING * safeDelta);
        }

        const baseWalkSpeed = Math.max(3.4, p.profile.wanderSpeed);
        const effTargetSpeed =
          this.currentStage === 'creature_stage' && p.isSessile
            ? baseWalkSpeed * poisonSpeedFactor
            : targetSpeed;

        p.currentSpeed = isSessileNow
          ? 0
          : THREE.MathUtils.damp(
              p.currentSpeed,
              effTargetSpeed,
              5.0,
              safeDelta
            );

        if (!isSessileNow && p.currentSpeed > 0.001) {
          _forward.set(-Math.sin(p.headingAngle), 0, -Math.cos(p.headingAngle));
          p.position.addScaledVector(_forward, p.currentSpeed * safeDelta);
        }
        this.resolveEntityObstacleCollisions(p, effectiveScale, safeDelta);

        const rSq = p.position.x * p.position.x + p.position.z * p.position.z;
        const maxR =
          this.currentStage === 'creature_stage'
            ? CONTINENT_CONFIG.CONTINENT_RADIUS - 80
            : GAME_CONFIG.WORLD.ARENA_RADIUS - 3.0;
        if (rSq > maxR * maxR) {
          const r = Math.sqrt(rSq);
          p.position.x = (p.position.x / r) * maxR;
          p.position.z = (p.position.z / r) * maxR;
          if (!isSessileNow) {
            this.pickWanderTarget(p);
          }
        }

        if (this.currentStage === 'creature_stage') {
          // Keep terrestrial creatures on solid emergent land and apply gravity + floor clamp
          const rawTerrainY = getLandHeightAt(p.position.x, p.position.z);
          const floorY =
            Math.max(0.2, rawTerrainY) +
            p.standingOffset * effectiveScale +
            Math.abs(Math.sin(p.swimPhase * 0.95)) * 0.14;
          if (p.position.y > floorY + 0.04) {
            p.verticalVelocity -= 22.0 * safeDelta;
            p.position.y += p.verticalVelocity * safeDelta;
          }
          if (p.position.y <= floorY) {
            p.position.y = floorY;
            p.verticalVelocity = 0;
          }
        } else {
          p.position.y =
            GAME_CONFIG.WORLD.SWIM_PLANE_Y +
            depthOffsetY +
            Math.sin(elapsedTime * 3.0 + p.id) * 0.14;
        }
        if (!isSessileNow) {
          p.group.rotation.set(0, p.headingAngle, 0);
        }

        this.animateBiologicalAnatomy(
          p,
          elapsedTime,
          safeDelta,
          poisonSpeedFactor
        );

        this.telemetryCache[i].state = p.state;
        this.telemetryCache[i].distanceToPlayer = distToPlayer;
        if (distToPlayer < nearestDistance) {
          nearestDistance = distToPlayer;
          nearestState = p.state;
          nearestSpeciesName = p.speciesName;
          nearestHasUncataloguedGene = carriesUncatalogued;
        }
        continue;
      }

      // --- 2. CARNIVORE / NEUTRAL TERRITORIAL / HOSTILE PREDATOR LOGIC ---
      const isNeutral = p.profile.attitude === 'neutral';

      // If player aggressively rams/collides into a Neutral creature, provoke it!
      if (isNeutral && distToPlayer <= 2.65 && !isPlayerAirborne) {
        p.provokedTimer = 14.0;
        if (p.state === 'DEAMBULAR') {
          p.state = 'PERSEGUIR';
        }
      }

      // Effective detection radius against the player: 0 for unprovoked Neutral creatures
      const effectivePlayerDetectionRadius =
        isNeutral && p.provokedTimer <= 0 ? 0 : p.profile.detectionRadius;

      // Find nearest active AI prey in the SpatialHashGrid neighborhood (only Hostile predators actively hunt AI prey unprovoked)
      let nearestHerbivore: OrganismEntity | null = null;
      let distToHerbivore = Infinity;
      if (!isNeutral) {
        for (let j = 0; j < neighbors.length; j++) {
          const candidate = neighbors[j];
          if (!candidate.active || candidate.dyingTimer > 0 || candidate.id === p.id) {
            continue;
          }
          if (
            !candidate.profile.isHerbivore &&
            candidate.profile.tier >= p.profile.tier
          ) {
            continue;
          }
          const hDx = candidate.position.x - p.position.x;
          const hDz = candidate.position.z - p.position.z;
          const hDist = Math.sqrt(hDx * hDx + hDz * hDz);
          if (hDist < distToHerbivore) {
            distToHerbivore = hDist;
            nearestHerbivore = candidate;
          }
        }
      }

      const huntingHerbivore =
        !isNeutral &&
        nearestHerbivore !== null &&
        distToHerbivore < distToPlayer &&
        distToHerbivore <= p.profile.detectionRadius;

      const activePreyDist = huntingHerbivore ? distToHerbivore : distToPlayer;
      const activeDetectionRadius = huntingHerbivore
        ? p.profile.detectionRadius
        : effectivePlayerDetectionRadius;
      const activePreyPos =
        huntingHerbivore && nearestHerbivore
          ? nearestHerbivore.position
          : playerPosition;

      if (isNeutral && p.provokedTimer <= 0 && (p.state === 'PERSEGUIR' || p.state === 'ATACAR')) {
        p.state = 'DEAMBULAR';
        this.pickWanderTarget(p);
      }

      switch (p.state) {
        case 'DEAMBULAR':
          if (
            p.attackCooldown <= 1.5 &&
            activeDetectionRadius > 0 &&
            activePreyDist <= activeDetectionRadius
          ) {
            p.state = 'PERSEGUIR';
          }
          break;

        case 'PERSEGUIR':
          if (activePreyDist <= p.profile.attackRange) {
            p.state = 'ATACAR';
          } else if (activePreyDist > p.profile.loseInterestRadius) {
            p.state = 'DEAMBULAR';
            p.provokedTimer = 0;
            this.pickWanderTarget(p);
          }
          break;

        case 'ATACAR':
          if (activePreyDist > p.profile.attackRange * 1.35) {
            p.state =
              activePreyDist <= p.profile.loseInterestRadius
                ? 'PERSEGUIR'
                : 'DEAMBULAR';
          }
          break;
      }

      const locoFactor = this.getLocomotionSpeedMultiplier(p);
      let targetSpeed: number =
        p.profile.wanderSpeed * locoFactor * poisonSpeedFactor;

      if (p.state === 'DEAMBULAR') {
        p.wanderRetargetTimer -= safeDelta;
        _toTarget.subVectors(p.wanderTarget, p.position);
        _toTarget.y = 0;

        if (_toTarget.lengthSq() < 16.0 || p.wanderRetargetTimer <= 0) {
          this.pickWanderTarget(p);
          _toTarget.subVectors(p.wanderTarget, p.position);
          _toTarget.y = 0;
        }

        targetSpeed = p.profile.wanderSpeed * locoFactor * poisonSpeedFactor;
        p.stateRingMat.color.setHex(isNeutral ? 0xf8fafc : 0xef4444);
        p.stateRingMat.opacity = 0.45;
        p.coreMat.emissiveIntensity = p.hitFlashTimer > 0 ? 2.4 : 0.65;
      } else if (p.state === 'PERSEGUIR') {
        _toTarget.subVectors(activePreyPos, p.position);
        _toTarget.y = 0;
        targetSpeed = p.profile.activeSpeed * locoFactor * poisonSpeedFactor;

        p.stateRingMat.color.setHex(isNeutral ? 0xf8fafc : 0xf43f5e);
        p.stateRingMat.opacity = 0.85;
        p.coreMat.emissiveIntensity = p.hitFlashTimer > 0 ? 2.4 : 1.25;
      } else {
        // ATACAR (against either AI Prey or Player)
        _toTarget.subVectors(activePreyPos, p.position);
        _toTarget.y = 0;
        targetSpeed =
          (p.lungeTimer > 0
            ? p.profile.activeSpeed * 1.25
            : p.profile.wanderSpeed * 0.65) *
          locoFactor *
          poisonSpeedFactor;

        p.stateRingMat.color.setHex(isNeutral ? 0xf8fafc : 0xef4444);
        p.stateRingMat.opacity = 0.85;
        p.coreMat.emissiveIntensity = p.hitFlashTimer > 0 ? 2.6 : 1.8;

        if (
          p.attackCooldown <= 0 &&
          activePreyDist <= p.profile.attackRange
        ) {
          if (huntingHerbivore && nearestHerbivore) {
            // AI-vs-AI melee bite with knockback, health bar reveal & death drop!
            const hDx = nearestHerbivore.position.x - p.position.x;
            const hDz = nearestHerbivore.position.z - p.position.z;
            const hDist = Math.max(0.01, Math.sqrt(hDx * hDx + hDz * hDz));
            const pushX = hDx / hDist;
            const pushZ = hDz / hDist;

            const aiKilledPrey = this.applyOrganismDamage(
              nearestHerbivore,
              p.profile.attackDamage,
              pushX,
              pushZ,
              15.5,
              false,
              onCellKilled,
              false
            );
            // Physical recoil on the attacking predator too
            p.currentSpeed *= 0.2;
            p.knockbackVelocity.set(-pushX * 11.5, 0, -pushZ * 11.5);
            p.combatRevealTimer = 5.0;

            if (aiKilledPrey) {
              predatorKilledHerbivoreCount++;
              p.state = 'DEAMBULAR';
              this.pickWanderTarget(p);
            }
            p.attackCooldown = 1.8;
            p.lungeTimer = 0.3;
          } else if (!isPlayerAirborne) {
            // Predator bites the player! Check frontal alignment of predator
            const predForwardX = -Math.sin(p.headingAngle);
            const predForwardZ = -Math.cos(p.headingAngle);
            const toPlayerDirX = distToPlayer > 0.01 ? dxToPlayer / distToPlayer : predForwardX;
            const toPlayerDirZ = distToPlayer > 0.01 ? dzToPlayer / distToPlayer : predForwardZ;
            const predFrontalDot =
              predForwardX * toPlayerDirX + predForwardZ * toPlayerDirZ;

            if (predFrontalDot >= 0.15) {
              const spikeRetaliationFactor = chitinSpikeStacks >= 2 ? 0.55 : 1.0;
              const dmgToPlayer = Math.round(
                p.profile.attackDamage * spikeRetaliationFactor
              );
              totalDamageDealt += dmgToPlayer;
              attackerPosition = p.position;
              attackerSpeciesName = p.speciesName;
              p.attackCooldown = p.profile.attackCooldownSec;
              p.lungeTimer = 0.28;
              p.combatRevealTimer = 5.0;

              // Physical recoil on the predator after biting the player so they separate 2.5m-4.0m
              p.currentSpeed *= 0.18;
              p.knockbackVelocity.set(
                -toPlayerDirX * 14.5,
                0,
                -toPlayerDirZ * 14.5
              );

              if (hasProboscis) {
                proboscisDrainedAdn += 5;
              }
              if (chitinSpikeStacks >= 1) {
                const spikeReturnDmg = chitinSpikeStacks * 14;
                this.applyOrganismDamage(
                  p,
                  spikeReturnDmg,
                  -toPlayerDirX,
                  -toPlayerDirZ,
                  16.5,
                  true,
                  onCellKilled,
                  false
                );
                if (chitinSpikeStacks >= 2) {
                  p.state = 'DEAMBULAR';
                  p.attackCooldown = 2.5;
                  if (p.profile.tier === 3) {
                    repelledLeviathans++;
                  } else {
                    repelledHunters++;
                  }
                  leviathanBonusAdn += 8;
                }
              }
            }
          }
        }
      }

      const isSessileNow =
        this.currentStage === 'creature_stage' ? false : p.isSessile;
      if (!isSessileNow && _toTarget.lengthSq() > 0.001) {
        const desiredHeading = Math.atan2(-_toTarget.x, -_toTarget.z);
        let angleDiff = desiredHeading - p.headingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const turnRate =
          (p.profile.tier === 3
            ? GAME_CONFIG.PREDATOR.TURN_DAMPING * 0.72
            : GAME_CONFIG.PREDATOR.TURN_DAMPING) * poisonSpeedFactor;
        p.headingAngle += angleDiff * Math.min(1, turnRate * safeDelta);
      }

      const effPredTargetSpeed =
        this.currentStage === 'creature_stage' && p.isSessile
          ? Math.max(3.6, targetSpeed)
          : targetSpeed;

      p.currentSpeed = isSessileNow
        ? 0
        : THREE.MathUtils.damp(
            p.currentSpeed,
            effPredTargetSpeed,
            5.0,
            safeDelta
          );

      if (!isSessileNow && p.currentSpeed > 0.001) {
        _forward.set(-Math.sin(p.headingAngle), 0, -Math.cos(p.headingAngle));
        p.position.addScaledVector(_forward, p.currentSpeed * safeDelta);
      }
      this.resolveEntityObstacleCollisions(p, effectiveScale, safeDelta);

      const rSq = p.position.x * p.position.x + p.position.z * p.position.z;
      const maxR =
        this.currentStage === 'creature_stage'
          ? CONTINENT_CONFIG.CONTINENT_RADIUS - 80
          : GAME_CONFIG.WORLD.ARENA_RADIUS - 2.0;
      if (rSq > maxR * maxR) {
        const r = Math.sqrt(rSq);
        p.position.x = (p.position.x / r) * maxR;
        p.position.z = (p.position.z / r) * maxR;
        if (!isSessileNow) {
          this.pickWanderTarget(p);
        }
      }

      if (this.currentStage === 'creature_stage') {
        const rawTerrainY = getLandHeightAt(p.position.x, p.position.z);
        const floorY =
          Math.max(0.2, rawTerrainY) +
          p.standingOffset * effectiveScale +
          Math.abs(Math.sin(p.swimPhase * 0.95)) * 0.14;
        if (p.position.y > floorY + 0.04) {
          p.verticalVelocity -= 22.0 * safeDelta;
          p.position.y += p.verticalVelocity * safeDelta;
        }
        if (p.position.y <= floorY) {
          p.position.y = floorY;
          p.verticalVelocity = 0;
        }
      } else {
        p.position.y =
          GAME_CONFIG.WORLD.SWIM_PLANE_Y +
          depthOffsetY +
          Math.sin(elapsedTime * 2.6 + p.id) * 0.14;
      }
      if (!isSessileNow) {
        p.group.rotation.set(0, p.headingAngle, 0);
      }

      this.animateBiologicalAnatomy(
        p,
        elapsedTime,
        safeDelta,
        poisonSpeedFactor
      );

      if (p.mandibleLeft && p.mandibleRight) {
        const jawSnap =
          p.lungeTimer > 0
            ? 0.45
            : Math.sin(p.swimPhase * 0.85) *
              (p.state === 'DEAMBULAR' ? 0.08 : 0.24);
        p.mandibleLeft.rotation.y = -0.22 + jawSnap;
        p.mandibleRight.rotation.y = 0.22 - jawSnap;
      }

      this.telemetryCache[i].state = p.state;
      this.telemetryCache[i].distanceToPlayer = distToPlayer;

      if (distToPlayer < nearestDistance) {
        nearestDistance = distToPlayer;
        nearestState = p.state;
        nearestSpeciesName = p.speciesName;
        nearestHasUncataloguedGene = carriesUncatalogued;
      }
    }

    return {
      totalDamageDealt,
      attackerPosition,
      attackerSpeciesName,
      playerBounceTargetPosition,
      repelledHunters,
      repelledLeviathans,
      leviathanBonusAdn,
      proboscisDrainedAdn,
      herbivoresHunted,
      herbivoreAdnGained,
      herbivoreEnergyGained,
      huntersDevoured,
      hunterAdnGained,
      hunterEnergyGained,
      predatorKilledHerbivoreCount,
      blockedHerbivoreHunt,
      poisonedCount,
      stunnedPredatorsCount,
      electrocutedHerbivoresCount,
      electrocutedAdnGained,
      socializedCount,
      socialAdnGained,
      acidHitsPredatorCount,
      acidHitAdnGained,
      telemetry: this.telemetryCache,
      nearestSpeciesName,
      nearestState,
      nearestDistance,
      nearestHasUncataloguedGene,
    };
  }

  /**
   * Used by `weapon_flash_photophore`: blinds and disorients all predators within `radius` (8m),
   * forcing them into 'DEAMBULAR' with a random heading for 2.5s.
   */
  public disorientPredatorsInRadius(
    center: THREE.Vector3,
    radius = 8.0
  ): number {
    let count = 0;
    const rSq = radius * radius;
    for (const p of this.organisms) {
      if (!p.active || p.profile.isHerbivore) continue;
      const dx = p.position.x - center.x;
      const dz = p.position.z - center.z;
      if (dx * dx + dz * dz <= rSq) {
        p.state = 'DEAMBULAR';
        p.attackCooldown = Math.max(p.attackCooldown, 2.5);
        p.headingAngle += Math.PI + (Math.random() - 0.5) * 1.4;
        p.wanderRetargetTimer = 2.5;
        count++;
      }
    }
    return count;
  }

  public isAIFrozen = false;

  public setAIFrozen(frozen: boolean): void {
    this.isAIFrozen = frozen;
  }

  public clearAllOrganisms(): void {
    for (let i = 0; i < this.organisms.length; i++) {
      const p = this.organisms[i];
      p.active = false;
      p.group.visible = false;
      p.healthRingMesh.visible = false;
      p.respawnTimer = 45.0;
    }
  }

  public forceSpawnSpeciesNearPlayer(
    species: SpeciesType,
    playerPosition: THREE.Vector3,
    headingAngle = 0
  ): string {
    const target =
      this.organisms.find((o) => o.profile.species === species && !o.active) ??
      this.organisms.find((o) => o.profile.species === species) ??
      this.organisms[0];
    if (!target) return 'Criatura';

    const forwardX = -Math.sin(headingAngle);
    const forwardZ = -Math.cos(headingAngle);
    const lateralX = -forwardZ;
    const lateralZ = forwardX;
    const jitterLat = (Math.random() - 0.5) * 4.5;
    const distAhead = 10.5 + Math.random() * 2.5;

    const fx = playerPosition.x + forwardX * distAhead + lateralX * jitterLat;
    const fz = playerPosition.z + forwardZ * distAhead + lateralZ * jitterLat;
    target.position.set(
      fx,
      this.currentStage === 'creature_stage'
        ? getLandHeightAt(fx, fz) + 0.55
        : GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      fz
    );
    target.headingAngle = headingAngle + Math.PI;
    target.group.position.copy(target.position);
    target.group.rotation.set(0, target.headingAngle, 0);
    target.active = true;
    target.group.visible = true;
    target.dyingTimer = 0;
    target.stunTimer = 0;
    target.poisonTimer = 0;
    target.health = target.maxHealth;
    target.state = 'DEAMBULAR';
    target.attackCooldown = 1.5;
    this.pickWanderTarget(target);
    return target.speciesName;
  }

  public getActiveOrganismsForFoodCollision(): readonly {
    active: boolean;
    dyingTimer: number;
    position: THREE.Vector3;
    currentSpeed: number;
    profile: { isHerbivore: boolean; scaleMultiplier: number };
  }[] {
    return this.organisms;
  }

  public getDesiredKinCount(growthStage: number): number {
    // Etapa 1: 7 congéneres -> Etapa 5: 23 congéneres poblando el caldo
    return 3 + growthStage * 4;
  }

  public setPlayerCellRef(player: PlayerCell): void {
    this.playerCellRef = player;
  }

  /**
   * Actualiza todas las células de la misma especie en el mapa clonando al 100%
   * la jerarquía 3D activa de `playerCell` (membrana deformada, material, núcleo y órganos).
   */
  public refreshAllKinClones(
    playerCell: PlayerCell,
    factory = organFactory
  ): void {
    this.playerCellRef = playerCell;
    const desiredCount = this.getDesiredKinCount(this.playerGrowthStage);
    const arenaRadius = Math.max(85, playerCell.activeArenaRadius ?? 110);

    // Asegurar que la población de congéneres coincida con la etapa actual
    while (this.kinCells.length < desiredCount) {
      const idx = this.kinCells.length;
      const angle = (idx / desiredCount) * Math.PI * 2 + Math.random() * 0.45;
      const dist = 24.0 + ((idx * 17) % (arenaRadius - 32.0));
      const pos = new THREE.Vector3(
        Math.cos(angle) * dist,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y,
        Math.sin(angle) * dist
      );
      const heading = angle + Math.PI * 0.5;
      const kinRoot = new THREE.Group();
      kinRoot.position.copy(pos);
      kinRoot.rotation.set(0, heading, 0);
      kinRoot.visible =
        this.currentStage === 'cell_stage' && this.isEcosystemCurrentlyVisible;
      this.scene.add(kinRoot);

      this.kinCells.push({
        id: `kin_${idx + 1}`,
        mesh: kinRoot,
        position: pos,
        velocity: new THREE.Vector3(),
        targetHeading: heading,
        isMateReceptive: false,
        pingTimer: 0,
        wanderTimer: 2.0 + Math.random() * 3.5,
      });
    }

    for (const kin of this.kinCells) {
      // Limpiar la geometría vieja del congénere
      if (typeof kin.mesh.userData.disposeClone === 'function') {
        kin.mesh.userData.disposeClone();
        delete kin.mesh.userData.disposeClone;
      }
      while (kin.mesh.children.length > 0) {
        const child = kin.mesh.children[0];
        if (typeof child.userData?.disposeClone === 'function') {
          child.userData.disposeClone();
        }
        kin.mesh.remove(child);
      }

      // Instanciar el nuevo modelo idéntico al jugador recién mutado
      const freshClone = factory.buildIdenticalCellClone(playerCell);
      kin.mesh.add(freshClone);
      kin.mesh.position.copy(kin.position);
      kin.mesh.rotation.set(0, kin.targetHeading, 0);
      kin.mesh.visible =
        this.currentStage === 'cell_stage' && this.isEcosystemCurrentlyVisible;
    }
  }

  /**
   * Reconstruye la malla 3D de todos los congéneres en el mapa copiando exactamente
   * las piezas, forma corporal, color y escala actuales del jugador.
   */
  public syncAllKinToPlayerMorphology(playerStats: PlayerStats): void {
    this.playerGrowthStage = playerStats.growthStage;
    if (this.playerCellRef) {
      this.refreshAllKinClones(this.playerCellRef, organFactory);
      return;
    }

    const desiredCount = this.getDesiredKinCount(playerStats.growthStage);
    const arenaRadius = Math.max(85, playerStats.activeArenaRadius ?? 110);

    // Ajustar población de congéneres si creció la etapa
    while (this.kinCells.length < desiredCount) {
      const idx = this.kinCells.length;
      const angle = (idx / desiredCount) * Math.PI * 2 + Math.random() * 0.45;
      const dist = 24.0 + ((idx * 17) % (arenaRadius - 32.0));
      const pos = new THREE.Vector3(
        Math.cos(angle) * dist,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y,
        Math.sin(angle) * dist
      );
      const cloneMesh = organFactory.buildCellMeshClone(
        playerStats.bodyShape,
        playerStats.colorTheme,
        playerStats.placedOrgans,
        playerStats.growthStage
      );
      cloneMesh.position.copy(pos);
      const heading = angle + Math.PI * 0.5;
      cloneMesh.rotation.set(0, heading, 0);
      cloneMesh.visible =
        this.currentStage === 'cell_stage' && this.isEcosystemCurrentlyVisible;
      this.scene.add(cloneMesh);

      this.kinCells.push({
        id: `kin_${idx + 1}`,
        mesh: cloneMesh,
        position: pos,
        velocity: new THREE.Vector3(),
        targetHeading: heading,
        isMateReceptive: false,
        pingTimer: 0,
        wanderTimer: 2.0 + Math.random() * 3.5,
      });
    }

    for (let i = 0; i < this.kinCells.length; i++) {
      const kin = this.kinCells[i];
      if (typeof kin.mesh.userData.disposeClone === 'function') {
        kin.mesh.userData.disposeClone();
      }
      this.scene.remove(kin.mesh);

      const clonedMesh = organFactory.buildCellMeshClone(
        playerStats.bodyShape,
        playerStats.colorTheme,
        playerStats.placedOrgans,
        playerStats.growthStage
      );

      clonedMesh.position.copy(kin.position);
      clonedMesh.rotation.set(0, kin.targetHeading, 0);
      clonedMesh.visible =
        this.currentStage === 'cell_stage' && this.isEcosystemCurrentlyVisible;
      this.scene.add(clonedMesh);
      kin.mesh = clonedMesh;
    }
  }

  /**
   * Activa o genera un congénere receptivo a distancia (~45-70m) que responde
   * al llamado de cortejo del jugador y nada a su encuentro.
   */
  public spawnReceptiveMate(
    matePos: THREE.Vector3,
    playerStats: PlayerStats
  ): KinCellEntity {
    if (this.kinCells.length === 0) {
      this.syncAllKinToPlayerMorphology(playerStats);
    }

    // Desmarcar cualquier pareja previa
    for (const k of this.kinCells) {
      k.isMateReceptive = false;
    }

    const mate = this.kinCells[0];
    mate.position.set(
      matePos.x,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      matePos.z
    );
    mate.mesh.position.copy(mate.position);
    mate.mesh.visible = true;
    mate.isMateReceptive = true;
    mate.pingTimer = 0.2;
    return mate;
  }

  private updateKinCells(
    safeDelta: number,
    elapsedTime: number,
    playerPosition: THREE.Vector3
  ): void {
    if (this.currentStage !== 'cell_stage' || !this.isEcosystemCurrentlyVisible) {
      return;
    }

    const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 12.0;

    for (let i = 0; i < this.kinCells.length; i++) {
      const kin = this.kinCells[i];
      if (!kin.mesh.visible) continue;

      if (kin.isMateReceptive) {
        // Nadar activamente al encuentro del jugador
        const dx = playerPosition.x - kin.position.x;
        const dz = playerPosition.z - kin.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.5) {
          kin.targetHeading = Math.atan2(-dx, -dz);
          const swimSpeed = 9.2;
          kin.velocity.set((dx / dist) * swimSpeed, 0, (dz / dist) * swimSpeed);
          kin.position.x += kin.velocity.x * safeDelta;
          kin.position.z += kin.velocity.z * safeDelta;
        }
      } else {
        // Nado pacífico en cardumen por la sopa primigenia
        kin.wanderTimer = (kin.wanderTimer ?? 2.5) - safeDelta;
        if (kin.wanderTimer <= 0) {
          kin.wanderTimer = 3.0 + Math.random() * 4.0;
          kin.targetHeading += (Math.random() - 0.5) * 1.6;
        }

        // Mantener dentro del radio de la arena
        const rSq = kin.position.x * kin.position.x + kin.position.z * kin.position.z;
        if (rSq > maxR * maxR) {
          kin.targetHeading = Math.atan2(kin.position.x, kin.position.z);
        }

        const wanderSpeed = 4.6;
        const fx = -Math.sin(kin.targetHeading);
        const fz = -Math.cos(kin.targetHeading);
        kin.velocity.set(fx * wanderSpeed, 0, fz * wanderSpeed);
        kin.position.x += kin.velocity.x * safeDelta;
        kin.position.z += kin.velocity.z * safeDelta;
      }

      kin.position.y =
        GAME_CONFIG.WORLD.SWIM_PLANE_Y +
        Math.sin(elapsedTime * 2.2 + i * 0.9) * 0.08;
      kin.mesh.position.copy(kin.position);

      // Interpolación suave de giro
      let diff = kin.targetHeading - kin.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      kin.mesh.rotation.y += diff * Math.min(1.0, safeDelta * 6.5);

      // Animar flagelos y órganos acoplados del clon
      const organVisuals = kin.mesh.userData.organVisuals as
        | OrganVisualInstance[]
        | undefined;
      if (organVisuals) {
        const speedRatio = kin.isMateReceptive ? 1.15 : 0.65;
        for (let o = 0; o < organVisuals.length; o++) {
          organVisuals[o].animate(
            elapsedTime + i * 0.35,
            speedRatio,
            kin.isMateReceptive
          );
        }
      }
    }
  }

  public dispose(): void {
    for (const kin of this.kinCells) {
      if (typeof kin.mesh.userData.disposeClone === 'function') {
        kin.mesh.userData.disposeClone();
      }
      kin.mesh.removeFromParent();
    }
    for (const p of this.organisms) {
      for (const org of p.attachedOrgans) {
        org.dispose();
      }
    }
    for (const geo of this.sharedGeometries) {
      geo.dispose();
    }
    for (const mat of this.disposableMaterials) {
      mat.dispose();
    }
  }
}

