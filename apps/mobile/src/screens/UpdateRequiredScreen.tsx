import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from '@dabb/i18n';

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
    backgroundColor: '#f0f9ff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  hint: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});

export default UpdateRequiredScreen;
