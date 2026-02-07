/**
 * Hook to manage the 3-second trick display pause after a trick is completed.
 *
 * When a TRICK_WON event clears currentTrick, this hook keeps showing the
 * completed trick with the winning card highlighted for 3 seconds.
 */

import { useState, useEffect, useRef } from 'react';
import type { CompletedTrick, GamePhase, PlayerIndex, Trick } from '@dabb/shared-types';

const TRICK_DISPLAY_DURATION = 3000;

export interface TrickDisplayResult {
  /** The trick to render (either the completed trick during pause, or the current trick) */
  displayTrick: Trick;
  /** The winning player's index during pause, null otherwise */
  winnerPlayerIndex: PlayerIndex | null;
  /** Whether the display is currently paused showing a completed trick */
  isTrickPaused: boolean;
}

export function useTrickDisplay(
  currentTrick: Trick,
  lastCompletedTrick: CompletedTrick | null,
  phase: GamePhase
): TrickDisplayResult {
  const [paused, setPaused] = useState(false);
  const [displayedTrick, setDisplayedTrick] = useState<CompletedTrick | null>(null);
  const prevTrickRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    if (!lastCompletedTrick) {
      // No completed trick, nothing to show
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
      }
      return;
    }

    // Build a fingerprint from the card IDs to detect new tricks
    const trickKey = lastCompletedTrick.cards.map((c) => c.cardId).join(',');

    // Skip the initial load to avoid showing a stale trick on reconnection
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      prevTrickRef.current = trickKey;
      return;
    }

    // Only trigger pause for NEW completed tricks
    if (trickKey === prevTrickRef.current) {
      return;
    }

    prevTrickRef.current = trickKey;

    // Start the pause
    setPaused(true);
    setDisplayedTrick(lastCompletedTrick);

    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setPaused(false);
      setDisplayedTrick(null);
      timerRef.current = null;
    }, TRICK_DISPLAY_DURATION);
  }, [lastCompletedTrick]);

  // Cancel pause early if a new card is played during the pause
  useEffect(() => {
    if (paused && currentTrick.cards.length > 0) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setPaused(false);
      setDisplayedTrick(null);
    }
  }, [paused, currentTrick.cards.length]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (paused && displayedTrick) {
    return {
      displayTrick: {
        cards: displayedTrick.cards,
        leadSuit: displayedTrick.cards[0]?.card.suit ?? null,
        winnerIndex: displayedTrick.winnerIndex,
      },
      winnerPlayerIndex: displayedTrick.winnerIndex,
      isTrickPaused: true,
    };
  }

  // Not paused — but if the phase has moved past tricks (e.g. scoring),
  // don't show an empty trick area
  if (phase !== 'tricks') {
    return {
      displayTrick: { cards: [], leadSuit: null, winnerIndex: null },
      winnerPlayerIndex: null,
      isTrickPaused: false,
    };
  }

  return {
    displayTrick: currentTrick,
    winnerPlayerIndex: null,
    isTrickPaused: false,
  };
}
