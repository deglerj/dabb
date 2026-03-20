/**
 * ScoreboardModal — full round history shown when user taps the scoreboard strip.
 */
import React from 'react';
import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import type { PlayerIndex, RoundHistoryEntry } from '@dabb/shared-types';
import type { RoundHistoryResult } from '@dabb/ui-shared';
import { useTranslation } from '@dabb/i18n';

export interface ScoreboardModalProps {
  visible: boolean;
  onClose: () => void;
  rounds: RoundHistoryEntry[];
  currentRound: RoundHistoryResult['currentRound'];
  nicknames: Map<PlayerIndex, string>;
  playerCount: number;
  totalScores: Array<{ playerIndex: PlayerIndex; score: number }>;
}

export function ScoreboardModal({
  visible,
  onClose,
  rounds,
  currentRound,
  nicknames,
  playerCount,
  totalScores,
}: ScoreboardModalProps) {
  const { t } = useTranslation();
  const playerIndices = Array.from({ length: playerCount }, (_, i) => i as PlayerIndex);

  function name(pi: PlayerIndex) {
    return nicknames.get(pi) ?? `P${pi}`;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('game.scoreHistory')}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Column headers */}
          <View style={styles.row}>
            <Text style={[styles.cell, styles.roundCell, styles.headerText]}>
              {t('game.roundAbbr')}
            </Text>
            <Text style={[styles.cell, styles.bidCell, styles.headerText]}>
              {t('game.bidColumn')}
            </Text>
            {playerIndices.map((pi) => (
              <Text key={pi} style={[styles.cell, styles.playerCell, styles.headerText]}>
                {name(pi)}
              </Text>
            ))}
          </View>

          <ScrollView>
            {/* Completed rounds */}
            {rounds.map((round) => (
              <View key={round.round} style={styles.row}>
                <Text style={[styles.cell, styles.roundCell]}>{round.round}</Text>
                <Text style={[styles.cell, styles.bidCell]}>
                  {round.bidWinner !== null ? `${name(round.bidWinner)} ${round.winningBid}` : '—'}
                </Text>
                {playerIndices.map((pi) => {
                  const score = round.scores?.[pi];
                  return (
                    <View key={pi} style={[styles.cell, styles.playerCell]}>
                      {score ? (
                        <>
                          <Text style={styles.scoreDetail}>
                            {score.melds}m + {score.tricks}t
                          </Text>
                          <Text
                            style={[styles.scoreTotal, score.bidMet ? styles.bidMet : undefined]}
                          >
                            {score.total}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.scoreTotal}>—</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Current in-progress round */}
            {currentRound && (
              <View style={[styles.row, styles.currentRow]}>
                <Text style={[styles.cell, styles.roundCell]}>{currentRound.round}</Text>
                <Text style={[styles.cell, styles.bidCell]}>
                  {currentRound.bidWinner !== null
                    ? `${name(currentRound.bidWinner)} ${currentRound.winningBid}`
                    : '—'}
                </Text>
                {playerIndices.map((pi) => (
                  <Text key={pi} style={[styles.cell, styles.playerCell, styles.scoreTotal]}>
                    —
                  </Text>
                ))}
              </View>
            )}

            {/* Totals row */}
            <View style={[styles.row, styles.totalsRow]}>
              <Text style={[styles.cell, styles.roundCell, styles.totalsLabel]}>
                {t('game.total')}
              </Text>
              <Text style={[styles.cell, styles.bidCell]} />
              {playerIndices.map((pi) => {
                const entry = totalScores.find((s) => s.playerIndex === pi);
                return (
                  <Text key={pi} style={[styles.cell, styles.playerCell, styles.totalsValue]}>
                    {entry?.score ?? 0}
                  </Text>
                );
              })}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#2a1a0a',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#5a3a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f2e8d0',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: '#c8b090',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#3a2a1a',
    alignItems: 'center',
  },
  currentRow: {
    backgroundColor: 'rgba(201,127,0,0.1)',
  },
  totalsRow: {
    borderTopWidth: 2,
    borderTopColor: '#5a3a1a',
    marginTop: 4,
    paddingTop: 8,
  },
  cell: {
    paddingHorizontal: 4,
  },
  roundCell: {
    width: 28,
    color: '#c8b090',
    fontSize: 12,
    textAlign: 'center',
  },
  bidCell: {
    flex: 1,
    color: '#c8b090',
    fontSize: 11,
  },
  playerCell: {
    width: 60,
    alignItems: 'center',
  },
  headerText: {
    color: '#f2e8d0',
    fontWeight: 'bold',
    fontSize: 12,
  },
  scoreDetail: {
    fontSize: 10,
    color: '#c8b090',
    textAlign: 'center',
  },
  scoreTotal: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f2e8d0',
    textAlign: 'center',
  },
  bidMet: {
    color: '#6bcb77',
  },
  totalsLabel: {
    color: '#f2e8d0',
    fontWeight: 'bold',
  },
  totalsValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#c97f00',
    textAlign: 'center',
  },
});
