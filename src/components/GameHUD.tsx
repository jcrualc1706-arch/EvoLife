import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Dna,
  Footprints,
  HeartHandshake,
  Pause,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { GameUISnapshot, InputState } from '../game/types';
import { DnaCounter } from './DnaCounter';
import { HealthEnergyBars } from './HealthEnergyBars';
import { ThreatRadar } from './ThreatRadar';

interface GameHUDProps {
  snapshot: GameUISnapshot;
  onTogglePause: () => void;
  onToggleEditor: () => void;
  onEvolveToCreatureStage: () => void;
  onRestart: () => void;
  onControlInput: (key: keyof InputState, active: boolean) => void;
}

const MEMBRANE_CONTAINER_CLASS =
  'border border-cyan-300/25 border-t-cyan-300/45 bg-gradient-to-b from-cyan-950/70 via-[#041a29]/80 to-teal-950/75 backdrop-blur-xl shadow-[0_8px_32px_rgba(4,25,41,0.5),0_0_15px_rgba(34,211,238,0.15),inset_0_1px_1px_rgba(165,243,252,0.22)]';

export const GameHUD: React.FC<GameHUDProps> = React.memo(
  ({
    snapshot,
    onTogglePause,
    onToggleEditor,
    onEvolveToCreatureStage,
    onRestart,
    onControlInput,
  }) => {
    const prefersReducedMotion = useReducedMotion();
    const [confirmingRestart, setConfirmingRestart] = useState(false);
    const [confirmingLandJump, setConfirmingLandJump] = useState(false);

    const {
      stats,
      nearestSpeciesName,
      nearestPredatorState,
      nearestPredatorDistance,
      currentBiomeName,
      activeQuestTitle,
      activeQuestProgressText,
      readyForLandTransition,
      recentEventMessage,
      evolutionSlots,
    } = snapshot;

    const isCreatureStage = stats.evolutionaryStage === 'creature_stage';

    const {
      availableUpgradesCount,
      hasWings,
      hasVocalCrest,
      hasChemoreceptor,
    } = useMemo(() => {
      let available = 0;
      let wings = false;
      let crest = false;
      let chemo = false;
      for (const s of evolutionSlots) {
        if (s.unlocked) {
          if (s.id === 'wings_1') wings = true;
          if (s.id === 'vocal_crest') crest = true;
          if (s.id === 'chemoreceptor') chemo = true;
        }
        const stageAllowed = s.stage === 'cell_stage' || isCreatureStage;
        const isDiscovered = s.discoveryState !== 'locked_hidden';
        if (
          stageAllowed &&
          isDiscovered &&
          s.installedStacks < s.maxStacks &&
          stats.adn >= s.costAdn
        ) {
          available++;
        }
      }
      return {
        availableUpgradesCount: available,
        hasWings: isCreatureStage && wings,
        hasVocalCrest: crest,
        hasChemoreceptor: chemo,
      };
    }, [evolutionSlots, isCreatureStage, stats.adn]);

    const dietLabel =
      stats.diet === 'omnivore'
        ? 'Omnívoro'
        : stats.diet === 'carnivore'
        ? 'Carnívoro'
        : 'Herbívoro';

    const dietColorClass =
      stats.diet === 'omnivore'
        ? 'text-amber-300'
        : stats.diet === 'carnivore'
        ? 'text-rose-300'
        : 'text-emerald-300';

    const stageNameMap: Record<number, string> = {
      1: 'Micro-Organismo',
      2: 'Célula Desarrollada',
      3: 'Complejo Pluricelular',
      4: 'Macro-Célula Dominante',
      5: 'Leviatán Celular',
    };

    const traitLabelMap: Record<string, string> = {
      elastic_membrane: 'Membrana Elástica',
      thermophilic_cytoplasm: 'Citoplasma Termófilo',
      voracious_chemotaxis: 'Quimiotaxis Voraz',
      abyssal_bioluminescence: 'Bioluminiscencia Abisal',
    };

    const stageLabel = isCreatureStage
      ? 'Criatura Terrestre'
      : `Etapa ${stats.growthStage}/5 · ${stageNameMap[stats.growthStage] ?? 'Célula'}`;

    const hasActiveAbility = Boolean(stats.activeStatusEffect);
    const abilityReady = stats.abilityCooldownRatio >= 0.99;

    // Circular cooldown ring geometry (r = 12 => circumference = 75.4)
    const ringCircumference = 75.4;
    const ringDashOffset =
      ringCircumference *
      (1 - Math.max(0, Math.min(1, stats.abilityCooldownRatio)));

    return (
      <motion.div
        initial={
          prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }
        }
        animate={{ opacity: 1, y: 0 }}
        exit={
          prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }
        }
        transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
        className={`pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-5 ${
          isCreatureStage ? 'theme-creature' : 'theme-cell'
        }`}
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
        }}
      >
        {/* TOP PERIPHERAL BAR + COMPACT MISSION & TOAST */}
        <div className="flex flex-col gap-2.5">
          {/* Unified Top Bar Row */}
          <header className="flex w-full flex-wrap items-center justify-between gap-3">
            {/* Top-Left: Species Identity Organic Capsule */}
            <div
              className={`pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2 ${MEMBRANE_CONTAINER_CLASS}`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                  isCreatureStage
                    ? 'border-amber-200/70 bg-gradient-to-b from-amber-300/35 to-amber-700/40 text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.35)]'
                    : 'border-cyan-200/70 bg-gradient-to-b from-cyan-300/35 to-teal-700/40 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.35)]'
                }`}
              >
                <Dna className="h-5 w-5" />
              </div>

              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-sm sm:text-base font-extrabold tracking-tight text-white truncate max-w-[160px] sm:max-w-[210px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                    {stats.speciesName || 'EvoLife'}
                  </h1>
                  <span aria-hidden="true" className="text-cyan-400/50">
                    ·
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${
                      isCreatureStage
                        ? 'bg-amber-400/20 text-amber-200 border border-amber-300/35'
                        : 'bg-cyan-400/20 text-cyan-100 border border-cyan-300/35'
                    }`}
                  >
                    {stageLabel}
                  </span>
                </div>

                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-cyan-100/85">
                  <span className="font-semibold text-teal-200 whitespace-nowrap">
                    {currentBiomeName}
                  </span>
                  <span aria-hidden="true" className="text-cyan-400/50">
                    ·
                  </span>
                  <span className={`font-bold ${dietColorClass}`}>
                    {dietLabel}
                  </span>
                  <span aria-hidden="true" className="text-cyan-400/50">
                    ·
                  </span>
                  <span className="font-semibold text-amber-200/90 whitespace-nowrap">
                    {traitLabelMap[stats.innateTrait] ?? 'Membrana Elástica'}
                  </span>
                </div>
              </div>
            </div>

            {/* Top-Center: Organic Fluid Health/Energy Capsules + Fossil Amber DNA Counter */}
            <div
              className={`pointer-events-auto flex flex-wrap items-center gap-4 rounded-[28px] px-5 py-2.5 ${MEMBRANE_CONTAINER_CLASS}`}
            >
              <HealthEnergyBars
                health={stats.health}
                maxHealth={stats.maxHealth}
                energy={stats.energy}
                maxEnergy={stats.maxEnergy}
                isStarving={stats.isStarving}
                isBoosting={stats.isBoosting}
              />

              <div className="border-l border-cyan-300/20 pl-3.5">
                <DnaCounter adn={stats.adn} size="md" />
              </div>
            </div>

            {/* Top-Right: Bubble/Droplet Action Buttons (Evolucionar [E], Pausa [Esc], Reiniciar) */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleEditor}
                className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150 ${
                  availableUpgradesCount > 0
                    ? 'border border-amber-200/80 border-t-white/90 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-[0_4px_16px_rgba(251,191,36,0.45),inset_0_1px_2px_rgba(255,255,255,0.75)]'
                    : 'border border-cyan-300/45 border-t-cyan-100/70 bg-gradient-to-b from-cyan-400/30 via-cyan-600/25 to-teal-900/60 text-cyan-50 hover:from-cyan-400/40 hover:to-teal-800/70 shadow-[0_4px_14px_rgba(34,211,238,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-xl'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                <span>Evolucionar</span>
                <kbd
                  className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-bold ${
                    availableUpgradesCount > 0
                      ? 'bg-amber-950/25 text-slate-950'
                      : 'bg-cyan-950/70 text-cyan-200 border border-cyan-300/30'
                  }`}
                >
                  E
                </kbd>
                {availableUpgradesCount > 0 && (
                  <span className="rounded-full bg-[#041a29] px-2 py-0.5 font-mono text-xs font-extrabold tabular-nums text-amber-300 shadow-inner">
                    {availableUpgradesCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={onTogglePause}
                className="flex items-center gap-1.5 rounded-full border border-cyan-400/40 border-t-cyan-200/60 bg-cyan-500/20 hover:bg-cyan-500/35 px-3.5 py-2.5 text-xs font-bold text-cyan-100 shadow-[0_2px_10px_rgba(34,211,238,0.2),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-xl whitespace-nowrap shrink-0 cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150"
              >
                <Pause className="h-4 w-4 text-cyan-200" />
                <span className="hidden sm:inline">Pausa</span>
                <kbd className="rounded-full bg-cyan-950/70 border border-cyan-300/30 px-2 py-0.5 font-mono text-[11px] text-cyan-200">
                  Esc
                </kbd>
              </button>

              {!confirmingRestart ? (
                <button
                  type="button"
                  onClick={() => setConfirmingRestart(true)}
                  title="Reiniciar partida"
                  aria-label="Reiniciar partida"
                  className="flex items-center gap-1.5 rounded-full border border-cyan-400/35 border-t-cyan-200/50 bg-cyan-500/15 hover:bg-rose-500/25 hover:border-rose-300/50 px-3 py-2.5 text-xs font-semibold text-cyan-200 hover:text-rose-100 shadow-[0_2px_10px_rgba(34,211,238,0.15)] backdrop-blur-xl shrink-0 cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="hidden xl:inline">Reiniciar</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 rounded-full border border-rose-300/50 bg-gradient-to-b from-rose-950/85 to-[#041a29]/90 p-1 backdrop-blur-xl shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingRestart(false);
                      onRestart();
                    }}
                    className="rounded-full bg-gradient-to-b from-rose-400 to-rose-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-[0_2px_10px_rgba(244,63,94,0.4)] cursor-pointer whitespace-nowrap active:scale-95 transition-transform duration-150"
                  >
                    ¿Reiniciar?
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRestart(false)}
                    className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-cyan-100 hover:text-white cursor-pointer active:scale-95 transition-transform duration-150"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Compact Organic Mission Bubble + Live Polite Toast */}
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div
              className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-3xl px-4 py-2.5 ${MEMBRANE_CONTAINER_CLASS}`}
            >
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                  isCreatureStage
                    ? 'border-amber-300/50 bg-amber-400/20 text-amber-200'
                    : 'border-cyan-300/50 bg-cyan-400/20 text-cyan-200'
                }`}
              >
                <Compass className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xs font-extrabold text-white">
                    {activeQuestTitle}
                  </span>
                  {readyForLandTransition && !isCreatureStage && (
                    <button
                      type="button"
                      onClick={() => setConfirmingLandJump(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-2.5 py-0.5 text-xs font-extrabold text-slate-950 shadow-[0_2px_10px_rgba(251,191,36,0.45)] cursor-pointer whitespace-nowrap hover:scale-[1.03] active:scale-95 transition-all duration-150"
                    >
                      <Footprints className="h-3 w-3" />
                      <span>Salto Terrestre</span>
                    </button>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-cyan-100/90 leading-snug">
                  {activeQuestProgressText}
                </p>

                {confirmingLandJump && !isCreatureStage && (
                  <div className="mt-2.5 rounded-2xl border border-amber-300/50 bg-[#041a29]/90 p-3 shadow-inner">
                    <div className="flex items-start gap-2 text-xs text-amber-100">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
                      <span>
                        ¿Confirmar transición irreversible a Criatura Terrestre?
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingLandJump(false);
                          onEvolveToCreatureStage();
                        }}
                        className="rounded-full bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 px-3.5 py-1 text-xs font-extrabold text-slate-950 shadow-[0_2px_10px_rgba(251,191,36,0.4)] cursor-pointer active:scale-95 transition-transform duration-150"
                      >
                        Confirmar salto
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingLandJump(false)}
                        className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/35 cursor-pointer active:scale-95 transition-transform duration-150"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Polite Bubble Toast for Recent Events or Starvation */}
            <div
              aria-live="polite"
              aria-atomic="true"
              className="pointer-events-none"
            >
              {stats.isStarving ? (
                <div className="flex items-center gap-2 rounded-full border border-rose-300/60 border-t-rose-200/80 bg-gradient-to-b from-rose-900/85 to-rose-950/90 px-4 py-2 text-xs font-bold text-rose-100 backdrop-blur-xl shadow-[0_8px_24px_rgba(244,63,94,0.35)]">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300 animate-pulse" />
                  <span>
                    Sin bioenergía: Pierdes vitalidad. Busca nutrientes o una fumarola.
                  </span>
                </div>
              ) : recentEventMessage ? (
                <div
                  className={`rounded-full px-4 py-2 text-xs font-bold text-cyan-100 ${MEMBRANE_CONTAINER_CLASS}`}
                >
                  {recentEventMessage}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* BOTTOM PERIPHERAL ORGANIC CAPSULE SKILL BAR & THREAT RADAR */}
        <div
          className={`pointer-events-auto mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-[28px] px-5 py-2.5 ${MEMBRANE_CONTAINER_CLASS}`}
        >
          {/* Touch-Only WASD Bubble Pad: strictly shown on coarse pointer devices */}
          <div className="hidden [@media(pointer:coarse)]:flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={() => onControlInput('left', true)}
              onPointerUp={() => onControlInput('left', false)}
              onPointerLeave={() => onControlInput('left', false)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/20 font-mono text-xs font-bold text-cyan-100 active:scale-95 active:bg-cyan-400/40 cursor-pointer transition-transform duration-150"
            >
              A
            </button>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onPointerDown={() => onControlInput('forward', true)}
                onPointerUp={() => onControlInput('forward', false)}
                onPointerLeave={() => onControlInput('forward', false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/20 font-mono text-xs font-bold text-cyan-100 active:scale-95 active:bg-cyan-400/40 cursor-pointer transition-transform duration-150"
              >
                W
              </button>
              <button
                type="button"
                onPointerDown={() => onControlInput('backward', true)}
                onPointerUp={() => onControlInput('backward', false)}
                onPointerLeave={() => onControlInput('backward', false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/20 font-mono text-xs font-bold text-cyan-100 active:scale-95 active:bg-cyan-400/40 cursor-pointer transition-transform duration-150"
              >
                S
              </button>
            </div>
            <button
              type="button"
              onPointerDown={() => onControlInput('right', true)}
              onPointerUp={() => onControlInput('right', false)}
              onPointerLeave={() => onControlInput('right', false)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-500/20 font-mono text-xs font-bold text-cyan-100 active:scale-95 active:bg-cyan-400/40 cursor-pointer transition-transform duration-150"
            >
              D
            </button>
          </div>

          {/* Skill Bar with Droplet Keycaps */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* [Espacio] Boost or Jump/Glide */}
            <button
              type="button"
              onPointerDown={() => onControlInput('boost', true)}
              onPointerUp={() => onControlInput('boost', false)}
              onPointerLeave={() => onControlInput('boost', false)}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150 ${
                stats.isBoosting
                  ? 'border-cyan-200 bg-gradient-to-b from-cyan-300/45 to-teal-500/40 text-white shadow-[0_0_18px_rgba(34,211,238,0.5)]'
                  : 'border-cyan-400/40 border-t-cyan-200/60 bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-100 shadow-[0_2px_10px_rgba(34,211,238,0.2)]'
              }`}
            >
              <kbd className="rounded-full border border-cyan-300/40 bg-[#031521]/80 px-2.5 py-0.5 font-mono text-[11px] font-bold text-cyan-200">
                Espacio
              </kbd>
              <span>{hasWings ? 'Saltar / Planear' : 'Impulso Acuático'}</span>
            </button>

            {/* [Q] Active Weapon with Circular Cooldown Ring */}
            <button
              type="button"
              onPointerDown={() => onControlInput('ability', true)}
              onPointerUp={() => onControlInput('ability', false)}
              onPointerLeave={() => onControlInput('ability', false)}
              className={`flex items-center gap-2.5 rounded-full border px-4 py-1.5 text-xs font-extrabold whitespace-nowrap shrink-0 cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150 ${
                !hasActiveAbility
                  ? 'border-cyan-400/25 bg-cyan-950/40 text-cyan-200/60'
                  : abilityReady
                  ? 'border-emerald-300/65 border-t-emerald-100/80 bg-gradient-to-b from-emerald-400/30 via-teal-500/25 to-emerald-900/40 text-emerald-100 shadow-[0_0_16px_rgba(52,211,153,0.35)]'
                  : 'border-cyan-400/40 bg-cyan-500/20 text-cyan-100'
              }`}
            >
              {/* Circular SVG Cooldown Ring around Keycap Q */}
              <div className="relative flex h-7 w-7 items-center justify-center">
                <svg
                  viewBox="0 0 32 32"
                  className="h-7 w-7 -rotate-90"
                  aria-hidden="true"
                >
                  <circle
                    cx="16"
                    cy="16"
                    r="12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="text-cyan-950/90"
                  />
                  {hasActiveAbility && (
                    <circle
                      cx="16"
                      cy="16"
                      r="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringDashOffset}
                      strokeLinecap="round"
                      className={
                        abilityReady ? 'text-emerald-300' : 'text-cyan-300'
                      }
                    />
                  )}
                </svg>
                <kbd className="absolute font-mono text-xs font-extrabold text-white">
                  Q
                </kbd>
              </div>

              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-emerald-300" />
                <span>
                  {stats.activeStatusEffect ?? 'Sin órgano activo'}
                </span>
              </span>
            </button>

            {/* [C] Socializar (Only in Creature Stage) */}
            {isCreatureStage && (
              <button
                type="button"
                onPointerDown={() => onControlInput('socialize', true)}
                onPointerUp={() => onControlInput('socialize', false)}
                onPointerLeave={() => onControlInput('socialize', false)}
                className="flex items-center gap-2 rounded-full border border-amber-300/60 border-t-amber-100/80 bg-gradient-to-b from-amber-300/30 via-amber-500/25 to-amber-900/40 px-4 py-2 text-xs font-extrabold text-amber-100 shadow-[0_2px_12px_rgba(251,191,36,0.3)] whitespace-nowrap shrink-0 cursor-pointer hover:scale-[1.03] active:scale-95 transition-all duration-150"
              >
                <kbd className="rounded-full border border-amber-300/40 bg-[#031521]/80 px-2 py-0.5 font-mono text-xs font-bold text-amber-200">
                  C
                </kbd>
                <HeartHandshake className="h-3.5 w-3.5 text-amber-300" />
                <span>
                  Socializar ({hasVocalCrest ? '+35 ADN' : '+20 ADN'})
                </span>
              </button>
            )}
          </div>

          {/* Right End: Threat Radar */}
          <div className="border-l border-cyan-300/20 pl-4">
            <ThreatRadar
              nearestSpeciesName={nearestSpeciesName}
              nearestPredatorState={nearestPredatorState}
              nearestPredatorDistance={nearestPredatorDistance}
              nearestHasUncataloguedGene={snapshot.nearestHasUncataloguedGene}
              hasChemoreceptor={hasChemoreceptor}
            />
          </div>
        </div>
      </motion.div>
    );
  }
);

GameHUD.displayName = 'GameHUD';
