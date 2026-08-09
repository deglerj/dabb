import { useEffect, useRef } from 'react';
import { applyEvents, createEventsForAction, whoActsNext } from '@dabb/game-logic';
import { createAIPlayer, AI_CARD_PLAY_DELAY_MS, AI_TRICK_COMPLETE_DELAY_MS } from '@dabb/game-ai';
import type { GameEvent } from '@dabb/shared-types';
import { pushEvents, claimCascade } from '../firebase/events.js';
import { hashSecretId } from '../firebase/secretId.js';
import type { AISeat } from './useFirebaseGame.js';

interface UseAIOptions {
  sessionCode: string;
  secretId: string;
  rawEvents: GameEvent[];
  aiSeats: AISeat[];
}

/**
 * How long this bot waits before answering.
 *
 * Offline the engine loop paces the AI (OfflineGameEngine.act); online there is no loop, so
 * the only gap between two plays would be the Firebase round trip. On a fast connection that
 * is short enough that the next card lands before the trick pause animation has run, and
 * useTrickAnimationState cancels the pause — the trick is swept off the table before anyone
 * saw it. Same two constants, so the two drivers cannot drift apart again.
 */
function pacingDelayMs(rawEvents: GameEvent[]): number {
  const last = rawEvents[rawEvents.length - 1];
  if (last?.type === 'TRICK_WON') {
    return AI_TRICK_COMPLETE_DELAY_MS;
  }
  if (last?.type === 'CARD_PLAYED') {
    return AI_CARD_PLAY_DELAY_MS;
  }
  return 0;
}

export function useAI({ sessionCode, secretId, rawEvents, aiSeats }: UseAIOptions): void {
  /**
   * The decision currently in flight, keyed the same way the Firebase claim is.
   *
   * A plain "busy" boolean deadlocked the bots: any event arriving mid-decision made the
   * effect re-run, bail on the flag, and never retry — nothing else would change the deps.
   * Keying by claimKey means a re-run for the *same* decision is a no-op while a re-run for
   * a *different* one supersedes it, so the pacing wait below cannot strand a turn.
   */
  const activeClaimRef = useRef<string | null>(null);

  useEffect(() => {
    if (aiSeats.length === 0) {
      return;
    }

    const fullState = applyEvents(rawEvents);
    const currentPlayer = whoActsNext(fullState);
    if (currentPlayer === null) {
      return;
    }
    const seat = aiSeats.find((s) => s.playerIndex === currentPlayer);
    if (!seat) {
      return;
    }

    const claimKey = `player${currentPlayer}_seq${rawEvents.length}`;
    if (activeClaimRef.current === claimKey) {
      return;
    }

    let cancelled = false;

    activeClaimRef.current = claimKey;
    void (async () => {
      try {
        const secretHash = await hashSecretId(secretId);
        const won = await claimCascade(sessionCode, claimKey, secretHash);
        if (!won) {
          return;
        }

        // Held well inside claimCascade's 10s expiry, so the claim stays ours across the wait.
        await new Promise((resolve) => setTimeout(resolve, pacingDelayMs(rawEvents)));
        if (cancelled) {
          return;
        }

        const aiPlayer = createAIPlayer(seat.difficulty);
        const action = await aiPlayer.decide({
          gameState: fullState,
          playerIndex: currentPlayer,
          sessionId: sessionCode,
        });

        let n = rawEvents.length;
        const evts = createEventsForAction(fullState, currentPlayer, action, () => ({
          sessionId: sessionCode,
          sequence: ++n,
        }));

        if (evts.length > 0 && !cancelled) {
          await pushEvents(sessionCode, evts, secretHash);
        }
      } finally {
        if (activeClaimRef.current === claimKey) {
          activeClaimRef.current = null;
        }
      }
    })();

    // The pacing wait keeps this pending for seconds; writing a move built from a log that
    // has since moved on would push a cascade with sequence numbers already taken.
    return () => {
      cancelled = true;
    };
  }, [rawEvents.length, aiSeats, sessionCode, secretId]);
}
