import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { CreatureEditorModal } from './components/CreatureEditorModal';
import { DeathModal } from './components/DeathModal';
import { GameHUD } from './components/GameHUD';
import { GenesisModal } from './components/GenesisModal';
import { MainMenuModal } from './components/MainMenuModal';
import { PauseModal } from './components/PauseModal';
import { SettingsModal } from './components/SettingsModal';
import { UnlockBannerToast } from './components/UnlockBannerToast';
import { GAME_CONFIG } from './game/config';
import { GameEngine } from './game/GameEngine';
import {
  CellBodyShape,
  CellColorTheme,
  DEFAULT_GAME_SETTINGS,
  GameSettings,
  GameUISnapshot,
  GenesisConfig,
  InputState,
  PlacedOrganMorphology,
} from './game/types';

const INITIAL_SNAPSHOT: GameUISnapshot = {
  status: 'menu',
  hasSavedGame: false,
  settings: { ...DEFAULT_GAME_SETTINGS },
  stats: {
    speciesName: 'Organismo Primigenio',
    bodyShape: 'fusiforme',
    colorTheme: 'cyan',
    spineSegments: 1,
    spineLength: 1.0,
    torsoRadii: [1.0, 1.0, 1.0],
    placedOrgans: [],
    evolutionaryStage: 'cell_stage',
    health: GAME_CONFIG.PLAYER.INITIAL_HEALTH,
    maxHealth: GAME_CONFIG.PLAYER.MAX_HEALTH,
    energy: GAME_CONFIG.PLAYER.INITIAL_ENERGY,
    maxEnergy: GAME_CONFIG.PLAYER.MAX_ENERGY,
    adn: GAME_CONFIG.PLAYER.INITIAL_ADN,
    totalAdnEarned: GAME_CONFIG.PLAYER.INITIAL_ADN,
    growthStage: 1,
    nextStageAdnThreshold: 50,
    activeArenaRadius: 90,
    diet: 'herbivore',
    innateTrait: 'elastic_membrane',
    foodEaten: 0,
    survivalTime: 0,
    isStarving: false,
    isBoosting: false,
    boostCooldownRatio: 1,
    abilityCooldownRatio: 1,
    activeStatusEffect: null,
    speed: 0,
    damageFlashTime: 0,
    hasEyes: true,
    attackPower: 5,
    poisonLevel: 0,
    electricLevel: 0,
    defensePercent: 0,
    visionLevel: 1,
  },
  activeFoodCount: GAME_CONFIG.FOOD.TOTAL_COUNT,
  totalFoodCapacity: GAME_CONFIG.FOOD.TOTAL_COUNT,
  predatorStates: [],
  nearestSpeciesName: 'Mandíbula Rápida',
  nearestPredatorState: 'DEAMBULAR',
  nearestPredatorDistance: 999,
  nearestHasUncataloguedGene: false,
  currentBiomeName: 'Pradera Bioluminiscente',
  activeQuestTitle: 'Misión 1/4 · Primeros Nutrientes',
  activeQuestProgressText:
    'Acumula 20 ADN totales (0/20 ADN) · Recompensa: +10 ADN',
  readyForLandTransition: false,
  recentEventMessage: null,
  unlockedBannerNotification: null,
  evolutionSlots: [],
  selectedPlacedInstanceId: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [snapshot, setSnapshot] = useState<GameUISnapshot>(INITIAL_SNAPSHOT);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGenesisOpen, setIsGenesisOpen] = useState(false);

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

  const handleContinueSavedGame = useCallback(() => {
    setIsGenesisOpen(false);
    engineRef.current?.continueSavedGame();
  }, []);

  const handleStartNewGame = useCallback(() => {
    setIsGenesisOpen(true);
  }, []);

  const handleConfirmGenesis = useCallback((config: GenesisConfig) => {
    setIsGenesisOpen(false);
    engineRef.current?.startNewGame(config);
  }, []);

  const handleSaveAndExitToMenu = useCallback(() => {
    setIsSettingsOpen(false);
    engineRef.current?.saveAndExitToMenu();
  }, []);

  const handleUpdateSettings = useCallback(
    (partialSettings: Partial<GameSettings>) => {
      engineRef.current?.updateSettings(partialSettings);
    },
    []
  );

  const handleResetSettings = useCallback(() => {
    engineRef.current?.resetSettingsToDefault();
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

  const handleStartCatalogDrag = useCallback((slotId: string) => {
    engineRef.current?.startCatalogDrag(slotId);
  }, []);

  const handleSelectPlacedOrgan = useCallback((instanceId: string | null) => {
    engineRef.current?.selectPlacedOrgan(instanceId);
  }, []);

  const handleRemovePlacedOrgan = useCallback((instanceId: string) => {
    engineRef.current?.removePlacedOrganByInstanceId(instanceId);
  }, []);

  const handleUpdatePlacedOrganMorphology = useCallback(
    (instanceId: string, partialMorphology: Partial<PlacedOrganMorphology>) => {
      engineRef.current?.updatePlacedOrganMorphology(
        instanceId,
        partialMorphology
      );
    },
    []
  );

  const handleUpdatePlacedOrganOrientation = useCallback(
    (instanceId: string, yaw: number, pitch: number) => {
      engineRef.current?.updatePlacedOrganOrientation(instanceId, yaw, pitch);
    },
    []
  );

  const handleResetPlacedOrganMorphology = useCallback((instanceId: string) => {
    engineRef.current?.resetPlacedOrganMorphology(instanceId);
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

  const handleChangeSpineSegments = useCallback((segments: 1 | 2 | 3) => {
    engineRef.current?.setSpineSegments(segments);
  }, []);

  const handleSetSpineLength = useCallback((length: number) => {
    engineRef.current?.setSpineLength(length);
  }, []);

  const handleSetTorsoRadius = useCallback(
    (segmentIndex: 0 | 1 | 2, radius: number) => {
      engineRef.current?.setTorsoRadius(segmentIndex, radius);
    },
    []
  );

  const handleEvolveToCreatureStage = useCallback(() => {
    engineRef.current?.evolveToCreatureStage();
  }, []);

  const handleRotateEditorCamera = useCallback((deltaRadians: number) => {
    engineRef.current?.rotateEditorCamera(deltaRadians);
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleRestart = useCallback(() => {
    setIsGenesisOpen(true);
  }, []);

  const handleControlInput = useCallback(
    (key: keyof InputState, active: boolean) => {
      engineRef.current?.setTouchControl(key, active);
    },
    []
  );

  const isMenu = snapshot.status === 'menu';
  const isEditing = snapshot.status === 'editing';

  const colorblindFilterStyle =
    snapshot.settings.colorblindMode === 'protanopia'
      ? 'hue-rotate(24deg) saturate(1.25) contrast(1.08)'
      : snapshot.settings.colorblindMode === 'deuteranopia'
      ? 'hue-rotate(-28deg) saturate(1.25) contrast(1.08)'
      : snapshot.settings.colorblindMode === 'tritanopia'
      ? 'hue-rotate(75deg) saturate(1.2) contrast(1.08)'
      : undefined;

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-[#03131f] select-none"
      style={colorblindFilterStyle ? { filter: colorblindFilterStyle } : undefined}
    >
      {/* Dedicated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="h-full w-full"
        aria-label="Escena 3D de EvoLife"
      />

      {/* Cinematic Floating Banner Toast when a new adaptation or meteor core is unlocked */}
      {!isEditing && !isMenu && (
        <UnlockBannerToast notification={snapshot.unlockedBannerNotification} />
      )}

      {/* Sensory Blindness Tunnel-Vision Vignette when all ocular organs are uninstalled */}
      {!isEditing && !isMenu && !snapshot.stats.hasEyes && (
        <div
          className="pointer-events-none fixed inset-0 z-15 transition-opacity duration-500"
          style={{
            background:
              'radial-gradient(circle at center, transparent 30%, rgba(2, 6, 23, 0.72) 65%, rgba(2, 6, 23, 0.94) 100%)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Subtle Damage Flash Border Overlay (Hidden while in Evolution Editor or Main Menu) */}
      {!isEditing && !isMenu && snapshot.stats.damageFlashTime > 0 && (
        <div
          className="pointer-events-none fixed inset-0 z-20 border-4 border-rose-500/70 transition-opacity duration-150"
          aria-hidden="true"
        />
      )}

      {/* Exclusive Switching between MainMenuModal, CreatureEditorModal, and GameHUD */}
      <AnimatePresence mode="wait">
        {isMenu ? (
          <MainMenuModal
            key="main-menu"
            hasSavedGame={snapshot.hasSavedGame}
            stats={snapshot.stats}
            onContinueGame={handleContinueSavedGame}
            onStartNewGame={handleStartNewGame}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : isEditing ? (
          <CreatureEditorModal
            key="creature-editor"
            stats={snapshot.stats}
            slots={snapshot.evolutionSlots}
            readyForLandTransition={snapshot.readyForLandTransition}
            selectedPlacedInstanceId={snapshot.selectedPlacedInstanceId}
            onUnlockSlot={handleUnlockSlot}
            onRefundSlot={handleRefundSlot}
            onStartCatalogDrag={handleStartCatalogDrag}
            onSelectPlacedOrgan={handleSelectPlacedOrgan}
            onRemovePlacedOrgan={handleRemovePlacedOrgan}
            onUpdatePlacedOrganMorphology={handleUpdatePlacedOrganMorphology}
            onUpdatePlacedOrganOrientation={handleUpdatePlacedOrganOrientation}
            onResetPlacedOrganMorphology={handleResetPlacedOrganMorphology}
            onChangeSpeciesName={handleChangeSpeciesName}
            onChangeBodyShape={handleChangeBodyShape}
            onChangeColorTheme={handleChangeColorTheme}
            onChangeSpineSegments={handleChangeSpineSegments}
            onSetSpineLength={handleSetSpineLength}
            onSetTorsoRadius={handleSetTorsoRadius}
            onEvolveToCreatureStage={handleEvolveToCreatureStage}
            onRotateEditorCamera={handleRotateEditorCamera}
            onClose={handleCloseEditor}
          />
        ) : (
          <GameHUD
            key="game-hud"
            snapshot={snapshot}
            onTogglePause={handleTogglePause}
            onToggleEditor={handleToggleEditor}
            onEvolveToCreatureStage={handleEvolveToCreatureStage}
            onRestart={handleRestart}
            onControlInput={handleControlInput}
          />
        )}
      </AnimatePresence>

      {/* Pause Menu Modal (Escape) */}
      {snapshot.status === 'paused' && (
        <PauseModal
          stats={snapshot.stats}
          onResume={handleResume}
          onRestart={handleRestart}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExitToMenu={handleSaveAndExitToMenu}
        />
      )}

      {/* Death & Restart Modal (Vida = 0) */}
      {snapshot.status === 'gameover' && (
        <DeathModal stats={snapshot.stats} onRestart={handleRestart} />
      )}

      {/* Cellular Genesis Modal when starting a New Game or Restarting */}
      <AnimatePresence>
        {isGenesisOpen && (
          <GenesisModal
            key="genesis-modal"
            onConfirmGenesis={handleConfirmGenesis}
            onCancel={() => setIsGenesisOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Modular Settings Overlay Modal (Accessible from Main Menu and Pause Menu) */}
      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal
            key="settings-modal"
            settings={snapshot.settings}
            onUpdateSettings={handleUpdateSettings}
            onResetSettings={handleResetSettings}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
