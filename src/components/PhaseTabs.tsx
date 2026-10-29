import React from 'react';
import { Check, Footprints, Lock, Waves } from 'lucide-react';
import { EvolutionaryStage } from '../game/types';

interface PhaseTabsProps {
  currentEvolutionaryStage: EvolutionaryStage;
  growthStage: 1 | 2 | 3;
  selectedStageTab: EvolutionaryStage;
  onSelectStageTab: (stage: EvolutionaryStage) => void;
  cellInstalledCount: number;
  cellTotalCount: number;
  creatureInstalledCount: number;
  creatureTotalCount: number;
}

const TIMELINE_STEPS = [
  { id: 1, label: 'Microcélula' },
  { id: 2, label: 'Célula desarrollada' },
  { id: 3, label: 'Organismo macrocelular' },
  { id: 4, label: 'Criatura terrestre' },
] as const;

export const PhaseTabs: React.FC<PhaseTabsProps> = React.memo(
  ({
    currentEvolutionaryStage,
    growthStage,
    selectedStageTab,
    onSelectStageTab,
    cellInstalledCount,
    cellTotalCount,
    creatureInstalledCount,
    creatureTotalCount,
  }) => {
    const activeStepIndex =
      currentEvolutionaryStage === 'creature_stage' ? 4 : growthStage;

    const isCellCurrent = currentEvolutionaryStage === 'cell_stage';
    const isCreatureCurrent = currentEvolutionaryStage === 'creature_stage';

    return (
      <div className="space-y-3 border-b border-cyan-300/20 bg-[#031521]/55 px-5 py-3.5">
        {/* 4-Step Compact Organic Evolutionary Line */}
        <div
          aria-label="Línea evolutiva de la especie"
          className="grid grid-cols-4 gap-2"
        >
          {TIMELINE_STEPS.map((step) => {
            const isCompleted = step.id < activeStepIndex;
            const isCurrent = step.id === activeStepIndex;
            const isTerrestrialStep = step.id === 4;

            return (
              <div
                key={step.id}
                className={`flex flex-col gap-1 rounded-2xl border px-3 py-1.5 transition-colors ${
                  isCurrent
                    ? isTerrestrialStep
                      ? 'border-amber-300/65 bg-amber-400/20 text-amber-100'
                      : 'border-cyan-300/65 bg-cyan-400/20 text-cyan-100'
                    : isCompleted
                    ? 'border-emerald-400/35 bg-emerald-950/35 text-emerald-200'
                    : 'border-cyan-400/15 bg-cyan-950/40 text-cyan-200/60'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-xs font-mono font-bold tabular-nums">
                  <span>0{step.id}</span>
                  {isCompleted && (
                    <Check className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                  )}
                  {isCurrent && (
                    <span
                      className={`text-[11px] font-sans font-bold ${
                        isTerrestrialStep ? 'text-amber-300' : 'text-cyan-200'
                      }`}
                    >
                      Actual
                    </span>
                  )}
                </div>
                <div className="truncate text-xs font-semibold leading-tight">
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Two Large Bubble Stage Selector Tabs */}
        <div
          role="tablist"
          aria-label="Fases de evolución"
          className="grid grid-cols-2 gap-2.5"
        >
          {/* Tab 1: Fase Celular */}
          <button
            type="button"
            role="tab"
            aria-selected={selectedStageTab === 'cell_stage'}
            onClick={() => onSelectStageTab('cell_stage')}
            className={`flex items-center justify-between gap-2 rounded-full border px-4 py-3 text-left cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150 ${
              selectedStageTab === 'cell_stage'
                ? 'border-cyan-200/80 border-t-white/90 bg-gradient-to-b from-cyan-400/35 to-teal-900/60 text-white shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                : 'border-cyan-300/25 bg-cyan-950/45 text-cyan-100/85 hover:border-cyan-300/50 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-400/20 text-cyan-200">
                <Waves className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-sm font-extrabold truncate">
                    Fase Celular
                  </span>
                </div>
                <div className="font-mono text-xs text-cyan-200/90 tabular-nums">
                  {cellInstalledCount}/{cellTotalCount} órganos
                </div>
              </div>
            </div>

            {isCellCurrent && (
              <span className="shrink-0 rounded-full border border-cyan-300/50 bg-cyan-400/25 px-2.5 py-0.5 text-xs font-bold text-cyan-100">
                Fase actual
              </span>
            )}
          </button>

          {/* Tab 2: Criatura Terrestre */}
          <button
            type="button"
            role="tab"
            aria-selected={selectedStageTab === 'creature_stage'}
            onClick={() => onSelectStageTab('creature_stage')}
            className={`flex items-center justify-between gap-2 rounded-full border px-4 py-3 text-left cursor-pointer hover:scale-[1.02] active:scale-95 transition-all duration-150 ${
              selectedStageTab === 'creature_stage'
                ? 'border-amber-200/80 border-t-white/90 bg-gradient-to-b from-amber-400/35 to-amber-900/60 text-white shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                : 'border-cyan-300/25 bg-cyan-950/45 text-cyan-100/85 hover:border-amber-300/50 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/50 bg-amber-400/20 text-amber-200">
                <Footprints className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-sm font-extrabold truncate">
                    Criatura Terrestre
                  </span>
                </div>
                <div className="font-mono text-xs text-amber-200/90 tabular-nums">
                  {creatureInstalledCount}/{creatureTotalCount} órganos
                </div>
              </div>
            </div>

            {isCreatureCurrent ? (
              <span className="shrink-0 rounded-full border border-amber-300/50 bg-amber-400/25 px-2.5 py-0.5 text-xs font-bold text-amber-100">
                Fase actual
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-950/60 px-2.5 py-0.5 text-xs font-semibold text-cyan-100/80">
                <Lock className="h-3 w-3 text-amber-300" />
                <span>Vista previa</span>
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }
);

PhaseTabs.displayName = 'PhaseTabs';
