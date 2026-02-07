/**
 * Main game screen
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Modal, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { GameState, GameEvent, PlayerIndex, Suit } from '@dabb/shared-types';
import { getValidPlays, sortHand } from '@dabb/game-logic';
import { useTrickDisplay } from '@dabb/ui-shared';
import { useTranslation } from '@dabb/i18n';
import {
  PlayerHand,
  BiddingPanel,
  TrumpSelector,
  TrickArea,
  ScoreBoard,
  ScoreBoardHeader,
  GameLog,
  CelebrationOverlay,
} from '../components/game';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTurnNotification } from '../hooks/useTurnNotification';

interface GameScreenProps {
  state: GameState;
  events: GameEvent[];
  playerIndex: PlayerIndex;
  nicknames: Map<PlayerIndex, string>;
  onBid: (amount: number) => void;
  onPass: () => void;
  onDeclareTrump: (suit: Suit) => void;
  onPlayCard: (cardId: string) => void;
  onExitGame?: () => void;
  onGoHome?: () => void;
}

function GameScreen({
  state,
  events,
  playerIndex,
  nicknames,
  onBid,
  onPass,
  onDeclareTrump,
  onPlayCard,
  onExitGame,
  onGoHome,
}: GameScreenProps) {
  const { t } = useTranslation();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showExpandedScoreboard, setShowExpandedScoreboard] = useState(false);

  // Clear selected card when phase changes (e.g., between rounds)
  useEffect(() => {
    setSelectedCardId(null);
  }, [state.phase]);

  const myHand = state.hands.get(playerIndex) || [];
  const sortedHand = useMemo(() => sortHand(myHand), [myHand]);

  // Play notification sound when it's the player's turn
  useTurnNotification(state, playerIndex);

  // Manage trick display with 4-second pause after completion
  const { displayTrick, winnerPlayerIndex, isTrickPaused } = useTrickDisplay(
    state.currentTrick,
    state.lastCompletedTrick,
    state.phase
  );

  const isMyTurn = state.currentPlayer === playerIndex;

  const validCardIds = useMemo(() => {
    if (state.phase !== 'tricks' || !isMyTurn || !state.trump || isTrickPaused) {
      return undefined;
    }
    const validCards = getValidPlays(myHand, state.currentTrick, state.trump);
    return validCards.map((c) => c.id);
  }, [state.phase, isMyTurn, state.trump, myHand, state.currentTrick, isTrickPaused]);

  const handleCardSelect = useCallback(
    (cardId: string) => {
      if (state.phase === 'tricks' && isMyTurn && !isTrickPaused) {
        if (selectedCardId === cardId) {
          onPlayCard(cardId);
          setSelectedCardId(null);
        } else {
          setSelectedCardId(cardId);
        }
      }
    },
    [state.phase, isMyTurn, isTrickPaused, selectedCardId, onPlayCard]
  );

  // Determine if we should show the compact header or full scoreboard
  const showScoreboardHeader =
    state.phase !== 'waiting' &&
    state.phase !== 'dealing' &&
    state.phase !== 'scoring' &&
    state.phase !== 'finished';

  // Check if we can show the exit button (only during active game phases)
  const activePhases = ['dealing', 'bidding', 'dabb', 'trump', 'melding', 'tricks', 'scoring'];
  const canExit = activePhases.includes(state.phase);

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
            trick={displayTrick}
            playerCount={state.playerCount}
            currentPlayerIndex={playerIndex}
            nicknames={nicknames}
            trump={state.trump}
            winnerPlayerIndex={winnerPlayerIndex}
          />
        );

      case 'scoring':
        if (isTrickPaused) {
          return (
            <TrickArea
              trick={displayTrick}
              playerCount={state.playerCount}
              currentPlayerIndex={playerIndex}
              nicknames={nicknames}
              trump={state.trump}
              winnerPlayerIndex={winnerPlayerIndex}
            />
          );
        }
        return (
          <View style={styles.phaseContainer}>
            <Text style={styles.phaseText}>{t('game.roundOver')}</Text>
            <ScoreBoard
              state={state}
              events={events}
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
              state={state}
              events={events}
              nicknames={nicknames}
              currentPlayerIndex={playerIndex}
            />
            {onGoHome && (
              <TouchableOpacity style={styles.homeButton} onPress={onGoHome}>
                <View style={styles.buttonContent}>
                  <Feather name="home" size={16} color="#fff" />
                  <Text style={styles.homeButtonText}>{t('game.backToHome')}</Text>
                </View>
              </TouchableOpacity>
            )}
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
        <View style={styles.headerLeft}>
          <Text style={styles.phaseLabel}>
            {state.phase === 'bidding' && `${t('game.bid')}: ${state.currentBid}`}
            {state.phase === 'tricks' && state.trump && `${t('game.trump')}: ${state.trump}`}
          </Text>
          {isMyTurn && state.phase !== 'waiting' && state.phase !== 'dealing' && (
            <Text style={styles.turnIndicator}>{t('game.yourTurn')}</Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <LanguageSwitcher compact />
          {canExit && onExitGame && (
            <TouchableOpacity style={styles.exitButton} onPress={onExitGame}>
              <View style={styles.buttonContent}>
                <Feather name="log-out" size={12} color="#fff" />
                <Text style={styles.exitButtonText}>{t('game.exitGame')}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Compact scoreboard header during active play */}
      {showScoreboardHeader && (
        <ScoreBoardHeader
          state={state}
          events={events}
          nicknames={nicknames}
          onExpand={() => setShowExpandedScoreboard(true)}
        />
      )}

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

      {/* Game Log overlay */}
      <GameLog
        state={state}
        events={events}
        currentPlayerIndex={playerIndex}
        nicknames={nicknames}
      />

      {/* Expanded scoreboard modal */}
      <Modal
        visible={showExpandedScoreboard}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowExpandedScoreboard(false)}
      >
        <View style={styles.modalOverlay}>
          <ScoreBoard
            state={state}
            events={events}
            nicknames={nicknames}
            currentPlayerIndex={playerIndex}
            onCollapse={() => setShowExpandedScoreboard(false)}
          />
        </View>
      </Modal>

      {/* Celebration animations */}
      <CelebrationOverlay events={events} playerIndex={playerIndex} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f766e',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  exitButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  exitButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  homeButton: {
    marginTop: 16,
    backgroundColor: '#0f766e',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default GameScreen;
