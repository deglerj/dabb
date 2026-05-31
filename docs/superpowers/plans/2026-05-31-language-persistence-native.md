# Language Persistence on Native Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist language selection across app restarts on native (Android/iOS) by wiring `AsyncStorage` as the i18n storage adapter.

**Architecture:** Call `setStorageAdapter(AsyncStorage)` at module level in `_layout.tsx` before any React render, then detect the stored language asynchronously during startup. Hold the splash screen until both fonts and language are ready, then pass the detected language to `I18nProvider`.

**Tech Stack:** `@react-native-async-storage/async-storage` (already a client dep), `@dabb/i18n` (already exports `setStorageAdapter`, `detectLanguageAsync`, `SupportedLanguage`).

---

## File Map

| File                              | Change                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/client/src/app/_layout.tsx` | Add AsyncStorage adapter, async language detection, pass `initialLanguage` to `I18nProvider` |

No changes to `packages/i18n` — infrastructure is already complete.

---

### Task 1: Wire AsyncStorage and async language detection in `_layout.tsx`

**Files:**

- Modify: `apps/client/src/app/_layout.tsx`

- [ ] **Step 1: Update imports**

Replace the current `@dabb/i18n` import line and add `AsyncStorage` import. Also add `useState` to the React import.

```tsx
import './global.css';
import React, { useEffect, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  I18nProvider,
  setStorageAdapter,
  detectLanguageAsync,
  type SupportedLanguage,
} from '@dabb/i18n';
import AppErrorBoundary from '../components/ui/AppErrorBoundary.js';
import { loadSoundPreferences } from '../utils/sounds.js';
import { loadHapticsPreferences } from '../utils/haptics.js';
```

- [ ] **Step 2: Set storage adapter at module level**

Add this line immediately after the imports (before `SplashScreen.preventAutoHideAsync()`):

```ts
setStorageAdapter(AsyncStorage);

SplashScreen.preventAutoHideAsync();
```

`AsyncStorage` on web uses `localStorage` under the hood (same package used by sounds and haptics), so no platform guard is needed.

- [ ] **Step 3: Add language state and async detection effect in `RootLayout`**

Inside `RootLayout`, add a `language` state and a `useEffect` to detect it asynchronously. Place them right after the `useFonts` call:

```tsx
function RootLayout() {
  const [fontsLoaded] = useFonts({
    IMFellEnglishSC_400Regular,
    Caveat_400Regular,
    Caveat_700Bold,
    Lato_400Regular,
    Lato_700Bold,
  });

  const [language, setLanguage] = useState<SupportedLanguage | null>(null);

  useEffect(() => {
    void detectLanguageAsync().then(setLanguage);
  }, []);
  // ... rest of component
}
```

- [ ] **Step 4: Update the splash screen effect to wait for both fonts and language**

Replace the existing splash screen `useEffect`:

```tsx
// was:
useEffect(() => {
  if (fontsLoaded) {
    SplashScreen.hideAsync();
  }
}, [fontsLoaded]);

// becomes:
useEffect(() => {
  if (fontsLoaded && language !== null) {
    void SplashScreen.hideAsync();
  }
}, [fontsLoaded, language]);
```

- [ ] **Step 5: Update null guard and pass `initialLanguage` to `I18nProvider`**

```tsx
if (!fontsLoaded || language === null) {
  return null;
}

return (
  <GestureHandlerRootView style={styles.root}>
    <StatusBar hidden />
    <SafeAreaProvider>
      <I18nProvider initialLanguage={language}>
        <Stack screenOptions={{ headerShown: false }} />
      </I18nProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);
```

- [ ] **Step 6: Run CI check**

```bash
pnpm run build && pnpm test && pnpm lint
```

Expected: all pass with no type errors.

- [ ] **Step 7: Manual smoke test**

1. Run the app on a native device/emulator: `pnpm --filter @dabb/client start`
2. Open options dialog → select a non-default language
3. Close and reopen the app
4. Verify the selected language is still active (UI strings match chosen language)

- [ ] **Step 8: Commit**

```bash
git add apps/client/src/app/_layout.tsx
git commit -m "feat(client): persist language selection via AsyncStorage on native"
```
