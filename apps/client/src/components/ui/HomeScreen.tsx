/**
 * Home screen — create or join a game session.
 * Ported from apps/web/src/pages/HomePage.tsx.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@dabb/i18n';
import type { PlayerCount } from '@dabb/shared-types';
import { Colors, Fonts } from '../../theme.js';
import { storageGet, storageSet } from '../../hooks/useStorage.js';
import { createSession, joinSession } from '../../utils/api.js';
import { APP_VERSION } from '../../constants.js';
import { OptionsButton } from './OptionsButton.js';

type Mode = 'menu' | 'create' | 'join';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('menu');
  const [nickname, setNickname] = useState('');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  // Restore nickname from storage on mount
  useEffect(() => {
    storageGet('dabb-nickname')
      .then((saved) => {
        if (saved) {
          setNickname(saved);
        }
      })
      .catch(() => undefined);
  }, []);

  const handleCreate = async () => {
    if (!nickname.trim()) {
      setError(t('errors.enterNickname'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sessionData = await createSession(nickname.trim(), playerCount);

      await storageSet(
        `dabb-${sessionData.sessionCode}`,
        JSON.stringify({
          secretId: sessionData.secretId,
          playerId: sessionData.playerId,
          playerIndex: sessionData.playerIndex,
        })
      );
      await storageSet('dabb-nickname', nickname.trim());

      router.push({
        pathname: '/waiting-room/[id]',
        params: {
          id: sessionData.sessionId,
          code: sessionData.sessionCode,
          secretId: sessionData.secretId,
          playerIndex: String(sessionData.playerIndex),
          playerCount: String(playerCount),
          nickname: nickname.trim(),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) {
      setError(t('errors.enterNickname'));
      return;
    }
    if (!joinCode.trim()) {
      setError(t('errors.enterGameCode'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sessionData = await joinSession(joinCode.trim(), nickname.trim());

      await storageSet(
        `dabb-${joinCode.trim().toUpperCase()}`,
        JSON.stringify({
          secretId: sessionData.secretId,
          playerId: sessionData.playerId,
          playerIndex: sessionData.playerIndex,
        })
      );
      await storageSet('dabb-nickname', nickname.trim());

      router.push({
        pathname: '/waiting-room/[id]',
        params: {
          id: sessionData.sessionId,
          code: joinCode.trim().toUpperCase(),
          secretId: sessionData.secretId,
          playerIndex: String(sessionData.playerIndex),
          playerCount: '0', // unknown for joiners; waiting room discovers it from socket events
          nickname: nickname.trim(),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'menu') {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('home.title')}</Text>
            <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

            <View style={styles.buttonGroup}>
              <TouchableOpacity style={styles.buttonPrimary} onPress={() => setMode('create')}>
                <Text style={styles.buttonPrimaryText}>{t('home.createGame')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.buttonSecondary} onPress={() => setMode('join')}>
                <Text style={styles.buttonSecondaryText}>{t('home.joinGame')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.version}>v{APP_VERSION}</Text>
          </View>
        </ScrollView>
        <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
          <OptionsButton />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.heading}>
            {mode === 'create' ? t('home.newGame') : t('home.joinGame')}
          </Text>

          {/* Nickname field */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('home.nickname')}</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('home.nicknamePlaceholder')}
              placeholderTextColor={Colors.inkFaint}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Player count (create only) — always mounted, hidden via opacity per CLAUDE.md rule 2 */}
          <View
            style={[styles.formGroup, { opacity: mode === 'create' ? 1 : 0 }]}
            pointerEvents={mode === 'create' ? 'auto' : 'none'}
          >
            <Text style={styles.label}>{t('home.playerCount')}</Text>
            <View style={styles.playerCountRow}>
              {([2, 3, 4] as PlayerCount[]).map((count) => (
                <TouchableOpacity
                  key={count}
                  style={[
                    styles.countButton,
                    playerCount === count ? styles.countButtonActive : styles.countButtonInactive,
                  ]}
                  onPress={() => setPlayerCount(count)}
                >
                  <Text
                    style={
                      playerCount === count
                        ? styles.countButtonTextActive
                        : styles.countButtonTextInactive
                    }
                  >
                    {count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Join code (join only) — always mounted, hidden via opacity per CLAUDE.md rule 2 */}
          <View
            style={[styles.formGroup, { opacity: mode === 'join' ? 1 : 0 }]}
            pointerEvents={mode === 'join' ? 'auto' : 'none'}
          >
            <Text style={styles.label}>{t('home.gameCode')}</Text>
            <TextInput
              style={styles.input}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder={t('home.gameCodePlaceholder')}
              placeholderTextColor={Colors.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Error message — always present in layout, hidden when empty */}
          <Text style={[styles.errorText, { opacity: error ? 1 : 0 }]}>{error || ' '}</Text>

          {/* Action row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.buttonSecondarySmall} onPress={() => setMode('menu')}>
              <Text style={styles.buttonSecondaryText}>{t('common.back')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.buttonPrimary, styles.flex1, loading && styles.buttonDisabled]}
              onPress={mode === 'create' ? handleCreate : handleJoin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.paperFace} />
              ) : (
                <Text style={styles.buttonPrimaryText}>
                  {mode === 'create' ? t('home.create') : t('home.join')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
        <OptionsButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.woodDark,
  },
  optionsButtonContainer: {
    position: 'absolute',
    right: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Colors.woodDark,
  },
  card: {
    backgroundColor: Colors.paperFace,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#3c1e0a',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 36,
    color: Colors.inkDark,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.inkMid,
    textAlign: 'center',
    marginBottom: 32,
  },
  heading: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.inkDark,
    marginBottom: 20,
  },
  buttonGroup: {
    gap: 12,
  },
  buttonPrimary: {
    backgroundColor: Colors.amber,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.paperFace,
  },
  buttonSecondary: {
    backgroundColor: Colors.paperAged,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.woodMid,
  },
  buttonSecondarySmall: {
    backgroundColor: Colors.paperAged,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.woodMid,
  },
  buttonSecondaryText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.inkMid,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontFamily: Fonts.bodyBold,
    fontSize: 14,
    color: Colors.inkMid,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.inkDark,
    backgroundColor: Colors.paperAged,
  },
  playerCountRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  countButtonActive: {
    backgroundColor: Colors.amber,
    borderColor: Colors.amber,
  },
  countButtonInactive: {
    backgroundColor: Colors.paperAged,
    borderColor: Colors.woodMid,
  },
  countButtonTextActive: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.paperFace,
  },
  countButtonTextInactive: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.inkMid,
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.error,
    marginBottom: 8,
    minHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  flex1: {
    flex: 1,
  },
  version: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
    textAlign: 'center',
    marginTop: 24,
  },
});
