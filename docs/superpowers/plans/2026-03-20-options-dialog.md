# Options Dialog Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent options dialog (sound, vibration, language) accessible via a gear icon button in the top-right corner of every screen.

**Architecture:** Two new shared components (`OptionsDialog`, `OptionsButton`) placed in `apps/client/src/components/ui/`. `OptionsButton` is added directly to each of the three screen components; it controls dialog visibility locally and renders `OptionsDialog` inline. Settings read/write via existing `sounds.ts` / `haptics.ts` utilities and `i18n`/`persistLanguage` from `@dabb/i18n`.

**Tech Stack:** React Native, Expo, `@expo/vector-icons` (Feather), `react-native-safe-area-context`, `@dabb/i18n`, TypeScript strict mode.

---

## File Map

| Action | File                                                  | Responsibility                                                      |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Create | `apps/client/src/components/ui/OptionsDialog.tsx`     | Modal card with sound/vibration switches + language flag picker     |
| Create | `apps/client/src/components/ui/OptionsButton.tsx`     | Gear icon button; renders OptionsDialog inline                      |
| Modify | `packages/i18n/src/types.ts`                          | Add `options` namespace to `TranslationKeys` interface              |
| Modify | `packages/i18n/src/locales/de.ts`                     | Add German strings for `options` namespace                          |
| Modify | `packages/i18n/src/locales/en.ts`                     | Add English strings for `options` namespace                         |
| Modify | `apps/client/src/components/ui/HomeScreen.tsx`        | Add `useSafeAreaInsets`, wrap ScrollViews, add `<OptionsButton>`    |
| Modify | `apps/client/src/components/ui/WaitingRoomScreen.tsx` | Add `<OptionsButton>` after ScrollView in root View                 |
| Modify | `apps/client/src/components/ui/GameScreen.tsx`        | Add `useSafeAreaInsets`, add `<OptionsButton>` to both render paths |

---

## Task 1: Add `options` translation keys

**Files:**

- Modify: `packages/i18n/src/types.ts`
- Modify: `packages/i18n/src/locales/de.ts`
- Modify: `packages/i18n/src/locales/en.ts`

- [ ] **Step 1: Add `options` namespace to `TranslationKeys` in `types.ts`**

  In `packages/i18n/src/types.ts`, add after the `updateRequired` block (before `serverErrors`):

  ```ts
  options: {
    title: string;
    sound: string;
    vibration: string;
    language: string;
  }
  ```

- [ ] **Step 2: Add German strings to `de.ts`**

  In `packages/i18n/src/locales/de.ts`, add before the closing `};` of the `de` object (after the `serverErrors` block, inserting as a sibling at the same indent level — but TypeScript requires all `TranslationKeys` fields, so add it before `serverErrors`):

  ```ts
  options: {
    title: 'Optionen',
    sound: 'Sound',
    vibration: 'Vibration',
    language: 'Sprache',
  },
  ```

  Place it immediately before `serverErrors: {` in `de.ts`.

- [ ] **Step 3: Add English strings to `en.ts`**

  In `packages/i18n/src/locales/en.ts`, add immediately before `serverErrors: {`:

  ```ts
  options: {
    title: 'Options',
    sound: 'Sound',
    vibration: 'Vibration',
    language: 'Language',
  },
  ```

- [ ] **Step 4: Build to verify type-correctness**

  ```bash
  pnpm run build
  ```

  Expected: build completes with no TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/i18n/src/types.ts packages/i18n/src/locales/de.ts packages/i18n/src/locales/en.ts
  git commit -m "feat: add options translation keys (de + en)"
  ```

---

## Task 2: Create `OptionsDialog` component

**Files:**

- Create: `apps/client/src/components/ui/OptionsDialog.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  /**
   * Options dialog — sound toggle, vibration toggle (native only), language selector.
   */
  import React, { useState, useCallback } from 'react';
  import { Modal, View, Text, Switch, TouchableOpacity, StyleSheet, Platform } from 'react-native';
  import { Feather } from '@expo/vector-icons';
  import { useTranslation, i18n, persistLanguage, type SupportedLanguage } from '@dabb/i18n';
  import { isMuted, setMuted } from '../../utils/sounds.js';
  import { isHapticsEnabled, setHapticsEnabled } from '../../utils/haptics.js';
  import { Colors, Fonts, Shadows } from '../../theme.js';

  interface OptionsDialogProps {
    visible: boolean;
    onClose: () => void;
  }

  export function OptionsDialog({ visible, onClose }: OptionsDialogProps) {
    const { t } = useTranslation();

    // Read current values when dialog renders
    const [soundEnabled, setSoundEnabled] = useState(() => !isMuted());
    const [hapticsEnabled, setHapticsEnabledState] = useState(() => isHapticsEnabled());
    const [language, setLanguage] = useState<SupportedLanguage>(
      () => (i18n.language as SupportedLanguage) ?? 'de'
    );

    const handleSoundToggle = useCallback((value: boolean) => {
      setSoundEnabled(value);
      void setMuted(!value);
    }, []);

    const handleHapticsToggle = useCallback((value: boolean) => {
      setHapticsEnabledState(value);
      void setHapticsEnabled(value);
    }, []);

    const handleLanguageSelect = useCallback((lang: SupportedLanguage) => {
      setLanguage(lang);
      void i18n.changeLanguage(lang);
      persistLanguage(lang);
    }, []);

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => undefined}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{t('options.title')}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={8}>
                <Feather name="x" size={18} color={Colors.inkMid} />
              </TouchableOpacity>
            </View>

            {/* Sound row */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>🔊 {t('options.sound')}</Text>
              <Switch
                value={soundEnabled}
                onValueChange={handleSoundToggle}
                trackColor={{ false: Colors.paperEdge, true: Colors.amber }}
                thumbColor={Colors.paperFace}
              />
            </View>

            {/* Vibration row — native only */}
            {Platform.OS !== 'web' && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>📳 {t('options.vibration')}</Text>
                <Switch
                  value={hapticsEnabled}
                  onValueChange={handleHapticsToggle}
                  trackColor={{ false: Colors.paperEdge, true: Colors.amber }}
                  thumbColor={Colors.paperFace}
                />
              </View>
            )}

            {/* Language section */}
            <View style={styles.languageSection}>
              <Text style={styles.languageLabel}>{t('options.language')}</Text>
              <View style={styles.flagRow}>
                {(['de', 'en'] as SupportedLanguage[]).map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[styles.flagButton, language === lang && styles.flagButtonSelected]}
                    onPress={() => handleLanguageSelect(lang)}
                  >
                    <Text style={styles.flagEmoji}>{lang === 'de' ? '🇩🇪' : '🇬🇧'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
    card: {
      backgroundColor: Colors.paperFace,
      borderRadius: 12,
      padding: 20,
      width: 280,
      ...Shadows.card,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.paperEdge,
    },
    title: {
      fontFamily: Fonts.bodyBold,
      fontSize: 16,
      color: Colors.inkDark,
    },
    closeButton: {
      backgroundColor: Colors.paperAged,
      borderRadius: 6,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    rowLabel: {
      fontFamily: Fonts.body,
      fontSize: 14,
      color: Colors.inkDark,
    },
    languageSection: {
      borderTopWidth: 1,
      borderTopColor: Colors.paperEdge,
      paddingTop: 14,
      marginTop: 2,
    },
    languageLabel: {
      fontFamily: Fonts.body,
      fontSize: 11,
      color: Colors.inkFaint,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    flagRow: {
      flexDirection: 'row',
      gap: 8,
    },
    flagButton: {
      backgroundColor: Colors.paperAged,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderWidth: 2,
      borderColor: 'transparent',
      opacity: 0.5,
    },
    flagButtonSelected: {
      backgroundColor: Colors.paperAged,
      borderColor: Colors.amber,
      opacity: 1,
    },
    flagEmoji: {
      fontSize: 22,
    },
  });
  ```

- [ ] **Step 2: Build to verify types**

  ```bash
  pnpm run build
  ```

  Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/client/src/components/ui/OptionsDialog.tsx
  git commit -m "feat: add OptionsDialog component"
  ```

---

## Task 3: Create `OptionsButton` component

**Files:**

- Create: `apps/client/src/components/ui/OptionsButton.tsx`

- [ ] **Step 1: Create the component**

  ```tsx
  /**
   * Gear icon button that opens the OptionsDialog.
   * Render inside a View with position: 'absolute' applied externally.
   */
  import React, { useState } from 'react';
  import { TouchableOpacity, StyleSheet } from 'react-native';
  import { Feather } from '@expo/vector-icons';
  import { Colors } from '../../theme.js';
  import { OptionsDialog } from './OptionsDialog.js';

  export function OptionsButton() {
    const [dialogVisible, setDialogVisible] = useState(false);

    return (
      <>
        <TouchableOpacity style={styles.button} onPress={() => setDialogVisible(true)} hitSlop={8}>
          <Feather name="settings" size={20} color={Colors.paperFace} />
        </TouchableOpacity>
        <OptionsDialog visible={dialogVisible} onClose={() => setDialogVisible(false)} />
      </>
    );
  }

  const styles = StyleSheet.create({
    button: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  ```

- [ ] **Step 2: Build to verify types**

  ```bash
  pnpm run build
  ```

  Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/client/src/components/ui/OptionsButton.tsx
  git commit -m "feat: add OptionsButton component"
  ```

---

## Task 4: Integrate into `HomeScreen`

**Files:**

- Modify: `apps/client/src/components/ui/HomeScreen.tsx`

`HomeScreen` currently has two `return` branches each with a root `ScrollView`. Both need to be wrapped in an outer `View` so `OptionsButton` can sit as an absolute-positioned sibling.

- [ ] **Step 1: Add imports**

  In `HomeScreen.tsx`, add to the existing React Native import:

  ```tsx
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import { OptionsButton } from './OptionsButton.js';
  ```

- [ ] **Step 2: Call the hook at the top of the component**

  Inside `HomeScreen`, after the existing `useState` / `useEffect` calls, add:

  ```tsx
  const insets = useSafeAreaInsets();
  ```

- [ ] **Step 3: Update the `mode === 'menu'` return branch**

  Replace:

  ```tsx
  return <ScrollView contentContainerStyle={styles.scrollContent}>...</ScrollView>;
  ```

  With:

  ```tsx
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>...</ScrollView>
      <OptionsButton style={{ position: 'absolute', top: insets.top + 8, right: 16 }} />
    </View>
  );
  ```

  Wait — `OptionsButton` doesn't accept a `style` prop. Instead, wrap it:

  ```tsx
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>...</ScrollView>
      <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
        <OptionsButton />
      </View>
    </View>
  );
  ```

- [ ] **Step 4: Update the second return branch (create/join mode) the same way**

  Replace its root `<ScrollView ...>...</ScrollView>` with the same wrapper pattern as step 3.

- [ ] **Step 5: Add the new styles**

  In `StyleSheet.create({...})`, add:

  ```ts
  screen: {
    flex: 1,
    backgroundColor: Colors.woodDark,
  },
  optionsButtonContainer: {
    position: 'absolute',
    right: 16,
  },
  ```

- [ ] **Step 6: Build to verify types**

  ```bash
  pnpm run build
  ```

  Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/client/src/components/ui/HomeScreen.tsx
  git commit -m "feat: add options button to HomeScreen"
  ```

---

## Task 5: Integrate into `WaitingRoomScreen`

**Files:**

- Modify: `apps/client/src/components/ui/WaitingRoomScreen.tsx`

The root is already `<View style={styles.container}>`. `useSafeAreaInsets` is already imported and used. Add `OptionsButton` as a third child after the `ScrollView`.

- [ ] **Step 1: Add import**

  In `WaitingRoomScreen.tsx`, add:

  ```tsx
  import { OptionsButton } from './OptionsButton.js';
  ```

- [ ] **Step 2: Add OptionsButton to the JSX**

  In the `return` block, after `</ScrollView>` (line ~242) and before `</View>`:

  ```tsx
  <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
    <OptionsButton />
  </View>
  ```

- [ ] **Step 3: Add the style**

  In `StyleSheet.create({...})`, add:

  ```ts
  optionsButtonContainer: {
    position: 'absolute',
    right: 16,
  },
  ```

- [ ] **Step 4: Build to verify types**

  ```bash
  pnpm run build
  ```

  Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/client/src/components/ui/WaitingRoomScreen.tsx
  git commit -m "feat: add options button to WaitingRoomScreen"
  ```

---

## Task 6: Integrate into `GameScreen`

**Files:**

- Modify: `apps/client/src/components/ui/GameScreen.tsx`

`GameScreen` has an early return at line 313 (loading state). `useSafeAreaInsets` must be called **unconditionally** before that early return. Add `OptionsButton` to both the loading branch and the main render.

- [ ] **Step 1: Add imports**

  In `GameScreen.tsx`, add to imports:

  ```tsx
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import { OptionsButton } from './OptionsButton.js';
  ```

- [ ] **Step 2: Call the hook unconditionally at the top**

  Inside `GameScreen`, near the top of the function body (after `const router = useRouter()` on line 127, before any early returns), add:

  ```tsx
  const insets = useSafeAreaInsets();
  ```

- [ ] **Step 3: Add OptionsButton to the loading state return**

  The loading return (lines 313–319) currently renders:

  ```tsx
  if (state.phase === 'waiting') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#c97f00" />
      </View>
    );
  }
  ```

  Change to:

  ```tsx
  if (state.phase === 'waiting') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#c97f00" />
        <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
          <OptionsButton />
        </View>
      </View>
    );
  }
  ```

- [ ] **Step 4: Add OptionsButton to the main render**

  In the main `return (...)` block, add `<OptionsButton>` as the last child of the root `<View style={styles.container}>`, after `<GameTerminatedModal .../>`:

  ```tsx
  <View style={[styles.optionsButtonContainer, { top: insets.top + 8 }]}>
    <OptionsButton />
  </View>
  ```

- [ ] **Step 5: Add the style**

  In `StyleSheet.create({...})`, add:

  ```ts
  optionsButtonContainer: {
    position: 'absolute',
    right: 16,
  },
  ```

- [ ] **Step 6: Build to verify types**

  ```bash
  pnpm run build
  ```

  Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/client/src/components/ui/GameScreen.tsx
  git commit -m "feat: add options button to GameScreen"
  ```

---

## Task 7: Full CI verification

- [ ] **Step 1: Run full CI suite**

  ```bash
  pnpm run build && pnpm lint && pnpm test
  ```

  Expected: all pass with no errors.

- [ ] **Step 2: If CI passes, the feature is complete**

  Manual smoke-test checklist:
  - Gear icon visible top-right on Home, Waiting Room, and Game screens
  - Tapping gear opens the dialog
  - Tapping backdrop or ✕ closes the dialog
  - Sound switch toggles mute; persists after app restart
  - Vibration switch toggles haptics (native only; hidden on web); persists after app restart
  - Selecting 🇩🇪 / 🇬🇧 changes the UI language immediately; persists after app restart
