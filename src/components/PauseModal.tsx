import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Dna,
  Home,
  LogOut,
  Play,
  Save,
  Settings,
  Terminal,
  Timer,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { audioManager } from '../game/AudioManager';
import { PlayerStats } from '../game/types';

interface PauseModalProps {
  stats: PlayerStats;
  isSettingsOpen?: boolean;
  onResume: () => void;
  onManualSave: () => void;
  onOpenSettings: () => void;
  onOpenDevTools?: () => void;
  onExitToMenu: () => void;
  onExitWithoutSaving: () => void;
}

function formatSurvivalTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  stats,
  isSettingsOpen = false,
  onResume,
  onManualSave,
  onOpenSettings,
  onOpenDevTools,
  onExitToMenu,
  onExitWithoutSaving,
}) => {
  const isCreatureStage = stats.evolutionaryStage === 'creature_stage';
  const [justSaved, setJustSaved] = useState(false);
  const [isConfirmingExit, setIsConfirmingExit] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const timer = window.setTimeout(() => {
      setJustSaved(false);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  // Layer 2 (Pause Menu) Escape Key Handling:
  // Only active when SettingsModal is closed (isSettingsOpen === false)
  useEffect(() => {
    if (isSettingsOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();

        if (isConfirmingExit) {
          audioManager.playButtonClick();
          setIsConfirmingExit(false);
          return;
        }

        audioManager.playButtonClick();
        onResume();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, isConfirmingExit, onResume]);

  const handleManualSaveClick = () => {
    onManualSave();
    setJustSaved(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-4"
    >
      <div className="relative rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-cyan-950/80 via-slate-950/90 to-slate-950/95 p-6 sm:p-8 shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header with Species Name and Survival Time */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${
                isCreatureStage
                  ? 'border-amber-200/70 bg-gradient-to-b from-amber-300/35 to-amber-700/40 text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.35)]'
                  : 'border-cyan-200/70 bg-gradient-to-b from-cyan-300/35 to-teal-700/40 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.35)]'
              }`}
            >
              <Dna className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black tracking-widest text-cyan-300/80 uppercase">
                Pausa de Simulación
              </div>
              <h2
                id="pause-modal-title"
                className="font-display text-xl font-extrabold text-white truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
              >
                {stats.speciesName || 'Organismo Primigenio'}
              </h2>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-950/60 px-3 py-1.5 text-xs font-mono font-bold text-cyan-200 shadow-inner">
            <Timer className="h-3.5 w-3.5 text-teal-300" />
            <span>{formatSurvivalTime(stats.survivalTime)}</span>
          </div>
        </div>

        {/* Current Session Organic Receptacles */}
        <div className="mb-6 grid grid-cols-3 gap-2.5 rounded-3xl border border-cyan-300/25 border-t-cyan-200/40 bg-[#031521]/65 p-3.5 text-center shadow-inner">
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

        {/* Main Pause Actions */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              onResume();
            }}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-5 py-3.5 text-sm font-extrabold text-slate-950 shadow-[0_4px_18px_rgba(251,191,36,0.4),inset_0_1px_2px_rgba(255,255,255,0.75)] cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Continuar</span>
            <kbd className="ml-1 rounded-full bg-amber-950/20 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-950">
              Esc
            </kbd>
          </button>

          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={handleManualSaveClick}
            className={`flex w-full items-center justify-center gap-2.5 rounded-full border px-5 py-3 text-sm font-bold cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150 ${
              justSaved
                ? 'border-emerald-300/60 bg-emerald-900/65 text-emerald-100 shadow-[0_0_18px_rgba(16,185,129,0.3)]'
                : 'border-emerald-400/40 bg-emerald-950/55 hover:bg-emerald-900/65 text-emerald-100 shadow-[0_4px_14px_rgba(16,185,129,0.15)]'
            }`}
          >
            {justSaved ? (
              <>
                <Check className="h-4 w-4 text-emerald-300" />
                <span>¡Guardado!</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 text-emerald-300" />
                <span>Guardar Partida</span>
              </>
            )}
          </button>

          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              onOpenSettings();
            }}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-cyan-300/40 bg-cyan-950/60 hover:bg-cyan-900/70 px-5 py-3 text-sm font-bold text-cyan-100 shadow-[0_4px_14px_rgba(34,211,238,0.15)] cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
          >
            <Settings className="h-4 w-4 text-cyan-300" />
            <span>Ajustes</span>
          </button>

          {onOpenDevTools && (
            <button
              type="button"
              onPointerEnter={() => audioManager.playButtonHover()}
              onClick={() => {
                audioManager.playButtonClick();
                onOpenDevTools();
              }}
              className="flex w-full items-center justify-center gap-2.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-950/45 hover:bg-fuchsia-900/65 px-5 py-2.5 text-xs font-extrabold text-fuchsia-100 shadow-[0_4px_14px_rgba(217,70,239,0.15)] cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
            >
              <Terminal className="h-3.5 w-3.5 text-fuchsia-300" />
              <span>DevTools / Suite de Pruebas</span>
              <kbd className="ml-1 rounded-full bg-fuchsia-950/80 border border-fuchsia-400/35 px-2 py-0.5 font-mono text-[10px] font-bold text-fuchsia-200">
                F1
              </kbd>
            </button>
          )}

          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              setIsConfirmingExit(true);
            }}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-cyan-300/35 bg-[#031521]/85 hover:bg-cyan-950/80 px-5 py-3 text-sm font-bold text-cyan-100 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
          >
            <Home className="h-4 w-4 text-amber-300" />
            <span>Salir al Menú Principal</span>
          </button>
        </div>

        {/* Exit Confirmation Overlay: ¿Quieres guardar tu progreso actual antes de salir al Sistema Solar? */}
        <AnimatePresence>
          {isConfirmingExit && (
            <motion.div
              key="pause-exit-confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-[#020d16]/92 p-6 backdrop-blur-xl"
            >
              <motion.div
                initial={{ scale: 0.92, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 10 }}
                className="w-full text-center"
              >
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/50 bg-amber-500/20 text-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.3)]">
                  <AlertTriangle className="h-6 w-6" />
                </div>

                <h3 className="font-display text-lg font-extrabold text-white">
                  ¿Deseas guardar los cambios antes de salir?
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-cyan-100/80">
                  ¿Quieres guardar tu progreso actual antes de salir al Sistema Solar?
                </p>

                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onPointerEnter={() => audioManager.playButtonHover()}
                    onClick={() => {
                      audioManager.playSaveConfirm();
                      setIsConfirmingExit(false);
                      onExitToMenu();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-emerald-300/60 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 px-5 py-3 text-xs font-extrabold text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                  >
                    <Save className="h-4 w-4" />
                    <span>Guardar y Salir</span>
                  </button>

                  <button
                    type="button"
                    onPointerEnter={() => audioManager.playButtonHover()}
                    onClick={() => {
                      audioManager.playButtonClick();
                      setIsConfirmingExit(false);
                      onExitWithoutSaving();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-rose-400/45 bg-rose-950/65 hover:bg-rose-900/75 px-5 py-2.5 text-xs font-extrabold text-rose-100 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                  >
                    <LogOut className="h-4 w-4 text-rose-300" />
                    <span>Salir sin Guardar</span>
                  </button>

                  <button
                    type="button"
                    onPointerEnter={() => audioManager.playButtonHover()}
                    onClick={() => {
                      audioManager.playButtonClick();
                      setIsConfirmingExit(false);
                    }}
                    className="flex w-full items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-950/60 hover:bg-cyan-900/70 px-5 py-2.5 text-xs font-bold text-cyan-100 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                  >
                    <span>Cancelar</span>
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

