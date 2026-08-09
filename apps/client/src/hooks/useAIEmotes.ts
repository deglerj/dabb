/**
 * useAIEmotes — drives bot reactions from the event log, on every client independently.
 *
 * There is no transport and no cascade claim here on purpose: pickAIEmote is deterministic,
 * so each client derives the same reaction for the same event and they agree without talking.
 * The replay guard lives inside pickAIEmote (event age), which is what keeps a refresh or a
 * reconnect from firing a whole round's worth of reactions at once.
 */

import { useEffect, useRef } from 'react';
import { pickAIEmote } from '@dabb/game-ai';
import type { EmoteKey, GameEvent, GameState, PlayerIndex } from '@dabb/shared-types';

export function useAIEmotes(
  events: GameEvent[],
  state: GameState,
  aiPlayerIndices: PlayerIndex[],
  post: (playerIndex: PlayerIndex, key: EmoteKey) => void
): void {
  // High-water mark so an event is only ever considered once, even though `events` is a
  // growing array that this effect re-reads on every change.
  const seenCount = useRef(0);

  useEffect(() => {
    // The log can shrink or be replaced outright (leaving a game, starting a new offline
    // one); rewind rather than skipping the whole new log.
    if (events.length < seenCount.current) {
      seenCount.current = 0;
    }
    const fresh = events.slice(seenCount.current);
    seenCount.current = events.length;

    if (aiPlayerIndices.length === 0) {
      return;
    }

    for (const event of fresh) {
      for (const aiIndex of aiPlayerIndices) {
        const key = pickAIEmote(event, aiIndex, state);
        if (key) {
          post(aiIndex, key);
        }
      }
    }
  }, [events, state, aiPlayerIndices, post]);
}
