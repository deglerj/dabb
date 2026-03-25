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

function makeInput(cardCount: number) {
  return {
    handCardIds: Array.from({ length: cardCount }, (_, i) => `card-${i}`),
    trickCardIds: [],
    wonPilePlayerIds: [],
    opponentCardCounts: {},
  };
}

describe('deriveCardPositions', () => {
  it('places player hand cards in bottom third of screen', () => {
    const result = deriveCardPositions(
      {
        handCardIds: ['c1', 'c2', 'c3'],
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
        handCardIds: ['c1', 'c2', 'c3'],
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
        handCardIds: [],
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
        handCardIds: [],
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

  it('scales down when 12 cards overflow a 375px portrait phone', () => {
    const layout = { width: 375, height: 812, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(12), layout);
    expect(result.cardScale).toBeLessThan(1);
    // In two-row mode cardScale is derived from the bottom row (MAX_CARDS_PER_ROW cards)
    const n = MAX_CARDS_PER_ROW;
    const scaledW = CARD_WIDTH * result.cardScale;
    const scaledOverlap = CARD_OVERLAP * result.cardScale;
    const handWidth = n * scaledW - (n - 1) * scaledOverlap;
    expect(handWidth).toBeLessThanOrEqual(375 - 2 * HAND_SIDE_MARGIN + 0.5);
  });

  it('bottom-anchors the hand so it never goes off-screen', () => {
    const layout = { width: 375, height: 812, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(12), layout);
    const firstCard = result.playerHand['card-0'];
    expect(firstCard).toBeDefined();
    const scaledH = CARD_HEIGHT * result.cardScale;
    expect(firstCard!.y + scaledH).toBeLessThanOrEqual(812);
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
    // 11 cards on 375px → bottom row 10, top row 1
    const result = deriveCardPositions(makeInput(11), mobileLayout);
    const bottomY = result.playerHand['card-0']!.y;
    const topY = result.playerHand['card-10']!.y;
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

  it('places first MAX_CARDS_PER_ROW cards on the bottom row', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const bottomY = result.playerHand['card-0']!.y;
    for (let i = 0; i < MAX_CARDS_PER_ROW; i++) {
      expect(result.playerHand[`card-${i}`]!.y).toBeCloseTo(bottomY, 1);
    }
  });

  it('places overflow cards on the top row', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const bottomY = result.playerHand['card-0']!.y;
    for (let i = MAX_CARDS_PER_ROW; i < 12; i++) {
      expect(result.playerHand[`card-${i}`]!.y).toBeLessThan(bottomY);
    }
  });

  it('top row y equals bottomY minus (1 - ROW_OVERLAP) * scaledH', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const scaledH = CARD_HEIGHT * result.cardScale;
    const bottomY = result.playerHand['card-0']!.y;
    const topY = result.playerHand['card-10']!.y;
    const expectedTopY = bottomY - scaledH * (1 - ROW_OVERLAP);
    expect(topY).toBeCloseTo(expectedTopY, 1);
  });

  it('bottom row cards have higher z-index than top row cards', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const bottomZIndices = Array.from(
      { length: MAX_CARDS_PER_ROW },
      (_, i) => result.playerHand[`card-${i}`]!.zIndex
    );
    const topZIndices = Array.from(
      { length: 2 },
      (_, i) => result.playerHand[`card-${MAX_CARDS_PER_ROW + i}`]!.zIndex
    );
    const minBottomZ = Math.min(...bottomZIndices);
    const maxTopZ = Math.max(...topZIndices);
    expect(minBottomZ).toBeGreaterThan(maxTopZ);
  });

  it('each row is independently centered horizontally', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);
    const scaledW = CARD_WIDTH * result.cardScale;

    // Bottom row: cards 0–9
    const bottomFirst = result.playerHand['card-0']!.x;
    const bottomLast = result.playerHand[`card-${MAX_CARDS_PER_ROW - 1}`]!.x;
    const bottomCenter = (bottomFirst + bottomLast + scaledW) / 2;
    expect(bottomCenter).toBeCloseTo(mobileLayout.width / 2, 0);

    // Top row: cards 10–11
    const topFirst = result.playerHand['card-10']!.x;
    const topLast = result.playerHand['card-11']!.x;
    const topCenter = (topFirst + topLast + scaledW) / 2;
    expect(topCenter).toBeCloseTo(mobileLayout.width / 2, 0);
  });

  it('each row fans independently — symmetric rotation around its own midpoint', () => {
    const result = deriveCardPositions(makeInput(12), mobileLayout);

    // Bottom row first and last card should have equal-magnitude, opposite-sign rotations
    const bottomFirst = result.playerHand['card-0']!.rotation;
    const bottomLast = result.playerHand[`card-${MAX_CARDS_PER_ROW - 1}`]!.rotation;
    expect(bottomFirst + bottomLast).toBeCloseTo(0, 5);

    // Top row: cards 10 and 11 (2 cards, symmetric)
    const topFirst = result.playerHand['card-10']!.rotation;
    const topLast = result.playerHand['card-11']!.rotation;
    expect(topFirst + topLast).toBeCloseTo(0, 5);
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
      { handCardIds: [], trickCardIds: [], wonPilePlayerIds: [], opponentCardCounts: { p1: 8 } },
      LAYOUT
    );
    expect(result.opponentHands['p1']?.x).toBeCloseTo(LAYOUT.width * 0.5);
  });

  it('places two opponents at 15% and 85% of width', () => {
    const result = deriveCardPositions(
      {
        handCardIds: [],
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
