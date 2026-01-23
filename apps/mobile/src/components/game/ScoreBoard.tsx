/**
 * Score board component for React Native
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PlayerIndex } from '@dabb/shared-types';

interface ScoreBoardProps {
  scores: Map<PlayerIndex, number>;
  targetScore: number;
  nicknames: Map<PlayerIndex, string>;
  currentPlayerIndex: PlayerIndex;
}

function ScoreBoard({ scores, targetScore, nicknames, currentPlayerIndex }: ScoreBoardProps) {
  const sortedPlayers = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Punktestand</Text>
      <Text style={styles.targetScore}>Ziel: {targetScore}</Text>

      <View style={styles.scoreList}>
        {sortedPlayers.map(([playerIndex, score], rank) => {
          const isCurrentPlayer = playerIndex === currentPlayerIndex;
          const nickname = nicknames.get(playerIndex) || `Spieler ${playerIndex + 1}`;

          return (
            <View
              key={playerIndex}
              style={[styles.scoreRow, isCurrentPlayer && styles.currentPlayerRow]}
            >
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{rank + 1}</Text>
              </View>
              <Text
                style={[styles.nickname, isCurrentPlayer && styles.currentPlayerText]}
                numberOfLines={1}
              >
                {nickname}
                {isCurrentPlayer && ' (Du)'}
              </Text>
              <Text style={[styles.score, isCurrentPlayer && styles.currentPlayerText]}>
                {score}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  targetScore: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  scoreList: {
    gap: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  currentPlayerRow: {
    backgroundColor: '#dbeafe',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
  },
  nickname: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  score: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  currentPlayerText: {
    color: '#1d4ed8',
  },
});

export default ScoreBoard;
