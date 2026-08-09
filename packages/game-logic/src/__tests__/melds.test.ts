import { describe, expect, it } from 'vitest';
import type { Card, Suit } from '@dabb/shared-types';

import { calculateMeldPoints, detectMelds } from '../melds/detector.js';

// Helper to create cards
function card(suit: Suit, rank: Card['rank'], copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

describe('Meld Detection', () => {
  describe('Paar (King + Ober of same suit)', () => {
    it('detects a single Paar', () => {
      const hand = [card('herz', 'koenig'), card('herz', 'ober'), card('kreuz', 'ass')];

      const melds = detectMelds(hand, 'kreuz');
      const paar = melds.find((m) => m.type === 'paar');

      expect(paar).toBeDefined();
      expect(paar?.points).toBe(20);
      expect(paar?.suit).toBe('herz');
    });

    it('detects trump Paar with bonus points', () => {
      const hand = [card('herz', 'koenig'), card('herz', 'ober')];

      const melds = detectMelds(hand, 'herz');
      const paar = melds.find((m) => m.type === 'paar');

      expect(paar).toBeDefined();
      expect(paar?.points).toBe(40); // 20 base + 20 trump bonus
    });

    it('detects double Paar in same suit', () => {
      const hand = [
        card('herz', 'koenig', 0),
        card('herz', 'koenig', 1),
        card('herz', 'ober', 0),
        card('herz', 'ober', 1),
      ];

      const melds = detectMelds(hand, 'kreuz');
      const paare = melds.filter((m) => m.type === 'paar');

      expect(paare).toHaveLength(2);
    });
  });

  describe('Familie (A-10-K-O-U of same suit)', () => {
    it('detects a Familie', () => {
      const hand = [
        card('schippe', 'ass'),
        card('schippe', '10'),
        card('schippe', 'koenig'),
        card('schippe', 'ober'),
        card('schippe', 'buabe'),
      ];

      const melds = detectMelds(hand, 'herz');
      const familie = melds.find((m) => m.type === 'familie');

      expect(familie).toBeDefined();
      expect(familie?.points).toBe(100);
      expect(familie?.suit).toBe('schippe');
    });

    it('detects trump Familie with bonus', () => {
      const hand = [
        card('herz', 'ass'),
        card('herz', '10'),
        card('herz', 'koenig'),
        card('herz', 'ober'),
        card('herz', 'buabe'),
      ];

      const melds = detectMelds(hand, 'herz');
      const familie = melds.find((m) => m.type === 'familie');

      expect(familie).toBeDefined();
      expect(familie?.points).toBe(150); // 100 + 50 trump bonus
    });

    it('Familie cards cannot be reused for Paar', () => {
      const hand = [
        card('schippe', 'ass'),
        card('schippe', '10'),
        card('schippe', 'koenig'),
        card('schippe', 'ober'),
        card('schippe', 'buabe'),
      ];

      const melds = detectMelds(hand, 'herz');
      const paare = melds.filter((m) => m.type === 'paar' && m.suit === 'schippe');

      expect(paare).toHaveLength(0);
    });
  });

  describe('Binokel (Ober Schippe + Buabe Bollen)', () => {
    it('detects single Binokel', () => {
      const hand = [card('schippe', 'ober'), card('bollen', 'buabe')];

      const melds = detectMelds(hand, 'herz');
      const binokel = melds.find((m) => m.type === 'binokel');

      expect(binokel).toBeDefined();
      expect(binokel?.points).toBe(40);
    });

    it('detects Doppel-Binokel', () => {
      const hand = [
        card('schippe', 'ober', 0),
        card('schippe', 'ober', 1),
        card('bollen', 'buabe', 0),
        card('bollen', 'buabe', 1),
      ];

      const melds = detectMelds(hand, 'herz');
      const doppelBinokel = melds.find((m) => m.type === 'doppel-binokel');

      expect(doppelBinokel).toBeDefined();
      expect(doppelBinokel?.points).toBe(300);
    });

    it('prefers Doppel-Binokel over single', () => {
      const hand = [
        card('schippe', 'ober', 0),
        card('schippe', 'ober', 1),
        card('bollen', 'buabe', 0),
        card('bollen', 'buabe', 1),
      ];

      const melds = detectMelds(hand, 'herz');
      const singleBinokel = melds.find((m) => m.type === 'binokel');
      const doppelBinokel = melds.find((m) => m.type === 'doppel-binokel');

      expect(singleBinokel).toBeUndefined();
      expect(doppelBinokel).toBeDefined();
    });
  });

  describe('Four of a kind', () => {
    it('detects vier Ass', () => {
      const hand = [
        card('kreuz', 'ass'),
        card('schippe', 'ass'),
        card('herz', 'ass'),
        card('bollen', 'ass'),
      ];

      const melds = detectMelds(hand, 'herz');
      const vierAss = melds.find((m) => m.type === 'vier-ass');

      expect(vierAss).toBeDefined();
      expect(vierAss?.points).toBe(100);
    });

    it('detects vier Unter', () => {
      const hand = [
        card('kreuz', 'buabe'),
        card('schippe', 'buabe'),
        card('herz', 'buabe'),
        card('bollen', 'buabe'),
      ];

      const melds = detectMelds(hand, 'herz');
      const vierUnter = melds.find((m) => m.type === 'vier-unter');

      expect(vierUnter).toBeDefined();
      expect(vierUnter?.points).toBe(40);
    });

    it('detects acht Ass', () => {
      const hand = [
        card('kreuz', 'ass', 0),
        card('kreuz', 'ass', 1),
        card('schippe', 'ass', 0),
        card('schippe', 'ass', 1),
        card('herz', 'ass', 0),
        card('herz', 'ass', 1),
        card('bollen', 'ass', 0),
        card('bollen', 'ass', 1),
      ];

      const melds = detectMelds(hand, 'herz');
      const achtAss = melds.find((m) => m.type === 'acht-ass');

      expect(achtAss).toBeDefined();
      expect(achtAss?.points).toBe(1000);
    });
  });

  describe('card reuse across melds', () => {
    // A card may pay in melds of different kinds, with one exception: a Familie absorbs the
    // Paar of its own suit. That exception is purely a function of detectPaar running last
    // and receiving the melds found so far — reordering the pushes in detectMelds would drop
    // it silently, so these pin it.
    const familie = (suit: Suit, copy: 0 | 1 = 0) => [
      card(suit, 'ass', copy),
      card(suit, '10', copy),
      card(suit, 'koenig', copy),
      card(suit, 'ober', copy),
      card(suit, 'buabe', copy),
    ];

    it('does not pay a Paar for the König and Ober inside a Familie', () => {
      const melds = detectMelds(familie('herz'), 'kreuz');

      expect(melds.filter((m) => m.type === 'familie')).toHaveLength(1);
      expect(melds.filter((m) => m.type === 'paar')).toHaveLength(0);
    });

    it('pays a Paar from a spare König and Ober left over by the Familie', () => {
      const hand = [...familie('herz'), card('herz', 'koenig', 1), card('herz', 'ober', 1)];

      const melds = detectMelds(hand, 'kreuz');

      expect(melds.filter((m) => m.type === 'familie')).toHaveLength(1);
      const paare = melds.filter((m) => m.type === 'paar');
      expect(paare).toHaveLength(1);
      // The spare copies, not the ones spent on the Familie
      expect(paare[0].cards.sort()).toEqual(['herz-koenig-1', 'herz-ober-1']);
    });

    it('pays no Paar at all when both Familien of a suit are held', () => {
      const melds = detectMelds([...familie('herz', 0), ...familie('herz', 1)], 'kreuz');

      expect(melds.filter((m) => m.type === 'familie')).toHaveLength(2);
      expect(melds.filter((m) => m.type === 'paar')).toHaveLength(0);
    });

    it('lets a König pay in both Vier Könige and a Paar (different kinds)', () => {
      const hand = [
        card('kreuz', 'koenig'),
        card('schippe', 'koenig'),
        card('herz', 'koenig'),
        card('bollen', 'koenig'),
        card('herz', 'ober'),
      ];

      const melds = detectMelds(hand, 'kreuz');
      const vier = melds.find((m) => m.type === 'vier-koenig');
      const paar = melds.find((m) => m.type === 'paar');

      expect(vier).toBeDefined();
      expect(paar).toBeDefined();
      // Same physical card in both melds — deliberate, not double-counting a mistake
      expect(vier!.cards).toContain('herz-koenig-0');
      expect(paar!.cards).toContain('herz-koenig-0');
      expect(calculateMeldPoints(melds)).toBe(100);
    });

    it('lets the Ober Schippe pay in both a Binokel and a Schippe-Paar', () => {
      const hand = [card('schippe', 'ober'), card('bollen', 'buabe'), card('schippe', 'koenig')];

      const melds = detectMelds(hand, 'kreuz');

      expect(melds.find((m) => m.type === 'binokel')?.cards).toContain('schippe-ober-0');
      expect(melds.find((m) => m.type === 'paar')?.cards).toContain('schippe-ober-0');
      expect(calculateMeldPoints(melds)).toBe(60);
    });
  });

  describe('calculateMeldPoints', () => {
    it('sums all meld points', () => {
      const melds = [
        { type: 'paar' as const, cards: [], points: 20 },
        { type: 'binokel' as const, cards: [], points: 40 },
      ];

      expect(calculateMeldPoints(melds)).toBe(60);
    });
  });
});
