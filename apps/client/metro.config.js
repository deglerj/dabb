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

// TypeScript files use `.js` extensions in imports (ESM convention), but
// Metro doesn't substitute `.js` → `.ts/.tsx`. Teach it to do so.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.js')) {
    const base = moduleName.slice(0, -3);
    for (const ext of ['.tsx', '.ts', '.jsx']) {
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
