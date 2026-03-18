/**
 * Web stub for useTurnNotification — audio autoplay is blocked by browsers
 * until after a user gesture, and expo-audio throws uncatchable errors on web.
 * The visual turn indicator is sufficient feedback on web.
 */

import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';
import { useCallback } from 'react';

export function useTurnNotification(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null
): void {
  const noop = useCallback(() => Promise.resolve(), []);
  useActionRequiredCallback(state, currentPlayerIndex, noop);
}
