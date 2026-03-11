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

echo "==> Patching foojay-resolver-convention for Gradle 9 + JDK 21 compatibility..."
# @react-native/gradle-plugin ships foojay-resolver-convention 0.5.0 which references
# JvmVendorSpec.IBM_SEMERU — removed in Gradle 9. Upgrade to 1.0.0 to fix the build.
sed -i 's/foojay-resolver-convention").version("0.5.0")/foojay-resolver-convention").version("1.0.0")/' \
    node_modules/@react-native/gradle-plugin/settings.gradle.kts

echo "==> Building workspace packages..."
pnpm run build

echo "==> Generating native Android project..."
cd apps/mobile
npx expo prebuild --platform android --clean

echo "==> Patching Android build.gradle for @react-native-async-storage/async-storage v3..."
# async-storage v3 ships a native Kotlin Multiplatform AAR in a local maven repo.
# The repo path must be registered so Gradle can resolve org.asyncstorage.shared_storage:storage-android.
python3 - <<'EOF'
import re
path = 'android/build.gradle'
with open(path, 'r') as f:
    content = f.read()
addition = (
    "    maven { url 'https://www.jitpack.io' }\n"
    "    maven {\n"
    "      // Required for @react-native-async-storage/async-storage v3\n"
    '      url "${rootDir}/../../../node_modules/@react-native-async-storage/async-storage/android/local_repo"\n'
    "    }"
)
content = content.replace("    maven { url 'https://www.jitpack.io' }", addition)
with open(path, 'w') as f:
    f.write(content)
print("    Patched apps/mobile/android/build.gradle")
EOF

echo "==> Patching gradle.properties to increase JVM memory for async-storage v3 KSP/Room compilation..."
# async-storage v3 uses KSP + Room which increases class metadata (Metaspace) usage significantly.
# Override org.gradle.jvmargs to raise Metaspace limit.
sed -i 's/^org\.gradle\.jvmargs=.*/org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError/' \
    android/gradle.properties

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
# expo prebuild --clean regenerates build.gradle with a debug signingConfig for release builds.
# This script patches it to use the real upload keystore and the supplied versionCode.
python3 - <<'PYTHON'
import re, os, sys

keystore_path  = os.environ['SIGNING_KEYSTORE_PATH']
store_password = os.environ['SIGNING_STORE_PASSWORD']
key_alias      = os.environ['SIGNING_KEY_ALIAS']
key_password   = os.environ['SIGNING_KEY_PASSWORD']
version_code   = os.environ['VERSION_CODE']

gradle_file = 'apps/mobile/android/app/build.gradle'
with open(gradle_file) as f:
    content = f.read()

# 1. Override versionCode with the value from CI
content = re.sub(r'versionCode \d+', f'versionCode {version_code}', content)

# 2. Insert a release signingConfig block at the top of signingConfigs {}.
#    Placement before debug is fine — Gradle doesn't care about config order.
release_block = (
    f"\n        release {{\n"
    f"            storeFile file('{keystore_path}')\n"
    f"            storePassword '{store_password}'\n"
    f"            keyAlias '{key_alias}'\n"
    f"            keyPassword '{key_password}'\n"
    f"        }}"
)
content = content.replace('    signingConfigs {', '    signingConfigs {' + release_block, 1)

# 3. Switch the release buildType from debug signing to release signing.
#    The "Caution! In production" comment is a stable anchor in the expo prebuild template.
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
cd apps/mobile/android
./gradlew bundleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a

echo "==> Copying AAB to output..."
cd /app/apps/mobile
mkdir -p build
cp android/app/build/outputs/bundle/release/app-release.aab build/dabb.aab

echo "==> Build complete: apps/mobile/build/dabb.aab"
