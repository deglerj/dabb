import { describe, it, expect } from 'vitest';
import { applyEvents } from '@dabb/game-logic';
import {
  createStartGameEvents,
  createBidPlacedEvents,
  createPlayerPassedEvents,
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
