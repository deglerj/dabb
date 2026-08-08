/**
 * Manual install steps for browsers with no `beforeinstallprompt` API
 * (Safari, Firefox Android). Shown instead of the native install prompt.
 */
import { Modal, View, Text, TouchableOpacity, StyleSheet } from '@dabb/rn-compat';
import { Icon } from './Icon.js';
import { useTranslation } from '@dabb/i18n';
import { Colors, Fonts, Shadows } from '../../theme.js';
import type { InstallInstructionsPlatform } from '../../hooks/useInstallPrompt.js';

interface InstallInstructionsDialogProps {
  visible: boolean;
  platform: InstallInstructionsPlatform | null;
  onClose: () => void;
}

const MESSAGE_KEY: Record<InstallInstructionsPlatform, string> = {
  'ios-safari': 'installInstructions.iosSafari',
  'macos-safari': 'installInstructions.macosSafari',
  'android-firefox': 'installInstructions.androidFirefox',
};

export function InstallInstructionsDialog({
  visible,
  platform,
  onClose,
}: InstallInstructionsDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => undefined}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('installInstructions.title')}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <Icon name="x" size={18} color={Colors.inkMid} />
            </TouchableOpacity>
          </View>
          <Text style={styles.message}>{platform ? t(MESSAGE_KEY[platform]) : ''}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.paperFace,
    borderRadius: 12,
    padding: 20,
    width: 280,
    ...Shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.paperEdge,
  },
  title: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.inkDark,
  },
  closeButton: {
    backgroundColor: Colors.paperAged,
    borderRadius: 6,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkDark,
    lineHeight: 20,
  },
});
