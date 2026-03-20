# Options Dialog — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Add a persistent options dialog to the Dabb client that lets players toggle sound, toggle vibration, and select the app language. A gear icon button in the top-right corner of every screen opens the dialog. Settings persist across sessions.

## Components

### `OptionsButton`

A small, icon-only touchable that opens the dialog. Positioned absolutely in the top-right corner of each screen, outside the normal layout flow so it never displaces other content.

- Icon: gear (⚙ / `Ionicons` `settings-outline` or equivalent from the project's icon set)
- Size: ~36×36 pt touch target, ~20 pt icon
- Style: semi-transparent dark pill/rounded-square to remain legible on both light and dark backgrounds
- Renders `OptionsDialog` inline (controls `visible` state internally)

### `OptionsDialog`

A centered modal card over a dimmed backdrop.

**Structure:**

- Header row: "Optionen" title + ✕ close button (right-aligned)
- Sound row: label with speaker emoji + `Switch`
- Vibration row: label with vibration emoji + `Switch` — **hidden on web** (`Platform.OS === 'web'`)
- Language section: small "Sprache" label above a row of flag buttons (🇩🇪 🇬🇧); selected flag highlighted with amber background + border, unselected dimmed
- Backdrop tap closes the dialog

**Styling:** matches existing modal style — `Colors.paperFace` background, `Colors.inkDark` text, `Colors.amber` for active states, 12 px border radius, standard `Shadows`.

## Integration

`OptionsButton` is added to three existing screen components:

| Screen            | File                                                  |
| ----------------- | ----------------------------------------------------- |
| HomeScreen        | `apps/client/src/components/ui/HomeScreen.tsx`        |
| WaitingRoomScreen | `apps/client/src/components/ui/WaitingRoomScreen.tsx` |
| GameScreen        | `apps/client/src/components/ui/GameScreen.tsx`        |

Each screen positions the button with `position: 'absolute'`, `top` aligned to safe-area inset, `right: 16`.

## State & Persistence

| Setting   | Read                                         | Write                       | Storage                                           |
| --------- | -------------------------------------------- | --------------------------- | ------------------------------------------------- |
| Sound     | `isMuted()` from `utils/sounds.ts`           | `setMuted(value)`           | AsyncStorage `dabb-muted`                         |
| Vibration | `isHapticsEnabled()` from `utils/haptics.ts` | `setHapticsEnabled(value)`  | AsyncStorage `dabb-haptics-enabled`               |
| Language  | `i18n.language` from `useTranslation()`      | `i18n.changeLanguage(code)` | AsyncStorage `dabb-language` (via `I18nProvider`) |

All changes take effect immediately — no restart or confirmation required.

The dialog reads initial toggle values when it opens (calling `isMuted()` / `isHapticsEnabled()`) so it always reflects current state.

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

Swabian card terms are unaffected — this dialog uses standard UI language only.

## Platform Behaviour

- **Android / iOS:** All three settings visible.
- **Web:** Vibration row hidden (haptics are no-ops on web). Sound and language work normally.

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
