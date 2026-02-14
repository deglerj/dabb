/**
 * Game log component for React Native
 * Shows player actions in real-time during the game
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { GameState, GameEvent, PlayerIndex, GameLogEntry, Meld } from '@dabb/shared-types';
import { formatMeldName, SUIT_NAMES, RANK_NAMES } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';
import { useGameLog } from '@dabb/ui-shared';

interface GameLogProps {
  state: GameState;
  events: GameEvent[];
  currentPlayerIndex: PlayerIndex;
  nicknames: Map<PlayerIndex, string>;
}

function GameLog({ state, events, currentPlayerIndex, nicknames }: GameLogProps) {
  const { t } = useTranslation();
  const { entries, latestEntries, isYourTurn } = useGameLog(events, state, currentPlayerIndex);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  const displayEntries = isExpanded ? entries : latestEntries;
  const hasMoreEntries = entries.length > latestEntries.length;

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
                  <Feather name={isDabbOpen ? 'minus' : 'plus'} size={10} color="#6b7280" />
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
                  <Feather name={isOpen ? 'minus' : 'plus'} size={10} color="#6b7280" />
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
        {hasMoreEntries && (
          <TouchableOpacity style={styles.toggleButton} onPress={() => setIsExpanded(!isExpanded)}>
            <View style={styles.toggleContent}>
              <Feather
                name={isExpanded ? 'chevron-down' : 'chevron-up'}
                size={10}
                color="#6b7280"
              />
              <Text style={styles.toggleText}>
                {isExpanded ? t('gameLog.showLess') : t('gameLog.showMore')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {isYourTurn && (
        <View style={styles.turnBanner}>
          <Text style={styles.turnText}>{t('gameLog.yourTurn')}</Text>
        </View>
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginHorizontal: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleText: {
    fontSize: 10,
    color: '#6b7280',
  },
  turnBanner: {
    backgroundColor: '#e94560',
    paddingVertical: 8,
    alignItems: 'center',
  },
  turnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  entriesContainer: {
    maxHeight: 120,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  entriesExpanded: {
    maxHeight: 200,
  },
  entry: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 2,
    borderRadius: 4,
  },
  highlightEntry: {
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
  },
  successEntry: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  errorEntry: {
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
  },
  entryText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 18,
  },
  highlightText: {
    color: '#dc2626',
    fontWeight: '500',
  },
  successText: {
    color: '#16a34a',
    fontWeight: '500',
  },
  errorText: {
    color: '#dc2626',
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    padding: 16,
    color: '#9ca3af',
    fontSize: 12,
  },
  meldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meldToggle: {
    marginLeft: 6,
    width: 18,
    height: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  meldToggleText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  meldDetails: {
    marginTop: 4,
    marginLeft: 8,
    paddingLeft: 8,
    fontSize: 10,
    color: '#9ca3af',
    borderLeftWidth: 2,
    borderLeftColor: '#e5e7eb',
  },
});

export default GameLog;
