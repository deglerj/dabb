import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Only needed for local sandboxed dev environments (nested-sandbox zygote crash);
        // harmless on CI runners.
        launchOptions: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
      },
    },
  ],
  webServer: [
    {
      // firebase.dev.json points at database.rules.dev.json: wide open, so local dev and this
      // smoke test never trip over auth. NEVER deployed — firebase.json holds the real rules.
      //
      // Keep database.rules.dev.json to the single "rules" key. The emulator jar is fetched at
      // run time rather than pinned by the lockfile, and the current one rejects any other
      // top-level key outright ("Expected 'rules' property"), which takes CI down with it.
      command:
        'pnpm exec firebase emulators:start --only database --project demo-dabb --config firebase.dev.json',
      cwd: '../..',
      port: 9000,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npx vite',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        EXPO_PUBLIC_USE_FIREBASE_EMULATOR: 'true',
        EXPO_PUBLIC_FIREBASE_DATABASE_URL: 'https://demo-dabb-default-rtdb.firebaseio.com',
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-dabb',
      },
    },
  ],
});
