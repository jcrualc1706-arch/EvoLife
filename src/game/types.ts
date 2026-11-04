import * as THREE from 'three';

export type GameStatus =
  | 'menu'
  | 'intro_cinematic'
  | 'brain_cinematic'
  | 'playing'
  | 'paused'
  | 'editing'
  | 'gameover';

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
  steeringMode: 'mouse',
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
  | 'mirador_abisal'
  | 'clorofita_solar'
  | 'fito_medusa'
  | 'espora_refulgente'
  | 'pluricelular_pastador'
  | 'titan_verde'
  | 'quelicerado_abisal'
  | 'nautilo_espinoso'
  | 'triturador_fumarola'
  | 'aguijon_electrico'
  | 'leviatan_sauro';

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
  | 'apariencia'
  | 'brazos'
  | 'piernas'
  | 'manos'
  | 'pies';

export type CreatureBodyArchetype =
  | 'bipedo_agil'
  | 'cuadrupedo_robusto'
  | 'reptiliano_rastreador'
  | 'humanoide_erguido'
  | 'serpentino';

export interface CreatureMorphologySliders {
  archetype: CreatureBodyArchetype;
  heightScale: number;      // 0.7x a 1.6x (Altura)
  widthScale: number;       // 0.6x a 1.8x (Anchura / Envergadura)
  musculatureScale: number; // 0.7x a 1.9x (Musculatura / Volumen)
}

export const DEFAULT_CREATURE_MORPHOLOGY: CreatureMorphologySliders = {
  archetype: 'bipedo_agil',
  heightScale: 1.0,
  widthScale: 1.0,
  musculatureScale: 1.0,
};

export type EditorSelectionTarget = 'body' | 'legs' | 'arms' | null;

export const MORPHOLOGY_SCALE_LIMITS = {
  // Esferas del torso / segmentos corporales
  bodySegment: {
    min: 0.45, // Radio mínimo para no colapsar la malla
    max: 2.2, // Radio máximo para no desbordar el podio
    step: 0.05, // Variación por cada muesca de la rueda
  },
  // Huesos y grosor de extremidades (patas / brazos)
  limbThickness: {
    min: 0.5,
    max: 1.8,
    step: 0.04,
  },
  // Órganos externos (ojos, bocas, adornos)
  organScale: {
    min: 0.4,
    max: 2.0,
    step: 0.05,
  },
} as const;

export type BodySegmentId = 'cabeza' | 'cuello' | 'pecho' | 'abdomen' | 'cola';

export const BODY_SEGMENT_ORDER: readonly BodySegmentId[] = [
  'cabeza',
  'cuello',
  'pecho',
  'abdomen',
  'cola',
] as const;

export interface BodySegmentConfig {
  id: BodySegmentId;
  label: string;
  radius: number; // Radio/grosor local de la esfera (0.45 a 2.20, por defecto 1.0)
  lengthZ: number; // Longitud del segmento (0.5m a 2.0m, por defecto 1.0)
  pitchAngle: number; // Inclinación vertical (-45° a +45°, para arquear o erguir)
  yawAngle: number; // Curvatura lateral (-30° a +30°)
}

export function createDefaultBodySegments(): BodySegmentConfig[] {
  return [
    { id: 'cabeza', label: 'Cabeza', radius: 1.0, lengthZ: 1.0, pitchAngle: 0, yawAngle: 0 },
    { id: 'cuello', label: 'Cuello', radius: 1.0, lengthZ: 1.0, pitchAngle: 0, yawAngle: 0 },
    { id: 'pecho', label: 'Pecho', radius: 1.0, lengthZ: 1.0, pitchAngle: 0, yawAngle: 0 },
    { id: 'abdomen', label: 'Abdomen', radius: 1.0, lengthZ: 1.0, pitchAngle: 0, yawAngle: 0 },
    { id: 'cola', label: 'Cola', radius: 1.0, lengthZ: 1.0, pitchAngle: 0, yawAngle: 0 },
  ];
}

export interface SpineVertebraNode {
  x: number;
  y: number;
  z: number;
  /** Radio transversal general de la vértebra (0.35x a 2.8x, por defecto 1.0) */
  radius: number;
  /** Grosor transversal horizontal (0.35x a 2.8x) */
  radiusX?: number;
  /** Grosor transversal vertical (0.35x a 2.8x) */
  radiusY?: number;
  /** Rotación axial del marco vertebral (roll en radianes) */
  rotationRoll?: number;
  pitch: number;
  yaw: number;
}

export function createDefaultSpineNodes(
  count = 6,
  spineLength = 1.0
): SpineVertebraNode[] {
  const n = Math.max(4, Math.min(12, Math.round(count)));
  const halfZ = 1.15 * spineLength;
  const nodes: SpineVertebraNode[] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5;
    const u = -1 + 2 * t; // -1 (cranial/front) to +1 (caudal/rear)
    const archY = Math.sin(t * Math.PI) * 0.08;
    const taper =
      i === 0
        ? 0.92
        : i === n - 1
        ? 0.76
        : 1.0 + Math.sin(t * Math.PI) * 0.14;
    const rVal = Number(taper.toFixed(2));
    nodes.push({
      x: 0,
      y: archY,
      z: u * halfZ,
      radius: rVal,
      radiusX: rVal,
      radiusY: rVal,
      rotationRoll: 0,
      pitch: 0,
      yaw: 0,
    });
  }
  return nodes;
}

export type SkinTextureType = 'smooth' | 'reptilian_scales' | 'matte_chitin';

export type CoatPatternType =
  | 'none'
  | 'tiger_stripes'
  | 'leopard_spots'
  | 'dorsal_gradient'
  | 'pale_belly';

export interface CreaturePaintConfig {
  /** Capa 1: Color base general de la piel */
  baseColor: string;
  /** Capa 1: Textura física PBR (piel lisa, escamas reptilianas o quitina mate) */
  skinTexture: SkinTextureType;
  /** Capa 2: Tipo de patrón dorsal/corporal */
  patternType: CoatPatternType;
  /** Capa 2: Color primario del patrón */
  patternPrimaryColor: string;
  /** Capa 2: Color secundario del patrón */
  patternSecondaryColor: string;
  /** Capa 2: Opacidad del patrón */
  patternOpacity?: number;
  /** Capa 3: Tonalidad de detalle (garras, uñas, dientes, cuernos, párpados) */
  detailColor: string;
}

export const DEFAULT_CREATURE_PAINT: CreaturePaintConfig = {
  baseColor: '#22d3ee',
  skinTexture: 'smooth',
  patternType: 'none',
  patternPrimaryColor: '#0e7490',
  patternSecondaryColor: '#a5f3fc',
  patternOpacity: 0.85,
  detailColor: '#fef08a',
};

export interface CreatureStats {
  // Locomoción y Supervivencia
  speed: number;       // 1 - 5 (otorgado por pies y piernas)
  jump: number;        // 1 - 5 (otorgado por patas musculosas y pies elásticos)
  glide: number;       // 0 - 5 (otorgado por membranas alares/brazos de planeo)
  sneak: number;       // 1 - 5 (otorgado por almohadillas en pies y patas gráciles)
  health: number;      // 1 - 5 (nivel de salud/robustez)
  sight: number;       // 1 - 5 (nivel de visión/sentidos)

  // Combate
  bite: number;        // 1 - 5 (otorgado por bocas)
  charge: number;      // 0 - 5 (otorgado por cuernos y pezuñas)
  strike: number;      // 0 - 5 (otorgado por garras y manos robustas)
  spit: number;        // 0 - 5 (otorgado por glándulas bucales)

  // Social / Tribal
  sing: number;        // 1 - 5 (otorgado por bocas y crestas)
  dance: number;       // 1 - 5 (otorgado por pies ágiles)
  pose: number;        // 0 - 5 (otorgado por manos expresivas)
  charm: number;       // 0 - 5 (otorgado por adornos y plumas)

  // Funcional
  hasGraspers: boolean; // True si equipa manos (permite coger comida y herramientas)
}

export const DEFAULT_CREATURE_STATS: CreatureStats = {
  speed: 1,
  jump: 1,
  glide: 0,
  sneak: 1,
  health: 1,
  sight: 1,
  bite: 1,
  charge: 0,
  strike: 0,
  spit: 0,
  sing: 1,
  dance: 1,
  pose: 0,
  charm: 0,
  hasGraspers: false,
};

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
  /** Flexión de la articulación proximal (cadera/hombro) en radianes (-1.0 a 1.0) */
  upperJointAngle?: number;
  /** Flexión de la articulación media (rodilla/codo) en radianes (-1.2 a 1.2) */
  middleJointAngle?: number;
  /** Multiplicador de longitud de segmento óseo (0.6x a 1.75x) */
  boneLength?: number;
}

export const DEFAULT_ORGAN_MORPHOLOGY: PlacedOrganMorphology = {
  scaleOverall: 1.0,
  scaleWidth: 1.0,
  scaleHeight: 1.0,
  colorOverride: undefined,
  upperJointAngle: 0,
  middleJointAngle: 0,
  boneLength: 1.0,
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
  /** Índice de la vértebra más cercana para anclaje paramétrico relativo */
  vertebraIndex?: number;
  /** Desplazamiento paramétrico 0..1 entre vértebras contiguas */
  axialT?: number;
  /** Ángulo azimutal alrededor de la sección transversal de la piel */
  surfaceAngle?: number;
  /** Segmento anatómico directo al que pertenece la pieza (cabeza, cuello, pecho, abdomen, cola) */
  targetSegmentId?: BodySegmentId;
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
  /** Official Spore Terrestrial Creature & Tribal Stats */
  creatureStats?: CreatureStats;
  /** Parametric 3D CatmullRom spline vertebrae nodes (3 to 9 active nodes) */
  spineNodes?: SpineVertebraNode[];
  /** 3-Layer PBR Paint & Pattern Configuration (Base, Pattern, Detail) */
  paintConfig?: CreaturePaintConfig;
  /** Current polygon/bone complexity score (0..maxComplexity) */
  complexityScore?: number;
  /** Maximum safe complexity budget */
  maxComplexity?: number;
  /** Whether bilateral symmetry is currently active in the Workshop (toggled via Tab) */
  symmetryEnabled?: boolean;
  /** Cadena jerárquica de 5 segmentos anatómicos modulares (cabeza, cuello, pecho, abdomen, cola) */
  bodySegments?: BodySegmentConfig[];
  /** Configuración de Arquetipo Corporal 3D y Deslizadores Estilo ARK para la Fase de Criatura */
  creatureMorphology?: CreatureMorphologySliders;
  /** Ajuste manual de altura del torso sobre el suelo en el editor (metros) */
  bodyGroundOffsetY?: number;
}

export type PlanetTheme =
  | 'oceanic'
  | 'volcanic'
  | 'terrene'
  | 'crystalline'
  | 'desertic'
  | 'toxic';

export interface PlanetSlotMetadata {
  slotId: number; // 1 to 6
  planetName: string; // e.g. "Aethel Prime", "Kalyx IV", "Gaea-9", etc.
  planetTheme: PlanetTheme;
  hasSave: boolean;
  // Summary data when hasSave === true
  speciesName?: string;
  growthStage?: CellularGrowthStage;
  evolutionaryStage?: EvolutionaryStage;
  diet?: DietType;
  innateTrait?: InnateTraitId;
  colorTheme?: CellColorTheme;
  bodyShape?: CellBodyShape;
  adn?: number;
  totalAdnEarned?: number;
  survivalTime?: number;
  lastPlayedTimestamp?: number;
}

export interface PlanetaryTransitionState {
  active: boolean;
  mode: 'entering_planet' | 'exiting_to_orbit';
  progress: number;
  atmosphereOverlayOpacity: number;
  atmosphereColorHex: string;
  planetName: string;
}

export interface IntroCinematicState {
  active: boolean;
  phase: 0 | 1 | 2 | 3 | 4;
  elapsed: number;
  duration: number;
  fadeOpacity: number;
  cloudOverlayOpacity: number;
  splashOverlayOpacity: number;
  atmosphereColorHex: string;
  planetName: string;
  speciesName: string;
  phaseTitle: string;
  phaseSubtitle: string;
}

export interface BrainCinematicState {
  active: boolean;
  phase?: 0 | 1 | 2 | 3;
  elapsed: number;
  duration: number;
  progress: number;
  flashOpacity: number;
  speciesName: string;
  phaseTitle: string;
  phaseSubtitle: string;
  brainVolumeCc: number;
  synapticActivityHz: number;
  synapseCount?: number;
}

export type EditorPreviewAction = 'idle' | 'walk' | 'run' | 'attack' | 'social';

export interface GameUISnapshot {
  status: GameStatus;
  hasSavedGame: boolean;
  activeSlotId: number;
  selectedMenuSlotId: number | null;
  hoveredMenuSlotId: number | null;
  planetSlots: PlanetSlotMetadata[];
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
  selectedBodySegmentId?: BodySegmentId | null;
  selectedSphereIndex?: number | null;
  editorSelectionTarget?: EditorSelectionTarget;
  canUndoEditor?: boolean;
  canRedoEditor?: boolean;
  editorPreviewAction?: EditorPreviewAction;
  planetaryTransition?: PlanetaryTransitionState;
  introCinematic?: IntroCinematicState;
  brainCinematic?: BrainCinematicState;
  autosaveNotificationVisible?: boolean;
  deathCauseDescription?: string;
  isGodModeActive?: boolean;
  isAIFrozen?: boolean;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  ability: boolean;
  socialize: boolean;
  isLeftMouseDown?: boolean;
  hasTargetPosition?: boolean;
  targetWorldPosition?: THREE.Vector3;
}



