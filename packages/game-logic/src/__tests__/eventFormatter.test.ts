import { describe, expect, it } from 'vitest';
import type { Card, GameEvent, PlayerIndex, Suit } from '@dabb/shared-types';

import {
  formatCard,
  formatCards,
  formatSuit,
  formatMeld,
  formatMelds,
} from '../export/cardFormatter.js';
import { formatEventLog } from '../export/eventFormatter.js';

// Helper to create cards
function card(suit: Suit, rank: Card['rank'], copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

// Helper to create a base event
function baseEvent(sequence: number): Omit<GameEvent, 'type' | 'payload'> {
  return {
    id: `event-${sequence}`,
    sessionId: 'test-session-123',
    sequence,
    timestamp: Date.now(),
  };
}

describe('Card Formatter', () => {
  describe('formatCard', () => {
    it('formats a Herz Ass correctly', () => {
      expect(formatCard(card('herz', 'ass'))).toBe('Herz Ass');
    });

    it('formats a Kreuz König correctly', () => {
      expect(formatCard(card('kreuz', 'koenig'))).toBe('Kreuz König');
    });

    it('formats a Schippe Buabe correctly', () => {
      expect(formatCard(card('schippe', 'buabe'))).toBe('Schippe Buabe');
    });

    it('formats a Bollen Zehn correctly', () => {
      expect(formatCard(card('bollen', '10'))).toBe('Bollen Zehn');
    });

    it('formats a Herz Buabe correctly', () => {
      expect(formatCard(card('herz', 'buabe'))).toBe('Herz Buabe');
    });
  });

  describe('formatCards', () => {
    it('formats multiple cards comma-separated', () => {
      const cards = [card('herz', 'ass'), card('kreuz', 'koenig'), card('bollen', 'ober')];
      expect(formatCards(cards)).toBe('Herz Ass, Kreuz König, Bollen Ober');
    });

    it('handles empty array', () => {
      expect(formatCards([])).toBe('');
    });

    it('handles single card', () => {
      expect(formatCards([card('schippe', 'buabe')])).toBe('Schippe Buabe');
    });
  });

  describe('formatSuit', () => {
    it('formats Herz', () => {
      expect(formatSuit('herz')).toBe('Herz');
    });

    it('formats Kreuz', () => {
      expect(formatSuit('kreuz')).toBe('Kreuz');
    });

    it('formats Schippe', () => {
      expect(formatSuit('schippe')).toBe('Schippe');
    });

    it('formats Bollen', () => {
      expect(formatSuit('bollen')).toBe('Bollen');
    });
  });

  describe('formatMeld', () => {
    it('formats a Paar with suit', () => {
      const meld = { type: 'paar' as const, cards: [], points: 20, suit: 'herz' as const };
      expect(formatMeld(meld)).toBe('Paar in Herz (20 pts)');
    });

    it('formats a trump Paar', () => {
      const meld = { type: 'paar' as const, cards: [], points: 40, suit: 'kreuz' as const };
      expect(formatMeld(meld)).toBe('Paar in Kreuz (40 pts)');
    });

    it('formats a Binokel', () => {
      const meld = { type: 'binokel' as const, cards: [], points: 40 };
      expect(formatMeld(meld)).toBe('Binokel (40 pts)');
    });

    it('formats a Doppel-Binokel', () => {
      const meld = { type: 'doppel-binokel' as const, cards: [], points: 300 };
      expect(formatMeld(meld)).toBe('Doppel-Binokel (300 pts)');
    });

    it('formats a Familie', () => {
      const meld = { type: 'familie' as const, cards: [], points: 100, suit: 'schippe' as const };
      expect(formatMeld(meld)).toBe('Familie in Schippe (100 pts)');
    });

    it('formats Vier Ass', () => {
      const meld = { type: 'vier-ass' as const, cards: [], points: 100 };
      expect(formatMeld(meld)).toBe('Vier Ass (100 pts)');
    });
  });

  describe('formatMelds', () => {
    it('formats multiple melds as bulleted list', () => {
      const melds = [
        { type: 'paar' as const, cards: [], points: 40, suit: 'herz' as const },
        { type: 'binokel' as const, cards: [], points: 40 },
      ];
      const expected = '- Paar in Herz (40 pts)\n- Binokel (40 pts)';
      expect(formatMelds(melds)).toBe(expected);
    });
  });
});

describe('Event Formatter', () => {
  describe('formatEventLog', () => {
    it('creates header with session info', () => {
      const events: GameEvent[] = [];
      const log = formatEventLog(events, {
        sessionCode: 'XKCD42',
        sessionId: 'abc123',
      });

      expect(log).toContain('DABB GAME EVENT LOG');
      expect(log).toContain('Session: XKCD42 (abc123)');
      expect(log).toContain('Total Events: 0');
      expect(log).toContain('END OF LOG');
    });

    it('includes termination warning when terminated', () => {
      const log = formatEventLog([], { terminated: true });
      expect(log).toContain('⚠️  SESSION TERMINATED AFTER EXPORT');
    });

    it('extracts players from PLAYER_JOINED events', () => {
      const events: GameEvent[] = [
        {
          ...baseEvent(1),
          type: 'PLAYER_JOINED',
          payload: { playerId: 'p1', playerIndex: 0 as PlayerIndex, nickname: 'Hans', team: 0 },
        },
        {
          ...baseEvent(2),
          type: 'PLAYER_JOINED',
          payload: { playerId: 'p2', playerIndex: 1 as PlayerIndex, nickname: 'Maria', team: 1 },
        },
      ];

      const log = formatEventLog(events);

      expect(log).toContain('PLAYERS:');
      expect(log).toContain('[0] Hans (Team 0)');
      expect(log).toContain('[1] Maria (Team 1)');
    });

    it('formats GAME_STARTED event', () => {
      const events: GameEvent[] = [
        {
          ...baseEvent(1),
          type: 'GAME_STARTED',
          payload: { playerCount: 2, targetScore: 1500, dealer: 0 as PlayerIndex },
        },
      ];

      const log = formatEventLog(events);

      expect(log).toContain('ROUND 1');
      expect(log).toContain('GAME_STARTED');
      expect(log).toContain('2 players, target score: 1500');
    });

    it('formats CARDS_DEALT event with all cards', () => {
      const events: GameEvent[] = [
        {
          ...baseEvent(1),
          type: 'GAME_STARTED',
          payload: { playerCount: 2, targetScore: 1500, dealer: 0 as PlayerIndex },
        },
        {
          ...baseEvent(2),
          type: 'CARDS_DEALT',
          payload: {
            hands: {
              0: [card('herz', 'ass'), card('kreuz', 'koenig')],
              1: [card('schippe', '10'), card('bollen', 'buabe')],
            } as Record<PlayerIndex, Card[]>,
            dabb: [card('herz', 'buabe'), card('bollen', 'koenig')],
          },
        },
      ];

      const log = formatEventLog(events);

      expect(log).toContain('DEALING');
      expect(log).toContain('CARDS_DEALT');
      expect(log).toContain('Player 0: Herz Ass, Kreuz König');
      expect(log).toContain('Player 1: Schippe Zehn, Bollen Buabe');
      expect(log).toContain('Dabb: Herz Buabe, Bollen König');
    });

    it('formats bidding events', () => {
      const events: GameEvent[] = [
        {
          ...baseEvent(1),
          type: 'GAME_STARTED',
          payload: { playerCount: 2, targetScore: 1500, dealer: 0 as PlayerIndex },
        },
        {
          ...baseEvent(2),
          type: 'PLAYER_JOINED',
          payload: { playerId: 'p1', playerIndex: 0 as PlayerIndex, nickname: 'Hans' },
        },
        {
          ...baseEvent(3),
          type: 'PLAYER_JOINED',
          payload: { playerId: 'p2', playerIndex: 1 as PlayerIndex, nickname: 'Maria' },
        },
        {
          ...baseEvent(4),
          type: 'BID_PLACED',
          payload: { playerIndex: 1 as PlayerIndex, amount: 150 },
        },
        {
          ...baseEvent(5),
          type: 'PLAYER_PASSED',
          payload: { playerIndex: 0 as PlayerIndex },
        },
        {
          ...baseEvent(6),
          type: 'BIDDING_WON',
          payload: { playerIndex: 1 as PlayerIndex, winningBid: 150 },
        },
      ];

      const log = formatEventLog(events);

      expect(log).toContain('BIDDING');
      expect(log).toContain('Maria [1] bid 150');
      expect(log).toContain('Hans [0] passed');
      expect(log).toContain('Maria [1] won bidding with 150');
    });

    it('formats trump and melds events', () => {
      const events: GameEvent[] = [
        {
          ...baseEvent(1),
          type: 'GAME_STARTED',
          payload: { playerCount: 2, targetScore: 1500, dealer: 0 as PlayerIndex },
        },
        {
          ...baseEvent(2),
          type: 'PLAYER_JOINED',
          payload: { playerId: 'p1', playerIndex: 0 as PlayerIndex, nickname: 'Hans' },
        },
        {
          ...baseEvent(3),
          type: 'TRUMP_DECLARED',
          payload: { playerIndex: 0 as PlayerIndex, suit: 'herz' },
        },
        {
          ...baseEvent(4),
          type: 'MELDS_DECLARED',
          payload: {
            playerIndex: 0 as PlayerIndex,
            melds: [
              { type: 'paar', cards: [], points: 40, suit: 'herz' },
              { type: 'binokel', cards: [], points: 40 },
            ],
            totalPoints: 80,
          },
        },
      ];

      const log = formatEventLog(events);

      expect(log).toContain('TRUMP & MELDS');
      expect(log).toContain('Hans [0] declared Herz as trump');
      expect(log).toContain('Hans [0] declared melds (80 points)');
      expect(log).toContain('Paar in Herz (40 pts)');
      expect(log).toContain('Binokel (40 pts)');
    });

    it('formats trick events', () => {
      const events: GameEvent[] = [
        {
          ...baseEvent(1),
          type: 'GAME_STARTED',
          payload: { playerCount: 2, targetScore: 1500, dealer: 0 as PlayerIndex },
        },
        {
          ...baseEvent(2),
          type: 'PLAYER_JOINED',
          payload: { playerId: 'p1', playerIndex: 0 as PlayerIndex, nickname: 'Hans' },
        },
        {
          ...baseEvent(3),
          type: 'PLAYER_JOINED',
          payload: { playerId: 'p2', playerIndex: 1 as PlayerIndex, nickname: 'Maria' },
        },
        {
          ...baseEvent(4),
          type: 'CARD_PLAYED',
          payload: { playerIndex: 0 as PlayerIndex, card: card('herz', 'ass') },
        },
        {
          ...baseEvent(5),
          type: 'CARD_PLAYED',
          payload: { playerIndex: 1 as PlayerIndex, card: card('herz', 'buabe') },
        },
        {
          ...baseEvent(6),
          type: 'TRICK_WON',
          payload: {
            winnerIndex: 0 as PlayerIndex,
            cards: [card('herz', 'ass'), card('herz', 'buabe')],
            points: 11,
          },
        },
      ];

      const log = formatEventLog(events);

      expect(log).toContain('TRICKS');
      expect(log).toContain('Hans [0] played Herz Ass');
      expect(log).toContain('Maria [1] played Herz Buabe');
      expect(log).toContain('Hans [0] won trick (11 pts)');
    });

    it('groups events by round', () => {
      const events: GameEvent[] = [
        {
          ...baseEvent(1),
          type: 'GAME_STARTED',
          payload: { playerCount: 2, targetScore: 1500, dealer: 0 as PlayerIndex },
        },
        {
          ...baseEvent(2),
          type: 'NEW_ROUND_STARTED',
          payload: { round: 2, dealer: 1 as PlayerIndex },
        },
      ];

      const log = formatEventLog(events);

      expect(log).toContain('ROUND 1');
      expect(log).toContain('ROUND 2');
    });

    it('uses provided player info over extracted', () => {
      const events: GameEvent[] = [
        {
          ...baseEvent(1),
          type: 'PLAYER_JOINED',
          payload: { playerId: 'p1', playerIndex: 0 as PlayerIndex, nickname: 'OldName' },
        },
      ];

      const log = formatEventLog(events, {
        players: [{ playerIndex: 0 as PlayerIndex, nickname: 'CustomName', team: 0 }],
      });

      expect(log).toContain('[0] CustomName (Team 0)');
    });
  });
});
