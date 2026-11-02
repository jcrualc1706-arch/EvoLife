import * as THREE from 'three';
import { audioManager } from './AudioManager';
import { GAME_CONFIG } from './config';
import { createOrganVisual, OrganVisualInstance } from './OrganFactory3D';
import { PooledAcidProjectile } from './PlayerCell';
import { EnvironmentObstacle } from './SceneEnvironment';
import { SpatialHashGrid } from './SpatialHashGrid';
import {
  CellularGrowthStage,
  EvolutionaryStage,
  PoisonCloudHazard,
  PredatorBehaviorState,
  PredatorTelemetry,
  SpeciesType,
} from './types';

interface SpeciesProfile {
  species: SpeciesType;
  name: string;
  tier: 1 | 2 | 3;
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
    isHerbivore: true,
    count: 4,
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
    isHerbivore: true,
    count: 3,
    wanderSpeed: 3.9,
    activeSpeed: 7.4,
    detectionRadius: 15.0,
    loseInterestRadius: 22.0,
    attackRange: 2.6,
    attackDamage: 10,
    attackCooldownSec: 1.8,
    scaleMultiplier: 0.92,
    primaryTraits: ['weapon_harpoon_cell', 'sense_stalk_compound_eye', 'simple_flagellum'],
  },
  gasteropodo: {
    species: 'gasteropodo',
    name: 'Gasterópodo Sulfuroso',
    tier: 1,
    isHerbivore: true,
    count: 3,
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
    isHerbivore: true,
    isSessile: true,
    count: 3,
    wanderSpeed: 0,
    activeSpeed: 0,
    detectionRadius: 10.0,
    loseInterestRadius: 15.0,
    attackRange: 2.4,
    attackDamage: 8,
    attackCooldownSec: 2.0,
    scaleMultiplier: 0.98,
    primaryTraits: ['defense_silica_spicules', 'chitin_spike'],
  },
  hunter: {
    species: 'hunter',
    name: 'Mandíbula Rápida',
    tier: 1,
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
    isHerbivore: false,
    count: 3,
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
    isHerbivore: false,
    count: 3,
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
    isHerbivore: true,
    count: 3,
    wanderSpeed: 4.3,
    activeSpeed: 8.5,
    detectionRadius: 16.5,
    loseInterestRadius: 24.0,
    attackRange: 3.5,
    attackDamage: 12,
    attackCooldownSec: 2.2,
    scaleMultiplier: 1.1,
    primaryTraits: [
      'weapon_flash_photophore',
      'electric_cell',
      'movement_ribbon_fin',
    ],
  },
  anquilocelula: {
    species: 'anquilocelula',
    name: 'Anquilocélula de Fondo',
    tier: 2,
    isHerbivore: false,
    count: 2,
    wanderSpeed: 3.5,
    activeSpeed: 7.0,
    detectionRadius: 19.5,
    loseInterestRadius: 27.5,
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
  nebula_gelatinosa: {
    species: 'nebula_gelatinosa',
    name: 'Nébula Gelatinosa',
    tier: 2,
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
  bala_fumarola: {
    species: 'bala_fumarola',
    name: 'Bala de Fumarola',
    tier: 3,
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
  legsGroup: THREE.Group;
  legs: THREE.Mesh[];
  stateRingMat: THREE.MeshBasicMaterial;
  uncataloguedRimMat: THREE.MeshBasicMaterial;
  uncataloguedRimMesh: THREE.Mesh;
  coreMat: THREE.MeshStandardMaterial;
  geneticTraits: string[];
  geneMarkerGroup: THREE.Group;
  geneMarkerCrystal: THREE.Mesh;
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
  private currentStage: EvolutionaryStage = 'cell_stage';
  private playerGrowthStage: CellularGrowthStage = 1;
  private readonly organisms: OrganismEntity[] = [];
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
  private uncataloguedRimGeo!: THREE.BufferGeometry;
  private leviathanPlateGeo!: THREE.BufferGeometry;
  private herbivoreBodyGeo!: THREE.BufferGeometry;
  private herbivoreCiliaGeo!: THREE.BufferGeometry;
  private creatureLegGeo!: THREE.BufferGeometry;
  private geneCrystalGeo!: THREE.BufferGeometry;
  private geneHaloGeo!: THREE.BufferGeometry;

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
  private shellArmorMat!: THREE.MeshStandardMaterial;
  private eyeScleraMat!: THREE.MeshPhysicalMaterial;
  private predatorEyeMat!: THREE.MeshStandardMaterial;
  private herbivoreEyeMat!: THREE.MeshStandardMaterial;
  private eyePupilMat!: THREE.MeshStandardMaterial;
  private organelleMat!: THREE.MeshStandardMaterial;
  private electricArcMat!: THREE.MeshBasicMaterial;
  private geneCrystalMat!: THREE.MeshStandardMaterial;
  private geneHaloMat!: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
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
        entity.position.y < o.minY - 0.4 ||
        entity.position.y > o.maxY + 0.4
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

    this.uncataloguedRimGeo = new THREE.RingGeometry(1.72, 2.08, 36);
    this.uncataloguedRimGeo.rotateX(-Math.PI / 2);

    this.leviathanPlateGeo = new THREE.DodecahedronGeometry(0.55, 0);
    this.leviathanPlateGeo.scale(1.4, 0.45, 1.1);

    this.herbivoreBodyGeo = new THREE.CapsuleGeometry(0.95, 0.65, 16, 22);
    this.herbivoreBodyGeo.rotateX(Math.PI / 2);

    this.herbivoreCiliaGeo = new THREE.CylinderGeometry(0.035, 0.095, 0.62, 6);
    this.herbivoreCiliaGeo.rotateZ(Math.PI / 2);

    this.creatureLegGeo = new THREE.CapsuleGeometry(0.14, 0.72, 6, 8);
    this.creatureLegGeo.translate(0, -0.36, 0);

    this.geneCrystalGeo = new THREE.OctahedronGeometry(0.32, 0);
    this.geneCrystalGeo.scale(0.85, 1.45, 0.85);
    this.geneHaloGeo = new THREE.RingGeometry(0.4, 0.56, 20);
    this.geneHaloGeo.rotateX(-Math.PI / 2);

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
      this.uncataloguedRimGeo,
      this.leviathanPlateGeo,
      this.herbivoreBodyGeo,
      this.herbivoreCiliaGeo,
      this.creatureLegGeo,
      this.geneCrystalGeo,
      this.geneHaloGeo
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

    this.shellArmorMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      emissive: 0x451a03,
      emissiveIntensity: 0.28,
      roughness: 0.45,
      metalness: 0.48,
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

    this.geneCrystalMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0x10b981,
      emissiveIntensity: 2.0,
      roughness: 0.15,
      metalness: 0.4,
    });

    this.geneHaloMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
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
      this.shellArmorMat,
      this.eyeScleraMat,
      this.predatorEyeMat,
      this.herbivoreEyeMat,
      this.eyePupilMat,
      this.organelleMat,
      this.electricArcMat,
      this.geneCrystalMat,
      this.geneHaloMat
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

      // Tactical State Indicator Ring underneath
      const stateRingMat = new THREE.MeshBasicMaterial({
        color: profile.isHerbivore ? 0x2dd4bf : 0xf59e0b,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.disposableMaterials.push(stateRingMat);
      const ringMesh = new THREE.Mesh(this.ringGeo, stateRingMat);
      ringMesh.position.y = -0.95;
      group.add(ringMesh);

      // Golden/Emerald Outer Rim Glow when organism carries an uncatalogued adaptation
      const uncataloguedRimMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.disposableMaterials.push(uncataloguedRimMat);
      const uncataloguedRimMesh = new THREE.Mesh(
        this.uncataloguedRimGeo,
        uncataloguedRimMat
      );
      uncataloguedRimMesh.position.y = -0.92;
      group.add(uncataloguedRimMesh);

      // Pre-allocated Terrestrial Legs Group (4 legs, shown in Creature Stage)
      const legsGroup = new THREE.Group();
      legsGroup.visible = false;
      const legs: THREE.Mesh[] = [];
      const legMat = profile.isHerbivore
        ? this.herbivoreCiliaMat
        : profile.tier === 3
        ? this.leviathanMandibleMat
        : this.hunterMandibleMat;
      const legSockets: [number, number, number, number][] = [
        [-0.78, -0.2, -0.5, -1],
        [0.78, -0.2, -0.5, 1],
        [-0.82, -0.2, 0.5, -1],
        [0.82, -0.2, 0.5, 1],
      ];
      for (const [lx, ly, lz, side] of legSockets) {
        const legMesh = new THREE.Mesh(this.creatureLegGeo, legMat);
        legMesh.position.set(lx, ly, lz);
        legMesh.rotation.z = side * 0.28;
        legsGroup.add(legMesh);
        legs.push(legMesh);
      }
      group.add(legsGroup);

      // Dorsal Uncatalogued Gene Carrier Marker (Crystal + Golden Halo)
      const geneMarkerGroup = new THREE.Group();
      geneMarkerGroup.position.set(0, 1.38, 0);
      const geneMarkerCrystal = new THREE.Mesh(
        this.geneCrystalGeo,
        this.geneCrystalMat
      );
      const geneMarkerHalo = new THREE.Mesh(this.geneHaloGeo, this.geneHaloMat);
      geneMarkerHalo.position.y = -0.18;
      geneMarkerGroup.add(geneMarkerCrystal);
      geneMarkerGroup.add(geneMarkerHalo);
      group.add(geneMarkerGroup);

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
        legsGroup,
        legs,
        stateRingMat,
        uncataloguedRimMat,
        uncataloguedRimMesh,
        coreMat,
        geneticTraits: [...profile.primaryTraits],
        geneMarkerGroup,
        geneMarkerCrystal,
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
   * Animates internal nucleus/organelles, articulated flagella waves proportional to real velocity,
   * vibrating oral/lateral cilia, and bioelectric arcs for any active organism.
   */
  private animateBiologicalAnatomy(
    p: OrganismEntity,
    elapsedTime: number,
    safeDelta: number,
    poisonSpeedFactor: number
  ): void {
    // 1. Pulsating bioluminescent nucleus & internal organelles
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

    // 3. Biological Rule: Sessile organisms without flagella/cilia do not self-propel; they gently sway with the ocean current
    if (p.isSessile) {
      p.currentSpeed = 0;
      const swayX = Math.sin(elapsedTime * 1.65 + p.id * 0.9) * 0.085;
      const swayZ = Math.cos(elapsedTime * 1.35 + p.id * 1.2) * 0.085;
      p.group.rotation.set(swayX, p.headingAngle, swayZ);
      return;
    }

    // 4. Advance swim phase strictly proportional to the organism's real movement velocity
    const speedRatio = Math.min(2.4, Math.max(0.15, p.currentSpeed / 4.2));
    const phaseRate = (3.2 + speedRatio * 7.8) * poisonSpeedFactor;
    p.swimPhase = (p.swimPhase + safeDelta * phaseRate) % (Math.PI * 200);

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
    this.currentStage = stage;
    const isLand = stage === 'creature_stage';
    for (let i = 0; i < this.organisms.length; i++) {
      const entity = this.organisms[i];
      entity.legsGroup.visible = isLand;
      entity.speciesName = entity.profile.name;
      this.telemetryCache[i].speciesName = entity.speciesName;
    }
  }

  private pickWanderTarget(entity: OrganismEntity): void {
    const minR = entity.profile.tier === 1 ? 10 : entity.profile.tier === 2 ? 22 : 36;
    const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 14;
    const r = minR + Math.random() * (maxR - minR);
    const angle = Math.random() * Math.PI * 2;
    entity.wanderTarget.set(
      Math.cos(angle) * r,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      Math.sin(angle) * r
    );
    entity.wanderRetargetTimer = 4.0 + Math.random() * 4.5;
  }

  private spawnOrganismAtSafeRadius(
    entity: OrganismEntity,
    index: number
  ): void {
    const total = this.organisms.length;
    const angle = (index / total) * Math.PI * 2 + Math.random() * 0.5;
    // Distribute Tiers across the 240m arena so the player encounters Tier 1 nearby, Tier 2 mid-range, Tier 3 deeper out
    const minDist =
      entity.profile.tier === 1
        ? 16.0
        : entity.profile.tier === 2
        ? 28.0
        : 46.0;
    const maxExtra =
      entity.profile.tier === 1
        ? 95.0
        : entity.profile.tier === 2
        ? 145.0
        : 170.0;
    const radius = Math.min(
      GAME_CONFIG.WORLD.ARENA_RADIUS - 12,
      minDist + ((index * 19) % maxExtra) + Math.random() * 14
    );

    entity.position.set(
      Math.cos(angle) * radius,
      GAME_CONFIG.WORLD.SWIM_PLANE_Y,
      Math.sin(angle) * radius
    );
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
      killedByPlayer: boolean
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
    }

    if (p.health <= 0) {
      // Trigger 0.25s swelling + flash + micro-sphere rupture animation & meat drop
      p.dyingTimer = 0.25;
      p.dyingKilledByPlayer = killedByPlayer;
      p.healthRingMesh.visible = false;
      if (killedByPlayer) {
        audioManager.playCreatureDeath();
      }
      this.spawnDeathMicroSpheres(
        p.position,
        p.profile.isHerbivore,
        p.profile.scaleMultiplier
      );
      if (onCellKilled) {
        onCellKilled(p.position, p.geneticTraits, p.speciesName, killedByPlayer);
      }
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
      killedByPlayer: boolean
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

      // Handle 0.25s Cell Death Swelling & Incandescent Flash Animation before hiding
      if (p.dyingTimer > 0) {
        p.dyingTimer = Math.max(0, p.dyingTimer - safeDelta);
        const deathProgress = 1.0 - p.dyingTimer / 0.25;
        const swellScale = effectiveScale * (1.0 + deathProgress * 0.42);
        p.group.scale.setScalar(swellScale);
        p.stateRingMat.color.setHex(0xffffff);
        p.stateRingMat.opacity = (1.0 - deathProgress) * 0.95;
        p.coreMat.emissive.setHex(0xffffff);
        p.coreMat.emissiveIntensity = 3.2;

        if (p.dyingTimer <= 0) {
          p.active = false;
          p.group.visible = false;
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

      // Check if this organism carries any uncatalogued adaptation for the 3D golden/emerald rim & radar
      const carriesUncatalogued = discoveredIds
        ? p.geneticTraits.some((traitId) => !discoveredIds.has(traitId))
        : false;
      p.geneMarkerGroup.visible = carriesUncatalogued;
      p.uncataloguedRimMesh.visible = carriesUncatalogued;
      if (carriesUncatalogued && distToPlayer <= 110) {
        p.geneMarkerCrystal.rotation.y += safeDelta * 2.8;
        p.geneMarkerGroup.position.y =
          1.38 + Math.sin(elapsedTime * 4.2 + p.id) * 0.14;
        const rimPulse = 0.4 + Math.sin(elapsedTime * 4.5 + p.id) * 0.22;
        p.uncataloguedRimMat.opacity = rimPulse;
        p.uncataloguedRimMat.color.setHex(
          Math.sin(elapsedTime * 3.0 + p.id) > 0 ? 0xfacc15 : 0x10b981
        );
      }

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

        p.position.y =
          GAME_CONFIG.WORLD.SWIM_PLANE_Y +
          depthOffsetY +
          Math.sin(elapsedTime * 28.0 + p.id) * 0.08;
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
          p.stateRingMat.color.setHex(
            p.hitFlashTimer > 0
              ? 0xf43f5e
              : p.poisonTimer > 0
              ? 0x84cc16
              : 0x38bdf8
          );
          p.stateRingMat.opacity = 0.65;
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

          p.stateRingMat.color.setHex(
            p.hitFlashTimer > 0
              ? 0xf43f5e
              : p.socialCooldown > 0
              ? 0x4ade80
              : p.poisonTimer > 0
              ? 0x84cc16
              : 0x2dd4bf
          );
          p.stateRingMat.opacity =
            p.hitFlashTimer > 0
              ? 0.85
              : p.socialCooldown > 0
              ? 0.78
              : p.poisonTimer > 0
              ? 0.55
              : 0.24;
          p.coreMat.emissiveIntensity =
            p.hitFlashTimer > 0 ? 2.2 : p.socialCooldown > 0 ? 1.4 : 0.75;
        }

        if (!p.isSessile && _toTarget.lengthSq() > 0.001) {
          const desiredHeading = Math.atan2(-_toTarget.x, -_toTarget.z);
          let angleDiff = desiredHeading - p.headingAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          p.headingAngle +=
            angleDiff *
            Math.min(1, GAME_CONFIG.PREDATOR.TURN_DAMPING * safeDelta);
        }

        p.currentSpeed = p.isSessile
          ? 0
          : THREE.MathUtils.damp(
              p.currentSpeed,
              targetSpeed,
              5.0,
              safeDelta
            );

        if (!p.isSessile && p.currentSpeed > 0.001) {
          _forward.set(-Math.sin(p.headingAngle), 0, -Math.cos(p.headingAngle));
          p.position.addScaledVector(_forward, p.currentSpeed * safeDelta);
        }
        this.resolveEntityObstacleCollisions(p, effectiveScale, safeDelta);

        const rSq = p.position.x * p.position.x + p.position.z * p.position.z;
        const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 3.0;
        if (rSq > maxR * maxR) {
          const r = Math.sqrt(rSq);
          p.position.x = (p.position.x / r) * maxR;
          p.position.z = (p.position.z / r) * maxR;
          if (!p.isSessile) {
            this.pickWanderTarget(p);
          }
        }

        p.position.y =
          GAME_CONFIG.WORLD.SWIM_PLANE_Y +
          depthOffsetY +
          Math.sin(elapsedTime * 3.0 + p.id) * 0.14;
        if (!p.isSessile) {
          p.group.rotation.set(0, p.headingAngle, 0);
        }

        this.animateBiologicalAnatomy(
          p,
          elapsedTime,
          safeDelta,
          poisonSpeedFactor
        );
        if (p.legsGroup.visible && p.legs.length === 4 && !p.isSessile) {
          const legSwing = Math.sin(p.swimPhase * 0.85) * 0.42;
          p.legs[0].rotation.x = legSwing;
          p.legs[1].rotation.x = -legSwing;
          p.legs[2].rotation.x = -legSwing;
          p.legs[3].rotation.x = legSwing;
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
      }

      // --- 2. CARNIVORE / TERRITORIAL PREDATOR LOGIC ---
      // Find nearest active prey in the SpatialHashGrid neighborhood for AI-vs-AI battles!
      let nearestHerbivore: OrganismEntity | null = null;
      let distToHerbivore = Infinity;
      for (let j = 0; j < neighbors.length; j++) {
        const candidate = neighbors[j];
        if (!candidate.active || candidate.dyingTimer > 0 || candidate.id === p.id) {
          continue;
        }
        // Predators hunt herbivores or lower-tier organisms
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

      const huntingHerbivore =
        nearestHerbivore !== null &&
        distToHerbivore < distToPlayer &&
        distToHerbivore <= p.profile.detectionRadius;

      const activePreyDist = huntingHerbivore ? distToHerbivore : distToPlayer;
      const activePreyPos =
        huntingHerbivore && nearestHerbivore
          ? nearestHerbivore.position
          : playerPosition;

      switch (p.state) {
        case 'DEAMBULAR':
          if (
            p.attackCooldown <= 1.5 &&
            activePreyDist <= p.profile.detectionRadius
          ) {
            p.state = 'PERSEGUIR';
          }
          break;

        case 'PERSEGUIR':
          if (activePreyDist <= p.profile.attackRange) {
            p.state = 'ATACAR';
          } else if (activePreyDist > p.profile.loseInterestRadius) {
            p.state = 'DEAMBULAR';
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
        p.stateRingMat.color.setHex(
          p.hitFlashTimer > 0
            ? 0xf43f5e
            : p.poisonTimer > 0
            ? 0x84cc16
            : p.profile.tier === 3
            ? 0xa855f7
            : 0xf59e0b
        );
        p.stateRingMat.opacity = p.hitFlashTimer > 0 ? 0.88 : p.poisonTimer > 0 ? 0.6 : 0.24;
        p.coreMat.emissiveIntensity = p.hitFlashTimer > 0 ? 2.4 : 0.65;
      } else if (p.state === 'PERSEGUIR') {
        _toTarget.subVectors(activePreyPos, p.position);
        _toTarget.y = 0;
        targetSpeed = p.profile.activeSpeed * locoFactor * poisonSpeedFactor;

        p.stateRingMat.color.setHex(
          p.hitFlashTimer > 0
            ? 0xf43f5e
            : p.poisonTimer > 0
            ? 0x84cc16
            : 0xf97316
        );
        p.stateRingMat.opacity = p.hitFlashTimer > 0 ? 0.9 : 0.58;
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

        p.stateRingMat.color.setHex(0xef4444);
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

      if (!p.isSessile && _toTarget.lengthSq() > 0.001) {
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

      p.currentSpeed = p.isSessile
        ? 0
        : THREE.MathUtils.damp(
            p.currentSpeed,
            targetSpeed,
            5.0,
            safeDelta
          );

      if (!p.isSessile && p.currentSpeed > 0.001) {
        _forward.set(-Math.sin(p.headingAngle), 0, -Math.cos(p.headingAngle));
        p.position.addScaledVector(_forward, p.currentSpeed * safeDelta);
      }
      this.resolveEntityObstacleCollisions(p, effectiveScale, safeDelta);

      const rSq = p.position.x * p.position.x + p.position.z * p.position.z;
      const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 2.0;
      if (rSq > maxR * maxR) {
        const r = Math.sqrt(rSq);
        p.position.x = (p.position.x / r) * maxR;
        p.position.z = (p.position.z / r) * maxR;
        if (!p.isSessile) {
          this.pickWanderTarget(p);
        }
      }

      p.position.y =
        GAME_CONFIG.WORLD.SWIM_PLANE_Y +
        depthOffsetY +
        Math.sin(elapsedTime * 2.6 + p.id) * 0.14;
      if (!p.isSessile) {
        p.group.rotation.set(0, p.headingAngle, 0);
      }

      this.animateBiologicalAnatomy(
        p,
        elapsedTime,
        safeDelta,
        poisonSpeedFactor
      );

      if (p.legsGroup.visible && p.legs.length === 4 && !p.isSessile) {
        const legSwing = Math.sin(p.swimPhase * 0.85) * 0.45;
        p.legs[0].rotation.x = legSwing;
        p.legs[1].rotation.x = -legSwing;
        p.legs[2].rotation.x = -legSwing;
        p.legs[3].rotation.x = legSwing;
      }

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

  public getActiveOrganismsForFoodCollision(): readonly {
    active: boolean;
    dyingTimer: number;
    position: THREE.Vector3;
    currentSpeed: number;
    profile: { isHerbivore: boolean; scaleMultiplier: number };
  }[] {
    return this.organisms;
  }

  public dispose(): void {
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
