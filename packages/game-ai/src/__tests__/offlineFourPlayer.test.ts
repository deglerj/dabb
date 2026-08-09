/**
 * Regression tests for 4-player offline games.
 *
 * OfflineGameEngine used to emit PLAYER_JOINED without a team, so every 4-player offline
 * game scored 0/0 forever (unwinnable), showed no partner, and threw a TypeError the
 * moment anyone went out — stranding the round in the trick phase.
 */
import { describe, it, expect } from 'vitest';
import { OfflineGameEngine } from '../OfflineGameEngine.js';
import type { PlayerIndex, Team } from '@dabb/shared-types';

const HUMAN = 0 as PlayerIndex;

function newEngine(playerCount: 2 | 3 | 4) {
  return new OfflineGameEngine({ playerCount, difficulty: 'easy', humanPlayerIndex: HUMAN });
}

describe('offline 4-player teams', () => {
  it('pairs players sitting opposite each other (regression)', async () => {
    const engine = newEngine(4);
    await engine.start();

    const { players } = engine.getViewForPlayer(HUMAN).state;
    const teamOf = (i: PlayerIndex) => players.find((p) => p.playerIndex === i)?.team;
    expect(teamOf(0)).toBe(0);
    expect(teamOf(2)).toBe(0);
    expect(teamOf(1)).toBe(1);
    expect(teamOf(3)).toBe(1);
  });

  it('leaves teams unset in a 3-player game', async () => {
    const engine = newEngine(3);
    await engine.start();

    const { players } = engine.getViewForPlayer(HUMAN).state;
    expect(players.every((p) => p.team === undefined)).toBe(true);
  });
});

describe('offline 4-player going out', () => {
  it('scores the round instead of throwing into the trick phase (regression)', async () => {
    const engine = newEngine(4);
    await engine.start();

    // Outbid the AI seats so the human takes the dabb and can choose to go out.
    let guard = 0;
    while (engine.getViewForPlayer(HUMAN).state.phase === 'bidding' && guard++ < 100) {
      const state = engine.getViewForPlayer(HUMAN).state;
      if (state.currentBidder !== HUMAN) {
        break;
      }
      await engine.dispatch({
        type: 'bid',
        amount: state.currentBid === 0 ? 150 : state.currentBid + 10,
      });
    }

    const afterBidding = engine.getViewForPlayer(HUMAN).state;
    expect(afterBidding.phase).toBe('dabb');
    expect(afterBidding.bidWinner).toBe(HUMAN);

    await engine.dispatch({ type: 'takeDabb' });
    // Trump is declared before the layaway, so going out inherits it.
    const suit = engine.getViewForPlayer(HUMAN).state.hands.get(HUMAN)![0].suit;
    await engine.dispatch({ type: 'declareTrump', suit });
    await engine.dispatch({ type: 'goOut' });

    const events = engine.getViewForPlayer(HUMAN).events;
    const scored = events.find((e) => e.type === 'ROUND_SCORED');
    expect(scored).toBeDefined();
    expect(events.some((e) => e.type === 'CARD_PLAYED')).toBe(false);

    if (scored?.type !== 'ROUND_SCORED') {
      throw new Error('unreachable');
    }
    // Keyed by team (0/1) — it used to write scores[undefined] and scores[NaN]
    expect(Object.keys(scored.payload.scores).sort()).toEqual(['0', '1']);

    const bid = afterBidding.currentBid;
    const bidWinnerTeam = 0 as Team; // human sits at seat 0
    expect(scored.payload.scores[bidWinnerTeam].total).toBe(-bid);
    expect(scored.payload.scores[1 as Team].bidMet).toBe(true);
    expect(scored.payload.scores[1 as Team].total).toBe(
      scored.payload.scores[1 as Team].melds + 40
    );

    // Round actually ended: the next round was dealt
    expect(engine.getViewForPlayer(HUMAN).state.phase).toBe('bidding');
    expect(engine.getViewForPlayer(HUMAN).state.round).toBe(2);
  });
});
