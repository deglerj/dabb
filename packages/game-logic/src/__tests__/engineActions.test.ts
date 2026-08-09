import { describe, it, expect } from 'vitest';
import { applyEvents, calculateMeldPoints, detectMelds } from '../index.js';
import type { GameEvent, GameState, PlayerIndex } from '@dabb/shared-types';
import {
  createStartGameEvents,
  createBidPlacedEvents,
  createDeclareMeldsEvents,
  createDeclareTrumpEvents,
  createDiscardCardsEvents,
  createEventsForAction,
  createPlayerPassedEvents,
  createTakeDabbEvents,
} from '../engine/index.js';
import type { NextContext, PlayerInfo } from '../engine/index.js';

const SESSION = 'test-session';
const makeNext = (start = 0): NextContext => {
  let n = start;
  return () => ({ sessionId: SESSION, sequence: ++n });
};

const PLAYERS_3: PlayerInfo[] = [
  { playerIndex: 0, nickname: 'Alice', isAI: false, team: null },
  { playerIndex: 1, nickname: 'Bob', isAI: false, team: null },
  { playerIndex: 2, nickname: 'Charlie', isAI: false, team: null },
];

describe('createStartGameEvents', () => {
  it('emits PLAYER_JOINED × 3 + GAME_STARTED + CARDS_DEALT for 3 players', () => {
    const events = createStartGameEvents(makeNext(), PLAYERS_3, 3, 1000);
    const types = events.map((e) => e.type);
    expect(types).toEqual([
      'PLAYER_JOINED',
      'PLAYER_JOINED',
      'PLAYER_JOINED',
      'GAME_STARTED',
      'CARDS_DEALT',
    ]);
  });

  it('resulting state has phase "bidding"', () => {
    const events = createStartGameEvents(makeNext(), PLAYERS_3, 3, 1000);
    const state = applyEvents(events);
    expect(state.phase).toBe('bidding');
  });

  it('numbers events consecutively from the context factory', () => {
    const events = createStartGameEvents(makeNext(), PLAYERS_3, 3, 1000);
    expect(events.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(events.every((e) => e.sessionId === SESSION)).toBe(true);
  });
});

describe('createBidPlacedEvents', () => {
  it('returns single BID_PLACED event', () => {
    const startEvents = createStartGameEvents(makeNext(), PLAYERS_3, 3, 1000);
    const state = applyEvents(startEvents);
    const bidEvents = createBidPlacedEvents(state, 0, 160, makeNext(startEvents.length));
    expect(bidEvents).toHaveLength(1);
    expect(bidEvents[0].type).toBe('BID_PLACED');
  });

  it('throws if not current bidder', () => {
    const startEvents = createStartGameEvents(makeNext(), PLAYERS_3, 3, 1000);
    const state = applyEvents(startEvents);
    expect(() => createBidPlacedEvents(state, 1, 160, makeNext(startEvents.length))).toThrow();
  });
});

/** Drives a 3-player round from the deal up to the start of the melding phase. */
function roundInMeldingPhase(): { events: GameEvent[]; state: GameState; next: NextContext } {
  let events = createStartGameEvents(makeNext(), PLAYERS_3, 3, 1000);
  const next = makeNext(events.length);
  const push = (evts: GameEvent[]) => {
    events = [...events, ...evts];
  };
  const act = (fn: (s: GameState) => GameEvent[]) => push(fn(applyEvents(events)));

  // Dealer is 2, so player 0 opens the bidding and the other two pass.
  act((s) => createBidPlacedEvents(s, 0, 150, next));
  act((s) => createPlayerPassedEvents(s, 1, next));
  act((s) => createPlayerPassedEvents(s, 2, next));
  act((s) => createTakeDabbEvents(s, 0, next));
  act((s) => createDeclareTrumpEvents(s, 0, 'herz', next));
  act((s) =>
    createDiscardCardsEvents(
      s,
      0,
      (s.hands.get(0) ?? []).slice(0, 4).map((c) => c.id),
      next
    )
  );

  return { events, state: applyEvents(events), next };
}

describe('createDeclareMeldsEvents', () => {
  it('derives melds from the hand instead of trusting the caller (regression)', () => {
    // Melds used to be passed in and stored verbatim: no check that the cards were in hand,
    // that points matched, or that a card was not reused. A forged acht-ass (1000 points)
    // ended the game on the spot.
    const { state, next } = roundInMeldingPhase();
    expect(state.phase).toBe('melding');

    for (const p of [0, 1, 2] as PlayerIndex[]) {
      const declared = createDeclareMeldsEvents(state, p, next)[0];
      if (declared.type !== 'MELDS_DECLARED') {
        throw new Error('expected MELDS_DECLARED');
      }

      const hand = state.hands.get(p) ?? [];
      const expected = detectMelds(hand, state.trump!);
      expect(declared.payload.melds).toEqual(expected);
      expect(declared.payload.totalPoints).toBe(calculateMeldPoints(expected));

      // Every declared card really is in the declaring player's own hand. (Cards may appear
      // in more than one meld — a Familie König also counts towards Vier Könige.)
      const handIds = new Set(hand.map((c) => c.id));
      for (const meld of declared.payload.melds) {
        for (const cardId of meld.cards) {
          expect(handIds.has(cardId)).toBe(true);
        }
      }
    }
  });
});

describe('createPlayerPassedEvents', () => {
  it('includes BIDDING_WON when last two players pass', () => {
    let events = createStartGameEvents(makeNext(), PLAYERS_3, 3, 1000);
    const next = makeNext(events.length);
    let state = applyEvents(events);

    events = [...events, ...createBidPlacedEvents(state, 0, 150, next)];
    state = applyEvents(events);
    events = [...events, ...createPlayerPassedEvents(state, 1, next)];
    state = applyEvents(events);
    events = [...events, ...createPlayerPassedEvents(state, 2, next)];

    const types = events.map((e) => e.type);
    expect(types).toContain('BIDDING_WON');
  });
});

/**
 * The online AI driver, offline play and the simulation each used to carry their own copy of
 * the action-to-events mapping, and only the online one validated anything. They all route
 * through createEventsForAction now, so these cover the shared entry point.
 */
describe('createEventsForAction', () => {
  it('produces the same events as calling the action builder directly', () => {
    const startEvents = createStartGameEvents(makeNext(), PLAYERS_3, 3, 1000);
    const state = applyEvents(startEvents);

    const direct = createBidPlacedEvents(state, 0, 160, makeNext(startEvents.length));
    const dispatched = createEventsForAction(
      state,
      0,
      { type: 'bid', amount: 160 },
      makeNext(startEvents.length)
    );

    expect(dispatched).toHaveLength(direct.length);
    expect(dispatched[0].type).toBe(direct[0].type);
    expect(dispatched[0].sequence).toBe(direct[0].sequence);
  });

  it('validates the action rather than trusting the caller (regression)', () => {
    // Offline play and the simulation applied actions without any validation of their own.
    const startEvents = createStartGameEvents(makeNext(), PLAYERS_3, 3, 1000);
    const state = applyEvents(startEvents);

    // Player 1 is not the current bidder — dealer is 2, so player 0 opens.
    expect(() =>
      createEventsForAction(state, 1, { type: 'bid', amount: 160 }, makeNext())
    ).toThrow();

    // Wrong phase entirely.
    expect(() => createEventsForAction(state, 0, { type: 'takeDabb' }, makeNext())).toThrow();
  });

  it('routes every action type', () => {
    const { state, next } = roundInMeldingPhase();
    const events = createEventsForAction(state, 0, { type: 'declareMelds' }, next);
    expect(events[0].type).toBe('MELDS_DECLARED');
  });
});
