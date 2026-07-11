import { ConfigPlugin, withAppBuildGradle } from 'expo/config-plugins';

const withDebugBundling: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Idempotent: already patched
    if (contents.includes('debuggableVariants = []')) {
      return config;
    }

    // By default the RN Gradle plugin skips JS/asset bundling for the "debug" variant
    // (see the "debuggableVariants" doc comment in this same file), since debug builds
    // normally load JS live from Metro. Our CI-built debug APK (smoke tests, artifact
    // uploads) has no Metro server to connect to, so without this it launches into the
    // Expo dev-launcher's "connect to a server" screen instead of the app.
    contents = contents.replace(
      'bundleCommand = "export:embed"',
      'bundleCommand = "export:embed"\n    debuggableVariants = []'
    );

    if (!contents.includes('debuggableVariants = []')) {
      throw new Error(
        'withDebugBundling: failed to inject debuggableVariants — expo prebuild template may have changed'
      );
    }

    config.modResults.contents = contents;
    return config;
  });

export default withDebugBundling;
