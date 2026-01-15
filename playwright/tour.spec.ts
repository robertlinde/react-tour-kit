import {test, expect} from '@playwright/test';

/**
 * E2E tests for react-tour-kit.
 * Tests the tour functionality using the React demo app.
 */

test.describe('Tour', () => {
  test.beforeEach(async ({page}) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test.describe('Tour Initialization', () => {
    test('should display start tour button', async ({page}) => {
      const startButton = page.locator('[data-tour="cta"]');
      await expect(startButton).toBeVisible();
      await expect(startButton).toHaveText('Start Cross-Page Tour');
    });

    test('should start tour when button is clicked', async ({page}) => {
      const startButton = page.locator('[data-tour="cta"]');
      await startButton.click();

      // Tour tooltip should appear - look for the step counter text pattern "1 / 8"
      const tooltip = page.getByText(/\d+\s*\/\s*\d+/).first();
      await expect(tooltip).toBeVisible({timeout: 5000});
    });
  });

  test.describe('Tour Navigation', () => {
    test('should navigate through tour steps with Next button', async ({page}) => {
      // Start the tour
      await page.locator('[data-tour="cta"]').click();

      // First step should be visible - check for the title
      await expect(page.getByText('Welcome to React Tour!')).toBeVisible({timeout: 5000});

      // Click Next
      await page.getByRole('button', {name: 'Next'}).click();

      // Second step should be visible
      await expect(page.getByText('Navigation')).toBeVisible();
    });

    test('should navigate back with Previous button', async ({page}) => {
      // Start the tour
      await page.locator('[data-tour="cta"]').click();

      await expect(page.getByText('Welcome to React Tour!')).toBeVisible({timeout: 5000});

      // Go to second step
      await page.getByRole('button', {name: 'Next'}).click();
      await expect(page.getByRole('heading', {name: 'Navigation'})).toBeVisible();

      // Go back to first step
      await page.getByRole('button', {name: 'Back'}).click();
      await expect(page.getByText('Welcome to React Tour!')).toBeVisible();
    });

    test('should close tour with close button', async ({page}) => {
      // Start the tour
      await page.locator('[data-tour="cta"]').click();

      await expect(page.getByText('Welcome to React Tour!')).toBeVisible({timeout: 5000});

      // Click close button (aria-label="Close tour")
      await page.getByLabel('Close tour').click();

      // Tooltip should be gone - the welcome text should not be visible
      await expect(page.getByText('Welcome to React Tour!')).not.toBeVisible();

      // Start button should show original text
      const startButton = page.locator('[data-tour="cta"]');
      await expect(startButton).toHaveText('Start Cross-Page Tour');
    });
  });

  test.describe('Cross-Page Navigation', () => {
    test('should navigate to settings page during tour', async ({page}) => {
      // Start the tour
      await page.locator('[data-tour="cta"]').click();

      await expect(page.getByText('Welcome to React Tour!')).toBeVisible({timeout: 5000});

      // Navigate through steps until we reach the settings navigation step
      // Step 1: Welcome -> Step 2
      await page.getByRole('button', {name: 'Next'}).click();
      // Step 2: Navigation -> Step 3
      await page.getByRole('button', {name: 'Next'}).click();
      // Step 3: Easy to Use -> Step 4
      await page.getByRole('button', {name: 'Next'}).click();
      // Step 4: Let's Visit Settings - this triggers navigation

      // Wait for navigation to settings page
      await expect(page).toHaveURL(/\/settings/, {timeout: 10_000});

      // Tour should continue on settings page
      await expect(page.getByText('Settings Page')).toBeVisible({timeout: 5000});
    });

    test('should navigate back to home page during tour', async ({page}) => {
      // Start the tour and navigate to settings
      await page.locator('[data-tour="cta"]').click();

      await expect(page.getByText('Welcome to React Tour!')).toBeVisible({timeout: 5000});

      // Navigate to settings page (steps 1-4)
      for (let i = 0; i < 4; i++) {
        await page.getByRole('button', {name: 'Next'}).click();
        await page.waitForTimeout(100);
      }

      await expect(page).toHaveURL(/\/settings/, {timeout: 10_000});

      // Continue through settings steps
      // Step 5: Settings Page -> Step 6
      await page.getByRole('button', {name: 'Next'}).click();
      // Step 6: Theme Settings -> Step 7
      await page.getByRole('button', {name: 'Next'}).click();
      // Step 7: Back to Home - this triggers navigation back to home
      await page.getByRole('button', {name: 'Next'}).click();

      // Wait for navigation back to home
      await expect(page).toHaveURL('/', {timeout: 10_000});

      // Tour should continue on home page with final step
      await expect(page.getByText("That's It!")).toBeVisible({timeout: 5000});
    });
  });

  test.describe('Tour Completion', () => {
    test('should complete full tour', async ({page}) => {
      // Start the tour
      await page.locator('[data-tour="cta"]').click();

      await expect(page.getByText('Welcome to React Tour!')).toBeVisible({timeout: 5000});

      // Navigate through all 8 steps (click Next 7 times)
      for (let i = 0; i < 7; i++) {
        await page.getByRole('button', {name: 'Next'}).click();
        await page.waitForTimeout(200);
      }

      // On last step, click Finish
      await page.getByRole('button', {name: 'Finish'}).click();

      // Tour should be closed - welcome text should not be visible anymore
      await expect(page.getByText("That's It!")).not.toBeVisible();

      // Should be back on home page
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Tour Overlay', () => {
    test('should display overlay when tour is active', async ({page}) => {
      // Start the tour
      await page.locator('[data-tour="cta"]').click();

      // Overlay uses SVG with mask - check for the SVG element
      const overlay = page.locator('svg').filter({has: page.locator('mask#tour-mask')});
      await expect(overlay).toBeVisible({timeout: 5000});
    });

    test('should highlight target element', async ({page}) => {
      // Start the tour
      await page.locator('[data-tour="cta"]').click();

      // The header should be the first target
      const header = page.locator('[data-tour="header"]');
      await expect(header).toBeVisible();

      // Tour tooltip should show the first step
      await expect(page.getByText('Welcome to React Tour!')).toBeVisible({timeout: 5000});
    });
  });

  test.describe('Tour State', () => {
    test('should show current step in button during tour', async ({page}) => {
      // Start the tour
      await page.locator('[data-tour="cta"]').click();

      // Button should show step progress
      const ctaButton = page.locator('[data-tour="cta"]');
      await expect(ctaButton).toContainText(/Step 1 of \d+/);

      // Advance to next step
      await page.getByRole('button', {name: 'Next'}).click();
      await expect(ctaButton).toContainText(/Step 2 of \d+/);
    });
  });
});

test.describe('Navigation', () => {
  test('should navigate between pages using nav links', async ({page}) => {
    await page.goto('/');

    // Click settings link
    await page.locator('[data-tour="nav-settings"]').click();
    await expect(page).toHaveURL(/\/settings/);

    // Click home link
    await page.locator('[data-tour="nav-home"]').click();
    await expect(page).toHaveURL('/');
  });
});
