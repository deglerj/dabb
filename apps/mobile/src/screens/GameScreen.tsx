/**
 * Main game screen
 */

import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import type { GameState, PlayerIndex, Suit } from '@dabb/shared-types';
import { getValidPlays, sortHand } from '@dabb/game-logic';
import { useTranslation } from '@dabb/i18n';
import { PlayerHand, BiddingPanel, TrumpSelector, TrickArea, ScoreBoard } from '../components/game';

interface GameScreenProps {
  state: GameState;
  playerIndex: PlayerIndex;
  nicknames: Map<PlayerIndex, string>;
  onBid: (amount: number) => void;
  onPass: () => void;
  onDeclareTrump: (suit: Suit) => void;
  onPlayCard: (cardId: string) => void;
}

function GameScreen({
  state,
  playerIndex,
  nicknames,
  onBid,
  onPass,
  onDeclareTrump,
  onPlayCard,
}: GameScreenProps) {
  const { t } = useTranslation();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const myHand = state.hands.get(playerIndex) || [];
  const sortedHand = useMemo(() => sortHand(myHand), [myHand]);

  const isMyTurn = state.currentPlayer === playerIndex;

  const validCardIds = useMemo(() => {
    if (state.phase !== 'tricks' || !isMyTurn || !state.trump) {
      return undefined;
    }
    const validCards = getValidPlays(myHand, state.currentTrick, state.trump);
    return validCards.map((c) => c.id);
  }, [state.phase, isMyTurn, state.trump, myHand, state.currentTrick]);

  const handleCardSelect = useCallback(
    (cardId: string) => {
      if (state.phase === 'tricks' && isMyTurn) {
        if (selectedCardId === cardId) {
          onPlayCard(cardId);
          setSelectedCardId(null);
        } else {
          setSelectedCardId(cardId);
        }
      }
    },
    [state.phase, isMyTurn, selectedCardId, onPlayCard]
  );

  const renderPhaseContent = () => {
    switch (state.phase) {
      case 'waiting':
        return (
          <View style={styles.phaseContainer}>
            <Text style={styles.phaseText}>{t('game.waitingForGameStart')}</Text>
          </View>
        );

      case 'dealing':
        return (
          <View style={styles.phaseContainer}>
            <Text style={styles.phaseText}>{t('game.dealing')}</Text>
          </View>
        );

      case 'bidding':
        return (
          <BiddingPanel
            currentBid={state.currentBid}
            isMyTurn={isMyTurn}
            onBid={onBid}
            onPass={onPass}
          />
        );

      case 'trump':
        if (state.bidWinner === playerIndex) {
          return <TrumpSelector onSelect={onDeclareTrump} />;
        }
        return (
          <View style={styles.phaseContainer}>
            <Text style={styles.phaseText}>
              {t('game.choosingTrump', {
                name: nicknames.get(state.bidWinner!) || t('common.player'),
              })}
            </Text>
          </View>
        );

      case 'tricks':
        return (
          <TrickArea
            trick={state.currentTrick}
            playerCount={state.playerCount}
            currentPlayerIndex={playerIndex}
            trump={state.trump}
          />
        );

      case 'scoring':
        return (
          <View style={styles.phaseContainer}>
            <Text style={styles.phaseText}>{t('game.roundOver')}</Text>
            <ScoreBoard
              scores={state.totalScores}
              targetScore={state.targetScore}
              nicknames={nicknames}
              currentPlayerIndex={playerIndex}
            />
          </View>
        );

      case 'finished': {
        const winner = Array.from(state.totalScores.entries()).find(
          ([, score]) => score >= state.targetScore
        );
        return (
          <View style={styles.phaseContainer}>
            <Text style={styles.winnerText}>
              {winner
                ? t('game.wins', {
                    name: nicknames.get(winner[0] as PlayerIndex) || t('common.player'),
                  })
                : t('game.gameOver')}
            </Text>
            <ScoreBoard
              scores={state.totalScores}
              targetScore={state.targetScore}
              nicknames={nicknames}
              currentPlayerIndex={playerIndex}
            />
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.phaseLabel}>
          {state.phase === 'bidding' && `${t('game.bid')}: ${state.currentBid}`}
          {state.phase === 'tricks' && state.trump && `${t('game.trump')}: ${state.trump}`}
        </Text>
        {isMyTurn && state.phase !== 'waiting' && state.phase !== 'dealing' && (
          <Text style={styles.turnIndicator}>{t('game.yourTurn')}</Text>
        )}
      </View>

      <View style={styles.gameArea}>{renderPhaseContent()}</View>

      <View style={styles.handContainer}>
        <PlayerHand
          cards={sortedHand}
          selectedCardId={selectedCardId}
          validCardIds={validCardIds}
          onCardSelect={handleCardSelect}
        />
        {state.phase === 'tricks' && selectedCardId && (
          <Text style={styles.hint}>{t('game.tapAgainToPlay')}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f766e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  phaseLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  turnIndicator: {
    color: '#fef08a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  gameArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  phaseContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: '90%',
  },
  phaseText: {
    fontSize: 18,
    color: '#374151',
    textAlign: 'center',
  },
  winnerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 16,
  },
  handContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 8,
  },
  hint: {
    color: '#fef08a',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default GameScreen;
