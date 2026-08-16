/**
 * GameTerminatedModal — shown when the game ends (someone reached the target score
 * or the session was terminated). Uses a centered card over a  backdrop.
 */
import { Modal, View, Text, Pressable, StyleSheet } from '@dabb/rn-compat';
import { Colors, Fonts, Shadows } from '../../theme.js';
import { useTranslation } from '@dabb/i18n';
import type { RematchState } from './rematch.js';

export interface GameTerminatedModalProps {
  visible: boolean;
  winnerId: string | null;
  winnerNicknames: string[];
  isLocalWinner: boolean;
  terminatedBy?: { nickname: string | null } | null;
  /** Absent when a rematch is not on offer (an aborted game, or still loading). */
  rematch?: RematchState | null;
  onDone: () => void;
}

export function GameTerminatedModal({
  visible,
  winnerId,
  winnerNicknames,
  isLocalWinner,
  terminatedBy,
  rematch,
  onDone,
}: GameTerminatedModalProps) {
  const { t } = useTranslation();

  let title: string;
  if (terminatedBy) {
    // Falls back to the neutral wording when the session never said who ended it.
    title = terminatedBy.nickname
      ? t('game.playerEndedGame', { name: terminatedBy.nickname })
      : t('game.gameEnded');
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

  // One no ends it for everyone: the offer goes away and only the way out is left.
  const declined = (rematch?.declinedBy.length ?? 0) > 0;
  const offer = declined ? null : (rematch ?? null);
  const waiting = offer?.myVote === true;
  const showRematchButton = offer !== null && !waiting;

  let rematchLine: string | null = null;
  if (declined && rematch) {
    rematchLine = t('game.rematchDeclined', { names: rematch.declinedBy.join(', ') });
  } else if (offer !== null && waiting) {
    rematchLine =
      offer.waitingFor.length > 0
        ? t('game.rematchWaiting', { names: offer.waitingFor.join(', ') })
        : t('game.rematchStarting');
  } else if (offer !== null) {
    rematchLine = t('game.rematchQuestion');
  }

  return (
    <Modal visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {rematchLine === null ? null : <Text style={styles.rematchLine}>{rematchLine}</Text>}
          <View style={styles.buttonRow}>
            {showRematchButton ? (
              <Pressable style={styles.button} onPress={offer.onRematch}>
                <Text style={styles.buttonLabel}>{t('game.rematchYes')}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.button, showRematchButton ? styles.secondaryButton : null]}
              onPress={onDone}
            >
              <Text
                style={[styles.buttonLabel, showRematchButton ? styles.secondaryButtonLabel : null]}
              >
                {t('common.done')}
              </Text>
            </Pressable>
          </View>
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
    marginBottom: 12,
  },
  rematchLine: {
    fontFamily: Fonts.body,
    color: Colors.inkDark,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
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
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.amber,
  },
  secondaryButtonLabel: {
    color: Colors.amber,
  },
});
