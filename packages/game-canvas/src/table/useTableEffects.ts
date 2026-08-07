import { useRef } from 'react';

const RIPPLE_DURATION = 600;
const PARTICLE_DURATION = 700;

interface Value {
  value: number;
}

function createValue(initial: number): Value {
  return { value: initial };
}

/** A 0→1 value that advances over `durationMs` from the moment `trigger` is called. */
function createProgressValue(): Value & { trigger: (durationMs: number) => void } {
  let startTime = 0;
  let duration = 1;
  let finished = true;
  return {
    get value() {
      if (finished) {
        return 1;
      }
      const t = Math.min((performance.now() - startTime) / duration, 1);
      if (t >= 1) {
        finished = true;
        return 1;
      }
      // ease-in-out-quad, approximating reanimated's default withTiming easing
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    },
    trigger(durationMs: number) {
      startTime = performance.now();
      duration = durationMs;
      finished = false;
    },
  };
}

export function useTableEffects() {
  const ref = useRef<ReturnType<typeof createEffects> | null>(null);
  if (!ref.current) {
    ref.current = createEffects();
  }
  return ref.current;
}

function createEffects() {
  // Shadow (updated per frame during drag)
  const shadowX = createValue(0);
  const shadowY = createValue(0);
  const shadowElevation = createValue(0);

  // Ripple (progress 0→1 animated on card land)
  const rippleX = createValue(0);
  const rippleY = createValue(0);
  const rippleProgress = createProgressValue();

  // Particles (progress 0→1 animated on trick sweep)
  const particleX = createValue(0);
  const particleY = createValue(0);
  const particleProgress = createProgressValue();

  return {
    shadowX,
    shadowY,
    shadowElevation,
    rippleX,
    rippleY,
    rippleProgress,
    particleX,
    particleY,
    particleProgress,
    triggerCardShadow(x: number, y: number, elevation: number) {
      shadowX.value = x;
      shadowY.value = y;
      shadowElevation.value = elevation;
    },
    clearCardShadow() {
      shadowElevation.value = 0;
    },
    triggerFeltRipple(x: number, y: number) {
      rippleX.value = x;
      rippleY.value = y;
      rippleProgress.trigger(RIPPLE_DURATION);
    },
    triggerSweepParticles(x: number, y: number) {
      particleX.value = x;
      particleY.value = y;
      particleProgress.trigger(PARTICLE_DURATION);
    },
  };
}

export type TableEffects = ReturnType<typeof useTableEffects>;
