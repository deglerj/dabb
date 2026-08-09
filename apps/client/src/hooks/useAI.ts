import { useEffect, useRef } from 'react';
import { applyEvents, createEventsForAction, whoActsNext } from '@dabb/game-logic';
import { createAIPlayer } from '@dabb/game-ai';
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

export function useAI({ sessionCode, secretId, rawEvents, aiSeats }: UseAIOptions): void {
  const processingRef = useRef(false);

  useEffect(() => {
    if (aiSeats.length === 0) {
      return;
    }
    if (processingRef.current) {
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

    processingRef.current = true;
    void (async () => {
      try {
        const secretHash = await hashSecretId(secretId);
        const won = await claimCascade(sessionCode, claimKey, secretHash);
        if (!won) {
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

        if (evts.length > 0) {
          await pushEvents(sessionCode, evts, secretHash);
        }
      } finally {
        processingRef.current = false;
      }
    })();
  }, [rawEvents.length, aiSeats, sessionCode, secretId]);
}
