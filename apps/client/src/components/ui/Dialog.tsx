/**
 * Dialog — the paper-card dialog: dim backdrop, titled header, close button.
 *
 * Covers the dialogs that share this exact look. ScoreboardModal and GameTerminatedModal
 * deliberately do not use it: the first is the dark table-themed panel and the second has
 * no dismiss affordance at all, so routing them through here would mean more overrides than
 * the shared markup saves.
 */
import type { ReactNode } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from '@dabb/rn-compat';
import { Colors, Fonts, Shadows } from '../../theme.js';
import { Icon } from './Icon.js';

export interface DialogProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ visible, title, onClose, children }: DialogProps) {
  return (
    <Modal visible={visible} onRequestClose={onClose}>
      {/* activeOpacity 1 on both: tapping the backdrop dismisses, tapping the card is
          swallowed so it does not fall through — neither should dim while held. */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => undefined}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={8}>
              <Icon name="x" size={18} color={Colors.inkMid} />
            </TouchableOpacity>
          </View>
          {children}
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
});
