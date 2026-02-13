/**
 * Dabb - Binokel Card Game Mobile App
 */

import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, Text, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlayerIndex, GameEvent, PlayerCount, Suit, CardId } from '@dabb/shared-types';
import { detectMelds } from '@dabb/game-logic';
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
    Map<PlayerIndex, { nickname: string; connected: boolean; isAI: boolean }>
  >(new Map());
  const [isAddingAI, setIsAddingAI] = useState(false);
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

  const handlePlayerJoined = useCallback(
    (playerIndex: number, nickname: string, isAI: boolean = false) => {
      setPlayers((prev) => {
        const updated = new Map(prev);
        updated.set(playerIndex as PlayerIndex, { nickname, connected: true, isAI });
        return updated;
      });
      setNicknames((prev) => {
        const updated = new Map(prev);
        updated.set(playerIndex as PlayerIndex, nickname);
        return updated;
      });
    },
    []
  );

  const handlePlayerLeft = useCallback((playerIndex: number) => {
    setPlayers((prev) => {
      const updated = new Map(prev);
      // For AI players being removed, delete them; for humans, mark as disconnected
      const player = updated.get(playerIndex as PlayerIndex);
      if (player) {
        if (player.isAI) {
          updated.delete(playerIndex as PlayerIndex);
        } else {
          updated.set(playerIndex as PlayerIndex, { ...player, connected: false });
        }
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
    sessionId: sessionInfo?.sessionCode || '',
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
        body: JSON.stringify({ playerCount, nickname: nickname.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create game');
      }

      const { sessionId, sessionCode, secretId, playerIndex } = await response.json();

      await setCredentials({ secretId, sessionId, nickname });
      setSessionInfo({
        sessionId,
        sessionCode,
        playerIndex,
        playerCount,
        isHost: true,
      });

      // Add self to players
      setPlayers(
        new Map([[playerIndex as PlayerIndex, { nickname, connected: true, isAI: false }]])
      );
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

  const handleAddAI = async () => {
    if (!sessionInfo || !credentials || isAddingAI) {
      return;
    }

    setIsAddingAI(true);
    try {
      const response = await fetch(`${SERVER_URL}/sessions/${sessionInfo.sessionCode}/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Id': credentials.secretId,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        Alert.alert(t('common.error'), data.error || 'Failed to add AI player');
        return;
      }

      const { playerIndex, nickname } = await response.json();
      handlePlayerJoined(playerIndex, nickname, true);
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : 'Failed to add AI player'
      );
    } finally {
      setIsAddingAI(false);
    }
  };

  const handleRemoveAI = async (playerIndex: PlayerIndex) => {
    if (!sessionInfo || !credentials) {
      return;
    }

    try {
      const response = await fetch(
        `${SERVER_URL}/sessions/${sessionInfo.sessionCode}/ai/${playerIndex}`,
        {
          method: 'DELETE',
          headers: {
            'X-Secret-Id': credentials.secretId,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        Alert.alert(t('common.error'), data.error || 'Failed to remove AI player');
        return;
      }

      // Remove player from local state
      setPlayers((prev) => {
        const updated = new Map(prev);
        updated.delete(playerIndex);
        return updated;
      });
      setNicknames((prev) => {
        const updated = new Map(prev);
        updated.delete(playerIndex);
        return updated;
      });
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : 'Failed to remove AI player'
      );
    }
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

  const handleTakeDabb = () => {
    emit?.('game:takeDabb');
  };

  const handleDiscard = (cardIds: CardId[]) => {
    emit?.('game:discard', { cardIds });
  };

  const handleGoOut = (suit: Suit) => {
    emit?.('game:goOut', { suit });
  };

  const handleDeclareMelds = () => {
    if (!state.trump || !sessionInfo) {
      return;
    }
    const myHand = state.hands.get(sessionInfo.playerIndex) || [];
    const melds = detectMelds(myHand, state.trump);
    emit?.('game:declareMelds', { melds });
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
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (screen === 'home') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <HomeScreen
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          loading={apiLoading}
        />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (screen === 'waiting' && sessionInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <WaitingRoomScreen
          sessionCode={sessionInfo.sessionCode}
          players={players}
          playerCount={sessionInfo.playerCount}
          isHost={sessionInfo.isHost}
          onStartGame={handleStartGame}
          onLeave={handleLeave}
          onAddAI={handleAddAI}
          onRemoveAI={handleRemoveAI}
          isAddingAI={isAddingAI}
        />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (screen === 'game' && sessionInfo) {
    return (
      <SafeAreaView style={styles.gameSafeArea}>
        <GameScreen
          state={state}
          events={events}
          playerIndex={sessionInfo.playerIndex}
          nicknames={nicknames}
          onBid={handleBid}
          onPass={handlePass}
          onTakeDabb={handleTakeDabb}
          onDiscard={handleDiscard}
          onGoOut={handleGoOut}
          onDeclareTrump={handleDeclareTrump}
          onDeclareMelds={handleDeclareMelds}
          onPlayCard={handlePlayCard}
          onExitGame={handleExitGame}
          onGoHome={handleLeave}
        />
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.loadingContainer}>
      <Text>{t('errors.somethingWentWrong')}</Text>
      <StatusBar style="auto" />
    </SafeAreaView>
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
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  gameSafeArea: {
    flex: 1,
    backgroundColor: '#0f766e',
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
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <StatusBar style="auto" />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider initialLanguage={initialLanguage}>
          <AppContent />
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
