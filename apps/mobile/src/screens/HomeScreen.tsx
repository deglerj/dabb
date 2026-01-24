/**
 * Home screen for creating or joining games
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from '@dabb/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface HomeScreenProps {
  onCreateGame: (nickname: string, playerCount: 2 | 3 | 4) => Promise<void>;
  onJoinGame: (sessionCode: string, nickname: string) => Promise<void>;
  loading: boolean;
}

function HomeScreen({ onCreateGame, onJoinGame, loading }: HomeScreenProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [nickname, setNickname] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);

  const handleCreate = async () => {
    if (!nickname.trim()) {
      Alert.alert(t('common.error'), t('errors.enterNickname'));
      return;
    }

    try {
      await onCreateGame(nickname.trim(), playerCount);
    } catch (_error) {
      Alert.alert(t('common.error'), t('errors.createFailed'));
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) {
      Alert.alert(t('common.error'), t('errors.enterNickname'));
      return;
    }
    if (!sessionCode.trim()) {
      Alert.alert(t('common.error'), t('errors.enterGameCode'));
      return;
    }

    try {
      await onJoinGame(sessionCode.trim().toLowerCase(), nickname.trim());
    } catch (_error) {
      Alert.alert(t('common.error'), t('errors.joinFailed'));
    }
  };

  if (mode === 'menu') {
    return (
      <View style={styles.container}>
        <View style={styles.languageSwitcherContainer}>
          <LanguageSwitcher />
        </View>
        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => setMode('create')}
          >
            <Text style={styles.buttonText}>{t('home.createGame')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setMode('join')}
          >
            <Text style={styles.secondaryButtonText}>{t('home.joinGame')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === 'create') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.title}>{t('home.newGame')}</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t('home.nickname')}</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder={t('home.nicknamePlaceholder')}
            maxLength={20}
          />

          <Text style={styles.label}>{t('home.playerCount')}</Text>
          <View style={styles.playerCountButtons}>
            {([2, 3, 4] as const).map((count) => (
              <TouchableOpacity
                key={count}
                style={[styles.countButton, playerCount === count && styles.countButtonSelected]}
                onPress={() => setPlayerCount(count)}
              >
                <Text
                  style={[
                    styles.countButtonText,
                    playerCount === count && styles.countButtonTextSelected,
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('home.create')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.textButton]}
              onPress={() => setMode('menu')}
              disabled={loading}
            >
              <Text style={styles.textButtonText}>{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Text style={styles.title}>{t('home.joinGame')}</Text>

      <View style={styles.form}>
        <Text style={styles.label}>{t('home.nickname')}</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder={t('home.nicknamePlaceholder')}
          maxLength={20}
        />

        <Text style={styles.label}>{t('home.gameCode')}</Text>
        <TextInput
          style={styles.input}
          value={sessionCode}
          onChangeText={setSessionCode}
          placeholder={t('home.gameCodePlaceholder')}
          autoCapitalize="none"
        />

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleJoin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('home.join')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.textButton]}
            onPress={() => setMode('menu')}
            disabled={loading}
          >
            <Text style={styles.textButtonText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f0f9ff',
  },
  languageSwitcherContainer: {
    position: 'absolute',
    top: 60,
    right: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 48,
  },
  buttonGroup: {
    width: '100%',
    gap: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#2563eb',
    fontSize: 18,
    fontWeight: 'bold',
  },
  textButton: {
    backgroundColor: 'transparent',
  },
  textButtonText: {
    color: '#64748b',
    fontSize: 16,
  },
  form: {
    width: '100%',
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  playerCountButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  countButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
  },
  countButtonSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#dbeafe',
  },
  countButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  countButtonTextSelected: {
    color: '#2563eb',
  },
  actionButtons: {
    marginTop: 16,
    gap: 12,
  },
});

export default HomeScreen;
