/**
 * GameTerminatedModal — shown when the game ends (someone reached the target score
 * or the session was terminated). Uses a centered card over a transparent backdrop.
 */
import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Fonts, Shadows } from '../../theme.js';
import { useTranslation } from '@dabb/i18n';

export interface GameTerminatedModalProps {
  visible: boolean;
  winnerId: string | null;
  winnerNickname: string | null;
  isLocalWinner: boolean;
  onDone: () => void;
}

export function GameTerminatedModal({
  visible,
  winnerId,
  winnerNickname,
  isLocalWinner,
  onDone,
}: GameTerminatedModalProps) {
  const { t } = useTranslation();

  let title: string;
  if (!winnerId) {
    title = t('game.gameEnded');
  } else if (isLocalWinner) {
    title = t('game.youWonGame');
  } else {
    title = t('game.playerWonGame', { name: winnerNickname ?? t('common.player') });
  }

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Pressable style={styles.button} onPress={onDone}>
            <Text style={styles.buttonLabel}>{t('common.done')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.paperFace,
    borderRadius: 12,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    minWidth: 260,
    ...Shadows.panel,
  },
  title: {
    fontFamily: Fonts.display,
    color: Colors.inkDark,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: Colors.amber,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  buttonLabel: {
    fontFamily: Fonts.bodyBold,
    color: '#ffffff',
    fontSize: 16,
  },
});
