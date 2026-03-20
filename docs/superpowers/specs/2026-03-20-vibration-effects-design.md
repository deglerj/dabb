# Vibration Effects — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Add haptic feedback to the Dabb mobile client (Android/iOS) for button presses, card interactions, game events, and turn notifications. Web receives no-op stubs. Haptics have their own independent on/off preference (separate from sound mute), with UI toggle deferred.

---

## Haptic Name → Intensity Mapping

| Trigger                  | `HapticName`        | `expo-haptics` call   |
| ------------------------ | ------------------- | --------------------- |
| Card highlighted in hand | `card-select`       | `impactLight`         |
| Any card played          | `card-play`         | `impactMedium`        |
| Cards dealt              | `card-deal`         | `impactLight`         |
| Bid placed               | `bid-place`         | `impactMedium`        |
| Player passes            | `pass`              | `impactLight`         |
| Trick won                | `trick-win`         | `impactHeavy`         |
| It's the player's turn   | `turn-notification` | `notificationSuccess` |
| Game finished (win)      | `game-win`          | `notificationSuccess` |
| Any button press         | (inline, no name)   | `impactLight`         |

---

## Architecture

### Approach

Mirror the existing `utils/sounds.ts` pattern exactly: a module-level utility with platform-split files (`.ts` for native, `.web.ts` no-op stub), AsyncStorage persistence, and silent failure on errors.

Button-press haptics live in `packages/game-canvas` (where most buttons are) as a `HapticTouchableOpacity` wrapper component, since that package cannot depend on `apps/client`.

### New Files

**`apps/client/src/utils/haptics.ts`** (native)

- Imports `expo-haptics`
- Module-level `let enabled = true`
- AsyncStorage key: `'dabb-haptics-enabled'`
- Exports:
  - `loadHapticsPreferences()` — reads preference from AsyncStorage on app startup
  - `setHapticsEnabled(value: boolean)` — updates module state + persists
  - `isHapticsEnabled()` — returns current state
  - `triggerHaptic(name: HapticName)` — checks `enabled`, calls appropriate `expo-haptics` method, fails silently

**`apps/client/src/utils/haptics.web.ts`** (web stub)

- Same exports, all no-ops

**`apps/client/src/hooks/useTurnHaptic.ts`** (native)

- Mirrors `useTurnNotification.ts`
- Calls `useActionRequiredCallback` with a callback that calls `triggerHaptic('turn-notification')`

**`apps/client/src/hooks/useTurnHaptic.web.ts`** (web stub)

- Same shape as `useTurnNotification.web.ts` — no-op callback

**`packages/game-canvas/src/components/HapticTouchableOpacity.tsx`**

- Wraps `TouchableOpacity`
- On mount: reads `'dabb-haptics-enabled'` from AsyncStorage (defaults to `true`)
- On press: if enabled, calls `Haptics.impactAsync(ImpactFeedbackStyle.Light)` before forwarding `onPress`
- Accepts all `TouchableOpacity` props; drop-in replacement

### Modified Files

| File                                                   | Change                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `apps/client/app/_layout.tsx`                          | Add `loadHapticsPreferences()` call alongside `loadSoundPreferences()`                |
| `apps/client/src/components/ui/GameScreen.tsx`         | Add `triggerHaptic(...)` next to each `playSound(...)` call; add `useTurnHaptic` hook |
| `apps/client/src/components/game/PlayerHand.tsx`       | Add `triggerHaptic('card-select')` next to `playSound('card-select')`                 |
| `packages/game-canvas/src/overlays/BiddingOverlay.tsx` | Replace `TouchableOpacity` → `HapticTouchableOpacity`                                 |
| `packages/game-canvas/src/overlays/TrumpOverlay.tsx`   | Replace `TouchableOpacity` → `HapticTouchableOpacity`                                 |
| `packages/game-canvas/src/overlays/DabbOverlay.tsx`    | Replace `TouchableOpacity` → `HapticTouchableOpacity`                                 |
| `packages/game-canvas/src/overlays/MeldingOverlay.tsx` | Replace `TouchableOpacity` → `HapticTouchableOpacity`                                 |
| `packages/game-canvas/package.json`                    | Add `expo-haptics` as a dependency                                                    |

---

## Preference Handling

- Shared AsyncStorage key: `'dabb-haptics-enabled'`
- `haptics.ts` loads it once at app startup via `loadHapticsPreferences()`
- `HapticTouchableOpacity` reads it once on mount
- Default: `true` (haptics on if no preference stored)
- When a future toggle UI is built: call `setHapticsEnabled(value)` from `haptics.ts` — no other changes needed
- All haptic calls wrapped in `try/catch`, fail silently

---

## Out of Scope

- Toggle UI (deferred to a future settings screen)
- Web haptics (browser API is too limited; no-op stubs are sufficient)
- Haptics in `ui-shared` (no react-native/expo dependencies there)

---

## Testing

No new unit tests — haptics are a pure side-effect with no logic. CI (build + lint + typecheck) verifies correctness. Manual verification on a physical device for the actual feel.
