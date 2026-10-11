// The demo runs the library's source directly, so every change in `src/` is live here.
// CI sets TOUR_KIT_FROM_PACKAGE=1 and installs the packed tarball instead, to test what gets published.
const path = require('node:path');
const {getDefaultConfig} = require('expo/metro-config');

const projectRoot = __dirname;
const librarySource = path.resolve(projectRoot, '../../src');
const fromPackage = process.env.TOUR_KIT_FROM_PACKAGE === '1';

const config = getDefaultConfig(projectRoot);

if (!fromPackage) {
  config.watchFolders = [librarySource];

  const isLibraryFile = (file) => file.startsWith(librarySource + path.sep);

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === '@robertlinde/react-tour-kit/react-native') {
      return {type: 'sourceFile', filePath: path.join(librarySource, 'react-native.ts')};
    }

    if (isLibraryFile(context.originModulePath)) {
      // The source imports `./x.js` (Node ESM style) for files that are `./x.ts` or `./x.tsx`.
      if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
        return context.resolveRequest(context, moduleName.slice(0, -'.js'.length), platform);
      }

      // Packages (react, react-native) come from the demo, never from the repository root: one copy of React.
      if (!moduleName.startsWith('.')) {
        return context.resolveRequest(
          {...context, originModulePath: path.join(projectRoot, 'index.ts')},
          moduleName,
          platform,
        );
      }
    }

    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
