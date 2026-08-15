/**
 * Hook to trigger a haptic pulse when it's the player's turn.
 * Suppressed while the state we are looking at comes from replayed events (rejoin, reload) —
 * being caught up on a turn that started without us is not worth a buzz.
 * Note: useActionRequiredCallback already guards the first render via hasInitialized;
 * this is defense-in-depth for the renders after it, where the replayed log has landed.
 */
import { useCallback } from 'react';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';
import { triggerHaptic } from '../utils/haptics.js';

export function useTurnHaptic(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null,
  /** True when the newest event is one we are only catching up on. */
  isReplaying: boolean
): void {
  const triggerTurnHaptic = useCallback(async () => {
    if (isReplaying) {
      return;
    }
    triggerHaptic('turn-notification');
  }, [isReplaying]);

  useActionRequiredCallback(state, currentPlayerIndex, triggerTurnHaptic);
}
