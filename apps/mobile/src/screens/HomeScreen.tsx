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
  Modal,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { useTranslation } from '@dabb/i18n';
import { getRulesMarkdown, type SupportedLanguage } from '@dabb/i18n';
import LanguageSwitcher from '../components/LanguageSwitcher';

interface HomeScreenProps {
  onCreateGame: (nickname: string, playerCount: 2 | 3 | 4) => Promise<void>;
  onJoinGame: (sessionCode: string, nickname: string) => Promise<void>;
  loading: boolean;
}

function HomeScreen({ onCreateGame, onJoinGame, loading }: HomeScreenProps) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [nickname, setNickname] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [showRules, setShowRules] = useState(false);

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
            <View style={styles.buttonContent}>
              <Feather name="plus" size={18} color="#fff" />
              <Text style={styles.buttonText}>{t('home.createGame')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setMode('join')}
          >
            <View style={styles.buttonContent}>
              <Feather name="user-plus" size={18} color="#2563eb" />
              <Text style={styles.secondaryButtonText}>{t('home.joinGame')}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setShowRules(true)}
          >
            <View style={styles.buttonContent}>
              <Feather name="book-open" size={18} color="#2563eb" />
              <Text style={styles.secondaryButtonText}>{t('rules.title')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Modal visible={showRules} animationType="slide" onRequestClose={() => setShowRules(false)}>
          <View style={styles.rulesModal}>
            <View style={styles.rulesHeader}>
              <Text style={styles.rulesTitle}>{t('rules.title')}</Text>
              <TouchableOpacity onPress={() => setShowRules(false)}>
                <Feather name="x" size={24} color="#1e3a5f" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.rulesScroll}
              contentContainerStyle={styles.rulesScrollContent}
            >
              <Markdown style={markdownStyles}>
                {getRulesMarkdown(i18n.language as SupportedLanguage)}
              </Markdown>
            </ScrollView>
          </View>
        </Modal>
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
                <View style={styles.countButtonContent}>
                  <Feather
                    name="users"
                    size={14}
                    color={playerCount === count ? '#2563eb' : '#6b7280'}
                  />
                  <Text
                    style={[
                      styles.countButtonText,
                      playerCount === count && styles.countButtonTextSelected,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
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
                <View style={styles.buttonContent}>
                  <Feather name="plus" size={16} color="#fff" />
                  <Text style={styles.buttonText}>{t('home.create')}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.textButton]}
              onPress={() => setMode('menu')}
              disabled={loading}
            >
              <View style={styles.buttonContent}>
                <Feather name="arrow-left" size={16} color="#64748b" />
                <Text style={styles.textButtonText}>{t('common.back')}</Text>
              </View>
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
              <View style={styles.buttonContent}>
                <Feather name="user-plus" size={16} color="#fff" />
                <Text style={styles.buttonText}>{t('home.join')}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.textButton]}
            onPress={() => setMode('menu')}
            disabled={loading}
          >
            <View style={styles.buttonContent}>
              <Feather name="arrow-left" size={16} color="#64748b" />
              <Text style={styles.textButtonText}>{t('common.back')}</Text>
            </View>
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  languageSwitcherContainer: {
    position: 'absolute',
    top: 16,
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
  rulesModal: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
  },
  rulesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3a5f',
  },
  rulesScroll: {
    flex: 1,
  },
  rulesScrollContent: {
    padding: 16,
  },
});

const markdownStyles = StyleSheet.create({
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginBottom: 8,
    marginTop: 16,
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginBottom: 8,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 4,
  },
  heading3: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginBottom: 6,
    marginTop: 12,
  },
  body: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  strong: {
    fontWeight: 'bold',
    color: '#1e3a5f',
  },
  table: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    marginBottom: 12,
  },
  th: {
    backgroundColor: '#e5e7eb',
    padding: 8,
    fontWeight: 'bold',
    fontSize: 13,
  },
  td: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    fontSize: 13,
  },
  list_item: {
    marginBottom: 4,
  },
});

export default HomeScreen;
