/**
 * Dabb - Binokel Card Game Mobile App
 */

import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, ActivityIndicator, Text, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlayerIndex, GameEvent, PlayerCount, Suit } from '@dabb/shared-types';
import {
  I18nProvider,
  setStorageAdapter,
  detectLanguageAsync,
  useTranslation,
  type SupportedLanguage,
} from '@dabb/i18n';
import { HomeScreen, WaitingRoomScreen, GameScreen } from './src/screens';
import { useSessionCredentials } from './src/hooks/useAsyncStorage';
import { useSocket } from './src/hooks/useSocket';
import { useGameState } from './src/hooks/useGameState';

// Set up AsyncStorage adapter for i18n
setStorageAdapter({
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
});

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';

type AppScreen = 'loading' | 'home' | 'waiting' | 'game';

interface SessionInfo {
  sessionId: string;
  sessionCode: string;
  playerIndex: PlayerIndex;
  playerCount: PlayerCount;
  isHost: boolean;
}

function AppContent() {
  const { t } = useTranslation();
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
    events,
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

  const handleSessionTerminated = useCallback(
    (terminatedBy?: string) => {
      const message = terminatedBy
        ? t('game.gameTerminatedMessage', { name: terminatedBy })
        : t('game.gameTerminated');

      Alert.alert(t('game.gameTerminated'), message, [
        {
          text: t('game.backToHome'),
          onPress: async () => {
            await clearCredentials();
            setSessionInfo(null);
            setPlayers(new Map());
            setNicknames(new Map());
            resetGameState();
            setScreen('home');
          },
        },
      ]);
    },
    [t, clearCredentials, resetGameState]
  );

  const handleError = useCallback(
    (error: { code: string; params?: Record<string, string | number> }) => {
      // Translate error code to localized message
      const translatedError = t(`serverErrors.${error.code}` as const, error.params);
      Alert.alert(t('common.error'), translatedError);
    },
    [t]
  );

  const {
    socket: _socket,
    connected: _connected,
    emit,
  } = useSocket({
    serverUrl: SERVER_URL,
    sessionId: sessionInfo?.sessionId || '',
    secretId: credentials?.secretId || '',
    onEvents: handleEvents,
    onError: handleError,
    onPlayerJoined: handlePlayerJoined,
    onPlayerLeft: handlePlayerLeft,
    onPlayerReconnected: handlePlayerReconnected,
    onSessionTerminated: handleSessionTerminated,
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
      Alert.alert(t('common.error'), t('errors.createFailed'));
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
      Alert.alert(t('common.error'), t('errors.joinFailed'));
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

  const handleExitGame = () => {
    Alert.alert(t('game.exitGameConfirmTitle'), t('game.exitGameConfirmMessage'), [
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
      {
        text: t('game.exitGame'),
        style: 'destructive',
        onPress: () => {
          emit?.('game:exit');
        },
      },
    ]);
  };

  if (screen === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
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
          events={events}
          playerIndex={sessionInfo.playerIndex}
          nicknames={nicknames}
          onBid={handleBid}
          onPass={handlePass}
          onDeclareTrump={handleDeclareTrump}
          onPlayCard={handlePlayCard}
          onExitGame={handleExitGame}
          onGoHome={handleLeave}
        />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <View style={styles.loadingContainer}>
      <Text>{t('errors.somethingWentWrong')}</Text>
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

export default function App() {
  const [initialLanguage, setInitialLanguage] = useState<SupportedLanguage | undefined>(undefined);
  const [languageLoading, setLanguageLoading] = useState(true);

  useEffect(() => {
    detectLanguageAsync().then((lang) => {
      setInitialLanguage(lang);
      setLanguageLoading(false);
    });
  }, []);

  if (languageLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <I18nProvider initialLanguage={initialLanguage}>
      <AppContent />
    </I18nProvider>
  );
}
