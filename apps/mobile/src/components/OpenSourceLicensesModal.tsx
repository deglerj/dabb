import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from '@dabb/i18n';
import { licenseGroups } from '../generated/licenses';

interface OpenSourceLicensesModalProps {
  visible: boolean;
  onClose: () => void;
}

function OpenSourceLicensesModal({ visible, onClose }: OpenSourceLicensesModalProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Feather name="arrow-left" size={20} color="#2563eb" />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('licenses.title')}</Text>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {licenseGroups.map((group) => (
            <View key={group.license} style={styles.group}>
              <Text style={styles.licenseName}>{group.license}</Text>
              <Text style={styles.packages}>{group.packages.join(', ')}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backText: {
    color: '#2563eb',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e3a5f',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  group: {
    marginBottom: 16,
  },
  licenseName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginBottom: 4,
  },
  packages: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
  },
});

export default OpenSourceLicensesModal;
