/**
 * Web stub for useTurnHaptic — haptics are not available on web.
 */
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';
import { useCallback } from 'react';

export function useTurnHaptic(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null,
  _isInitialLoad: boolean
): void {
  const noop = useCallback(() => Promise.resolve(), []);
  useActionRequiredCallback(state, currentPlayerIndex, noop);
}
