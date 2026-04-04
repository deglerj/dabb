/**
 * Tests for reducer paths not covered by integration tests:
 * - PLAYER_LEFT / PLAYER_RECONNECTED events
 * - Error paths for null firstBidder
 */

import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

import { applyEvents } from '../state/reducer.js';
import {
  createPlayerJoinedEvent,
  createGameStartedEvent,
  createPlayerLeftEvent,
  createPlayerReconnectedEvent,
  createBidPlacedEvent,
  createPlayerPassedEvent,
} from '../events/generators.js';

const SESSION_ID = 'test-session';
let seq = 0;
function ctx() {
  return { sessionId: SESSION_ID, sequence: ++seq };
}

function setupTwoPlayerGame() {
  const events = [
    createPlayerJoinedEvent(ctx(), 'player-alice', 0 as PlayerIndex, 'Alice'),
    createPlayerJoinedEvent(ctx(), 'player-bob', 1 as PlayerIndex, 'Bob'),
    createGameStartedEvent(ctx(), 2, 1000, 0 as PlayerIndex),
  ];
  return applyEvents(events);
}

describe('reducer: PLAYER_LEFT and PLAYER_RECONNECTED', () => {
  it('marks a player as disconnected on PLAYER_LEFT', () => {
    const state = setupTwoPlayerGame();
    expect(state.players.find((p) => p.playerIndex === 0)?.connected).toBe(true);

    const nextState = applyEvents([createPlayerLeftEvent(ctx(), 0 as PlayerIndex)], state);

    expect(nextState.players.find((p) => p.playerIndex === 0)?.connected).toBe(false);
    // Other player unaffected
    expect(nextState.players.find((p) => p.playerIndex === 1)?.connected).toBe(true);
  });

  it('marks a player as connected on PLAYER_RECONNECTED', () => {
    const state = setupTwoPlayerGame();
    const disconnected = applyEvents([createPlayerLeftEvent(ctx(), 0 as PlayerIndex)], state);
    expect(disconnected.players.find((p) => p.playerIndex === 0)?.connected).toBe(false);

    const reconnected = applyEvents(
      [createPlayerReconnectedEvent(ctx(), 0 as PlayerIndex)],
      disconnected
    );

    expect(reconnected.players.find((p) => p.playerIndex === 0)?.connected).toBe(true);
  });

  it('handles reconnection of a player who never disconnected (idempotent)', () => {
    const state = setupTwoPlayerGame();
    const nextState = applyEvents([createPlayerReconnectedEvent(ctx(), 1 as PlayerIndex)], state);
    expect(nextState.players.find((p) => p.playerIndex === 1)?.connected).toBe(true);
  });
});

describe('reducer: error paths', () => {
  it('throws when BID_PLACED arrives with null firstBidder', () => {
    // Manually build a state with firstBidder=null — this shouldn't happen
    // in normal gameplay but the reducer guards against it
    const state = setupTwoPlayerGame();
    // Corrupt the state by nulling firstBidder
    const corruptState = { ...state, firstBidder: null };

    expect(() =>
      applyEvents(
        [createBidPlacedEvent(ctx(), 0 as PlayerIndex, 150)],
        corruptState as typeof state
      )
    ).toThrow('firstBidder is null during bidding');
  });

  it('throws when PLAYER_PASSED arrives with null firstBidder', () => {
    const state = setupTwoPlayerGame();
    const corruptState = { ...state, firstBidder: null };

    expect(() =>
      applyEvents([createPlayerPassedEvent(ctx(), 1 as PlayerIndex)], corruptState as typeof state)
    ).toThrow('firstBidder is null during bidding');
  });
});
