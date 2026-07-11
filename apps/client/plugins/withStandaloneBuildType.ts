import { ConfigPlugin, withAppBuildGradle } from 'expo/config-plugins';

/**
 * Adds a "standalone" Android build type: same as release (bundles JS, not
 * debuggable) but signed with the auto-generated debug keystore instead of
 * requiring production Play Store signing secrets.
 *
 * Why this exists: expo-dev-client's launcher activates for any build whose
 * manifest has android:debuggable="true" (which the "debug" build type sets
 * by default), regardless of whether a JS bundle is embedded — it shows its
 * own "connect to a development server" screen instead of the app. A plain
 * `assembleDebug` is therefore unusable for CI smoke tests, which install
 * the APK with no Metro server running. `assembleRelease` avoids the
 * launcher but needs real signing secrets. This "standalone" type gets a
 * non-debuggable, bundle-embedded APK without touching production signing.
 */
const withStandaloneBuildType: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Idempotent: already patched
    if (contents.includes('standalone {')) {
      return config;
    }

    const anchor = [
      '            crunchPngs enablePngCrunchInRelease.toBoolean()',
      '        }',
      '    }',
    ].join('\n');

    const replacement = [
      '            crunchPngs enablePngCrunchInRelease.toBoolean()',
      '        }',
      '        standalone {',
      '            initWith release',
      '            signingConfig signingConfigs.debug',
      "            matchingFallbacks = ['release']",
      '            minifyEnabled false',
      '            shrinkResources false',
      '        }',
      '    }',
    ].join('\n');

    if (!contents.includes(anchor)) {
      throw new Error(
        'withStandaloneBuildType: failed to find release buildType anchor — expo prebuild template may have changed'
      );
    }

    contents = contents.replace(anchor, replacement);
    config.modResults.contents = contents;
    return config;
  });

export default withStandaloneBuildType;
