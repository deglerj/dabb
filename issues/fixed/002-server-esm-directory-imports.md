# Bug: Server Crashes - ESM Directory Imports Not Supported

## Summary

The server crashes on startup in Docker because Node.js ES modules don't support directory imports. The compiled JavaScript files use directory imports (e.g., `from './cards'`) which work with bundlers but fail when Node.js runs the code directly.

## Error Output

```
Error [ERR_UNSUPPORTED_DIR_IMPORT]: Directory import '/app/packages/game-logic/dist/cards' is not supported resolving ES modules imported from /app/packages/game-logic/dist/index.js
    at finalizeResolution (node:internal/modules/esm/resolve:262:11)
    at moduleResolve (node:internal/modules/esm/resolve:859:10)
    ...
```

## Root Cause

Configuration mismatch between TypeScript compilation and Node.js runtime:

1. **tsconfig.base.json** uses `"moduleResolution": "bundler"` which allows directory imports without file extensions
2. **apps/server/package.json** has `"type": "module"` making it an ES module
3. **Server start command** is `node dist/index.js` - runs Node.js directly without a bundler
4. **Development** works because it uses `tsx watch src/index.ts` which handles module resolution

When TypeScript compiles with bundler resolution, imports like:

```typescript
export { createDeck } from './cards';
```

Compile to:

```javascript
export { createDeck } from './cards';
```

But Node.js ES modules require:

```javascript
export { createDeck } from './cards/index.js';
```

## Affected Packages

The following packages have internal imports without `.js` extensions that need to be fixed:

### `packages/game-logic/src/index.ts`

```typescript
export { createDeck, dealCards, shuffleDeck, sortHand } from './cards';
export { ... } from './events';
export { calculateMeldPoints, detectMelds } from './melds';
export { ... } from './phases';
export { ... } from './state';
export { ... } from './export';
```

### `packages/shared-types/src/index.ts`

```typescript
export type { Card, CardId, Rank, Suit } from './cards';
export { RANKS, RANK_NAMES, RANK_POINTS, SUITS, SUIT_NAMES } from './cards';
export { ... } from './game';
export { ... } from './events';
export { ... } from './api';
export { ... } from './socket';
```

### `packages/i18n/src/index.ts`

```typescript
export { I18nProvider } from './components/I18nProvider';
export { ... } from './config';
export { ... } from './types';
export { de, en, resources } from './locales';
```

### `packages/ui-shared/src/index.ts`

```typescript
export { useSocket } from './useSocket';
export { useGameState } from './useGameState';
export { useSessionCredentials } from './useLocalStorage';
```

## Complete List of Files Needing Changes

### Barrel/Index Files (re-exports)

- `packages/game-logic/src/index.ts`
- `packages/game-logic/src/cards/index.ts`
- `packages/game-logic/src/events/index.ts`
- `packages/game-logic/src/melds/index.ts`
- `packages/game-logic/src/phases/index.ts`
- `packages/game-logic/src/state/index.ts`
- `packages/game-logic/src/export/index.ts` (already partially has `.js` extensions)
- `packages/shared-types/src/index.ts`
- `packages/ui-shared/src/index.ts`
- `packages/i18n/src/index.ts`
- `packages/i18n/src/locales/index.ts`

### Files with Cross-Directory Imports

- `packages/shared-types/src/game.ts` - imports from `./cards`
- `packages/shared-types/src/socket.ts` - imports from `./cards`, `./events`, `./game`
- `packages/shared-types/src/api.ts` - imports from `./game`
- `packages/shared-types/src/events.ts` - imports from `./cards`, `./game`
- `packages/i18n/src/config.ts` - imports from `./locales`, `./types`
- `packages/i18n/src/locales/de.ts` - imports from `../types`
- `packages/i18n/src/locales/en.ts` - imports from `../types`
- `packages/game-logic/src/state/reducer.ts` - imports from `../phases/bidding`, `./initial`
- `packages/game-logic/src/export/eventFormatter.ts` - already has `.js` extension

### Test Files (lower priority, only affect test runs)

- `packages/game-logic/src/__tests__/eventFormatter.test.ts`
- `packages/game-logic/src/__tests__/tricks.test.ts`
- `packages/game-logic/src/__tests__/deck.test.ts`
- `packages/game-logic/src/__tests__/melds.test.ts`
- `packages/game-logic/src/__tests__/bidding.test.ts`

## Important Notes

1. **Server files are already correct**: `apps/server/src/*.ts` files already use `.js` extensions (e.g., `import { env } from './config/env.js'`)

2. **Package imports work differently**: Imports like `from '@dabb/game-logic'` resolve via package.json exports, but then the internal barrel file (`index.js`) fails because it uses directory imports

3. **Web app is not affected**: Vite bundles the web app, so bundler-style resolution works there

4. **Mobile app may be affected**: Need to verify if Expo/Metro handles this or not

## Recommended Fix

### Option 1: NodeNext Module Resolution (Recommended)

**Step 1**: Update `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

**Step 2**: Add `.js` extensions to all relative imports in the affected files listed above.

Example transformation:

```typescript
// Before
export { createDeck } from './cards';
import type { Card } from './cards';

// After
export { createDeck } from './cards/index.js';
import type { Card } from './cards.js';
```

**Important**: When importing from a directory with an `index.ts`, use `/index.js`. When importing from a single file like `./cards.ts`, use `.js` (e.g., `./cards.js`).

### Option 2: Bundle the Server

Add esbuild or similar to bundle the server before deployment:

```json
// apps/server/package.json
{
  "scripts": {
    "build": "esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js"
  }
}
```

This would require updating the Dockerfile and handling external dependencies.

## Verification Steps

After fixing, verify with:

```bash
# Rebuild packages
pnpm run build

# Test server starts locally
cd apps/server && node dist/index.js

# Test in Docker
./dev.sh stop && ./dev.sh start && ./dev.sh logs
```

## Impact

- **Critical** - Server completely fails to start in Docker
- Development mode works (uses tsx which handles resolution)
- Production deployment is broken

## Priority

**Critical** - Blocks all Docker-based development and deployment
