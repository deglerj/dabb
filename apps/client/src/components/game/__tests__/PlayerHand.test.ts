import { describe, it, expect } from 'vitest';
import { computeHighlightedDabbIds } from '../dabbHighlighting.js';

describe('computeHighlightedDabbIds', () => {
  const ids = ['kreuz-ass-0', 'herz-koenig-1'];

  it('highlights in dabb phase with cards', () => {
    const result = computeHighlightedDabbIds('dabb', ids);
    expect(result.has('kreuz-ass-0')).toBe(true);
    expect(result.has('herz-koenig-1')).toBe(true);
  });

  it('highlights in trump phase', () => {
    const result = computeHighlightedDabbIds('trump', ids);
    expect(result.size).toBe(2);
  });

  it('highlights in melding phase', () => {
    const result = computeHighlightedDabbIds('melding', ids);
    expect(result.size).toBe(2);
  });

  it('no highlight in dabb phase when dabbCardIds is empty (take step)', () => {
    const result = computeHighlightedDabbIds('dabb', []);
    expect(result.size).toBe(0);
  });

  it('no highlight in tricks phase even with dabbCardIds populated', () => {
    const result = computeHighlightedDabbIds('tricks', ids);
    expect(result.size).toBe(0);
  });

  it('no highlight in bidding phase', () => {
    const result = computeHighlightedDabbIds('bidding', ids);
    expect(result.size).toBe(0);
  });

  it('no highlight in finished phase', () => {
    const result = computeHighlightedDabbIds('finished', ids);
    expect(result.size).toBe(0);
  });

  it('no highlight in scoring phase', () => {
    const result = computeHighlightedDabbIds('scoring', ids);
    expect(result.size).toBe(0);
  });
});
