import { describe, expect, it } from 'vitest';

import { createDeck, dealCards, shuffleDeck, sortHand } from '../cards/deck';

describe('Deck', () => {
  describe('createDeck', () => {
    it('creates a deck with 40 cards', () => {
      const deck = createDeck();
      expect(deck).toHaveLength(40);
    });

    it('has 2 copies of each card', () => {
      const deck = createDeck();
      const cardCounts = new Map<string, number>();

      for (const card of deck) {
        const key = `${card.suit}-${card.rank}`;
        cardCounts.set(key, (cardCounts.get(key) || 0) + 1);
      }

      // Each unique card should appear exactly twice
      for (const count of cardCounts.values()) {
        expect(count).toBe(2);
      }
    });

    it('has all 4 suits', () => {
      const deck = createDeck();
      const suits = new Set(deck.map((c) => c.suit));
      expect(suits).toEqual(new Set(['kreuz', 'schippe', 'herz', 'bollen']));
    });

    it('has all 5 ranks', () => {
      const deck = createDeck();
      const ranks = new Set(deck.map((c) => c.rank));
      expect(ranks).toEqual(new Set(['buabe', 'ober', 'koenig', '10', 'ass']));
    });
  });

  describe('shuffleDeck', () => {
    it('returns a deck with the same cards', () => {
      const deck = createDeck();
      const shuffled = shuffleDeck(deck);

      expect(shuffled).toHaveLength(40);

      const originalIds = new Set(deck.map((c) => c.id));
      const shuffledIds = new Set(shuffled.map((c) => c.id));
      expect(shuffledIds).toEqual(originalIds);
    });

    it('does not modify the original deck', () => {
      const deck = createDeck();
      const originalIds = deck.map((c) => c.id);

      shuffleDeck(deck);

      expect(deck.map((c) => c.id)).toEqual(originalIds);
    });
  });

  describe('dealCards', () => {
    it('deals correctly for 2 players (16 cards each, 8 dabb)', () => {
      const deck = shuffleDeck(createDeck());
      const { hands, dabb } = dealCards(deck, 2);

      expect(hands.size).toBe(2);
      expect(hands.get(0)).toHaveLength(16);
      expect(hands.get(1)).toHaveLength(16);
      expect(dabb).toHaveLength(8);
    });

    it('deals correctly for 3 players (12 cards each, 4 dabb)', () => {
      const deck = shuffleDeck(createDeck());
      const { hands, dabb } = dealCards(deck, 3);

      expect(hands.size).toBe(3);
      expect(hands.get(0)).toHaveLength(12);
      expect(hands.get(1)).toHaveLength(12);
      expect(hands.get(2)).toHaveLength(12);
      expect(dabb).toHaveLength(4);
    });

    it('deals correctly for 4 players (9 cards each, 4 dabb)', () => {
      const deck = shuffleDeck(createDeck());
      const { hands, dabb } = dealCards(deck, 4);

      expect(hands.size).toBe(4);
      expect(hands.get(0)).toHaveLength(9);
      expect(hands.get(1)).toHaveLength(9);
      expect(hands.get(2)).toHaveLength(9);
      expect(hands.get(3)).toHaveLength(9);
      expect(dabb).toHaveLength(4);
    });

    it('deals all 40 cards', () => {
      const deck = shuffleDeck(createDeck());
      const { hands, dabb } = dealCards(deck, 4);

      const allDealtCards = [
        ...hands.get(0)!,
        ...hands.get(1)!,
        ...hands.get(2)!,
        ...hands.get(3)!,
        ...dabb,
      ];

      expect(allDealtCards).toHaveLength(40);
    });
  });

  describe('sortHand', () => {
    it('sorts by suit first, then by rank', () => {
      const hand = [
        { id: '1', suit: 'herz' as const, rank: 'buabe' as const, copy: 0 as const },
        { id: '2', suit: 'kreuz' as const, rank: 'ass' as const, copy: 0 as const },
        { id: '3', suit: 'herz' as const, rank: 'ass' as const, copy: 0 as const },
        { id: '4', suit: 'schippe' as const, rank: 'koenig' as const, copy: 0 as const },
      ];

      const sorted = sortHand(hand);

      expect(sorted.map((c) => c.suit)).toEqual(['kreuz', 'schippe', 'herz', 'herz']);
      expect(sorted[2].rank).toBe('ass');
      expect(sorted[3].rank).toBe('buabe');
    });
  });
});
