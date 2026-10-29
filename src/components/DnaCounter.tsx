import React, { useEffect, useRef, useState } from 'react';
import { Dna } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface DnaCounterProps {
  adn: number;
  size?: 'md' | 'lg';
}

interface FloatingDelta {
  id: number;
  delta: number;
}

export const DnaCounter: React.FC<DnaCounterProps> = React.memo(
  ({ adn, size = 'md' }) => {
    const prefersReducedMotion = useReducedMotion();
    const [displayedAdn, setDisplayedAdn] = useState(adn);
    const [floatingDelta, setFloatingDelta] = useState<FloatingDelta | null>(
      null
    );
    const prevAdnRef = useRef(adn);
    const deltaIdRef = useRef(0);

    useEffect(() => {
      const diff = adn - prevAdnRef.current;
      prevAdnRef.current = adn;

      if (diff !== 0) {
        deltaIdRef.current += 1;
        setFloatingDelta({ id: deltaIdRef.current, delta: diff });
        const clearTimer = window.setTimeout(() => {
          setFloatingDelta(null);
        }, 1250);

        if (prefersReducedMotion) {
          setDisplayedAdn(adn);
          return () => window.clearTimeout(clearTimer);
        }

        const startVal = displayedAdn;
        const duration = 260;
        const startTime = performance.now();
        let rafId = 0;

        const step = (now: number) => {
          const progress = Math.min(1, (now - startTime) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplayedAdn(Math.round(startVal + (adn - startVal) * eased));
          if (progress < 1) {
            rafId = requestAnimationFrame(step);
          }
        };
        rafId = requestAnimationFrame(step);

        return () => {
          window.clearTimeout(clearTimer);
          cancelAnimationFrame(rafId);
        };
      }
      setDisplayedAdn(adn);
      return undefined;
    }, [adn, displayedAdn, prefersReducedMotion]);

    const isLarge = size === 'lg';

    return (
      <div className="relative flex items-center gap-2.5 rounded-full border border-amber-300/50 border-t-amber-100/80 bg-gradient-to-b from-amber-300/25 via-amber-500/20 to-amber-950/50 px-3.5 py-1.5 shadow-[0_0_20px_rgba(251,191,36,0.32),inset_0_1px_2px_rgba(254,243,199,0.5)]">
        {/* Glowing Fossil Amber Droplet Icon */}
        <div
          className={`flex shrink-0 items-center justify-center rounded-full border border-amber-200/70 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-slate-950 shadow-[0_0_14px_rgba(251,191,36,0.65),inset_0_1px_2px_rgba(255,255,255,0.75)] ${
            isLarge ? 'h-9 w-9' : 'h-8 w-8'
          }`}
        >
          <Dna className={isLarge ? 'h-5 w-5' : 'h-4 w-4'} />
        </div>

        <div className="pr-1">
          <div className="text-[10px] font-bold tracking-wider uppercase text-amber-200/90 leading-tight">
            Ámbar ADN
          </div>
          <div
            className={`font-mono font-extrabold tabular-nums text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] leading-none ${
              isLarge ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
            }`}
          >
            {displayedAdn}
          </div>
        </div>

        <AnimatePresence>
          {floatingDelta && (
            <motion.span
              key={floatingDelta.id}
              initial={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, y: 8, scale: 0.85 }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: -16, scale: 1.05 }
              }
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 360, damping: 20 }}
              className={`pointer-events-none absolute -top-3 right-0 rounded-full border px-2 py-0.5 font-mono text-xs font-extrabold tabular-nums shadow-lg ${
                floatingDelta.delta > 0
                  ? 'border-amber-100 bg-gradient-to-b from-amber-200 to-amber-400 text-slate-950 shadow-[0_0_14px_rgba(251,191,36,0.65)]'
                  : 'border-rose-200/60 bg-gradient-to-b from-rose-400 to-rose-600 text-white'
              }`}
            >
              {floatingDelta.delta > 0
                ? `+${floatingDelta.delta}`
                : floatingDelta.delta}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

DnaCounter.displayName = 'DnaCounter';
