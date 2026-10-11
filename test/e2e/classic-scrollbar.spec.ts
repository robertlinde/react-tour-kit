import {expect, test} from '@playwright/test';

/**
 * Classic, always-visible scrollbars (Windows, Linux, macOS "always show"). Headless browsers hide
 * scrollbars, so Chromium is started without that, and the page styles its scrollbar (which makes
 * Chromium draw a classic one on every system). Hiding such a scrollbar while the tour is open
 * would widen the page, so the tour must leave it, and the layout, exactly as they are.
 */
test.use({launchOptions: {ignoreDefaultArgs: ['--hide-scrollbars']}});

test('leaves a classic scrollbar and the layout as they are while the tour is open', async ({page, browserName}) => {
  test.skip(browserName !== 'chromium', 'Only Chromium can be made to draw classic scrollbars here.');
  await page.addInitScript(() => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') {
        const style = document.createElement('style');
        style.textContent =
          '::-webkit-scrollbar { width: 15px; height: 15px; } ::-webkit-scrollbar-thumb { background: #888; }';
        document.head.append(style);
      }
    });
  });
  const pageWidth = async (): Promise<number> => page.evaluate(() => document.documentElement.clientWidth);
  await page.goto('/lab?scenario=below-fold&placement=bottom');
  await expect(page.locator('[data-rtk-tooltip]:not([data-hidden])')).toBeVisible();
  const scrollbar = await page.evaluate(() => window.innerWidth - document.documentElement.clientWidth);
  expect(scrollbar).toBe(15);
  const widthWhileOpen = await pageWidth();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-rtk-root]')).toHaveCount(0);
  expect(await pageWidth()).toBe(widthWhileOpen);
  expect(await page.evaluate(() => document.documentElement.getAttribute('style'))).toBeNull();
});
