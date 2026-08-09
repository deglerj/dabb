/**
 * Regression test for 4-player partner-aware trick play ("smearing").
 *
 * The AI decided whether its partner was winning by reading `trick.winnerIndex`, which the
 * reducer only ever sets on a *completed* trick — the in-progress trick always carries null.
 * Smearing was therefore dead code and the AI dumped its cheapest card onto its own
 * partner's winning trick instead of feeding it points.
 */
import { describe, it, expect } from 'vitest';
import { createInitialState } from '@dabb/game-logic';
import type { Card, GameState, PlayerIndex, Rank, Suit, Team } from '@dabb/shared-types';
import { createAIPlayer } from '../AIPlayer.js';

function card(suit: Suit, rank: Rank, copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

/**
 * Trick in progress, trump = kreuz, lead suit = herz:
 *   seat 0 (team 0) played herz-buabe
 *   seat 1 (team 1) played herz-ass  ← currently winning
 *   seat 2 (team 0) played herz-koenig
 * Seat 3 is last to play and is seat 1's partner. Neither of its herz cards can beat the
 * Ass, so it should smear its most valuable one.
 */
function trickInProgress(): GameState {
  const base = createInitialState(4);
  const seat3Hand = [card('herz', 'ober'), card('herz', '10')];

  return {
    ...base,
    phase: 'tricks',
    round: 1,
    trump: 'kreuz' as Suit,
    players: [0, 1, 2, 3].map((i) => ({
      id: `p${i}`,
      nickname: `P${i}`,
      playerIndex: i as PlayerIndex,
      team: (i % 2) as Team,
      connected: true,
    })),
    hands: new Map<PlayerIndex, Card[]>([
      [0 as PlayerIndex, []],
      [1 as PlayerIndex, []],
      [2 as PlayerIndex, []],
      [3 as PlayerIndex, seat3Hand],
    ]),
    tricksTaken: new Map<PlayerIndex, Card[][]>([
      [0 as PlayerIndex, []],
      [1 as PlayerIndex, []],
      [2 as PlayerIndex, []],
      [3 as PlayerIndex, []],
    ]),
    currentPlayer: 3 as PlayerIndex,
    currentTrick: {
      leadSuit: 'herz' as Suit,
      winnerIndex: null, // as the reducer leaves it mid-trick
      cards: [
        { cardId: 'herz-buabe-0', card: card('herz', 'buabe'), playerIndex: 0 as PlayerIndex },
        { cardId: 'herz-ass-0', card: card('herz', 'ass'), playerIndex: 1 as PlayerIndex },
        { cardId: 'herz-koenig-0', card: card('herz', 'koenig'), playerIndex: 2 as PlayerIndex },
      ],
    },
  };
}

describe('4-player partner play', () => {
  it('smears points onto a partner’s winning trick (regression)', async () => {
    const action = await createAIPlayer('hard').decide({
      gameState: trickInProgress(),
      playerIndex: 3 as PlayerIndex,
      sessionId: 'test',
    });

    // Zehn (10 points) rather than Ober (3) — the partner is taking the trick either way
    expect(action).toEqual({ type: 'playCard', cardId: 'herz-10-0' });
  });

  it('dumps its cheapest card when an opponent is winning instead', async () => {
    const state = trickInProgress();
    // Swap seats 1 and 2's cards so an opponent of seat 3 holds the Ass
    state.currentTrick.cards[1] = {
      cardId: 'herz-koenig-0',
      card: card('herz', 'koenig'),
      playerIndex: 1 as PlayerIndex,
    };
    state.currentTrick.cards[2] = {
      cardId: 'herz-ass-0',
      card: card('herz', 'ass'),
      playerIndex: 2 as PlayerIndex,
    };

    const action = await createAIPlayer('hard').decide({
      gameState: state,
      playerIndex: 3 as PlayerIndex,
      sessionId: 'test',
    });

    expect(action).toEqual({ type: 'playCard', cardId: 'herz-ober-0' });
  });

  it('ducks rather than overtaking a partner it could beat', async () => {
    const state = trickInProgress();
    // Partner (seat 1) now wins with the König, which seat 3's Zehn could beat
    state.currentTrick.cards[1] = {
      cardId: 'herz-koenig-0',
      card: card('herz', 'koenig'),
      playerIndex: 1 as PlayerIndex,
    };
    state.currentTrick.cards[2] = {
      cardId: 'herz-buabe-1',
      card: card('herz', 'buabe', 1),
      playerIndex: 2 as PlayerIndex,
    };

    const action = await createAIPlayer('hard').decide({
      gameState: state,
      playerIndex: 3 as PlayerIndex,
      sessionId: 'test',
    });

    // The Zehn would beat the König; the exemption lets us keep it and throw the Ober,
    // where the old rules forced the overtake.
    expect(action).toEqual({ type: 'playCard', cardId: 'herz-ober-0' });
  });
});
