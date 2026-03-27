import { describe, it, expect } from 'vitest';
import {
  deriveCardPositions,
  edgeFraction,
  type LayoutDimensions,
} from '../src/cards/cardPositions.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;
const CARD_OVERLAP = 22;
const HAND_SIDE_MARGIN = 16;
const MOBILE_BREAKPOINT_WIDTH = 480;
const MAX_CARDS_PER_ROW = 10;
const ROW_OVERLAP = 0.4;

const LAYOUT: LayoutDimensions = {
  width: 800,
  height: 600,
  playerCount: 3,
};

const SUITS_CYCLE = ['kreuz', 'schippe', 'herz', 'bollen'] as const;

function makeInput(cardCount: number) {
  return {
    handCards: Array.from({ length: cardCount }, (_, i) => ({
      id: `card-${i}`,
      suit: SUITS_CYCLE[i % 4]!,
    })),
    trickCardIds: [],
    wonPilePlayerIds: [],
    opponentCardCounts: {},
  };
}

describe('deriveCardPositions', () => {
  it('places player hand cards in bottom third of screen', () => {
    const result = deriveCardPositions(
      {
        handCards: [
          { id: 'c1', suit: 'kreuz' },
          { id: 'c2', suit: 'schippe' },
          { id: 'c3', suit: 'herz' },
        ],
        trickCardIds: [],
        wonPilePlayerIds: [],
        opponentCardCounts: {},
      },
      LAYOUT
    );
    for (const id of ['c1', 'c2', 'c3']) {
      expect(result.playerHand[id]?.y).toBeGreaterThan(LAYOUT.height * 0.6);
    }
  });

  it('spreads hand cards horizontally left to right', () => {
    const result = deriveCardPositions(
      {
        handCards: [
          { id: 'c1', suit: 'kreuz' },
          { id: 'c2', suit: 'schippe' },
          { id: 'c3', suit: 'herz' },
        ],
        trickCardIds: [],
        wonPilePlayerIds: [],
        opponentCardCounts: {},
      },
      LAYOUT
    );
    const xs = ['c1', 'c2', 'c3'].map((id) => result.playerHand[id]?.x ?? 0);
    expect(xs[0]).toBeLessThan(xs[1]!);
    expect(xs[1]).toBeLessThan(xs[2]!);
  });

  it('places trick cards near screen center', () => {
    const result = deriveCardPositions(
      {
        handCards: [],
        trickCardIds: [{ cardId: 't1', seatIndex: 1 }],
        wonPilePlayerIds: [],
        opponentCardCounts: {},
      },
      LAYOUT
    );
    const pos = result.trickCards['t1'];
    expect(pos?.x).toBeGreaterThan(LAYOUT.width * 0.3);
    expect(pos?.x).toBeLessThan(LAYOUT.width * 0.7);
    expect(pos?.y).toBeGreaterThan(LAYOUT.height * 0.2);
    expect(pos?.y).toBeLessThan(LAYOUT.height * 0.8);
  });

  it('returns a won pile position for each player ID', () => {
    const result = deriveCardPositions(
      {
        handCards: [],
        trickCardIds: [],
        wonPilePlayerIds: ['p0', 'p1', 'p2'],
        opponentCardCounts: {},
      },
      LAYOUT
    );
    expect(result.wonPiles['p0']).toBeDefined();
    expect(result.wonPiles['p1']).toBeDefined();
    expect(result.wonPiles['p2']).toBeDefined();
  });
});

describe('deriveCardPositions — hand scaling', () => {
  it('does not scale down when hand fits comfortably (few cards, wide screen)', () => {
    const layout = { width: 800, height: 1200, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(5), layout);
    expect(result.cardScale).toBe(1);
  });

  it('scales down when a large row overflows a 375px portrait phone', () => {
    // 16 cards: 5 kreuz + 4 schippe + 4 herz + 3 bollen
    // Boundaries at 5, 9, 13 → closest to 8 is 9 → top row = 9 cards
    const layout = { width: 375, height: 812, playerCount: 3 as const };
    const input = {
      handCards: [
        ...Array.from({ length: 5 }, (_, i) => ({ id: `kreuz-${i}`, suit: 'kreuz' })),
        ...Array.from({ length: 4 }, (_, i) => ({ id: `schippe-${i}`, suit: 'schippe' })),
        ...Array.from({ length: 4 }, (_, i) => ({ id: `herz-${i}`, suit: 'herz' })),
        ...Array.from({ length: 3 }, (_, i) => ({ id: `bollen-${i}`, suit: 'bollen' })),
      ],
      trickCardIds: [],
      wonPilePlayerIds: [],
      opponentCardCounts: {},
    };
    const result = deriveCardPositions(input, layout);
    expect(result.cardScale).toBeLessThan(1);
    // Scale is driven by the larger row (9 cards)
    const scaledW = CARD_WIDTH * result.cardScale;
    const scaledOverlap = CARD_OVERLAP * result.cardScale;
    const largerRowWidth = 9 * scaledW - 8 * scaledOverlap;
    expect(largerRowWidth).toBeLessThanOrEqual(375 - 2 * HAND_SIDE_MARGIN + 0.5);
  });

  it('bottom-anchors the hand so it never goes off-screen', () => {
    const layout = { width: 375, height: 812, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(12), layout);
    const scaledH = CARD_HEIGHT * result.cardScale;
    // makeInput(12) splits at 6 → card-6 is the first card of the bottom row
    const bottomCard = result.playerHand['card-6']!;
    expect(bottomCard.y + scaledH).toBeLessThanOrEqual(812);
  });

  it('cards are horizontally centered', () => {
    const layout = { width: 375, height: 812, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(4), layout);
    const first = result.playerHand['card-0']!;
    const last = result.playerHand['card-3']!;
    const scaledW = CARD_WIDTH * result.cardScale;
    const midFirst = first.x + scaledW / 2;
    const midLast = last.x + scaledW / 2;
    const center = (midFirst + midLast) / 2;
    expect(center).toBeCloseTo(375 / 2, 0);
  });

  it('returns cardScale: 1 when hand is exactly the available width', () => {
    const n = 3;
    const naturalWidth = n * CARD_WIDTH - (n - 1) * CARD_OVERLAP;
    const screenWidth = naturalWidth + 2 * HAND_SIDE_MARGIN;
    const layout = { width: screenWidth, height: 800, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(n), layout);
    expect(result.cardScale).toBeCloseTo(1, 5);
  });
});

describe('deriveCardPositions — two-row hand layout', () => {
  const mobileLayout = { width: 375, height: 812, playerCount: 3 as const };
  // Wide layout must be >= MOBILE_BREAKPOINT_WIDTH to stay in single-row mode
  const wideLayout = { width: MOBILE_BREAKPOINT_WIDTH + 320, height: 812, playerCount: 3 as const };

  it('activates two-row mode on narrow screen with more than MAX_CARDS_PER_ROW cards', () => {
    // makeInput(11) → split at 5 → top row: cards 0–4, bottom row: cards 5–10
    const result = deriveCardPositions(makeInput(11), mobileLayout);
    const topY = result.playerHand['card-0']!.y; // first card is in top row
    const bottomY = result.playerHand['card-10']!.y; // last card is in bottom row
    expect(topY).toBeLessThan(bottomY);
  });

  it('does not activate two-row mode on wide screen', () => {
    // 800px is above MOBILE_BREAKPOINT_WIDTH → all cards same y
    const result = deriveCardPositions(makeInput(11), wideLayout);
    const ys = Array.from({ length: 11 }, (_, i) => result.playerHand[`card-${i}`]!.y);
    const allSameY = ys.every((y) => Math.abs(y - ys[0]!) < 0.5);
    expect(allSameY).toBe(true);
  });

  it('does not activate two-row mode when cards <= MAX_CARDS_PER_ROW', () => {
    // 10 cards on 375px → single row, all same y
    const result = deriveCardPositions(makeInput(MAX_CARDS_PER_ROW), mobileLayout);
    const ys = Array.from(
      { length: MAX_CARDS_PER_ROW },
      (_, i) => result.playerHand[`card-${i}`]!.y
    );
    const allSameY = ys.every((y) => Math.abs(y - ys[0]!) < 0.5);
    expect(allSameY).toBe(true);
  });

  it('top row contains the first cards in sort order', () => {
    // makeInput(12) with cycling suits → split at index 6
    // card-0 through card-5 land in the top row (smaller Y)
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const topY = result.playerHand['card-0']!.y;
    const bottomY = result.playerHand['card-6']!.y;
    expect(topY).toBeLessThan(bottomY);
    for (let i = 0; i < 6; i++) {
      expect(result.playerHand[`card-${i}`]!.y).toBeCloseTo(topY, 1);
    }
  });

  it('bottom row contains the later cards in sort order', () => {
    // makeInput(12) → cards 6–11 land in the bottom row (larger Y)
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const bottomY = result.playerHand['card-6']!.y;
    for (let i = 6; i < 12; i++) {
      expect(result.playerHand[`card-${i}`]!.y).toBeCloseTo(bottomY, 1);
    }
  });

  it('top row y equals bottomY minus (1 - ROW_OVERLAP) * scaledH', () => {
    // makeInput(12) → card-0 is in top row, card-6 is in bottom row
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const scaledH = CARD_HEIGHT * result.cardScale;
    const topY = result.playerHand['card-0']!.y;
    const bottomY = result.playerHand['card-6']!.y;
    const expectedTopY = bottomY - scaledH * (1 - ROW_OVERLAP);
    expect(topY).toBeCloseTo(expectedTopY, 1);
  });

  it('bottom row cards have higher z-index than top row cards', () => {
    // makeInput(12) → top: cards 0–5, bottom: cards 6–11
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const topZIndices = Array.from({ length: 6 }, (_, i) => result.playerHand[`card-${i}`]!.zIndex);
    const bottomZIndices = Array.from(
      { length: 6 },
      (_, i) => result.playerHand[`card-${6 + i}`]!.zIndex
    );
    const maxTopZ = Math.max(...topZIndices);
    const minBottomZ = Math.min(...bottomZIndices);
    expect(minBottomZ).toBeGreaterThan(maxTopZ);
  });

  it('each row is independently centered horizontally', () => {
    // makeInput(12) → top row: cards 0–5, bottom row: cards 6–11
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const scaledW = CARD_WIDTH * result.cardScale;

    // Top row: cards 0–5
    const topFirst = result.playerHand['card-0']!.x;
    const topLast = result.playerHand['card-5']!.x;
    const topCenter = (topFirst + topLast + scaledW) / 2;
    expect(topCenter).toBeCloseTo(mobileLayout.width / 2, 0);

    // Bottom row: cards 6–11
    const bottomFirst = result.playerHand['card-6']!.x;
    const bottomLast = result.playerHand['card-11']!.x;
    const bottomCenter = (bottomFirst + bottomLast + scaledW) / 2;
    expect(bottomCenter).toBeCloseTo(mobileLayout.width / 2, 0);
  });

  it('each row fans independently — symmetric rotation around its own midpoint', () => {
    // makeInput(12) → top: cards 0–5, bottom: cards 6–11
    const result = deriveCardPositions(makeInput(12), mobileLayout);

    // Top row: first and last cards have equal-magnitude, opposite-sign rotations
    const topFirst = result.playerHand['card-0']!.rotation;
    const topLast = result.playerHand['card-5']!.rotation;
    expect(topFirst + topLast).toBeCloseTo(0, 5);

    // Bottom row: symmetric
    const bottomFirst = result.playerHand['card-6']!.rotation;
    const bottomLast = result.playerHand['card-11']!.rotation;
    expect(bottomFirst + bottomLast).toBeCloseTo(0, 5);
  });

  it('keeps all cards of the same suit in the same row', () => {
    // 12 cards: 3 per suit, sorted → boundaries at 3, 6, 9 → split at 6
    // kreuz+schippe in top row; herz+bollen in bottom row
    const input = {
      handCards: [
        { id: 'k0', suit: 'kreuz' },
        { id: 'k1', suit: 'kreuz' },
        { id: 'k2', suit: 'kreuz' },
        { id: 's0', suit: 'schippe' },
        { id: 's1', suit: 'schippe' },
        { id: 's2', suit: 'schippe' },
        { id: 'h0', suit: 'herz' },
        { id: 'h1', suit: 'herz' },
        { id: 'h2', suit: 'herz' },
        { id: 'b0', suit: 'bollen' },
        { id: 'b1', suit: 'bollen' },
        { id: 'b2', suit: 'bollen' },
      ],
      trickCardIds: [],
      wonPilePlayerIds: [],
      opponentCardCounts: {},
    };
    const result = deriveCardPositions(input, mobileLayout);

    const kreuzY = result.playerHand['k0']!.y;
    const schippeY = result.playerHand['s0']!.y;
    const herzY = result.playerHand['h0']!.y;
    const bollenY = result.playerHand['b0']!.y;

    // All kreuz cards on the same row
    expect(result.playerHand['k1']!.y).toBeCloseTo(kreuzY, 1);
    expect(result.playerHand['k2']!.y).toBeCloseTo(kreuzY, 1);
    // kreuz and schippe share the top row
    expect(schippeY).toBeCloseTo(kreuzY, 1);
    // herz and bollen share the bottom row
    expect(result.playerHand['h1']!.y).toBeCloseTo(herzY, 1);
    expect(bollenY).toBeCloseTo(herzY, 1);
    // Top row (kreuz) is higher than bottom row (herz)
    expect(kreuzY).toBeLessThan(herzY);
  });

  it('falls back to ceil(n/2) split when all cards are the same suit', () => {
    const input = {
      handCards: Array.from({ length: 12 }, (_, i) => ({ id: `k${i}`, suit: 'kreuz' })),
      trickCardIds: [],
      wonPilePlayerIds: [],
      opponentCardCounts: {},
    };
    const result = deriveCardPositions(input, mobileLayout);

    // ceil(12/2) = 6 → top row: k0–k5, bottom row: k6–k11
    const topY = result.playerHand['k0']!.y;
    const bottomY = result.playerHand['k6']!.y;

    for (let i = 0; i < 6; i++) {
      expect(result.playerHand[`k${i}`]!.y).toBeCloseTo(topY, 1);
    }
    for (let i = 6; i < 12; i++) {
      expect(result.playerHand[`k${i}`]!.y).toBeCloseTo(bottomY, 1);
    }
    expect(topY).toBeLessThan(bottomY);
  });
});

describe('edgeFraction', () => {
  it('returns 0.5 for a single opponent', () => {
    expect(edgeFraction(0, 1)).toBe(0.5);
  });

  it('maps two opponents to 15% and 85%', () => {
    expect(edgeFraction(0, 2)).toBeCloseTo(0.15);
    expect(edgeFraction(1, 2)).toBeCloseTo(0.85);
  });

  it('maps three opponents to 15%, 50%, 85%', () => {
    expect(edgeFraction(0, 3)).toBeCloseTo(0.15);
    expect(edgeFraction(1, 3)).toBeCloseTo(0.5);
    expect(edgeFraction(2, 3)).toBeCloseTo(0.85);
  });
});

describe('deriveCardPositions – opponent hands', () => {
  it('places a single opponent at 50% of width', () => {
    const result = deriveCardPositions(
      { handCards: [], trickCardIds: [], wonPilePlayerIds: [], opponentCardCounts: { p1: 8 } },
      LAYOUT
    );
    expect(result.opponentHands['p1']?.x).toBeCloseTo(LAYOUT.width * 0.5);
  });

  it('places two opponents at 15% and 85% of width', () => {
    const result = deriveCardPositions(
      {
        handCards: [],
        trickCardIds: [],
        wonPilePlayerIds: [],
        opponentCardCounts: { p1: 8, p2: 8 },
      },
      LAYOUT
    );
    expect(result.opponentHands['p1']?.x).toBeCloseTo(LAYOUT.width * 0.15);
    expect(result.opponentHands['p2']?.x).toBeCloseTo(LAYOUT.width * 0.85);
  });
});
