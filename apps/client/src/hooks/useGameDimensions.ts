import { useWindowDimensions } from '@dabb/rn-compat';

export const MAX_GAME_WIDTH = 1500;

/**
 * Returns the effective game dimensions, capping width at MAX_GAME_WIDTH
 * so the game table doesn't stretch excessively on large monitors.
 */
export function useGameDimensions() {
  const { width, height } = useWindowDimensions();
  return { width: Math.min(width, MAX_GAME_WIDTH), height };
}
