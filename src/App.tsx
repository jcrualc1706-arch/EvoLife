import { useCallback, useEffect, useRef, useState } from 'react';
import { CreatureEditorModal } from './components/CreatureEditorModal';
import { DeathModal } from './components/DeathModal';
import { GameHUD } from './components/GameHUD';
import { PauseModal } from './components/PauseModal';
import { GAME_CONFIG } from './game/config';
import { GameEngine } from './game/GameEngine';
import { GameUISnapshot, InputState } from './game/types';

const INITIAL_SNAPSHOT: GameUISnapshot = {
  status: 'playing',
  stats: {
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
  },
  activeFoodCount: GAME_CONFIG.FOOD.TOTAL_COUNT,
  totalFoodCapacity: GAME_CONFIG.FOOD.TOTAL_COUNT,
  predatorStates: [],
  nearestPredatorState: 'DEAMBULAR',
  nearestPredatorDistance: 999,
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
        aria-label="Escena 3D submarina de EvoLife"
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
        onRestart={handleRestart}
        onControlInput={handleControlInput}
      />

      {/* Creature Evolution Editor Modal (Key E) */}
      {snapshot.status === 'editing' && (
        <CreatureEditorModal
          stats={snapshot.stats}
          slots={snapshot.evolutionSlots}
          onUnlockSlot={handleUnlockSlot}
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
