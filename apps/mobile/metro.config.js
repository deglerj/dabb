// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('ogg');

// Force singleton packages to resolve from the mobile app's node_modules.
// pnpm creates per-package symlinks for peer dependencies, which causes Metro
// to bundle multiple instances of React (one per workspace package).
const mobileModules = path.resolve(__dirname, 'node_modules');
config.resolver.extraNodeModules = {
  react: path.resolve(mobileModules, 'react'),
  'react-native': path.resolve(mobileModules, 'react-native'),
  'react-native-gesture-handler': path.resolve(mobileModules, 'react-native-gesture-handler'),
  'react-native-reanimated': path.resolve(mobileModules, 'react-native-reanimated'),
  buffer: path.resolve(mobileModules, 'buffer'),
};

module.exports = config;
