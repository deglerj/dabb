# Options Dialog — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Add a persistent options dialog to the Dabb client that lets players toggle sound, toggle vibration, and select the app language. A gear icon button in the top-right corner of every screen opens the dialog. Settings persist across sessions.

## Components

### `OptionsButton`

A small, icon-only touchable that opens the dialog. Positioned absolutely in the top-right corner of each screen, outside the normal layout flow so it never displaces other content.

- Icon: `Feather` `settings` from `@expo/vector-icons` (Feather is the icon set used in the project; all Feather icons are already outline-style — there is no `-outline` variant)
- Size: ~36×36 pt touch target, ~20 pt icon
- Style: semi-transparent dark pill/rounded-square to remain legible on both light and dark backgrounds
- Renders `OptionsDialog` inline (controls `visible` state internally)

### `OptionsDialog`

A centered modal card over a dimmed backdrop.

**Structure:**

- Header row: "Optionen" title + ✕ close button (right-aligned)
- Sound row: label with speaker emoji + `Switch` — Switch represents "sound enabled" (not muted)
- Vibration row: label with vibration emoji + `Switch` — **hidden on web** (`Platform.OS === 'web'`)
- Language section: small "Sprache" label above a row of flag buttons (🇩🇪 🇬🇧); selected flag highlighted with amber background + border, unselected dimmed
- Backdrop tap closes the dialog

**Styling:** matches existing modal style — `Colors.paperFace` background, `Colors.inkDark` text, `Colors.amber` for active states, 12 px border radius, standard `Shadows`.

## Integration

`OptionsButton` is added to three existing screen components:

| Screen            | File                                                  | Needs `useSafeAreaInsets` added |
| ----------------- | ----------------------------------------------------- | ------------------------------- |
| HomeScreen        | `apps/client/src/components/ui/HomeScreen.tsx`        | Yes                             |
| WaitingRoomScreen | `apps/client/src/components/ui/WaitingRoomScreen.tsx` | Already present                 |
| GameScreen        | `apps/client/src/components/ui/GameScreen.tsx`        | Yes                             |

Each screen positions `OptionsButton` with `position: 'absolute'`, `top: insets.top`, `right: 16`, where `insets` comes from `useSafeAreaInsets()` imported from `react-native-safe-area-context`. For `HomeScreen` and `GameScreen`, the `useSafeAreaInsets` import and hook call must be added.

**HomeScreen layout note:** `HomeScreen` has two separate `return` statements (mode `'menu'` and mode `'create'`/`'join'`), each returning a `ScrollView` as the root. `OptionsButton` must be placed **outside and after** the `ScrollView` as a sibling in **both** branches. This requires wrapping each `ScrollView` in a `View` with `flex: 1` and `backgroundColor: Colors.woodDark` (to preserve the existing screen background that was previously provided by the `ScrollView`'s `contentContainerStyle`). Apply the wrapper to both return paths.

**WaitingRoomScreen layout note:** The root is already a `View` containing a `LinearGradient` (absoluteFill) and a `ScrollView`. Add `<OptionsButton />` as a third child of that root `View`, after the `ScrollView`, so it floats above the content.

**GameScreen layout note:** `GameScreen` has an early-return loading branch before the main JSX. `useSafeAreaInsets()` must be called **unconditionally at the top of the component function**, before any early returns (React rules-of-hooks). Add `<OptionsButton />` to both the loading branch and the main render so the button is always available.

## State & Persistence

### Sound

The Switch represents "sound enabled", which is the logical inverse of `isMuted()` / `setMuted()`:

- **Initial Switch value:** `!isMuted()`
- **On Switch change:** `setMuted(!enabled)` — negate the Switch value before passing to `setMuted`

`isMuted()` / `setMuted()` are imported from `utils/sounds.ts`; stores to AsyncStorage key `dabb-muted`.

### Vibration

The Switch represents "vibration enabled":

- **Initial Switch value:** `isHapticsEnabled()`
- **On Switch change:** `setHapticsEnabled(enabled)`

`isHapticsEnabled()` / `setHapticsEnabled()` are imported from `utils/haptics.ts`; stores to AsyncStorage key `dabb-haptics-enabled`. On web, the haptics module is a no-op stub — calling these functions is safe on all platforms. No platform guard inside the handler is needed; the row is simply not rendered on web.

### Language

- **Read:** `i18n.language` (from `useTranslation()`)
- **Write:** call both `i18n.changeLanguage(code)` **and** `persistLanguage(code)`, both imported from `@dabb/i18n`. `i18n.changeLanguage` updates the in-memory language immediately; `persistLanguage` writes to AsyncStorage `dabb-language` so the choice survives app restarts. The `I18nProvider` does not hook into subsequent `changeLanguage` calls — manual persistence is required.
- **Types:** flag-button values must be typed as `SupportedLanguage` (also imported from `@dabb/i18n`) — `persistLanguage` accepts `SupportedLanguage`, not `string`, and TypeScript strict mode is enabled.

### Startup race condition

`isMuted()` defaults to `false` (unmuted) and `isHapticsEnabled()` defaults to `true` (enabled) before `loadSoundPreferences()` / `loadHapticsPreferences()` resolve in `_layout.tsx`. If the dialog opens in this narrow window it shows the hardcoded defaults. This is acceptable: the defaults are sane, the window is tiny (preferences load immediately on mount), and no loading state is required.

All changes take effect immediately — no restart or confirmation required.

## Translations

New keys added to both `packages/i18n/src/locales/de.ts` and `en.ts` under an `options` namespace:

```ts
options: {
  title: 'Optionen' / 'Options',
  sound: 'Sound',
  vibration: 'Vibration',
  language: 'Sprache' / 'Language',
}
```

The `TranslationKeys` interface in `packages/i18n/src/types.ts` must be extended to include:

```ts
options: {
  title: string;
  sound: string;
  vibration: string;
  language: string;
}
```

Swabian card terms are unaffected — this dialog uses standard UI language only.

## Platform Behaviour

- **Android / iOS:** All three settings visible.
- **Web:** Vibration row hidden (`Platform.OS === 'web'`). Sound and language work normally.

## File Plan

New files:

- `apps/client/src/components/ui/OptionsButton.tsx`
- `apps/client/src/components/ui/OptionsDialog.tsx`

Modified files:

- `apps/client/src/components/ui/HomeScreen.tsx`
- `apps/client/src/components/ui/WaitingRoomScreen.tsx`
- `apps/client/src/components/ui/GameScreen.tsx`
- `packages/i18n/src/locales/de.ts`
- `packages/i18n/src/locales/en.ts`
- `packages/i18n/src/types.ts`

## Out of Scope

- No new settings beyond sound, vibration, language
- No per-screen settings differences
- No confirmation dialogs for settings changes
- No settings screen / dedicated route
