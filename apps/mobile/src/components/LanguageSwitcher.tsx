/**
 * Language switcher component for mobile
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  useTranslation,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  type SupportedLanguage,
} from '@dabb/i18n';

interface LanguageSwitcherProps {
  compact?: boolean;
}

function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();

  return (
    <View style={styles.container}>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = i18n.language === lang;
        return (
          <TouchableOpacity
            key={lang}
            style={[
              styles.button,
              compact && styles.buttonCompact,
              isActive && styles.activeButton,
              isActive && compact && styles.activeButtonCompact,
            ]}
            onPress={() => i18n.changeLanguage(lang)}
          >
            <View style={styles.buttonContent}>
              <Feather
                name="globe"
                size={compact ? 10 : 14}
                color={isActive ? '#fff' : compact ? '#fff' : '#374151'}
              />
              <Text
                style={[
                  styles.buttonText,
                  compact && styles.buttonTextCompact,
                  isActive && styles.activeButtonText,
                ]}
              >
                {LANGUAGE_LABELS[lang as SupportedLanguage]}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonCompact: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  activeButton: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  activeButtonCompact: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  buttonTextCompact: {
    fontSize: 11,
    color: '#fff',
  },
  activeButtonText: {
    color: '#fff',
  },
});

export default LanguageSwitcher;
