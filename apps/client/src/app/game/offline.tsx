/**
 * Offline game route (web).
 * Uses WithSkiaWeb to defer Skia loading — same pattern as [code].tsx.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { useOfflineGame } from '../../hooks/useOfflineGame.js';
import type { GameInterface } from '@dabb/ui-shared';
import type { PlayerCount, PlayerIndex } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';

export default function OfflineGameRoute() {
  const { playerCount, difficulty, nickname, resume } = useLocalSearchParams<{
    playerCount?: string;
    difficulty?: string;
    nickname?: string;
    resume?: string;
  }>();

  const isResume = resume === 'true';

  const game = useOfflineGame({
    playerCount: (Number(playerCount) || 2) as PlayerCount,
    difficulty: (difficulty as AIDifficulty) || 'medium',
    nickname: nickname || 'Ich',
    resume: isResume,
  });

  return (
    <WithSkiaWeb
      getComponent={() =>
        import('../../components/ui/GameScreen.js') as unknown as Promise<{
          default: React.ComponentType<{ game: GameInterface; playerIndex: PlayerIndex }>;
        }>
      }
      opts={{ locateFile: (file: string) => `/${file}` }}
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      }
      componentProps={{ game, playerIndex: 0 as PlayerIndex }}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
