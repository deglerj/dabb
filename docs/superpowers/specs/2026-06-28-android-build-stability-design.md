# Android Build Stability — Design Spec

**Date:** 2026-06-28  
**Status:** Approved

---

## Problem

The Android build pipeline (`build-apk.sh`, `build-aab.sh`) applies four fragile patches after every `expo prebuild --clean`. Any Expo SDK upgrade can break one or more patches silently. Local Android dev is also broken (Java 26 vs Gradle 9.0.0 incompatibility).

**Current patch stack (applied after every prebuild):**

| Patch                                    | Mechanism                                 | Fragility                                                         |
| ---------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| foojay-resolver-convention 0.5.0 → 1.0.0 | `sed` on `node_modules/`                  | node_modules is ephemeral                                         |
| `gradle.properties` flags                | `printf` with trailing-newline workaround | Expo SDK 56 bug coupling                                          |
| Release signing + versionCode            | 50-line Python regex on `build.gradle`    | Breaks if prebuild template changes                               |
| Hermes symlink for pnpm                  | `find`/`ln` in build script               | Path fragile, runs on every build                                 |
| Gradle wrapper → 9.6.0                   | `sed` on wrapper properties               | **Dead-end — causes Kotlin 2.1/2.2 incompatibility, must revert** |

---

## Approach

Keep CNG (`expo prebuild --platform android --clean` on every build). Move each patch to its proper home so it auto-applies and is upgrade-stable.

**Web is a primary platform — Expo stays.**

---

## Architecture

### 1. foojay — pnpm native patch

Use `pnpm patch` to create a committed diff under `.patches/`. Applies automatically on every `pnpm install`. Replaces `sed` on `node_modules/`.

**File created:** `.patches/@react-native__gradle-plugin@<X.Y.Z>.patch` (X.Y.Z = the version currently installed, e.g. `0.76.9`)  
**Change:** `foojay-resolver-convention").version("0.5.0")` → `...version("1.0.0")`

### 2. Gradle properties — `withGradleProperties` config plugin

**File:** `apps/client/plugins/withGradleProperties.ts`

Sets after every prebuild:

- `org.gradle.daemon=false`
- `org.gradle.java.installations.auto-download=false`
- `org.gradle.java.installations.fromEnv=JAVA_HOME`

`withGradleProperties` manages the file properly — eliminates the trailing-newline workaround.

### 3. Signing + versionCode — `withAndroidSigning` config plugin

**File:** `apps/client/plugins/withAndroidSigning.ts`

Uses `withAppBuildGradle` to insert once (idempotent guard):

- A `release` signingConfig block reading credentials from env vars **at Gradle run time** (not prebuild time)
- versionCode expression: reads `-PversionCode` Gradle property with fallback to `1`

CI passes `VERSION_CODE` to Docker (unchanged). Build script passes it to Gradle: `-PversionCode=${VERSION_CODE}`.

Signing env vars (`SIGNING_KEYSTORE_PATH`, `SIGNING_STORE_PASSWORD`, `SIGNING_KEY_ALIAS`, `SIGNING_KEY_PASSWORD`) remain in Docker env, read by Gradle directly — no file patching.

Replaces the 50-line Python block.

### 4. Hermes + Skia — postinstall consolidation

- **Hermes symlink fix** → root `package.json` `postinstall` (workspace-level, pnpm store paths are relative to workspace root; Linux-only guard)
- **`npx install-skia`** → `apps/client/package.json` `postinstall` (client-specific; extend the existing `postinstall` one-liner already there)

Both run once on `pnpm install`, not on every build. Replaces inline logic in both build scripts.

### 5. Gradle wrapper version — revert

Remove the Gradle 9.6.0 `sed` patches from `build-apk.sh` and `build-aab.sh`. Docker image already uses `eclipse-temurin:21-jdk-jammy` (Java 21). Gradle 9.0.0 + Java 21 is compatible. The 9.6.0 upgrade caused Kotlin 2.1/2.2 metadata incompatibility with RN 0.86's Gradle plugin — dead end.

---

## Config Plugin Registration

`apps/client/app.json`:

```json
"plugins": [
  "expo-navigation-bar",
  "./plugins/withGradleProperties",
  "./plugins/withAndroidSigning"
]
```

---

## Build Scripts After

**build-apk.sh:**

```
pnpm install --frozen-lockfile   ← foojay patch + Hermes + Skia run here
pnpm run build
cd apps/client && npx expo prebuild --platform android --clean   ← config plugins run here
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=...
copy APK
```

**build-aab.sh:**

```
pnpm install --frozen-lockfile
pnpm run build
cd apps/client && npx expo prebuild --platform android --clean
cd android && ./gradlew bundleRelease -PversionCode=${VERSION_CODE} -PreactNativeArchitectures=... [other flags]
copy AAB
```

**Removed from both scripts:** foojay sed, Gradle wrapper sed, printf to gradle.properties, find/ln Hermes, install-skia, Python signing block.

**Dockerfile:** no changes (already Java 21).

**CI workflows:** no changes (env vars already passed through Docker).

---

## Local Dev Setup

One-time per developer machine:

```bash
sudo pacman -S jdk21-openjdk
```

```properties
# ~/.gradle/gradle.properties
org.gradle.java.home=/usr/lib/jvm/java-21-openjdk
```

System Java stays at 26. Gradle builds use Java 21.

```bash
cd apps/client
npx expo run:android   # works after setup
```

Document in `DEPLOYMENT.md` under "Local Android Development".

---

## Expo SDK Upgrade Path

On next SDK upgrade:

1. `pnpm install` (pnpm re-applies foojay patch automatically, or regenerate with `pnpm patch` if version changed)
2. `npx expo prebuild --platform android --clean` (config plugins re-apply)
3. Verify build passes

No shell script changes needed unless Expo fundamentally changes the `build.gradle` template structure (in which case `withAndroidSigning` needs updating — but it's TypeScript, not regex in a bash heredoc).

---

## Files Changed

| File                                                    | Action                                     |
| ------------------------------------------------------- | ------------------------------------------ |
| `apps/client/scripts/build-apk.sh`                      | Remove 6 patch steps                       |
| `apps/client/scripts/build-aab.sh`                      | Remove 6 patch steps + Python block        |
| `apps/client/plugins/withGradleProperties.ts`           | **New**                                    |
| `apps/client/plugins/withAndroidSigning.ts`             | **New**                                    |
| `apps/client/app.json`                                  | Add 2 plugin entries                       |
| `package.json` (root)                                   | Add postinstall for Hermes symlink fix     |
| `apps/client/package.json`                              | Extend postinstall to add `install-skia`   |
| `.patches/@react-native__gradle-plugin@<version>.patch` | **New** (generated by `pnpm patch-commit`) |
| `pnpm-lock.yaml`                                        | Updated by pnpm patch-commit               |
| `DEPLOYMENT.md`                                         | Add local Android dev section              |
| `BUILD_HANDOVER.md`                                     | Delete (resolved)                          |
