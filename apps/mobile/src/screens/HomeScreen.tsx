/**
 * Home screen for creating or joining games
 */

import React, { useState, useEffect } from 'react';
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
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import { useTranslation } from '@dabb/i18n';
import { getRulesMarkdown, type SupportedLanguage } from '@dabb/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LanguageSwitcher from '../components/LanguageSwitcher';
import KiSchlonzStamp from '../components/KiSchlonzStamp';
import InfoModal from '../components/InfoModal';
import Constants from 'expo-constants';
import { WoodBackground } from '../components/WoodBackground';
import { PaperPanel } from '../components/PaperPanel';
import { Colors, Fonts } from '../theme';

interface HomeScreenProps {
  onCreateGame: (nickname: string, playerCount: 2 | 3 | 4) => Promise<void>;
  onJoinGame: (sessionCode: string, nickname: string) => Promise<void>;
  loading: boolean;
}

function HomeScreen({ onCreateGame, onJoinGame, loading }: HomeScreenProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [nickname, setNickname] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(2);
  const [showRules, setShowRules] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';

  useEffect(() => {
    AsyncStorage.getItem('dabb-nickname').then((saved) => {
      if (saved) {
        setNickname(saved);
      }
    });
  }, []);

  const handleCreate = async () => {
    if (!nickname.trim()) {
      Alert.alert(t('common.error'), t('errors.enterNickname'));
      return;
    }

    try {
      await AsyncStorage.setItem('dabb-nickname', nickname.trim());
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
      await AsyncStorage.setItem('dabb-nickname', nickname.trim());
      await onJoinGame(sessionCode.trim().toLowerCase(), nickname.trim());
    } catch (_error) {
      Alert.alert(t('common.error'), t('errors.joinFailed'));
    }
  };

  if (mode === 'menu') {
    return (
      <WoodBackground>
        <View style={[styles.menuContainer, { paddingTop: insets.top + 8 }]}>
          {/* Language switcher */}
          <View style={styles.languageSwitcherContainer}>
            <LanguageSwitcher />
          </View>

          <PaperPanel aged style={styles.menuPanel}>
            <View style={styles.stampContainer}>
              <KiSchlonzStamp size={80} />
            </View>
            <Text style={styles.title}>{t('home.title')}</Text>
            <Text style={styles.subtitle}>{t('home.subtitle')}</Text>

            <View style={styles.buttonGroup}>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setMode('create')}
              >
                <View style={styles.buttonContent}>
                  <Feather name="plus" size={18} color={Colors.inkDark} />
                  <Text style={styles.buttonText}>{t('home.createGame')}</Text>
                </View>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={() => setMode('join')}
              >
                <View style={styles.buttonContent}>
                  <Feather name="user-plus" size={18} color={Colors.inkMid} />
                  <Text style={styles.secondaryButtonText}>{t('home.joinGame')}</Text>
                </View>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={() => setShowRules(true)}
              >
                <View style={styles.buttonContent}>
                  <Feather name="book-open" size={18} color={Colors.inkMid} />
                  <Text style={styles.secondaryButtonText}>{t('rules.title')}</Text>
                </View>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
                onPress={() => setShowInfo(true)}
              >
                <View style={styles.buttonContent}>
                  <Feather name="info" size={18} color={Colors.inkMid} />
                  <Text style={styles.secondaryButtonText}>{t('info.title')}</Text>
                </View>
              </Pressable>
            </View>
          </PaperPanel>
        </View>

        <InfoModal version={appVersion} visible={showInfo} onClose={() => setShowInfo(false)} />

        <Modal visible={showRules} animationType="slide" onRequestClose={() => setShowRules(false)}>
          <View style={styles.rulesModal}>
            <View style={styles.rulesHeader}>
              <Text style={styles.rulesTitle}>{t('rules.title')}</Text>
              <TouchableOpacity onPress={() => setShowRules(false)}>
                <Feather name="x" size={24} color={Colors.inkDark} />
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
      </WoodBackground>
    );
  }

  if (mode === 'create') {
    return (
      <WoodBackground>
        <KeyboardAvoidingView
          style={styles.formOuter}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <PaperPanel aged style={styles.formPanel}>
            <Text style={styles.formTitle}>{t('home.newGame')}</Text>

            <Text style={styles.label}>{t('home.nickname')}</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('home.nicknamePlaceholder')}
              placeholderTextColor={Colors.inkFaint}
              maxLength={20}
            />

            <Text style={styles.label}>{t('home.playerCount')}</Text>
            <View style={styles.playerCountButtons}>
              {([2, 3, 4] as const).map((count) => (
                <Pressable
                  key={count}
                  style={[styles.countButton, playerCount === count && styles.countButtonSelected]}
                  onPress={() => setPlayerCount(count)}
                >
                  <View style={styles.countButtonContent}>
                    <Feather
                      name="users"
                      size={14}
                      color={playerCount === count ? Colors.amber : Colors.inkFaint}
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
                </Pressable>
              ))}
            </View>

            <View style={styles.actionButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.primaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleCreate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.inkDark} />
                ) : (
                  <View style={styles.buttonContent}>
                    <Feather name="plus" size={16} color={Colors.inkDark} />
                    <Text style={styles.buttonText}>{t('home.create')}</Text>
                  </View>
                )}
              </Pressable>

              <TouchableOpacity
                style={[styles.button, styles.textButton]}
                onPress={() => setMode('menu')}
                disabled={loading}
              >
                <View style={styles.buttonContent}>
                  <Feather name="arrow-left" size={16} color={Colors.inkFaint} />
                  <Text style={styles.textButtonText}>{t('common.back')}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </PaperPanel>
        </KeyboardAvoidingView>
      </WoodBackground>
    );
  }

  return (
    <WoodBackground>
      <KeyboardAvoidingView
        style={styles.formOuter}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <PaperPanel aged style={styles.formPanel}>
          <Text style={styles.formTitle}>{t('home.joinGame')}</Text>

          <Text style={styles.label}>{t('home.nickname')}</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder={t('home.nicknamePlaceholder')}
            placeholderTextColor={Colors.inkFaint}
            maxLength={20}
          />

          <Text style={styles.label}>{t('home.gameCode')}</Text>
          <TextInput
            style={styles.input}
            value={sessionCode}
            onChangeText={setSessionCode}
            placeholder={t('home.gameCodePlaceholder')}
            placeholderTextColor={Colors.inkFaint}
            autoCapitalize="none"
          />

          <View style={styles.actionButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleJoin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.inkDark} />
              ) : (
                <View style={styles.buttonContent}>
                  <Feather name="user-plus" size={16} color={Colors.inkDark} />
                  <Text style={styles.buttonText}>{t('home.join')}</Text>
                </View>
              )}
            </Pressable>

            <TouchableOpacity
              style={[styles.button, styles.textButton]}
              onPress={() => setMode('menu')}
              disabled={loading}
            >
              <View style={styles.buttonContent}>
                <Feather name="arrow-left" size={16} color={Colors.inkFaint} />
                <Text style={styles.textButtonText}>{t('common.back')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </PaperPanel>
      </KeyboardAvoidingView>
    </WoodBackground>
  );
}

const styles = StyleSheet.create({
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuPanel: {
    width: '100%',
    maxWidth: 380,
  },
  formOuter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  formPanel: {
    width: '100%',
    maxWidth: 380,
  },
  languageSwitcherContainer: {
    position: 'absolute',
    top: 16,
    right: 24,
  },
  stampContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 40,
    fontFamily: Fonts.display,
    color: Colors.inkDark,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.handwriting,
    color: Colors.inkFaint,
    textAlign: 'center',
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 28,
    fontFamily: Fonts.display,
    color: Colors.inkDark,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonGroup: {
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 4,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.amber,
    shadowColor: 'rgba(120,60,0,0.4)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  buttonPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  secondaryButton: {
    backgroundColor: Colors.paperAged,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    shadowColor: Colors.paperEdge,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  secondaryButtonPressed: {
    transform: [{ translateY: 1 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: Colors.inkDark,
    fontSize: 16,
    fontFamily: Fonts.bodyBold,
  },
  secondaryButtonText: {
    color: Colors.inkMid,
    fontSize: 16,
    fontFamily: Fonts.bodyBold,
  },
  textButton: {
    backgroundColor: 'transparent',
  },
  textButtonText: {
    color: Colors.inkFaint,
    fontSize: 15,
    fontFamily: Fonts.body,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    color: Colors.inkMid,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.paperFace,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    borderRadius: 3,
    padding: 12,
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.inkDark,
  },
  playerCountButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  countButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: Colors.paperFace,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    borderRadius: 3,
    alignItems: 'center',
  },
  countButtonSelected: {
    borderColor: Colors.amber,
    backgroundColor: '#fef3e0',
  },
  countButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countButtonText: {
    fontSize: 18,
    fontFamily: Fonts.handwritingBold,
    color: Colors.inkFaint,
  },
  countButtonTextSelected: {
    color: Colors.amber,
  },
  actionButtons: {
    marginTop: 20,
    gap: 10,
  },
  rulesModal: {
    flex: 1,
    backgroundColor: Colors.paperAged,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.paperEdge,
    backgroundColor: Colors.paperFace,
  },
  rulesTitle: {
    fontSize: 20,
    fontFamily: Fonts.display,
    color: Colors.inkDark,
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
    fontSize: 22,
    fontFamily: Fonts.display,
    color: Colors.inkDark,
    marginBottom: 8,
    marginTop: 16,
  },
  heading2: {
    fontSize: 18,
    fontFamily: Fonts.bodyBold,
    color: Colors.inkDark,
    marginBottom: 8,
    marginTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.paperEdge,
    paddingBottom: 4,
  },
  heading3: {
    fontSize: 15,
    fontFamily: Fonts.bodyBold,
    color: Colors.inkMid,
    marginBottom: 6,
    marginTop: 12,
  },
  body: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.inkMid,
    lineHeight: 22,
  },
  strong: {
    fontFamily: Fonts.bodyBold,
    color: Colors.inkDark,
  },
  table: {
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    borderRadius: 3,
    marginBottom: 12,
  },
  th: {
    backgroundColor: Colors.paperAged,
    padding: 8,
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
  },
  td: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.paperEdge,
    fontSize: 12,
  },
  list_item: {
    marginBottom: 4,
  },
});

export default HomeScreen;
