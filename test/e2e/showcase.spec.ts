import {AxeBuilder} from '@axe-core/playwright';
import {expect, type Page, test, type TestInfo} from '@playwright/test';
import {expectInSight, sampleSight} from './in-sight.js';

/**
 * The showcase: the live demo on GitHub Pages and the README's animated preview. Its onboarding
 * tour starts by itself, crosses pages, waits for data, and must stay in sight on every device.
 */

test.use({baseURL: 'http://localhost:4174'});

/** The showcase runs on one desktop and two phone projects. */
function skipOtherProjects(testInfo: TestInfo): void {
  test.skip(!['chromium-desktop', 'chromium-phone', 'webkit-phone'].includes(testInfo.project.name), 'showcase');
}

const tooltip = (page: Page) => page.locator('[data-rtk-tooltip]:not([data-hidden])');

async function expectStep(page: Page, title: string | RegExp, target?: string): Promise<void> {
  await expect(page.getByRole('dialog', {name: title})).toBeVisible();
  await expect(tooltip(page)).not.toHaveAttribute('data-entering');
  if (target) {
    expectInSight(await sampleSight(page, 400, target));
  }
}

async function next(page: Page): Promise<void> {
  await page.getByRole('button', {name: 'Next'}).click();
}

test('the onboarding tour starts by itself and runs across pages to the end', async ({page}, testInfo) => {
  skipOtherProjects(testInfo);
  await page.goto('/');
  await expectStep(page, /^Welcome to Acme/u);

  await next(page);
  await expectStep(page, 'Find anything', '[data-tour="search"]');

  await next(page);
  await expectStep(page, 'Start something new', '[data-tour="new-project"]');

  // Below the fold on smaller screens: scrolled into view.
  await next(page);
  await expectStep(page, 'Stay in the loop', '[data-tour="activity"]');

  // Another page whose data takes a moment: the tour shows a spinner meanwhile.
  await next(page);
  await expect(page.getByRole('progressbar', {name: 'Loading…'})).toBeVisible();
  await expectStep(page, 'Bring your team', '[data-tour="invite"]');
  await expect(page).toHaveURL(/#\/team$/u);

  await next(page);
  await expectStep(page, 'Help is always here', '[data-tour="help"]');
  await expect(page).toHaveURL(/#\/$/u);

  await page.getByRole('button', {name: 'Finish'}).click();
  await expect(page.locator('[data-rtk-root]')).toHaveCount(0);
  // Where it started, so the README's preview loops seamlessly.
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('Help replays the tour', async ({page}, testInfo) => {
  skipOtherProjects(testInfo);
  await page.goto('/');
  await expectStep(page, /^Welcome to Acme/u);
  await page.getByRole('button', {name: 'Close tour'}).click();
  await expect(page.locator('[data-rtk-root]')).toHaveCount(0);

  await page.getByRole('button', {name: 'Help'}).click();
  await expectStep(page, /^Welcome to Acme/u);
});

test('the showcase and its tour are accessible', async ({page}, testInfo) => {
  skipOtherProjects(testInfo);
  await page.goto('/');
  await expectStep(page, /^Welcome to Acme/u);
  await next(page);
  await expectStep(page, 'Find anything');
  const tour = await new AxeBuilder({page}).include('[data-rtk-root]').analyze();
  expect(tour.violations).toEqual([]);

  await page.getByRole('button', {name: 'Close tour'}).click();
  await expect(page.locator('[data-rtk-root]')).toHaveCount(0);
  const app = await new AxeBuilder({page}).analyze();
  expect(app.violations).toEqual([]);
});
