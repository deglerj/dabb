# URL Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove sensitive credentials and dead identifiers from game session URLs, replacing `/waiting-room/<uuid>?code=ABCD&secretId=...&playerIndex=0` with simply `/waiting-room/ABCD`.

**Architecture:** Route files are renamed from `[id]` to `[code]` so the path segment captures the 4-letter join code directly. Credentials (`secretId`, `playerIndex`, `playerCount`) are read asynchronously from `storageGet('dabb-${code}')` on mount instead of URL params. Navigation calls are stripped to just `{ code }`.

**Tech Stack:** React Native, Expo Router (file-based routing), `expo-secure-store` / `localStorage` via `storageGet`/`storageSet`/`storageDelete` in `apps/client/src/hooks/useStorage.ts`.

---

## File Map

| File                                           | Action                                     |
| ---------------------------------------------- | ------------------------------------------ |
| `apps/client/src/app/waiting-room/[id].tsx`    | Rename → `[code].tsx` and rewrite          |
| `apps/client/src/app/game/[id].tsx`            | Rename → `[code].tsx` and rewrite          |
| `apps/client/src/app/game/[id].native.tsx`     | Rename → `[code].native.tsx` and rewrite   |
| `apps/client/src/components/ui/HomeScreen.tsx` | Update navigation calls and storage writes |

No server files change. No test files change (route components have no unit tests).

---

### Task 1: Update HomeScreen navigation and storage

**Files:**

- Modify: `apps/client/src/components/ui/HomeScreen.tsx`

- [ ] **Step 1: Add `playerCount` to the host's storage write**

  In `HomeScreen.tsx`, find the `handleCreate` function. The `storageSet` call currently writes:

  ```ts
  JSON.stringify({
    secretId: sessionData.secretId,
    playerId: sessionData.playerId,
    playerIndex: sessionData.playerIndex,
  });
  ```

  Add `playerCount`:

  ```ts
  JSON.stringify({
    secretId: sessionData.secretId,
    playerId: sessionData.playerId,
    playerIndex: sessionData.playerIndex,
    playerCount,
  });
  ```

  (`playerCount` is already in scope — it's the variable the user selected.)

- [ ] **Step 2: Strip host navigation to just `code`**

  Replace the `router.push` call in `handleCreate`:

  ```ts
  // Before
  router.push({
    pathname: '/waiting-room/[id]',
    params: {
      id: sessionData.sessionId,
      code: sessionData.sessionCode,
      secretId: sessionData.secretId,
      playerIndex: String(sessionData.playerIndex),
      playerCount: String(playerCount),
      nickname: nickname.trim(),
    },
  });

  // After
  router.push({
    pathname: '/waiting-room/[code]',
    params: { code: sessionData.sessionCode },
  });
  ```

- [ ] **Step 3: Strip join navigation to just `code`**

  Replace the `router.push` call in `handleJoin`:

  ```ts
  // Before
  router.push({
    pathname: '/waiting-room/[id]',
    params: {
      id: sessionData.sessionId,
      code: joinCode.trim().toUpperCase(),
      secretId: sessionData.secretId,
      playerIndex: String(sessionData.playerIndex),
      playerCount: '0',
      nickname: nickname.trim(),
    },
  });

  // After
  router.push({
    pathname: '/waiting-room/[code]',
    params: { code: joinCode.trim().toUpperCase() },
  });
  ```

  Note: the joiner's storage write (just above this) already uses `joinCode.trim().toUpperCase()` as the key — no change needed there.

- [ ] **Step 4: Commit**
  ```bash
  git add apps/client/src/components/ui/HomeScreen.tsx
  git commit -m "feat: strip credentials from waiting-room navigation URL"
  ```

---

### Task 2: Rewrite waiting-room route

**Files:**

- Delete: `apps/client/src/app/waiting-room/[id].tsx`
- Create: `apps/client/src/app/waiting-room/[code].tsx`

- [ ] **Step 1: Delete the old route file**

  ```bash
  rm apps/client/src/app/waiting-room/[id].tsx
  ```

- [ ] **Step 2: Create `[code].tsx` with full implementation**

  Create `apps/client/src/app/waiting-room/[code].tsx`:

  ```tsx
  import React, { useState, useCallback, useEffect } from 'react';
  import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
  import { useLocalSearchParams, useRouter } from 'expo-router';
  import { useSocket } from '@dabb/ui-shared';
  import WaitingRoomScreen from '../../components/ui/WaitingRoomScreen.js';
  import { storageDelete, storageGet } from '../../hooks/useStorage.js';
  import { SERVER_URL } from '../../constants.js';
  import type { PlayerIndex, AIDifficulty, GameEvent } from '@dabb/shared-types';

  type PlayerEntry = {
    nickname: string;
    connected: boolean;
    isAI: boolean;
    aiDifficulty?: AIDifficulty;
  };

  type StoredSession = {
    secretId: string;
    playerId: string;
    playerIndex: PlayerIndex;
    playerCount?: number;
  };

  export default function WaitingRoomRoute() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const router = useRouter();

    const [credentials, setCredentials] = useState<StoredSession | null>(null);
    const [nickname, setNickname] = useState('');
    const [players, setPlayers] = useState<Map<PlayerIndex, PlayerEntry>>(new Map());
    const [isAddingAI, setIsAddingAI] = useState(false);
    const [selectedAIDifficulty, setSelectedAIDifficulty] = useState<AIDifficulty>('medium');

    // Load credentials from storage on mount
    useEffect(() => {
      if (!code) {
        router.replace('/');
        return;
      }
      void (async () => {
        try {
          const [sessionRaw, storedNickname] = await Promise.all([
            storageGet(`dabb-${code}`),
            storageGet('dabb-nickname'),
          ]);
          if (!sessionRaw) {
            router.replace('/');
            return;
          }
          const session = JSON.parse(sessionRaw) as StoredSession;
          setCredentials(session);
          const ownNickname = storedNickname ?? '';
          setNickname(ownNickname);
          // Seed own player — server emits player:joined only to *other* sockets
          setPlayers(
            new Map([
              [session.playerIndex, { nickname: ownNickname, connected: true, isAI: false }],
            ])
          );
        } catch {
          router.replace('/');
        }
      })();
    }, [code, router]);

    const handlePlayerJoined = useCallback(
      (idx: number, playerNickname: string, isAI = false, aiDifficulty?: AIDifficulty) => {
        setPlayers((prev) => {
          const next = new Map(prev);
          next.set(idx as PlayerIndex, {
            nickname: playerNickname,
            connected: true,
            isAI,
            aiDifficulty,
          });
          return next;
        });
      },
      []
    );

    const handlePlayerLeft = useCallback((idx: number) => {
      setPlayers((prev) => {
        const next = new Map(prev);
        const p = next.get(idx as PlayerIndex);
        if (p) {
          next.set(idx as PlayerIndex, { ...p, connected: false });
        }
        return next;
      });
    }, []);

    const handlePlayerReconnected = useCallback((idx: number) => {
      setPlayers((prev) => {
        const next = new Map(prev);
        const p = next.get(idx as PlayerIndex);
        if (p) {
          next.set(idx as PlayerIndex, { ...p, connected: true });
        }
        return next;
      });
    }, []);

    const handleEvents = useCallback(
      (events: GameEvent[]) => {
        const started = events.some((e) => e.type === 'GAME_STARTED');
        if (started) {
          router.replace({
            pathname: '/game/[code]',
            params: { code },
          });
        }
      },
      [router, code]
    );

    // Note: useSocket called unconditionally (Rules of Hooks).
    // Passes empty secretId while credentials are loading — socket won't connect until it's non-empty.
    const { emit, error: _connectionError } = useSocket({
      serverUrl: SERVER_URL,
      sessionId: code ?? '',
      secretId: credentials?.secretId ?? '',
      onEvents: handleEvents,
      onPlayerJoined: handlePlayerJoined,
      onPlayerLeft: handlePlayerLeft,
      onPlayerReconnected: handlePlayerReconnected,
    });

    if (!credentials) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    const { playerIndex, playerCount } = credentials;
    const isHost = playerIndex === 0;

    const handleStartGame = () => {
      emit?.('game:start');
    };

    const handleLeave = async () => {
      emit?.('game:exit');
      await storageDelete(`dabb-${code}`);
      router.replace('/');
    };

    const handleAddAI = async () => {
      if (!credentials.secretId || isAddingAI) return;
      setIsAddingAI(true);
      try {
        const response = await fetch(`${SERVER_URL}/api/sessions/${code}/ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Secret-Id': credentials.secretId },
          body: JSON.stringify({ difficulty: selectedAIDifficulty }),
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          Alert.alert('Error', data.error ?? 'Failed to add AI player');
          return;
        }
        const {
          playerIndex: idx,
          nickname: aiNickname,
          aiDifficulty,
        } = (await response.json()) as {
          playerIndex: number;
          nickname: string;
          aiDifficulty: AIDifficulty;
        };
        handlePlayerJoined(idx, aiNickname, true, aiDifficulty);
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add AI player');
      } finally {
        setIsAddingAI(false);
      }
    };

    const handleRemoveAI = async (playerIdx: PlayerIndex) => {
      if (!credentials.secretId) return;
      try {
        const response = await fetch(`${SERVER_URL}/api/sessions/${code}/ai/${playerIdx}`, {
          method: 'DELETE',
          headers: { 'X-Secret-Id': credentials.secretId },
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          Alert.alert('Error', data.error ?? 'Failed to remove AI player');
          return;
        }
        setPlayers((prev) => {
          const next = new Map(prev);
          next.delete(playerIdx);
          return next;
        });
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove AI player');
      }
    };

    return (
      <WaitingRoomScreen
        sessionCode={code}
        players={players}
        playerCount={playerCount ?? 0}
        isHost={isHost}
        onStartGame={handleStartGame}
        onLeave={handleLeave}
        onAddAI={isHost ? handleAddAI : undefined}
        onRemoveAI={isHost ? handleRemoveAI : undefined}
        isAddingAI={isAddingAI}
        selectedAIDifficulty={selectedAIDifficulty}
        onSelectAIDifficulty={setSelectedAIDifficulty}
      />
    );
  }

  const styles = StyleSheet.create({
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });
  ```

  The `nickname` state variable is used only to seed the `players` map (inside the `useEffect`). `WaitingRoomScreen` does not accept a `nickname` prop — the nickname is already embedded in the `players` map entry, so no extra prop is needed.

- [ ] **Step 3: Commit**
  ```bash
  git add apps/client/src/app/waiting-room/
  git commit -m "feat: replace waiting-room/[id] route with [code], load credentials from storage"
  ```

---

### Task 3: Rewrite game routes

**Files:**

- Delete: `apps/client/src/app/game/[id].tsx`
- Delete: `apps/client/src/app/game/[id].native.tsx`
- Create: `apps/client/src/app/game/[code].tsx`
- Create: `apps/client/src/app/game/[code].native.tsx`

- [ ] **Step 1: Delete old route files**

  ```bash
  rm apps/client/src/app/game/[id].tsx apps/client/src/app/game/[id].native.tsx
  ```

- [ ] **Step 2: Create `[code].native.tsx`**

  Create `apps/client/src/app/game/[code].native.tsx`:

  ```tsx
  import React, { useEffect, useState } from 'react';
  import { ActivityIndicator, StyleSheet, View } from 'react-native';
  import { useLocalSearchParams, useRouter } from 'expo-router';
  import GameScreen from '../../components/ui/GameScreen.js';
  import { storageGet } from '../../hooks/useStorage.js';
  import type { PlayerIndex } from '@dabb/shared-types';

  type StoredSession = {
    secretId: string;
    playerId: string;
    playerIndex: PlayerIndex;
  };

  export default function GameRoute() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const router = useRouter();
    const [credentials, setCredentials] = useState<StoredSession | null>(null);

    useEffect(() => {
      if (!code) {
        router.replace('/');
        return;
      }
      void (async () => {
        try {
          const raw = await storageGet(`dabb-${code}`);
          if (!raw) {
            router.replace('/');
            return;
          }
          setCredentials(JSON.parse(raw) as StoredSession);
        } catch {
          router.replace('/');
        }
      })();
    }, [code, router]);

    if (!credentials) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    return (
      <GameScreen
        sessionId={code}
        secretId={credentials.secretId}
        playerIndex={credentials.playerIndex}
      />
    );
  }

  const styles = StyleSheet.create({
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });
  ```

- [ ] **Step 3: Create `[code].tsx` (web)**

  Create `apps/client/src/app/game/[code].tsx`:

  ```tsx
  /**
   * Web game route (native uses [code].native.tsx which is excluded from the web bundle).
   *
   * On web, @shopify/react-native-skia uses CanvasKit (WASM). The JsiSk* factories
   * capture `global.CanvasKit` at import time — so GameScreen must NOT be statically
   * imported before LoadSkiaWeb resolves. WithSkiaWeb uses React.lazy() to defer the
   * GameScreen import until after CanvasKit is ready.
   *
   * Keeping this as [code].tsx (not [code].web.tsx) ensures Metro excludes [code].native.tsx
   * from the web bundle, preventing premature Skia module evaluation.
   */
  import React, { useEffect, useState } from 'react';
  import { ActivityIndicator, StyleSheet, View } from 'react-native';
  import { useLocalSearchParams, useRouter } from 'expo-router';
  import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
  import { storageGet } from '../../hooks/useStorage.js';
  import type { PlayerIndex } from '@dabb/shared-types';

  type StoredSession = {
    secretId: string;
    playerId: string;
    playerIndex: PlayerIndex;
  };

  export default function GameRoute() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const router = useRouter();
    const [credentials, setCredentials] = useState<StoredSession | null>(null);

    useEffect(() => {
      if (!code) {
        router.replace('/');
        return;
      }
      void (async () => {
        try {
          const raw = await storageGet(`dabb-${code}`);
          if (!raw) {
            router.replace('/');
            return;
          }
          setCredentials(JSON.parse(raw) as StoredSession);
        } catch {
          router.replace('/');
        }
      })();
    }, [code, router]);

    if (!credentials) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    return (
      <WithSkiaWeb
        getComponent={() =>
          import('../../components/ui/GameScreen.js') as unknown as Promise<{
            default: React.ComponentType<{
              sessionId: string;
              secretId: string;
              playerIndex: PlayerIndex;
            }>;
          }>
        }
        opts={{ locateFile: (file: string) => `/${file}` }}
        fallback={
          <View style={styles.loading}>
            <ActivityIndicator size="large" />
          </View>
        }
        componentProps={{
          sessionId: code,
          secretId: credentials.secretId,
          playerIndex: credentials.playerIndex,
        }}
      />
    );
  }

  const styles = StyleSheet.create({
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add apps/client/src/app/game/
  git commit -m "feat: replace game/[id] routes with [code], load credentials from storage"
  ```

---

### Task 4: Verify and fix

- [ ] **Step 1: Run CI check**

  ```bash
  pnpm run build && pnpm test && pnpm run typecheck && pnpm lint
  ```

  Expected: all pass. If the `WaitingRoomScreen` does not have a `nickname` prop, TypeScript will report an error here — remove the `nickname={nickname}` prop from the JSX in `[code].tsx` (the players map already contains the own player with the correct nickname).

- [ ] **Step 2: Fix any issues found, then commit**
  ```bash
  git add apps/client/src/app/ apps/client/src/components/ui/HomeScreen.tsx
  git commit -m "fix: address typecheck/lint issues in URL cleanup"
  ```
  (Only needed if step 1 found issues.)
