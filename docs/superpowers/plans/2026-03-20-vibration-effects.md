# Vibration Effects Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add haptic feedback to the Dabb mobile client for button presses, card interactions, game events, and turn notifications.

**Architecture:** A `utils/haptics.ts` module (native) + `utils/haptics.web.ts` (no-op stub) mirrors the existing `sounds.ts` pattern exactly. A `HapticTouchableOpacity` wrapper component in `packages/game-canvas` handles button-press haptics for all overlay buttons. A `useTurnHaptic` hook fires a single haptic pulse when it becomes the player's turn.

**Tech Stack:** `expo-haptics`, `@react-native-async-storage/async-storage` (already installed in client), React Native, Expo SDK 55.

---

## File Map

**New files:**

- `apps/client/src/utils/haptics.ts` — native haptics utility (module-level state, AsyncStorage persistence)
- `apps/client/src/utils/haptics.web.ts` — web no-op stub
- `apps/client/src/hooks/useTurnHaptic.ts` — native turn haptic hook
- `apps/client/src/hooks/useTurnHaptic.web.ts` — web no-op stub
- `packages/game-canvas/src/components/HapticTouchableOpacity.tsx` — always-on button haptic wrapper (native)
- `packages/game-canvas/src/components/HapticTouchableOpacity.web.tsx` — web stub (plain TouchableOpacity, no expo-haptics import)

**Modified files:**

- `apps/client/src/app/_layout.tsx` — add `loadHapticsPreferences()` call
- `apps/client/src/components/ui/GameScreen.tsx` — add game-event haptics + `useTurnHaptic`
- `apps/client/src/components/game/PlayerHand.tsx` — add card-select haptic
- `packages/game-canvas/src/overlays/BiddingOverlay.tsx` — `TouchableOpacity` → `HapticTouchableOpacity`
- `packages/game-canvas/src/overlays/TrumpOverlay.tsx` — `TouchableOpacity` → `HapticTouchableOpacity`
- `packages/game-canvas/src/overlays/DabbOverlay.tsx` — `TouchableOpacity` → `HapticTouchableOpacity`
- `packages/game-canvas/src/overlays/MeldingOverlay.tsx` — `TouchableOpacity` → `HapticTouchableOpacity`
- `packages/game-canvas/package.json` — add `expo-haptics` peer dependency

---

### Task 1: Install expo-haptics and create the haptics utility

**Files:**

- Create: `apps/client/src/utils/haptics.ts`
- Create: `apps/client/src/utils/haptics.web.ts`

- [ ] **Step 1: Install expo-haptics in the client app**

Run from repo root (expo install picks the SDK-55-compatible version):

```bash
pnpm --filter @dabb/client exec expo install expo-haptics
```

Expected: `expo-haptics` appears in `apps/client/package.json` under `dependencies`.

- [ ] **Step 2: Create `apps/client/src/utils/haptics.ts`**

This mirrors `sounds.ts` exactly — module-level state, AsyncStorage persistence, silent failure.

```typescript
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAPTICS_ENABLED_KEY = 'dabb-haptics-enabled';

type HapticName =
  | 'card-select'
  | 'card-play'
  | 'card-deal'
  | 'bid-place'
  | 'pass'
  | 'trick-win'
  | 'turn-notification'
  | 'game-win';

let enabled = true;

export async function loadHapticsPreferences() {
  try {
    const stored = await AsyncStorage.getItem(HAPTICS_ENABLED_KEY);
    enabled = stored !== 'false';
  } catch {
    // Fail silently
  }
}

export async function setHapticsEnabled(value: boolean): Promise<void> {
  enabled = value;
  try {
    await AsyncStorage.setItem(HAPTICS_ENABLED_KEY, String(value));
  } catch {
    // Fail silently
  }
}

export function isHapticsEnabled() {
  return enabled;
}

export function triggerHaptic(name: HapticName) {
  if (!enabled) {
    return;
  }
  try {
    switch (name) {
      case 'card-select':
      case 'card-deal':
      case 'pass':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'card-play':
      case 'bid-place':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'trick-win':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'turn-notification':
      case 'game-win':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
    }
  } catch {
    // Fail silently
  }
}
```

- [ ] **Step 3: Create `apps/client/src/utils/haptics.web.ts`**

Web stub — all exports are no-ops so the module can be imported on web without crashing.

```typescript
type HapticName =
  | 'card-select'
  | 'card-play'
  | 'card-deal'
  | 'bid-place'
  | 'pass'
  | 'trick-win'
  | 'turn-notification'
  | 'game-win';

export async function loadHapticsPreferences(): Promise<void> {}

export async function setHapticsEnabled(_value: boolean): Promise<void> {}

export function isHapticsEnabled() {
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function triggerHaptic(_name: HapticName) {}
```

- [ ] **Step 4: Verify the build passes**

```bash
pnpm run build
```

Expected: no TypeScript errors.

---

### Task 2: Load haptics preference at app startup

**Files:**

- Modify: `apps/client/src/app/_layout.tsx:43-45`

- [ ] **Step 1: Add import and load call to `_layout.tsx`**

Add the import alongside the existing sounds import:

```typescript
import { loadHapticsPreferences } from '../utils/haptics.js';
```

Add the load call in the existing `useEffect` that loads sound preferences (line 43):

```typescript
useEffect(() => {
  void loadSoundPreferences();
  void loadHapticsPreferences();
}, []);
```

- [ ] **Step 2: Verify the build passes**

```bash
pnpm run build
```

Expected: no errors.

---

### Task 3: Create the turn haptic hook

**Files:**

- Create: `apps/client/src/hooks/useTurnHaptic.ts`
- Create: `apps/client/src/hooks/useTurnHaptic.web.ts`

- [ ] **Step 1: Create `apps/client/src/hooks/useTurnHaptic.ts`**

Mirrors `useTurnNotification.ts` — simpler because there's no audio player to initialize.
Note: `useActionRequiredCallback` expects `() => void`. Use `async` on the callback so TypeScript infers the declared return type as `void`, not `Promise<void>`.

```typescript
/**
 * Hook to trigger a haptic pulse when it's the player's turn.
 */
import { useCallback } from 'react';
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';
import { triggerHaptic } from '../utils/haptics.js';

export function useTurnHaptic(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null
): void {
  const triggerTurnHaptic = useCallback(async () => {
    triggerHaptic('turn-notification');
  }, []);

  useActionRequiredCallback(state, currentPlayerIndex, triggerTurnHaptic);
}
```

- [ ] **Step 2: Create `apps/client/src/hooks/useTurnHaptic.web.ts`**

Mirrors `useTurnNotification.web.ts`. Use `async` on the noop for the same typing reason.

```typescript
/**
 * Web stub for useTurnHaptic — haptics are not available on web.
 */
import type { GameState, PlayerIndex } from '@dabb/shared-types';
import { useActionRequiredCallback } from '@dabb/ui-shared';
import { useCallback } from 'react';

export function useTurnHaptic(
  state: GameState | null,
  currentPlayerIndex: PlayerIndex | null
): void {
  const noop = useCallback(async () => {}, []);
  useActionRequiredCallback(state, currentPlayerIndex, noop);
}
```

- [ ] **Step 3: Verify the build passes**

```bash
pnpm run build
```

Expected: no errors.

---

### Task 4: Wire useTurnHaptic into GameScreen

**Files:**

- Modify: `apps/client/src/components/ui/GameScreen.tsx:28-29`

- [ ] **Step 1: Add import**

Add alongside the existing `useTurnNotification` import (line 28):

```typescript
import { useTurnHaptic } from '../../hooks/useTurnHaptic.js';
```

- [ ] **Step 2: Call the hook**

Add directly below the existing `useTurnNotification` call (line 179):

```typescript
useTurnNotification(state, playerIndex);
useTurnHaptic(state, playerIndex);
```

- [ ] **Step 3: Verify the build passes**

```bash
pnpm run build
```

Expected: no errors.

---

### Task 5: Add game-event haptics in GameScreen

**Files:**

- Modify: `apps/client/src/components/ui/GameScreen.tsx:29,189-209`

- [ ] **Step 1: Add triggerHaptic import**

Add alongside the existing `playSound` import (line 29):

```typescript
import { triggerHaptic } from '../../utils/haptics.js';
```

- [ ] **Step 2: Add haptic calls in the event loop**

In the `useEffect` that processes new events (lines 185–210), add a `triggerHaptic` call alongside each `playSound` call:

```typescript
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
```

- [ ] **Step 3: Verify the build passes**

```bash
pnpm run build
```

Expected: no errors.

---

### Task 6: Add card-select haptic in PlayerHand

**Files:**

- Modify: `apps/client/src/components/game/PlayerHand.tsx:12,95-98`

- [ ] **Step 1: Add import**

Add alongside the existing `playSound` import (line 12):

```typescript
import { triggerHaptic } from '../../utils/haptics.js';
```

- [ ] **Step 2: Add haptic call on card tap**

In the `onTap` handler (lines 94–99), add `triggerHaptic` alongside `playSound`:

```typescript
            onTap={
              isTricksPhase && isValid
                ? () => {
                    playSound('card-select');
                    triggerHaptic('card-select');
                    onPlayCard(card.id);
                  }
                : undefined
            }
```

- [ ] **Step 3: Verify the build passes**

```bash
pnpm run build
```

Expected: no errors.

---

### Task 7: Create HapticTouchableOpacity in game-canvas

**Files:**

- Modify: `packages/game-canvas/package.json`
- Create: `packages/game-canvas/src/components/HapticTouchableOpacity.tsx`
- Create: `packages/game-canvas/src/components/HapticTouchableOpacity.web.tsx`

- [ ] **Step 1: Add expo-haptics as peer dependency to game-canvas**

In `packages/game-canvas/package.json`, add to the `peerDependencies` object (alongside `react-native`, etc.):

```json
"expo-haptics": "*"
```

- [ ] **Step 2: Create `packages/game-canvas/src/components/HapticTouchableOpacity.tsx`**

Drop-in replacement for `TouchableOpacity` that fires `impactLight` on every press. No preference check — always-on until a toggle UI passes `hapticsEnabled={false}`.

```typescript
import React from 'react';
import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';
import * as Haptics from 'expo-haptics';

interface HapticTouchableOpacityProps extends TouchableOpacityProps {
  hapticsEnabled?: boolean;
}

export function HapticTouchableOpacity({
  hapticsEnabled = true,
  onPress,
  ...props
}: HapticTouchableOpacityProps) {
  const handlePress: TouchableOpacityProps['onPress'] = (event) => {
    if (hapticsEnabled) {
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Fail silently
      }
    }
    onPress?.(event);
  };

  return <TouchableOpacity onPress={handlePress} {...props} />;
}
```

- [ ] **Step 3: Create `packages/game-canvas/src/components/HapticTouchableOpacity.web.tsx`**

`expo-haptics` does not auto-stub on web in SDK 55 — it throws at runtime. This web stub is a plain `TouchableOpacity` passthrough with no `expo-haptics` import. Metro resolves `.web.tsx` first on web builds.

```typescript
import React from 'react';
import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';

interface HapticTouchableOpacityProps extends TouchableOpacityProps {
  hapticsEnabled?: boolean;
}

export function HapticTouchableOpacity({
  hapticsEnabled: _hapticsEnabled,
  ...props
}: HapticTouchableOpacityProps) {
  return <TouchableOpacity {...props} />;
}
```

- [ ] **Step 4: Verify the build passes**

```bash
pnpm run build
```

Expected: no errors.

---

### Task 8: Replace TouchableOpacity in game-canvas overlays

**Files:**

- Modify: `packages/game-canvas/src/overlays/BiddingOverlay.tsx`
- Modify: `packages/game-canvas/src/overlays/TrumpOverlay.tsx`
- Modify: `packages/game-canvas/src/overlays/DabbOverlay.tsx`
- Modify: `packages/game-canvas/src/overlays/MeldingOverlay.tsx`

- [ ] **Step 1: Update BiddingOverlay.tsx**

Replace the import line:

```typescript
// Before:
import { StyleSheet, Text, TouchableOpacity, ScrollView, View } from 'react-native';
// After:
import { StyleSheet, Text, ScrollView, View } from 'react-native';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
```

Replace all `<TouchableOpacity` with `<HapticTouchableOpacity` and all `</TouchableOpacity>` with `</HapticTouchableOpacity>` in the file.

- [ ] **Step 2: Update TrumpOverlay.tsx**

Replace the import line:

```typescript
// Before:
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// After:
import { StyleSheet, Text, View } from 'react-native';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
```

Replace all `<TouchableOpacity` with `<HapticTouchableOpacity` and all `</TouchableOpacity>` with `</HapticTouchableOpacity>`.

- [ ] **Step 3: Update DabbOverlay.tsx**

Replace the import line:

```typescript
// Before:
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// After:
import { StyleSheet, Text, View } from 'react-native';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
```

Replace all `<TouchableOpacity` with `<HapticTouchableOpacity` and all `</TouchableOpacity>` with `</HapticTouchableOpacity>`.

- [ ] **Step 4: Update MeldingOverlay.tsx**

Replace the import line:

```typescript
// Before:
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
// After:
import { StyleSheet, Text, View } from 'react-native';
import { HapticTouchableOpacity } from '../components/HapticTouchableOpacity.js';
```

Replace all `<TouchableOpacity` with `<HapticTouchableOpacity` and all `</TouchableOpacity>` with `</HapticTouchableOpacity>`.

- [ ] **Step 5: Run full CI check**

```bash
pnpm run build && pnpm test && pnpm lint && pnpm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit everything**

```bash
git add \
  apps/client/src/utils/haptics.ts \
  apps/client/src/utils/haptics.web.ts \
  apps/client/src/hooks/useTurnHaptic.ts \
  apps/client/src/hooks/useTurnHaptic.web.ts \
  apps/client/src/app/_layout.tsx \
  apps/client/src/components/ui/GameScreen.tsx \
  apps/client/src/components/game/PlayerHand.tsx \
  apps/client/package.json \
  packages/game-canvas/src/components/HapticTouchableOpacity.tsx \
  packages/game-canvas/src/components/HapticTouchableOpacity.web.tsx \
  packages/game-canvas/src/overlays/BiddingOverlay.tsx \
  packages/game-canvas/src/overlays/TrumpOverlay.tsx \
  packages/game-canvas/src/overlays/DabbOverlay.tsx \
  packages/game-canvas/src/overlays/MeldingOverlay.tsx \
  packages/game-canvas/package.json \
  pnpm-lock.yaml

git commit -m "feat: add haptic vibration effects for mobile"
```
