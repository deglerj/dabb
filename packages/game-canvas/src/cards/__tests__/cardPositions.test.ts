import { describe, it, expect } from 'vitest';
import { deriveCardPositions } from '../cardPositions.js';

const CARD_WIDTH = 70;
const CARD_HEIGHT = 105;
const CARD_OVERLAP = 22;
const HAND_SIDE_MARGIN = 16;

function makeInput(cardCount: number) {
  return {
    handCardIds: Array.from({ length: cardCount }, (_, i) => `card-${i}`),
    trickCardIds: [],
    wonPilePlayerIds: [],
    opponentCardCounts: {},
  };
}

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
    // Verify hand fits within screen minus margins
    const n = 12;
    const scaledW = CARD_WIDTH * result.cardScale;
    const scaledOverlap = CARD_OVERLAP * result.cardScale;
    const handWidth = n * scaledW - (n - 1) * scaledOverlap;
    expect(handWidth).toBeLessThanOrEqual(375 - 2 * HAND_SIDE_MARGIN + 0.5); // +0.5 for float rounding
  });

  it('bottom-anchors the hand so it never goes off-screen', () => {
    const layout = { width: 375, height: 812, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(12), layout);
    const firstCard = result.playerHand['card-0'];
    expect(firstCard).toBeDefined();
    const scaledH = CARD_HEIGHT * result.cardScale;
    // Bottom edge of cards = y + scaledH, should be <= height
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
    // Natural width of 3 cards at full size
    const n = 3;
    const naturalWidth = n * CARD_WIDTH - (n - 1) * CARD_OVERLAP;
    const screenWidth = naturalWidth + 2 * HAND_SIDE_MARGIN;
    const layout = { width: screenWidth, height: 800, playerCount: 3 as const };
    const result = deriveCardPositions(makeInput(n), layout);
    expect(result.cardScale).toBeCloseTo(1, 5);
  });
});
