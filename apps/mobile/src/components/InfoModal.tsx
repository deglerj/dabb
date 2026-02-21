import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from '@dabb/i18n';
import OpenSourceLicensesModal from './OpenSourceLicensesModal';

const GITHUB_URL = 'https://github.com/deglerj/dabb';
const LICENSE_URL = 'https://github.com/deglerj/dabb/blob/main/LICENSE';
const ISSUES_URL = 'https://github.com/deglerj/dabb/issues';

interface InfoModalProps {
  version: string;
  visible: boolean;
  onClose: () => void;
}

function InfoModal({ version, visible, onClose }: InfoModalProps) {
  const { t } = useTranslation();
  const [showLicenses, setShowLicenses] = useState(false);

  return (
    <>
      <OpenSourceLicensesModal visible={showLicenses} onClose={() => setShowLicenses(false)} />
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('info.title')}</Text>
            <Text style={styles.description}>{t('info.description')}</Text>
            <Text style={styles.version}>
              {t('info.version')}: {version}
            </Text>
            <View style={styles.links}>
              <TouchableOpacity style={styles.link} onPress={() => Linking.openURL(GITHUB_URL)}>
                <Feather name="github" size={16} color="#2563eb" />
                <Text style={styles.linkText}>{t('info.sourceCode')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.link} onPress={() => Linking.openURL(LICENSE_URL)}>
                <Feather name="file-text" size={16} color="#2563eb" />
                <Text style={styles.linkText}>{t('info.license')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.link} onPress={() => Linking.openURL(ISSUES_URL)}>
                <Feather name="alert-circle" size={16} color="#2563eb" />
                <Text style={styles.linkText}>{t('info.reportBug')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.link} onPress={() => setShowLicenses(true)}>
                <Feather name="book-open" size={16} color="#2563eb" />
                <Text style={styles.linkText}>{t('info.openSourceLicenses')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Feather name="x" size={16} color="#2563eb" />
              <Text style={styles.closeText}>{t('info.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  links: {
    gap: 12,
    marginBottom: 20,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    color: '#2563eb',
    fontSize: 15,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  closeText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default InfoModal;
