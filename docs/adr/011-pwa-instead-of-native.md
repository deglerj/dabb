# ADR 011: Retire native Android/iOS, ship as an installable PWA

## Status

Accepted

## Date

2026-08-04

## Context

The app shipped on Android (Play Store) and iOS (local builds only, no CI/release pipeline) via Expo/React Native, alongside an already-working, already-deploying web build (`expo export --platform web`). Android in particular carried a large, permanently-maintained tail: a Docker+Gradle build image, an NDK/CMake toolchain, six Expo config plugins, a keystore, a Play Store listing, and a merge-blocking Maestro smoke test on a CI Android emulator (see the now-deleted ADR 010, which documented working around Expo Go's native-module limitations for that same native build).

None of that tail existed for the web build, and the web build already reached every desktop user and, via a browser, every mobile user too — just without an install icon or offline support.

## Decision

Drop both native targets. Serve mobile as an installable Progressive Web App instead: a web app manifest, an offline-capable app shell via a service worker, and standard "Add to Home Screen" install flows on Android and iOS. Google Play listing unpublished manually; existing installs keep working against Firebase until they break, no farewell release.

Because React Native then had no consumer, the RN/Expo stack was removed too, not just the native build tooling:

- Metro/expo-router → Vite + react-router-dom.
- `@shopify/react-native-skia` → raw WebGL1/Canvas2D (SkSL shaders ported to GLSL by hand).
- `react-native-reanimated`/`react-native-gesture-handler` → Pointer Events + CSS transitions.
- `react-native-web` → `@dabb/rn-compat`, a small in-repo shim providing just enough of the RN component surface (View/Text/Pressable/ScrollView/Modal/etc., StyleSheet-shaped style objects) that the ~200 existing JSX call sites across the client and `game-canvas` didn't need a wholesale rewrite.

The migration landed as five checkpoints on one long-lived branch, each independently buildable, testable, and manually verifiable, rather than one big-bang rewrite.

## Consequences

### Positive

- One deploy target (the existing web pipeline) instead of three.
- ~29 fewer dependencies; no native toolchain, no Docker/Gradle image, no keystore to rotate.
- Faster first load — `@shopify/react-native-skia`'s WASM alone was 2.8 MB.
- `Modal` now renders as a native `<dialog>` (free focus trap + ESC-to-close), an accessibility upgrade over the RN Modal it replaced.
- CI's Android emulator smoke test is replaced by a Playwright test against the same Firebase RTDB emulator — faster and doesn't need an emulator image.

### Negative

- No more app-store presence — installs now require a user to find the site and explicitly "Add to Home Screen"; there's no Play Store search discovery.
- iOS has no `beforeinstallprompt` and no `navigator.vibrate` — haptics are silently unavailable there, permanently, and install requires an in-app instruction card rather than a one-tap prompt.
- iOS Safari evicts `localStorage` after 7 days of non-use for sites that were never installed — session credentials stored there can be lost for a lapsed non-installed player. Installed PWAs are exempt.
- `@dabb/rn-compat` is a maintenance surface of its own: any new RN-shaped component or style property used in future work needs a corresponding shim entry, and its ceiling (new components inherit RN flex-column box defaults) is documented at the top of the package.

## Related

- Supersedes ADR 010 (custom development build instead of Expo Go — moot once there's no native build).
- [web.dev: Add to Home Screen](https://web.dev/learn/pwa/installation)
- [MDN: Using service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
