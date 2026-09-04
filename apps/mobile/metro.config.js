// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Let Metro bundle the shared, framework-agnostic logic in packages/core
// (it lives outside this app dir). We watch ONLY packages/core — not the whole
// repo root — so the web app's node_modules can't cause a dual-React clash.
config.watchFolders = [path.resolve(monorepoRoot, 'packages/core')];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
