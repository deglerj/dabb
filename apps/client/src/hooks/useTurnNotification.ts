/**
 * Hook to play a notification sound when it's the player's turn.
 *
 * No-op: audio autoplay is blocked by browsers until after a user gesture,
 * and there's no reliable way to guarantee a notification sound actually
 * plays. The visual turn indicator is sufficient feedback.
 */
import { useCallback } from 'react';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';

export function useTurnNotification(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null,
  _isInitialLoad: boolean
): void {
  const noop = useCallback(() => Promise.resolve(), []);
  useActionRequiredCallback(state, currentPlayerIndex, noop);
}
