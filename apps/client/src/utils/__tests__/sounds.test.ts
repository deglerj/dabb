import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { playSound, setMuted } from '../sounds.js';

/**
 * Sound effects must go through the Web Audio API. A plain HTMLAudioElement gets
 * exclusive audio focus on Android, which pauses the user's background music
 * (regression: 4.6.1).
 */
describe('playSound', () => {
  const start = vi.fn();
  const audioConstructor = vi.fn();

  beforeEach(() => {
    start.mockClear();
    audioConstructor.mockClear();

    const buffer = {} as AudioBuffer;
    vi.stubGlobal(
      'AudioContext',
      class {
        destination = {};
        resume = vi.fn().mockResolvedValue(undefined);
        decodeAudioData = vi.fn().mockResolvedValue(buffer);
        createGain = () => ({ gain: { value: 0 }, connect: () => ({}) });
        createBufferSource = () => ({
          buffer: null,
          connect: () => ({ connect: () => ({}) }),
          start,
        });
      }
    );
    vi.stubGlobal('Audio', audioConstructor);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })
    );
    setMuted(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('plays through Web Audio, never an HTMLAudioElement (regression)', async () => {
    playSound('card-play');
    await vi.waitFor(() => expect(start).toHaveBeenCalled());
    expect(audioConstructor).not.toHaveBeenCalled();
  });

  it('stays silent while muted', async () => {
    setMuted(true);
    playSound('card-play');
    await Promise.resolve();
    expect(start).not.toHaveBeenCalled();
    setMuted(false);
  });
});
