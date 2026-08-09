import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameLog } from '../useGameLog.js';
import type { GameEvent, PlayerIndex, Team } from '@dabb/shared-types';

const baseEvent = {
  sessionId: 'session-1',
  timestamp: Date.now(),
};

function makeEvent(
  overrides: Partial<GameEvent> & { type: GameEvent['type']; id: string; sequence: number }
): GameEvent {
  return { ...baseEvent, ...overrides } as GameEvent;
}

/**
 * Echoes the key and its interpolation values instead of translating, so the tests assert on
 * which line was produced and with what, not on the wording of any one locale.
 */
const t = (key: string, options?: Record<string, unknown>): string =>
  options === undefined ? key : `${key} ${JSON.stringify(options)}`;

const NICKNAMES = new Map<PlayerIndex, string>([
  [0 as PlayerIndex, 'Alice'],
  [1 as PlayerIndex, 'Bob'],
  [2 as PlayerIndex, 'Carol'],
  [3 as PlayerIndex, 'Dave'],
]);

const log = (events: GameEvent[]) => renderHook(() => useGameLog(events, NICKNAMES, t)).result;

/** The translation key a line was built from, ignoring its interpolated values. */
const keyOf = (text: string) => text.split(' ')[0];

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

describe('useGameLog — collapsedSummary', () => {
  it('is undefined when no events', () => {
    expect(log([]).current.collapsedSummary).toBeUndefined();
  });

  it('is undefined when only unimportant events exist', () => {
    expect(log([startedEvent, bidPlacedEvent]).current.collapsedSummary).toBeUndefined();
  });

  it('reports the most recent important line', () => {
    const summary = log([startedEvent, trickWonEvent]).current.collapsedSummary;
    expect(keyOf(summary!)).toBe('gameLog.trickWon');
  });

  it('ignores newer unimportant events', () => {
    const summary = log([startedEvent, trickWonEvent, bidPlacedEvent]).current.collapsedSummary;
    expect(keyOf(summary!)).toBe('gameLog.trickWon');
  });

  it('takes the latest of several important lines', () => {
    const summary = log([startedEvent, trickWonEvent, meldsDeclaredEvent]).current.collapsedSummary;
    expect(keyOf(summary!)).toBe('gameLog.meldsDeclared');
  });

  it('reports the end of the game', () => {
    const summary = log([startedEvent, trickWonEvent, gameFinishedEvent]).current.collapsedSummary;
    expect(keyOf(summary!)).toBe('gameLog.gameFinished');
  });

  it('scans past any number of newer unimportant lines', () => {
    const manyBids = Array.from({ length: 6 }, (_, i) =>
      makeEvent({
        id: `bid-${i}`,
        sequence: 10 + i,
        type: 'BID_PLACED',
        payload: { playerIndex: 0, amount: 150 + i * 10 },
      })
    );
    const summary = log([startedEvent, trickWonEvent, ...manyBids]).current.collapsedSummary;
    // trickWon is 7th from the end — the scan must not stop at a recency window
    expect(keyOf(summary!)).toBe('gameLog.trickWon');
  });

  // Everyone melds at roughly the same moment; showing only the last declaration would hide
  // the rest of the table's.
  it('merges a run of meld declarations into one line, oldest first', () => {
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
    const summary = log([melds1, melds2]).current.collapsedSummary!;

    expect(summary).toContain('"name":"Alice","points":40');
    expect(summary).toContain('"name":"Bob","points":60');
    expect(summary.indexOf('Alice')).toBeLessThan(summary.indexOf('Bob'));
  });

  it('reports a meld of nothing differently from one worth points', () => {
    const empty = makeEvent({
      id: 'em0',
      sequence: 6,
      type: 'MELDS_DECLARED',
      payload: { playerIndex: 0, melds: [], totalPoints: 0 },
    });
    expect(keyOf(log([empty]).current.collapsedSummary!)).toBe('gameLog.meldsNone');
  });
});

describe('useGameLog — entries', () => {
  it('are in chronological order (oldest first)', () => {
    const { entries } = log([startedEvent, trickWonEvent, bidPlacedEvent]).current;
    expect(entries.map((e) => keyOf(e.text))).toEqual([
      'gameLog.gameStarted',
      'gameLog.trickWon',
      'gameLog.bidPlaced',
    ]);
  });

  it('key each line by its event id', () => {
    const { entries } = log([startedEvent, trickWonEvent]).current;
    expect(entries.map((e) => e.key)).toEqual(['e1', 'e2']);
  });

  it('name players from the supplied nicknames', () => {
    const { entries } = log([bidPlacedEvent]).current;
    expect(entries[0].text).toContain('Bob');
  });
});

describe('useGameLog — event type coverage', () => {
  it('reports going out, with the trump suit', () => {
    const event = makeEvent({
      id: 'e-going-out',
      sequence: 10,
      type: 'GOING_OUT',
      payload: { playerIndex: 1, suit: 'herz' },
    });
    const { entries } = log([event]).current;
    expect(keyOf(entries[0].text)).toBe('gameLog.goingOut');
    expect(entries[0].text).toContain('Bob');
  });

  it('reports a card played', () => {
    const event = makeEvent({
      id: 'e-card',
      sequence: 10,
      type: 'CARD_PLAYED',
      payload: {
        playerIndex: 0,
        card: { id: 'kreuz-ass-0', suit: 'kreuz', rank: 'ass', copy: 0 },
      },
    });
    const { entries } = log([event]).current;
    expect(keyOf(entries[0].text)).toBe('gameLog.cardPlayed');
  });

  it('reports a scored round', () => {
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
    const { entries } = log([event]).current;
    expect(keyOf(entries[0].text)).toBe('gameLog.roundScored');
  });

  it('reports a terminated game', () => {
    const event = makeEvent({
      id: 'e-terminated',
      sequence: 10,
      type: 'GAME_TERMINATED',
      payload: { terminatedBy: 1, reason: 'player_exit' },
    });
    const { entries } = log([event]).current;
    expect(keyOf(entries[0].text)).toBe('gameLog.gameTerminated');
  });

  it('reports the dabb being taken', () => {
    const event = makeEvent({
      id: 'e-dabb',
      sequence: 10,
      type: 'DABB_TAKEN',
      payload: {
        playerIndex: 0,
        dabbCards: [{ id: 'kreuz-ass-0', suit: 'kreuz', rank: 'ass', copy: 0 as const }],
      },
    });
    const { entries } = log([event]).current;
    expect(keyOf(entries[0].text)).toBe('gameLog.dabbTaken');
  });

  it('skips the deal, and a layaway with no trump in it', () => {
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
    expect(log([dealt, discarded]).current.entries).toHaveLength(0);
  });

  // Buried trump has to be announced. filterCardsDiscarded leaves those card IDs readable
  // and replaces the rest with 'hidden', so the reveal is derived from the IDs — which means
  // the trump in force has to be carried forward from the earlier TRUMP_DECLARED.
  it('announces buried trump, and only the trump cards', () => {
    const trumpDeclared = makeEvent({
      id: 'e-trump',
      sequence: 1,
      type: 'TRUMP_DECLARED',
      payload: { playerIndex: 0, suit: 'herz' },
    });
    const discarded = makeEvent({
      id: 'e-discarded',
      sequence: 2,
      type: 'CARDS_DISCARDED',
      payload: { playerIndex: 0, discardedCards: ['herz-koenig-0', 'hidden', 'hidden', 'hidden'] },
    });
    const { entries } = log([trumpDeclared, discarded]).current;
    const reveal = entries.find((e) => keyOf(e.text) === 'gameLog.trumpDiscarded');
    expect(reveal).toBeDefined();
    expect(reveal!.text).not.toContain('hidden');
  });

  it('forgets the trump when a new round starts', () => {
    const trumpDeclared = makeEvent({
      id: 'e-trump',
      sequence: 1,
      type: 'TRUMP_DECLARED',
      payload: { playerIndex: 0, suit: 'herz' },
    });
    const newRound = makeEvent({
      id: 'e-round',
      sequence: 2,
      type: 'NEW_ROUND_STARTED',
      payload: { round: 2, dealer: 1 },
    });
    const discarded = makeEvent({
      id: 'e-discarded',
      sequence: 3,
      type: 'CARDS_DISCARDED',
      payload: { playerIndex: 0, discardedCards: ['herz-koenig-0'] },
    });
    const { entries } = log([trumpDeclared, newRound, discarded]).current;
    expect(entries.some((e) => keyOf(e.text) === 'gameLog.trumpDiscarded')).toBe(false);
  });

  it('announces the teams after GAME_STARTED in a 4-player game', () => {
    const joins = (['Alice', 'Bob', 'Carol', 'Dave'] as const).map((nickname, i) =>
      makeEvent({
        id: `pj${i}`,
        sequence: i + 1,
        type: 'PLAYER_JOINED',
        payload: {
          playerIndex: i as PlayerIndex,
          nickname,
          playerId: 'pid',
          team: (i % 2) as Team,
        },
      })
    );
    const started = makeEvent({
      id: 'gs',
      sequence: 5,
      type: 'GAME_STARTED',
      payload: { playerCount: 4, targetScore: 1500, dealer: 0 },
    });

    const { entries } = log([...joins, started]).current;
    const teams = entries.find((e) => keyOf(e.text) === 'gameLog.teamsAnnounced');
    expect(teams?.text).toContain('Alice, Carol');
    expect(teams?.text).toContain('Bob, Dave');
  });

  it('names both winners when a team wins', () => {
    const joins = (['Alice', 'Bob', 'Carol', 'Dave'] as const).map((nickname, i) =>
      makeEvent({
        id: `pj${i}`,
        sequence: i + 1,
        type: 'PLAYER_JOINED',
        payload: {
          playerIndex: i as PlayerIndex,
          nickname,
          playerId: 'pid',
          team: (i % 2) as Team,
        },
      })
    );
    const finished = makeEvent({
      id: 'gf',
      sequence: 6,
      type: 'GAME_FINISHED',
      payload: { winner: 1, finalScores: { 0: 900, 1: 1100, 2: 0, 3: 0 } },
    });
    const { collapsedSummary } = log([...joins, finished]).current;
    expect(collapsedSummary).toContain('Bob & Dave');
  });
});
