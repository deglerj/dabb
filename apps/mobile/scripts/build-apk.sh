#!/bin/bash
# Build script for Dabb Android APK
# Runs inside the Docker container (same for local and CI builds)
set -euo pipefail

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building workspace packages..."
pnpm run build

echo "==> Generating native Android project..."
cd apps/mobile
npx expo prebuild --platform android --clean

echo "==> Fixing Hermes path for pnpm..."
cd /app
RN_DIR=$(find node_modules/.pnpm -type d -name "react-native" -path "*react-native@*/node_modules/react-native" 2>/dev/null | head -1)
if [ -n "$RN_DIR" ]; then
    HERMES_COMPILER=$(dirname "$RN_DIR")/hermes-compiler
    if [ -d "$HERMES_COMPILER" ]; then
        mkdir -p "$RN_DIR/sdks"
        ln -sf "../../hermes-compiler/hermesc" "$RN_DIR/sdks/hermesc"
        echo "    Created Hermes symlink: $RN_DIR/sdks/hermesc"
        chmod +x "$RN_DIR/sdks/hermesc/linux64-bin/hermesc"
    else
        echo "    hermes-compiler not found (may not be needed)"
    fi
else
    echo "    react-native directory not found in pnpm store"
fi

echo "==> Building APK with Gradle..."
cd apps/mobile/android
./gradlew assembleRelease

echo "==> Copying APK to output directory..."
cd /app/apps/mobile
mkdir -p build
cp android/app/build/outputs/apk/release/app-release.apk build/dabb.apk

echo "==> Build complete: apps/mobile/build/dabb.apk"
