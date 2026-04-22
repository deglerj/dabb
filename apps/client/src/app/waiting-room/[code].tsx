import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import WaitingRoomScreen from '../../components/ui/WaitingRoomScreen.js';
import { storageDelete, storageGet } from '../../hooks/useStorage.js';
import type { PlayerIndex, AIDifficulty } from '@dabb/shared-types';
import {
  subscribeToPlayers,
  subscribeToSessionStatus,
  addAIPlayer,
  removeAIPlayer,
  getSessionMeta,
  setupPresence,
  setSessionStatus,
} from '../../firebase/session.js';
import { pushEvents } from '../../firebase/events.js';
import { getOrCreateSecretId, hashSecretId } from '../../firebase/secretId.js';
import {
  createStartGameEvents,
  createTerminateGameEvents,
} from '../../firebase/gameEventFactory.js';
import type { PlayerInfo } from '../../firebase/gameEventFactory.js';
import { applyEvents } from '@dabb/game-logic';

type PlayerEntry = {
  nickname: string;
  connected: boolean;
  isAI: boolean;
};

type StoredSession = {
  secretId: string;
  playerIndex: PlayerIndex;
  playerCount?: number;
};

const AI_NAMES = ['Bot Fritz', 'Bot Hilde', 'Bot Klaus', 'Bot Liesel'];
let aiNameIndex = 0;

export default function WaitingRoomRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const [credentials, setCredentials] = useState<StoredSession | null>(null);
  const [players, setPlayers] = useState<Map<PlayerIndex, PlayerEntry>>(new Map());
  const [isAddingAI, setIsAddingAI] = useState(false);
  const [selectedAIDifficulty, setSelectedAIDifficulty] = useState<AIDifficulty>('medium');
  const [sessionPlayerCount, setSessionPlayerCount] = useState(0);
  const [firebasePlayers, setFirebasePlayers] = useState<PlayerInfo[]>([]);

  useEffect(() => {
    if (!code) {
      router.replace('/');
      return;
    }
    void (async () => {
      try {
        const [sessionRaw, storedNickname, meta] = await Promise.all([
          storageGet(`dabb-${code}`),
          storageGet('dabb-nickname'),
          getSessionMeta(code),
        ]);
        if (!sessionRaw || !meta) {
          router.replace('/');
          return;
        }
        const session = JSON.parse(sessionRaw) as StoredSession;
        setCredentials(session);
        setSessionPlayerCount(meta.playerCount);

        setPlayers(
          new Map([
            [session.playerIndex, { nickname: storedNickname ?? '', connected: true, isAI: false }],
          ])
        );
      } catch {
        router.replace('/');
      }
    })();
  }, [code, router]);

  useEffect(() => {
    if (!code || !credentials) {
      return;
    }
    const cleanupPresence = setupPresence(code, credentials.playerIndex);

    const unsubPlayers = subscribeToPlayers(code, (fbPlayers) => {
      const infos: PlayerInfo[] = Object.entries(fbPlayers).map(([idx, p]) => ({
        playerIndex: Number(idx) as PlayerIndex,
        nickname: p.nickname,
        isAI: p.isAI,
        team: null,
      }));
      setFirebasePlayers(infos);

      const newMap = new Map<PlayerIndex, PlayerEntry>();
      infos.forEach((p) => {
        newMap.set(p.playerIndex, { nickname: p.nickname, connected: true, isAI: p.isAI });
      });
      setPlayers(newMap);
    });

    const unsubStatus = subscribeToSessionStatus(code, (status) => {
      if (status === 'active') {
        router.replace({ pathname: '/game/[code]', params: { code } });
      } else if (status === 'terminated') {
        router.replace('/');
      }
    });

    return () => {
      cleanupPresence();
      unsubPlayers();
      unsubStatus();
    };
  }, [code, credentials, router]);

  if (!credentials) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const { playerIndex, playerCount } = credentials;
  const isHost = playerIndex === 0;

  const handleStartGame = async () => {
    if (!code) {
      return;
    }
    try {
      const secretId = await getOrCreateSecretId(code);
      const secretHash = await hashSecretId(secretId);
      const meta = await getSessionMeta(code);
      if (!meta) {
        return;
      }

      let seq = 0;
      const seqGen = () => ++seq;

      const events = createStartGameEvents(
        code,
        seqGen,
        firebasePlayers,
        meta.playerCount,
        meta.targetScore
      );
      await pushEvents(code, events, secretHash);
      await setSessionStatus(code, 'active');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to start game');
    }
  };

  const handleLeave = async () => {
    if (!code || !credentials) {
      return;
    }
    try {
      const secretId = await getOrCreateSecretId(code);
      const secretHash = await hashSecretId(secretId);
      const meta = await getSessionMeta(code);
      if (meta && meta.status === 'active') {
        const emptyState = applyEvents([]);
        const termEvents = createTerminateGameEvents(
          code,
          (() => {
            let n = 0;
            return () => ++n;
          })(),
          emptyState,
          playerIndex
        );
        await pushEvents(code, termEvents, secretHash);
      }
    } catch {
      // Ignore errors on leave
    }
    await storageDelete(`dabb-${code}`);
    router.replace('/');
  };

  const handleAddAI = async () => {
    if (!code || isAddingAI) {
      return;
    }
    setIsAddingAI(true);
    try {
      const meta = await getSessionMeta(code);
      if (!meta) {
        return;
      }
      const aiName = AI_NAMES[aiNameIndex % AI_NAMES.length];
      aiNameIndex++;
      await addAIPlayer(code, meta.players, meta.playerCount, aiName);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add AI player');
    } finally {
      setIsAddingAI(false);
    }
  };

  const handleRemoveAI = async (playerIdx: PlayerIndex) => {
    if (!code) {
      return;
    }
    try {
      await removeAIPlayer(code, playerIdx);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove AI player');
    }
  };

  return (
    <WaitingRoomScreen
      sessionCode={code}
      players={players}
      playerCount={sessionPlayerCount || (playerCount ?? 0)}
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
