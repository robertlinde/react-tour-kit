import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// The demo runs the library's source directly, so every change in `src/` is live here.
// CI sets TOUR_KIT_FROM_PACKAGE=1 and installs the packed tarball instead, to test what gets published.
const fromPackage = process.env.TOUR_KIT_FROM_PACKAGE === '1';
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

// `--mode showcase` builds the showcase (the live demo on GitHub Pages) instead of the test-bench demo.
// It uses relative asset URLs and a hash router, so the same build works under any path.
export default defineConfig(({mode}) => ({
  plugins: [react()],
  ...(mode === 'showcase'
    ? {
        root: fileURLToPath(new URL('showcase', import.meta.url)),
        base: './',
        build: {outDir: fileURLToPath(new URL('dist-showcase', import.meta.url)), emptyOutDir: true},
      }
    : {}),
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
}));
