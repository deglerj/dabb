/**
 * Gear icon button that opens the OptionsDialog.
 * Render inside a View with position: 'absolute' applied externally.
 */
import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../theme.js';
import { OptionsDialog } from './OptionsDialog.js';

interface OptionsButtonProps {
  onExitGame?: () => void;
}

export function OptionsButton({ onExitGame }: OptionsButtonProps) {
  const [dialogVisible, setDialogVisible] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={() => setDialogVisible(true)} hitSlop={8}>
        <Feather name="settings" size={20} color={Colors.paperFace} />
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
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
