import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MELD_SHOWCASE_DURATION_MS } from '@dabb/shared-types';
import type { Card, GameEvent, PlayerIndex } from '@dabb/shared-types';
import { useDabbShowcase } from '../useDabbShowcase.js';

/** Nothing was in the log when this client joined — every event is live. */
const NO_REPLAY = new Set<string>();

let sequence = 0;

function event<T extends GameEvent['type']>(
  type: T,
  payload: unknown
): Extract<GameEvent, { type: T }> {
  return {
    id: `e${++sequence}`,
    sessionId: 'S',
    sequence,
    timestamp: Date.now(),
    type,
    payload,
  } as Extract<GameEvent, { type: T }>;
}

const card = (id: string): Card => {
  const [suit, rank, copy] = id.split('-') as [Card['suit'], Card['rank'], string];
  return { id, suit, rank, copy: Number(copy) as 0 | 1 };
};

const DABB = ['herz-ass-0', 'herz-zehn-0', 'kreuz-buabe-1', 'bollen-ober-0'];

function dabbTaken(playerIndex: PlayerIndex): GameEvent {
  return event('DABB_TAKEN', { playerIndex, dabbCards: DABB.map(card) });
}

describe('useDabbShowcase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sequence = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the dabb to the other players and retracts it to the winner', () => {
    const events = [dabbTaken(2)];
    const { result } = renderHook(() => useDabbShowcase(events, 0, NO_REPLAY));

    expect(result.current?.playerIndex).toBe(2);
    expect(result.current?.cards).toEqual(DABB);
    expect(result.current?.retracting).toBe(false);

    act(() => vi.advanceTimersByTime(MELD_SHOWCASE_DURATION_MS - 100));
    expect(result.current?.retracting).toBe(true);

    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBeNull();
  });

  it('shows nothing to the bid winner — they have the take-dabb overlay', () => {
    const events = [dabbTaken(0)];
    const { result } = renderHook(() => useDabbShowcase(events, 0, NO_REPLAY));
    expect(result.current).toBeNull();
  });

  it('shows nothing for a dabb taken before this client joined', () => {
    const events = [dabbTaken(2)];
    const replayed = new Set(events.map((e) => e.id));
    const { result } = renderHook(() => useDabbShowcase(events, 0, replayed));
    expect(result.current).toBeNull();
  });

  it('shows the next round dabb again', () => {
    const first = [dabbTaken(1)];
    const { result, rerender } = renderHook(({ evts }) => useDabbShowcase(evts, 0, NO_REPLAY), {
      initialProps: { evts: first },
    });
    act(() => vi.advanceTimersByTime(MELD_SHOWCASE_DURATION_MS));
    expect(result.current).toBeNull();

    rerender({ evts: [...first, dabbTaken(2)] });
    expect(result.current?.playerIndex).toBe(2);
  });
});
