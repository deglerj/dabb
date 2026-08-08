import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')
) as { version: string };

export default defineConfig({
  envPrefix: 'EXPO_PUBLIC_',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      // NOT autoUpdate: skipWaiting on an autoUpdate SW would reload the page mid-game and
      // destroy a live session. 'prompt' requires an explicit user action (see main.tsx),
      // which the app should only take when no game is in progress.
      registerType: 'prompt',
      // Registered manually in main.tsx (via virtual:pwa-register) so the update prompt can
      // be deferred while a game is in progress — auto-injection would double-register.
      injectRegister: false,
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Dabb — Binokel Online',
        short_name: 'Dabb',
        description: 'Multiplayer Binokel (Swabian card game), online or vs. AI.',
        lang: 'de',
        start_url: '/',
        display: 'standalone',
        background_color: '#8a5e2e',
        theme_color: '#8a5e2e',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // RTDB is a websocket — Workbox can't cache it, and there's no "resume an online game
        // offline" story (RTDB has no web disk persistence). This precaches the app shell
        // (JS/CSS/fonts/sounds/icons) so any deep link — /game/offline included — loads the
        // shell offline; online-only routes then show their own existing "can't connect" UI
        // rather than a bare browser network error.
        globPatterns: ['**/*.{js,css,html,woff2,mp3,png,svg}'],
      },
    }),
  ],
  resolve: {
    alias: [{ find: /^react-native$/, replacement: 'react-native-web' }],
    // Third-party RN packages (react-native-safe-area-context, etc.) ship .web.tsx/.web.js
    // platform variants that Metro resolves automatically for extensionless imports — Vite
    // needs the same extension order. mainFields excludes "react-native" so package.json's
    // react-native field (pointing at native-only source) never wins over "module"/"browser".
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.mjs',
      '.json',
    ],
    mainFields: ['browser', 'module', 'main'],
  },
  optimizeDeps: {
    // The dep-prebundling esbuild pass doesn't reliably honor the extensions/mainFields
    // above for this package's platform-variant files — excluding it forces normal
    // per-module dev resolution instead, which does.
    exclude: ['react-native-safe-area-context'],
  },
});
