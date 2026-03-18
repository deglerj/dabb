import { describe, expect, it } from 'vitest';
import { DEFAULT_SURROUND_FRACTION, getFeltBounds } from '../feltBounds.js';

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
