# Short Rules Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a short, scannable rules reference screen accessible from the options dialog, with content respecting the user's language toggle.

**Architecture:** New `rules.tsx` Expo Router screen mirrors the structure of `privacy.tsx`. All text lives in i18n locale files (`de.ts` / `en.ts`) under the existing `rules` namespace. The OptionsDialog gets a navigation link that dismisses itself then pushes `/rules`.

**Tech Stack:** React Native, Expo Router, `@dabb/i18n` (`useTranslation`), TypeScript strict mode.

---

## File Map

| Action | File                                              | Purpose                                      |
| ------ | ------------------------------------------------- | -------------------------------------------- |
| Modify | `packages/i18n/src/types.ts`                      | Extend `TranslationKeys.rules` with new keys |
| Modify | `packages/i18n/src/locales/de.ts`                 | Add German rules content                     |
| Modify | `packages/i18n/src/locales/en.ts`                 | Add English rules content                    |
| Create | `apps/client/src/app/rules.tsx`                   | Rules screen component                       |
| Modify | `apps/client/src/components/ui/OptionsDialog.tsx` | Add rules navigation link                    |

---

### Task 1: Extend i18n types and add locale strings

**Files:**

- Modify: `packages/i18n/src/types.ts` (the `rules` object is at line ~195)
- Modify: `packages/i18n/src/locales/de.ts` (the `rules` object is at line ~185)
- Modify: `packages/i18n/src/locales/en.ts` (the `rules` object is at line ~184)

- [ ] **Step 1: Extend TranslationKeys.rules in types.ts**

Find this block (around line 195):

```typescript
rules: {
  title: string;
}
```

Replace with:

```typescript
rules: {
  title: string;
  sectionGoal: string;
  goal: string;
  sectionBidding: string;
  bidding: string;
  melds: string;
  meldsIntro: string;
  meldPaar: string;
  meldFamilie: string;
  meldBinokel: string;
  meldDoppelBinokel: string;
  meldFour: string;
  trumpSuffix: string;
  sectionTricks: string;
  tricks: string;
  cardValues: string;
}
```

- [ ] **Step 2: Add German rules keys in de.ts**

Find this block (around line 185):

```typescript
  rules: {
    title: 'Spielregeln',
  },
```

Replace with:

```typescript
  rules: {
    title: 'Spielregeln',
    sectionGoal: 'Ziel',
    goal: 'Wer zuerst 1000 Punkte erreicht, gewinnt. Bei 4 Spielern spielen je zwei zusammen.',
    sectionBidding: 'Reizen',
    bidding:
      'Geboten wird ab 150. Der Höchstbietende nimmt den Dabb (verdeckte Karten), legt Karten ab und wählt Trumpf. Optional: Abgehen – Runde endet sofort, Gegner kassieren Meldepunkte + 40 Bonus.',
    melds: 'Melden',
    meldsIntro: 'Vor den Stichen Meldungen ablegen:',
    meldPaar: 'Paar (König + Ober, gleiche Farbe)',
    meldFamilie: 'Familie (Ass–Zehn–König–Ober–Buabe, gleiche Farbe)',
    meldBinokel: 'Binokel (Ober Schippe + Buabe Bollen)',
    meldDoppelBinokel: 'Doppel-Binokel',
    meldFour: 'Vier Asse / Könige / Ober / Buaben',
    trumpSuffix: 'in Trumpf',
    sectionTricks: 'Stiche',
    tricks:
      'Du musst die angespielte Farbe bedienen. Kannst du bedienen, musst du höher stechen, wenn möglich. Kannst du nicht bedienen, musst du Trumpf spielen.',
    cardValues: 'Kartenwerte: Ass 11 · Zehn 10 · König 4 · Ober 3 · Buabe 2.',
  },
```

- [ ] **Step 3: Add English rules keys in en.ts**

Find this block (around line 184):

```typescript
  rules: {
    title: 'Game Rules',
  },
```

Replace with:

```typescript
  rules: {
    title: 'Game Rules',
    sectionGoal: 'Goal',
    goal: 'First to 1,000 points wins. With 4 players, two players form a team.',
    sectionBidding: 'Bidding',
    bidding:
      'Bidding starts at 150. The highest bidder takes the Dabb (hidden cards), discards some, and picks the trump suit. Optionally, go out — the round ends immediately and opponents score their melds plus a 40-point bonus.',
    melds: 'Melds',
    meldsIntro: 'Declare melds before tricks:',
    meldPaar: 'Paar – König + Ober of same suit',
    meldFamilie: 'Familie – Ass–Zehn–König–Ober–Buabe of same suit',
    meldBinokel: 'Binokel – Ober Schippe + Buabe Bollen',
    meldDoppelBinokel: 'Doppel-Binokel',
    meldFour: 'Four Asse / Könige / Ober / Buaben',
    trumpSuffix: 'in trump',
    sectionTricks: 'Tricks',
    tricks:
      "You must play a card of the led suit if you have one. If you can follow suit, you must play higher than the winning card if possible. If you can't follow suit, you must play trump.",
    cardValues: 'Card values: Ass 11 · Zehn 10 · König 4 · Ober 3 · Buabe 2.',
  },
```

- [ ] **Step 4: Verify types are correct**

```bash
pnpm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/src/types.ts packages/i18n/src/locales/de.ts packages/i18n/src/locales/en.ts
git commit -m "feat(i18n): add short rules content keys"
```

---

### Task 2: Create the rules screen

**Files:**

- Create: `apps/client/src/app/rules.tsx`

The screen mirrors the structure of `privacy.tsx`: a `ScrollView` with a paper-card layout. Sections are Goal, Bidding, Melds (rendered as a two-column table using `<View>` rows), and Tricks.

- [ ] **Step 1: Create `apps/client/src/app/rules.tsx`**

```tsx
import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useTranslation } from '@dabb/i18n';
import { Colors, Fonts } from '../theme.js';

export default function RulesScreen() {
  const { t } = useTranslation();

  const melds = [
    { desc: t('rules.meldPaar'), points: `20 (40 ${t('rules.trumpSuffix')})` },
    { desc: t('rules.meldFamilie'), points: `100 (150 ${t('rules.trumpSuffix')})` },
    { desc: t('rules.meldBinokel'), points: '40' },
    { desc: t('rules.meldDoppelBinokel'), points: '300' },
    { desc: t('rules.meldFour'), points: '100 / 80 / 60 / 40' },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.appTitle}>Dabb</Text>

      <View style={styles.card}>
        <Text style={styles.title}>{t('rules.title')}</Text>

        <Text style={styles.sectionHeader}>{t('rules.sectionGoal')}</Text>
        <Text style={styles.body}>{t('rules.goal')}</Text>

        <Text style={styles.sectionHeader}>{t('rules.sectionBidding')}</Text>
        <Text style={styles.body}>{t('rules.bidding')}</Text>

        <Text style={styles.sectionHeader}>{t('rules.melds')}</Text>
        <Text style={styles.body}>{t('rules.meldsIntro')}</Text>

        <View style={styles.table}>
          {melds.map((meld, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
              <Text style={styles.tableCellDesc}>{meld.desc}</Text>
              <Text style={styles.tableCellPoints}>{meld.points}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeader}>{t('rules.sectionTricks')}</Text>
        <Text style={styles.body}>{t('rules.tricks')}</Text>
        <Text style={styles.cardValues}>{t('rules.cardValues')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.woodDark,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  appTitle: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.paperFace,
    textAlign: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  card: {
    backgroundColor: Colors.paperFace,
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontFamily: Fonts.bodyBold,
    fontSize: 18,
    color: Colors.inkDark,
    marginBottom: 20,
  },
  sectionHeader: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 6,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.inkMid,
    lineHeight: 22,
  },
  table: {
    marginTop: 10,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.paperEdge,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: Colors.paperFace,
  },
  tableRowAlt: {
    backgroundColor: Colors.paperAged,
  },
  tableCellDesc: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkMid,
  },
  tableCellPoints: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13,
    color: Colors.inkDark,
    textAlign: 'right',
    marginLeft: 8,
  },
  cardValues: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.inkFaint,
    marginTop: 10,
  },
});
```

- [ ] **Step 2: Verify build**

```bash
pnpm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/app/rules.tsx
git commit -m "feat(client): add short rules screen"
```

---

### Task 3: Add rules link to OptionsDialog

**Files:**

- Modify: `apps/client/src/components/ui/OptionsDialog.tsx`

Add a "Game Rules / Spielregeln" link in the existing info-links area (alongside the GitHub link). On press: close the dialog, then navigate to `/rules`.

- [ ] **Step 1: Add router import and hook**

At the top of `OptionsDialog.tsx`, add `useRouter` to the existing `expo-router` import — or add a new import line if none exists yet:

```typescript
import { useRouter } from 'expo-router';
```

Inside the `OptionsDialog` function body (after the existing `useState` declarations), add:

```typescript
const router = useRouter();
```

- [ ] **Step 2: Add rules link row**

Find this block in the JSX (around line 117):

```tsx
{
  /* GitHub link */
}
<View style={styles.githubRow}>
  <TouchableOpacity
    accessibilityRole="link"
    onPress={() => void Linking.openURL('https://github.com/deglerj/dabb')}
  >
    <Text style={styles.githubLink}>{t('info.sourceCode')}</Text>
  </TouchableOpacity>
</View>;
```

Replace with:

```tsx
{
  /* Info links */
}
<View style={styles.githubRow}>
  <TouchableOpacity
    onPress={() => {
      onClose();
      router.push('/rules');
    }}
  >
    <Text style={styles.githubLink}>{t('rules.title')}</Text>
  </TouchableOpacity>
  <TouchableOpacity
    accessibilityRole="link"
    onPress={() => void Linking.openURL('https://github.com/deglerj/dabb')}
  >
    <Text style={styles.githubLink}>{t('info.sourceCode')}</Text>
  </TouchableOpacity>
</View>;
```

- [ ] **Step 3: Verify build**

```bash
pnpm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/components/ui/OptionsDialog.tsx
git commit -m "feat(client): add rules link to options dialog"
```

---

### Task 4: Run full CI check

- [ ] **Step 1: Run CI suite**

```bash
pnpm run build && pnpm lint && pnpm test
```

Expected: all pass with no errors.
