/**
 * Hook to play a notification sound when it's the player's turn
 */

import { useCallback, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';

/**
 * Plays a notification sound when the player needs to perform an action
 */
export function useTurnNotification(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null
): void {
  const soundRef = useRef<Audio.Sound | null>(null);

  // Load the sound on mount
  useEffect(() => {
    let mounted = true;

    async function loadSound() {
      try {
        const { sound } = await Audio.Sound.createAsync(
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('../../assets/sounds/notification.ogg'),
          { volume: 0.5 }
        );
        if (mounted) {
          soundRef.current = sound;
        } else {
          // Component unmounted before sound loaded, clean up
          await sound.unloadAsync();
        }
      } catch (error) {
        // Ignore errors loading sound
        console.warn('Failed to load notification sound:', error);
      }
    }

    loadSound();

    return () => {
      mounted = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  const playNotification = useCallback(async () => {
    if (!soundRef.current) {
      return;
    }

    try {
      // Reset to beginning if already played
      await soundRef.current.setPositionAsync(0);
      await soundRef.current.playAsync();
    } catch (error) {
      // Ignore playback errors
      console.warn('Failed to play notification sound:', error);
    }
  }, []);

  useActionRequiredCallback(state, currentPlayerIndex, playNotification);
}
