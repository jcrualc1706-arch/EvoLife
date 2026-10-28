export type GameStatus = 'playing' | 'paused' | 'editing' | 'gameover';

export type PredatorBehaviorState =
  | 'DEAMBULAR'
  | 'PERSEGUIR'
  | 'ATACAR'
  | 'HUIR'
  | 'ATURDIDO';

export type SpeciesType = 'hunter' | 'leviathan' | 'herbivore';

export type DietType = 'herbivore' | 'carnivore' | 'omnivore';

export type FoodKind = 'plant' | 'meat' | 'dna_spore';

export type EvolutionCategory = 'locomocion' | 'metabolismo' | 'defensa';

export type BiomeType = 'pradera_luminosa' | 'fosa_termal' | 'arrecife_abisal';

export type CellBodyShape = 'fusiforme' | 'esferico' | 'alargado';

export type CellColorTheme = 'cyan' | 'emerald' | 'crimson' | 'violet';

export type EvolutionaryStage = 'cell_stage' | 'creature_stage';

export interface PlayerStats {
  speciesName: string;
  bodyShape: CellBodyShape;
  colorTheme: CellColorTheme;
  evolutionaryStage: EvolutionaryStage;
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  adn: number;
  totalAdnEarned: number;
  growthStage: 1 | 2 | 3;
  nextStageAdnThreshold: number;
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
}

export interface PredatorTelemetry {
  id: number;
  species: SpeciesType;
  speciesName: string;
  state: PredatorBehaviorState;
  distanceToPlayer: number;
}

export interface CellularEvolutionSlot {
  id: string;
  name: string;
  description: string;
  statSummary: string;
  category: EvolutionCategory;
  costAdn: number;
  unlocked: boolean;
}

export interface GameUISnapshot {
  status: GameStatus;
  stats: PlayerStats;
  activeFoodCount: number;
  totalFoodCapacity: number;
  predatorStates: PredatorTelemetry[];
  nearestSpeciesName: string;
  nearestPredatorState: PredatorBehaviorState;
  nearestPredatorDistance: number;
  currentBiomeName: string;
  activeQuestTitle: string;
  activeQuestProgressText: string;
  readyForLandTransition: boolean;
  recentEventMessage: string | null;
  evolutionSlots: CellularEvolutionSlot[];
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

export interface PoisonCloudHazard {
  position: THREE.Vector3;
  radius: number;
  active: boolean;
}

import * as THREE from 'three';

