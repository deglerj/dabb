/**
 * Dabb - Binokel Card Game Mobile App
 */

import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text, Alert } from 'react-native';
import type { PlayerIndex, GameEvent, PlayerCount, Suit } from '@dabb/shared-types';
import { HomeScreen, WaitingRoomScreen, GameScreen } from './src/screens';
import { useSessionCredentials } from './src/hooks/useAsyncStorage';
import { useSocket } from './src/hooks/useSocket';
import { useGameState } from './src/hooks/useGameState';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';

type AppScreen = 'loading' | 'home' | 'waiting' | 'game';

interface SessionInfo {
  sessionId: string;
  sessionCode: string;
  playerIndex: PlayerIndex;
  playerCount: PlayerCount;
  isHost: boolean;
}

export default function App() {
  const {
    credentials,
    setCredentials,
    clearCredentials,
    loading: credentialsLoading,
  } = useSessionCredentials();
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [players, setPlayers] = useState<
    Map<PlayerIndex, { nickname: string; connected: boolean }>
  >(new Map());
  const [nicknames, setNicknames] = useState<Map<PlayerIndex, string>>(new Map());
  const [apiLoading, setApiLoading] = useState(false);

  const {
    state,
    applyEvents,
    reset: resetGameState,
  } = useGameState({
    playerCount: sessionInfo?.playerCount || 4,
    playerIndex: sessionInfo?.playerIndex || 0,
  });

  const handleEvents = useCallback(
    (events: GameEvent[]) => {
      applyEvents(events);

      // Check if game started
      const gameStarted = events.some((e) => e.type === 'GAME_STARTED');
      if (gameStarted) {
        setScreen('game');
      }
    },
    [applyEvents]
  );

  const handlePlayerJoined = useCallback((playerIndex: number, nickname: string) => {
    setPlayers((prev) => {
      const updated = new Map(prev);
      updated.set(playerIndex as PlayerIndex, { nickname, connected: true });
      return updated;
    });
    setNicknames((prev) => {
      const updated = new Map(prev);
      updated.set(playerIndex as PlayerIndex, nickname);
      return updated;
    });
  }, []);

  const handlePlayerLeft = useCallback((playerIndex: number) => {
    setPlayers((prev) => {
      const updated = new Map(prev);
      const player = updated.get(playerIndex as PlayerIndex);
      if (player) {
        updated.set(playerIndex as PlayerIndex, { ...player, connected: false });
      }
      return updated;
    });
  }, []);

  const handlePlayerReconnected = useCallback((playerIndex: number) => {
    setPlayers((prev) => {
      const updated = new Map(prev);
      const player = updated.get(playerIndex as PlayerIndex);
      if (player) {
        updated.set(playerIndex as PlayerIndex, { ...player, connected: true });
      }
      return updated;
    });
  }, []);

  const {
    socket: _socket,
    connected: _connected,
    emit,
  } = useSocket({
    serverUrl: SERVER_URL,
    sessionId: sessionInfo?.sessionId || '',
    secretId: credentials?.secretId || '',
    onEvents: handleEvents,
    onPlayerJoined: handlePlayerJoined,
    onPlayerLeft: handlePlayerLeft,
    onPlayerReconnected: handlePlayerReconnected,
  });

  // Initialize app screen based on credentials
  useEffect(() => {
    if (!credentialsLoading) {
      if (credentials && sessionInfo) {
        setScreen('waiting');
      } else {
        setScreen('home');
      }
    }
  }, [credentialsLoading, credentials, sessionInfo]);

  const handleCreateGame = async (nickname: string, playerCount: 2 | 3 | 4) => {
    setApiLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount }),
      });

      if (!response.ok) {
        throw new Error('Failed to create game');
      }

      const { sessionId, code } = await response.json();

      // Join the game
      const joinResponse = await fetch(`${SERVER_URL}/sessions/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });

      if (!joinResponse.ok) {
        throw new Error('Failed to join game');
      }

      const { secretId, playerIndex } = await joinResponse.json();

      await setCredentials({ secretId, sessionId, nickname });
      setSessionInfo({
        sessionId,
        sessionCode: code,
        playerIndex,
        playerCount,
        isHost: true,
      });

      // Add self to players
      setPlayers(new Map([[playerIndex as PlayerIndex, { nickname, connected: true }]]));
      setNicknames(new Map([[playerIndex as PlayerIndex, nickname]]));

      setScreen('waiting');
    } catch (_error) {
      Alert.alert('Fehler', 'Spiel konnte nicht erstellt werden');
    } finally {
      setApiLoading(false);
    }
  };

  const handleJoinGame = async (sessionCode: string, nickname: string) => {
    setApiLoading(true);
    try {
      // Get session info
      const infoResponse = await fetch(`${SERVER_URL}/sessions/${sessionCode}`);
      if (!infoResponse.ok) {
        throw new Error('Game not found');
      }

      const { playerCount } = await infoResponse.json();

      // Join the game
      const joinResponse = await fetch(`${SERVER_URL}/sessions/${sessionCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });

      if (!joinResponse.ok) {
        throw new Error('Failed to join game');
      }

      const { secretId, playerIndex, sessionId } = await joinResponse.json();

      await setCredentials({ secretId, sessionId, nickname });
      setSessionInfo({
        sessionId,
        sessionCode,
        playerIndex,
        playerCount,
        isHost: false,
      });

      setScreen('waiting');
    } catch (_error) {
      Alert.alert('Fehler', 'Spiel konnte nicht beigetreten werden');
    } finally {
      setApiLoading(false);
    }
  };

  const handleStartGame = () => {
    emit?.('game:start');
  };

  const handleLeave = async () => {
    await clearCredentials();
    setSessionInfo(null);
    setPlayers(new Map());
    setNicknames(new Map());
    resetGameState();
    setScreen('home');
  };

  const handleBid = (amount: number) => {
    emit?.('game:bid', { amount });
  };

  const handlePass = () => {
    emit?.('game:pass');
  };

  const handleDeclareTrump = (suit: Suit) => {
    emit?.('game:declareTrump', { suit });
  };

  const handlePlayCard = (cardId: string) => {
    emit?.('game:playCard', { cardId });
  };

  if (screen === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Laden...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (screen === 'home') {
    return (
      <>
        <HomeScreen
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          loading={apiLoading}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  if (screen === 'waiting' && sessionInfo) {
    return (
      <>
        <WaitingRoomScreen
          sessionCode={sessionInfo.sessionCode}
          players={players}
          playerCount={sessionInfo.playerCount}
          isHost={sessionInfo.isHost}
          onStartGame={handleStartGame}
          onLeave={handleLeave}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  if (screen === 'game' && sessionInfo) {
    return (
      <>
        <GameScreen
          state={state}
          playerIndex={sessionInfo.playerIndex}
          nicknames={nicknames}
          onBid={handleBid}
          onPass={handlePass}
          onDeclareTrump={handleDeclareTrump}
          onPlayCard={handlePlayCard}
        />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <View style={styles.loadingContainer}>
      <Text>Etwas ist schiefgelaufen</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
});
