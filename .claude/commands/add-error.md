Add a new server error code to the Dabb codebase. The error name/description is: $ARGUMENTS

Follow these steps in order:

## Step 1 — Add the error code

In `packages/shared-types/src/errors.ts`, add the new code to `SERVER_ERROR_CODES`.

## Step 2 — Add translations

Add the translated message to **both** locale files:

- `packages/i18n/src/locales/de.ts` — German translation
- `packages/i18n/src/locales/en.ts` — English translation

Place it under the `serverErrors` namespace. Use i18next interpolation syntax (`{{paramName}}`) for any dynamic values.

## Step 3 — Add the TypeScript type

In `packages/i18n/src/types.ts`, add the new key to the `serverErrors` interface so it's type-safe.

## Step 4 — Use the error in server code

In the appropriate server handler/service, throw the error using:

```typescript
import { GameError, SERVER_ERROR_CODES } from '@dabb/shared-types';
throw new GameError(SERVER_ERROR_CODES.YOUR_NEW_CODE, { optionalParams });
```

After all edits are done, run `/ci-check` to verify everything compiles and passes lint.
