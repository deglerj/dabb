# Client App Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/client` — the unified Expo app (web + iOS + Android) replacing `apps/web` and `apps/mobile`, consuming `@dabb/game-canvas` for game rendering.

**Architecture:** Single Expo SDK 55 app with expo-router for file-based routing. Game screen uses `GameTable` (Skia) as background canvas with `CardView` components layered above it. Phase actions flow through `PhaseOverlay` + overlay components from `@dabb/game-canvas`. All game state comes from `useSocket`/`useGameState` in `@dabb/ui-shared` — unchanged.

**Tech Stack:** Expo SDK 55, expo-router, react-native-web, @dabb/game-canvas, @dabb/ui-shared, expo-secure-store, expo-audio, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-03-12-game-ui-rewrite-design.md`
**Depends on:** Plan 1 (`packages/game-canvas`) — complete that first.

**Note:** `apps/web` and `apps/mobile` are deleted at the end of this plan. Their CI pipeline references and pnpm workspace entries are removed at that point.

---

## File Map

```
apps/client/
  app.json                          ← Expo app config (name, version, icons)
  package.json                      ← @dabb/client dependencies
  tsconfig.json                     ← extends ../../tsconfig.base.json
  babel.config.js                   ← Expo + Reanimated babel preset
  metro.config.js                   ← Expo Metro config
  index.ts                          ← Expo entry point (registerRootComponent)
  src/
    app/                            ← expo-router file-based routes
      _layout.tsx                   ← Root layout: font loading, GestureHandlerRoot, SafeArea
      index.tsx                     ← Home screen route
      waiting-room/
        [id].tsx                    ← Waiting room screen route
      game/
        [id].tsx                    ← Game screen route
    components/
      game/
        GameScreen.tsx              ← Full game screen: assembles table + cards + overlays + UI
        PlayerHand.tsx              ← Player's fanned card hand (tap + drag)
        OpponentZone.tsx            ← Single opponent: nameplate + card backs + won pile
        TrickArea.tsx               ← Center trick area (shows played cards)
        ScoreboardStrip.tsx         ← Top wooden-strip score display + expandable table
        GameLogTab.tsx              ← Bottom-right folded tab + scrolling log
        CelebrationLayer.tsx        ← Confetti + fireworks overlay
        GameTerminatedModal.tsx     ← Game-over / terminated modal
        ReconnectingBanner.tsx      ← Socket reconnect banner in wood surround
      ui/
        HomeScreen.tsx              ← Home / lobby: create + join game
        WaitingRoomScreen.tsx       ← Pre-game: player list + start button
        UpdateRequiredScreen.tsx    ← Version mismatch full-screen
    hooks/
      useGame.ts                    ← Combines useSocket + useGameState + action dispatchers
      useStorage.ts                 ← Platform-aware storage (SecureStore native / localStorage web)
      useTurnNotification.ts        ← System notification on your-turn
    utils/
      sounds.ts                     ← Merged sound implementation (expo-audio base)
      api.ts                        ← Fetch helpers for REST API (create/join session)
    theme.ts                        ← Colors, fonts, spacing (migrated from mobile theme.ts)
    constants.ts                    ← SERVER_URL, APP_VERSION from Expo Constants
```

---

## Chunk 1: App Foundation

### Task 1: Bootstrap Expo app

**Files:**

- Create: `apps/client/package.json`
- Create: `apps/client/app.json`
- Create: `apps/client/tsconfig.json`
- Create: `apps/client/babel.config.js`
- Create: `apps/client/metro.config.js`
- Create: `apps/client/index.ts`

- [ ] **Step 1: Create `apps/client/package.json`**

Copy `apps/mobile/package.json` as a base and make these changes:

- Set `"name": "@dabb/client"`
- Add `"@dabb/game-canvas": "workspace:*"` to dependencies
- Add `"@shopify/react-native-skia": "^1.0.0"` (check latest compatible with Expo 55)
- Add `"expo-router": "~4.0.0"` (check latest for Expo 55)
- Add `"expo-secure-store": "~14.0.0"` (check latest for Expo 55)
- Keep all existing mobile deps unchanged
- Remove `"react-native-markdown-display"` (not used in new UI)

Run `pnpm install` after creating to resolve versions.

- [ ] **Step 2: Create `apps/client/app.json`**

Copy `apps/mobile/app.json` and update:

- `"name"`: `"Dabb"` (unchanged)
- `"slug"`: `"dabb-client"`
- Add `"scheme": "dabb"` (required for expo-router deep linking)
- Add `"web": { "bundler": "metro" }` (Metro bundler for web with expo-router)
- Keep version in sync with root `package.json`

- [ ] **Step 3: Create `apps/client/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "jsx": "react-native",
    "lib": ["ES2022", "DOM"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "index.ts", "babel.config.js", "metro.config.js"]
}
```

- [ ] **Step 4: Create `apps/client/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

Note: `react-native-reanimated/plugin` must be last in plugins list.

- [ ] **Step 5: Create `apps/client/metro.config.js`**

```js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow importing .ts source from workspace packages (game-canvas et al.)
config.resolver.sourceExts = [...config.resolver.sourceExts, 'ts', 'tsx'];

module.exports = config;
```

- [ ] **Step 6: Create `apps/client/index.ts`**

```ts
import 'expo-router/entry';
```

- [ ] **Step 7: Install and verify**

```bash
pnpm install
pnpm --filter @dabb/client typecheck
```

Expected: typecheck passes (no source files yet).

- [ ] **Step 8: Verify Expo can start**

```bash
pnpm --filter @dabb/client start
```

Expected: Expo dev server starts, QR code shown. Press `w` to open web — blank page is fine at this stage.

- [ ] **Step 9: Commit**

```bash
git add apps/client/
git commit -m "feat(client): bootstrap unified Expo app"
```

---

### Task 2: Theme, constants, storage, and sounds

**Files:**

- Create: `apps/client/src/theme.ts`
- Create: `apps/client/src/constants.ts`
- Create: `apps/client/src/hooks/useStorage.ts`
- Create: `apps/client/src/utils/sounds.ts`
- Create: `apps/client/src/utils/api.ts`

- [ ] **Step 1: Create `src/theme.ts`**

Copy `apps/mobile/src/theme.ts` verbatim. It already defines all needed colors, fonts, and shadows for the Gasthof aesthetic.

- [ ] **Step 2: Create `src/constants.ts`**

```ts
import Constants from 'expo-constants';

/**
 * Runtime constants sourced from app.json extra / EAS environment.
 * Falls back to localhost for local development.
 */
export const SERVER_URL: string =
  (Constants.expoConfig?.extra?.serverUrl as string | undefined) ?? 'http://localhost:3000';

export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';
```

Add to `app.json`:

```json
"extra": {
  "serverUrl": "https://your-server.example.com"
}
```

(Leave as empty string for now; filled by EAS secrets in CI.)

- [ ] **Step 3: Create `src/hooks/useStorage.ts`**

```ts
/**
 * Platform-aware key-value storage.
 * Native: expo-secure-store (encrypted).
 * Web: localStorage.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function storageDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
```

- [ ] **Step 4: Create `src/utils/sounds.ts`**

Copy `apps/mobile/src/utils/sounds.ts` verbatim as the base (it uses `expo-audio`). Then port any web-specific sound fallbacks from `apps/web/src/utils/sounds.ts` that are not already handled by `expo-audio` on web. If `expo-audio` handles web playback correctly (it should in Expo 55), no changes are needed beyond the copy.

Verify correctness by running the typecheck after this file is created (see Step 6 below).

- [ ] **Step 5: Create `src/utils/api.ts`**

```ts
/**
 * REST API helpers for session management.
 * Uses types from @dabb/shared-types (verified against server routes).
 *
 * Server routes (apps/server/src/routes/sessions.ts):
 *   POST /api/sessions            → create  (body: CreateSessionRequest)
 *   POST /api/sessions/:code/join → join    (body: JoinSessionRequest)
 */
import { SERVER_URL } from '../constants.js';
import type { PlayerCount, CreateSessionResponse, JoinSessionResponse } from '@dabb/shared-types';

export type { CreateSessionResponse, JoinSessionResponse };

export async function createSession(
  nickname: string,
  playerCount: PlayerCount
): Promise<CreateSessionResponse> {
  const res = await fetch(`${SERVER_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: nickname.trim(), playerCount }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Failed to create session');
  }
  return res.json() as Promise<CreateSessionResponse>;
}

export async function joinSession(
  joinCode: string,
  nickname: string
): Promise<JoinSessionResponse> {
  const res = await fetch(`${SERVER_URL}/api/sessions/${joinCode.trim().toUpperCase()}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: nickname.trim() }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Failed to join session');
  }
  return res.json() as Promise<JoinSessionResponse>;
}
```

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @dabb/client typecheck
```

Expected: passes.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/theme.ts apps/client/src/constants.ts apps/client/src/hooks/useStorage.ts apps/client/src/utils/sounds.ts apps/client/src/utils/api.ts
git commit -m "feat(client): add theme, constants, storage adapter, sounds, and API helpers"
```

---

### Task 3: Root layout + useGame hook

**Files:**

- Create: `apps/client/src/app/_layout.tsx`
- Create: `apps/client/src/hooks/useGame.ts`
- Create: `apps/client/src/hooks/useTurnNotification.ts`

- [ ] **Step 1: Create `src/app/_layout.tsx`**

```tsx
/**
 * Root layout — loaded once for all routes.
 * Loads fonts, sets up GestureHandlerRootView and SafeAreaProvider.
 */
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useFonts, IMFellEnglishSC_400Regular } from '@expo-google-fonts/im-fell-english-sc';
import { Caveat_400Regular, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IMFellEnglishSC_400Regular,
    Caveat_400Regular,
    Caveat_700Bold,
    Lato_400Regular,
    Lato_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
```

- [ ] **Step 2: Create `src/hooks/useGame.ts`**

This hook wires `useSocket` and `useGameState` from `ui-shared` together with typed action dispatchers. The two hooks are decoupled: `useSocket`'s `onEvents` callback feeds into `processEvents` from `useGameState`. Nicknames are tracked locally via `onPlayerJoined`. Mirrors the pattern from `apps/mobile/App.tsx`.

Real API (verified against `packages/ui-shared/src/`):

- `useSocket({ serverUrl, sessionId, secretId, onEvents?, onPlayerJoined?, ... })` → `{ socket, connected, connecting, error, emit }`
- `useGameState({ playerIndex, initialPlayerCount? })` → `{ state, events, processEvents, reset }`

```ts
/**
 * useGame
 *
 * Connects to the game server via Socket.IO and manages game state.
 * Returns game state, player info, and typed action callbacks.
 *
 * Usage:
 *   const game = useGame({ sessionId, secretId, playerIndex });
 *   game.onBid(150);
 */
import { useCallback, useState } from 'react';
import { useSocket, useGameState } from '@dabb/ui-shared';
import { SERVER_URL } from '../constants.js';
import type { CardId, Suit, PlayerIndex } from '@dabb/shared-types';

export interface UseGameOptions {
  sessionId: string;
  secretId: string;
  playerIndex: number;
}

export function useGame({ sessionId, secretId, playerIndex }: UseGameOptions) {
  const [nicknames, setNicknames] = useState<Map<PlayerIndex, string>>(new Map());

  const { state, events, processEvents, reset } = useGameState({
    playerIndex: playerIndex as PlayerIndex,
  });

  const handlePlayerJoined = useCallback((idx: number, nickname: string) => {
    setNicknames((prev) => {
      const next = new Map(prev);
      next.set(idx as PlayerIndex, nickname);
      return next;
    });
  }, []);

  const { socket, connected, connecting, error } = useSocket({
    serverUrl: SERVER_URL,
    sessionId,
    secretId,
    onEvents: processEvents,
    onPlayerJoined: handlePlayerJoined,
  });

  const onBid = useCallback((amount: number) => socket?.emit('game:bid', { amount }), [socket]);
  const onPass = useCallback(() => socket?.emit('game:pass'), [socket]);
  const onTakeDabb = useCallback(() => socket?.emit('game:takeDabb'), [socket]);
  const onDiscard = useCallback(
    (cardIds: CardId[]) => socket?.emit('game:discard', { cardIds }),
    [socket]
  );
  const onGoOut = useCallback((suit: Suit) => socket?.emit('game:goOut', { suit }), [socket]);
  const onDeclareTrump = useCallback(
    (suit: Suit) => socket?.emit('game:declareTrump', { suit }),
    [socket]
  );
  const onDeclareMelds = useCallback(() => socket?.emit('game:declareMelds'), [socket]);
  const onPlayCard = useCallback(
    (cardId: CardId) => socket?.emit('game:playCard', { cardId }),
    [socket]
  );

  return {
    state,
    events,
    nicknames,
    connected,
    connecting,
    error,
    onBid,
    onPass,
    onTakeDabb,
    onDiscard,
    onGoOut,
    onDeclareTrump,
    onDeclareMelds,
    onPlayCard,
  };
}
```

- [ ] **Step 3: Create `src/hooks/useTurnNotification.ts`**

Copy `apps/mobile/src/hooks/useTurnNotification.ts` verbatim. It handles local notifications for "your turn" events.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @dabb/client typecheck
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/app/_layout.tsx apps/client/src/hooks/
git commit -m "feat(client): add root layout, useGame hook, and turn notifications"
```

---

## Chunk 2: Non-Game Screens

### Task 4: Home screen

**Files:**

- Create: `apps/client/src/components/ui/HomeScreen.tsx`
- Create: `apps/client/src/app/index.tsx`

- [ ] **Step 1: Create `src/components/ui/HomeScreen.tsx`**

Port `apps/web/src/pages/HomePage.tsx` to React Native, replacing:

- `<input>` → `<TextInput>`
- `<button>` → `<TouchableOpacity>`
- `useNavigate` → `useRouter` from `expo-router`
- `localStorage` → `storageGet`/`storageSet` from `useStorage`
- `import.meta.env.VITE_SERVER_URL` → `SERVER_URL` from `constants.ts`
- `import.meta.env.VITE_APP_VERSION` → `APP_VERSION` from `constants.ts`

Preserve all logic: create session, join session, join-code-from-URL (deep link via expo-router params), nickname persistence, version check, language switcher.

Style using RN StyleSheet with the Gasthof color palette from `theme.ts`. The home screen does not need to be a felt table — it's a lobby screen, simpler styling is fine.

- [ ] **Step 2: Create `src/app/index.tsx`**

```tsx
import HomeScreen from '../components/ui/HomeScreen.js';
export default HomeScreen;
```

- [ ] **Step 3: Verify home screen loads on web**

```bash
pnpm --filter @dabb/client start
```

Open browser at the dev server URL. Home screen should render with create/join options.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/ui/HomeScreen.tsx apps/client/src/app/index.tsx
git commit -m "feat(client): add home screen"
```

---

### Task 5: Waiting room + update required screens

**Files:**

- Create: `apps/client/src/components/ui/WaitingRoomScreen.tsx`
- Create: `apps/client/src/components/ui/UpdateRequiredScreen.tsx`
- Create: `apps/client/src/app/waiting-room/[id].tsx`

Note: `WaitingRoomScreen` is a **presentational component** — it takes all state as props. The socket connection and player-list state live in the route file (`waiting-room/[id].tsx`), mirroring the pattern used in `apps/mobile/App.tsx`.

- [ ] **Step 1: Create `src/components/ui/WaitingRoomScreen.tsx`**

Copy `apps/mobile/src/screens/WaitingRoomScreen.tsx` verbatim. It is already pure React Native and receives all state as props (`sessionCode`, `players`, `playerCount`, `isHost`, callbacks). No navigation APIs to replace — navigation is handled in the parent route file.

Replace only: `WoodBackground` and `PaperPanel` imports (if they live in `apps/mobile/src/components/`) with plain `View` stubs for now — these can be refined later.

- [ ] **Step 2: Create `src/components/ui/UpdateRequiredScreen.tsx`**

Copy `apps/mobile/src/screens/UpdateRequiredScreen.tsx` verbatim and adapt styling to use `theme.ts`.

Expected output: full-screen message "Update required" with a brief instruction and an app store / reload link.

- [ ] **Step 3: Create `src/app/waiting-room/[id].tsx`**

The route file manages socket connection and player-list state for the waiting phase, then passes all state as props to `WaitingRoomScreen`.

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { useSocket } from '@dabb/ui-shared';
import WaitingRoomScreen from '../../components/ui/WaitingRoomScreen.js';
import { storageGet, storageDelete } from '../../hooks/useStorage.js';
import { SERVER_URL } from '../../constants.js';
import type { PlayerIndex, AIDifficulty } from '@dabb/shared-types';

interface SessionParams {
  id: string; // sessionId
  code: string; // sessionCode (display to users)
  secretId: string;
  playerIndex: string;
  playerCount: string;
}

type PlayerEntry = {
  nickname: string;
  connected: boolean;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
};

export default function WaitingRoomRoute() {
  const {
    id: sessionId,
    code: sessionCode,
    secretId,
    playerIndex: piStr,
    playerCount: pcStr,
  } = useLocalSearchParams<SessionParams>();
  const router = useRouter();
  const playerIndex = parseInt(piStr ?? '0', 10) as PlayerIndex;
  const playerCount = parseInt(pcStr ?? '4', 10);

  const [players, setPlayers] = useState<Map<PlayerIndex, PlayerEntry>>(new Map());

  const handlePlayerJoined = useCallback(
    (idx: number, nickname: string, isAI = false, diff?: AIDifficulty) => {
      setPlayers((prev) => {
        const next = new Map(prev);
        next.set(idx as PlayerIndex, { nickname, connected: true, isAI, aiDifficulty: diff });
        return next;
      });
    },
    []
  );

  const handlePlayerLeft = useCallback((idx: number) => {
    setPlayers((prev) => {
      const next = new Map(prev);
      const p = next.get(idx as PlayerIndex);
      if (p) next.set(idx as PlayerIndex, { ...p, connected: false });
      return next;
    });
  }, []);

  // Navigate to game screen when game starts
  const handleEvents = useCallback(
    (events: import('@dabb/shared-types').GameEvent[]) => {
      const started = events.some((e) => e.type === 'GAME_STARTED');
      if (started) {
        router.replace({
          pathname: '/game/[id]',
          params: { id: sessionId, secretId, playerIndex: piStr },
        });
      }
    },
    [router, sessionId, secretId, piStr]
  );

  const { socket, emit } = useSocket({
    serverUrl: SERVER_URL,
    sessionId,
    secretId,
    onEvents: handleEvents,
    onPlayerJoined: handlePlayerJoined,
    onPlayerLeft: handlePlayerLeft,
  });

  const isHost = playerIndex === 0;

  const handleStartGame = useCallback(() => {
    emit?.('game:start');
  }, [emit]);

  const handleLeave = useCallback(async () => {
    emit?.('game:exit');
    await storageDelete(`session-${sessionCode}`);
    router.replace('/');
  }, [emit, sessionCode, router]);

  return (
    <WaitingRoomScreen
      sessionCode={sessionCode ?? ''}
      players={players}
      playerCount={playerCount}
      isHost={isHost}
      onStartGame={handleStartGame}
      onLeave={handleLeave}
    />
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @dabb/client typecheck
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/ui/ apps/client/src/app/waiting-room/
git commit -m "feat(client): add waiting room and update-required screens"
```

---

## Chunk 3: Game Screen

### Task 6: Opponent zone + player hand components

**Files:**

- Create: `apps/client/src/components/game/OpponentZone.tsx`
- Create: `apps/client/src/components/game/PlayerHand.tsx`

- [ ] **Step 1: Create `src/components/game/OpponentZone.tsx`**

```tsx
/**
 * OpponentZone
 *
 * Renders a single opponent's area on the table:
 * - Landscape / tablet: nameplate + fanned card backs + won-pile count
 * - Portrait phone: nameplate badge + card count number only
 *
 * Positioned absolutely within the game screen at the coordinates
 * provided by deriveCardPositions().opponentHands[playerId].
 */
import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
// CardBack is not in game-canvas public API; opponent card backs are static styled Views

export interface OpponentZoneProps {
  playerId: string;
  nickname: string;
  cardCount: number;
  wonTrickCount: number;
  isTheirTurn: boolean;
  x: number;
  y: number;
  isPartner?: boolean; // 4-player team mode
}

const CARD_W = 40;
const CARD_H = 60;

export function OpponentZone({
  nickname,
  cardCount,
  wonTrickCount,
  isTheirTurn,
  x,
  y,
  isPartner,
}: OpponentZoneProps) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isTablet = Math.min(width, height) > 600;
  const showCards = isLandscape || isTablet;

  return (
    <View style={[styles.container, { left: x - 40, top: y - 20 }]}>
      {/* Nameplate */}
      <View
        style={[
          styles.nameplate,
          isTheirTurn && styles.nameplateActive,
          isPartner && styles.nameplatePartner,
        ]}
      >
        <Text style={styles.name} numberOfLines={1}>
          {nickname}
        </Text>
        {!showCards && <Text style={styles.cardCountBadge}>{cardCount}</Text>}
      </View>

      {/* Card backs — landscape/tablet only — static styled Views (not CardView) */}
      {showCards && cardCount > 0 && (
        <View style={styles.cardFan}>
          {Array.from({ length: Math.min(cardCount, 6) }).map((_, i) => (
            <View key={i} style={[styles.cardBack, { marginLeft: i === 0 ? 0 : -28 }]} />
          ))}
        </View>
      )}

      {/* Won pile count */}
      {wonTrickCount > 0 && (
        <View style={styles.wonBadge}>
          <Text style={styles.wonText}>{wonTrickCount}×</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', alignItems: 'center', gap: 4 },
  nameplate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f2e8d0',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#c8b090',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  nameplateActive: { borderColor: '#d4890a', shadowColor: '#d4890a', shadowOpacity: 0.5 },
  nameplatePartner: { borderColor: '#3a7d44' },
  name: { fontFamily: 'Caveat_400Regular', fontSize: 14, color: '#3d2e18', maxWidth: 80 },
  cardCountBadge: { fontFamily: 'Caveat_700Bold', fontSize: 13, color: '#8a5e2e' },
  cardFan: { flexDirection: 'row' },
  cardBack: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#2a6e3c',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#1a4a28',
  },
  wonBadge: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  wonText: { fontFamily: 'Caveat_400Regular', fontSize: 11, color: '#f2e8d0' },
});
```

- [ ] **Step 2: Create `src/components/game/PlayerHand.tsx`**

```tsx
/**
 * PlayerHand
 *
 * Renders the local player's hand as a horizontal fan of CardView components.
 * Cards are positioned using deriveCardPositions().playerHand.
 * Tap: calls onPlayCard(cardId) directly (single play mode).
 * Drag: calls onPlayCard(cardId) when dropped over the felt.
 *
 * Phase-dependent behavior:
 * - tricks: draggable=true, tap plays card immediately
 * - dabb discard: multiple selection via tap (handled by DabbOverlay, not this component)
 * - other phases: cards shown but not interactive
 */
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { CardView, deriveCardPositions, type LayoutDimensions } from '@dabb/game-canvas';
import { getValidPlays } from '@dabb/game-logic';
import type { GameState, PlayerIndex, Card } from '@dabb/shared-types';

export interface PlayerHandProps {
  state: GameState;
  playerIndex: PlayerIndex;
  playerCards: Card[]; // face-up cards in hand
  onPlayCard: (cardId: string) => void;
}

export function PlayerHand({ state, playerIndex, playerCards, onPlayCard }: PlayerHandProps) {
  const { width, height } = useWindowDimensions();
  const layout: LayoutDimensions = { width, height, playerCount: state.players.length as 3 | 4 };

  const positions = deriveCardPositions(
    {
      handCardIds: playerCards.map((c) => c.id),
      trickCardIds: [],
      wonPilePlayerIds: [],
      opponentCardCounts: {},
    },
    layout
  );

  const isTricksPhase = state.phase === 'tricks';
  // getValidPlays(hand: Card[], trick: Trick, trump: Suit) — real signature from game-logic
  // state.currentTrick is always a Trick (never null); state.trump is Suit|null (only set post-trump phase)
  const validPlays =
    isTricksPhase && state.trump ? getValidPlays(playerCards, state.currentTrick, state.trump) : [];
  const validIds = new Set(validPlays.map((c) => c.id));

  const handleDrop = (cardId: string) => (_x: number, _y: number) => {
    // Entire felt surface is a valid drop — if card is playable, play it
    if (validIds.has(cardId)) onPlayCard(cardId);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {playerCards.map((card) => {
        const pos = positions.playerHand[card.id];
        if (!pos) return null;
        const isValid = !isTricksPhase || validIds.has(card.id);
        // CardView uses absolute positioning internally (position: 'absolute' set by Reanimated).
        // Do NOT wrap in a View — extra wrapper breaks absolute coordinate space.
        // Invalid cards are non-interactive (no draggable/onTap) and shown at reduced opacity.
        // Pass opacity directly to CardView; if CardView does not yet accept an opacity prop,
        // add one: it should forward it to its animated style.
        return (
          <CardView
            key={card.id}
            card={card}
            targetX={pos.x}
            targetY={pos.y}
            targetRotation={pos.rotation}
            zIndex={pos.zIndex}
            opacity={isValid ? 1 : 0.5}
            draggable={isTricksPhase && isValid}
            onTap={isTricksPhase && isValid ? () => onPlayCard(card.id) : undefined}
            onDrop={isTricksPhase && isValid ? handleDrop(card.id) : undefined}
          />
        );
      })}
    </View>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @dabb/client typecheck
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/game/OpponentZone.tsx apps/client/src/components/game/PlayerHand.tsx
git commit -m "feat(client): add OpponentZone and PlayerHand components"
```

---

### Task 7: Trick area + scoreboard strip + game log tab

**Files:**

- Create: `apps/client/src/components/game/TrickArea.tsx`
- Create: `apps/client/src/components/game/ScoreboardStrip.tsx`
- Create: `apps/client/src/components/game/GameLogTab.tsx`

- [ ] **Step 1: Create `src/components/game/TrickArea.tsx`**

```tsx
/**
 * TrickArea
 *
 * Renders cards currently on the table during a trick.
 * Cards are positioned using deriveCardPositions().trickCards.
 * Cards animate in (arc from player position) via CardView's Reanimated animation.
 * When a trick completes, computeSweepSchedule drives cards to the winner's corner.
 */
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { CardView, deriveCardPositions, type LayoutDimensions } from '@dabb/game-canvas';
import type { GameState, Card, PlayerIndex } from '@dabb/shared-types';

export interface TrickCardEntry {
  card: Card;
  seatIndex: number;
}

export interface TrickAreaProps {
  state: GameState;
  trickCards: TrickCardEntry[];
  wonPilePlayerIds: string[];
}

export function TrickArea({ state, trickCards, wonPilePlayerIds }: TrickAreaProps) {
  const { width, height } = useWindowDimensions();
  const layout: LayoutDimensions = { width, height, playerCount: state.players.length as 3 | 4 };

  const positions = deriveCardPositions(
    {
      handCardIds: [],
      trickCardIds: trickCards.map((tc) => ({ cardId: tc.card.id, seatIndex: tc.seatIndex })),
      wonPilePlayerIds,
      opponentCardCounts: {},
    },
    layout
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {trickCards.map((tc) => {
        const pos = positions.trickCards[tc.card.id];
        if (!pos) return null;
        return (
          <CardView
            key={tc.card.id}
            card={tc.card}
            targetX={pos.x}
            targetY={pos.y}
            targetRotation={pos.rotation}
            zIndex={pos.zIndex}
          />
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Create `src/components/game/ScoreboardStrip.tsx`**

```tsx
/**
 * ScoreboardStrip
 *
 * Slim wooden strip at the top of the screen showing each player's current score.
 * Tapping expands a full round-history table as a bottom sheet modal.
 *
 * Uses useRoundHistory from @dabb/ui-shared.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { useRoundHistory } from '@dabb/ui-shared';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';

export interface ScoreboardStripProps {
  state: GameState;
  events: import('@dabb/shared-types').GameEvent[];
  playerIndex: PlayerIndex;
  nicknames: Map<PlayerIndex, string>;
}

export function ScoreboardStrip({ state, events, playerIndex, nicknames }: ScoreboardStripProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  // useRoundHistory takes only events — no playerCount arg
  const { rounds } = useRoundHistory(events);
  // Totals come from GameState.totalScores (Map<PlayerIndex|Team, number>)
  const totals = state.totalScores;

  return (
    <>
      {/* Slim strip */}
      <TouchableOpacity style={styles.strip} onPress={() => setExpanded(true)}>
        {state.players.map((_, i) => (
          <View key={i} style={styles.playerScore}>
            <Text style={styles.playerName} numberOfLines={1}>
              {nicknames.get(i as PlayerIndex) ?? `P${i + 1}`}
            </Text>
            <Text style={styles.score}>{totals.get(i as PlayerIndex) ?? 0}</Text>
          </View>
        ))}
        <Text style={styles.expandHint}>▼</Text>
      </TouchableOpacity>

      {/* Expanded history modal */}
      <Modal
        visible={expanded}
        transparent
        animationType="slide"
        onRequestClose={() => setExpanded(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setExpanded(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('scoreboard.roundHistory')}</Text>
            <ScrollView>
              {rounds.map((round, i) => (
                <View key={i} style={styles.roundRow}>
                  <Text style={styles.roundNum}>#{i + 1}</Text>
                  {round.scores.map((s, j) => (
                    <Text key={j} style={styles.roundScore}>
                      {s}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('scoreboard.total')}</Text>
              {state.players.map((_, i) => (
                <Text key={i} style={styles.totalScore}>
                  {totals.get(i as PlayerIndex) ?? 0}
                </Text>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5c3310',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 16,
  },
  playerScore: { alignItems: 'center', flex: 1 },
  playerName: { fontFamily: 'Caveat_400Regular', fontSize: 12, color: '#f2e8d0', opacity: 0.8 },
  score: { fontFamily: 'Caveat_700Bold', fontSize: 18, color: '#f2e8d0' },
  expandHint: { color: 'rgba(242,232,208,0.4)', fontSize: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: '#f2e8d0',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontFamily: 'Caveat_700Bold',
    fontSize: 22,
    color: '#3d2e18',
    marginBottom: 12,
    textAlign: 'center',
  },
  roundRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderColor: '#c8b090',
  },
  roundNum: { fontFamily: 'Caveat_400Regular', fontSize: 14, color: '#8a7a60', width: 32 },
  roundScore: {
    fontFamily: 'Caveat_400Regular',
    fontSize: 14,
    color: '#3d2e18',
    flex: 1,
    textAlign: 'center',
  },
  totalRow: { flexDirection: 'row', paddingTop: 8 },
  totalLabel: { fontFamily: 'Caveat_700Bold', fontSize: 15, color: '#3d2e18', width: 32 },
  totalScore: {
    fontFamily: 'Caveat_700Bold',
    fontSize: 15,
    color: '#3d2e18',
    flex: 1,
    textAlign: 'center',
  },
});
```

- [ ] **Step 3: Create `src/components/game/GameLogTab.tsx`**

```tsx
/**
 * GameLogTab
 *
 * Folded-paper tab in the bottom-right of the wood surround.
 * Tap to expand a scrolling paper-scroll overlay with recent log entries.
 * Auto-collapses when player takes any action (pass expanded state via prop).
 *
 * Uses useGameLog from @dabb/ui-shared.
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useGameLog } from '@dabb/ui-shared';
import type { GameEvent, GameState, PlayerIndex } from '@dabb/shared-types';
import { useTranslation } from '@dabb/i18n';

export interface GameLogTabProps {
  events: GameEvent[];
  state: GameState;
  playerIndex: PlayerIndex;
  // Increment each time the player takes an action to trigger a collapse.
  // Using a counter (not boolean) so each new action re-triggers the effect.
  collapseSignal: number;
}

// Port renderEntry() from apps/mobile/src/components/game/GameLog.tsx as renderLogEntry(entry, t).
// It returns a string by switching on entry.data.kind and translating each case.
// GameLogEntry.data is a discriminated union — entry.data.kind is the discriminant.
function renderLogEntry(
  entry: import('@dabb/shared-types').GameLogEntry,
  t: (key: string, params?: object) => string
): string {
  switch (entry.data.kind) {
    case 'bid_placed':
      return t('gameLog.bidPlaced', { amount: entry.data.amount });
    case 'player_passed':
      return t('gameLog.playerPassed');
    case 'bidding_won':
      return t('gameLog.biddingWon', { bid: entry.data.winningBid });
    case 'trump_declared':
      return t('gameLog.trumpDeclared', { suit: entry.data.suit });
    case 'card_played':
      return t('gameLog.cardPlayed', { card: `${entry.data.card.rank} ${entry.data.card.suit}` });
    case 'trick_won':
      return t('gameLog.trickWon', { points: entry.data.points });
    default:
      return entry.type;
  }
}

export function GameLogTab({ events, state, playerIndex, collapseSignal }: GameLogTabProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  // useGameLog(events, state, playerIndex) — real signature
  const { latestEntries, entries } = useGameLog(events, state, playerIndex);

  // Collapse whenever the player takes an action (signal increments)
  const prevSignal = useRef(collapseSignal);
  useEffect(() => {
    if (collapseSignal !== prevSignal.current) {
      prevSignal.current = collapseSignal;
      setExpanded(false);
    }
  }, [collapseSignal]);

  return (
    <>
      {/* Folded tab */}
      <TouchableOpacity style={styles.tab} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.tabLabel}>
          {t('gameLog.title')} {expanded ? '▼' : '▲'}
        </Text>
      </TouchableOpacity>

      {/* Expanded scroll — always rendered, hidden via opacity per project convention */}
      <View
        style={[styles.scroll, { opacity: expanded ? 1 : 0 }]}
        pointerEvents={expanded ? 'auto' : 'none'}
      >
        <ScrollView>
          {/* GameLogEntry shape: { id, type, playerIndex, data: discriminated union (data.kind) }
              No .text or .highlight fields — render from entry.data.kind + entry.data fields.
              Port the full renderEntry(entry) switch from apps/mobile/src/components/game/GameLog.tsx.
              latestEntries = newest-first slice (DEFAULT_VISIBLE_ENTRIES = 5).
              expanded ? use full entries : use latestEntries. */}
          {(expanded ? entries : latestEntries).map((entry) => (
            <Text key={entry.id} style={styles.entry}>
              {renderLogEntry(entry, t)}
            </Text>
          ))}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tab: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#f2e8d0',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#c8b090',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  tabLabel: { fontFamily: 'Caveat_700Bold', fontSize: 13, color: '#3d2e18' },
  scroll: {
    position: 'absolute',
    bottom: 44,
    right: 12,
    width: 260,
    maxHeight: 200,
    backgroundColor: '#f2e8d0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c8b090',
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  entry: { fontFamily: 'Caveat_400Regular', fontSize: 13, color: '#3d2e18', paddingVertical: 2 },
  highlight: { color: '#d4890a', fontFamily: 'Caveat_700Bold' },
});
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @dabb/client typecheck
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/game/TrickArea.tsx apps/client/src/components/game/ScoreboardStrip.tsx apps/client/src/components/game/GameLogTab.tsx
git commit -m "feat(client): add TrickArea, ScoreboardStrip, and GameLogTab"
```

---

### Task 8: Celebration, error states, reconnect banner

**Files:**

- Create: `apps/client/src/components/game/CelebrationLayer.tsx` (includes Confetti + Fireworks implementations inline from mobile originals)
- Create: `apps/client/src/components/game/GameTerminatedModal.tsx`
- Create: `apps/client/src/components/game/ReconnectingBanner.tsx`

- [ ] **Step 1: Create `src/components/game/CelebrationLayer.tsx`**

Port `apps/mobile/src/components/game/Confetti.tsx` and `Fireworks.tsx` directly into this file as local helper components (no separate files needed). `CelebrationLayer` accepts `showConfetti` and `showFireworks` from the parent — `useCelebration` is already called in `GameScreen.tsx`. The Gasthof palette is already used in the mobile Confetti (`COLORS = ['#d4890a', '#f0a830', ...]`), so copy it without changes.

```tsx
/**
 * CelebrationLayer
 *
 * Full-screen overlay for celebration animations.
 * Receives showConfetti / showFireworks from parent (GameScreen calls useCelebration).
 * Ported from apps/mobile/src/components/game/CelebrationOverlay.tsx + sub-components.
 */
import React from 'react';
import { View, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';

export interface CelebrationLayerProps {
  showConfetti: boolean;
  showFireworks: boolean;
}

// ── Confetti ──────────────────────────────────────────────────────────────────
// Copy apps/mobile/src/components/game/Confetti.tsx verbatim here (already uses Gasthof palette).
// It renders ~50 falling animated particles using React Native Animated API.
// Do NOT rename — just paste the full component implementation below.

// ── Fireworks ─────────────────────────────────────────────────────────────────
// Copy apps/mobile/src/components/game/Fireworks.tsx verbatim here.
// It renders animated bursting star particles.
// Do NOT rename — just paste the full component implementation below.

export function CelebrationLayer({ showConfetti, showFireworks }: CelebrationLayerProps) {
  const visible = showConfetti || showFireworks;
  // Outer View: always rendered with opacity toggle (absoluteFill, doesn't affect layout of siblings).
  // Inner Confetti/Fireworks: conditional mount is intentional — they use Animated API and must
  // restart their animation each time they appear. opacity toggle would keep animations running silently.
  return (
    <View style={[StyleSheet.absoluteFill, { opacity: visible ? 1 : 0 }]} pointerEvents="none">
      {showConfetti && <Confetti />}
      {showFireworks && <Fireworks />}
    </View>
  );
}
```

After pasting the implementations from the mobile app, run typecheck to confirm.

- [ ] **Step 2: Create `src/components/game/GameTerminatedModal.tsx`**

Port from `apps/web/src/components/game/GameTerminatedModal.tsx` (the web version has the correct structure — it renders a modal with reason text and a button). Convert HTML elements to React Native (`<div>` → `<View>`, `<p>` → `<Text>`, `<button>` → `<TouchableOpacity>`). Use `theme.ts` colors and Caveat font instead of CSS classes.

```tsx
/**
 * GameTerminatedModal
 *
 * Full-screen modal shown when the server terminates the game
 * (e.g. a player disconnects and doesn't reconnect in time).
 * Ported from apps/web/src/components/game/GameTerminatedModal.tsx.
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from '@dabb/i18n';

export interface GameTerminatedModalProps {
  visible: boolean;
  terminatedBy: string | null | undefined;
  onGoHome: () => void;
}

export function GameTerminatedModal({ visible, terminatedBy, onGoHome }: GameTerminatedModalProps) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>{t('game.gameTerminated')}</Text>
          <Text style={styles.body}>
            {terminatedBy
              ? t('game.gameTerminatedMessage', { name: terminatedBy })
              : t('game.gameTerminated')}
          </Text>
          <TouchableOpacity style={styles.button} onPress={onGoHome}>
            <Text style={styles.buttonText}>{t('game.backToHome')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    backgroundColor: '#f2e8d0',
    borderRadius: 8,
    padding: 28,
    maxWidth: 320,
    width: '85%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c8b090',
  },
  title: {
    fontFamily: 'Caveat_700Bold',
    fontSize: 24,
    color: '#3d2e18',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontFamily: 'Caveat_400Regular',
    fontSize: 16,
    color: '#3d2e18',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#5c3310',
    borderRadius: 6,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  buttonText: { fontFamily: 'Caveat_700Bold', fontSize: 16, color: '#f2e8d0' },
});
```

- [ ] **Step 3: Create `src/components/game/ReconnectingBanner.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from '@dabb/i18n';

export function ReconnectingBanner({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  // Always rendered; opacity toggled per project convention (never conditional unmount)
  return (
    <View
      style={[styles.banner, { opacity: visible ? 1 : 0 }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Text style={styles.text}>{t('connection.reconnecting')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    backgroundColor: '#8a5e2e',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    zIndex: 200,
  },
  text: { fontFamily: 'Caveat_700Bold', fontSize: 15, color: '#f2e8d0' },
});
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @dabb/client typecheck
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/game/CelebrationLayer.tsx apps/client/src/components/game/GameTerminatedModal.tsx apps/client/src/components/game/ReconnectingBanner.tsx
git commit -m "feat(client): add CelebrationLayer, GameTerminatedModal, and ReconnectingBanner"
```

---

### Task 9: GameScreen — assemble everything

**Files:**

- Create: `apps/client/src/components/game/GameScreen.tsx`
- Create: `apps/client/src/app/game/[id].tsx`

- [ ] **Step 1: Create `src/components/game/GameScreen.tsx`**

```tsx
/**
 * GameScreen
 *
 * Assembles the full game table:
 * 1. GameTable (Skia canvas — full-bleed background)
 * 2. ScoreboardStrip (top of wood surround)
 * 3. OpponentZone × N (absolute, one per opponent)
 * 4. TrickArea (absolute, center felt)
 * 5. PlayerHand (absolute, bottom)
 * 6. PhaseOverlay + phase overlay content (center felt)
 * 7. GameLogTab (bottom-right corner)
 * 8. CelebrationLayer (full-screen above all)
 * 9. ReconnectingBanner
 * 10. GameTerminatedModal
 *
 * "Your turn" amber ribbon is rendered as an absolutely positioned View
 * across the top edge of the felt when it's the player's turn.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  GameTable,
  useSkiaEffects,
  PhaseOverlay,
  BiddingOverlay,
  DabbOverlay,
  TrumpOverlay,
  MeldingOverlay,
  deriveCardPositions,
} from '@dabb/game-canvas';
import { useCelebration, useActionRequired } from '@dabb/ui-shared';
import { getValidPlays, sortHand, detectMelds } from '@dabb/game-logic';
import { useTranslation } from '@dabb/i18n';
import type { GameState, GameEvent, PlayerIndex, CardId, Suit } from '@dabb/shared-types';
import { PlayerHand } from './PlayerHand.js';
import { OpponentZone } from './OpponentZone.js';
import { TrickArea } from './TrickArea.js';
import { ScoreboardStrip } from './ScoreboardStrip.js';
import { GameLogTab } from './GameLogTab.js';
import { CelebrationLayer } from './CelebrationLayer.js';
import { GameTerminatedModal } from './GameTerminatedModal.js';
import { ReconnectingBanner } from './ReconnectingBanner.js';
import { playSound } from '../../utils/sounds.js';

export interface GameScreenProps {
  state: GameState;
  events: GameEvent[];
  playerIndex: PlayerIndex;
  nicknames: Map<PlayerIndex, string>;
  connecting: boolean; // true while socket is establishing connection / reconnecting
  onBid: (amount: number) => void;
  onPass: () => void;
  onTakeDabb: () => void;
  onDiscard: (cardIds: CardId[]) => void;
  onGoOut: (suit: Suit) => void;
  onDeclareTrump: (suit: Suit) => void;
  onDeclareMelds: () => void;
  onPlayCard: (cardId: CardId) => void;
}

export function GameScreen({
  state,
  events,
  playerIndex,
  nicknames,
  connecting,
  onBid,
  onPass,
  onTakeDabb,
  onDiscard,
  onGoOut,
  onDeclareTrump,
  onDeclareMelds,
  onPlayCard,
}: GameScreenProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const effects = useSkiaEffects();

  const [dabbSelected, setDabbSelected] = useState<CardId[]>([]);
  const [logCollapseSignal, setLogCollapseSignal] = useState(0);

  // Derive terminated-by player name from GAME_TERMINATED event + nicknames map
  const terminatedByName = useMemo(() => {
    const termEvent = events.find((e) => e.type === 'GAME_TERMINATED');
    if (!termEvent) return null;
    const termPlayerIndex = (termEvent as import('@dabb/shared-types').GameTerminatedEvent).payload
      .terminatedBy;
    return nicknames.get(termPlayerIndex) ?? null;
  }, [events, nicknames]);

  // useCelebration(events, playerIndex) → { showConfetti, showFireworks }
  const { showConfetti, showFireworks } = useCelebration(events, playerIndex);
  // useActionRequired returns ActionRequiredResult { actionRequired: boolean, actionType: ... }
  const { actionRequired: isMyTurn } = useActionRequired(state, playerIndex);

  // Derive sorted player hand — GameState.hands is Map<PlayerIndex, Card[]>
  const myCards = useMemo(
    () => sortHand(state.hands.get(playerIndex) ?? []),
    [state.hands, playerIndex]
  );

  // Derive opponent info for each opponent seat
  const opponentSeats = useMemo(
    () => state.players.map((_, i) => i as PlayerIndex).filter((i) => i !== playerIndex),
    [state.players, playerIndex]
  );

  // Won pile player IDs (all players, ordered by seat)
  const wonPilePlayerIds = useMemo(() => state.players.map((p) => p.id), [state.players]);

  // Derived position for opponent zones
  const positions = useMemo(() => {
    const opponentCounts = Object.fromEntries(
      opponentSeats.map((i) => [state.players[i]!.id, state.hands.get(i)?.length ?? 0])
    );
    return deriveCardPositions(
      { handCardIds: [], trickCardIds: [], wonPilePlayerIds, opponentCardCounts: opponentCounts },
      { width, height, playerCount: state.players.length as 3 | 4 }
    );
  }, [state, opponentSeats, wonPilePlayerIds, width, height]);

  // Melds for current player (melding phase)
  // detectMelds(hand, trump: Suit) — trump is guaranteed non-null during melding phase
  // calculateMeldPoints(melds: Meld[]) — takes array; each meld already has .points
  const myMelds = useMemo(() => {
    if (state.phase !== 'melding' || !state.trump) return [];
    const detected = detectMelds(myCards, state.trump);
    return detected.map((m) => ({ name: m.type, points: m.points }));
  }, [state.phase, myCards, state.trump]);

  const handlePlayCard = useCallback(
    (cardId: CardId) => {
      onPlayCard(cardId);
      setLogCollapseSignal((v) => v + 1);
      playSound('cardPlay');
      effects.triggerFeltRipple(width / 2, height * 0.45);
    },
    [onPlayCard, effects, width, height]
  );

  const handleBid = useCallback(
    (amount: number) => {
      onBid(amount);
      setLogCollapseSignal((v) => v + 1);
    },
    [onBid]
  );
  const handlePass = useCallback(() => {
    onPass();
    setLogCollapseSignal((v) => v + 1);
  }, [onPass]);
  const handleTakeDabb = useCallback(() => {
    onTakeDabb();
    setLogCollapseSignal((v) => v + 1);
  }, [onTakeDabb]);
  const handleDiscard = useCallback(() => {
    onDiscard(dabbSelected);
    setDabbSelected([]);
    setLogCollapseSignal((v) => v + 1);
  }, [onDiscard, dabbSelected]);
  const handleGoOut = useCallback(
    (suit: Suit) => {
      onGoOut(suit);
      setLogCollapseSignal((v) => v + 1);
    },
    [onGoOut]
  );
  const handleDeclareTrump = useCallback(
    (suit: Suit) => {
      onDeclareTrump(suit);
      setLogCollapseSignal((v) => v + 1);
    },
    [onDeclareTrump]
  );
  const handleDeclareMelds = useCallback(() => {
    onDeclareMelds();
    setLogCollapseSignal((v) => v + 1);
  }, [onDeclareMelds]);

  const isDabbTake = state.phase === 'dabb' && state.dabb.length > 0;
  const isDabbDiscard = state.phase === 'dabb' && state.dabb.length === 0;

  return (
    <View style={styles.screen}>
      {/* 1. Skia table background */}
      <GameTable width={width} height={height} effects={effects} />

      {/* 2. Scoreboard strip (top) */}
      <ScoreboardStrip
        state={state}
        events={events}
        playerIndex={playerIndex}
        nicknames={nicknames}
      />

      {/* 3. Opponent zones */}
      {opponentSeats.map((seatIdx) => {
        const player = state.players[seatIdx]!;
        const oppPos = positions.opponentHands[player.id];
        if (!oppPos) return null;
        return (
          <OpponentZone
            key={player.id}
            playerId={player.id}
            nickname={nicknames.get(seatIdx) ?? player.id}
            cardCount={oppPos.cardCount}
            wonTrickCount={state.tricksTaken.get(seatIdx)?.length ?? 0}
            isTheirTurn={state.currentPlayer === seatIdx}
            x={oppPos.x}
            y={oppPos.y}
          />
        );
      })}

      {/* 4. Trick area */}
      <TrickArea
        state={state}
        trickCards={(state.currentTrick ?? []).map((entry) => ({
          card: entry.card,
          seatIndex: entry.playerIndex,
        }))}
        wonPilePlayerIds={wonPilePlayerIds}
      />

      {/* 5. Player hand */}
      <PlayerHand
        state={state}
        playerIndex={playerIndex}
        playerCards={myCards}
        onPlayCard={handlePlayCard}
      />

      {/* 6. Phase overlays */}
      <PhaseOverlay visible={state.phase === 'bidding'} rotation={-2}>
        <BiddingOverlay
          currentBid={state.currentBid ?? 150}
          isMyTurn={isMyTurn}
          onBid={handleBid}
          onPass={handlePass}
        />
      </PhaseOverlay>

      <PhaseOverlay visible={isDabbTake || isDabbDiscard} rotation={1}>
        <DabbOverlay
          step={isDabbTake ? 'take' : 'discard'}
          dabbCards={state.dabb ?? []}
          selectedCardIds={dabbSelected}
          onTake={handleTakeDabb}
          onToggleCard={(id) =>
            setDabbSelected((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          onDiscard={handleDiscard}
          onGoOut={handleGoOut}
        />
      </PhaseOverlay>

      <PhaseOverlay visible={state.phase === 'trump'} rotation={-1}>
        <TrumpOverlay onSelectTrump={handleDeclareTrump} />
      </PhaseOverlay>

      <PhaseOverlay visible={state.phase === 'melding'} rotation={2}>
        <MeldingOverlay
          melds={myMelds}
          totalPoints={myMelds.reduce((sum, m) => sum + m.points, 0)}
          canConfirm={state.currentPlayer === playerIndex}
          onConfirm={handleDeclareMelds}
        />
      </PhaseOverlay>

      {/* 7. Your turn ribbon — always rendered, opacity toggled per project convention */}
      <View
        style={[styles.turnRibbon, { opacity: isMyTurn ? 1 : 0 }]}
        pointerEvents={isMyTurn ? 'auto' : 'none'}
      >
        <Text style={styles.turnText}>{t('game.yourTurn')}</Text>
      </View>

      {/* 8. Game log tab */}
      <GameLogTab
        events={events}
        state={state}
        playerIndex={playerIndex}
        collapseSignal={logCollapseSignal}
      />

      {/* 9. Celebration */}
      <CelebrationLayer showConfetti={showConfetti} showFireworks={showFireworks} />

      {/* 10. Reconnecting */}
      <ReconnectingBanner visible={connecting} />

      {/* 11. Terminated modal */}
      <GameTerminatedModal
        visible={state.phase === 'terminated'}
        terminatedBy={terminatedByName}
        onGoHome={() => router.replace('/')}
      />

      {/* Exit button */}
      <TouchableOpacity style={styles.exitBtn} onPress={() => router.replace('/')}>
        <Text style={styles.exitText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#3b2005' },
  turnRibbon: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  turnText: {
    fontFamily: 'Caveat_700Bold',
    fontSize: 18,
    color: '#f2e8d0',
    backgroundColor: 'rgba(212,137,10,0.85)',
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  exitBtn: { position: 'absolute', top: 8, right: 12, zIndex: 300 },
  exitText: { fontFamily: 'Lato_700Bold', fontSize: 18, color: 'rgba(242,232,208,0.5)' },
});
```

- [ ] **Step 2: Create `src/app/game/[id].tsx`**

```tsx
import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useGame } from '../../hooks/useGame.js';
import { GameScreen } from '../../components/game/GameScreen.js';

interface SessionParams {
  id: string; // sessionId
  secretId: string;
  playerIndex: string;
}

export default function GameRoute() {
  const {
    id: sessionId,
    secretId,
    playerIndex: playerIndexStr,
  } = useLocalSearchParams<SessionParams>();
  const playerIndex = parseInt(
    playerIndexStr ?? '0',
    10
  ) as import('@dabb/shared-types').PlayerIndex;

  const game = useGame({ sessionId, secretId, playerIndex });

  if (!game.connected && game.connecting) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Connecting…</Text>
      </View>
    );
  }

  return (
    <GameScreen
      state={game.state}
      events={game.events}
      playerIndex={playerIndex}
      nicknames={game.nicknames}
      connecting={game.connecting}
      onBid={game.onBid}
      onPass={game.onPass}
      onTakeDabb={game.onTakeDabb}
      onDiscard={game.onDiscard}
      onGoOut={game.onGoOut}
      onDeclareTrump={game.onDeclareTrump}
      onDeclareMelds={game.onDeclareMelds}
      onPlayCard={game.onPlayCard}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b2005' },
  loadingText: { fontFamily: 'Caveat_400Regular', fontSize: 20, color: '#f2e8d0' },
});
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @dabb/client typecheck
```

Expected: passes. Fix any type mismatches against `GameState` fields — check `packages/shared-types/src/game.ts` for exact field names (`currentTrick`, `hands`, `dabb`, `currentPlayer`, `currentBid`, `trump`, `terminationReason`, etc.).

- [ ] **Step 4: Smoke test in Expo**

```bash
pnpm --filter @dabb/client start
```

Open on web or device. Navigate from home → create game → waiting room → game (need a running server for full test). Verify:

- Table background renders (green felt + wood surround visible)
- Home screen shows create/join UI
- No crash on load

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/game/GameScreen.tsx apps/client/src/app/game/
git commit -m "feat(client): add GameScreen assembling full game table"
```

---

## Chunk 4: Face Card Illustrations + Cleanup

### Task 10: Move face card illustrations to card-assets

**Files:**

- Modify: `packages/card-assets/src/index.ts`
- Move: face SVG components from old apps → `packages/card-assets/src/faces/`
- Modify: `packages/game-canvas/src/cards/CardFace.tsx`

- [ ] **Step 1: Locate existing face components**

```bash
ls apps/mobile/src/components/game/CardFaces/
ls apps/web/src/components/game/CardFaces/
```

Expected: files like `Koenig.tsx`, `Ober.tsx`, `Buabe.tsx` (or similar) for each suit.

- [ ] **Step 2: Copy face components to card-assets**

Use the mobile versions only — they use `react-native-svg` which works cross-platform via react-native-web. The web versions use native browser `<svg>` elements and must be discarded.

```bash
mkdir -p packages/card-assets/src/faces
cp apps/mobile/src/components/game/CardFaces/*.tsx packages/card-assets/src/faces/
```

Verify `react-native-svg` is in `packages/card-assets/package.json` dependencies. If not, add it:

```json
"react-native-svg": "*"
```

(Use the same version already installed in `apps/mobile/package.json`.)

- [ ] **Step 3: Export from card-assets**

The mobile face components use `export default`. Add re-exports with named aliases to `packages/card-assets/src/index.ts`:

```ts
export { default as KoenigFace } from './faces/KoenigFace.js';
export { default as OberFace } from './faces/OberFace.js';
export { default as BuabeFace } from './faces/BuabeFace.js';
```

(Adjust file names to match the actual copied file names — check `packages/card-assets/src/faces/` after Step 2.)

- [ ] **Step 4: Wire into CardFace.tsx**

In `packages/game-canvas/src/cards/CardFace.tsx`, replace emoji placeholders:

The face components accept `{ color: string }` (verified in `KoenigFace.tsx`). Use `getSuitColor` from `@dabb/card-assets` to convert the card's `Suit` to a color string. Rank values are lowercase (`'koenig'`, `'ober'`, `'buabe'`) — these are the `Rank` type values from `@dabb/shared-types`.

```tsx
import { KoenigFace, OberFace, BuabeFace, getSuitColor } from '@dabb/card-assets';

// Replace in the center render:
{
  isFace ? (
    card.rank === 'koenig' ? (
      <KoenigFace color={getSuitColor(card.suit)} width={width * 0.7} height={height * 0.55} />
    ) : card.rank === 'ober' ? (
      <OberFace color={getSuitColor(card.suit)} width={width * 0.7} height={height * 0.55} />
    ) : (
      <BuabeFace color={getSuitColor(card.suit)} width={width * 0.7} height={height * 0.55} />
    )
  ) : (
    <Text style={[styles.centerSuit, { fontSize: centerSz, color }]}>{symbol}</Text>
  );
}
```

- [ ] **Step 5: Typecheck both packages**

```bash
pnpm --filter @dabb/card-assets typecheck
pnpm --filter @dabb/game-canvas typecheck
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add packages/card-assets/src/faces/ packages/card-assets/src/index.ts packages/game-canvas/src/cards/CardFace.tsx
git commit -m "feat(card-assets): move face card illustrations and wire into CardFace"
```

---

### Task 11: Delete old apps + update CI

**Files:**

- Delete: `apps/web/` (entire directory)
- Delete: `apps/mobile/` (entire directory)
- Modify: `.github/workflows/` (remove web/mobile references, add client)
- Modify: `turbo.json` (remove web/mobile pipeline entries if any)

- [ ] **Step 1: Verify client app is fully working before deleting**

Run the full test suite and typecheck:

```bash
pnpm test
pnpm run build
```

Expected: all pass. Do NOT proceed to deletion if tests fail.

- [ ] **Step 2: Delete old apps**

```bash
rm -rf apps/web apps/mobile
```

- [ ] **Step 3: Update CI workflows**

```bash
ls .github/workflows/
```

For each workflow file that references `@dabb/web` or `@dabb/mobile`:

- Replace with `@dabb/client`
- Update any `pnpm --filter @dabb/web` or `pnpm --filter @dabb/mobile` commands

- [ ] **Step 4: Update turbo.json if needed**

```bash
cat turbo.json
```

If `turbo.json` has pipeline entries for `@dabb/web` or `@dabb/mobile`, update to `@dabb/client`.

- [ ] **Step 5: Search for stray references to old apps**

```bash
grep -r "apps/web\|apps/mobile\|@dabb/web\|@dabb/mobile" .github/ docs/ pnpm-workspace.yaml turbo.json CLAUDE.md DEPLOYMENT.md CHANGELOG.md 2>/dev/null | grep -v "\.git"
```

For each match: update the reference to `apps/client` / `@dabb/client`.

- [ ] **Step 6: Run CI check**

```bash
pnpm run build && pnpm test && pnpm lint
```

Expected: all pass with no references to deleted apps.

- [ ] **Step 7: Commit**

```bash
git add .github/ docs/ pnpm-workspace.yaml turbo.json CLAUDE.md DEPLOYMENT.md CHANGELOG.md
git commit -m "feat(client): replace apps/web and apps/mobile with unified apps/client"
```

---

**Plan 2 complete.** The unified `apps/client` Expo app is fully implemented and the old apps are retired.
