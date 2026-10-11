import {expect, type Page, test} from '@playwright/test';
import {expectInSight, sampleSight} from './in-sight.js';

/**
 * The "never out of sight" guarantee, end to end: in every scenario and on every device project,
 * the target is brought into view and the tooltip stays inside the visible viewport on every frame.
 */

async function openLab(page: Page, scenario: string, placement = 'bottom'): Promise<void> {
  await page.goto(`/lab?scenario=${scenario}&placement=${placement}`);
  await expect(page.locator('[data-rtk-tooltip]')).toBeVisible();
  await expect(page.locator('[data-rtk-tooltip]:not([data-hidden])')).toBeVisible();
}

const edgeScenarios = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right', 'default'];

for (const scenario of edgeScenarios) {
  for (const placement of ['top', 'bottom', 'left', 'right']) {
    test(`edge "${scenario}", preferred side ${placement}`, async ({page}) => {
      await openLab(page, scenario, placement);
      expectInSight(await sampleSight(page, 600));
    });
  }
}

test('target below the fold is scrolled into view', async ({page}) => {
  await openLab(page, 'below-fold');
  expectInSight(await sampleSight(page, 600));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
});

test('target inside a nested scroller below the fold', async ({page}) => {
  await openLab(page, 'nested');
  expectInSight(await sampleSight(page, 600));
  expect(await page.getByTestId('scroller').evaluate((element) => element.scrollTop)).toBeGreaterThan(900);
});

test('target at the end of a horizontal carousel', async ({page}) => {
  await openLab(page, 'carousel');
  expectInSight(await sampleSight(page, 600));
  expect(await page.getByTestId('scroller').evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});

test('target larger than the viewport', async ({page}) => {
  await openLab(page, 'huge');
  // The tooltip has to sit on top of a target that fills the whole screen.
  expectInSight(await sampleSight(page, 600), {allowOverlap: true});
});

test('very long content stays scrollable inside the viewport', async ({page}) => {
  await openLab(page, 'long-content');
  expectInSight(await sampleSight(page, 600), {allowOverlap: true});
  const finish = page.getByRole('button', {name: 'Finish'});
  await finish.scrollIntoViewIfNeeded();
  await expect(finish).toBeInViewport();
});

test('target is moved out from under a sticky header (z-index max)', async ({page}) => {
  await openLab(page, 'sticky', 'top');
  expectInSight(await sampleSight(page, 600));
});

test('scrolling up: the target stops below a sticky header', async ({page}) => {
  await openLab(page, 'sticky-up', 'bottom');
  expectInSight(await sampleSight(page, 600));
});

test('scrolling down: the target stops above a fixed cookie banner', async ({page}) => {
  await openLab(page, 'sticky-footer', 'bottom');
  expectInSight(await sampleSight(page, 600));
});

test('the target is scrolled clear of a floating button in its column', async ({page}) => {
  await openLab(page, 'floating', 'top');
  // On very short screens the button leaves no room for the tooltip beside the target.
  const isShort = (page.viewportSize()?.height ?? 800) < 400;
  expectInSight(await sampleSight(page, 600), {allowOverlap: isShort});
});

test('several fixed elements at once: header, banner and footer', async ({page}) => {
  for (const placement of ['top', 'bottom']) {
    await openLab(page, 'many', placement);
    expectInSight(await sampleSight(page, 600));
  }
});

test('a target larger than the screen starts just below a sticky header', async ({page}) => {
  await openLab(page, 'huge-sticky', 'bottom');
  expectInSight(await sampleSight(page, 600), {allowOverlap: true});
});

test('when a fixed element cannot be scrolled away, the step is still shown and stays in sight', async ({page}) => {
  await openLab(page, 'unavoidable', 'bottom');
  expectInSight(await sampleSight(page, 600), {allowObscuredTarget: true, allowOverlap: true});
});

test('target inside a fixed bottom bar', async ({page}) => {
  await openLab(page, 'fixed-bottom', 'bottom');
  expectInSight(await sampleSight(page, 600));
});

test('step without a target is centred', async ({page}) => {
  await openLab(page, 'no-target');
  await expect(page.locator('[data-rtk-tooltip]')).not.toHaveAttribute('data-entering');
  const offset = await page.evaluate(() => {
    const box = document.querySelector('[data-rtk-tooltip]')!.getBoundingClientRect();
    const root = document.documentElement;
    return {x: box.left + box.width / 2 - root.clientWidth / 2, y: box.top + box.height / 2 - root.clientHeight / 2};
  });
  expect(Math.abs(offset.x)).toBeLessThan(1.5);
  expect(Math.abs(offset.y)).toBeLessThan(1.5);
});

test('the tour brings the target back promptly when the app pushes it out of view', async ({page}) => {
  await openLab(page, 'shift');
  await expect(page.getByTestId('inserted')).toBeVisible();
  // The app moved the target; the tour scrolls it back within a second.
  await expect(page.locator('#lab-target')).toBeInViewport({ratio: 1, timeout: 1000});
  expectInSight(await sampleSight(page, 600));
});

test('the page cannot be scrolled away while the tour is open', async ({page, isMobile}) => {
  test.skip(isMobile, 'mouse wheel only');
  await openLab(page, 'below-fold');
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.move(20, 20);
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  expectInSight(await sampleSight(page, 200));
});

test('right-to-left pages', async ({page}) => {
  await page.goto('/lab?scenario=right&placement=right&dir=rtl');
  await expect(page.locator('[data-rtk-tooltip]:not([data-hidden])')).toBeVisible();
  expect(await page.locator('[data-rtk-root]').getAttribute('dir')).toBe('rtl');
  expectInSight(await sampleSight(page, 600));
});

test('the tooltip stays in sight when the window is resized', async ({page}) => {
  await openLab(page, 'right', 'right');
  await page.setViewportSize({width: 360, height: 640});
  expectInSight(await sampleSight(page, 600));
  await page.setViewportSize({width: 900, height: 420});
  expectInSight(await sampleSight(page, 600));
});
