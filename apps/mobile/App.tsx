/**
 * Dabb - Binokel Card Game Mobile App
 */

import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, IMFellEnglishSC_400Regular } from '@expo-google-fonts/im-fell-english-sc';
import { Caveat_400Regular, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import { Alert } from 'react-native';
import type {
  AIDifficulty,
  PlayerIndex,
  GameEvent,
  PlayerCount,
  Suit,
  CardId,
} from '@dabb/shared-types';
import { detectMelds } from '@dabb/game-logic';
import {
  I18nProvider,
  setStorageAdapter,
  detectLanguageAsync,
  useTranslation,
  type SupportedLanguage,
} from '@dabb/i18n';
import { HomeScreen, WaitingRoomScreen, GameScreen, UpdateRequiredScreen } from './src/screens';
import { useSessionCredentials } from './src/hooks/useAsyncStorage';
import { useSocket } from './src/hooks/useSocket';
import { useGameState } from './src/hooks/useGameState';
import { Colors, Fonts } from './src/theme';

// Prevent splash screen from auto-hiding until fonts are loaded
SplashScreen.preventAutoHideAsync();

// Set up AsyncStorage adapter for i18n
setStorageAdapter({
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
});

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'http://localhost:3000';
const UMAMI_URL = process.env.EXPO_PUBLIC_UMAMI_URL;
const UMAMI_WEBSITE_ID = process.env.EXPO_PUBLIC_UMAMI_WEBSITE_ID;

type AppScreen = 'loading' | 'home' | 'waiting' | 'game' | 'update-required';

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
    Map<
      PlayerIndex,
      { nickname: string; connected: boolean; isAI: boolean; aiDifficulty?: AIDifficulty }
    >
  >(new Map());
  const [isAddingAI, setIsAddingAI] = useState(false);
  const [addAIDifficulty, setAddAIDifficulty] = useState<AIDifficulty>('medium');
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
    (playerIndex: number, nickname: string, isAI: boolean = false, aiDifficulty?: AIDifficulty) => {
      setPlayers((prev) => {
        const updated = new Map(prev);
        updated.set(playerIndex as PlayerIndex, { nickname, connected: true, isAI, aiDifficulty });
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

  // Initialize app screen based on credentials + version check
  useEffect(() => {
    if (!credentialsLoading) {
      const appVersion = Constants.expoConfig?.version ?? '0.0.0';
      fetch(`${SERVER_URL}/api/version`)
        .then((res) => res.json() as Promise<{ version: string }>)
        .then(({ version: serverVersion }) => {
          const clientMajor = parseInt(appVersion.split('.')[0], 10);
          const serverMajor = parseInt(serverVersion.split('.')[0], 10);
          if (serverMajor > clientMajor) {
            setScreen('update-required');
            return;
          }
          setScreen(credentials && sessionInfo ? 'waiting' : 'home');
        })
        .catch(() => {
          // Version check failed — proceed normally
          setScreen(credentials && sessionInfo ? 'waiting' : 'home');
        });
    }
  }, [credentialsLoading, credentials, sessionInfo]);

  const handleCreateGame = async (nickname: string, playerCount: 2 | 3 | 4) => {
    setApiLoading(true);
    try {
      const response = await fetch(`${SERVER_URL}/api/sessions`, {
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
      const infoResponse = await fetch(`${SERVER_URL}/api/sessions/${sessionCode}`);
      if (!infoResponse.ok) {
        throw new Error('Game not found');
      }

      const { playerCount } = await infoResponse.json();

      // Join the game
      const joinResponse = await fetch(`${SERVER_URL}/api/sessions/${sessionCode}/join`, {
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
      const response = await fetch(`${SERVER_URL}/api/sessions/${sessionInfo.sessionCode}/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-Id': credentials.secretId,
        },
        body: JSON.stringify({ difficulty: addAIDifficulty }),
      });

      if (!response.ok) {
        const data = await response.json();
        Alert.alert(t('common.error'), data.error || 'Failed to add AI player');
        return;
      }

      const { playerIndex, nickname, aiDifficulty } = await response.json();
      handlePlayerJoined(playerIndex, nickname, true, aiDifficulty as AIDifficulty | undefined);
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
        `${SERVER_URL}/api/sessions/${sessionInfo.sessionCode}/ai/${playerIndex}`,
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
        <ActivityIndicator size="large" color={Colors.amber} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (screen === 'update-required') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <UpdateRequiredScreen />
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  if (screen === 'home') {
    return (
      <View style={styles.safeArea}>
        <HomeScreen
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          loading={apiLoading}
        />
        <StatusBar style="dark" />
      </View>
    );
  }

  if (screen === 'waiting' && sessionInfo) {
    return (
      <View style={styles.safeArea}>
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
          selectedAIDifficulty={addAIDifficulty}
          onSelectAIDifficulty={setAddAIDifficulty}
        />
        <StatusBar style="dark" />
      </View>
    );
  }

  if (screen === 'game' && sessionInfo) {
    return (
      <View style={styles.gameSafeArea}>
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
      </View>
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
    backgroundColor: Colors.paperAged,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.inkFaint,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.woodMid,
  },
  gameSafeArea: {
    flex: 1,
    backgroundColor: Colors.woodDark,
  },
});

export default function App() {
  const [initialLanguage, setInitialLanguage] = useState<SupportedLanguage | undefined>(undefined);
  const [languageLoading, setLanguageLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    IMFellEnglishSC_400Regular,
    Caveat_400Regular,
    Caveat_700Bold,
    Lato_400Regular,
    Lato_700Bold,
  });

  useEffect(() => {
    detectLanguageAsync().then((lang) => {
      setInitialLanguage(lang);
      setLanguageLoading(false);
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded && !languageLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, languageLoading]);

  useEffect(() => {
    if (!UMAMI_URL || !UMAMI_WEBSITE_ID) {
      return;
    }
    fetch(`${UMAMI_URL}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'pageview',
        payload: { website: UMAMI_WEBSITE_ID, url: '/', hostname: 'dabb-mobile' },
      }),
    }).catch(() => {
      // Analytics failure is non-critical
    });
  }, []);

  if (!fontsLoaded || languageLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SafeAreaView
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: Colors.paperAged,
            }}
          >
            <ActivityIndicator size="large" color={Colors.amber} />
            <StatusBar style="dark" />
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
