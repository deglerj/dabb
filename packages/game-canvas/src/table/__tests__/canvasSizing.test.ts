import { describe, expect, it } from 'vitest';
import { computeCanvasBackingSize } from '../canvasSizing.js';

describe('computeCanvasBackingSize', () => {
  it('matches CSS size 1:1 at devicePixelRatio 1', () => {
    expect(computeCanvasBackingSize(800, 600, 1)).toEqual({ width: 800, height: 600 });
  });

  it('scales up for a standard Retina devicePixelRatio of 2', () => {
    expect(computeCanvasBackingSize(800, 600, 2)).toEqual({ width: 1600, height: 1200 });
  });

  // Regression: fractional devicePixelRatio (e.g. 1.5 on many Windows/Linux display scaling
  // setups, or 3 on some Android phones) must round each axis independently rather than
  // truncating — a non-integer canvas.width/height gets silently floored by the DOM, which
  // previously left a ~1px sliver of stale/blank pixels along the bottom/right edge.
  it('rounds each axis independently for a fractional devicePixelRatio', () => {
    // 375 * 1.5 = 562.5 -> 563 (round, not floor to 562)
    expect(computeCanvasBackingSize(375, 667, 1.5)).toEqual({ width: 563, height: 1001 });
  });

  it('handles devicePixelRatio 3 (common on Android)', () => {
    expect(computeCanvasBackingSize(390, 844, 3)).toEqual({ width: 1170, height: 2532 });
  });
});
