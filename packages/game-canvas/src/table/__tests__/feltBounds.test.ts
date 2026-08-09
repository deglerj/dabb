import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SURROUND_FRACTION,
  getFeltBounds,
  isWithinDropZone,
  isWithinFeltBounds,
} from '../feltBounds.js';

describe('getFeltBounds', () => {
  it('returns correct bounds for a square-ish screen with default surroundFraction', () => {
    const bounds = getFeltBounds(800, 600);
    const surround = Math.round(800 * DEFAULT_SURROUND_FRACTION);
    expect(bounds).toEqual({
      x: surround,
      y: surround,
      width: 800 - surround * 2,
      height: 600 - surround * 2,
    });
  });

  it('returns correct bounds with a custom surroundFraction', () => {
    const bounds = getFeltBounds(800, 600, 0.1);
    const surround = Math.round(800 * 0.1);
    expect(bounds).toEqual({
      x: surround,
      y: surround,
      width: 800 - surround * 2,
      height: 600 - surround * 2,
    });
  });

  it('derives surround from screenWidth only on a portrait screen', () => {
    // surround = Math.round(390 * 0.05) = 20, NOT Math.round(844 * 0.05) = 42
    const bounds = getFeltBounds(390, 844);
    expect(bounds.x).toBe(20);
    expect(bounds.y).toBe(20);
    expect(bounds.width).toBe(390 - 40);
    expect(bounds.height).toBe(844 - 40);
  });
});

describe('isWithinFeltBounds', () => {
  const bounds = getFeltBounds(800, 600); // surround = 40, felt spans x:[40,760] y:[40,560]

  it('accepts a point inside the felt', () => {
    expect(isWithinFeltBounds(400, 300, bounds)).toBe(true);
  });

  it('accepts points exactly on the boundary (inclusive)', () => {
    expect(isWithinFeltBounds(bounds.x, bounds.y, bounds)).toBe(true);
    expect(isWithinFeltBounds(bounds.x + bounds.width, bounds.y + bounds.height, bounds)).toBe(
      true
    );
  });

  it('rejects a point outside the felt', () => {
    expect(isWithinFeltBounds(0, 300, bounds)).toBe(false);
    expect(isWithinFeltBounds(800, 300, bounds)).toBe(false);
  });

  // Regression: dragGesture.ts reports drop coordinates relative to #game-wrapper, which is
  // capped at MAX_GAME_WIDTH=1500 and centered — so on a monitor wider than 1500px, local drop
  // coordinates only ever range [0, 1500]. getFeltBounds must be called with that *capped*
  // width, not the raw window width: doing it wrong makes the computed felt ~228px wider than
  // the space local coordinates actually live in, silently treating the wood margin outside
  // the real felt as a valid drop target.
  it('uses the capped game-wrapper width, not the raw window width, for the felt edge', () => {
    const rawWindowWidth = 1920;
    const cappedWidth = 1500; // MAX_GAME_WIDTH from useGameDimensions
    const height = 900;

    const correctBounds = getFeltBounds(cappedWidth, height);
    const wrongBounds = getFeltBounds(rawWindowWidth, height);
    expect(correctBounds).toEqual({ x: 75, y: 75, width: 1350, height: 750 });
    expect(wrongBounds).toEqual({ x: 96, y: 96, width: 1728, height: 708 });

    // x=1430 is local-space wood, just past the true (capped) felt's right edge at x=1425 —
    // must be rejected as a drop target.
    expect(isWithinFeltBounds(1430, 450, correctBounds)).toBe(false);

    // The same local coordinate is wrongly accepted if bounds were computed from the raw,
    // uncapped window width instead — this is the exact bug that shipped.
    expect(isWithinFeltBounds(1430, 450, wrongBounds)).toBe(true);
  });
});

describe('isWithinDropZone', () => {
  const bounds = getFeltBounds(800, 600); // felt spans x:[40,760] y:[40,560]
  const handTopY = 480; // topmost hand card

  it('accepts a drop on the felt above the hand', () => {
    expect(isWithinDropZone(400, 300, bounds, handTopY)).toBe(true);
  });

  // Regression: the felt reaches underneath the hand arc, so felt bounds alone counted a card
  // dragged back down onto the hand as a play unless it landed below the felt's bottom edge.
  it('rejects a drop back onto the hand even though it is still on the felt', () => {
    expect(isWithinFeltBounds(400, 500, bounds)).toBe(true);
    expect(isWithinDropZone(400, 500, bounds, handTopY)).toBe(false);
    expect(isWithinDropZone(400, handTopY, bounds, handTopY)).toBe(false);
  });

  it('still rejects a drop off the felt', () => {
    expect(isWithinDropZone(0, 300, bounds, handTopY)).toBe(false);
  });
});
