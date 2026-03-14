/**
 * Update required screen — shown when the server requires a newer app version.
 * Ported from apps/mobile/src/screens/UpdateRequiredScreen.tsx.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from '@dabb/i18n';
import { Colors, Fonts } from '../../theme.js';

function UpdateRequiredScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('updateRequired.title')}</Text>
      <Text style={styles.message}>{t('updateRequired.message')}</Text>
      <Text style={styles.hint}>{t('updateRequired.update')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.woodDark,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.display,
    color: Colors.paperFace,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontFamily: Fonts.body,
    color: Colors.paperAged,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  hint: {
    fontSize: 14,
    fontFamily: Fonts.body,
    color: Colors.inkFaint,
    textAlign: 'center',
  },
});

export default UpdateRequiredScreen;
