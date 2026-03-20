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

1. `isInitialLoad` starts as `true`.
2. When the first `game:state` batch arrives, `processEvents` updates the `events` state.
3. A `useEffect` watching `events` in `useGameState` sets `isInitialLoad` to `false`.
4. Because the flag lives in state (not a ref), flipping it triggers a re-render. From that render onward, all effect hooks fire normally.
5. The sound/haptic `useEffect` in `GameScreen.tsx` runs on the same render that events arrive — at that point `isInitialLoad` is still `true`, so effects are suppressed. On the next render (after the flag flips), no new events have arrived, so no effects fire spuriously.

### Systems affected

| System                           | File                                               | Change needed                                      |
| -------------------------------- | -------------------------------------------------- | -------------------------------------------------- |
| Sounds & haptics                 | `apps/client/src/components/ui/GameScreen.tsx`     | Check `isInitialLoad`, early-return                |
| Turn notification sound          | `apps/client/src/hooks/useTurnNotification.ts`     | Receive & check `isInitialLoad`                    |
| Turn haptic                      | `apps/client/src/hooks/useTurnHaptic.ts`           | Receive & check `isInitialLoad`                    |
| Trick animation guard            | `packages/ui-shared/src/useTrickAnimationState.ts` | No change (already guards with `initialLoadRef`)   |
| Celebration (confetti/fireworks) | `packages/ui-shared/src/useCelebration.ts`         | No change (safe: only triggers on prop transition) |
| Ripple/sweep particles           | `packages/game-canvas/src/table/useSkiaEffects.ts` | No change (triggered by real-time code only)       |

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

`isInitialLoad` is passed as a prop to `useTurnNotification` and `useTurnHaptic` from `GameScreen`, which already calls `useGameState`.

## Out of scope

- Server-side changes
- Animations (trick sweep, card flight arcs) — already safe
- Celebration layer — already safe

## Testing

No new automated tests. The fix is verifiable by manual reconnect testing: join a game in progress, disconnect, rejoin — no sounds, haptics, or animations should play until the next real action.

Existing tests for `useGameState` and game logic continue to pass unchanged; `isInitialLoad` is additive.
