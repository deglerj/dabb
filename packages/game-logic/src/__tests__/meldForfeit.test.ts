/**
 * Regression tests: a player (3-player) or team (4-player) that wins no trick at all
 * forfeits its melds for the round.
 *
 * The trap is the bid winner's layaway: CARDS_DISCARDED pushes it into `tricksTaken` as an
 * extra entry, so a non-empty `tricksTaken` does not mean a trick was won. Its points still
 * count, only the melds are gone.
 */

import { describe, expect, it } from 'vitest';
import type {
  Card,
  CompletedTrick,
  GameState,
  Meld,
  PlayerIndex,
  Player,
  Suit,
  Team,
} from '@dabb/shared-types';

import { createInitialState } from '../state/initial.js';
import { createRoundEndEvents } from '../engine/scoring.js';

function card(suit: Suit, rank: Card['rank'], copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

/** A Familie, worth 100. Only the points matter here. */
function familie(suit: Suit): Meld {
  return { type: 'familie', cards: [], points: 100, suit };
}

/** A trick won by `winnerIndex`; only the winner matters for the forfeit rule. */
function wonBy(winnerIndex: PlayerIndex): CompletedTrick {
  return { cards: [], winnerIndex, points: 0, round: 0 };
}

function nextContext() {
  let sequence = 0;
  return () => ({ sessionId: 'meld-forfeit', sequence: ++sequence });
}

function roundScores(state: GameState) {
  const events = createRoundEndEvents(state, nextContext());
  const scored = events.find((e) => e.type === 'ROUND_SCORED');
  if (scored?.type !== 'ROUND_SCORED') {
    throw new Error('no ROUND_SCORED event');
  }
  return scored.payload.scores;
}

describe('melds are forfeit without a trick (regression)', () => {
  it('3-player: the trickless player loses their melds, the others keep theirs', () => {
    const state: GameState = {
      ...createInitialState(3),
      phase: 'tricks',
      currentBid: 150,
      bidWinner: 0 as PlayerIndex,
      declaredMelds: new Map<PlayerIndex, Meld[]>([
        [0 as PlayerIndex, [familie('herz')]],
        [1 as PlayerIndex, [familie('kreuz')]],
        [2 as PlayerIndex, [familie('schippe')]], // forfeit: no trick
      ]),
      tricksTaken: new Map<PlayerIndex, Card[][]>([
        [0 as PlayerIndex, [[card('herz', 'ass'), card('herz', '10')]]], // 21
        [1 as PlayerIndex, [[card('kreuz', 'ass'), card('kreuz', '10')]]], // 21
        [2 as PlayerIndex, []],
      ]),
      trickHistory: [wonBy(0 as PlayerIndex), wonBy(1 as PlayerIndex)],
      lastCompletedTrick: null,
    };

    const scores = roundScores(state);

    expect(scores[0 as PlayerIndex]).toMatchObject({ melds: 100, tricks: 20 });
    expect(scores[1 as PlayerIndex]).toMatchObject({ melds: 100, tricks: 20 });
    expect(scores[2 as PlayerIndex]).toMatchObject({ melds: 0, tricks: 0, total: 0 });
  });

  it('3-player: the bid winner’s layaway is not a trick', () => {
    const state: GameState = {
      ...createInitialState(3),
      phase: 'tricks',
      currentBid: 200,
      bidWinner: 0 as PlayerIndex,
      declaredMelds: new Map<PlayerIndex, Meld[]>([[0 as PlayerIndex, [familie('herz')]]]),
      tricksTaken: new Map<PlayerIndex, Card[][]>([
        // Only entry is the layaway pushed by CARDS_DISCARDED: 11 + 10 = 21 points, no trick.
        [0 as PlayerIndex, [[card('schippe', 'ass'), card('schippe', '10')]]],
        [1 as PlayerIndex, [[card('kreuz', 'ass')]]],
        [2 as PlayerIndex, [[card('bollen', 'ass')]]],
      ]),
      trickHistory: [wonBy(1 as PlayerIndex), wonBy(2 as PlayerIndex)],
      lastCompletedTrick: null,
    };

    const scores = roundScores(state);

    // Melds gone, layaway points kept, bid missed → -2 × 200.
    expect(scores[0 as PlayerIndex]).toEqual({
      melds: 0,
      tricks: 20,
      total: -400,
      bidMet: false,
    });
  });

  it('4-player: the rule is per team — a partner without a trick keeps their melds', () => {
    const players: Player[] = [
      { id: 'p0', nickname: 'Alice', playerIndex: 0 as PlayerIndex, team: 0 as Team },
      { id: 'p1', nickname: 'Bob', playerIndex: 1 as PlayerIndex, team: 1 as Team },
      { id: 'p2', nickname: 'Carol', playerIndex: 2 as PlayerIndex, team: 0 as Team },
      { id: 'p3', nickname: 'Dave', playerIndex: 3 as PlayerIndex, team: 1 as Team },
    ];

    const state: GameState = {
      ...createInitialState(4),
      phase: 'tricks',
      players,
      currentBid: 150,
      bidWinner: 0 as PlayerIndex,
      declaredMelds: new Map<PlayerIndex, Meld[]>([
        [0 as PlayerIndex, [familie('herz')]],
        [1 as PlayerIndex, [familie('kreuz')]],
        [2 as PlayerIndex, [familie('schippe')]], // no trick, but Alice took one
        [3 as PlayerIndex, [familie('bollen')]], // team 1 took nothing at all
      ]),
      tricksTaken: new Map<PlayerIndex, Card[][]>([
        // Layaway plus one real trick for the bid winner.
        [
          0 as PlayerIndex,
          [
            [card('schippe', 'koenig'), card('schippe', 'ober')], // layaway, 7
            [card('herz', 'ass'), card('herz', '10')], // trick, 21
          ],
        ],
        [1 as PlayerIndex, []],
        [2 as PlayerIndex, []],
        [3 as PlayerIndex, []],
      ]),
      trickHistory: [wonBy(0 as PlayerIndex)],
      lastCompletedTrick: null,
    };

    const scores = roundScores(state);

    expect(scores[0 as Team]).toMatchObject({ melds: 200, tricks: 30 });
    expect(scores[1 as Team]).toMatchObject({ melds: 0, tricks: 0, total: 0 });
  });
});
