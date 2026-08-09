/**
 * useEmotes — the visible-emote map, and the one place the display window is enforced.
 *
 * Both drivers feed the same store: the online hook posts what Firebase reports plus a local
 * echo of the player's own emote, the offline hook posts directly. AI emotes are posted by
 * useAIEmotes on every client independently — they are derived, not transported.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EmoteKey, EmoteSignal, PlayerIndex } from '@dabb/shared-types';
import { EMOTE_TTL_MS } from '@dabb/shared-types';

export interface EmotesResult {
  /** Seats with a currently visible emote. Expired entries are never included. */
  visible: Map<PlayerIndex, EmoteKey>;
  /** Records an emote for a seat. `at` defaults to now. */
  post: (playerIndex: PlayerIndex, key: EmoteKey, at?: number) => void;
  /**
   * Folds a batch of signals in, newest-per-seat winning.
   *
   * This merges rather than replaces because the two sources are disjoint: the Firebase
   * snapshot carries human seats only, while AI emotes are derived locally and never appear
   * there. Replacing outright would wipe every bot reaction on the next snapshot.
   */
  merge: (signals: Map<PlayerIndex, EmoteSignal>) => void;
}

function stillVisible(signal: EmoteSignal, now: number): boolean {
  return now - signal.at < EMOTE_TTL_MS;
}

export function useEmotes(): EmotesResult {
  const [signals, setSignals] = useState<Map<PlayerIndex, EmoteSignal>>(new Map());
  // Bumped by the expiry timer so the memo below recomputes when an emote ages out. The
  // signal map itself is unchanged at that point, so nothing else would trigger a re-render.
  const [tick, setTick] = useState(0);

  const post = useCallback((playerIndex: PlayerIndex, key: EmoteKey, at: number = Date.now()) => {
    setSignals((prev) => {
      const next = new Map(prev);
      next.set(playerIndex, { key, at });
      return next;
    });
  }, []);

  const merge = useCallback((incoming: Map<PlayerIndex, EmoteSignal>) => {
    setSignals((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const [playerIndex, signal] of incoming) {
        const existing = next.get(playerIndex);
        if (!existing || signal.at > existing.at) {
          next.set(playerIndex, signal);
          changed = true;
        }
      }
      // Firebase re-reports the same snapshot on every reconnect; returning prev unchanged
      // keeps that from restarting the expiry timer and re-rendering the table.
      return changed ? next : prev;
    });
  }, []);

  const visible = useMemo(() => {
    void tick;
    const now = Date.now();
    const result = new Map<PlayerIndex, EmoteKey>();
    for (const [playerIndex, signal] of signals) {
      if (stillVisible(signal, now)) {
        result.set(playerIndex, signal.key);
      }
    }
    return result;
  }, [signals, tick]);

  // One timer for the soonest expiry rather than one per emote — with at most four seats
  // the difference is cosmetic, but a single timer cannot leak a stray seat's handle.
  useEffect(() => {
    const now = Date.now();
    const deadlines = Array.from(signals.values())
      .map((signal) => signal.at + EMOTE_TTL_MS)
      .filter((deadline) => deadline > now);
    if (deadlines.length === 0) {
      return;
    }
    const timer = setTimeout(() => setTick((n) => n + 1), Math.min(...deadlines) - now);
    return () => clearTimeout(timer);
  }, [signals, tick]);

  return { visible, post, merge };
}
