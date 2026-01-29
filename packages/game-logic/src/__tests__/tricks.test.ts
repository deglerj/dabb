import { describe, expect, it } from 'vitest';
import type { Card, Suit, Trick } from '@dabb/shared-types';

import {
  calculateTrickPoints,
  determineTrickWinner,
  getValidPlays,
  isValidPlay,
} from '../phases/tricks.js';

// Helper to create cards
function card(suit: Suit, rank: Card['rank'], copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

// Helper to create a trick
function createTrick(cards: { card: Card; playerIndex: 0 | 1 | 2 | 3 }[]): Trick {
  return {
    cards: cards.map((c) => ({ cardId: c.card.id, card: c.card, playerIndex: c.playerIndex })),
    leadSuit: cards[0]?.card.suit || null,
    winnerIndex: null,
  };
}

describe('Trick Logic', () => {
  describe('determineTrickWinner', () => {
    it('highest card of lead suit wins when no trump', () => {
      const trick = createTrick([
        { card: card('herz', 'koenig'), playerIndex: 0 },
        { card: card('herz', 'ass'), playerIndex: 1 },
        { card: card('herz', '10'), playerIndex: 2 },
      ]);

      const winnerIdx = determineTrickWinner(trick, 'kreuz');
      expect(winnerIdx).toBe(1); // Ass wins
    });

    it('trump beats lead suit', () => {
      const trick = createTrick([
        { card: card('herz', 'ass'), playerIndex: 0 },
        { card: card('kreuz', 'buabe'), playerIndex: 1 }, // Trump Buabe
        { card: card('herz', '10'), playerIndex: 2 },
      ]);

      const winnerIdx = determineTrickWinner(trick, 'kreuz');
      expect(winnerIdx).toBe(1); // Trump Buabe beats Herz Ass
    });

    it('higher trump beats lower trump', () => {
      const trick = createTrick([
        { card: card('kreuz', 'buabe'), playerIndex: 0 },
        { card: card('kreuz', 'ober'), playerIndex: 1 },
        { card: card('kreuz', 'koenig'), playerIndex: 2 },
      ]);

      const winnerIdx = determineTrickWinner(trick, 'kreuz');
      expect(winnerIdx).toBe(2); // König beats Ober beats Buabe
    });

    it('off-suit card cannot win', () => {
      const trick = createTrick([
        { card: card('herz', 'koenig'), playerIndex: 0 },
        { card: card('schippe', 'ass'), playerIndex: 1 }, // Off-suit (not trump)
        { card: card('herz', 'ober'), playerIndex: 2 },
      ]);

      const winnerIdx = determineTrickWinner(trick, 'kreuz');
      expect(winnerIdx).toBe(0); // Herz König wins, Schippe Ass is off-suit
    });

    it('10 beats König in same suit', () => {
      const trick = createTrick([
        { card: card('herz', 'koenig'), playerIndex: 0 },
        { card: card('herz', '10'), playerIndex: 1 },
      ]);

      const winnerIdx = determineTrickWinner(trick, 'kreuz');
      expect(winnerIdx).toBe(1); // 10 beats König
    });
  });

  describe('getValidPlays', () => {
    it('any card is valid on empty trick', () => {
      const hand = [card('herz', 'ass'), card('kreuz', 'koenig'), card('schippe', 'buabe')];
      const emptyTrick: Trick = { cards: [], leadSuit: null, winnerIndex: null };

      const validPlays = getValidPlays(hand, emptyTrick, 'kreuz');
      expect(validPlays).toHaveLength(3);
    });

    it('must follow suit if possible', () => {
      const hand = [card('herz', 'ass'), card('herz', 'koenig'), card('kreuz', 'buabe')];
      const trick = createTrick([
        { card: card('herz', 'buabe'), playerIndex: 0 }, // Low card that both can beat
      ]);

      const validPlays = getValidPlays(hand, trick, 'kreuz');

      expect(validPlays).toHaveLength(2);
      expect(validPlays.every((c) => c.suit === 'herz')).toBe(true);
    });

    it('must beat if following suit and can beat', () => {
      const hand = [card('herz', 'ass'), card('herz', 'buabe')];
      const trick = createTrick([{ card: card('herz', 'koenig'), playerIndex: 0 }]);

      const validPlays = getValidPlays(hand, trick, 'kreuz');

      // Only Ass can beat König
      expect(validPlays).toHaveLength(1);
      expect(validPlays[0].rank).toBe('ass');
    });

    it('can play any of suit if cannot beat', () => {
      const hand = [card('herz', 'buabe'), card('herz', 'ober')];
      const trick = createTrick([{ card: card('herz', 'ass'), playerIndex: 0 }]);

      const validPlays = getValidPlays(hand, trick, 'kreuz');

      // Cannot beat Ass, so any Herz is valid
      expect(validPlays).toHaveLength(2);
    });

    it('must trump if cannot follow suit', () => {
      const hand = [
        card('schippe', 'ass'),
        card('kreuz', 'buabe'), // Trump
        card('kreuz', 'ober'), // Trump
      ];
      const trick = createTrick([{ card: card('herz', 'koenig'), playerIndex: 0 }]);

      const validPlays = getValidPlays(hand, trick, 'kreuz');

      expect(validPlays).toHaveLength(2);
      expect(validPlays.every((c) => c.suit === 'kreuz')).toBe(true);
    });

    it('any card valid if cannot follow or trump', () => {
      const hand = [card('schippe', 'ass'), card('bollen', 'koenig')];
      const trick = createTrick([{ card: card('herz', 'koenig'), playerIndex: 0 }]);

      const validPlays = getValidPlays(hand, trick, 'kreuz');

      expect(validPlays).toHaveLength(2);
    });
  });

  describe('isValidPlay', () => {
    it('returns true for valid plays', () => {
      const hand = [card('herz', 'ass'), card('kreuz', 'buabe')];
      const emptyTrick: Trick = { cards: [], leadSuit: null, winnerIndex: null };

      expect(isValidPlay(hand[0], hand, emptyTrick, 'kreuz')).toBe(true);
    });

    it('returns false for invalid plays', () => {
      const herzAss = card('herz', 'ass');
      const hand = [herzAss, card('schippe', 'koenig')];
      const trick = createTrick([{ card: card('schippe', '10'), playerIndex: 0 }]);

      // Must follow Schippe, so Herz Ass is invalid
      expect(isValidPlay(herzAss, hand, trick, 'kreuz')).toBe(false);
    });
  });

  describe('calculateTrickPoints', () => {
    it('calculates points correctly', () => {
      const cards = [
        card('herz', 'ass'), // 11
        card('herz', '10'), // 10
        card('herz', 'koenig'), // 4
        card('herz', 'buabe'), // 2
      ];

      expect(calculateTrickPoints(cards)).toBe(27);
    });

    it('returns 0 for empty cards', () => {
      expect(calculateTrickPoints([])).toBe(0);
    });
  });

  describe('PlayedCard structure (regression)', () => {
    // Regression test for bug where played cards were not visible to other players.
    // The issue was that PlayedCard only stored cardId, not the full Card object.
    // When a card was played, it was removed from the player's hand, so looking it up
    // by cardId from hands returned undefined, causing the TrickArea to show nothing.
    it('PlayedCard contains full card object for rendering', () => {
      const herzKoenig = card('herz', 'koenig');
      const trick = createTrick([{ card: herzKoenig, playerIndex: 0 }]);

      // Verify the PlayedCard structure includes the card object
      expect(trick.cards[0].card).toBeDefined();
      expect(trick.cards[0].card.suit).toBe('herz');
      expect(trick.cards[0].card.rank).toBe('koenig');
      expect(trick.cards[0].cardId).toBe(herzKoenig.id);
    });

    it('all played cards are accessible from trick without needing hand lookup', () => {
      const cards = [
        { card: card('herz', 'ass'), playerIndex: 0 as const },
        { card: card('herz', '10'), playerIndex: 1 as const },
        { card: card('kreuz', 'buabe'), playerIndex: 2 as const },
      ];
      const trick = createTrick(cards);

      // Each played card should have the full card object embedded
      trick.cards.forEach((playedCard, index) => {
        expect(playedCard.card).toEqual(cards[index].card);
        expect(playedCard.playerIndex).toBe(cards[index].playerIndex);
      });
    });
  });
});
