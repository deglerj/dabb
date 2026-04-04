/**
 * Regression tests for trick scoring bugs:
 * 1. Discarded dabb cards must count toward bid winner's trick points
 * 2. Last trick winner receives a 10-point bonus
 */

import { describe, expect, it } from 'vitest';
import type { Card, GameState, PlayerIndex, Suit } from '@dabb/shared-types';

import { applyEvent } from '../state/reducer.js';
import { createInitialState } from '../state/initial.js';
import { createCardsDiscardedEvent } from '../events/generators.js';
import { calculatePlayerTrickRawPoints, LAST_TRICK_BONUS } from '../phases/tricks.js';

function card(suit: Suit, rank: Card['rank'], copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

describe('Trick scoring', () => {
  describe('discarded dabb cards count for bid winner (regression)', () => {
    it('adds discarded cards to bid winner tricksTaken after CARDS_DISCARDED', () => {
      const discarded = [
        card('schippe', 'ass'), // 11 pts
        card('schippe', '10'), // 10 pts
        card('schippe', 'koenig'), // 4 pts
        card('schippe', 'ober'), // 3 pts
      ];
      const remaining = [card('herz', 'ass'), card('herz', '10')];

      const state: GameState = {
        ...createInitialState(2),
        phase: 'dabb',
        bidWinner: 0 as PlayerIndex,
        hands: new Map<PlayerIndex, Card[]>([
          [0 as PlayerIndex, [...remaining, ...discarded]],
          [1 as PlayerIndex, []],
        ]),
        tricksTaken: new Map<PlayerIndex, Card[][]>([
          [0 as PlayerIndex, []],
          [1 as PlayerIndex, []],
        ]),
      };

      const event = createCardsDiscardedEvent(
        { sessionId: 'test', sequence: 1 },
        0 as PlayerIndex,
        discarded.map((c) => c.id)
      );

      const newState = applyEvent(state, event);

      const bidWinnerTricks = newState.tricksTaken.get(0 as PlayerIndex)!;
      expect(bidWinnerTricks).toHaveLength(1); // discarded cards form one group
      expect(bidWinnerTricks[0]).toHaveLength(4);
      expect(bidWinnerTricks[0]).toEqual(expect.arrayContaining(discarded));
    });

    it('does not add cards to non-bid-winner tricksTaken', () => {
      const discarded = [card('schippe', 'ass'), card('schippe', '10')];
      const remaining = [card('herz', 'ass')];

      const state: GameState = {
        ...createInitialState(2),
        phase: 'dabb',
        bidWinner: 0 as PlayerIndex, // player 0 is bid winner
        hands: new Map<PlayerIndex, Card[]>([
          [0 as PlayerIndex, [...remaining, ...discarded]],
          [1 as PlayerIndex, [card('kreuz', 'ass')]],
        ]),
        tricksTaken: new Map<PlayerIndex, Card[][]>([
          [0 as PlayerIndex, []],
          [1 as PlayerIndex, []],
        ]),
      };

      const event = createCardsDiscardedEvent(
        { sessionId: 'test', sequence: 1 },
        0 as PlayerIndex,
        discarded.map((c) => c.id)
      );

      const newState = applyEvent(state, event);

      // Player 1's tricksTaken must remain untouched
      const player1Tricks = newState.tricksTaken.get(1 as PlayerIndex)!;
      expect(player1Tricks).toHaveLength(0);
    });
  });

  describe('last trick bonus (regression)', () => {
    it('LAST_TRICK_BONUS is 10', () => {
      expect(LAST_TRICK_BONUS).toBe(10);
    });

    it('adds 10 bonus points to last trick winner', () => {
      const tricksTaken = new Map<PlayerIndex, Card[][]>([
        [0 as PlayerIndex, [[card('herz', 'ass'), card('kreuz', 'ass')]]], // 22 pts
        [1 as PlayerIndex, [[card('schippe', 'koenig'), card('bollen', 'koenig')]]], // 8 pts
      ]);

      const player0Raw = calculatePlayerTrickRawPoints(
        0 as PlayerIndex,
        tricksTaken,
        0 as PlayerIndex // player 0 won last trick
      );
      const player1Raw = calculatePlayerTrickRawPoints(
        1 as PlayerIndex,
        tricksTaken,
        0 as PlayerIndex
      );

      expect(player0Raw).toBe(22 + LAST_TRICK_BONUS); // 32
      expect(player1Raw).toBe(8); // no bonus
    });

    it('only the last trick winner gets the bonus, not other players', () => {
      const tricksTaken = new Map<PlayerIndex, Card[][]>([
        [0 as PlayerIndex, [[card('herz', 'ass')]]], // 11 pts
        [1 as PlayerIndex, [[card('schippe', 'ass')]]], // 11 pts
      ]);

      const player0Raw = calculatePlayerTrickRawPoints(
        0 as PlayerIndex,
        tricksTaken,
        1 as PlayerIndex // player 1 won last trick
      );
      const player1Raw = calculatePlayerTrickRawPoints(
        1 as PlayerIndex,
        tricksTaken,
        1 as PlayerIndex
      );

      expect(player0Raw).toBe(11);
      expect(player1Raw).toBe(11 + LAST_TRICK_BONUS); // 21
    });

    it('no bonus when lastTrickWinner is null', () => {
      const tricksTaken = new Map<PlayerIndex, Card[][]>([
        [0 as PlayerIndex, [[card('herz', 'ass')]]], // 11 pts
      ]);

      const raw = calculatePlayerTrickRawPoints(0 as PlayerIndex, tricksTaken, null);

      expect(raw).toBe(11);
    });
  });
});
