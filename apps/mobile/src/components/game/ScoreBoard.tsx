/**
 * Score board component for React Native with round history
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PlayerIndex, Team, GameEvent, GameState } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import { useRoundHistory } from '@dabb/ui-shared';

interface ScoreBoardProps {
  state: GameState;
  events: GameEvent[];
  nicknames: Map<PlayerIndex, string>;
  currentPlayerIndex: PlayerIndex;
  onCollapse?: () => void;
}

function ScoreBoard({ state, events, nicknames, currentPlayerIndex, onCollapse }: ScoreBoardProps) {
  const { t } = useTranslation();
  const { rounds, currentRound, gameWinner } = useRoundHistory(events);

  const getName = (playerOrTeam: PlayerIndex | Team): string => {
    if (state.playerCount === 4) {
      const teamPlayers = state.players.filter((p) => p.team === playerOrTeam);
      if (teamPlayers.length > 0) {
        return teamPlayers.map((p) => p.nickname).join(' & ');
      }
    }
    const nickname = nicknames.get(playerOrTeam as PlayerIndex);
    if (nickname) {
      return nickname;
    }
    return `${t('common.player')} ${(playerOrTeam as number) + 1}`;
  };

  const getMeldForEntity = (entity: PlayerIndex | Team): number | undefined => {
    if (state.playerCount === 4) {
      const members = state.players.filter((p) => p.team === entity);
      const vals = members.map((p) => currentRound?.meldScores?.[p.playerIndex]);
      if (vals.every((v) => v === undefined)) {
        return undefined;
      }
      return vals.reduce((sum: number, v) => sum + (v ?? 0), 0);
    }
    return currentRound?.meldScores?.[entity as PlayerIndex];
  };

  const scoringEntities = Array.from(state.totalScores.keys());
  const sortedEntries = Array.from(state.totalScores.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.container}>
      {/* Header with collapse button */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('game.scoreBoard')}</Text>
        {onCollapse && (
          <TouchableOpacity onPress={onCollapse} style={styles.collapseButton}>
            <View style={styles.collapseContent}>
              <Feather name="chevron-down" size={12} color="#2563eb" />
              <Text style={styles.collapseText}>{t('game.hideHistory')}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.targetScore}>
        {t('game.targetScore')}: {state.targetScore}
      </Text>

      {/* Game winner banner */}
      {gameWinner !== null && (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerText}>
            {t('game.gameWinner')}: {getName(gameWinner)}
          </Text>
        </View>
      )}

      {/* Player totals */}
      <View style={styles.scoreList}>
        {sortedEntries.map(([playerOrTeam, score], rank) => {
          const isCurrentPlayer = playerOrTeam === currentPlayerIndex;
          const nickname = getName(playerOrTeam);

          return (
            <View
              key={playerOrTeam}
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
                {isCurrentPlayer && ` (${t('common.you')})`}
              </Text>
              <Text style={[styles.score, isCurrentPlayer && styles.currentPlayerText]}>
                {score}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Round history table */}
      {(rounds.length > 0 || currentRound) && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>{t('game.showHistory')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
            <View>
              {/* Table header */}
              <View style={styles.tableRow}>
                <View style={[styles.tableCell, styles.roundCell]}>
                  <Text style={styles.headerText}>{t('game.round')}</Text>
                </View>
                {scoringEntities.map((entity) => (
                  <View key={entity} style={styles.tableCell}>
                    <Text style={styles.headerText} numberOfLines={1}>
                      {getName(entity)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Round rows */}
              {rounds.map((round) => (
                <View
                  key={round.round}
                  style={[styles.tableRow, round.scores && styles.completedRound]}
                >
                  <View style={[styles.tableCell, styles.roundCell]}>
                    <Text style={styles.roundNumber}>{round.round}</Text>
                    {round.bidWinner !== null && (
                      <Text style={styles.roundBid}>
                        {getName(round.bidWinner)}: {round.winningBid}
                      </Text>
                    )}
                  </View>
                  {scoringEntities.map((entity) => {
                    const scoreData = round.scores?.[entity];
                    if (!scoreData) {
                      return (
                        <View key={entity} style={styles.tableCell}>
                          <Text style={styles.cellText}>-</Text>
                        </View>
                      );
                    }
                    return (
                      <View
                        key={entity}
                        style={[styles.tableCell, !scoreData.bidMet && styles.bidNotMetCell]}
                      >
                        <Text style={styles.cellTotal}>{scoreData.total}</Text>
                        {scoreData.bidMet && (
                          <>
                            <Text style={styles.cellBreakdown}>
                              {t('game.melds')}: {scoreData.melds}
                            </Text>
                            <Text style={styles.cellBreakdown}>
                              {t('game.tricks')}: {scoreData.tricks}
                            </Text>
                          </>
                        )}
                        {!scoreData.bidMet && (
                          <Text style={styles.bidNotMetText}>{t('game.bidNotMet')}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}

              {/* Active round row */}
              {currentRound && currentRound.bidWinner !== null && (
                <View style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.roundCell]}>
                    <Text style={styles.roundNumber}>{currentRound.round}</Text>
                    <Text style={styles.roundBid}>
                      {getName(currentRound.bidWinner)}: {currentRound.winningBid}
                    </Text>
                  </View>
                  {scoringEntities.map((entity) => {
                    const meldScore = getMeldForEntity(entity);
                    if (meldScore === undefined) {
                      return (
                        <View key={entity} style={styles.tableCell}>
                          <Text style={styles.cellText}>-</Text>
                        </View>
                      );
                    }
                    return (
                      <View key={entity} style={styles.tableCell}>
                        <Text style={styles.cellBreakdown}>
                          {t('game.melds')}: {meldScore}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  collapseButton: {
    padding: 4,
  },
  collapseContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  collapseText: {
    fontSize: 12,
    color: '#2563eb',
  },
  targetScore: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  winnerBanner: {
    backgroundColor: '#22c55e',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  winnerText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
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
  historySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  tableScroll: {
    maxHeight: 200,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  completedRound: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    width: 80,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundCell: {
    width: 100,
    alignItems: 'flex-start',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  roundNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
  },
  roundBid: {
    fontSize: 10,
    color: '#6b7280',
  },
  cellText: {
    fontSize: 14,
    color: '#6b7280',
  },
  cellTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
  },
  cellBreakdown: {
    fontSize: 9,
    color: '#9ca3af',
  },
  bidNotMetCell: {
    backgroundColor: '#fef2f2',
  },
  bidNotMetText: {
    fontSize: 9,
    color: '#dc2626',
    fontWeight: '600',
  },
});

export default ScoreBoard;
