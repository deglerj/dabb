/**
 * Tests for AI emote selection.
 *
 * Two properties carry the whole design and are what these tests exist to protect:
 * determinism (every client must derive the same reaction without coordinating) and the
 * age gate (a replayed log must not fire a round's worth of reactions at once).
 */
import { describe, it, expect } from 'vitest';
import { createInitialState } from '@dabb/game-logic';
import type { GameEvent, GameState, PlayerIndex, Team } from '@dabb/shared-types';
import { EMOTE_TTL_MS } from '@dabb/shared-types';
import { pickAIEmote } from '../emotes.js';

const NOW = 1_700_000_000_000;

function stateFor(playerCount: 2 | 3 | 4): GameState {
  const state = createInitialState(playerCount);
  return {
    ...state,
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `p${i}`,
      playerIndex: i as PlayerIndex,
      nickname: `P${i}`,
      ...(playerCount === 4 ? { team: (i % 2) as Team } : {}),
    })),
  };
}

/** An event with a fixed id, so the hash gate is reproducible across tests. */
function event(
  id: string,
  partial: Omit<GameEvent, 'id' | 'sessionId' | 'sequence' | 'timestamp'>
) {
  return {
    id,
    sessionId: 'test',
    sequence: 1,
    timestamp: NOW,
    ...partial,
  } as GameEvent;
}

function trickWon(id: string, winnerIndex: PlayerIndex, points: number) {
  return event(id, {
    type: 'TRICK_WON',
    payload: { winnerIndex, cards: [], points },
  } as Omit<GameEvent, 'id' | 'sessionId' | 'sequence' | 'timestamp'>);
}

/** Finds an event id for which the given seat actually emotes — the gate rejects most. */
function idThatFires(
  make: (id: string) => GameEvent,
  aiIndex: PlayerIndex,
  state: GameState
): { id: string; key: string } {
  for (let i = 0; i < 500; i++) {
    const id = `evt-${i}`;
    const key = pickAIEmote(make(id), aiIndex, state, NOW);
    if (key) {
      return { id, key };
    }
  }
  throw new Error('no event id produced an emote — the gate is closed too far');
}

describe('pickAIEmote', () => {
  const state3 = stateFor(3);
  const ai = 1 as PlayerIndex;

  it('is deterministic for the same event and seat', () => {
    const evt = trickWon('fixed-id', 0 as PlayerIndex, 20);
    const results = Array.from({ length: 10 }, () => pickAIEmote(evt, ai, state3, NOW));
    expect(new Set(results).size).toBe(1);
  });

  it('ignores events older than the display window (replay guard)', () => {
    const { id } = idThatFires((eid) => trickWon(eid, 0 as PlayerIndex, 20), ai, state3);
    const evt = trickWon(id, 0 as PlayerIndex, 20);

    expect(pickAIEmote(evt, ai, state3, NOW)).not.toBeNull();
    expect(pickAIEmote(evt, ai, state3, NOW + EMOTE_TTL_MS)).toBeNull();
    expect(pickAIEmote(evt, ai, state3, NOW + 60_000)).toBeNull();
  });

  it('never reacts to a cheap trick', () => {
    for (let i = 0; i < 200; i++) {
      expect(pickAIEmote(trickWon(`c-${i}`, 0 as PlayerIndex, 4), ai, state3, NOW)).toBeNull();
    }
  });

  it('is pleased by a rich trick it won and displeased by one it lost', () => {
    const won = idThatFires((eid) => trickWon(eid, ai, 20), ai, state3);
    expect(won.key).toBe('happy');

    const lost = idThatFires((eid) => trickWon(eid, 0 as PlayerIndex, 20), ai, state3);
    expect(['angry', 'facepalm']).toContain(lost.key);
  });

  it('treats a partner winning a rich trick as its own side winning (4-player)', () => {
    const state4 = stateFor(4);
    // Seats 1 and 3 are partners.
    const partnerWin = idThatFires((eid) => trickWon(eid, 3 as PlayerIndex, 20), ai, state4);
    expect(partnerWin.key).toBe('happy');
  });

  it('is confused by a wild bid from someone else, but not by its own', () => {
    const mkBid = (eid: string, playerIndex: PlayerIndex, amount: number) =>
      event(eid, {
        type: 'BID_PLACED',
        payload: { playerIndex, amount },
      } as Omit<GameEvent, 'id' | 'sessionId' | 'sequence' | 'timestamp'>);

    const wild = idThatFires((eid) => mkBid(eid, 0 as PlayerIndex, 300), ai, state3);
    expect(wild.key).toBe('confused');

    for (let i = 0; i < 200; i++) {
      expect(pickAIEmote(mkBid(`own-${i}`, ai, 300), ai, state3, NOW)).toBeNull();
      expect(pickAIEmote(mkBid(`low-${i}`, 0 as PlayerIndex, 160), ai, state3, NOW)).toBeNull();
    }
  });

  it('facepalms when it missed its own bid, and gloats when an opponent missed theirs', () => {
    const scored = (eid: string, mineBidMet: boolean, theirsBidMet: boolean) =>
      event(eid, {
        type: 'ROUND_SCORED',
        payload: {
          scores: {
            [ai]: { melds: 40, tricks: 60, total: 100, bidMet: mineBidMet },
            0: { melds: 20, tricks: 40, total: 60, bidMet: theirsBidMet },
          },
          totalScores: { [ai]: 100, 0: 60 },
        },
      } as Omit<GameEvent, 'id' | 'sessionId' | 'sequence' | 'timestamp'>);

    expect(idThatFires((eid) => scored(eid, false, true), ai, state3).key).toBe('facepalm');
    expect(idThatFires((eid) => scored(eid, true, false), ai, state3).key).toBe('happy');
  });

  it('applauds a round another side clearly won', () => {
    const scored = (eid: string) =>
      event(eid, {
        type: 'ROUND_SCORED',
        payload: {
          scores: {
            [ai]: { melds: 0, tricks: 20, total: 20, bidMet: true },
            0: { melds: 100, tricks: 80, total: 180, bidMet: true },
          },
          totalScores: { [ai]: 20, 0: 180 },
        },
      } as Omit<GameEvent, 'id' | 'sessionId' | 'sequence' | 'timestamp'>);

    expect(idThatFires(scored, ai, state3).key).toBe('congrats');
  });

  it('emotes once or twice over a representative round, not on every trick', () => {
    // A plausible round for one bot: ten tricks, six of them worth reacting to, plus the
    // scoring event. The band is what keeps emotes feeling like reactions rather than noise.
    const rounds = 200;
    let total = 0;

    for (let r = 0; r < rounds; r++) {
      const events: GameEvent[] = [];
      for (let trick = 0; trick < 10; trick++) {
        const winner = (trick % 3) as PlayerIndex;
        events.push(trickWon(`r${r}-t${trick}`, winner, trick < 6 ? 22 : 6));
      }
      events.push(
        event(`r${r}-score`, {
          type: 'ROUND_SCORED',
          payload: {
            scores: {
              [ai]: { melds: 20, tricks: 40, total: 60, bidMet: true },
              0: { melds: 60, tricks: 90, total: 150, bidMet: true },
            },
            totalScores: { [ai]: 60, 0: 150 },
          },
        } as Omit<GameEvent, 'id' | 'sessionId' | 'sequence' | 'timestamp'>)
      );

      total += events.filter((e) => pickAIEmote(e, ai, state3, NOW) !== null).length;
    }

    const perRound = total / rounds;
    expect(perRound).toBeGreaterThan(0.7);
    expect(perRound).toBeLessThan(2.5);
  });
});
