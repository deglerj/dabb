/**
 * Hook to detect when the current player needs to perform an action
 */

import { useMemo, useRef, useEffect } from 'react';
import type { GameState, PlayerIndex } from '@dabb/shared-types';

export interface ActionRequiredResult {
  /** Whether the player needs to perform an action right now */
  actionRequired: boolean;
  /** The type of action required, if any */
  actionType:
    | 'bid'
    | 'take_dabb'
    | 'discard'
    | 'declare_trump'
    | 'declare_melds'
    | 'play_card'
    | null;
}

/**
 * Determines if the current player needs to perform an action
 */
export function useActionRequired(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null
): ActionRequiredResult {
  return useMemo(() => {
    if (!state || currentPlayerIndex === null) {
      return { actionRequired: false, actionType: null };
    }

    switch (state.phase) {
      case 'bidding':
        // Player's turn to bid
        if (state.currentBidder === currentPlayerIndex) {
          return { actionRequired: true, actionType: 'bid' };
        }
        break;

      case 'dabb':
        // Bid winner needs to take dabb or discard
        if (state.bidWinner === currentPlayerIndex) {
          if (state.dabb.length > 0) {
            return { actionRequired: true, actionType: 'take_dabb' };
          } else {
            return { actionRequired: true, actionType: 'discard' };
          }
        }
        break;

      case 'trump':
        // Bid winner needs to declare trump
        if (state.bidWinner === currentPlayerIndex) {
          return { actionRequired: true, actionType: 'declare_trump' };
        }
        break;

      case 'melding':
        // Player needs to confirm melds (if not already declared)
        if (!state.declaredMelds.has(currentPlayerIndex)) {
          return { actionRequired: true, actionType: 'declare_melds' };
        }
        break;

      case 'tricks':
        // Player's turn to play a card
        if (state.currentPlayer === currentPlayerIndex) {
          return { actionRequired: true, actionType: 'play_card' };
        }
        break;
    }

    return { actionRequired: false, actionType: null };
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
): ActionRequiredResult {
  const result = useActionRequired(state, currentPlayerIndex);
  const prevActionRequired = useRef(false);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Skip the initial render to avoid playing sound on page load
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      prevActionRequired.current = result.actionRequired;
      return;
    }

    // Trigger callback when action becomes required (transition from false to true)
    if (result.actionRequired && !prevActionRequired.current) {
      onActionRequired();
    }

    prevActionRequired.current = result.actionRequired;
  }, [result.actionRequired, onActionRequired]);

  return result;
}
