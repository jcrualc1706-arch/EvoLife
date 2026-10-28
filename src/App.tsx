import { useCallback, useEffect, useRef, useState } from 'react';
import { CreatureEditorModal } from './components/CreatureEditorModal';
import { DeathModal } from './components/DeathModal';
import { GameHUD } from './components/GameHUD';
import { PauseModal } from './components/PauseModal';
import { GAME_CONFIG } from './game/config';
import { GameEngine } from './game/GameEngine';
import {
  CellBodyShape,
  CellColorTheme,
  GameUISnapshot,
  InputState,
} from './game/types';

const INITIAL_SNAPSHOT: GameUISnapshot = {
  status: 'playing',
  stats: {
    speciesName: 'Organismo Primigenio',
    bodyShape: 'fusiforme',
    colorTheme: 'cyan',
    evolutionaryStage: 'cell_stage',
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
  },
  activeFoodCount: GAME_CONFIG.FOOD.TOTAL_COUNT,
  totalFoodCapacity: GAME_CONFIG.FOOD.TOTAL_COUNT,
  predatorStates: [],
  nearestSpeciesName: 'Mandíbula Rápida',
  nearestPredatorState: 'DEAMBULAR',
  nearestPredatorDistance: 999,
  currentBiomeName: 'Pradera Bioluminiscente',
  activeQuestTitle: 'Misión 1/4 · Primeros Nutrientes',
  activeQuestProgressText: 'Acumula 20 ADN totales (0/20 ADN) · Recompensa: +10 ADN',
  readyForLandTransition: false,
  recentEventMessage: null,
  evolutionSlots: [],
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [snapshot, setSnapshot] = useState<GameUISnapshot>(INITIAL_SNAPSHOT);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new GameEngine(mountEl, (nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleToggleEditor = useCallback(() => {
    engineRef.current?.toggleEditor();
  }, []);

  const handleCloseEditor = useCallback(() => {
    engineRef.current?.closeEditor();
  }, []);

  const handleUnlockSlot = useCallback((slotId: string) => {
    engineRef.current?.unlockEvolutionSlot(slotId);
  }, []);

  const handleRefundSlot = useCallback((slotId: string) => {
    engineRef.current?.refundEvolutionSlot(slotId);
  }, []);

  const handleChangeSpeciesName = useCallback((name: string) => {
    engineRef.current?.setSpeciesName(name);
  }, []);

  const handleChangeBodyShape = useCallback((shape: CellBodyShape) => {
    engineRef.current?.setBodyShape(shape);
  }, []);

  const handleChangeColorTheme = useCallback((theme: CellColorTheme) => {
    engineRef.current?.setColorTheme(theme);
  }, []);

  const handleEvolveToCreatureStage = useCallback(() => {
    engineRef.current?.evolveToCreatureStage();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.restartGame();
  }, []);

  const handleControlInput = useCallback(
    (key: keyof InputState, active: boolean) => {
      engineRef.current?.setTouchControl(key, active);
    },
    []
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#03131f] select-none">
      {/* Dedicated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="h-full w-full"
        aria-label="Escena 3D de EvoLife"
      />

      {/* Subtle Damage Flash Border Overlay */}
      {snapshot.stats.damageFlashTime > 0 && (
        <div
          className="pointer-events-none fixed inset-0 z-20 border-4 border-rose-500/70 transition-opacity duration-150"
          aria-hidden="true"
        />
      )}

      {/* Main Game HUD */}
      <GameHUD
        snapshot={snapshot}
        onTogglePause={handleTogglePause}
        onToggleEditor={handleToggleEditor}
        onEvolveToCreatureStage={handleEvolveToCreatureStage}
        onRestart={handleRestart}
        onControlInput={handleControlInput}
      />

      {/* Creature Evolution Editor Modal (Key E) */}
      {snapshot.status === 'editing' && (
        <CreatureEditorModal
          stats={snapshot.stats}
          slots={snapshot.evolutionSlots}
          readyForLandTransition={snapshot.readyForLandTransition}
          onUnlockSlot={handleUnlockSlot}
          onRefundSlot={handleRefundSlot}
          onChangeSpeciesName={handleChangeSpeciesName}
          onChangeBodyShape={handleChangeBodyShape}
          onChangeColorTheme={handleChangeColorTheme}
          onEvolveToCreatureStage={handleEvolveToCreatureStage}
          onClose={handleCloseEditor}
        />
      )}

      {/* Pause Menu Modal (Escape) */}
      {snapshot.status === 'paused' && (
        <PauseModal
          stats={snapshot.stats}
          onResume={handleResume}
          onRestart={handleRestart}
        />
      )}

      {/* Death & Restart Modal (Vida = 0) */}
      {snapshot.status === 'gameover' && (
        <DeathModal stats={snapshot.stats} onRestart={handleRestart} />
      )}
    </main>
  );
}
