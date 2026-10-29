import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Zap } from 'lucide-react';

interface HealthEnergyBarsProps {
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  isStarving: boolean;
  isBoosting: boolean;
}

export const HealthEnergyBars: React.FC<HealthEnergyBarsProps> = React.memo(
  ({ health, maxHealth, energy, maxEnergy, isStarving, isBoosting }) => {
    const safeMaxHealth = Math.max(1, maxHealth);
    const safeMaxEnergy = Math.max(1, maxEnergy);

    const healthPct = Math.max(
      0,
      Math.min(100, (health / safeMaxHealth) * 100)
    );
    const energyPct = Math.max(
      0,
      Math.min(100, (energy / safeMaxEnergy) * 100)
    );

    // Ghost bar for recent damage feedback
    const [ghostHealthPct, setGhostHealthPct] = useState(healthPct);

    useEffect(() => {
      if (healthPct >= ghostHealthPct) {
        setGhostHealthPct(healthPct);
        return;
      }
      const timeoutId = window.setTimeout(() => {
        setGhostHealthPct(healthPct);
      }, 380);
      return () => window.clearTimeout(timeoutId);
    }, [healthPct, ghostHealthPct]);

    const roundedHealth = Math.ceil(health);
    const roundedEnergy = Math.ceil(energy);
    const isCriticalHealth = healthPct > 0 && healthPct < 30;
    const isCriticalEnergy = energyPct < 30;

    return (
      <div className="flex flex-wrap items-center gap-4 sm:gap-5">
        {/* VIDA (Organic Liquid Chlorophyll/Mint Capsule) */}
        <div className="w-36 sm:w-44">
          <div className="mb-1 flex items-center justify-between gap-2 px-1">
            <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-teal-100">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                  isCriticalHealth
                    ? 'border-rose-300/60 bg-rose-500/30 text-rose-200 animate-pulse'
                    : 'border-emerald-300/60 bg-emerald-400/25 text-emerald-200 shadow-[0_0_8px_rgba(52,211,153,0.45)]'
                }`}
              >
                <Activity className="h-2.5 w-2.5 shrink-0" />
              </span>
              <span>Vitalidad</span>
            </span>
            <span
              className={`font-mono text-xs font-extrabold tabular-nums ${
                isCriticalHealth ? 'text-rose-200' : 'text-emerald-100'
              }`}
            >
              {roundedHealth} / {maxHealth}
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="Vida del organismo"
            aria-valuenow={roundedHealth}
            aria-valuemin={0}
            aria-valuemax={maxHealth}
            className={`relative h-4 w-full overflow-hidden rounded-full border-2 bg-[#02121d]/85 p-0.5 ${
              isCriticalHealth
                ? 'border-rose-400/70 shadow-[0_0_16px_rgba(244,63,94,0.45),inset_0_2px_5px_rgba(0,0,0,0.75)]'
                : 'border-emerald-300/40 shadow-[0_0_14px_rgba(16,185,129,0.2),inset_0_2px_5px_rgba(0,0,0,0.75)]'
            }`}
          >
            {/* Recent damage ghost fluid */}
            <div
              className="
                absolute inset-y-0.5 left-0.5 rounded-full bg-rose-400/60
                transition-transform duration-500 ease-out origin-left
              "
              style={{
                width: 'calc(100% - 4px)',
                transform: `scaleX(${ghostHealthPct / 100})`,
              }}
            />
            {/* Current organic liquid health fill */}
            <div
              className={`relative h-full rounded-full transition-transform duration-200 ease-out origin-left ${
                isCriticalHealth
                  ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-300 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.65)]'
                  : healthPct <= 55
                  ? 'bg-gradient-to-r from-teal-500 via-emerald-400 to-amber-300 shadow-[0_0_10px_rgba(52,211,153,0.45)]'
                  : 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-200 shadow-[0_0_12px_rgba(52,211,153,0.55)]'
              }`}
              style={{
                width: '100%',
                transform: `scaleX(${healthPct / 100})`,
              }}
            />
            {/* Top curved glass bubble highlight */}
            <div className="pointer-events-none absolute inset-x-2 top-[2px] h-[3px] rounded-full bg-gradient-to-r from-white/45 via-white/25 to-transparent" />
          </div>
        </div>

        {/* ENERGÍA (Organic Liquid Ultramarine-to-Cyan Capsule) */}
        <div className="w-36 sm:w-44">
          <div className="mb-1 flex items-center justify-between gap-2 px-1">
            <span className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-cyan-100">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                  isStarving
                    ? 'border-rose-300/60 bg-rose-500/30 text-rose-200 animate-pulse'
                    : isCriticalEnergy
                    ? 'border-amber-300/60 bg-amber-400/25 text-amber-200 animate-pulse'
                    : 'border-cyan-300/60 bg-cyan-400/25 text-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.45)]'
                }`}
              >
                <Zap className="h-2.5 w-2.5 shrink-0" />
              </span>
              <span>Bioenergía</span>
              {isStarving && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/30 px-1.5 py-0.2 text-[10px] font-bold text-rose-200">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  <span>Hambre</span>
                </span>
              )}
            </span>
            <span
              className={`font-mono text-xs font-extrabold tabular-nums ${
                isStarving ? 'text-rose-200' : 'text-cyan-100'
              }`}
            >
              {roundedEnergy} / {maxEnergy}
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="Energía metabólica"
            aria-valuenow={roundedEnergy}
            aria-valuemin={0}
            aria-valuemax={maxEnergy}
            className={`relative h-4 w-full overflow-hidden rounded-full border-2 bg-[#02121d]/85 p-0.5 ${
              isStarving
                ? 'border-rose-400/70 shadow-[0_0_16px_rgba(244,63,94,0.45),inset_0_2px_5px_rgba(0,0,0,0.75)]'
                : 'border-cyan-300/40 shadow-[0_0_14px_rgba(34,211,238,0.22),inset_0_2px_5px_rgba(0,0,0,0.75)]'
            }`}
          >
            <div
              className={`h-full rounded-full transition-transform duration-200 ease-out origin-left ${
                isStarving
                  ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-amber-400'
                  : isCriticalEnergy
                  ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-200 animate-pulse'
                  : isBoosting
                  ? 'bg-gradient-to-r from-sky-500 via-cyan-300 to-white shadow-[0_0_14px_rgba(103,232,249,0.75)]'
                  : 'bg-gradient-to-r from-blue-600 via-sky-400 to-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.55)]'
              }`}
              style={{
                width: '100%',
                transform: `scaleX(${energyPct / 100})`,
              }}
            />
            {/* Top curved glass bubble highlight */}
            <div className="pointer-events-none absolute inset-x-2 top-[2px] h-[3px] rounded-full bg-gradient-to-r from-white/45 via-white/25 to-transparent" />
          </div>
        </div>
      </div>
    );
  }
);

HealthEnergyBars.displayName = 'HealthEnergyBars';
