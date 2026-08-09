// __APP_VERSION__ is injected by vite.config.ts from package.json at build time.
declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;

/**
 * Geometry of the floating top-right controls (emote button, options button).
 *
 * They are absolutely positioned over ScoreboardStrip, which lives in a different component
 * tree and has no other way to know how much room to leave — so the numbers live here and
 * both sides read them. Every previous overlap came from one side hard-coding a size the
 * other side did not share: the strip reserved a width that fit the options button alone,
 * and the buttons were offset from the top by more than the strip was tall.
 */
export const TOP_RIGHT_CONTROLS_SIZE = 36;
/** Offset from the top of the strip. Independent of the strip's own text padding. */
export const TOP_RIGHT_CONTROLS_TOP = 2;
/** Offset from the right edge. */
export const TOP_RIGHT_CONTROLS_RIGHT = 13;
/** Edge offset + two buttons + the gap between them, plus a little clearance. */
export const TOP_RIGHT_CONTROLS_RESERVE =
  TOP_RIGHT_CONTROLS_RIGHT + 2 * TOP_RIGHT_CONTROLS_SIZE + 6 + 6;
