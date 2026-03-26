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
  payload: { winner: 0, finalScores: { 0: 1200, 1: 800, 2: 650, 3: 0 } },
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

describe('useGameLog — entry ordering', () => {
  it('entries are in chronological order (oldest first)', () => {
    // sequences 1, 2, 3 match insertion order — no sorting, just pass-through
    const { result } = renderHook(() =>
      useGameLog([startedEvent, trickWonEvent, bidPlacedEvent], null, null)
    );
    expect(result.current.entries[0].type).toBe('game_started');
    expect(result.current.entries[1].type).toBe('trick_won');
    expect(result.current.entries[2].type).toBe('bid_placed');
  });

  it('latestEntries are the last N entries in chronological order', () => {
    const manyBids = Array.from({ length: 6 }, (_, i) =>
      makeEvent({
        id: `bid-${i}`,
        sequence: 10 + i,
        type: 'BID_PLACED',
        payload: { playerIndex: 0, amount: 150 + i * 10 },
      })
    );
    const { result } = renderHook(() => useGameLog([startedEvent, ...manyBids], null, null));
    expect(result.current.latestEntries).toHaveLength(5);
    // Last 5 of 7 entries = bids 1–5, oldest-first (ascending amounts)
    const amounts = result.current.latestEntries.map((e) =>
      e.data.kind === 'bid_placed' ? e.data.amount : null
    );
    expect(amounts).toEqual([160, 170, 180, 190, 200]);
  });

  it('merges consecutive melds_declared into melds_summary in chronological order', () => {
    const melds1 = makeEvent({
      id: 'em1',
      sequence: 6,
      type: 'MELDS_DECLARED',
      payload: { playerIndex: 0, melds: [], totalPoints: 40 },
    });
    const melds2 = makeEvent({
      id: 'em2',
      sequence: 7,
      type: 'MELDS_DECLARED',
      payload: { playerIndex: 1, melds: [], totalPoints: 60 },
    });
    const { result } = renderHook(() => useGameLog([melds1, melds2], null, null));
    const entry = result.current.lastImportantEntry;
    expect(entry?.type).toBe('melds_summary');
    if (entry?.data.kind === 'melds_summary') {
      // playerMelds must be chronological: player 0 then player 1
      expect(entry.data.playerMelds).toEqual([
        { playerIndex: 0, totalPoints: 40 },
        { playerIndex: 1, totalPoints: 60 },
      ]);
    }
  });
});

describe('useGameLog — event type coverage', () => {
  it('converts GOING_OUT event', () => {
    const event = makeEvent({
      id: 'e-going-out',
      sequence: 10,
      type: 'GOING_OUT',
      payload: { playerIndex: 1, suit: 'herz' },
    });
    const { result } = renderHook(() => useGameLog([event], null, null));
    expect(result.current.entries[0]).toMatchObject({
      type: 'going_out',
      playerIndex: 1,
      data: { kind: 'going_out', suit: 'herz' },
    });
  });

  it('converts CARD_PLAYED event', () => {
    const event = makeEvent({
      id: 'e-card',
      sequence: 10,
      type: 'CARD_PLAYED',
      payload: {
        playerIndex: 0,
        card: { id: 'kreuz-ass-0', suit: 'kreuz', rank: 'ass', copy: 0 },
      },
    });
    const { result } = renderHook(() => useGameLog([event], null, null));
    expect(result.current.entries[0]).toMatchObject({
      type: 'card_played',
      playerIndex: 0,
      data: { kind: 'card_played' },
    });
  });

  it('converts ROUND_SCORED event', () => {
    const event = makeEvent({
      id: 'e-scored',
      sequence: 10,
      type: 'ROUND_SCORED',
      payload: {
        scores: {
          0: { melds: 60, tricks: 40, total: 100, bidMet: true },
          1: { melds: 0, tricks: 20, total: 20, bidMet: false },
          2: { melds: 20, tricks: 30, total: 50, bidMet: false },
          3: { melds: 0, tricks: 0, total: 0, bidMet: false },
        },
        totalScores: { 0: 100, 1: 20, 2: 50, 3: 0 },
      },
    });
    const { result } = renderHook(() => useGameLog([event], null, null));
    expect(result.current.entries[0]).toMatchObject({
      type: 'round_scored',
      playerIndex: null,
      data: { kind: 'round_scored' },
    });
  });

  it('converts GAME_TERMINATED event', () => {
    const event = makeEvent({
      id: 'e-terminated',
      sequence: 10,
      type: 'GAME_TERMINATED',
      payload: { terminatedBy: 1, reason: 'player_exit' },
    });
    const { result } = renderHook(() => useGameLog([event], null, null));
    expect(result.current.entries[0]).toMatchObject({
      type: 'game_terminated',
      playerIndex: 1,
      data: { kind: 'game_terminated', reason: 'player_exit' },
    });
  });

  it('converts DABB_TAKEN event', () => {
    const event = makeEvent({
      id: 'e-dabb',
      sequence: 10,
      type: 'DABB_TAKEN',
      payload: {
        playerIndex: 0,
        dabbCards: [{ id: 'kreuz-ass-0', suit: 'kreuz', rank: 'ass', copy: 0 as const }],
      },
    });
    const { result } = renderHook(() => useGameLog([event], null, null));
    expect(result.current.entries[0]).toMatchObject({
      type: 'dabb_taken',
      playerIndex: 0,
      data: { kind: 'dabb_taken' },
    });
  });

  it('skips secret events (CARDS_DEALT, CARDS_DISCARDED)', () => {
    const dealt = makeEvent({
      id: 'e-dealt',
      sequence: 1,
      type: 'CARDS_DEALT',
      payload: { hands: { 0: [], 1: [], 2: [], 3: [] }, dabb: [] },
    });
    const discarded = makeEvent({
      id: 'e-discarded',
      sequence: 2,
      type: 'CARDS_DISCARDED',
      payload: { playerIndex: 0, discardedCards: [] },
    });
    const { result } = renderHook(() => useGameLog([dealt, discarded], null, null));
    expect(result.current.entries).toHaveLength(0);
  });

  it('emits teams_announced after GAME_STARTED in 4-player game', () => {
    const joined0 = makeEvent({
      id: 'pj0',
      sequence: 1,
      type: 'PLAYER_JOINED',
      payload: { playerIndex: 0, nickname: 'Alice', playerId: 'pid', team: 0 },
    });
    const joined1 = makeEvent({
      id: 'pj1',
      sequence: 2,
      type: 'PLAYER_JOINED',
      payload: { playerIndex: 1, nickname: 'Bob', playerId: 'pid', team: 1 },
    });
    const joined2 = makeEvent({
      id: 'pj2',
      sequence: 3,
      type: 'PLAYER_JOINED',
      payload: { playerIndex: 2, nickname: 'Carol', playerId: 'pid', team: 0 },
    });
    const joined3 = makeEvent({
      id: 'pj3',
      sequence: 4,
      type: 'PLAYER_JOINED',
      payload: { playerIndex: 3, nickname: 'Dave', playerId: 'pid', team: 1 },
    });
    const started = makeEvent({
      id: 'gs',
      sequence: 5,
      type: 'GAME_STARTED',
      payload: { playerCount: 4, targetScore: 1500, dealer: 0 },
    });

    const { result } = renderHook(() =>
      useGameLog([joined0, joined1, joined2, joined3, started], null, null)
    );

    const teamsEntry = result.current.entries.find((e) => e.type === 'teams_announced');
    expect(teamsEntry?.data).toMatchObject({
      kind: 'teams_announced',
      team0: expect.arrayContaining(['Alice', 'Carol']),
      team1: expect.arrayContaining(['Bob', 'Dave']),
    });
  });
});

describe('useGameLog — isYourTurn', () => {
  it('is true when it is your turn in bidding phase', () => {
    const state = {
      phase: 'bidding',
      currentPlayer: 0,
    } as unknown as import('@dabb/shared-types').GameState;
    const { result } = renderHook(() =>
      useGameLog([], state, 0 as import('@dabb/shared-types').PlayerIndex)
    );
    expect(result.current.isYourTurn).toBe(true);
  });

  it('is true when it is your turn in tricks phase', () => {
    const state = {
      phase: 'tricks',
      currentPlayer: 1,
    } as unknown as import('@dabb/shared-types').GameState;
    const { result } = renderHook(() =>
      useGameLog([], state, 1 as import('@dabb/shared-types').PlayerIndex)
    );
    expect(result.current.isYourTurn).toBe(true);
  });

  it('is false in melding phase even when player index matches currentPlayer', () => {
    const state = {
      phase: 'melding',
      currentPlayer: 0,
    } as unknown as import('@dabb/shared-types').GameState;
    const { result } = renderHook(() =>
      useGameLog([], state, 0 as import('@dabb/shared-types').PlayerIndex)
    );
    expect(result.current.isYourTurn).toBe(false);
  });

  it('is false when state is null', () => {
    const { result } = renderHook(() =>
      useGameLog([], null, 0 as import('@dabb/shared-types').PlayerIndex)
    );
    expect(result.current.isYourTurn).toBe(false);
  });
});
