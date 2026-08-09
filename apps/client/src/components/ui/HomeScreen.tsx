/**
 * Home screen — three entry points: offline vs AI, create online, join online.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  useSafeAreaInsets,
} from '@dabb/rn-compat';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@dabb/i18n';
import type { PlayerCount } from '@dabb/shared-types';
import { GameError } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';
import { Colors, Fonts } from '../../theme.js';
import { createSession, joinSession } from '../../firebase/session.js';
import { APP_VERSION } from '../../constants.js';
import { OptionsButton } from './OptionsButton.js';
import { Icon } from './Icon.js';
import { useInstallPrompt } from '../../hooks/useInstallPrompt.js';
import { InstallInstructionsDialog } from './InstallInstructionsDialog.js';

type Mode = 'menu' | 'create' | 'join' | 'offline';

/**
 * Session failures carry a GAME_ERROR_CODES value, which has a `serverErrors.*` translation.
 * Anything else is a bug rather than a rejected action, so it falls back to the generic text
 * instead of putting a raw exception message on screen.
 */
function sessionErrorText(err: unknown, t: (key: string) => string): string {
  if (err instanceof GameError) {
    return t(`serverErrors.${err.code}`);
  }
  return t('errors.unknownError');
}

type GamePhaseString = string;

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('menu');
  const [nickname, setNickname] = useState('');
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2);
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resumableGame, setResumableGame] = useState(false);
  const insets = useSafeAreaInsets();
  const { canInstall, promptInstall, instructionsPlatform } = useInstallPrompt();
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);

  // Restore nickname from storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('dabb-nickname');
    if (saved) {
      setNickname(saved);
    }
  }, []);

  // Check for a resumable offline game on mount
  useEffect(() => {
    const raw = localStorage.getItem('dabb-offline-game');
    if (!raw) {
      return;
    }
    try {
      const payload = JSON.parse(raw) as { phase?: GamePhaseString };
      const phase = payload.phase;
      if (phase && phase !== 'finished' && phase !== 'terminated') {
        setResumableGame(true);
      }
    } catch {
      // Corrupt storage — ignore
    }
  }, []);

  const handleCreate = async () => {
    if (!nickname.trim()) {
      setError(t('errors.enterNickname'));
      return;
    }
    if (nickname.trim().length > 10) {
      setError(t('errors.nicknameTooLong'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await createSession(nickname.trim(), playerCount);
      localStorage.setItem(
        `dabb-${result.sessionCode}`,
        JSON.stringify({
          secretId: result.secretId,
          playerIndex: result.playerIndex,
          playerCount,
        })
      );
      localStorage.setItem('dabb-nickname', nickname.trim());
      navigate(`/waiting-room/${result.sessionCode}`);
    } catch (err) {
      setError(sessionErrorText(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) {
      setError(t('errors.enterNickname'));
      return;
    }
    if (nickname.trim().length > 10) {
      setError(t('errors.nicknameTooLong'));
      return;
    }
    if (!joinCode.trim()) {
      setError(t('errors.enterGameCode'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await joinSession(joinCode.trim(), nickname.trim());
      const code = joinCode.trim().toLowerCase();
      localStorage.setItem(
        `dabb-${code}`,
        JSON.stringify({
          secretId: result.secretId,
          playerIndex: result.playerIndex,
        })
      );
      localStorage.setItem('dabb-nickname', nickname.trim());
      navigate(`/waiting-room/${code}`);
    } catch (err) {
      setError(sessionErrorText(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleStartOffline = async () => {
    if (!nickname.trim()) {
      setError(t('errors.enterNickname'));
      return;
    }
    if (nickname.trim().length > 10) {
      setError(t('errors.nicknameTooLong'));
      return;
    }
    localStorage.setItem('dabb-nickname', nickname.trim());
    const params = new URLSearchParams({
      playerCount: String(playerCount),
      difficulty,
      nickname: nickname.trim(),
      resume: 'false',
    });
    navigate(`/game/offline?${params.toString()}`);
  };

  const handleResume = () => {
    navigate('/game/offline?resume=true');
  };

  if (mode === 'menu') {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.title} testID="home-title">
              {t('home.title')}
            </Text>
            <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

            {resumableGame && (
              <TouchableOpacity
                style={[styles.buttonPrimary, styles.resumeButton]}
                onPress={handleResume}
              >
                <Text style={styles.buttonPrimaryText}>{t('home.resumeGame')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.buttonGroup}>
              <TouchableOpacity style={styles.buttonPrimary} onPress={() => setMode('offline')}>
                <Text style={styles.buttonPrimaryText}>{t('home.playOffline')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.buttonSecondary}
                onPress={() => setMode('create')}
                testID="home-create-online-button"
              >
                <Text style={styles.buttonSecondaryText}>{t('home.createOnline')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.buttonSecondary}
                onPress={() => setMode('join')}
                testID="home-join-online-button"
              >
                <Text style={styles.buttonSecondaryText}>{t('home.joinOnline')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.version}>v{APP_VERSION}</Text>
              {(canInstall || instructionsPlatform) && (
                <TouchableOpacity
                  style={styles.installButton}
                  onPress={canInstall ? promptInstall : () => setShowInstallInstructions(true)}
                >
                  <Icon name="download" size={12} color={Colors.inkFaint} />
                  <Text style={styles.installButtonText}>{t('home.installApp')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
        <InstallInstructionsDialog
          visible={showInstallInstructions}
          platform={instructionsPlatform}
          onClose={() => setShowInstallInstructions(false)}
        />
        <View
          style={[
            styles.optionsButtonContainer,
            { top: insets.top + 8, paddingRight: insets.right },
          ]}
        >
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
            {mode === 'create'
              ? t('home.createOnline')
              : mode === 'join'
                ? t('home.joinOnline')
                : t('home.playOffline')}
          </Text>

          {/* Nickname field — always shown */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('home.nickname')}</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('home.nicknamePlaceholder')}
              placeholderTextColor={Colors.inkFaint}
              maxLength={10}
              autoCapitalize="none"
              autoCorrect={false}
              testID="home-nickname-input"
            />
          </View>

          {/* Player count — create and offline modes */}
          <View
            style={[styles.formGroup, { opacity: mode === 'join' ? 0 : 1 }]}
            pointerEvents={mode === 'join' ? 'none' : 'auto'}
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

          {/* Difficulty — offline mode only */}
          <View
            style={[styles.formGroup, { opacity: mode === 'offline' ? 1 : 0 }]}
            pointerEvents={mode === 'offline' ? 'auto' : 'none'}
          >
            <Text style={styles.label}>{t('offline.difficulty')}</Text>
            <View style={styles.playerCountRow}>
              {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((d) => {
                const label =
                  d === 'easy'
                    ? t('offline.difficultyEasy')
                    : d === 'medium'
                      ? t('offline.difficultyMedium')
                      : t('offline.difficultyHard');
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.countButton,
                      difficulty === d ? styles.countButtonActive : styles.countButtonInactive,
                    ]}
                    onPress={() => setDifficulty(d)}
                  >
                    <Text
                      style={
                        difficulty === d
                          ? styles.countButtonTextActive
                          : styles.countButtonTextInactive
                      }
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Join code — join mode only */}
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
              testID="home-join-code-input"
            />
          </View>

          {/* Error message */}
          <Text style={[styles.errorText, { opacity: error ? 1 : 0 }]}>{error || ' '}</Text>

          {/* Action row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.buttonSecondarySmall}
              onPress={() => {
                setMode('menu');
                setError('');
              }}
            >
              <Text style={styles.buttonSecondaryText}>{t('common.back')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.buttonPrimary, styles.flex1, loading && styles.buttonDisabled]}
              onPress={
                mode === 'create' ? handleCreate : mode === 'join' ? handleJoin : handleStartOffline
              }
              disabled={loading}
              testID="home-submit-button"
            >
              {loading ? (
                <ActivityIndicator color={Colors.paperFace} />
              ) : (
                <Text style={styles.buttonPrimaryText}>
                  {mode === 'create'
                    ? t('home.create')
                    : mode === 'join'
                      ? t('home.join')
                      : t('offline.startGame')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <View
        style={[styles.optionsButtonContainer, { top: insets.top + 8, paddingRight: insets.right }]}
      >
        <OptionsButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.woodDark },
  optionsButtonContainer: { position: 'absolute', right: 16 },
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
  resumeButton: { marginBottom: 12 },
  buttonGroup: { gap: 12 },
  buttonPrimary: {
    backgroundColor: Colors.amber,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  buttonPrimaryText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.paperFace },
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
  buttonSecondaryText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.inkMid },
  buttonDisabled: { opacity: 0.6 },
  formGroup: { marginBottom: 16 },
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
  playerCountRow: { flexDirection: 'row', gap: 8 },
  countButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  countButtonActive: { backgroundColor: Colors.amber, borderColor: Colors.amber },
  countButtonInactive: { backgroundColor: Colors.paperAged, borderColor: Colors.woodMid },
  countButtonTextActive: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.paperFace },
  countButtonTextInactive: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.inkMid },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.error,
    marginBottom: 8,
    minHeight: 20,
  },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  flex1: { flex: 1 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 24,
  },
  version: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
  },
  installButtonText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.inkFaint,
  },
});
