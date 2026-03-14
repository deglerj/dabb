import { useSharedValue } from 'react-native-reanimated';

export interface ShadowState {
  x: number;
  y: number;
  elevation: number;
}
export interface RippleState {
  x: number;
  y: number;
  progress: number;
}
export interface ParticleState {
  x: number;
  y: number;
  active: boolean;
}

export function useSkiaEffects() {
  const shadow = useSharedValue<ShadowState>({ x: 0, y: 0, elevation: 0 });
  const ripple = useSharedValue<RippleState>({ x: 0, y: 0, progress: 0 });
  const particle = useSharedValue<ParticleState>({ x: 0, y: 0, active: false });

  function triggerCardShadow(x: number, y: number, elevation: number) {
    'worklet';
    shadow.value = { x, y, elevation };
  }

  function clearCardShadow() {
    'worklet';
    shadow.value = { x: 0, y: 0, elevation: 0 };
  }

  function triggerFeltRipple(x: number, y: number) {
    'worklet';
    ripple.value = { x, y, progress: 0 };
  }

  function triggerSweepParticles(x: number, y: number) {
    'worklet';
    particle.value = { x, y, active: true };
  }

  return {
    shadow,
    ripple,
    particle,
    triggerCardShadow,
    clearCardShadow,
    triggerFeltRipple,
    triggerSweepParticles,
  };
}

export type SkiaEffects = ReturnType<typeof useSkiaEffects>;
