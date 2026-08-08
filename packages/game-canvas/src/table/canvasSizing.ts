export interface CanvasBackingSize {
  width: number;
  height: number;
}

/** CSS pixel dimensions -> canvas backing-store pixel dimensions for a given devicePixelRatio.
 * Rounds independently per axis (not e.g. width*height*dpr) so canvas.width/height stay
 * integers — fractional backing-store sizes get silently truncated by the canvas element,
 * which would otherwise leave a 1px sliver of stale/blank pixels along one edge. */
export function computeCanvasBackingSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number
): CanvasBackingSize {
  return {
    width: Math.round(cssWidth * dpr),
    height: Math.round(cssHeight * dpr),
  };
}
