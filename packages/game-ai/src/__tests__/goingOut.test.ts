/**
 * Regression tests for the going-out threshold.
 *
 * This one number decided roughly 30% of four-player rounds. Going out costs the bid once,
 * guaranteed; playing on costs twice the bid, but only when the hand actually misses — and at
 * the old 0.7 the hands being abandoned were mostly making their bid. Lowering it to 0.2 was
 * worth about 18 percentage points of win rate, far more than every trick-play rule in this
 * package put together, so it is worth a test that notices if it drifts back.
 */

import { describe, expect, it } from 'vitest';
import type { Card, GameState, PlayerIndex, Rank, Suit } from '@dabb/shared-types';
import { createInitialState } from '@dabb/game-logic';

import { BinokelAIPlayer } from '../BinokelAIPlayer.js';

function card(suit: Suit, rank: Rank, copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

/**
 * A four-player discard decision on a middling hand: three trump and, deliberately, no melds at
 * all — no König/Ober pair, no four of any rank, no Binokel. The estimator scores it at roughly
 * 47, which sits between 0.2 and 0.7 of a 200 bid and so separates the two thresholds.
 */
function discardState(currentBid: number): GameState {
  const state = createInitialState(4);
  return {
    ...state,
    phase: 'discard',
    playerCount: 4,
    players: [
      { id: 'p0', nickname: 'Alice', playerIndex: 0 as PlayerIndex, team: 0 },
      { id: 'p1', nickname: 'Bob', playerIndex: 1 as PlayerIndex, team: 1 },
      { id: 'p2', nickname: 'Carol', playerIndex: 2 as PlayerIndex, team: 0 },
      { id: 'p3', nickname: 'Dave', playerIndex: 3 as PlayerIndex, team: 1 },
    ],
    trump: 'herz',
    round: 1,
    currentBid,
    bidWinner: 0 as PlayerIndex,
    hands: new Map([
      [
        0 as PlayerIndex,
        [
          card('herz', 'buabe', 0),
          card('herz', 'buabe', 1),
          card('herz', '10', 0),
          card('kreuz', 'ass', 0),
          card('kreuz', 'ass', 1),
          card('kreuz', '10', 0),
          card('kreuz', '10', 1),
          card('schippe', 'ass', 0),
          card('schippe', '10', 0),
          card('schippe', '10', 1),
          card('schippe', 'ober', 0),
          card('bollen', 'ass', 0),
          card('bollen', '10', 0),
          card('bollen', 'koenig', 0),
        ],
      ],
    ]),
  };
}

async function decide(state: GameState) {
  const ai = new BinokelAIPlayer(0, 0);
  return ai.decide({ gameState: state, playerIndex: 0, sessionId: 'test' });
}

describe('going out', () => {
  it('plays on where the old 0.7 threshold would have bailed out (regression)', async () => {
    // The estimator scores this hand around 47. Under the old threshold 0.7 * 200 = 140 sent it
    // out; under 0.2 * 200 = 40 it plays the round, which is what was worth 16 points of win
    // rate in four-player games.
    expect((await decide(discardState(200))).type).toBe('discard');
  });

  it('still goes out when even the lower threshold is not met', async () => {
    // Abgehen stays available: 0.2 rather than 0 exists so a dead hand can still use it.
    // 0.2 * 250 = 50, just above this hand's estimate.
    expect((await decide(discardState(250))).type).toBe('goOut');
  });
});
