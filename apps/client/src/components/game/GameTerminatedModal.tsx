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
  winnerNicknames: string[];
  isLocalWinner: boolean;
  terminatedByNickname?: string | null;
  onDone: () => void;
}

export function GameTerminatedModal({
  visible,
  winnerId,
  winnerNicknames,
  isLocalWinner,
  terminatedByNickname,
  onDone,
}: GameTerminatedModalProps) {
  const { t } = useTranslation();

  let title: string;
  if (terminatedByNickname) {
    title = t('game.playerEndedGame', { name: terminatedByNickname });
  } else if (!winnerId) {
    title = t('game.gameEnded');
  } else if (isLocalWinner) {
    if (winnerNicknames.length === 2) {
      // 4-player: "Du und Anna habt gewonnen! 🎉"
      const teammateName = winnerNicknames[1] ?? winnerNicknames[0];
      title = t('game.youAndTeammateWonGame', { name: teammateName });
    } else {
      title = t('game.youWonGame');
    }
  } else {
    if (winnerNicknames.length === 2) {
      // 4-player: "Bob und Chris haben gewonnen."
      title = t('game.playersWonGame', { name1: winnerNicknames[0], name2: winnerNicknames[1] });
    } else {
      title = t('game.playerWonGame', { name: winnerNicknames[0] ?? t('common.player') });
    }
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
