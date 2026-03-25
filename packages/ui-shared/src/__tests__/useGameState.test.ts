import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState } from '../useGameState.js';
import type { GameEvent } from '@dabb/shared-types';

const startedEvent: GameEvent = {
  id: 'e1',
  sessionId: 'session-1',
  sequence: 1,
  type: 'GAME_STARTED',
  payload: {
    playerCount: 3,
    targetScore: 1000,
    dealer: 0,
  },
  timestamp: Date.now(),
};

describe('useGameState', () => {
  it('isInitialLoad starts true and flips to false after first processEvents call', async () => {
    const { result } = renderHook(() => useGameState({ playerIndex: 0 }));

    expect(result.current.isInitialLoad).toBe(true);

    await act(async () => {
      result.current.processEvents([startedEvent]);
    });

    expect(result.current.isInitialLoad).toBe(false);
  });

  it('isInitialLoad stays false after subsequent processEvents calls', async () => {
    const { result } = renderHook(() => useGameState({ playerIndex: 0 }));

    await act(async () => {
      result.current.processEvents([startedEvent]);
    });
    expect(result.current.isInitialLoad).toBe(false);

    const anotherEvent: GameEvent = { ...startedEvent, id: 'e2', sequence: 2 };
    await act(async () => {
      result.current.processEvents([anotherEvent]);
    });
    expect(result.current.isInitialLoad).toBe(false);
  });

  it('isInitialLoad resets to true after reset()', async () => {
    const { result } = renderHook(() => useGameState({ playerIndex: 0 }));

    await act(async () => {
      result.current.processEvents([startedEvent]);
    });
    expect(result.current.isInitialLoad).toBe(false);

    act(() => {
      result.current.reset();
    });
    expect(result.current.isInitialLoad).toBe(true);
  });

  it('isInitialLoad is still true synchronously during the render where events arrive', () => {
    const { result } = renderHook(() => useGameState({ playerIndex: 0 }));

    act(() => {
      result.current.processEvents([startedEvent]);
      // Inside the same act, before effects flush — flag is still true
      expect(result.current.isInitialLoad).toBe(true);
    });
    // After act completes, effects have run and the flag has flipped
    expect(result.current.isInitialLoad).toBe(false);
  });
});
