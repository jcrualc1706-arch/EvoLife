import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { BrainTransitionModal } from './components/BrainTransitionModal';
import { CreatureEditorModal } from './components/CreatureEditorModal';
import { DeathModal } from './components/DeathModal';
import { DevToolsModal } from './components/DevToolsModal';
import { GameHUD } from './components/GameHUD';
import { GenesisModal } from './components/GenesisModal';
import { MainMenuModal } from './components/MainMenuModal';
import { PauseModal } from './components/PauseModal';
import { SettingsModal } from './components/SettingsModal';
import { UnlockBannerToast } from './components/UnlockBannerToast';
import { GAME_CONFIG } from './game/config';
import { GameEngine } from './game/GameEngine';
import { SaveSystem } from './game/SaveSystem';
import {
  BodySegmentConfig,
  BodySegmentId,
  CellBodyShape,
  CellColorTheme,
  CellularGrowthStage,
  CreatureMorphologySliders,
  CreaturePaintConfig,
  DEFAULT_CREATURE_MORPHOLOGY,
  DEFAULT_CREATURE_PAINT,
  DEFAULT_CREATURE_STATS,
  DEFAULT_GAME_SETTINGS,
  EditorPreviewAction,
  EditorSelectionTarget,
  EvolutionaryStage,
  GameSettings,
  GameUISnapshot,
  GenesisConfig,
  InputState,
  PlacedOrganMorphology,
  PlanetTheme,
  SpeciesType,
  createDefaultBodySegments,
  createDefaultSpineNodes,
} from './game/types';

const INITIAL_SNAPSHOT: GameUISnapshot = {
  status: 'menu',
  hasSavedGame: false,
  activeSlotId: 1,
  selectedMenuSlotId: null,
  hoveredMenuSlotId: null,
  planetSlots: SaveSystem.getDefaultSlotsMetadata(),
  settings: { ...DEFAULT_GAME_SETTINGS },
  stats: {
    speciesName: 'Organismo Primigenio',
    bodyShape: 'fusiforme',
    colorTheme: 'cyan',
    spineSegments: 1,
    spineLength: 1.0,
    torsoRadii: [1.0, 1.0, 1.0],
    spineNodes: createDefaultSpineNodes(5, 1.0),
    bodySegments: createDefaultBodySegments(),
    paintConfig: { ...DEFAULT_CREATURE_PAINT },
    complexityScore: 15,
    maxComplexity: 100,
    symmetryEnabled: true,
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
    activeArenaRadius: 110,
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
    creatureStats: { ...DEFAULT_CREATURE_STATS },
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
  selectedBodySegmentId: 'pecho',
  selectedSphereIndex: 2,
  editorSelectionTarget: 'body',
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [snapshot, setSnapshot] = useState<GameUISnapshot>(INITIAL_SNAPSHOT);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGenesisOpen, setIsGenesisOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [pendingGenesisSlotId, setPendingGenesisSlotId] = useState<
    number | undefined
  >(undefined);

  const [isFadingToIntro, setIsFadingToIntro] = useState(false);
  const fadeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new GameEngine(mountEl, (nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });
    engineRef.current = engine;

    return () => {
      if (fadeTimeoutRef.current !== null) {
        window.clearTimeout(fadeTimeoutRef.current);
      }
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleSelectMenuSlot = useCallback((slotId: number | null) => {
    engineRef.current?.selectMenuPlanetSlot(slotId);
  }, []);

  const handleSetMenuCameraMode = useCallback(
    (mode: 'title_menu' | 'planet_select') => {
      engineRef.current?.setMenuCameraMode(mode);
    },
    []
  );

  const handlePlaySlot = useCallback((slotId: number) => {
    setIsGenesisOpen(false);
    engineRef.current?.playPlanetSlot(slotId);
  }, []);

  const handleStartNewGameInSlot = useCallback((slotId: number) => {
    setPendingGenesisSlotId(slotId);
    setIsGenesisOpen(true);
  }, []);

  const handleDeleteSlot = useCallback((slotId: number) => {
    engineRef.current?.deletePlanetSlot(slotId);
  }, []);

  const handleConfirmGenesis = useCallback(
    (config: GenesisConfig) => {
      const slotToLaunch = pendingGenesisSlotId;
      setIsGenesisOpen(false);
      setPendingGenesisSlotId(undefined);
      setIsFadingToIntro(true);

      if (fadeTimeoutRef.current !== null) {
        window.clearTimeout(fadeTimeoutRef.current);
      }
      fadeTimeoutRef.current = window.setTimeout(() => {
        engineRef.current?.startNewGame(config, slotToLaunch);
        setIsFadingToIntro(false);
        fadeTimeoutRef.current = null;
      }, 800);
    },
    [pendingGenesisSlotId]
  );

  const handleSkipIntroCinematic = useCallback(() => {
    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    setIsFadingToIntro(false);
    engineRef.current?.skipIntroCinematic();
  }, []);

  const handleSaveAndExitToMenu = useCallback(() => {
    setIsSettingsOpen(false);
    engineRef.current?.saveAndExitToMenu();
  }, []);

  const handleExitToMenuWithoutSaving = useCallback(() => {
    setIsSettingsOpen(false);
    engineRef.current?.exitToMenuWithoutSaving();
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

  const handleSelectBodySegment = useCallback(
    (segmentId: BodySegmentId | null) => {
      engineRef.current?.selectBodySegment(segmentId);
    },
    []
  );

  const handleSelectBodySphere = useCallback(
    (sphereIndex: number | null) => {
      engineRef.current?.selectBodySphere(sphereIndex);
    },
    []
  );

  const handleAdjustBodySphereRadius = useCallback(
    (sphereIndex: number, delta: number) => {
      engineRef.current?.adjustBodySphereRadius(sphereIndex, delta);
    },
    []
  );

  const handleAdjustLimbThickness = useCallback(
    (limbId: string, delta: number) => {
      engineRef.current?.adjustLimbThickness(limbId, delta);
    },
    []
  );

  const handleSelectEditorTarget = useCallback(
    (target: EditorSelectionTarget) => {
      engineRef.current?.setEditorSelectionTarget(target);
    },
    []
  );

  const handleUpdateBodySegment = useCallback(
    (segmentId: BodySegmentId, partial: Partial<BodySegmentConfig>) => {
      engineRef.current?.updateBodySegment(segmentId, partial);
    },
    []
  );

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

  const handleSetVertebraCount = useCallback((count: number) => {
    engineRef.current?.setVertebraCount(count);
  }, []);

  const handleApplySpinePosturePreset = useCallback(
    (preset: 'quadruped' | 'biped_upright' | 'predator_arch' | 'serpentine') => {
      engineRef.current?.applySpinePosturePreset(preset);
    },
    []
  );

  const handleUpdateCreatureMorphology = useCallback(
    (partial: Partial<CreatureMorphologySliders>) => {
      engineRef.current?.updateCreatureMorphology(partial);
    },
    []
  );

  const handleUpdatePaintConfig = useCallback(
    (partial: Partial<CreaturePaintConfig>) => {
      engineRef.current?.updatePaintConfig(partial);
    },
    []
  );

  const handleToggleSymmetry = useCallback(() => {
    engineRef.current?.toggleEditorSymmetry();
  }, []);

  const handleUndoEditor = useCallback(() => {
    engineRef.current?.undoEditorAction();
  }, []);

  const handleRedoEditor = useCallback(() => {
    engineRef.current?.redoEditorAction();
  }, []);

  const handleSetEditorPreviewAction = useCallback(
    (action: EditorPreviewAction) => {
      engineRef.current?.setEditorPreviewAction(action);
    },
    []
  );

  const handleEvolveToCreatureStage = useCallback(() => {
    engineRef.current?.evolveToCreatureStage();
  }, []);

  const handleSkipBrainCinematic = useCallback(() => {
    engineRef.current?.skipBrainCinematic();
  }, []);

  const handleRotateEditorCamera = useCallback((deltaRadians: number) => {
    engineRef.current?.rotateEditorCamera(deltaRadians);
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleManualSave = useCallback(() => {
    engineRef.current?.manualSaveGame();
  }, []);

  const handleRespawnFromSave = useCallback(() => {
    engineRef.current?.respawnFromLastSave();
  }, []);

  const handleExitToMenuFromDeath = useCallback(() => {
    setIsSettingsOpen(false);
    engineRef.current?.exitToMenuFromDeath();
  }, []);

  const handleControlInput = useCallback(
    (key: keyof InputState, active: boolean) => {
      engineRef.current?.setTouchControl(key, active);
    },
    []
  );

  // DevTools Suite Callbacks
  const handleDevJumpToStage = useCallback(
    (stage: EvolutionaryStage, growthStage: CellularGrowthStage) => {
      engineRef.current?.devJumpToStage(stage, growthStage);
    },
    []
  );

  const handleDevAddAdn = useCallback((amount: number) => {
    engineRef.current?.devAddAdn(amount);
  }, []);

  const handleDevToggleGodMode = useCallback(() => {
    engineRef.current?.devToggleGodMode();
  }, []);

  const handleDevHealFull = useCallback(() => {
    engineRef.current?.devHealFull();
  }, []);

  const handleDevTeleport = useCallback(
    (x: number, z: number, label: string) => {
      engineRef.current?.devTeleport(x, z, label);
    },
    []
  );

  const handleDevSetPlanetTheme = useCallback((theme: PlanetTheme) => {
    engineRef.current?.devSetPlanetTheme(theme);
  }, []);

  const handleDevToggleFreezeAI = useCallback(() => {
    engineRef.current?.devToggleFreezeAI();
  }, []);

  const handleDevUnlockAllAdaptations = useCallback(() => {
    engineRef.current?.devUnlockAllAdaptations();
  }, []);

  const handleDevOpenEditorImmediate = useCallback(() => {
    engineRef.current?.devOpenEditorImmediate();
  }, []);

  const handleDevTriggerBrainCinematic = useCallback(() => {
    engineRef.current?.devTriggerBrainCinematic();
  }, []);

  const handleDevSpawnFoodCluster = useCallback(() => {
    engineRef.current?.devSpawnFoodClusterNearPlayer();
  }, []);

  const handleDevClearAllEnemies = useCallback(() => {
    engineRef.current?.devClearAllEnemies();
  }, []);

  const handleDevForceSpawnSpecies = useCallback((species: SpeciesType) => {
    engineRef.current?.devForceSpawnSpeciesNearPlayer(species);
  }, []);

  // Global Hotkey Listener for DevTools Suite (F1 or Backquote / º / \)
  useEffect(() => {
    const handleDevKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable) &&
        e.code !== 'F1' &&
        e.key !== 'F1'
      ) {
        return;
      }

      if (
        e.code === 'F1' ||
        e.key === 'F1' ||
        e.code === 'Backquote' ||
        e.code === 'Backslash' ||
        e.key === 'º' ||
        e.key === 'ª' ||
        e.key === '\\'
      ) {
        e.preventDefault();
        setIsDevToolsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleDevKeyDown);
    return () => window.removeEventListener('keydown', handleDevKeyDown);
  }, []);

  // Centralized Escape Key Hierarchy (Layers 1-4):
  // Layer 1 (SettingsModal) and Layer 2 (PauseModal) and Layer 3 (MainMenuModal) intercept Escape when active;
  // this handler covers GenesisModal and Layer 4 (Active Gameplay -> Pause, 3D Editor -> Close Editor, Intro -> Skip)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' && e.key !== 'Escape') return;
      if (e.repeat) return;

      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable)
      ) {
        return;
      }

      // Layer 1: SettingsModal is open on top -> handled exclusively by SettingsModal
      if (isSettingsOpen) {
        return;
      }

      // Genesis Modal open over Main Menu -> close Genesis Modal
      if (isGenesisOpen) {
        e.preventDefault();
        setIsGenesisOpen(false);
        return;
      }

      // Layer 2 (Paused) and Layer 3 (Main Menu) are handled by PauseModal and MainMenuModal respectively
      if (snapshot.status === 'paused' || snapshot.status === 'menu') {
        return;
      }

      // Layer 4: Active Gameplay, 3D Editor, or Intro Cinematic
      // Note: Escape NEVER closes the 3D Editor (only deselects a selected organ) and NEVER skips brain_cinematic
      if (snapshot.status === 'editing') {
        e.preventDefault();
        if (snapshot.selectedPlacedInstanceId !== null) {
          handleSelectPlacedOrgan(null);
        }
      } else if (snapshot.status === 'playing') {
        e.preventDefault();
        handleTogglePause();
      } else if (snapshot.status === 'intro_cinematic') {
        e.preventDefault();
        handleSkipIntroCinematic();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isSettingsOpen,
    isGenesisOpen,
    snapshot.status,
    snapshot.selectedPlacedInstanceId,
    handleSelectPlacedOrgan,
    handleTogglePause,
    handleSkipIntroCinematic,
  ]);

  const isMenu = snapshot.status === 'menu';
  const isIntroCinematic = snapshot.status === 'intro_cinematic';
  const isBrainCinematic = snapshot.status === 'brain_cinematic';
  const isEditing = snapshot.status === 'editing';
  const isPaused = snapshot.status === 'paused';
  const planetaryTransition = snapshot.planetaryTransition;
  const isTransitioning = Boolean(planetaryTransition?.active);
  const introCinematic = snapshot.introCinematic;
  const brainCinematic = snapshot.brainCinematic;

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

      {/* Initial 0.8s Fade-to-Black Curtain when launching a New Game from GenesisModal */}
      <div
        className="pointer-events-none fixed inset-0 z-50 bg-black transition-opacity duration-700"
        style={{
          opacity: isFadingToIntro
            ? 1
            : isIntroCinematic && introCinematic
            ? introCinematic.fadeOpacity
            : 0,
        }}
        aria-hidden="true"
      />

      {/* 3D Panspermia New-Game Intro Cinematic Overlays & Skip Control */}
      {isIntroCinematic && introCinematic && (
        <div className="pointer-events-none fixed inset-0 z-45 flex flex-col justify-between overflow-hidden">
          {/* Atmospheric Re-Entry Plasma & Cloud Veil (Phase 2 -> Phase 3) */}
          {introCinematic.cloudOverlayOpacity > 0.01 && (
            <div
              className="pointer-events-none fixed inset-0"
              style={{
                opacity: introCinematic.cloudOverlayOpacity,
                background: `radial-gradient(circle at 50% 45%, rgba(254, 215, 170, 0.82) 0%, ${introCinematic.atmosphereColorHex}cc 52%, rgba(4, 24, 42, 0.96) 100%)`,
              }}
              aria-hidden="true"
            />
          )}

          {/* Ocean Surface Impact Splash & Caustic Flash Veil (Phase 3) */}
          {introCinematic.splashOverlayOpacity > 0.01 && (
            <div
              className="pointer-events-none fixed inset-0"
              style={{
                opacity: introCinematic.splashOverlayOpacity,
                background:
                  'radial-gradient(circle at 50% 50%, rgba(240, 249, 255, 0.94) 0%, rgba(56, 189, 248, 0.78) 44%, rgba(3, 24, 38, 0.95) 100%)',
              }}
              aria-hidden="true"
            />
          )}

          {/* Top Cinematic Letterbox Bar */}
          <div className="relative z-10 flex items-center justify-between bg-gradient-to-b from-black/85 via-black/45 to-transparent px-6 pt-5 pb-8">
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24]" />
              <span className="text-[11px] font-black tracking-[0.26em] text-cyan-200/90 uppercase">
                Secuencia de Panspermia · Fase {introCinematic.phase + 1}/5
              </span>
            </div>
            <span className="text-xs font-bold tracking-widest text-cyan-100/75 uppercase">
              {introCinematic.planetName}
            </span>
          </div>

          {/* Bottom Cinematic Letterbox Bar with Narrative Subtitle & Skip Button */}
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-6 pt-10 pb-6">
            <div className="max-w-xl space-y-1">
              <h2 className="font-display text-lg sm:text-xl font-black tracking-wide text-white drop-shadow-[0_2px_12px_rgba(34,211,238,0.45)]">
                {introCinematic.phaseTitle}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-cyan-100/85 leading-relaxed">
                {introCinematic.phaseSubtitle}
              </p>
              {/* Timeline Progress Indicator */}
              <div className="mt-2.5 h-1 w-56 overflow-hidden rounded-full bg-cyan-950/80 border border-cyan-400/25">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 via-cyan-300 to-emerald-400 transition-all duration-100"
                  style={{
                    width: `${Math.min(
                      100,
                      (introCinematic.elapsed / introCinematic.duration) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSkipIntroCinematic}
              className="pointer-events-auto rounded-full border border-cyan-300/45 bg-[#041d2d]/90 px-4 py-2 text-xs font-extrabold tracking-wider text-cyan-100 uppercase shadow-[0_4px_20px_rgba(0,0,0,0.65)] hover:border-cyan-200 hover:bg-cyan-900/80 hover:text-white active:scale-95 transition-all cursor-pointer"
            >
              Saltar Intro [Espacio]
            </button>
          </div>
        </div>
      )}

      {/* 3D Brain Evolution Sequence Overlay (Cell -> Terrestrial Creature) */}
      {isBrainCinematic && brainCinematic && (
        <BrainTransitionModal
          state={brainCinematic}
          onSkip={handleSkipBrainCinematic}
        />
      )}

      {/* Atmospheric Cloud & Mist Veil during Planetary Immersion / Orbital Ascent */}
      {isTransitioning && planetaryTransition && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
          style={{
            opacity: planetaryTransition.atmosphereOverlayOpacity,
            background: `radial-gradient(circle at 50% 50%, ${planetaryTransition.atmosphereColorHex}f2 0%, #042f49f8 58%, #020c18ff 100%)`,
          }}
          aria-hidden="true"
        >
          <div
            className="h-[135vmax] w-[135vmax] rounded-full opacity-70 blur-3xl transition-transform duration-150"
            style={{
              background: `radial-gradient(circle, #ffffffd8 0%, ${planetaryTransition.atmosphereColorHex}aa 42%, transparent 72%)`,
              transform: `scale(${0.75 + planetaryTransition.progress * 0.65})`,
            }}
          />
          <div className="fixed inset-x-0 bottom-14 flex flex-col items-center gap-1.5 text-center">
            <span className="text-[11px] font-extrabold tracking-[0.28em] text-cyan-100/90 uppercase drop-shadow">
              {planetaryTransition.mode === 'entering_planet'
                ? 'Inmersión Atmosférica'
                : 'Ascenso Orbital'}
            </span>
            <span className="text-xl font-black tracking-wide text-white drop-shadow-[0_2px_14px_rgba(34,211,238,0.65)]">
              {planetaryTransition.planetName}
            </span>
          </div>
        </div>
      )}

      {/* Cinematic Floating Banner Toast when a new adaptation or meteor core is unlocked */}
      {!isEditing &&
        !isMenu &&
        !isIntroCinematic &&
        !isBrainCinematic &&
        !isFadingToIntro &&
        !isPaused &&
        !isTransitioning && (
          <UnlockBannerToast notification={snapshot.unlockedBannerNotification} />
        )}

      {/* Sensory Blindness Tunnel-Vision Vignette when all ocular organs are uninstalled */}
      {!isEditing &&
        !isMenu &&
        !isIntroCinematic &&
        !isBrainCinematic &&
        !isFadingToIntro &&
        !isPaused &&
        !isTransitioning &&
        !snapshot.stats.hasEyes && (
          <div
            className="pointer-events-none fixed inset-0 z-15 transition-opacity duration-500"
            style={{
              background:
                'radial-gradient(circle at center, transparent 30%, rgba(2, 6, 23, 0.72) 65%, rgba(2, 6, 23, 0.94) 100%)',
            }}
            aria-hidden="true"
          />
        )}

      {/* Subtle Damage Flash Border Overlay (Hidden while in Evolution Editor, Main Menu, or Pause) */}
      {!isEditing &&
        !isMenu &&
        !isIntroCinematic &&
        !isBrainCinematic &&
        !isFadingToIntro &&
        !isPaused &&
        !isTransitioning &&
        snapshot.stats.damageFlashTime > 0 && (
          <div
            className="pointer-events-none fixed inset-0 z-20 border-4 border-rose-500/70 transition-opacity duration-150"
            aria-hidden="true"
          />
        )}

      {/* Exclusive Switching between MainMenuModal, CreatureEditorModal, and GameHUD */}
      <AnimatePresence mode="wait">
        {isTransitioning ||
        isIntroCinematic ||
        isBrainCinematic ||
        isFadingToIntro ? null : isMenu ? (
          <MainMenuModal
            key="main-menu"
            planetSlots={snapshot.planetSlots}
            selectedSlotId={snapshot.selectedMenuSlotId}
            hoveredSlotId={snapshot.hoveredMenuSlotId}
            isSettingsOpen={isSettingsOpen}
            isGenesisOpen={isGenesisOpen}
            onSelectSlot={handleSelectMenuSlot}
            onPlaySlot={handlePlaySlot}
            onStartNewGameInSlot={handleStartNewGameInSlot}
            onDeleteSlot={handleDeleteSlot}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSetMenuCameraMode={handleSetMenuCameraMode}
          />
        ) : isEditing ? (
          <CreatureEditorModal
            key="creature-editor"
            stats={snapshot.stats}
            slots={snapshot.evolutionSlots}
            readyForLandTransition={snapshot.readyForLandTransition}
            selectedPlacedInstanceId={snapshot.selectedPlacedInstanceId}
            selectedBodySegmentId={snapshot.selectedBodySegmentId}
            selectedSphereIndex={snapshot.selectedSphereIndex}
            editorSelectionTarget={snapshot.editorSelectionTarget}
            canUndo={snapshot.canUndoEditor}
            canRedo={snapshot.canRedoEditor}
            editorPreviewAction={snapshot.editorPreviewAction}
            onUnlockSlot={handleUnlockSlot}
            onRefundSlot={handleRefundSlot}
            onStartCatalogDrag={handleStartCatalogDrag}
            onSelectPlacedOrgan={handleSelectPlacedOrgan}
            onSelectBodySegment={handleSelectBodySegment}
            onSelectBodySphere={handleSelectBodySphere}
            onAdjustBodySphereRadius={handleAdjustBodySphereRadius}
            onAdjustLimbThickness={handleAdjustLimbThickness}
            onSelectEditorTarget={handleSelectEditorTarget}
            onUpdateBodySegment={handleUpdateBodySegment}
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
            onSetVertebraCount={handleSetVertebraCount}
            onApplySpinePosturePreset={handleApplySpinePosturePreset}
            onUpdateCreatureMorphology={handleUpdateCreatureMorphology}
            onUpdatePaintConfig={handleUpdatePaintConfig}
            onToggleSymmetry={handleToggleSymmetry}
            onUndo={handleUndoEditor}
            onRedo={handleRedoEditor}
            onSetEditorPreviewAction={handleSetEditorPreviewAction}
            onEvolveToCreatureStage={handleEvolveToCreatureStage}
            onRotateEditorCamera={handleRotateEditorCamera}
            onClose={handleCloseEditor}
          />
        ) : !isPaused ? (
          <GameHUD
            key="game-hud"
            snapshot={snapshot}
            onTogglePause={handleTogglePause}
            onToggleEditor={handleToggleEditor}
            onToggleDevTools={() => setIsDevToolsOpen((prev) => !prev)}
            onEvolveToCreatureStage={handleEvolveToCreatureStage}
            onControlInput={handleControlInput}
          />
        ) : null}
      </AnimatePresence>

      {/* Pause Menu Modal (Escape) */}
      {isPaused && (
        <PauseModal
          stats={snapshot.stats}
          isSettingsOpen={isSettingsOpen}
          onResume={handleResume}
          onManualSave={handleManualSave}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenDevTools={() => setIsDevToolsOpen(true)}
          onExitToMenu={handleSaveAndExitToMenu}
          onExitWithoutSaving={handleExitToMenuWithoutSaving}
        />
      )}

      {/* Floating Developer Suite / Debug Overlay (F1 or º/Backquote) */}
      {isDevToolsOpen && (
        <DevToolsModal
          stats={snapshot.stats}
          isGodModeActive={Boolean(snapshot.isGodModeActive)}
          isAIFrozen={Boolean(snapshot.isAIFrozen)}
          currentBiomeName={snapshot.currentBiomeName}
          onClose={() => setIsDevToolsOpen(false)}
          onJumpToStage={handleDevJumpToStage}
          onAddAdn={handleDevAddAdn}
          onToggleGodMode={handleDevToggleGodMode}
          onHealFull={handleDevHealFull}
          onTeleport={handleDevTeleport}
          onSetPlanetTheme={handleDevSetPlanetTheme}
          onToggleFreezeAI={handleDevToggleFreezeAI}
          onUnlockAllAdaptations={handleDevUnlockAllAdaptations}
          onOpenEditorImmediate={handleDevOpenEditorImmediate}
          onTriggerBrainCinematic={handleDevTriggerBrainCinematic}
          onSpawnFoodCluster={handleDevSpawnFoodCluster}
          onClearAllEnemies={handleDevClearAllEnemies}
          onForceSpawnSpecies={handleDevForceSpawnSpecies}
        />
      )}

      {/* Death & Checkpoint Respawn Modal (Vida = 0) */}
      {snapshot.status === 'gameover' && (
        <DeathModal
          stats={snapshot.stats}
          deathCauseDescription={snapshot.deathCauseDescription}
          onRespawnFromSave={handleRespawnFromSave}
          onExitToMenu={handleExitToMenuFromDeath}
        />
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
