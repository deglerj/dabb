#!/bin/bash
# Build script for Dabb Android APK
# Runs inside the Docker container (same for local and CI builds)
# Usage: build-apk.sh [variant] [architectures]
#   variant: debug (default, dev-client launcher, needs Metro) | standalone
#            (non-debuggable, bundled JS, debug-keystore signed — for CI
#            smoke tests that install and run the APK with no Metro server)
#   architectures: comma-separated reactNativeArchitectures list.
#            Default armeabi-v7a,arm64-v8a,x86_64 (real devices). The
#            standalone/smoke-test build only ever installs on the x86_64
#            emulator, so it passes x86_64 alone to avoid compiling native
#            code for two ABIs nothing will ever run on.
set -euo pipefail

VARIANT="${1:-debug}"
VARIANT_CAP="$(tr '[:lower:]' '[:upper:]' <<< "${VARIANT:0:1}")${VARIANT:1}"
ARCHITECTURES="${2:-armeabi-v7a,arm64-v8a,x86_64}"

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building workspace packages..."
pnpm run build

echo "==> Generating native Android project..."
cd apps/client
npx expo prebuild --platform android --clean

echo "==> Building APK with Gradle (variant: ${VARIANT}, architectures: ${ARCHITECTURES})..."
cd android
./gradlew "assemble${VARIANT_CAP}" -PreactNativeArchitectures="${ARCHITECTURES}"

echo "==> Copying APK to output directory..."
cd /app/apps/client
mkdir -p build
cp "android/app/build/outputs/apk/${VARIANT}/app-${VARIANT}.apk" build/dabb.apk

echo "==> Build complete: apps/client/build/dabb.apk"
