/**
 * Hook to play a notification sound when it's the player's turn
 */

import { useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const notificationSound = require('../../assets/sounds/notification.ogg');

/**
 * Plays a notification sound when the player needs to perform an action
 */
export function useTurnNotification(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null
): void {
  const player = useAudioPlayer(notificationSound);

  const playNotification = useCallback(async () => {
    if (!player) {
      return;
    }

    try {
      player.volume = 0.5;
      player.seekTo(0);
      player.play();
    } catch (error) {
      // Ignore playback errors
      console.warn('Failed to play notification sound:', error);
    }
  }, [player]);

  useActionRequiredCallback(state, currentPlayerIndex, playNotification);
}
