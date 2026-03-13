import { describe, it, expect } from 'vitest';
import { computeDealSchedule } from '../src/animations/dealSequence.js';

describe('computeDealSchedule', () => {
  it('first card has delay 0', () => {
    const s = computeDealSchedule(['c1', 'c2', 'c3'], 80);
    expect(s[0]?.delay).toBe(0);
  });

  it('staggers by the given interval', () => {
    const s = computeDealSchedule(['c1', 'c2', 'c3'], 80);
    expect(s[1]?.delay).toBe(80);
    expect(s[2]?.delay).toBe(160);
  });

  it('preserves card ID order', () => {
    const s = computeDealSchedule(['c1', 'c2', 'c3'], 80);
    expect(s.map((e) => e.cardId)).toEqual(['c1', 'c2', 'c3']);
  });
});
