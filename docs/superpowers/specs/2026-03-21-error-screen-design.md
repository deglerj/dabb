# Error Screen Design

**Date:** 2026-03-21
**Status:** Approved

## Overview

Replace the current white-screen crash with a full-screen error display that shows debug information and offers Reload and Copy actions. Targets developers primarily, but acceptable for all users to see.

## Architecture

Three new files in `apps/client/src/components/ui/`:

### `ErrorBoundaryScreen`

Pure display component. Props:

```ts
interface ErrorBoundaryScreenProps {
  error: Error;
  extraContext?: Record<string, unknown>;
  onReload: () => void;
  onCopy: () => void;
}
```

Renders the full-screen error UI. No logic — just layout and theme.

### `AppErrorBoundary`

React class component (`React.Component`). Placed in `_layout.tsx` wrapping the entire app tree (inside `GestureHandlerRootView` and `SafeAreaProvider`, but outside `I18nProvider` — so it cannot use `useTranslation`; all text is hardcoded English).

- Catches any render crash in the app.
- Shows `ErrorBoundaryScreen` with `error` only (no game context at this level).
- Reload: `Updates.reloadAsync()` on native, `window.location.reload()` on web, via `Platform.OS` check.

### `GameScreenErrorBoundary`

React class component. Used **inside** `GameScreen`'s return JSX, wrapping all rendered content after hooks have already run.

```tsx
// Inside GameScreen return:
return (
  <GameScreenErrorBoundary
    state={state}
    events={events}
    connected={connected}
    onReload={() => router.replace('/')}
  >
    <View style={styles.outerContainer}>{/* all game content */}</View>
  </GameScreenErrorBoundary>
);
```

Receives `state`, `events`, `connected`, and `onReload` as props. When a child crashes, it stores the props at the time of the crash and renders `ErrorBoundaryScreen` with game context as `extraContext`.

## Debug Data

### Error section (always present)

- Error message (string)
- Stack trace (string)

### Game context section (only in `GameScreenErrorBoundary`)

Shown as pretty-printed JSON:

- `connected: boolean`
- Selected game state fields: `phase`, `playerCount`, `currentBid`, `bidWinner`, `trump`
- `eventCount: number` (total events)
- `recentEvents: string[]` (last 10 event types)
- Full `state` as a serialized object (Maps converted to plain objects)

Maps in `GameState` (`hands`, `roundScores`, `totalScores`) must be serialized via a custom replacer or pre-conversion since `JSON.stringify` skips Maps.

### Copy action

Assembles all displayed info as plain text and calls `Clipboard.setStringAsync` from `expo-clipboard`.

## Visual Design

Consistent with the existing wood/paper theme (see `UpdateRequiredScreen` and `theme.ts`):

| Element                      | Style                                                                      |
| ---------------------------- | -------------------------------------------------------------------------- |
| Background                   | `Colors.woodDark` (`#8a5e2e`)                                              |
| Title "Something went wrong" | `Fonts.display`, `Colors.paperFace`, 24px                                  |
| Error message                | `Colors.error` (`#a32020`), `Fonts.bodyBold`, 16px                         |
| Stack trace / JSON           | Monospace (`Lato_400Regular`), `Colors.paperAged`, inside darker inset box |
| Inset box background         | `Colors.woodGrain` / semi-transparent darker panel                         |
| Scroll area                  | `ScrollView` for both stack trace and JSON context                         |
| Reload button                | Amber fill (`Colors.amber`), `Colors.paperFace` label — primary action     |
| Copy button                  | Transparent fill, amber border, `Colors.amber` label — secondary action    |

## Actions

**Reload**

- `AppErrorBoundary`: `Platform.OS === 'web' ? window.location.reload() : Updates.reloadAsync()`
- `GameScreenErrorBoundary`: `router.replace('/')` (passed in as prop from `GameScreen` which uses `useRouter`)

**Copy error info**
Format as plain text:

```
=== ERROR ===
<error.message>

=== STACK TRACE ===
<error.stack>

=== GAME CONTEXT ===
<JSON.stringify(extraContext, null, 2)>
```

Then call `Clipboard.setStringAsync(text)`.

## Files Changed

| File                                                        | Change                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/client/src/components/ui/ErrorBoundaryScreen.tsx`     | New                                                              |
| `apps/client/src/components/ui/AppErrorBoundary.tsx`        | New                                                              |
| `apps/client/src/components/ui/GameScreenErrorBoundary.tsx` | New                                                              |
| `apps/client/src/app/_layout.tsx`                           | Wrap app tree with `AppErrorBoundary`                            |
| `apps/client/src/components/ui/GameScreen.tsx`              | Add `GameScreenErrorBoundary` around return JSX; pass `onReload` |

## Out of Scope

- Non-render (async/promise) errors — these are rare and a separate concern
- i18n of error screen text — hardcoded English is fine for a debug tool
- Collapsible sections — always expanded for simplicity
- Persisting error logs to server or storage
