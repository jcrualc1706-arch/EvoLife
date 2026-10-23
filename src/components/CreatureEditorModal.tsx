import React from 'react';
import {
  CheckCircle2,
  Dna,
  Lock,
  Play,
  Shield,
  Sparkles,
  Wind,
  Zap,
} from 'lucide-react';
import {
  CellularEvolutionSlot,
  EvolutionCategory,
  PlayerStats,
} from '../game/types';

interface CreatureEditorModalProps {
  stats: PlayerStats;
  slots: CellularEvolutionSlot[];
  onUnlockSlot: (slotId: string) => void;
  onRefundSlot: (slotId: string) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<EvolutionCategory, string> = {
  locomocion: 'Locomoción',
  metabolismo: 'Metabolismo',
  defensa: 'Defensa y Combate',
};

export const CreatureEditorModal: React.FC<CreatureEditorModalProps> = ({
  stats,
  slots,
  onUnlockSlot,
  onRefundSlot,
  onClose,
}) => {
  const unlockedCount = slots.filter((s) => s.unlocked).length;

  const stageLabel =
    stats.growthStage === 3
      ? 'Fase 3/3 · Organismo Macrocelular'
      : stats.growthStage === 2
      ? 'Fase 2/3 · Célula Desarrollada'
      : 'Fase 1/3 · Microcélula';

  const renderCategoryIcon = (category: EvolutionCategory) => {
    switch (category) {
      case 'locomocion':
        return <Wind className="h-4 w-4 text-cyan-400" />;
      case 'metabolismo':
        return <Zap className="h-4 w-4 text-emerald-400" />;
      case 'defensa':
        return <Shield className="h-4 w-4 text-amber-400" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-modal-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#051829] shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-pink-400/40 bg-pink-950/70 text-pink-300">
              <Dna className="h-6 w-6" />
            </div>
            <div>
              <h2
                id="editor-modal-title"
                className="font-display text-2xl font-bold text-white"
              >
                Editor de Evolución Celular
              </h2>
              <p className="text-xs text-pink-200/90">
                Puesta genética con Pareja Celular · {stageLabel} · Instala o reembolsa órganos libremente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2.5">
            <div>
              <div className="text-xs text-slate-400">ADN Disponible</div>
              <div className="font-mono text-xl font-bold tabular-nums text-amber-300">
                {stats.adn} <span className="text-xs font-normal text-amber-200/80">ADN</span>
              </div>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <div className="text-xs text-slate-400">Adaptaciones</div>
              <div className="font-mono text-base font-bold tabular-nums text-cyan-300">
                {unlockedCount} / {slots.length}
              </div>
            </div>
          </div>
        </div>

        {/* Body: 8 Evolution Slots Grid */}
        <div className="grid grid-cols-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2">
          {slots.map((slot) => {
            const canAfford = !slot.unlocked && stats.adn >= slot.costAdn;

            return (
              <div
                key={slot.id}
                className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
                  slot.unlocked
                    ? 'border-emerald-500/40 bg-emerald-950/20'
                    : canAfford
                    ? 'border-cyan-400/40 bg-slate-900/90'
                    : 'border-slate-800 bg-slate-900/50'
                }`}
              >
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium text-slate-300">
                      {renderCategoryIcon(slot.category)}
                      {CATEGORY_LABELS[slot.category]}
                    </span>
                    <span className="font-mono font-semibold tabular-nums">
                      {slot.unlocked ? (
                        <span className="text-emerald-400">Instalada</span>
                      ) : canAfford ? (
                        <span className="text-amber-300">
                          Disponible · {slot.costAdn} ADN
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Requiere {slot.costAdn} ADN
                        </span>
                      )}
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-bold text-white">
                    {slot.name}
                  </h3>

                  <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                    {slot.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="mb-3 text-xs font-mono font-medium text-cyan-300">
                    Efecto: {slot.statSummary}
                  </div>

                  {slot.unlocked ? (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/60 px-3 py-2 text-xs font-bold text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Órgano Activo</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRefundSlot(slot.id)}
                        className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-900/80 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Quitar (+{slot.costAdn} ADN)
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onUnlockSlot(slot.id)}
                      className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
                        canAfford
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer'
                          : 'border border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {canAfford ? (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>Evolucionar ({slot.costAdn} ADN)</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5" />
                          <span>
                            Faltan {slot.costAdn - stats.adn} ADN
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="text-xs text-slate-400">
            Dieta:{' '}
            <span className="font-semibold text-amber-300">
              {stats.diet === 'omnivore'
                ? 'Omnívoro'
                : stats.diet === 'carnivore'
                ? 'Carnívoro'
                : 'Herbívoro'}
            </span>
            <span className="mx-2">·</span>
            Vida Máx: <span className="font-mono font-semibold text-emerald-400 tabular-nums">{stats.maxHealth}</span>
            <span className="mx-2">·</span>
            Energía Máx: <span className="font-mono font-semibold text-cyan-400 tabular-nums">{stats.maxEnergy}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Volver al Ecosistema (E)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
