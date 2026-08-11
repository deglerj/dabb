import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MELD_SHOWCASE_DURATION_MS } from '@dabb/shared-types';
import type { GameEvent, Meld, PlayerIndex } from '@dabb/shared-types';
import { useMeldShowcase } from '../useMeldShowcase.js';

let sequence = 0;

function event<T extends GameEvent['type']>(
  type: T,
  payload: unknown,
  ageMs = 0
): Extract<GameEvent, { type: T }> {
  return {
    id: `e${++sequence}`,
    sessionId: 'S',
    sequence,
    timestamp: Date.now() - ageMs,
    type,
    payload,
  } as Extract<GameEvent, { type: T }>;
}

const paar = (cards: string[]): Meld => ({ type: 'paar', cards, points: 20, suit: 'herz' });

function declared(playerIndex: PlayerIndex, melds: Meld[], ageMs = 0): GameEvent {
  return event(
    'MELDS_DECLARED',
    { playerIndex, melds, totalPoints: melds.reduce((s, m) => s + m.points, 0) },
    ageMs
  );
}

function meldingComplete(ageMs = 0): GameEvent {
  return event('MELDING_COMPLETE', { meldScores: {} }, ageMs);
}

describe('useMeldShowcase', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sequence = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('queues the other players in seat order, skipping the local player', () => {
    const events = [
      declared(1, [paar(['herz-ober-1', 'herz-koenig-1'])]),
      declared(2, [paar(['schippe-ober-1', 'schippe-koenig-1'])]),
      declared(0, [paar(['kreuz-ober-1', 'kreuz-koenig-1'])]),
      meldingComplete(),
    ];
    const { result } = renderHook(() => useMeldShowcase(events, 0));

    expect(result.current?.playerIndex).toBe(1);
    expect(result.current?.cards).toEqual(['herz-ober-1', 'herz-koenig-1']);
    expect(result.current?.points).toBe(20);
    expect(result.current?.retracting).toBe(false);

    act(() => vi.advanceTimersByTime(MELD_SHOWCASE_DURATION_MS));
    expect(result.current?.playerIndex).toBe(2);

    act(() => vi.advanceTimersByTime(MELD_SHOWCASE_DURATION_MS));
    expect(result.current).toBeNull();
  });

  it('retracts before handing over to the next player', () => {
    const events = [
      declared(1, [paar(['herz-ober-1', 'herz-koenig-1'])]),
      declared(2, [paar(['schippe-ober-1', 'schippe-koenig-1'])]),
      meldingComplete(),
    ];
    const { result } = renderHook(() => useMeldShowcase(events, 0));

    expect(result.current?.retracting).toBe(false);
    act(() => vi.advanceTimersByTime(MELD_SHOWCASE_DURATION_MS - 100));
    expect(result.current?.playerIndex).toBe(1);
    expect(result.current?.retracting).toBe(true);

    act(() => vi.advanceTimersByTime(100));
    expect(result.current?.playerIndex).toBe(2);
    expect(result.current?.retracting).toBe(false);
  });

  it('deduplicates a card that pays in two melds', () => {
    const melds: Meld[] = [
      paar(['herz-ober-1', 'herz-koenig-1']),
      { type: 'vier-koenig', cards: ['herz-koenig-1', 'kreuz-koenig-1'], points: 60 },
    ];
    const events = [declared(1, melds), meldingComplete()];
    const { result } = renderHook(() => useMeldShowcase(events, 0));

    expect(result.current?.cards).toEqual(['herz-ober-1', 'herz-koenig-1', 'kreuz-koenig-1']);
    expect(result.current?.points).toBe(80);
  });

  it('skips players who declared nothing', () => {
    const events = [declared(1, []), declared(2, [paar(['a', 'b'])]), meldingComplete()];
    const { result } = renderHook(() => useMeldShowcase(events, 0));

    expect(result.current?.playerIndex).toBe(2);
  });

  it('shows only the current round (regression)', () => {
    const events = [
      declared(1, [paar(['old-1', 'old-2'])]),
      meldingComplete(60_000),
      event('CARDS_DEALT', { hands: {}, dabb: [] }),
      declared(2, [paar(['new-1', 'new-2'])]),
      meldingComplete(),
    ];
    const { result } = renderHook(() => useMeldShowcase(events, 0));

    expect(result.current?.playerIndex).toBe(2);
    expect(result.current?.cards).toEqual(['new-1', 'new-2']);
  });

  it('stays quiet for a replayed log (regression)', () => {
    // A reconnect replays every event; a MELDING_COMPLETE from minutes ago is history, not news.
    const events = [declared(1, [paar(['a', 'b'])], 60_000), meldingComplete(60_000)];
    const { result } = renderHook(() => useMeldShowcase(events, 0));

    expect(result.current).toBeNull();
  });

  it('does not restart when unrelated events arrive afterwards', () => {
    const events: GameEvent[] = [declared(1, [paar(['a', 'b'])]), meldingComplete()];
    const { result, rerender } = renderHook(({ evts }) => useMeldShowcase(evts, 0), {
      initialProps: { evts: events },
    });

    act(() => vi.advanceTimersByTime(MELD_SHOWCASE_DURATION_MS));
    expect(result.current).toBeNull();

    rerender({ evts: [...events, event('CARD_PLAYED', { playerIndex: 1, card: {} })] });
    expect(result.current).toBeNull();
  });
});
