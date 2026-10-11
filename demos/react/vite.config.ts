import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// The demo runs the library's source directly, so every change in `src/` is live here.
// CI sets TOUR_KIT_FROM_PACKAGE=1 and installs the packed tarball instead, to test what gets published.
const fromPackage = process.env.TOUR_KIT_FROM_PACKAGE === '1';
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: fromPackage
      ? []
      : [
          {
            find: '@robertlinde/react-tour-kit/react',
            replacement: fileURLToPath(new URL('../../src/react.ts', import.meta.url)),
          },
        ],
    // One copy of React, even though the library source lives outside this folder.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    fs: {allow: [repoRoot]},
  },
});
