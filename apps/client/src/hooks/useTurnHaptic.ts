/**
 * Hook to trigger a haptic pulse when it's the player's turn.
 * Suppressed during initial state load on reconnect.
 * Note: useActionRequiredCallback already guards the first render via hasInitialized;
 * isInitialLoad is defense-in-depth for edge cases.
 */
import { useCallback } from 'react';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';
import { triggerHaptic } from '../utils/haptics.js';

export function useTurnHaptic(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null,
  isInitialLoad: boolean
): void {
  const triggerTurnHaptic = useCallback(async () => {
    if (isInitialLoad) {
      return;
    }
    triggerHaptic('turn-notification');
  }, [isInitialLoad]);

  useActionRequiredCallback(state, currentPlayerIndex, triggerTurnHaptic);
}
