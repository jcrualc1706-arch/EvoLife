import React, { useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Dna,
  Footprints,
  HeartHandshake,
  Pause,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { GameUISnapshot, InputState } from '../game/types';

interface GameHUDProps {
  snapshot: GameUISnapshot;
  onTogglePause: () => void;
  onToggleEditor: () => void;
  onEvolveToCreatureStage: () => void;
  onRestart: () => void;
  onControlInput: (key: keyof InputState, active: boolean) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  snapshot,
  onTogglePause,
  onToggleEditor,
  onEvolveToCreatureStage,
  onRestart,
  onControlInput,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const {
    stats,
    nearestSpeciesName,
    nearestPredatorState,
    nearestPredatorDistance,
    currentBiomeName,
    activeQuestTitle,
    activeQuestProgressText,
    readyForLandTransition,
    recentEventMessage,
    evolutionSlots,
  } = snapshot;

  const isCreatureStage = stats.evolutionaryStage === 'creature_stage';

  const healthPct = Math.max(
    0,
    Math.min(100, (stats.health / stats.maxHealth) * 100)
  );
  const energyPct = Math.max(
    0,
    Math.min(100, (stats.energy / stats.maxEnergy) * 100)
  );

  const availableUpgradesCount = evolutionSlots.filter(
    (s) => !s.unlocked && stats.adn >= s.costAdn
  ).length;
  const unlockedCount = evolutionSlots.filter((s) => s.unlocked).length;

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remSec = Math.floor(sec % 60);
    return `${mins}:${remSec < 10 ? '0' : ''}${remSec}`;
  };

  const threatColorClass =
    nearestPredatorState === 'ATACAR'
      ? 'text-rose-400'
      : nearestPredatorState === 'PERSEGUIR'
      ? 'text-amber-400'
      : nearestPredatorState === 'ATURDIDO'
      ? 'text-cyan-300'
      : nearestPredatorState === 'HUIR'
      ? 'text-sky-400'
      : 'text-emerald-400';

  const hasActiveAbility = Boolean(stats.activeStatusEffect);
  const abilityReady = stats.abilityCooldownRatio >= 0.99;

  const dietLabel =
    stats.diet === 'omnivore'
      ? 'Omnívoro'
      : stats.diet === 'carnivore'
      ? 'Carnívoro'
      : 'Herbívoro';

  const dietColorClass =
    stats.diet === 'omnivore'
      ? 'text-amber-300'
      : stats.diet === 'carnivore'
      ? 'text-rose-400'
      : 'text-emerald-400';

  const growthStageLabel = isCreatureStage
    ? 'Estadio Criatura Terrestre'
    : stats.growthStage === 3
    ? 'Fase 3/3 · Macrocélula'
    : stats.growthStage === 2
    ? 'Fase 2/3 · Célula Desarrollada'
    : 'Fase 1/3 · Microcélula';

  const growthProgressPct =
    stats.growthStage === 3
      ? 100
      : stats.growthStage === 2
      ? Math.min(100, Math.max(0, ((stats.totalAdnEarned - 60) / (140 - 60)) * 100))
      : Math.min(100, Math.max(0, (stats.totalAdnEarned / 60) * 100));

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2.5">
        {/* Top Status Bar */}
        <header className="pointer-events-auto flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border border-cyan-500/20 bg-[#041524]/92 px-5 py-3.5 shadow-xl">
          {/* Zone 1: Brand Title, Species Name, Diet, Biome & Stage */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-950/80 text-cyan-300">
              <Dna className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
                  {stats.speciesName || 'EvoLife'}
                </h1>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                    isCreatureStage
                      ? 'border-amber-400/50 bg-amber-950/80 text-amber-300'
                      : 'border-cyan-500/30 bg-cyan-950/70 text-cyan-300'
                  }`}
                >
                  {growthStageLabel}
                </span>
              </div>
              <p className="text-xs text-slate-400 whitespace-nowrap">
                Dieta:{' '}
                <span className={`font-semibold ${dietColorClass}`}>
                  {dietLabel}
                </span>
                <span className="mx-1.5">·</span>
                <span>
                  {unlockedCount}/{evolutionSlots.length} Órganos
                </span>
                <span className="mx-1.5">·</span>
                <span className="font-medium text-teal-300">
                  {currentBiomeName}
                </span>
              </p>
            </div>
          </div>

          {/* Zone 2: Vital Telemetry Bars (Vida, Energía, Progreso Evolutivo, ADN) */}
          <div className="flex flex-1 flex-wrap items-center justify-center gap-5 px-2">
            {/* VIDA (Health) */}
            <div className="min-w-[140px] flex-1 max-w-[195px]">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <Activity className="h-3.5 w-3.5 text-rose-400" />
                  Vida
                </span>
                <span className="font-mono font-bold tabular-nums text-white">
                  {Math.ceil(stats.health)} / {stats.maxHealth}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-md bg-slate-900 border border-slate-800">
                <div
                  className={`h-full transition-transform duration-150 origin-left ${
                    healthPct <= 30
                      ? 'bg-rose-500'
                      : healthPct <= 60
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ transform: `scaleX(${healthPct / 100})` }}
                />
              </div>
            </div>

            {/* ENERGÍA (Energy) */}
            <div className="min-w-[140px] flex-1 max-w-[195px]">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <Zap className="h-3.5 w-3.5 text-cyan-400" />
                  Energía
                  {stats.isStarving && (
                    <span className="text-rose-400 font-semibold">
                      · Inanición
                    </span>
                  )}
                </span>
                <span className="font-mono font-bold tabular-nums text-white">
                  {Math.ceil(stats.energy)} / {stats.maxEnergy}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-md bg-slate-900 border border-slate-800">
                <div
                  className={`h-full transition-transform duration-150 origin-left ${
                    energyPct <= 20
                      ? 'bg-amber-500'
                      : stats.isBoosting
                      ? 'bg-sky-300'
                      : 'bg-cyan-400'
                  }`}
                  style={{ transform: `scaleX(${energyPct / 100})` }}
                />
              </div>
            </div>

            {/* CRECIMIENTO EVOLUTIVO */}
            <div className="min-w-[145px] flex-1 max-w-[195px]">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-200 whitespace-nowrap">
                  {isCreatureStage ? 'Adaptación Terrestre' : 'Crecimiento'}
                </span>
                <span className="font-mono font-bold tabular-nums text-amber-300">
                  {isCreatureStage
                    ? '4 Patas Activas'
                    : stats.growthStage === 3
                    ? 'MÁX (1.62x)'
                    : `${stats.totalAdnEarned} / ${stats.nextStageAdnThreshold} ADN`}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-md bg-slate-900 border border-slate-800">
                <div
                  className="h-full bg-amber-400 transition-transform duration-200 origin-left"
                  style={{ transform: `scaleX(${growthProgressPct / 100})` }}
                />
              </div>
            </div>

            {/* ADN (Genetic Points) */}
            <div className="flex items-center gap-4 border-l border-slate-800 pl-4 shrink-0">
              <div>
                <div className="text-xs font-medium text-slate-400">
                  Puntos de ADN
                </div>
                <div className="font-mono text-xl font-bold tabular-nums text-amber-300">
                  {stats.adn}{' '}
                  <span className="text-xs font-normal text-amber-200/80">
                    ADN
                  </span>
                </div>
              </div>

              <div className="hidden 2xl:block text-xs text-slate-400">
                <div>
                  Nutrientes:{' '}
                  <span className="font-mono font-semibold text-slate-200 tabular-nums">
                    {stats.foodEaten}
                  </span>
                </div>
                <div>
                  Tiempo:{' '}
                  <span className="font-mono font-semibold text-slate-200 tabular-nums">
                    {formatTime(stats.survivalTime)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Zone 3: Llamar Pareja / Evolucionar (E), Pause & Quick Restart Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleEditor}
              className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                availableUpgradesCount > 0
                  ? 'border-amber-300 bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'border-pink-400/40 bg-pink-950/60 text-pink-200 hover:bg-pink-900/70'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                Editor 3D / Evolucionar (E)
                {availableUpgradesCount > 0 ? ` · ${availableUpgradesCount}` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={onRestart}
              title="Reiniciar partida"
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reiniciar</span>
            </button>

            <button
              type="button"
              onClick={onTogglePause}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>Pausa (Esc)</span>
            </button>
          </div>
        </header>

        {/* Compact Active Evolutionary Quest Card & Biome Indicator */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cyan-500/20 bg-[#041524]/88 px-4 py-2 text-xs shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                isCreatureStage
                  ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                  : readyForLandTransition
                  ? 'border-amber-400/50 bg-amber-500/20 text-amber-300'
                  : 'border-cyan-500/30 bg-cyan-950/80 text-cyan-300'
              }`}
            >
              {isCreatureStage
                ? 'Costa Terrestre'
                : readyForLandTransition
                ? 'Transición Terrestre Lista'
                : 'Misión Evolutiva'}
            </span>
            <span className="font-semibold text-white">{activeQuestTitle}:</span>
            <span className="text-slate-300">{activeQuestProgressText}</span>
          </div>

          <div className="flex items-center gap-3">
            {readyForLandTransition && !isCreatureStage && (
              <button
                type="button"
                onClick={onEvolveToCreatureStage}
                className="flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
              >
                <Footprints className="h-3.5 w-3.5" />
                <span>Evolucionar a Criatura Terrestre</span>
              </button>
            )}
            <div className="flex items-center gap-2 text-slate-400">
              <span>Entorno:</span>
              <span className="font-semibold text-teal-300">
                {currentBiomeName}
              </span>
              {currentBiomeName === 'Fosa Hidrotermal' && (
                <span className="text-cyan-300 font-medium">
                  (Fumarolas +3 Energía/s)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Subtle Event Banner / Starvation Alert */}
        <div className="mx-auto flex flex-col items-center gap-2">
          {stats.isStarving && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/90 px-4 py-1.5 text-xs font-semibold text-rose-200 shadow-lg">
              Energía agotada: Tu organismo pierde vida gradualmente. Consume nutrientes o descansa en el Nido.
            </div>
          )}
          {recentEventMessage && !stats.isStarving && (
            <div className="rounded-lg border border-cyan-500/30 bg-[#041524]/90 px-4 py-1.5 text-xs font-medium text-cyan-200 shadow-md">
              {recentEventMessage}
            </div>
          )}
        </div>
      </div>

      {/* Unified Collapsible Bottom Control Dock */}
      <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((prev) => !prev)}
          className="mb-1.5 flex items-center gap-1.5 rounded-t-lg border border-b-0 border-cyan-500/20 bg-[#041524]/90 px-3.5 py-1 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5 text-cyan-400" />
              <span>Mostrar controles y sensor</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 text-cyan-400" />
              <span>Ocultar panel inferior</span>
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border border-cyan-500/20 bg-[#041524]/92 px-5 py-3 shadow-2xl">
            {/* Keyboard & Interactive Movement Pad */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onPointerDown={() => onControlInput('left', true)}
                  onPointerUp={() => onControlInput('left', false)}
                  onPointerLeave={() => onControlInput('left', false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 font-mono text-xs font-bold text-slate-200 hover:border-cyan-400 active:bg-cyan-500 active:text-slate-950 cursor-pointer"
                >
                  A
                </button>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onPointerDown={() => onControlInput('forward', true)}
                    onPointerUp={() => onControlInput('forward', false)}
                    onPointerLeave={() => onControlInput('forward', false)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 font-mono text-xs font-bold text-slate-200 hover:border-cyan-400 active:bg-cyan-500 active:text-slate-950 cursor-pointer"
                  >
                    W
                  </button>
                  <button
                    type="button"
                    onPointerDown={() => onControlInput('backward', true)}
                    onPointerUp={() => onControlInput('backward', false)}
                    onPointerLeave={() => onControlInput('backward', false)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 font-mono text-xs font-bold text-slate-200 hover:border-cyan-400 active:bg-cyan-500 active:text-slate-950 cursor-pointer"
                  >
                    S
                  </button>
                </div>
                <button
                  type="button"
                  onPointerDown={() => onControlInput('right', true)}
                  onPointerUp={() => onControlInput('right', false)}
                  onPointerLeave={() => onControlInput('right', false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 font-mono text-xs font-bold text-slate-200 hover:border-cyan-400 active:bg-cyan-500 active:text-slate-950 cursor-pointer"
                >
                  D
                </button>
              </div>

              <button
                type="button"
                onPointerDown={() => onControlInput('boost', true)}
                onPointerUp={() => onControlInput('boost', false)}
                onPointerLeave={() => onControlInput('boost', false)}
                className={`rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  stats.isBoosting
                    ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                    : 'border-cyan-500/40 bg-cyan-950/70 text-cyan-200 hover:bg-cyan-900/80'
                }`}
              >
                ESPACIO · Impulso
              </button>

              {/* Q · Active Cellular Weapon Button */}
              <button
                type="button"
                onPointerDown={() => onControlInput('ability', true)}
                onPointerUp={() => onControlInput('ability', false)}
                onPointerLeave={() => onControlInput('ability', false)}
                className={`relative overflow-hidden rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  !hasActiveAbility
                    ? 'border-slate-700 bg-slate-900/80 text-slate-400 hover:border-slate-600'
                    : abilityReady
                    ? 'border-lime-400/60 bg-lime-950/70 text-lime-200 hover:bg-lime-900/80'
                    : 'border-cyan-500/30 bg-slate-900 text-cyan-300'
                }`}
              >
                {hasActiveAbility && !abilityReady && (
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 bg-cyan-500/25 transition-all duration-100"
                    style={{
                      width: `${Math.round(stats.abilityCooldownRatio * 100)}%`,
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  <span>
                    Q · {stats.activeStatusEffect ?? 'Habilidad'}
                    {hasActiveAbility && !abilityReady
                      ? ` (${Math.round(stats.abilityCooldownRatio * 100)}%)`
                      : ''}
                  </span>
                </span>
              </button>

              {/* C · Terrestrial Creature Stage Socialize Button */}
              {isCreatureStage && (
                <button
                  type="button"
                  onPointerDown={() => onControlInput('socialize', true)}
                  onPointerUp={() => onControlInput('socialize', false)}
                  onPointerLeave={() => onControlInput('socialize', false)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-400/60 bg-amber-950/75 px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <HeartHandshake className="h-3.5 w-3.5 text-amber-300" />
                  <span>C · Socializar (+20 ADN)</span>
                </button>
              )}
            </div>

            {/* Control Instructions */}
            <div className="hidden lg:flex items-center gap-2.5 text-xs text-slate-400">
              <span>WASD: Mover</span>
              <span aria-hidden="true">·</span>
              <span>Espacio: Impulso</span>
              <span aria-hidden="true">·</span>
              <span>Q: Habilidad</span>
              {isCreatureStage && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300 font-medium">
                    C: Socializar
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>E: Editor 3D</span>
            </div>

            {/* Ecosystem Species Sensor Readout */}
            <div className="flex items-center gap-2.5 border-l border-slate-800 pl-4 text-xs">
              <ShieldAlert className={`h-4 w-4 ${threatColorClass}`} />
              <div>
                <div className="text-slate-400 font-medium">
                  {nearestSpeciesName}
                </div>
                <div className="font-mono font-semibold tabular-nums">
                  <span className={threatColorClass}>{nearestPredatorState}</span>
                  <span className="text-slate-500"> · </span>
                  <span className="text-slate-200">
                    {Number.isFinite(nearestPredatorDistance)
                      ? `${nearestPredatorDistance.toFixed(1)}m`
                      : '--'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
