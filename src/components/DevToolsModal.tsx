import React, { useState } from 'react';
import {
  Bug,
  ChevronDown,
  ChevronUp,
  Compass,
  Cpu,
  Dna,
  Flame,
  Footprints,
  HeartPulse,
  MapPin,
  Palette,
  ShieldAlert,
  Sparkles,
  Snowflake,
  Trash2,
  Unlock,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { audioManager } from '../game/AudioManager';
import {
  CellularGrowthStage,
  EvolutionaryStage,
  PlanetTheme,
  PlayerStats,
  SpeciesType,
} from '../game/types';

type DevToolsTab = 'stages' | 'player' | 'teleport' | 'ecosystem';

interface DevToolsModalProps {
  stats: PlayerStats;
  isGodModeActive: boolean;
  isAIFrozen: boolean;
  currentBiomeName: string;
  onClose: () => void;
  onJumpToStage: (
    evolutionaryStage: EvolutionaryStage,
    growthStage: CellularGrowthStage
  ) => void;
  onTriggerBrainCinematic: () => void;
  onAddAdn: (amount: number) => void;
  onToggleGodMode: () => void;
  onHealFull: () => void;
  onUnlockAllAdaptations: () => void;
  onOpenEditorImmediate: () => void;
  onTeleport: (x: number, z: number, label: string) => void;
  onSetPlanetTheme: (theme: PlanetTheme) => void;
  onToggleFreezeAI: () => void;
  onSpawnFoodCluster: () => void;
  onClearAllEnemies: () => void;
  onForceSpawnSpecies: (species: SpeciesType) => void;
}

const PLANET_THEMES: { id: PlanetTheme; label: string; dotClass: string }[] = [
  { id: 'oceanic', label: 'Oceánico', dotClass: 'bg-cyan-400' },
  { id: 'volcanic', label: 'Volcánico', dotClass: 'bg-orange-500' },
  { id: 'terrene', label: 'Terreno', dotClass: 'bg-emerald-400' },
  { id: 'crystalline', label: 'Cristalino', dotClass: 'bg-purple-400' },
  { id: 'desertic', label: 'Desértico', dotClass: 'bg-amber-400' },
  { id: 'toxic', label: 'Tóxico', dotClass: 'bg-lime-400' },
];

const SPAWNABLE_SPECIES: { id: SpeciesType; label: string; tag: string }[] = [
  { id: 'hunter', label: 'Mandíbula Rápida', tag: 'Depredador Nv.1' },
  { id: 'herbivore', label: 'Célula Filtradora', tag: 'Herbívoro Nv.1' },
  { id: 'aguijon_electrico', label: 'Aguijón Bioeléctrico', tag: 'Eléctrico Nv.2' },
  { id: 'vibora_fosa', label: 'Víbora de Fosa', tag: 'Venenoso Nv.2' },
  { id: 'leviathan', label: 'Coloso Acorazado', tag: 'Ápex Nv.3' },
  { id: 'leviatan_sauro', label: 'Leviatán Sauro', tag: 'Terrestre Nv.3' },
];

export const DevToolsModal: React.FC<DevToolsModalProps> = ({
  stats,
  isGodModeActive,
  isAIFrozen,
  currentBiomeName,
  onClose,
  onJumpToStage,
  onTriggerBrainCinematic,
  onAddAdn,
  onToggleGodMode,
  onHealFull,
  onUnlockAllAdaptations,
  onOpenEditorImmediate,
  onTeleport,
  onSetPlanetTheme,
  onToggleFreezeAI,
  onSpawnFoodCluster,
  onClearAllEnemies,
  onForceSpawnSpecies,
}) => {
  const [activeTab, setActiveTab] = useState<DevToolsTab>('stages');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isCreatureStage = stats.evolutionaryStage === 'creature_stage';

  return (
    <aside
      aria-label="Panel de Herramientas de Desarrollador (DevTools)"
      className="pointer-events-auto fixed top-3 right-3 z-55 w-[350px] sm:w-[385px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-3xl border border-amber-300/45 bg-gradient-to-b from-[#061c2c]/95 via-[#03121d]/95 to-[#020b12]/98 text-cyan-50 shadow-[0_14px_44px_rgba(0,0,0,0.85),0_0_24px_rgba(251,191,36,0.22)] backdrop-blur-2xl select-none"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-cyan-400/25 bg-gradient-to-r from-amber-500/20 via-cyan-900/30 to-teal-900/25 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-amber-300/60 bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.35)]">
            <Bug className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-black tracking-wider text-white uppercase">
                DevTools Suite
              </span>
              <span className="rounded-md border border-amber-300/40 bg-amber-500/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-amber-200">
                F1 / º
              </span>
            </div>
            <p className="truncate font-mono text-[10px] text-cyan-200/75">
              {isCreatureStage
                ? 'Estadio: Criatura Terrestre'
                : `Estadio: Celular (Etapa ${stats.growthStage}/5)`}{' '}
              · {stats.adn} ADN
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              audioManager.playButtonClick();
              setIsCollapsed((prev) => !prev);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-950/60 text-cyan-200 hover:border-cyan-200 hover:text-white cursor-pointer transition-all"
            title={isCollapsed ? 'Expandir panel' : 'Minimizar panel'}
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              audioManager.playButtonClick();
              onClose();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-400/35 bg-rose-950/50 text-rose-200 hover:border-rose-300 hover:bg-rose-900/60 hover:text-white cursor-pointer transition-all"
            title="Cerrar DevTools [F1]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Status Badges Strip */}
      {!isCollapsed && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-cyan-400/15 bg-[#020d16]/80 px-3.5 py-1.5 text-[10px] font-mono">
            <span className="truncate text-cyan-200/80" title={currentBiomeName}>
              Bioma: <strong className="text-cyan-100">{currentBiomeName}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              {isGodModeActive && (
                <span className="rounded-full border border-amber-300/60 bg-amber-500/25 px-2 py-0.5 font-extrabold text-amber-200">
                  GOD MODE
                </span>
              )}
              {isAIFrozen && (
                <span className="rounded-full border border-sky-300/60 bg-sky-500/25 px-2 py-0.5 font-extrabold text-sky-200">
                  IA CONGELADA
                </span>
              )}
            </div>
          </div>

          {/* 4 Navigation Tabs */}
          <div className="grid grid-cols-4 gap-1 border-b border-cyan-400/20 bg-[#031320]/90 p-1.5">
            {(
              [
                { id: 'stages', label: 'Fases', icon: Footprints },
                { id: 'player', label: 'Jugador', icon: Zap },
                { id: 'teleport', label: 'Biomas', icon: Compass },
                { id: 'ecosystem', label: 'IA / Spawn', icon: Cpu },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    audioManager.playButtonClick();
                    setActiveTab(tab.id);
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border py-1.5 text-[10px] font-extrabold transition-all cursor-pointer ${
                    active
                      ? 'border-amber-300/80 bg-gradient-to-b from-amber-400/30 to-cyan-900/50 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.28)]'
                      : 'border-cyan-400/15 bg-cyan-950/40 text-cyan-200/70 hover:border-cyan-300/40 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Body */}
          <div className="max-h-[68vh] overflow-y-auto p-3.5 space-y-3 text-xs">
            {/* ==================== TAB 1: FASES Y ETAPAS ==================== */}
            {activeTab === 'stages' && (
              <div className="space-y-2.5">
                <div className="text-[10px] font-mono font-bold tracking-wider text-cyan-300/85 uppercase">
                  Salto Instantáneo de Fase Evolutiva
                </div>

                {/* Highlighted Terrestrial Creature Stage Jump Button */}
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playButtonClick();
                    onJumpToStage('creature_stage', 5);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-2xl border px-3.5 py-3 text-left font-extrabold transition-all cursor-pointer active:scale-[0.98] ${
                    isCreatureStage
                      ? 'border-amber-200 bg-gradient-to-r from-amber-500/40 via-orange-500/35 to-amber-700/40 text-white shadow-[0_0_20px_rgba(251,191,36,0.4)]'
                      : 'border-amber-300/70 bg-gradient-to-r from-amber-500/25 via-amber-600/20 to-teal-900/40 text-amber-100 hover:border-amber-200 hover:from-amber-500/35'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Footprints className="h-5 w-5 shrink-0 text-amber-300" />
                    <div>
                      <div className="text-xs font-black tracking-wide uppercase">
                        ¡FASE DE CRIATURA TERRESTRE!
                      </div>
                      <div className="text-[10px] font-medium text-amber-100/80">
                        Salta directo a tierra firme con patas, manos y Nido
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-400/25 px-2 py-0.5 font-mono text-[10px] text-amber-200">
                    Tierra
                  </span>
                </button>

                {/* Cellular Stages 1, 2, 3, 4, 5 */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-mono font-bold tracking-wider text-cyan-200/75 uppercase">
                    Etapas de la Fase Celular (Acuática)
                  </div>
                  {(
                    [
                      {
                        stage: 1 as CellularGrowthStage,
                        title: 'Fase Celular - Etapa 1 (Microbio)',
                        sub: 'Radio 110m · Nivel microbiano inicial',
                      },
                      {
                        stage: 2 as CellularGrowthStage,
                        title: 'Fase Celular - Etapa 2 (Célula Desarrollada)',
                        sub: 'Radio 165m · Fumarolas y fauna Nv.2',
                      },
                      {
                        stage: 3 as CellularGrowthStage,
                        title: 'Fase Celular - Etapa 3 (Colonia)',
                        sub: 'Radio 220m · Árboles de Cloroplastos',
                      },
                      {
                        stage: 4 as CellularGrowthStage,
                        title: 'Fase Celular - Etapa 4 (Macro-Célula)',
                        sub: 'Radio 275m · Depredadores abisales',
                      },
                      {
                        stage: 5 as CellularGrowthStage,
                        title: 'Fase Celular - Etapa 5 (Leviatán Acuático)',
                        sub: 'Radio 330m · Listo para transición cerebral',
                      },
                    ] as const
                  ).map((item) => {
                    const active =
                      !isCreatureStage && stats.growthStage === item.stage;
                    return (
                      <button
                        key={item.stage}
                        type="button"
                        onClick={() => {
                          audioManager.playButtonClick();
                          onJumpToStage('cell_stage', item.stage);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-all cursor-pointer active:scale-[0.98] ${
                          active
                            ? 'border-cyan-200/85 bg-cyan-500/25 text-white shadow-[0_0_12px_rgba(34,211,238,0.25)]'
                            : 'border-cyan-400/20 bg-cyan-950/45 text-cyan-100/85 hover:border-cyan-300/50 hover:bg-cyan-900/40'
                        }`}
                      >
                        <div>
                          <div className="text-[11px] font-extrabold">
                            {item.title}
                          </div>
                          <div className="text-[10px] text-cyan-200/70">
                            {item.sub}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-cyan-300">
                          Nv.{item.stage}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Trigger 3D Brain Evolution Sequence */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      audioManager.playButtonClick();
                      onTriggerBrainCinematic();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-300/45 bg-purple-950/50 hover:bg-purple-900/60 px-3 py-2 text-[11px] font-extrabold text-purple-100 cursor-pointer active:scale-95 transition-all"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-purple-300" />
                    <span>Reproducir Cinemática de Cerebro 3D</span>
                  </button>
                </div>
              </div>
            )}

            {/* ==================== TAB 2: JUGADOR Y STATS ==================== */}
            {activeTab === 'player' && (
              <div className="space-y-3">
                {/* DNA Injection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-amber-200 uppercase">
                    <span>Inyección de Recursos Genéticos</span>
                    <span>Actual: {stats.adn} ADN</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        audioManager.playButtonClick();
                        onAddAdn(100);
                      }}
                      className="flex items-center justify-center gap-1 rounded-xl border border-amber-300/45 bg-amber-500/20 hover:bg-amber-500/35 py-2 font-mono text-xs font-extrabold text-amber-100 cursor-pointer active:scale-95 transition-all"
                    >
                      <Dna className="h-3.5 w-3.5 text-amber-300" />
                      <span>+100 ADN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        audioManager.playButtonClick();
                        onAddAdn(1000);
                      }}
                      className="flex items-center justify-center gap-1 rounded-xl border border-amber-200/70 bg-amber-500/30 hover:bg-amber-500/45 py-2 font-mono text-xs font-extrabold text-white shadow-[0_0_12px_rgba(251,191,36,0.3)] cursor-pointer active:scale-95 transition-all"
                    >
                      <Dna className="h-3.5 w-3.5 text-amber-200" />
                      <span>+1000 ADN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        audioManager.playButtonClick();
                        onAddAdn(-100);
                      }}
                      className="flex items-center justify-center gap-1 rounded-xl border border-rose-300/35 bg-rose-950/50 hover:bg-rose-900/60 py-2 font-mono text-xs font-bold text-rose-200 cursor-pointer active:scale-95 transition-all"
                    >
                      <span>-100 ADN</span>
                    </button>
                  </div>
                </div>

                {/* God Mode Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playButtonClick();
                    onToggleGodMode();
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition-all cursor-pointer active:scale-[0.98] ${
                    isGodModeActive
                      ? 'border-amber-200 bg-gradient-to-r from-amber-500/35 to-emerald-600/35 text-white shadow-[0_0_16px_rgba(251,191,36,0.35)]'
                      : 'border-cyan-300/30 bg-cyan-950/50 text-cyan-100 hover:border-cyan-200/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert
                      className={`h-4 w-4 ${
                        isGodModeActive ? 'text-amber-300' : 'text-cyan-300'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-extrabold">
                        Modo Dios (Invulnerable + Sprint Infinito)
                      </div>
                      <div className="text-[10px] text-cyan-200/75">
                        Inmune a mordiscos/inanición y turbo ilimitado
                      </div>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-black ${
                      isGodModeActive
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-slate-800 text-cyan-200/70'
                    }`}
                  >
                    {isGodModeActive ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Heal 100% Vital & Energy */}
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playButtonClick();
                    onHealFull();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/45 bg-emerald-950/55 hover:bg-emerald-900/65 px-3 py-2.5 text-xs font-extrabold text-emerald-100 cursor-pointer active:scale-95 transition-all"
                >
                  <HeartPulse className="h-4 w-4 text-emerald-300" />
                  <span>
                    Curar 100% Vida ({Math.ceil(stats.health)}/{stats.maxHealth}) y
                    Energía ({Math.ceil(stats.energy)}/{stats.maxEnergy})
                  </span>
                </button>

                {/* Unlock All Catalog Parts */}
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playButtonClick();
                    onUnlockAllAdaptations();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/45 bg-cyan-900/45 hover:bg-cyan-800/55 px-3 py-2.5 text-xs font-extrabold text-cyan-50 cursor-pointer active:scale-95 transition-all"
                >
                  <Unlock className="h-4 w-4 text-amber-300" />
                  <span>Desbloquear Todo el Catálogo (Fósiles y Genes)</span>
                </button>

                {/* Open 3D Workshop Directly */}
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playButtonClick();
                    onOpenEditorImmediate();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/60 bg-gradient-to-r from-cyan-500/30 to-teal-600/35 hover:from-cyan-500/45 hover:to-teal-600/50 px-3 py-2.5 text-xs font-extrabold text-white shadow-[0_0_14px_rgba(34,211,238,0.28)] cursor-pointer active:scale-95 transition-all"
                >
                  <Wrench className="h-4 w-4 text-cyan-200" />
                  <span>Abrir Editor 3D Directamente [E]</span>
                </button>
              </div>
            )}

            {/* ==================== TAB 3: ENTORNO Y TELETRANSPORTE ==================== */}
            {activeTab === 'teleport' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono font-bold tracking-wider text-cyan-300/85 uppercase">
                    Teletransporte Instantáneo de Coordenadas
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(
                      [
                        {
                          x: 0,
                          z: 0,
                          label: 'Ir a Nido Central / Origen (0, 0)',
                          desc: 'Santuario central y meteorito de origen',
                        },
                        {
                          x: -60,
                          z: 20,
                          label: 'Ir a Fosa Hidrotermal (-60, 20)',
                          desc: 'Fumarolas volcánicas de regeneración térmica',
                        },
                        {
                          x: 40,
                          z: 80,
                          label: 'Ir a Bosque de Cloroplastos (40, 80)',
                          desc: 'Alta densidad de flora fotosintética',
                        },
                        {
                          x: -85,
                          z: -70,
                          label: 'Ir a Mesetas de Coral (-85, -70)',
                          desc: 'Formaciones arrecifales y laberintos de roca',
                        },
                        {
                          x: 310,
                          z: 0,
                          label: 'Ir a Borde del Mapa (310, 0)',
                          desc: 'Frontera abisal del radio máximo (330m)',
                        },
                      ] as const
                    ).map((loc) => (
                      <button
                        key={loc.label}
                        type="button"
                        onClick={() => {
                          audioManager.playButtonClick();
                          onTeleport(loc.x, loc.z, loc.label);
                        }}
                        className="flex items-center justify-between rounded-xl border border-cyan-400/25 bg-cyan-950/50 hover:border-cyan-300/60 hover:bg-cyan-900/50 px-3 py-2 text-left transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                          <div>
                            <div className="text-[11px] font-extrabold text-white">
                              {loc.label}
                            </div>
                            <div className="text-[10px] text-cyan-200/70">
                              {loc.desc}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-amber-300">
                          TP
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Planetary Biome Palette Switcher */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider text-amber-200 uppercase">
                    <Palette className="h-3.5 w-3.5" />
                    <span>Cambiar Paleta / Bioma Planetario en Vivo</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {PLANET_THEMES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          audioManager.playButtonClick();
                          onSetPlanetTheme(t.id);
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-950/55 hover:border-amber-300/65 hover:bg-cyan-900/55 px-2.5 py-1.5 text-[11px] font-bold text-cyan-100 cursor-pointer active:scale-95 transition-all"
                      >
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${t.dotClass}`}
                        />
                        <span className="truncate">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 4: ECOSISTEMA E IA ==================== */}
            {activeTab === 'ecosystem' && (
              <div className="space-y-3">
                {/* Freeze AI Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    audioManager.playButtonClick();
                    onToggleFreezeAI();
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition-all cursor-pointer active:scale-[0.98] ${
                    isAIFrozen
                      ? 'border-sky-200 bg-gradient-to-r from-sky-500/35 to-cyan-700/40 text-white shadow-[0_0_16px_rgba(56,189,248,0.35)]'
                      : 'border-cyan-300/30 bg-cyan-950/50 text-cyan-100 hover:border-cyan-200/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Snowflake
                      className={`h-4 w-4 ${
                        isAIFrozen ? 'text-sky-200' : 'text-cyan-300'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-extrabold">
                        Congelar IA (Freeze Enemies)
                      </div>
                      <div className="text-[10px] text-cyan-200/75">
                        Pausa depredadores para inspeccionar mallas y shaders
                      </div>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-black ${
                      isAIFrozen
                        ? 'bg-sky-300 text-slate-950'
                        : 'bg-slate-800 text-cyan-200/70'
                    }`}
                  >
                    {isAIFrozen ? 'FROZEN' : 'LIVE'}
                  </span>
                </button>

                {/* Spawn Extra Food & Clear Map */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      audioManager.playButtonClick();
                      onSpawnFoodCluster();
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300/45 bg-emerald-950/55 hover:bg-emerald-900/65 px-2.5 py-2.5 text-[11px] font-extrabold text-emerald-100 cursor-pointer active:scale-95 transition-all"
                  >
                    <Flame className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Generar Comida Cerca</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      audioManager.playButtonClick();
                      onClearAllEnemies();
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-300/40 bg-rose-950/55 hover:bg-rose-900/65 px-2.5 py-2.5 text-[11px] font-extrabold text-rose-100 cursor-pointer active:scale-95 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-300" />
                    <span>Vaciar Enemigos</span>
                  </button>
                </div>

                {/* Force Spawn Specific Species for Combat Testing */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-mono font-bold tracking-wider text-cyan-300/85 uppercase">
                    Forzar Spawn de Especie Frente al Jugador (11m)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SPAWNABLE_SPECIES.map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => {
                          audioManager.playButtonClick();
                          onForceSpawnSpecies(sp.id);
                        }}
                        className="flex flex-col rounded-xl border border-cyan-400/25 bg-cyan-950/50 hover:border-amber-300/60 hover:bg-cyan-900/50 px-2.5 py-1.5 text-left transition-all cursor-pointer active:scale-95"
                      >
                        <span className="text-[11px] font-extrabold text-white truncate">
                          {sp.label}
                        </span>
                        <span className="font-mono text-[9px] text-amber-200/80">
                          {sp.tag}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};
