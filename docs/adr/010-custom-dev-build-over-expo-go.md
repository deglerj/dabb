# ADR 010: Custom Development Build Instead of Expo Go

## Status

Accepted

## Date

2026-04-15

## Context

The app uses `@shopify/react-native-skia` (v2+) for card rendering and `react-native-reanimated` v4 for animations. Both require native modules that are not reliably available in Expo Go:

- Skia v2+ is not bundled in Expo Go at all — its native renderer is absent.
- Even where Expo Go bundles Skia, known rendering bugs (transparent paths, color issues) make it unsuitable for production-grade use.

The original development workflow used `expo start --go`, forcing Expo Go. This caused a runtime error (`react-native-reanimated is not installed!`) and broken routes whenever the app was started in dev mode on Android.

## Decision

Remove the `--go` flag from `dev.sh`'s Expo start command. Developers must build a custom development APK via `./dev.sh apk` and install it once. Subsequent development sessions use Metro for fast JS-only hot-reloading against that installed APK.

## Consequences

### Positive

- App runs correctly on device — Skia and Reanimated native modules are properly compiled in.
- The hot-reload workflow is unchanged after the initial APK install.
- No risk of Expo Go version drift causing subtle native module mismatches.

### Negative

- One-time APK build required before first device test (takes several minutes in Docker).
- Cannot scan a QR code from scratch on a new device without first installing the dev APK.
- Expo Go's instant onboarding experience is lost.

## Related

- [React Native Skia installation docs](https://shopify.github.io/react-native-skia/docs/getting-started/installation/)
- [Expo development builds introduction](https://docs.expo.dev/develop/development-builds/introduction/)
