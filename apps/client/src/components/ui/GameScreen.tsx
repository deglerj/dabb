/**
 * GameScreen — main game screen assembler.
 * Connects useGame hook to all sub-components: table, opponents, hand,
 * trick area, scoreboard, overlays, log, celebration, and termination modal.
 */
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { GameInterface } from '@dabb/ui-shared';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import {
  GameTable,
  useSkiaEffects,
  PhaseOverlay,
  BiddingOverlay,
  CardView,
  DabbOverlay,
  DiscardOverlay,
  getFeltBounds,
  TrumpOverlay,
  MeldingOverlay,
  edgeFraction,
} from '@dabb/game-canvas';
import {
  useGameLog,
  useTrickAnimationState,
  useRoundHistory,
  useCelebration,
} from '@dabb/ui-shared';
import { detectMelds, formatCard, formatSuit } from '@dabb/game-logic';
import type {
  PlayerIndex,
  Card,
  GameLogEntry,
  Suit,
  Rank,
  Team,
  TeamScoreEntry,
} from '@dabb/shared-types';
import { DABB_SIZE, SUIT_NAMES, formatMeldName } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';

import { useGameDimensions, MAX_GAME_WIDTH } from '../../hooks/useGameDimensions.js';
import { useTurnNotification } from '../../hooks/useTurnNotification.js';
import { useTurnHaptic } from '../../hooks/useTurnHaptic.js';
import { playSound } from '../../utils/sounds.js';
import { triggerHaptic } from '../../utils/haptics.js';
import { OpponentZone } from '../game/OpponentZone.js';
import { PlayerHand } from '../game/PlayerHand.js';
import { TrickAnimationLayer } from '../game/TrickAnimationLayer.js';
import { ScoreboardStrip } from '../game/ScoreboardStrip.js';
import { GameLogTab } from '../game/GameLogTab.js';
import type { RichLogEntry } from '../game/GameLogTab.js';
import { CelebrationLayer } from '../game/CelebrationLayer.js';
import { GameTerminatedModal } from '../game/GameTerminatedModal.js';
import { ScoreboardModal } from '../game/ScoreboardModal.js';
import { ReconnectingBanner } from '../game/ReconnectingBanner.js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OptionsButton } from './OptionsButton.js';
import GameScreenErrorBoundary from './GameScreenErrorBoundary.js';

export interface GameScreenProps {
  game: GameInterface;
  playerIndex: PlayerIndex;
}

/**
 * Compute opponent positions based on player count and screen dimensions.
 * Returns a map from opponent seat index to {x,y} pixel coordinates.
 * x uses the edge-push formula (15%–85%), y is 8% from the top.
 */
function computeOpponentPositions(
  playerCount: number,
  myIndex: PlayerIndex,
  width: number,
  height: number
): Map<PlayerIndex, { x: number; y: number }> {
  const positions = new Map<PlayerIndex, { x: number; y: number }>();
  const opponents: PlayerIndex[] = [];

  for (let i = 0; i < playerCount; i++) {
    if (i !== myIndex) {
      opponents.push(i as PlayerIndex);
    }
  }

  opponents.forEach((opIdx, i) => {
    positions.set(opIdx, {
      x: width * edgeFraction(i, opponents.length),
      y: height * 0.08,
    });
  });

  return positions;
}

/**
 * Format a GameLogEntry into a human-readable string.
 */
function formatLogEntryText(
  entry: GameLogEntry,
  nicknames: Map<PlayerIndex, string>,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const name =
    entry.playerIndex !== null ? (nicknames.get(entry.playerIndex) ?? `P${entry.playerIndex}`) : '';
  const d = entry.data;

  switch (d.kind) {
    case 'game_started':
      return t('gameLog.gameStarted', { playerCount: d.playerCount, targetScore: d.targetScore });
    case 'teams_announced':
      return t('gameLog.teamsAnnounced', { team0: d.team0.join(', '), team1: d.team1.join(', ') });
    case 'round_started':
      return t('gameLog.roundStarted', { round: d.round });
    case 'bid_placed':
      return t('gameLog.bidPlaced', { name, amount: d.amount });
    case 'player_passed':
      return t('gameLog.playerPassed', { name });
    case 'bidding_won':
      return t('gameLog.biddingWon', { name, bid: d.winningBid });
    case 'dabb_taken':
      return t('gameLog.dabbTaken', { name });
    case 'going_out':
      return t('gameLog.goingOut', { name, suit: formatSuit(d.suit) });
    case 'trump_declared':
      return t('gameLog.trumpDeclared', { name, suit: formatSuit(d.suit) });
    case 'melds_declared':
      return d.totalPoints === 0
        ? t('gameLog.meldsNone', { name })
        : t('gameLog.meldsDeclared', { name, points: d.totalPoints });
    case 'melds_summary':
      return d.playerMelds
        .map((pm) => {
          const pmName = nicknames.get(pm.playerIndex) ?? `P${pm.playerIndex}`;
          return pm.totalPoints === 0
            ? t('gameLog.meldsNone', { name: pmName })
            : t('gameLog.meldsDeclared', { name: pmName, points: pm.totalPoints });
        })
        .join(', ');
    case 'card_played':
      return t('gameLog.cardPlayed', { name, card: formatCard(d.card) });
    case 'trick_won':
      return t('gameLog.trickWon', { name, points: d.points });
    case 'round_scored':
      return t('gameLog.roundScored');
    case 'game_finished':
      return t('gameLog.gameFinished', {
        name: d.winnerNames.join(' & '),
      });
    case 'game_terminated':
      return t('gameLog.gameTerminated', { name });
    default: {
      const _exhaustive: never = d;
      void _exhaustive;
      return entry.type;
    }
  }
}

export default function GameScreen({ game, playerIndex }: GameScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { width, height } = useGameDimensions();
  const insets = useSafeAreaInsets();
  const effects = useSkiaEffects();

  const {
    state,
    events,
    isInitialLoad,
    nicknames,
    connected,
    terminatedByNickname,
    onBid,
    onPass,
    onTakeDabb,
    onDiscard,
    onGoOut,
    onDeclareTrump,
    onDeclareMelds,
    onPlayCard,
    onExit,
  } = game;

  const [logExpanded, setLogExpanded] = useState(false);
  const [lastDropPos, setLastDropPos] = useState<{ x: number; y: number } | undefined>(undefined);
  const [slottedCardIds, setSlottedCardIds] = useState<string[]>([]);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);

  // Round history
  const { rounds, currentRound } = useRoundHistory(events);

  // Game log
  const { entries: logEntries, lastImportantEntry } = useGameLog(events, state, playerIndex);
  const richLogEntries = useMemo(
    (): RichLogEntry[] =>
      logEntries.map((e) => ({
        key: e.id,
        text: formatLogEntryText(e, nicknames, t),
        detail:
          e.data.kind === 'melds_declared'
            ? e.data.melds.map((meld) => ({
                name: formatMeldName(meld, SUIT_NAMES),
                cards: meld.cards.map((cardId) => {
                  const [suit, rank, copy] = cardId.split('-');
                  return formatCard({
                    id: cardId,
                    suit: suit as Suit,
                    rank: rank as Rank,
                    copy: Number(copy) as 0 | 1,
                  });
                }),
                points: meld.points,
              }))
            : undefined,
      })),
    [logEntries, nicknames, t]
  );
  const collapsedSummary = useMemo(
    () => (lastImportantEntry ? formatLogEntryText(lastImportantEntry, nicknames, t) : undefined),
    [lastImportantEntry, nicknames, t]
  );

  // Opponent positions
  const opponentPositions = useMemo(
    () => computeOpponentPositions(state.playerCount, playerIndex, width, height),
    [state.playerCount, playerIndex, width, height]
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

  // Scoreboard data — always produce an entry per player (0 if not yet scored)
  const totalScores = useMemo(() => {
    return Array.from({ length: state.playerCount }, (_, i) => {
      const key = i as PlayerIndex;
      return { playerIndex: key, score: state.totalScores.get(key) ?? 0 };
    });
  }, [state.totalScores, state.playerCount]);

  // 4-player team mode: compute per-team score entries for scoreboard components
  const teamScores = useMemo((): TeamScoreEntry[] | undefined => {
    if (state.playerCount !== 4) {
      return undefined;
    }
    const myPlayer = state.players.find((p) => p.playerIndex === playerIndex);
    const myTeam = myPlayer?.team;
    const result: TeamScoreEntry[] = [];
    for (const team of [0, 1] as Team[]) {
      const members = state.players
        .filter((p) => p.team === team)
        .sort((a, b) => a.playerIndex - b.playerIndex);
      const names = members.map((p) => nicknames.get(p.playerIndex) ?? p.nickname).join(' & ');
      const score = state.totalScores.get(team) ?? 0;
      result.push({ team, names, score, isMyTeam: myTeam === team });
    }
    // Ensure local player's team is first
    return result.sort((a) => (a.isMyTeam ? -1 : 1));
  }, [state.players, state.totalScores, state.playerCount, playerIndex, nicknames]);

  const teamsByPlayerIndex = useMemo((): Map<PlayerIndex, Team> | undefined => {
    if (state.playerCount !== 4) {
      return undefined;
    }
    const map = new Map<PlayerIndex, Team>();
    for (const p of state.players) {
      if (p.team !== undefined) {
        map.set(p.playerIndex, p.team);
      }
    }
    return map;
  }, [state.players, state.playerCount]);

  // Is it my turn for bidding?
  const isMyBiddingTurn = state.phase === 'bidding' && state.currentBidder === playerIndex;

  // Is bid winner (for dabb/trump phases)?
  const isBidWinner = state.bidWinner === playerIndex;

  // Discard slot state handlers
  const discardCount = DABB_SIZE[state.playerCount];

  const handleSlotCard = useCallback(
    (cardId: string) => {
      setSlottedCardIds((prev) => {
        if (prev.length >= discardCount || prev.includes(cardId)) {
          return prev;
        }
        return [...prev, cardId];
      });
    },
    [discardCount]
  );

  const handleRemoveFromSlot = useCallback((cardId: string) => {
    setSlottedCardIds((prev) => prev.filter((id) => id !== cardId));
  }, []);

  const handleDiscard = useCallback(() => {
    onDiscard(slottedCardIds);
    setSlottedCardIds([]);
  }, [onDiscard, slottedCardIds]);

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
  const { confettiRound, showFireworks } = useCelebration(events, playerIndex);

  // Termination — derive winner info for 4-player (team) and 2/3-player (individual)
  const isTerminated = state.phase === 'terminated' || state.phase === 'finished';

  const winnerInfo = useMemo(() => {
    if (state.phase !== 'finished') {
      return null;
    }
    if (state.playerCount === 4) {
      // 4-player: totalScores keyed by Team
      const winningTeam =
        ([0, 1] as Team[]).find((t) => (state.totalScores.get(t) ?? 0) >= state.targetScore) ??
        null;
      if (winningTeam === null) {
        return null;
      }
      const myPlayer = state.players.find((p) => p.playerIndex === playerIndex);
      const isLocalWinner = myPlayer?.team === winningTeam;
      const winnerNicknames = state.players
        .filter((p) => p.team === winningTeam)
        .sort((a, b) => a.playerIndex - b.playerIndex)
        .map((p) => nicknames.get(p.playerIndex) ?? p.nickname);
      const winnerId = state.players.find((p) => p.team === winningTeam)?.id ?? null;
      return { winnerId, winnerNicknames, isLocalWinner };
    } else {
      // 2/3-player: totalScores keyed by PlayerIndex
      const winnerPlayer =
        state.players.find((p) => {
          const score = state.totalScores.get(p.playerIndex);
          return score !== undefined && score >= state.targetScore;
        }) ?? null;
      if (!winnerPlayer) {
        return null;
      }
      return {
        winnerId: winnerPlayer.id,
        winnerNicknames: [nicknames.get(winnerPlayer.playerIndex) ?? winnerPlayer.nickname],
        isLocalWinner: winnerPlayer.playerIndex === playerIndex,
      };
    }
  }, [
    state.phase,
    state.playerCount,
    state.totalScores,
    state.targetScore,
    state.players,
    playerIndex,
    nicknames,
  ]);

  const handleDone = useCallback(() => {
    router.replace('/');
  }, [router]);

  const handleExitGame = useCallback(() => {
    onExit();
    router.replace('/');
  }, [onExit, router]);

  const handleReload = useCallback(() => {
    router.replace('/');
  }, [router]);

  // Phase overlay
  const showBidding = state.phase === 'bidding';
  const showDabbTake = state.phase === 'dabb' && isBidWinner && state.dabb.length > 0;
  const showDiscard = state.phase === 'dabb' && isBidWinner && state.dabb.length === 0;
  const showTrump = state.phase === 'trump' && isBidWinner;

  // Reset slotted cards if discard phase exits unexpectedly (reconnect, phase advance)
  useEffect(() => {
    if (!showDiscard) {
      setSlottedCardIds([]);
    }
  }, [showDiscard]);
  const showMelding = state.phase === 'melding' && !(isBidWinner && state.wentOut);

  return (
    <GameScreenErrorBoundary
      state={state}
      events={events}
      connected={connected}
      onReload={handleReload}
    >
      {state.phase === 'waiting' ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#c97f00" />
          <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
            <OptionsButton onExitGame={handleExitGame} />
          </View>
        </View>
      ) : (
        <View style={styles.outerContainer}>
          <View style={styles.gameWrapper}>
            {/* Skia game table background */}
            <GameTable width={width} height={height} effects={effects} />

            {/* Reconnecting banner */}
            <ReconnectingBanner visible={!connected && !terminatedByNickname} />

            {/* Scoreboard strip at top */}
            <ScoreboardStrip
              totalScores={totalScores}
              myPlayerIndex={playerIndex}
              bidWinner={state.bidWinner}
              currentBid={state.currentBid}
              trump={state.trump}
              nicknames={nicknames}
              teamScores={teamScores}
              onPress={() => setScoreboardOpen(true)}
            />

            {/* Opponents */}
            {Array.from(opponentPositions.entries()).map(([opIdx, pos]) => {
              const player = state.players.find((p) => p.playerIndex === opIdx);
              const opCards = state.hands.get(opIdx);
              const myPlayer = state.players.find((p) => p.playerIndex === playerIndex);
              const isTeammate =
                state.playerCount === 4 &&
                myPlayer?.team !== undefined &&
                player?.team === myPlayer.team;
              return (
                <OpponentZone
                  key={opIdx}
                  playerIndex={opIdx}
                  nickname={nicknames.get(opIdx) ?? player?.nickname ?? `P${opIdx}`}
                  cardCount={opCards?.length ?? 0}
                  isConnected={player?.connected ?? false}
                  isTeammate={isTeammate}
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
              slottedCardIds={showDiscard ? slottedCardIds : undefined}
              onSlotCard={showDiscard ? handleSlotCard : undefined}
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

            <PhaseOverlay visible={showDabbTake}>
              <DabbOverlay visible={showDabbTake} dabbCards={state.dabb} onTake={onTakeDabb} />
            </PhaseOverlay>

            <DiscardOverlay
              visible={showDiscard}
              discardCount={discardCount}
              slottedCount={slottedCardIds.length}
              onDiscard={handleDiscard}
              onGoOut={onGoOut}
            />

            {/* Discard zone on the felt: outlines + placed cards */}
            {showDiscard &&
              (() => {
                const felt = getFeltBounds(width, height);
                const CARD_W = 70;
                const CARD_H = 105;
                const GAP = 14;
                const rowWidth = discardCount * CARD_W + (discardCount - 1) * GAP;
                const rowX = felt.x + (felt.width - rowWidth) / 2;
                const rowY = felt.y + (felt.height - CARD_H) / 2;
                return (
                  <>
                    {Array.from({ length: discardCount }, (_, i) => (
                      <View
                        key={`slot-${i}`}
                        style={{
                          position: 'absolute',
                          left: rowX + i * (CARD_W + GAP),
                          top: rowY,
                          width: CARD_W,
                          height: CARD_H,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: 'rgba(255,255,255,0.35)',
                          backgroundColor: 'rgba(255,255,255,0.06)',
                        }}
                        pointerEvents="none"
                      />
                    ))}
                    {slottedCardIds.map((cardId, i) => (
                      <CardView
                        key={cardId}
                        card={cardId}
                        targetX={rowX + i * (CARD_W + GAP)}
                        targetY={rowY}
                        targetRotation={0}
                        zIndex={200}
                        width={CARD_W}
                        height={CARD_H}
                        draggable={true}
                        onTap={() => {
                          triggerHaptic('card-select');
                          handleRemoveFromSlot(cardId);
                        }}
                        onDrop={() => {
                          handleRemoveFromSlot(cardId);
                        }}
                      />
                    ))}
                  </>
                );
              })()}

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
                entries={richLogEntries}
                collapsedSummary={collapsedSummary}
                isExpanded={logExpanded}
                onToggle={() => setLogExpanded((v) => !v)}
              />
            </View>

            {/* Celebration layer */}
            <CelebrationLayer
              confettiRound={confettiRound}
              showFireworks={showFireworks}
              isTeamGame={state.playerCount === 4}
            />

            {/* Scoreboard history modal */}
            <ScoreboardModal
              visible={scoreboardOpen}
              onClose={() => setScoreboardOpen(false)}
              rounds={rounds}
              currentRound={currentRound}
              nicknames={nicknames}
              playerCount={state.playerCount}
              totalScores={totalScores}
              teamScores={teamScores}
              teamsByPlayerIndex={teamsByPlayerIndex}
            />

            {/* Game terminated modal */}
            <GameTerminatedModal
              visible={isTerminated}
              winnerId={winnerInfo?.winnerId ?? null}
              winnerNicknames={winnerInfo?.winnerNicknames ?? []}
              isLocalWinner={winnerInfo?.isLocalWinner ?? false}
              terminatedByNickname={terminatedByNickname}
              onDone={handleDone}
            />
            <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
              <OptionsButton onExitGame={handleExitGame} />
            </View>
          </View>
        </View>
      )}
    </GameScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#1a0f05',
    alignItems: 'center',
  },
  gameWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_GAME_WIDTH,
    overflow: 'hidden',
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
