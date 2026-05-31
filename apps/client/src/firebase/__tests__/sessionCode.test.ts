import { describe, it, expect } from 'vitest';
import { generateSessionCode } from '../sessionCode.js';

describe('generateSessionCode', () => {
  it('returns adjective-noun-number format', () => {
    const code = generateSessionCode();
    expect(code).toMatch(/^[a-z]+-[a-z]+-\d+$/);
  });

  it('number is between 1 and 99', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateSessionCode();
      const parts = code.split('-');
      const num = parseInt(parts[2], 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(99);
    }
  });

  it('generates unique codes (probabilistic)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateSessionCode()));
    expect(codes.size).toBeGreaterThan(40);
  });
});
