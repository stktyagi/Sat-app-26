const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @react-native-firebase v26 ships only an ESM build (dist/module/) which uses
// ESM import/export syntax that Metro cannot handle — all named exports resolve
// to undefined at runtime. Redirect to the raw TypeScript lib/ source so that
// Metro's Babel transform can process it correctly.
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName.startsWith('@react-native-firebase/')) {
      const pkgName = moduleName.split('/').slice(0, 2).join('/');
      const subPath = moduleName.slice(pkgName.length + 1) || 'index';
      const pkgDir = path.dirname(require.resolve(`${pkgName}/package.json`));
      const libEntry = path.join(pkgDir, 'lib', subPath === 'index' ? 'index.ts' : subPath);
      // Only redirect if the lib/ file exists; fall through otherwise
      try {
        require.resolve(libEntry);
        return { filePath: libEntry, type: 'sourceFile' };
      } catch (_) {
        // fall through to default resolution
      }
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: './src/global.css' });
