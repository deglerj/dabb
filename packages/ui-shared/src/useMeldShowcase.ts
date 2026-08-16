/**
 * Lays the other players' declared melds out on the table, one player at a time, once melding
 * is complete — the melds are in the game log too, but reading them there means opening it.
 *
 * Only the local player is skipped: they just saw their own melds in the melding overlay.
 *
 * Timing per player, adding up to MELD_SHOWCASE_DURATION_MS: the cards arc in from the owner's
 * seat (CardView does this on mount from initialX/initialY), hold, then retract to the seat
 * again for the last RETRACT_MS. The AI drivers pace the first trick card to the same total,
 * so a bot does not play over the showcase.
 */

import { useEffect, useRef, useState } from 'react';
import { MELD_SHOWCASE_DURATION_MS } from '@dabb/shared-types';
import type { CardId, GameEvent, Meld, PlayerIndex } from '@dabb/shared-types';

/** Matches CardView's default animationDuration — the retraction is its normal target-change move. */
export const RETRACT_MS = 400;

/** One row of cards on the felt: a player's melds (here) or the Dabb (useDabbShowcase). */
export interface TableShowcase {
  /** Whose seat the cards fly in from and retract to. */
  playerIndex: PlayerIndex;
  /** Card ids across all of this player's melds, deduped — a König can pay in two melds. */
  cards: CardId[];
  points: number;
  /** True for the last RETRACT_MS: the cards are on their way back to the owner's seat. */
  retracting: boolean;
}

type QueueEntry = Omit<TableShowcase, 'retracting'>;

/** Melds declared in the round that the event at `endIndex` completes, in seat order. */
function meldsOfRound(events: GameEvent[], endIndex: number): Map<PlayerIndex, Meld[]> {
  const declared = new Map<PlayerIndex, Meld[]>();
  for (let i = 0; i < endIndex; i++) {
    const event = events[i]!;
    if (event.type === 'CARDS_DEALT') {
      declared.clear();
    } else if (event.type === 'MELDS_DECLARED') {
      declared.set(event.payload.playerIndex, event.payload.melds);
    }
  }
  return declared;
}

export function useMeldShowcase(
  events: GameEvent[],
  playerIndex: PlayerIndex | null,
  /** Events already in the log when this client joined — those melds were shown without us. */
  replayedEventIds: Set<string>
): TableShowcase | null {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [retracting, setRetracting] = useState(false);
  const handledEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (playerIndex === null) {
      return;
    }
    let completeIndex = -1;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i]!.type === 'MELDING_COMPLETE') {
        completeIndex = i;
        break;
      }
    }
    if (completeIndex === -1) {
      return;
    }
    const complete = events[completeIndex]!;
    if (handledEventIdRef.current === complete.id) {
      return;
    }
    handledEventIdRef.current = complete.id;
    // Melding that finished before we joined is history: those melds were already shown.
    if (replayedEventIds.has(complete.id)) {
      return;
    }

    const entries: QueueEntry[] = [];
    for (const [seat, melds] of [...meldsOfRound(events, completeIndex)].sort(
      ([a], [b]) => a - b
    )) {
      if (seat === playerIndex || melds.length === 0) {
        continue;
      }
      entries.push({
        playerIndex: seat,
        cards: [...new Set(melds.flatMap((m) => m.cards))],
        points: melds.reduce((sum, m) => sum + m.points, 0),
      });
    }
    if (entries.length > 0) {
      setQueue(entries);
    }
  }, [events, playerIndex, replayedEventIds]);

  const current = queue[0];

  useEffect(() => {
    if (!current) {
      return;
    }
    setRetracting(false);
    const retractTimer = setTimeout(
      () => setRetracting(true),
      MELD_SHOWCASE_DURATION_MS - RETRACT_MS
    );
    const advanceTimer = setTimeout(() => setQueue((q) => q.slice(1)), MELD_SHOWCASE_DURATION_MS);
    return () => {
      clearTimeout(retractTimer);
      clearTimeout(advanceTimer);
    };
  }, [current]);

  return current ? { ...current, retracting } : null;
}
