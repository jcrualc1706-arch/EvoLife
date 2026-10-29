import React from 'react';
import { RotateCcw, Skull } from 'lucide-react';
import { PlayerStats } from '../game/types';

interface DeathModalProps {
  stats: PlayerStats;
  onRestart: () => void;
}

export const DeathModal: React.FC<DeathModalProps> = ({ stats, onRestart }) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="death-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#021019]/70 backdrop-blur-xl p-4"
    >
      <div className="w-full max-w-md rounded-[32px] border border-cyan-300/30 border-t-rose-300/50 bg-gradient-to-b from-cyan-950/75 via-[#041a29]/85 to-teal-950/80 p-6 sm:p-7 backdrop-blur-xl shadow-[0_8px_32px_rgba(4,25,41,0.6),0_0_24px_rgba(244,63,94,0.22),inset_0_1px_2px_rgba(254,205,211,0.25)]">
        <div className="mb-4 flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-rose-300/60 bg-gradient-to-b from-rose-400/35 to-rose-900/50 text-rose-200 shadow-[0_0_16px_rgba(244,63,94,0.4)]">
            <Skull className="h-6 w-6" />
          </div>
          <div>
            <h2
              id="death-modal-title"
              className="font-display text-xl font-extrabold text-white"
            >
              Ciclo Vital Interrumpido
            </h2>
            <p className="text-xs font-semibold text-rose-200">
              {stats.speciesName || 'Tu organismo'} se reintegró al caldo primigenio
            </p>
          </div>
        </div>

        <p className="mb-5 rounded-2xl border border-cyan-300/20 bg-cyan-950/35 p-3.5 text-xs leading-relaxed text-cyan-100/90">
          {stats.energy <= 0
            ? 'El agotamiento total de bioenergía provocó un colapso metabólico antes de hallar suficientes nutrientes.'
            : 'Los depredadores del ecosistema abisal superaron la membrana defensiva de tu especie.'}
        </p>

        {/* Final Run Organic Telemetry */}
        <div className="mb-6 grid grid-cols-3 gap-2.5 rounded-3xl border border-cyan-300/25 border-t-cyan-200/40 bg-[#031521]/65 p-3.5 text-center shadow-inner">
          <div className="rounded-2xl bg-amber-500/15 px-2 py-1.5 border border-amber-300/30">
            <div className="text-[11px] font-semibold text-amber-200/85">
              ADN Total
            </div>
            <div className="mt-1 font-mono text-lg font-extrabold tabular-nums text-amber-300">
              {stats.totalAdnEarned}
            </div>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 px-2 py-1.5 border border-emerald-400/20">
            <div className="text-[11px] font-semibold text-emerald-200/80">
              Nutrientes
            </div>
            <div className="mt-1 font-mono text-lg font-extrabold tabular-nums text-emerald-300">
              {stats.foodEaten}
            </div>
          </div>
          <div className="rounded-2xl bg-cyan-500/10 px-2 py-1.5 border border-cyan-400/20">
            <div className="text-[11px] font-semibold text-cyan-200/80">
              Supervivencia
            </div>
            <div className="mt-1 font-mono text-lg font-extrabold tabular-nums text-cyan-300">
              {Math.floor(stats.survivalTime)} s
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-6 py-3.5 text-xs font-extrabold text-slate-950 shadow-[0_4px_16px_rgba(251,191,36,0.45),inset_0_1px_2px_rgba(255,255,255,0.75)] cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-95 transition-all duration-150"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Incubar Nueva Generación</span>
        </button>
      </div>
    </div>
  );
};
