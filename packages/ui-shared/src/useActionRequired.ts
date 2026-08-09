/**
 * Hook to detect when the current player needs to perform an action
 */

import { useMemo, useRef, useEffect } from 'react';
import { isWaitingOn } from '@dabb/game-logic';
import type { GameState, PlayerIndex } from '@dabb/shared-types';

/**
 * Whether the game is currently waiting on this player.
 *
 * Defers to isWaitingOn rather than switching on the phase here: a second copy of the
 * turn rules silently goes stale when the phase order changes, which is how this hook
 * came to miss the discard phase entirely.
 */
export function useActionRequired(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null
): boolean {
  return useMemo(() => {
    if (!state || currentPlayerIndex === null) {
      return false;
    }
    return isWaitingOn(state, currentPlayerIndex);
  }, [state, currentPlayerIndex]);
}

/**
 * Hook that triggers a callback when action becomes required
 * Used to play notification sounds
 */
export function useActionRequiredCallback(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null,
  onActionRequired: () => void
): boolean {
  const actionRequired = useActionRequired(state, currentPlayerIndex);
  const prevActionRequired = useRef(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Skip the initial render to avoid playing sound on page load
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      prevActionRequired.current = actionRequired;
      return;
    }

    // Trigger callback when action becomes required (transition from false to true)
    if (actionRequired && !prevActionRequired.current) {
      onActionRequired();
    }

    prevActionRequired.current = actionRequired;
  }, [actionRequired, onActionRequired]);

  return actionRequired;
}
