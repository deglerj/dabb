# Language Persistence on Native — Design

**Date:** 2026-05-31  
**Status:** Approved

## Problem

Language selection is not persisted across app restarts on native (Android/iOS). The i18n package has a `StorageAdapter` interface and a `setStorageAdapter()` function, but the client never wires up `AsyncStorage` for native. The default `webStorageAdapter` (localStorage) is a no-op on React Native, so the detected language always falls back to the device locale or German default.

Web is unaffected — `webStorageAdapter` uses `localStorage` directly and already works.

## Solution

Wire `AsyncStorage` as the storage adapter in `_layout.tsx`. Detect the stored language asynchronously at startup and hold the splash screen until both fonts and language are ready.

### Single file changed: `apps/client/src/app/_layout.tsx`

**1. Set storage adapter at module level**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setStorageAdapter, detectLanguageAsync } from '@dabb/i18n';

setStorageAdapter(AsyncStorage);
```

Module-level call executes before any React render, ensuring i18n never touches the old adapter. No platform guard needed — `@react-native-async-storage/async-storage` already uses `localStorage` on web (same package used by sounds and haptics).

**2. Detect language asynchronously**

```ts
const [language, setLanguage] = useState<SupportedLanguage | null>(null);

useEffect(() => {
  void detectLanguageAsync().then(setLanguage);
}, []);
```

`detectLanguageAsync()` reads from `AsyncStorage` via the adapter, then falls back to `navigator.language`, then to `DEFAULT_LANGUAGE`.

**3. Splash screen waits for fonts AND language**

```ts
useEffect(() => {
  if (fontsLoaded && language !== null) {
    SplashScreen.hideAsync();
  }
}, [fontsLoaded, language]);
```

Language detection is fast (AsyncStorage read), so this adds negligible delay.

**4. Pass detected language to `I18nProvider`**

```tsx
<I18nProvider initialLanguage={language}>
```

`I18nProvider` already accepts `initialLanguage` and passes it to `initI18n()`. No changes to the i18n package.

**Persistence on change** already works: `I18nProvider` subscribes to `languageChanged` and calls `persistLanguage()`, which now routes through `AsyncStorage` on native.

## No Changes Required

- `packages/i18n` — infrastructure already complete (`StorageAdapter`, `setStorageAdapter`, `detectLanguageAsync`, `persistLanguage`)
- `OptionsDialog` — already calls `persistLanguage()` on select (redundant but harmless)

## Testing

- Change language in options dialog → restart app → correct language shown
- First launch (no stored preference) → falls back to device locale or German
