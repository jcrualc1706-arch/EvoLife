import React, { useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Dna,
  HelpCircle,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayerStats } from '../game/types';

interface MainMenuModalProps {
  hasSavedGame: boolean;
  stats: PlayerStats;
  onContinueGame: () => void;
  onStartNewGame: () => void;
  onOpenSettings: () => void;
}

export const MainMenuModal: React.FC<MainMenuModalProps> = ({
  hasSavedGame,
  stats,
  onContinueGame,
  onStartNewGame,
  onOpenSettings,
}) => {
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [showQuickControls, setShowQuickControls] = useState(false);

  const isCreatureStage = stats.evolutionaryStage === 'creature_stage';
  const stageBadgeLabel = isCreatureStage
    ? 'Estadio de Criatura Terrestre'
    : `Estadio Celular · Etapa ${stats.growthStage}/5`;

  const handleNewGameClick = () => {
    if (hasSavedGame && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    setConfirmOverwrite(false);
    onStartNewGame();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="main-menu-title"
      className="fixed inset-0 z-30 flex items-center justify-center p-4 sm:p-6 pointer-events-auto"
    >
      {/* Subtle Ambient Bioluminescent Vignette */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#021019]/55 via-[#031521]/35 to-[#021019]/70 backdrop-blur-[3px]"
        aria-hidden="true"
      />

      {/* Organic Spore Central Capsule Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="relative z-10 w-full max-w-lg rounded-[36px] border border-cyan-300/35 border-t-cyan-200/65 bg-gradient-to-b from-cyan-950/80 via-[#041a29]/88 to-teal-950/85 p-6 sm:p-8 backdrop-blur-xl shadow-[0_12px_42px_rgba(3,18,30,0.75),0_0_32px_rgba(34,211,238,0.22),inset_0_1px_2px_rgba(165,243,252,0.35)]"
      >
        {/* Top Ambient Specular Highlight */}
        <div
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent"
          aria-hidden="true"
        />

        {/* Identity Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-500/15 px-3.5 py-1 text-[11px] font-bold tracking-wide text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.2)] mb-3">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>ECOSISTEMA BIOLUMINISCENTE · v2.5</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="flex h-13 w-13 items-center justify-center rounded-full border border-cyan-200/70 bg-gradient-to-b from-cyan-300/35 via-teal-500/30 to-teal-800/50 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.45),inset_0_1px_2px_rgba(255,255,255,0.5)]">
              <Dna className="h-7 w-7 text-cyan-200" />
            </div>
            <h1
              id="main-menu-title"
              className="font-display text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-100 via-teal-200 to-amber-200 drop-shadow-[0_2px_10px_rgba(34,211,238,0.35)]"
            >
              EvoLife
            </h1>
          </div>

          <p className="mt-2 text-xs sm:text-sm font-medium text-cyan-100/85">
            Simulador de Evolución Celular y Terrestre
          </p>
        </div>

        {/* Saved Game Summary & Continue Button (Only when hasSavedGame is true) */}
        {hasSavedGame && (
          <div className="mb-5 rounded-3xl border border-cyan-300/35 border-t-cyan-200/55 bg-gradient-to-b from-cyan-900/45 to-[#031521]/75 p-4 shadow-[inset_0_1px_2px_rgba(165,243,252,0.2)]">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Genoma en Letargo Detectado</span>
                </div>
                <div className="truncate font-display text-base sm:text-lg font-extrabold text-white mt-0.5">
                  {stats.speciesName || 'Organismo Primigenio'}
                </div>
                <div className="text-xs text-cyan-200/85 flex items-center gap-1.5 mt-0.5">
                  <Compass className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                  <span>{stageBadgeLabel}</span>
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-amber-300/40 bg-amber-500/15 px-3.5 py-2 text-right shadow-[0_0_14px_rgba(245,158,11,0.2)]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-200/85">
                  Reserva ADN
                </div>
                <div className="font-mono text-lg font-black tabular-nums text-amber-300">
                  {stats.adn} <span className="text-xs font-bold">ADN</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onContinueGame}
              className="w-full flex items-center justify-center gap-2.5 rounded-full border border-amber-100/85 bg-gradient-to-r from-cyan-300 via-teal-300 to-amber-300 px-6 py-3.5 text-sm font-extrabold text-slate-950 shadow-[0_6px_20px_rgba(34,211,238,0.4),inset_0_1px_2px_rgba(255,255,255,0.85)] cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Continuar Partida</span>
            </button>
          </div>
        )}

        {/* Main Action Buttons */}
        <div className="space-y-3">
          {/* Two-step confirmation if overwriting saved game */}
          <AnimatePresence mode="wait">
            {confirmOverwrite ? (
              <motion.div
                key="confirm-overwrite"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="rounded-3xl border border-amber-300/50 bg-amber-950/60 p-4 text-center shadow-[0_0_20px_rgba(245,158,11,0.25)]"
              >
                <div className="flex items-center justify-center gap-2 text-xs font-extrabold text-amber-200 mb-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0" />
                  <span>¿Iniciar nueva partida?</span>
                </div>
                <p className="text-xs text-amber-100/85 mb-3">
                  Se sobrescribirá la evolución actual de{' '}
                  <strong className="text-white">
                    {stats.speciesName || 'tu especie'}
                  </strong>
                  .
                </p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmOverwrite(false)}
                    className="flex-1 rounded-full border border-cyan-300/35 bg-cyan-950/60 hover:bg-cyan-900/70 py-2.5 text-xs font-bold text-cyan-100 cursor-pointer transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleNewGameClick}
                    className="flex-1 rounded-full border border-amber-200/80 bg-gradient-to-b from-amber-300 to-amber-500 py-2.5 text-xs font-extrabold text-slate-950 shadow-[0_4px_14px_rgba(245,158,11,0.4)] cursor-pointer hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Sí, Crear Nueva
                  </button>
                </div>
              </motion.div>
            ) : (
              <button
                key="btn-new-game"
                type="button"
                onClick={handleNewGameClick}
                className={`w-full flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 text-sm font-extrabold cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150 ${
                  hasSavedGame
                    ? 'border border-cyan-300/45 border-t-cyan-200/70 bg-gradient-to-b from-cyan-500/25 to-teal-700/35 hover:from-cyan-500/35 hover:to-teal-600/45 text-cyan-50 shadow-[0_4px_16px_rgba(34,211,238,0.2),inset_0_1px_1px_rgba(165,243,252,0.3)]'
                    : 'border border-amber-100/85 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-[0_6px_20px_rgba(251,191,36,0.45),inset_0_1px_2px_rgba(255,255,255,0.8)]'
                }`}
              >
                {hasSavedGame ? (
                  <RotateCcw className="h-4 w-4 text-cyan-200" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
                <span>Nueva Partida</span>
              </button>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center justify-center gap-2 rounded-full border border-cyan-300/35 border-t-cyan-200/60 bg-cyan-500/15 hover:bg-cyan-500/28 px-5 py-3 text-xs font-extrabold text-cyan-100 shadow-[0_2px_12px_rgba(34,211,238,0.18),inset_0_1px_1px_rgba(165,243,252,0.25)] cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
            >
              <Settings className="h-4 w-4 text-cyan-300" />
              <span>Ajustes</span>
            </button>

            <button
              type="button"
              onClick={() => setShowQuickControls((prev) => !prev)}
              className="flex items-center justify-center gap-2 rounded-full border border-cyan-300/30 bg-[#031521]/70 hover:bg-cyan-950/75 px-5 py-3 text-xs font-bold text-cyan-200/90 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
            >
              {showQuickControls ? (
                <>
                  <X className="h-4 w-4 text-cyan-300" />
                  <span>Ocultar Guía</span>
                </>
              ) : (
                <>
                  <HelpCircle className="h-4 w-4 text-cyan-300" />
                  <span>Controles y Guía</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expandable Quick Controls & Credits Section */}
        <AnimatePresence>
          {showQuickControls && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 rounded-3xl border border-cyan-300/25 bg-[#031521]/80 p-4 text-xs text-cyan-100/90 space-y-2 shadow-inner">
                <div className="font-display font-bold text-white flex items-center justify-between">
                  <span>Controles Biológicos Rápidos</span>
                  <span className="text-[10px] font-semibold text-cyan-300/80">
                     Sopa Primigenia 3D
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="rounded-xl bg-cyan-950/50 px-2.5 py-1.5 border border-cyan-400/15">
                    <strong className="text-amber-300">WASD / Ratón:</strong>{' '}
                    Nado y Giro
                  </div>
                  <div className="rounded-xl bg-cyan-950/50 px-2.5 py-1.5 border border-cyan-400/15">
                    <strong className="text-amber-300">Espacio:</strong> Impulso
                    / Planeo
                  </div>
                  <div className="rounded-xl bg-cyan-950/50 px-2.5 py-1.5 border border-cyan-400/15">
                    <strong className="text-amber-300">Tecla E:</strong> Taller
                    Evolutivo 3D
                  </div>
                  <div className="rounded-xl bg-cyan-950/50 px-2.5 py-1.5 border border-cyan-400/15">
                    <strong className="text-amber-300">Tecla Q:</strong> Habilidad
                    Activa
                  </div>
                  <div className="rounded-xl bg-cyan-950/50 px-2.5 py-1.5 border border-cyan-400/15">
                    <strong className="text-amber-300">Tecla C:</strong> Canto
                    Social
                  </div>
                  <div className="rounded-xl bg-cyan-950/50 px-2.5 py-1.5 border border-cyan-400/15">
                    <strong className="text-amber-300">Esc:</strong> Letargo /
                    Pausa
                  </div>
                </div>
                <p className="text-[11px] text-cyan-200/75 pt-1 border-t border-cyan-300/15">
                  Aísla nuevos genes fracturando{' '}
                  <strong className="text-amber-200">
                    Meteoritos Fosilizados
                  </strong>{' '}
                  o cazando especies con adaptaciones desconocidas.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
