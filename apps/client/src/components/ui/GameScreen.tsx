/**
 * GameScreen — main game screen assembler.
 * Connects useGame hook to all sub-components: table, opponents, hand,
 * trick area, scoreboard, overlays, log, celebration, and termination modal.
 */
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import {
  GameTable,
  useSkiaEffects,
  PhaseOverlay,
  BiddingOverlay,
  DabbOverlay,
  TrumpOverlay,
  MeldingOverlay,
} from '@dabb/game-canvas';
import {
  useGameLog,
  useTrickAnimationState,
  useRoundHistory,
  useCelebration,
} from '@dabb/ui-shared';
import { detectMelds } from '@dabb/game-logic';
import type { PlayerIndex, Card, GameLogEntry } from '@dabb/shared-types';

import { useGame } from '../../hooks/useGame.js';
import { useTurnNotification } from '../../hooks/useTurnNotification.js';
import { useTurnHaptic } from '../../hooks/useTurnHaptic.js';
import { playSound } from '../../utils/sounds.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { OpponentZone } from '../game/OpponentZone.js';
import { PlayerHand } from '../game/PlayerHand.js';
import { TrickAnimationLayer } from '../game/TrickAnimationLayer.js';
import { ScoreboardStrip } from '../game/ScoreboardStrip.js';
import { GameLogTab } from '../game/GameLogTab.js';
import { CelebrationLayer } from '../game/CelebrationLayer.js';
import { GameTerminatedModal } from '../game/GameTerminatedModal.js';
import { ScoreboardModal } from '../game/ScoreboardModal.js';
import { ReconnectingBanner } from '../game/ReconnectingBanner.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OptionsButton } from './OptionsButton.js';

export interface GameScreenProps {
  sessionId: string;
  secretId: string;
  playerIndex: PlayerIndex;
}

/**
 * Compute opponent positions based on player count.
 * Returns a map from opponent seat index to {x,y} coordinates.
 */
function computeOpponentPositions(
  playerCount: number,
  myIndex: PlayerIndex
): Map<PlayerIndex, { x: number; y: number }> {
  const positions = new Map<PlayerIndex, { x: number; y: number }>();
  const opponents: PlayerIndex[] = [];

  for (let i = 0; i < playerCount; i++) {
    if (i !== myIndex) {
      opponents.push(i as PlayerIndex);
    }
  }

  if (opponents.length === 1) {
    // 2-player: one opponent at top-center
    positions.set(opponents[0], { x: 180, y: 60 });
  } else if (opponents.length === 2) {
    // 3-player: opponents at top-left and top-right
    positions.set(opponents[0], { x: 100, y: 60 });
    positions.set(opponents[1], { x: 260, y: 60 });
  } else if (opponents.length === 3) {
    // 4-player: opponents at top-left, top-center, top-right
    positions.set(opponents[0], { x: 60, y: 60 });
    positions.set(opponents[1], { x: 180, y: 60 });
    positions.set(opponents[2], { x: 300, y: 60 });
  }

  return positions;
}

/**
 * Format a GameLogEntry into a human-readable string.
 */
function formatLogEntryText(entry: GameLogEntry, nicknames: Map<PlayerIndex, string>): string {
  const name =
    entry.playerIndex !== null ? (nicknames.get(entry.playerIndex) ?? `P${entry.playerIndex}`) : '';
  const d = entry.data;

  switch (d.kind) {
    case 'game_started':
      return `Game started (${d.playerCount} players)`;
    case 'round_started':
      return `Round ${d.round} started`;
    case 'bid_placed':
      return `${name} bids ${d.amount}`;
    case 'player_passed':
      return `${name} passed`;
    case 'bidding_won':
      return `${name} wins bidding at ${d.winningBid}`;
    case 'dabb_taken':
      return `${name} took the Dabb`;
    case 'going_out':
      return `${name} goes out`;
    case 'trump_declared':
      return `${name} declares ${d.suit} as trump`;
    case 'melds_declared':
      return `${name} declares melds (${d.totalPoints} pts)`;
    case 'card_played':
      return `${name} plays a card`;
    case 'trick_won':
      return `${name} wins trick (${d.points} pts)`;
    case 'round_scored':
      return 'Round scored';
    case 'game_finished':
      return 'Game finished!';
    case 'game_terminated':
      return 'Game terminated';
    case 'teams_announced':
      return 'Teams announced';
    default:
      return entry.type;
  }
}

export default function GameScreen({ sessionId, secretId, playerIndex }: GameScreenProps) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const effects = useSkiaEffects();

  const {
    state,
    events,
    isInitialLoad,
    nicknames,
    connected,
    onBid,
    onPass,
    onTakeDabb,
    onDiscard,
    onGoOut,
    onDeclareTrump,
    onDeclareMelds,
    onPlayCard,
  } = useGame({ sessionId, secretId, playerIndex });

  const [logExpanded, setLogExpanded] = useState(false);
  const [lastDropPos, setLastDropPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [dabbSelectedCards, setDabbSelectedCards] = useState<string[]>([]);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

  // Round history
  const { rounds, currentRound } = useRoundHistory(events);

  // Game log
  const { entries: logEntries } = useGameLog(events, state, playerIndex);
  const logStrings = useMemo(
    () => logEntries.map((e) => formatLogEntryText(e, nicknames)),
    [logEntries, nicknames]
  );

  // Opponent positions
  const opponentPositions = useMemo(
    () => computeOpponentPositions(state.playerCount, playerIndex),
    [state.playerCount, playerIndex]
  );

  // Player's hand cards
  const myCards: Card[] = useMemo(
    () => state.hands.get(playerIndex) ?? [],
    [state.hands, playerIndex]
  );

  // Trick animation state machine
  const trickAnimState = useTrickAnimationState(
    state.currentTrick,
    state.lastCompletedTrick,
    state.phase,
    state.players
  );

  useTurnNotification(state, playerIndex, isInitialLoad);
  useTurnHaptic(state, playerIndex, isInitialLoad);

  // Sound effects: play on new events, suppressed during initial load on reconnect.
  const lastSoundedEventIdx = useRef(events.length);
  useEffect(() => {
    const newEvents = events.slice(lastSoundedEventIdx.current);
    lastSoundedEventIdx.current = events.length;
    if (isInitialLoad) {
      return;
    }
    for (const event of newEvents) {
      switch (event.type) {
        case 'CARDS_DEALT':
          playSound('card-deal');
          triggerHaptic('card-deal');
          break;
        case 'CARD_PLAYED':
          playSound('card-play');
          triggerHaptic('card-play');
          break;
        case 'BID_PLACED':
          playSound('bid-place');
          triggerHaptic('bid-place');
          break;
        case 'PLAYER_PASSED':
          playSound('pass');
          triggerHaptic('pass');
          break;
        case 'TRICK_WON':
          playSound('trick-win');
          triggerHaptic('trick-win');
          break;
        case 'GAME_FINISHED':
          playSound('game-win');
          triggerHaptic('game-win');
          break;
      }
    }
  }, [events, isInitialLoad]);

  // Scoreboard data
  const roundScores = useMemo(() => {
    const result: Array<{ playerIndex: PlayerIndex; score: number }> = [];
    state.roundScores.forEach((rs, key) => {
      // Only include PlayerIndex entries (not Team entries for 4-player)
      if (typeof key === 'number' && key < state.playerCount) {
        result.push({ playerIndex: key as PlayerIndex, score: rs.total });
      }
    });
    return result;
  }, [state.roundScores, state.playerCount]);

  const totalScores = useMemo(() => {
    const result: Array<{ playerIndex: PlayerIndex; score: number }> = [];
    state.totalScores.forEach((score, key) => {
      if (typeof key === 'number' && key < state.playerCount) {
        result.push({ playerIndex: key as PlayerIndex, score });
      }
    });
    return result;
  }, [state.totalScores, state.playerCount]);

  // Is it my turn for bidding?
  const isMyBiddingTurn = state.phase === 'bidding' && state.currentBidder === playerIndex;

  // Is bid winner (for dabb/trump phases)?
  const isBidWinner = state.bidWinner === playerIndex;

  // Dabb overlay step
  const dabbStep =
    state.dabb.length > 0 &&
    state.hands.get(playerIndex)?.length ===
      // After taking dabb, hand size increases by dabb size
      (state.playerCount === 2 ? 22 : state.playerCount === 3 ? 16 : 13)
      ? ('discard' as const)
      : ('take' as const);

  // Dabb cards (visible after taking)
  const dabbCards = useMemo(() => {
    if (dabbStep === 'discard') {
      // Show the dabb cards that are now in the player's hand (marked by dabbCardIds)
      return myCards.filter((c) => state.dabbCardIds.includes(c.id));
    }
    return state.dabb;
  }, [dabbStep, myCards, state.dabb, state.dabbCardIds]);

  const handleToggleDabbCard = useCallback((cardId: string) => {
    setDabbSelectedCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  }, []);

  const handleDiscard = useCallback(() => {
    onDiscard(dabbSelectedCards);
    setDabbSelectedCards([]);
  }, [onDiscard, dabbSelectedCards]);

  // Melds detection for melding overlay
  const detectedMelds = useMemo(() => {
    if (state.phase !== 'melding' || !state.trump) {
      return [];
    }
    return detectMelds(myCards, state.trump);
  }, [state.phase, state.trump, myCards]);

  const meldTotalPoints = useMemo(
    () => detectedMelds.reduce((sum, m) => sum + m.points, 0),
    [detectedMelds]
  );

  const handleConfirmMelds = useCallback(() => {
    onDeclareMelds(detectedMelds);
  }, [onDeclareMelds, detectedMelds]);

  // Celebration: show confetti for round win, fireworks for game win
  const { showConfetti, showFireworks } = useCelebration(events, playerIndex);

  // Termination
  const isTerminated = state.phase === 'terminated' || state.phase === 'finished';
  const winnerPlayer =
    state.phase === 'finished'
      ? state.players.find((p) => {
          const score = state.totalScores.get(p.playerIndex);
          return score !== undefined && score >= state.targetScore;
        })
      : null;

  const handleDone = useCallback(() => {
    router.replace('/');
  }, [router]);

  // Loading state
  if (state.phase === 'waiting') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#c97f00" />
        <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
          <OptionsButton />
        </View>
      </View>
    );
  }

  // Phase overlay
  const showBidding = state.phase === 'bidding';
  const showDabb = state.phase === 'dabb' && isBidWinner;
  const showTrump = state.phase === 'trump' && isBidWinner;
  const showMelding = state.phase === 'melding';

  return (
    <View style={styles.container}>
      {/* Skia game table background */}
      <GameTable width={width} height={height} effects={effects} />

      {/* Reconnecting banner */}
      <ReconnectingBanner visible={!connected} />

      {/* Scoreboard strip at top */}
      <ScoreboardStrip
        roundScores={roundScores}
        totalScores={totalScores}
        myPlayerIndex={playerIndex}
        targetScore={state.targetScore}
        onPress={() => setScoreboardOpen(true)}
      />

      {/* Opponents */}
      {Array.from(opponentPositions.entries()).map(([opIdx, pos]) => {
        const player = state.players[opIdx];
        const opCards = state.hands.get(opIdx);
        return (
          <OpponentZone
            key={opIdx}
            playerIndex={opIdx}
            nickname={nicknames.get(opIdx) ?? player?.nickname ?? `P${opIdx}`}
            cardCount={opCards?.length ?? 0}
            isConnected={player?.connected ?? false}
            position={pos}
          />
        );
      })}

      {/* Trick animation layer */}
      <TrickAnimationLayer
        animState={trickAnimState}
        myPlayerIndex={playerIndex}
        players={state.players}
        playerCount={state.playerCount as 3 | 4}
        effects={effects}
        localPlayerDropOrigin={lastDropPos}
      />

      {/* Player hand */}
      <PlayerHand
        gameState={state}
        playerIndex={playerIndex}
        cards={myCards}
        onPlayCard={(cardId, dropPos) => {
          if (dropPos) {
            setLastDropPos(dropPos);
          }
          onPlayCard(cardId);
        }}
        effects={effects}
      />

      {/* Phase overlays */}
      <PhaseOverlay visible={showBidding}>
        <BiddingOverlay
          currentBid={state.currentBid}
          isMyTurn={isMyBiddingTurn}
          onBid={onBid}
          onPass={onPass}
        />
      </PhaseOverlay>

      <PhaseOverlay visible={showDabb}>
        <DabbOverlay
          step={dabbStep}
          dabbCards={dabbCards}
          selectedCardIds={dabbSelectedCards}
          onToggleCard={handleToggleDabbCard}
          onTake={onTakeDabb}
          onDiscard={handleDiscard}
          onGoOut={onGoOut}
        />
      </PhaseOverlay>

      <PhaseOverlay visible={showTrump}>
        <TrumpOverlay onSelectTrump={onDeclareTrump} />
      </PhaseOverlay>

      <PhaseOverlay visible={showMelding}>
        <MeldingOverlay
          melds={detectedMelds}
          totalPoints={meldTotalPoints}
          canConfirm={true}
          onConfirm={handleConfirmMelds}
        />
      </PhaseOverlay>

      {/* Game log */}
      <View style={styles.logContainer}>
        <GameLogTab
          entries={logStrings}
          isExpanded={logExpanded}
          onToggle={() => setLogExpanded((v) => !v)}
        />
      </View>

      {/* Celebration layer */}
      <CelebrationLayer showConfetti={showConfetti} showFireworks={showFireworks} />

      {/* Scoreboard history modal */}
      <ScoreboardModal
        visible={scoreboardOpen}
        onClose={() => setScoreboardOpen(false)}
        rounds={rounds}
        currentRound={currentRound}
        nicknames={nicknames}
        playerCount={state.playerCount}
        totalScores={totalScores}
      />

      {/* Game terminated modal */}
      <GameTerminatedModal
        visible={isTerminated}
        winnerId={winnerPlayer?.id ?? null}
        winnerNickname={winnerPlayer?.nickname ?? null}
        isLocalWinner={winnerPlayer?.playerIndex === playerIndex}
        onDone={handleDone}
      />
      <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
        <OptionsButton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0f05',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a0f05',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  optionsButtonContainer: {
    position: 'absolute',
    right: 16,
  },
});
