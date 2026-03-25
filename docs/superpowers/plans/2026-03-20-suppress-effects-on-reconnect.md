# Suppress Effects on Reconnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent sounds, haptics, and turn notifications from firing during the initial event-batch load when a player reconnects to an in-progress game.

**Architecture:** Add an `isInitialLoad: boolean` flag to `useGameState`. It starts `true`, flips to `false` after the first event batch settles. `useGame` forwards it; `GameScreen` checks it in the sound/haptic effect; `useTurnNotification` and `useTurnHaptic` receive it and short-circuit their callbacks.

**Tech Stack:** React hooks, TypeScript, Vitest + `@testing-library/react` (`renderHook`, `act`).

---

## File Map

| File                                                    | Change                                                           |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `packages/ui-shared/src/useGameState.ts`                | Add `isInitialLoad` state + effect; add to return type           |
| `packages/ui-shared/src/__tests__/useGameState.test.ts` | New test file for `isInitialLoad` lifecycle                      |
| `apps/client/src/hooks/useGame.ts`                      | Destructure + forward `isInitialLoad`                            |
| `apps/client/src/components/ui/GameScreen.tsx`          | Check `isInitialLoad` in sound/haptic effect; pass to turn hooks |
| `apps/client/src/hooks/useTurnNotification.ts`          | Add `isInitialLoad` param; guard callback                        |
| `apps/client/src/hooks/useTurnNotification.web.ts`      | Add `isInitialLoad` param to match signature                     |
| `apps/client/src/hooks/useTurnHaptic.ts`                | Add `isInitialLoad` param; guard callback                        |
| `apps/client/src/hooks/useTurnHaptic.web.ts`            | Add `isInitialLoad` param to match signature                     |

---

## Task 1: Add `isInitialLoad` to `useGameState`

**Files:**

- Modify: `packages/ui-shared/src/useGameState.ts`
- Create: `packages/ui-shared/src/__tests__/useGameState.test.ts`

- [ ] **Step 1: Write a failing test**

Create `packages/ui-shared/src/__tests__/useGameState.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState } from '../useGameState.js';
import type { GameEvent } from '@dabb/shared-types';

const startedEvent: GameEvent = {
  id: 'e1',
  sequence: 1,
  type: 'GAME_STARTED',
  playerCount: 3,
  playerIds: ['p0', 'p1', 'p2'],
  timestamp: new Date().toISOString(),
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
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
pnpm --filter @dabb/ui-shared test -- --reporter=verbose useGameState
```

Expected: FAIL — `isInitialLoad` is not in the return type yet.

- [ ] **Step 3: Implement `isInitialLoad` in `useGameState`**

Edit `packages/ui-shared/src/useGameState.ts`:

```typescript
/**
 * Event-sourced game state hook
 */

import { useState, useCallback, useEffect } from 'react';
import type { GameEvent, GameState, PlayerIndex } from '@dabb/shared-types';
import { applyEvents, createInitialState, filterEventsForPlayer } from '@dabb/game-logic';

interface UseGameStateOptions {
  playerIndex: PlayerIndex;
  initialPlayerCount?: 2 | 3 | 4;
}

interface UseGameStateReturn {
  state: GameState;
  events: GameEvent[];
  isInitialLoad: boolean;
  processEvents: (newEvents: GameEvent[]) => void;
  reset: () => void;
}

export function useGameState(options: UseGameStateOptions): UseGameStateReturn {
  const { playerIndex, initialPlayerCount = 4 } = options;

  const [events, setEvents] = useState<GameEvent[]>([]);
  const [state, setState] = useState<GameState>(() => createInitialState(initialPlayerCount));
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const processEvents = useCallback(
    (newEvents: GameEvent[]) => {
      // Filter events for this player's view
      const filteredEvents = filterEventsForPlayer(newEvents, playerIndex);

      setEvents((prev) => {
        // Deduplicate by event ID
        const existingIds = new Set(prev.map((e) => e.id));
        const uniqueNewEvents = filteredEvents.filter((e) => !existingIds.has(e.id));

        if (uniqueNewEvents.length === 0) {
          return prev;
        }

        const combined = [...prev, ...uniqueNewEvents].sort((a, b) => a.sequence - b.sequence);

        // Rebuild state from all events
        const newState = applyEvents(combined);
        setState(newState);

        return combined;
      });
    },
    [playerIndex]
  );

  // Clear isInitialLoad after the first event batch settles.
  // React state updates from within useEffect are applied after all effects in the
  // current render finish — so isInitialLoad remains true for all sibling effects
  // (e.g. the sound/haptic effect in GameScreen) during the render where events
  // first arrive. Using the functional updater avoids adding isInitialLoad to the
  // dependency array (which would cause an ESLint exhaustive-deps warning).
  useEffect(() => {
    if (events.length > 0) {
      setIsInitialLoad((prev) => (prev ? false : prev));
    }
  }, [events]);

  const reset = useCallback(() => {
    setEvents([]);
    setState(createInitialState(initialPlayerCount));
    setIsInitialLoad(true);
  }, [initialPlayerCount]);

  return {
    state,
    events,
    isInitialLoad,
    processEvents,
    reset,
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
pnpm --filter @dabb/ui-shared test -- --reporter=verbose useGameState
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-shared/src/useGameState.ts packages/ui-shared/src/__tests__/useGameState.test.ts
git commit -m "feat: add isInitialLoad flag to useGameState"
```

---

## Task 2: Forward `isInitialLoad` through `useGame`

**Files:**

- Modify: `apps/client/src/hooks/useGame.ts`

No separate test — this is pure forwarding; covered by downstream compilation.

- [ ] **Step 1: Destructure and return `isInitialLoad`**

In `apps/client/src/hooks/useGame.ts`, change lines 18–20 and the return object:

```typescript
const { state, events, isInitialLoad, processEvents, reset } = useGameState({
  playerIndex: playerIndex as PlayerIndex,
});
```

And add `isInitialLoad` to the return object (line 64–80):

```typescript
return {
  state,
  events,
  isInitialLoad,
  nicknames,
  connected,
  connecting,
  error,
  reset,
  onBid,
  onPass,
  onTakeDabb,
  onDiscard,
  onGoOut,
  onDeclareTrump,
  onDeclareMelds,
  onPlayCard,
};
```

- [ ] **Step 2: Type-check**

```bash
pnpm --filter @dabb/client run typecheck 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/hooks/useGame.ts
git commit -m "feat: forward isInitialLoad from useGame"
```

---

## Task 3: Add `isInitialLoad` guard to `useTurnNotification` and `useTurnHaptic`

**Files:**

- Modify: `apps/client/src/hooks/useTurnNotification.ts`
- Modify: `apps/client/src/hooks/useTurnNotification.web.ts`
- Modify: `apps/client/src/hooks/useTurnHaptic.ts`
- Modify: `apps/client/src/hooks/useTurnHaptic.web.ts`

No unit tests for these hooks (no existing test infrastructure; verified manually).

**Note on `useActionRequiredCallback` interaction:** The existing `hasInitialized` ref in `useActionRequiredCallback` already skips the callback on the very first render, and records `prevActionRequired` from that render. If action is required at initial load, `prevActionRequired` is set to `true` on render #1, so render #2 sees `true → true` and doesn't fire. The `isInitialLoad` guard added here is defense-in-depth — a second safety net for edge cases where the two renders land differently.

- [ ] **Step 1: Update `useTurnNotification`**

Replace the entire file content of `apps/client/src/hooks/useTurnNotification.ts`:

```typescript
/**
 * Hook to play a notification sound when it's the player's turn
 */

import { useCallback, useEffect } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const notificationSound = require('../../assets/sounds/notification.ogg');

/**
 * Plays a notification sound when the player needs to perform an action.
 * Suppressed during initial state load on reconnect.
 */
export function useTurnNotification(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null,
  isInitialLoad: boolean
): void {
  useEffect(() => {
    setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      interruptionModeAndroid: 'mixWithOthers',
    });
  }, []);

  const player = useAudioPlayer(notificationSound);

  const playNotification = useCallback(async () => {
    if (isInitialLoad) {
      return;
    }

    if (!player) {
      return;
    }

    try {
      player.volume = 0.5;
      player.seekTo(0);
      await Promise.resolve(player.play()).catch(() => {
        // Ignore autoplay policy rejections (e.g. browser requires user gesture)
      });
    } catch {
      // Ignore synchronous playback errors
    }
  }, [player, isInitialLoad]);

  useActionRequiredCallback(state, currentPlayerIndex, playNotification);
}
```

- [ ] **Step 2: Update `useTurnHaptic`**

Replace the entire file content of `apps/client/src/hooks/useTurnHaptic.ts`:

```typescript
/**
 * Hook to trigger a haptic pulse when it's the player's turn.
 * Suppressed during initial state load on reconnect.
 */
import { useCallback } from 'react';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';
import { triggerHaptic } from '../utils/haptics.js';

export function useTurnHaptic(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null,
  isInitialLoad: boolean
): void {
  const triggerTurnHaptic = useCallback(async () => {
    if (isInitialLoad) {
      return;
    }
    triggerHaptic('turn-notification');
  }, [isInitialLoad]);

  useActionRequiredCallback(state, currentPlayerIndex, triggerTurnHaptic);
}
```

- [ ] **Step 3: Update `useTurnNotification.web.ts`**

The web stub must match the new signature. Replace `apps/client/src/hooks/useTurnNotification.web.ts`:

```typescript
/**
 * Web stub for useTurnNotification — audio autoplay is blocked by browsers
 * until after a user gesture, and expo-audio throws uncatchable errors on web.
 * The visual turn indicator is sufficient feedback on web.
 */

import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';
import { useCallback } from 'react';

export function useTurnNotification(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null,
  _isInitialLoad: boolean
): void {
  const noop = useCallback(() => Promise.resolve(), []);
  useActionRequiredCallback(state, currentPlayerIndex, noop);
}
```

- [ ] **Step 4: Update `useTurnHaptic.web.ts`**

Replace `apps/client/src/hooks/useTurnHaptic.web.ts`:

```typescript
/**
 * Web stub for useTurnHaptic — haptics are not available on web.
 */
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';
import { useCallback } from 'react';

export function useTurnHaptic(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null,
  _isInitialLoad: boolean
): void {
  const noop = useCallback(() => Promise.resolve(), []);
  useActionRequiredCallback(state, currentPlayerIndex, noop);
}
```

- [ ] **Step 5: Type-check**

```bash
pnpm --filter @dabb/client run typecheck 2>&1 | head -30
```

Expected: TypeScript errors on the call sites in `GameScreen.tsx` — the hooks now require a third argument. That's expected and will be fixed in Task 4.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/hooks/useTurnNotification.ts apps/client/src/hooks/useTurnNotification.web.ts apps/client/src/hooks/useTurnHaptic.ts apps/client/src/hooks/useTurnHaptic.web.ts
git commit -m "feat: suppress turn notification/haptic during initial load"
```

---

## Task 4: Update `GameScreen` to use `isInitialLoad`

**Files:**

- Modify: `apps/client/src/components/ui/GameScreen.tsx`

- [ ] **Step 1: Destructure `isInitialLoad` from `useGame`**

In `GameScreen.tsx`, find the `useGame` destructuring (around line 134) and add `isInitialLoad`:

```typescript
const {
  state,
  events,
  isInitialLoad,
  nicknames,
  connected,
  onBid,
  onPass,
  onTakeDabb,
  onDiscard,
  onGoOut,
  onDeclareTrump,
  onDeclareMelds,
  onPlayCard,
} = useGame({ sessionId, secretId, playerIndex });
```

- [ ] **Step 2: Pass `isInitialLoad` to turn hooks**

Find lines 184–185 and update:

```typescript
useTurnNotification(state, playerIndex, isInitialLoad);
useTurnHaptic(state, playerIndex, isInitialLoad);
```

- [ ] **Step 3: Guard the sound/haptic `useEffect`**

Find the sound/haptic `useEffect` (around line 187–222) and update it. The key change is: advance `lastSoundedEventIdx.current` unconditionally (to prevent replay on next render), then return early if `isInitialLoad`. Also remove the outdated comment.

```typescript
// Sound effects: play on new events, suppressed during initial load on reconnect.
const lastSoundedEventIdx = useRef(events.length);
useEffect(() => {
  const newEvents = events.slice(lastSoundedEventIdx.current);
  lastSoundedEventIdx.current = events.length;
  if (isInitialLoad) {
    return;
  }
  for (const event of newEvents) {
    switch (event.type) {
      case 'CARDS_DEALT':
        playSound('card-deal');
        triggerHaptic('card-deal');
        break;
      case 'CARD_PLAYED':
        playSound('card-play');
        triggerHaptic('card-play');
        break;
      case 'BID_PLACED':
        playSound('bid-place');
        triggerHaptic('bid-place');
        break;
      case 'PLAYER_PASSED':
        playSound('pass');
        triggerHaptic('pass');
        break;
      case 'TRICK_WON':
        playSound('trick-win');
        triggerHaptic('trick-win');
        break;
      case 'GAME_FINISHED':
        playSound('game-win');
        triggerHaptic('game-win');
        break;
    }
  }
}, [events, isInitialLoad]);
```

- [ ] **Step 4: Type-check and run tests**

```bash
pnpm run build 2>&1 | tail -20
pnpm test 2>&1 | tail -20
```

Expected: build passes, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/ui/GameScreen.tsx
git commit -m "feat: suppress sounds and haptics during initial load on reconnect"
```

---

## Task 5: Full CI verification

- [ ] **Step 1: Run CI check**

```bash
pnpm run build && pnpm test && pnpm lint && pnpm run typecheck
```

Expected: all pass.

- [ ] **Step 2: If anything fails, fix it before proceeding**

Common issues:

- Lint: `pnpm lint:fix` to auto-fix
- Type errors: re-read the failing file and fix the type mismatch

- [ ] **Step 3: Done**

Reconnect to a game in progress to manually verify: no sounds, no haptics, no turn notification plays until the next real game action.
