# Error Screen Design

**Date:** 2026-03-21
**Status:** Approved

## Overview

Replace the current white-screen crash with a full-screen error display that shows debug information and offers Reload and Copy actions. Targets developers primarily, but acceptable for all users to see.

## New Dependencies

`expo-clipboard` must be added to `apps/client/package.json`. Use the Expo-managed install command to align the native module version with the installed Expo SDK:

```sh
npx expo install expo-clipboard --filter @dabb/client
```

`expo-updates` is **not** required; the imperative `router` singleton from `expo-router` handles reload instead.

## Architecture

Three new files in `apps/client/src/components/ui/`:

### `ErrorBoundaryScreen`

Pure display component. All text is hardcoded English (it is outside `I18nProvider`). Props:

```ts
interface ErrorBoundaryScreenProps {
  error: Error;
  extraContext?: Record<string, unknown>;
  onReload: () => void;
  onCopy: () => void;
}
```

Renders the full-screen error UI. No logic.

### `AppErrorBoundary`

React class component defined at module level. `_layout.tsx`'s default export wraps `RootLayout` so the boundary is a true ancestor:

```tsx
// _layout.tsx
function RootLayout() {
  /* ... existing code ... */
}

export default function RootLayoutWithBoundary() {
  return (
    <AppErrorBoundary>
      <RootLayout />
    </AppErrorBoundary>
  );
}
```

- Catches any render crash in the entire app.
- Shows `ErrorBoundaryScreen` with `error` only (no game context available here).
- `onReload` is defined as a class method:

```ts
import { router } from 'expo-router'; // imperative singleton — NOT useRouter()
import { Platform } from 'react-native';

handleReload = () => {
  if (Platform.OS === 'web') {
    window.location.reload(); // safe: tsconfig includes "lib": ["DOM"]
  } else {
    router.replace('/');
  }
};
```

### `GameScreenErrorBoundary`

React class component. Wraps the **entire** return of `GameScreen` (including the loading branch) so render errors during any phase are caught with game context:

```tsx
// GameScreen.tsx — full return wrapped:
const handleReload = useCallback(() => router.replace('/'), [router]);

return (
  <GameScreenErrorBoundary
    state={state}
    events={events}
    connected={connected}
    onReload={handleReload}
  >
    {state.phase === 'waiting' ? (
      <LoadingView insets={insets} />   {/* extracted from the early return */}
    ) : (
      <View style={styles.outerContainer}>
        {/* all existing game content */}
      </View>
    )}
  </GameScreenErrorBoundary>
);
```

Props type:

```ts
import type { GameState, GameEvent } from '@dabb/shared-types';

interface GameScreenErrorBoundaryProps {
  state: GameState;
  events: GameEvent[];
  connected: boolean;
  onReload: () => void;
  children: React.ReactNode;
}
```

When a child crashes, `getDerivedStateFromError` stores the error; `componentDidCatch` stores the last-rendered props as a debug snapshot (acknowledged limitation: this is the state at last render, not necessarily perfectly current). The boundary then renders `ErrorBoundaryScreen` with `extraContext` built from the snapshot.

## Debug Data

### Error section (always present)

- Error message (`error.message`)
- Stack trace (`error.stack`)

### Game context section (`GameScreenErrorBoundary` only)

Passed as `extraContext` to `ErrorBoundaryScreen`:

```ts
{
  connected,
  eventCount: events.length,
  recentEvents: events.slice(-10).map(e => e.type),
  state: serializeGameState(state),
}
```

`GameState` contains several Maps and a Set that `JSON.stringify` cannot serialize. Convert all of them explicitly:

```ts
import type { GameState } from '@dabb/shared-types';

function serializeGameState(state: GameState): Record<string, unknown> {
  return {
    phase: state.phase,
    round: state.round,
    playerCount: state.playerCount,
    players: state.players,
    targetScore: state.targetScore,
    dealer: state.dealer,
    currentBidder: state.currentBidder,
    firstBidder: state.firstBidder,
    currentBid: state.currentBid,
    bidWinner: state.bidWinner,
    passedPlayers: Array.from(state.passedPlayers), // Set → array
    trump: state.trump,
    wentOut: state.wentOut,
    dabb: state.dabb,
    dabbCardIds: state.dabbCardIds,
    hands: Object.fromEntries(state.hands.entries()),
    currentTrick: state.currentTrick,
    currentPlayer: state.currentPlayer,
    lastCompletedTrick: state.lastCompletedTrick,
    tricksTaken: Object.fromEntries(state.tricksTaken.entries()),
    declaredMelds: Object.fromEntries(state.declaredMelds.entries()),
    roundScores: Object.fromEntries(state.roundScores.entries()),
    totalScores: Object.fromEntries(state.totalScores.entries()),
  };
}
```

### Copy action

```ts
import * as Clipboard from 'expo-clipboard';

const text = [
  '=== ERROR ===',
  error.message,
  '',
  '=== STACK TRACE ===',
  error.stack ?? '(no stack)',
  ...(extraContext ? ['', '=== GAME CONTEXT ===', JSON.stringify(extraContext, null, 2)] : []),
].join('\n');

await Clipboard.setStringAsync(text);
```

## Visual Design

Consistent with the existing wood/paper theme (`UpdateRequiredScreen`, `theme.ts`):

| Element                      | Style                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Background                   | `Colors.woodDark` (`#8a5e2e`)                                                                                                          |
| Title "Something went wrong" | `Fonts.display`, `Colors.paperFace`, 24px                                                                                              |
| Error message                | `Colors.paperFace`, `Fonts.bodyBold`, 16px — `Colors.error` (#a32020) has insufficient contrast on `woodDark` and is not used for text |
| Stack trace / JSON           | `Fonts.body`, `Colors.paperAged`, inside dark inset box (`rgba(0,0,0,0.3)`)                                                            |
| Scroll area                  | `ScrollView` for stack trace and JSON context                                                                                          |
| Reload button                | Amber fill (`Colors.amber`), `Colors.paperFace` label — primary action                                                                 |
| Copy button                  | Transparent fill, `Colors.amber` border and label — secondary action                                                                   |

## Actions

**Reload** — see `handleReload` in architecture section above.

**Copy** — see copy action in debug data section above.

## Files Changed

| File                                                        | Change                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/client/src/components/ui/ErrorBoundaryScreen.tsx`     | New                                                                   |
| `apps/client/src/components/ui/AppErrorBoundary.tsx`        | New                                                                   |
| `apps/client/src/components/ui/GameScreenErrorBoundary.tsx` | New                                                                   |
| `apps/client/src/app/_layout.tsx`                           | Change default export to `RootLayoutWithBoundary`                     |
| `apps/client/src/components/ui/GameScreen.tsx`              | Extract loading branch; wrap full return in `GameScreenErrorBoundary` |
| `apps/client/package.json`                                  | Add `expo-clipboard`                                                  |

## Out of Scope

- Non-render (async/promise) errors — these are rare and a separate concern
- i18n of error screen text — hardcoded English is fine for a debug tool
- Collapsible sections — always expanded for simplicity
- Persisting error logs to server or storage
