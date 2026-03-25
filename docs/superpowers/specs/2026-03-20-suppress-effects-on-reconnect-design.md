# Suppress Effects on Reconnect

**Date:** 2026-03-20
**Status:** Approved

## Problem

When a player reconnects to an in-progress game, the client receives the full historical event log via `game:state`. This causes sounds, haptics, and potentially animations to replay for all past events — card deals, bids, tricks won, etc. The desired behaviour is complete silence and stillness until the next real game action occurs.

## Root Cause

`GameScreen.tsx` tracks which events have already triggered effects using `const lastSoundedEventIdx = useRef(events.length)`. On component remount (reconnect), this ref resets to `0` if the `events` array is empty at mount time. When the server's `game:state` batch arrives and populates `events`, the `useEffect` treats all historical events as new and plays their sounds/haptics. A comment in the code acknowledges this as "acceptable for this use case" — it is not.

`useTurnNotification` and `useTurnHaptic` use `useActionRequiredCallback` which guards against the first render only; they can still fire if action is required at the time of initial load.

## Approach: `isInitialLoad` flag in `useGameState`

Add an `isInitialLoad: boolean` to the return value of `useGameState` in `packages/ui-shared/src/useGameState.ts`. All effect systems that produce sounds or haptics check this flag and skip when it is `true`.

### Flag lifecycle

1. `isInitialLoad` starts as `true` (React state).
2. When the first `game:state` batch arrives, `processEvents` updates the `events` state.
3. A `useEffect` watching `events` in `useGameState` calls `setIsInitialLoad(false)`.
4. React state updates from within a `useEffect` are not applied until after all effects from the current render have finished. This guarantees that all effects in the same render — including `GameScreen`'s sound/haptic effect — see `isInitialLoad === true` when events first arrive.
5. The sound/haptic effect updates `lastSoundedEventIdx.current` to `events.length` unconditionally (even when suppressed), so on the subsequent render (when `isInitialLoad` flips to `false`) there are no new events and no spurious sounds fire.

### Systems affected

| System                           | File                                               | Change needed                                    |
| -------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Sounds & haptics                 | `apps/client/src/components/ui/GameScreen.tsx`     | Check `isInitialLoad`, early-return              |
| Turn notification sound          | `apps/client/src/hooks/useTurnNotification.ts`     | Receive & check `isInitialLoad`                  |
| Turn haptic                      | `apps/client/src/hooks/useTurnHaptic.ts`           | Receive & check `isInitialLoad`                  |
| Game hook                        | `apps/client/src/hooks/useGame.ts`                 | Forward `isInitialLoad` from `useGameState`      |
| Trick animation guard            | `packages/ui-shared/src/useTrickAnimationState.ts` | No change (already guards with `initialLoadRef`) |
| Celebration (confetti/fireworks) | `packages/ui-shared/src/useCelebration.ts`         | No change (see note below)                       |
| Ripple/sweep particles           | `packages/game-canvas/src/table/useSkiaEffects.ts` | No change (triggered by real-time code only)     |

### Data flow

```
useGameState
  ├── returns: { events, state, isInitialLoad, ... }
  │
  └── consumed by:
       ├── GameScreen.tsx         — suppresses sound/haptic useEffect
       ├── useTurnNotification    — suppresses turn sound
       └── useTurnHaptic          — suppresses turn haptic
```

`isInitialLoad` flows: `useGameState` → returned by `useGame` → destructured in `GameScreen` → passed to `useTurnNotification` and `useTurnHaptic`.

**Note on `useCelebration`:** This hook replays the full `events` array via `useMemo` to compute celebration state. On reconnect, if the player had already won a round or the game before disconnecting, the celebration visual (confetti/fireworks) will be restored immediately. This is accepted behaviour — it is not triggered by a new action, and the animation was already legitimately earned. No suppression is applied.

## Out of scope

- Server-side changes
- Animations (trick sweep, card flight arcs) — already safe
- Celebration layer — already safe

## Testing

No new automated tests. The fix is verifiable by manual reconnect testing: join a game in progress, disconnect, rejoin — no sounds, haptics, or animations should play until the next real action.

Existing tests for `useGameState` and game logic continue to pass unchanged; `isInitialLoad` is additive.
