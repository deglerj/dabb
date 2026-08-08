import { describe, expect, it } from 'vitest';
import { flattenStyle } from '../styles.js';

describe('flattenStyle', () => {
  it('gives numeric lineHeight a px unit (regression)', () => {
    // Bare CSS treats a unitless lineHeight as a font-size multiplier, not a
    // pixel value like RN does — this collapsed CardFace's corner suit symbol
    // outside the card bounds (lineHeight: 13 -> 13x font-size, ~146px tall).
    const flat = flattenStyle({ lineHeight: 13, fontSize: 11 });
    expect(flat?.lineHeight).toBe('13px');
  });

  it('leaves string lineHeight (e.g. "normal") untouched', () => {
    const flat = flattenStyle({ lineHeight: 'normal' });
    expect(flat?.lineHeight).toBe('normal');
  });
});
