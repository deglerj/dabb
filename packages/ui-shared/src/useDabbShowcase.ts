/**
 * Lays the Dabb out on the table for everyone but the bid winner, once they pick it up.
 *
 * The Dabb is face up: the whole table gets to see the four cards before they disappear into
 * the winner's hand. The winner is skipped — they just saw them in the take-dabb overlay.
 *
 * Same shape and timing as useMeldShowcase, so both feed the one table showcase layer: the
 * cards arc in, hold, then retract to the bid winner's seat for the last RETRACT_MS.
 */

import { useEffect, useRef, useState } from 'react';
import { MELD_SHOWCASE_DURATION_MS } from '@dabb/shared-types';
import type { GameEvent, PlayerIndex } from '@dabb/shared-types';
import { RETRACT_MS, type TableShowcase } from './useMeldShowcase.js';

export function useDabbShowcase(
  events: GameEvent[],
  playerIndex: PlayerIndex | null,
  /** Events already in the log when this client joined — that dabb was shown without us. */
  replayedEventIds: Set<string>
): TableShowcase | null {
  const [showcase, setShowcase] = useState<Omit<TableShowcase, 'retracting'> | null>(null);
  const [retracting, setRetracting] = useState(false);
  const handledEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (playerIndex === null) {
      return;
    }
    let taken: GameEvent | undefined;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i]!.type === 'DABB_TAKEN') {
        taken = events[i];
        break;
      }
    }
    if (!taken || taken.type !== 'DABB_TAKEN' || handledEventIdRef.current === taken.id) {
      return;
    }
    handledEventIdRef.current = taken.id;
    // Taken before we joined, or taken by us: nothing to show.
    if (replayedEventIds.has(taken.id) || taken.payload.playerIndex === playerIndex) {
      return;
    }

    setShowcase({
      playerIndex: taken.payload.playerIndex,
      cards: taken.payload.dabbCards.map((c) => c.id),
      points: 0,
    });
  }, [events, playerIndex, replayedEventIds]);

  useEffect(() => {
    if (!showcase) {
      return;
    }
    setRetracting(false);
    const retractTimer = setTimeout(
      () => setRetracting(true),
      MELD_SHOWCASE_DURATION_MS - RETRACT_MS
    );
    const clearTimer = setTimeout(() => setShowcase(null), MELD_SHOWCASE_DURATION_MS);
    return () => {
      clearTimeout(retractTimer);
      clearTimeout(clearTimer);
    };
  }, [showcase]);

  return showcase ? { ...showcase, retracting } : null;
}
