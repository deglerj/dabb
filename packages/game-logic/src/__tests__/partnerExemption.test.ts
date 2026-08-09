/**
 * Partner exemption (4-player games only).
 *
 * When your own partner is currently winning the trick, the "must beat" and "must trump"
 * obligations are lifted — the trick already belongs to your team. Following suit still
 * applies. See the Tricks section of packages/i18n/src/rules.ts.
 */

import { describe, expect, it } from 'vitest';
import type { Card, Player, PlayerIndex, Suit, Trick } from '@dabb/shared-types';

import {
  getCurrentTrickWinner,
  getPartnerIndex,
  getValidPlays,
  isPartnerWinning,
  isValidPlay,
} from '../phases/tricks.js';

function card(suit: Suit, rank: Card['rank'], copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

function trickOf(cards: { card: Card; playerIndex: PlayerIndex }[]): Trick {
  return {
    cards: cards.map((c) => ({ cardId: c.card.id, card: c.card, playerIndex: c.playerIndex })),
    leadSuit: cards[0]?.card.suit ?? null,
    winnerIndex: null, // as the reducer leaves it mid-trick
  };
}

/** Seat parity: 0 & 2 are one team, 1 & 3 the other. */
function fourPlayers(): Player[] {
  return [0, 1, 2, 3].map((i) => ({
    id: `p${i}`,
    nickname: `P${i}`,
    playerIndex: i as PlayerIndex,
    team: (i % 2) as 0 | 1,
  }));
}

function threePlayers(): Player[] {
  return [0, 1, 2].map((i) => ({
    id: `p${i}`,
    nickname: `P${i}`,
    playerIndex: i as PlayerIndex,
  }));
}

describe('getPartnerIndex', () => {
  it('pairs opposite seats in a 4-player game', () => {
    const players = fourPlayers();
    expect(getPartnerIndex(players, 0 as PlayerIndex)).toBe(2);
    expect(getPartnerIndex(players, 1 as PlayerIndex)).toBe(3);
    expect(getPartnerIndex(players, 2 as PlayerIndex)).toBe(0);
    expect(getPartnerIndex(players, 3 as PlayerIndex)).toBe(1);
  });

  it('returns null when there are no teams', () => {
    expect(getPartnerIndex(threePlayers(), 0 as PlayerIndex)).toBeNull();
  });
});

describe('getCurrentTrickWinner', () => {
  it('reports the winner of an in-progress trick', () => {
    const trick = trickOf([
      { card: card('herz', 'buabe'), playerIndex: 0 as PlayerIndex },
      { card: card('herz', 'ass'), playerIndex: 1 as PlayerIndex },
      { card: card('herz', 'koenig'), playerIndex: 2 as PlayerIndex },
    ]);
    expect(getCurrentTrickWinner(trick, 'kreuz')).toBe(1);
  });

  it('returns null for an empty trick', () => {
    expect(getCurrentTrickWinner({ cards: [], leadSuit: null, winnerIndex: null }, 'kreuz')).toBe(
      null
    );
  });
});

describe('isPartnerWinning', () => {
  const trick = trickOf([
    { card: card('herz', 'buabe'), playerIndex: 0 as PlayerIndex },
    { card: card('herz', 'ass'), playerIndex: 1 as PlayerIndex },
  ]);

  it('is true for the winner’s partner', () => {
    expect(isPartnerWinning(trick, 'kreuz', 3 as PlayerIndex, fourPlayers())).toBe(true);
  });

  it('is false for opponents', () => {
    expect(isPartnerWinning(trick, 'kreuz', 2 as PlayerIndex, fourPlayers())).toBe(false);
  });

  it('is false for the winner themselves', () => {
    expect(isPartnerWinning(trick, 'kreuz', 1 as PlayerIndex, fourPlayers())).toBe(false);
  });

  it('is always false without teams (2/3-player games)', () => {
    expect(isPartnerWinning(trick, 'kreuz', 2 as PlayerIndex, threePlayers())).toBe(false);
  });
});

describe('getValidPlays with the partner exemption', () => {
  // Trump is Kreuz. Seat 1 (seat 3's partner) is winning with the Herz-König.
  const trick = trickOf([
    { card: card('herz', 'buabe'), playerIndex: 0 as PlayerIndex },
    { card: card('herz', 'koenig'), playerIndex: 1 as PlayerIndex },
    { card: card('herz', 'ober'), playerIndex: 2 as PlayerIndex },
  ]);
  // Holds both cards that beat the König and one that does not
  const hand = [
    card('herz', 'ass'),
    card('herz', '10'),
    card('herz', 'buabe', 1),
    card('kreuz', 'buabe'),
  ];

  it('forces the overtake when an opponent is winning', () => {
    const validPlays = getValidPlays(hand, trick, 'kreuz', false);
    expect(validPlays.map((c) => c.id)).toEqual(['herz-ass-0', 'herz-10-0']);
  });

  it('allows ducking under a partner’s winning card', () => {
    const validPlays = getValidPlays(hand, trick, 'kreuz', true);
    // The low Buabe becomes legal — no need to spend the Ass on the partner's trick
    expect(validPlays.map((c) => c.id)).toEqual(['herz-ass-0', 'herz-10-0', 'herz-buabe-1']);
  });

  it('still requires following suit when the partner is winning', () => {
    const validPlays = getValidPlays(
      [card('herz', 'buabe', 1), card('kreuz', 'ass')],
      trick,
      'kreuz',
      true
    );
    expect(validPlays.map((c) => c.id)).toEqual(['herz-buabe-1']);
  });

  it('does not force a trump when void and the partner is winning', () => {
    const voidHand = [card('kreuz', 'ass'), card('schippe', '10'), card('bollen', 'buabe')];

    expect(getValidPlays(voidHand, trick, 'kreuz', false).map((c) => c.id)).toEqual([
      'kreuz-ass-0',
    ]);
    // Free to smear the Zehn instead of burning the trump Ass on the partner's trick
    expect(getValidPlays(voidHand, trick, 'kreuz', true)).toHaveLength(3);
  });

  it('defaults to the strict rules when the flag is omitted', () => {
    expect(getValidPlays(hand, trick, 'kreuz')).toEqual(getValidPlays(hand, trick, 'kreuz', false));
  });
});

describe('isValidPlay with the partner exemption', () => {
  const trick = trickOf([
    { card: card('herz', 'buabe'), playerIndex: 0 as PlayerIndex },
    { card: card('herz', 'koenig'), playerIndex: 1 as PlayerIndex },
  ]);
  const lowHerz = card('herz', 'ober');
  const hand = [card('herz', 'ass'), lowHerz];

  it('rejects a card that fails to overtake when an opponent is winning', () => {
    expect(isValidPlay(lowHerz, hand, trick, 'kreuz', false)).toBe(false);
  });

  it('accepts that same card when the partner is winning', () => {
    expect(isValidPlay(lowHerz, hand, trick, 'kreuz', true)).toBe(true);
  });

  it('still rejects an off-suit card when the partner is winning', () => {
    const offSuit = card('kreuz', 'buabe');
    expect(isValidPlay(offSuit, [...hand, offSuit], trick, 'kreuz', true)).toBe(false);
  });
});
