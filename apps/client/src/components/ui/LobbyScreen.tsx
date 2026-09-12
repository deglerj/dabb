/**
 * Lobby — the list of online games waiting for players, and the only way into one.
 *
 * There is no invite code any more: every online session is listed here for everyone.
 */
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  useSafeAreaInsets,
} from '@dabb/rn-compat';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@dabb/i18n';
import { Colors, Fonts, Shadows } from '../../theme.js';
import { TableBackdrop } from './TableBackdrop.js';
import { OptionsButton } from './OptionsButton.js';
import { subscribeToLobby, pruneStaleSessions, type LobbyEntry } from '../../firebase/lobby.js';
import { joinSession } from '../../firebase/session.js';
import { sessionErrorText } from '../../utils/sessionErrorText.js';
import { DEFAULT_NICKNAME, MAX_NICKNAME_LENGTH } from '../../constants.js';

export default function LobbyScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const insets = useSafeAreaInsets();

  const [nickname, setNickname] = useState(DEFAULT_NICKNAME);
  const [entries, setEntries] = useState<LobbyEntry[] | null>(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  // Nobody runs a cleanup job — whoever opens the lobby is the garbage collector. Codes are
  // remembered so a rejected delete isn't retried on every snapshot.
  const pruned = useRef(new Set<string>());

  useEffect(() => {
    const saved = localStorage.getItem('dabb-nickname');
    if (saved) {
      setNickname(saved);
    }
  }, []);

  useEffect(() => {
    return subscribeToLobby((fresh, staleCodes) => {
      setEntries(fresh);
      const unhandled = staleCodes.filter((code) => !pruned.current.has(code));
      if (unhandled.length > 0) {
        unhandled.forEach((code) => pruned.current.add(code));
        void pruneStaleSessions(unhandled);
      }
    });
  }, []);

  const handleJoin = async (entry: LobbyEntry) => {
    if (!nickname.trim()) {
      setError(t('errors.enterNickname'));
      return;
    }
    if (nickname.trim().length > MAX_NICKNAME_LENGTH) {
      setError(t('errors.nicknameTooLong', { max: MAX_NICKNAME_LENGTH }));
      return;
    }
    setJoining(true);
    setError('');
    try {
      const result = await joinSession(entry.code, nickname.trim());
      localStorage.setItem(
        `dabb-${entry.code}`,
        JSON.stringify({
          secretId: result.secretId,
          playerIndex: result.playerIndex,
        })
      );
      localStorage.setItem('dabb-nickname', nickname.trim());
      navigate(`/waiting-room/${entry.code}`);
    } catch (err) {
      setError(sessionErrorText(err, t));
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.screen}>
      <TableBackdrop />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.heading}>{t('lobby.title')}</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>{t('home.nickname')}</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('home.nicknamePlaceholder')}
              placeholderTextColor={Colors.inkFaint}
              maxLength={MAX_NICKNAME_LENGTH}
              autoCapitalize="none"
              autoCorrect={false}
              testID="lobby-nickname-input"
            />
          </View>

          <View style={styles.list}>
            {entries === null ? (
              <ActivityIndicator color={Colors.inkMid} />
            ) : entries.length === 0 ? (
              <Text style={styles.empty}>{t('lobby.empty')}</Text>
            ) : (
              entries.map((entry) => (
                <Pressable
                  key={entry.code}
                  testID="lobby-game-row"
                  style={({ pressed }) => [
                    styles.row,
                    joining && styles.rowDisabled,
                    pressed && !joining && styles.rowPressed,
                  ]}
                  disabled={joining}
                  onPress={() => void handleJoin(entry)}
                >
                  <View style={styles.flex1}>
                    <Text style={styles.rowHost}>
                      {t('lobby.hostedBy', { nickname: entry.host })}
                    </Text>
                    <Text style={styles.rowSeats}>
                      {t('lobby.seats', { taken: entry.taken, total: entry.playerCount })}
                    </Text>
                  </View>
                  <Text style={styles.rowJoin}>{t('lobby.join')}</Text>
                </Pressable>
              ))
            )}
          </View>

          <Text style={[styles.errorText, { opacity: error ? 1 : 0 }]}>{error || ' '}</Text>

          <Pressable
            style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}
            onPress={() => navigate('/')}
          >
            <Text style={styles.buttonSecondaryText}>{t('common.back')}</Text>
          </Pressable>
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
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: Colors.paperAged,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    ...Shadows.card,
  },
  heading: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.inkDark,
    marginBottom: 20,
  },
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
    backgroundColor: Colors.paperFace,
  },
  // A fixed floor so the card doesn't jump between "empty" and "three games".
  list: { gap: 8, minHeight: 120, justifyContent: 'center' },
  empty: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.inkFaint,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.paperFace,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: 'rgba(120,60,0,0.25)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  rowPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  rowDisabled: { opacity: 0.5 },
  rowHost: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.inkDark },
  rowSeats: { fontFamily: Fonts.body, fontSize: 13, color: Colors.inkMid },
  rowJoin: { fontFamily: Fonts.bodyBold, fontSize: 14, color: Colors.amber },
  flex1: { flex: 1 },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.error,
    marginTop: 12,
    marginBottom: 8,
    minHeight: 20,
  },
  buttonSecondary: {
    backgroundColor: Colors.paperFace,
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    shadowColor: 'rgba(120,60,0,0.25)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  buttonSecondaryText: { fontFamily: Fonts.bodyBold, fontSize: 16, color: Colors.inkMid },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
});
