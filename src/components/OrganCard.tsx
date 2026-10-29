import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  Crosshair,
  Dna,
  Eye,
  Feather,
  Filter,
  Flame,
  Lock,
  Minus,
  Plus,
  Radio,
  Scissors,
  Shield,
  ShieldCheck,
  Skull,
  Sparkles,
  Sun,
  Swords,
  Syringe,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { AdaptationCategory, CellularEvolutionSlot } from '../game/types';

interface OrganCardProps {
  slot: CellularEvolutionSlot;
  currentAdn: number;
  isLockedByStage: boolean;
  isFeaturedTerrestrial: boolean;
  onUnlock: (slotId: string) => void;
  onRefund: (slotId: string) => void;
}

const CATEGORY_META: Record<
  AdaptationCategory,
  {
    label: string;
    chipClass: string;
  }
> = {
  alimentacion: {
    label: 'Alimentación',
    chipClass: 'border-rose-300/45 bg-rose-500/20 text-rose-100',
  },
  ataque: {
    label: 'Ataque',
    chipClass: 'border-amber-300/45 bg-amber-500/20 text-amber-100',
  },
  defensa: {
    label: 'Defensa',
    chipClass: 'border-indigo-300/45 bg-indigo-500/20 text-indigo-100',
  },
  movimiento: {
    label: 'Movimiento',
    chipClass: 'border-cyan-300/45 bg-cyan-500/20 text-cyan-100',
  },
  sentidos: {
    label: 'Sentidos',
    chipClass: 'border-violet-300/45 bg-violet-500/20 text-violet-100',
  },
  metabolismo: {
    label: 'Metabolismo',
    chipClass: 'border-emerald-300/45 bg-emerald-500/20 text-emerald-100',
  },
  apariencia: {
    label: 'Apariencia',
    chipClass: 'border-teal-300/45 bg-teal-500/20 text-teal-100',
  },
};

const ORGAN_ICONS: Record<string, React.FC<{ className?: string }>> = {
  mouth_filter: Filter,
  mouth_jaw: Scissors,
  mouth_proboscis: Syringe,
  chitin_spike: Swords,
  rostral_spines: Swords,
  poison_gland: Skull,
  electric_cell: Zap,
  acid_spit: Crosshair,
  membrane_armor: Shield,
  neutralizer_vesicle: ShieldCheck,
  simple_flagellum: Wind,
  flagellum_2: Wind,
  cilia_waves: Waves,
  hydro_siphon: Compass,
  eye_photoreceptor: Eye,
  eye_stalks: Eye,
  chemoreceptor: Radio,
  chloroplast_1: Sun,
  vocal_crest: Radio,
  grasping_arms: Flame,
  wings_1: Feather,
};

export const OrganCard: React.FC<OrganCardProps> = React.memo(
  ({
    slot,
    currentAdn,
    isLockedByStage,
    isFeaturedTerrestrial,
    onUnlock,
    onRefund,
  }) => {
    const prefersReducedMotion = useReducedMotion();
    const [expandedDetails, setExpandedDetails] = useState(false);
    const [confirmingRefund, setConfirmingRefund] = useState(false);
    const [justInstalledPulse, setJustInstalledPulse] = useState(false);

    const OrganIcon = ORGAN_ICONS[slot.id] ?? Dna;
    const catMeta = CATEGORY_META[slot.category] ?? CATEGORY_META.metabolismo;

    const isHiddenLocked =
      !isLockedByStage && slot.discoveryState === 'locked_hidden';
    const isInstalled = slot.installedStacks > 0;
    const canAddMoreStacks =
      !isHiddenLocked &&
      !isLockedByStage &&
      slot.installedStacks < slot.maxStacks;
    const canAfford = canAddMoreStacks && currentAdn >= slot.costAdn;

    const missingAdn = Math.max(0, slot.costAdn - currentAdn);
    const affordabilityPct = Math.min(
      100,
      Math.max(0, (currentAdn / Math.max(1, slot.costAdn)) * 100)
    );

    const handleSynthesize = () => {
      if (!canAfford) return;
      setJustInstalledPulse(true);
      onUnlock(slot.id);
      window.setTimeout(() => setJustInstalledPulse(false), 450);
    };

    // =========================================================================
    // STATE 1: LOCKED & HIDDEN IN THE ECOSYSTEM ('locked_hidden' - Dormant Fossil)
    // =========================================================================
    if (isHiddenLocked) {
      return (
        <div className="flex flex-col justify-between rounded-3xl border border-cyan-300/20 bg-gradient-to-b from-cyan-950/60 via-[#041a29]/75 to-teal-950/70 p-4 opacity-85 backdrop-blur-xl transition-all">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-300/35 bg-[#031521]/90 text-amber-200/80 shadow-inner">
                  <Dna className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${catMeta.chipClass}`}
                  >
                    {catMeta.label}
                  </span>
                  <h3 className="mt-1 font-display text-sm sm:text-base font-extrabold text-white">
                    Embrión Fosilizado Latente
                  </h3>
                  <p className="text-xs font-mono text-amber-200/90">
                    {slot.veiledName}
                  </p>
                </div>
              </div>

              <span className="shrink-0 rounded-full border border-amber-300/30 bg-amber-950/40 px-2.5 py-1 font-mono text-xs text-amber-200/80">
                Fósil ???
              </span>
            </div>

            {/* Discovery Hint Box */}
            <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              <div className="font-bold text-amber-200">
                Rastro de aislamiento biológico:
              </div>
              <p className="mt-0.5 leading-relaxed text-amber-100/90">
                {slot.discoveryHint}
              </p>
            </div>
          </div>

          <div className="mt-3 border-t border-cyan-300/15 pt-2.5">
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-full border border-cyan-400/20 bg-[#031521]/70 px-3 py-2 text-xs font-bold text-cyan-200/60 cursor-not-allowed"
            >
              <span>Fósil latente en el ecosistema</span>
            </button>
          </div>
        </div>
      );
    }

    // =========================================================================
    // STATES 2, 3 & 4: DISCOVERED OR INSTALLED
    // =========================================================================
    return (
      <motion.div
        layout={!prefersReducedMotion}
        animate={
          justInstalledPulse && !prefersReducedMotion
            ? { scale: [1, 1.02, 1] }
            : { scale: 1 }
        }
        transition={{ duration: 0.22 }}
        className={`flex flex-col justify-between rounded-3xl border backdrop-blur-xl transition-all ${
          isFeaturedTerrestrial ? 'p-4 sm:p-5' : 'p-4'
        } ${
          isLockedByStage
            ? 'border-cyan-300/20 bg-cyan-950/35 opacity-75'
            : isInstalled
            ? 'border-emerald-300/60 border-t-emerald-100/80 bg-gradient-to-b from-emerald-950/50 via-[#041a29]/80 to-teal-950/75 shadow-[0_8px_24px_rgba(16,185,129,0.18)]'
            : canAfford
            ? 'border-cyan-300/50 border-t-cyan-100/75 bg-gradient-to-b from-cyan-950/70 via-[#041a29]/80 to-teal-950/75 shadow-[0_8px_24px_rgba(34,211,238,0.18)] hover:border-cyan-200'
            : 'border-cyan-300/20 bg-cyan-950/45 opacity-90'
        }`}
      >
        <div>
          {/* Top Row: Organ Icon, Title, Category & Stack Counter / Cost */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`flex shrink-0 items-center justify-center rounded-full border ${
                  isFeaturedTerrestrial ? 'h-12 w-12' : 'h-10 w-10'
                } ${
                  isInstalled
                    ? 'border-emerald-300/60 bg-emerald-400/25 text-emerald-200'
                    : canAfford
                    ? 'border-cyan-300/60 bg-cyan-400/25 text-cyan-100'
                    : 'border-cyan-400/25 bg-cyan-950/60 text-cyan-200/80'
                }`}
              >
                <OrganIcon
                  className={isFeaturedTerrestrial ? 'h-6 w-6' : 'h-5 w-5'}
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${catMeta.chipClass}`}
                  >
                    {catMeta.label}
                  </span>
                  {slot.stackable && (
                    <span className="rounded-full border border-cyan-300/35 bg-[#031521]/80 px-2.5 py-0.5 font-mono text-xs font-bold text-cyan-100">
                      {slot.installedStacks}/{slot.maxStacks} copias
                    </span>
                  )}
                </div>

                <h3
                  className={`mt-1 font-display font-extrabold text-white ${
                    isFeaturedTerrestrial
                      ? 'text-base sm:text-lg'
                      : 'text-sm sm:text-base'
                  }`}
                >
                  {slot.name}
                </h3>
              </div>
            </div>

            {/* Cost Badge */}
            <div
              className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 font-mono text-xs font-extrabold tabular-nums ${
                canAfford || isInstalled
                  ? 'border-amber-300/55 bg-amber-500/20 text-amber-200'
                  : 'border-rose-300/45 bg-rose-950/50 text-rose-200'
              }`}
            >
              <Dna className="h-3.5 w-3.5 text-amber-300" />
              <span>{slot.costAdn} ADN</span>
            </div>
          </div>

          {/* Description */}
          <p className="mt-2.5 text-xs leading-relaxed text-cyan-100/90">
            {slot.description}
          </p>

          {/* Quantitative Pros & Tradeoffs Datasheet */}
          <div className="mt-3 space-y-1.5 rounded-2xl border border-cyan-300/20 bg-[#031521]/65 p-3 text-xs">
            {slot.pros.map((pro) => (
              <div
                key={pro}
                className="flex items-start gap-1.5 text-emerald-300"
              >
                <span className="font-mono font-bold text-emerald-400">+</span>
                <span>{pro}</span>
              </div>
            ))}

            {(expandedDetails || isFeaturedTerrestrial || !isInstalled) &&
              slot.tradeoffs
                .filter((t) => t !== 'Ninguno')
                .map((tradeoff) => (
                  <div
                    key={tradeoff}
                    className="flex items-start gap-1.5 text-amber-200/90"
                  >
                    <span className="font-mono font-bold text-amber-400">
                      −
                    </span>
                    <span>{tradeoff}</span>
                  </div>
                ))}

            {expandedDetails &&
              slot.incompatibilities &&
              slot.incompatibilities.map((inc) => (
                <div
                  key={inc}
                  className="flex items-start gap-1.5 text-cyan-200/75"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  <span>{inc}</span>
                </div>
              ))}

            {slot.incompatibilities && slot.incompatibilities.length > 0 && (
              <button
                type="button"
                onClick={() => setExpandedDetails((prev) => !prev)}
                className="mt-1 text-xs font-bold text-cyan-200 hover:text-white cursor-pointer"
              >
                {expandedDetails
                  ? 'Ocultar notas técnicas'
                  : 'Ver compatibilidad'}
              </button>
            )}
          </div>
        </div>

        {/* Bottom Action Area */}
        <div className="mt-3.5 border-t border-cyan-300/20 pt-3">
          {isLockedByStage ? (
            <div className="flex items-center gap-2 rounded-full border border-cyan-300/25 bg-[#031521]/70 px-3.5 py-2 text-xs text-cyan-100">
              <Lock className="h-4 w-4 shrink-0 text-amber-300" />
              <span>Se desbloquea al evolucionar a Criatura Terrestre</span>
            </div>
          ) : isInstalled ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>
                    Activo en el organismo
                    {slot.stackable
                      ? ` (${slot.installedStacks}/${slot.maxStacks})`
                      : ''}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {slot.stackable && slot.installedStacks < slot.maxStacks && (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={handleSynthesize}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-extrabold whitespace-nowrap active:scale-95 transition-all duration-150 ${
                        canAfford
                          ? 'border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-[0_2px_10px_rgba(251,191,36,0.35)] cursor-pointer'
                          : 'border-cyan-400/20 bg-cyan-950/50 text-cyan-300/40 cursor-not-allowed'
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Copia ({slot.costAdn} ADN)</span>
                    </button>
                  )}

                  {!confirmingRefund ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingRefund(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/20 hover:bg-rose-500/25 hover:border-rose-300/50 px-3 py-1.5 text-xs font-bold text-cyan-100 hover:text-rose-100 cursor-pointer whitespace-nowrap active:scale-95 transition-all duration-150"
                    >
                      <Minus className="h-3.5 w-3.5" />
                      <span>Quitar (+{slot.costAdn} ADN)</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingRefund(false);
                          onRefund(slot.id);
                        }}
                        className="rounded-full bg-gradient-to-b from-rose-400 to-rose-600 px-3 py-1.5 text-xs font-extrabold text-white cursor-pointer whitespace-nowrap active:scale-95 transition-transform duration-150"
                      >
                        Confirmar (+{slot.costAdn})
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingRefund(false)}
                        className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-2.5 py-1.5 text-xs font-bold text-cyan-100 cursor-pointer active:scale-95 transition-transform duration-150"
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : canAfford ? (
            <button
              type="button"
              onClick={handleSynthesize}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-[0_4px_14px_rgba(251,191,36,0.4)] cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-95 transition-all duration-150"
            >
              <Sparkles className="h-4 w-4" />
              <span>Sintetizar e Instalar ({slot.costAdn} ADN)</span>
            </button>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-rose-200">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Lock className="h-3.5 w-3.5 text-rose-300" />
                  <span>ADN Insuficiente (Faltan {missingAdn} ADN)</span>
                </span>
                <span className="font-mono tabular-nums text-cyan-100">
                  {currentAdn}/{slot.costAdn}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`Progreso de ADN para ${slot.name}`}
                aria-valuenow={currentAdn}
                aria-valuemin={0}
                aria-valuemax={slot.costAdn}
                className="h-2 w-full overflow-hidden rounded-full bg-[#02121d]"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-transform duration-200 origin-left"
                  style={{
                    width: '100%',
                    transform: `scaleX(${affordabilityPct / 100})`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }
);

OrganCard.displayName = 'OrganCard';
