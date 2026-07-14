import { ConfigPlugin, withDangerousMod } from 'expo/config-plugins';
import fs from 'fs';
import path from 'path';

/**
 * Allows cleartext (plain HTTP/WS) traffic for the "standalone" build type
 * only — mirrors the debug-only android:usesCleartextTraffic override AGP
 * already generates at android/app/src/debug/AndroidManifest.xml, which our
 * custom "standalone" build type (see withStandaloneBuildType) doesn't get
 * since it isn't named "debug".
 *
 * Needed because the smoke-test app talks to the Firebase RTDB emulator
 * over ws://localhost:9000 (no TLS in a local emulator) — Android blocks
 * cleartext traffic by default since API 28, which silently drops the
 * WebSocket connection with no catchable JS error (confirmed the exact
 * failure via a plain fetch() diagnostic: "CLEARTEXT communication to
 * localhost not permitted by network security policy").
 *
 * Production release builds are untouched — no source set named "release"
 * or "standalone" gets this override there, so cleartext stays blocked.
 */
const withStandaloneCleartextTraffic: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'android',
    async (config) => {
      const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/standalone');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'AndroidManifest.xml'),
        `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="http://schemas.android.com/tools">
    <application android:usesCleartextTraffic="true" tools:replace="android:usesCleartextTraffic" />
</manifest>
`
      );
      return config;
    },
  ]);

export default withStandaloneCleartextTraffic;
