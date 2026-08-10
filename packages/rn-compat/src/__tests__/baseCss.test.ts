import { describe, expect, it } from 'vitest';
import { CSS } from '../baseCss.js';

describe('base stylesheet', () => {
  it('sizes Text border-box like View (regression)', () => {
    // A Text with `width: 94` plus `paddingHorizontal: 4` used to measure 102px while a View
    // with the same style measured 94px, so the scoreboard's column headers drifted right of
    // the score columns underneath them.
    const textRule = /\.rn-text\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(textRule).toContain('box-sizing: border-box');
  });
});
