import * as THREE from 'three';

export type GameStatus = 'menu' | 'playing' | 'paused' | 'editing' | 'gameover';

export type GraphicsQualityPreset = 'low' | 'medium' | 'high';
export type FpsLimitSetting = '30' | '60' | 'unlimited';
export type SteeringModeSetting = 'keyboard' | 'mouse';
export type ColorblindModeSetting =
  | 'none'
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia';

export interface GameSettings {
  // Tab A: Gráficos y Rendimiento
  graphicsQuality: GraphicsQualityPreset;
  fpsLimit: FpsLimitSetting;
  fogDistancePercent: number; // 50 to 150
  screenShake: boolean;
  // Tab B: Audio y Sonido
  masterVolume: number; // 0 to 100
  sfxVolume: number; // 0 to 100
  ambientVolume: number; // 0 to 100
  threatAudioAlerts: boolean;
  // Tab C: Jugabilidad y Controles
  steeringMode: SteeringModeSetting;
  rotationSensitivity: number; // 0.5 to 2.0
  invertEditorCamera: boolean;
  autoBilateralSymmetry: boolean;
  // Tab D: Accesibilidad y Sistema
  colorblindMode: ColorblindModeSetting;
  reducedMotion: boolean;
  language: 'es';
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  graphicsQuality: 'high',
  fpsLimit: '60',
  fogDistancePercent: 100,
  screenShake: true,
  masterVolume: 80,
  sfxVolume: 85,
  ambientVolume: 70,
  threatAudioAlerts: true,
  steeringMode: 'keyboard',
  rotationSensitivity: 1.0,
  invertEditorCamera: false,
  autoBilateralSymmetry: true,
  colorblindMode: 'none',
  reducedMotion: false,
  language: 'es',
};

export type DietType = 'herbivore' | 'omnivore' | 'carnivore';

export type FoodKind = 'plant' | 'meat' | 'dna_spore' | 'genetic_nodule';

export type BiomeType = 'pradera_luminosa' | 'fosa_termal' | 'arrecife_abisal';

export type SpeciesType =
  | 'hunter'
  | 'leviathan'
  | 'herbivore'
  | 'nematocito'
  | 'gasteropodo'
  | 'perforador'
  | 'vibora_fosa'
  | 'medusa_biolum'
  | 'anquilocelula'
  | 'esponja_espicular'
  | 'nebula_gelatinosa'
  | 'bala_fumarola'
  | 'mirador_abisal';

export type PredatorBehaviorState =
  | 'DEAMBULAR'
  | 'PERSEGUIR'
  | 'ATACAR'
  | 'HUIR'
  | 'ATURDIDO';

export type CellBodyShape = 'esferico' | 'fusiforme' | 'alargado';

export type CellColorTheme = 'cyan' | 'emerald' | 'crimson' | 'violet';

export type EvolutionaryStage = 'cell_stage' | 'creature_stage';

export type AdaptationCategory =
  | 'alimentacion'
  | 'ataque'
  | 'defensa'
  | 'movimiento'
  | 'sentidos'
  | 'metabolismo'
  | 'apariencia';

export type DiscoveryState =
  | 'locked_hidden'
  | 'discovered_unbought'
  | 'installed';

export type DiscoverySource =
  | 'initial'
  | 'drop_from_prey'
  | 'drop_from_predator'
  | 'environmental_fossil'
  | 'biome_exposure'
  | 'predator_kill'
  | 'scavenge_carcass'
  | 'fossil_fragment';

export type OrganSocketType =
  | 'front'
  | 'rear'
  | 'lateral'
  | 'dorsal'
  | 'internal'
  | 'any';

export interface PlacedOrganMorphology {
  /** Factor de escala general (0.5x a 2.2x, por defecto 1.0) */
  scaleOverall: number;
  /** Grosor / anchura transversal (0.5x a 2.0x, por defecto 1.0) */
  scaleWidth: number;
  /** Longitud / altura de proyección (0.5x a 2.5x, por defecto 1.0) */
  scaleHeight: number;
  /** Tono hexadecimal o clave de paleta bioluminiscente individual (undefined = color original/sincronizado) */
  colorOverride?: string;
}

export const DEFAULT_ORGAN_MORPHOLOGY: PlacedOrganMorphology = {
  scaleOverall: 1.0,
  scaleWidth: 1.0,
  scaleHeight: 1.0,
  colorOverride: undefined,
};

export interface PlacedOrganInstance {
  instanceId: string;
  adaptationId: string;
  /** Angle around cell perimeter (-PI to PI, where 0 is rear +Z and PI/-PI is front -Z) */
  angle: number;
  /** Position along spine (-1 = front, 0 = center, +1 = rear) */
  axialOffset: number;
  /** True if placed off-center and automatically generates its bilateral mirror twin */
  mirrorSymmetry: boolean;
  /** Rotación horizontal local (radianes) controlada con el tirador esférico o el inspector */
  orientationYaw: number;
  /** Inclinación vertical local (radianes) controlada con el tirador esférico o el inspector */
  orientationPitch: number;
  /** Parámetros morfológicos no uniformes y pigmentación individual por pieza */
  morphology: PlacedOrganMorphology;
  /** Alias heredado de rotación horizontal local */
  localYaw?: number;
  /** Alias heredado de inclinación vertical local */
  localPitch?: number;
}

export interface PoisonCloudHazard {
  position: THREE.Vector3;
  radius: number;
  active: boolean;
}

export interface AcidSpitProjectile {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  active: boolean;
}

export interface PredatorTelemetry {
  id: number;
  species: SpeciesType;
  speciesName: string;
  state: PredatorBehaviorState;
  distanceToPlayer: number;
}

export interface CellAdaptationDefinition {
  id: string;
  name: string;
  veiledName: string;
  category: AdaptationCategory;
  stage: EvolutionaryStage;
  dnaCost: number;
  discoverySource: DiscoverySource;
  discoveryHint: string;
  stackable: boolean;
  maxStacks: number;
  socketType: OrganSocketType;
  description: string;
  statSummary: string;
  pros: string[];
  tradeoffs: string[];
  incompatibilities?: string[];
  modifiers?: Record<string, unknown>;
  meshId?: string;
}

export type AdaptationDefinition = CellAdaptationDefinition;

export interface CellularEvolutionSlot extends CellAdaptationDefinition {
  /** Alias of dnaCost for UI compatibility */
  costAdn: number;
  /** True when installedStacks > 0 */
  unlocked: boolean;
  /** Current discovery & installation state */
  discoveryState: DiscoveryState;
  /** Number of copies currently installed on the organism (0 .. maxStacks) */
  installedStacks: number;
}

export interface UnlockedBannerNotification {
  id: string;
  adaptationId: string;
  name: string;
  statSummary: string;
  sourceLabel: string;
  isPureAdnBonus?: boolean;
}

export type CellularGrowthStage = 1 | 2 | 3 | 4 | 5;

export type InnateTraitId =
  | 'elastic_membrane'
  | 'thermophilic_cytoplasm'
  | 'voracious_chemotaxis'
  | 'abyssal_bioluminescence';

export interface GenesisConfig {
  speciesName: string;
  initialDiet: DietType;
  innateTrait: InnateTraitId;
  bodyShape?: CellBodyShape;
  colorTheme?: CellColorTheme;
}

export interface PlayerStats {
  speciesName: string;
  bodyShape: CellBodyShape;
  colorTheme: CellColorTheme;
  spineSegments: 1 | 2 | 3;
  spineLength: number;
  torsoRadii: [number, number, number];
  placedOrgans: PlacedOrganInstance[];
  evolutionaryStage: EvolutionaryStage;
  innateTrait: InnateTraitId;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  adn: number;
  totalAdnEarned: number;
  growthStage: CellularGrowthStage;
  nextStageAdnThreshold: number;
  activeArenaRadius: number;
  diet: DietType;
  foodEaten: number;
  survivalTime: number;
  isStarving: boolean;
  isBoosting: boolean;
  boostCooldownRatio: number;
  abilityCooldownRatio: number;
  activeStatusEffect: string | null;
  speed: number;
  damageFlashTime: number;
  /** True if at least one eye organ is installed */
  hasEyes: boolean;
  /** Quantitative organism attribute totals for the Spore Workshop HUD */
  attackPower: number;
  poisonLevel: number;
  electricLevel: number;
  defensePercent: number;
  visionLevel: number;
}

export interface GameUISnapshot {
  status: GameStatus;
  hasSavedGame: boolean;
  settings: GameSettings;
  stats: PlayerStats;
  activeFoodCount: number;
  totalFoodCapacity: number;
  predatorStates: PredatorTelemetry[];
  nearestSpeciesName: string;
  nearestPredatorState: PredatorBehaviorState;
  nearestPredatorDistance: number;
  nearestHasUncataloguedGene: boolean;
  currentBiomeName: string;
  activeQuestTitle: string;
  activeQuestProgressText: string;
  readyForLandTransition: boolean;
  recentEventMessage: string | null;
  unlockedBannerNotification: UnlockedBannerNotification | null;
  evolutionSlots: CellularEvolutionSlot[];
  selectedPlacedInstanceId: string | null;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  ability: boolean;
  socialize: boolean;
}
