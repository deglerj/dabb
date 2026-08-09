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
      // firebase.dev.json = wide-open emulator rules; firebase.json holds the deployed ones.
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
