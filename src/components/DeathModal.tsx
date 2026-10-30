import React from 'react';
import { Dna, Home, RotateCcw, ShieldCheck, Skull } from 'lucide-react';
import { audioManager } from '../game/AudioManager';
import { PlayerStats } from '../game/types';

interface DeathModalProps {
  stats: PlayerStats;
  deathCauseDescription?: string;
  onRespawnFromSave: () => void;
  onExitToMenu: () => void;
}

export const DeathModal: React.FC<DeathModalProps> = ({
  stats,
  deathCauseDescription,
  onRespawnFromSave,
  onExitToMenu,
}) => {
  const causeText =
    deathCauseDescription ||
    (stats.energy <= 0
      ? 'Inanición metabólica: Las reservas de bioenergía celular se agotaron por completo.'
      : 'Los depredadores del ecosistema abisal superaron la membrana defensiva de tu especie.');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="death-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#021019]/78 backdrop-blur-2xl p-4"
    >
      <div className="w-full max-w-md rounded-[32px] border border-cyan-300/30 border-t-rose-300/50 bg-gradient-to-b from-cyan-950/80 via-[#041a29]/92 to-teal-950/88 p-6 sm:p-7 backdrop-blur-xl shadow-[0_8px_32px_rgba(4,25,41,0.7),0_0_28px_rgba(244,63,94,0.22),inset_0_1px_2px_rgba(254,205,211,0.25)]">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-rose-300/60 bg-gradient-to-b from-rose-400/35 to-rose-900/50 text-rose-200 shadow-[0_0_16px_rgba(244,63,94,0.4)]">
            <Skull className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black tracking-widest uppercase text-rose-300/85">
              Colapso Celular · Registro Genético Intacto
            </div>
            <h2
              id="death-modal-title"
              className="font-display text-xl font-extrabold text-white truncate"
            >
              Ciclo Vital Interrumpido
            </h2>
            <p className="text-xs font-semibold text-rose-200/90 truncate">
              {stats.speciesName || 'Tu organismo'} cayó en la Etapa{' '}
              {stats.growthStage}/5
            </p>
          </div>
        </div>

        {/* Cause of Death Summary */}
        <div className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-950/30 p-3.5 text-xs leading-relaxed text-rose-100/95">
          {causeText}
        </div>

        {/* Safe Checkpoint Reassurance Note */}
        <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-emerald-400/25 bg-emerald-950/30 px-3.5 py-2.5 text-[11px] font-medium text-emerald-100/90">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>
            Tu código genético y tus piezas ensambladas están a salvo en el
            último punto de guardado del planeta.
          </span>
        </div>

        {/* Current Checkpoint Telemetry */}
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
              Etapa
            </div>
            <div className="mt-1 font-mono text-lg font-extrabold tabular-nums text-emerald-300">
              {stats.growthStage}/5
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

        {/* Two Required Checkpoint Actions */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              onRespawnFromSave();
            }}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-6 py-3.5 text-sm font-extrabold text-slate-950 shadow-[0_4px_18px_rgba(251,191,36,0.45),inset_0_1px_2px_rgba(255,255,255,0.75)] cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reaparecer (Último Guardado)</span>
          </button>

          <button
            type="button"
            onPointerEnter={() => audioManager.playButtonHover()}
            onClick={() => {
              audioManager.playButtonClick();
              onExitToMenu();
            }}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-cyan-300/35 bg-[#031521]/85 hover:bg-cyan-950/80 px-6 py-3 text-sm font-bold text-cyan-100 cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
          >
            <Home className="h-4 w-4 text-cyan-300" />
            <span>Salir al Menú Principal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
