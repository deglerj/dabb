import { describe, it, expect } from 'vitest';
import { applyEvents, calculateMeldPoints, detectMelds } from '@dabb/game-logic';
import type { GameEvent, GameState, PlayerIndex } from '@dabb/shared-types';
import {
  createStartGameEvents,
  createBidPlacedEvents,
  createDeclareMeldsEvents,
  createDeclareTrumpEvents,
  createDiscardCardsEvents,
  createPlayerPassedEvents,
  createTakeDabbEvents,
  SeqGen,
} from '../gameEventFactory.js';
import type { PlayerInfo } from '../gameEventFactory.js';

const SESSION = 'test-session';
const makeSeqGen = (start = 0): SeqGen => {
  let n = start;
  return () => ++n;
};

const PLAYERS_3: PlayerInfo[] = [
  { playerIndex: 0, nickname: 'Alice', isAI: false, team: null },
  { playerIndex: 1, nickname: 'Bob', isAI: false, team: null },
  { playerIndex: 2, nickname: 'Charlie', isAI: false, team: null },
];

describe('createStartGameEvents', () => {
  it('emits PLAYER_JOINED × 3 + GAME_STARTED + CARDS_DEALT for 3 players', () => {
    const events = createStartGameEvents(SESSION, makeSeqGen(), PLAYERS_3, 3, 1000);
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
    const events = createStartGameEvents(SESSION, makeSeqGen(), PLAYERS_3, 3, 1000);
    const state = applyEvents(events);
    expect(state.phase).toBe('bidding');
  });
});

describe('createBidPlacedEvents', () => {
  it('returns single BID_PLACED event', () => {
    const startEvents = createStartGameEvents(SESSION, makeSeqGen(), PLAYERS_3, 3, 1000);
    const state = applyEvents(startEvents);
    const bidEvents = createBidPlacedEvents(SESSION, makeSeqGen(startEvents.length), state, 0, 160);
    expect(bidEvents).toHaveLength(1);
    expect(bidEvents[0].type).toBe('BID_PLACED');
  });

  it('throws if not current bidder', () => {
    const startEvents = createStartGameEvents(SESSION, makeSeqGen(), PLAYERS_3, 3, 1000);
    const state = applyEvents(startEvents);
    expect(() =>
      createBidPlacedEvents(SESSION, makeSeqGen(startEvents.length), state, 1, 160)
    ).toThrow();
  });
});

/** Drives a 3-player round from the deal up to the start of the melding phase. */
function roundInMeldingPhase(): { events: GameEvent[]; state: GameState; seq: SeqGen } {
  let events = createStartGameEvents(SESSION, makeSeqGen(), PLAYERS_3, 3, 1000);
  const seq = makeSeqGen(events.length);
  const push = (evts: GameEvent[]) => {
    events = [...events, ...evts];
  };
  const act = (fn: (s: GameState) => GameEvent[]) => push(fn(applyEvents(events)));

  // Dealer is 2, so player 0 opens the bidding and the other two pass.
  act((s) => createBidPlacedEvents(SESSION, seq, s, 0, 150));
  act((s) => createPlayerPassedEvents(SESSION, seq, s, 1));
  act((s) => createPlayerPassedEvents(SESSION, seq, s, 2));
  act((s) => createTakeDabbEvents(SESSION, seq, s, 0));
  act((s) => createDeclareTrumpEvents(SESSION, seq, s, 0, 'herz'));
  act((s) =>
    createDiscardCardsEvents(
      SESSION,
      seq,
      s,
      0,
      (s.hands.get(0) ?? []).slice(0, 4).map((c) => c.id)
    )
  );

  return { events, state: applyEvents(events), seq };
}

describe('createDeclareMeldsEvents', () => {
  it('derives melds from the hand instead of trusting the caller (regression)', () => {
    // Melds used to be passed in and stored verbatim: no check that the cards were in hand,
    // that points matched, or that a card was not reused. A forged acht-ass (1000 points)
    // ended the game on the spot.
    const { state, seq } = roundInMeldingPhase();
    expect(state.phase).toBe('melding');

    for (const p of [0, 1, 2] as PlayerIndex[]) {
      const declared = createDeclareMeldsEvents(SESSION, seq, state, p)[0];
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
    let events = createStartGameEvents(SESSION, makeSeqGen(), PLAYERS_3, 3, 1000);
    const seq = makeSeqGen(events.length);
    let state = applyEvents(events);

    events = [...events, ...createBidPlacedEvents(SESSION, seq, state, 0, 150)];
    state = applyEvents(events);
    events = [...events, ...createPlayerPassedEvents(SESSION, seq, state, 1)];
    state = applyEvents(events);
    events = [...events, ...createPlayerPassedEvents(SESSION, seq, state, 2)];

    const types = events.map((e) => e.type);
    expect(types).toContain('BIDDING_WON');
  });
});
