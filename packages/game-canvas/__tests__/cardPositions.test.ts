import { describe, it, expect } from 'vitest';
import { deriveCardPositions, type LayoutDimensions } from '../src/cards/cardPositions.js';

const LAYOUT: LayoutDimensions = {
  width: 800,
  height: 600,
  playerCount: 3,
};

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
