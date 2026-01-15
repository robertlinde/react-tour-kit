import {defineConfig, devices} from '@playwright/test';

/**
 * Playwright configuration for react-tour-kit E2E tests.
 *
 * Tests run against the React demo app to verify tour functionality
 * including cross-page navigation, tooltips, and user interactions.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: '.',
  /* Only run .spec.ts files */
  testMatch: '**/*.spec.ts',
  /* Run tests in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */

  forbidOnly: Boolean(process.env.CI),
  /* Retry on CI only - helps with flakiness */

  retries: process.env.CI ? 2 : 0,
  /* Parallel workers */

  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. On CI, use blob reporter for sharding + GitHub Actions summary */

  reporter: process.env.CI
    ? [['github'], ['blob'], ['@estruyf/github-actions-reporter', {title: 'Playwright E2E Test Results'}]]
    : [['html', {open: 'on-failure'}]],
  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: 'http://localhost:4173',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'on-first-retry',

    /* Default timeout for actions */
    actionTimeout: 15_000,

    /* Default timeout for navigation */
    navigationTimeout: 30_000,

    /* Use Desktop Chrome */
    ...devices['Desktop Chrome'],
  },

  /* Run the demo app before starting tests */
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: '../demos/react',
  },

  /* Global timeout for each test */
  timeout: 60_000,

  /* Expect timeout configuration */
  expect: {
    timeout: 10_000,
  },
});
