import { describe, it, expect } from 'vitest';
import { generateSessionCode } from '../utils/sessionCode.js';

describe('generateSessionCode', () => {
  it('returns a string in adjective-noun-number format', () => {
    const code = generateSessionCode();
    expect(typeof code).toBe('string');
    const parts = code.split('-');
    expect(parts).toHaveLength(3);
    const [adjective, noun, numberStr] = parts;
    expect(adjective.length).toBeGreaterThan(0);
    expect(noun.length).toBeGreaterThan(0);
    const num = parseInt(numberStr, 10);
    expect(num).toBeGreaterThanOrEqual(1);
    expect(num).toBeLessThanOrEqual(99);
  });

  it('generates different codes across multiple calls', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateSessionCode()));
    // With ~200k combinations, 50 calls should almost always yield >1 unique code
    expect(codes.size).toBeGreaterThan(1);
  });

  it('only uses lowercase characters and hyphens', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateSessionCode();
      expect(code).toMatch(/^[a-z]+-[a-z]+-\d+$/);
    }
  });
});
