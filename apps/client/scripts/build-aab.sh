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

echo "==> Configuring Gradle properties..."
printf '\norg.gradle.daemon=false\norg.gradle.java.installations.auto-download=false\norg.gradle.java.installations.fromEnv=JAVA_HOME\n' >> android/gradle.properties

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

echo "==> Patching build.gradle for release signing (versionCode=${VERSION_CODE})..."
python3 - <<'PYTHON'
import re, os, sys

keystore_path  = os.environ['SIGNING_KEYSTORE_PATH']
store_password = os.environ['SIGNING_STORE_PASSWORD']
key_alias      = os.environ['SIGNING_KEY_ALIAS']
key_password   = os.environ['SIGNING_KEY_PASSWORD']
version_code   = os.environ['VERSION_CODE']

gradle_file = 'apps/client/android/app/build.gradle'
with open(gradle_file) as f:
    content = f.read()

content = re.sub(r'versionCode \d+', f'versionCode {version_code}', content)

release_block = (
    f"\n        release {{\n"
    f"            storeFile file('{keystore_path}')\n"
    f"            storePassword '{store_password}'\n"
    f"            keyAlias '{key_alias}'\n"
    f"            keyPassword '{key_password}'\n"
    f"        }}"
)
content = content.replace('    signingConfigs {', '    signingConfigs {' + release_block, 1)

content = re.sub(
    r'(// Caution! In production.*?signed-apk-android\.[^\n]*\n\s+)signingConfig signingConfigs\.debug',
    r'\1signingConfig signingConfigs.release',
    content,
    flags=re.DOTALL,
    count=1,
)

if 'signingConfig signingConfigs.release' not in content:
    print('ERROR: Failed to patch release signingConfig — expo prebuild template may have changed',
          file=sys.stderr)
    sys.exit(1)

with open(gradle_file, 'w') as f:
    f.write(content)

print(f'    versionCode={version_code}, release buildType now uses signingConfig.release')
PYTHON

echo "==> Building AAB with Gradle..."
cd apps/client/android
./gradlew bundleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a \
  -Dorg.gradle.jvmargs="-Xmx4g -XX:MaxMetaspaceSize=512m" \
  -x lintVitalRelease \
  --no-daemon

echo "==> Copying AAB to output..."
cd /app/apps/client
mkdir -p build
cp android/app/build/outputs/bundle/release/app-release.aab build/dabb.aab

echo "==> Build complete: apps/client/build/dabb.aab"
