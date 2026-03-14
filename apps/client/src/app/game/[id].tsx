/**
 * Web game route (native uses [id].native.tsx which is excluded from the web bundle).
 *
 * On web, @shopify/react-native-skia uses CanvasKit (WASM). The JsiSk* factories
 * capture `global.CanvasKit` at import time — so GameScreen must NOT be statically
 * imported before LoadSkiaWeb resolves. WithSkiaWeb uses React.lazy() to defer the
 * GameScreen import until after CanvasKit is ready.
 *
 * Keeping this as [id].tsx (not [id].web.tsx) ensures Metro excludes [id].native.tsx
 * from the web bundle, preventing premature Skia module evaluation.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import type { PlayerIndex } from '@dabb/shared-types';

export default function GameRoute() {
  const params = useLocalSearchParams();
  const sessionId = params['id'] as string | undefined;
  // The server socket middleware identifies sessions by code, not UUID (see handlers.ts)
  const sessionCode = (params['code'] as string | undefined) ?? '';
  const secretId = params['secretId'] as string | undefined;
  const piStr = params['playerIndex'] as string | undefined;
  const playerIndex = parseInt(piStr ?? '0', 10) as PlayerIndex;

  if (!sessionId || !secretId) {
    return null;
  }

  return (
    <WithSkiaWeb
      getComponent={() => import('../../components/ui/GameScreen.js')}
      opts={{ locateFile: (file: string) => `/${file}` }}
      fallback={
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      }
      componentProps={{ sessionId: sessionCode, secretId, playerIndex }}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
