import React, { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSocket } from '@dabb/ui-shared';
import WaitingRoomScreen from '../../components/ui/WaitingRoomScreen.js';
import { storageDelete } from '../../hooks/useStorage.js';
import { SERVER_URL } from '../../constants.js';
import type { PlayerIndex, AIDifficulty, GameEvent } from '@dabb/shared-types';

type PlayerEntry = {
  nickname: string;
  connected: boolean;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
};

export default function WaitingRoomRoute() {
  const params = useLocalSearchParams();
  const sessionId = params['id'] as string | undefined;
  const sessionCode = params['code'] as string | undefined;
  const secretId = params['secretId'] as string | undefined;
  const piStr = params['playerIndex'] as string | undefined;
  const pcStr = params['playerCount'] as string | undefined;
  const ownNickname = params['nickname'] as string | undefined;
  const router = useRouter();
  const playerIndex = parseInt(piStr ?? '0', 10) as PlayerIndex;
  // playerCount=0 means unknown (joiner) — WaitingRoomScreen handles 0 gracefully
  const playerCount = parseInt(pcStr ?? '0', 10);

  // Seed own player immediately — the server emits player:joined only to *other* sockets,
  // so we'd never receive our own join event.
  const [players, setPlayers] = useState<Map<PlayerIndex, PlayerEntry>>(() => {
    const m = new Map<PlayerIndex, PlayerEntry>();
    if (ownNickname) {
      m.set(playerIndex, { nickname: ownNickname, connected: true, isAI: false });
    }
    return m;
  });
  const [isAddingAI, setIsAddingAI] = useState(false);
  const [selectedAIDifficulty, setSelectedAIDifficulty] = useState<AIDifficulty>('medium');

  const handlePlayerJoined = useCallback(
    (idx: number, nickname: string, isAI = false, aiDifficulty?: AIDifficulty) => {
      setPlayers((prev) => {
        const next = new Map(prev);
        next.set(idx as PlayerIndex, { nickname, connected: true, isAI, aiDifficulty });
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
          pathname: '/game/[id]',
          params: { id: sessionId, code: sessionCode, secretId, playerIndex: piStr },
        });
      }
    },
    [router, sessionId, sessionCode, secretId, piStr]
  );

  // TODO: surface connection error to WaitingRoomScreen once it accepts a connectionError prop
  // Note: the server socket middleware expects the session *code* (e.g. "ABCD") in the sessionId
  // auth field, not the UUID. See apps/server/src/socket/handlers.ts middleware.
  const { emit, error: _connectionError } = useSocket({
    serverUrl: SERVER_URL,
    sessionId: sessionCode ?? '',
    secretId: secretId ?? '',
    onEvents: handleEvents,
    onPlayerJoined: handlePlayerJoined,
    onPlayerLeft: handlePlayerLeft,
    onPlayerReconnected: handlePlayerReconnected,
  });

  const isHost = playerIndex === 0;

  const handleStartGame = useCallback(() => {
    emit?.('game:start');
  }, [emit]);

  const handleLeave = useCallback(async () => {
    emit?.('game:exit');
    await storageDelete(`dabb-${sessionCode}`);
    router.replace('/');
  }, [emit, sessionCode, router]);

  const handleAddAI = useCallback(async () => {
    if (!sessionCode || !secretId || isAddingAI) {
      return;
    }
    setIsAddingAI(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/sessions/${sessionCode}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-Id': secretId },
        body: JSON.stringify({ difficulty: selectedAIDifficulty }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        Alert.alert('Error', data.error ?? 'Failed to add AI player');
        return;
      }
      const {
        playerIndex: idx,
        nickname,
        aiDifficulty,
      } = (await response.json()) as {
        playerIndex: number;
        nickname: string;
        aiDifficulty: AIDifficulty;
      };
      handlePlayerJoined(idx, nickname, true, aiDifficulty);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add AI player');
    } finally {
      setIsAddingAI(false);
    }
  }, [sessionCode, secretId, isAddingAI, selectedAIDifficulty, handlePlayerJoined]);

  const handleRemoveAI = useCallback(
    async (playerIdx: PlayerIndex) => {
      if (!sessionCode || !secretId) {
        return;
      }
      try {
        const response = await fetch(`${SERVER_URL}/api/sessions/${sessionCode}/ai/${playerIdx}`, {
          method: 'DELETE',
          headers: { 'X-Secret-Id': secretId },
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
    },
    [sessionCode, secretId]
  );

  return (
    <WaitingRoomScreen
      sessionCode={sessionCode ?? ''}
      players={players}
      playerCount={playerCount}
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
