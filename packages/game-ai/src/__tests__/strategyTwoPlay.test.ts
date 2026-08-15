/**
 * Tests for the card-counting trick-play rules: overtaking a partner (S2) and the sacrifice
 * leads (S4). See docs/design/AI_STRATEGY_V2.md.
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

async function playedCard(state: GameState, seat: PlayerIndex) {
  // Mistake probability 0, rubber band 0: the choice under test, never a blunder.
  const ai = new BinokelAIPlayer(0, 0);
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
    expect(await playedCard(partnerWinningState(false), 0)).toBe('kreuz-buabe-0');
  });

  it('does not protect with an expensive card the threat can beat anyway', async () => {
    // Bob can ruff. Alice's only overtake is the Ass, which the ruff beats too — so spending it
    // would lose the Ass as well as the trick.
    expect(await playedCard(partnerWinningState(true), 0)).toBe('kreuz-buabe-0');
  });

  it('smears from the last seat, where nobody can answer at all', async () => {
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

    // Seat 3's partner is seat 1, who is winning, and seat 3 is last. This used to be its own
    // branch; it now falls out of the threat test, since an empty list of players yet to act
    // means the partner cannot be beaten.
    expect(await playedCard(state, 3)).toBe('kreuz-buabe-0');
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

    expect(await playedCard(state, 1)).toBe('kreuz-10-0');
  });
});

/**
 * Leading is the one decision Binokel never constrains, which is why the card counting pays off
 * here and barely anywhere else.
 */
describe('S4 — leads', () => {
  /** Every trump but our own Buabe has been played, so nothing can be ruffed. */
  function noTrumpLeftState(): GameState {
    const spent: CompletedTrick[] = [];
    for (const rank of ['ass', '10', 'koenig', 'ober'] as Rank[]) {
      for (const copy of [0, 1] as const) {
        spent.push(
          trick([play(1, card('herz', rank, copy)), play(0, card('kreuz', 'buabe', copy))], 1)
        );
      }
    }
    spent.push(trick([play(1, card('herz', 'buabe', 1)), play(0, card('schippe', 'buabe'))], 1));

    return tricksState(2, {
      hands: new Map([
        [
          0 as PlayerIndex,
          [card('herz', 'buabe'), card('bollen', 'ass'), card('schippe', 'koenig')],
        ],
      ]),
      trickHistory: spent,
      currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
      currentPlayer: 0 as PlayerIndex,
    });
  }

  it('cashes the lonely ace rather than spending a trump on the same trick', async () => {
    // The lonely-ace rule handles this. A census-based "lead whatever cannot be beaten" rule was
    // tried in place of it and measured 2.7 percentage points *worse* over 8000 games, so it was
    // dropped — see the P3 notes in docs/design/AI_STRATEGY_V2.md.
    expect(await playedCard(noTrumpLeftState(), 0)).toBe('bollen-ass-0');
  });

  /**
   * The inversion. Bob is known void in Kreuz and may still hold trump, so our Kreuz Ass can be
   * ruffed and no lead of ours is safe. Strategy 1 leads its dearest card into that; strategy 2
   * loses the trick as cheaply as it can.
   *
   * Bob's void has to come from a trick where the must-trump rule was not in force, or the same
   * discard would prove him out of trump and remove the threat. In a two-player game there is no
   * partner exemption, so the void is established by a *ruff* instead: he could not follow Kreuz
   * and trumped, which proves the Kreuz void while leaving his remaining trump unknown.
   */
  function nothingIsSafeState(): GameState {
    return tricksState(2, {
      hands: new Map([
        [
          0 as PlayerIndex,
          [card('kreuz', 'ass'), card('kreuz', 'buabe'), card('schippe', 'koenig')],
        ],
      ]),
      trickHistory: [
        trick([play(0, card('kreuz', 'koenig')), play(1, card('herz', 'ober'))], 1),
        // And a Schippe Ass is still out there, so the Schippe König is no refuge either.
        trick([play(0, card('bollen', 'koenig')), play(1, card('bollen', 'ass'))], 1),
      ],
      currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
      currentPlayer: 0 as PlayerIndex,
    });
  }

  it('leads low when nothing in hand is safe', async () => {
    // This sort used to run the other way, leading the Ass straight into the waiting ruff.
    expect(await playedCard(nothingIsSafeState(), 0)).not.toBe('kreuz-ass-0');
  });

  /**
   * S4a — the sacrifice. One trump is unaccounted for, only Bob can hold it, and he is known
   * void in Schippe. Leading our cheapest Schippe forces the ruff for two points and clears the
   * way for the Kreuz Ass.
   *
   * The void has to be established by a **ruff**, not by a discard. An off-suit discard proves a
   * trump void as well (must-trump was in force), which would remove the very threat the pull
   * exists to remove — so outside 4-player games, where the partner exemption offers a third
   * way, a ruff is the only evidence that leaves an opponent both void in a suit and possibly
   * still holding trump.
   */
  it('sacrifices a cheap card to force out the last trump', async () => {
    const spent: CompletedTrick[] = [];

    // Eight trump spent on tricks Bob led, so nothing is deduced about anyone from them.
    const trumpLeads = (['ass', '10', 'koenig', 'ober'] as Rank[]).flatMap((rank) =>
      ([0, 1] as const).map((copy) => card('herz', rank, copy))
    );
    const filler = (['ass', '10', 'koenig', 'ober'] as Rank[]).flatMap((rank) =>
      ([0, 1] as const).map((copy) => card('bollen', rank, copy))
    );
    trumpLeads.forEach((trumpCard, i) => {
      spent.push(trick([play(1, trumpCard), play(0, filler[i])], 1));
    });

    // The ninth: Bob could not follow Schippe and ruffed. Void in Schippe, and the Herz Buabe
    // he did not play is the one trump still unaccounted for.
    spent.push(trick([play(0, card('schippe', 'ass')), play(1, card('herz', 'buabe', 0))], 1));

    const state = tricksState(2, {
      hands: new Map([
        [
          0 as PlayerIndex,
          [card('kreuz', 'ass'), card('schippe', 'buabe'), card('schippe', 'koenig')],
        ],
      ]),
      trickHistory: spent,
      currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
      currentPlayer: 0 as PlayerIndex,
    });

    expect(await playedCard(state, 0)).toBe('schippe-buabe-0');
  });
});
