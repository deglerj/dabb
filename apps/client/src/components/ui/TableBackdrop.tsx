/**
 * TableBackdrop — the same wood surround + felt surface the game renders, behind
 * the menu and the lobby, so they sit at the table instead of on a flat fill.
 *
 * No `effects` prop: menus have no drag or trick animations, so GameTable skips
 * its requestAnimationFrame layer entirely.
 */
import { GameTable } from '@dabb/game-canvas';
import { useWindowDimensions } from '@dabb/rn-compat';

export function TableBackdrop() {
  const { width, height } = useWindowDimensions();
  return <GameTable width={width} height={height} />;
}
