const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro sees changes in workspace packages
config.watchFolders = [workspaceRoot];

// Allow Metro to resolve packages from the root node_modules (pnpm monorepo)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Allow importing .ts source from workspace packages (game-canvas et al.)
config.resolver.sourceExts = [...config.resolver.sourceExts, 'ts', 'tsx'];

// Allow importing .ogg audio files (not in Metro's default asset extensions)
config.resolver.assetExts = [...config.resolver.assetExts, 'ogg'];

// TypeScript files use `.js` extensions in imports (ESM convention), but
// Metro doesn't substitute `.js` → `.ts/.tsx`. Teach it to do so.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // canvaskit-wasm is the Skia JS renderer for web only — it imports Node's 'fs' module
  // which doesn't exist in React Native. On native platforms Skia uses the native renderer.
  if (platform !== 'web' && moduleName.startsWith('canvaskit-wasm')) {
    return { type: 'empty' };
  }

  if (moduleName.endsWith('.js')) {
    const base = moduleName.slice(0, -3);
    const platformPrefix = platform ? `.${platform}` : '';
    const exts = platformPrefix
      ? [
          `${platformPrefix}.tsx`,
          `${platformPrefix}.ts`,
          `${platformPrefix}.jsx`,
          '.tsx',
          '.ts',
          '.jsx',
        ]
      : ['.tsx', '.ts', '.jsx'];
    for (const ext of exts) {
      try {
        return context.resolveRequest(context, base + ext, platform);
      } catch {
        // try next extension
      }
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
