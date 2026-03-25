import { Platform, useWindowDimensions } from 'react-native';

export const MAX_GAME_WIDTH = 1500;

/**
 * Returns the effective game dimensions, capping width at MAX_GAME_WIDTH on web
 * so the game table doesn't stretch excessively on large monitors.
 */
export function useGameDimensions() {
  const { width, height } = useWindowDimensions();
  const effectiveWidth = Platform.OS === 'web' ? Math.min(width, MAX_GAME_WIDTH) : width;
  return { width: effectiveWidth, height };
}
