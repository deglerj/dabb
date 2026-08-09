import { defineConfig } from 'vitest/config';

export default defineConfig({
  // vite.config.ts injects this from package.json; vitest does not read that config, so any
  // test importing src/constants.ts would blow up on the bare identifier.
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/vitest.setup.ts'],
    // e2e/ holds Playwright specs (also *.spec.ts) — vitest's default glob would otherwise
    // try to run them directly and fail, since they use test() from @playwright/test.
    exclude: ['**/node_modules/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/__tests__/**', 'src/**/index.ts', 'src/**/index.tsx'],
    },
  },
});
