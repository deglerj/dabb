import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type {
  CompletedTrick,
  GamePhase,
  Player,
  PlayerIndex,
  PlayedCard,
  Trick,
} from '@dabb/shared-types';

const PAUSE_DURATION = 3000;
const SWEEP_ARRIVAL_GAP = 200;
const SWEEP_CARD_DURATION = 400;
/**
 * Floor on how long a completed trick stays on the table, even when the next card is played
 * immediately. The pause is cancelled early so play never feels blocked, but a human winner
 * who leads instantly used to wipe the trick before anyone could read it. Bots pace themselves
 * (AI_TRICK_COMPLETE_DELAY_MS) and so never hit this.
 */
const MIN_TRICK_HOLD_MS = 1000;

export type TrickAnimPhase = 'idle' | 'showing' | 'paused' | 'sweeping';

export interface TrickAnimationResult {
  animPhase: TrickAnimPhase;
  /** Cards to render (current trick during showing, completed trick during pause/sweep) */
  displayCards: PlayedCard[];
  winnerIndex: PlayerIndex | null;
  /** Player ID of winner — key into wonPiles from deriveCardPositions */
  winnerPlayerId: string | null;
  /**
   * During 'sweeping': number of cards whose sweep target should be revealed.
   * Increments from 0 to displayCards.length over time (one per SWEEP_ARRIVAL_GAP ms).
   * Cards at index < sweepingCardCount should animate to the winner's corner.
   */
  sweepingCardCount: number;
  /**
   * True while the last trick of a round is still on the table but the game state has already
   * moved on. The round's final CARD_PLAYED, TRICK_WON, ROUND_SCORED, NEW_ROUND_STARTED and
   * CARDS_DEALT arrive as one cascade, so the next round's hand and bidding dialog would
   * otherwise appear under the sweep. Consumers hold those back until this clears.
   */
  holdsRoundStart: boolean;
}

export function useTrickAnimationState(
  currentTrick: Trick,
  lastCompletedTrick: CompletedTrick | null,
  phase: GamePhase,
  players: Player[],
  /**
   * True when the completed trick comes from a replayed TRICK_WON — one that was already in
   * the log when this client joined. The caller resolves it (see GameScreen) because
   * CompletedTrick carries no event id of its own.
   */
  isReplayedTrick: boolean
): TrickAnimationResult {
  const [animPhase, setAnimPhase] = useState<TrickAnimPhase>('idle');
  const [displayCards, setDisplayCards] = useState<PlayedCard[]>([]);
  const [winnerIndex, setWinnerIndex] = useState<PlayerIndex | null>(null);
  const [winnerPlayerId, setWinnerPlayerId] = useState<string | null>(null);
  const [sweepingCardCount, setSweepingCardCount] = useState(0);

  const prevTrickKeyRef = useRef<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pauseStartRef = useRef(0);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Track current trick cards during 'showing' phase.
  //
  // This has to be a layout effect, and it has to stay declared *before* the trick-detect
  // effect below. The last trick of a round arrives as one cascade — CARD_PLAYED, TRICK_WON,
  // ROUND_SCORED — so a single render carries both the completed trick and a phase that has
  // already left 'tricks'. This effect's `animPhase` is then the previous render's 'showing',
  // so the guard right below does not hold and it would reset to idle. As a passive effect it
  // ran after the trick-detect layout effect and won, wiping the round's final trick from the
  // table before it was ever painted. Same commit, declaration order, last write wins: the
  // trick-detect effect now overwrites this one back to 'paused'.
  useLayoutEffect(() => {
    if (animPhase === 'paused' || animPhase === 'sweeping') {
      return;
    }
    if (phase !== 'tricks') {
      if (animPhase !== 'idle') {
        setAnimPhase('idle');
        setDisplayCards([]);
      }
      return;
    }
    if (currentTrick.cards.length > 0) {
      setAnimPhase('showing');
      setDisplayCards(currentTrick.cards);
    }
  }, [currentTrick.cards, phase, animPhase]);

  // Detect new completed trick → start pause → then sweep
  useLayoutEffect(() => {
    if (!lastCompletedTrick) {
      return;
    }

    const trickKey = lastCompletedTrick.cards.map((c) => c.cardId).join(',');

    // Reconnection guard: a replayed log carries a trick that finished before we got here,
    // so adopt it without animating. The previous guard was a ref spent on the first render,
    // which always has an empty state and therefore no completed trick — by the time the log
    // landed it was gone, and every reload replayed a stale sweep.
    if (isReplayedTrick) {
      prevTrickKeyRef.current = trickKey;
      return;
    }

    if (trickKey === prevTrickKeyRef.current) {
      return;
    }
    prevTrickKeyRef.current = trickKey;

    clearAllTimers();

    const winner = players.find((p) => p.playerIndex === lastCompletedTrick.winnerIndex);
    pauseStartRef.current = Date.now();
    setAnimPhase('paused');
    setDisplayCards(lastCompletedTrick.cards);
    setWinnerIndex(lastCompletedTrick.winnerIndex);
    setWinnerPlayerId(winner?.id ?? null);
    setSweepingCardCount(0);

    const pauseTimer = setTimeout(() => {
      setAnimPhase('sweeping');
      const numCards = lastCompletedTrick.cards.length;

      // Stagger sweep: one card starts moving every SWEEP_ARRIVAL_GAP ms
      // Start from 1-based delay so sweepingCardCount is 0 when sweeping begins
      for (let i = 0; i < numCards; i++) {
        const t = setTimeout(
          () => {
            setSweepingCardCount((prev) => prev + 1);
          },
          (i + 1) * SWEEP_ARRIVAL_GAP
        );
        timersRef.current.push(t);
      }

      // After all cards arrive + animation finishes, return to idle
      const totalSweepMs = (numCards - 1) * SWEEP_ARRIVAL_GAP + SWEEP_CARD_DURATION;
      const doneTimer = setTimeout(() => {
        setAnimPhase('idle');
        setDisplayCards([]);
        setWinnerIndex(null);
        setWinnerPlayerId(null);
        setSweepingCardCount(0);
      }, totalSweepMs);
      timersRef.current.push(doneTimer);
    }, PAUSE_DURATION);

    timersRef.current.push(pauseTimer);
  }, [lastCompletedTrick, players, clearAllTimers, isReplayedTrick]);

  // Cancel pause early if next card is played while paused — but never before the completed
  // trick has been on the table for MIN_TRICK_HOLD_MS.
  const cards = currentTrick.cards;
  useEffect(() => {
    if (animPhase !== 'paused' || cards.length === 0) {
      return;
    }
    const showNext = () => {
      setAnimPhase('showing');
      setDisplayCards(cards);
      setWinnerIndex(null);
      setWinnerPlayerId(null);
    };
    // Drops the pending sweep timers; the hold timer is pushed after, so it survives.
    clearAllTimers();
    const remaining = MIN_TRICK_HOLD_MS - (Date.now() - pauseStartRef.current);
    if (remaining <= 0) {
      showNext();
      return;
    }
    timersRef.current.push(setTimeout(showNext, remaining));
  }, [animPhase, cards, clearAllTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  return {
    animPhase,
    displayCards,
    winnerIndex,
    winnerPlayerId,
    sweepingCardCount,
    holdsRoundStart: animPhase !== 'idle' && phase !== 'tricks',
  };
}
