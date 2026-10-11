import {defineConfig, devices} from '@playwright/test';

/**
 * End-to-end tests (test/e2e) against the web demo (demos/react).
 *
 * Locally the demo runs the library's source. In CI, TOUR_KIT_FROM_PACKAGE=1 makes the demo use
 * the packed tarball instead, so the tests cover exactly what gets published.
 */
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 2 : undefined,
  reporter: isCi ? [['github'], ['blob']] : [['list'], ['html', {open: 'never'}]],
  timeout: 60_000,
  expect: {timeout: 10_000},
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    {name: 'chromium-desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1280, height: 800}}},
    {
      name: 'chromium-phone-small',
      use: {...devices['Desktop Chrome'], viewport: {width: 320, height: 568}, hasTouch: true},
    },
    {name: 'chromium-phone', use: {...devices['Desktop Chrome'], viewport: {width: 375, height: 667}, hasTouch: true}},
    {
      name: 'chromium-landscape',
      use: {...devices['Desktop Chrome'], viewport: {width: 568, height: 320}, hasTouch: true},
    },
    {name: 'webkit-phone', use: {...devices['iPhone 13']}},
    {name: 'firefox-desktop', use: {...devices['Desktop Firefox'], viewport: {width: 1280, height: 800}}},
    {
      name: 'chromium-reduced-motion',
      use: {...devices['Desktop Chrome'], viewport: {width: 1280, height: 800}, reducedMotion: 'reduce'},
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !isCi,
    timeout: 180_000,
    cwd: './demos/react',
  },
});
