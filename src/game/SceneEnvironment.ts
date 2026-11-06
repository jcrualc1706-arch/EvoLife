import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GAME_CONFIG } from './config';
import { SpatialHashGrid } from './SpatialHashGrid';
import {
  BiomeType,
  CellularGrowthStage,
  EvolutionaryStage,
  PlanetTheme,
} from './types';

export interface PlanetPaletteConfig {
  waterColor: number;
  fogColor: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  dirLightColor: number;
  rimLightColor: number;
  seabedDeepColor: number;
  seabedRidgeColor: number;
  floraStalkColor: number;
  floraFrondColor: number;
  floraEmissiveColor: number;
}

export const PLANET_THEME_PALETTES: Record<PlanetTheme, PlanetPaletteConfig> = {
  oceanic: {
    waterColor: 0x041929,
    fogColor: 0x041929,
    hemiSkyColor: 0x5eead4,
    hemiGroundColor: 0x062033,
    dirLightColor: 0xa5f3fc,
    rimLightColor: 0x38bdf8,
    seabedDeepColor: 0x041b2d,
    seabedRidgeColor: 0x0c4a6e,
    floraStalkColor: 0x0d9488,
    floraFrondColor: 0x34d399,
    floraEmissiveColor: 0x10b981,
  },
  crystalline: {
    waterColor: 0x1a092b,
    fogColor: 0x180829,
    hemiSkyColor: 0xd8b4fe,
    hemiGroundColor: 0x2e1065,
    dirLightColor: 0xe9d5ff,
    rimLightColor: 0xc084fc,
    seabedDeepColor: 0x17042a,
    seabedRidgeColor: 0x4c1d95,
    floraStalkColor: 0x7c3aed,
    floraFrondColor: 0xc084fc,
    floraEmissiveColor: 0x9333ea,
  },
  volcanic: {
    waterColor: 0x220708,
    fogColor: 0x200607,
    hemiSkyColor: 0xfca5a5,
    hemiGroundColor: 0x450a0a,
    dirLightColor: 0xfecaca,
    rimLightColor: 0xf87171,
    seabedDeepColor: 0x1c0506,
    seabedRidgeColor: 0x7f1d1d,
    floraStalkColor: 0x991b1b,
    floraFrondColor: 0xf87171,
    floraEmissiveColor: 0xef4444,
  },
  toxic: {
    waterColor: 0x081f12,
    fogColor: 0x071b10,
    hemiSkyColor: 0xbbf7d0,
    hemiGroundColor: 0x052e16,
    dirLightColor: 0xdcfce7,
    rimLightColor: 0x4ade80,
    seabedDeepColor: 0x051a0e,
    seabedRidgeColor: 0x14532d,
    floraStalkColor: 0x15803d,
    floraFrondColor: 0x86efac,
    floraEmissiveColor: 0x22c55e,
  },
  desertic: {
    waterColor: 0x241808,
    fogColor: 0x211607,
    hemiSkyColor: 0xfde68a,
    hemiGroundColor: 0x451a03,
    dirLightColor: 0xfef3c7,
    rimLightColor: 0xfbbf24,
    seabedDeepColor: 0x1f1406,
    seabedRidgeColor: 0x78350f,
    floraStalkColor: 0xb45309,
    floraFrondColor: 0xfcd34d,
    floraEmissiveColor: 0xf59e0b,
  },
  terrene: {
    waterColor: 0x031c26,
    fogColor: 0x031a23,
    hemiSkyColor: 0x6ee7b7,
    hemiGroundColor: 0x022c22,
    dirLightColor: 0xccfbf1,
    rimLightColor: 0x2dd4bf,
    seabedDeepColor: 0x02161f,
    seabedRidgeColor: 0x134e4a,
    floraStalkColor: 0x047857,
    floraFrondColor: 0x6ee7b7,
    floraEmissiveColor: 0x10b981,
  },
};

export interface EnvironmentObstacle {
  x: number;
  z: number;
  minY: number;
  maxY: number;
  radius: number;
}

export interface FruitNode {
  mesh: THREE.Mesh;
  isHarvested: boolean;
  respawnTimer: number;
}

export interface FruitBushEntity {
  position: THREE.Vector3;
  bushGroup: THREE.Group;
  fruits: FruitNode[];
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _baseColorA = new THREE.Color();
const _baseColorB = new THREE.Color();
const _baseColorC = new THREE.Color();

export function getGroundHeightAt(x: number, z: number): number {
  const distSq = x * x + z * z;
  const dist = Math.sqrt(distSq);
  const ripples =
    Math.sin(x * 0.055) * Math.cos(z * 0.055) * 1.35 +
    Math.sin(x * 0.16 + z * 0.14) * 0.45;

  // Natural volcanic/reef basin rim around the 240m arena perimeter
  const rimFactor = THREE.MathUtils.smoothstep(
    dist,
    GAME_CONFIG.WORLD.ARENA_RADIUS - 18,
    GAME_CONFIG.WORLD.ARENA_RADIUS + 34
  );
  const rimHeight = rimFactor * 12.5;

  // Deepened seabed (-7.2 base) so Spore-style abyssal silhouettes & 12m giant kelp fit naturally
  return -7.2 + ripples + rimHeight;
}

export const CONTINENT_CONFIG = {
  CONTINENT_RADIUS: 1200, // Radio del continente emergido (2.4 km de diámetro)
  SHALLOW_WATER_LIMIT: 1350, // Zona de playa y aguas poco profundas
  OCEAN_ABYSS_LIMIT: 1500, // Océano profundo donde acecha el Leviatán
  CHUNK_SIZE: 128, // Tamaño de cada bloque de terreno
  VISIBLE_CHUNK_RADIUS: 4, // Radio de chunks activos alrededor del jugador
};

export interface TerrainChunk {
  chunkX: number;
  chunkZ: number;
  mesh: THREE.Mesh;
  boundingBox: THREE.Box3;
  assigned: boolean;
}

const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();

export function getLandHeightAt(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z);

  // 1. Máscara Continental: Cae suavemente bajo el nivel del mar (Y < 0) al acercarse a la costa
  const continentMask =
    1.0 -
    THREE.MathUtils.smoothstep(dist, 700, CONTINENT_CONFIG.CONTINENT_RADIUS);
  const oceanDepression =
    THREE.MathUtils.smoothstep(
      dist,
      CONTINENT_CONFIG.CONTINENT_RADIUS,
      1600
    ) * -22.0;

  // 2. Llanura segura del Nido Central (Radio < 40m)
  if (dist < 40) {
    return 1.2 + Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.2;
  }

  // 3. Relieve Continental Multiescala (Montañas, Valles y Colinas)
  const macroHills = Math.sin(x * 0.005) * Math.cos(z * 0.005) * 35.0; // Cordilleras grandes
  const mesoHills =
    Math.sin(x * 0.015 + 1.2) * Math.cos(z * 0.015 + 0.8) * 12.0; // Lomas medias
  const microDetail = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2.5; // Rugosidad del suelo

  const landElevation = (macroHills + mesoHills + microDetail) * continentMask;
  const fullContinentY = Math.max(-25.0, 1.0 + landElevation + oceanDepression);

  // Transición suave entre la plataforma del nido (40m) y el relieve continental (72m)
  if (dist < 72) {
    const nestPlainY = 1.2 + Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.2;
    const blend = THREE.MathUtils.smoothstep(dist, 40, 72);
    return THREE.MathUtils.lerp(nestPlainY, fullContinentY, blend);
  }

  return fullContinentY;
}

interface AbyssalSilhouette {
  group: THREE.Group;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  centerX: number;
  centerZ: number;
  baseScale: number;
  tailSegments: THREE.Mesh[];
  fins: THREE.Mesh[];
  phaseOffset: number;
}

const THERMAL_VENT_COORDS: readonly [number, number][] = [
  [-42, 0],
  [-52, -26],
  [-68, -10],
  [-54, 26],
  [-40, 42],
  [-98, -48],
  [-118, 14],
  [-145, -28],
  [-132, 68],
  [-195, -55],
  [-228, 32],
  [-255, -82],
];

export class SceneEnvironment {
  public readonly scene: THREE.Scene;
  private currentStage: EvolutionaryStage = 'cell_stage';
  private currentGrowthStage: CellularGrowthStage = 1;
  private currentPlanetTheme: PlanetTheme = 'oceanic';
  private envTexture: THREE.Texture | null = null;
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private fogExp2!: THREE.FogExp2;
  private fogDensityMultiplier = 1.0;
  private userFogDistanceMultiplier = 1.0;
  private stageFogFactor = 1.0;
  private currentParticleQuality: 'low' | 'medium' | 'high' = 'high';
  private isEditorSandboxActive = false;
  private bgColor!: THREE.Color;

  public seabedMesh!: THREE.Mesh;
  private seabedMat!: THREE.MeshStandardMaterial;
  private rocksInstanced!: THREE.InstancedMesh;
  private rockCapsInstanced!: THREE.InstancedMesh;
  private rockBaseMat!: THREE.MeshStandardMaterial;
  private rockCapMat!: THREE.MeshStandardMaterial;
  private kelpStalksInstanced!: THREE.InstancedMesh;
  private kelpBladesInstanced!: THREE.InstancedMesh;
  private chloroplastCoreInstanced!: THREE.InstancedMesh;
  private chloroplastStalkMat!: THREE.MeshPhysicalMaterial;
  private chloroplastFrondMat!: THREE.MeshStandardMaterial;
  private chloroplastCoreMat!: THREE.MeshBasicMaterial;
  private readonly chloroplastTreePositions: THREE.Vector3[] = [];
  private readonly chloroplastTreeBaseScales: {
    scaleXZ: number;
    scaleY: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    isGiantZone: boolean;
  }[] = [];
  private electricCoralInstanced!: THREE.InstancedMesh;
  private electricCoralMat!: THREE.MeshStandardMaterial;
  private brainCoralInstanced!: THREE.InstancedMesh;
  private giantAnemoneInstanced!: THREE.InstancedMesh;
  private fossilShellsInstanced!: THREE.InstancedMesh;
  private planktonPoints!: THREE.Points;
  private causticRingMesh!: THREE.Mesh;

  // 3D Species Nest at (0, 0) for Terrestrial Creature Stage
  private nestGroup!: THREE.Group;
  private nestAuraMat!: THREE.MeshBasicMaterial;
  private readonly nestEggs: THREE.Mesh[] = [];

  // Massive Spore Continent Chunk System (LOD + Frustum Culling) & Ocean / Leviathan
  public continentChunksGroup!: THREE.Group;
  public get terrainMesh(): THREE.Object3D {
    return this.continentChunksGroup;
  }
  private readonly terrainChunks: TerrainChunk[] = [];
  private lowPolyContinentProxyMesh!: THREE.Mesh;
  private oceanWaterMesh!: THREE.Mesh;
  private oceanWaterMat!: THREE.MeshStandardMaterial;
  private lastChunkCenterX = Number.NaN;
  private lastChunkCenterZ = Number.NaN;
  private chunksInitialized = false;
  private leviathanGroup!: THREE.Group;
  private leviathanSplashRing!: THREE.Mesh;
  private leviathanJawMesh!: THREE.Mesh;
  private leviathanBreachTimer = 0;
  private readonly leviathanOrigin = new THREE.Vector3();

  // Macroscopic Continental Flora (Trees, Bushes, Giant Ferns & Rival Nests) & Trunk Colliders
  private treesTrunkInstanced!: THREE.InstancedMesh;
  private treesFoliageInstanced!: THREE.InstancedMesh;
  private bushesInstanced!: THREE.InstancedMesh;
  private fernsInstanced!: THREE.InstancedMesh;
  private rivalNestsInstanced!: THREE.InstancedMesh;
  public fruitBushes: FruitBushEntity[] = [];
  public treeColliders: { x: number; z: number; radius: number }[] = [];
  public readonly rivalNestPositions: THREE.Vector3[] = [];
  private readonly landObstacles: EnvironmentObstacle[] = [];
  private readonly landObstacleSpatialGrid =
    new SpatialHashGrid<EnvironmentObstacle>();

  // Hydrothermal Vents & Ascending Bubble Plumes
  private readonly ventPositions: THREE.Vector3[] = [];
  private readonly ventGroups: THREE.Group[] = [];
  private readonly ventAuraMeshes: THREE.Mesh[] = [];
  private readonly ventAuraMats: THREE.MeshBasicMaterial[] = [];
  private ventBubblesPoints!: THREE.Points;
  private readonly ventBubbleCount = 160;
  private readonly ventBubblePositions: Float32Array;
  private readonly ventBubbleBaseXZ: Float32Array;

  // Spore-style Colossal Abyssal Background Silhouettes (Depth Plane Staging)
  private readonly abyssalSilhouettes: AbyssalSilhouette[] = [];

  // 3D Spore Laboratory Petri Dish Sandbox & Coastal Sandy Nest Platform + 3-Point Studio Lighting Rig
  private sandboxGroup!: THREE.Group;
  private sandboxPetriDishSubgroup!: THREE.Group;
  private sandboxCoastalNestSubgroup!: THREE.Group;
  private sandboxPulseRingMat!: THREE.MeshBasicMaterial;
  private sandboxHexGridMesh!: THREE.Mesh;
  private sandboxKeyLight!: THREE.SpotLight;
  private sandboxFillLight!: THREE.DirectionalLight;
  private sandboxRimLight!: THREE.DirectionalLight;

  private readonly kelpCount = 220;
  private readonly planktonCount = 720;
  private readonly planktonPositions: Float32Array;
  private readonly obstacles: EnvironmentObstacle[] = [];
  private readonly treeObstacleRefList: EnvironmentObstacle[] = [];
  private readonly obstacleSpatialGrid = new SpatialHashGrid<EnvironmentObstacle>();
  private readonly rawCellObstaclesBuffer: EnvironmentObstacle[] = [];
  private readonly nearbyObstaclesResult: EnvironmentObstacle[] = [];
  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableMaterials: THREE.Material[] = [];

  constructor(renderer: THREE.WebGLRenderer) {
    this.scene = new THREE.Scene();
    this.bgColor = new THREE.Color(GAME_CONFIG.WORLD.WATER_COLOR);
    this.scene.background = this.bgColor;
    this.fogExp2 = new THREE.FogExp2(
      GAME_CONFIG.WORLD.FOG_COLOR,
      GAME_CONFIG.WORLD.FOG_DENSITY
    );
    this.scene.fog = this.fogExp2;

    this.planktonPositions = new Float32Array(this.planktonCount * 3);
    this.ventBubblePositions = new Float32Array(this.ventBubbleCount * 3);
    this.ventBubbleBaseXZ = new Float32Array(this.ventBubbleCount * 2);

    this.initEnvironmentMap(renderer);
    this.initLights();
    this.initSeabed();
    this.initRocks();
    this.initUnderwaterFlora();
    this.initThemedInstancedZones();
    this.initHydrothermalVents();
    this.initAbyssalSilhouettes();
    this.initPlanktonParticles();
    this.initArenaBoundaryMarker();
    this.initSpeciesNest();
    this.initContinentChunkSystem();
    this.initContinentalFlora();
    this.initFruitBushes();
    this.initEditorSandbox();
    this.rebuildObstacleSpatialGrid();
  }

  private registerObstacle(
    x: number,
    z: number,
    minY: number,
    maxY: number,
    radius: number
  ): EnvironmentObstacle {
    const obs: EnvironmentObstacle = { x, z, minY, maxY, radius };
    this.obstacles.push(obs);
    return obs;
  }

  private registerLandObstacle(
    x: number,
    z: number,
    minY: number,
    maxY: number,
    radius: number
  ): EnvironmentObstacle {
    const obs: EnvironmentObstacle = { x, z, minY, maxY, radius };
    this.landObstacles.push(obs);
    return obs;
  }

  private rebuildObstacleSpatialGrid(): void {
    this.obstacleSpatialGrid.clear();
    for (let i = 0; i < this.obstacles.length; i++) {
      const obs = this.obstacles[i];
      this.obstacleSpatialGrid.insert(obs, obs.x, obs.z);
    }

    this.landObstacleSpatialGrid.clear();
    for (let i = 0; i < this.landObstacles.length; i++) {
      const obs = this.landObstacles[i];
      this.landObstacleSpatialGrid.insert(obs, obs.x, obs.z);
    }
  }

  /**
   * Queries nearby solid 2D circular obstacles (continental tree trunks in creature_stage;
   * rocks, chloroplast tree trunks, hydrothermal vents, and reef formations in cell_stage)
   * using the O(1) SpatialHashGrid so creatures and AI organisms slide smoothly around them.
   */
  public getNearbyObstacles(
    x: number,
    z: number,
    searchRadius: number
  ): EnvironmentObstacle[] {
    this.nearbyObstaclesResult.length = 0;
    if (this.isEditorSandboxActive) {
      return this.nearbyObstaclesResult;
    }

    const cellRadius = Math.max(
      1,
      Math.ceil((searchRadius + 3.5) / GAME_CONFIG.WORLD.SPATIAL_GRID_CELL_SIZE)
    );
    const activeGrid =
      this.currentStage === 'creature_stage'
        ? this.landObstacleSpatialGrid
        : this.obstacleSpatialGrid;
    const candidates = activeGrid.queryCells(
      x,
      z,
      cellRadius,
      this.rawCellObstaclesBuffer
    );

    for (let i = 0; i < candidates.length; i++) {
      const obs = candidates[i];
      const dx = x - obs.x;
      const dz = z - obs.z;
      const maxDist = searchRadius + obs.radius;
      if (dx * dx + dz * dz <= maxDist * maxDist) {
        this.nearbyObstaclesResult.push(obs);
      }
    }

    return this.nearbyObstaclesResult;
  }

  public getBiomeAt(x: number, z: number): { id: BiomeType; name: string } {
    const radius = Math.sqrt(x * x + z * z);
    if (this.currentStage === 'creature_stage') {
      const elev = getLandHeightAt(x, z);
      if (radius < 45) {
        return { id: 'pradera_luminosa', name: 'Nido Central de la Especie' };
      }
      if (radius > CONTINENT_CONFIG.SHALLOW_WATER_LIMIT || elev < -4.0) {
        return {
          id: 'arrecife_abisal',
          name: 'Aguas Profundas (Dominio del Leviatán)',
        };
      }
      if (radius > CONTINENT_CONFIG.CONTINENT_RADIUS - 120 || elev < 0.8) {
        return {
          id: 'pradera_luminosa',
          name: 'Playa y Plataforma Costera',
        };
      }
      if (elev > 16.0) {
        return { id: 'fosa_termal', name: 'Cordillera Continental' };
      }
      return { id: 'pradera_luminosa', name: 'Valles y Colinas Continentales' };
    }

    if (radius < 52) {
      return { id: 'pradera_luminosa', name: 'Pradera de Cloroplastos' };
    }
    if (z < -65) {
      return { id: 'arrecife_abisal', name: 'Campos de Fósiles Abisales' };
    }
    if (z > 65 && x > -30) {
      return { id: 'pradera_luminosa', name: 'Bosque de Árboles de Cloroplastos' };
    }
    if (x < 0) {
      return { id: 'fosa_termal', name: 'Fosa Hidrotermal' };
    }
    return { id: 'arrecife_abisal', name: 'Mesetas de Coral Eléctrico' };
  }

  public getChloroplastTreePositions(maxRadius = 320): THREE.Vector3[] {
    const maxRSq = maxRadius * maxRadius;
    return this.chloroplastTreePositions.filter(
      (pos) => pos.x * pos.x + pos.z * pos.z <= maxRSq
    );
  }

  public isNearThermalVent(x: number, z: number): boolean {
    for (let i = 0; i < this.ventPositions.length; i++) {
      const vp = this.ventPositions[i];
      const dx = x - vp.x;
      const dz = z - vp.z;
      if (dx * dx + dz * dz <= 9.0 * 9.0) {
        return true;
      }
    }
    return false;
  }

  public isNearNest(x: number, z: number): boolean {
    if (this.currentStage !== 'creature_stage') return false;
    return x * x + z * z <= 8.0 * 8.0;
  }

  /**
   * Spore Depth Plane Staging across 5 Cellular Growth Stages (1 -> 2 -> 3 -> 4 -> 5):
   * Adjusts fog clarity, arena perimeter ring, chloroplast tree evolutionary height, and deep silhouette elevation.
   */
  public setGrowthStageDepthLayer(stage: CellularGrowthStage): void {
    this.currentGrowthStage = stage;
    const fogFactors: Record<CellularGrowthStage, number> = {
      1: 1.0,
      2: 0.88,
      3: 0.76,
      4: 0.65,
      5: 0.54,
    };
    this.stageFogFactor = fogFactors[stage] ?? 1.0;

    // Update arena perimeter caustic ring to match active stage radius (110 -> 165 -> 220 -> 275 -> 320)
    const stageRadii: Record<CellularGrowthStage, number> = {
      1: 110,
      2: 165,
      3: 220,
      4: 275,
      5: 320,
    };
    const activeRadius = stageRadii[stage] ?? 110;
    if (this.causticRingMesh) {
      const ringScale = activeRadius / GAME_CONFIG.WORLD.ARENA_RADIUS;
      this.causticRingMesh.scale.set(ringScale, 1, ringScale);
    }

    this.updateChloroplastTreesForStage(stage);
  }

  public setStageEnvironment(stage: EvolutionaryStage): void {
    this.currentStage = stage;
    const isLand = stage === 'creature_stage';
    const cfg =
      PLANET_THEME_PALETTES[this.currentPlanetTheme] ??
      PLANET_THEME_PALETTES.oceanic;

    if (this.nestGroup) {
      this.buildPlayerNest();
      this.nestGroup.visible = !this.isEditorSandboxActive && isLand;
    }
    if (this.causticRingMesh) {
      this.causticRingMesh.visible = !this.isEditorSandboxActive && !isLand;
    }

    const showAquaticProps = !this.isEditorSandboxActive && !isLand;
    if (this.kelpStalksInstanced) {
      this.kelpStalksInstanced.visible = showAquaticProps;
    }
    if (this.kelpBladesInstanced) {
      this.kelpBladesInstanced.visible = showAquaticProps;
    }
    if (this.chloroplastCoreInstanced) {
      this.chloroplastCoreInstanced.visible = showAquaticProps;
    }
    if (this.electricCoralInstanced) {
      this.electricCoralInstanced.visible = showAquaticProps;
    }
    if (this.brainCoralInstanced) {
      this.brainCoralInstanced.visible = showAquaticProps;
    }
    if (this.giantAnemoneInstanced) {
      this.giantAnemoneInstanced.visible = showAquaticProps;
    }
    if (this.fossilShellsInstanced) {
      this.fossilShellsInstanced.visible = showAquaticProps;
    }
    for (let i = 0; i < this.ventGroups.length; i++) {
      this.ventGroups[i].visible = showAquaticProps;
    }
    for (let i = 0; i < this.ventAuraMeshes.length; i++) {
      this.ventAuraMeshes[i].visible = showAquaticProps;
    }
    for (const s of this.abyssalSilhouettes) {
      s.group.visible = showAquaticProps;
    }
    if (this.ventBubblesPoints) {
      this.ventBubblesPoints.visible =
        showAquaticProps && this.currentParticleQuality !== 'low';
    }
    const showLandProps = !this.isEditorSandboxActive && isLand;
    if (this.continentChunksGroup) {
      this.continentChunksGroup.visible = showLandProps;
    }
    if (this.lowPolyContinentProxyMesh) {
      this.lowPolyContinentProxyMesh.visible = showLandProps;
    }
    if (this.oceanWaterMesh) {
      this.oceanWaterMesh.visible = showLandProps;
    }
    if (this.treesTrunkInstanced) {
      this.treesTrunkInstanced.visible = showLandProps;
    }
    if (this.treesFoliageInstanced) {
      this.treesFoliageInstanced.visible = showLandProps;
    }
    if (this.bushesInstanced) {
      this.bushesInstanced.visible = showLandProps;
    }
    if (this.fernsInstanced) {
      this.fernsInstanced.visible = showLandProps;
    }
    if (this.rivalNestsInstanced) {
      this.rivalNestsInstanced.visible = showLandProps;
    }
    for (const bush of this.fruitBushes) {
      bush.bushGroup.visible = showLandProps;
    }
    if (this.rocksInstanced) {
      this.rocksInstanced.visible = showAquaticProps;
    }
    if (this.rockCapsInstanced) {
      this.rockCapsInstanced.visible = showAquaticProps;
    }
    if (this.seabedMesh) {
      this.seabedMesh.visible = showAquaticProps;
    }

    this.rebuildTerrainForStage(stage);

    if (isLand) {
      this.fogExp2.density = 0.0016;
      this.seabedMat.color.setHex(0xffffff);
      this.bgColor.setHex(0x38bdf8);
      this.fogExp2.color.setHex(0x7dd3fc);
      this.hemiLight.color.setHex(0xfef08a);
      this.hemiLight.groundColor.setHex(0x3f6212);
      this.hemiLight.intensity = 1.45;
      this.dirLight.color.setHex(0xfffbeb);
      this.dirLight.intensity = 2.25;
      this.rimLight.color.setHex(0xfef08a);
      this.rimLight.intensity = 1.1;
    } else {
      this.fogExp2.density =
        GAME_CONFIG.WORLD.FOG_DENSITY * this.stageFogFactor;
      this.seabedMat.color.setHex(0xffffff);
      this.bgColor.setHex(cfg.waterColor);
      this.fogExp2.color.setHex(cfg.fogColor);
      this.hemiLight.color.setHex(cfg.hemiSkyColor);
      this.hemiLight.groundColor.setHex(cfg.hemiGroundColor);
      this.hemiLight.intensity = 1.15;
      this.dirLight.color.setHex(cfg.dirLightColor);
      this.dirLight.intensity = 2.1;
      this.rimLight.color.setHex(cfg.rimLightColor);
      this.rimLight.intensity = 0.85;
    }
  }

  public buildPlayerNest(): void {
    if (!this.nestGroup) return;
    const nestBaseY = getLandHeightAt(0, 0);
    this.nestGroup.position.set(0, nestBaseY - 0.12, 0);
  }

  private rebuildTerrainForStage(stage: EvolutionaryStage): void {
    const isLand = stage === 'creature_stage';
    const cfg =
      PLANET_THEME_PALETTES[this.currentPlanetTheme] ??
      PLANET_THEME_PALETTES.oceanic;

    if (isLand) {
      this.chunksInitialized = false;
      this.updateContinentChunks(0, 0);

      // Sincronización matemática estricta de seabedMesh con getLandHeightAt
      if (this.seabedMesh) {
        this.seabedMesh.updateMatrixWorld(true);
        const geo = this.seabedMesh.geometry as THREE.PlaneGeometry;
        const posAttr = geo.attributes.position as THREE.BufferAttribute;
        const colorAttr = geo.attributes.color as THREE.BufferAttribute;
        const localVertex = new THREE.Vector3();

        if (posAttr && colorAttr) {
          for (let i = 0; i < posAttr.count; i++) {
            localVertex.set(
              posAttr.getX(i),
              posAttr.getY(i),
              posAttr.getZ(i)
            );
            localVertex.applyMatrix4(this.seabedMesh.matrixWorld);

            const height = getLandHeightAt(localVertex.x, localVertex.z);
            posAttr.setY(i, height);

            this.computeContinentVertexColor(
              localVertex.x,
              localVertex.z,
              height,
              _color
            );
            colorAttr.setXYZ(i, _color.r, _color.g, _color.b);
          }
          posAttr.needsUpdate = true;
          colorAttr.needsUpdate = true;
          geo.computeVertexNormals();
          geo.computeBoundingBox();
          geo.computeBoundingSphere();
        }
      }
    } else if (this.seabedMesh) {
      const geo = this.seabedMesh.geometry;
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const colorAttr = geo.attributes.color as THREE.BufferAttribute;
      if (posAttr && colorAttr) {
        _baseColorA.setHex(cfg.seabedDeepColor);
        _baseColorB.setHex(cfg.seabedRidgeColor);
        _baseColorC.setHex(cfg.floraStalkColor);
        const thermalTint = new THREE.Color(0x7c2d12);
        const reefTint = new THREE.Color(cfg.rimLightColor).multiplyScalar(0.38);
        const fossilTint = new THREE.Color(0x3f3f46);

        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vz = posAttr.getZ(i);
          const vy = getGroundHeightAt(vx, vz);
          posAttr.setY(i, vy);

          const heightNorm = THREE.MathUtils.clamp((vy + 8.5) / 10.5, 0, 1);
          _color.copy(_baseColorA).lerp(_baseColorB, heightNorm);

          const dist = Math.sqrt(vx * vx + vz * vz);
          if (vz < -65) {
            _color.lerp(fossilTint, 0.26);
          } else if (dist >= 48 && vx < 0) {
            _color.lerp(thermalTint, 0.24);
          } else if (dist >= 48 && vx >= 0) {
            _color.lerp(reefTint, 0.26);
          }

          const causticWave =
            Math.sin(vx * 0.25) * Math.cos(vz * 0.25) * 0.5 + 0.5;
          if (causticWave > 0.68 && vy < 1.0) {
            _color.lerp(_baseColorC, (causticWave - 0.68) * 0.65);
          }

          colorAttr.setXYZ(i, _color.r, _color.g, _color.b);
        }
        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
        geo.computeVertexNormals();
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
      }
    }

    if (this.rocksInstanced && this.rockCapsInstanced) {
      const rockCount = this.rocksInstanced.count;
      for (let i = 0; i < rockCount; i++) {
        const isRim = i >= 120;
        const angle = (i / rockCount) * Math.PI * 2 + i * 1.618;
        const radius = isRim
          ? GAME_CONFIG.WORLD.ARENA_RADIUS + (i % 9) * 2.8
          : 18 + ((i * 23) % (GAME_CONFIG.WORLD.ARENA_RADIUS - 24));
        const effectiveRadius =
          isLand && radius < 30 ? 30 + (i % 12) * 1.5 : radius;
        const rx = Math.cos(angle) * effectiveRadius;
        const rz = Math.sin(angle) * effectiveRadius;
        const ry =
          (isLand ? getLandHeightAt(rx, rz) : getGroundHeightAt(rx, rz)) - 0.3;

        const scaleXZ = isRim ? 2.8 + (i % 5) * 0.85 : 1.0 + (i % 5) * 0.55;
        const scaleY = isRim ? 3.2 + (i % 4) * 1.1 : 1.3 + (i % 4) * 0.85;

        _dummy.position.set(rx, ry, rz);
        _dummy.rotation.set(
          ((i % 5) - 2) * 0.08,
          (i * 1.1) % (Math.PI * 2),
          ((i % 3) - 1) * 0.08
        );
        _dummy.scale.set(scaleXZ, scaleY, scaleXZ);
        _dummy.updateMatrix();

        this.rocksInstanced.setMatrixAt(i, _dummy.matrix);
        this.rockCapsInstanced.setMatrixAt(i, _dummy.matrix);

        const shade = 0.72 + (i % 5) * 0.08;
        if (isLand) {
          _color.setRGB(0.46 * shade, 0.42 * shade, 0.36 * shade);
          this.rocksInstanced.setColorAt(i, _color);
          _color.setRGB(0.35 * shade, 0.52 * shade, 0.24 * shade);
          this.rockCapsInstanced.setColorAt(i, _color);
        } else {
          _baseColorA.setHex(cfg.seabedRidgeColor);
          _baseColorB.setHex(cfg.floraStalkColor);
          _color.copy(_baseColorA).multiplyScalar(shade * 1.15);
          this.rocksInstanced.setColorAt(i, _color);
          _color.copy(_baseColorB).multiplyScalar(shade * 0.95);
          this.rockCapsInstanced.setColorAt(i, _color);
        }
      }
      this.rocksInstanced.instanceMatrix.needsUpdate = true;
      this.rockCapsInstanced.instanceMatrix.needsUpdate = true;
      if (this.rocksInstanced.instanceColor) {
        this.rocksInstanced.instanceColor.needsUpdate = true;
      }
      if (this.rockCapsInstanced.instanceColor) {
        this.rockCapsInstanced.instanceColor.needsUpdate = true;
      }
    }

    for (let i = 0; i < this.treeObstacleRefList.length; i++) {
      const treeObs = this.treeObstacleRefList[i];
      const pos = this.chloroplastTreePositions[i];
      const scaleCfg = this.chloroplastTreeBaseScales[i];
      if (!treeObs || !pos || !scaleCfg) continue;
      if (isLand) {
        treeObs.minY = -999;
        treeObs.maxY = -990;
      } else {
        treeObs.minY = pos.y;
        treeObs.maxY = pos.y + 11.8 * scaleCfg.scaleY * 0.88;
      }
    }
  }

  /**
   * Dynamically applies the selected planet's visual biome palette (water, fog, lighting,
   * seabed terrain vertex colors, rocks, and chloroplast trees) while keeping all creatures untouched.
   */
  public applyPlanetPalette(theme: PlanetTheme): void {
    this.currentPlanetTheme = theme;
    const cfg =
      PLANET_THEME_PALETTES[theme] ?? PLANET_THEME_PALETTES.oceanic;

    if (this.currentStage !== 'creature_stage' && !this.isEditorSandboxActive) {
      this.bgColor.setHex(cfg.waterColor);
      this.fogExp2.color.setHex(cfg.fogColor);
      this.hemiLight.color.setHex(cfg.hemiSkyColor);
      this.hemiLight.groundColor.setHex(cfg.hemiGroundColor);
      this.dirLight.color.setHex(cfg.dirLightColor);
      this.rimLight.color.setHex(cfg.rimLightColor);
    }

    this.rebuildTerrainForStage(this.currentStage);

    // 2. Update Rocks & Rock Caps colors to harmonize with the planet's seabed
    if (this.rockBaseMat && this.rockCapMat) {
      this.rockBaseMat.color.setHex(0xffffff);
      this.rockCapMat.color.setHex(0xffffff);
    }
    if (this.rocksInstanced && this.rockCapsInstanced) {
      _baseColorA.setHex(cfg.seabedRidgeColor);
      _baseColorB.setHex(cfg.floraStalkColor);
      const count = this.rocksInstanced.count;
      for (let i = 0; i < count; i++) {
        const shade = 0.72 + (i % 5) * 0.08;
        _color.copy(_baseColorA).multiplyScalar(shade * 1.15);
        this.rocksInstanced.setColorAt(i, _color);

        _color.copy(_baseColorB).multiplyScalar(shade * 0.95);
        this.rockCapsInstanced.setColorAt(i, _color);
      }
      if (this.rocksInstanced.instanceColor) {
        this.rocksInstanced.instanceColor.needsUpdate = true;
      }
      if (this.rockCapsInstanced.instanceColor) {
        this.rockCapsInstanced.instanceColor.needsUpdate = true;
      }
    }

    // 3. Update Chloroplast Trees (Trunks, Fronds, and Inner Cores) to match the planet's flora palette
    if (this.chloroplastStalkMat) {
      this.chloroplastStalkMat.color.setHex(cfg.floraStalkColor);
      this.chloroplastStalkMat.emissive
        .setHex(cfg.floraStalkColor)
        .multiplyScalar(0.55);
    }
    if (this.chloroplastFrondMat) {
      this.chloroplastFrondMat.color.setHex(cfg.floraFrondColor);
      this.chloroplastFrondMat.emissive.setHex(cfg.floraEmissiveColor);
    }
    if (this.chloroplastCoreMat) {
      this.chloroplastCoreMat.color
        .setHex(cfg.floraFrondColor)
        .lerp(new THREE.Color(0xffffff), 0.38);
    }

    if (
      this.kelpStalksInstanced &&
      this.kelpBladesInstanced &&
      this.chloroplastCoreInstanced
    ) {
      const stalkHSL = { h: 0, s: 0, l: 0 };
      const frondHSL = { h: 0, s: 0, l: 0 };
      _baseColorA.setHex(cfg.floraStalkColor).getHSL(stalkHSL);
      _baseColorB.setHex(cfg.floraFrondColor).getHSL(frondHSL);

      for (let i = 0; i < this.kelpCount; i++) {
        const hueShift = ((i % 5) - 2) * 0.015;
        const lightShift = ((i % 3) - 1) * 0.04;

        // Since material.color is already tinted with cfg.floraStalkColor / cfg.floraFrondColor,
        // keep instance colors bright with subtle organic shade variation so vertex * material color stays vivid
        const shade = 0.86 + (i % 4) * 0.06;
        _color.setRGB(shade, shade, shade);
        _color.offsetHSL(hueShift, 0, lightShift * 0.5);
        this.kelpStalksInstanced.setColorAt(i, _color);
        this.kelpBladesInstanced.setColorAt(i, _color);
        this.chloroplastCoreInstanced.setColorAt(i, _color);
      }
      if (this.kelpStalksInstanced.instanceColor) {
        this.kelpStalksInstanced.instanceColor.needsUpdate = true;
      }
      if (this.kelpBladesInstanced.instanceColor) {
        this.kelpBladesInstanced.instanceColor.needsUpdate = true;
      }
      if (this.chloroplastCoreInstanced.instanceColor) {
        this.chloroplastCoreInstanced.instanceColor.needsUpdate = true;
      }
    }

    // 4. Update Arena Boundary Caustic Ring & Suspended Plankton Particles
    if (this.causticRingMesh) {
      const ringMat = this.causticRingMesh.material as THREE.MeshBasicMaterial;
      ringMat.color.setHex(cfg.rimLightColor);
    }
    if (this.planktonPoints) {
      const colorAttr = this.planktonPoints.geometry.getAttribute(
        'color'
      ) as THREE.BufferAttribute;
      if (colorAttr) {
        const baseHSL = { h: 0.5, s: 0.8, l: 0.7 };
        _baseColorA.setHex(cfg.hemiSkyColor).getHSL(baseHSL);
        for (let i = 0; i < this.planktonCount; i++) {
          const h = (baseHSL.h + ((i % 7) - 3) * 0.02 + 1.0) % 1.0;
          const l = THREE.MathUtils.clamp(
            0.62 + (i % 5) * 0.06,
            0.45,
            0.92
          );
          _color.setHSL(h, Math.max(0.65, baseHSL.s), l);
          colorAttr.setXYZ(i, _color.r, _color.g, _color.b);
        }
        colorAttr.needsUpdate = true;
      }
    }
  }

  public setVisionFogMultiplier(multiplier: number): void {
    this.fogDensityMultiplier = THREE.MathUtils.clamp(multiplier, 0.45, 1.85);
  }

  public setUserFogDistancePercent(percent: number): void {
    const clamped = THREE.MathUtils.clamp(percent, 50, 150);
    // Higher fog distance percent = less dense fog (multiplier = 100 / clamped)
    this.userFogDistanceMultiplier = 100 / clamped;
  }

  public setParticleQuality(quality: 'low' | 'medium' | 'high'): void {
    this.currentParticleQuality = quality;
    if (this.planktonPoints) {
      this.planktonPoints.visible =
        !this.isEditorSandboxActive && quality !== 'low';
      const mat = this.planktonPoints.material as THREE.PointsMaterial;
      mat.opacity = quality === 'high' ? 0.65 : 0.42;
    }
    if (this.ventBubblesPoints) {
      this.ventBubblesPoints.visible =
        !this.isEditorSandboxActive && quality !== 'low';
    }
  }

  /**
   * Switches the 3D scene between the open aquatic/terrestrial ecosystem and
   * an isolated Spore-style Petri Dish Laboratory Sandbox with 3-point studio lighting.
   */
  public setEditorSandboxMode(
    active: boolean,
    playerPosition?: THREE.Vector3
  ): void {
    this.isEditorSandboxActive = active;
    const showWorld = !active;
    const isLand = this.currentStage === 'creature_stage';

    // Toggle world terrain, flora, corals, vents, silhouettes & particles
    this.seabedMesh.visible = showWorld && !isLand;
    if (this.continentChunksGroup) {
      this.continentChunksGroup.visible = showWorld && isLand;
    }
    if (this.lowPolyContinentProxyMesh) {
      this.lowPolyContinentProxyMesh.visible = showWorld && isLand;
    }
    if (this.oceanWaterMesh) {
      this.oceanWaterMesh.visible = showWorld && isLand;
    }
    if (this.treesTrunkInstanced) {
      this.treesTrunkInstanced.visible = showWorld && isLand;
    }
    if (this.treesFoliageInstanced) {
      this.treesFoliageInstanced.visible = showWorld && isLand;
    }
    if (this.bushesInstanced) {
      this.bushesInstanced.visible = showWorld && isLand;
    }
    if (this.fernsInstanced) {
      this.fernsInstanced.visible = showWorld && isLand;
    }
    if (this.rivalNestsInstanced) {
      this.rivalNestsInstanced.visible = showWorld && isLand;
    }
    for (const bush of this.fruitBushes) {
      bush.bushGroup.visible = showWorld && isLand;
    }
    this.rocksInstanced.visible = showWorld && !isLand;
    this.rockCapsInstanced.visible = showWorld && !isLand;
    this.kelpStalksInstanced.visible = showWorld && !isLand;
    this.kelpBladesInstanced.visible = showWorld && !isLand;
    if (this.chloroplastCoreInstanced) {
      this.chloroplastCoreInstanced.visible = showWorld && !isLand;
    }
    this.electricCoralInstanced.visible = showWorld && !isLand;
    this.brainCoralInstanced.visible = showWorld && !isLand;
    this.giantAnemoneInstanced.visible = showWorld && !isLand;
    this.fossilShellsInstanced.visible = showWorld && !isLand;
    this.causticRingMesh.visible = showWorld && !isLand;
    this.nestGroup.visible = showWorld && isLand;

    for (let i = 0; i < this.ventGroups.length; i++) {
      this.ventGroups[i].visible = showWorld && !isLand;
    }
    for (let i = 0; i < this.ventAuraMeshes.length; i++) {
      this.ventAuraMeshes[i].visible = showWorld && !isLand;
    }
    for (let i = 0; i < this.abyssalSilhouettes.length; i++) {
      this.abyssalSilhouettes[i].group.visible = showWorld && !isLand;
    }

    this.planktonPoints.visible =
      showWorld && this.currentParticleQuality !== 'low';
    this.ventBubblesPoints.visible =
      showWorld && !isLand && this.currentParticleQuality !== 'low';

    // Toggle 3D Petri Dish / Coastal Nest Sandbox & 3-Point Studio Lighting Rig
    this.sandboxGroup.visible = active;
    if (this.sandboxPetriDishSubgroup && this.sandboxCoastalNestSubgroup) {
      this.sandboxPetriDishSubgroup.visible = active && !isLand;
      this.sandboxCoastalNestSubgroup.visible = active && isLand;
    }
    this.sandboxKeyLight.visible = active;
    this.sandboxFillLight.visible = active;
    this.sandboxRimLight.visible = active;

    if (active) {
      const px = playerPosition ? playerPosition.x : 0;
      const py = playerPosition
        ? playerPosition.y
        : GAME_CONFIG.WORLD.SWIM_PLANE_Y;
      const pz = playerPosition ? playerPosition.z : 0;

      this.sandboxGroup.position.set(px, isLand ? 0 : py - 1.25, pz);
      this.sandboxKeyLight.position.set(px + 2.5, (isLand ? 0 : py) + 18.0, pz + 3.5);
      this.sandboxKeyLight.target.position.set(px, isLand ? 0 : py, pz);
      this.sandboxKeyLight.target.updateMatrixWorld();

      this.sandboxFillLight.position.set(px - 14.0, py + 9.0, pz + 12.0);
      this.sandboxFillLight.target.position.set(px, py, pz);
      this.sandboxFillLight.target.updateMatrixWorld();

      this.sandboxRimLight.position.set(px + 12.0, py + 7.5, pz - 14.0);
      this.sandboxRimLight.target.position.set(px, py, pz);
      this.sandboxRimLight.target.updateMatrixWorld();

      if (isLand) {
        // Warm diurnal coastal sun ambiance for Terrestrial Creature Workshop
        this.sandboxKeyLight.color.setHex(0xfef3c7);
        this.sandboxKeyLight.intensity = 3.6;
        this.sandboxFillLight.color.setHex(0x38bdf8);
        this.sandboxRimLight.color.setHex(0xfde047);
        this.dirLight.intensity = 1.15;
        this.hemiLight.color.setHex(0xfef08a);
        this.hemiLight.groundColor.setHex(0x78350f);
        this.hemiLight.intensity = 1.45;
        this.bgColor.setHex(0x0b293b);
        this.fogExp2.color.copy(this.bgColor);
        this.fogExp2.density = 0.0018;
      } else {
        this.sandboxKeyLight.color.setHex(0xf0fdfa);
        this.sandboxKeyLight.intensity = 3.2;
        this.sandboxFillLight.color.setHex(0x38bdf8);
        this.sandboxRimLight.color.setHex(0x34d399);
        this.dirLight.intensity = 0.65;
        this.hemiLight.color.setHex(0x67e8f9);
        this.hemiLight.groundColor.setHex(0x041e2e);
        this.hemiLight.intensity = 1.25;
        this.bgColor.setHex(0x02101b);
        this.fogExp2.color.copy(this.bgColor);
        this.fogExp2.density = 0.0022;
      }
    } else {
      this.dirLight.intensity = 2.1;
      this.setStageEnvironment(this.currentStage);
    }
  }

  private initEnvironmentMap(renderer: THREE.WebGLRenderer): void {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const renderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    this.envTexture = renderTarget.texture;
    this.scene.environment = this.envTexture;
    roomEnv.dispose();
    pmremGenerator.dispose();
  }

  private initLights(): void {
    this.hemiLight = new THREE.HemisphereLight(0x5eead4, 0x062033, 1.15);
    this.hemiLight.position.set(0, 65, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xa5f3fc, 2.1);
    this.dirLight.position.set(35, 70, 30);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    const d = 85;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 160;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    this.rimLight.position.set(-45, 28, -40);
    this.scene.add(this.rimLight);
  }

  private initSeabed(): void {
    const size = 740;
    const segments = 160;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    const deepColor = new THREE.Color(0x041b2d);
    const ridgeColor = new THREE.Color(0x0c4a6e);
    const causticTint = new THREE.Color(0x0d9488);
    const thermalTint = new THREE.Color(0x7c2d12);
    const reefTint = new THREE.Color(0x312e81);
    const fossilTint = new THREE.Color(0x3f3f46);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = getGroundHeightAt(vx, vz);
      posAttr.setY(i, vy);

      const heightNorm = THREE.MathUtils.clamp((vy + 8.5) / 10.5, 0, 1);
      _color.copy(deepColor).lerp(ridgeColor, heightNorm);

      const dist = Math.sqrt(vx * vx + vz * vz);
      if (vz < -65) {
        _color.lerp(fossilTint, 0.32);
      } else if (dist >= 48 && vx < 0) {
        _color.lerp(thermalTint, 0.28);
      } else if (dist >= 48 && vx >= 0) {
        _color.lerp(reefTint, 0.3);
      }

      const causticWave =
        Math.sin(vx * 0.25) * Math.cos(vz * 0.25) * 0.5 + 0.5;
      if (causticWave > 0.68 && vy < 1.0) {
        _color.lerp(causticTint, (causticWave - 0.68) * 0.65);
      }

      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    this.seabedMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.06,
    });

    this.seabedMesh = new THREE.Mesh(geometry, this.seabedMat);
    this.seabedMesh.receiveShadow = true;
    this.scene.add(this.seabedMesh);

    this.disposableGeometries.push(geometry);
    this.disposableMaterials.push(this.seabedMat);
  }

  private initRocks(): void {
    const rockCount = 190;
    const baseGeo = new THREE.DodecahedronGeometry(1.5, 1);
    baseGeo.translate(0, 0.78, 0);
    const capGeo = new THREE.IcosahedronGeometry(0.95, 1);
    capGeo.translate(0.35, 1.4, 0.2);

    this.rockBaseMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.12,
    });
    this.rockCapMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.18,
    });

    this.rocksInstanced = new THREE.InstancedMesh(
      baseGeo,
      this.rockBaseMat,
      rockCount
    );
    this.rockCapsInstanced = new THREE.InstancedMesh(
      capGeo,
      this.rockCapMat,
      rockCount
    );
    this.rocksInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.rockCapsInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.rocksInstanced.frustumCulled = true;
    this.rockCapsInstanced.frustumCulled = true;
    this.rocksInstanced.castShadow = true;
    this.rocksInstanced.receiveShadow = true;

    for (let i = 0; i < rockCount; i++) {
      const isRim = i >= 120;
      const angle = (i / rockCount) * Math.PI * 2 + i * 1.618;
      const radius = isRim
        ? GAME_CONFIG.WORLD.ARENA_RADIUS + (i % 9) * 2.8
        : 18 + ((i * 23) % (GAME_CONFIG.WORLD.ARENA_RADIUS - 24));

      const rx = Math.cos(angle) * radius;
      const rz = Math.sin(angle) * radius;
      const ry = getGroundHeightAt(rx, rz) - 0.3;

      const scaleXZ = isRim ? 2.8 + (i % 5) * 0.85 : 1.0 + (i % 5) * 0.55;
      const scaleY = isRim ? 3.2 + (i % 4) * 1.1 : 1.3 + (i % 4) * 0.85;

      _dummy.position.set(rx, ry, rz);
      _dummy.rotation.set(
        ((i % 5) - 2) * 0.08,
        (i * 1.1) % (Math.PI * 2),
        ((i % 3) - 1) * 0.08
      );
      _dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      _dummy.updateMatrix();

      this.rocksInstanced.setMatrixAt(i, _dummy.matrix);
      this.rockCapsInstanced.setMatrixAt(i, _dummy.matrix);

      // Register rock collider (0.8m - 1.5m radius) ONLY if it actually reaches the aquatic swimming layer
      const rockTopY = ry + scaleY * 2.2;
      if (isRim || rockTopY >= 0.8) {
        const rockColliderRadius = THREE.MathUtils.clamp(
          scaleXZ * 0.55,
          0.8,
          1.5
        );
        this.registerObstacle(rx, rz, ry, rockTopY, rockColliderRadius);
      }

      const shade = 0.72 + (i % 5) * 0.08;
      _color.setRGB(0.12 * shade, 0.26 * shade, 0.34 * shade);
      this.rocksInstanced.setColorAt(i, _color);

      _color.setRGB(0.08 * shade, 0.38 * shade, 0.35 * shade);
      this.rockCapsInstanced.setColorAt(i, _color);
    }

    this.rocksInstanced.instanceMatrix.needsUpdate = true;
    if (this.rocksInstanced.instanceColor) {
      this.rocksInstanced.instanceColor.needsUpdate = true;
    }
    this.rocksInstanced.computeBoundingSphere();

    this.rockCapsInstanced.instanceMatrix.needsUpdate = true;
    if (this.rockCapsInstanced.instanceColor) {
      this.rockCapsInstanced.instanceColor.needsUpdate = true;
    }
    this.rockCapsInstanced.computeBoundingSphere();

    this.scene.add(this.rocksInstanced);
    this.scene.add(this.rockCapsInstanced);

    this.disposableGeometries.push(baseGeo, capGeo);
    this.disposableMaterials.push(this.rockBaseMat, this.rockCapMat);
  }

  private initUnderwaterFlora(): void {
    // Procedural Chloroplast Tree System:
    // 1. Translucent Cellulose Trunk with organic curve & upper bifurcation (11.8m towering height)
    const stalkGeo = new THREE.CylinderGeometry(0.18, 0.44, 11.8, 10, 8);
    stalkGeo.translate(0, 5.9, 0);
    const stalkPos = stalkGeo.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < stalkPos.count; v++) {
      const vy = stalkPos.getY(v);
      const heightRatio = vy / 11.8;
      // Organic sinusoidal S-curve along the cellulose trunk + flared root base
      const curveX = Math.sin(heightRatio * Math.PI * 1.25) * 0.42;
      const curveZ = Math.cos(heightRatio * Math.PI * 0.95) * 0.32 - 0.32;
      const rootFlare = heightRatio < 0.16 ? 1.0 + (0.16 - heightRatio) * 2.1 : 1.0;
      const crownFlare = heightRatio > 0.82 ? 1.0 + (heightRatio - 0.82) * 2.4 : 1.0;
      stalkPos.setX(v, stalkPos.getX(v) * rootFlare * crownFlare + curveX);
      stalkPos.setZ(v, stalkPos.getZ(v) * rootFlare * crownFlare + curveZ);
    }
    stalkGeo.computeVertexNormals();

    // 2. Bioluminescent Chloroplast Canopy Fronds (elevated high above normal swim plane)
    const bladeGeo = new THREE.SphereGeometry(1.65, 16, 12);
    bladeGeo.scale(1.85, 0.52, 1.65);
    bladeGeo.translate(0.35, 12.0, 0);

    // 3. Inner Thylakoid Grana Core (glowing photosynthetic discs visible inside the canopy)
    const coreGeo = new THREE.TorusKnotGeometry(0.72, 0.2, 32, 8, 2, 3);
    coreGeo.rotateX(Math.PI / 2);
    coreGeo.scale(1.35, 0.45, 1.35);
    coreGeo.translate(0.35, 12.0, 0);

    this.chloroplastStalkMat = new THREE.MeshPhysicalMaterial({
      color: 0x0d9488,
      emissive: 0x065f46,
      emissiveIntensity: 0.35,
      roughness: 0.26,
      metalness: 0.05,
      transmission: 0.45,
      thickness: 0.9,
      ior: 1.38,
      clearcoat: 0.85,
      transparent: true,
      opacity: 0.9,
    });

    this.chloroplastFrondMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.08,
      transparent: true,
      opacity: 0.88,
    });

    this.chloroplastCoreMat = new THREE.MeshBasicMaterial({
      color: 0xa7f3d0,
      transparent: true,
      opacity: 0.78,
    });

    this.kelpStalksInstanced = new THREE.InstancedMesh(
      stalkGeo,
      this.chloroplastStalkMat,
      this.kelpCount
    );
    this.kelpBladesInstanced = new THREE.InstancedMesh(
      bladeGeo,
      this.chloroplastFrondMat,
      this.kelpCount
    );
    this.chloroplastCoreInstanced = new THREE.InstancedMesh(
      coreGeo,
      this.chloroplastCoreMat,
      this.kelpCount
    );
    this.kelpStalksInstanced.frustumCulled = true;
    this.kelpBladesInstanced.frustumCulled = true;
    this.chloroplastCoreInstanced.frustumCulled = true;

    this.chloroplastTreePositions.length = 0;
    this.chloroplastTreeBaseScales.length = 0;

    for (let i = 0; i < this.kelpCount; i++) {
      let kx: number;
      let kz: number;
      let isGiantKelpZone = false;

      if (i < 36) {
        // Inner Stage 1 Chloroplast Sprouts ring (12m .. 82m) so player finds trees immediately
        const a = (i / 36) * Math.PI * 2 + (i % 3) * 0.18;
        const r = 14 + ((i * 17) % 68);
        kx = Math.cos(a) * r;
        kz = Math.sin(a) * r;
      } else if (i < 115) {
        isGiantKelpZone = true;
        const a = ((i - 36) / 79) * Math.PI * 0.85 + Math.PI * 0.08;
        const r = 52 + ((i * 19) % 175);
        kx = Math.cos(a) * r;
        kz = Math.abs(Math.sin(a) * r) + 32;
      } else {
        const angle = i * 2.39996;
        const radius =
          18 +
          Math.sqrt(i / this.kelpCount) * (GAME_CONFIG.WORLD.ARENA_RADIUS - 12);
        kx = Math.cos(angle) * radius;
        kz = Math.sin(angle) * radius;
      }

      const ky = getGroundHeightAt(kx, kz) - 0.15;
      const baseScaleY = isGiantKelpZone
        ? 1.35 + (i % 6) * 0.18
        : 0.95 + (i % 7) * 0.18;
      const baseScaleXZ = isGiantKelpZone
        ? 1.15 + (i % 4) * 0.2
        : 0.85 + (i % 4) * 0.16;

      const rotX = ((i % 5) - 2) * 0.04;
      const rotY = (i * 0.7) % (Math.PI * 2);
      const rotZ = ((i % 3) - 1) * 0.04;

      this.chloroplastTreePositions.push(new THREE.Vector3(kx, ky, kz));
      this.chloroplastTreeBaseScales.push({
        scaleXZ: baseScaleXZ,
        scaleY: baseScaleY,
        rotX,
        rotY,
        rotZ,
        isGiantZone: isGiantKelpZone,
      });

      // Register solid trunk collider (0.75m - 1.2m radius) only for physical trunk span
      const initialTrunkRadius = THREE.MathUtils.clamp(
        baseScaleXZ * 0.82,
        0.75,
        1.2
      );
      const treeTopY = ky + 11.8 * baseScaleY * 0.88;
      const treeObs = this.registerObstacle(
        kx,
        kz,
        ky,
        treeTopY,
        initialTrunkRadius
      );
      this.treeObstacleRefList.push(treeObs);

      const shade = 0.86 + (i % 4) * 0.06;
      _color.setRGB(shade, shade, shade);
      this.kelpStalksInstanced.setColorAt(i, _color);
      this.kelpBladesInstanced.setColorAt(i, _color);
      this.chloroplastCoreInstanced.setColorAt(i, _color);
    }

    if (this.kelpStalksInstanced.instanceColor) {
      this.kelpStalksInstanced.instanceColor.needsUpdate = true;
    }
    if (this.kelpBladesInstanced.instanceColor) {
      this.kelpBladesInstanced.instanceColor.needsUpdate = true;
    }
    if (this.chloroplastCoreInstanced.instanceColor) {
      this.chloroplastCoreInstanced.instanceColor.needsUpdate = true;
    }

    this.updateChloroplastTreesForStage(1);

    this.scene.add(this.kelpStalksInstanced);
    this.scene.add(this.kelpBladesInstanced);
    this.scene.add(this.chloroplastCoreInstanced);

    this.disposableGeometries.push(stalkGeo, bladeGeo, coreGeo);
    this.disposableMaterials.push(
      this.chloroplastStalkMat,
      this.chloroplastFrondMat,
      this.chloroplastCoreMat
    );
  }

  /**
   * Scales Chloroplast Trees across the 5 evolutionary cellular stages:
   * - Stage 1: Small chloroplast sprouts (6m-11m)
   * - Stage 2: Branched chloroplast colonies (12m-14m)
   * - Stage 3: Medium chloroplast trees (15m-18m)
   * - Stage 4: Giant underwater chloroplast forests (19m-22m)
   * - Stage 5: Colossal ancestral chloroplast trees (23m-27m)
   */
  private updateChloroplastTreesForStage(stage: CellularGrowthStage): void {
    if (!this.kelpStalksInstanced || !this.kelpBladesInstanced) return;

    const stageHeightMultipliers: Record<CellularGrowthStage, number> = {
      1: 0.92,
      2: 1.22,
      3: 1.55,
      4: 1.9,
      5: 2.3,
    };
    const stageWidthMultipliers: Record<CellularGrowthStage, number> = {
      1: 0.85,
      2: 1.0,
      3: 1.18,
      4: 1.38,
      5: 1.65,
    };

    const hMult = stageHeightMultipliers[stage] ?? 1.0;
    const wMult = stageWidthMultipliers[stage] ?? 1.0;

    for (let i = 0; i < this.chloroplastTreePositions.length; i++) {
      const pos = this.chloroplastTreePositions[i];
      const cfg = this.chloroplastTreeBaseScales[i];

      _dummy.position.copy(pos);
      _dummy.rotation.set(cfg.rotX, cfg.rotY, cfg.rotZ);
      _dummy.scale.set(
        cfg.scaleXZ * wMult,
        cfg.scaleY * hMult,
        cfg.scaleXZ * wMult
      );
      _dummy.updateMatrix();

      this.kelpStalksInstanced.setMatrixAt(i, _dummy.matrix);
      this.kelpBladesInstanced.setMatrixAt(i, _dummy.matrix);
      this.chloroplastCoreInstanced.setMatrixAt(i, _dummy.matrix);

      const treeObs = this.treeObstacleRefList[i];
      if (treeObs) {
        treeObs.minY = pos.y;
        treeObs.maxY = pos.y + 11.8 * cfg.scaleY * hMult * 0.88;
        treeObs.radius = THREE.MathUtils.clamp(
          cfg.scaleXZ * wMult * 0.82,
          0.75,
          1.2
        );
      }
    }

    this.kelpStalksInstanced.instanceMatrix.needsUpdate = true;
    this.kelpBladesInstanced.instanceMatrix.needsUpdate = true;
    this.chloroplastCoreInstanced.instanceMatrix.needsUpdate = true;
    this.kelpStalksInstanced.computeBoundingSphere();
    this.kelpBladesInstanced.computeBoundingSphere();
  }

  /**
   * Initializes static InstancedMeshes with Frustum Culling for:
   * 1) Mesetas de Coral Eléctrico (crystalline cyan-flashing formations)
   * 2) Corales Cerebro & Anémonas Gigantes
   * 3) Campos de Fósiles Abisales (giant fossilized ammonite shells & tectonic ribs)
   */
  private initThemedInstancedZones(): void {
    // 1. Electric Coral Plateaus (East / Southeast sector)
    const coralCount = 90;
    const coralGeo = new THREE.ConeGeometry(0.65, 3.6, 6);
    coralGeo.translate(0, 1.8, 0);
    this.electricCoralMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.95,
      roughness: 0.2,
      metalness: 0.45,
      flatShading: true,
    });

    this.electricCoralInstanced = new THREE.InstancedMesh(
      coralGeo,
      this.electricCoralMat,
      coralCount
    );
    this.electricCoralInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.electricCoralInstanced.frustumCulled = true;

    for (let i = 0; i < coralCount; i++) {
      const angle = (i / coralCount) * Math.PI * 1.1 - Math.PI * 0.45;
      const r = 42 + ((i * 29) % (GAME_CONFIG.WORLD.ARENA_RADIUS - 65));
      const cx = Math.abs(Math.cos(angle) * r) + 24;
      const cz = Math.sin(angle) * r;
      const cy = getGroundHeightAt(cx, cz) - 0.2;

      _dummy.position.set(cx, cy, cz);
      _dummy.rotation.set(
        ((i % 5) - 2) * 0.14,
        (i * 1.3) % (Math.PI * 2),
        ((i % 3) - 1) * 0.14
      );
      const s = 0.8 + (i % 5) * 0.35;
      _dummy.scale.set(s, s * (1.0 + (i % 4) * 0.28), s);
      _dummy.updateMatrix();
      this.electricCoralInstanced.setMatrixAt(i, _dummy.matrix);

      _color.setHSL(0.52 + (i % 4) * 0.03, 0.92, 0.58);
      this.electricCoralInstanced.setColorAt(i, _color);
    }
    this.electricCoralInstanced.instanceMatrix.needsUpdate = true;
    if (this.electricCoralInstanced.instanceColor) {
      this.electricCoralInstanced.instanceColor.needsUpdate = true;
    }
    this.electricCoralInstanced.computeBoundingSphere();
    this.scene.add(this.electricCoralInstanced);

    // 2. Brain Corals & Giant Anemones (Pure visual benthic reef decor, hasCollision = false)
    const reefPropCount = 85;
    const brainGeo = new THREE.IcosahedronGeometry(1.15, 2);
    brainGeo.scale(1.2, 0.72, 1.2);
    brainGeo.translate(0, 0.55, 0);
    const brainMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x6b21a8,
      emissiveIntensity: 0.45,
      roughness: 0.65,
      metalness: 0.1,
    });

    const anemoneGeo = new THREE.TorusKnotGeometry(0.75, 0.22, 36, 8, 2, 3);
    anemoneGeo.rotateX(Math.PI / 2);
    anemoneGeo.translate(0, 1.25, 0);
    const anemoneMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xdb2777,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    });

    this.brainCoralInstanced = new THREE.InstancedMesh(
      brainGeo,
      brainMat,
      reefPropCount
    );
    this.giantAnemoneInstanced = new THREE.InstancedMesh(
      anemoneGeo,
      anemoneMat,
      reefPropCount
    );
    this.brainCoralInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.giantAnemoneInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.brainCoralInstanced.frustumCulled = true;
    this.giantAnemoneInstanced.frustumCulled = true;

    for (let i = 0; i < reefPropCount; i++) {
      const a = i * 2.39996 + 0.5;
      const r = 20 + Math.sqrt(i / reefPropCount) * (GAME_CONFIG.WORLD.ARENA_RADIUS - 30);
      const bx = Math.cos(a) * r;
      const bz = Math.sin(a) * r;
      const by = getGroundHeightAt(bx, bz) - 0.15;

      _dummy.position.set(bx, by, bz);
      _dummy.rotation.set(0, (i * 0.9) % (Math.PI * 2), 0);
      const s = 0.85 + (i % 4) * 0.32;
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();

      this.brainCoralInstanced.setMatrixAt(i, _dummy.matrix);
      this.giantAnemoneInstanced.setMatrixAt(i, _dummy.matrix);

      _color.setHSL(0.78 + (i % 4) * 0.04, 0.78, 0.55);
      this.brainCoralInstanced.setColorAt(i, _color);
      _color.setHSL(0.9 + (i % 3) * 0.04, 0.85, 0.62);
      this.giantAnemoneInstanced.setColorAt(i, _color);
    }

    this.brainCoralInstanced.instanceMatrix.needsUpdate = true;
    this.giantAnemoneInstanced.instanceMatrix.needsUpdate = true;
    if (this.brainCoralInstanced.instanceColor) {
      this.brainCoralInstanced.instanceColor.needsUpdate = true;
    }
    if (this.giantAnemoneInstanced.instanceColor) {
      this.giantAnemoneInstanced.instanceColor.needsUpdate = true;
    }
    this.brainCoralInstanced.computeBoundingSphere();
    this.giantAnemoneInstanced.computeBoundingSphere();

    this.scene.add(this.brainCoralInstanced);
    this.scene.add(this.giantAnemoneInstanced);

    // 3. Abyssal Fossil Fields (Giant Ammonite Shells & Tectonic Ribs, hasCollision = false)
    const fossilCount = 65;
    const shellGeo = new THREE.TorusGeometry(1.65, 0.58, 10, 22, Math.PI * 1.65);
    shellGeo.translate(0, 0.9, 0);
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      emissive: 0x44403c,
      emissiveIntensity: 0.25,
      roughness: 0.75,
      metalness: 0.15,
    });

    this.fossilShellsInstanced = new THREE.InstancedMesh(
      shellGeo,
      shellMat,
      fossilCount
    );
    this.fossilShellsInstanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.fossilShellsInstanced.frustumCulled = true;

    for (let i = 0; i < fossilCount; i++) {
      const a = (i / fossilCount) * Math.PI * 1.2 - Math.PI * 1.1;
      const r = 48 + ((i * 31) % (GAME_CONFIG.WORLD.ARENA_RADIUS - 70));
      const fx = Math.cos(a) * r;
      const fz = -Math.abs(Math.sin(a) * r) - 28;
      const fy = getGroundHeightAt(fx, fz) - 0.2;

      _dummy.position.set(fx, fy, fz);
      _dummy.rotation.set(
        0.25 + (i % 3) * 0.15,
        (i * 1.7) % (Math.PI * 2),
        (i % 4) * 0.2
      );
      const s = 1.0 + (i % 5) * 0.45;
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      this.fossilShellsInstanced.setMatrixAt(i, _dummy.matrix);

      const shade = 0.7 + (i % 4) * 0.08;
      _color.setRGB(0.84 * shade, 0.81 * shade, 0.76 * shade);
      this.fossilShellsInstanced.setColorAt(i, _color);
    }

    this.fossilShellsInstanced.instanceMatrix.needsUpdate = true;
    if (this.fossilShellsInstanced.instanceColor) {
      this.fossilShellsInstanced.instanceColor.needsUpdate = true;
    }
    this.fossilShellsInstanced.computeBoundingSphere();
    this.scene.add(this.fossilShellsInstanced);

    this.disposableGeometries.push(coralGeo, brainGeo, anemoneGeo, shellGeo);
    this.disposableMaterials.push(
      this.electricCoralMat,
      brainMat,
      anemoneMat,
      shellMat
    );
  }

  private initHydrothermalVents(): void {
    const chimneyGeo = new THREE.CylinderGeometry(1.1, 2.6, 5.2, 12, 1, true);
    chimneyGeo.translate(0, 2.6, 0);
    const chimneyMat = new THREE.MeshStandardMaterial({
      color: 0x292524,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.45,
      roughness: 0.85,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    const craterRingGeo = new THREE.TorusGeometry(1.12, 0.25, 10, 24);
    craterRingGeo.rotateX(Math.PI / 2);
    const craterRingMat = new THREE.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xea580c,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    });

    const auraRingGeo = new THREE.RingGeometry(2.2, 8.2, 36);
    auraRingGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < THERMAL_VENT_COORDS.length; i++) {
      const [vx, vz] = THERMAL_VENT_COORDS[i];
      const vy = getGroundHeightAt(vx, vz) - 0.3;
      const ventPos = new THREE.Vector3(vx, vy, vz);
      this.ventPositions.push(ventPos);

      // Register solid 1.35m collider for each hydrothermal vent chimney with vertical span
      this.registerObstacle(vx, vz, vy, vy + 5.4, 1.35);

      const ventGroup = new THREE.Group();
      ventGroup.position.copy(ventPos);

      const chimneyMesh = new THREE.Mesh(chimneyGeo, chimneyMat);
      ventGroup.add(chimneyMesh);

      const craterMesh = new THREE.Mesh(craterRingGeo, craterRingMat);
      craterMesh.position.y = 5.15;
      ventGroup.add(craterMesh);

      const auraMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.ventAuraMats.push(auraMat);
      this.disposableMaterials.push(auraMat);

      const auraMesh = new THREE.Mesh(auraRingGeo, auraMat);
      auraMesh.position.set(vx, GAME_CONFIG.WORLD.SWIM_PLANE_Y - 1.1, vz);
      this.ventAuraMeshes.push(auraMesh);
      this.ventGroups.push(ventGroup);
      this.scene.add(auraMesh);
      this.scene.add(ventGroup);
    }

    const bubbleGeo = new THREE.BufferGeometry();
    const bubbleColors = new Float32Array(this.ventBubbleCount * 3);

    for (let i = 0; i < this.ventBubbleCount; i++) {
      const ventIdx = i % this.ventPositions.length;
      const vp = this.ventPositions[ventIdx];
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * 1.6;
      const bx = vp.x + Math.cos(angle) * spread;
      const bz = vp.z + Math.sin(angle) * spread;
      const by = vp.y + 4.8 + Math.random() * 9.5;

      this.ventBubbleBaseXZ[i * 2] = bx;
      this.ventBubbleBaseXZ[i * 2 + 1] = bz;

      this.ventBubblePositions[i * 3] = bx;
      this.ventBubblePositions[i * 3 + 1] = by;
      this.ventBubblePositions[i * 3 + 2] = bz;

      _color.setHSL(0.08 + (i % 3) * 0.14, 0.95, 0.68);
      bubbleColors[i * 3] = _color.r;
      bubbleColors[i * 3 + 1] = _color.g;
      bubbleColors[i * 3 + 2] = _color.b;
    }

    bubbleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.ventBubblePositions, 3)
    );
    bubbleGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(bubbleColors, 3)
    );

    const bubbleMat = new THREE.PointsMaterial({
      size: 0.42,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.ventBubblesPoints = new THREE.Points(bubbleGeo, bubbleMat);
    this.scene.add(this.ventBubblesPoints);

    this.disposableGeometries.push(
      chimneyGeo,
      craterRingGeo,
      auraRingGeo,
      bubbleGeo
    );
    this.disposableMaterials.push(chimneyMat, craterRingMat, bubbleMat);
  }

  private initAbyssalSilhouettes(): void {
    // 6 Colossal dark-translucent background organisms swimming in the deep stratum (Spore depth layer effect)
    const headGeo = new THREE.CapsuleGeometry(2.8, 5.2, 12, 18);
    headGeo.rotateX(Math.PI / 2);
    headGeo.scale(1.25, 0.52, 1.0);

    const finGeo = new THREE.ConeGeometry(2.4, 7.5, 8);
    finGeo.rotateZ(Math.PI / 2);
    finGeo.scale(0.35, 1.0, 1.4);

    const tailSegGeo = new THREE.SphereGeometry(1.75, 10, 10);
    tailSegGeo.scale(0.9, 0.48, 1.85);

    const silhouetteMat = new THREE.MeshBasicMaterial({
      color: 0x0a344f,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });

    const biolumSpotGeo = new THREE.SphereGeometry(0.55, 8, 8);
    const biolumSpotMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });

    const configs = [
      { cx: -16, cz: -14, radius: 28, speed: 0.15, scale: 1.25, phase: 0.2 },
      { cx: 36, cz: 24, radius: 36, speed: -0.12, scale: 1.45, phase: 1.7 },
      { cx: -38, cz: 34, radius: 32, speed: 0.13, scale: 1.18, phase: 3.1 },
      { cx: 28, cz: -38, radius: 34, speed: -0.13, scale: 1.35, phase: 4.6 },
      { cx: -92, cz: -65, radius: 48, speed: 0.11, scale: 1.65, phase: 2.3 },
      { cx: 88, cz: 72, radius: 52, speed: -0.1, scale: 1.75, phase: 5.2 },
    ];

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const group = new THREE.Group();
      group.scale.setScalar(cfg.scale);

      const bodyMesh = new THREE.Mesh(headGeo, silhouetteMat);
      group.add(bodyMesh);

      for (const side of [-1, 1]) {
        const spot = new THREE.Mesh(biolumSpotGeo, biolumSpotMat);
        spot.position.set(side * 2.1, 0.4, -2.4);
        group.add(spot);
      }

      const fins: THREE.Mesh[] = [];
      for (const side of [-1, 1]) {
        const fin = new THREE.Mesh(finGeo, silhouetteMat);
        fin.position.set(side * 4.5, 0, -0.5);
        if (side === 1) {
          fin.rotation.z = Math.PI;
        }
        group.add(fin);
        fins.push(fin);
      }

      const tailSegments: THREE.Mesh[] = [];
      for (let t = 0; t < 4; t++) {
        const seg = new THREE.Mesh(tailSegGeo, silhouetteMat);
        seg.scale.setScalar(1 - t * 0.2);
        seg.position.set(0, 0, 4.8 + t * 3.1);
        group.add(seg);
        tailSegments.push(seg);
      }

      group.position.set(cfg.cx + cfg.radius, -4.8, cfg.cz);
      this.scene.add(group);

      this.abyssalSilhouettes.push({
        group,
        orbitRadius: cfg.radius,
        orbitAngle: cfg.phase,
        orbitSpeed: cfg.speed,
        centerX: cfg.cx,
        centerZ: cfg.cz,
        baseScale: cfg.scale,
        tailSegments,
        fins,
        phaseOffset: cfg.phase,
      });
    }

    this.disposableGeometries.push(
      headGeo,
      finGeo,
      tailSegGeo,
      biolumSpotGeo
    );
    this.disposableMaterials.push(silhouetteMat, biolumSpotMat);
  }

  private initPlanktonParticles(): void {
    const geometry = new THREE.BufferGeometry();
    const colors = new Float32Array(this.planktonCount * 3);

    for (let i = 0; i < this.planktonCount; i++) {
      const r =
        Math.sqrt(Math.random()) * (GAME_CONFIG.WORLD.ARENA_RADIUS + 12);
      const theta = Math.random() * Math.PI * 2;
      this.planktonPositions[i * 3] = Math.cos(theta) * r;
      this.planktonPositions[i * 3 + 1] = -3.5 + Math.random() * 15.5;
      this.planktonPositions[i * 3 + 2] = Math.sin(theta) * r;

      _color.setHSL(
        0.48 + Math.random() * 0.12,
        0.8,
        0.65 + Math.random() * 0.25
      );
      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }

    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.planktonPositions, 3)
    );
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.planktonPoints = new THREE.Points(geometry, material);
    this.scene.add(this.planktonPoints);

    this.disposableGeometries.push(geometry);
    this.disposableMaterials.push(material);
  }

  private initArenaBoundaryMarker(): void {
    const ringGeo = new THREE.RingGeometry(
      GAME_CONFIG.WORLD.ARENA_RADIUS - 0.8,
      GAME_CONFIG.WORLD.ARENA_RADIUS + 0.8,
      128
    );
    ringGeo.rotateX(-Math.PI / 2);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.causticRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.causticRingMesh.position.y = GAME_CONFIG.WORLD.SWIM_PLANE_Y - 1.5;
    this.scene.add(this.causticRingMesh);

    this.disposableGeometries.push(ringGeo);
    this.disposableMaterials.push(ringMat);
  }

  private initSpeciesNest(): void {
    this.nestGroup = new THREE.Group();
    const nestBaseY = getLandHeightAt(0, 0);
    this.nestGroup.position.set(0, nestBaseY - 0.12, 0);
    this.nestGroup.visible = false;

    const moundGeo = new THREE.CylinderGeometry(4.5, 5.6, 0.55, 32);
    const moundMat = new THREE.MeshStandardMaterial({
      color: 0x3f6212,
      emissive: 0x14532d,
      emissiveIntensity: 0.25,
      roughness: 0.85,
    });
    const moundMesh = new THREE.Mesh(moundGeo, moundMat);
    moundMesh.receiveShadow = true;
    this.nestGroup.add(moundMesh);

    const nestRimGeo = new THREE.TorusGeometry(4.5, 0.58, 12, 32);
    nestRimGeo.rotateX(Math.PI / 2);
    const nestRimMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.88,
    });
    const nestRimMesh = new THREE.Mesh(nestRimGeo, nestRimMat);
    nestRimMesh.position.y = 0.28;
    nestRimMesh.castShadow = true;
    nestRimMesh.receiveShadow = true;
    this.nestGroup.add(nestRimMesh);

    const stoneGeo = new THREE.DodecahedronGeometry(0.68, 1);
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.75,
      metalness: 0.1,
    });
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(Math.cos(angle) * 4.8, 0.42, Math.sin(angle) * 4.8);
      stone.scale.set(1.2, 0.85 + (i % 3) * 0.2, 1.1);
      stone.rotation.y = angle;
      stone.castShadow = true;
      stone.receiveShadow = true;
      this.nestGroup.add(stone);
    }

    const eggGeo = new THREE.SphereGeometry(0.46, 16, 16);
    eggGeo.scale(0.85, 1.35, 0.85);
    const eggMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.55,
      roughness: 0.28,
    });
    const eggOffsets: [number, number][] = [
      [-0.65, -0.4],
      [0.68, -0.35],
      [0.0, 0.65],
    ];
    for (const [ex, ez] of eggOffsets) {
      const egg = new THREE.Mesh(eggGeo, eggMat);
      egg.position.set(ex, 0.58, ez);
      egg.castShadow = true;
      this.nestGroup.add(egg);
      this.nestEggs.push(egg);
    }

    const auraGeo = new THREE.RingGeometry(2.2, 7.2, 48);
    auraGeo.rotateX(-Math.PI / 2);
    this.nestAuraMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const auraMesh = new THREE.Mesh(auraGeo, this.nestAuraMat);
    auraMesh.position.y = 0.12;
    this.nestGroup.add(auraMesh);

    this.scene.add(this.nestGroup);

    this.disposableGeometries.push(
      moundGeo,
      nestRimGeo,
      stoneGeo,
      eggGeo,
      auraGeo
    );
    this.disposableMaterials.push(
      moundMat,
      nestRimMat,
      stoneMat,
      eggMat,
      this.nestAuraMat
    );
  }

  /**
   * Initializes the 2,400m Spore Continent Chunk System (LOD + Frustum Culling),
   * the Horizon Low-Poly Proxy, the Ocean Water Plane at Y = 0, and the 3D Sea Leviathan.
   */
  private initContinentChunkSystem(): void {
    this.continentChunksGroup = new THREE.Group();
    this.continentChunksGroup.visible = false;
    this.scene.add(this.continentChunksGroup);

    const r = CONTINENT_CONFIG.VISIBLE_CHUNK_RADIUS;
    const gridDim = r * 2 + 1; // 9x9 = 81 pooled terrain chunks
    const totalChunks = gridDim * gridDim;
    const chunkSize = CONTINENT_CONFIG.CHUNK_SIZE;

    for (let i = 0; i < totalChunks; i++) {
      const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, 48, 48);
      geo.rotateX(-Math.PI / 2);
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const colors = new Float32Array(posAttr.count * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mesh = new THREE.Mesh(geo, this.seabedMat);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // Managed explicitly via custom chunk Frustum Culling
      this.continentChunksGroup.add(mesh);
      this.disposableGeometries.push(geo);

      this.terrainChunks.push({
        chunkX: 99999,
        chunkZ: 99999,
        mesh,
        boundingBox: new THREE.Box3(),
        assigned: false,
      });
    }

    // Low-poly Horizon Proxy Mesh (3400m x 3400m) depressed well below valley floors so coarse triangles never poke above high-detail chunks
    const proxyGeo = new THREE.PlaneGeometry(3400, 3400, 64, 64);
    proxyGeo.rotateX(-Math.PI / 2);
    const proxyPos = proxyGeo.attributes.position as THREE.BufferAttribute;
    const proxyColors = new Float32Array(proxyPos.count * 3);
    for (let i = 0; i < proxyPos.count; i++) {
      const vx = proxyPos.getX(i);
      const vz = proxyPos.getZ(i);
      const rawY = getLandHeightAt(vx, vz);
      // Offset down by -18m so coarse chords across valleys never clip above the true terrain chunks
      const vy = rawY - 18.0;
      proxyPos.setY(i, vy);
      this.computeContinentVertexColor(vx, vz, rawY, _color);
      proxyColors[i * 3] = _color.r;
      proxyColors[i * 3 + 1] = _color.g;
      proxyColors[i * 3 + 2] = _color.b;
    }
    proxyGeo.setAttribute('color', new THREE.BufferAttribute(proxyColors, 3));
    proxyGeo.computeVertexNormals();
    proxyGeo.computeBoundingBox();
    proxyGeo.computeBoundingSphere();

    this.lowPolyContinentProxyMesh = new THREE.Mesh(proxyGeo, this.seabedMat);
    this.lowPolyContinentProxyMesh.visible = false;
    this.scene.add(this.lowPolyContinentProxyMesh);
    this.disposableGeometries.push(proxyGeo);

    // Planetary Ocean Surface Plane at Y = 0.0 surrounding the 1,200m radius continent
    const oceanGeo = new THREE.PlaneGeometry(3800, 3800, 28, 28);
    oceanGeo.rotateX(-Math.PI / 2);
    this.oceanWaterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.28,
      roughness: 0.16,
      metalness: 0.18,
      transparent: true,
      opacity: 0.78,
    });
    this.oceanWaterMesh = new THREE.Mesh(oceanGeo, this.oceanWaterMat);
    this.oceanWaterMesh.position.y = 0.0;
    this.oceanWaterMesh.visible = false;
    this.scene.add(this.oceanWaterMesh);
    this.disposableGeometries.push(oceanGeo);
    this.disposableMaterials.push(this.oceanWaterMat);

    // Colossal 3D Sea Leviathan (Spore-style Deep Ocean Guardian)
    this.leviathanGroup = new THREE.Group();
    this.leviathanGroup.visible = false;

    const leviSkinMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x082f49,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.25,
    });
    const leviEyeMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
    });
    const leviToothMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.25,
    });
    const splashMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const headGeo = new THREE.ConeGeometry(4.2, 11.5, 14);
    headGeo.rotateX(Math.PI * 0.18);
    headGeo.translate(0, 3.5, 0);
    const headMesh = new THREE.Mesh(headGeo, leviSkinMat);
    this.leviathanGroup.add(headMesh);

    const jawGeo = new THREE.ConeGeometry(3.4, 8.5, 12);
    jawGeo.rotateX(-Math.PI * 0.22);
    jawGeo.translate(0, 2.2, 1.4);
    this.leviathanJawMesh = new THREE.Mesh(jawGeo, leviSkinMat);
    this.leviathanGroup.add(this.leviathanJawMesh);

    const eyeGeo = new THREE.SphereGeometry(0.65, 12, 10);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, leviEyeMat);
      eye.position.set(side * 2.4, 5.2, 1.8);
      this.leviathanGroup.add(eye);
    }

    const fangGeo = new THREE.ConeGeometry(0.35, 1.6, 6);
    for (let f = 0; f < 8; f++) {
      const ang = (f / 8) * Math.PI * 2;
      const fang = new THREE.Mesh(fangGeo, leviToothMat);
      fang.position.set(Math.cos(ang) * 2.6, 4.0, Math.sin(ang) * 2.6 + 0.6);
      this.leviathanGroup.add(fang);
    }

    const splashGeo = new THREE.RingGeometry(3.5, 9.5, 32);
    splashGeo.rotateX(-Math.PI / 2);
    this.leviathanSplashRing = new THREE.Mesh(splashGeo, splashMat);
    this.leviathanSplashRing.position.y = 0.25;
    this.leviathanGroup.add(this.leviathanSplashRing);

    this.scene.add(this.leviathanGroup);
    this.disposableGeometries.push(headGeo, jawGeo, eyeGeo, fangGeo, splashGeo);
    this.disposableMaterials.push(
      leviSkinMat,
      leviEyeMat,
      leviToothMat,
      splashMat
    );
  }

  private computeContinentVertexColor(
    vx: number,
    vz: number,
    vy: number,
    outColor: THREE.Color
  ): void {
    const dist = Math.sqrt(vx * vx + vz * vz);
    // Nest central sanctuary (< 40m)
    if (dist < 40) {
      outColor.setRGB(0.32, 0.54, 0.14);
      return;
    }
    // Deep ocean abyssal trench (< -4.0m)
    if (vy < -4.0) {
      const depthNorm = THREE.MathUtils.clamp((-vy - 4.0) / 18.0, 0, 1);
      outColor.setRGB(
        THREE.MathUtils.lerp(0.05, 0.015, depthNorm),
        THREE.MathUtils.lerp(0.28, 0.08, depthNorm),
        THREE.MathUtils.lerp(0.42, 0.18, depthNorm)
      );
      return;
    }
    // Golden sandy beach & shallow shoreline (-4.0m .. +1.6m)
    if (vy < 1.6 || dist > CONTINENT_CONFIG.CONTINENT_RADIUS - 75) {
      const sandNorm = THREE.MathUtils.clamp((vy + 4.0) / 5.6, 0, 1);
      outColor.setRGB(
        THREE.MathUtils.lerp(0.12, 0.84, sandNorm),
        THREE.MathUtils.lerp(0.45, 0.72, sandNorm),
        THREE.MathUtils.lerp(0.55, 0.42, sandNorm)
      );
      return;
    }
    // Verdant continental valleys & plains (1.6m .. 14.0m)
    if (vy < 14.0) {
      const hillNorm = THREE.MathUtils.clamp((vy - 1.6) / 12.4, 0, 1);
      outColor.setRGB(
        THREE.MathUtils.lerp(0.24, 0.48, hillNorm),
        THREE.MathUtils.lerp(0.46, 0.36, hillNorm),
        THREE.MathUtils.lerp(0.11, 0.14, hillNorm)
      );
      return;
    }
    // High mountain slate & snow peaks (> 14.0m)
    const peakNorm = THREE.MathUtils.clamp((vy - 14.0) / 22.0, 0, 1);
    if (peakNorm < 0.65) {
      const t = peakNorm / 0.65;
      outColor.setRGB(
        THREE.MathUtils.lerp(0.48, 0.38, t),
        THREE.MathUtils.lerp(0.36, 0.36, t),
        THREE.MathUtils.lerp(0.14, 0.35, t)
      );
    } else {
      const t = (peakNorm - 0.65) / 0.35;
      outColor.setRGB(
        THREE.MathUtils.lerp(0.38, 0.92, t),
        THREE.MathUtils.lerp(0.36, 0.94, t),
        THREE.MathUtils.lerp(0.35, 0.96, t)
      );
    }
  }

  private populateTerrainChunk(
    chunk: TerrainChunk,
    chunkX: number,
    chunkZ: number
  ): void {
    chunk.chunkX = chunkX;
    chunk.chunkZ = chunkZ;
    chunk.assigned = true;

    const chunkSize = CONTINENT_CONFIG.CHUNK_SIZE;
    const worldCenterX = chunkX * chunkSize;
    const worldCenterZ = chunkZ * chunkSize;

    chunk.mesh.position.set(worldCenterX, 0, worldCenterZ);
    chunk.mesh.updateMatrixWorld(true);

    const geo = chunk.mesh.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const colorAttr = geo.attributes.color as THREE.BufferAttribute;
    const localVertex = new THREE.Vector3();

    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < posAttr.count; i++) {
      localVertex.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      localVertex.applyMatrix4(chunk.mesh.matrixWorld);

      const wx = localVertex.x;
      const wz = localVertex.z;
      const wy = getLandHeightAt(wx, wz);

      posAttr.setY(i, wy);
      if (wy < minY) minY = wy;
      if (wy > maxY) maxY = wy;

      this.computeContinentVertexColor(wx, wz, wy, _color);
      colorAttr.setXYZ(i, _color.r, _color.g, _color.b);
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    const half = chunkSize * 0.5;
    chunk.boundingBox.min.set(
      worldCenterX - half,
      minY - 2.0,
      worldCenterZ - half
    );
    chunk.boundingBox.max.set(
      worldCenterX + half,
      maxY + 4.0,
      worldCenterZ + half
    );
  }

  /**
   * Returns the active terrain chunk mesh directly underneath (x, z) for vertical raycasting,
   * or falls back to continentChunksGroup / seabedMesh.
   */
  public getTerrainMeshAt(x: number, z: number): THREE.Object3D {
    const chunkSize = CONTINENT_CONFIG.CHUNK_SIZE;
    const cx = Math.round(x / chunkSize);
    const cz = Math.round(z / chunkSize);
    for (let i = 0; i < this.terrainChunks.length; i++) {
      const c = this.terrainChunks[i];
      if (c.assigned && c.chunkX === cx && c.chunkZ === cz && c.mesh.visible) {
        return c.mesh;
      }
    }
    return this.continentChunksGroup?.visible
      ? this.continentChunksGroup
      : this.seabedMesh;
  }

  /**
   * Updates the 9x9 grid of 128x128m continent terrain chunks around the player
   * and performs camera Frustum Culling so chunks behind the camera are skipped.
   */
  public updateContinentChunks(
    playerX: number,
    playerZ: number,
    camera?: THREE.Camera
  ): void {
    if (this.currentStage !== 'creature_stage' || this.isEditorSandboxActive) {
      return;
    }

    const chunkSize = CONTINENT_CONFIG.CHUNK_SIZE;
    const r = CONTINENT_CONFIG.VISIBLE_CHUNK_RADIUS;
    const centerChunkX = Math.round(playerX / chunkSize);
    const centerChunkZ = Math.round(playerZ / chunkSize);

    if (
      !this.chunksInitialized ||
      centerChunkX !== this.lastChunkCenterX ||
      centerChunkZ !== this.lastChunkCenterZ
    ) {
      this.lastChunkCenterX = centerChunkX;
      this.lastChunkCenterZ = centerChunkZ;
      this.chunksInitialized = true;

      // Mark chunks outside the active (2R+1)x(2R+1) window as free for recycling
      for (let i = 0; i < this.terrainChunks.length; i++) {
        const c = this.terrainChunks[i];
        if (
          Math.abs(c.chunkX - centerChunkX) > r ||
          Math.abs(c.chunkZ - centerChunkZ) > r
        ) {
          c.assigned = false;
        }
      }

      let freeSearchIdx = 0;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const targetCX = centerChunkX + dx;
          const targetCZ = centerChunkZ + dz;

          let alreadyLoaded = false;
          for (let i = 0; i < this.terrainChunks.length; i++) {
            const c = this.terrainChunks[i];
            if (
              c.assigned &&
              c.chunkX === targetCX &&
              c.chunkZ === targetCZ
            ) {
              alreadyLoaded = true;
              break;
            }
          }

          if (!alreadyLoaded) {
            while (
              freeSearchIdx < this.terrainChunks.length &&
              this.terrainChunks[freeSearchIdx].assigned
            ) {
              freeSearchIdx++;
            }
            if (freeSearchIdx < this.terrainChunks.length) {
              this.populateTerrainChunk(
                this.terrainChunks[freeSearchIdx],
                targetCX,
                targetCZ
              );
              freeSearchIdx++;
            }
          }
        }
      }
    }

    // Frustum Culling: only render chunks inside the camera frustum (plus immediate 3x3 around player for shadows)
    if (camera) {
      camera.updateMatrixWorld();
      _projScreenMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      );
      _frustum.setFromProjectionMatrix(_projScreenMatrix);

      for (let i = 0; i < this.terrainChunks.length; i++) {
        const chunk = this.terrainChunks[i];
        if (!chunk.assigned) {
          chunk.mesh.visible = false;
          continue;
        }
        const isImmediateNeighbor =
          Math.abs(chunk.chunkX - centerChunkX) <= 1 &&
          Math.abs(chunk.chunkZ - centerChunkZ) <= 1;
        chunk.mesh.visible =
          isImmediateNeighbor || _frustum.intersectsBox(chunk.boundingBox);
      }
    }
  }

  /**
   * Triggers the visual emergence of the colossal 3D Sea Leviathan ahead of the player in deep water.
   */
  public triggerLeviathanVisual(playerPos: THREE.Vector3): void {
    if (!this.leviathanGroup) return;
    const dist = Math.hypot(playerPos.x, playerPos.z);
    const dirX = dist > 0.01 ? playerPos.x / dist : 0;
    const dirZ = dist > 0.01 ? playerPos.z / dist : 1;

    // Emerge slightly seaward of the player, facing inward toward the player and shore
    this.leviathanOrigin.set(
      playerPos.x + dirX * 14.0,
      -2.5,
      playerPos.z + dirZ * 14.0
    );
    this.leviathanGroup.position.copy(this.leviathanOrigin);
    this.leviathanGroup.lookAt(playerPos.x, 1.5, playerPos.z);
    this.leviathanGroup.visible = true;
    this.leviathanBreachTimer = 1.65;
  }

  /**
   * Initializes macroscopic continental vegetation (trees with solid trunk colliders,
   * bushes, giant ferns, and rival species nests) for `creature_stage` using InstancedMesh.
   */
  private initContinentalFlora(): void {
    const TREE_COUNT = 600;
    const BUSH_COUNT = 800;
    const FERN_COUNT = 400;
    const RIVAL_NEST_COUNT = 12;

    // 1. Geometría de Tronco y Copa de Árbol Continental
    const trunkGeo = new THREE.CylinderGeometry(0.8, 1.4, 8.0, 8);
    trunkGeo.translate(0, 4.0, 0);
    const barkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.92,
      metalness: 0.04,
    });

    const foliageGeo = new THREE.DodecahedronGeometry(4.5, 1);
    foliageGeo.translate(0, 8.5, 0);
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.78,
      metalness: 0.05,
    });

    this.treesTrunkInstanced = new THREE.InstancedMesh(
      trunkGeo,
      barkMat,
      TREE_COUNT
    );
    this.treesFoliageInstanced = new THREE.InstancedMesh(
      foliageGeo,
      foliageMat,
      TREE_COUNT
    );
    this.treesTrunkInstanced.castShadow = true;
    this.treesTrunkInstanced.receiveShadow = true;
    this.treesFoliageInstanced.castShadow = true;
    this.treesFoliageInstanced.receiveShadow = true;
    this.treesTrunkInstanced.visible = false;
    this.treesFoliageInstanced.visible = false;

    this.treeColliders = [];

    let placedTrees = 0;
    let seed = 137;
    const pseudoRand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (
      let attempt = 0;
      attempt < TREE_COUNT * 4 && placedTrees < TREE_COUNT;
      attempt++
    ) {
      // Distribuir en anillos fuera del Nido Central (Radio > 38m hasta la costa < 980m)
      const r = 38 + Math.pow(pseudoRand(), 0.75) * 940;
      const theta = pseudoRand() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = getLandHeightAt(x, z);

      // Solo plantar en tierra firme emergida (evitar el océano y picos nevados extremos)
      if (y <= 0.65 || y >= 24.0) continue;

      const scale = 0.8 + pseudoRand() * 0.7;
      _dummy.position.set(x, y - 0.35, z);
      _dummy.rotation.set(
        (pseudoRand() - 0.5) * 0.08,
        pseudoRand() * Math.PI * 2,
        (pseudoRand() - 0.5) * 0.08
      );
      _dummy.scale.set(scale, scale * (0.9 + pseudoRand() * 0.25), scale);
      _dummy.updateMatrix();

      this.treesTrunkInstanced.setMatrixAt(placedTrees, _dummy.matrix);
      this.treesFoliageInstanced.setMatrixAt(placedTrees, _dummy.matrix);

      // Variación cromática orgánica de corteza y follaje
      const barkShade = 0.82 + (placedTrees % 5) * 0.06;
      _color.setRGB(0.36 * barkShade, 0.25 * barkShade, 0.18 * barkShade);
      this.treesTrunkInstanced.setColorAt(placedTrees, _color);

      const leafHue = 0.28 + ((placedTrees % 7) - 3) * 0.018;
      const leafLight = 0.28 + (placedTrees % 4) * 0.045;
      _color.setHSL(leafHue, 0.58, leafLight);
      this.treesFoliageInstanced.setColorAt(placedTrees, _color);

      // Registrar colisionador de tronco (radio 1.2m escalado) para que las criaturas no lo atraviesen
      const trunkRadius = 1.2 * scale;
      this.treeColliders.push({ x, z, radius: trunkRadius });
      this.registerLandObstacle(x, z, y - 2.0, y + 12.0 * scale, trunkRadius);
      placedTrees++;
    }

    this.treesTrunkInstanced.count = placedTrees;
    this.treesFoliageInstanced.count = placedTrees;
    this.treesTrunkInstanced.instanceMatrix.needsUpdate = true;
    this.treesFoliageInstanced.instanceMatrix.needsUpdate = true;
    if (this.treesTrunkInstanced.instanceColor) {
      this.treesTrunkInstanced.instanceColor.needsUpdate = true;
    }
    if (this.treesFoliageInstanced.instanceColor) {
      this.treesFoliageInstanced.instanceColor.needsUpdate = true;
    }
    this.treesTrunkInstanced.computeBoundingSphere();
    this.treesFoliageInstanced.computeBoundingSphere();
    this.scene.add(this.treesTrunkInstanced);
    this.scene.add(this.treesFoliageInstanced);

    // 2. Arbustos Continentales y Helechos Prehistóricos
    const bushGeo = new THREE.DodecahedronGeometry(1.35, 1);
    bushGeo.scale(1.25, 0.82, 1.25);
    bushGeo.translate(0, 0.75, 0);
    const bushMat = new THREE.MeshStandardMaterial({
      color: 0x3f8f4e,
      roughness: 0.82,
      metalness: 0.04,
    });

    this.bushesInstanced = new THREE.InstancedMesh(
      bushGeo,
      bushMat,
      BUSH_COUNT
    );
    this.bushesInstanced.castShadow = true;
    this.bushesInstanced.receiveShadow = true;
    this.bushesInstanced.visible = false;

    let placedBushes = 0;
    for (
      let attempt = 0;
      attempt < BUSH_COUNT * 3 && placedBushes < BUSH_COUNT;
      attempt++
    ) {
      const r = 28 + Math.pow(pseudoRand(), 0.78) * 960;
      const theta = pseudoRand() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = getLandHeightAt(x, z);
      if (y <= 0.5 || y >= 20.0) continue;

      const s = 0.65 + pseudoRand() * 0.85;
      _dummy.position.set(x, y - 0.15, z);
      _dummy.rotation.set(0, pseudoRand() * Math.PI * 2, 0);
      _dummy.scale.set(s, s * (0.85 + pseudoRand() * 0.3), s);
      _dummy.updateMatrix();
      this.bushesInstanced.setMatrixAt(placedBushes, _dummy.matrix);

      const bushHue = 0.26 + ((placedBushes % 6) - 2.5) * 0.02;
      _color.setHSL(bushHue, 0.62, 0.32 + (placedBushes % 4) * 0.04);
      this.bushesInstanced.setColorAt(placedBushes, _color);
      placedBushes++;
    }
    this.bushesInstanced.count = placedBushes;
    this.bushesInstanced.instanceMatrix.needsUpdate = true;
    if (this.bushesInstanced.instanceColor) {
      this.bushesInstanced.instanceColor.needsUpdate = true;
    }
    this.bushesInstanced.computeBoundingSphere();
    this.scene.add(this.bushesInstanced);

    const fernGeo = new THREE.ConeGeometry(1.65, 2.6, 7);
    fernGeo.scale(1.3, 0.55, 1.3);
    fernGeo.translate(0, 0.65, 0);
    const fernMat = new THREE.MeshStandardMaterial({
      color: 0x52b788,
      roughness: 0.72,
      metalness: 0.06,
    });

    this.fernsInstanced = new THREE.InstancedMesh(fernGeo, fernMat, FERN_COUNT);
    this.fernsInstanced.castShadow = true;
    this.fernsInstanced.receiveShadow = true;
    this.fernsInstanced.visible = false;

    let placedFerns = 0;
    for (
      let attempt = 0;
      attempt < FERN_COUNT * 3 && placedFerns < FERN_COUNT;
      attempt++
    ) {
      const r = 24 + Math.pow(pseudoRand(), 0.75) * 920;
      const theta = pseudoRand() * Math.PI * 2;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = getLandHeightAt(x, z);
      if (y <= 0.5 || y >= 16.0) continue;

      const s = 0.75 + pseudoRand() * 0.9;
      _dummy.position.set(x, y - 0.1, z);
      _dummy.rotation.set(
        (pseudoRand() - 0.5) * 0.15,
        pseudoRand() * Math.PI * 2,
        (pseudoRand() - 0.5) * 0.15
      );
      _dummy.scale.set(s, s, s);
      _dummy.updateMatrix();
      this.fernsInstanced.setMatrixAt(placedFerns, _dummy.matrix);

      _color.setHSL(
        0.33 + (placedFerns % 5) * 0.015,
        0.68,
        0.36 + (placedFerns % 3) * 0.05
      );
      this.fernsInstanced.setColorAt(placedFerns, _color);
      placedFerns++;
    }
    this.fernsInstanced.count = placedFerns;
    this.fernsInstanced.instanceMatrix.needsUpdate = true;
    if (this.fernsInstanced.instanceColor) {
      this.fernsInstanced.instanceColor.needsUpdate = true;
    }
    this.fernsInstanced.computeBoundingSphere();
    this.scene.add(this.fernsInstanced);

    // 3. Nidos Secundarios de Especies Rivales repartidos por el continente
    const rivalNestGeo = new THREE.TorusGeometry(4.2, 0.75, 10, 28);
    rivalNestGeo.rotateX(Math.PI / 2);
    rivalNestGeo.scale(1, 0.55, 1);
    rivalNestGeo.translate(0, 0.25, 0);
    const rivalNestMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.9,
      metalness: 0.05,
    });

    this.rivalNestsInstanced = new THREE.InstancedMesh(
      rivalNestGeo,
      rivalNestMat,
      RIVAL_NEST_COUNT
    );
    this.rivalNestsInstanced.receiveShadow = true;
    this.rivalNestsInstanced.visible = false;
    this.rivalNestPositions.length = 0;

    for (let n = 0; n < RIVAL_NEST_COUNT; n++) {
      const baseAngle = (n / RIVAL_NEST_COUNT) * Math.PI * 2 + 0.35;
      const ringRadius = n < 6 ? 85 + (n % 3) * 42 : 220 + ((n - 6) % 6) * 75;
      let nx = Math.cos(baseAngle) * ringRadius;
      let nz = Math.sin(baseAngle) * ringRadius;
      let ny = getLandHeightAt(nx, nz);

      // Asegurar que cada nido rival esté sobre tierra firme emergida
      if (ny < 0.8) {
        nx = Math.cos(baseAngle) * 95;
        nz = Math.sin(baseAngle) * 95;
        ny = Math.max(0.8, getLandHeightAt(nx, nz));
      }

      this.rivalNestPositions.push(new THREE.Vector3(nx, ny, nz));
      _dummy.position.set(nx, ny - 0.1, nz);
      _dummy.rotation.set(0, baseAngle, 0);
      _dummy.scale.setScalar(1.0);
      _dummy.updateMatrix();
      this.rivalNestsInstanced.setMatrixAt(n, _dummy.matrix);
    }
    this.rivalNestsInstanced.instanceMatrix.needsUpdate = true;
    this.rivalNestsInstanced.computeBoundingSphere();
    this.scene.add(this.rivalNestsInstanced);

    this.disposableGeometries.push(
      trunkGeo,
      foliageGeo,
      bushGeo,
      fernGeo,
      rivalNestGeo
    );
    this.disposableMaterials.push(
      barkMat,
      foliageMat,
      bushMat,
      fernMat,
      rivalNestMat
    );
  }

  public initFruitBushes(): void {
    const BUSH_COUNT = 85;
    const fruitGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const fruitMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e, // Verde brillante bioluminiscente
      emissive: 0x15803d,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    });

    const bushFoliageGeo = new THREE.DodecahedronGeometry(1.6, 1);
    const bushMat = new THREE.MeshStandardMaterial({
      color: 0x14532d,
      roughness: 0.8,
    });

    this.disposableGeometries.push(fruitGeo, bushFoliageGeo);
    this.disposableMaterials.push(fruitMat, bushMat);

    for (let i = 0; i < BUSH_COUNT; i++) {
      // Colocar primeros arbustos cerca de la llanura del nido (30m - 120m) y el resto por todo el continente
      const angle =
        i < 16
          ? (i / 16) * Math.PI * 2 + (i % 3) * 0.15
          : Math.random() * Math.PI * 2;
      const dist =
        i < 16
          ? 30 + (i % 4) * 18 + Math.random() * 12
          : 30 + Math.random() * 900; // Entre el nido y el borde continental
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = getLandHeightAt(x, z);

      if (y > 0.5) {
        const bushGroup = new THREE.Group();
        bushGroup.position.set(x, y + 0.8, z);
        bushGroup.visible =
          !this.isEditorSandboxActive &&
          this.currentStage === 'creature_stage';

        // Follaje del arbusto
        const foliageMesh = new THREE.Mesh(bushFoliageGeo, bushMat);
        foliageMesh.castShadow = true;
        foliageMesh.receiveShadow = true;
        bushGroup.add(foliageMesh);

        // Añadir frutos accesibles por arbusto
        const fruits: FruitNode[] = [];
        const fruitOffsets = [
          new THREE.Vector3(0.9, 0.4, 0.5),
          new THREE.Vector3(-0.8, 0.3, -0.6),
          new THREE.Vector3(0.3, 0.7, -0.8),
          new THREE.Vector3(-0.5, 0.5, 0.8),
        ];

        fruitOffsets.forEach((offset) => {
          const fruitMesh = new THREE.Mesh(fruitGeo, fruitMat);
          fruitMesh.position.copy(offset);
          bushGroup.add(fruitMesh);
          fruits.push({ mesh: fruitMesh, isHarvested: false, respawnTimer: 0 });
        });

        this.scene.add(bushGroup);
        this.fruitBushes.push({
          position: bushGroup.position,
          bushGroup,
          fruits,
        });
      }
    }
  }

  public updateFruitBushes(dt: number): void {
    // Regenerar frutos consumidos tras 45 segundos
    for (const bush of this.fruitBushes) {
      for (const fruit of bush.fruits) {
        if (fruit.isHarvested) {
          fruit.respawnTimer -= dt;
          if (fruit.respawnTimer <= 0) {
            fruit.isHarvested = false;
            fruit.mesh.visible = true;
            fruit.mesh.scale.set(1, 1, 1);
          }
        }
      }
    }
  }

  /**
   * Initializes the isolated 3D Spore Laboratory Petri Dish platform (for Cell Stage)
   * AND the Coastal Sandy Nest Platform (for Creature Stage) with a 3-point studio lighting rig.
   */
  private initEditorSandbox(): void {
    this.sandboxGroup = new THREE.Group();
    this.sandboxGroup.visible = false;

    this.sandboxPetriDishSubgroup = new THREE.Group();
    this.sandboxCoastalNestSubgroup = new THREE.Group();
    this.sandboxCoastalNestSubgroup.visible = false;
    this.sandboxGroup.add(this.sandboxPetriDishSubgroup);
    this.sandboxGroup.add(this.sandboxCoastalNestSubgroup);

    // 1. Dark Polished Laboratory Petri Dish Base Disk (Cell Stage)
    const dishBaseGeo = new THREE.CylinderGeometry(14.5, 15.2, 0.28, 64);
    dishBaseGeo.translate(0, -0.14, 0);
    const dishBaseMat = new THREE.MeshStandardMaterial({
      color: 0x031826,
      emissive: 0x042f40,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.35,
    });
    const dishBaseMesh = new THREE.Mesh(dishBaseGeo, dishBaseMat);
    dishBaseMesh.receiveShadow = true;
    this.sandboxPetriDishSubgroup.add(dishBaseMesh);

    // 2. Outer Frosted Glass Petri Rim Bevel
    const dishRimGeo = new THREE.TorusGeometry(14.6, 0.26, 16, 72);
    dishRimGeo.rotateX(Math.PI / 2);
    dishRimGeo.translate(0, 0.08, 0);
    const dishRimMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0891b2,
      emissiveIntensity: 0.65,
      roughness: 0.18,
      metalness: 0.45,
      transparent: true,
      opacity: 0.68,
    });
    const dishRimMesh = new THREE.Mesh(dishRimGeo, dishRimMat);
    this.sandboxPetriDishSubgroup.add(dishRimMesh);

    // 3. Concentric Bioluminescent Calibration Rings (with polygonOffset to prevent Z-fighting)
    const ringRadii: [number, number, number][] = [
      [2.6, 2.68, 0.42],
      [5.2, 5.28, 0.32],
      [8.4, 8.48, 0.24],
      [11.8, 11.9, 0.18],
    ];
    for (const [innerR, outerR, opacity] of ringRadii) {
      const rGeo = new THREE.RingGeometry(innerR, outerR, 64);
      rGeo.rotateX(-Math.PI / 2);
      const rMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const rMesh = new THREE.Mesh(rGeo, rMat);
      rMesh.position.y = 0.02;
      this.sandboxPetriDishSubgroup.add(rMesh);
      this.disposableGeometries.push(rGeo);
      this.disposableMaterials.push(rMat);
    }

    // 4. Subtle Hexagonal Bioluminescent Reticle in the Center of the Dish
    const hexGeo = new THREE.RingGeometry(3.8, 3.92, 6);
    hexGeo.rotateX(-Math.PI / 2);
    this.sandboxPulseRingMat = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.sandboxHexGridMesh = new THREE.Mesh(hexGeo, this.sandboxPulseRingMat);
    this.sandboxHexGridMesh.position.y = 0.03;
    this.sandboxGroup.add(this.sandboxHexGridMesh);

    // 4B. Coastal Sandy Nest Platform (Terrestrial Creature Workshop Stage)
    const sandMoundGeo = new THREE.CylinderGeometry(13.8, 15.6, 0.42, 64);
    sandMoundGeo.translate(0, -0.21, 0);
    const sandMoundMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x78350f,
      emissiveIntensity: 0.22,
      roughness: 0.86,
      metalness: 0.05,
    });
    const sandMoundMesh = new THREE.Mesh(sandMoundGeo, sandMoundMat);
    sandMoundMesh.receiveShadow = true;
    this.sandboxCoastalNestSubgroup.add(sandMoundMesh);

    const innerSandGeo = new THREE.CylinderGeometry(9.6, 10.4, 0.12, 48);
    innerSandGeo.translate(0, 0.02, 0);
    const innerSandMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0x92400e,
      emissiveIntensity: 0.18,
      roughness: 0.9,
      metalness: 0.02,
    });
    const innerSandMesh = new THREE.Mesh(innerSandGeo, innerSandMat);
    innerSandMesh.receiveShadow = true;
    this.sandboxCoastalNestSubgroup.add(innerSandMesh);

    const nestWovenRimGeo = new THREE.TorusGeometry(10.2, 0.55, 12, 48);
    nestWovenRimGeo.rotateX(Math.PI / 2);
    nestWovenRimGeo.translate(0, 0.22, 0);
    const nestWovenRimMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.88,
      metalness: 0.05,
    });
    const nestWovenRimMesh = new THREE.Mesh(nestWovenRimGeo, nestWovenRimMat);
    this.sandboxCoastalNestSubgroup.add(nestWovenRimMesh);

    const pebbleGeo = new THREE.DodecahedronGeometry(0.65, 1);
    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.78,
      metalness: 0.08,
    });
    const frondGeo = new THREE.ConeGeometry(0.55, 2.2, 6);
    frondGeo.rotateX(Math.PI * 0.38);
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x15803d,
      emissiveIntensity: 0.3,
      roughness: 0.55,
    });

    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 10.8 + (i % 2) * 0.65;
      const pebble = new THREE.Mesh(pebbleGeo, pebbleMat);
      pebble.position.set(Math.cos(a) * r, 0.28, Math.sin(a) * r);
      pebble.scale.set(1.25, 0.75 + (i % 3) * 0.18, 1.1);
      pebble.rotation.y = a;
      this.sandboxCoastalNestSubgroup.add(pebble);

      if (i % 2 === 0) {
        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.set(
          Math.cos(a + 0.12) * 11.4,
          0.42,
          Math.sin(a + 0.12) * 11.4
        );
        frond.rotation.y = -a + Math.PI / 2;
        this.sandboxCoastalNestSubgroup.add(frond);
      }
    }

    this.scene.add(this.sandboxGroup);

    // 5. Three-Point Studio Lighting Rig (Overhead Zenith Key + Cyan Fill + Emerald Rim)
    this.sandboxKeyLight = new THREE.SpotLight(
      0xf0fdfa,
      3.2,
      45,
      Math.PI / 3,
      0.55,
      1.2
    );
    this.sandboxKeyLight.visible = false;
    this.scene.add(this.sandboxKeyLight);
    this.scene.add(this.sandboxKeyLight.target);

    this.sandboxFillLight = new THREE.DirectionalLight(0x38bdf8, 1.35);
    this.sandboxFillLight.visible = false;
    this.scene.add(this.sandboxFillLight);
    this.scene.add(this.sandboxFillLight.target);

    this.sandboxRimLight = new THREE.DirectionalLight(0x34d399, 1.45);
    this.sandboxRimLight.visible = false;
    this.scene.add(this.sandboxRimLight);
    this.scene.add(this.sandboxRimLight.target);

    this.disposableGeometries.push(
      dishBaseGeo,
      dishRimGeo,
      hexGeo,
      sandMoundGeo,
      innerSandGeo,
      nestWovenRimGeo,
      pebbleGeo,
      frondGeo
    );
    this.disposableMaterials.push(
      dishBaseMat,
      dishRimMat,
      this.sandboxPulseRingMat,
      sandMoundMat,
      innerSandMat,
      nestWovenRimMat,
      pebbleMat,
      frondMat
    );
  }

  public update(
    elapsedTime: number,
    delta: number,
    playerX = 0,
    playerZ = 0,
    camera?: THREE.Camera
  ): void {
    // When in 3D Editor Sandbox Mode, keep the clean Petri Dish or Coastal Nest ambiance and animate only the subtle reticle
    if (this.isEditorSandboxActive) {
      const isLand = this.currentStage === 'creature_stage';
      const targetR = isLand ? 0.045 : 0.008;
      const targetG = isLand ? 0.16 : 0.063;
      const targetB = isLand ? 0.23 : 0.106;
      this.bgColor.r = THREE.MathUtils.damp(this.bgColor.r, targetR, 6.0, delta);
      this.bgColor.g = THREE.MathUtils.damp(this.bgColor.g, targetG, 6.0, delta);
      this.bgColor.b = THREE.MathUtils.damp(this.bgColor.b, targetB, 6.0, delta);
      this.fogExp2.color.copy(this.bgColor);
      this.fogExp2.density = THREE.MathUtils.damp(
        this.fogExp2.density,
        isLand ? 0.0018 : 0.0022,
        6.0,
        delta
      );

      this.sandboxPulseRingMat.color.setHex(isLand ? 0xfacc15 : 0x2dd4bf);
      this.sandboxPulseRingMat.opacity =
        0.28 + Math.sin(elapsedTime * 2.2) * 0.1;
      this.sandboxHexGridMesh.rotation.y = elapsedTime * 0.08;
      return;
    }

    // 1. Smoothly interpolate Biome Fog & Lighting tint based on active Planet Palette, stage & player position
    const biome = this.getBiomeAt(playerX, playerZ);
    const planetCfg =
      PLANET_THEME_PALETTES[this.currentPlanetTheme] ??
      PLANET_THEME_PALETTES.oceanic;

    _baseColorA.setHex(planetCfg.waterColor);
    _baseColorB.setHex(planetCfg.hemiSkyColor);

    let targetBgR = _baseColorA.r;
    let targetBgG = _baseColorA.g;
    let targetBgB = _baseColorA.b;

    let targetHemiR = _baseColorB.r;
    let targetHemiG = _baseColorB.g;
    let targetHemiB = _baseColorB.b;

    if (this.currentStage === 'creature_stage') {
      const distFromCenter = Math.hypot(playerX, playerZ);
      const abyssBlend = THREE.MathUtils.smoothstep(
        distFromCenter,
        CONTINENT_CONFIG.CONTINENT_RADIUS,
        CONTINENT_CONFIG.OCEAN_ABYSS_LIMIT
      );
      // Sky transitions from bright continental azure to ominous storm-teal near the Leviathan's abyss
      targetBgR = THREE.MathUtils.lerp(0.32, 0.04, abyssBlend);
      targetBgG = THREE.MathUtils.lerp(0.72, 0.22, abyssBlend);
      targetBgB = THREE.MathUtils.lerp(0.94, 0.34, abyssBlend);
      targetHemiR = THREE.MathUtils.lerp(0.99, 0.38, abyssBlend);
      targetHemiG = THREE.MathUtils.lerp(0.95, 0.68, abyssBlend);
      targetHemiB = THREE.MathUtils.lerp(0.62, 0.78, abyssBlend);

      this.updateContinentChunks(playerX, playerZ, camera);
      this.updateFruitBushes(delta);

      if (this.oceanWaterMesh) {
        this.oceanWaterMesh.position.y = Math.sin(elapsedTime * 1.6) * 0.14;
      }

      if (this.leviathanBreachTimer > 0 && this.leviathanGroup) {
        this.leviathanBreachTimer = Math.max(
          0,
          this.leviathanBreachTimer - delta
        );
        const progress = 1.0 - this.leviathanBreachTimer / 1.65;
        const arcY = Math.sin(progress * Math.PI) * 11.5 - 3.5;
        this.leviathanGroup.position.y = arcY;
        if (this.leviathanJawMesh) {
          this.leviathanJawMesh.rotation.x =
            0.35 + Math.sin(progress * Math.PI * 3.0) * 0.28;
        }
        if (this.leviathanSplashRing) {
          const splashScale = 1.0 + progress * 2.4;
          this.leviathanSplashRing.scale.setScalar(splashScale);
          this.leviathanSplashRing.position.y = -arcY + 0.25;
        }
        if (this.leviathanBreachTimer <= 0) {
          this.leviathanGroup.visible = false;
        }
      }

      this.nestAuraMat.opacity = 0.22 + Math.sin(elapsedTime * 3.2) * 0.1;
      for (let e = 0; e < this.nestEggs.length; e++) {
        const pulse = 1.0 + Math.sin(elapsedTime * 3.5 + e) * 0.06;
        this.nestEggs[e].scale.set(0.85 * pulse, 1.35 * pulse, 0.85 * pulse);
      }
    } else if (biome.id === 'fosa_termal') {
      // Blend planet's base water & sky tint with a subtle thermal amber warmth
      targetBgR = THREE.MathUtils.lerp(_baseColorA.r, 0.16, 0.22);
      targetBgG = THREE.MathUtils.lerp(_baseColorA.g, 0.07, 0.22);
      targetBgB = THREE.MathUtils.lerp(_baseColorA.b, 0.05, 0.22);
      targetHemiR = THREE.MathUtils.lerp(_baseColorB.r, 0.98, 0.28);
      targetHemiG = THREE.MathUtils.lerp(_baseColorB.g, 0.65, 0.28);
      targetHemiB = THREE.MathUtils.lerp(_baseColorB.b, 0.32, 0.28);
    } else if (biome.id === 'arrecife_abisal') {
      // Slightly deeper abyssal shade of the current planet's water & rim palette
      _baseColorC.setHex(planetCfg.rimLightColor);
      targetBgR = _baseColorA.r * 0.85;
      targetBgG = _baseColorA.g * 0.85;
      targetBgB = _baseColorA.b * 0.92;
      targetHemiR = THREE.MathUtils.lerp(_baseColorB.r, _baseColorC.r, 0.35);
      targetHemiG = THREE.MathUtils.lerp(_baseColorB.g, _baseColorC.g, 0.35);
      targetHemiB = THREE.MathUtils.lerp(_baseColorB.b, _baseColorC.b, 0.35);
    }

    this.bgColor.r = THREE.MathUtils.damp(this.bgColor.r, targetBgR, 2.2, delta);
    this.bgColor.g = THREE.MathUtils.damp(this.bgColor.g, targetBgG, 2.2, delta);
    this.bgColor.b = THREE.MathUtils.damp(this.bgColor.b, targetBgB, 2.2, delta);
    this.fogExp2.color.copy(this.bgColor);

    const baseFogDensity =
      this.currentStage === 'creature_stage'
        ? 0.0016
        : GAME_CONFIG.WORLD.FOG_DENSITY * this.stageFogFactor;
    this.fogExp2.density = THREE.MathUtils.damp(
      this.fogExp2.density,
      baseFogDensity * this.fogDensityMultiplier * this.userFogDistanceMultiplier,
      3.0,
      delta
    );

    this.hemiLight.color.r = THREE.MathUtils.damp(
      this.hemiLight.color.r,
      targetHemiR,
      2.2,
      delta
    );
    this.hemiLight.color.g = THREE.MathUtils.damp(
      this.hemiLight.color.g,
      targetHemiG,
      2.2,
      delta
    );
    this.hemiLight.color.b = THREE.MathUtils.damp(
      this.hemiLight.color.b,
      targetHemiB,
      2.2,
      delta
    );

    // 2. Pulse Electric Coral Plateaus & Chloroplast Tree Canopy emissive intensity (zero matrix updates, GPU-only!)
    this.electricCoralMat.emissiveIntensity =
      0.85 + Math.sin(elapsedTime * 3.8) * 0.45;
    if (this.chloroplastFrondMat) {
      this.chloroplastFrondMat.emissiveIntensity =
        0.72 + Math.sin(elapsedTime * 2.6) * 0.28;
    }

    // 3. Animate Hydrothermal Vents & Ascending Bubble Plumes
    const ventAttr = this.ventBubblesPoints.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    for (let i = 0; i < this.ventBubbleCount; i++) {
      const ventIdx = i % this.ventPositions.length;
      const vp = this.ventPositions[ventIdx];
      let by = ventAttr.getY(i) + delta * (3.2 + (i % 4) * 0.6);
      if (by > GAME_CONFIG.WORLD.SWIM_PLANE_Y + 5.5) {
        by = vp.y + 4.8;
      }
      const baseX = this.ventBubbleBaseXZ[i * 2];
      const baseZ = this.ventBubbleBaseXZ[i * 2 + 1];
      const spiralX = baseX + Math.sin(elapsedTime * 3.0 + i) * 0.35;
      const spiralZ = baseZ + Math.cos(elapsedTime * 3.0 + i) * 0.35;
      ventAttr.setXYZ(i, spiralX, by, spiralZ);
    }
    ventAttr.needsUpdate = true;

    for (let i = 0; i < this.ventAuraMats.length; i++) {
      this.ventAuraMats[i].opacity =
        0.16 + Math.sin(elapsedTime * 2.8 + i) * 0.08;
    }

    // 4. Animate Colossal Abyssal Silhouettes (Spore Depth Plane Staging across 5 stages)
    const depthTargets: Record<CellularGrowthStage, number> = {
      1: -5.2,
      2: -4.2,
      3: -3.2,
      4: -2.2,
      5: -1.4,
    };
    const scaleFactors: Record<CellularGrowthStage, number> = {
      1: 1.0,
      2: 1.15,
      3: 1.28,
      4: 0.95,
      5: 0.72,
    };
    const depthTargetY = depthTargets[this.currentGrowthStage] ?? -5.0;
    const scaleStageFactor = scaleFactors[this.currentGrowthStage] ?? 1.0;

    for (let i = 0; i < this.abyssalSilhouettes.length; i++) {
      const s = this.abyssalSilhouettes[i];
      const prevX = s.group.position.x;
      const prevZ = s.group.position.z;

      s.orbitAngle += s.orbitSpeed * delta;
      const nextX = s.centerX + Math.cos(s.orbitAngle) * s.orbitRadius;
      const nextZ =
        s.centerZ + Math.sin(s.orbitAngle * 0.85) * (s.orbitRadius * 0.85);

      s.group.position.set(
        nextX,
        depthTargetY + Math.sin(elapsedTime * 0.9 + s.phaseOffset) * 0.25,
        nextZ
      );
      s.group.scale.setScalar(s.baseScale * scaleStageFactor);

      const dx = nextX - prevX;
      const dz = nextZ - prevZ;
      if (dx * dx + dz * dz > 0.00001) {
        s.group.rotation.y = Math.atan2(-dx, -dz);
      }

      const swimWave = elapsedTime * 2.2 + s.phaseOffset;
      for (let t = 0; t < s.tailSegments.length; t++) {
        s.tailSegments[t].position.x =
          Math.sin(swimWave - t * 0.8) * (0.45 + t * 0.35);
      }
      if (s.fins.length === 2) {
        const flap = Math.sin(swimWave * 0.7) * 0.18;
        s.fins[0].rotation.y = flap;
        s.fins[1].rotation.y = -flap;
      }
    }

    // 5. Gentle drift of suspended marine snow / plankton
    const posAttr = this.planktonPoints.geometry.getAttribute(
      'position'
    ) as THREE.BufferAttribute;
    for (let i = 0; i < this.planktonCount; i++) {
      let py = posAttr.getY(i) + delta * 0.35;
      const px =
        posAttr.getX(i) + Math.sin(elapsedTime * 0.6 + i) * delta * 0.2;
      if (py > 12.0) py = -3.5;
      posAttr.setXY(i, px, py);
    }
    posAttr.needsUpdate = true;

    // 6. Animate Mating Call Sonar Ping Waves (MatingPingWave)
    for (let i = this.sonarPingWaves.length - 1; i >= 0; i--) {
      const w = this.sonarPingWaves[i];
      w.elapsed += delta;
      if (w.elapsed < 0) continue;
      if (w.elapsed >= w.duration) {
        w.mesh.removeFromParent();
        w.mat.dispose();
        this.sonarPingWaves.splice(i, 1);
        continue;
      }
      w.mesh.visible = true;
      const t = w.elapsed / w.duration;
      const radius = 0.8 + t * w.maxRadius;
      w.mesh.scale.setScalar(radius);
      w.mat.opacity = Math.pow(1.0 - t, 1.4) * 0.85;
    }

    // 7. Animate Egg Hatching Cell Burst FX Particles
    for (let i = this.cellBurstParticles.length - 1; i >= 0; i--) {
      const p = this.cellBurstParticles[i];
      p.elapsed += delta;
      if (p.elapsed >= p.duration) {
        p.mesh.removeFromParent();
        p.mat.dispose();
        this.cellBurstParticles.splice(i, 1);
        continue;
      }
      const t = p.elapsed / p.duration;
      p.mesh.position.addScaledVector(p.velocity, delta);
      p.velocity.multiplyScalar(Math.max(0, 1.0 - delta * 3.2));
      p.mesh.scale.setScalar((1.0 - t * 0.6) * p.baseScale);
      p.mat.opacity = (1.0 - t) * 0.92;
    }
  }

  private readonly sonarPingWaves: {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    elapsed: number;
    duration: number;
    maxRadius: number;
  }[] = [];
  private sonarRingSharedGeo: THREE.RingGeometry | null = null;

  private readonly cellBurstParticles: {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    velocity: THREE.Vector3;
    elapsed: number;
    duration: number;
    baseScale: number;
  }[] = [];
  private burstParticleSharedGeo: THREE.SphereGeometry | null = null;

  /**
   * Emite ondas acústicas bioluminiscentes en círculos expansivos (MatingPingWave)
   * durante el llamado de cortejo o el eco de respuesta de la pareja.
   */
  public spawnSonarPing(origin: THREE.Vector3, colorHex = 0x38bdf8): void {
    if (!this.sonarRingSharedGeo) {
      this.sonarRingSharedGeo = new THREE.RingGeometry(0.88, 1.0, 48);
      this.sonarRingSharedGeo.rotateX(-Math.PI / 2);
      this.disposableGeometries.push(this.sonarRingSharedGeo);
    }

    // Emitir 3 anillos concéntricos escalonados
    for (let ringIdx = 0; ringIdx < 3; ringIdx++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.sonarRingSharedGeo, mat);
      mesh.position.set(
        origin.x,
        GAME_CONFIG.WORLD.SWIM_PLANE_Y + 0.08,
        origin.z
      );
      mesh.scale.setScalar(0.8);
      mesh.visible = ringIdx === 0;
      this.scene.add(mesh);

      this.sonarPingWaves.push({
        mesh,
        mat,
        elapsed: -ringIdx * 0.22,
        duration: 1.45,
        maxRadius: 22.0 + ringIdx * 4.0,
      });
    }
  }

  /**
   * Estallido bioluminiscente de fragmentos de membrana al eclosionar el huevo primordial.
   */
  public spawnCellBurstFX(origin: THREE.Vector3, colorStr = '#22d3ee'): void {
    if (!this.burstParticleSharedGeo) {
      this.burstParticleSharedGeo = new THREE.SphereGeometry(0.18, 10, 8);
      this.disposableGeometries.push(this.burstParticleSharedGeo);
    }

    const baseColor = new THREE.Color(colorStr);
    this.spawnSonarPing(origin, baseColor.getHex());

    const count = 26;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const speed = 4.5 + Math.random() * 8.5;
      const vy = (Math.random() - 0.3) * 3.5;

      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? baseColor : new THREE.Color(0xa5f3fc),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.burstParticleSharedGeo, mat);
      mesh.position.copy(origin);
      const baseScale = 0.65 + Math.random() * 0.95;
      mesh.scale.setScalar(baseScale);
      this.scene.add(mesh);

      this.cellBurstParticles.push({
        mesh,
        mat,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          vy,
          Math.sin(angle) * speed
        ),
        elapsed: 0,
        duration: 0.75 + Math.random() * 0.35,
        baseScale,
      });
    }
  }

  /**
   * Emite un destello bioluminiscente de unión y partículas ascendentes de cortejo
   * cuando el jugador y su pareja nadan juntos hacia el Taller Evolutivo.
   */
  public spawnMatingHeartsOrGlow(
    origin: THREE.Vector3,
    colorStr = '#38bdf8'
  ): void {
    if (!this.burstParticleSharedGeo) {
      this.burstParticleSharedGeo = new THREE.SphereGeometry(0.18, 10, 8);
      this.disposableGeometries.push(this.burstParticleSharedGeo);
    }

    const baseColor = new THREE.Color(colorStr);
    const pinkGlow = new THREE.Color(0xf472b6);
    this.spawnSonarPing(origin, baseColor.getHex());

    const count = 22;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 2.2 + Math.random() * 4.5;
      const vy = 1.5 + Math.random() * 2.8;

      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? baseColor : pinkGlow,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(this.burstParticleSharedGeo, mat);
      mesh.position.copy(origin);
      const baseScale = 0.75 + Math.random() * 0.85;
      mesh.scale.setScalar(baseScale);
      this.scene.add(mesh);

      this.cellBurstParticles.push({
        mesh,
        mat,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          vy,
          Math.sin(angle) * speed
        ),
        elapsed: 0,
        duration: 1.15 + Math.random() * 0.35,
        baseScale,
      });
    }
  }

  public dispose(): void {

    if (this.envTexture) {
      this.envTexture.dispose();
    }
    for (const w of this.sonarPingWaves) {
      w.mesh.removeFromParent();
      w.mat.dispose();
    }
    for (const p of this.cellBurstParticles) {
      p.mesh.removeFromParent();
      p.mat.dispose();
    }
    for (const geo of this.disposableGeometries) {
      geo.dispose();
    }
    for (const mat of this.disposableMaterials) {
      mat.dispose();
    }
  }
}

