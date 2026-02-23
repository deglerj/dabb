import { describe, expect, it } from 'vitest';
import type { Card, CardId, GameEvent, PlayerIndex } from '@dabb/shared-types';
import { filterEventForPlayer, filterEventsForPlayer, isHiddenCard } from '../state/views.js';

// Helper to make a visible card
function visibleCard(suit: Card['suit'], rank: Card['rank'], copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

// Helper to make a base event
function baseEvent(sequence: number): Omit<GameEvent, 'type' | 'payload'> {
  return {
    id: `event-${sequence}`,
    sessionId: 'test-session',
    sequence,
    timestamp: Date.now(),
  };
}

describe('filterEventForPlayer', () => {
  describe('CARDS_DEALT', () => {
    const dealtEvent: Extract<GameEvent, { type: 'CARDS_DEALT' }> = {
      ...baseEvent(1),
      type: 'CARDS_DEALT',
      payload: {
        hands: {
          0: [visibleCard('herz', 'ass'), visibleCard('herz', 'koenig')],
          1: [visibleCard('kreuz', 'buabe'), visibleCard('kreuz', 'ober')],
          2: [visibleCard('schippe', '10'), visibleCard('schippe', 'ass')],
        } as Record<PlayerIndex, Card[]>,
        dabb: [visibleCard('bollen', 'koenig'), visibleCard('bollen', 'ober')],
      },
    };

    it("shows player's own hand unmodified", () => {
      const filtered = filterEventForPlayer(dealtEvent, 0 as PlayerIndex);
      expect(filtered.type).toBe('CARDS_DEALT');
      const payload = (filtered as typeof dealtEvent).payload;
      expect(payload.hands[0 as PlayerIndex]).toEqual(dealtEvent.payload.hands[0 as PlayerIndex]);
    });

    it('hides other players hands with placeholder cards', () => {
      const filtered = filterEventForPlayer(dealtEvent, 0 as PlayerIndex);
      const payload = (filtered as typeof dealtEvent).payload;

      const hand1 = payload.hands[1 as PlayerIndex];
      const hand2 = payload.hands[2 as PlayerIndex];

      expect(hand1).toHaveLength(2);
      expect(hand2).toHaveLength(2);
      expect(hand1.every((c) => c.id.startsWith('hidden-'))).toBe(true);
      expect(hand2.every((c) => c.id.startsWith('hidden-'))).toBe(true);
    });

    it('hides the dabb', () => {
      const filtered = filterEventForPlayer(dealtEvent, 0 as PlayerIndex);
      const payload = (filtered as typeof dealtEvent).payload;
      expect(payload.dabb).toHaveLength(2);
      expect(payload.dabb.every((c) => c.id.startsWith('hidden-'))).toBe(true);
    });

    it('preserves card count for hidden hands', () => {
      const filtered = filterEventForPlayer(dealtEvent, 1 as PlayerIndex);
      const payload = (filtered as typeof dealtEvent).payload;
      // player 0 has 2 cards, player 2 has 2 cards — both should be hidden with same count
      expect(payload.hands[0 as PlayerIndex]).toHaveLength(2);
      expect(payload.hands[2 as PlayerIndex]).toHaveLength(2);
    });

    it("shows player 1's own hand when filtering for player 1", () => {
      const filtered = filterEventForPlayer(dealtEvent, 1 as PlayerIndex);
      const payload = (filtered as typeof dealtEvent).payload;
      expect(payload.hands[1 as PlayerIndex]).toEqual(dealtEvent.payload.hands[1 as PlayerIndex]);
    });
  });

  describe('CARDS_DISCARDED', () => {
    const discardEvent: Extract<GameEvent, { type: 'CARDS_DISCARDED' }> = {
      ...baseEvent(2),
      type: 'CARDS_DISCARDED',
      payload: {
        playerIndex: 0 as PlayerIndex,
        discardedCards: ['herz-ass-0', 'kreuz-koenig-0'] as CardId[],
      },
    };

    it('shows the bid winner their own discarded cards', () => {
      const filtered = filterEventForPlayer(discardEvent, 0 as PlayerIndex);
      expect(filtered.type).toBe('CARDS_DISCARDED');
      const payload = (filtered as typeof discardEvent).payload;
      expect(payload.discardedCards).toEqual(['herz-ass-0', 'kreuz-koenig-0']);
    });

    it("hides discarded card IDs from other players, replacing with 'hidden'", () => {
      const filtered = filterEventForPlayer(discardEvent, 1 as PlayerIndex);
      const payload = (filtered as typeof discardEvent).payload;
      expect(payload.discardedCards).toHaveLength(2);
      expect(payload.discardedCards.every((id) => id === 'hidden')).toBe(true);
    });

    it('preserves the discard count for other players', () => {
      const discardFour: Extract<GameEvent, { type: 'CARDS_DISCARDED' }> = {
        ...baseEvent(2),
        type: 'CARDS_DISCARDED',
        payload: {
          playerIndex: 0 as PlayerIndex,
          discardedCards: ['a', 'b', 'c', 'd'] as CardId[],
        },
      };
      const filtered = filterEventForPlayer(discardFour, 1 as PlayerIndex);
      const payload = (filtered as typeof discardFour).payload;
      expect(payload.discardedCards).toHaveLength(4);
    });
  });

  describe('other event types', () => {
    it('passes through non-sensitive events unchanged', () => {
      const bidEvent: GameEvent = {
        ...baseEvent(3),
        type: 'BID_PLACED',
        payload: { playerIndex: 0 as PlayerIndex, amount: 150 },
      };
      const filtered = filterEventForPlayer(bidEvent, 1 as PlayerIndex);
      expect(filtered).toBe(bidEvent); // same reference — no copy made
    });

    it('passes through TRICK_WON events unchanged', () => {
      const trickEvent: GameEvent = {
        ...baseEvent(4),
        type: 'TRICK_WON',
        payload: {
          winnerIndex: 0 as PlayerIndex,
          cards: [visibleCard('herz', 'ass')],
          points: 11,
        },
      };
      const filtered = filterEventForPlayer(trickEvent, 0 as PlayerIndex);
      expect(filtered).toBe(trickEvent);
    });
  });
});

describe('filterEventsForPlayer', () => {
  it('filters all events in an array', () => {
    const events: GameEvent[] = [
      {
        ...baseEvent(1),
        type: 'CARDS_DEALT',
        payload: {
          hands: {
            0: [visibleCard('herz', 'ass')],
            1: [visibleCard('kreuz', 'buabe')],
          } as Record<PlayerIndex, Card[]>,
          dabb: [visibleCard('bollen', 'koenig')],
        },
      },
      {
        ...baseEvent(2),
        type: 'BID_PLACED',
        payload: { playerIndex: 0 as PlayerIndex, amount: 150 },
      },
    ];

    const filtered = filterEventsForPlayer(events, 0 as PlayerIndex);

    expect(filtered).toHaveLength(2);
    // CARDS_DEALT should be filtered
    const dealtFiltered = filtered[0] as Extract<GameEvent, { type: 'CARDS_DEALT' }>;
    expect(dealtFiltered.payload.hands[1 as PlayerIndex][0].id).toMatch(/^hidden-/);
    // BID_PLACED should pass through unchanged
    expect(filtered[1]).toBe(events[1]);
  });

  it('returns empty array for empty input', () => {
    expect(filterEventsForPlayer([], 0 as PlayerIndex)).toEqual([]);
  });
});

describe('isHiddenCard', () => {
  it('returns true for cards with hidden- prefix', () => {
    const hidden: Card = { id: 'hidden-0', suit: 'kreuz', rank: 'buabe', copy: 0 };
    expect(isHiddenCard(hidden)).toBe(true);
  });

  it('returns true for hidden-1 etc.', () => {
    const hidden: Card = { id: 'hidden-1', suit: 'kreuz', rank: 'buabe', copy: 0 };
    expect(isHiddenCard(hidden)).toBe(true);
  });

  it('returns false for real card IDs', () => {
    const real: Card = visibleCard('herz', 'ass');
    expect(isHiddenCard(real)).toBe(false);
  });

  it('returns false for a card whose ID contains "hidden" elsewhere', () => {
    const real: Card = { id: 'kreuz-ass-hidden', suit: 'kreuz', rank: 'ass', copy: 0 };
    expect(isHiddenCard(real)).toBe(false);
  });
});
