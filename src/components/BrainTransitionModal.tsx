import React, { useMemo } from 'react';
import { BrainCinematicState } from '../game/types';
import { audioManager } from '../game/AudioManager';

interface BrainTransitionModalProps {
  state: BrainCinematicState;
  cinematic?: BrainCinematicState;
  onSkip: () => void;
}

const PHASE_LABELS = [
  'I · GERMINACIÓN AXONAL',
  'II · GIRIFICACIÓN CORTICAL',
  'III · SOBRECARGA SINÁPTICA',
  'IV · ASIMILACIÓN CRANEAL',
];

export const BrainTransitionModal: React.FC<BrainTransitionModalProps> = ({
  state,
  cinematic: cinematicProp,
  onSkip,
}) => {
  const cinematic = state ?? cinematicProp!;
  const progressPercent = Math.min(100, Math.round(cinematic.progress * 100));
  const activePhase =
    cinematic.phase ??
    (cinematic.progress < 0.25
      ? 0
      : cinematic.progress < 0.65
      ? 1
      : cinematic.progress < 0.85
      ? 2
      : 3);
  const synapticHz = cinematic.synapticActivityHz ?? 12;

  // Generate a dynamic SVG Electroencephalogram (EEG) waveform driven by synapticActivityHz & progress
  const eegPathData = useMemo(() => {
    const width = 220;
    const midY = 22;
    const points: string[] = [];
    const step = 4;
    const freqFactor = 0.08 + (synapticHz / 45) * 0.22;
    const phaseShift = cinematic.progress * 42;
    const amp = 4 + (synapticHz / 45) * 12;

    for (let x = 0; x <= width; x += step) {
      const env = Math.sin((x / width) * Math.PI);
      const y =
        midY +
        (Math.sin(x * freqFactor + phaseShift) * 0.65 +
          Math.cos(x * freqFactor * 1.85 - phaseShift * 1.4) * 0.35) *
          amp *
          env;
      points.push(`${x === 0 ? 'M' : 'L'} ${x} ${y.toFixed(1)}`);
    }
    return points.join(' ');
  }, [cinematic.progress, synapticHz]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-between p-5 sm:p-8 select-none overflow-hidden">
      {/* Radial Cranial Assimilation Flash Overlay (Phase 4) */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-75"
        style={{
          opacity: cinematic.flashOpacity,
          background:
            'radial-gradient(circle at center, rgba(254,240,138,0.92) 0%, rgba(34,211,238,0.78) 45%, rgba(192,132,252,0.5) 75%, rgba(2,6,23,0.95) 100%)',
        }}
      />

      {/* Top Peripheral Biometric Header (Leaves center 3D viewport 100% unobstructed) */}
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        {/* Left: Species & Encephalization Telemetry */}
        <div className="bg-slate-950/75 border border-cyan-500/30 rounded-xl px-4 py-3 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.65)]">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-cyan-300/80">
            TELEMETRÍA NEURO-EVOLUTIVA · SALTO A TIERRA FIRME
          </div>
          <div className="mt-0.5 text-sm sm:text-base font-display font-bold text-white tracking-wide">
            {cinematic.speciesName}
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center gap-6">
            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                CAPACIDAD CRANEAL
              </div>
              <div className="text-lg sm:text-xl font-mono font-bold text-amber-300 tabular-nums">
                {cinematic.brainVolumeCc}{' '}
                <span className="text-xs font-normal text-amber-200/70">
                  cm³
                </span>
              </div>
            </div>

            <div className="h-7 w-px bg-white/10" />

            <div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                CADENCIA SINÁPTICA
              </div>
              <div className="text-lg sm:text-xl font-mono font-bold text-cyan-300 tabular-nums">
                {synapticHz}{' '}
                <span className="text-xs font-normal text-cyan-200/70">Hz</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Live EEG Brainwave Monitor & Skip Action */}
        <div className="flex flex-col items-end gap-2.5">
          <div className="bg-slate-950/75 border border-cyan-500/30 rounded-xl px-3.5 py-2.5 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between gap-4 mb-1">
              <span className="text-[9px] font-mono uppercase tracking-widest text-slate-400">
                OSCILOSCOPIO CORTICAL (EEG)
              </span>
              <span className="text-[10px] font-mono text-fuchsia-300 tabular-nums">
                FASE {activePhase + 1}/4
              </span>
            </div>
            <svg
              width="220"
              height="44"
              viewBox="0 0 220 44"
              className="overflow-visible"
            >
              <line
                x1="0"
                y1="22"
                x2="220"
                y2="22"
                stroke="rgba(148,163,184,0.18)"
                strokeDasharray="3 3"
              />
              <path
                d={eegPathData}
                fill="none"
                stroke="url(#eegGradient)"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="eegGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="55%" stopColor="#c084fc" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <button
            type="button"
            onClick={() => {
              audioManager.playButtonClick();
              onSkip();
            }}
            onMouseEnter={() => audioManager.playButtonHover()}
            className="pointer-events-auto px-3.5 py-2 rounded-lg bg-slate-950/80 hover:bg-slate-900 text-slate-200 hover:text-white border border-white/15 hover:border-cyan-400/50 text-xs font-mono uppercase tracking-wider transition-all backdrop-blur-md shadow-lg cursor-pointer"
          >
            Omitir Secuencia [Espacio]
          </button>
        </div>
      </div>

      {/* Bottom Peripheral Phase Narrative & Luminescent Progress Bar */}
      <div className="relative z-10 max-w-3xl w-full mx-auto bg-slate-950/80 border border-cyan-500/30 rounded-xl px-5 py-4 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
        {/* 4-Stage Stepper Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3">
          {PHASE_LABELS.map((label, idx) => {
            const isCompleted = idx < activePhase;
            const isCurrent = idx === activePhase;
            return (
              <div
                key={label}
                className={`px-2 py-1 rounded border text-[9px] font-mono tracking-wider truncate transition-colors ${
                  isCurrent
                    ? 'bg-cyan-500/15 border-cyan-400/60 text-cyan-200 font-semibold'
                    : isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300/80'
                    : 'bg-slate-900/50 border-white/5 text-slate-500'
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>

        <div className="flex items-baseline justify-between gap-4 mb-1">
          <h2 className="text-base sm:text-lg font-display font-bold text-white tracking-wide">
            {cinematic.phaseTitle}
          </h2>
          <span className="text-xs font-mono font-bold text-cyan-300 tabular-nums shrink-0">
            {progressPercent}%
          </span>
        </div>

        <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed mb-3">
          {cinematic.phaseSubtitle}
        </p>

        {/* Luminescent Progress Bar */}
        <div className="w-full h-2 rounded-sm bg-slate-900/95 overflow-hidden border border-white/10 p-0.5">
          <div
            className="h-full rounded-xs bg-gradient-to-r from-amber-400 via-cyan-300 to-emerald-400 transition-all duration-100 shadow-[0_0_14px_rgba(34,211,238,0.8)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
