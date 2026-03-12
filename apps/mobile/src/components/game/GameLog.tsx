/**
 * Game log component for React Native
 * Shows player actions in real-time during the game
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { GameState, GameEvent, PlayerIndex, GameLogEntry, Meld } from '@dabb/shared-types';
import { formatMeldName, SUIT_NAMES, RANK_NAMES } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import { useGameLog } from '@dabb/ui-shared';
import { Colors, Fonts } from '../../theme';

interface GameLogProps {
  state: GameState;
  events: GameEvent[];
  currentPlayerIndex: PlayerIndex;
  nicknames: Map<PlayerIndex, string>;
  disableExpand?: boolean;
}

function GameLog({
  state,
  events,
  currentPlayerIndex,
  nicknames,
  disableExpand = false,
}: GameLogProps) {
  const { t } = useTranslation();
  const { entries, latestEntries, isYourTurn } = useGameLog(events, state, currentPlayerIndex);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const displayEntries = isExpanded ? entries : latestEntries;
  const hasMoreEntries = entries.length > latestEntries.length;

  // Pulse animation for "your turn" banner
  useEffect(() => {
    if (!isYourTurn) {
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 750, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isYourTurn, pulseAnim]);

  const toggleExpanded = (entryId: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const getPlayerName = (playerIndex: PlayerIndex | null): string => {
    if (playerIndex === null) {
      return '';
    }
    const nickname = nicknames.get(playerIndex);
    return nickname || `Player ${playerIndex + 1}`;
  };

  const formatCard = (card: { suit: string; rank: string }): string => {
    const suitName = SUIT_NAMES[card.suit as keyof typeof SUIT_NAMES] || card.suit;
    const rankName = RANK_NAMES[card.rank as keyof typeof RANK_NAMES] || card.rank;
    return `${rankName} ${suitName}`;
  };

  const formatMelds = (melds: Meld[]): string => {
    return melds.map((m) => `${formatMeldName(m, SUIT_NAMES)} (${m.points})`).join(', ');
  };

  const renderEntryMessage = (entry: GameLogEntry): React.ReactNode => {
    const name = getPlayerName(entry.playerIndex);

    switch (entry.data.kind) {
      case 'game_started':
        return (
          <Text style={styles.entryText}>
            {t('gameLog.gameStarted', {
              playerCount: entry.data.playerCount,
              targetScore: entry.data.targetScore,
            })}
          </Text>
        );

      case 'teams_announced':
        return (
          <Text style={styles.entryText}>
            {t('gameLog.teamsAnnounced', {
              team0: entry.data.team0.join(' & '),
              team1: entry.data.team1.join(' & '),
            })}
          </Text>
        );

      case 'round_started':
        return (
          <Text style={styles.entryText}>
            {t('gameLog.roundStarted', { round: entry.data.round })}
          </Text>
        );

      case 'bid_placed':
        return (
          <Text style={styles.entryText}>
            {t('gameLog.bidPlaced', { name, amount: entry.data.amount })}
          </Text>
        );

      case 'player_passed':
        return <Text style={styles.entryText}>{t('gameLog.playerPassed', { name })}</Text>;

      case 'bidding_won':
        return (
          <Text style={[styles.entryText, styles.highlightText]}>
            {t('gameLog.biddingWon', { name, bid: entry.data.winningBid })}
          </Text>
        );

      case 'trump_declared': {
        const suitName = SUIT_NAMES[entry.data.suit as keyof typeof SUIT_NAMES] || entry.data.suit;
        return (
          <Text style={styles.entryText}>
            {t('gameLog.trumpDeclared', { name, suit: suitName })}
          </Text>
        );
      }

      case 'dabb_taken': {
        const hasCards = entry.data.cards.length > 0;
        const isDabbOpen = expandedEntries.has(entry.id);
        return (
          <View>
            <View style={styles.meldRow}>
              <Text style={styles.entryText}>{t('gameLog.dabbTaken', { name })}</Text>
              {hasCards && (
                <TouchableOpacity
                  style={styles.meldToggle}
                  onPress={() => toggleExpanded(entry.id)}
                >
                  <Feather name={isDabbOpen ? 'minus' : 'plus'} size={10} color={Colors.inkFaint} />
                </TouchableOpacity>
              )}
            </View>
            {isDabbOpen && (
              <Text style={styles.meldDetails}>
                {entry.data.cards.map((c) => formatCard(c)).join(', ')}
              </Text>
            )}
          </View>
        );
      }

      case 'melds_declared': {
        if (entry.data.totalPoints === 0) {
          return <Text style={styles.entryText}>{t('gameLog.meldsNone', { name })}</Text>;
        }
        const hasMelds = entry.data.melds.length > 0;
        const isOpen = expandedEntries.has(entry.id);
        return (
          <View>
            <View style={styles.meldRow}>
              <Text style={styles.entryText}>
                {t('gameLog.meldsDeclared', { name, points: entry.data.totalPoints })}
              </Text>
              {hasMelds && (
                <TouchableOpacity
                  style={styles.meldToggle}
                  onPress={() => toggleExpanded(entry.id)}
                >
                  <Feather name={isOpen ? 'minus' : 'plus'} size={10} color={Colors.inkFaint} />
                </TouchableOpacity>
              )}
            </View>
            {isOpen && <Text style={styles.meldDetails}>{formatMelds(entry.data.melds)}</Text>}
          </View>
        );
      }

      case 'card_played':
        return (
          <Text style={styles.entryText}>
            {t('gameLog.cardPlayed', { name, card: formatCard(entry.data.card) })}
          </Text>
        );

      case 'trick_won':
        return (
          <Text style={[styles.entryText, styles.highlightText]}>
            {t('gameLog.trickWon', { name, points: entry.data.points })}
          </Text>
        );

      case 'round_scored':
        return (
          <Text style={[styles.entryText, styles.successText]}>{t('gameLog.roundScored')}</Text>
        );

      case 'game_finished': {
        const winnerName =
          typeof entry.data.winner === 'number'
            ? getPlayerName(entry.data.winner as PlayerIndex)
            : `Team ${(entry.data.winner as number) + 1}`;
        return (
          <Text style={[styles.entryText, styles.highlightText]}>
            {t('gameLog.gameFinished', { name: winnerName })}
          </Text>
        );
      }

      case 'game_terminated':
        return (
          <Text style={[styles.entryText, styles.errorText]}>
            {t('gameLog.gameTerminated', { name })}
          </Text>
        );

      default:
        return null;
    }
  };

  const getEntryStyle = (entry: GameLogEntry) => {
    switch (entry.data.kind) {
      case 'bidding_won':
      case 'trick_won':
      case 'game_finished':
        return [styles.entry, styles.highlightEntry];
      case 'round_scored':
        return [styles.entry, styles.successEntry];
      case 'game_terminated':
        return [styles.entry, styles.errorEntry];
      default:
        return styles.entry;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('gameLog.title')}</Text>
        {hasMoreEntries && !disableExpand && (
          <TouchableOpacity style={styles.toggleButton} onPress={() => setIsExpanded(!isExpanded)}>
            <View style={styles.toggleContent}>
              <Feather
                name={isExpanded ? 'chevron-down' : 'chevron-up'}
                size={10}
                color={Colors.inkFaint}
              />
              <Text style={styles.toggleText}>
                {isExpanded ? t('gameLog.showLess') : t('gameLog.showMore')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {isYourTurn && (
        <Animated.View style={[styles.turnBanner, { opacity: pulseAnim }]}>
          <Text style={styles.turnText}>{t('gameLog.yourTurn')}</Text>
        </Animated.View>
      )}

      <ScrollView
        style={[styles.entriesContainer, isExpanded && styles.entriesExpanded]}
        showsVerticalScrollIndicator
      >
        {displayEntries.length === 0 ? (
          <Text style={styles.emptyText}>{t('gameLog.noEntries')}</Text>
        ) : (
          displayEntries.map((entry) => (
            <View key={entry.id} style={getEntryStyle(entry)}>
              {renderEntryMessage(entry)}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.paperAged,
    marginHorizontal: 8,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    shadowColor: '#3c1e0a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: Colors.paperEdge,
    backgroundColor: Colors.paperFace,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  title: {
    fontSize: 10,
    fontFamily: Fonts.bodyBold,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleButton: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    backgroundColor: Colors.paperAged,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  toggleText: {
    fontSize: 9,
    fontFamily: Fonts.body,
    color: Colors.inkFaint,
  },
  turnBanner: {
    backgroundColor: Colors.amber,
    paddingVertical: 7,
    alignItems: 'center',
  },
  turnText: {
    color: Colors.inkDark,
    fontFamily: Fonts.display,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  entriesContainer: {
    maxHeight: 110,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  entriesExpanded: {
    maxHeight: 200,
  },
  entry: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 1,
    borderRadius: 2,
  },
  highlightEntry: {
    backgroundColor: 'rgba(212, 137, 10, 0.12)',
  },
  successEntry: {
    backgroundColor: 'rgba(58, 125, 68, 0.1)',
  },
  errorEntry: {
    backgroundColor: 'rgba(163, 32, 32, 0.1)',
  },
  entryText: {
    fontSize: 12,
    fontFamily: Fonts.handwriting,
    color: Colors.inkDark,
    lineHeight: 17,
  },
  highlightText: {
    color: Colors.amber,
    fontFamily: Fonts.handwritingBold,
  },
  successText: {
    color: Colors.success,
    fontFamily: Fonts.handwritingBold,
  },
  errorText: {
    color: Colors.error,
    fontFamily: Fonts.handwritingBold,
  },
  emptyText: {
    textAlign: 'center',
    padding: 12,
    fontFamily: Fonts.handwriting,
    color: Colors.inkFaint,
    fontSize: 12,
  },
  meldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meldToggle: {
    marginLeft: 6,
    width: 16,
    height: 16,
    backgroundColor: Colors.paperEdge,
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  meldDetails: {
    marginTop: 2,
    marginLeft: 8,
    paddingLeft: 8,
    fontSize: 10,
    fontFamily: Fonts.handwriting,
    color: Colors.inkFaint,
    borderLeftWidth: 2,
    borderLeftColor: Colors.paperEdge,
  },
});

export default GameLog;
