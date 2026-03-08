/**
 * Score board component for React Native with round history
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { PlayerIndex, Team, GameEvent, GameState } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import { useRoundHistory } from '@dabb/ui-shared';
import { Colors, Fonts, Shadows } from '../../theme';

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
              <Feather name="chevron-down" size={12} color={Colors.inkFaint} />
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
              <View style={[styles.tableRow, styles.tableHeaderRow]}>
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
    backgroundColor: Colors.paperFace,
    borderRadius: 3,
    padding: 16,
    margin: 16,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    ...Shadows.panel,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.display,
    color: Colors.inkDark,
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
    fontFamily: Fonts.body,
    color: Colors.inkFaint,
  },
  targetScore: {
    fontSize: 11,
    fontFamily: Fonts.body,
    color: Colors.inkFaint,
    textAlign: 'center',
    marginBottom: 12,
  },
  winnerBanner: {
    backgroundColor: Colors.success,
    padding: 8,
    borderRadius: 3,
    marginBottom: 12,
  },
  winnerText: {
    color: Colors.paperFace,
    fontFamily: Fonts.handwritingBold,
    fontSize: 16,
    textAlign: 'center',
  },
  scoreList: {
    gap: 6,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 3,
    backgroundColor: Colors.paperAged,
  },
  currentPlayerRow: {
    backgroundColor: '#fef3e0',
    borderLeftWidth: 3,
    borderLeftColor: Colors.amber,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.paperEdge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    color: Colors.inkMid,
  },
  nickname: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.handwriting,
    color: Colors.inkMid,
  },
  score: {
    fontSize: 18,
    fontFamily: Fonts.handwritingBold,
    color: Colors.inkDark,
  },
  currentPlayerText: {
    color: Colors.amber,
  },
  historySection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.paperLines,
  },
  historyTitle: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: Colors.inkFaint,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableScroll: {
    maxHeight: 200,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.paperLines,
  },
  tableHeaderRow: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.paperEdge,
  },
  completedRound: {
    backgroundColor: Colors.paperAged,
  },
  tableCell: {
    width: 80,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundCell: {
    width: 100,
    alignItems: 'flex-start',
  },
  headerText: {
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    color: Colors.inkMid,
  },
  roundNumber: {
    fontSize: 13,
    fontFamily: Fonts.handwritingBold,
    color: Colors.inkDark,
  },
  roundBid: {
    fontSize: 10,
    fontFamily: Fonts.handwriting,
    color: Colors.inkFaint,
  },
  cellText: {
    fontSize: 13,
    fontFamily: Fonts.handwriting,
    color: Colors.inkFaint,
  },
  cellTotal: {
    fontSize: 15,
    fontFamily: Fonts.handwritingBold,
    color: Colors.inkDark,
  },
  cellBreakdown: {
    fontSize: 9,
    fontFamily: Fonts.body,
    color: Colors.inkFaint,
  },
  bidNotMetCell: {
    backgroundColor: '#fef2f2',
  },
  bidNotMetText: {
    fontSize: 9,
    fontFamily: Fonts.bodyBold,
    color: Colors.error,
  },
});

export default ScoreBoard;
