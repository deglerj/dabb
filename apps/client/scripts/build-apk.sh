#!/bin/bash
# Build script for Dabb Android APK
# Runs inside the Docker container (same for local and CI builds)
set -euo pipefail

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building workspace packages..."
pnpm run build

echo "==> Generating native Android project..."
cd apps/client
npx expo prebuild --platform android --clean

echo "==> Building APK with Gradle..."
cd android
./gradlew assembleDebug -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86_64

echo "==> Copying APK to output directory..."
cd /app/apps/client
mkdir -p build
cp android/app/build/outputs/apk/debug/app-debug.apk build/dabb.apk

echo "==> Build complete: apps/client/build/dabb.apk"
