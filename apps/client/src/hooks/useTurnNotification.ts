/**
 * Hook to play a notification sound when it's the player's turn
 */

import { useCallback, useEffect } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const notificationSound = require('../../assets/sounds/notification.ogg');

/**
 * Plays a notification sound when the player needs to perform an action.
 * Suppressed during initial state load on reconnect.
 * Note: useActionRequiredCallback already guards the first render via hasInitialized;
 * isInitialLoad is defense-in-depth for edge cases.
 */
export function useTurnNotification(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null,
  isInitialLoad: boolean
): void {
  useEffect(() => {
    setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      interruptionModeAndroid: 'mixWithOthers',
    });
  }, []);

  const player = useAudioPlayer(notificationSound);

  const playNotification = useCallback(async () => {
    if (isInitialLoad) {
      return;
    }

    if (!player) {
      return;
    }

    try {
      player.volume = 0.5;
      player.seekTo(0);
      await Promise.resolve(player.play()).catch(() => {
        // Ignore autoplay policy rejections (e.g. browser requires user gesture)
      });
    } catch {
      // Ignore synchronous playback errors
    }
  }, [player, isInitialLoad]);

  useActionRequiredCallback(state, currentPlayerIndex, playNotification);
}
