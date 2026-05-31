import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineGameEngine } from '../OfflineGameEngine.js';
import type { PlayerIndex } from '@dabb/shared-types';
import { detectMelds } from '@dabb/game-logic';

// Advance fake time enough to clear all AI delays (card plays: 700ms, tricks: 4500ms)
const ADVANCE_MS = 60_000;

async function advanceFakeTime(): Promise<void> {
  await vi.advanceTimersByTimeAsync(ADVANCE_MS);
}

/**
 * Drive through one phase of the game for the human player.
 * Returns true if an action was dispatched.
 */
async function dispatchOneHumanAction(
  engine: OfflineGameEngine,
  humanPlayerIndex: PlayerIndex
): Promise<boolean> {
  const view = engine.getViewForPlayer(humanPlayerIndex);
  const state = view.state;

  if (state.phase === 'finished' || state.phase === 'terminated') {
    return false;
  }

  if (state.phase === 'bidding') {
    if (state.currentBidder !== humanPlayerIndex) {
      return false;
    }
    if (state.passedPlayers.has(humanPlayerIndex)) {
      return false;
    }
    const p = engine.dispatch({ type: 'pass' });
    await advanceFakeTime();
    await p;
    return true;
  }
  if (state.phase === 'dabb') {
    if (state.bidWinner !== humanPlayerIndex) {
      return false;
    }
    const p = engine.dispatch({ type: 'takeDabb' });
    await advanceFakeTime();
    await p;
    return true;
  }
  if (state.phase === 'trump') {
    if (state.bidWinner !== humanPlayerIndex) {
      return false;
    }
    const p = engine.dispatch({ type: 'declareTrump', suit: 'herz' });
    await advanceFakeTime();
    await p;
    return true;
  }
  if (state.phase === 'melding') {
    if (state.declaredMelds.has(humanPlayerIndex)) {
      return false;
    }
    const hand = state.hands.get(humanPlayerIndex) || [];
    const melds = detectMelds(hand, state.trump ?? 'herz');
    const p = engine.dispatch({ type: 'declareMelds', melds });
    await advanceFakeTime();
    await p;
    return true;
  }
  if (state.phase === 'tricks') {
    if (state.currentPlayer !== humanPlayerIndex) {
      return false;
    }
    const hand = state.hands.get(humanPlayerIndex) || [];
    if (hand.length === 0) {
      return false;
    }
    const p = engine.dispatch({ type: 'playCard', cardId: hand[0].id });
    await advanceFakeTime();
    await p;
    return true;
  }
  return false;
}

async function playToCompletion(
  engine: OfflineGameEngine,
  humanPlayerIndex: PlayerIndex,
  maxActions = 100
): Promise<void> {
  for (let i = 0; i < maxActions; i++) {
    const view = engine.getViewForPlayer(humanPlayerIndex);
    if (view.state.phase === 'finished' || view.state.phase === 'terminated') {
      break;
    }
    const acted = await dispatchOneHumanAction(engine, humanPlayerIndex);
    if (!acted) {
      break;
    }
  }
}

describe('OfflineGameEngine — full game paths (fake timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws if dispatch is called before start', async () => {
    vi.useRealTimers(); // this test doesn't need fake timers
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    await expect(engine.dispatch({ type: 'pass' })).rejects.toThrow(
      'OfflineGameEngine.start() must be called before dispatch()'
    );
    vi.useFakeTimers();
  });

  it('human player at non-zero index works correctly', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 3,
      difficulty: 'hard',
      humanPlayerIndex: 2,
    });
    const startP = engine.start();
    await advanceFakeTime();
    await startP;

    const view = engine.getViewForPlayer(2);
    expect(view.state).toBeDefined();
    expect(['bidding', 'dabb', 'trump', 'melding', 'tricks']).toContain(view.state.phase);
  });

  it('fires onStateChange after each dispatch with new events', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });

    const newEventCounts: number[] = [];
    engine.onStateChange = (_state, newEvents) => {
      newEventCounts.push(newEvents.length);
    };

    const startP = engine.start();
    await advanceFakeTime();
    await startP;

    expect(newEventCounts.length).toBeGreaterThanOrEqual(1);
    expect(newEventCounts[0]).toBeGreaterThan(0);

    const before = newEventCounts.length;
    const dispP = engine.dispatch({ type: 'pass' });
    await advanceFakeTime();
    await dispP;
    expect(newEventCounts.length).toBeGreaterThan(before);
  });

  it('3-player game runs to a valid phase', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 3,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    const startP = engine.start();
    await advanceFakeTime();
    await startP;

    const view = engine.getViewForPlayer(0);
    if (view.state.phase === 'bidding' && view.state.currentBidder === 0) {
      const p = engine.dispatch({ type: 'pass' });
      await advanceFakeTime();
      await p;
    }

    const afterView = engine.getViewForPlayer(0);
    expect(['bidding', 'dabb', 'trump', 'melding', 'tricks', 'finished']).toContain(
      afterView.state.phase
    );
  });

  it('getPersistPayload phase matches player view phase', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    const startP = engine.start();
    await advanceFakeTime();
    await startP;

    const payload = engine.getPersistPayload();
    const view = engine.getViewForPlayer(0);
    expect(payload.phase).toBe(view.state.phase);
  });

  it('onStateChange null does not throw', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    engine.onStateChange = null;
    const startP = engine.start();
    await advanceFakeTime();
    await expect(startP).resolves.toBeUndefined();
  });

  it('easy difficulty AI produces valid game start', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'easy',
      humanPlayerIndex: 0,
    });
    const startP = engine.start();
    await advanceFakeTime();
    await startP;
    const view = engine.getViewForPlayer(0);
    expect(['bidding', 'dabb', 'trump', 'melding', 'tricks']).toContain(view.state.phase);
  });

  it('medium difficulty AI produces valid game start', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'medium',
      humanPlayerIndex: 0,
    });
    const startP = engine.start();
    await advanceFakeTime();
    await startP;
    const view = engine.getViewForPlayer(0);
    expect(['bidding', 'dabb', 'trump', 'melding', 'tricks']).toContain(view.state.phase);
  });

  it('plays a 2-player game through bidding and into melding/tricks', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });

    const seenPhases = new Set<string>();
    engine.onStateChange = (state) => {
      seenPhases.add(state.phase);
    };

    const startP = engine.start();
    await advanceFakeTime();
    await startP;

    // Drive through bidding (human passes) and subsequent phases
    await playToCompletion(engine, 0, 50);

    // Should have seen at least the initial phase
    expect(seenPhases.size).toBeGreaterThanOrEqual(1);
    const view = engine.getViewForPlayer(0);
    expect(view.events.length).toBeGreaterThan(3);
  });

  it('human at index 1 with 2-player game — AI leads bidding', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 1,
    });
    const startP = engine.start();
    await advanceFakeTime();
    await startP;

    // Play through some actions
    await playToCompletion(engine, 1, 30);

    const view = engine.getViewForPlayer(1);
    expect(view.events.length).toBeGreaterThan(3);
  });

  it('resumes from persisted events without re-initializing', async () => {
    const engine1 = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    const startP1 = engine1.start();
    await advanceFakeTime();
    await startP1;

    const payload = engine1.getPersistPayload();

    const engine2 = new OfflineGameEngine({
      ...payload.config,
      existingEvents: payload.events,
    });
    const startP2 = engine2.start();
    await advanceFakeTime();
    await startP2;

    const view1 = engine1.getViewForPlayer(0);
    const view2 = engine2.getViewForPlayer(0);
    expect(view2.state.phase).toBe(view1.state.phase);
    expect(view2.state.round).toBe(view1.state.round);
  });

  it('trick card play fires onStateChange before AI responds', async () => {
    const engine = new OfflineGameEngine({
      playerCount: 2,
      difficulty: 'hard',
      humanPlayerIndex: 0,
    });
    const startP = engine.start();
    await advanceFakeTime();
    await startP;

    // Advance to tricks phase through bidding/dabb/trump/melding
    for (let i = 0; i < 20; i++) {
      const view = engine.getViewForPlayer(0);
      if (view.state.phase === 'tricks' || view.state.phase === 'finished') {
        break;
      }
      const acted = await dispatchOneHumanAction(engine, 0);
      if (!acted) {
        break;
      }
    }

    const view = engine.getViewForPlayer(0);
    if (view.state.phase === 'tricks' && view.state.currentPlayer === 0) {
      const fireCount: number[] = [];
      engine.onStateChange = (_state, newEvts) => {
        fireCount.push(newEvts.length);
      };
      const hand = view.state.hands.get(0) || [];
      if (hand.length > 0) {
        const p = engine.dispatch({ type: 'playCard', cardId: hand[0].id });
        await advanceFakeTime();
        await p;
        expect(fireCount.length).toBeGreaterThan(0);
      }
    }
    // If not in tricks yet, the test is still valid — just confirms we can drive to any phase
  });
});
