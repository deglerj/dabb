# Android Build Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragile post-prebuild shell patches with idiomatic mechanisms so `expo prebuild --clean` is safe to run without any manual fixups.

**Architecture:** Two Expo config plugins (`withGradleProperties`, `withAndroidSigning`) auto-apply after every prebuild. Hermes and Skia setup moves to `postinstall`. Dead-end Gradle 9.6.0 patches are reverted; foojay sed is removed (already a no-op — `@react-native/gradle-plugin@0.86.0` ships foojay 1.0.0).

**Tech Stack:** Expo SDK 56, React Native 0.86, `expo/config-plugins`, pnpm workspaces, Gradle 9.0.0, Docker (eclipse-temurin:21-jdk-jammy)

## Global Constraints

- Never modify `node_modules/` directly in build scripts
- All config plugins live in `apps/client/plugins/`
- Config plugins must be idempotent (safe to run multiple times)
- `android/` is gitignored — never commit it
- TypeScript strict mode is enabled
- Signing credentials (`SIGNING_KEYSTORE_PATH`, `SIGNING_STORE_PASSWORD`, `SIGNING_KEY_ALIAS`, `SIGNING_KEY_PASSWORD`) are env vars available at Gradle run time (inside Docker) — read them in Gradle, not at prebuild time

---

## File Map

| File                                          | Action     | Responsibility                                                             |
| --------------------------------------------- | ---------- | -------------------------------------------------------------------------- |
| `apps/client/scripts/build-apk.sh`            | Modify     | Remove 5 patch steps                                                       |
| `apps/client/scripts/build-aab.sh`            | Modify     | Remove 5 patch steps + Python signing block; add `-PversionCode` flag      |
| `apps/client/plugins/withGradleProperties.ts` | **Create** | Inject Gradle daemon/Java-installation properties after every prebuild     |
| `apps/client/plugins/withAndroidSigning.ts`   | **Create** | Inject release signingConfig and dynamic versionCode into app/build.gradle |
| `apps/client/app.json`                        | Modify     | Register the two new config plugins                                        |
| `package.json` (root)                         | Modify     | Extend postinstall to run Hermes symlink fix                               |
| `scripts/fix-hermes.sh`                       | **Create** | Linux-only Hermes symlink fix, extracted from build scripts                |
| `apps/client/package.json`                    | Modify     | Extend postinstall to run `install-skia`                                   |
| `DEPLOYMENT.md`                               | Modify     | Add "Local Android Development" section                                    |
| `BUILD_HANDOVER.md`                           | **Delete** | Resolved                                                                   |

---

## Task 1: Revert dead-end patches from build scripts

Both build scripts have two patches that should be removed:

- **Gradle 9.6.0 sed** — dead-end, causes Kotlin 2.1/2.2 incompatibility with RN 0.86 Gradle plugin
- **foojay sed** — no-op since `@react-native/gradle-plugin@0.86.0` already ships foojay 1.0.0

**Files:**

- Modify: `apps/client/scripts/build-apk.sh`
- Modify: `apps/client/scripts/build-aab.sh`

- [ ] **Step 1: Remove foojay and Gradle 9.6.0 patches from build-apk.sh**

Replace the full file with this content:

```bash
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
```

- [ ] **Step 2: Remove foojay and Gradle 9.6.0 patches from build-aab.sh**

Replace the full file with this content (note: Hermes fix, Python signing block, and `npx install-skia` remain for now — they are removed in Task 5):

```bash
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
```

- [ ] **Step 3: Verify the sed patches are gone**

```bash
grep -n "9.6.0\|foojay" apps/client/scripts/build-apk.sh apps/client/scripts/build-aab.sh
```

Expected: no output (no matches).

- [ ] **Step 4: Commit**

```bash
git add apps/client/scripts/build-apk.sh apps/client/scripts/build-aab.sh
git commit -m "fix(android): remove dead-end Gradle 9.6.0 and no-op foojay patches from build scripts"
```

---

## Task 2: Create `withGradleProperties` config plugin

Replaces the `printf` to `android/gradle.properties` in the build scripts. The `withGradleProperties` modifier manages file writes correctly, eliminating the trailing-newline workaround.

**Files:**

- Create: `apps/client/plugins/withGradleProperties.ts`
- Modify: `apps/client/app.json`

- [ ] **Step 1: Create the plugins directory and plugin file**

```bash
mkdir -p apps/client/plugins
```

Create `apps/client/plugins/withGradleProperties.ts`:

```typescript
import { ConfigPlugin, withGradleProperties } from 'expo/config-plugins';

const withAndroidGradleProperties: ConfigPlugin = (config) =>
  withGradleProperties(config, (config) => {
    const props = config.modResults;
    const settings = [
      { key: 'org.gradle.daemon', value: 'false' },
      { key: 'org.gradle.java.installations.auto-download', value: 'false' },
      { key: 'org.gradle.java.installations.fromEnv', value: 'JAVA_HOME' },
    ];
    for (const { key, value } of settings) {
      const idx = props.findIndex((p) => p.type === 'property' && 'key' in p && p.key === key);
      if (idx !== -1) props.splice(idx, 1);
      props.push({ type: 'property', key, value });
    }
    return config;
  });

export default withAndroidGradleProperties;
```

- [ ] **Step 2: Register the plugin in app.json**

Edit `apps/client/app.json` — replace the `plugins` array:

```json
"plugins": ["expo-navigation-bar", "./plugins/withGradleProperties"]
```

- [ ] **Step 3: Verify plugin applies during prebuild**

```bash
cd apps/client
npx expo prebuild --platform android --clean 2>&1 | tail -5
grep -E "org.gradle.daemon|java.installations" android/gradle.properties
```

Expected grep output (order may vary):

```
org.gradle.daemon=false
org.gradle.java.installations.auto-download=false
org.gradle.java.installations.fromEnv=JAVA_HOME
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd apps/client
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client/plugins/withGradleProperties.ts apps/client/app.json
git commit -m "feat(android): withGradleProperties config plugin replaces printf patch"
```

---

## Task 3: Create `withAndroidSigning` config plugin

Replaces the 50-line Python block in `build-aab.sh`. The plugin inserts the release signingConfig block and dynamic versionCode expression once, during prebuild. Credentials are env vars read by Gradle at build time — not baked into any file.

The generated `android/app/build.gradle` structure (confirmed from current prebuild output):

- Line ~95: `versionCode 1`
- Line ~100: `signingConfigs { debug { ... } }`
- Line ~108: `buildTypes { debug { ... } release { // Caution! ...\n signingConfig signingConfigs.debug ... } }`

**Files:**

- Create: `apps/client/plugins/withAndroidSigning.ts`
- Modify: `apps/client/app.json`

- [ ] **Step 1: Create the plugin**

Create `apps/client/plugins/withAndroidSigning.ts`:

```typescript
import { ConfigPlugin, withAppBuildGradle } from 'expo/config-plugins';

const withAndroidSigning: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Idempotent: already patched
    if (contents.includes('signingConfig signingConfigs.release')) {
      return config;
    }

    // 1. Insert release signingConfig block at start of signingConfigs {}
    const releaseSigningBlock = [
      '',
      '        release {',
      '            storeFile file(System.getenv("SIGNING_KEYSTORE_PATH") ?: "")',
      '            storePassword System.getenv("SIGNING_STORE_PASSWORD") ?: ""',
      '            keyAlias System.getenv("SIGNING_KEY_ALIAS") ?: ""',
      '            keyPassword System.getenv("SIGNING_KEY_PASSWORD") ?: ""',
      '        }',
    ].join('\n');

    contents = contents.replace(
      '    signingConfigs {',
      `    signingConfigs {${releaseSigningBlock}`
    );

    // 2. Switch release buildType from debug signing to release signing.
    //    Anchor: the "Caution!" comment that precedes signingConfig in the release block.
    contents = contents.replace(
      /(\/\/ Caution! In production[\s\S]*?signed-apk-android\.[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
      '$1signingConfig signingConfigs.release'
    );

    // 3. Dynamic versionCode: read from Gradle property (-PversionCode=N), default 1
    contents = contents.replace(
      /versionCode \d+/,
      "versionCode (project.hasProperty('versionCode') ? project.property('versionCode').toInteger() : 1)"
    );

    if (!contents.includes('signingConfig signingConfigs.release')) {
      throw new Error(
        'withAndroidSigning: failed to inject release signingConfig — expo prebuild template may have changed'
      );
    }

    config.modResults.contents = contents;
    return config;
  });

export default withAndroidSigning;
```

- [ ] **Step 2: Register the plugin in app.json**

Edit `apps/client/app.json` — replace the `plugins` array:

```json
"plugins": ["expo-navigation-bar", "./plugins/withGradleProperties", "./plugins/withAndroidSigning"]
```

- [ ] **Step 3: Verify plugin applies during prebuild**

```bash
cd apps/client
npx expo prebuild --platform android --clean 2>&1 | tail -5
grep -n "signingConfig signingConfigs.release\|SIGNING_KEYSTORE_PATH\|project.hasProperty.*versionCode" android/app/build.gradle
```

Expected output (line numbers will vary):

```
105:            storeFile file(System.getenv("SIGNING_KEYSTORE_PATH") ?: "")
116:            signingConfig signingConfigs.release
100:            versionCode (project.hasProperty('versionCode') ? project.property('versionCode').toInteger() : 1)
```

Exact line numbers don't matter — what matters is all three patterns appear.

- [ ] **Step 4: Verify idempotency (run prebuild a second time)**

```bash
npx expo prebuild --platform android --clean 2>&1 | tail -3
grep -c "signingConfig signingConfigs.release" android/app/build.gradle
```

Expected: `grep -c` outputs `1` (not 2 — idempotent guard worked).

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/client
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/client/plugins/withAndroidSigning.ts apps/client/app.json
git commit -m "feat(android): withAndroidSigning config plugin replaces Python signing patch"
```

---

## Task 4: Postinstall consolidation (Hermes + Skia)

Move per-build setup that belongs in `pnpm install` to postinstall scripts. Hermes symlink fix (workspace-level, Linux-only) goes to root `postinstall`. Skia binary download (client-only) goes to `apps/client/postinstall`.

**Files:**

- Create: `scripts/fix-hermes.sh`
- Modify: `package.json` (root)
- Modify: `apps/client/package.json`

- [ ] **Step 1: Create scripts/fix-hermes.sh**

```bash
#!/bin/bash
# Fix Hermes hermesc symlink for pnpm monorepo on Linux.
# pnpm puts hermes-compiler in a sibling dir of react-native in the content store;
# React Native's build expects hermesc at react-native/sdks/hermesc.
# Only needed on Linux; macOS ships hermesc differently.

if [ "$(uname)" != "Linux" ]; then exit 0; fi

RN_DIR=$(find node_modules/.pnpm -type d -name "react-native" -path "*react-native@*/node_modules/react-native" 2>/dev/null | head -1)
if [ -z "$RN_DIR" ]; then
    echo "fix-hermes: react-native not found in .pnpm store, skipping"
    exit 0
fi

HERMES_COMPILER=$(dirname "$RN_DIR")/hermes-compiler
if [ ! -d "$HERMES_COMPILER" ]; then
    echo "fix-hermes: hermes-compiler not found, skipping"
    exit 0
fi

mkdir -p "$RN_DIR/sdks"
ln -sf "../../hermes-compiler/hermesc" "$RN_DIR/sdks/hermesc"
chmod +x "$RN_DIR/sdks/hermesc/linux64-bin/hermesc"
echo "fix-hermes: symlink created at $RN_DIR/sdks/hermesc"
```

Make it executable:

```bash
chmod +x scripts/fix-hermes.sh
```

- [ ] **Step 2: Extend root package.json postinstall**

In `package.json` (root), change:

```json
"postinstall": "node scripts/generate-licenses.mjs"
```

to:

```json
"postinstall": "node scripts/generate-licenses.mjs && bash scripts/fix-hermes.sh"
```

- [ ] **Step 3: Extend apps/client/package.json postinstall to add install-skia**

In `apps/client/package.json`, change:

```json
"postinstall": "node -e \"const fs=require('fs');fs.mkdirSync('public',{recursive:true});fs.copyFileSync('../../node_modules/canvaskit-wasm/bin/full/canvaskit.wasm','public/canvaskit.wasm')\""
```

to:

```json
"postinstall": "node -e \"const fs=require('fs');fs.mkdirSync('public',{recursive:true});fs.copyFileSync('../../node_modules/canvaskit-wasm/bin/full/canvaskit.wasm','public/canvaskit.wasm')\" && npx install-skia"
```

- [ ] **Step 4: Verify postinstall runs correctly**

```bash
pnpm install
```

Expected: completes without error. On Linux you should see `fix-hermes:` output and `install-skia` output in the postinstall phase.

- [ ] **Step 5: Commit**

```bash
git add scripts/fix-hermes.sh package.json apps/client/package.json
git commit -m "feat(android): move Hermes symlink fix and install-skia to postinstall"
```

---

## Task 5: Simplify build scripts (final cleanup)

Now that config plugins handle gradle.properties and signing, and postinstall handles Hermes and Skia, remove all remaining patch steps from both build scripts.

**Files:**

- Modify: `apps/client/scripts/build-apk.sh`
- Modify: `apps/client/scripts/build-aab.sh`

- [ ] **Step 1: Rewrite build-apk.sh**

Replace `apps/client/scripts/build-apk.sh` entirely:

```bash
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
```

- [ ] **Step 2: Rewrite build-aab.sh**

Replace `apps/client/scripts/build-aab.sh` entirely:

```bash
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
```

- [ ] **Step 3: Verify scripts have no traces of old patches**

```bash
grep -n "sed\|printf\|python3\|foojay\|9\.6\.0\|install-skia\|fix-hermes\|HERMES\|RN_DIR" \
  apps/client/scripts/build-apk.sh apps/client/scripts/build-aab.sh
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/client/scripts/build-apk.sh apps/client/scripts/build-aab.sh
git commit -m "refactor(android): simplify build scripts — patches replaced by config plugins and postinstall"
```

---

## Task 6: Docs and cleanup

- [ ] **Step 1: Add local Android development section to DEPLOYMENT.md**

In `DEPLOYMENT.md`, insert after the `## Android Deployment (Automated)` section and before `## Firebase Setup`:

````markdown
## Local Android Development

**Prerequisites (one-time setup per machine):**

1. Install JDK 21:
   ```bash
   sudo pacman -S jdk21-openjdk
   ```
````

2. Tell Gradle to use it (system Java can stay at 26):

   ```properties
   # ~/.gradle/gradle.properties
   org.gradle.java.home=/usr/lib/jvm/java-21-openjdk
   ```

3. Install dependencies (also runs Hermes and Skia setup):

   ```bash
   pnpm install
   ```

4. Run on a connected device or emulator:
   ```bash
   cd apps/client
   npx expo run:android
   ```

**Why JDK 21?** Expo SDK 56 ships Gradle 9.0.0, which requires Java ≤ 21. The build environment (Docker) uses Java 21 via `eclipse-temurin:21-jdk-jammy`; local dev needs the same.

````

- [ ] **Step 2: Delete BUILD_HANDOVER.md**

```bash
rm BUILD_HANDOVER.md
````

- [ ] **Step 3: Commit**

```bash
git add DEPLOYMENT.md
git rm BUILD_HANDOVER.md
git commit -m "docs: add local Android dev setup to DEPLOYMENT.md, remove resolved BUILD_HANDOVER.md"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `grep -r "9\.6\.0\|foojay" apps/client/scripts/` → no output
- [ ] `grep "withGradleProperties\|withAndroidSigning" apps/client/app.json` → both present
- [ ] `ls apps/client/plugins/` → `withGradleProperties.ts  withAndroidSigning.ts`
- [ ] `grep "fix-hermes" package.json` → present in postinstall
- [ ] `grep "install-skia" apps/client/package.json` → present in postinstall
- [ ] `wc -l apps/client/scripts/build-apk.sh` → ~20 lines (was ~67)
- [ ] `wc -l apps/client/scripts/build-aab.sh` → ~30 lines (was ~121)
- [ ] `BUILD_HANDOVER.md` → file deleted
