# Short Rules Screen — Design Spec

## Overview

Add a short, scannable rules reference screen to the app. Accessible from the options dialog. Respects the user's language toggle.

## Approved Text Content

### Deutsch

**Ziel:** Wer zuerst 1000 Punkte erreicht, gewinnt. Bei 4 Spielern spielen je zwei zusammen.

**Reizen:** Geboten wird ab 150. Der Höchstbietende nimmt den Dabb (verdeckte Karten), legt Karten ab und wählt Trumpf. Optional: Abgehen – Runde endet sofort, Gegner kassieren Meldepunkte + 40 Bonus.

**Melden:** Vor den Stichen Meldungen ablegen:

| Meldung                                            | Punkte              |
| -------------------------------------------------- | ------------------- |
| Paar (König + Ober, gleiche Farbe)                 | 20 (40 in Trumpf)   |
| Familie (Ass–Zehn–König–Ober–Buabe, gleiche Farbe) | 100 (150 in Trumpf) |
| Binokel (Ober Schippe + Buabe Bollen)              | 40                  |
| Doppel-Binokel                                     | 300                 |
| Vier Asse / Könige / Ober / Buaben                 | 100 / 80 / 60 / 40  |

**Stiche:** Du musst die angespielte Farbe bedienen. Kannst du bedienen, musst du höher stechen, wenn möglich. Kannst du nicht bedienen, musst du Trumpf spielen.

Kartenwerte: Ass 11 · Zehn 10 · König 4 · Ober 3 · Buabe 2.

### English

**Goal:** First to 1,000 points wins. With 4 players, two players form a team.

**Bidding:** Bidding starts at 150. The highest bidder takes the Dabb (hidden cards), discards some, and picks the trump suit. Optionally, go out — the round ends immediately and opponents score their melds plus a 40-point bonus.

**Melds:** Declare melds before tricks:

| Meld                                             | Points             |
| ------------------------------------------------ | ------------------ |
| Paar – König + Ober of same suit                 | 20 (40 in trump)   |
| Familie – Ass–Zehn–König–Ober–Buabe of same suit | 100 (150 in trump) |
| Binokel – Ober Schippe + Buabe Bollen            | 40                 |
| Doppel-Binokel                                   | 300                |
| Four Asse / Könige / Ober / Buaben               | 100 / 80 / 60 / 40 |

**Tricks:** You must play a card of the led suit if you have one. If you can follow suit, you must play higher than the winning card if possible. If you can't follow suit, you must play trump.

Card values: Ass 11 · Zehn 10 · König 4 · Ober 3 · Buabe 2.

## Implementation

### New file: `apps/client/src/app/rules.tsx`

- `ScrollView` layout, same structure as `privacy.tsx`
- Uses `useTranslation()` from `@dabb/i18n`
- Sections rendered as React Native `<Text>` and `<View>` components
- Meld table rendered as `<View>` rows (no markdown renderer needed)
- No new dependencies

### i18n changes (`packages/i18n/src/locales/de.ts` and `en.ts`)

Add keys under existing `rules` namespace:

| Key                       | DE                                                                                                                                                                                           | EN                                                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `rules.title`             | Spielregeln _(already exists)_                                                                                                                                                               | Rules _(already exists)_                                                                                                                                                                                                 |
| `rules.goal`              | Wer zuerst 1000 Punkte erreicht, gewinnt. Bei 4 Spielern spielen je zwei zusammen.                                                                                                           | First to 1,000 points wins. With 4 players, two players form a team.                                                                                                                                                     |
| `rules.bidding`           | Geboten wird ab 150. Der Höchstbietende nimmt den Dabb (verdeckte Karten), legt Karten ab und wählt Trumpf. Optional: Abgehen – Runde endet sofort, Gegner kassieren Meldepunkte + 40 Bonus. | Bidding starts at 150. The highest bidder takes the Dabb (hidden cards), discards some, and picks the trump suit. Optionally, go out — the round ends immediately and opponents score their melds plus a 40-point bonus. |
| `rules.melds`             | Melden                                                                                                                                                                                       | Melds                                                                                                                                                                                                                    |
| `rules.meldsIntro`        | Vor den Stichen Meldungen ablegen:                                                                                                                                                           | Declare melds before tricks:                                                                                                                                                                                             |
| `rules.meldPaar`          | Paar (König + Ober, gleiche Farbe)                                                                                                                                                           | Paar – König + Ober of same suit                                                                                                                                                                                         |
| `rules.meldFamilie`       | Familie (Ass–Zehn–König–Ober–Buabe, gleiche Farbe)                                                                                                                                           | Familie – Ass–Zehn–König–Ober–Buabe of same suit                                                                                                                                                                         |
| `rules.meldBinokel`       | Binokel (Ober Schippe + Buabe Bollen)                                                                                                                                                        | Binokel – Ober Schippe + Buabe Bollen                                                                                                                                                                                    |
| `rules.meldDoppelBinokel` | Doppel-Binokel                                                                                                                                                                               | Doppel-Binokel                                                                                                                                                                                                           |
| `rules.meldFour`          | Vier Asse / Könige / Ober / Buaben                                                                                                                                                           | Four Asse / Könige / Ober / Buaben                                                                                                                                                                                       |
| `rules.trumpSuffix`       | in Trumpf                                                                                                                                                                                    | in trump                                                                                                                                                                                                                 |
| `rules.tricks`            | Du musst die angespielte Farbe bedienen. Kannst du bedienen, musst du höher stechen, wenn möglich. Kannst du nicht bedienen, musst du Trumpf spielen.                                        | You must play a card of the led suit if you have one. If you can follow suit, you must play higher than the winning card if possible. If you can't follow suit, you must play trump.                                     |
| `rules.cardValues`        | Kartenwerte: Ass 11 · Zehn 10 · König 4 · Ober 3 · Buabe 2.                                                                                                                                  | Card values: Ass 11 · Zehn 10 · König 4 · Ober 3 · Buabe 2.                                                                                                                                                              |

Meld points column uses static values; `trumpSuffix` is interpolated for the bonus point display (e.g. "20 (40 in Trumpf)").

### Navigation: `apps/client/src/components/ui/OptionsDialog.tsx`

- Add a "Spielregeln" / "Rules" touchable row in the existing info-links area (alongside the GitHub link)
- On press: call `onClose()` then `router.push('/rules')`
- Import `router` from `expo-router`

### TypeScript types: `packages/i18n/src/types.ts`

- Extend the `rules` object in `TranslationKeys` (currently only has `title: string`) with all new keys to satisfy strict typing
