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
      '            def ksPath = System.getenv("SIGNING_KEYSTORE_PATH")',
      '            if (ksPath) storeFile file(ksPath)',
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
