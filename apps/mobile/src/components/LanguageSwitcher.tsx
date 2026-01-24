/**
 * Language switcher component for mobile
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import {
  useTranslation,
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  type SupportedLanguage,
} from '@dabb/i18n';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <View style={styles.container}>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = i18n.language === lang;
        return (
          <TouchableOpacity
            key={lang}
            style={[styles.button, isActive && styles.activeButton]}
            onPress={() => i18n.changeLanguage(lang)}
          >
            <Text style={[styles.buttonText, isActive && styles.activeButtonText]}>
              {LANGUAGE_LABELS[lang as SupportedLanguage]}
            </Text>
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
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  activeButton: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  activeButtonText: {
    color: '#fff',
  },
});

export default LanguageSwitcher;
