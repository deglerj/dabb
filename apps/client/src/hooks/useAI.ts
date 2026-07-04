import { useEffect, useRef } from 'react';
import { applyEvents } from '@dabb/game-logic';
import { createAIPlayer } from '@dabb/game-ai';
import type { GameEvent, PlayerIndex } from '@dabb/shared-types';
import { pushEvents, claimCascade } from '../firebase/events.js';
import { hashSecretId } from '../firebase/secretId.js';
import {
  createBidPlacedEvents,
  createPlayerPassedEvents,
  createTakeDabbEvents,
  createDiscardCardsEvents,
  createGoOutEvents,
  createDeclareTrumpEvents,
  createDeclareMeldsEvents,
  createPlayCardEvents,
} from '../firebase/gameEventFactory.js';
import type { PlayerInfo, SeqGen } from '../firebase/gameEventFactory.js';

interface UseAIOptions {
  sessionCode: string;
  secretId: string;
  rawEvents: GameEvent[];
  players: PlayerInfo[];
  aiPlayerIndices: PlayerIndex[];
}

export function useAI({
  sessionCode,
  secretId,
  rawEvents,
  players,
  aiPlayerIndices,
}: UseAIOptions): void {
  const processingRef = useRef(false);

  useEffect(() => {
    if (aiPlayerIndices.length === 0) {
      return;
    }
    if (processingRef.current) {
      return;
    }

    const fullState = applyEvents(rawEvents);
    const currentPlayer = fullState.currentPlayer;
    if (currentPlayer === null || currentPlayer === undefined) {
      return;
    }
    if (!aiPlayerIndices.includes(currentPlayer)) {
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

        const aiPlayer = createAIPlayer();
        const action = await aiPlayer.decide({
          gameState: fullState,
          playerIndex: currentPlayer,
          sessionId: sessionCode,
        });

        const seq: SeqGen = (() => {
          let n = rawEvents.length;
          return () => ++n;
        })();

        let evts: GameEvent[] = [];

        if (action.type === 'bid') {
          evts = createBidPlacedEvents(sessionCode, seq, fullState, currentPlayer, action.amount);
        } else if (action.type === 'pass') {
          evts = createPlayerPassedEvents(sessionCode, seq, fullState, currentPlayer);
        } else if (action.type === 'takeDabb') {
          evts = createTakeDabbEvents(sessionCode, seq, fullState, currentPlayer);
        } else if (action.type === 'discard') {
          evts = createDiscardCardsEvents(
            sessionCode,
            seq,
            fullState,
            currentPlayer,
            action.cardIds
          );
        } else if (action.type === 'goOut') {
          evts = createGoOutEvents(sessionCode, seq, fullState, currentPlayer, action.suit);
        } else if (action.type === 'declareTrump') {
          evts = createDeclareTrumpEvents(sessionCode, seq, fullState, currentPlayer, action.suit);
        } else if (action.type === 'declareMelds') {
          evts = createDeclareMeldsEvents(
            sessionCode,
            seq,
            fullState,
            currentPlayer,
            action.melds,
            players
          );
        } else if (action.type === 'playCard') {
          evts = createPlayCardEvents(
            sessionCode,
            seq,
            fullState,
            currentPlayer,
            action.cardId,
            players
          );
        }

        if (evts.length > 0) {
          await pushEvents(sessionCode, evts, secretHash);
        }
      } finally {
        processingRef.current = false;
      }
    })();
  }, [rawEvents.length, aiPlayerIndices, sessionCode, secretId, players]);
}
