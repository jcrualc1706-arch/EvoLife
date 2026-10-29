import React, { useState } from 'react';
import {
  AlertTriangle,
  Footprints,
  Sparkles,
} from 'lucide-react';

interface LandTransitionBannerProps {
  totalAdnEarned: number;
  readyForLandTransition: boolean;
  onConfirmTransition: () => void;
}

export const LandTransitionBanner: React.FC<LandTransitionBannerProps> =
  React.memo(
    ({ totalAdnEarned, readyForLandTransition, onConfirmTransition }) => {
      const [confirming, setConfirming] = useState(false);
      const progressPct = Math.min(
        100,
        Math.max(0, (totalAdnEarned / 200) * 100)
      );
      const displayAdn = Math.min(200, totalAdnEarned);

      return (
        <div
          className={`rounded-3xl border p-4 backdrop-blur-xl transition-all ${
            readyForLandTransition
              ? 'border-amber-300/65 border-t-amber-100/80 bg-gradient-to-b from-amber-500/20 via-[#041a29]/85 to-teal-950/80 shadow-[0_8px_32px_rgba(4,25,41,0.5),0_0_24px_rgba(251,191,36,0.25)]'
              : 'border-cyan-300/30 border-t-cyan-200/50 bg-gradient-to-b from-cyan-950/70 via-[#041a29]/80 to-teal-950/75 shadow-[0_8px_32px_rgba(4,25,41,0.5)]'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
                  readyForLandTransition
                    ? 'border-amber-100 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.5)]'
                    : 'border-amber-300/50 bg-amber-400/20 text-amber-200'
                }`}
              >
                <Footprints className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-extrabold text-white">
                    Salto Evolutivo a Criatura Terrestre
                  </h3>
                  {readyForLandTransition && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-slate-950">
                      <Sparkles className="h-3 w-3" />
                      <span>¡Listo!</span>
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-cyan-100/90">
                  {readyForLandTransition
                    ? 'Cerebro Primitivo completado. Desarrolla 4 patas articuladas y emerge a la Costa Terrestre.'
                    : 'Acumula 200 ADN históricos para culminar la Fase Celular, o adelanta la transición cuando quieras.'}
                </p>
              </div>
            </div>
          </div>

          {/* Organic Fluid Progress Bar toward 200 ADN */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-cyan-100/85">
                Progreso hacia el Cerebro Primitivo
              </span>
              <span className="font-mono font-extrabold tabular-nums text-amber-300">
                {displayAdn} / 200 ADN
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Progreso hacia la transición terrestre"
              aria-valuenow={displayAdn}
              aria-valuemin={0}
              aria-valuemax={200}
              className="relative h-3.5 w-full overflow-hidden rounded-full border-2 border-amber-300/40 bg-[#02121d]/85 p-0.5"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-200 transition-transform duration-300 origin-left shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                style={{
                  width: '100%',
                  transform: `scaleX(${progressPct / 100})`,
                }}
              />
            </div>
          </div>

          {/* Action Button or 2-Step Irreversible Confirmation */}
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-[0_4px_14px_rgba(251,191,36,0.4)] cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150"
            >
              <Footprints className="h-4 w-4" />
              <span>
                {readyForLandTransition
                  ? '¡Evolucionar a Criatura Terrestre Ahora!'
                  : 'Adelantar Salto a Criatura Terrestre (Desarrollar 4 Patas)'}
              </span>
            </button>
          ) : (
            <div className="mt-3 rounded-3xl border border-amber-300/50 bg-[#031521]/90 p-3.5">
              <div className="flex items-start gap-2 text-xs text-amber-100">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300 mt-0.5" />
                <span>
                  Esta transición es irreversible: abandonarás el océano abisal para vivir en la Costa Terrestre y desbloquear los órganos terrestres.
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    onConfirmTransition();
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-[0_4px_12px_rgba(251,191,36,0.4)] cursor-pointer active:scale-95 transition-transform duration-150"
                >
                  <Footprints className="h-3.5 w-3.5" />
                  <span>Sí, evolucionar a tierra</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-full border border-cyan-400/40 bg-cyan-500/20 hover:bg-cyan-500/35 px-4 py-2 text-xs font-bold text-cyan-100 cursor-pointer active:scale-95 transition-all duration-150"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }
  );

LandTransitionBanner.displayName = 'LandTransitionBanner';
