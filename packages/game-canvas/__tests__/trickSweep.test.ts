import { describe, it, expect } from 'vitest';
import { computeSweepSchedule } from '../src/animations/trickSweep.js';

const DEST = { x: 50, y: 550 };

describe('computeSweepSchedule', () => {
  it('all cards go to the same destination', () => {
    const s = computeSweepSchedule(['c1', 'c2', 'c3'], DEST, 200);
    s.forEach((e) => expect(e.destination).toEqual(DEST));
  });

  it('later cards have larger delays', () => {
    const s = computeSweepSchedule(['c1', 'c2', 'c3'], DEST, 200);
    expect(s[0]!.delay).toBeLessThan(s[1]!.delay);
    expect(s[1]!.delay).toBeLessThan(s[2]!.delay);
  });

  it('gap between arrivals equals arrivalGap param', () => {
    const s = computeSweepSchedule(['c1', 'c2'], DEST, 200);
    expect(s[1]!.delay - s[0]!.delay).toBe(200);
  });
});
