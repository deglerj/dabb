/**
 * ScoreboardStrip — a compact horizontal score display shown at the top of the game screen.
 * Shows total score per player (2/3-player) or per team (4-player), highlighting the local side.
 * Shows highest bid/bidder and current trump on the right.
 * Tappable to open the scoreboard history modal.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { PlayerIndex, Suit, TeamScoreEntry } from '@dabb/shared-types';
import { formatSuit } from '@dabb/game-logic';
import { useTranslation } from '@dabb/i18n';

export interface ScoreboardStripProps {
  totalScores: Array<{ playerIndex: PlayerIndex; score: number }>;
  myPlayerIndex: PlayerIndex;
  bidWinner: PlayerIndex | null;
  currentBid: number;
  trump: Suit | null;
  nicknames: Map<PlayerIndex, string>;
  teamScores?: TeamScoreEntry[];
  onPress?: () => void;
}

export function ScoreboardStrip({
  totalScores,
  myPlayerIndex,
  bidWinner,
  currentBid,
  trump,
  nicknames,
  teamScores,
  onPress,
}: ScoreboardStripProps) {
  const { t } = useTranslation();

  const bidderName = bidWinner !== null ? (nicknames.get(bidWinner) ?? `P${bidWinner}`) : null;
  const bidText = bidderName !== null ? `${bidderName} · ${currentBid}` : '—';
  const trumpText = trump !== null ? formatSuit(trump) : '—';

  return (
    <TouchableOpacity style={styles.strip} onPress={onPress} activeOpacity={0.7}>
      {teamScores
        ? // 4-player team mode: two colour-coded team boxes
          teamScores.map((entry) => (
            <View
              key={entry.team}
              style={[
                styles.teamEntry,
                entry.isMyTeam ? styles.teamEntryMine : styles.teamEntryOpponent,
              ]}
            >
              <Text
                style={[
                  styles.teamName,
                  entry.isMyTeam ? styles.teamNameMine : styles.teamNameOpponent,
                ]}
                numberOfLines={1}
              >
                {entry.names}
              </Text>
              <Text style={[styles.totalScore, styles.totalScoreHighlight]}>{entry.score}</Text>
            </View>
          ))
        : // 2/3-player: one box per player
          totalScores.map((entry) => {
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
  teamEntry: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 60,
  },
  teamEntryMine: {
    backgroundColor: '#1e3a5f',
  },
  teamEntryOpponent: {
    backgroundColor: '#3a1e1e',
  },
  teamName: {
    fontSize: 9,
    maxWidth: 80,
  },
  teamNameMine: {
    color: '#7ab3e0',
  },
  teamNameOpponent: {
    color: '#e07a7a',
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
