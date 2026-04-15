/**
 * Web game route (native uses [code].native.tsx which is excluded from the web bundle).
 *
 * On web, @shopify/react-native-skia uses CanvasKit (WASM). The JsiSk* factories
 * capture `global.CanvasKit` at import time — so GameScreen must NOT be statically
 * imported before LoadSkiaWeb resolves. WithSkiaWeb uses React.lazy() to defer the
 * GameScreen import until after CanvasKit is ready.
 *
 * Keeping this as [code].tsx (not [code].web.tsx) ensures Metro excludes [code].native.tsx
 * from the web bundle, preventing premature Skia module evaluation.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { storageGet } from '../../hooks/useStorage.js';
import { useGame } from '../../hooks/useGame.js';
import type { GameInterface } from '@dabb/ui-shared';
import type { PlayerIndex } from '@dabb/shared-types';

type StoredSession = {
  secretId: string;
  playerId: string;
  playerIndex: PlayerIndex;
};

export default function GameRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [credentials, setCredentials] = useState<StoredSession | null>(null);

  useEffect(() => {
    if (!code) {
      router.replace('/');
      return;
    }
    void (async () => {
      try {
        const raw = await storageGet(`dabb-${code}`);
        if (!raw) {
          router.replace('/');
          return;
        }
        setCredentials(JSON.parse(raw) as StoredSession);
      } catch {
        router.replace('/');
      }
    })();
  }, [code, router]);

  const game = useGame(
    credentials
      ? { sessionId: code, secretId: credentials.secretId, playerIndex: credentials.playerIndex }
      : { sessionId: '', secretId: '', playerIndex: 0 }
  );

  if (!credentials) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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
      componentProps={{ game, playerIndex: credentials.playerIndex }}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
