import {fileURLToPath} from 'node:url';
import {playwright} from '@vitest/browser-playwright';
import {defineConfig} from 'vitest/config';

// A fresh object per project: Vitest mutates `instances`, so sharing one object mixes projects up.
const browser = () => ({
  enabled: true,
  headless: true,
  provider: playwright(),
  instances: [{browser: 'chromium' as const}],
  viewport: {width: 1280, height: 800},
  screenshotFailures: false,
});

export default defineConfig({
  oxc: {jsx: {runtime: 'automatic'}},
  test: {
    // Tests never rely on globals; every helper is imported explicitly.
    globals: false,
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'web',
          include: ['test/web/**/*.test.tsx'],
          setupFiles: ['test/support/browser-setup.ts'],
          browser: browser(),
        },
        optimizeDeps: {include: ['react', 'react-dom', 'react-dom/client', 'vitest-browser-react']},
      },
      {
        extends: true,
        resolve: {
          // Plain string alias (exact match or `react-native/…`); Rolldown's alias regexes do not support every JS flag.
          alias: [{find: 'react-native', replacement: fileURLToPath(import.meta.resolve('react-native-web'))}],
        },
        define: {__DEV__: 'true', 'process.env.NODE_ENV': JSON.stringify('test')},
        test: {
          name: 'native',
          include: ['test/native/**/*.test.tsx'],
          setupFiles: ['test/support/browser-setup.ts'],
          browser: browser(),
        },
        optimizeDeps: {
          include: ['react', 'react-dom', 'react-dom/client', 'react-native-web', 'vitest-browser-react'],
        },
      },
      {
        extends: true,
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['test/jsdom/**/*.test.tsx'],
        },
      },
    ],
  },
});
