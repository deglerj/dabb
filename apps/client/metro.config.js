const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow importing .ts source from workspace packages (game-canvas et al.)
config.resolver.sourceExts = [...config.resolver.sourceExts, 'ts', 'tsx'];

module.exports = config;
