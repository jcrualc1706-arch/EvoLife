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
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#09131f] p-6 sm:p-8 shadow-2xl">
        <div className="mb-5 flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-950 text-rose-400">
            <Skull className="h-6 w-6" />
          </div>
          <div>
            <h2
              id="death-modal-title"
              className="font-display text-2xl font-bold text-white"
            >
              Has Muerto
            </h2>
            <p className="text-xs text-rose-300/90">
              Tu organismo celular no logró sobrevivir al ecosistema abisal
            </p>
          </div>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-slate-300">
          {stats.energy <= 0
            ? 'El agotamiento total de energía provocó un colapso metabólico antes de encontrar suficientes nutrientes.'
            : 'Los microorganismos depredadores destruyeron la membrana celular.'}
        </p>

        {/* Final Run Telemetry */}
        <div className="mb-6 grid grid-cols-3 gap-3 rounded-xl border border-slate-800 bg-slate-900/90 p-4 text-center">
          <div>
            <div className="text-xs text-slate-400">ADN Obtenido</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-amber-300">
              {stats.adn}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Alimentos</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-400">
              {stats.foodEaten}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Supervivencia</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-cyan-300">
              {Math.floor(stats.survivalTime)}s
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 px-6 py-3.5 text-sm font-bold text-white hover:bg-rose-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Reiniciar</span>
        </button>
      </div>
    </div>
  );
};
