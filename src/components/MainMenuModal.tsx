import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Compass,
  Dna,
  Flame,
  Globe,
  Info,
  Orbit,
  Play,
  RotateCcw,
  Settings,
  ShieldAlert,
  Sparkles,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { audioManager } from '../game/AudioManager';
import { PLANET_CATALOG, PlanetCatalogDefinition } from '../game/SaveSystem';
import {
  CellBodyShape,
  CellColorTheme,
  DietType,
  InnateTraitId,
  PlanetSlotMetadata,
  PlanetTheme,
} from '../game/types';

interface MainMenuModalProps {
  planetSlots: PlanetSlotMetadata[];
  selectedSlotId: number | null;
  hoveredSlotId: number | null;
  isSettingsOpen?: boolean;
  isGenesisOpen?: boolean;
  onSelectSlot: (slotId: number | null) => void;
  onPlaySlot: (slotId: number) => void;
  onStartNewGameInSlot: (slotId: number) => void;
  onDeleteSlot: (slotId: number) => void;
  onOpenSettings: () => void;
  onSetMenuCameraMode?: (mode: 'title_menu' | 'planet_select') => void;
}

const THEME_BADGE_STYLES: Record<
  PlanetTheme,
  {
    badgeBg: string;
    orbGradient: string;
    accentText: string;
    label: string;
  }
> = {
  oceanic: {
    badgeBg: 'border-cyan-400/40 bg-cyan-950/60 text-cyan-200',
    orbGradient: 'radial-gradient(circle at 32% 28%, #67e8f9, #0891b2 58%, #083344 100%)',
    accentText: 'text-cyan-300',
    label: 'Talásico Bioluminiscente',
  },
  volcanic: {
    badgeBg: 'border-orange-400/40 bg-orange-950/60 text-orange-200',
    orbGradient: 'radial-gradient(circle at 32% 28%, #fdba74, #ea580c 58%, #431407 100%)',
    accentText: 'text-orange-300',
    label: 'Volcánico Termofílico',
  },
  terrene: {
    badgeBg: 'border-emerald-400/40 bg-emerald-950/60 text-emerald-200',
    orbGradient: 'radial-gradient(circle at 32% 28%, #6ee7b7, #059669 58%, #064e3b 100%)',
    accentText: 'text-emerald-300',
    label: 'Super-Tierra Clorofílica',
  },
  crystalline: {
    badgeBg: 'border-purple-400/40 bg-purple-950/60 text-purple-200',
    orbGradient: 'radial-gradient(circle at 32% 28%, #e9d5ff, #9333ea 58%, #3b0764 100%)',
    accentText: 'text-purple-300',
    label: 'Gigante Cristalino Anillado',
  },
  desertic: {
    badgeBg: 'border-amber-400/40 bg-amber-950/60 text-amber-200',
    orbGradient: 'radial-gradient(circle at 32% 28%, #fde68a, #d97706 58%, #451a03 100%)',
    accentText: 'text-amber-300',
    label: 'Árido de Oasis Salinos',
  },
  toxic: {
    badgeBg: 'border-lime-400/40 bg-lime-950/60 text-lime-200',
    orbGradient: 'radial-gradient(circle at 32% 28%, #d9f99d, #65a30d 58%, #1a2e05 100%)',
    accentText: 'text-lime-300',
    label: 'Exomundo Quimiosintético',
  },
};

const DIET_LABELS: Record<DietType, { label: string; color: string }> = {
  herbivore: {
    label: 'Herbívoro Filtrador',
    color: 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200',
  },
  omnivore: {
    label: 'Omnívoro Adaptativo',
    color: 'border-amber-400/40 bg-amber-500/20 text-amber-200',
  },
  carnivore: {
    label: 'Carnívoro Depredador',
    color: 'border-rose-400/40 bg-rose-500/20 text-rose-200',
  },
};

const TRAIT_LABELS: Record<InnateTraitId, string> = {
  elastic_membrane: 'Membrana Elástica',
  thermophilic_cytoplasm: 'Citoplasma Termófilo',
  voracious_chemotaxis: 'Quimiotaxis Voraz',
  abyssal_bioluminescence: 'Bioluminiscencia Abisal',
};

function formatSurvivalTime(seconds = 0): string {
  const totalSecs = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

function CreatureHologramMiniature({
  colorTheme = 'cyan',
  bodyShape = 'fusiforme',
  diet = 'herbivore',
  isCreatureStage = false,
}: {
  colorTheme?: CellColorTheme;
  bodyShape?: CellBodyShape;
  diet?: DietType;
  isCreatureStage?: boolean;
}) {
  const palette: Record<
    CellColorTheme,
    { fill: string; stroke: string; core: string; glow: string }
  > = {
    cyan: {
      fill: '#0891b2',
      stroke: '#67e8f9',
      core: '#22d3ee',
      glow: 'rgba(34,211,238,0.45)',
    },
    emerald: {
      fill: '#059669',
      stroke: '#6ee7b7',
      core: '#10b981',
      glow: 'rgba(16,185,129,0.45)',
    },
    crimson: {
      fill: '#e11d48',
      stroke: '#fda4af',
      core: '#f43f5e',
      glow: 'rgba(244,63,94,0.45)',
    },
    violet: {
      fill: '#7c3aed',
      stroke: '#d8b4fe',
      core: '#a855f7',
      glow: 'rgba(168,85,247,0.45)',
    },
  };

  const colors = palette[colorTheme] ?? palette.cyan;
  const rx = bodyShape === 'esferico' ? 24 : bodyShape === 'alargado' ? 32 : 28;
  const ry = bodyShape === 'esferico' ? 23 : bodyShape === 'alargado' ? 14 : 18;

  return (
    <div
      className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-cyan-300/35 bg-[#031826]/85 shadow-inner"
      style={{ boxShadow: `0 0 28px ${colors.glow}` }}
    >
      <svg
        viewBox="0 0 100 100"
        className="h-20 w-20 overflow-visible drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]"
      >
        {/* Flagellum tail */}
        <path
          d="M 18 50 Q 6 42, 3 50 T -4 50"
          fill="none"
          stroke={colors.stroke}
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Terrestrial legs if evolved to Creature Stage */}
        {isCreatureStage && (
          <g stroke={colors.stroke} strokeWidth="3.5" strokeLinecap="round">
            <line x1="38" y1="34" x2="30" y2="16" />
            <line x1="62" y1="34" x2="70" y2="16" />
            <line x1="38" y1="66" x2="30" y2="84" />
            <line x1="62" y1="66" x2="70" y2="84" />
          </g>
        )}

        {/* Main Cell Body Membrane */}
        <ellipse
          cx="50"
          cy="50"
          rx={rx}
          ry={ry}
          fill={colors.fill}
          fillOpacity="0.78"
          stroke={colors.stroke}
          strokeWidth="2.8"
        />

        {/* Bioluminescent Nucleus & Organelles */}
        <circle
          cx="46"
          cy="50"
          r={ry * 0.45}
          fill={colors.core}
          fillOpacity="0.9"
        />
        <circle cx="36" cy="44" r="3.2" fill={colors.stroke} fillOpacity="0.75" />
        <circle cx="38" cy="57" r="2.6" fill={colors.stroke} fillOpacity="0.7" />

        {/* Diet Mouth Organ at Front (+X) */}
        {diet === 'carnivore' ? (
          <g fill="#fda4af" stroke="#f43f5e" strokeWidth="1.2">
            <polygon points={`${50 + rx - 2},41 ${50 + rx + 13},46 ${50 + rx - 1},48`} />
            <polygon points={`${50 + rx - 2},59 ${50 + rx + 13},54 ${50 + rx - 1},52`} />
          </g>
        ) : diet === 'omnivore' ? (
          <line
            x1={50 + rx - 2}
            y1="50"
            x2={50 + rx + 15}
            y2="50"
            stroke="#fcd34d"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ) : (
          <g stroke="#6ee7b7" strokeWidth="2.2" strokeLinecap="round">
            <line x1={50 + rx} y1="43" x2={50 + rx + 9} y2="39" />
            <line x1={50 + rx + 1} y1="50" x2={50 + rx + 10} y2="50" />
            <line x1={50 + rx} y1="57" x2={50 + rx + 9} y2="61" />
          </g>
        )}

        {/* Bilateral Eyes */}
        <circle cx={50 + rx * 0.55} cy={50 - ry * 0.55} r="4.2" fill="#f8fafc" />
        <circle cx={50 + rx * 0.58} cy={50 - ry * 0.55} r="2.1" fill="#020617" />
        <circle cx={50 + rx * 0.55} cy={50 + ry * 0.55} r="4.2" fill="#f8fafc" />
        <circle cx={50 + rx * 0.58} cy={50 + ry * 0.55} r="2.1" fill="#020617" />
      </svg>

      <span className="absolute -bottom-2 rounded-full border border-cyan-300/45 bg-[#042436] px-2 py-0.5 text-[9px] font-black tracking-wider text-cyan-200 uppercase shadow">
        {isCreatureStage ? 'Terrestre' : 'Celular'}
      </span>
    </div>
  );
}

export function MainMenuModal({
  planetSlots,
  selectedSlotId,
  hoveredSlotId,
  isSettingsOpen = false,
  isGenesisOpen = false,
  onSelectSlot,
  onPlaySlot,
  onStartNewGameInSlot,
  onDeleteSlot,
  onOpenSettings,
  onSetMenuCameraMode,
}: MainMenuModalProps) {
  const [menuView, setMenuView] = useState<'title_menu' | 'planet_select'>('title_menu');
  const [confirmingDeleteSlotId, setConfirmingDeleteSlotId] = useState<
    number | null
  >(null);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);

  // If the user clicks directly on a 3D planet in the canvas, transition smoothly into planet_select view
  const effectiveMenuView =
    selectedSlotId !== null ? 'planet_select' : menuView;

  const selectedSlot =
    selectedSlotId !== null
      ? planetSlots.find((s) => s.slotId === selectedSlotId) ?? null
      : null;
  const selectedDefinition: PlanetCatalogDefinition | null =
    selectedSlotId !== null
      ? PLANET_CATALOG.find((d) => d.slotId === selectedSlotId) ?? null
      : null;

  const hoveredSlot =
    hoveredSlotId !== null
      ? planetSlots.find((s) => s.slotId === hoveredSlotId) ?? null
      : null;
  const hoveredDefinition =
    hoveredSlotId !== null
      ? PLANET_CATALOG.find((d) => d.slotId === hoveredSlotId) ?? null
      : null;

  const colonizedCount = planetSlots.filter((s) => s.hasSave).length;

  const handleSelectPlanet = (slotId: number | null) => {
    audioManager.playButtonClick();
    setConfirmingDeleteSlotId(null);
    if (slotId !== null) {
      setMenuView('planet_select');
    }
    onSelectSlot(slotId);
  };

  const handleEnterCosmos = () => {
    audioManager.playButtonClick();
    setMenuView('planet_select');
    onSetMenuCameraMode?.('planet_select');
  };

  const handleBackToTitleMenu = () => {
    audioManager.playButtonClick();
    setConfirmingDeleteSlotId(null);
    onSelectSlot(null);
    setMenuView('title_menu');
    onSetMenuCameraMode?.('title_menu');
  };

  // Keep menuView synced to 'planet_select' whenever a planet is selected so deselecting returns to Level 2 (Solar System)
  useEffect(() => {
    if (selectedSlotId !== null && menuView !== 'planet_select') {
      setMenuView('planet_select');
      onSetMenuCameraMode?.('planet_select');
    }
  }, [selectedSlotId, menuView, onSetMenuCameraMode]);

  useEffect(() => {
    if (isSettingsOpen || isGenesisOpen || isCreditsOpen) return;

    const handleWheel = (e: WheelEvent) => {
      // NIVEL 1: En la pantalla de título inicial el zoom con la rueda está completamente bloqueado
      if (effectiveMenuView === 'title_menu') {
        e.preventDefault();
        return;
      }

      if (effectiveMenuView === 'planet_select') {
        // NIVEL 3 -> NIVEL 2: Con un planeta seleccionado, girar la rueda hacia atrás solo deselecciona el planeta
        if (selectedSlotId !== null && e.deltaY > 0) {
          e.preventDefault();
          setConfirmingDeleteSlotId(null);
          onSelectSlot(null);
          return;
        }

        // NIVEL 2: Sin planeta seleccionado, girar la rueda hacia atrás nunca devuelve a title_menu
        if (selectedSlotId === null && e.deltaY > 0) {
          return;
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [
    effectiveMenuView,
    selectedSlotId,
    isSettingsOpen,
    isGenesisOpen,
    isCreditsOpen,
    onSelectSlot,
  ]);

  useEffect(() => {
    if (isSettingsOpen || isGenesisOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.key === 'Escape') {
        if (isCreditsOpen) {
          e.preventDefault();
          e.stopPropagation();
          audioManager.playButtonClick();
          setIsCreditsOpen(false);
          return;
        }
        if (confirmingDeleteSlotId !== null) {
          e.preventDefault();
          e.stopPropagation();
          audioManager.playButtonClick();
          setConfirmingDeleteSlotId(null);
          return;
        }
        if (effectiveMenuView === 'planet_select') {
          e.preventDefault();
          e.stopPropagation();
          audioManager.playButtonClick();
          setConfirmingDeleteSlotId(null);

          // NIVEL 3 -> NIVEL 2: Si hay un planeta enfocado, solo deseleccionarlo y volver a la vista general del Sistema Solar
          if (selectedSlotId !== null) {
            onSelectSlot(null);
            return;
          }

          // NIVEL 2 -> NIVEL 1: Si ya estamos en la vista general del Sistema Solar, regresar al menú de título inicial
          setMenuView('title_menu');
          onSetMenuCameraMode?.('title_menu');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    effectiveMenuView,
    selectedSlotId,
    isCreditsOpen,
    confirmingDeleteSlotId,
    isSettingsOpen,
    isGenesisOpen,
    onSelectSlot,
    onSetMenuCameraMode,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-4 sm:p-6"
    >
      <AnimatePresence mode="wait">
        {effectiveMenuView === 'title_menu' ? (
          /* =====================================================================
           * MODE 1: TITLE_MENU (Floating Bioluminescent EvoLife Logo & Organic Menu)
           * ===================================================================== */
          <motion.div
            key="title-menu-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-1 flex-col items-center justify-between py-6 sm:py-10"
          >
            {/* Top Floating Organic Bioluminescent Logo with Plasma Sparkles */}
            <div className="relative flex flex-col items-center text-center mt-2 sm:mt-4">
              {/* Ambient Bioluminescent Plasma Glow Halo */}
              <div
                className="pointer-events-none absolute -inset-x-16 -inset-y-8 rounded-full bg-gradient-to-r from-cyan-500/20 via-emerald-400/25 to-amber-400/20 blur-3xl"
                aria-hidden="true"
              />

              {/* Plasma Sparkle Dots */}
              <div className="relative flex items-center gap-3 text-xs font-extrabold tracking-[0.32em] text-cyan-200/90 uppercase mb-2">
                <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
                <span>Sistema Estelar Helios-Prime</span>
                <Sparkles className="h-3.5 w-3.5 text-cyan-300 animate-pulse" />
              </div>

              <h1
                className="relative font-display text-6xl sm:text-7xl md:text-8xl font-black tracking-tight bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(34,211,238,0.55)] select-none"
                style={{ fontFamily: '"Outfit", "Plus Jakarta Sans", sans-serif' }}
              >
                EvoLife
              </h1>

              <p className="mt-2 text-sm sm:text-base font-extrabold tracking-[0.22em] text-cyan-100/90 uppercase drop-shadow-[0_2px_10px_rgba(6,182,212,0.5)]">
                Simulador de Evolución Celular
              </p>
            </div>

            {/* Central Floating Organic Button Menu */}
            <div className="pointer-events-auto relative my-auto flex w-full max-w-sm flex-col items-center gap-3.5 rounded-[2.6rem] border-2 border-cyan-300/35 bg-gradient-to-b from-[#06283d]/80 via-[#041827]/85 to-[#020d17]/90 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.78),0_0_45px_rgba(34,211,238,0.22),inset_0_2px_12px_rgba(165,243,252,0.25)] backdrop-blur-2xl">
              {/* Top Specular Membrane Highlight */}
              <div className="pointer-events-none absolute inset-x-10 top-0 h-10 rounded-b-full bg-gradient-to-b from-cyan-200/20 to-transparent" />

              {/* Primary Button: JUGAR / ENTRAR AL COSMOS */}
              <button
                type="button"
                onPointerEnter={() => audioManager.playButtonHover()}
                onClick={handleEnterCosmos}
                className="group relative flex w-full items-center justify-center gap-3 rounded-full border-2 border-teal-200/75 bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 px-7 py-4 text-sm sm:text-base font-black tracking-wider text-slate-950 uppercase shadow-[0_0_32px_rgba(34,211,238,0.55),inset_0_2px_8px_rgba(255,255,255,0.75)] transition-all hover:scale-[1.03] hover:brightness-110 active:scale-[0.98] cursor-pointer"
              >
                <Play className="h-5 w-5 fill-slate-950 transition-transform group-hover:translate-x-0.5" />
                <span>JUGAR / ENTRAR AL COSMOS</span>
              </button>

              {/* Secondary Button: AJUSTES */}
              <button
                type="button"
                onPointerEnter={() => audioManager.playButtonHover()}
                onClick={() => {
                  audioManager.playButtonClick();
                  onOpenSettings();
                }}
                className="flex w-full items-center justify-center gap-2.5 rounded-full border border-cyan-300/40 bg-[#052336]/85 px-6 py-3 text-xs sm:text-sm font-black tracking-widest text-cyan-100 uppercase shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_1px_6px_rgba(103,232,249,0.2)] transition-all hover:scale-[1.02] hover:border-cyan-200 hover:bg-cyan-800/50 hover:text-white active:scale-[0.98] cursor-pointer"
              >
                <Settings className="h-4 w-4 text-cyan-300" />
                <span>AJUSTES</span>
              </button>

              {/* Secondary Button: CRÉDITOS */}
              <button
                type="button"
                onPointerEnter={() => audioManager.playButtonHover()}
                onClick={() => {
                  audioManager.playButtonClick();
                  setIsCreditsOpen(true);
                }}
                className="flex w-full items-center justify-center gap-2.5 rounded-full border border-cyan-300/40 bg-[#052336]/85 px-6 py-3 text-xs sm:text-sm font-black tracking-widest text-cyan-100 uppercase shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_1px_6px_rgba(103,232,249,0.2)] transition-all hover:scale-[1.02] hover:border-cyan-200 hover:bg-cyan-800/50 hover:text-white active:scale-[0.98] cursor-pointer"
              >
                <Info className="h-4 w-4 text-teal-300" />
                <span>CRÉDITOS</span>
              </button>
            </div>

            {/* Subtle Bottom Cosmic Hint */}
            <div className="text-center text-xs font-semibold tracking-wide text-cyan-100/70 drop-shadow">
              Arrastra en el espacio para orbitar la estrella madre · {colonizedCount}/6 mundos con vida activa
            </div>
          </motion.div>
        ) : (
          /* =====================================================================
           * MODE 2: PLANET_SELECT (6 Orbital Planets & World Hologram Card)
           * ===================================================================== */
          <motion.div
            key="planet-select-view"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex flex-1 flex-col justify-between"
          >
            {/* TOP BAR: Biological Droplet "Volver al Menú Principal" */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Top-Left Biological Droplet Button: Volver al Menú Principal */}
              <div className="pointer-events-auto flex items-center gap-3">
                <button
                  type="button"
                  onPointerEnter={() => audioManager.playButtonHover()}
                  onClick={handleBackToTitleMenu}
                  className="flex items-center gap-2 rounded-full border border-cyan-400/35 bg-cyan-950/70 backdrop-blur-xl px-4 py-2 text-xs font-black tracking-widest text-cyan-200 hover:border-cyan-300 hover:bg-cyan-900/80 hover:text-white transition-all shadow-[0_4px_16px_rgba(0,0,0,0.5)] uppercase cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-cyan-300" />
                  <span>Volver al Menú Principal [Esc]</span>
                </button>

                <span className="hidden md:inline-block text-xs font-semibold text-cyan-100/75 drop-shadow">
                  Selecciona un planeta en órbita para continuar o engendrar una nueva especie ({colonizedCount}/6 mundos vivos)
                </span>
              </div>

              {selectedSlotId !== null && (
                <div className="pointer-events-auto flex items-center gap-2.5">
                  <button
                    type="button"
                    onPointerEnter={() => audioManager.playButtonHover()}
                    onClick={() => handleSelectPlanet(null)}
                    className="flex items-center gap-2 rounded-full border border-cyan-300/40 bg-[#052336]/90 px-4 py-2 text-xs font-black tracking-wider text-cyan-100 uppercase shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all hover:scale-105 hover:border-cyan-200 hover:bg-cyan-500/25 active:scale-95 cursor-pointer"
                  >
                    <Orbit className="h-3.5 w-3.5 text-cyan-300" />
                    Vista Orbital
                  </button>
                </div>
              )}
            </div>

            {/* MIDDLE AREA: Hover Telemetry Pill OR Focused Planet Holographic World Card */}
            <div className="relative flex flex-1 items-center justify-end py-3">
              {/* Floating Hover Pill when in General Solar System View */}
              <AnimatePresence>
                {selectedSlot === null && hoveredSlot && hoveredDefinition && (
                  <motion.div
                    key={`hover-${hoveredSlot.slotId}`}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full border-2 border-cyan-300/45 bg-[#041d2e]/90 px-5 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.65),0_0_24px_rgba(34,211,238,0.25)] backdrop-blur-xl"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-white">
                        {hoveredSlot.planetName}
                      </span>
                      <span className="text-xs text-cyan-300/80">·</span>
                      {hoveredSlot.hasSave ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                          <Sparkles className="h-3.5 w-3.5" />
                          {hoveredSlot.speciesName} (Etapa {hoveredSlot.growthStage ?? 1}/5)
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-amber-300">
                          Mundo Virgen · Haz clic para colonizar
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* HOLOGRAPHIC WORLD CARD (Right-aligned when a planet is selected) */}
              <AnimatePresence mode="wait">
                {selectedSlot && selectedDefinition && (
                  <motion.div
                    key={`world-card-${selectedSlot.slotId}`}
                    initial={{ opacity: 0, x: 42, scale: 0.94 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 42, scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[2.5rem] border-2 border-cyan-300/45 bg-gradient-to-b from-[#072d44]/92 via-[#041b2b]/95 to-[#020f1a]/96 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.8),0_0_45px_rgba(6,182,212,0.24),inset_0_2px_14px_rgba(165,243,252,0.28)] backdrop-blur-2xl"
                  >
                    {/* Top Specular Membrane Highlight */}
                    <div className="pointer-events-none absolute inset-x-8 top-0 h-14 rounded-b-full bg-gradient-to-b from-cyan-200/20 to-transparent" />

                    {/* Card Header */}
                    <div className="relative flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black tracking-widest text-cyan-200 uppercase">
                          <span>
                            Órbita #{selectedSlot.slotId} · {selectedDefinition.orbitRadius} UA
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={THEME_BADGE_STYLES[selectedSlot.planetTheme].accentText}>
                            {THEME_BADGE_STYLES[selectedSlot.planetTheme].label}
                          </span>
                        </div>

                        <h2 className="mt-1.5 text-3xl font-black tracking-tight text-white drop-shadow-[0_2px_12px_rgba(34,211,238,0.4)]">
                          {selectedSlot.planetName}
                        </h2>
                        <p className="text-xs font-medium text-cyan-100/75">
                          {selectedDefinition.atmosphereDesc}
                        </p>
                      </div>

                      <button
                        type="button"
                        onPointerEnter={() => audioManager.playButtonHover()}
                        onClick={() => handleSelectPlanet(null)}
                        aria-label="Cerrar tarjeta planetaria"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-950/60 text-cyan-200 transition-transform hover:scale-110 hover:border-cyan-200 hover:bg-cyan-800/60 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* CARD BODY: COLONIZED PLANET vs VIRGIN PLANET */}
                    {selectedSlot.hasSave ? (
                      <div className="mt-5 space-y-4">
                        {/* Species Hologram & Identity Box */}
                        <div className="flex items-center gap-4 rounded-3xl border border-cyan-300/30 bg-[#031523]/85 p-4 shadow-inner">
                          <CreatureHologramMiniature
                            colorTheme={selectedSlot.colorTheme}
                            bodyShape={selectedSlot.bodyShape}
                            diet={selectedSlot.diet}
                            isCreatureStage={
                              selectedSlot.evolutionaryStage === 'creature_stage'
                            }
                          />

                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-black tracking-widest text-teal-300 uppercase">
                              Especie Dominante
                            </div>
                            <div className="truncate text-xl font-black text-white">
                              {selectedSlot.speciesName || 'Organismo Primigenio'}
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-bold text-cyan-200">
                              <span>
                                {selectedSlot.evolutionaryStage === 'creature_stage'
                                  ? 'Criatura Terrestre'
                                  : `Etapa ${selectedSlot.growthStage ?? 1}/5 Celular`}
                              </span>
                              {selectedSlot.diet && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-teal-300">
                                    {DIET_LABELS[selectedSlot.diet].label}
                                  </span>
                                </>
                              )}
                            </div>

                            {selectedSlot.innateTrait && (
                              <div className="mt-1 text-[11px] font-semibold text-cyan-200/80">
                                Gen: {TRAIT_LABELS[selectedSlot.innateTrait]}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Quantitative Telemetry Grid */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="rounded-2xl border border-cyan-400/25 bg-[#041a2b]/80 px-3.5 py-2.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-cyan-300/75 uppercase">
                              <Dna className="h-3.5 w-3.5 text-amber-300" />
                              ADN Disponible / Total
                            </div>
                            <div className="mt-0.5 text-base font-black text-amber-300">
                              {selectedSlot.adn ?? 0}{' '}
                              <span className="text-xs font-bold text-cyan-200/70">
                                ({selectedSlot.totalAdnEarned ?? 0} acum.)
                              </span>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-cyan-400/25 bg-[#041a2b]/80 px-3.5 py-2.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-cyan-300/75 uppercase">
                              <Timer className="h-3.5 w-3.5 text-teal-300" />
                              Tiempo Evolutivo
                            </div>
                            <div className="mt-0.5 text-base font-black text-teal-200">
                              {formatSurvivalTime(selectedSlot.survivalTime)}
                            </div>
                          </div>
                        </div>

                        {/* Primary Action: Play in this World */}
                        <button
                          type="button"
                          onPointerEnter={() => audioManager.playButtonHover()}
                          onClick={() => {
                            audioManager.playButtonClick();
                            onPlaySlot(selectedSlot.slotId);
                          }}
                          className="group flex w-full items-center justify-center gap-3 rounded-full border-2 border-teal-200/65 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 px-6 py-3.5 text-base font-black tracking-wide text-slate-950 shadow-[0_0_28px_rgba(45,212,191,0.5),inset_0_2px_6px_rgba(255,255,255,0.65)] transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] cursor-pointer"
                        >
                          <Play className="h-5 w-5 fill-slate-950 transition-transform group-hover:translate-x-0.5" />
                          Jugar en este Mundo
                        </button>

                        {/* Secondary Action: Sterilize / Delete Planet Save Slot with two-step confirmation */}
                        {confirmingDeleteSlotId === selectedSlot.slotId ? (
                          <div className="rounded-3xl border-2 border-rose-400/60 bg-rose-950/75 p-3.5 text-center shadow-[0_0_24px_rgba(244,63,94,0.3)]">
                            <div className="flex items-center justify-center gap-2 text-xs font-black text-rose-200">
                              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                              <span>
                                ¿Esterilizar este planeta? Toda la vida y el progreso de esta especie se perderán.
                              </span>
                            </div>
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onPointerEnter={() => audioManager.playButtonHover()}
                                onClick={() => {
                                  audioManager.playButtonClick();
                                  onDeleteSlot(selectedSlot.slotId);
                                  setConfirmingDeleteSlotId(null);
                                }}
                                className="flex-1 rounded-full border border-rose-300/60 bg-rose-600 px-3 py-2 text-xs font-black text-white uppercase shadow hover:bg-rose-500 cursor-pointer"
                              >
                                Sí, Esterilizar
                              </button>
                              <button
                                type="button"
                                onPointerEnter={() => audioManager.playButtonHover()}
                                onClick={() => {
                                  audioManager.playButtonClick();
                                  setConfirmingDeleteSlotId(null);
                                }}
                                className="flex-1 rounded-full border border-cyan-300/35 bg-slate-900/80 px-3 py-2 text-xs font-bold text-cyan-100 uppercase hover:bg-slate-800 cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <button
                              type="button"
                              onPointerEnter={() => audioManager.playButtonHover()}
                              onClick={() => handleSelectPlanet(null)}
                              className="flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-[#041d2e]/80 px-3.5 py-2 text-xs font-bold text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-500/15 cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Volver
                            </button>

                            <button
                              type="button"
                              onPointerEnter={() => audioManager.playButtonHover()}
                              onClick={() => {
                                audioManager.playButtonClick();
                                setConfirmingDeleteSlotId(selectedSlot.slotId);
                              }}
                              className="flex items-center gap-1.5 rounded-full border border-rose-400/35 bg-rose-950/40 px-3.5 py-2 text-xs font-bold text-rose-300 transition hover:border-rose-400/70 hover:bg-rose-900/60 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Esterilizar / Borrar Mundo
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* VIRGIN PLANET VIEW */
                      <div className="mt-5 space-y-4">
                        <div className="flex items-center gap-4 rounded-3xl border border-amber-300/30 bg-[#041726]/85 p-4 shadow-inner">
                          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-amber-300/45 bg-amber-500/10">
                            <Globe className="h-10 w-10 text-amber-300/85" />
                            <span className="absolute -bottom-1.5 rounded-full border border-amber-300/45 bg-amber-950 px-2 py-0.5 text-[9px] font-black text-amber-200 uppercase">
                              Estéril
                            </span>
                          </div>

                          <div>
                            <div className="text-[10px] font-black tracking-widest text-amber-300 uppercase">
                              Estado de Biosfera
                            </div>
                            <div className="text-lg font-black text-white">
                              Mundo Virgen Sin Colonizar
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-cyan-100/75">
                              {selectedDefinition.subtitle}. Condiciones óptimas para sembrar un meteorito de panspermia e iniciar una nueva línea genética.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onPointerEnter={() => audioManager.playButtonHover()}
                          onClick={() => {
                            audioManager.playButtonClick();
                            onStartNewGameInSlot(selectedSlot.slotId);
                          }}
                          className="group flex w-full items-center justify-center gap-3 rounded-full border-2 border-amber-200/70 bg-gradient-to-r from-amber-400 via-teal-400 to-cyan-400 px-6 py-3.5 text-base font-black tracking-wide text-slate-950 shadow-[0_0_28px_rgba(251,191,36,0.45),inset_0_2px_6px_rgba(255,255,255,0.65)] transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] cursor-pointer"
                        >
                          <Sparkles className="h-5 w-5 text-slate-950 transition-transform group-hover:rotate-12" />
                          Engendrar Vida en este Mundo
                        </button>

                        <button
                          type="button"
                          onPointerEnter={() => audioManager.playButtonHover()}
                          onClick={() => handleSelectPlanet(null)}
                          className="flex w-full items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-[#041d2e]/80 px-4 py-2.5 text-xs font-bold text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-500/15 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Volver al Sistema Solar [Esc]
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* BOTTOM DOCK: Quick Planetary Orbit Selector (Slots 1 to 6) */}
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="pointer-events-auto mx-auto w-full max-w-5xl rounded-[2.2rem] border-2 border-cyan-300/35 bg-gradient-to-r from-[#041d2e]/90 via-[#06283d]/90 to-[#041d2e]/90 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.75),inset_0_2px_10px_rgba(103,232,249,0.2)] backdrop-blur-xl"
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
                {planetSlots.map((slot) => {
                  const def = PLANET_CATALOG.find((d) => d.slotId === slot.slotId);
                  const isSelected = selectedSlotId === slot.slotId;
                  const isHovered = hoveredSlotId === slot.slotId;
                  const themeStyle = THEME_BADGE_STYLES[slot.planetTheme];

                  return (
                    <button
                      key={slot.slotId}
                      type="button"
                      onPointerEnter={() => audioManager.playButtonHover()}
                      onClick={() =>
                        handleSelectPlanet(isSelected ? null : slot.slotId)
                      }
                      className={`group relative flex items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'scale-[1.03] border-cyan-200 bg-cyan-500/25 shadow-[0_0_22px_rgba(34,211,238,0.4)]'
                          : isHovered
                          ? 'border-cyan-300/65 bg-cyan-500/15'
                          : 'border-cyan-400/20 bg-[#031422]/75 hover:border-cyan-300/50 hover:bg-[#062338]/85'
                      }`}
                    >
                      {/* Mini 3D-styled Planet Orb */}
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
                        <div
                          className={`h-7 w-7 rounded-full transition-transform group-hover:scale-110 ${
                            slot.hasSave ? 'shadow-[0_0_12px_rgba(34,211,238,0.6)]' : 'opacity-60 grayscale'
                          }`}
                          style={{
                            background: themeStyle.orbGradient,
                          }}
                        />
                        {def?.hasRings && (
                          <div className="pointer-events-none absolute h-3 w-10 -rotate-12 rounded-full border border-cyan-200/55" />
                        )}
                        <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full border border-cyan-300/50 bg-[#02101c] text-[9px] font-black text-cyan-200">
                          {slot.slotId}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-black text-white">
                          {slot.planetName}
                        </div>
                        {slot.hasSave ? (
                          <div className="truncate text-[10px] font-bold text-teal-300">
                            {slot.speciesName || 'Vida Activa'} · E{slot.growthStage ?? 1}/5
                          </div>
                        ) : (
                          <div className="truncate text-[10px] font-semibold text-slate-400">
                            Mundo Virgen
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREDITS MODAL OVERLAY (Membrane Style) */}
      <AnimatePresence>
        {isCreditsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#020c16]/75 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 16 }}
              className="relative w-full max-w-lg rounded-[2.6rem] border-2 border-cyan-300/45 bg-gradient-to-b from-[#072c42]/95 via-[#041a29]/96 to-[#020f1a]/98 p-7 text-center shadow-[0_24px_70px_rgba(0,0,0,0.85),0_0_45px_rgba(34,211,238,0.25),inset_0_2px_14px_rgba(165,243,252,0.28)]"
            >
              <div className="pointer-events-none absolute inset-x-10 top-0 h-12 rounded-b-full bg-gradient-to-b from-cyan-200/20 to-transparent" />

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/45 bg-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.35)]">
                <Compass className="h-6 w-6 text-cyan-200" />
              </div>
              <h3 className="mt-3 text-2xl font-black text-white">
                EvoLife · Simulador de Evolución Celular
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-cyan-100/80">
                Experiencia interactiva de evolución biológica y panspermia planetaria inspirada en la fase celular clásica de Spore.
              </p>
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left text-[11px] text-cyan-200/85">
                <div className="rounded-2xl border border-cyan-400/25 bg-[#041d2e]/75 p-3">
                  <div className="font-black text-cyan-300 uppercase">Motor 3D & Shaders</div>
                  <div className="mt-0.5 text-cyan-100/75">
                    Three.js WebGL, membranas translúcidas PBR, iluminación abisal y órbitas keplerianas.
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-400/25 bg-[#041d2e]/75 p-3">
                  <div className="font-black text-emerald-300 uppercase">Diseño Evolutivo</div>
                  <div className="mt-0.5 text-cyan-100/75">
                    23 especies marinas procedurales, 25+ adaptaciones genéticas y taller morfológico 3D.
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-400/25 bg-[#041d2e]/75 p-3">
                  <div className="font-black text-amber-300 uppercase">Audio Procedimental</div>
                  <div className="mt-0.5 text-cyan-100/75">
                    Síntesis acústica Web Audio API en tiempo real y paisaje sonoro hidrotermal.
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-400/25 bg-[#041d2e]/75 p-3">
                  <div className="font-black text-purple-300 uppercase">Sistema Helios-Prime</div>
                  <div className="mt-0.5 text-cyan-100/75">
                    6 mundos persistentes con biomas oceánicos de 320m y cinemática de panspermia.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onPointerEnter={() => audioManager.playButtonHover()}
                onClick={() => {
                  audioManager.playButtonClick();
                  setIsCreditsOpen(false);
                }}
                className="mt-6 w-full rounded-full border-2 border-cyan-300/50 bg-cyan-500/25 py-3 text-xs font-black tracking-widest text-cyan-100 uppercase transition hover:bg-cyan-500/35 hover:text-white cursor-pointer"
              >
                Cerrar Créditos
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
