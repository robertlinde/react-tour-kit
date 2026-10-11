import type {ReactNode} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {render} from 'vitest-browser-react';
import type {TourContextType} from '../../src/shared/types/tour-context.type.js';
import type {TourStep} from '../../src/shared/types/tour-step.type.js';
import type {TourTooltipProps} from '../../src/shared/types/tour-tooltip-props.type.js';
import {useTour} from '../../src/shared/react/use-tour.hook.js';
import {TourProvider, type TourProviderProps} from '../../src/react-platform/tour-provider.js';

// Web only: what the shared behaviour suite (tour-behavior.test.tsx) cannot cover.

let tour: TourContextType | undefined;
function Capture(): ReactNode {
  tour = useTour();
  return null;
}

type HarnessProps = Omit<TourProviderProps, 'children'> & {readonly children?: ReactNode};

function Harness({children, ...props}: HarnessProps): ReactNode {
  return (
    <TourProvider {...props}>
      <Capture />
      <button type="button" data-testid="trigger">
        Start
      </button>
      {children}
    </TourProvider>
  );
}

function Page(): ReactNode {
  return (
    <div style={{padding: 40}}>
      <div id="first" style={{width: 200, height: 40, marginTop: 100}}>
        First
      </div>
      <div id="second" style={{width: 200, height: 40, marginTop: 100, marginLeft: 400}}>
        Second
      </div>
      <div id="third" style={{width: 200, height: 40, marginTop: 100}}>
        Third
      </div>
    </div>
  );
}

const steps: TourStep[] = [
  {target: '#first', title: 'First step', content: 'Hello'},
  {target: '#second', title: 'Second step', content: 'Middle', placement: 'right'},
  {target: '#third', title: 'Third step', content: 'Bye'},
];

const query = <T extends Element = HTMLElement>(selector: string): T | null => document.querySelector<T>(selector);

function visibleArea(): {width: number; height: number} {
  return {width: document.documentElement.clientWidth, height: document.documentElement.clientHeight};
}

function expectOnScreen(element: Element, padding = 0): void {
  const rect = element.getBoundingClientRect();
  const {width, height} = visibleArea();
  expect(rect.left).toBeGreaterThanOrEqual(padding - 0.5);
  expect(rect.top).toBeGreaterThanOrEqual(padding - 0.5);
  expect(rect.right).toBeLessThanOrEqual(width - padding + 0.5);
  expect(rect.bottom).toBeLessThanOrEqual(height - padding + 0.5);
}

async function shown(title: string): Promise<HTMLElement> {
  await expect.element(page.getByRole('heading', {name: title})).toBeVisible();
  const tooltip = query('[data-rtk-tooltip]');
  if (!tooltip) {
    throw new Error('No tooltip');
  }

  await vi.waitFor(() => {
    expect(Object.hasOwn(tooltip.dataset, 'entering')).toBe(false);
  });
  return tooltip;
}

beforeEach(async () => {
  tour = undefined;
  await page.viewport(1280, 800);
  window.scrollTo({top: 0, left: 0, behavior: 'instant'});
});

describe('TourProvider (web)', () => {
  it('shows an accessible dialog next to the highlighted element', async () => {
    await render(
      <Harness>
        <Page />
      </Harness>,
    );
    tour?.startTour(steps, 'intro');
    const tooltip = await shown('First step');

    const dialog = page.getByRole('dialog', {name: 'First step'});
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog).toHaveAccessibleDescription('Hello');
    expectOnScreen(tooltip, 12);

    // The spotlight surrounds the target with 8px padding; the tooltip sits below it.
    const target = query('#first')!.getBoundingClientRect();
    const spotlight = query('[data-rtk-spotlight]')!.getBoundingClientRect();
    expect(spotlight.left).toBeCloseTo(target.left - 8, 0);
    expect(spotlight.top).toBeCloseTo(target.top - 8, 0);
    expect(spotlight.width).toBeCloseTo(target.width + 16, 0);
    expect(tooltip.getBoundingClientRect().top).toBeGreaterThanOrEqual(spotlight.bottom);
    expect(tooltip.dataset.placement).toBe('bottom');
  });

  it('navigates with the arrow keys, swapped in right-to-left pages', async () => {
    await render(
      <Harness>
        <Page />
      </Harness>,
    );
    tour?.startTour(steps, 'intro');
    await shown('First step');
    await userEvent.keyboard('{ArrowRight}');
    const second = await shown('Second step');
    expect(second.dataset.placement).toBe('right');
    await userEvent.keyboard('{ArrowLeft}');
    await shown('First step');
    tour?.endTour();
    await vi.waitFor(() => {
      expect(query('[data-rtk-root]')).toBeNull();
    });
    document.documentElement.dir = 'rtl';
    try {
      tour?.startTour(steps, 'rtl');
      await shown('First step');
      await userEvent.keyboard('{ArrowLeft}');
      await shown('Second step');
    } finally {
      document.documentElement.dir = '';
    }
  });
  it('moves focus into the tooltip and gives it back to the trigger when the tour ends', async () => {
    await render(
      <Harness>
        <Page />
      </Harness>,
    );
    const trigger = query<HTMLButtonElement>('[data-testid="trigger"]')!;
    trigger.focus();
    tour?.startTour(steps);
    const tooltip = await shown('First step');
    await vi.waitFor(() => {
      expect(tooltip.contains(document.activeElement)).toBe(true);
    });
    tour?.endTour();
    await vi.waitFor(() => {
      expect(query('[data-rtk-root]')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('does not navigate with arrow keys while the user types in a text field', async () => {
    function InputTooltip({step, titleId}: TourTooltipProps): ReactNode {
      return (
        <div>
          <h2 id={titleId}>{step.title}</h2>
          <input aria-label="Name" />
        </div>
      );
    }

    await render(
      <Harness TooltipComponent={InputTooltip}>
        <Page />
      </Harness>,
    );
    tour?.startTour(steps);
    await shown('First step');
    await page.getByRole('textbox', {name: 'Name'}).fill('abc');
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}');
    expect(tour?.currentStep).toBe(0);
  });

  it('passes placement, arrow offset and ids to a custom tooltip, and labels the dialog with its title', async () => {
    const received: TourTooltipProps[] = [];
    function Custom(props: TourTooltipProps): ReactNode {
      received.push(props);
      return (
        <div className="custom" style={{width: 240, padding: 12, background: 'white'}}>
          <strong id={props.titleId}>{props.step.title}</strong>
          <p id={props.descriptionId}>{props.step.content}</p>
          <button type="button" onClick={props.onNext}>
            Continue
          </button>
        </div>
      );
    }

    await render(
      <Harness TooltipComponent={Custom}>
        <Page />
      </Harness>,
    );
    tour?.startTour(steps);
    await expect.element(page.getByRole('dialog', {name: 'First step'})).toBeVisible();
    const last = received.at(-1);
    expect(last).toMatchObject({currentStep: 0, totalSteps: 3, placement: 'bottom'});
    expect(last?.arrowOffset).toEqual(expect.any(Number));
    await page.getByRole('button', {name: 'Continue'}).click();
    await expect.element(page.getByRole('dialog', {name: 'Second step'})).toBeVisible();
  });

  it('labels the dialog even when a custom tooltip ignores the ids', async () => {
    function Plain({step}: TourTooltipProps): ReactNode {
      return <div>{step.title}</div>;
    }

    await render(
      <Harness TooltipComponent={Plain}>
        <Page />
      </Harness>,
    );
    tour?.startTour(steps);
    await expect.element(page.getByRole('dialog', {name: 'First step'})).toBeVisible();
  });

  it('applies the theme as CSS variables', async () => {
    await render(
      <Harness theme={{primaryColor: 'rgb(255, 0, 0)', tooltipBackground: 'rgb(0, 0, 0)'}}>
        <Page />
      </Harness>,
    );
    tour?.startTour(steps);
    await shown('First step');
    const next = page.getByRole('button', {name: 'Next'}).element();
    expect(getComputedStyle(next).backgroundColor).toBe('rgb(255, 0, 0)');
    expect(getComputedStyle(query('.rtk-card')!).backgroundColor).toBe('rgb(0, 0, 0)');
  });

  it("lets the app's own CSS override the built-in styles without !important", async () => {
    const appCss = document.createElement('style');
    // Plain class selectors, added before the tour's styles: they still win.
    appCss.textContent = '.rtk-title { font-size: 31px; } .rtk-root { --rtk-radius: 3px; }';
    document.head.prepend(appCss);
    try {
      await render(
        <Harness>
          <Page />
        </Harness>,
      );
      tour?.startTour(steps);
      await shown('First step');
      expect(getComputedStyle(query('.rtk-title')!).fontSize).toBe('31px');
      expect(getComputedStyle(query('.rtk-card')!).borderTopLeftRadius).toBe('3px');
    } finally {
      appCss.remove();
    }
  });
});

describe('TourProvider (web): never out of sight', () => {
  it('scrolls a target below the fold into view, with room for the tooltip', async () => {
    await render(
      <Harness>
        <div style={{height: 3000, position: 'relative'}}>
          <div id="far" style={{position: 'absolute', top: 2200, left: 100, width: 200, height: 40}}>
            Far away
          </div>
        </div>
      </Harness>,
    );
    tour?.startTour([{target: '#far', title: 'Far', content: 'Down here'}]);
    const tooltip = await shown('Far');
    expect(window.scrollY).toBeGreaterThan(1000);
    expectOnScreen(query('#far')!);
    expectOnScreen(tooltip, 12);
  });

  it('scrolls nested scroll containers and the page', async () => {
    await render(
      <Harness>
        <div style={{height: 1500}} />
        <div id="scroller" style={{height: 200, overflow: 'auto', border: '1px solid'}}>
          <div style={{height: 1200}} />
          <div id="nested" style={{height: 40, width: 200}}>
            Nested
          </div>
          <div style={{height: 600}} />
        </div>
        <div style={{height: 1500}} />
      </Harness>,
    );
    tour?.startTour([{target: '#nested', title: 'Nested', content: 'Inside a scroller'}]);
    const tooltip = await shown('Nested');
    expect(query('#scroller')!.scrollTop).toBeGreaterThan(1000);
    const scroller = query('#scroller')!.getBoundingClientRect();
    const nested = query('#nested')!.getBoundingClientRect();
    expect(nested.top).toBeGreaterThanOrEqual(scroller.top);
    expect(nested.bottom).toBeLessThanOrEqual(scroller.bottom);
    expectOnScreen(query('#nested')!);
    expectOnScreen(tooltip, 12);
  });

  it('moves targets out from under a sticky header', async () => {
    await render(
      <Harness>
        <header style={{position: 'sticky', top: 0, height: 120, background: 'teal', zIndex: 2_147_483_647}}>
          Header
        </header>
        <div style={{height: 1600}} />
        <div id="under" style={{height: 40, width: 200}}>
          Under
        </div>
        <div style={{height: 1600}} />
      </Harness>,
    );
    window.scrollTo({top: 1600 + 120 - 60, behavior: 'instant'});
    tour?.startTour([{target: '#under', title: 'Under', content: 'Not hidden', placement: 'top'}]);
    await shown('Under');
    const header = query('header')!.getBoundingClientRect();
    const target = query('#under')!.getBoundingClientRect();
    expect(target.top).toBeGreaterThanOrEqual(header.bottom);
  });

  it('keeps the tooltip on screen on a small phone', async () => {
    await page.viewport(320, 568);
    await render(
      <Harness>
        <div style={{padding: 8}}>
          <div id="wide" style={{width: 300, height: 400}}>
            Wide
          </div>
        </div>
      </Harness>,
    );
    tour?.startTour([{target: '#wide', title: 'Wide', content: 'A long text. '.repeat(40)}]);
    const tooltip = await shown('Wide');
    expectOnScreen(tooltip, 12);
    expect(tooltip.getBoundingClientRect().width).toBeLessThanOrEqual(320 - 24);
  });

  it('keeps the page still while the tour is open', async () => {
    await render(
      <Harness>
        <div style={{height: 3000}}>
          <div id="top" style={{height: 40, width: 200, marginTop: 100}}>
            Top
          </div>
        </div>
      </Harness>,
    );
    tour?.startTour([{target: '#top', title: 'Top', content: 'Stay'}]);
    await shown('Top');
    await userEvent.wheel(page.elementLocator(query('[data-rtk-backdrop]')!), {delta: {y: 800}, times: 3});
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    expect(window.scrollY).toBe(0);
  });
});
