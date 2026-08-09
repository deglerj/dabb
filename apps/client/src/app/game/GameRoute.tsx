import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from '@dabb/rn-compat';
import { useNavigate, useParams } from 'react-router-dom';
import { useFirebaseGame } from '../../hooks/useFirebaseGame.js';
import { useAI } from '../../hooks/useAI.js';
import GameScreen from '../../components/ui/GameScreen.js';
import type { PlayerIndex } from '@dabb/shared-types';

type StoredSession = {
  secretId: string;
  playerId: string;
  playerIndex: PlayerIndex;
};

export default function GameRoute() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<StoredSession | null>(null);

  useEffect(() => {
    if (!code) {
      navigate('/', { replace: true });
      return;
    }
    try {
      const raw = localStorage.getItem(`dabb-${code}`);
      if (!raw) {
        navigate('/', { replace: true });
        return;
      }
      setCredentials(JSON.parse(raw) as StoredSession);
    } catch {
      navigate('/', { replace: true });
    }
  }, [code, navigate]);

  const game = useFirebaseGame(
    credentials
      ? {
          sessionCode: code ?? '',
          secretId: credentials.secretId,
          playerIndex: credentials.playerIndex,
        }
      : { sessionCode: '', secretId: '', playerIndex: 0 as PlayerIndex }
  );

  useAI({
    sessionCode: code ?? '',
    secretId: credentials?.secretId ?? '',
    rawEvents: game.rawEvents ?? [],
    aiSeats: game.aiSeats ?? [],
  });

  if (!credentials) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <GameScreen game={game} playerIndex={credentials.playerIndex} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
