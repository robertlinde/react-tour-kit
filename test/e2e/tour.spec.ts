import {AxeBuilder} from '@axe-core/playwright';
import {expect, type Page, test} from '@playwright/test';

/**
 * The demo's cross-page tour, end to end: navigation, keyboard, focus, accessibility, smoothness
 * and the absence of background work.
 */

const tooltip = (page: Page) => page.locator('[data-rtk-tooltip]:not([data-hidden])');

async function startTour(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('[data-tour="cta"]').click();
  await expect(page.getByRole('dialog', {name: 'Welcome to react-tour-kit'})).toBeVisible();
}

async function next(page: Page, title: string): Promise<void> {
  await page.getByRole('button', {name: 'Next'}).click();
  await expect(page.getByRole('dialog', {name: title})).toBeVisible();
  await expect(tooltip(page)).not.toHaveAttribute('data-entering');
}

test('runs the whole cross-page tour', async ({page}) => {
  await startTour(page);
  await next(page, 'Highlight anything');
  await next(page, 'Smart placement');
  await next(page, 'Below the fold');
  await expect(page.locator('[data-tour="install"]')).toBeInViewport({ratio: 1});
  await next(page, 'Across pages');
  await expect(page).toHaveURL(/\/settings$/u);
  await next(page, 'Theme it');
  await next(page, 'Nested scrollers');
  await expect(page.locator('[data-tour="advanced"]')).toBeInViewport({ratio: 1});
  await next(page, "That's it!");
  await expect(page).toHaveURL(/\/$/u);
  await page.getByRole('button', {name: 'Finish'}).click();
  await expect(page.locator('[data-rtk-root]')).toHaveCount(0);
  await expect(page.locator('[data-tour="cta"]')).toHaveText('Start the tour');
});

test('gives focus back to the button that started the tour', async ({page}) => {
  await page.goto('/lab?scenario=default');
  await expect(tooltip(page)).toBeVisible();
  await page.getByRole('button', {name: 'Close tour'}).click();
  await page.locator('[data-tour="cta"]').count();
  await page.goto('/');
  const cta = page.locator('[data-tour="cta"]');
  await cta.focus();
  await cta.press('Enter');
  await expect(page.getByRole('dialog', {name: 'Welcome to react-tour-kit'})).toBeVisible();
  await page.getByRole('button', {name: 'Close tour'}).click();
  await expect(page.locator('[data-rtk-root]')).toHaveCount(0);
  await expect(cta).toBeFocused();
});

test('navigates back across pages', async ({page}) => {
  await startTour(page);
  for (const title of ['Highlight anything', 'Smart placement', 'Below the fold', 'Across pages']) {
    await next(page, title);
  }

  await page.getByRole('button', {name: 'Back'}).click();
  await expect(page.getByRole('dialog', {name: 'Below the fold'})).toBeVisible();
});

test('going back keeps the target clear of the sticky navigation', async ({page}) => {
  await startTour(page);
  for (const title of ['Highlight anything', 'Smart placement', 'Below the fold']) {
    await next(page, title);
  }

  await page.getByRole('button', {name: 'Back'}).click();
  await expect(page.getByRole('dialog', {name: 'Smart placement'})).toBeVisible();
  await expect(tooltip(page)).not.toHaveAttribute('data-entering');
  const {navBottom, targetTop} = await page.evaluate(() => ({
    navBottom: document.querySelector('.nav')!.getBoundingClientRect().bottom,
    targetTop: document.querySelector('[data-tour="feature-1"]')!.getBoundingClientRect().top,
  }));
  expect(targetTop).toBeGreaterThanOrEqual(navBottom);
});

test('keyboard: arrows move, Escape closes', async ({page, isMobile}) => {
  test.skip(isMobile, 'hardware keyboard');
  await startTour(page);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', {name: 'Highlight anything'})).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('dialog', {name: 'Welcome to react-tour-kit'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-rtk-root]')).toHaveCount(0);
});

test('closes when the dimmed area is clicked', async ({page}) => {
  await startTour(page);
  await next(page, 'Highlight anything');
  // A spot on the dimmed area: outside the tooltip and the highlight.
  const spot = await page.evaluate(() => {
    const avoid = ['[data-rtk-tooltip]', '[data-rtk-spotlight]'].map((selector) =>
      document.querySelector(selector)!.getBoundingClientRect(),
    );
    const {clientWidth: width, clientHeight: height} = document.documentElement;
    const corners = [
      {x: 5, y: 5},
      {x: width - 5, y: 5},
      {x: 5, y: height - 5},
      {x: width - 5, y: height - 5},
    ];
    return corners.find((point) =>
      avoid.every((r) => point.x < r.left || point.x > r.right || point.y < r.top || point.y > r.bottom),
    )!;
  });
  await page.locator('[data-rtk-backdrop]').click({position: spot});
  await expect(page.locator('[data-rtk-root]')).toHaveCount(0);
});

test('has no accessibility violations', async ({page}) => {
  await startTour(page);
  await next(page, 'Highlight anything');
  const results = await new AxeBuilder({page}).include('[data-rtk-root]').analyze();
  expect(results.violations).toEqual([]);
});

test('does no work while a step is on screen', async ({page}) => {
  await startTour(page);
  await next(page, 'Highlight anything');
  // Right after a step appears, the tour checks its target for a second (animations can move it unannounced).
  await page.waitForTimeout(1500);
  const counts = await page.evaluate(async () => {
    const counters = {measurements: 0, frames: 0, scrolls: 0, mutations: 0};
    const original = {
      measure: Element.prototype.getBoundingClientRect,
      frame: globalThis.requestAnimationFrame,
      scrollTo: globalThis.scrollTo,
    };
    Element.prototype.getBoundingClientRect = function (this: Element) {
      counters.measurements++;
      return original.measure.call(this);
    };

    globalThis.requestAnimationFrame = (callback) => {
      counters.frames++;
      return original.frame.call(globalThis, callback);
    };

    globalThis.scrollTo = (...args: unknown[]) => {
      counters.scrolls++;
      Reflect.apply(original.scrollTo, globalThis, args);
    };

    const observer = new MutationObserver((records) => {
      counters.mutations += records.length;
    });
    observer.observe(document.body, {subtree: true, childList: true, attributes: true});
    await new Promise((resolve) => {
      setTimeout(resolve, 1500);
    });
    observer.disconnect();
    Element.prototype.getBoundingClientRect = original.measure;
    globalThis.requestAnimationFrame = original.frame;
    globalThis.scrollTo = original.scrollTo;
    return counters;
  });
  expect(counts).toEqual({measurements: 0, frames: 0, scrolls: 0, mutations: 0});
});

test('step changes animate smoothly: no jumps, no flicker', async ({page}, testInfo) => {
  test.skip(testInfo.project.name.includes('reduced-motion'), 'animations are disabled on purpose');
  await startTour(page);
  await next(page, 'Highlight anything');
  const frames = await page.evaluate(async () => {
    const samples: Array<{left: number; top: number; tooltipOpacity: number}> = [];
    const spotlight = document.querySelector('[data-rtk-spotlight]');
    const start = performance.now();
    document.querySelector<HTMLButtonElement>('.rtk-button--next')?.click();
    await new Promise<void>((resolve) => {
      const tick = (): void => {
        const rect = spotlight?.getBoundingClientRect();
        const card = document.querySelector('[data-rtk-tooltip]');
        samples.push({
          left: rect?.left ?? 0,
          top: rect?.top ?? 0,
          tooltipOpacity: card ? Number(getComputedStyle(card).opacity) : 0,
        });
        if (performance.now() - start < 700) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(tick);
    });
    return samples;
  });
  const steps = frames
    .slice(1)
    .map((frame, index) => Math.hypot(frame.left - frames[index]!.left, frame.top - frames[index]!.top));
  // Total distance travelled (the spotlight may first close, while the page scrolls, then open on the next target).
  const path = steps.reduce((sum, step) => sum + step, 0);
  expect(path).toBeGreaterThan(20);
  // It travels over several frames instead of jumping: no single frame covers most of the way.
  expect(steps.filter((step) => step > 0.5).length).toBeGreaterThanOrEqual(4);
  expect(Math.max(...steps)).toBeLessThan(path * 0.75);
  // The tooltip fades in once; it never blinks back out.
  const fadeIns = frames.filter(
    (frame, index) => index > 0 && frame.tooltipOpacity > 0.95 && frames[index - 1]!.tooltipOpacity <= 0.95,
  );
  expect(fadeIns.length).toBeLessThanOrEqual(1);
});
