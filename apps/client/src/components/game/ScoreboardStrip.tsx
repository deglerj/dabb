/**
 * ScoreboardStrip — a compact horizontal score display shown at the top of the game screen.
 * Shows total score per player, highlighting the local player.
 * Shows highest bid/bidder and current trump on the right.
 * Tappable to open the scoreboard history modal.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { PlayerIndex, Suit } from '@dabb/shared-types';
import { formatSuit } from '@dabb/game-logic';
import { useTranslation } from '@dabb/i18n';

export interface ScoreboardStripProps {
  totalScores: Array<{ playerIndex: PlayerIndex; score: number }>;
  myPlayerIndex: PlayerIndex;
  bidWinner: PlayerIndex | null;
  currentBid: number;
  trump: Suit | null;
  nicknames: Map<PlayerIndex, string>;
  onPress?: () => void;
}

export function ScoreboardStrip({
  totalScores,
  myPlayerIndex,
  bidWinner,
  currentBid,
  trump,
  nicknames,
  onPress,
}: ScoreboardStripProps) {
  const { t } = useTranslation();

  const bidderName = bidWinner !== null ? (nicknames.get(bidWinner) ?? `P${bidWinner}`) : null;
  const bidText = bidderName !== null ? `${bidderName} · ${currentBid}` : '—';
  const trumpText = trump !== null ? formatSuit(trump) : '—';

  return (
    <TouchableOpacity style={styles.strip} onPress={onPress} activeOpacity={0.7}>
      {totalScores.map((entry) => {
        const isMe = entry.playerIndex === myPlayerIndex;
        return (
          <View
            key={entry.playerIndex}
            style={[styles.playerEntry, isMe && styles.playerEntryHighlight]}
          >
            <Text style={[styles.totalScore, isMe && styles.totalScoreHighlight]}>
              {entry.score}
            </Text>
          </View>
        );
      })}
      <View style={styles.infoBlock}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('game.bidColumn')}:</Text>
          <Text style={[styles.infoValue, bidWinner === null && styles.infoValueEmpty]}>
            {bidText}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('game.trump')}:</Text>
          <Text style={[styles.infoValue, trump === null && styles.infoValueEmpty]}>
            {trumpText}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a1a0a',
    paddingLeft: 8,
    paddingRight: 60,
    paddingVertical: 4,
    gap: 6,
    minHeight: 36,
  },
  playerEntry: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 44,
  },
  playerEntryHighlight: {
    backgroundColor: '#c97f00',
  },
  totalScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f2e8d0',
  },
  totalScoreHighlight: {
    color: '#fff',
  },
  infoBlock: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
    gap: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: 10,
    color: '#c8b090',
  },
  infoValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f2e8d0',
  },
  infoValueEmpty: {
    color: '#7a6a50',
    fontWeight: 'normal',
  },
});
