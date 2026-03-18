export const DEFAULT_SURROUND_FRACTION = 0.05;

export interface FeltBounds {
  x: number; // left edge of felt (px)
  y: number; // top edge of felt (px)
  width: number; // felt width (px)
  height: number; // felt height (px)
}

export function getFeltBounds(
  screenWidth: number,
  screenHeight: number,
  surroundFraction = DEFAULT_SURROUND_FRACTION
): FeltBounds {
  const surround = Math.round(screenWidth * surroundFraction);
  return {
    x: surround,
    y: surround,
    width: screenWidth - surround * 2,
    height: screenHeight - surround * 2,
  };
}
