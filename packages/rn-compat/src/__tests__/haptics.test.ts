import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isHapticsEnabled, setHapticsEnabled, triggerHaptic } from '../haptics.js';

const vibrate = vi.fn();

beforeEach(() => {
  vibrate.mockClear();
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
  vi.stubGlobal('navigator', { vibrate });
  setHapticsEnabled(true);
});

describe('haptics', () => {
  it('vibrates when enabled', () => {
    triggerHaptic('card-select');
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  // The overlay buttons used to vibrate through their own `navigator.vibrate`
  // call, which never consulted the options toggle (regression).
  it('stays silent for every haptic once the toggle is off', () => {
    setHapticsEnabled(false);
    expect(isHapticsEnabled()).toBe(false);

    triggerHaptic('card-select');
    triggerHaptic('card-play');
    triggerHaptic('trick-win');
    triggerHaptic('game-win');

    expect(vibrate).not.toHaveBeenCalled();
  });

  it('is a no-op where the Vibration API is missing (iOS/Safari)', () => {
    vi.stubGlobal('navigator', {});
    expect(() => triggerHaptic('card-play')).not.toThrow();
  });
});
