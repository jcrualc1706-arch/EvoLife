import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TutorialStep } from '../game/types';

interface TutorialOverlayProps {
  step: TutorialStep;
  isActive: boolean;
  onAdvanceFromVitals: () => void;
  onSkipTutorial: () => void;
}

export const InteractiveTutorialOverlay: React.FC<TutorialOverlayProps> = ({
  step,
  isActive,
  onAdvanceFromVitals,
  onSkipTutorial,
}) => {
  if (!isActive || step === 'completed') return null;

  return (
    <div className="fixed inset-0 z-30 pointer-events-none select-none">
      {/* Foco dinámico (Spotlight Overlay sutil) sobre la zona del HUD explicada */}
      {step === 'vital_signs' && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-500"
          style={{
            background:
              'radial-gradient(circle 190px at calc(100% - 6.5rem) 2.25rem, transparent 0%, rgba(2, 6, 23, 0.55) 100%)',
          }}
          aria-hidden="true"
        />
      )}
      {step === 'evolve_key' && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-500"
          style={{
            background:
              'radial-gradient(circle 190px at 7.5rem 2.25rem, transparent 0%, rgba(2, 6, 23, 0.55) 100%)',
          }}
          aria-hidden="true"
        />
      )}

      <AnimatePresence mode="wait">
        {step === 'movement' && (
          <motion.div
            key="step_move"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-cyan-500/40 px-6 py-4 rounded-2xl backdrop-blur-md shadow-[0_0_30px_rgba(34,211,238,0.25)] text-center text-white"
          >
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-mono mb-1">
              Primeros Impulsos
            </div>
            <div className="text-base font-semibold">
              Usa{' '}
              <span className="bg-cyan-500/20 px-2 py-0.5 rounded text-cyan-300 font-bold border border-cyan-500/40">
                W
              </span>{' '}
              o mantén el{' '}
              <span className="text-emerald-300 font-bold">Clic Izquierdo</span>{' '}
              para nadar y virar
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Prueba a moverte por el caldo para adaptarte al medio
            </div>
          </motion.div>
        )}

        {step === 'camera' && (
          <motion.div
            key="step_cam"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-cyan-500/40 px-6 py-4 rounded-2xl backdrop-blur-md shadow-[0_0_30px_rgba(34,211,238,0.25)] text-center text-white"
          >
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-mono mb-1">
              Percepción Espacial
            </div>
            <div className="text-base font-semibold">
              Gira la{' '}
              <span className="bg-cyan-500/20 px-2 py-0.5 rounded text-cyan-300 font-bold border border-cyan-500/40">
                Rueda del Ratón
              </span>{' '}
              para alejar o acercar el zoom de cámara
            </div>
          </motion.div>
        )}

        {step === 'vital_signs' && (
          <motion.div
            key="step_vitals"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-16 right-6 pointer-events-auto bg-slate-900/95 border border-emerald-500/50 p-4 rounded-2xl backdrop-blur-md shadow-2xl max-w-xs text-white"
          >
            <div className="text-xs uppercase tracking-widest text-emerald-400 font-mono mb-1">
              Indicadores Biológicos
            </div>
            <div className="text-sm text-slate-200 mb-2">
              Arriba a la derecha tienes tu{' '}
              <span className="text-emerald-300 font-bold">Vitalidad</span>{' '}
              (verde) y tu{' '}
              <span className="text-amber-300 font-bold">
                Energía de propulsión
              </span>{' '}
              (amarillo). Si tu salud llega a cero, tu linaje se extinguirá.
            </div>
            <button
              type="button"
              onClick={onAdvanceFromVitals}
              className="w-full py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl border border-emerald-500/40 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Entendido →
            </button>
          </motion.div>
        )}

        {step === 'feed_first_time' && (
          <motion.div
            key="step_feed"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-cyan-500/40 px-6 py-4 rounded-2xl backdrop-blur-md shadow-[0_0_30px_rgba(34,211,238,0.25)] text-center text-white"
          >
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-mono mb-1">
              Supervivencia Trófica
            </div>
            <div className="text-base font-semibold">
              Localiza y absorbe una partícula de{' '}
              <span className="text-emerald-300 font-bold">Plancton</span> o
              caza restos celulares
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Alimentarte restaura tu vitalidad y sintetiza nuevo ADN
            </div>
          </motion.div>
        )}

        {step === 'evolve_key' && (
          <motion.div
            key="step_evolve"
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 left-6 pointer-events-auto bg-slate-900/95 border border-purple-500/50 p-4 rounded-2xl backdrop-blur-md shadow-2xl max-w-xs text-white"
          >
            <div className="text-xs uppercase tracking-widest text-purple-400 font-mono mb-1">
              Mutación y Taller
            </div>
            <div className="text-sm text-slate-200 mb-2">
              Junto a tu nombre acumulas tu reserva de{' '}
              <span className="text-amber-300 font-bold">ADN</span>. Pulsa{' '}
              <span className="bg-purple-500/30 px-2 py-0.5 rounded text-purple-300 font-bold border border-purple-500/40">
                E
              </span>{' '}
              en cualquier momento para acoplar flagelos, ojos o espinas en el
              editor.
            </div>
            <button
              type="button"
              onClick={() => onSkipTutorial()}
              className="w-full py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-xl border border-purple-500/40 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Comenzar Vida Primordial
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
