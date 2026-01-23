/**
 * Meld detection for Binokel
 */

import {
  Card,
  Meld,
  MeldType,
  MELD_BASE_POINTS,
  MELD_TRUMP_BONUS,
  Rank,
  SUITS,
  Suit,
} from '@dabb/shared-types';

interface MeldConfig {
  basePoints: Record<MeldType, number>;
  trumpBonus: Partial<Record<MeldType, number>>;
}

const DEFAULT_CONFIG: MeldConfig = {
  basePoints: MELD_BASE_POINTS,
  trumpBonus: MELD_TRUMP_BONUS,
};

/**
 * Detect all valid melds in a hand
 */
export function detectMelds(
  hand: Card[],
  trump: Suit,
  config: MeldConfig = DEFAULT_CONFIG
): Meld[] {
  const melds: Meld[] = [];

  // Group cards by suit and rank for easier detection
  const bySuit = groupBySuit(hand);
  const byRank = groupByRank(hand);

  // Detect Binokel (Ober Schippe + Buabe Bollen)
  melds.push(...detectBinokel(hand, config));

  // Detect four/eight of a kind
  melds.push(...detectFourOfAKind(byRank, config));

  // Detect Familie (A-10-K-O-U of same suit)
  melds.push(...detectFamilie(bySuit, trump, config));

  // Detect Paar (K-O of same suit)
  // Note: Paar cards can't be part of a Familie
  melds.push(...detectPaar(bySuit, trump, melds, config));

  return melds;
}

function groupBySuit(cards: Card[]): Map<Suit, Card[]> {
  const groups = new Map<Suit, Card[]>();
  for (const suit of SUITS) {
    groups.set(suit, []);
  }
  for (const card of cards) {
    groups.get(card.suit)!.push(card);
  }
  return groups;
}

function groupByRank(cards: Card[]): Map<Rank, Card[]> {
  const groups = new Map<Rank, Card[]>();
  for (const card of cards) {
    const existing = groups.get(card.rank) || [];
    existing.push(card);
    groups.set(card.rank, existing);
  }
  return groups;
}

/**
 * Detect Binokel (Ober Schippe + Buabe Bollen)
 * Doppel-Binokel requires both copies of each card
 */
function detectBinokel(hand: Card[], config: MeldConfig): Meld[] {
  const melds: Meld[] = [];

  const oberSchippe = hand.filter((c) => c.suit === 'schippe' && c.rank === 'ober');
  const buabeBollen = hand.filter((c) => c.suit === 'bollen' && c.rank === 'buabe');

  if (oberSchippe.length >= 2 && buabeBollen.length >= 2) {
    // Doppel-Binokel
    melds.push({
      type: 'doppel-binokel',
      cards: [...oberSchippe.map((c) => c.id), ...buabeBollen.map((c) => c.id)],
      points: config.basePoints['doppel-binokel'],
    });
  } else if (oberSchippe.length >= 1 && buabeBollen.length >= 1) {
    // Single Binokel
    melds.push({
      type: 'binokel',
      cards: [oberSchippe[0].id, buabeBollen[0].id],
      points: config.basePoints.binokel,
    });
  }

  return melds;
}

/**
 * Detect four or eight of a kind (for Ass, Zehn, König, Ober, Unter)
 */
function detectFourOfAKind(byRank: Map<Rank, Card[]>, config: MeldConfig): Meld[] {
  const melds: Meld[] = [];

  const rankToMeldTypes: Record<Rank, { four: MeldType; eight: MeldType } | null> = {
    ass: { four: 'vier-ass', eight: 'acht-ass' },
    '10': { four: 'vier-zehn', eight: 'acht-zehn' },
    koenig: { four: 'vier-koenig', eight: 'acht-koenig' },
    ober: { four: 'vier-ober', eight: 'acht-ober' },
    buabe: { four: 'vier-unter', eight: 'acht-unter' },
    '9': null,
  };

  for (const [rank, cards] of byRank) {
    const meldTypes = rankToMeldTypes[rank];
    if (!meldTypes) {
      continue;
    }

    // Check for cards in all four suits
    const suitCount = new Set(cards.map((c) => c.suit)).size;

    if (suitCount === 4) {
      if (cards.length === 8) {
        // Eight of a kind (both copies of all four suits)
        melds.push({
          type: meldTypes.eight,
          cards: cards.map((c) => c.id),
          points: config.basePoints[meldTypes.eight],
        });
      } else if (cards.length >= 4) {
        // Four of a kind (one from each suit)
        // Take one card from each suit
        const onePerSuit: Card[] = [];
        const seenSuits = new Set<Suit>();
        for (const card of cards) {
          if (!seenSuits.has(card.suit)) {
            onePerSuit.push(card);
            seenSuits.add(card.suit);
          }
        }
        melds.push({
          type: meldTypes.four,
          cards: onePerSuit.map((c) => c.id),
          points: config.basePoints[meldTypes.four],
        });
      }
    }
  }

  return melds;
}

/**
 * Detect Familie (A-10-K-O-U of same suit)
 * Each suit can have up to two Familien (with both copies)
 */
function detectFamilie(bySuit: Map<Suit, Card[]>, trump: Suit, config: MeldConfig): Meld[] {
  const melds: Meld[] = [];
  const familieRanks: Rank[] = ['ass', '10', 'koenig', 'ober', 'buabe'];

  for (const [suit, cards] of bySuit) {
    const rankCounts = new Map<Rank, Card[]>();
    for (const card of cards) {
      if (familieRanks.includes(card.rank)) {
        const existing = rankCounts.get(card.rank) || [];
        existing.push(card);
        rankCounts.set(card.rank, existing);
      }
    }

    // Check if we have all 5 ranks
    if (rankCounts.size === 5) {
      // Check for double Familie (both copies of all 5)
      const hasDouble = familieRanks.every((r) => (rankCounts.get(r)?.length || 0) >= 2);

      const isTrump = suit === trump;
      const basePoints = config.basePoints.familie;
      const bonus = isTrump ? config.trumpBonus.familie || 0 : 0;

      if (hasDouble) {
        // Two Familien in this suit
        for (let i = 0; i < 2; i++) {
          const familieCards = familieRanks.map((r) => rankCounts.get(r)![i]);
          melds.push({
            type: 'familie',
            cards: familieCards.map((c) => c.id),
            points: basePoints + bonus,
            suit,
          });
        }
      } else {
        // One Familie
        const familieCards = familieRanks.map((r) => rankCounts.get(r)![0]);
        melds.push({
          type: 'familie',
          cards: familieCards.map((c) => c.id),
          points: basePoints + bonus,
          suit,
        });
      }
    }
  }

  return melds;
}

/**
 * Detect Paar (K-O of same suit)
 * Cards used in Familie cannot be reused for Paar
 */
function detectPaar(
  bySuit: Map<Suit, Card[]>,
  trump: Suit,
  existingMelds: Meld[],
  config: MeldConfig
): Meld[] {
  const melds: Meld[] = [];

  // Collect cards already used in Familie melds
  const usedInFamilie = new Set<string>();
  for (const meld of existingMelds) {
    if (meld.type === 'familie') {
      for (const cardId of meld.cards) {
        usedInFamilie.add(cardId);
      }
    }
  }

  for (const [suit, cards] of bySuit) {
    const availableKoenig = cards.filter((c) => c.rank === 'koenig' && !usedInFamilie.has(c.id));
    const availableOber = cards.filter((c) => c.rank === 'ober' && !usedInFamilie.has(c.id));

    const paarCount = Math.min(availableKoenig.length, availableOber.length);

    const isTrump = suit === trump;
    const basePoints = config.basePoints.paar;
    const bonus = isTrump ? config.trumpBonus.paar || 0 : 0;

    for (let i = 0; i < paarCount; i++) {
      melds.push({
        type: 'paar',
        cards: [availableKoenig[i].id, availableOber[i].id],
        points: basePoints + bonus,
        suit,
      });
    }
  }

  return melds;
}

/**
 * Calculate total meld points
 */
export function calculateMeldPoints(melds: Meld[]): number {
  return melds.reduce((sum, meld) => sum + meld.points, 0);
}
