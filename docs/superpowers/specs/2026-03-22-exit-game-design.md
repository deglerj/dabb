# Exit Game Feature — Design Spec

**Date:** 2026-03-22

## Overview

Players can exit an active game from the Options dialog. Exiting terminates the session for all players. The exiting player is returned to the welcome screen; other players see a dialog informing them the game ended, then tap Done to return.

## Backend

The server already implements this fully:

- `game:exit` socket event → calls `terminateGame`, broadcasts `GAME_TERMINATED` event to all, emits `session:terminated` to all, disconnects all sockets.

No backend changes required.

## UI Entry Point

An "Exit Game" button is added at the bottom of `OptionsDialog` (gear icon, top-right of game screen), below the language section, separated by a divider. The button uses a destructive red style to signal irreversibility.

The button is only rendered when `onExitGame` prop is provided, keeping `OptionsDialog` reusable. `OptionsButton` receives the same prop and passes it through.

## Confirmation

On pressing "Exit Game", `Alert.alert` shows a native OS confirmation dialog using existing i18n strings:

- Title: `options.exitGameConfirmTitle`
- Message: `options.exitGameConfirmMessage`
- Actions: Cancel (no-op) and Confirm (destructive)

## Exiting Player Flow

On confirm: close the dialog, emit `game:exit`, then immediately `router.replace('/')`. No waiting for server acknowledgement — the server will disconnect the socket anyway.

## Other Players Flow

`useSocket` gains an `onSessionTerminated?: (data: { message: string; terminatedBy?: string }) => void` callback, matching the existing `ServerToClientEvents` shape. When `session:terminated` arrives inside the `useEffect` closure:

1. Call `newSocket.disconnect()` directly (stops reconnection attempts — the session is gone, reconnection would be futile and show a misleading banner).
2. Call `callbacksRef.current.onSessionTerminated?.(data)` to notify the consumer.

`useGame` exposes `onSessionTerminated` to the caller. In `GameScreen`:

- `sessionTerminated` boolean state is set to `true` (suppresses the reconnecting banner).
- `terminatedByNickname` string state stores the `terminatedBy` value from the event.
- The existing `GameTerminatedModal` triggers from `state.phase === 'terminated'` (set by the `GAME_TERMINATED` event). It receives `terminatedByNickname` as a new optional prop.
- When `terminatedByNickname` is set, the modal title shows `t('game.playerEndedGame', { name })` instead of `t('game.gameEnded')`.
- Tapping Done navigates to `/`.

A new i18n key `game.playerEndedGame` is added to both locales:

- DE: `"{{name}} hat das Spiel beendet"`
- EN: `"{{name}} ended the game"`

## Files Changed

| File                                                      | Change                                                                                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/client/src/components/ui/OptionsDialog.tsx`         | Add `onExitGame` prop + Exit Game button with Alert confirmation                                                                                                                                                               |
| `apps/client/src/components/ui/OptionsButton.tsx`         | Add `onExitGame` prop, pass to `OptionsDialog`                                                                                                                                                                                 |
| `apps/client/src/components/ui/GameScreen.tsx`            | Wire `handleExitGame`; pass to the in-game `OptionsButton` only (the loading-state instance gets no `onExitGame`); suppress reconnecting banner when `sessionTerminated`; pass `terminatedByNickname` to `GameTerminatedModal` |
| `apps/client/src/components/game/GameTerminatedModal.tsx` | Add `terminatedByNickname?: string` prop; show `game.playerEndedGame` message when set                                                                                                                                         |
| `packages/ui-shared/src/useSocket.ts`                     | Add `onSessionTerminated` callback + handler                                                                                                                                                                                   |
| `apps/client/src/hooks/useGame.ts`                        | Thread `onSessionTerminated` through                                                                                                                                                                                           |
| `packages/i18n/src/locales/de.ts`                         | Add `game.playerEndedGame`                                                                                                                                                                                                     |
| `packages/i18n/src/locales/en.ts`                         | Add `game.playerEndedGame`                                                                                                                                                                                                     |
| `packages/i18n/src/types.ts`                              | Add `playerEndedGame` to `game` namespace type                                                                                                                                                                                 |

## Out of Scope

- Backend changes (already complete)
- New components (all changes are additions to existing files)
- Waiting room exit (already implemented)
