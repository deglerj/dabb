# Firebase P2P Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Node.js server + PostgreSQL + Socket.IO with Firebase Realtime Database, eliminating server costs while keeping full multiplayer.

**Architecture:** Clients push game events directly to Firebase RTDB. Each client maintains full unfiltered state (for cascade computation) and filtered state (for display). Cascade events (TRICK_WON, BIDDING_WON, etc.) are computed and pushed atomically by the triggering client. AI turns use Firebase transactions for claim-based execution. All `packages/` remain unchanged.

**Tech Stack:** Firebase JS SDK (`firebase` npm package, no native modules needed), Expo Go compatible, React Native + web.

**Spec:** `docs/superpowers/specs/2026-04-21-firebase-p2p-design.md`

---

## File Map

| Status | Path                                           | Responsibility                                       |
| ------ | ---------------------------------------------- | ---------------------------------------------------- |
| Create | `apps/client/src/firebase/config.ts`           | Firebase app init, DB ref                            |
| Create | `apps/client/src/firebase/secretId.ts`         | Generate/store/hash player secretId                  |
| Create | `apps/client/src/firebase/sessionCode.ts`      | Client-side session code generation                  |
| Create | `apps/client/src/firebase/session.ts`          | Create/join/get session in Firebase                  |
| Create | `apps/client/src/firebase/events.ts`           | Push + subscribe to game events                      |
| Create | `apps/client/src/firebase/gameEventFactory.ts` | Action → GameEvent[] (port of server gameService.ts) |
| Create | `apps/client/src/hooks/useFirebaseGame.ts`     | Full game hook replacing useSocket + useGame         |
| Create | `apps/client/src/hooks/useAI.ts`               | AI turn detection + Firebase claim + execution       |
| Create | `apps/client/web/.htaccess`                    | SPA routing for Apache                               |
| Create | `.github/workflows/deploy-web.yml`             | SFTP deploy to Alfahosting                           |
| Modify | `apps/client/src/hooks/useGame.ts`             | Re-export from useFirebaseGame                       |
| Modify | `apps/client/src/app/waiting-room/[code].tsx`  | Use Firebase session + events                        |
| Modify | `apps/client/src/app/game/[code].tsx`          | Use useAI hook                                       |
| Modify | `apps/client/src/app/game/[code].native.tsx`   | Use useAI hook                                       |
| Modify | `apps/client/src/app/_layout.tsx`              | Remove useVersionCheck + SERVER_URL                  |
| Modify | `apps/client/src/constants.ts`                 | Remove SERVER_URL                                    |
| Modify | `apps/client/package.json`                     | Add firebase, remove socket.io-client                |
| Modify | `packages/ui-shared/package.json`              | Remove socket.io-client                              |
| Modify | `packages/ui-shared/src/index.ts`              | Remove useSocket + useVersionCheck exports           |
| Modify | `.github/workflows/ci.yml`                     | Remove build-docker jobs                             |
| Delete | `packages/ui-shared/src/useSocket.ts`          | Replaced by Firebase subscriptions in client         |
| Delete | `packages/ui-shared/src/useVersionCheck.ts`    | No server to check version against                   |
| Delete | `.github/workflows/deploy.yml`                 | Replaced by deploy-web.yml                           |

---

## Task 1: Firebase Dependencies + Config

**Files:**

- Modify: `apps/client/package.json`
- Modify: `packages/ui-shared/package.json`
- Create: `apps/client/src/firebase/config.ts`

- [ ] **Step 1: Update client package.json — add firebase, remove socket.io-client**

In `apps/client/package.json`, in the `dependencies` object:

- Add: `"firebase": "^11.0.0"`
- Remove: `"socket.io-client": "^4.8.3"`

- [ ] **Step 2: Remove socket.io-client from ui-shared**

In `packages/ui-shared/package.json`, remove from `dependencies`:

- `"socket.io-client": "^4.8.3"`

- [ ] **Step 3: Install**

```bash
pnpm install
```

Expected: lock file updates, no errors.

- [ ] **Step 4: Create Firebase config**

Create `apps/client/src/firebase/config.ts`:

```typescript
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import Constants from 'expo-constants';

const firebaseConfig = {
  apiKey: (Constants.expoConfig?.extra?.firebaseApiKey as string | undefined) ?? '',
  authDomain: (Constants.expoConfig?.extra?.firebaseAuthDomain as string | undefined) ?? '',
  databaseURL: (Constants.expoConfig?.extra?.firebaseDatabaseUrl as string | undefined) ?? '',
  projectId: (Constants.expoConfig?.extra?.firebaseProjectId as string | undefined) ?? '',
  storageBucket: (Constants.expoConfig?.extra?.firebaseStorageBucket as string | undefined) ?? '',
  messagingSenderId:
    (Constants.expoConfig?.extra?.firebaseMessagingSenderId as string | undefined) ?? '',
  appId: (Constants.expoConfig?.extra?.firebaseAppId as string | undefined) ?? '',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getDatabase(app);
```

- [ ] **Step 5: Wire env vars into app.json extra**

In `apps/client/app.json`, add `extra` section inside `expo`:

```json
"extra": {
  "firebaseApiKey": "$EXPO_PUBLIC_FIREBASE_API_KEY",
  "firebaseAuthDomain": "$EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "firebaseDatabaseUrl": "$EXPO_PUBLIC_FIREBASE_DATABASE_URL",
  "firebaseProjectId": "$EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "firebaseStorageBucket": "$EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "firebaseMessagingSenderId": "$EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "firebaseAppId": "$EXPO_PUBLIC_FIREBASE_APP_ID"
}
```

- [ ] **Step 6: Build to verify no import errors**

```bash
pnpm run build
```

Expected: passes (or shows only unrelated existing errors).

- [ ] **Step 7: Commit**

```bash
git add apps/client/package.json packages/ui-shared/package.json apps/client/src/firebase/config.ts apps/client/app.json pnpm-lock.yaml
git commit -m "feat(firebase): add Firebase SDK, wire config from env vars"
```

---

## Task 2: Secret ID Utility

**Files:**

- Create: `apps/client/src/firebase/secretId.ts`
- Create: `apps/client/src/firebase/__tests__/secretId.test.ts`

A `secretId` is a UUID stored in AsyncStorage. Its SHA-256 hash (`secretHash`) is stored in Firebase to gate event writes. Players prove their identity by including their `secretHash` in every event they push.

- [ ] **Step 1: Write failing tests**

Create `apps/client/src/firebase/__tests__/secretId.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrCreateSecretId, hashSecretId } from '../secretId.js';

describe('secretId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and stores a new secretId when none exists', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);

    const id = await getOrCreateSecretId('session-abc');

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'dabb-secret-session-abc',
      expect.stringMatching(/^[0-9a-f-]{36}$/)
    );
  });

  it('returns existing secretId when already stored', async () => {
    const existing = 'existing-uuid-1234-5678-abcd';
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(existing);

    const id = await getOrCreateSecretId('session-abc');

    expect(id).toBe(existing);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('hashSecretId returns a 64-char hex string', async () => {
    const hash = await hashSecretId('test-secret-id');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same input always produces same hash', async () => {
    const hash1 = await hashSecretId('test-secret-id');
    const hash2 = await hashSecretId('test-secret-id');
    expect(hash1).toBe(hash2);
  });

  it('different inputs produce different hashes', async () => {
    const hash1 = await hashSecretId('secret-a');
    const hash2 = await hashSecretId('secret-b');
    expect(hash1).not.toBe(hash2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @dabb/client test src/firebase/__tests__/secretId.test.ts
```

Expected: FAIL — `secretId.ts` not found.

- [ ] **Step 3: Implement secretId.ts**

Create `apps/client/src/firebase/secretId.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export async function getOrCreateSecretId(sessionCode: string): Promise<string> {
  const key = `dabb-secret-${sessionCode}`;
  const existing = await AsyncStorage.getItem(key);
  if (existing) return existing;

  const newId = uuidv4();
  await AsyncStorage.setItem(key, newId);
  return newId;
}

export async function hashSecretId(secretId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secretId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @dabb/client test src/firebase/__tests__/secretId.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/firebase/secretId.ts apps/client/src/firebase/__tests__/secretId.test.ts
git commit -m "feat(firebase): add secretId generation and SHA-256 hashing"
```

---

## Task 3: Session Code Utility

**Files:**

- Create: `apps/client/src/firebase/sessionCode.ts`
- Create: `apps/client/src/firebase/__tests__/sessionCode.test.ts`

Session codes are generated client-side (moved from `apps/server/src/utils/sessionCode.ts`).

- [ ] **Step 1: Write failing tests**

Create `apps/client/src/firebase/__tests__/sessionCode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateSessionCode } from '../sessionCode.js';

describe('generateSessionCode', () => {
  it('returns adjective-noun-number format', () => {
    const code = generateSessionCode();
    expect(code).toMatch(/^[a-z]+-[a-z]+-\d+$/);
  });

  it('number is between 1 and 99', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateSessionCode();
      const parts = code.split('-');
      const num = parseInt(parts[2], 10);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(99);
    }
  });

  it('generates unique codes (probabilistic)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateSessionCode()));
    expect(codes.size).toBeGreaterThan(40);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @dabb/client test src/firebase/__tests__/sessionCode.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement sessionCode.ts**

Create `apps/client/src/firebase/sessionCode.ts`:

```typescript
const ADJECTIVES = [
  'schnell',
  'langsam',
  'gross',
  'klein',
  'wild',
  'zahm',
  'hell',
  'dunkel',
  'alt',
  'jung',
  'neu',
  'frisch',
  'warm',
  'kalt',
  'weich',
  'hart',
  'blau',
  'rot',
  'gruen',
  'gelb',
  'schwarz',
  'weiss',
  'braun',
  'grau',
  'stark',
  'sanft',
  'klug',
  'schlau',
  'mutig',
  'stolz',
  'flink',
  'ruhig',
  'froh',
  'lustig',
  'still',
  'laut',
  'leicht',
  'schwer',
  'hoch',
  'tief',
  'lang',
  'kurz',
  'breit',
  'schmal',
  'dick',
  'duenn',
  'reich',
  'arm',
];

const NOUNS = [
  'fuchs',
  'baer',
  'wolf',
  'adler',
  'hase',
  'hirsch',
  'dachs',
  'igel',
  'rabe',
  'eule',
  'falke',
  'specht',
  'fisch',
  'frosch',
  'otter',
  'biber',
  'berg',
  'tal',
  'wald',
  'see',
  'fluss',
  'bach',
  'wiese',
  'feld',
  'stein',
  'fels',
  'baum',
  'blatt',
  'blume',
  'gras',
  'moos',
  'pilz',
  'stern',
  'mond',
  'sonne',
  'wind',
  'regen',
  'schnee',
  'nebel',
  'wolke',
  'turm',
  'burg',
  'haus',
  'hof',
  'dorf',
  'stadt',
  'tor',
  'weg',
];

function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateSessionCode(): string {
  const adjective = randomItem(ADJECTIVES);
  const noun = randomItem(NOUNS);
  const number = Math.floor(Math.random() * 99) + 1;
  return `${adjective}-${noun}-${number}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @dabb/client test src/firebase/__tests__/sessionCode.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/firebase/sessionCode.ts apps/client/src/firebase/__tests__/sessionCode.test.ts
git commit -m "feat(firebase): add client-side session code generator"
```

---

## Task 4: Firebase Session Management

**Files:**

- Create: `apps/client/src/firebase/session.ts`

Replaces `apps/client/src/utils/api.ts`. All operations write to/read from Firebase instead of hitting the REST API.

- [ ] **Step 1: Create session.ts**

Create `apps/client/src/firebase/session.ts`:

```typescript
import { ref, get, set, update, onDisconnect, onValue, off } from 'firebase/database';
import { db } from './config.js';
import { generateSessionCode } from './sessionCode.js';
import { getOrCreateSecretId, hashSecretId } from './secretId.js';
import type { PlayerCount, PlayerIndex } from '@dabb/shared-types';

export interface SessionPlayer {
  nickname: string;
  secretHash: string | null;
  isAI: boolean;
}

export interface SessionMeta {
  playerCount: PlayerCount;
  targetScore: number;
  status: 'waiting' | 'active' | 'finished' | 'terminated';
  createdAt: number;
  players: Record<string, SessionPlayer>;
}

export interface CreateSessionResult {
  sessionCode: string;
  secretId: string;
  playerIndex: PlayerIndex;
}

export interface JoinSessionResult {
  secretId: string;
  playerIndex: PlayerIndex;
}

export async function createSession(
  nickname: string,
  playerCount: PlayerCount,
  targetScore = 1000
): Promise<CreateSessionResult> {
  const sessionCode = generateSessionCode();
  const secretId = await getOrCreateSecretId(sessionCode);
  const secretHash = await hashSecretId(secretId);

  const meta: SessionMeta = {
    playerCount,
    targetScore,
    status: 'waiting',
    createdAt: Date.now(),
    players: {
      '0': { nickname, secretHash, isAI: false },
    },
  };

  await set(ref(db, `sessions/${sessionCode}/meta`), meta);

  return { sessionCode, secretId, playerIndex: 0 as PlayerIndex };
}

export async function joinSession(
  sessionCode: string,
  nickname: string
): Promise<JoinSessionResult> {
  const code = sessionCode.trim().toLowerCase();
  const metaRef = ref(db, `sessions/${code}/meta`);
  const snapshot = await get(metaRef);

  if (!snapshot.exists()) {
    throw new Error('SESSION_NOT_FOUND');
  }

  const meta = snapshot.val() as SessionMeta;

  if (meta.status !== 'waiting') {
    throw new Error('GAME_STARTED');
  }

  const takenSlots = Object.keys(meta.players).map(Number);
  let playerIndex: PlayerIndex | null = null;
  for (let i = 0; i < meta.playerCount; i++) {
    if (!takenSlots.includes(i)) {
      playerIndex = i as PlayerIndex;
      break;
    }
  }

  if (playerIndex === null) {
    throw new Error('SESSION_FULL');
  }

  const secretId = await getOrCreateSecretId(code);
  const secretHash = await hashSecretId(secretId);

  await set(ref(db, `sessions/${code}/meta/players/${playerIndex}`), {
    nickname,
    secretHash,
    isAI: false,
  });

  return { secretId, playerIndex };
}

export async function addAIPlayer(
  sessionCode: string,
  players: Record<string, SessionPlayer>,
  playerCount: PlayerCount,
  aiNickname: string
): Promise<PlayerIndex> {
  const takenSlots = Object.keys(players).map(Number);
  let playerIndex: PlayerIndex | null = null;
  for (let i = 0; i < playerCount; i++) {
    if (!takenSlots.includes(i)) {
      playerIndex = i as PlayerIndex;
      break;
    }
  }
  if (playerIndex === null) throw new Error('SESSION_FULL');

  await set(ref(db, `sessions/${sessionCode}/meta/players/${playerIndex}`), {
    nickname: aiNickname,
    secretHash: null,
    isAI: true,
  });

  return playerIndex;
}

export async function removeAIPlayer(sessionCode: string, playerIndex: PlayerIndex): Promise<void> {
  await set(ref(db, `sessions/${sessionCode}/meta/players/${playerIndex}`), null);
}

export async function getSessionMeta(sessionCode: string): Promise<SessionMeta | null> {
  const snapshot = await get(ref(db, `sessions/${sessionCode}/meta`));
  if (!snapshot.exists()) return null;
  return snapshot.val() as SessionMeta;
}

export async function setSessionStatus(
  sessionCode: string,
  status: SessionMeta['status']
): Promise<void> {
  await update(ref(db, `sessions/${sessionCode}/meta`), { status });
}

export function setupPresence(sessionCode: string, playerIndex: PlayerIndex): () => void {
  const presenceRef = ref(db, `sessions/${sessionCode}/presence/${playerIndex}`);
  const connectedRef = ref(db, '.info/connected');

  const handler = onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      void set(presenceRef, { connected: true, lastSeen: Date.now() });
      onDisconnect(presenceRef).set({ connected: false, lastSeen: Date.now() });
    }
  });

  return () => {
    off(connectedRef, 'value', handler);
    void set(presenceRef, { connected: false, lastSeen: Date.now() });
  };
}

export function subscribeToPlayers(
  sessionCode: string,
  callback: (players: Record<string, SessionPlayer>) => void
): () => void {
  const playersRef = ref(db, `sessions/${sessionCode}/meta/players`);
  const handler = onValue(playersRef, (snap) => {
    callback((snap.val() as Record<string, SessionPlayer>) ?? {});
  });
  return () => off(playersRef, 'value', handler);
}

export function subscribeToSessionStatus(
  sessionCode: string,
  callback: (status: SessionMeta['status']) => void
): () => void {
  const statusRef = ref(db, `sessions/${sessionCode}/meta/status`);
  const handler = onValue(statusRef, (snap) => {
    if (snap.exists()) callback(snap.val() as SessionMeta['status']);
  });
  return () => off(statusRef, 'value', handler);
}
```

- [ ] **Step 2: Build to verify no type errors**

```bash
pnpm run build
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/firebase/session.ts
git commit -m "feat(firebase): add Firebase session management (create, join, presence)"
```

---

## Task 5: Firebase Event Transport

**Files:**

- Create: `apps/client/src/firebase/events.ts`

Handles pushing events to Firebase and subscribing to the event stream.

- [ ] **Step 1: Create events.ts**

Create `apps/client/src/firebase/events.ts`:

```typescript
import { ref, push, update, onChildAdded, off, get } from 'firebase/database';
import { db } from './config.js';
import type { GameEvent } from '@dabb/shared-types';

export interface StoredEvent extends GameEvent {
  authorHash: string;
}

export async function pushEvents(
  sessionCode: string,
  events: GameEvent[],
  authorHash: string
): Promise<void> {
  if (events.length === 0) return;

  const updates: Record<string, StoredEvent> = {};
  for (const event of events) {
    const newKey = push(ref(db, `sessions/${sessionCode}/events`)).key;
    if (!newKey) throw new Error('Failed to generate Firebase key');
    updates[`sessions/${sessionCode}/events/${newKey}`] = { ...event, authorHash };
  }

  await update(ref(db), updates);
}

export function subscribeToEvents(
  sessionCode: string,
  onEvent: (event: GameEvent) => void
): () => void {
  const eventsRef = ref(db, `sessions/${sessionCode}/events`);

  const handler = onChildAdded(eventsRef, (snap) => {
    const stored = snap.val() as StoredEvent | null;
    if (!stored) return;
    // Strip authorHash before delivering to game logic
    const { authorHash: _a, ...event } = stored;
    onEvent(event as GameEvent);
  });

  return () => off(eventsRef, 'child_added', handler);
}

export async function getAllEvents(sessionCode: string): Promise<GameEvent[]> {
  const snapshot = await get(ref(db, `sessions/${sessionCode}/events`));
  if (!snapshot.exists()) return [];

  const events: GameEvent[] = [];
  snapshot.forEach((child) => {
    const stored = child.val() as StoredEvent;
    const { authorHash: _a, ...event } = stored;
    events.push(event as GameEvent);
  });

  return events.sort((a, b) => a.sequence - b.sequence);
}

export async function claimCascade(
  sessionCode: string,
  claimKey: string,
  claimerHash: string
): Promise<boolean> {
  const claimRef = ref(db, `sessions/${sessionCode}/aiClaims/${claimKey}`);
  const existing = await get(claimRef);

  if (existing.exists()) {
    const data = existing.val() as { claimedBy: string; claimedAt: number };
    const isExpired = Date.now() - data.claimedAt > 10_000;
    if (!isExpired) return false;
  }

  await update(claimRef, { claimedBy: claimerHash, claimedAt: Date.now() });

  // Re-read to verify we won the claim (handle race between check and write)
  const confirm = await get(claimRef);
  const winner = (confirm.val() as { claimedBy: string }).claimedBy;
  return winner === claimerHash;
}
```

- [ ] **Step 2: Build to verify no type errors**

```bash
pnpm run build
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/firebase/events.ts
git commit -m "feat(firebase): add event push/subscribe and cascade claim helpers"
```

---

## Task 6: Game Event Factory

**Files:**

- Create: `apps/client/src/firebase/gameEventFactory.ts`
- Create: `apps/client/src/firebase/__tests__/gameEventFactory.test.ts`

Ports `apps/server/src/services/gameService.ts` logic to the client. Uses existing `@dabb/game-logic` functions to create event arrays from player actions. All cascade events (TRICK_WON, BIDDING_WON, ROUND_SCORED, etc.) are computed here.

- [ ] **Step 1: Write failing tests**

Create `apps/client/src/firebase/__tests__/gameEventFactory.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { applyEvents, createInitialState } from '@dabb/game-logic';
import {
  createStartGameEvents,
  createBidPlacedEvents,
  createPlayerPassedEvents,
  createPlayCardEvents,
  SeqGen,
} from '../gameEventFactory.js';
import type { PlayerInfo } from '../gameEventFactory.js';

const SESSION = 'test-session';
const makeSeqGen = (start = 0): SeqGen => {
  let n = start;
  return () => ++n;
};

const PLAYERS_3: PlayerInfo[] = [
  { playerIndex: 0, nickname: 'Alice', isAI: false, team: null },
  { playerIndex: 1, nickname: 'Bob', isAI: false, team: null },
  { playerIndex: 2, nickname: 'Charlie', isAI: false, team: null },
];

describe('createStartGameEvents', () => {
  it('emits PLAYER_JOINED × 3 + GAME_STARTED + CARDS_DEALT for 3 players', () => {
    const events = createStartGameEvents(SESSION, makeSeqGen(), PLAYERS_3, 3, 1000);
    const types = events.map((e) => e.type);
    expect(types).toEqual([
      'PLAYER_JOINED',
      'PLAYER_JOINED',
      'PLAYER_JOINED',
      'GAME_STARTED',
      'CARDS_DEALT',
    ]);
  });

  it('resulting state has phase "bidding"', () => {
    const events = createStartGameEvents(SESSION, makeSeqGen(), PLAYERS_3, 3, 1000);
    const state = applyEvents(events);
    expect(state.phase).toBe('bidding');
  });
});

describe('createBidPlacedEvents', () => {
  it('returns single BID_PLACED event', () => {
    const startEvents = createStartGameEvents(SESSION, makeSeqGen(), PLAYERS_3, 3, 1000);
    const state = applyEvents(startEvents);
    const bidEvents = createBidPlacedEvents(SESSION, makeSeqGen(startEvents.length), state, 0, 160);
    expect(bidEvents).toHaveLength(1);
    expect(bidEvents[0].type).toBe('BID_PLACED');
  });

  it('throws if not current bidder', () => {
    const startEvents = createStartGameEvents(SESSION, makeSeqGen(), PLAYERS_3, 3, 1000);
    const state = applyEvents(startEvents);
    expect(() =>
      createBidPlacedEvents(SESSION, makeSeqGen(startEvents.length), state, 1, 160)
    ).toThrow();
  });
});

describe('createPlayerPassedEvents', () => {
  it('includes BIDDING_WON when last two players pass', () => {
    // Player 0 bids first, then 1 and 2 pass — bidding complete
    let events = createStartGameEvents(SESSION, makeSeqGen(), PLAYERS_3, 3, 1000);
    let seq = makeSeqGen(events.length);
    let state = applyEvents(events);

    events = [...events, ...createBidPlacedEvents(SESSION, seq, state, 0, 150)];
    state = applyEvents(events);
    events = [...events, ...createPlayerPassedEvents(SESSION, seq, state, 1)];
    state = applyEvents(events);
    events = [...events, ...createPlayerPassedEvents(SESSION, seq, state, 2)];

    const types = events.map((e) => e.type);
    expect(types).toContain('BIDDING_WON');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @dabb/client test src/firebase/__tests__/gameEventFactory.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement gameEventFactory.ts**

Create `apps/client/src/firebase/gameEventFactory.ts`:

```typescript
import {
  applyEvent,
  calculateMeldPoints,
  calculatePlayerTrickRawPoints,
  calculateTrickPoints,
  canPass,
  createBidPlacedEvent,
  createBiddingWonEvent,
  createCardPlayedEvent,
  createCardsDealtEvent,
  createCardsDiscardedEvent,
  createDabbTakenEvent,
  createDeck,
  createGameFinishedEvent,
  createGameStartedEvent,
  createGameTerminatedEvent,
  createGoingOutEvent,
  createMeldingCompleteEvent,
  createMeldsDeclaredEvent,
  createNewRoundStartedEvent,
  createPlayerJoinedEvent,
  createPlayerPassedEvent,
  createRoundScoredEvent,
  createTrickWonEvent,
  createTrumpDeclaredEvent,
  dealCards,
  determineTrickWinner,
  getBiddingWinner,
  isBiddingComplete,
  isValidBid,
  isValidPlay,
  shuffleDeck,
} from '@dabb/game-logic';
import type {
  Card,
  CardId,
  GameEvent,
  GameState,
  Meld,
  PlayerCount,
  PlayerIndex,
  Suit,
  Team,
} from '@dabb/shared-types';
import { DABB_SIZE, GameError, SERVER_ERROR_CODES } from '@dabb/shared-types';

export type SeqGen = () => number;

export interface PlayerInfo {
  playerIndex: PlayerIndex;
  nickname: string;
  isAI: boolean;
  team: Team | null;
}

function ctx(sessionId: string, seq: SeqGen) {
  return { sessionId, sequence: seq() };
}

export function createStartGameEvents(
  sessionCode: string,
  seq: SeqGen,
  players: PlayerInfo[],
  playerCount: PlayerCount,
  targetScore: number
): GameEvent[] {
  const events: GameEvent[] = [];

  // Assign teams for 4-player games
  let teamMap: Map<PlayerIndex, Team> | null = null;
  if (playerCount === 4) {
    const shuffled = [...players];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    teamMap = new Map();
    shuffled.forEach((p, i) => teamMap!.set(p.playerIndex, (i < 2 ? 0 : 1) as Team));
  }

  for (const player of players) {
    const team = teamMap ? (teamMap.get(player.playerIndex) ?? null) : player.team;
    events.push(
      createPlayerJoinedEvent(
        ctx(sessionCode, seq),
        `player-${player.playerIndex}`,
        player.playerIndex,
        player.nickname,
        team
      )
    );
  }

  events.push(createGameStartedEvent(ctx(sessionCode, seq), playerCount, targetScore, 0));

  const deck = shuffleDeck(createDeck());
  const { hands, dabb } = dealCards(deck, playerCount);
  const handsRecord = {} as Record<PlayerIndex, Card[]>;
  hands.forEach((cards, idx) => {
    handsRecord[idx as PlayerIndex] = cards;
  });
  events.push(createCardsDealtEvent(ctx(sessionCode, seq), handsRecord, dabb));

  return events;
}

export function createBidPlacedEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex,
  amount: number
): GameEvent[] {
  if (state.phase !== 'bidding') throw new GameError(SERVER_ERROR_CODES.NOT_IN_BIDDING_PHASE);
  if (state.currentBidder !== playerIndex)
    throw new GameError(SERVER_ERROR_CODES.NOT_YOUR_TURN_TO_BID);
  if (!isValidBid(amount, state.currentBid))
    throw new GameError(SERVER_ERROR_CODES.INVALID_BID_AMOUNT);
  return [createBidPlacedEvent(ctx(sessionCode, seq), playerIndex, amount)];
}

export function createPlayerPassedEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex
): GameEvent[] {
  if (state.phase !== 'bidding') throw new GameError(SERVER_ERROR_CODES.NOT_IN_BIDDING_PHASE);
  if (state.currentBidder !== playerIndex) throw new GameError(SERVER_ERROR_CODES.NOT_YOUR_TURN);
  if (!canPass(state.currentBid)) throw new GameError(SERVER_ERROR_CODES.FIRST_BIDDER_MUST_BID);

  const events: GameEvent[] = [];
  events.push(createPlayerPassedEvent(ctx(sessionCode, seq), playerIndex));

  const newPassedPlayers = new Set(state.passedPlayers);
  newPassedPlayers.add(playerIndex);

  if (isBiddingComplete(state.playerCount, newPassedPlayers)) {
    const winner = getBiddingWinner(state.playerCount, newPassedPlayers);
    if (winner !== null) {
      events.push(
        createBiddingWonEvent(ctx(sessionCode, seq), winner, state.currentBid || 150, state.dabb)
      );
    }
  }

  return events;
}

export function createTakeDabbEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex
): GameEvent[] {
  if (state.phase !== 'dabb') throw new GameError(SERVER_ERROR_CODES.NOT_IN_DABB_PHASE);
  if (state.bidWinner !== playerIndex)
    throw new GameError(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_TAKE_DABB);
  return [createDabbTakenEvent(ctx(sessionCode, seq), playerIndex, state.dabb)];
}

export function createDiscardCardsEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex,
  cardIds: CardId[]
): GameEvent[] {
  if (state.phase !== 'dabb') throw new GameError(SERVER_ERROR_CODES.NOT_IN_DABB_PHASE);
  if (state.bidWinner !== playerIndex)
    throw new GameError(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_DISCARD);

  const dabbSize = DABB_SIZE[state.playerCount];
  if (cardIds.length !== dabbSize)
    throw new GameError(SERVER_ERROR_CODES.MUST_DISCARD_EXACT_COUNT, { count: dabbSize });

  const hand = state.hands.get(playerIndex) ?? [];
  const handIds = new Set(hand.map((c) => c.id));
  for (const cardId of cardIds) {
    if (!handIds.has(cardId)) throw new GameError(SERVER_ERROR_CODES.CARD_NOT_IN_HAND);
  }

  return [createCardsDiscardedEvent(ctx(sessionCode, seq), playerIndex, cardIds)];
}

export function createGoOutEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex,
  suit: Suit
): GameEvent[] {
  if (state.phase !== 'dabb') throw new GameError(SERVER_ERROR_CODES.NOT_IN_DABB_PHASE);
  if (state.bidWinner !== playerIndex)
    throw new GameError(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_GO_OUT);
  if (state.dabb.length > 0)
    throw new GameError(SERVER_ERROR_CODES.MUST_TAKE_DABB_BEFORE_GOING_OUT);
  return [createGoingOutEvent(ctx(sessionCode, seq), playerIndex, suit)];
}

export function createDeclareTrumpEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex,
  suit: Suit
): GameEvent[] {
  if (state.phase !== 'trump') throw new GameError(SERVER_ERROR_CODES.NOT_IN_TRUMP_PHASE);
  if (state.bidWinner !== playerIndex)
    throw new GameError(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_DECLARE_TRUMP);
  return [createTrumpDeclaredEvent(ctx(sessionCode, seq), playerIndex, suit)];
}

export function createDeclareMeldsEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex,
  melds: Meld[],
  players: PlayerInfo[]
): GameEvent[] {
  if (state.phase !== 'melding') throw new GameError(SERVER_ERROR_CODES.NOT_IN_MELDING_PHASE);
  if (state.wentOut && playerIndex === state.bidWinner)
    throw new GameError(SERVER_ERROR_CODES.CANNOT_MELD_WHEN_GOING_OUT);
  if (state.declaredMelds.has(playerIndex))
    throw new GameError(SERVER_ERROR_CODES.ALREADY_DECLARED_MELDS);

  const events: GameEvent[] = [];
  const totalPoints = calculateMeldPoints(melds);
  events.push(createMeldsDeclaredEvent(ctx(sessionCode, seq), playerIndex, melds, totalPoints));

  const expectedMeldCount = state.wentOut ? state.playerCount - 1 : state.playerCount;
  const declaredCount = state.declaredMelds.size + 1;

  if (declaredCount === expectedMeldCount) {
    const meldScores = {} as Record<PlayerIndex, number>;
    state.declaredMelds.forEach((m, idx) => {
      meldScores[idx] = calculateMeldPoints(m);
    });
    meldScores[playerIndex] = totalPoints;

    if (state.wentOut) {
      const bidWinner = state.bidWinner!;
      meldScores[bidWinner] = 0;
      events.push(createMeldingCompleteEvent(ctx(sessionCode, seq), meldScores));

      const cascadeEvents = createGoingOutScoreEvents(sessionCode, seq, state, meldScores, players);
      events.push(...cascadeEvents);
    } else {
      events.push(createMeldingCompleteEvent(ctx(sessionCode, seq), meldScores));
    }
  }

  return events;
}

export function createPlayCardEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex,
  cardId: CardId,
  players: PlayerInfo[]
): GameEvent[] {
  if (state.phase !== 'tricks') throw new GameError(SERVER_ERROR_CODES.NOT_IN_TRICKS_PHASE);
  if (state.currentPlayer !== playerIndex) throw new GameError(SERVER_ERROR_CODES.NOT_YOUR_TURN);

  const hand = state.hands.get(playerIndex) ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) throw new GameError(SERVER_ERROR_CODES.CARD_NOT_IN_HAND);
  if (!isValidPlay(card, hand, state.currentTrick, state.trump!)) {
    throw new GameError(SERVER_ERROR_CODES.INVALID_PLAY);
  }

  const events: GameEvent[] = [];
  events.push(createCardPlayedEvent(ctx(sessionCode, seq), playerIndex, card));

  if (state.currentTrick.cards.length + 1 === state.playerCount) {
    const newTrick = {
      cards: [...state.currentTrick.cards, { cardId: card.id, card, playerIndex }],
      leadSuit: state.currentTrick.leadSuit || card.suit,
      winnerIndex: null,
    };

    const winnerIdx = determineTrickWinner(newTrick, state.trump!);
    const winnerPlayerIndex = newTrick.cards[winnerIdx].playerIndex;
    const trickCards = newTrick.cards.map((pc) => pc.card);
    const points = calculateTrickPoints(trickCards);
    events.push(createTrickWonEvent(ctx(sessionCode, seq), winnerPlayerIndex, trickCards, points));

    const remainingCards = (state.hands.get(playerIndex)?.length ?? 0) - 1;
    if (remainingCards === 0) {
      let scoringState = state;
      for (const event of events) {
        scoringState = applyEvent(scoringState, event);
      }
      const roundEvents = createRoundEndEvents(sessionCode, seq, scoringState, players);
      events.push(...roundEvents);
    }
  }

  return events;
}

export function createTerminateGameEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  playerIndex: PlayerIndex
): GameEvent[] {
  const activePhases = ['dealing', 'bidding', 'dabb', 'trump', 'melding', 'tricks', 'scoring'];
  if (!activePhases.includes(state.phase)) {
    throw new GameError(SERVER_ERROR_CODES.CANNOT_TERMINATE_IN_CURRENT_PHASE);
  }
  return [createGameTerminatedEvent(ctx(sessionCode, seq), playerIndex)];
}

// --- Internal helpers ---

function getPlayerTeam(players: PlayerInfo[], playerIndex: PlayerIndex): Team {
  return players.find((p) => p.playerIndex === playerIndex)!.team!;
}

function getTeamPlayerIndices(players: PlayerInfo[], team: Team): PlayerIndex[] {
  return players.filter((p) => p.team === team).map((p) => p.playerIndex);
}

function createRoundEndEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  players: PlayerInfo[]
): GameEvent[] {
  const events: GameEvent[] = [];
  const bidWinner = state.bidWinner!;
  const winningBid = state.currentBid || 150;

  const scores = {} as Record<
    PlayerIndex | Team,
    { melds: number; tricks: number; total: number; bidMet: boolean }
  >;
  const totalScores = {} as Record<PlayerIndex | Team, number>;

  if (state.playerCount === 4) {
    const playerMelds = new Map<PlayerIndex, number>();
    const playerTricks = new Map<PlayerIndex, number>();
    for (let i = 0; i < 4; i++) {
      const idx = i as PlayerIndex;
      const melds = calculateMeldPoints(state.declaredMelds.get(idx) ?? []);
      const tricksRaw = calculatePlayerTrickRawPoints(
        idx,
        state.tricksTaken,
        state.lastCompletedTrick?.winnerIndex ?? null
      );
      playerMelds.set(idx, melds);
      playerTricks.set(idx, Math.round(tricksRaw / 10) * 10);
    }

    const bidWinnerTeam = getPlayerTeam(players, bidWinner);
    for (const team of [0, 1] as Team[]) {
      const indices = getTeamPlayerIndices(players, team);
      const teamMelds = indices.reduce((s, idx) => s + playerMelds.get(idx)!, 0);
      const teamTricks = indices.reduce((s, idx) => s + playerTricks.get(idx)!, 0);
      const rawTotal = teamMelds + teamTricks;
      const isBidWinnerTeam = team === bidWinnerTeam;
      const bidMet = !isBidWinnerTeam || rawTotal >= winningBid;
      const total = isBidWinnerTeam && !bidMet ? -2 * winningBid : rawTotal;
      scores[team] = { melds: teamMelds, tricks: teamTricks, total, bidMet };
    }

    for (const team of [0, 1] as Team[]) {
      const prev = state.totalScores.get(team) ?? 0;
      totalScores[team] = prev + scores[team].total;
    }
  } else {
    for (let i = 0; i < state.playerCount; i++) {
      const idx = i as PlayerIndex;
      const melds = calculateMeldPoints(state.declaredMelds.get(idx) ?? []);
      const tricksRaw = calculatePlayerTrickRawPoints(
        idx,
        state.tricksTaken,
        state.lastCompletedTrick?.winnerIndex ?? null
      );
      const tricks = Math.round(tricksRaw / 10) * 10;
      const rawTotal = melds + tricks;
      const isBidWinner = idx === bidWinner;
      const bidMet = !isBidWinner || rawTotal >= winningBid;
      const total = isBidWinner && !bidMet ? -2 * winningBid : rawTotal;
      scores[idx] = { melds, tricks, total, bidMet };
    }

    for (let i = 0; i < state.playerCount; i++) {
      const idx = i as PlayerIndex;
      totalScores[idx] = (state.totalScores.get(idx) ?? 0) + scores[idx].total;
    }
  }

  events.push(createRoundScoredEvent(ctx(sessionCode, seq), scores, totalScores));

  const targetScore = state.targetScore;
  let winner: PlayerIndex | Team | null = null;
  let highestScore = 0;

  if (state.playerCount === 4) {
    for (const team of [0, 1] as Team[]) {
      if (totalScores[team] >= targetScore && totalScores[team] > highestScore) {
        winner = team;
        highestScore = totalScores[team];
      }
    }
  } else {
    for (let i = 0; i < state.playerCount; i++) {
      const idx = i as PlayerIndex;
      if (totalScores[idx] >= targetScore && totalScores[idx] > highestScore) {
        winner = idx;
        highestScore = totalScores[idx];
      }
    }
  }

  if (winner !== null) {
    events.push(createGameFinishedEvent(ctx(sessionCode, seq), winner, totalScores));
  } else {
    const newDealer = ((state.dealer + 1) % state.playerCount) as PlayerIndex;
    events.push(createNewRoundStartedEvent(ctx(sessionCode, seq), state.round + 1, newDealer));
    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, state.playerCount);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, idx) => {
      handsRecord[idx as PlayerIndex] = cards;
    });
    events.push(createCardsDealtEvent(ctx(sessionCode, seq), handsRecord, dabb));
  }

  return events;
}

function createGoingOutScoreEvents(
  sessionCode: string,
  seq: SeqGen,
  state: GameState,
  meldScores: Record<PlayerIndex, number>,
  players: PlayerInfo[]
): GameEvent[] {
  const events: GameEvent[] = [];
  const bidWinner = state.bidWinner!;
  const winningBid = state.currentBid || 150;
  const goingOutBonus = 40;

  const scores = {} as Record<
    PlayerIndex | Team,
    { melds: number; tricks: number; total: number; bidMet: boolean }
  >;
  const totalScores = {} as Record<PlayerIndex | Team, number>;

  if (state.playerCount === 4) {
    const bidWinnerTeam = getPlayerTeam(players, bidWinner);
    const opponentTeam = (1 - bidWinnerTeam) as Team;
    scores[bidWinnerTeam] = { melds: 0, tricks: 0, total: -winningBid, bidMet: false };

    const opponentIndices = getTeamPlayerIndices(players, opponentTeam);
    const opponentMelds = opponentIndices.reduce((s, idx) => s + (meldScores[idx] ?? 0), 0);
    scores[opponentTeam] = {
      melds: opponentMelds,
      tricks: 0,
      total: opponentMelds + goingOutBonus,
      bidMet: true,
    };

    for (const team of [0, 1] as Team[]) {
      totalScores[team] = (state.totalScores.get(team) ?? 0) + scores[team].total;
    }
  } else {
    for (let i = 0; i < state.playerCount; i++) {
      const idx = i as PlayerIndex;
      if (idx === bidWinner) {
        scores[idx] = { melds: 0, tricks: 0, total: -winningBid, bidMet: false };
      } else {
        const m = meldScores[idx] ?? 0;
        scores[idx] = { melds: m, tricks: 0, total: m + goingOutBonus, bidMet: true };
      }
      totalScores[idx] = (state.totalScores.get(idx) ?? 0) + scores[idx].total;
    }
  }

  events.push(createRoundScoredEvent(ctx(sessionCode, seq), scores, totalScores));

  const targetScore = state.targetScore;
  let winner: PlayerIndex | Team | null = null;
  let highestScore = 0;

  if (state.playerCount === 4) {
    for (const team of [0, 1] as Team[]) {
      if (totalScores[team] >= targetScore && totalScores[team] > highestScore) {
        winner = team;
        highestScore = totalScores[team];
      }
    }
  } else {
    for (let i = 0; i < state.playerCount; i++) {
      const idx = i as PlayerIndex;
      if (totalScores[idx] >= targetScore && totalScores[idx] > highestScore) {
        winner = idx;
        highestScore = totalScores[idx];
      }
    }
  }

  if (winner !== null) {
    events.push(createGameFinishedEvent(ctx(sessionCode, seq), winner, totalScores));
  } else {
    const newDealer = ((state.dealer + 1) % state.playerCount) as PlayerIndex;
    events.push(createNewRoundStartedEvent(ctx(sessionCode, seq), state.round + 1, newDealer));
    const deck = shuffleDeck(createDeck());
    const { hands, dabb } = dealCards(deck, state.playerCount);
    const handsRecord = {} as Record<PlayerIndex, Card[]>;
    hands.forEach((cards, idx) => {
      handsRecord[idx as PlayerIndex] = cards;
    });
    events.push(createCardsDealtEvent(ctx(sessionCode, seq), handsRecord, dabb));
  }

  return events;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @dabb/client test src/firebase/__tests__/gameEventFactory.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/firebase/gameEventFactory.ts apps/client/src/firebase/__tests__/gameEventFactory.test.ts
git commit -m "feat(firebase): add game event factory (port of server gameService)"
```

---

## Task 7: useFirebaseGame Hook

**Files:**

- Create: `apps/client/src/hooks/useFirebaseGame.ts`
- Modify: `apps/client/src/hooks/useGame.ts`

Replaces `useGame` + `useSocket`. Uses Firebase subscriptions instead of Socket.IO. Maintains both full (unfiltered) state for cascade computation and filtered state for display.

- [ ] **Step 1: Create useFirebaseGame.ts**

Create `apps/client/src/hooks/useFirebaseGame.ts`:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameState } from '@dabb/ui-shared';
import type { GameInterface } from '@dabb/ui-shared';
import { applyEvents, filterEventsForPlayer } from '@dabb/game-logic';
import type { CardId, GameEvent, GameState, Meld, PlayerIndex, Suit } from '@dabb/shared-types';
import { GameError } from '@dabb/shared-types';
import { subscribeToEvents, pushEvents, getAllEvents } from '../firebase/events.js';
import { getOrCreateSecretId, hashSecretId } from '../firebase/secretId.js';
import { getSessionMeta, setupPresence, subscribeToSessionStatus } from '../firebase/session.js';
import type { PlayerInfo } from '../firebase/gameEventFactory.js';
import {
  createBidPlacedEvents,
  createDeclareMeldsEvents,
  createDeclareTrumpEvents,
  createDiscardCardsEvents,
  createGoOutEvents,
  createPlayCardEvents,
  createPlayerPassedEvents,
  createTakeDabbEvents,
  createTerminateGameEvents,
} from '../firebase/gameEventFactory.js';

export interface UseFirebaseGameOptions {
  sessionCode: string;
  secretId: string;
  playerIndex: PlayerIndex;
}

export function useFirebaseGame({
  sessionCode,
  secretId,
  playerIndex,
}: UseFirebaseGameOptions): GameInterface {
  const [nicknames, setNicknames] = useState<Map<PlayerIndex, string>>(new Map());
  const [terminatedByNickname, setTerminatedByNickname] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [secretHash, setSecretHash] = useState<string>('');
  const [players, setPlayers] = useState<PlayerInfo[]>([]);

  // Full unfiltered state for cascade computation
  const rawEventsRef = useRef<GameEvent[]>([]);
  const fullStateRef = useRef<GameState>(applyEvents([]));

  const { state, events, isInitialLoad, processEvents } = useGameState({ playerIndex });

  // Load secretHash once
  useEffect(() => {
    void hashSecretId(secretId).then(setSecretHash);
  }, [secretId]);

  // Load player info for team scoring
  useEffect(() => {
    if (!sessionCode) return;
    void getSessionMeta(sessionCode).then((meta) => {
      if (!meta) return;
      const infos: PlayerInfo[] = Object.entries(meta.players).map(([idx, p]) => ({
        playerIndex: Number(idx) as PlayerIndex,
        nickname: p.nickname,
        isAI: p.isAI,
        team: null,
      }));
      setPlayers(infos);
      const nickMap = new Map<PlayerIndex, string>();
      infos.forEach((p) => nickMap.set(p.playerIndex, p.nickname));
      setNicknames(nickMap);
    });
  }, [sessionCode]);

  // Subscribe to session status (terminated)
  useEffect(() => {
    if (!sessionCode) return;
    const unsub = subscribeToSessionStatus(sessionCode, (status) => {
      if (status === 'terminated') {
        setTerminatedByNickname('');
      }
    });
    return unsub;
  }, [sessionCode]);

  // Load existing events on mount, then subscribe to new ones
  useEffect(() => {
    if (!sessionCode || !secretId) return;

    const cleanup = setupPresence(sessionCode, playerIndex);
    setConnected(true);

    void getAllEvents(sessionCode).then((existingEvents) => {
      rawEventsRef.current = existingEvents;
      fullStateRef.current = applyEvents(existingEvents);
      processEvents(existingEvents);
    });

    const unsubEvents = subscribeToEvents(sessionCode, (event) => {
      // Deduplicate — may already have this event from getAllEvents
      const alreadyHave = rawEventsRef.current.some((e) => e.id === event.id);
      if (!alreadyHave) {
        rawEventsRef.current = [...rawEventsRef.current, event].sort(
          (a, b) => a.sequence - b.sequence
        );
        fullStateRef.current = applyEvents(rawEventsRef.current);
        processEvents([event]);
      }

      if (event.type === 'GAME_TERMINATED') {
        const terminatorIndex = (event.payload as { playerIndex: PlayerIndex }).playerIndex;
        const terminatorNick = nicknames.get(terminatorIndex) ?? '';
        setTerminatedByNickname(terminatorNick !== '' ? terminatorNick : null);
      }
    });

    return () => {
      cleanup();
      unsubEvents();
      setConnected(false);
    };
  }, [sessionCode, secretId, playerIndex, processEvents, nicknames]);

  const makeSeq = useCallback((): (() => number) => {
    let n = rawEventsRef.current.length;
    return () => ++n;
  }, []);

  const pushAction = useCallback(
    async (eventFactory: (state: GameState, seq: () => number) => GameEvent[]) => {
      if (!secretHash) return;
      try {
        const evts = eventFactory(fullStateRef.current, makeSeq());
        if (evts.length > 0) {
          await pushEvents(sessionCode, evts, secretHash);
        }
      } catch (err) {
        if (err instanceof GameError) {
          console.warn('Game action rejected:', err.message);
        }
      }
    },
    [secretHash, sessionCode, makeSeq]
  );

  const onBid = useCallback(
    (amount: number) =>
      pushAction((s, seq) => createBidPlacedEvents(sessionCode, seq, s, playerIndex, amount)),
    [pushAction, sessionCode, playerIndex]
  );

  const onPass = useCallback(
    () => pushAction((s, seq) => createPlayerPassedEvents(sessionCode, seq, s, playerIndex)),
    [pushAction, sessionCode, playerIndex]
  );

  const onTakeDabb = useCallback(
    () => pushAction((s, seq) => createTakeDabbEvents(sessionCode, seq, s, playerIndex)),
    [pushAction, sessionCode, playerIndex]
  );

  const onDiscard = useCallback(
    (cardIds: CardId[]) =>
      pushAction((s, seq) => createDiscardCardsEvents(sessionCode, seq, s, playerIndex, cardIds)),
    [pushAction, sessionCode, playerIndex]
  );

  const onGoOut = useCallback(
    (suit: Suit) =>
      pushAction((s, seq) => createGoOutEvents(sessionCode, seq, s, playerIndex, suit)),
    [pushAction, sessionCode, playerIndex]
  );

  const onDeclareTrump = useCallback(
    (suit: Suit) =>
      pushAction((s, seq) => createDeclareTrumpEvents(sessionCode, seq, s, playerIndex, suit)),
    [pushAction, sessionCode, playerIndex]
  );

  const onDeclareMelds = useCallback(
    (melds: Meld[]) =>
      pushAction((s, seq) =>
        createDeclareMeldsEvents(sessionCode, seq, s, playerIndex, melds, players)
      ),
    [pushAction, sessionCode, playerIndex, players]
  );

  const onPlayCard = useCallback(
    (cardId: CardId) =>
      pushAction((s, seq) =>
        createPlayCardEvents(sessionCode, seq, s, playerIndex, cardId, players)
      ),
    [pushAction, sessionCode, playerIndex, players]
  );

  const onExit = useCallback(
    () => pushAction((s, seq) => createTerminateGameEvents(sessionCode, seq, s, playerIndex)),
    [pushAction, sessionCode, playerIndex]
  );

  return {
    state,
    events,
    isInitialLoad,
    nicknames,
    connected,
    terminatedByNickname,
    onBid,
    onPass,
    onTakeDabb,
    onDiscard,
    onGoOut,
    onDeclareTrump,
    onDeclareMelds,
    onPlayCard,
    onExit,
  };
}
```

- [ ] **Step 2: Update useGame.ts to re-export**

Replace the entire contents of `apps/client/src/hooks/useGame.ts` with:

```typescript
export { useFirebaseGame as useGame } from './useFirebaseGame.js';
export type { UseFirebaseGameOptions as UseGameOptions } from './useFirebaseGame.js';
```

- [ ] **Step 3: Build**

```bash
pnpm run build
```

Expected: passes (game routes still use `useGame` which now re-exports `useFirebaseGame`).

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/hooks/useFirebaseGame.ts apps/client/src/hooks/useGame.ts
git commit -m "feat(firebase): add useFirebaseGame hook, replace useGame socket transport"
```

---

## Task 8: AI Hook

**Files:**

- Create: `apps/client/src/hooks/useAI.ts`
- Modify: `apps/client/src/app/game/[code].tsx`
- Modify: `apps/client/src/app/game/[code].native.tsx`

AI players are run by any connected client. Firebase transactions ensure only one client executes each AI turn.

- [ ] **Step 1: Create useAI.ts**

Create `apps/client/src/hooks/useAI.ts`:

```typescript
import { useEffect, useRef } from 'react';
import { applyEvents } from '@dabb/game-logic';
import { selectAction } from '@dabb/game-ai';
import type { GameEvent, GameState, PlayerIndex } from '@dabb/shared-types';
import { pushEvents, claimCascade } from '../firebase/events.js';
import { hashSecretId } from '../firebase/secretId.js';
import {
  createBidPlacedEvents,
  createPlayerPassedEvents,
  createTakeDabbEvents,
  createDiscardCardsEvents,
  createDeclareTrumpEvents,
  createDeclareMeldsEvents,
  createPlayCardEvents,
  SeqGen,
} from '../firebase/gameEventFactory.js';
import type { PlayerInfo } from '../firebase/gameEventFactory.js';

interface UseAIOptions {
  sessionCode: string;
  secretId: string;
  rawEvents: GameEvent[];
  players: PlayerInfo[];
  aiPlayerIndices: PlayerIndex[];
}

export function useAI({
  sessionCode,
  secretId,
  rawEvents,
  players,
  aiPlayerIndices,
}: UseAIOptions): void {
  const processingRef = useRef(false);

  useEffect(() => {
    if (aiPlayerIndices.length === 0) return;
    if (processingRef.current) return;

    const fullState: GameState = applyEvents(rawEvents);
    const currentPlayer = fullState.currentPlayer;
    if (currentPlayer === null || currentPlayer === undefined) return;
    if (!aiPlayerIndices.includes(currentPlayer)) return;

    const claimKey = `player${currentPlayer}_seq${rawEvents.length}`;

    processingRef.current = true;
    void (async () => {
      try {
        const secretHash = await hashSecretId(secretId);
        const won = await claimCascade(sessionCode, claimKey, secretHash);
        if (!won) return;

        const action = selectAction(fullState, currentPlayer);
        if (!action) return;

        const seq: SeqGen = (() => {
          let n = rawEvents.length;
          return () => ++n;
        })();

        let evts: GameEvent[] = [];

        if (action.type === 'bid') {
          evts = createBidPlacedEvents(sessionCode, seq, fullState, currentPlayer, action.amount);
        } else if (action.type === 'pass') {
          evts = createPlayerPassedEvents(sessionCode, seq, fullState, currentPlayer);
        } else if (action.type === 'takeDabb') {
          evts = createTakeDabbEvents(sessionCode, seq, fullState, currentPlayer);
        } else if (action.type === 'discard') {
          evts = createDiscardCardsEvents(
            sessionCode,
            seq,
            fullState,
            currentPlayer,
            action.cardIds
          );
        } else if (action.type === 'declareTrump') {
          evts = createDeclareTrumpEvents(sessionCode, seq, fullState, currentPlayer, action.suit);
        } else if (action.type === 'declareMelds') {
          evts = createDeclareMeldsEvents(
            sessionCode,
            seq,
            fullState,
            currentPlayer,
            action.melds,
            players
          );
        } else if (action.type === 'playCard') {
          evts = createPlayCardEvents(
            sessionCode,
            seq,
            fullState,
            currentPlayer,
            action.cardId,
            players
          );
        }

        if (evts.length > 0) {
          await pushEvents(sessionCode, evts, secretHash);
        }
      } finally {
        processingRef.current = false;
      }
    })();
  }, [rawEvents.length, aiPlayerIndices, sessionCode, secretId, players]);
}
```

- [ ] **Step 2: Update game/[code].tsx to include AI hook**

In `apps/client/src/app/game/[code].tsx`, import `useAI` and the `useFirebaseGame` internal exports:

Replace the existing import of `useGame`:

```typescript
import { useFirebaseGame } from '../../hooks/useFirebaseGame.js';
```

Add before `export default function GameRoute()`:

```typescript
import { useAI } from '../../hooks/useAI.js';
```

Replace the `game` construction in `GameRoute`:

```typescript
const game = useFirebaseGame(
  credentials
    ? { sessionCode: code, secretId: credentials.secretId, playerIndex: credentials.playerIndex }
    : { sessionCode: '', secretId: '', playerIndex: 0 as PlayerIndex }
);

// AI hook: runs AI for any AI players in this session
useAI({
  sessionCode: code ?? '',
  secretId: credentials?.secretId ?? '',
  rawEvents: game.rawEvents ?? [],
  players: game.players ?? [],
  aiPlayerIndices: game.aiPlayerIndices ?? [],
});
```

> Note: `useFirebaseGame` must also expose `rawEvents`, `players`, and `aiPlayerIndices` on its return value. Add these to the hook's return object in `useFirebaseGame.ts`:

In `useFirebaseGame.ts`, change the return to include:

```typescript
return {
  // ... existing fields ...
  rawEvents: rawEventsRef.current,
  players,
  aiPlayerIndices: players.filter((p) => p.isAI).map((p) => p.playerIndex),
};
```

Also update `UseFirebaseGameOptions` to pass `sessionCode` (not `sessionId`):

- In `[code].tsx` and `[code].native.tsx`, change `sessionId: code` → `sessionCode: code` in the `useGame` call.

- [ ] **Step 3: Apply same changes to game/[code].native.tsx**

Mirror the changes from Step 2 in `apps/client/src/app/game/[code].native.tsx`.

- [ ] **Step 4: Build**

```bash
pnpm run build
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/hooks/useAI.ts apps/client/src/app/game/
git commit -m "feat(firebase): add AI hook with Firebase claim-based execution"
```

---

## Task 9: Waiting Room Migration

**Files:**

- Modify: `apps/client/src/app/waiting-room/[code].tsx`
- Modify: `apps/client/src/components/ui/HomeScreen.tsx`
- Delete: `apps/client/src/utils/api.ts`

- [ ] **Step 1: Rewrite waiting-room/[code].tsx**

Replace the contents of `apps/client/src/app/waiting-room/[code].tsx` with:

```typescript
import React, { useState, useCallback, useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '@dabb/i18n';
import WaitingRoomScreen from '../../components/ui/WaitingRoomScreen.js';
import { storageDelete, storageGet } from '../../hooks/useStorage.js';
import type { PlayerIndex, AIDifficulty } from '@dabb/shared-types';
import {
  subscribeToPlayers,
  subscribeToSessionStatus,
  addAIPlayer,
  removeAIPlayer,
  getSessionMeta,
  setupPresence,
} from '../../firebase/session.js';
import { pushEvents } from '../../firebase/events.js';
import { getOrCreateSecretId, hashSecretId } from '../../firebase/secretId.js';
import {
  createStartGameEvents,
  createTerminateGameEvents,
} from '../../firebase/gameEventFactory.js';
import type { PlayerInfo } from '../../firebase/gameEventFactory.js';
import { applyEvents } from '@dabb/game-logic';

type PlayerEntry = {
  nickname: string;
  connected: boolean;
  isAI: boolean;
};

type StoredSession = {
  secretId: string;
  playerIndex: PlayerIndex;
  playerCount?: number;
};

const AI_NAMES = ['Bot Fritz', 'Bot Hilde', 'Bot Klaus', 'Bot Liesel'];
let aiNameIndex = 0;

export default function WaitingRoomRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const [credentials, setCredentials] = useState<StoredSession | null>(null);
  const [players, setPlayers] = useState<Map<PlayerIndex, PlayerEntry>>(new Map());
  const [isAddingAI, setIsAddingAI] = useState(false);
  const [selectedAIDifficulty, setSelectedAIDifficulty] = useState<AIDifficulty>('medium');
  const [sessionPlayerCount, setSessionPlayerCount] = useState(0);
  const [firebasePlayers, setFirebasePlayers] = useState<PlayerInfo[]>([]);

  useEffect(() => {
    if (!code) {
      router.replace('/');
      return;
    }
    void (async () => {
      try {
        const [sessionRaw, storedNickname, meta] = await Promise.all([
          storageGet(`dabb-${code}`),
          storageGet('dabb-nickname'),
          getSessionMeta(code),
        ]);
        if (!sessionRaw || !meta) {
          router.replace('/');
          return;
        }
        const session = JSON.parse(sessionRaw) as StoredSession;
        setCredentials(session);
        setSessionPlayerCount(meta.playerCount);

        setPlayers(
          new Map([
            [session.playerIndex, { nickname: storedNickname ?? '', connected: true, isAI: false }],
          ])
        );
      } catch {
        router.replace('/');
      }
    })();
  }, [code, router]);

  useEffect(() => {
    if (!code || !credentials) return;
    const cleanupPresence = setupPresence(code, credentials.playerIndex);

    const unsubPlayers = subscribeToPlayers(code, (fbPlayers) => {
      const infos: PlayerInfo[] = Object.entries(fbPlayers).map(([idx, p]) => ({
        playerIndex: Number(idx) as PlayerIndex,
        nickname: p.nickname,
        isAI: p.isAI,
        team: null,
      }));
      setFirebasePlayers(infos);

      const newMap = new Map<PlayerIndex, PlayerEntry>();
      infos.forEach((p) => {
        newMap.set(p.playerIndex, { nickname: p.nickname, connected: true, isAI: p.isAI });
      });
      setPlayers(newMap);
    });

    const unsubStatus = subscribeToSessionStatus(code, (status) => {
      if (status === 'active') {
        router.replace({ pathname: '/game/[code]', params: { code } });
      } else if (status === 'terminated') {
        router.replace('/');
      }
    });

    return () => {
      cleanupPresence();
      unsubPlayers();
      unsubStatus();
    };
  }, [code, credentials, router]);

  if (!credentials) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const { playerIndex, playerCount } = credentials;
  const isHost = playerIndex === 0;

  const handleStartGame = async () => {
    if (!code) return;
    try {
      const secretId = await getOrCreateSecretId(code);
      const secretHash = await hashSecretId(secretId);
      const meta = await getSessionMeta(code);
      if (!meta) return;

      let seq = 0;
      const seqGen = () => ++seq;

      const events = createStartGameEvents(
        code,
        seqGen,
        firebasePlayers,
        meta.playerCount,
        meta.targetScore
      );
      await pushEvents(code, events, secretHash);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to start game');
    }
  };

  const handleLeave = async () => {
    if (!code || !credentials) return;
    try {
      const secretId = await getOrCreateSecretId(code);
      const secretHash = await hashSecretId(secretId);
      const meta = await getSessionMeta(code);
      if (meta && meta.status === 'active') {
        const events = applyEvents([]);
        const termEvents = createTerminateGameEvents(code, (() => { let n = 0; return () => ++n; })(), events, playerIndex);
        await pushEvents(code, termEvents, secretHash);
      }
    } catch {
      // Ignore errors on leave
    }
    await storageDelete(`dabb-${code}`);
    router.replace('/');
  };

  const handleAddAI = async () => {
    if (!code || isAddingAI) return;
    setIsAddingAI(true);
    try {
      const meta = await getSessionMeta(code);
      if (!meta) return;
      const aiName = AI_NAMES[aiNameIndex % AI_NAMES.length];
      aiNameIndex++;
      await addAIPlayer(code, meta.players, meta.playerCount, aiName);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to add AI player');
    } finally {
      setIsAddingAI(false);
    }
  };

  const handleRemoveAI = async (playerIdx: PlayerIndex) => {
    if (!code) return;
    try {
      await removeAIPlayer(code, playerIdx);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to remove AI player');
    }
  };

  return (
    <WaitingRoomScreen
      sessionCode={code}
      players={players}
      playerCount={sessionPlayerCount || (playerCount ?? 0)}
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

- [ ] **Step 2: Update HomeScreen.tsx to use Firebase session**

In `apps/client/src/components/ui/HomeScreen.tsx`, replace the import:

```typescript
// Remove:
import { createSession, joinSession } from '../../utils/api.js';
// Add:
import { createSession, joinSession } from '../../firebase/session.js';
```

Update `handleCreate` to use the new `createSession` return shape:

```typescript
const handleCreate = async () => {
  // ... validation unchanged ...
  setLoading(true);
  setError('');
  try {
    const result = await createSession(nickname.trim(), playerCount);
    await storageSet(
      `dabb-${result.sessionCode}`,
      JSON.stringify({
        secretId: result.secretId,
        playerIndex: result.playerIndex,
        playerCount,
      })
    );
    await storageSet('dabb-nickname', nickname.trim());
    router.push({ pathname: '/waiting-room/[code]', params: { code: result.sessionCode } });
  } catch (err) {
    setError(err instanceof Error ? err.message : t('errors.unknownError'));
  } finally {
    setLoading(false);
  }
};
```

Update `handleJoin` to use the new `joinSession` return shape:

```typescript
const handleJoin = async () => {
  // ... validation unchanged ...
  setLoading(true);
  setError('');
  try {
    const result = await joinSession(joinCode.trim(), nickname.trim());
    const code = joinCode.trim().toLowerCase();
    await storageSet(
      `dabb-${code}`,
      JSON.stringify({
        secretId: result.secretId,
        playerIndex: result.playerIndex,
      })
    );
    await storageSet('dabb-nickname', nickname.trim());
    router.push({ pathname: '/waiting-room/[code]', params: { code } });
  } catch (err) {
    setError(err instanceof Error ? err.message : t('errors.unknownError'));
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 3: Delete api.ts**

```bash
rm apps/client/src/utils/api.ts
```

- [ ] **Step 4: Build**

```bash
pnpm run build
```

Expected: passes (no references to the deleted api.ts remain).

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/app/waiting-room/ apps/client/src/components/ui/HomeScreen.tsx
git rm apps/client/src/utils/api.ts
git commit -m "feat(firebase): migrate waiting room and home screen to Firebase"
```

---

## Task 10: Cleanup — Remove Server Dependencies

**Files:**

- Modify: `apps/client/src/app/_layout.tsx`
- Modify: `apps/client/src/constants.ts`
- Modify: `packages/ui-shared/src/index.ts`
- Delete: `packages/ui-shared/src/useSocket.ts`
- Delete: `packages/ui-shared/src/useVersionCheck.ts`

- [ ] **Step 1: Remove useVersionCheck from \_layout.tsx**

Replace the contents of `apps/client/src/app/_layout.tsx` with:

```typescript
import './global.css';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { useFonts, IMFellEnglishSC_400Regular } from '@expo-google-fonts/im-fell-english-sc';
import { Caveat_400Regular, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Lato_400Regular, Lato_700Bold } from '@expo-google-fonts/lato';
import * as SplashScreen from 'expo-splash-screen';
import { I18nProvider } from '@dabb/i18n';
import AppErrorBoundary from '../components/ui/AppErrorBoundary.js';
import { loadSoundPreferences } from '../utils/sounds.js';
import { loadHapticsPreferences } from '../utils/haptics.js';

SplashScreen.preventAutoHideAsync();

if (Platform.OS === 'android') {
  void NavigationBar.setVisibilityAsync('hidden');
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    IMFellEnglishSC_400Regular,
    Caveat_400Regular,
    Caveat_700Bold,
    Lato_400Regular,
    Lato_700Bold,
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

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar hidden />
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

- [ ] **Step 2: Simplify constants.ts**

Replace `apps/client/src/constants.ts` with:

```typescript
import Constants from 'expo-constants';

export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';
```

- [ ] **Step 3: Update ui-shared index.ts — remove useSocket and useVersionCheck**

Replace `packages/ui-shared/src/index.ts` with:

```typescript
export { useGameState } from './useGameState.js';
export { useRoundHistory } from './useRoundHistory.js';
export type { RoundHistoryResult } from './useRoundHistory.js';
export { useGameLog } from './useGameLog.js';
export type { GameLogResult } from './useGameLog.js';
export { useActionRequiredCallback } from './useActionRequired.js';
export { useCelebration } from './useCelebration.js';
export type { CelebrationResult } from './useCelebration.js';
export { useTrickAnimationState } from './useTrickAnimationState.js';
export type { TrickAnimationResult, TrickAnimPhase } from './useTrickAnimationState.js';
export type { GameInterface } from './GameInterface.js';
```

- [ ] **Step 4: Delete obsolete files**

```bash
rm packages/ui-shared/src/useSocket.ts
rm packages/ui-shared/src/useVersionCheck.ts
```

- [ ] **Step 5: Build + test**

```bash
pnpm run build && pnpm test
```

Expected: all pass. The `UpdateRequiredScreen` component still exists but is no longer rendered — it can be deleted in a follow-up if desired.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/app/_layout.tsx apps/client/src/constants.ts packages/ui-shared/src/index.ts
git rm packages/ui-shared/src/useSocket.ts packages/ui-shared/src/useVersionCheck.ts
git commit -m "chore: remove Socket.IO, useVersionCheck, and SERVER_URL"
```

---

## Task 11: CI/CD + Static Hosting

**Files:**

- Create: `apps/client/web/.htaccess`
- Modify: `.github/workflows/ci.yml`
- Delete: `.github/workflows/deploy.yml`
- Create: `.github/workflows/deploy-web.yml`

- [ ] **Step 1: Create .htaccess for SPA routing**

Create `apps/client/web/.htaccess`:

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

- [ ] **Step 2: Remove build-docker jobs from ci.yml**

In `.github/workflows/ci.yml`, delete the entire `build-docker` job (the block starting at `build-docker:` through to the end of its step list). Keep all other jobs (`changes`, `lint-and-typecheck`, `test`, `security-audit`, `bundle-web`, `build-client-apk`) unchanged.

- [ ] **Step 3: Delete deploy.yml**

```bash
rm .github/workflows/deploy.yml
```

- [ ] **Step 4: Create deploy-web.yml**

Create `.github/workflows/deploy-web.yml`:

```yaml
name: Deploy Web

on:
  workflow_run:
    workflows: ['CI']
    branches: [main]
    types: [completed]

jobs:
  deploy-web:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout
        uses: actions/checkout@<PIN-SHA-HERE> # vX.Y.Z

      - name: Setup Node.js
        uses: actions/setup-node@<PIN-SHA-HERE> # vX.Y.Z
        with:
          node-version: '22'

      - name: Setup pnpm
        uses: pnpm/action-setup@<PIN-SHA-HERE> # vX.Y.Z
        with:
          version: '10.33.0'

      - name: Cache pnpm dependencies
        uses: actions/cache@<PIN-SHA-HERE> # vX.Y.Z
        with:
          path: ~/.local/share/pnpm/store/v3
          key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build web client
        run: pnpm --filter @dabb/client build:web
        env:
          EXPO_PUBLIC_FIREBASE_API_KEY: ${{ vars.EXPO_PUBLIC_FIREBASE_API_KEY }}
          EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: ${{ vars.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN }}
          EXPO_PUBLIC_FIREBASE_DATABASE_URL: ${{ vars.EXPO_PUBLIC_FIREBASE_DATABASE_URL }}
          EXPO_PUBLIC_FIREBASE_PROJECT_ID: ${{ vars.EXPO_PUBLIC_FIREBASE_PROJECT_ID }}
          EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: ${{ vars.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET }}
          EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: ${{ vars.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID }}
          EXPO_PUBLIC_FIREBASE_APP_ID: ${{ vars.EXPO_PUBLIC_FIREBASE_APP_ID }}

      - name: Deploy via FTPS
        uses: SamKirkland/FTP-Deploy-Action@<PIN-SHA-HERE> # v4.3.5
        with:
          server: ${{ secrets.SFTP_HOST }}
          username: ${{ secrets.SFTP_USER }}
          password: ${{ secrets.SFTP_PASSWORD }}
          local-dir: apps/client/dist/
          server-dir: ${{ secrets.SFTP_TARGET_DIR }}/
          protocol: ftps
```

> **IMPORTANT:** Before merging, pin all `uses:` to commit SHAs. Use:
>
> ```bash
> git ls-remote https://github.com/actions/checkout.git refs/tags/v4^{}
> git ls-remote https://github.com/SamKirkland/FTP-Deploy-Action.git refs/tags/v4.3.5^{}
> ```
>
> Replace each `<PIN-SHA-HERE>` with the full 40-char SHA and a `# vX.Y.Z` comment.

- [ ] **Step 5: Build to verify CI changes**

```bash
pnpm run build
```

Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add apps/client/web/.htaccess .github/workflows/deploy-web.yml .github/workflows/ci.yml
git rm .github/workflows/deploy.yml
git commit -m "ci: replace Docker deploy with SFTP static deploy to Alfahosting"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement                              | Task                                      |
| --------------------------------------------- | ----------------------------------------- |
| Firebase RTDB replaces Socket.IO + PostgreSQL | Tasks 1–7                                 |
| Full unfiltered events in Firebase            | Task 7 (rawEventsRef)                     |
| Client-side filterEventsForPlayer             | Task 7 (useGameState unchanged)           |
| SecretHash gates event writes                 | Tasks 2, 5                                |
| Session code client-generated                 | Task 3                                    |
| Reconnection via event replay                 | Task 7 (getAllEvents on mount)            |
| AI claim mechanism                            | Task 8 (useAI + claimCascade)             |
| Presence via .onDisconnect                    | Task 4 (setupPresence)                    |
| Atomic cascade event push                     | Tasks 5, 6 (pushEvents multi-path update) |
| .htaccess for SPA routing                     | Task 11                                   |
| CI: remove Docker builds                      | Task 11                                   |
| CI: add SFTP deploy                           | Task 11                                   |

**Gaps found and addressed:**

- `useFirebaseGame` return type must include `rawEvents`, `players`, `aiPlayerIndices` (noted in Task 8 Step 2)
- Session status must be set to `active` after `createStartGameEvents` push — add `setSessionStatus(code, 'active')` call after `pushEvents` in `handleStartGame` in the waiting room (Task 9 Step 1 — the `subscribeToSessionStatus` callback navigates to game when status = 'active', so the status write must happen)
- `useFirebaseGame` passes `sessionCode` not `sessionId` — game routes must use `sessionCode` (Task 8 Step 2)
- Firebase env vars must be in `app.json` `extra` using Expo Constants pattern (Task 1 Step 5)
- GitHub Actions SHAs must be pinned before merging (Task 11 Step 4 reminder)

**Missing from Task 9 — add to handleStartGame in waiting room:**

After `await pushEvents(code, events, secretHash)`, add:

```typescript
const { setSessionStatus } = await import('../../firebase/session.js');
await setSessionStatus(code, 'active');
```

(Or inline the import at the top of the file.)
