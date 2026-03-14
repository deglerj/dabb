import React, { useState, useCallback } from 'react';
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
  const router = useRouter();
  const playerIndex = parseInt(piStr ?? '0', 10) as PlayerIndex;
  // playerCount=0 means unknown (joiner) — WaitingRoomScreen handles 0 gracefully
  const playerCount = parseInt(pcStr ?? '0', 10);

  const [players, setPlayers] = useState<Map<PlayerIndex, PlayerEntry>>(new Map());

  // useSocket only provides (playerIndex, nickname) — isAI/difficulty not available via socket events
  const handlePlayerJoined = useCallback((idx: number, nickname: string) => {
    setPlayers((prev) => {
      const next = new Map(prev);
      next.set(idx as PlayerIndex, { nickname, connected: true, isAI: false });
      return next;
    });
  }, []);

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

  const handleEvents = useCallback(
    (events: GameEvent[]) => {
      const started = events.some((e) => e.type === 'GAME_STARTED');
      if (started) {
        router.replace({
          pathname: '/game/[id]',
          params: { id: sessionId, secretId, playerIndex: piStr },
        });
      }
    },
    [router, sessionId, secretId, piStr]
  );

  const { emit } = useSocket({
    serverUrl: SERVER_URL,
    sessionId: sessionId ?? '',
    secretId: secretId ?? '',
    onEvents: handleEvents,
    onPlayerJoined: handlePlayerJoined,
    onPlayerLeft: handlePlayerLeft,
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

  return (
    <WaitingRoomScreen
      sessionCode={sessionCode ?? ''}
      players={players}
      playerCount={playerCount}
      isHost={isHost}
      onStartGame={handleStartGame}
      onLeave={handleLeave}
    />
  );
}
