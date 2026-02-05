/**
 * Compact scoreboard header for active gameplay (minimized view)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { GameEvent, PlayerIndex, Team, GameState } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import { useRoundHistory } from '@dabb/ui-shared';

interface ScoreBoardHeaderProps {
  state: GameState;
  events: GameEvent[];
  nicknames: Map<PlayerIndex, string>;
  onExpand: () => void;
}

function ScoreBoardHeader({ state, events, nicknames, onExpand }: ScoreBoardHeaderProps) {
  const { t } = useTranslation();
  const { currentRound, rounds } = useRoundHistory(events);

  const getName = (playerOrTeam: PlayerIndex | Team): string => {
    const nickname = nicknames.get(playerOrTeam as PlayerIndex);
    if (nickname) {
      return nickname;
    }
    return `${t('common.player')} ${(playerOrTeam as number) + 1}`;
  };

  // Get player scores for compact display
  const playerScores = Array.from(state.totalScores.entries());

  return (
    <TouchableOpacity style={styles.container} onPress={onExpand} activeOpacity={0.7}>
      <View style={styles.scoresRow}>
        {playerScores.map(([playerOrTeam, score]) => (
          <View key={playerOrTeam} style={styles.playerScore}>
            <Text style={styles.playerName} numberOfLines={1}>
              {getName(playerOrTeam)}
            </Text>
            <Text style={styles.score}>{score}</Text>
          </View>
        ))}
      </View>

      {/* Current round bid info */}
      {currentRound && currentRound.bidWinner !== null && (
        <View style={styles.currentBid}>
          <Text style={styles.currentBidText}>
            {t('game.round')} {currentRound.round}: {getName(currentRound.bidWinner)} -{' '}
            {currentRound.winningBid}
          </Text>
        </View>
      )}

      {/* Expand indicator */}
      <View style={styles.expandIndicator}>
        <View style={styles.expandContent}>
          <Feather name="chevron-up" size={12} color="#9ca3af" />
          <Text style={styles.expandText}>
            {t('game.showHistory')} ({rounds.length})
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    margin: 8,
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  playerScore: {
    alignItems: 'center',
    minWidth: 60,
  },
  playerName: {
    fontSize: 11,
    color: '#666',
  },
  score: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  currentBid: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  currentBidText: {
    fontSize: 12,
    color: '#4b5563',
    textAlign: 'center',
  },
  expandIndicator: {
    marginTop: 4,
  },
  expandContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  expandText: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },
});

export default ScoreBoardHeader;
