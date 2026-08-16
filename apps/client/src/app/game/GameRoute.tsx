import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from '@dabb/rn-compat';
import { useNavigate, useParams } from 'react-router-dom';
import { useFirebaseGame } from '../../hooks/useFirebaseGame.js';
import { useAI } from '../../hooks/useAI.js';
import { useRematch } from '../../hooks/useRematch.js';
import GameScreen from '../../components/ui/GameScreen.js';
import type { PlayerIndex } from '@dabb/shared-types';

type StoredSession = {
  secretId: string;
  playerId: string;
  playerIndex: PlayerIndex;
};

function GameSession({ code }: { code: string }) {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState<StoredSession | null>(null);

  useEffect(() => {
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
          sessionCode: code,
          secretId: credentials.secretId,
          playerIndex: credentials.playerIndex,
        }
      : { sessionCode: '', secretId: '', playerIndex: 0 as PlayerIndex }
  );

  useAI({
    sessionCode: code,
    secretId: credentials?.secretId ?? '',
    rawEvents: game.rawEvents ?? [],
    aiSeats: game.aiSeats ?? [],
  });

  const rematch = useRematch({
    // Blank until the credentials are read: seat 0 hosts the rematch, and the placeholder
    // index below would make every client think it is the host.
    sessionCode: credentials ? code : '',
    playerIndex: credentials?.playerIndex ?? (0 as PlayerIndex),
    game,
  });

  if (!credentials) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <GameScreen game={game} playerIndex={credentials.playerIndex} rematch={rematch} />;
}

export default function GameRoute() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!code) {
      navigate('/', { replace: true });
    }
  }, [code, navigate]);

  if (!code) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Keyed by the session code: a rematch navigates from one session to the next without the
  // route unmounting, and every hook below here accumulates events for one session only —
  // the event log, the round history and the game log would all merge the two.
  return <GameSession key={code} code={code} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
