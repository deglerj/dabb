/**
 * AI emotes — which reaction, if any, a bot shows in response to a single event.
 *
 * Nothing here is transported. Every client derives the same emote from the same event log,
 * because the whole decision is a pure function of the event and a hash of its id. That is
 * what lets AI emotes skip Firebase and the cascade claim entirely: there is nothing to
 * coordinate when all clients independently arrive at the same answer.
 *
 * The corollary is that this must be kept deterministic. Reaching for Math.random() here
 * would make every client show a different bot reaction at the same moment.
 */

import type { EmoteKey, GameEvent, GameState, PlayerIndex, Team } from '@dabb/shared-types';
import { EMOTE_TTL_MS } from '@dabb/shared-types';

/** A trick worth at least this much is worth reacting to. */
const RICH_TRICK_POINTS = 15;

/** A bid this high reads as reckless to a bot. */
const WILD_BID = 250;

/** How far another side has to out-score mine in a round before it earns applause. */
const ROUND_GAP_FOR_APPLAUSE = 50;

/**
 * FNV-1a over the event id, mapped to [0,1).
 *
 * Any stable string hash would do; what matters is that it is seeded from data every client
 * already has, so the gate below opens on all of them or none.
 */
function hashUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100_000) / 100_000;
}

/**
 * The score key for a seat: the team in 4-player games, the seat itself otherwise.
 * ROUND_SCORED and GAME_FINISHED are keyed this way (see scoring.ts).
 */
function scoreKey(state: GameState, playerIndex: PlayerIndex): PlayerIndex | Team {
  if (state.playerCount !== 4) {
    return playerIndex;
  }
  const team = state.players.find((p) => p.playerIndex === playerIndex)?.team;
  return team ?? playerIndex;
}

/** Whether two seats are on the same side — always false for distinct seats outside 4-player. */
function sameSide(state: GameState, a: PlayerIndex, b: PlayerIndex): boolean {
  return a === b || scoreKey(state, a) === scoreKey(state, b);
}

/** A candidate reaction and how often it should actually be shown. */
interface Candidate {
  key: EmoteKey;
  chance: number;
}

/**
 * The trigger table. Chances are tuned so one bot emotes roughly once or twice per round:
 * a round yields a handful of rich tricks plus one scoring event, and most of those draws
 * come up empty.
 */
function candidateFor(event: GameEvent, aiIndex: PlayerIndex, state: GameState): Candidate | null {
  switch (event.type) {
    case 'TRICK_WON': {
      if (event.payload.points < RICH_TRICK_POINTS) {
        return null;
      }
      if (sameSide(state, event.payload.winnerIndex, aiIndex)) {
        return { key: 'happy', chance: 0.18 };
      }
      // Losing a fat trick reads as either annoyance or self-reproach; split the two so a
      // bot doesn't always pull the same face.
      const annoyed = hashUnit(`face:${event.id}:${aiIndex}`) < 0.5;
      return { key: annoyed ? 'angry' : 'facepalm', chance: 0.18 };
    }

    case 'BID_PLACED': {
      if (event.payload.playerIndex === aiIndex || event.payload.amount < WILD_BID) {
        return null;
      }
      return { key: 'confused', chance: 0.35 };
    }

    case 'GOING_OUT': {
      if (sameSide(state, event.payload.playerIndex, aiIndex)) {
        return null;
      }
      return { key: 'confused', chance: 0.3 };
    }

    case 'ROUND_SCORED': {
      // The bid winner is not named in the payload, and by the time the log has moved on
      // state.bidWinner has already been reset for the next round. Read the outcome
      // instead: bidMet is false only for a bid winner who missed (see scoring.ts).
      const mine = event.payload.scores[scoreKey(state, aiIndex)];
      if (!mine) {
        return null;
      }
      if (!mine.bidMet) {
        return { key: 'facepalm', chance: 0.6 };
      }
      const others = Object.entries(event.payload.scores)
        .filter(([key]) => Number(key) !== scoreKey(state, aiIndex))
        .map(([, score]) => score);
      if (others.some((score) => !score.bidMet)) {
        return { key: 'happy', chance: 0.4 };
      }
      if (others.some((score) => score.total > mine.total + ROUND_GAP_FOR_APPLAUSE)) {
        return { key: 'congrats', chance: 0.5 };
      }
      return null;
    }

    case 'GAME_FINISHED': {
      if (event.payload.winner === scoreKey(state, aiIndex)) {
        return { key: 'happy', chance: 0.8 };
      }
      return { key: 'congrats', chance: 0.8 };
    }

    default:
      return null;
  }
}

/**
 * The emote an AI seat shows for this event, or null for the overwhelming majority of events.
 *
 * `now` is injectable for tests only.
 */
export function pickAIEmote(
  event: GameEvent,
  aiIndex: PlayerIndex,
  state: GameState,
  now: number = Date.now()
): EmoteKey | null {
  // Replay guard. AI emotes are derived rather than transported, so a refresh or a
  // reconnect walks the entire log again and would fire every past reaction at once.
  // An event older than the display window could never produce a visible emote anyway,
  // which makes age the right gate — it holds regardless of the order events arrive in.
  if (now - event.timestamp >= EMOTE_TTL_MS) {
    return null;
  }

  const candidate = candidateFor(event, aiIndex, state);
  if (!candidate) {
    return null;
  }

  return hashUnit(`emote:${event.id}:${aiIndex}`) < candidate.chance ? candidate.key : null;
}
