import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dna,
  Footprints,
  HeartHandshake,
  Sparkles,
  Wind,
  Zap,
} from 'lucide-react';
import { audioManager } from '../game/AudioManager';
import { GameUISnapshot, InputState } from '../game/types';

interface GameHUDProps {
  snapshot: GameUISnapshot;
  onTogglePause?: () => void;
  onToggleEditor: () => void;
  onToggleDevTools?: () => void;
  onEvolveToCreatureStage: () => void;
  onControlInput: (key: keyof InputState, active: boolean) => void;
}

export const GameHUD: React.FC<GameHUDProps> = React.memo(
  ({
    snapshot,
    onToggleEditor,
    onEvolveToCreatureStage,
    onControlInput,
  }) => {
    const {
      stats: playerStats,
      nearestPredatorState,
      nearestPredatorDistance,
      readyForLandTransition,
      recentEventMessage,
      evolutionSlots,
    } = snapshot;

    const isCreatureStage = playerStats.evolutionaryStage === 'creature_stage';

    // Auto-ocultado de barras de estado tras 3 segundos sin cambios relevantes en salud o energía
    const [areStatusBarsVisible, setAreStatusBarsVisible] = useState(true);
    const hideBarsTimeoutRef = useRef<number | null>(null);
    const prevHealthRef = useRef<number>(Math.round(playerStats.health));
    const prevEnergyRef = useRef<number>(Math.round(playerStats.energy));

    useEffect(() => {
      const currentHealth = Math.round(playerStats.health);
      const currentEnergy = Math.round(playerStats.energy);
      const healthChanged = currentHealth !== prevHealthRef.current;
      // Ignorar el micro-drenaje metabólico pasivo frame a frame (< 3 puntos) para permitir el ocultado en reposo/exploración
      const energyChangedSignificantly =
        Math.abs(currentEnergy - prevEnergyRef.current) >= 3;

      if (
        healthChanged ||
        energyChangedSignificantly ||
        playerStats.isBoosting ||
        playerStats.isStarving ||
        playerStats.damageFlashTime > 0 ||
        Boolean(recentEventMessage)
      ) {
        prevHealthRef.current = currentHealth;
        prevEnergyRef.current = currentEnergy;
        setAreStatusBarsVisible(true);

        if (hideBarsTimeoutRef.current !== null) {
          window.clearTimeout(hideBarsTimeoutRef.current);
        }
        hideBarsTimeoutRef.current = window.setTimeout(() => {
          setAreStatusBarsVisible(false);
          hideBarsTimeoutRef.current = null;
        }, 3000);
      }
    }, [
      playerStats.health,
      playerStats.energy,
      playerStats.isBoosting,
      playerStats.isStarving,
      playerStats.damageFlashTime,
      recentEventMessage,
    ]);

    useEffect(() => {
      hideBarsTimeoutRef.current = window.setTimeout(() => {
        setAreStatusBarsVisible(false);
        hideBarsTimeoutRef.current = null;
      }, 3000);
      return () => {
        if (hideBarsTimeoutRef.current !== null) {
          window.clearTimeout(hideBarsTimeoutRef.current);
        }
      };
    }, []);

    const { availableUpgradesCount, installedActiveOrgans } = useMemo(() => {
      let available = 0;
      const activeOrgans: { id: string; name: string }[] = [];
      for (const s of evolutionSlots) {
        if (
          s.unlocked &&
          (s.category === 'ataque' ||
            s.category === 'movimiento' ||
            s.category === 'alimentacion')
        ) {
          activeOrgans.push({ id: s.id, name: s.name });
        }
        const stageAllowed = s.stage === 'cell_stage' || isCreatureStage;
        const isDiscovered = s.discoveryState !== 'locked_hidden';
        if (
          stageAllowed &&
          isDiscovered &&
          s.installedStacks < s.maxStacks &&
          playerStats.adn >= s.costAdn
        ) {
          available++;
        }
      }
      return {
        availableUpgradesCount: available,
        installedActiveOrgans: activeOrgans.slice(0, 4),
      };
    }, [evolutionSlots, isCreatureStage, playerStats.adn]);

    const inCombatOrActive =
      areStatusBarsVisible ||
      playerStats.isBoosting ||
      playerStats.damageFlashTime > 0 ||
      Boolean(recentEventMessage) ||
      (nearestPredatorDistance < 20 &&
        (nearestPredatorState === 'PERSEGUIR' ||
          nearestPredatorState === 'ATACAR'));

    const healthPercent = Math.max(
      0,
      Math.min(100, (playerStats.health / Math.max(1, playerStats.maxHealth)) * 100)
    );
    const energyPercent = Math.max(
      0,
      Math.min(100, (playerStats.energy / Math.max(1, playerStats.maxEnergy)) * 100)
    );

    const hasActiveAbility = Boolean(playerStats.activeStatusEffect);
    const abilityReady = playerStats.abilityCooldownRatio >= 0.99;

    const activeSlots = useMemo(() => {
      const slots: {
        id: string;
        title: string;
        icon: React.ReactNode;
        isActive?: boolean;
        badgeCount?: number;
        onPointerDown?: () => void;
        onPointerUp?: () => void;
        onClick?: () => void;
      }[] = [
        {
          id: 'boost',
          title: isCreatureStage ? 'Impulso / Salto' : 'Impulso Acuático',
          icon: <Wind className="h-4 w-4 text-cyan-300" />,
          isActive: playerStats.isBoosting,
          onPointerDown: () => onControlInput('boost', true),
          onPointerUp: () => onControlInput('boost', false),
        },
        {
          id: 'ability',
          title: playerStats.activeStatusEffect ?? 'Órgano Activo',
          icon: (
            <Zap
              className={`h-4 w-4 ${
                hasActiveAbility && abilityReady
                  ? 'text-emerald-300'
                  : 'text-slate-400'
              }`}
            />
          ),
          isActive: hasActiveAbility && abilityReady,
          onPointerDown: () => onControlInput('ability', true),
          onPointerUp: () => onControlInput('ability', false),
        },
      ];

      if (isCreatureStage) {
        slots.push({
          id: 'socialize',
          title: 'Llamada Social',
          icon: <HeartHandshake className="h-4 w-4 text-amber-300" />,
          onPointerDown: () => onControlInput('socialize', true),
          onPointerUp: () => onControlInput('socialize', false),
        });
      }

      slots.push({
        id: 'evolve',
        title: 'Llamada de Apareamiento / Taller Evolutivo',
        icon: (
          <Sparkles
            className={`h-4 w-4 ${
              availableUpgradesCount > 0 ? 'text-amber-300' : 'text-cyan-200'
            }`}
          />
        ),
        isActive: availableUpgradesCount > 0,
        badgeCount: availableUpgradesCount > 0 ? availableUpgradesCount : undefined,
        onClick: () => {
          audioManager.playButtonClick();
          onToggleEditor();
        },
      });

      for (let i = 0; i < installedActiveOrgans.length && slots.length < 5; i++) {
        const org = installedActiveOrgans[i];
        slots.push({
          id: `organ-${org.id}-${i}`,
          title: org.name,
          icon: <Dna className="h-3.5 w-3.5 text-teal-300/80" />,
        });
      }

      return slots;
    }, [
      abilityReady,
      availableUpgradesCount,
      hasActiveAbility,
      installedActiveOrgans,
      isCreatureStage,
      onControlInput,
      onToggleEditor,
      playerStats.activeStatusEffect,
      playerStats.isBoosting,
    ]);

    return (
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 select-none">
        {/* Franja Superior Minimalista */}
        <div className="flex items-start justify-between gap-3">
          {/* Esquina Superior Izquierda: Píldora Compacta de Especie y ADN */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`pointer-events-auto flex items-center gap-3 rounded-full bg-slate-950/40 px-4 py-1.5 backdrop-blur-md border shadow-lg transition-all duration-300 ${
                snapshot.tutorialState?.isActive &&
                snapshot.tutorialState.currentStep === 'evolve_key'
                  ? 'border-purple-400/80 ring-2 ring-purple-400/60 shadow-[0_0_24px_rgba(168,85,247,0.55)] scale-105'
                  : 'border-white/10'
              }`}
            >
              <span className="font-bold text-sm text-cyan-200 tracking-wide truncate max-w-[180px]">
                {playerStats.speciesName || 'Especie'}
              </span>
              <div className="h-3 w-[1px] bg-white/20" />
              <span className="font-mono text-xs font-semibold text-amber-300 tabular-nums">
                {playerStats.adn} ADN
              </span>
            </div>

            {readyForLandTransition && !isCreatureStage && (
              <button
                type="button"
                onClick={() => {
                  audioManager.playButtonClick();
                  onEvolveToCreatureStage();
                }}
                className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-emerald-500/85 hover:bg-emerald-400 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 backdrop-blur-md border border-emerald-200/40 shadow-[0_0_16px_rgba(16,185,129,0.45)] transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Footprints className="h-3.5 w-3.5" />
                <span>Evolucionar a Tierra</span>
              </button>
            )}
          </div>

          {/* Esquina Superior Derecha: Barras de Estado Esenciales con Auto-Ocultado tras 3s de Inactividad */}
          <div
            className={`pointer-events-auto flex flex-col items-end gap-1.5 transition-all duration-500 ease-in-out hover:opacity-100 hover:translate-y-0 ${
              areStatusBarsVisible ||
              playerStats.isStarving ||
              (snapshot.tutorialState?.isActive &&
                snapshot.tutorialState.currentStep === 'vital_signs')
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-1'
            }`}
          >
            <div
              className={`flex flex-col gap-1 w-44 rounded-xl transition-all duration-300 ${
                snapshot.tutorialState?.isActive &&
                snapshot.tutorialState.currentStep === 'vital_signs'
                  ? 'p-1.5 bg-slate-950/65 ring-2 ring-emerald-400/75 shadow-[0_0_24px_rgba(16,185,129,0.5)]'
                  : ''
              }`}
            >
              {/* Vitalidad */}
              <div
                title={`Vitalidad: ${Math.round(playerStats.health)}/${playerStats.maxHealth}`}
                className="h-2 w-full overflow-hidden rounded-full bg-slate-900/60 backdrop-blur-md border border-white/10"
              >
                <div
                  className={`h-full transition-all duration-200 ${
                    playerStats.isStarving
                      ? 'bg-gradient-to-r from-rose-500 to-red-400'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  }`}
                  style={{ width: `${healthPercent}%` }}
                />
              </div>
              {/* Energía */}
              <div
                title={`Energía: ${Math.round(playerStats.energy)}/${playerStats.maxEnergy}`}
                className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900/60 backdrop-blur-md border border-white/5"
              >
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-200"
                  style={{ width: `${energyPercent}%` }}
                />
              </div>
            </div>

            {/* Notificación discreta y efímera solo al alimentarse, sufrir inanición o autoguardar */}
            {(playerStats.isStarving ||
              recentEventMessage ||
              snapshot.autosaveNotificationVisible) && (
              <div
                aria-live="polite"
                className="pointer-events-none text-[11px] font-medium text-cyan-100/80 bg-slate-950/35 px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-white/5"
              >
                {playerStats.isStarving
                  ? 'Sin energía: busca alimento'
                  : recentEventMessage ?? 'Autoguardado'}
              </div>
            )}
          </div>
        </div>

        {/* Franja Inferior: Órganos / Acciones Rápidas con Efecto Fade-Out en Reposo */}
        <div className="flex justify-center pb-2">
          <div
            className={`pointer-events-auto flex items-center gap-2 rounded-2xl bg-slate-950/30 px-3 py-1.5 backdrop-blur-sm border border-white/5 transition-opacity duration-500 ease-in-out ${
              inCombatOrActive ? 'opacity-95' : 'opacity-0 hover:opacity-100'
            }`}
          >
            {activeSlots.map((slot, idx) => (
              <button
                key={slot.id}
                type="button"
                title={slot.title}
                onClick={slot.onClick}
                onPointerDown={slot.onPointerDown}
                onPointerUp={slot.onPointerUp}
                onPointerLeave={slot.onPointerUp}
                className={`relative w-9 h-9 rounded-xl bg-slate-900/70 border flex items-center justify-center text-xs text-slate-300 shadow-inner transition-all duration-150 hover:scale-105 active:scale-95 cursor-pointer ${
                  slot.isActive
                    ? 'border-cyan-400/50 bg-slate-800/80 text-white'
                    : 'border-white/10 hover:border-white/25'
                }`}
              >
                {slot.icon || idx + 1}
                {slot.badgeCount !== undefined && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-400 px-1 font-mono text-[9px] font-black text-slate-950">
                    {slot.badgeCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
);

GameHUD.displayName = 'GameHUD';
