# Vibration Effects — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Add haptic feedback to the Dabb mobile client (Android/iOS) for button presses, card interactions, game events, and turn notifications. Web receives no-op stubs. Haptics have their own independent on/off preference (separate from sound mute), with UI toggle deferred.

---

## Haptic Name → Intensity Mapping

`HapticName` is a local union type defined inside `haptics.ts` (same pattern as `SoundName` in `sounds.ts`). It is not exported to `@dabb/shared-types`.

| Trigger                        | `HapticName`        | `expo-haptics` call   |
| ------------------------------ | ------------------- | --------------------- |
| Card highlighted in hand (tap) | `card-select`       | `impactLight`         |
| Any card played                | `card-play`         | `impactMedium`        |
| Cards dealt                    | `card-deal`         | `impactLight`         |
| Bid placed                     | `bid-place`         | `impactMedium`        |
| Player passes                  | `pass`              | `impactLight`         |
| Trick won                      | `trick-win`         | `impactHeavy`         |
| It's the player's turn         | `turn-notification` | `notificationSuccess` |
| Game finished (any outcome)    | `game-win`          | `notificationSuccess` |
| Any button press               | (inline, no name)   | `impactLight`         |

Notes:

- `card-select` fires only on the tap path in `PlayerHand.tsx`. Drag-start is not covered in this spec.
- `game-win` fires for all `GAME_FINISHED` outcomes (win and loss) using `notificationSuccess`. The intent is a clear "round over" signal regardless of outcome; nuancing per outcome is out of scope.
- `turn-notification` uses `notificationSuccess` for its distinct, attention-getting double-tap pattern on iOS. `impactMedium` is a viable alternative if the feel is too strong in practice.

---

## Architecture

### Approach

Mirror the existing `utils/sounds.ts` pattern exactly: a module-level utility with platform-split files (`.ts` for native, `.web.ts` no-op stub), AsyncStorage persistence, and silent failure on errors.

Button-press haptics live in `packages/game-canvas` (where most buttons are) as a `HapticTouchableOpacity` wrapper component. Since `packages/game-canvas` cannot depend on `apps/client`, and there is no UI toggle yet (making the preference always-on for now), `HapticTouchableOpacity` calls `expo-haptics` directly without reading the preference. When a toggle UI is built, callers can pass an `hapticsEnabled` prop (defaults to `true`) to opt in to preference-aware behaviour.

`expo-haptics` does **not** auto-stub on web in SDK 55 — it throws at runtime. A `HapticTouchableOpacity.web.tsx` stub (plain `TouchableOpacity` passthrough, no `expo-haptics` import) is required so Metro resolves the safe version on web builds.

### New Files

**`apps/client/src/utils/haptics.ts`** (native)

- Imports `expo-haptics`
- Module-level `let enabled = true`
- AsyncStorage key: `'dabb-haptics-enabled'`
- Exports:
  - `loadHapticsPreferences()` — reads preference from AsyncStorage on app startup
  - `setHapticsEnabled(value: boolean): Promise<void>` — updates module state + persists (async, matches `setMuted` in `sounds.ts`)
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

- Wraps `TouchableOpacity`; accepts all `TouchableOpacity` props plus optional `hapticsEnabled?: boolean` (defaults to `true`)
- On press: if `hapticsEnabled`, calls `Haptics.impactAsync(ImpactFeedbackStyle.Light)`, then forwards `onPress`
- No AsyncStorage reads; no preference module import; always-on until a toggle UI passes the prop
- Internal to `packages/game-canvas` — not exported from the package index

### Modified Files

| File                                                   | Change                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `apps/client/src/app/_layout.tsx`                      | Add `loadHapticsPreferences()` call alongside `loadSoundPreferences()`                |
| `apps/client/src/components/ui/GameScreen.tsx`         | Add `triggerHaptic(...)` next to each `playSound(...)` call; add `useTurnHaptic` hook |
| `apps/client/src/components/game/PlayerHand.tsx`       | Add `triggerHaptic('card-select')` next to `playSound('card-select')`                 |
| `packages/game-canvas/src/overlays/BiddingOverlay.tsx` | Replace `TouchableOpacity` → `HapticTouchableOpacity`                                 |
| `packages/game-canvas/src/overlays/TrumpOverlay.tsx`   | Replace `TouchableOpacity` → `HapticTouchableOpacity`                                 |
| `packages/game-canvas/src/overlays/DabbOverlay.tsx`    | Replace `TouchableOpacity` → `HapticTouchableOpacity`                                 |
| `packages/game-canvas/src/overlays/MeldingOverlay.tsx` | Replace `TouchableOpacity` → `HapticTouchableOpacity`                                 |
| `packages/game-canvas/package.json`                    | Add `expo-haptics` as a **peer** dependency (consistent with other native modules)    |

---

## Preference Handling

- `haptics.ts` maintains module-level `enabled` state, loaded from AsyncStorage key `'dabb-haptics-enabled'` at app startup
- `HapticTouchableOpacity` is always-on for now (no preference read); accepts `hapticsEnabled` prop for future wiring
- Default: `true` if no preference stored
- When a future toggle UI is built: call `setHapticsEnabled(value)` from `haptics.ts` for game events; pass `isHapticsEnabled()` as the `hapticsEnabled` prop to overlays for button haptics
- All haptic calls wrapped in `try/catch`, fail silently

---

## Out of Scope

- Toggle UI (deferred to a future settings screen)
- Web haptics (`expo-haptics` auto-stubs on web; no-op stubs in `haptics.web.ts` cover the rest)
- Haptics in `ui-shared` (no react-native/expo dependencies there)
- Drag-start `card-select` haptic (only tap path covered)

---

## Testing

No new unit tests — haptics are a pure side-effect with no logic. CI (build + lint + typecheck) verifies correctness. Manual verification on a physical device for the actual feel.
