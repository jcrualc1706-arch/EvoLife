import React from 'react';
import { Dna, Play, RotateCcw } from 'lucide-react';
import { PlayerStats } from '../game/types';

interface PauseModalProps {
  stats: PlayerStats;
  onResume: () => void;
  onRestart: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  stats,
  onResume,
  onRestart,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4"
    >
      <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-[#051829] p-6 sm:p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-950 text-cyan-300">
            <Dna className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="pause-modal-title"
              className="font-display text-2xl font-bold text-white"
            >
              Juego en Pausa
            </h2>
            <p className="text-xs text-slate-400">
              Simulación biológica detenida temporalmente
            </p>
          </div>
        </div>

        {/* Current Session Summary */}
        <div className="mb-6 grid grid-cols-3 gap-3 rounded-xl border border-slate-800 bg-slate-900/90 p-4 text-center">
          <div>
            <div className="text-xs text-slate-400">Vida</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-400">
              {Math.ceil(stats.health)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Energía</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-cyan-400">
              {Math.ceil(stats.energy)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">ADN</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-amber-300">
              {stats.adn}
            </div>
          </div>
        </div>

        <div className="mb-6 space-y-2 text-xs text-slate-300">
          <p className="font-semibold text-slate-200">Controles de la Fase Celular:</p>
          <p>· W / S: Avanzar y retroceder en el medio acuático</p>
          <p>· A / D: Girar la orientación del organismo</p>
          <p>· Espacio: Impulso rápido (consume energía adicional)</p>
          <p>· Escape: Alternar menú de pausa</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onResume}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Continuar</span>
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reiniciar partida</span>
          </button>
        </div>
      </div>
    </div>
  );
};
