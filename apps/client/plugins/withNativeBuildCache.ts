import { ConfigPlugin, withAppBuildGradle } from 'expo/config-plugins';

/**
 * Routes the native C++ build (Hermes/JSI/turbomodules via CMake) through
 * ccache. Without this, a from-scratch RelWithDebInfo compile (used by the
 * "standalone" build type, see withStandaloneBuildType) is real, uncached
 * work every CI run — on 2026-07-11 it hung 5+ hours in
 * buildCMakeRelWithDebInfo[arm64-v8a]. `-DCMAKE_*_COMPILER_LAUNCHER=ccache`
 * is CMake's standard hook for a compiler cache and needs no source changes;
 * the RN Gradle plugin only adds its own default cmake args when a
 * same-prefixed one isn't already present, so this is additive, not a
 * fight over the same flag. Requires `ccache` on PATH (installed in
 * Dockerfile.android) and CI to persist `$CCACHE_DIR` across runs to pay off.
 */
const withNativeBuildCache: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Idempotent: already patched
    if (contents.includes('CMAKE_CXX_COMPILER_LAUNCHER')) {
      return config;
    }

    const anchor = [
      '        buildConfigField "String", "REACT_NATIVE_RELEASE_LEVEL", "\\"${findProperty(\'reactNativeReleaseLevel\') ?: \'stable\'}\\""',
      '    }',
    ].join('\n');

    const replacement = [
      '        buildConfigField "String", "REACT_NATIVE_RELEASE_LEVEL", "\\"${findProperty(\'reactNativeReleaseLevel\') ?: \'stable\'}\\""',
      '        externalNativeBuild {',
      '            cmake {',
      '                arguments "-DCMAKE_C_COMPILER_LAUNCHER=ccache", "-DCMAKE_CXX_COMPILER_LAUNCHER=ccache"',
      '            }',
      '        }',
      '    }',
    ].join('\n');

    if (!contents.includes(anchor)) {
      throw new Error(
        'withNativeBuildCache: failed to find defaultConfig anchor — expo prebuild template may have changed'
      );
    }

    contents = contents.replace(anchor, replacement);
    config.modResults.contents = contents;
    return config;
  });

export default withNativeBuildCache;
