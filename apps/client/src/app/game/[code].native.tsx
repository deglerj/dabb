import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import GameScreen from '../../components/ui/GameScreen.js';
import { storageGet } from '../../hooks/useStorage.js';
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

  if (!credentials) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <GameScreen
      sessionId={code}
      secretId={credentials.secretId}
      playerIndex={credentials.playerIndex}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
