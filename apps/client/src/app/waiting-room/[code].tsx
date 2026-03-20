import React, { useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSocket } from '@dabb/ui-shared';
import WaitingRoomScreen from '../../components/ui/WaitingRoomScreen.js';
import { storageDelete, storageGet } from '../../hooks/useStorage.js';
import { SERVER_URL } from '../../constants.js';
import type { PlayerIndex, AIDifficulty, GameEvent } from '@dabb/shared-types';

type PlayerEntry = {
  nickname: string;
  connected: boolean;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
};

type StoredSession = {
  secretId: string;
  playerId: string;
  playerIndex: PlayerIndex;
  playerCount?: number;
};

export default function WaitingRoomRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const [credentials, setCredentials] = useState<StoredSession | null>(null);
  const [_nickname, setNickname] = useState('');
  const [players, setPlayers] = useState<Map<PlayerIndex, PlayerEntry>>(new Map());
  const [isAddingAI, setIsAddingAI] = useState(false);
  const [selectedAIDifficulty, setSelectedAIDifficulty] = useState<AIDifficulty>('medium');

  // Load credentials from storage on mount
  useEffect(() => {
    if (!code) {
      router.replace('/');
      return;
    }
    void (async () => {
      try {
        const [sessionRaw, storedNickname] = await Promise.all([
          storageGet(`dabb-${code}`),
          storageGet('dabb-nickname'),
        ]);
        if (!sessionRaw) {
          router.replace('/');
          return;
        }
        const session = JSON.parse(sessionRaw) as StoredSession;
        setCredentials(session);
        const ownNickname = storedNickname ?? '';
        setNickname(ownNickname);
        // Seed own player — server emits player:joined only to *other* sockets
        setPlayers(
          new Map([[session.playerIndex, { nickname: ownNickname, connected: true, isAI: false }]])
        );
      } catch {
        router.replace('/');
      }
    })();
  }, [code, router]);

  const handlePlayerJoined = useCallback(
    (idx: number, playerNickname: string, isAI = false, aiDifficulty?: AIDifficulty) => {
      setPlayers((prev) => {
        const next = new Map(prev);
        next.set(idx as PlayerIndex, {
          nickname: playerNickname,
          connected: true,
          isAI,
          aiDifficulty,
        });
        return next;
      });
    },
    []
  );

  const handlePlayerLeft = useCallback((idx: number) => {
    setPlayers((prev) => {
      const next = new Map(prev);
      const p = next.get(idx as PlayerIndex);
      if (p) {
        next.set(idx as PlayerIndex, { ...p, connected: false });
      }
      return next;
    });
  }, []);

  const handlePlayerReconnected = useCallback((idx: number) => {
    setPlayers((prev) => {
      const next = new Map(prev);
      const p = next.get(idx as PlayerIndex);
      if (p) {
        next.set(idx as PlayerIndex, { ...p, connected: true });
      }
      return next;
    });
  }, []);

  const handleEvents = useCallback(
    (events: GameEvent[]) => {
      const started = events.some((e) => e.type === 'GAME_STARTED');
      if (started) {
        router.replace({
          pathname: '/game/[code]',
          params: { code },
        });
      }
    },
    [router, code]
  );

  // Note: useSocket called unconditionally (Rules of Hooks).
  // Passes empty secretId while credentials are loading — socket won't connect until it's non-empty.
  const { emit, error: _connectionError } = useSocket({
    serverUrl: SERVER_URL,
    sessionId: code ?? '',
    secretId: credentials?.secretId ?? '',
    onEvents: handleEvents,
    onPlayerJoined: handlePlayerJoined,
    onPlayerLeft: handlePlayerLeft,
    onPlayerReconnected: handlePlayerReconnected,
  });

  if (!credentials) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const { playerIndex, playerCount } = credentials;
  const isHost = playerIndex === 0;

  const handleStartGame = () => {
    emit?.('game:start');
  };

  const handleLeave = async () => {
    emit?.('game:exit');
    await storageDelete(`dabb-${code}`);
    router.replace('/');
  };

  const handleAddAI = async () => {
    if (!credentials.secretId || isAddingAI) {
      return;
    }
    setIsAddingAI(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/sessions/${code}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-Id': credentials.secretId },
        body: JSON.stringify({ difficulty: selectedAIDifficulty }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        Alert.alert('Error', data.error ?? 'Failed to add AI player');
        return;
      }
      const {
        playerIndex: idx,
        nickname: aiNickname,
        aiDifficulty,
      } = (await response.json()) as {
        playerIndex: number;
        nickname: string;
        aiDifficulty: AIDifficulty;
      };
      handlePlayerJoined(idx, aiNickname, true, aiDifficulty);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add AI player');
    } finally {
      setIsAddingAI(false);
    }
  };

  const handleRemoveAI = async (playerIdx: PlayerIndex) => {
    if (!credentials.secretId) {
      return;
    }
    try {
      const response = await fetch(`${SERVER_URL}/api/sessions/${code}/ai/${playerIdx}`, {
        method: 'DELETE',
        headers: { 'X-Secret-Id': credentials.secretId },
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        Alert.alert('Error', data.error ?? 'Failed to remove AI player');
        return;
      }
      setPlayers((prev) => {
        const next = new Map(prev);
        next.delete(playerIdx);
        return next;
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove AI player');
    }
  };

  return (
    <WaitingRoomScreen
      sessionCode={code}
      players={players}
      playerCount={playerCount ?? 0}
      isHost={isHost}
      onStartGame={handleStartGame}
      onLeave={handleLeave}
      onAddAI={isHost ? handleAddAI : undefined}
      onRemoveAI={isHost ? handleRemoveAI : undefined}
      isAddingAI={isAddingAI}
      selectedAIDifficulty={selectedAIDifficulty}
      onSelectAIDifficulty={setSelectedAIDifficulty}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
