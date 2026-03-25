/**
 * Arc path math for card flight animations.
 * All functions operate on normalized time t ∈ [0, 1].
 */

/** Linear x — constant horizontal speed. */
export function arcX(t: number): number {
  return t;
}

/**
 * Y offset along the arc as a normalized curve. Returns a value relative to
 * the straight-line interpolation: negative means the card is above the line.
 * Quadratic bezier B(t) = (1-t)^2*P0 + 2*(1-t)*t*P1 + t^2*P2
 * with P0=0, P1=-1, P2=1:
 *   B(t) = 2*(1-t)*t*(-1) + t^2
 * At t=0: 0, t=1: 1, t=0.5: -0.25 (above the straight line).
 */
export function arcY(t: number): number {
  return 2 * (1 - t) * t * -1 + t * t;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Arc lift magnitude in pixels. Controls how far above the straight line the
 * card rises at the midpoint of its flight.
 */
const ARC_LIFT_PX = 80;

/**
 * Interpolates position along the arc at normalized time t.
 * The horizontal position follows a linear interpolation.
 * The vertical position blends linear interpolation with an arc lift offset
 * so that the card rises visually above the start/end line.
 */
export function interpolateArc(from: Point, to: Point, t: number): Point {
  // Linear y interpolation
  const linearY = from.y + (to.y - from.y) * t;
  // Arc offset: arcY deviation from linear (i.e. arcY(t) - t) scaled by lift
  const arcOffset = (arcY(t) - t) * ARC_LIFT_PX;
  return {
    x: from.x + (to.x - from.x) * arcX(t),
    y: linearY + arcOffset,
  };
}
