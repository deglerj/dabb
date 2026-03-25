import { useSharedValue, withTiming } from 'react-native-reanimated';

const RIPPLE_DURATION = 600;
const PARTICLE_DURATION = 700;

export function useSkiaEffects() {
  // Shadow (updated per frame during drag)
  const shadowX = useSharedValue(0);
  const shadowY = useSharedValue(0);
  const shadowElevation = useSharedValue(0);

  // Ripple (progress 0→1 animated on card land)
  const rippleX = useSharedValue(0);
  const rippleY = useSharedValue(0);
  const rippleProgress = useSharedValue(0);

  // Particles (progress 0→1 animated on trick sweep)
  const particleX = useSharedValue(0);
  const particleY = useSharedValue(0);
  const particleProgress = useSharedValue(0);

  function triggerCardShadow(x: number, y: number, elevation: number) {
    'worklet';
    shadowX.value = x;
    shadowY.value = y;
    shadowElevation.value = elevation;
  }

  function clearCardShadow() {
    'worklet';
    shadowElevation.value = 0;
  }

  function triggerFeltRipple(x: number, y: number) {
    'worklet';
    rippleX.value = x;
    rippleY.value = y;
    rippleProgress.value = 0;
    rippleProgress.value = withTiming(1, { duration: RIPPLE_DURATION });
  }

  function triggerSweepParticles(x: number, y: number) {
    'worklet';
    particleX.value = x;
    particleY.value = y;
    particleProgress.value = 0;
    particleProgress.value = withTiming(1, { duration: PARTICLE_DURATION });
  }

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
    triggerCardShadow,
    clearCardShadow,
    triggerFeltRipple,
    triggerSweepParticles,
  };
}

export type SkiaEffects = ReturnType<typeof useSkiaEffects>;
