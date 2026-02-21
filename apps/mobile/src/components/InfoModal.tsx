import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from '@dabb/i18n';

interface InfoModalProps {
  version: string;
  visible: boolean;
  onClose: () => void;
}

function InfoModal({ version, visible, onClose }: InfoModalProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('info.title')}</Text>
          <Text style={styles.version}>
            {t('info.version')}: {version}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Feather name="x" size={16} color="#2563eb" />
            <Text style={styles.closeText}>{t('info.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    marginBottom: 12,
  },
  version: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 20,
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
