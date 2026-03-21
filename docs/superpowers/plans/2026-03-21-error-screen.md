# Error Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace white-screen crashes with a debug-friendly error screen showing error details, game context, and Reload/Copy actions.

**Architecture:** A root `AppErrorBoundary` class component wraps the entire app in `_layout.tsx`, catching any render crash. A `GameScreenErrorBoundary` class component wraps the full return of `GameScreen`, capturing game state/events/socket status as a debug snapshot. Both render a shared `ErrorBoundaryScreen` display component.

**Tech Stack:** React class components (error boundaries must be class-based), `expo-clipboard` for copy, imperative `router` singleton from `expo-router` for reload, React Native `ScrollView`/`TouchableOpacity` for UI.

---

## File Map

| File                                                        | Action | Responsibility                                                                             |
| ----------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `apps/client/src/components/ui/ErrorBoundaryScreen.tsx`     | Create | Pure display: title, error message, scrollable stack/context, two buttons                  |
| `apps/client/src/components/ui/AppErrorBoundary.tsx`        | Create | Root class boundary; reload via `router`/`window.location`; copy without context           |
| `apps/client/src/components/ui/GameScreenErrorBoundary.tsx` | Create | Game class boundary; `serializeGameState` helper; copy with full game context              |
| `apps/client/src/app/_layout.tsx`                           | Modify | Rename existing export to `RootLayout`; add `RootLayoutWithBoundary` as new default export |
| `apps/client/src/components/ui/GameScreen.tsx`              | Modify | Remove early loading return; wrap entire return in `GameScreenErrorBoundary`               |
| `apps/client/package.json`                                  | Modify | Add `expo-clipboard`                                                                       |

---

## Task 1: Install expo-clipboard

**Files:**

- Modify: `apps/client/package.json`

- [ ] **Step 1: Install the package**

Run from the repo root (Expo-managed install aligns the native module version with the SDK):

```sh
npx expo install expo-clipboard --filter @dabb/client
```

- [ ] **Step 2: Verify the dependency was added**

```sh
grep expo-clipboard apps/client/package.json
```

Expected: a line like `"expo-clipboard": "~7.x.x"`

- [ ] **Step 3: Commit**

```sh
git add apps/client/package.json
git commit -m "chore(client): add expo-clipboard dependency"
```

---

## Task 2: Create ErrorBoundaryScreen

**Files:**

- Create: `apps/client/src/components/ui/ErrorBoundaryScreen.tsx`

This is a pure display component. It knows nothing about boundaries, clipboard, or navigation — all logic is in the parent boundary.

- [ ] **Step 1: Create the file**

`apps/client/src/components/ui/ErrorBoundaryScreen.tsx`:

```tsx
/**
 * ErrorBoundaryScreen — full-screen error display shown when a React error boundary catches a crash.
 * Pure display component; all logic (reload, copy) is handled by the parent boundary.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../theme.js';

export interface ErrorBoundaryScreenProps {
  error: Error;
  extraContext?: Record<string, unknown>;
  onReload: () => void;
  onCopy: () => void;
}

export default function ErrorBoundaryScreen({
  error,
  extraContext,
  onReload,
  onCopy,
}: ErrorBoundaryScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>

      <ScrollView style={styles.debugBox} contentContainerStyle={styles.debugContent}>
        <Text style={styles.sectionLabel}>Stack Trace</Text>
        <Text style={styles.mono}>{error.stack ?? '(no stack trace)'}</Text>

        {extraContext !== undefined && (
          <>
            <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Game Context</Text>
            <Text style={styles.mono}>{JSON.stringify(extraContext, null, 2)}</Text>
          </>
        )}
      </ScrollView>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.reloadButton} onPress={onReload}>
          <Text style={styles.reloadButtonText}>Reload</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.copyButton} onPress={onCopy}>
          <Text style={styles.copyButtonText}>Copy error info</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.woodDark,
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.paperFace,
    marginBottom: 8,
  },
  errorMessage: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.paperFace,
    marginBottom: 16,
  },
  debugBox: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 6,
    marginBottom: 20,
  },
  debugContent: {
    padding: 12,
  },
  sectionLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 12,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionLabelSpaced: {
    marginTop: 20,
  },
  mono: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.paperAged,
    lineHeight: 16,
  },
  buttons: {
    gap: 10,
  },
  reloadButton: {
    backgroundColor: Colors.amber,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reloadButtonText: {
    fontFamily: Fonts.bodyBold,
    fontSize: 16,
    color: Colors.paperFace,
  },
  copyButton: {
    borderWidth: 1,
    borderColor: Colors.amber,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  copyButtonText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    color: Colors.amber,
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```sh
pnpm --filter @dabb/client run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```sh
git add apps/client/src/components/ui/ErrorBoundaryScreen.tsx
git commit -m "feat(client): add ErrorBoundaryScreen display component"
```

---

## Task 3: Create AppErrorBoundary

**Files:**

- Create: `apps/client/src/components/ui/AppErrorBoundary.tsx`

This boundary sits above `I18nProvider` and `SafeAreaProvider`, so it cannot use hooks. It uses the imperative `router` singleton from `expo-router` (not `useRouter()`).

- [ ] **Step 1: Create the file**

`apps/client/src/components/ui/AppErrorBoundary.tsx`:

```tsx
/**
 * AppErrorBoundary — root-level React error boundary.
 * Wraps the entire app; catches any unhandled render crash.
 * Cannot use hooks (class component) or context providers (placed above them).
 */
import React from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import ErrorBoundaryScreen from './ErrorBoundaryScreen.js';

interface State {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReload = () => {
    if (Platform.OS === 'web') {
      window.location.reload();
    } else {
      router.replace('/');
    }
  };

  handleCopy = () => {
    const { error } = this.state;
    if (!error) return;
    const text = [
      '=== ERROR ===',
      error.message,
      '',
      '=== STACK TRACE ===',
      error.stack ?? '(no stack)',
    ].join('\n');
    void Clipboard.setStringAsync(text);
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorBoundaryScreen
          error={this.state.error}
          onReload={this.handleReload}
          onCopy={this.handleCopy}
        />
      );
    }
    return this.props.children;
  }
}

export default AppErrorBoundary;
```

- [ ] **Step 2: Verify TypeScript compiles**

```sh
pnpm --filter @dabb/client run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```sh
git add apps/client/src/components/ui/AppErrorBoundary.tsx
git commit -m "feat(client): add AppErrorBoundary root error boundary"
```

---

## Task 4: Wire AppErrorBoundary into \_layout.tsx

**Files:**

- Modify: `apps/client/src/app/_layout.tsx`

The current default export is named `RootLayout`. Rename it to a non-exported function and add a new `RootLayoutWithBoundary` as the default export. Expo Router uses the default export, so this is all it takes.

- [ ] **Step 1: Modify \_layout.tsx**

Open `apps/client/src/app/_layout.tsx`. Make these two changes:

1. Change `export default function RootLayout()` → `function RootLayout()`
2. Add at the bottom of the file (before the `const styles` line):

```tsx
import AppErrorBoundary from '../components/ui/AppErrorBoundary.js';

export default function RootLayoutWithBoundary() {
  return (
    <AppErrorBoundary>
      <RootLayout />
    </AppErrorBoundary>
  );
}
```

The import should go at the top of the file with the other imports, not at the bottom. The final default export replaces the old one.

The complete final file should look like this:

```tsx
/**
 * Root layout — loaded once for all routes.
 * Loads fonts, sets up GestureHandlerRootView and SafeAreaProvider.
 */
import './global.css';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useFonts, IMFellEnglishSC_400Regular } from '@expo-google-fonts/im-fell-english-sc';
import { Caveat_400Regular, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import * as SplashScreen from 'expo-splash-screen';
import { I18nProvider } from '@dabb/i18n';
import { useVersionCheck } from '@dabb/ui-shared';
import { APP_VERSION, SERVER_URL } from '../constants.js';
import AppErrorBoundary from '../components/ui/AppErrorBoundary.js';
import UpdateRequiredScreen from '../components/ui/UpdateRequiredScreen.js';
import { loadSoundPreferences } from '../utils/sounds.js';
import { loadHapticsPreferences } from '../utils/haptics.js';

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [fontsLoaded] = useFonts({
    IMFellEnglishSC_400Regular,
    Caveat_400Regular,
    Caveat_700Bold,
    Lato_400Regular,
    Lato_700Bold,
  });

  const { needsUpdate, isLoading: versionLoading } = useVersionCheck({
    currentVersion: APP_VERSION,
    serverBaseUrl: SERVER_URL,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    void loadSoundPreferences();
    void loadHapticsPreferences();
  }, []);

  if (!fontsLoaded || versionLoading) {
    return null;
  }

  if (needsUpdate) {
    return <UpdateRequiredScreen />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <I18nProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

export default function RootLayoutWithBoundary() {
  return (
    <AppErrorBoundary>
      <RootLayout />
    </AppErrorBoundary>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```sh
pnpm --filter @dabb/client run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```sh
git add apps/client/src/app/_layout.tsx
git commit -m "feat(client): wrap app root with AppErrorBoundary"
```

---

## Task 5: Create GameScreenErrorBoundary

**Files:**

- Create: `apps/client/src/components/ui/GameScreenErrorBoundary.tsx`

This boundary stores a snapshot of `state`, `events`, and `connected` from when the crash occurred. `getDerivedStateFromError` fires during the render phase (sets `hasError`/`error`); `componentDidCatch` fires after (sets `contextSnapshot`). This causes two renders of the error screen — first without context, then with — which is fine.

- [ ] **Step 1: Create the file**

`apps/client/src/components/ui/GameScreenErrorBoundary.tsx`:

```tsx
/**
 * GameScreenErrorBoundary — error boundary for the game screen.
 * Captures game state, events, and socket status as a debug snapshot on crash.
 */
import React from 'react';
import * as Clipboard from 'expo-clipboard';
import type { GameState, GameEvent } from '@dabb/shared-types';
import ErrorBoundaryScreen from './ErrorBoundaryScreen.js';

export function serializeGameState(state: GameState): Record<string, unknown> {
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
    passedPlayers: Array.from(state.passedPlayers),
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

interface Props {
  state: GameState;
  events: GameEvent[];
  connected: boolean;
  onReload: () => void;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  contextSnapshot: Record<string, unknown> | null;
}

class GameScreenErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, contextSnapshot: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) {
    const { state, events, connected } = this.props;
    this.setState({
      contextSnapshot: {
        connected,
        eventCount: events.length,
        recentEvents: events.slice(-10).map((e) => e.type),
        state: serializeGameState(state),
      },
    });
  }

  handleCopy = () => {
    const { error, contextSnapshot } = this.state;
    if (!error) return;
    const text = [
      '=== ERROR ===',
      error.message,
      '',
      '=== STACK TRACE ===',
      error.stack ?? '(no stack)',
      ...(contextSnapshot
        ? ['', '=== GAME CONTEXT ===', JSON.stringify(contextSnapshot, null, 2)]
        : []),
    ].join('\n');
    void Clipboard.setStringAsync(text);
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <ErrorBoundaryScreen
          error={this.state.error}
          extraContext={this.state.contextSnapshot ?? undefined}
          onReload={this.props.onReload}
          onCopy={this.handleCopy}
        />
      );
    }
    return this.props.children;
  }
}

export default GameScreenErrorBoundary;
```

- [ ] **Step 2: Verify TypeScript compiles**

```sh
pnpm --filter @dabb/client run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```sh
git add apps/client/src/components/ui/GameScreenErrorBoundary.tsx
git commit -m "feat(client): add GameScreenErrorBoundary with game state capture"
```

---

## Task 6: Wire GameScreenErrorBoundary into GameScreen

**Files:**

- Modify: `apps/client/src/components/ui/GameScreen.tsx`

Two changes:

1. Remove the early return for the loading phase (lines ~318-327) — instead include this JSX as a conditional inside the boundary.
2. Wrap the entire return in `<GameScreenErrorBoundary>`.

`router` is already in scope from `const router = useRouter()` (line 141). Add a `handleReload` callback after the existing hooks.

- [ ] **Step 1: Add the import and handleReload**

At the top of `GameScreen.tsx`, add to the import list:

```tsx
import GameScreenErrorBoundary from './GameScreenErrorBoundary.js'; // add to existing imports block
```

After the line `const handleDone = useCallback(() => { router.replace('/'); }, [router]);` (around line 315), add:

```tsx
const handleReload = useCallback(() => {
  router.replace('/');
}, [router]);
```

- [ ] **Step 2: Remove the early loading return and replace the component return**

Delete the early-return block (approximately lines 318-327):

```tsx
// DELETE this entire block:
if (state.phase === 'waiting') {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#c97f00" />
      <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
        <OptionsButton />
      </View>
    </View>
  );
}
```

Then replace the entire `return (...)` block (from `return (` to the final `);`) with the following. The content inside `<View style={styles.outerContainer}>` is **identical to what was already there** — do not change any of it, only add the boundary wrapper and the loading conditional:

```tsx
return (
  <GameScreenErrorBoundary
    state={state}
    events={events}
    connected={connected}
    onReload={handleReload}
  >
    {state.phase === 'waiting' ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#c97f00" />
        <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
          <OptionsButton />
        </View>
      </View>
    ) : (
      <View style={styles.outerContainer}>
        <View style={styles.gameWrapper}>
          {/* Skia game table background */}
          <GameTable width={width} height={height} effects={effects} />

          {/* Reconnecting banner */}
          <ReconnectingBanner visible={!connected} />

          {/* Scoreboard strip at top */}
          <ScoreboardStrip
            roundScores={roundScores}
            totalScores={totalScores}
            myPlayerIndex={playerIndex}
            targetScore={state.targetScore}
            onPress={() => setScoreboardOpen(true)}
          />

          {/* Opponents */}
          {Array.from(opponentPositions.entries()).map(([opIdx, pos]) => {
            const player = state.players[opIdx];
            const opCards = state.hands.get(opIdx);
            return (
              <OpponentZone
                key={opIdx}
                playerIndex={opIdx}
                nickname={nicknames.get(opIdx) ?? player?.nickname ?? `P${opIdx}`}
                cardCount={opCards?.length ?? 0}
                isConnected={player?.connected ?? false}
                position={pos}
              />
            );
          })}

          {/* Trick animation layer */}
          <TrickAnimationLayer
            animState={trickAnimState}
            myPlayerIndex={playerIndex}
            players={state.players}
            playerCount={state.playerCount as 3 | 4}
            effects={effects}
            localPlayerDropOrigin={lastDropPos}
          />

          {/* Player hand */}
          <PlayerHand
            gameState={state}
            playerIndex={playerIndex}
            cards={myCards}
            onPlayCard={(cardId, dropPos) => {
              if (dropPos) {
                setLastDropPos(dropPos);
              }
              onPlayCard(cardId);
            }}
            effects={effects}
            discardSelectedIds={showDabb && dabbStep === 'discard' ? dabbSelectedCards : undefined}
            onToggleDiscard={showDabb && dabbStep === 'discard' ? handleToggleDabbCard : undefined}
          />

          {/* Phase overlays */}
          <PhaseOverlay visible={showBidding}>
            <BiddingOverlay
              currentBid={state.currentBid}
              isMyTurn={isMyBiddingTurn}
              onBid={onBid}
              onPass={onPass}
            />
          </PhaseOverlay>

          <PhaseOverlay visible={showDabb}>
            <DabbOverlay
              step={dabbStep}
              dabbCards={dabbCards}
              discardCount={DABB_SIZE[state.playerCount]}
              selectedCardIds={dabbSelectedCards}
              onTake={onTakeDabb}
              onDiscard={handleDiscard}
              onGoOut={onGoOut}
            />
          </PhaseOverlay>

          <PhaseOverlay visible={showTrump}>
            <TrumpOverlay onSelectTrump={onDeclareTrump} />
          </PhaseOverlay>

          <PhaseOverlay visible={showMelding}>
            <MeldingOverlay
              melds={detectedMelds}
              totalPoints={meldTotalPoints}
              canConfirm={true}
              onConfirm={handleConfirmMelds}
            />
          </PhaseOverlay>

          {/* Game log */}
          <View style={styles.logContainer}>
            <GameLogTab
              entries={logStrings}
              isExpanded={logExpanded}
              onToggle={() => setLogExpanded((v) => !v)}
            />
          </View>

          {/* Celebration layer */}
          <CelebrationLayer showConfetti={showConfetti} showFireworks={showFireworks} />

          {/* Scoreboard history modal */}
          <ScoreboardModal
            visible={scoreboardOpen}
            onClose={() => setScoreboardOpen(false)}
            rounds={rounds}
            currentRound={currentRound}
            nicknames={nicknames}
            playerCount={state.playerCount}
            totalScores={totalScores}
          />

          {/* Game terminated modal */}
          <GameTerminatedModal
            visible={isTerminated}
            winnerId={winnerPlayer?.id ?? null}
            winnerNickname={winnerPlayer?.nickname ?? null}
            isLocalWinner={winnerPlayer?.playerIndex === playerIndex}
            onDone={handleDone}
          />
          <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
            <OptionsButton />
          </View>
        </View>
      </View>
    )}
  </GameScreenErrorBoundary>
);
```

- [ ] **Step 3: Verify TypeScript compiles**

```sh
pnpm --filter @dabb/client run typecheck
```

Expected: no errors

- [ ] **Step 4: Run the full test suite**

```sh
pnpm test
```

Expected: all tests pass (no game-logic tests are affected by this UI change)

- [ ] **Step 5: Commit**

```sh
git add apps/client/src/components/ui/GameScreen.tsx
git commit -m "feat(client): wrap GameScreen return in GameScreenErrorBoundary"
```

---

## Task 7: CI verification

- [ ] **Step 1: Run full CI check**

```sh
pnpm run build && pnpm lint && pnpm test
```

Expected: all pass with no errors

If there are lint errors, fix them before proceeding. Common issues: unused imports, missing `.js` extensions on relative imports.

- [ ] **Step 2: Commit any lint fixes**

If lint auto-fixed anything:

```sh
git add -p
git commit -m "chore(client): fix lint issues in error boundary files"
```
