/**
 * Manual install steps for browsers with no `beforeinstallprompt` API
 * (Safari, Firefox Android). Shown instead of the native install prompt.
 */
import { StyleSheet, Text } from '@dabb/rn-compat';
import { useTranslation } from '@dabb/i18n';
import { Colors, Fonts } from '../../theme.js';
import { Dialog } from './Dialog.js';
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
    <Dialog visible={visible} title={t('installInstructions.title')} onClose={onClose}>
      <Text style={styles.message}>{platform ? t(MESSAGE_KEY[platform]) : ''}</Text>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  message: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkDark,
    lineHeight: 20,
  },
});
