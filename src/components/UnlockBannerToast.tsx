import React, { useEffect } from 'react';
import { Dna, Sparkles } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { UnlockedBannerNotification } from '../game/types';
import { OrganThumbnail } from './CreatureEditorModal';

interface UnlockBannerToastProps {
  notification: UnlockedBannerNotification | null;
}

const CONFETTI_SPORES = [
  { x: -120, y: -38, color: '#facc15', size: 6, delay: 0.02 },
  { x: -85, y: 34, color: '#34d399', size: 5, delay: 0.06 },
  { x: -45, y: -44, color: '#38bdf8', size: 7, delay: 0.04 },
  { x: 0, y: -50, color: '#fde047', size: 5, delay: 0.08 },
  { x: 48, y: -42, color: '#10b981', size: 6, delay: 0.03 },
  { x: 92, y: 36, color: '#facc15', size: 5, delay: 0.07 },
  { x: 128, y: -32, color: '#67e8f9', size: 6, delay: 0.05 },
  { x: -135, y: 16, color: '#a7f3d0', size: 5, delay: 0.09 },
  { x: 138, y: 18, color: '#fde047', size: 6, delay: 0.04 },
];

function playGeneticDiscoveryChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6 arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.075);

      gain.gain.setValueAtTime(0.001, now + idx * 0.075);
      gain.gain.exponentialRampToValueAtTime(0.085, now + idx * 0.075 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.075 + 0.48);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.075);
      osc.stop(now + idx * 0.075 + 0.5);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export const UnlockBannerToast: React.FC<UnlockBannerToastProps> = React.memo(
  ({ notification }) => {
    const prefersReducedMotion = useReducedMotion();

    useEffect(() => {
      if (notification) {
        playGeneticDiscoveryChime();
      }
    }, [notification?.id]);

    return (
      <AnimatePresence mode="wait">
        {notification && (
          <motion.div
            key={notification.id}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -36, scale: 0.9 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -24, scale: 0.94 }
            }
            transition={{
              type: 'spring',
              stiffness: 340,
              damping: 22,
            }}
            role="status"
            aria-live="assertive"
            className="pointer-events-none fixed top-20 left-1/2 z-40 -translate-x-1/2 select-none"
          >
            <div className="relative flex items-center gap-4 rounded-full border-2 border-amber-300/80 border-t-amber-100 bg-gradient-to-b from-cyan-950/85 via-[#041a29]/90 to-teal-950/85 px-6 py-3.5 backdrop-blur-xl shadow-[0_8px_32px_rgba(4,25,41,0.6),0_0_38px_rgba(251,191,36,0.4),inset_0_1px_2px_rgba(254,243,199,0.4)]">
              {/* Biological Confetti Spore Particles */}
              {!prefersReducedMotion &&
                CONFETTI_SPORES.map((spore, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 0.4 }}
                    animate={{
                      opacity: [1, 0.9, 0],
                      x: spore.x,
                      y: spore.y,
                      scale: [0.5, 1.25, 0.2],
                    }}
                    transition={{
                      duration: 1.15,
                      delay: spore.delay,
                      ease: 'easeOut',
                    }}
                    className="pointer-events-none absolute left-1/2 top-1/2 rounded-full"
                    style={{
                      width: spore.size,
                      height: spore.size,
                      backgroundColor: spore.color,
                      boxShadow: `0 0 10px ${spore.color}`,
                    }}
                  />
                ))}

              {/* Rotating Golden Circular Vacuole with 3D-Style Adaptation Render */}
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                <motion.div
                  animate={
                    prefersReducedMotion ? undefined : { rotate: 360 }
                  }
                  transition={{
                    duration: 7,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  className="
                    absolute inset-0 rounded-full border-2 border-dashed border-amber-300/85
                    shadow-[0_0_20px_rgba(250,204,21,0.5)]
                  "
                />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-amber-300/60 bg-gradient-to-b from-cyan-950 to-[#031521] shadow-inner">
                  {notification.isPureAdnBonus ? (
                    <Dna className="h-6 w-6 text-amber-300" />
                  ) : (
                    <OrganThumbnail
                      slotId={notification.adaptationId}
                      locked={false}
                    />
                  )}
                </div>
              </div>

              {/* Discovery Text & Attribute Summary */}
              <div className="min-w-[230px] max-w-[400px] pr-2">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider uppercase text-amber-300">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                  <span>
                    {notification.isPureAdnBonus
                      ? '¡NÚCLEO METEÓRICO DE ADN PURO!'
                      : '¡NUEVA ADAPTACIÓN AISLADA!'}
                  </span>
                  <span aria-hidden="true" className="text-cyan-400/50">
                    ·
                  </span>
                  <span className="font-bold text-emerald-300">
                    {notification.sourceLabel}
                  </span>
                </div>

                <div className="mt-0.5 font-display text-base sm:text-lg font-extrabold tracking-tight uppercase text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                  {notification.name}
                </div>

                <div className="mt-0.5 text-xs font-semibold text-cyan-100">
                  {notification.statSummary}
                  {!notification.isPureAdnBonus && (
                    <span className="text-teal-200">
                      {' '}
                      · Disponible en el Taller [E]
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

UnlockBannerToast.displayName = 'UnlockBannerToast';
