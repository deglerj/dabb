# Android Startup Smoke Test — Design Spec

**Date:** 2026-07-11
**Status:** Approved

---

## Problem

The app has repeatedly crashed on startup on Android (past incidents: `async-storage` v3 incompatibility with Expo Go SDK 55, `react-native-worklets`/reanimated version mismatch). These are native-runtime failures — they don't show up in `vitest` (jsdom, native modules mocked/absent) or `tsc`. The only way to catch them today is a human building and launching the app on a device or emulator, after the fact.

There is no automated check in CI that actually launches the built Android app and confirms it reaches a working screen, let alone that it can talk to Firebase and complete a basic multiplayer flow.

---

## Approach

Add a CI job that boots a real Android emulator, installs the existing debug APK (already built by `build-client-apk` in `ci.yml`), and drives it with **Maestro** (black-box YAML UI automation) against a **Firebase Realtime Database Local Emulator** (official, no real project/secrets). The Maestro flow launches the app, confirms it renders, then exercises create-session and join-session — the two Firebase-dependent, highest-risk startup paths.

**Scope for this pass:** Android only, startup + create/join. Out of scope: iOS (needs macOS runners — separate future spec if warranted), true concurrent 2-device play, gameplay past the waiting room (bidding/tricks/melds — already covered by existing integration tests in `packages/game-logic`).

### Why Maestro over Detox

Maestro drives the compiled APK black-box — no in-app test harness, no Jest wiring, nothing that has to survive `expo prebuild --platform android --clean` regenerating `android/` on every build (see [Android Build Stability spec](2026-06-28-android-build-stability-design.md)). Detox requires deep native project integration that would need to be re-applied or re-patched after every prebuild. Maestro only needs the app package name and, optionally, `testID`s on a few elements — nothing that prebuild touches.

Verified 2026-07-11: Maestro is actively maintained (~10.8k GitHub stars, used by Microsoft/Meta/Uber/Stripe, supports React Native natively). `ReactiveCircus/android-emulator-runner` is at v2.38.0, actively maintained, and — as of its current docs — recommends `ubuntu-latest` runners over macOS (2-3x faster) with KVM acceleration, which changes the CI job from what older examples show (macOS runner) to a cheaper Linux one. `firebase-tools`' Local Emulator Suite remains the standard approach; Firebase CLI v15+ requires Java 21+ for the emulator, which the CI job must provision explicitly.

---

## Architecture

### 1. Firebase emulator connection (app code)

**File:** `apps/client/src/firebase/config.ts`

```ts
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
// ...
export const db = getDatabase(app);
if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  connectDatabaseEmulator(db, '10.0.2.2', 9000);
}
```

`10.0.2.2` is the Android emulator's alias for the host machine's `localhost`. This only activates when the env var is set at build time (baked into the smoke-test APK build only — production builds are unaffected). No other firebase config values need to be real; the emulator ignores auth/project validity for RTDB.

### 2. Firebase emulator config

**New file:** `firebase.json` (repo root)

```json
{
  "database": {
    "rules": "database.rules.json"
  },
  "emulators": {
    "database": { "port": 9000 },
    "ui": { "enabled": false }
  }
}
```

**New file:** `database.rules.json` — permissive rules for the emulator only (`".read": true, ".write": true`). No security rules file exists in this repo today (confirmed: repo has no `*.rules.json`); production rules are managed directly in the Firebase console and are untouched by this change — `database.rules.json` is new and emulator-only, not a mirror of anything deployed.

### 3. testIDs for reliable element targeting

The app currently has zero `testID` usage; Maestro would otherwise have to match on visible (German) text, which breaks whenever `de.ts` copy changes. Add `testID` to:

- `HomeScreen.tsx`: nickname input, create-online button, join-online button, create/join submit button, join-code input, session-code display (in `WaitingRoomScreen.tsx`), player-count list/text.

Minimal, additive, no behavior change.

### 4. Maestro flow

**New file:** `apps/client/e2e/startup-create-join.yaml`

Single flow, single device, sequential roles (deliberate simplification — see below):

1. Launch app (`appId: com.dabb.binokel`) → assert home screen visible (`home-title` testID or text) → **this step alone catches the crash-on-startup bug class**.
2. Tap create-online → enter nickname "Alice" → tap create → assert waiting-room screen shows a session code → `copyTextFrom` the code element into a Maestro variable.
3. `stopApp` + relaunch (clears in-memory state, simulates a second device reusing the same physical emulator) → tap join-online → enter nickname "Bob" + the captured code → tap join → assert waiting room now shows 2 players.

Two-role-one-device is a deliberate simplification: a true second device would double emulator boot cost (~5-8 more CI minutes) for a smoke test whose job is "does this crash and can it reach Firebase," not "does concurrent multiplayer work" (that's covered by existing `game-logic` integration tests against the reducer). If real concurrency bugs ever show up that this misses, revisit with a 2-emulator matrix job.

### 5. CI job

**File:** `.github/workflows/ci.yml` — new job `smoke-test-android`

```yaml
build-client-apk-smoketest:
  name: Build Client APK (smoke test config)
  runs-on: ubuntu-latest
  needs: [lint-and-typecheck, test, changes]
  if: needs.changes.outputs.client == 'true'
  steps:
    # same as build-client-apk, but docker run passes
    # -e EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true
    # uploads artifact name: client-apk-smoketest

smoke-test-android:
  name: Android Startup Smoke Test
  runs-on: ubuntu-latest
  needs: [build-client-apk-smoketest, changes]
  if: needs.changes.outputs.client == 'true'
  timeout-minutes: 20
  steps:
    - checkout
    - setup Node 22 + pnpm (as in other jobs)
    - setup Java 21 (for firebase-tools emulator)
    - enable KVM group perms (required for ubuntu-latest emulator acceleration):
        echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
        sudo udevadm control --reload-rules && sudo udevadm trigger --name-match=kvm
    - download client-apk-smoketest artifact
    - install Maestro CLI (official install script)
    - start Firebase RTDB emulator in background: `npx firebase emulators:start --only database &`
    - reactivecircus/android-emulator-runner@v2.38.0 with script: `maestro test apps/client/e2e/startup-create-join.yaml`
    - upload Maestro screenshots/logs as artifact on failure
```

**Why a separate build job, not a parameterized existing one:** the existing `build-client-apk` job builds the production-config APK used nowhere except as a CI artifact today (the real release APK/AAB comes from `publish-android.yml`/`build-aab.sh` with signing). The smoke-test APK needs `EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true` baked in at `expo prebuild`/bundle time, which the production-config build must never have. A second job with one extra `-e` flag to the same Docker image/script is a smaller, safer diff than adding a build-variant parameter to the shared production build path — Docker layer caching (already configured via `cache-from: type=gha`) keeps the extra build cheap.

---

## Data Flow

```
CI job starts
  → Firebase RTDB emulator starts (localhost:9000)
  → Android emulator boots (KVM-accelerated, ubuntu-latest)
  → smoke-test APK (built with EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true) installed
  → Maestro launches app → app connects to 10.0.2.2:9000 (= host's :9000 = the RTDB emulator)
  → Maestro flow drives create session → app writes GameStartedEvent-equivalent session data to emulator
  → Maestro relaunches app as "Bob" → joins using captured code → reads session from emulator
  → assertions pass/fail → job succeeds/fails, artifacts uploaded on failure
```

---

## Error Handling / Flake Mitigation

- Maestro's built-in retry/wait-for-element semantics absorb normal UI animation timing — no manual `sleep`s needed in the flow.
- `timeout-minutes: 20` on the job caps a hung emulator/app from blocking CI indefinitely.
- On failure, upload Maestro's screenshot + view-hierarchy dump (`maestro test --format junit --output` supports this) as a CI artifact so failures are debuggable without re-running locally.
- This job is additive and independent of `test`/`lint-and-typecheck`/`build-client-apk` — a flaky smoke test blocks merge but doesn't block the existing fast checks from reporting.

---

## Testing / Validation

- Validate the Maestro flow locally first (Android Studio emulator + `firebase emulators:start`) before wiring into CI, per this repo's convention of not landing untested CI changes blind.
- First CI run: expect to iterate on timing/selectors — treat the first few runs as shakeout, not a merge gate, until stable (consider `continue-on-error: true` for the first 1-2 PRs, then remove once green).
