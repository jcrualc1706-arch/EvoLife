import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { StageEvolutionHistory } from '../game/types';

interface SummaryProps {
  history: StageEvolutionHistory;
  onProceedToLand: () => void;
}

export const StageEvolutionSummaryModal: React.FC<SummaryProps> = ({
  history,
  onProceedToLand,
}) => {
  const [displayedMa, setDisplayedMa] = useState(3800);

  // Animación del contador de millones de años transcurridos
  useEffect(() => {
    const duration = 2400; // ms
    const startMa = 3800;
    const endMa = 530;
    const startTime = performance.now();
    let rafId = 0;

    const frame = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      // Interpolación exponencial que desacelera hacia el Cámbrico
      const current = Math.round(
        startMa - Math.pow(progress, 0.7) * (startMa - endMa)
      );
      setDisplayedMa(current);
      if (progress < 1) {
        rafId = requestAnimationFrame(frame);
      }
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const formatMinutes = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const traitLabel =
    history.earnedTrait === 'carnivore'
      ? 'Carnívoro · Depredador'
      : history.earnedTrait === 'herbivore'
      ? 'Herbívoro · Social'
      : 'Omnívoro · Adaptable';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md text-white select-none p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
      >
        {/* Cabecera geológica */}
        <div className="text-center space-y-1 mb-6 border-b border-cyan-900/40 pb-4">
          <span className="text-xs tracking-widest text-cyan-400 font-mono uppercase">
            Registro Fósil y Selección Natural
          </span>
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-emerald-300 to-teal-200">
            FIN DE LA ETAPA PRIMIGENIA
          </h2>
          <div className="text-sm text-cyan-200/80 font-mono">
            Tiempo Geológico:{' '}
            <span className="text-amber-400 font-bold text-lg">
              {displayedMa} Ma
            </span>{' '}
            (Época Cámbrica)
          </div>
          {/* Barra visual de progresión geológica */}
          <div className="mx-auto mt-2 h-1.5 max-w-md overflow-hidden rounded-full bg-slate-950/90 border border-cyan-500/25">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 transition-all duration-75"
              style={{
                width: `${Math.max(
                  4,
                  Math.min(100, ((3800 - displayedMa) / (3800 - 530)) * 100)
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Cuerpo del resumen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Snapshot / Preview de la Célula */}
          <div className="flex flex-col items-center justify-center bg-slate-950/60 rounded-2xl p-4 border border-cyan-500/20 aspect-video relative overflow-hidden">
            {history.finalCellSnapshotUrl ? (
              <img
                src={history.finalCellSnapshotUrl}
                alt="Forma Celular Final"
                className="w-full h-full object-contain filter drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]"
              />
            ) : (
              <div className="text-cyan-400/50 text-sm italic">
                Organismo Primordial Registrado
              </div>
            )}
            <div className="absolute bottom-2 left-3 bg-black/60 px-3 py-1 rounded-full text-xs text-cyan-300 border border-cyan-500/30 font-mono">
              Morfología Celular Definitiva
            </div>
          </div>

          {/* Estadísticas de la etapa */}
          <div className="space-y-3 font-mono text-sm">
            <div className="flex justify-between bg-slate-800/50 p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-400">Tiempo de Supervivencia:</span>
              <span className="text-cyan-300 font-bold">
                {formatMinutes(history.stageTimeSeconds)}
              </span>
            </div>
            <div className="flex justify-between bg-slate-800/50 p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-400">Microbios Cazados:</span>
              <span className="text-red-400 font-bold">
                {history.microbesKilled}
              </span>
            </div>
            <div className="flex justify-between bg-slate-800/50 p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-400">Biomasa Vegetal Absorbida:</span>
              <span className="text-emerald-400 font-bold">
                {history.plantsEaten}
              </span>
            </div>
            <div className="flex justify-between bg-slate-800/50 p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-400">Adaptaciones Catalogadas:</span>
              <span className="text-amber-300 font-bold">
                {history.partsDiscoveredCount}
              </span>
            </div>
            <div className="flex justify-between bg-slate-800/50 p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-400">Mutaciones en el Taller:</span>
              <span className="text-purple-300 font-bold">
                {history.editorVisitsCount}
              </span>
            </div>

            {/* Veredicto de Dieta y Rasgo */}
            <div className="mt-4 p-3 rounded-xl bg-gradient-to-r from-cyan-950/40 to-slate-800/60 border border-cyan-500/40 flex items-center justify-between">
              <div>
                <div className="text-xs text-cyan-400 uppercase tracking-wider">
                  Rasgo Evolutivo Heredado
                </div>
                <div className="text-lg font-bold text-white capitalize">
                  {traitLabel}
                </div>
              </div>
              <div className="text-2xl">
                {history.earnedTrait === 'carnivore'
                  ? '🥩'
                  : history.earnedTrait === 'herbivore'
                  ? '🌿'
                  : '🧬'}
              </div>
            </div>
          </div>
        </div>

        {/* Botón de transición */}
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={onProceedToLand}
            className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-2xl shadow-[0_0_25px_rgba(20,184,166,0.5)] transition-all duration-200 transform hover:scale-105 active:scale-95 text-base tracking-wide uppercase cursor-pointer"
          >
            Dar los Primeros Pasos en Tierra Firme →
          </button>
        </div>
      </motion.div>
    </div>
  );
};
