const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Keep the generated API hooks and the app root provider on the same
// React Query module instance. This matters when Metro traverses the
// workspace API package through pnpm symlinks.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@tanstack/react-query': path.resolve(
    __dirname,
    'node_modules/@tanstack/react-query',
  ),
};

module.exports = config;
