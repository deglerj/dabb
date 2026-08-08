/**
 * Tracks whether a game is currently in progress, outside the React tree — checked by the
 * PWA update prompt in main.tsx before offering to reload, so a service worker update never
 * interrupts a live session. Set by GameScreen.
 */
export const gameActivity = { inProgress: false };
