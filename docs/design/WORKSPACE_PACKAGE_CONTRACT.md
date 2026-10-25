# Workspace package contract

The monorepo has one source/dist contract for every publishable workspace package:

- TypeScript source lives under `src/`.
- `build` removes `dist/` and emits compiled JavaScript and declarations from the package's
  `tsconfig.build.json`.
- `main`, `types`, and `exports` point to `dist/`; consumers do not import another package's
  `src/` files.
- `dist/` is generated, disposable, ignored by Git, and never a source of truth.
- Turborepo's `build` task runs dependencies first and caches `dist/**` as its output.
- `typecheck`, `test`, and the client Vite build depend on the same workspace build graph, so
  they resolve the package entrypoints that a clean checkout produces.
- `apps/simulate` follows the same contract: `pnpm simulate` builds its package dependencies,
  compiles its own `dist/`, then executes `dist/simulation/runner.js`.

A clean verification therefore removes package and app `dist/` directories before running the
workspace build. Generated output must not be committed to make stale artifacts unable to hide a
broken package entrypoint.
