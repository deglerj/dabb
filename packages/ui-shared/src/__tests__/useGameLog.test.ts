import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameLog } from '../useGameLog.js';
import type { GameEvent } from '@dabb/shared-types';

const baseEvent = {
  sessionId: 'session-1',
  timestamp: Date.now(),
};

function makeEvent(
  overrides: Partial<GameEvent> & { type: GameEvent['type']; id: string; sequence: number }
): GameEvent {
  return { ...baseEvent, ...overrides } as GameEvent;
}

const startedEvent = makeEvent({
  id: 'e1',
  sequence: 1,
  type: 'GAME_STARTED',
  payload: { playerCount: 3, targetScore: 1000, dealer: 0 },
});

const trickWonEvent = makeEvent({
  id: 'e2',
  sequence: 2,
  type: 'TRICK_WON',
  payload: { winnerIndex: 0, cards: [], points: 18 },
});

const bidPlacedEvent = makeEvent({
  id: 'e3',
  sequence: 3,
  type: 'BID_PLACED',
  payload: { playerIndex: 1, amount: 160 },
});

const meldsDeclaredEvent = makeEvent({
  id: 'e4',
  sequence: 4,
  type: 'MELDS_DECLARED',
  payload: { playerIndex: 0, melds: [], totalPoints: 60 },
});

const gameFinishedEvent = makeEvent({
  id: 'e5',
  sequence: 5,
  type: 'GAME_FINISHED',
  payload: { winner: 0, finalScores: { 0: 1200, 1: 800, 2: 650 } },
});

describe('useGameLog — lastImportantEntry', () => {
  it('is null when no events', () => {
    const { result } = renderHook(() => useGameLog([], null, null));
    expect(result.current.lastImportantEntry).toBeNull();
  });

  it('is null when only non-important events exist', () => {
    const { result } = renderHook(() => useGameLog([startedEvent, bidPlacedEvent], null, null));
    expect(result.current.lastImportantEntry).toBeNull();
  });

  it('returns the most recent important entry (trick_won)', () => {
    const { result } = renderHook(() => useGameLog([startedEvent, trickWonEvent], null, null));
    expect(result.current.lastImportantEntry?.type).toBe('trick_won');
  });

  it('returns the most recent important entry even when newer non-important events follow', () => {
    const { result } = renderHook(() =>
      useGameLog([startedEvent, trickWonEvent, bidPlacedEvent], null, null)
    );
    // bidPlaced is the newest event but non-important; trickWon is the most recent important entry
    expect(result.current.lastImportantEntry?.type).toBe('trick_won');
  });

  it('returns the latest of multiple important entries', () => {
    const { result } = renderHook(() =>
      useGameLog([startedEvent, trickWonEvent, meldsDeclaredEvent], null, null)
    );
    expect(result.current.lastImportantEntry?.type).toBe('melds_declared');
  });

  it('returns game_finished when game is over', () => {
    const { result } = renderHook(() =>
      useGameLog([startedEvent, trickWonEvent, gameFinishedEvent], null, null)
    );
    expect(result.current.lastImportantEntry?.type).toBe('game_finished');
  });

  it('works when important entry is outside the top-5 latestEntries window', () => {
    const manyBids = Array.from({ length: 6 }, (_, i) =>
      makeEvent({
        id: `bid-${i}`,
        sequence: 10 + i,
        type: 'BID_PLACED',
        payload: { playerIndex: 0, amount: 150 + i * 10 },
      })
    );
    const { result } = renderHook(() =>
      useGameLog([startedEvent, trickWonEvent, ...manyBids], null, null)
    );
    // trickWon is 7th from end — outside latestEntries window of 5
    expect(result.current.lastImportantEntry?.type).toBe('trick_won');
  });
});
