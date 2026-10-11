import {expect, type Page} from '@playwright/test';

export type SightReport = {
  readonly tooltipInViewport: boolean;
  readonly tooltipInSafeArea: boolean;
  readonly entering: boolean;
  readonly targetVisible: boolean;
  readonly targetFullyVisibleIfFits: boolean;
  readonly targetUnobscured: boolean;
  readonly spotlightMatchesTarget: boolean;
  readonly tooltipUnobscured: boolean;
  readonly overlapsTarget: boolean;
  readonly detail: string;
};

/**
 * Checks the "never out of sight" guarantee in the page, once per animation frame for `durationMs`.
 * Returns the reports of every frame.
 */
export async function sampleSight(page: Page, durationMs: number): Promise<SightReport[]> {
  return page.evaluate(async (duration) => {
    const padding = 12;
    const epsilon = 0.75;
    const isTourNode = (node: Element): boolean => node.closest('[data-rtk-root]') !== null;

    type View = {left: number; top: number; right: number; bottom: number};

    function visibleViewport(): View {
      const visual = globalThis.visualViewport;
      const width = Math.min(visual?.width ?? Infinity, document.documentElement.clientWidth);
      const height = Math.min(visual?.height ?? Infinity, document.documentElement.clientHeight);
      const left = visual?.offsetLeft ?? 0;
      const top = visual?.offsetTop ?? 0;
      return {left, top, right: left + width, bottom: top + height};
    }

    const edges = (r: DOMRect): number[] => [r.left, r.top, r.right, r.bottom].map((value) => Math.round(value));

    // Covered = a fixed or sticky element (header, floating button, banner) overlapping the target.
    // Computed geometrically: hit-testing cannot see the page while the tour's modal dialog is open.
    function isUnobscured(target: Element, t: DOMRect, view: View): boolean {
      const area = view.right * view.bottom;
      return [...document.body.querySelectorAll('*')]
        .filter((element) => !isTourNode(element) && !element.contains(target) && !target.contains(element))
        .filter((element) => ['fixed', 'sticky'].includes(getComputedStyle(element).position))
        .map((element) => element.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0 && r.width * r.height <= area / 2)
        .every(
          (r) =>
            Math.min(r.right, t.right) - Math.max(r.left, t.left) <= 1 ||
            Math.min(r.bottom, t.bottom) - Math.max(r.top, t.top) <= 1,
        );
    }

    function inspectTarget(target: Element, view: View, box: DOMRect) {
      const t = target.getBoundingClientRect();
      const visibleWidth = Math.min(t.right, view.right) - Math.max(t.left, view.left);
      const visibleHeight = Math.min(t.bottom, view.bottom) - Math.max(t.top, view.top);
      const fits = t.width <= view.right - view.left && t.height <= view.bottom - view.top;
      const spotlight = document.querySelector('[data-rtk-spotlight]')?.getBoundingClientRect();
      return {
        targetVisible: visibleWidth > 0 && visibleHeight > 0,
        targetFullyVisibleIfFits:
          !fits ||
          (t.left >= view.left - epsilon &&
            t.top >= view.top - epsilon &&
            t.right <= view.right + epsilon &&
            t.bottom <= view.bottom + epsilon),
        targetUnobscured: isUnobscured(target, t, view),
        spotlightMatchesTarget:
          !spotlight ||
          !fits ||
          (Math.abs(spotlight.left - (t.left - 8)) < 1.5 &&
            Math.abs(spotlight.top - (t.top - 8)) < 1.5 &&
            Math.abs(spotlight.width - (t.width + 16)) < 1.5),
        overlapsTarget: box.left < t.right && box.right > t.left && box.top < t.bottom && box.bottom > t.top,
      };
    }

    const noTarget = {
      targetVisible: true,
      targetFullyVisibleIfFits: true,
      targetUnobscured: true,
      spotlightMatchesTarget: true,
      overlapsTarget: false,
    };

    function report(): SightReport | undefined {
      const tooltip = document.querySelector<HTMLElement>('[data-rtk-tooltip]');
      const target = document.querySelector('#lab-target');
      if (!tooltip || tooltip.dataset.hidden !== undefined) {
        return undefined;
      }

      const view = visibleViewport();
      const box = tooltip.getBoundingClientRect();
      const [topmost] = document.elementsFromPoint(box.left + box.width / 2, box.top + Math.min(box.height / 2, 20));
      return {
        tooltipInViewport:
          box.left >= view.left - epsilon &&
          box.top >= view.top - epsilon &&
          box.right <= view.right + epsilon &&
          box.bottom <= view.bottom + epsilon,
        tooltipInSafeArea:
          box.left >= view.left + padding - epsilon &&
          box.top >= view.top + padding - epsilon &&
          box.right <= view.right - padding + epsilon &&
          box.bottom <= view.bottom - padding + epsilon,
        entering: tooltip.dataset.entering !== undefined,
        tooltipUnobscured: topmost ? tooltip.contains(topmost) : false,
        ...(target ? inspectTarget(target, view, box) : noTarget),
        detail: JSON.stringify({
          view,
          tooltip: edges(box),
          target: target ? edges(target.getBoundingClientRect()) : null,
        }),
      };
    }

    // Sample what was actually painted: a task queued from a frame callback runs after that frame's
    // rendering, whereas reading inside the callback could run before other frame callbacks update the page.
    const reports: SightReport[] = [];
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (): void => {
        setTimeout(() => {
          const current = report();
          if (current) {
            reports.push(current);
          }

          if (performance.now() - start < duration) {
            requestAnimationFrame(tick);
          } else {
            resolve();
          }
        }, 0);
      };

      requestAnimationFrame(tick);
    });
    return reports;
  }, durationMs);
}

/** Asserts the guarantee on every sampled frame. */
export function expectInSight(
  reports: SightReport[],
  options: {allowOverlap?: boolean; allowObscuredTarget?: boolean} = {},
): void {
  expect(reports.length, 'the tooltip was on screen while sampling').toBeGreaterThan(0);
  for (const frame of reports) {
    expect(frame.tooltipInViewport, `tooltip inside the visible viewport: ${frame.detail}`).toBe(true);
    if (!frame.entering) {
      expect(frame.tooltipInSafeArea, `settled tooltip inside the safe area: ${frame.detail}`).toBe(true);
      expect(frame.tooltipUnobscured, `nothing covers the tooltip: ${frame.detail}`).toBe(true);
    }

    expect(frame.targetVisible, `target visible: ${frame.detail}`).toBe(true);
    expect(frame.targetFullyVisibleIfFits, `target fully visible: ${frame.detail}`).toBe(true);
    if (!options.allowObscuredTarget) {
      expect(frame.targetUnobscured, `nothing covers the target: ${frame.detail}`).toBe(true);
    }

    if (!options.allowOverlap) {
      expect(frame.overlapsTarget, `tooltip does not cover the target: ${frame.detail}`).toBe(false);
    }
  }

  expect(reports.at(-1)?.spotlightMatchesTarget, `spotlight on the target: ${reports.at(-1)?.detail}`).toBe(true);
}
