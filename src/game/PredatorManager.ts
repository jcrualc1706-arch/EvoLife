import * as THREE from 'three';
import { GAME_CONFIG } from './config';
import { createOrganVisual, OrganVisualInstance } from './OrganFactory3D';
import { PooledAcidProjectile } from './PlayerCell';
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
    primaryTraits: ['weapon_harpoon_cell', 'sense_stalk_compound_eye'],
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
    ],
  },
  esponja_espicular: {
    species: 'esponja_espicular',
    name: 'Esponja Espicular',
    tier: 1,
    isHerbivore: true,
    count: 3,
    wanderSpeed: 1.5,
    activeSpeed: 2.7,
    detectionRadius: 10.0,
    loseInterestRadius: 15.0,
    attackRange: 2.4,
    attackDamage: 8,
    attackCooldownSec: 2.0,
    scaleMultiplier: 0.95,
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
    primaryTraits: ['weapon_rotary_drill', 'mouth_needle_proboscis'],
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
    primaryTraits: ['weapon_caustic_acid_blister', 'poison_gland', 'acid_spit'],
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
    ],
  },
};

interface OrganismEntity {
  id: number;
  species: SpeciesType;
  speciesName: string;
  profile: SpeciesProfile;
  group: THREE.Group;
  position: THREE.Vector3;
  headingAngle: number;
  currentSpeed: number;
  state: PredatorBehaviorState;
  active: boolean;
  respawnTimer: number;
  stunTimer: number;
  poisonTimer: number;
  socialCooldown: number;
  wanderTarget: THREE.Vector3;
  wanderRetargetTimer: number;
  attackCooldown: number;
  lungeTimer: number;
  swimPhase: number;
  mandibleLeft: THREE.Mesh | null;
  mandibleRight: THREE.Mesh | null;
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

  // Shared Geometries
  private predatorBodyGeo!: THREE.BufferGeometry;
  private sphericalBodyGeo!: THREE.BufferGeometry;
  private elongatedBodyGeo!: THREE.BufferGeometry;
  private medusaBellGeo!: THREE.BufferGeometry;
  private spongeTubeGeo!: THREE.BufferGeometry;
  private predatorCoreGeo!: THREE.BufferGeometry;
  private mandibleGeo!: THREE.BufferGeometry;
  private spineGeo!: THREE.BufferGeometry;
  private eyeGeo!: THREE.BufferGeometry;
  private tailGeo!: THREE.BufferGeometry;
  private ringGeo!: THREE.BufferGeometry;
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
  private gasteropodoBodyMat!: THREE.MeshStandardMaterial;
  private perforadorBodyMat!: THREE.MeshPhysicalMaterial;
  private viboraBodyMat!: THREE.MeshPhysicalMaterial;
  private medusaBodyMat!: THREE.MeshPhysicalMaterial;
  private anquiloBodyMat!: THREE.MeshStandardMaterial;
  private esponjaBodyMat!: THREE.MeshPhysicalMaterial;
  private nebulaBodyMat!: THREE.MeshPhysicalMaterial;
  private balaBodyMat!: THREE.MeshStandardMaterial;
  private miradorBodyMat!: THREE.MeshPhysicalMaterial;
  private predatorEyeMat!: THREE.MeshStandardMaterial;
  private herbivoreEyeMat!: THREE.MeshStandardMaterial;
  private geneCrystalMat!: THREE.MeshStandardMaterial;
  private geneHaloMat!: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.initSharedAssets();
    this.spawnEcosystem(scene);
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
    this.predatorBodyGeo = new THREE.ConeGeometry(1.15, 2.75, 16);
    this.predatorBodyGeo.rotateX(-Math.PI / 2);
    this.predatorBodyGeo.scale(1.05, 0.72, 1.0);

    this.sphericalBodyGeo = new THREE.SphereGeometry(1.18, 18, 16);
    this.sphericalBodyGeo.scale(1.05, 0.76, 1.12);

    this.elongatedBodyGeo = new THREE.CapsuleGeometry(0.68, 2.1, 12, 16);
    this.elongatedBodyGeo.rotateX(Math.PI / 2);
    this.elongatedBodyGeo.scale(0.95, 0.72, 1.15);

    this.medusaBellGeo = new THREE.SphereGeometry(
      1.25,
      18,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.65
    );
    this.medusaBellGeo.rotateX(-Math.PI * 0.35);

    this.spongeTubeGeo = new THREE.CylinderGeometry(0.75, 1.05, 1.85, 12, 2);

    this.predatorCoreGeo = new THREE.OctahedronGeometry(0.62, 1);

    this.mandibleGeo = new THREE.ConeGeometry(0.22, 0.95, 8);
    this.mandibleGeo.rotateX(-Math.PI / 2);

    this.spineGeo = new THREE.ConeGeometry(0.16, 0.65, 6);

    this.eyeGeo = new THREE.SphereGeometry(0.2, 12, 12);

    this.tailGeo = new THREE.SphereGeometry(0.26, 10, 10);
    this.tailGeo.scale(0.8, 0.8, 1.5);

    this.ringGeo = new THREE.RingGeometry(1.3, 1.68, 32);
    this.ringGeo.rotateX(-Math.PI / 2);

    this.uncataloguedRimGeo = new THREE.RingGeometry(1.72, 2.08, 36);
    this.uncataloguedRimGeo.rotateX(-Math.PI / 2);

    this.leviathanPlateGeo = new THREE.DodecahedronGeometry(0.55, 0);
    this.leviathanPlateGeo.scale(1.4, 0.45, 1.1);

    this.herbivoreBodyGeo = new THREE.CapsuleGeometry(0.95, 0.65, 14, 20);
    this.herbivoreBodyGeo.rotateX(Math.PI / 2);

    this.herbivoreCiliaGeo = new THREE.CylinderGeometry(0.05, 0.12, 0.65, 6);
    this.herbivoreCiliaGeo.rotateZ(Math.PI / 2);

    this.creatureLegGeo = new THREE.CapsuleGeometry(0.14, 0.72, 6, 8);
    this.creatureLegGeo.translate(0, -0.36, 0);

    this.geneCrystalGeo = new THREE.OctahedronGeometry(0.32, 0);
    this.geneCrystalGeo.scale(0.85, 1.45, 0.85);
    this.geneHaloGeo = new THREE.RingGeometry(0.4, 0.56, 20);
    this.geneHaloGeo.rotateX(-Math.PI / 2);

    this.sharedGeometries.push(
      this.predatorBodyGeo,
      this.sphericalBodyGeo,
      this.elongatedBodyGeo,
      this.medusaBellGeo,
      this.spongeTubeGeo,
      this.predatorCoreGeo,
      this.mandibleGeo,
      this.spineGeo,
      this.eyeGeo,
      this.tailGeo,
      this.ringGeo,
      this.uncataloguedRimGeo,
      this.leviathanPlateGeo,
      this.herbivoreBodyGeo,
      this.herbivoreCiliaGeo,
      this.creatureLegGeo,
      this.geneCrystalGeo,
      this.geneHaloGeo
    );

    // Shared Materials for all 13 species
    this.hunterBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x9f1239,
      emissive: 0x4c0519,
      emissiveIntensity: 0.35,
      roughness: 0.28,
      metalness: 0.15,
      clearcoat: 0.85,
      transparent: true,
      opacity: 0.92,
    });

    this.hunterMandibleMat = new THREE.MeshStandardMaterial({
      color: 0xfda4af,
      emissive: 0xe11d48,
      emissiveIntensity: 0.3,
      roughness: 0.25,
      metalness: 0.5,
    });

    this.leviathanBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x581c87,
      emissive: 0x3b0764,
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.3,
      clearcoat: 0.9,
      transparent: true,
      opacity: 0.95,
    });

    this.leviathanMandibleMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      metalness: 0.65,
    });

    this.herbivoreBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x2dd4bf,
      emissive: 0x0d9488,
      emissiveIntensity: 0.3,
      roughness: 0.15,
      metalness: 0.05,
      transmission: 0.6,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.86,
    });

    this.herbivoreCiliaMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xeab308,
      emissiveIntensity: 0.4,
      roughness: 0.4,
    });

    this.nematocitoBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      roughness: 0.15,
      transmission: 0.65,
      transparent: true,
      opacity: 0.84,
    });

    this.gasteropodoBodyMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x78350f,
      emissiveIntensity: 0.35,
      roughness: 0.72,
      metalness: 0.22,
    });

    this.perforadorBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xe2e8f0,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.55,
      clearcoat: 0.9,
    });

    this.viboraBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x65a30d,
      emissive: 0x365314,
      emissiveIntensity: 0.5,
      roughness: 0.28,
      clearcoat: 0.8,
      transparent: true,
      opacity: 0.92,
    });

    this.medusaBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.65,
      roughness: 0.1,
      transmission: 0.75,
      transparent: true,
      opacity: 0.82,
    });

    this.anquiloBodyMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      emissive: 0x451a03,
      emissiveIntensity: 0.3,
      roughness: 0.78,
      metalness: 0.3,
    });

    this.esponjaBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      transmission: 0.55,
      transparent: true,
      opacity: 0.88,
    });

    this.nebulaBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xc084fc,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.5,
      roughness: 0.12,
      transmission: 0.7,
      transparent: true,
      opacity: 0.82,
    });

    this.balaBodyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.68,
    });

    this.miradorBodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xf472b6,
      emissive: 0xbe185d,
      emissiveIntensity: 0.42,
      roughness: 0.2,
      clearcoat: 0.9,
      transparent: true,
      opacity: 0.9,
    });

    this.predatorEyeMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.2,
      roughness: 0.1,
    });

    this.herbivoreEyeMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.5,
      roughness: 0.15,
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
      this.predatorEyeMat,
      this.herbivoreEyeMat,
      this.geneCrystalMat,
      this.geneHaloMat
    );
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
      const group = new THREE.Group();
      group.scale.setScalar(profile.scaleMultiplier);

      let mandibleLeft: THREE.Mesh | null = null;
      let mandibleRight: THREE.Mesh | null = null;
      const tailSegments: THREE.Mesh[] = [];
      const attachedOrgans: OrganVisualInstance[] = [];

      const coreMat = new THREE.MeshStandardMaterial({
        color: profile.isHerbivore ? 0xfacc15 : 0xfb7185,
        emissive: profile.isHerbivore ? 0x10b981 : 0xf43f5e,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      });
      this.disposableMaterials.push(coreMat);

      // Build distinct 3D morphology + signature 3D organs for each species
      switch (speciesType) {
        case 'nematocito': {
          // 1. Nematocito Acordonado: Translucent sphere + multiple weapon_harpoon_cell + stalked eyes
          const body = new THREE.Mesh(
            this.sphericalBodyGeo,
            this.nematocitoBodyMat
          );
          group.add(body);
          const core = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(core);
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
          break;
        }

        case 'gasteropodo': {
          // 2. Gasterópodo Sulfuroso: Armored shell + mouth_radula
          const body = new THREE.Mesh(
            this.sphericalBodyGeo,
            this.gasteropodoBodyMat
          );
          body.scale.set(1.15, 0.95, 1.25);
          group.add(body);
          for (let s = 0; s < 3; s++) {
            const plate = new THREE.Mesh(
              this.leviathanPlateGeo,
              this.gasteropodoBodyMat
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
          break;
        }

        case 'perforador': {
          // 3. Perforador Abisal: Fusiform hunter + weapon_rotary_drill on head
          const body = new THREE.Mesh(
            this.predatorBodyGeo,
            this.perforadorBodyMat
          );
          group.add(body);
          const core = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(core);
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
          for (let t = 0; t < 3; t++) {
            const tailSeg = new THREE.Mesh(
              this.tailGeo,
              this.perforadorBodyMat
            );
            tailSeg.scale.setScalar(1 - t * 0.22);
            tailSeg.position.set(0, 0, 1.45 + t * 0.45);
            group.add(tailSeg);
            tailSegments.push(tailSeg);
          }
          break;
        }

        case 'vibora_fosa': {
          // 4. Víbora de Fosa: Segmented vermiform body + 2 weapon_caustic_acid_blister
          const body = new THREE.Mesh(
            this.elongatedBodyGeo,
            this.viboraBodyMat
          );
          group.add(body);
          for (let t = 0; t < 4; t++) {
            const tailSeg = new THREE.Mesh(this.tailGeo, this.viboraBodyMat);
            tailSeg.scale.setScalar(1.1 - t * 0.18);
            tailSeg.position.set(0, 0, 1.55 + t * 0.52);
            group.add(tailSeg);
            tailSegments.push(tailSeg);
          }
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
          // 5. Medusa Bioluminiscente: Translucent pulsing bell + weapon_flash_photophore
          const body = new THREE.Mesh(this.medusaBellGeo, this.medusaBodyMat);
          group.add(body);
          const core = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(core);
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
          break;
        }

        case 'anquilocelula': {
          // 6. Anquilocélula de Fondo: Hemispherical armored dome + weapon_tail_club + frontal shield
          const body = new THREE.Mesh(
            this.sphericalBodyGeo,
            this.anquiloBodyMat
          );
          body.scale.set(1.3, 0.78, 1.2);
          group.add(body);
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
          break;
        }

        case 'esponja_espicular': {
          // 7. Esponja Espicular: Crystalline tubular poriferan bristling with defense_silica_spicules
          const body = new THREE.Mesh(this.spongeTubeGeo, this.esponjaBodyMat);
          group.add(body);
          const core = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(core);
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
          // 8. Nébula Gelatinosa: Globular giant surrounded by defense_mucus_gland
          const body = new THREE.Mesh(
            this.sphericalBodyGeo,
            this.nebulaBodyMat
          );
          body.scale.set(1.25, 0.9, 1.25);
          group.add(body);
          const core = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(core);
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
          break;
        }

        case 'bala_fumarola': {
          // 9. Bala de Fumarola: Narrow tubular jet hunter propelled by movement_reactive_nozzle
          const body = new THREE.Mesh(this.elongatedBodyGeo, this.balaBodyMat);
          body.scale.set(0.82, 0.78, 1.25);
          group.add(body);
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
          break;
        }

        case 'mirador_abisal': {
          // 10. Mirador Abisal: 3 articulated sense_stalk_compound_eye + sense_abyssal_biolum_probe
          const body = new THREE.Mesh(
            this.herbivoreBodyGeo,
            this.miradorBodyMat
          );
          group.add(body);
          const core = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          group.add(core);
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
          break;
        }

        case 'hunter':
        case 'leviathan': {
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

          const coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          coreMesh.position.set(0, 0.05, 0.2);
          group.add(coreMesh);

          mandibleLeft = new THREE.Mesh(this.mandibleGeo, accentMat);
          mandibleLeft.position.set(isLeviathan ? -0.56 : -0.48, -0.05, -1.35);
          mandibleLeft.rotation.y = -0.25;
          if (isLeviathan) mandibleLeft.scale.set(1.35, 1.2, 1.25);
          group.add(mandibleLeft);

          mandibleRight = new THREE.Mesh(this.mandibleGeo, accentMat);
          mandibleRight.position.set(isLeviathan ? 0.56 : 0.48, -0.05, -1.35);
          mandibleRight.rotation.y = 0.25;
          if (isLeviathan) mandibleRight.scale.set(1.35, 1.2, 1.25);
          group.add(mandibleRight);

          if (isLeviathan) {
            for (let s = 0; s < 3; s++) {
              const plate = new THREE.Mesh(this.leviathanPlateGeo, accentMat);
              plate.position.set(0, 0.58 - s * 0.05, -0.35 + s * 0.62);
              group.add(plate);
            }
          } else {
            for (let s = 0; s < 3; s++) {
              const spine = new THREE.Mesh(this.spineGeo, accentMat);
              spine.position.set(0, 0.65 - s * 0.08, -0.3 + s * 0.55);
              spine.rotation.x = -0.35;
              group.add(spine);
            }
          }

          for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(this.eyeGeo, this.predatorEyeMat);
            eye.position.set(side * 0.52, 0.28, -0.82);
            group.add(eye);
          }

          for (let t = 0; t < 3; t++) {
            const tailSeg = new THREE.Mesh(this.tailGeo, bodyMat);
            const sFactor = 1 - t * 0.22;
            tailSeg.scale.setScalar(sFactor);
            tailSeg.position.set(0, 0, 1.45 + t * 0.45);
            group.add(tailSeg);
            tailSegments.push(tailSeg);
          }
          break;
        }

        default: {
          // HERBIVORE ("Célula Filtradora")
          const bodyMesh = new THREE.Mesh(
            this.herbivoreBodyGeo,
            this.herbivoreBodyMat
          );
          bodyMesh.castShadow = true;
          bodyMesh.receiveShadow = true;
          group.add(bodyMesh);

          const coreMesh = new THREE.Mesh(this.predatorCoreGeo, coreMat);
          coreMesh.scale.setScalar(0.85);
          group.add(coreMesh);

          for (const side of [-1, 1]) {
            const eye = new THREE.Mesh(this.eyeGeo, this.herbivoreEyeMat);
            eye.scale.setScalar(0.85);
            eye.position.set(side * 0.52, 0.26, -0.95);
            group.add(eye);
          }

          for (let c = 0; c < 3; c++) {
            const zOffset = -0.45 + c * 0.45;
            for (const side of [-1, 1]) {
              const cilium = new THREE.Mesh(
                this.herbivoreCiliaGeo,
                this.herbivoreCiliaMat
              );
              cilium.position.set(side * 0.98, 0, zOffset);
              group.add(cilium);
            }
          }

          for (let t = 0; t < 2; t++) {
            const tailSeg = new THREE.Mesh(
              this.tailGeo,
              this.herbivoreCiliaMat
            );
            tailSeg.scale.setScalar(0.75 - t * 0.2);
            tailSeg.position.set(0, 0, 1.3 + t * 0.4);
            group.add(tailSeg);
            tailSegments.push(tailSeg);
          }
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

      scene.add(group);

      const entity: OrganismEntity = {
        id: i + 1,
        species: speciesType,
        speciesName: profile.name,
        profile,
        group,
        position: group.position,
        headingAngle: Math.random() * Math.PI * 2,
        currentSpeed: profile.wanderSpeed,
        state: 'DEAMBULAR',
        active: true,
        respawnTimer: 0,
        stunTimer: 0,
        poisonTimer: 0,
        socialCooldown: 0,
        wanderTarget: new THREE.Vector3(),
        wanderRetargetTimer: 0,
        attackCooldown: 0,
        lungeTimer: 0,
        swimPhase: i * 1.15,
        mandibleLeft,
        mandibleRight,
        tailSegments,
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
    entity.currentSpeed = entity.profile.wanderSpeed;
    entity.state = 'DEAMBULAR';
    entity.active = true;
    entity.respawnTimer = 0;
    entity.stunTimer = 0;
    entity.poisonTimer = 0;
    entity.socialCooldown = 0;
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
    chitinSpikeStacks = 0
  ): {
    totalDamageDealt: number;
    attackerPosition: THREE.Vector3 | null;
    attackerSpeciesName: string | null;
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
    let totalDamageDealt = 0;
    let attackerPosition: THREE.Vector3 | null = null;
    let attackerSpeciesName: string | null = null;
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

    // Populate the 32m SpatialHashGrid with all active organisms for O(1) neighbor lookups
    this.spatialGrid.clear();
    for (let i = 0; i < this.organisms.length; i++) {
      const org = this.organisms[i];
      if (org.active) {
        this.spatialGrid.insert(org, org.position.x, org.position.z);
      }
    }

    for (let i = 0; i < this.organisms.length; i++) {
      const p = this.organisms[i];

      if (!p.active) {
        p.respawnTimer -= delta;
        if (p.respawnTimer <= 0) {
          this.spawnOrganismAtSafeRadius(p, i);
        } else {
          this.telemetryCache[i].distanceToPlayer = 999;
          continue;
        }
      }

      if (p.attackCooldown > 0) {
        p.attackCooldown = Math.max(0, p.attackCooldown - delta);
      }
      if (p.lungeTimer > 0) {
        p.lungeTimer = Math.max(0, p.lungeTimer - delta);
      }
      if (p.poisonTimer > 0) {
        p.poisonTimer = Math.max(0, p.poisonTimer - delta);
      }
      if (p.socialCooldown > 0) {
        p.socialCooldown = Math.max(0, p.socialCooldown - delta);
      }

      // Apply Spore Depth Plane Staging scale & depth offset
      const { effectiveScale, depthOffsetY } = this.getTieredScaleAndDepth(p);
      p.group.scale.setScalar(effectiveScale);

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
        p.geneMarkerCrystal.rotation.y += delta * 2.8;
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

          if (p.profile.isHerbivore) {
            if (onCellKilled) {
              onCellKilled(p.position, p.geneticTraits, p.speciesName, true);
            }
            p.active = false;
            p.group.visible = false;
            p.respawnTimer = 7.0;
            herbivoresHunted++;
            herbivoreAdnGained += 18;
            herbivoreEnergyGained += 30;
            killedByAcid = true;
            break;
          } else {
            if (onCellKilled) {
              onCellKilled(p.position, p.geneticTraits, p.speciesName, true);
            }
            p.position.x += pushX * 5.2;
            p.position.z += pushZ * 5.2;
            p.headingAngle = Math.atan2(-pushX, -pushZ);
            p.state = 'DEAMBULAR';
            p.attackCooldown = 2.8;
            p.lungeTimer = 0;
            p.wanderTarget.set(
              p.position.x + pushX * 26,
              GAME_CONFIG.WORLD.SWIM_PLANE_Y,
              p.position.z + pushZ * 26
            );
            p.wanderRetargetTimer = 4.2;
            acidHitsPredatorCount++;
            acidHitAdnGained += 10;
            break;
          }
        }
      }
      if (killedByAcid) {
        continue;
      }

      // --- 0A. BIOELECTRIC DISCHARGE SHOCKWAVE HIT (Radius 9.5m) ---
      if (electricPulseTriggered && distToPlayer <= electricPulseRadius) {
        if (p.profile.isHerbivore) {
          if (onCellKilled) {
            onCellKilled(p.position, p.geneticTraits, p.speciesName, true);
          }
          p.active = false;
          p.group.visible = false;
          p.respawnTimer = 7.0;
          electrocutedHerbivoresCount++;
          electrocutedAdnGained += 14;
          continue;
        } else {
          if (onCellKilled) {
            onCellKilled(p.position, p.geneticTraits, p.speciesName, true);
          }
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

          const invDist = distCloud > 0.01 ? 1 / distCloud : 1;
          const repelStep = 4.6 * delta;
          p.position.x += dxCloud * invDist * repelStep;
          p.position.z += dzCloud * invDist * repelStep;

          if (!p.profile.isHerbivore && p.stunTimer <= 0) {
            p.attackCooldown = Math.max(p.attackCooldown, 0.85);
          }
        }
      }

      // --- 0B-2. STAGE 3+ MACROCELL ABSORBING TIER 1 CELLS OR STAGE 5 ABSORBING TIER 2 ---
      const isStage3AbsorbingTier1 =
        ((this.playerGrowthStage >= 3 && p.profile.tier === 1) ||
          (this.playerGrowthStage >= 5 && p.profile.tier === 2)) &&
        distToPlayer <= 2.95;

      const canTakeDownHunter =
        !p.profile.isHerbivore &&
        distToPlayer <= 3.8 &&
        ((canDevourWeakenedHunters && (p.stunTimer > 0 || p.poisonTimer > 0)) ||
          (canHuntWithGraspingArms && distToPlayer <= 3.6) ||
          isStage3AbsorbingTier1);

      if (canTakeDownHunter) {
        if (onCellKilled) {
          onCellKilled(p.position, p.geneticTraits, p.speciesName, true);
        }
        p.active = false;
        p.group.visible = false;
        p.respawnTimer = 8.5;
        p.stunTimer = 0;
        p.poisonTimer = 0;
        huntersDevoured++;
        hunterAdnGained += canHuntWithGraspingArms ? 35 : 25;
        hunterEnergyGained += 38;
        continue;
      }

      // --- 0C. STUNNED STATE ('ATURDIDO') ---
      if (p.stunTimer > 0) {
        p.stunTimer = Math.max(0, p.stunTimer - delta);
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

        // Check player contact (dist <= 2.45m, or 2.9m in Stage 3 for Tier 1 micro-cells)
        const contactDist = isStage3AbsorbingTier1 ? 2.9 : 2.45;
        if (distToPlayer <= contactDist && p.socialCooldown <= 0) {
          if (
            canPredateHerbivores ||
            canCounterAttack ||
            canHuntWithGraspingArms ||
            isStage3AbsorbingTier1
          ) {
            if (onCellKilled) {
              onCellKilled(p.position, p.geneticTraits, p.speciesName, true);
            }
            p.active = false;
            p.group.visible = false;
            p.respawnTimer = 7.0;
            herbivoresHunted++;
            herbivoreAdnGained += p.profile.tier >= 2 ? 24 : 18;
            herbivoreEnergyGained += 30;
            continue;
          } else {
            // Defensive species (nematocito, esponja_espicular, medusa_biolum) sting/flash if player bumps them without weapons
            if (p.profile.attackDamage > 0 && p.attackCooldown <= 0) {
              totalDamageDealt += p.profile.attackDamage;
              attackerPosition = p.position;
              attackerSpeciesName = p.speciesName;
              p.attackCooldown = p.profile.attackCooldownSec;
            }
            const invDist = distToPlayer > 0.01 ? 1 / distToPlayer : 1;
            p.position.x -= dxToPlayer * invDist * 1.4;
            p.position.z -= dzToPlayer * invDist * 1.4;
            blockedHerbivoreHunt = true;
          }
        }

        // Evaluate closest threat using SpatialHashGrid neighbors
        let closestThreatDx = p.socialCooldown > 0 ? 999 : dxToPlayer;
        let closestThreatDz = p.socialCooldown > 0 ? 999 : dzToPlayer;
        let closestThreatDist = p.socialCooldown > 0 ? 999 : distToPlayer;

        for (let j = 0; j < neighbors.length; j++) {
          const other = neighbors[j];
          if (!other.active || other.profile.isHerbivore || other.id === p.id) {
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
          p.stateRingMat.color.setHex(p.poisonTimer > 0 ? 0x84cc16 : 0x38bdf8);
          p.stateRingMat.opacity = 0.65;
          p.coreMat.emissiveIntensity = 1.3;
        } else {
          p.wanderRetargetTimer -= delta;
          _toTarget.subVectors(p.wanderTarget, p.position);
          _toTarget.y = 0;

          if (_toTarget.lengthSq() < 16.0 || p.wanderRetargetTimer <= 0) {
            this.pickWanderTarget(p);
            _toTarget.subVectors(p.wanderTarget, p.position);
            _toTarget.y = 0;
          }

          p.stateRingMat.color.setHex(
            p.socialCooldown > 0
              ? 0x4ade80
              : p.poisonTimer > 0
              ? 0x84cc16
              : 0x2dd4bf
          );
          p.stateRingMat.opacity =
            p.socialCooldown > 0 ? 0.78 : p.poisonTimer > 0 ? 0.55 : 0.24;
          p.coreMat.emissiveIntensity = p.socialCooldown > 0 ? 1.4 : 0.75;
        }

        if (_toTarget.lengthSq() > 0.001) {
          const desiredHeading = Math.atan2(-_toTarget.x, -_toTarget.z);
          let angleDiff = desiredHeading - p.headingAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          p.headingAngle +=
            angleDiff * Math.min(1, GAME_CONFIG.PREDATOR.TURN_DAMPING * delta);
        }

        p.currentSpeed = THREE.MathUtils.damp(
          p.currentSpeed,
          targetSpeed,
          5.0,
          delta
        );

        _forward.set(-Math.sin(p.headingAngle), 0, -Math.cos(p.headingAngle));
        p.position.addScaledVector(_forward, p.currentSpeed * delta);

        const rSq = p.position.x * p.position.x + p.position.z * p.position.z;
        const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 3.0;
        if (rSq > maxR * maxR) {
          const r = Math.sqrt(rSq);
          p.position.x = (p.position.x / r) * maxR;
          p.position.z = (p.position.z / r) * maxR;
          this.pickWanderTarget(p);
        }

        p.position.y =
          GAME_CONFIG.WORLD.SWIM_PLANE_Y +
          depthOffsetY +
          Math.sin(elapsedTime * 3.0 + p.id) * 0.14;
        p.group.rotation.set(0, p.headingAngle, 0);

        p.swimPhase +=
          delta * (p.state === 'HUIR' ? 15.0 : 8.0) * poisonSpeedFactor;
        for (let t = 0; t < p.tailSegments.length; t++) {
          const seg = p.tailSegments[t];
          seg.position.x = Math.sin(p.swimPhase - t * 0.9) * 0.14;
        }
        if (p.legsGroup.visible && p.legs.length === 4) {
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
      const ramRadius = p.profile.tier === 3 ? 3.85 : 3.45;

      // Counter-attack check: if player has front spikes / rotary drill / harpoon and is boosting or ramming
      if (
        canCounterAttack &&
        distToPlayer < ramRadius &&
        p.attackCooldown <= 1.6
      ) {
        const pushDirX = distToPlayer > 0.01 ? -dxToPlayer / distToPlayer : 1;
        const pushDirZ = distToPlayer > 0.01 ? -dzToPlayer / distToPlayer : 0;

        p.position.x += pushDirX * 7.5;
        p.position.z += pushDirZ * 7.5;
        p.headingAngle = Math.atan2(-pushDirX, -pushDirZ);
        p.state = 'DEAMBULAR';
        p.attackCooldown = 2.6;
        p.lungeTimer = 0;
        p.wanderTarget.set(
          p.position.x + pushDirX * 28,
          GAME_CONFIG.WORLD.SWIM_PLANE_Y,
          p.position.z + pushDirZ * 28
        );
        p.wanderRetargetTimer = 4.5;

        if (onCellKilled) {
          onCellKilled(p.position, p.geneticTraits, p.speciesName, true);
        }

        if (p.profile.tier === 3) {
          repelledLeviathans++;
          leviathanBonusAdn += 12;
        } else {
          repelledHunters++;
          leviathanBonusAdn += 8;
        }
        continue;
      }

      // Find nearest active prey in the SpatialHashGrid neighborhood for AI-vs-AI battles!
      let nearestHerbivore: OrganismEntity | null = null;
      let distToHerbivore = Infinity;
      for (let j = 0; j < neighbors.length; j++) {
        const candidate = neighbors[j];
        if (!candidate.active || candidate.id === p.id) continue;
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
        p.wanderRetargetTimer -= delta;
        _toTarget.subVectors(p.wanderTarget, p.position);
        _toTarget.y = 0;

        if (_toTarget.lengthSq() < 16.0 || p.wanderRetargetTimer <= 0) {
          this.pickWanderTarget(p);
          _toTarget.subVectors(p.wanderTarget, p.position);
          _toTarget.y = 0;
        }

        targetSpeed = p.profile.wanderSpeed * locoFactor * poisonSpeedFactor;
        p.stateRingMat.color.setHex(
          p.poisonTimer > 0
            ? 0x84cc16
            : p.profile.tier === 3
            ? 0xa855f7
            : 0xf59e0b
        );
        p.stateRingMat.opacity = p.poisonTimer > 0 ? 0.6 : 0.24;
        p.coreMat.emissiveIntensity = 0.65;
      } else if (p.state === 'PERSEGUIR') {
        _toTarget.subVectors(activePreyPos, p.position);
        _toTarget.y = 0;
        targetSpeed = p.profile.activeSpeed * locoFactor * poisonSpeedFactor;

        p.stateRingMat.color.setHex(p.poisonTimer > 0 ? 0x84cc16 : 0xf97316);
        p.stateRingMat.opacity = 0.58;
        p.coreMat.emissiveIntensity = 1.25;
      } else {
        // ATACAR (against either AI Prey or Player)
        _toTarget.subVectors(activePreyPos, p.position);
        _toTarget.y = 0;
        targetSpeed =
          (p.lungeTimer > 0
            ? p.profile.activeSpeed * 1.28
            : p.profile.wanderSpeed * 0.65) *
          locoFactor *
          poisonSpeedFactor;

        p.stateRingMat.color.setHex(0xef4444);
        p.stateRingMat.opacity = 0.85;
        p.coreMat.emissiveIntensity = 1.8;

        if (
          p.attackCooldown <= 0 &&
          activePreyDist <= p.profile.attackRange
        ) {
          if (huntingHerbivore && nearestHerbivore) {
            // AI-vs-AI kill! Spawns meat + DNA spore + 30s scavengeable Genetic Nodule in the water!
            if (onCellKilled) {
              onCellKilled(
                nearestHerbivore.position,
                nearestHerbivore.geneticTraits,
                nearestHerbivore.speciesName,
                false
              );
            }
            nearestHerbivore.active = false;
            nearestHerbivore.group.visible = false;
            nearestHerbivore.respawnTimer = 7.0;
            predatorKilledHerbivoreCount++;
            p.attackCooldown = 2.0;
            p.lungeTimer = 0.3;
            p.state = 'DEAMBULAR';
            this.pickWanderTarget(p);
          } else if (!isPlayerAirborne) {
            const spikeRetaliationFactor = chitinSpikeStacks >= 2 ? 0.55 : 1.0;
            totalDamageDealt += Math.round(
              p.profile.attackDamage * spikeRetaliationFactor
            );
            attackerPosition = p.position;
            attackerSpeciesName = p.speciesName;
            p.attackCooldown = p.profile.attackCooldownSec;
            p.lungeTimer = 0.28;
            if (hasProboscis) {
              proboscisDrainedAdn += 5;
            }
            if (chitinSpikeStacks >= 2) {
              const pushDirX =
                distToPlayer > 0.01 ? -dxToPlayer / distToPlayer : 1;
              const pushDirZ =
                distToPlayer > 0.01 ? -dzToPlayer / distToPlayer : 0;
              p.position.x += pushDirX * 6.5;
              p.position.z += pushDirZ * 6.5;
              p.state = 'DEAMBULAR';
              p.attackCooldown = 2.5;
              if (onCellKilled) {
                onCellKilled(p.position, p.geneticTraits, p.speciesName, true);
              }
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

      if (_toTarget.lengthSq() > 0.001) {
        const desiredHeading = Math.atan2(-_toTarget.x, -_toTarget.z);
        let angleDiff = desiredHeading - p.headingAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        const turnRate =
          (p.profile.tier === 3
            ? GAME_CONFIG.PREDATOR.TURN_DAMPING * 0.72
            : GAME_CONFIG.PREDATOR.TURN_DAMPING) * poisonSpeedFactor;
        p.headingAngle += angleDiff * Math.min(1, turnRate * delta);
      }

      p.currentSpeed = THREE.MathUtils.damp(
        p.currentSpeed,
        targetSpeed,
        5.0,
        delta
      );

      _forward.set(-Math.sin(p.headingAngle), 0, -Math.cos(p.headingAngle));
      p.position.addScaledVector(_forward, p.currentSpeed * delta);

      const rSq = p.position.x * p.position.x + p.position.z * p.position.z;
      const maxR = GAME_CONFIG.WORLD.ARENA_RADIUS - 2.0;
      if (rSq > maxR * maxR) {
        const r = Math.sqrt(rSq);
        p.position.x = (p.position.x / r) * maxR;
        p.position.z = (p.position.z / r) * maxR;
        this.pickWanderTarget(p);
      }

      p.position.y =
        GAME_CONFIG.WORLD.SWIM_PLANE_Y +
        depthOffsetY +
        Math.sin(elapsedTime * 2.6 + p.id) * 0.14;
      p.group.rotation.set(0, p.headingAngle, 0);

      const swimMultiplier =
        (p.state === 'DEAMBULAR' ? 7.0 : 14.5) * poisonSpeedFactor;
      p.swimPhase += delta * swimMultiplier;

      for (let t = 0; t < p.tailSegments.length; t++) {
        const seg = p.tailSegments[t];
        const wave = Math.sin(p.swimPhase - t * 0.9);
        seg.position.x = wave * (0.14 + t * 0.1);
      }

      if (p.legsGroup.visible && p.legs.length === 4) {
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
            : Math.sin(p.swimPhase * 0.8) *
              (p.state === 'DEAMBULAR' ? 0.08 : 0.22);
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
