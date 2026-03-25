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
}

export function useTrickAnimationState(
  currentTrick: Trick,
  lastCompletedTrick: CompletedTrick | null,
  phase: GamePhase,
  players: Player[]
): TrickAnimationResult {
  const [animPhase, setAnimPhase] = useState<TrickAnimPhase>('idle');
  const [displayCards, setDisplayCards] = useState<PlayedCard[]>([]);
  const [winnerIndex, setWinnerIndex] = useState<PlayerIndex | null>(null);
  const [winnerPlayerId, setWinnerPlayerId] = useState<string | null>(null);
  const [sweepingCardCount, setSweepingCardCount] = useState(0);

  const prevTrickKeyRef = useRef<string | null>(null);
  const initialLoadRef = useRef(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Track current trick cards during 'showing' phase
  useEffect(() => {
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
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
      }
      return;
    }

    const trickKey = lastCompletedTrick.cards.map((c) => c.cardId).join(',');

    // Skip stale trick on initial load (reconnection guard)
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      prevTrickKeyRef.current = trickKey;
      return;
    }

    if (trickKey === prevTrickKeyRef.current) {
      return;
    }
    prevTrickKeyRef.current = trickKey;

    clearAllTimers();

    const winner = players.find((p) => p.playerIndex === lastCompletedTrick.winnerIndex);
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
  }, [lastCompletedTrick, players, clearAllTimers]);

  // Cancel pause early if next card is played while paused
  useEffect(() => {
    if (animPhase === 'paused' && currentTrick.cards.length > 0) {
      clearAllTimers();
      setAnimPhase('showing');
      setDisplayCards(currentTrick.cards);
      setWinnerIndex(null);
      setWinnerPlayerId(null);
    }
  }, [animPhase, currentTrick.cards.length, clearAllTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  return { animPhase, displayCards, winnerIndex, winnerPlayerId, sweepingCardCount };
}
