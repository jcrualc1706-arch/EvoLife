import React from 'react';
import {
  Compass,
  Crosshair,
  Dna,
  Radar,
  ShieldAlert,
  ZapOff,
} from 'lucide-react';
import { PredatorBehaviorState } from '../game/types';

interface ThreatRadarProps {
  nearestSpeciesName: string;
  nearestPredatorState: PredatorBehaviorState;
  nearestPredatorDistance: number;
  nearestHasUncataloguedGene?: boolean;
  hasChemoreceptor?: boolean;
}

const STATE_METADATA: Record<
  PredatorBehaviorState,
  {
    label: string;
    colorClass: string;
    bubbleClass: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  DEAMBULAR: {
    label: 'Merodeando',
    colorClass: 'text-emerald-200',
    bubbleClass:
      'border-emerald-300/50 border-t-emerald-100/70 bg-gradient-to-b from-emerald-400/30 to-teal-900/50 shadow-[0_0_12px_rgba(52,211,153,0.3)]',
    Icon: Compass,
  },
  PERSEGUIR: {
    label: 'Persiguiéndote',
    colorClass: 'text-amber-200',
    bubbleClass:
      'border-amber-300/60 border-t-amber-100/80 bg-gradient-to-b from-amber-400/35 to-amber-900/55 shadow-[0_0_14px_rgba(251,191,36,0.35)]',
    Icon: Crosshair,
  },
  ATACAR: {
    label: '¡Atacando!',
    colorClass: 'text-rose-200',
    bubbleClass:
      'border-rose-300/65 border-t-rose-100/80 bg-gradient-to-b from-rose-500/40 to-rose-950/60 shadow-[0_0_16px_rgba(244,63,94,0.45)] animate-pulse',
    Icon: ShieldAlert,
  },
  HUIR: {
    label: 'Huyendo',
    colorClass: 'text-sky-200',
    bubbleClass:
      'border-sky-300/50 border-t-sky-100/70 bg-gradient-to-b from-sky-400/30 to-sky-900/50 shadow-[0_0_12px_rgba(56,189,248,0.3)]',
    Icon: Radar,
  },
  ATURDIDO: {
    label: 'Aturdido',
    colorClass: 'text-cyan-200',
    bubbleClass:
      'border-cyan-300/55 border-t-cyan-100/75 bg-gradient-to-b from-cyan-400/30 to-cyan-900/50 shadow-[0_0_12px_rgba(34,211,238,0.3)]',
    Icon: ZapOff,
  },
};

export const ThreatRadar: React.FC<ThreatRadarProps> = React.memo(
  ({
    nearestSpeciesName,
    nearestPredatorState,
    nearestPredatorDistance,
    nearestHasUncataloguedGene = false,
    hasChemoreceptor = false,
  }) => {
    const maxRange = hasChemoreceptor ? 65 : 42;
    const isFarOrNone =
      !Number.isFinite(nearestPredatorDistance) ||
      nearestPredatorDistance > maxRange;

    if (isFarOrNone) {
      return (
        <div
          aria-label="Radar de amenazas"
          className="flex items-center gap-2.5 text-xs text-cyan-200/80"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-300/35 border-t-cyan-100/60 bg-gradient-to-b from-cyan-400/20 to-teal-950/60 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
            <Radar className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-cyan-100">
              {hasChemoreceptor ? 'Olfato Químico (65m)' : 'Sensor Biológico'}
            </div>
            <div className="text-[11px] text-teal-200/75">
              Aguas tranquilas cerca
            </div>
          </div>
        </div>
      );
    }

    const meta = STATE_METADATA[nearestPredatorState] ?? STATE_METADATA.DEAMBULAR;
    const StateIcon = meta.Icon;

    return (
      <div
        aria-label="Radar de amenazas"
        className="flex items-center gap-2.5 text-xs"
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${meta.bubbleClass} ${meta.colorClass}`}
        >
          <StateIcon className="h-4 w-4" />
        </div>
        <div className="min-w-[152px]">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-xs font-bold text-white">
              {nearestSpeciesName}
            </span>
            {nearestHasUncataloguedGene && (
              <span
                title="Este organismo porta una adaptación genética aún no catalogada"
                className="inline-flex items-center gap-0.5 rounded-full border border-amber-300/50 bg-amber-400/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.3)] whitespace-nowrap"
              >
                <Dna className="h-2.5 w-2.5 text-emerald-300" />
                <span>[ADN No Catalogado]</span>
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs tabular-nums">
            <span className={`font-bold ${meta.colorClass}`}>{meta.label}</span>
            <span aria-hidden="true" className="text-cyan-400/50">
              ·
            </span>
            <span className="font-extrabold text-cyan-100">
              {nearestPredatorDistance.toFixed(1)} m
            </span>
          </div>
        </div>
      </div>
    );
  }
);

ThreatRadar.displayName = 'ThreatRadar';
