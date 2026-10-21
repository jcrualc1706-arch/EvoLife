import React, { useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Dna,
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
  onRestart: () => void;
  onControlInput: (key: keyof InputState, active: boolean) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  snapshot,
  onTogglePause,
  onToggleEditor,
  onRestart,
  onControlInput,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const {
    stats,
    nearestPredatorState,
    nearestPredatorDistance,
    recentEventMessage,
    evolutionSlots,
  } = snapshot;

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
      : 'text-emerald-400';

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Status Bar: Brand + Core Vital Bars (Vida, Energía, ADN) + Evolucionar & Pause Actions */}
      <header className="pointer-events-auto mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 rounded-xl border border-cyan-500/20 bg-[#041524]/92 px-5 py-3.5 shadow-xl">
        {/* Zone 1: Brand Title & Stage */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-950/80 text-cyan-300">
            <Dna className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
              EvoLife
            </h1>
            <p className="text-xs text-slate-400 whitespace-nowrap">
              Fase Celular · {unlockedCount}/{evolutionSlots.length} Órganos
            </p>
          </div>
        </div>

        {/* Zone 2: Vital Telemetry Bars (Vida, Energía, ADN) */}
        <div className="flex flex-1 flex-wrap items-center justify-center gap-6 px-2">
          {/* VIDA (Health) */}
          <div className="min-w-[155px] flex-1 max-w-[220px]">
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
          <div className="min-w-[155px] flex-1 max-w-[220px]">
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

          {/* ADN (Genetic Points) */}
          <div className="flex items-center gap-5 border-l border-slate-800 pl-5 shrink-0">
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

            <div className="hidden xl:block text-xs text-slate-400">
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

        {/* Zone 3: Evolucionar (E), Pause & Quick Restart Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleEditor}
            className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              availableUpgradesCount > 0
                ? 'border-amber-300 bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'border-amber-500/40 bg-amber-950/60 text-amber-200 hover:bg-amber-900/70'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              Evolucionar (E)
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

      {/* Subtle Event Banner / Starvation Alert */}
      <div className="mx-auto flex flex-col items-center gap-2">
        {stats.isStarving && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/90 px-4 py-1.5 text-xs font-semibold text-rose-200 shadow-lg">
            Energía agotada: Tu célula pierde vida gradualmente. Consume nutrientes verdes o dorados.
          </div>
        )}
        {recentEventMessage && !stats.isStarving && (
          <div className="rounded-lg border border-cyan-500/30 bg-[#041524]/90 px-4 py-1.5 text-xs font-medium text-cyan-200 shadow-md">
            {recentEventMessage}
          </div>
        )}
      </div>

      {/* Unified Collapsible Bottom Control Dock */}
      <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col items-center">
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
            <div className="flex items-center gap-4">
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
                className={`rounded-lg border px-4 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  stats.isBoosting
                    ? 'border-cyan-300 bg-cyan-400 text-slate-950'
                    : 'border-cyan-500/40 bg-cyan-950/70 text-cyan-200 hover:bg-cyan-900/80'
                }`}
              >
                ESPACIO · Impulso Flagelar
              </button>
            </div>

            {/* Control Instructions */}
            <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
              <span>WASD: Mover</span>
              <span aria-hidden="true">·</span>
              <span>Espacio: Impulso</span>
              <span aria-hidden="true">·</span>
              <span>E: Evolucionar</span>
              <span aria-hidden="true">·</span>
              <span>Esc: Pausa</span>
            </div>

            {/* Predator Sensor Readout */}
            <div className="flex items-center gap-2.5 border-l border-slate-800 pl-4 text-xs">
              <ShieldAlert className={`h-4 w-4 ${threatColorClass}`} />
              <div>
                <div className="text-slate-400">Depredador más cercano</div>
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
