import { describe, it, expect } from 'vitest';
import { arcX, arcY, interpolateArc } from '../src/animations/arcPath.js';

describe('arcX', () => {
  it('starts at 0 and ends at 1', () => {
    expect(arcX(0)).toBeCloseTo(0);
    expect(arcX(1)).toBeCloseTo(1);
  });

  it('is linear (t=0.5 → 0.5)', () => {
    expect(arcX(0.5)).toBeCloseTo(0.5);
    expect(arcX(0.25)).toBeCloseTo(0.25);
  });
});

describe('arcY', () => {
  it('starts at 0 and ends at 1', () => {
    expect(arcY(0)).toBeCloseTo(0);
    expect(arcY(1)).toBeCloseTo(1);
  });

  it('dips below 0 at midpoint (card lifts above start/end line)', () => {
    // In RN coords: lower y = visually higher. arcY(0.5) < 0 means card is above the line.
    expect(arcY(0.5)).toBeLessThan(0);
  });
});

describe('interpolateArc', () => {
  it('returns start position at t=0', () => {
    const result = interpolateArc({ x: 100, y: 200 }, { x: 400, y: 500 }, 0);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(200);
  });

  it('returns end position at t=1', () => {
    const result = interpolateArc({ x: 100, y: 200 }, { x: 400, y: 500 }, 1);
    expect(result.x).toBeCloseTo(400);
    expect(result.y).toBeCloseTo(500);
  });

  it('card is visually above straight line at t=0.5 (lower y value)', () => {
    const start = { x: 0, y: 300 };
    const end = { x: 300, y: 300 };
    const mid = interpolateArc(start, end, 0.5);
    expect(mid.y).toBeLessThan(300); // lower y = higher on screen
  });
});
