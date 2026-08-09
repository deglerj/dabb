/**
 * Tests for the emote store — the one place the display window is enforced.
 *
 * The merge behaviour matters as much as the expiry: human emotes arrive as whole Firebase
 * snapshots while AI emotes are posted locally and never appear in those snapshots, so a
 * replacing store would wipe every bot reaction on the next snapshot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PlayerIndex } from '@dabb/shared-types';
import { EMOTE_TTL_MS } from '@dabb/shared-types';
import { useEmotes } from '../useEmotes.js';

const ALICE = 0 as PlayerIndex;
const BOT = 1 as PlayerIndex;

describe('useEmotes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a posted emote and drops it once the window passes', () => {
    const { result } = renderHook(() => useEmotes());

    act(() => result.current.post(ALICE, 'happy'));
    expect(result.current.visible.get(ALICE)).toBe('happy');

    act(() => {
      vi.advanceTimersByTime(EMOTE_TTL_MS - 1);
    });
    expect(result.current.visible.get(ALICE)).toBe('happy');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.visible.has(ALICE)).toBe(false);
  });

  it('keeps locally posted AI emotes when a Firebase snapshot arrives', () => {
    const { result } = renderHook(() => useEmotes());

    act(() => result.current.post(BOT, 'angry'));
    // The snapshot carries human seats only — bots are never written to Firebase.
    act(() => result.current.merge(new Map([[ALICE, { key: 'congrats', at: Date.now() }]])));

    expect(result.current.visible.get(BOT)).toBe('angry');
    expect(result.current.visible.get(ALICE)).toBe('congrats');
  });

  it('ignores an already-expired signal from a snapshot (reload replay)', () => {
    const { result } = renderHook(() => useEmotes());

    act(() =>
      result.current.merge(
        new Map([[ALICE, { key: 'happy', at: Date.now() - EMOTE_TTL_MS - 1000 }]])
      )
    );

    expect(result.current.visible.has(ALICE)).toBe(false);
  });

  it('keeps the newer signal per seat', () => {
    const { result } = renderHook(() => useEmotes());
    const now = Date.now();

    act(() => result.current.merge(new Map([[ALICE, { key: 'happy', at: now }]])));
    act(() => result.current.merge(new Map([[ALICE, { key: 'angry', at: now - 500 }]])));
    expect(result.current.visible.get(ALICE)).toBe('happy');

    act(() => result.current.merge(new Map([[ALICE, { key: 'confused', at: now + 500 }]])));
    expect(result.current.visible.get(ALICE)).toBe('confused');
  });
});
