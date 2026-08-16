/**
 * useRematch — the online rematch vote and the hand-off to the new session.
 *
 * The vote never enters the event log (see firebase/rematch.ts). Once every human seat has
 * agreed, seat 0 — always a human, it is the seat `createSession` gives the creator — builds
 * the rematch session, deals it, and publishes its code; every client then claims the same
 * seat it just played and follows.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createStartGameEvents } from '@dabb/game-logic';
import type { PlayerIndex } from '@dabb/shared-types';
import type { FirebaseGameResult } from './useFirebaseGame.js';
import { pushEvents } from '../firebase/events.js';
import {
  claimRematchSeat,
  createRematchSession,
  publishRematchCode,
  sendRematchVote,
  subscribeToRematch,
} from '../firebase/rematch.js';
import type { RematchSeat, RematchSignal } from '../firebase/rematch.js';
import { resolveRematchStatus } from '../components/game/rematch.js';
import type { RematchState } from '../components/game/rematch.js';

const HOST_SEAT = 0 as PlayerIndex;

export interface UseRematchOptions {
  sessionCode: string;
  playerIndex: PlayerIndex;
  game: FirebaseGameResult;
}

export function useRematch({ sessionCode, playerIndex, game }: UseRematchOptions): RematchState {
  const navigate = useNavigate();
  const [signal, setSignal] = useState<RematchSignal>({ votes: {} });
  // A rematch is only offered after a regular finish; an abort leaves nobody to play with.
  const finished = game.state.phase === 'finished' && game.terminatedBy === null;

  const startedRef = useRef(false);
  const movedRef = useRef(false);

  useEffect(() => {
    if (!sessionCode || !finished) {
      return;
    }
    return subscribeToRematch(sessionCode, setSignal);
  }, [sessionCode, finished]);

  const humanSeats = useMemo(
    () => game.players.filter((p) => !p.isAI).map((p) => p.playerIndex),
    [game.players]
  );
  const status = useMemo(
    () => resolveRematchStatus(signal.votes, humanSeats),
    [signal.votes, humanSeats]
  );

  // Host builds the rematch session. Start events go in right away, with the seat list of the
  // finished game: the other humans are still writing their seats, but nothing in the log
  // depends on them being there — only their own later writes do.
  useEffect(() => {
    if (
      !sessionCode ||
      !finished ||
      status.status !== 'agreed' ||
      signal.code ||
      playerIndex !== HOST_SEAT ||
      startedRef.current
    ) {
      return;
    }
    startedRef.current = true;

    const seats: RematchSeat[] = game.players.map((p) => {
      const difficulty = game.aiSeats.find((s) => s.playerIndex === p.playerIndex)?.difficulty;
      return {
        playerIndex: p.playerIndex,
        nickname: game.nicknames.get(p.playerIndex) ?? p.nickname,
        isAI: p.isAI,
        ...(difficulty ? { aiDifficulty: difficulty } : {}),
      };
    });

    void (async () => {
      try {
        const { code, secretHash } = await createRematchSession(
          seats,
          HOST_SEAT,
          game.state.playerCount,
          game.state.targetScore
        );
        let seq = 0;
        const events = createStartGameEvents(
          () => ({ sessionId: code, sequence: ++seq }),
          game.players,
          game.state.playerCount,
          game.state.targetScore
        );
        await pushEvents(code, events, secretHash);
        await publishRematchCode(sessionCode, code);
      } catch (err) {
        // Let the others keep waiting on a host that can try again rather than stranding
        // them on a session that was never announced.
        startedRef.current = false;
        console.error('Failed to create rematch session:', err);
      }
    })();
  }, [finished, status.status, signal.code, playerIndex, sessionCode, game]);

  // Everyone follows the published code, host included — it stored its credentials while
  // creating the session, so claiming is a no-op there.
  useEffect(() => {
    const code = signal.code;
    if (!code || !finished || movedRef.current) {
      return;
    }
    movedRef.current = true;

    void (async () => {
      try {
        await claimRematchSeat(code, playerIndex, game.nicknames.get(playerIndex) ?? '');
        navigate(`/game/${code}`, { replace: true });
      } catch (err) {
        movedRef.current = false;
        console.error('Failed to join rematch session:', err);
      }
    })();
  }, [signal.code, finished, playerIndex, game.nicknames, navigate]);

  const vote = useCallback(
    (agree: boolean) => {
      // Echoed locally so the button reacts before the round trip.
      setSignal((prev) => ({ ...prev, votes: { ...prev.votes, [String(playerIndex)]: agree } }));
      void sendRematchVote(sessionCode, playerIndex, agree);
    },
    [playerIndex, sessionCode]
  );

  const nameOf = useCallback(
    (seat: PlayerIndex) => game.nicknames.get(seat) ?? String(seat + 1),
    [game.nicknames]
  );

  return {
    myVote: signal.votes[String(playerIndex)] ?? null,
    waitingFor: status.waitingFor.filter((seat) => seat !== playerIndex).map(nameOf),
    declinedBy: status.declinedBy.map(nameOf),
    onRematch: () => vote(true),
    onDecline: () => vote(false),
  };
}
