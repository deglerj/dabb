/**
 * Hook to trigger a haptic pulse when it's the player's turn.
 */
import { useCallback } from 'react';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';
import { triggerHaptic } from '../utils/haptics.js';

export function useTurnHaptic(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null
): void {
  const triggerTurnHaptic = useCallback(async () => {
    triggerHaptic('turn-notification');
  }, []);

  useActionRequiredCallback(state, currentPlayerIndex, triggerTurnHaptic);
}
