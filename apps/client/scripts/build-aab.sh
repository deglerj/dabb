#!/bin/bash
# Build script for Dabb Android AAB (Play Store release)
# Runs inside the Docker container; source is bind-mounted at /app
#
# Required environment variables:
#   SIGNING_KEYSTORE_PATH  - Path to the .jks upload keystore (inside container)
#   SIGNING_STORE_PASSWORD - Keystore password
#   SIGNING_KEY_ALIAS      - Key alias within the keystore
#   SIGNING_KEY_PASSWORD   - Key password
#   VERSION_CODE           - Android versionCode (must be strictly greater than previous release)
set -euo pipefail

: "${SIGNING_KEYSTORE_PATH:?SIGNING_KEYSTORE_PATH must be set}"
: "${SIGNING_STORE_PASSWORD:?SIGNING_STORE_PASSWORD must be set}"
: "${SIGNING_KEY_ALIAS:?SIGNING_KEY_ALIAS must be set}"
: "${SIGNING_KEY_PASSWORD:?SIGNING_KEY_PASSWORD must be set}"
: "${VERSION_CODE:?VERSION_CODE must be set}"

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building workspace packages..."
pnpm run build

echo "==> Generating native Android project..."
cd apps/client
npx expo prebuild --platform android --clean

echo "==> Building AAB with Gradle..."
cd android
./gradlew bundleRelease \
  -PversionCode="${VERSION_CODE}" \
  -PreactNativeArchitectures=armeabi-v7a,arm64-v8a \
  -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=512m" \
  -x lintVitalRelease \
  --no-daemon

echo "==> Copying AAB to output..."
cd /app/apps/client
mkdir -p build
cp android/app/build/outputs/bundle/release/app-release.aab build/dabb.aab

echo "==> Build complete: apps/client/build/dabb.aab"
