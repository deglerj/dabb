import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useGameState } from '@dabb/ui-shared';
import type { PlayerIndex, GameEvent } from '@dabb/shared-types';

function makeGameStartedEvent(): GameEvent {
  return {
    id: 'evt-1',
    type: 'GAME_STARTED',
    sessionId: 'test-session',
    sequence: 1,
    timestamp: Date.now(),
    payload: {
      playerCount: 2,
      targetScore: 1000,
      dealer: 0 as PlayerIndex,
    },
  } as GameEvent;
}

function makeCardsDealtEvent(): GameEvent {
  return {
    id: 'evt-2',
    type: 'CARDS_DEALT',
    sessionId: 'test-session',
    sequence: 2,
    timestamp: Date.now(),
    payload: {
      hands: {
        0: [
          { id: 'herz-ass-0', suit: 'herz', rank: 'ass', copy: 0 },
          { id: 'kreuz-koenig-0', suit: 'kreuz', rank: 'koenig', copy: 0 },
        ],
        1: [
          { id: 'schippe-buabe-0', suit: 'schippe', rank: 'buabe', copy: 0 },
          { id: 'bollen-10-0', suit: 'bollen', rank: '10', copy: 0 },
        ],
      },
      dabb: [{ id: 'herz-ober-0', suit: 'herz', rank: 'ober', copy: 0 }],
    },
  } as GameEvent;
}

describe('useGameState', () => {
  it('creates initial state with correct player count', () => {
    const { result } = renderHook(() =>
      useGameState({ playerIndex: 0 as PlayerIndex, initialPlayerCount: 2 })
    );

    expect(result.current.state.playerCount).toBe(2);
    expect(result.current.state.phase).toBe('waiting');
    expect(result.current.events).toHaveLength(0);
  });

  it('applies events and updates state', () => {
    const { result } = renderHook(() =>
      useGameState({ playerIndex: 0 as PlayerIndex, initialPlayerCount: 2 })
    );

    act(() => {
      result.current.processEvents([makeGameStartedEvent()]);
    });

    expect(result.current.state.phase).toBe('dealing');
    expect(result.current.events).toHaveLength(1);
  });

  it('filters events for player (anti-cheat)', () => {
    const { result } = renderHook(() =>
      useGameState({ playerIndex: 0 as PlayerIndex, initialPlayerCount: 2 })
    );

    act(() => {
      result.current.processEvents([makeGameStartedEvent(), makeCardsDealtEvent()]);
    });

    // Player 0 should see their own cards but player 1's cards should be hidden
    const hand0 = result.current.state.hands.get(0 as PlayerIndex);
    const hand1 = result.current.state.hands.get(1 as PlayerIndex);

    expect(hand0).toBeDefined();
    expect(hand0!.length).toBeGreaterThan(0);

    // Player 1's cards should be hidden (id starts with 'hidden-')
    if (hand1 && hand1.length > 0) {
      hand1.forEach((card) => {
        expect(card.id).toMatch(/^hidden-/);
      });
    }
  });

  it('reset returns to initial state', () => {
    const { result } = renderHook(() =>
      useGameState({ playerIndex: 0 as PlayerIndex, initialPlayerCount: 2 })
    );

    act(() => {
      result.current.processEvents([makeGameStartedEvent()]);
    });

    expect(result.current.state.phase).not.toBe('waiting');

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.phase).toBe('waiting');
    expect(result.current.events).toHaveLength(0);
  });

  it('accumulates events across multiple processEvents calls', () => {
    const { result } = renderHook(() =>
      useGameState({ playerIndex: 0 as PlayerIndex, initialPlayerCount: 2 })
    );

    act(() => {
      result.current.processEvents([makeGameStartedEvent()]);
    });

    expect(result.current.events).toHaveLength(1);

    act(() => {
      result.current.processEvents([makeCardsDealtEvent()]);
    });

    expect(result.current.events).toHaveLength(2);
  });
});
