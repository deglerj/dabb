/**
 * Gear icon button that opens the OptionsDialog.
 * Render inside a View with position: 'absolute' applied externally.
 */
import { useState } from 'react';
import { TouchableOpacity, StyleSheet } from '@dabb/rn-compat';
import { Icon } from './Icon.js';
import { Colors } from '../../theme.js';
import { TOP_RIGHT_CONTROLS_SIZE } from '../../constants.js';
import { OptionsDialog } from './OptionsDialog.js';

interface OptionsButtonProps {
  onExitGame?: () => void;
}

export function OptionsButton({ onExitGame }: OptionsButtonProps) {
  const [dialogVisible, setDialogVisible] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setDialogVisible(true)}>
        <Icon name="settings" size={20} color={Colors.paperFace} />
      </TouchableOpacity>
      <OptionsDialog
        visible={dialogVisible}
        onClose={() => setDialogVisible(false)}
        onExitGame={onExitGame}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    // No hitSlop here any more: its negative margins pulled this button on top of the emote
    // button that now sits next to it.
    width: TOP_RIGHT_CONTROLS_SIZE,
    height: TOP_RIGHT_CONTROLS_SIZE,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
