# Android Startup Smoke Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CI job that boots a real Android emulator, installs the app's debug APK, and runs a Maestro UI flow that launches the app, creates an online session, and joins it — catching native startup crashes (async-storage/reanimated-class incompatibilities) that `vitest`/`tsc` can't reach.

**Architecture:** App code gains an opt-in Firebase RTDB Local Emulator connection (env-flag gated). A handful of `testID`s are added to `HomeScreen`/`WaitingRoomScreen` so a Maestro YAML flow can target elements reliably. CI gets a second Android APK build job (smoke-test config) and a new job that boots an `ubuntu-latest` KVM-accelerated emulator, starts the Firebase RTDB emulator, and runs the Maestro flow against the installed APK.

**Tech Stack:** Maestro (E2E flow runner), `firebase-tools` (Local Emulator Suite), `ReactiveCircus/android-emulator-runner` (GitHub Action), existing Docker-based Android build (`apps/client/Dockerfile.android`, `apps/client/scripts/build-apk.sh`).

## Global Constraints

- Android only this pass — no iOS (needs macOS runners, separate future work).
- Android package id: `com.dabb.binokel` (from `apps/client/app.json`).
- CI emulator runner: `ubuntu-latest` with KVM acceleration (not macOS — 2-3x faster per `ReactiveCircus/android-emulator-runner` docs), action pinned to `v2.38.0`.
- Firebase RTDB emulator: port `9000`; Android emulator reaches host via `10.0.2.2`.
- `firebase-tools` requires Java 21+ (CLI v15+ dropped support for older Java) — CI job must provision Java 21.
- Single device, sequential roles for create+join (no second emulator) — deliberate simplification per spec, do not add a second emulator/matrix job in this plan.
- No security-rules mirroring: `database.rules.json` is new, emulator-only, permissive (`.read`/`.write`: true) — it does not represent or replace production Firebase console rules.
- Spec: `docs/superpowers/specs/2026-07-11-android-startup-smoke-test-design.md`.

---

## Task 1: Firebase Local Emulator connection in app config

**Files:**

- Modify: `apps/client/src/firebase/config.ts`
- Test: `apps/client/src/firebase/__tests__/config.test.ts` (new)

**Interfaces:**

- Produces: `apps/client/src/firebase/config.ts` still exports `db` (unchanged signature: `Database` from `firebase/database`). Behavior added: when `process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true'`, calls `connectDatabaseEmulator(db, '10.0.2.2', 9000)` once at module load.

- [ ] **Step 1: Write the failing test**

Create `apps/client/src/firebase/__tests__/config.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const connectDatabaseEmulatorMock = vi.fn();
const getDatabaseMock = vi.fn(() => ({}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/database', () => ({
  getDatabase: getDatabaseMock,
  connectDatabaseEmulator: connectDatabaseEmulatorMock,
}));

describe('firebase config emulator connection', () => {
  const originalEnv = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR;

  beforeEach(() => {
    vi.resetModules();
    connectDatabaseEmulatorMock.mockClear();
    getDatabaseMock.mockClear();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR;
    } else {
      process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = originalEnv;
    }
  });

  it('does not connect to the emulator by default', async () => {
    delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR;
    await import('../config.js');
    expect(connectDatabaseEmulatorMock).not.toHaveBeenCalled();
  });

  it('connects to the emulator when EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true', async () => {
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
    await import('../config.js');
    expect(connectDatabaseEmulatorMock).toHaveBeenCalledWith(
      getDatabaseMock.mock.results[0]?.value,
      '10.0.2.2',
      9000
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @dabb/client test -- src/firebase/__tests__/config.test.ts`
Expected: FAIL on the second test (`connectDatabaseEmulatorMock` not called) — `connectDatabaseEmulator` is never imported/called yet in `config.ts`.

- [ ] **Step 3: Write minimal implementation**

Modify `apps/client/src/firebase/config.ts`:

```ts
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getDatabase(app);

if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  connectDatabaseEmulator(db, '10.0.2.2', 9000);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @dabb/client test -- src/firebase/__tests__/config.test.ts`
Expected: PASS (both tests)

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @dabb/client typecheck`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/firebase/config.ts apps/client/src/firebase/__tests__/config.test.ts
git commit -m "feat: connect to Firebase RTDB emulator when EXPO_PUBLIC_USE_FIREBASE_EMULATOR is set"
```

---

## Task 2: Firebase Local Emulator Suite config

**Files:**

- Create: `firebase.json` (repo root)
- Create: `database.rules.json` (repo root)
- Modify: `package.json` (root) — add `firebase-tools` devDependency

**Interfaces:**

- Produces: `firebase emulators:start --only database` runnable from repo root, serving RTDB on port 9000, using the permissive rules in `database.rules.json`.

- [ ] **Step 1: Add `firebase-tools` as a root devDependency**

Run: `pnpm add -D -w firebase-tools`

This pins the version in `pnpm-lock.yaml` instead of relying on an unpinned `npx firebase-tools` fetch in CI every run.

- [ ] **Step 2: Create `database.rules.json`**

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

- [ ] **Step 3: Create `firebase.json`**

```json
{
  "database": {
    "rules": "database.rules.json"
  },
  "emulators": {
    "database": {
      "port": 9000
    },
    "ui": {
      "enabled": false
    }
  }
}
```

- [ ] **Step 4: Verify the emulator starts**

Run: `pnpm exec firebase emulators:start --only database --project demo-dabb`
Expected output includes: `✔  database: Realtime Database Emulator UI` disabled note and `✔  All emulators ready! It is now safe to connect your app.` with the database emulator listening on `9000`. Stop with `Ctrl+C`.

(`--project demo-dabb` uses a fake "demo-" prefixed project id, which the Firebase Emulator Suite treats as offline-only — no real GCP project or credentials needed.)

- [ ] **Step 5: Commit**

```bash
git add firebase.json database.rules.json package.json pnpm-lock.yaml
git commit -m "feat: add Firebase RTDB Local Emulator config for smoke testing"
```

---

## Task 3: testIDs for Maestro targeting

**Files:**

- Modify: `apps/client/src/components/ui/HomeScreen.tsx`
- Modify: `apps/client/src/components/ui/WaitingRoomScreen.tsx`

**Interfaces:**

- Produces: the following `testID` values, consumed by the Maestro flow in Task 4:
  - `home-title` — Text, home screen heading
  - `home-create-online-button` — TouchableOpacity, switches to create mode
  - `home-join-online-button` — TouchableOpacity, switches to join mode
  - `home-nickname-input` — TextInput, nickname field
  - `home-join-code-input` — TextInput, join-code field
  - `home-submit-button` — TouchableOpacity, create/join submit
  - `waiting-room-session-code` — Text, displays the session code
  - `waiting-room-players-count` — Text, displays `(connected/total)`

No unit test for this task — `testID` is inert in jsdom/RTL rendering and its only consumer is the Maestro flow, which is validated end-to-end in Task 4/6. Adding an RTL assertion here would just re-assert JSX literals with no behavioral risk (YAGNI).

- [ ] **Step 1: Add testIDs in `HomeScreen.tsx`**

In the `mode === 'menu'` block, on the title `Text` (currently `<Text style={styles.title}>{t('home.title')}</Text>`):

```tsx
<Text style={styles.title} testID="home-title">
  {t('home.title')}
</Text>
```

On the create-online button:

```tsx
<TouchableOpacity
  style={styles.buttonSecondary}
  onPress={() => setMode('create')}
  testID="home-create-online-button"
>
  <Text style={styles.buttonSecondaryText}>{t('home.createOnline')}</Text>
</TouchableOpacity>
```

On the join-online button:

```tsx
<TouchableOpacity
  style={styles.buttonSecondary}
  onPress={() => setMode('join')}
  testID="home-join-online-button"
>
  <Text style={styles.buttonSecondaryText}>{t('home.joinOnline')}</Text>
</TouchableOpacity>
```

On the nickname `TextInput`:

```tsx
<TextInput
  style={styles.input}
  value={nickname}
  onChangeText={setNickname}
  placeholder={t('home.nicknamePlaceholder')}
  placeholderTextColor={Colors.inkFaint}
  maxLength={10}
  autoCapitalize="none"
  autoCorrect={false}
  testID="home-nickname-input"
/>
```

On the join-code `TextInput`:

```tsx
<TextInput
  style={styles.input}
  value={joinCode}
  onChangeText={setJoinCode}
  placeholder={t('home.gameCodePlaceholder')}
  placeholderTextColor={Colors.inkFaint}
  autoCapitalize="none"
  autoCorrect={false}
  testID="home-join-code-input"
/>
```

On the submit button (the one with dynamic `onPress`/label for create/join/offline):

```tsx
<TouchableOpacity
  style={[styles.buttonPrimary, styles.flex1, loading && styles.buttonDisabled]}
  onPress={
    mode === 'create' ? handleCreate : mode === 'join' ? handleJoin : handleStartOffline
  }
  disabled={loading}
  testID="home-submit-button"
>
```

- [ ] **Step 2: Add testIDs in `WaitingRoomScreen.tsx`**

On the session-code `Text` (currently `<Text style={styles.code}>{sessionCode}</Text>`):

```tsx
<Text style={styles.code} testID="waiting-room-session-code">
  {sessionCode}
</Text>
```

On the players-count `Text`:

```tsx
<Text style={styles.playersTitle} testID="waiting-room-players-count">
  {t('common.players')} ({connectedPlayers}/{playerCount > 0 ? playerCount : '?'})
</Text>
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm --filter @dabb/client typecheck && pnpm lint`
Expected: no errors

- [ ] **Step 4: Run existing client tests to confirm no regressions**

Run: `pnpm --filter @dabb/client test`
Expected: PASS (testID is a no-op prop for existing RTL tests)

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/components/ui/HomeScreen.tsx apps/client/src/components/ui/WaitingRoomScreen.tsx
git commit -m "feat: add testIDs to home and waiting-room screens for Maestro E2E targeting"
```

---

## Task 4: Maestro flow — startup, create, join

**Files:**

- Create: `apps/client/e2e/startup-create-join.yaml`

**Interfaces:**

- Consumes: `testID`s from Task 3 (`home-title`, `home-create-online-button`, `home-join-online-button`, `home-nickname-input`, `home-join-code-input`, `home-submit-button`, `waiting-room-session-code`, `waiting-room-players-count`); app id `com.dabb.binokel`; the emulator-config APK from Task 5 must already be installed on the running device/emulator before this flow executes.
- Produces: an exit-code-driven pass/fail for CI (Task 6) — `maestro test apps/client/e2e/startup-create-join.yaml` exits non-zero on any failed assertion.

- [ ] **Step 1: Install the Maestro CLI locally**

Run: `curl -Ls "https://get.maestro.mobile.dev" | bash` (official installer; adds `maestro` to `~/.maestro/bin`, add that to `PATH` per the installer's own instructions)

Verify: `maestro --version` prints a version number.

- [ ] **Step 2: Write the flow file**

Create `apps/client/e2e/startup-create-join.yaml`:

```yaml
appId: com.dabb.binokel
---
- launchApp
- assertVisible:
    id: 'home-title'
- tapOn:
    id: 'home-create-online-button'
- tapOn:
    id: 'home-nickname-input'
- inputText: 'Alice'
- tapOn:
    id: 'home-submit-button'
- assertVisible:
    id: 'waiting-room-session-code'
- copyTextFrom:
    id: 'waiting-room-session-code'
- stopApp
- launchApp:
    clearState: true
- assertVisible:
    id: 'home-title'
- tapOn:
    id: 'home-join-online-button'
- tapOn:
    id: 'home-nickname-input'
- inputText: 'Bob'
- tapOn:
    id: 'home-join-code-input'
- pasteText
- tapOn:
    id: 'home-submit-button'
- assertVisible:
    id: 'waiting-room-players-count'
    text: '.*2/2.*'
```

(`copyTextFrom` stores the last-copied text in Maestro's clipboard-backed variable; `pasteText` inputs it into the currently focused field — this is the mechanism that lets one device play both "Alice" (host) and "Bob" (joiner) roles sequentially, per the Global Constraints single-device simplification.)

- [ ] **Step 3: Manually validate against a local emulator**

Prerequisites: Android emulator running (Android Studio AVD Manager, API 34+), app built and installed with the emulator flag:

```bash
cd apps/client
EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true npx expo run:android
```

In a second terminal, start the Firebase emulator from repo root: `pnpm exec firebase emulators:start --only database --project demo-dabb`

In a third terminal: `maestro test apps/client/e2e/startup-create-join.yaml`

Expected: Maestro reports all steps passed (green checkmarks), no timeout/assertion failures. If a step fails, inspect Maestro's terminal output (it prints the failing assertion and a screenshot path) and adjust `testID`s/timing — do not proceed to Task 5/6 until this passes locally.

- [ ] **Step 4: Commit**

```bash
git add apps/client/e2e/startup-create-join.yaml
git commit -m "test: add Maestro startup/create/join smoke test flow"
```

---

## Task 5: CI — smoke-test APK build job

**Files:**

- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Produces: CI artifact named `client-apk-smoketest` at `apps/client/build/dabb.apk`, built with `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true` baked into the JS bundle. Consumed by Task 6's `smoke-test-android` job.

- [ ] **Step 1: Add the `build-client-apk-smoketest` job**

In `.github/workflows/ci.yml`, add a new job after `build-client-apk` (same file, top-level `jobs:` key), mirroring `build-client-apk` but with one added `-e` flag and a distinct artifact name:

```yaml
build-client-apk-smoketest:
  name: Build Client APK (smoke test)
  runs-on: ubuntu-latest
  needs: [lint-and-typecheck, test, changes]
  if: needs.changes.outputs.client == 'true'

  steps:
    - name: Checkout
      uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@d7f5e7f509e45cec5c76c4d5afdd7de93d0b3df5 # v4.1.0

    - name: Build Android builder image
      uses: docker/build-push-action@f9f3042f7e2789586610d6e8b85c8f03e5195baf # v7.2.0
      with:
        context: .
        file: apps/client/Dockerfile.android
        push: false
        load: true
        tags: dabb-android-builder:ci-smoketest
        cache-from: type=gha,scope=android-builder
        cache-to: type=gha,mode=max,scope=android-builder

    - name: Cache Gradle dependencies
      uses: actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae # v5
      with:
        path: /tmp/gradle-cache-smoketest
        key: ${{ runner.os }}-gradle-smoketest-${{ hashFiles('apps/client/package.json') }}
        restore-keys: |
          ${{ runner.os }}-gradle-smoketest-

    - name: Build smoke-test APK in Docker
      run: |
        mkdir -p /tmp/gradle-cache-smoketest
        docker run --rm \
          -v "${{ github.workspace }}:/app" \
          -v /tmp/gradle-cache-smoketest:/gradle-cache \
          -e GRADLE_USER_HOME=/gradle-cache \
          -e EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true \
          dabb-android-builder:ci-smoketest

    - name: Upload smoke-test APK artifact
      uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
      with:
        name: client-apk-smoketest
        path: apps/client/build/dabb.apk
        retention-days: 7
```

Note: the action SHAs above are copied verbatim from the existing `build-client-apk` job in the same file — do not re-pin to different commits.

- [ ] **Step 2: Validate YAML syntax**

Run: `pnpm exec js-yaml .github/workflows/ci.yml > /dev/null && echo OK` (if `js-yaml` isn't available, `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('OK')"` works equally, since it's just a parse check, not a schema check)
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add smoke-test-config Android APK build job"
```

---

## Task 6: CI — Android emulator smoke test job

**Files:**

- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: `client-apk-smoketest` artifact from Task 5; `apps/client/e2e/startup-create-join.yaml` from Task 4; `firebase.json`/`database.rules.json` from Task 2.
- Produces: CI job `smoke-test-android` that fails the workflow (subject to the `continue-on-error` shakeout note below) if the Maestro flow fails.

- [ ] **Step 1: Add the `smoke-test-android` job**

Append to `.github/workflows/ci.yml`:

```yaml
smoke-test-android:
  name: Android Startup Smoke Test
  runs-on: ubuntu-latest
  needs: [build-client-apk-smoketest, changes]
  if: needs.changes.outputs.client == 'true'
  timeout-minutes: 20
  continue-on-error: true # TODO: remove once the flow is stable across a few PRs

  steps:
    - name: Checkout
      uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0

    - name: Setup Node.js
      uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
      with:
        node-version: '22'

    - name: Setup pnpm
      uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6.0.9
      with:
        version: '10.33.0'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Setup Java 21 (required by firebase-tools emulator)
      uses: actions/setup-java@0f481fcb613427c0f801b606911222b5b6f3083a # v5.5.0
      with:
        distribution: 'temurin'
        java-version: '21'

    - name: Enable KVM group perms
      run: |
        echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
        sudo udevadm control --reload-rules
        sudo udevadm trigger --name-match=kvm

    - name: Download smoke-test APK
      uses: actions/download-artifact@018cc2cf5baa6db3ef3c5f8a56943fffe632ef53 # v6.0.0
      with:
        name: client-apk-smoketest
        path: apps/client/build

    - name: Install Maestro CLI
      run: |
        curl -Ls "https://get.maestro.mobile.dev" | bash
        echo "$HOME/.maestro/bin" >> "$GITHUB_PATH"

    - name: Start Firebase RTDB emulator
      run: pnpm exec firebase emulators:start --only database --project demo-dabb &

    - name: Run Android emulator and Maestro flow
      uses: ReactiveCircus/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d # v2.38.0
      with:
        api-level: 34
        arch: x86_64
        profile: pixel_6
        script: |
          adb install apps/client/build/dabb.apk
          maestro test apps/client/e2e/startup-create-join.yaml

    - name: Upload Maestro debug output on failure
      if: failure()
      uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
      with:
        name: maestro-debug-output
        path: ~/.maestro/tests
        retention-days: 7
```

All three new actions above (`ReactiveCircus/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d` = v2.38.0, `actions/setup-java@0f481fcb613427c0f801b606911222b5b6f3083a` = v5.5.0, `actions/download-artifact@018cc2cf5baa6db3ef3c5f8a56943fffe632ef53` = v6.0.0) are already pinned to full commit SHAs, resolved via `git ls-remote <repo> refs/tags/<tag>^{}` (dereferenced/annotated-tag form) or `refs/tags/<tag>` (lightweight-tag form), per this repo's GitHub Actions pinning convention. Before merging, re-run the same `git ls-remote` command to confirm the SHA still matches the tag (protects against a tag having moved between plan-writing and implementation).

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Push branch and confirm the job runs in GitHub Actions**

This step can't be verified locally — Android emulator + KVM acceleration isn't available in most sandboxed dev environments. Push the branch, open a PR (or use `gh workflow run` if the workflow supports manual dispatch — it doesn't here, so a PR is required), and watch the `smoke-test-android` job in the Actions tab.

Expected: job completes (pass or fail) within the 20-minute timeout. If it fails, inspect the uploaded `maestro-debug-output` artifact and the job log for the specific failing step; iterate on `testID`s/timing in Task 3/4 as needed. Because `continue-on-error: true` is set, a failure here doesn't block merge during shakeout — but should still be diagnosed and fixed before removing that flag.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Android emulator smoke test job (Maestro + Firebase RTDB emulator)"
```

---

## Task 7: Documentation

**Files:**

- Modify: `docs/KEY_FILES.md`
- Modify: `CLAUDE.md`

**Interfaces:** none (docs only)

- [ ] **Step 1: Add entries to `docs/KEY_FILES.md`**

Add these rows to the table (after the `apps/client/src/hooks/useStorage.ts` row):

```markdown
| `apps/client/e2e/startup-create-join.yaml` | Maestro E2E smoke test (app startup, create/join session) |
| `firebase.json` | Firebase Local Emulator Suite config (RTDB emulator, port 9000) |
```

- [ ] **Step 2: Note the smoke test in `CLAUDE.md`**

In `CLAUDE.md`, under the `## Testing` section, after the existing "Regression tests" paragraph, add:

```markdown
**Android smoke test**: `apps/client/e2e/startup-create-join.yaml` (Maestro) runs in CI against a real Android emulator + Firebase RTDB Local Emulator — catches native startup crashes that `vitest`/`tsc` can't (e.g. native module version mismatches). Run locally: see Task 4 validation steps in `docs/superpowers/plans/2026-07-11-android-startup-smoke-test.md`, or re-run `maestro test apps/client/e2e/startup-create-join.yaml` against a running emulator with the app already installed.
```

- [ ] **Step 3: Commit**

```bash
git add docs/KEY_FILES.md CLAUDE.md
git commit -m "docs: document Android smoke test in KEY_FILES and CLAUDE.md"
```
