# Android CI Native Build Cache — Handoff

**Date:** 2026-07-12
**Status:** Investigation handoff — not implemented, not blocking

---

## Context

While debugging the Android startup smoke test (`docs/superpowers/specs/2026-07-11-android-startup-smoke-test-design.md`), the smoke-test CI job needed an APK that runs standalone (no Metro server). Two root causes were found and fixed in sequence:

1. `apps/client/plugins/withDebugBundling.ts` (commit `dc79501`) — the RN Gradle plugin skips JS/asset bundling for any variant named in `debuggableVariants` (default `["debug"]`). Fixed by setting `debuggableVariants = []`.
2. `apps/client/plugins/withStandaloneBuildType.ts` (commit `06cc79a`) — even with a bundle embedded, `expo-dev-client`'s launcher still activates for any build with `android:debuggable="true"` (Expo's own docs confirm: switching debug→release is the supported way to skip the launcher). Added a `standalone` Android build type: same as `release` (bundles JS, `debuggable false`, matches `release` for dependency variant resolution) but signed with the auto-generated Android debug keystore instead of production Play Store secrets, so no CI secrets are needed.

## The problem this doc hands off

Fix #2 works but is release-_like_, which means Android compiles native C++ (Hermes/JSI/turbomodules via CMake) in an optimized `RelWithDebInfo` configuration, for all 3 requested ABIs (`armeabi-v7a`, `arm64-v8a`, `x86_64`), from scratch, with no native build cache. On the first real CI run of this build type, the job stalled inside `buildCMakeRelWithDebInfo[arm64-v8a]` for **5+ hours** (2026-07-11T19:44Z → 2026-07-12T01:26Z) before being manually cancelled — not just slow, a real hang (consistent with runner memory exhaustion or an orphaned compiler process).

This is consistent with the rest of the repo's own design: the only other release-type Android build in this project (`publish-android.yml`, `bundleRelease`) is `workflow_dispatch`-only, never run automatically on every PR — the maintainers already avoided this exact cost in the fast CI loop. The smoke-test job just reintroduced it.

## Immediate mitigation (being tried first, cheap, bounded)

The smoke-test job only ever installs on the `x86_64` emulator (`android-emulator-runner`'s `arch: x86_64`) — there's no reason to compile native code for `armeabi-v7a`/`arm64-v8a` for this build. Restricting `-PreactNativeArchitectures=x86_64` for the smoke-test build only (leaving the production `build-client-apk` job's 3-ABI build untouched) cuts native compile roughly 3x. This is a bet, not a proven fix — a 5-hour hang isn't guaranteed to become a fast build just from fewer ABIs, so this needs to run with a tight step timeout so it fails fast and visibly instead of hanging again.

## Real fix if the above isn't enough: native build caching

GitHub Actions provides a hosted cache (`actions/cache`, already used in `ci.yml` for Gradle/pnpm/turbo caches — shared ~10GB/repo quota, LRU-evicted). The standard approach for this class of problem:

1. Install `ccache` (or `sccache`) in `Dockerfile.android`.
2. Wire it into the CMake native build — not automatic with RN/AGP, needs `externalNativeBuild.cmake.arguments` to include `-DCMAKE_CXX_COMPILER_LAUNCHER=ccache` / `-DCMAKE_C_COMPILER_LAUNCHER=ccache` (likely via another `withAppBuildGradle` config plugin, following the existing `plugins/with*.ts` pattern).
3. Persist ccache's cache directory across runs with `actions/cache`, rolling key + `restore-keys` fallback (partial hits still help when source changed but flags didn't).

Caveat: the first run (or any run touching native deps/RN version) is still a full cold compile — ccache only pays off on repeat runs, and shares cache quota with the Gradle/pnpm/turbo caches already in use.

## What NOT to do

Don't retry the exact same 3-ABI `standalone` build hoping it was a fluke — the CMake RelWithDebInfo compile is real, reproducible extra work, not flaky CI. If the `x86_64`-only mitigation also stalls, that's evidence the hang is about optimization-level/compiler behavior, not ABI count, and points more directly at ccache (or investigating why RelWithDebInfo specifically hangs vs. just being slow — could be a compiler bug, OOM, or a known RN/NDK issue worth searching for before building caching infra around it).
