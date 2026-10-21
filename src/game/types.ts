export type GameStatus = 'playing' | 'paused' | 'editing' | 'gameover';

export type PredatorBehaviorState = 'DEAMBULAR' | 'PERSEGUIR' | 'ATACAR';

export type EvolutionCategory = 'locomocion' | 'metabolismo' | 'defensa';

export interface PlayerStats {
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  adn: number;
  foodEaten: number;
  survivalTime: number;
  isStarving: boolean;
  isBoosting: boolean;
  boostCooldownRatio: number;
  speed: number;
  damageFlashTime: number;
}

export interface PredatorTelemetry {
  id: number;
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
  nearestPredatorState: PredatorBehaviorState;
  nearestPredatorDistance: number;
  recentEventMessage: string | null;
  evolutionSlots: CellularEvolutionSlot[];
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
}
