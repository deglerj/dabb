/**
 * Hook to play a notification sound when it's the player's turn
 */

import { useCallback, useRef } from 'react';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';

const NOTIFICATION_SOUND_URL = '/notification.ogg';

/**
 * Plays a notification sound when the player needs to perform an action
 */
export function useTurnNotification(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null
): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playNotification = useCallback(() => {
    // Create audio element lazily
    if (!audioRef.current) {
      audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
      audioRef.current.volume = 0.5;
    }

    // Play the sound (reset if already playing)
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      // Ignore errors (e.g., user hasn't interacted with page yet)
    });
  }, []);

  useActionRequiredCallback(state, currentPlayerIndex, playNotification);
}
