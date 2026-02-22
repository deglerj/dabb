Run the full CI verification suite locally, exactly as GitHub CI does it.

Execute these three commands **in sequence**, stopping and reporting clearly if any fails:

```bash
pnpm run build   # tsc type-check + vite build
pnpm run lint    # ESLint across the whole repo
pnpm run test    # Vitest (all packages)
```

After all three pass, confirm to the user that the code is ready to commit.

**Important**: All three must pass. Vitest does NOT type-check (it uses esbuild), so passing tests alone does NOT guarantee type correctness — `pnpm run build` is what catches type errors.
