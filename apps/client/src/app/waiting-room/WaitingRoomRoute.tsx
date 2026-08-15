import { useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from '@dabb/rn-compat';
import { useNavigate, useParams } from 'react-router-dom';
import WaitingRoomScreen from '../../components/ui/WaitingRoomScreen.js';
import { AI_NAMES, availableAINames } from '@dabb/shared-types';
import type { PlayerIndex } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';
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
import { hashSecretId } from '../../firebase/secretId.js';
import { applyEvents, createStartGameEvents, createTerminateGameEvents } from '@dabb/game-logic';
import type { PlayerInfo } from '@dabb/game-logic';

type PlayerEntry = {
  nickname: string;
  connected: boolean;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
};

type StoredSession = {
  secretId: string;
  playerIndex: PlayerIndex;
  playerCount?: number;
};

export default function WaitingRoomRoute() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [credentials, setCredentials] = useState<StoredSession | null>(null);
  const [players, setPlayers] = useState<Map<PlayerIndex, PlayerEntry>>(new Map());
  const [isAddingAI, setIsAddingAI] = useState(false);
  const [selectedAIDifficulty, setSelectedAIDifficulty] = useState<AIDifficulty>('medium');
  const [sessionPlayerCount, setSessionPlayerCount] = useState(0);
  const [firebasePlayers, setFirebasePlayers] = useState<PlayerInfo[]>([]);

  useEffect(() => {
    if (!code) {
      navigate('/', { replace: true });
      return;
    }
    void (async () => {
      try {
        const sessionRaw = localStorage.getItem(`dabb-${code}`);
        const storedNickname = localStorage.getItem('dabb-nickname');
        const meta = await getSessionMeta(code);
        if (!sessionRaw || !meta) {
          navigate('/', { replace: true });
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
        navigate('/', { replace: true });
      }
    })();
  }, [code, navigate]);

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
      Object.entries(fbPlayers).forEach(([idx, p]) => {
        newMap.set(Number(idx) as PlayerIndex, {
          nickname: p.nickname,
          connected: true,
          isAI: p.isAI,
          ...(p.aiDifficulty ? { aiDifficulty: p.aiDifficulty } : {}),
        });
      });
      setPlayers(newMap);
    });

    const unsubStatus = subscribeToSessionStatus(code, (status) => {
      if (status === 'active') {
        navigate(`/game/${code}`, { replace: true });
      } else if (status === 'terminated') {
        navigate('/', { replace: true });
      }
    });

    return () => {
      cleanupPresence();
      unsubPlayers();
      unsubStatus();
    };
  }, [code, credentials, navigate]);

  if (!credentials) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const { playerIndex, playerCount, secretId: credentialsSecretId } = credentials;
  const isHost = playerIndex === 0;

  const handleStartGame = async () => {
    if (!code) {
      return;
    }
    try {
      const secretHash = await hashSecretId(credentialsSecretId);
      const meta = await getSessionMeta(code);
      if (!meta) {
        return;
      }

      let seq = 0;
      const next = () => ({ sessionId: code, sequence: ++seq });

      const events = createStartGameEvents(
        next,
        firebasePlayers,
        meta.playerCount,
        meta.targetScore
      );
      await pushEvents(code, events, secretHash);
      await setSessionStatus(code, 'active');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to start game');
    }
  };

  const handleLeave = async () => {
    if (!code || !credentials) {
      return;
    }
    try {
      const secretHash = await hashSecretId(credentialsSecretId);
      const meta = await getSessionMeta(code);
      if (meta && meta.status === 'active') {
        let n = 0;
        const termEvents = createTerminateGameEvents(applyEvents([]), playerIndex, () => ({
          sessionId: code,
          sequence: ++n,
        }));
        await pushEvents(code, termEvents, secretHash);
      }
    } catch {
      // Ignore errors on leave
    }
    localStorage.removeItem(`dabb-${code}`);
    navigate('/', { replace: true });
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
      // Picked against the table rather than a running counter: the counter was module
      // state, so it kept climbing across sessions and could hand out the same name twice.
      const taken = Object.values(meta.players).map((p) => p.nickname);
      const aiName = availableAINames(taken)[0] ?? AI_NAMES[0];
      await addAIPlayer(code, meta.players, meta.playerCount, aiName, selectedAIDifficulty);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to add AI player');
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
      window.alert(err instanceof Error ? err.message : 'Failed to remove AI player');
    }
  };

  return (
    <WaitingRoomScreen
      sessionCode={code ?? ''}
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
