/**
 * Main game screen
 */

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { GameState, GameEvent, PlayerIndex, Suit, CardId } from '@dabb/shared-types';
import { DABB_SIZE, formatMeldName, SUITS, SUIT_NAMES } from '@dabb/shared-types';
import { getValidPlays, sortHand, detectMelds, calculateMeldPoints } from '@dabb/game-logic';
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
  LandscapeGameLayout,
} from '../components/game';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTurnNotification } from '../hooks/useTurnNotification';
import { DropZoneProvider } from '../contexts/DropZoneContext';
import { WoodBackground } from '../components/WoodBackground';
import { Colors, Fonts, Shadows } from '../theme';
import { playSound, isMuted, setMuted, loadSoundPreferences } from '../utils/sounds';

interface GameScreenProps {
  state: GameState;
  events: GameEvent[];
  playerIndex: PlayerIndex;
  nicknames: Map<PlayerIndex, string>;
  onBid: (amount: number) => void;
  onPass: () => void;
  onTakeDabb: () => void;
  onDiscard: (cardIds: CardId[]) => void;
  onGoOut: (suit: Suit) => void;
  onDeclareTrump: (suit: Suit) => void;
  onDeclareMelds: () => void;
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
  onTakeDabb,
  onDiscard,
  onGoOut,
  onDeclareTrump,
  onDeclareMelds,
  onPlayCard,
  onExitGame,
  onGoHome,
}: GameScreenProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<CardId[]>([]);
  const [showExpandedScoreboard, setShowExpandedScoreboard] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);

  useEffect(() => {
    if (isLandscape) {
      setPanelExpanded(true);
    }
  }, [isLandscape]);

  const dabbSize = DABB_SIZE[state.playerCount];

  // Load sound preferences on mount
  useEffect(() => {
    loadSoundPreferences().then(() => setSoundMuted(isMuted()));
  }, []);

  // Handle mute toggle
  const handleToggleMute = useCallback(async () => {
    const next = !isMuted();
    await setMuted(next);
    setSoundMuted(next);
  }, []);

  // Wire sounds to game events
  const processedEventCount = events.length;
  useEffect(() => {
    if (events.length === 0) {
      return;
    }
    const latestEvent = events[events.length - 1];
    switch (latestEvent.type) {
      case 'CARDS_DEALT':
        playSound('card-deal');
        break;
      case 'BID_PLACED':
        playSound('bid-place');
        break;
      case 'PLAYER_PASSED':
        playSound('pass');
        break;
      case 'CARD_PLAYED':
        playSound('card-play');
        break;
      case 'TRICK_WON':
        playSound('trick-win');
        break;
      case 'GAME_FINISHED':
        playSound('game-win');
        break;
      default:
        break;
    }
  }, [processedEventCount]); // intentional: only re-run when event count changes

  // Clear selected card when phase changes (e.g., between rounds)
  useEffect(() => {
    setSelectedCardId(null);
    setSelectedCards([]);
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

  const isMyTurn = state.currentPlayer === playerIndex || state.currentBidder === playerIndex;

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
          playSound('card-select');
          setSelectedCardId(cardId);
        }
      }
    },
    [state.phase, isMyTurn, isTrickPaused, selectedCardId, onPlayCard]
  );

  const handleMultiSelect = useCallback(
    (cardId: string) => {
      setSelectedCards((prev) => {
        if (prev.includes(cardId)) {
          return prev.filter((id) => id !== cardId);
        }
        if (prev.length >= dabbSize) {
          return prev;
        }
        return [...prev, cardId];
      });
    },
    [dabbSize]
  );

  const handleDiscard = useCallback(() => {
    if (selectedCards.length === dabbSize) {
      onDiscard(selectedCards);
      setSelectedCards([]);
    }
  }, [selectedCards, dabbSize, onDiscard]);

  const handleGoOutPress = useCallback(
    (suit: Suit) => {
      Alert.alert(t('game.goOutConfirmTitle'), t('game.goOutConfirmMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('game.goOutIn', { suit: SUIT_NAMES[suit] }),
          style: 'destructive',
          onPress: () => onGoOut(suit),
        },
      ]);
    },
    [t, onGoOut]
  );

  // Check if we can show the exit button (only during active game phases)
  const activePhases = ['dealing', 'bidding', 'dabb', 'trump', 'melding', 'tricks', 'scoring'];
  const canExit = activePhases.includes(state.phase);

  const renderPhaseContent = () => {
    switch (state.phase) {
      case 'waiting':
        return (
          <View style={styles.phasePanel}>
            <Text style={styles.phaseText}>{t('game.waitingForGameStart')}</Text>
          </View>
        );

      case 'dealing':
        return (
          <View style={styles.phasePanel}>
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

      case 'dabb':
        if (state.bidWinner === playerIndex) {
          if (state.dabb.length > 0) {
            return (
              <View style={styles.phasePanel}>
                <Text style={styles.phaseTitle}>{t('game.takeDabb')}</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                  onPress={onTakeDabb}
                >
                  <Text style={styles.actionButtonText}>
                    {t('game.takeDabbCards', { count: state.dabb.length })}
                  </Text>
                </Pressable>
              </View>
            );
          }
          return (
            <View style={styles.phasePanel}>
              <Text style={styles.phaseTitle}>{t('game.discardCards')}</Text>
              <Text style={styles.phaseText}>
                {t('game.selectCardsToDiscard', { count: dabbSize })}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  selectedCards.length !== dabbSize && styles.actionButtonDisabled,
                  pressed && selectedCards.length === dabbSize && styles.actionButtonPressed,
                ]}
                onPress={handleDiscard}
                disabled={selectedCards.length !== dabbSize}
              >
                <Text style={styles.actionButtonText}>
                  {t('game.selectedCount', {
                    selected: selectedCards.length,
                    total: dabbSize,
                  })}
                </Text>
              </Pressable>
              <View style={styles.goOutSection}>
                <Text style={styles.goOutLabel}>{t('game.orGoOut')}</Text>
                <View style={styles.goOutButtons}>
                  {SUITS.map((suit) => (
                    <Pressable
                      key={suit}
                      style={({ pressed }) => [
                        styles.goOutButton,
                        pressed && styles.goOutButtonPressed,
                      ]}
                      onPress={() => handleGoOutPress(suit)}
                    >
                      <Text style={styles.goOutButtonText}>{SUIT_NAMES[suit]}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          );
        }
        return (
          <View style={styles.phasePanel}>
            <Text style={styles.phaseText}>
              {t('game.waitingForPlayer', {
                name: nicknames.get(state.bidWinner!) || t('common.player'),
              })}
            </Text>
          </View>
        );

      case 'trump':
        if (state.bidWinner === playerIndex) {
          return <TrumpSelector onSelect={onDeclareTrump} />;
        }
        return (
          <View style={styles.phasePanel}>
            <Text style={styles.phaseText}>
              {t('game.choosingTrump', {
                name: nicknames.get(state.bidWinner!) || t('common.player'),
              })}
            </Text>
          </View>
        );

      case 'melding':
        if (!state.declaredMelds.has(playerIndex)) {
          const melds = state.trump ? detectMelds(myHand, state.trump) : [];
          const totalPoints = calculateMeldPoints(melds);
          return (
            <View style={styles.phasePanel}>
              <Text style={styles.phaseTitle}>{t('game.declareMelds')}</Text>
              {melds.length === 0 ? (
                <Text style={styles.phaseText}>{t('game.noMelds')}</Text>
              ) : (
                <View style={styles.meldList}>
                  {melds.map((meld, i) => (
                    <Text key={i} style={styles.meldItem}>
                      {formatMeldName(meld, SUIT_NAMES)} ({meld.points} {t('game.points')})
                    </Text>
                  ))}
                  <Text style={styles.meldTotal}>
                    {t('game.total')}: {totalPoints} {t('game.points')}
                  </Text>
                </View>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && styles.actionButtonPressed,
                ]}
                onPress={onDeclareMelds}
              >
                <Text style={styles.actionButtonText}>{t('game.confirmMelds')}</Text>
              </Pressable>
            </View>
          );
        }
        return (
          <View style={styles.phasePanel}>
            <Text style={styles.phaseText}>{t('game.waitingForOtherPlayers')}</Text>
          </View>
        );

      case 'tricks':
        return (
          <TrickArea
            trick={displayTrick}
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
              <Pressable
                style={({ pressed }) => [styles.homeButton, pressed && styles.homeButtonPressed]}
                onPress={onGoHome}
              >
                <View style={styles.buttonContent}>
                  <Feather name="home" size={16} color={Colors.inkDark} />
                  <Text style={styles.homeButtonText}>{t('game.backToHome')}</Text>
                </View>
              </Pressable>
            )}
          </View>
        );
      }

      default:
        return null;
    }
  };

  const handContent = (
    <>
      <PlayerHand
        cards={sortedHand}
        selectedCardId={selectedCardId}
        validCardIds={validCardIds}
        dabbCardIds={state.dabbCardIds}
        onCardSelect={handleCardSelect}
        selectionMode={
          state.phase === 'dabb' && state.dabb.length === 0 && state.bidWinner === playerIndex
            ? 'multiple'
            : 'single'
        }
        selectedCardIds={selectedCards}
        onMultiSelect={handleMultiSelect}
        draggable={state.phase === 'tricks' && isMyTurn && !isTrickPaused}
        onPlayCard={onPlayCard}
      />
      <Text style={[styles.hint, { opacity: state.phase === 'tricks' && selectedCardId ? 1 : 0 }]}>
        {t('game.tapAgainToPlay')}
      </Text>
    </>
  );

  return (
    <DropZoneProvider>
      <WoodBackground>
        {isLandscape ? (
          <LandscapeGameLayout
            state={state}
            events={events}
            playerIndex={playerIndex}
            nicknames={nicknames}
            panelExpanded={panelExpanded}
            onTogglePanel={() => setPanelExpanded((prev) => !prev)}
            isMyTurn={isMyTurn}
            soundMuted={soundMuted}
            onToggleMute={handleToggleMute}
            canExit={canExit}
            onExitGame={onExitGame}
            phaseContent={renderPhaseContent()}
            handContent={handContent}
          />
        ) : (
          <>
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
                <TouchableOpacity style={styles.muteButton} onPress={handleToggleMute}>
                  <Feather
                    name={soundMuted ? 'volume-x' : 'volume-2'}
                    size={14}
                    color={Colors.paperFace}
                  />
                </TouchableOpacity>
                <LanguageSwitcher compact />
                {canExit && onExitGame && (
                  <TouchableOpacity style={styles.exitButton} onPress={onExitGame}>
                    <View style={styles.buttonContent}>
                      <Feather name="log-out" size={12} color={Colors.paperFace} />
                      <Text style={styles.exitButtonText}>{t('game.exitGame')}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Compact scoreboard header - always rendered to avoid layout shifts */}
            <ScoreBoardHeader
              state={state}
              events={events}
              nicknames={nicknames}
              onExpand={() => setShowExpandedScoreboard(true)}
            />

            {/* Game Log below scoreboard header */}
            <GameLog
              state={state}
              events={events}
              currentPlayerIndex={playerIndex}
              nicknames={nicknames}
            />

            <View style={styles.gameArea}>{renderPhaseContent()}</View>

            <View style={styles.handContainer}>{handContent}</View>
          </>
        )}

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
      </WoodBackground>
    </DropZoneProvider>
  );
}

const styles = StyleSheet.create({
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.25)',
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
    color: Colors.paperAged,
    fontSize: 13,
    fontFamily: Fonts.handwritingBold,
  },
  turnIndicator: {
    color: Colors.amberLight,
    fontSize: 13,
    fontFamily: Fonts.display,
    letterSpacing: 0.5,
  },
  muteButton: {
    padding: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  exitButton: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  exitButtonText: {
    color: Colors.paperFace,
    fontSize: 11,
    fontFamily: Fonts.body,
  },
  gameArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  phaseContainer: {
    alignItems: 'center',
    maxWidth: '95%',
    width: '100%',
  },
  phasePanel: {
    backgroundColor: Colors.paperFace,
    borderRadius: 3,
    padding: 20,
    alignItems: 'center',
    maxWidth: '90%',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    ...Shadows.panel,
  },
  phaseTitle: {
    fontSize: 18,
    fontFamily: Fonts.display,
    color: Colors.inkDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  phaseText: {
    fontSize: 15,
    fontFamily: Fonts.handwriting,
    color: Colors.inkMid,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: Colors.amber,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 4,
    marginTop: 14,
    shadowColor: 'rgba(120,60,0,0.4)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  actionButtonPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  actionButtonDisabled: {
    backgroundColor: Colors.inkFaint,
    shadowOpacity: 0,
    elevation: 0,
  },
  actionButtonText: {
    color: Colors.inkDark,
    fontSize: 15,
    fontFamily: Fonts.bodyBold,
    textAlign: 'center',
  },
  goOutSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.paperEdge,
    paddingTop: 12,
    alignItems: 'center',
    width: '100%',
  },
  goOutLabel: {
    color: Colors.inkFaint,
    fontSize: 12,
    fontFamily: Fonts.handwriting,
    marginBottom: 8,
  },
  goOutButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  goOutButton: {
    backgroundColor: Colors.paperAged,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: Colors.paperEdge,
    shadowColor: Colors.paperEdge,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  goOutButtonPressed: {
    transform: [{ translateY: 1 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  goOutButtonText: {
    color: Colors.inkMid,
    fontSize: 14,
    fontFamily: Fonts.handwriting,
  },
  meldList: {
    marginTop: 8,
    marginBottom: 4,
    alignItems: 'center',
    width: '100%',
  },
  meldItem: {
    fontSize: 13,
    fontFamily: Fonts.handwriting,
    color: Colors.inkMid,
    marginVertical: 2,
  },
  meldTotal: {
    fontSize: 15,
    fontFamily: Fonts.handwritingBold,
    color: Colors.inkDark,
    marginTop: 8,
  },
  winnerText: {
    fontSize: 22,
    fontFamily: Fonts.display,
    color: Colors.amberLight,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  homeButton: {
    marginTop: 16,
    backgroundColor: Colors.amber,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 4,
    shadowColor: 'rgba(120,60,0,0.4)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  homeButtonPressed: {
    transform: [{ translateY: 2 }],
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  homeButtonText: {
    color: Colors.inkDark,
    fontSize: 15,
    fontFamily: Fonts.bodyBold,
  },
  handContainer: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingVertical: 8,
  },
  hint: {
    color: Colors.amberLight,
    fontSize: 11,
    fontFamily: Fonts.handwriting,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default GameScreen;
