#!/bin/bash
# Build script for Dabb Android APK
# Runs inside the Docker container (same for local and CI builds)
set -euo pipefail

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Patching foojay-resolver-convention for Gradle 9 + JDK 21 compatibility..."
# @react-native/gradle-plugin ships foojay-resolver-convention 0.5.0 which references
# JvmVendorSpec.IBM_SEMERU — removed in Gradle 9. Upgrade to 1.0.0 to fix the build.
sed -i 's/foojay-resolver-convention").version("0.5.0")/foojay-resolver-convention").version("1.0.0")/' \
    node_modules/@react-native/gradle-plugin/settings.gradle.kts

echo "==> Building workspace packages..."
pnpm run build

echo "==> Generating native Android project..."
cd apps/client
npx expo prebuild --platform android --clean

echo "==> Configuring Gradle properties..."
# Disable JDK toolchain auto-download: React Native's Gradle plugin declares a Java toolchain
# requirement and Gradle 9's foojay resolver tries to download it from the internet, which
# hangs in container environments. Point it at the JDK already installed in the image instead.
echo "org.gradle.daemon=false" >> android/gradle.properties
echo "org.gradle.java.installations.auto-download=false" >> android/gradle.properties
echo "org.gradle.java.installations.fromEnv=JAVA_HOME" >> android/gradle.properties

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

echo "==> Installing Skia prebuilt binaries..."
cd /app/apps/client
npx install-skia
cd /app

echo "==> Building APK with Gradle..."
cd apps/client/android
./gradlew assembleDebug -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86_64

echo "==> Copying APK to output directory..."
cd /app/apps/client
mkdir -p build
cp android/app/build/outputs/apk/debug/app-debug.apk build/dabb.apk

echo "==> Build complete: apps/client/build/dabb.apk"
