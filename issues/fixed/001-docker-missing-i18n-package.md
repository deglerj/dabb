# Bug: Docker Build Fails - Missing @dabb/i18n Package

## Summary

The Docker build for the web app fails because the `@dabb/i18n` package is not included in the Dockerfile configuration.

## Error Output

```
src/components/ErrorBoundary.tsx(2,32): error TS2307: Cannot find module '@dabb/i18n' or its corresponding type declarations.
src/components/LanguageSwitcher.tsx(6,8): error TS2307: Cannot find module '@dabb/i18n' or its corresponding type declarations.
src/main.tsx(4,30): error TS2307: Cannot find module '@dabb/i18n' or its corresponding type declarations.
src/pages/GamePage.tsx(6,32): error TS2307: Cannot find module '@dabb/i18n' or its corresponding type declarations.
src/pages/HomePage.tsx(4,32): error TS2307: Cannot find module '@dabb/i18n' or its corresponding type declarations.
src/pages/WaitingRoomPage.tsx(9,32): error TS2307: Cannot find module '@dabb/i18n' or its corresponding type declarations.
```

## Root Cause

The `apps/web/Dockerfile` does not include the `packages/i18n/` directory in the build context. The i18n package was added to the project (as documented in CLAUDE.md) but the Dockerfile was not updated accordingly.

## Affected File

`apps/web/Dockerfile`

## Current State (lines 14-26)

```dockerfile
# Copy all package.json files for dependency resolution
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/game-logic/package.json ./packages/game-logic/
COPY packages/ui-shared/package.json ./packages/ui-shared/
COPY apps/web/package.json ./apps/web/

# Install dependencies with pnpm
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared-types ./packages/shared-types
COPY packages/game-logic ./packages/game-logic
COPY packages/ui-shared ./packages/ui-shared
COPY apps/web ./apps/web
```

## Fix Required

Add the i18n package to the Dockerfile:

1. Add package.json copy:

   ```dockerfile
   COPY packages/i18n/package.json ./packages/i18n/
   ```

2. Add source files copy:

   ```dockerfile
   COPY packages/i18n ./packages/i18n
   ```

3. Add build step:
   ```dockerfile
   cd ../i18n && pnpm run build && \
   ```

## Impact

- `./dev.sh start` fails completely
- Docker-based local development is broken
- Production deployment would also fail

## Reproduction Steps

1. Run `./dev.sh start`
2. Observe build failure with TypeScript errors about missing `@dabb/i18n` module

## Priority

**High** - Blocks local Docker development entirely
