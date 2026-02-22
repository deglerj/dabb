Add a new language to the Dabb i18n system. The language to add is: $ARGUMENTS

Follow these steps in order:

## Step 1 — Create the locale file

Copy `packages/i18n/src/locales/de.ts` to `packages/i18n/src/locales/[lang].ts` and translate all values.

**Do NOT translate** Swabian game terminology — these remain in German across all languages:

- Suits: Kreuz, Schippe, Herz, Bollen
- Ranks: Buabe, Ober, König, Zehn, Ass
- Melds: Paar, Familie, Binokel, Doppel-Binokel, etc.
- Game terms: Dabb, Binokel

## Step 2 — Register the language

In `packages/i18n/src/types.ts`:

- Add the language code to `SUPPORTED_LANGUAGES`
- Add the display label to `LANGUAGE_LABELS`

## Step 3 — Export the locale

In `packages/i18n/src/locales/index.ts`, export the new locale file.

After all edits are done, run `/ci-check` to verify everything compiles and passes lint.
