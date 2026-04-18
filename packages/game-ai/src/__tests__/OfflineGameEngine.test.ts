import { describe, it, expect } from 'vitest';
import { OfflineGameEngine } from '../OfflineGameEngine.js';
import type { GameState } from '@dabb/shared-types';

describe('OfflineGameEngine', () => {
  it('initialises and pauses at the human turn', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });

    const states: GameState[] = [];
    engine.onStateChange = (state: GameState) => {
      states.push(state);
    };

    await engine.start();

    expect(states.length).toBeGreaterThan(0);
    const lastState = states[states.length - 1];
    expect(['bidding', 'dabb', 'trump', 'melding', 'tricks']).toContain(lastState.phase);
  });

  it('hides opponent cards in player view', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    await engine.start();

    const view = engine.getViewForPlayer(0);
    const opponentHand = view.state.hands.get(1);
    expect(opponentHand).toBeDefined();
    if (opponentHand && opponentHand.length > 0) {
      expect(opponentHand[0].id).toMatch(/^hidden-/);
    }
    const ownHand = view.state.hands.get(0);
    if (ownHand && ownHand.length > 0) {
      expect(ownHand[0].id).not.toMatch(/^hidden-/);
    }
  });

  it('getPersistPayload includes config, events, and phase', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 3,
      difficulty: 'medium',
      humanPlayerIndex: 0,
    });
    await engine.start();

    const payload = engine.getPersistPayload();
    expect(payload.config.playerCount).toBe(3);
    expect(payload.config.difficulty).toBe('medium');
    expect(payload.config.humanPlayerIndex).toBe(0);
    expect(Array.isArray(payload.events)).toBe(true);
    expect(payload.events.length).toBeGreaterThan(0);
    expect(payload.phase).toBeDefined();
  });

  it('resumes from existing events without re-initialising', async () => {
    const engine1 = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    await engine1.start();

    const payload = engine1.getPersistPayload();

    const engine2 = new OfflineGameEngine({
      ...payload.config,
      existingEvents: payload.events,
    });
    await engine2.start();

    const view1 = engine1.getViewForPlayer(0);
    const view2 = engine2.getViewForPlayer(0);
    expect(view2.state.phase).toBe(view1.state.phase);
    expect(view2.state.round).toBe(view1.state.round);
  });

  it('advances game state after dispatch with human action', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    await engine.start();

    const beforeView = engine.getViewForPlayer(0);
    expect(beforeView.state.phase).toBe('bidding');

    await engine.dispatch({ type: 'bid', amount: 150 });

    const afterView = engine.getViewForPlayer(0);
    // After human bids, AI acts and the game is still in a valid state
    expect(['bidding', 'dabb', 'trump', 'melding', 'tricks', 'finished']).toContain(
      afterView.state.phase
    );
    // The event log grew
    expect(afterView.events.length).toBeGreaterThan(beforeView.events.length);
  });

  it('onStateChange fires exactly once per start() call with all events batched', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });

    let callCount = 0;
    let lastNewEventsCount = 0;
    engine.onStateChange = (_state, newEvents) => {
      callCount++;
      lastNewEventsCount = newEvents.length;
    };
    await engine.start();

    expect(callCount).toBe(1);
    // start() emits player-joined × N, game-started, cards-dealt, plus any AI bidding events
    expect(lastNewEventsCount).toBeGreaterThan(2);
  });
});
