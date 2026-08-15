/**
 * Tests for the strategy-2 trick-play rules (S1 census, S2 don't-feed).
 *
 * Every case is played out through `decide`, with mistakes off, so what is asserted is the card
 * the AI actually plays rather than the output of a helper.
 */

import { describe, expect, it } from 'vitest';
import type {
  Card,
  CompletedTrick,
  GameState,
  PlayedCard,
  PlayerIndex,
  Rank,
  Suit,
} from '@dabb/shared-types';
import { createInitialState } from '@dabb/game-logic';

import { BinokelAIPlayer } from '../BinokelAIPlayer.js';
import type { AIStrategy } from '../AIPlayer.js';

function card(suit: Suit, rank: Rank, copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

function play(playerIndex: PlayerIndex, c: Card): PlayedCard {
  return { cardId: c.id, card: c, playerIndex };
}

function trick(cards: PlayedCard[], winnerIndex: PlayerIndex, round = 1): CompletedTrick {
  return { cards, winnerIndex, points: 0, round };
}

/**
 * Trump is Herz throughout. Partners sit opposite: Alice(0)/Carol(2) and Bob(1)/Dave(3) — so
 * for Bob the player who acts right after him, Carol, is an opponent, and Dave is not.
 */
function tricksState(playerCount: 2 | 4, overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState(playerCount);
  const players = [
    { id: 'p0', nickname: 'Alice', playerIndex: 0 as PlayerIndex, team: 0 as const },
    { id: 'p1', nickname: 'Bob', playerIndex: 1 as PlayerIndex, team: 1 as const },
    { id: 'p2', nickname: 'Carol', playerIndex: 2 as PlayerIndex, team: 0 as const },
    { id: 'p3', nickname: 'Dave', playerIndex: 3 as PlayerIndex, team: 1 as const },
  ];
  return {
    ...state,
    phase: 'tricks',
    playerCount,
    players: players.slice(0, playerCount),
    trump: 'herz',
    round: 1,
    ...overrides,
  };
}

async function playedCard(state: GameState, seat: PlayerIndex, strategy: AIStrategy) {
  // Mistake probability 0, rubber band 0: the choice under test, never a blunder.
  const ai = new BinokelAIPlayer(0, 0, strategy);
  const action = await ai.decide({ gameState: state, playerIndex: seat, sessionId: 'test' });
  if (action.type !== 'playCard') {
    throw new Error(`Expected playCard, got ${action.type}`);
  }
  return action.cardId;
}

/**
 * The partner exemption is the only situation in Binokel where a player chooses between winning
 * and not winning a trick — everywhere else must-beat decides for them. So every "hold the Ass
 * back" rule lives in this one slot, and these are the cases that exercise it.
 *
 * Seating: Alice(0)/Carol(2) versus Bob(1)/Dave(3).
 */
describe('S2 — overtaking the partner', () => {
  const aliceHand = [card('kreuz', 'ass'), card('kreuz', 'buabe'), card('bollen', 'koenig')];

  /**
   * Carol leads, so the turn order is Carol(2) → Dave(3) → Alice(0) → Bob(1). Alice plays third
   * with her partner Carol still winning, which puts her under the exemption, and the only
   * player behind her is the opponent Bob.
   */
  function partnerWinningState(bobIsThreatening: boolean): GameState {
    return tricksState(4, {
      hands: new Map([[0 as PlayerIndex, aliceHand]]),
      trickHistory: bobIsThreatening
        ? [
            // Dave leads and is still winning when Bob plays, so Bob is exempt from must-trump.
            // His off-suit discard proves he is void in Kreuz but says nothing about his trump.
            trick(
              [
                play(3, card('kreuz', 'ass', 1)),
                play(0, card('kreuz', 'koenig')),
                play(1, card('bollen', 'ober')),
                play(2, card('kreuz', '10', 1)),
              ],
              3
            ),
          ]
        : [
            // Alice leads instead, so Bob discards off-suit with must-trump in force: void in
            // Kreuz *and* in trump, and nothing he holds can take a Kreuz trick.
            trick(
              [
                play(0, card('kreuz', 'ass', 1)),
                play(1, card('bollen', 'ober')),
                play(2, card('kreuz', '10', 1)),
                play(3, card('kreuz', 'koenig')),
              ],
              0
            ),
          ],
      currentTrick: {
        // Carol (Alice's partner) leads the Zehn and Dave's König does not beat it.
        cards: [play(2, card('kreuz', '10')), play(3, card('kreuz', 'koenig', 1))],
        leadSuit: 'kreuz',
        winnerIndex: null,
      },
      currentPlayer: 0 as PlayerIndex,
    });
  }

  it('smears onto the partner instead of overtaking when nobody behind is a threat', async () => {
    // Bob is void in Kreuz and in trump, so Carol's trick is safe. Alice banks points on it
    // rather than spending her Ass to take it off her own partner.
    expect(await playedCard(partnerWinningState(false), 0, 2)).toBe('kreuz-buabe-0');
  });

  it('does not protect with an expensive card the threat can beat anyway', async () => {
    // Bob can ruff. Alice's only overtake is the Ass, which the ruff beats too — so spending it
    // would lose the Ass as well as the trick.
    expect(await playedCard(partnerWinningState(true), 0, 2)).toBe('kreuz-buabe-0');
  });

  it('strategy 1 overtakes its own partner from a non-final seat, which is the leak', async () => {
    expect(await playedCard(partnerWinningState(false), 0, 1)).toBe('kreuz-ass-0');
  });

  it('still smears from the last seat under strategy 1', async () => {
    const state = tricksState(4, {
      hands: new Map([[3 as PlayerIndex, [card('kreuz', 'ass'), card('kreuz', 'buabe')]]]),
      currentTrick: {
        cards: [
          play(0, card('kreuz', 'buabe', 1)),
          play(1, card('kreuz', 'koenig')),
          play(2, card('kreuz', 'ober')),
        ],
        leadSuit: 'kreuz',
        winnerIndex: null,
      },
      currentPlayer: 3 as PlayerIndex,
    });

    // Seat 3's partner is seat 1, who is winning, and seat 3 is last — both strategies smear.
    expect(await playedCard(state, 3, 1)).toBe('kreuz-buabe-0');
    expect(await playedCard(state, 3, 2)).toBe('kreuz-buabe-0');
  });

  it('never ducks when must-beat leaves only winning cards', async () => {
    // No partner is winning, so the rules force the Ass whatever the AI would prefer. This is
    // the ordinary case: 0% of 2- and 3-player follow decisions ever offer a choice.
    const state = tricksState(4, {
      hands: new Map([[1 as PlayerIndex, [card('kreuz', 'ass'), card('kreuz', '10')]]]),
      currentTrick: {
        cards: [play(0, card('kreuz', 'koenig'))],
        leadSuit: 'kreuz',
        winnerIndex: null,
      },
      currentPlayer: 1 as PlayerIndex,
    });

    expect(await playedCard(state, 1, 2)).toBe('kreuz-10-0');
  });
});

describe('S1 — endgame trump lead is gated on the census', () => {
  /** Last three cards, leading, holding trump plus a plain Ass. */
  function endgameState(trumpAllPlayed: boolean): GameState {
    const spentTrump: CompletedTrick[] = [];
    if (trumpAllPlayed) {
      // Every Herz except the two in our own hand goes through the trick history.
      const ranks: Rank[] = ['ass', '10', 'koenig', 'ober'];
      for (const rank of ranks) {
        for (const copy of [0, 1] as const) {
          spentTrump.push(
            trick([play(1, card('herz', rank, copy)), play(0, card('kreuz', 'buabe', copy))], 1)
          );
        }
      }
      spentTrump.push(
        trick([play(1, card('herz', 'buabe', 1)), play(0, card('schippe', 'buabe'))], 1)
      );
    }

    return tricksState(2, {
      // No ace: rule 1 leads a lonely ace before the endgame rule is ever reached, which would
      // decide the test instead of the rule under it.
      hands: new Map([
        [
          0 as PlayerIndex,
          [card('herz', 'buabe'), card('bollen', 'koenig'), card('schippe', 'koenig')],
        ],
      ]),
      trickHistory: spentTrump,
      currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
      currentPlayer: 0 as PlayerIndex,
    });
  }

  it('leads trump while opponents can still ruff', async () => {
    expect(await playedCard(endgameState(false), 0, 2)).toBe('herz-buabe-0');
  });

  it('does not spend trump once no trump is left outside our hand', async () => {
    expect(await playedCard(endgameState(true), 0, 2)).not.toBe('herz-buabe-0');
  });

  it('strategy 1 spends the trump either way, which is the leak', async () => {
    expect(await playedCard(endgameState(true), 0, 1)).toBe('herz-buabe-0');
  });
});
