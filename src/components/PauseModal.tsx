import React from 'react';
import { Dna, Home, Play, RotateCcw, Settings } from 'lucide-react';
import { PlayerStats } from '../game/types';

interface PauseModalProps {
  stats: PlayerStats;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onExitToMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  stats,
  onResume,
  onRestart,
  onOpenSettings,
  onExitToMenu,
}) => {
  const isCreatureStage = stats.evolutionaryStage === 'creature_stage';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#021019]/65 backdrop-blur-xl p-4"
    >
      <div className="relative w-full max-w-md rounded-[32px] border border-cyan-300/35 border-t-cyan-200/60 bg-gradient-to-b from-cyan-950/75 via-[#041a29]/85 to-teal-950/80 p-6 sm:p-7 backdrop-blur-xl shadow-[0_8px_32px_rgba(4,25,41,0.6),0_0_24px_rgba(34,211,238,0.2),inset_0_1px_2px_rgba(165,243,252,0.3)]">
        <div className="mb-5 flex items-center gap-3.5">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${
              isCreatureStage
                ? 'border-amber-200/70 bg-gradient-to-b from-amber-300/35 to-amber-700/40 text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.35)]'
                : 'border-cyan-200/70 bg-gradient-to-b from-cyan-300/35 to-teal-700/40 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.35)]'
            }`}
          >
            <Dna className="h-6 w-6" />
          </div>
          <div>
            <h2
              id="pause-modal-title"
              className="font-display text-xl font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
            >
              Letargo Biológico
            </h2>
            <p className="text-xs font-medium text-cyan-200/85">
              {stats.speciesName || 'Organismo Primigenio'} · Genoma preservado
            </p>
          </div>
        </div>

        {/* Current Session Organic Receptacles */}
        <div className="mb-5 grid grid-cols-3 gap-2.5 rounded-3xl border border-cyan-300/25 border-t-cyan-200/40 bg-[#031521]/65 p-3.5 text-center shadow-inner">
          <div className="rounded-2xl bg-emerald-500/10 px-2 py-1.5 border border-emerald-400/20">
            <div className="text-[11px] font-semibold text-emerald-200/80">
              Vitalidad
            </div>
            <div className="mt-0.5 font-mono text-base font-extrabold tabular-nums text-emerald-300">
              {Math.ceil(stats.health)}/{stats.maxHealth}
            </div>
          </div>
          <div className="rounded-2xl bg-cyan-500/10 px-2 py-1.5 border border-cyan-400/20">
            <div className="text-[11px] font-semibold text-cyan-200/80">
              Bioenergía
            </div>
            <div className="mt-0.5 font-mono text-base font-extrabold tabular-nums text-cyan-300">
              {Math.ceil(stats.energy)}/{stats.maxEnergy}
            </div>
          </div>
          <div className="rounded-2xl bg-amber-500/15 px-2 py-1.5 border border-amber-300/30">
            <div className="text-[11px] font-semibold text-amber-200/85">
              Ámbar ADN
            </div>
            <div className="mt-0.5 font-mono text-base font-extrabold tabular-nums text-amber-300">
              {stats.adn}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-cyan-300/20 bg-cyan-950/35 p-4 space-y-1.5 text-xs text-cyan-100/90">
          <p className="font-display font-bold text-white">
            Instintos y Controles Orgánicos:
          </p>
          <p>· WASD: Nado ondulante y giro celular</p>
          <p>· Espacio: Impulso de propulsión o Planeo con Alas</p>
          <p>· Q: Descarga de órgano activo (Veneno, Bioeléctrico, Fotóforo)</p>
          <p>· E: Taller Evolutivo 3D · C: Canto Social · Esc: Pausa</p>
        </div>

        <div className="space-y-2.5">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={onResume}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-5 py-3 text-xs font-extrabold text-slate-950 shadow-[0_4px_14px_rgba(251,191,36,0.4),inset_0_1px_2px_rgba(255,255,255,0.75)] cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-95 transition-all duration-150"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Reanudar Vida</span>
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-cyan-400/40 border-t-cyan-200/60 bg-cyan-500/20 hover:bg-cyan-500/35 px-5 py-3 text-xs font-bold text-cyan-100 shadow-[0_2px_10px_rgba(34,211,238,0.2)] cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-95 transition-all duration-150"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Nueva Generación</span>
            </button>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-cyan-300/35 bg-[#031521]/75 hover:bg-cyan-950/75 px-5 py-2.5 text-xs font-bold text-cyan-100 cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-95 transition-all duration-150"
            >
              <Settings className="h-4 w-4 text-cyan-300" />
              <span>Ajustes</span>
            </button>
            <button
              type="button"
              onClick={onExitToMenu}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-cyan-300/35 bg-[#031521]/75 hover:bg-cyan-950/75 px-5 py-2.5 text-xs font-bold text-cyan-100 cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-95 transition-all duration-150"
            >
              <Home className="h-4 w-4 text-amber-300" />
              <span>Salir al Menú Principal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
