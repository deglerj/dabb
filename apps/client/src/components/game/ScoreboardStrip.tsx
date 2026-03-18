/**
 * ScoreboardStrip — a compact horizontal score display shown at the top of the game screen.
 * Shows round score + total score per player, highlighting the local player.
 * Tappable to open the scoreboard history modal.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { PlayerIndex } from '@dabb/shared-types';

export interface ScoreboardStripProps {
  roundScores: Array<{ playerIndex: PlayerIndex; score: number }>;
  totalScores: Array<{ playerIndex: PlayerIndex; score: number }>;
  myPlayerIndex: PlayerIndex;
  targetScore: number;
  onPress?: () => void;
}

export function ScoreboardStrip({
  roundScores,
  totalScores,
  myPlayerIndex,
  targetScore,
  onPress,
}: ScoreboardStripProps) {
  return (
    <TouchableOpacity style={styles.strip} onPress={onPress} activeOpacity={0.7}>
      {roundScores.map((entry) => {
        const total = totalScores.find((t) => t.playerIndex === entry.playerIndex);
        const isMe = entry.playerIndex === myPlayerIndex;
        return (
          <View
            key={entry.playerIndex}
            style={[styles.playerEntry, isMe && styles.playerEntryHighlight]}
          >
            <Text style={[styles.roundScore, isMe && styles.roundScoreHighlight]}>
              {entry.score}
            </Text>
            <Text style={[styles.totalScore, isMe && styles.totalScoreHighlight]}>
              {total !== undefined ? total.score : 0}
            </Text>
          </View>
        );
      })}
      <View style={styles.targetEntry}>
        <Text style={styles.targetLabel}>Target:</Text>
        <Text style={styles.targetValue}>{targetScore}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a1a0a',
    paddingHorizontal: 8,
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
  roundScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f2e8d0',
  },
  roundScoreHighlight: {
    color: '#fff',
  },
  totalScore: {
    fontSize: 11,
    color: '#c8b090',
  },
  totalScoreHighlight: {
    color: '#ffe8b0',
  },
  targetEntry: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  targetLabel: {
    fontSize: 11,
    color: '#c8b090',
  },
  targetValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f2e8d0',
  },
});
