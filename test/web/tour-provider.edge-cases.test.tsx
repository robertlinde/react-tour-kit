import {type ReactNode, useEffect, useRef} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {render} from 'vitest-browser-react';
import {useTour} from '../../src/shared/react/use-tour.hook.js';
import type {TourContextType} from '../../src/shared/types/tour-context.type.js';
import type {TourEndInfo} from '../../src/shared/types/tour-end-info.type.js';
import type {TourTooltipProps} from '../../src/shared/types/tour-tooltip-props.type.js';
import {TourProvider, type TourProviderProps} from '../../src/react-platform/tour-provider.js';

// Web only: pages and components that used to break the tour (found in review).

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
      {children}
    </TourProvider>
  );
}

const query = <T extends Element = HTMLElement>(selector: string): T | null => document.querySelector<T>(selector);

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

async function closed(): Promise<void> {
  tour?.endTour();
  await vi.waitFor(() => {
    expect(query('[data-rtk-root]')).toBeNull();
  });
}

/** Styles for the page, removed after the test. */
const cleanups: Array<() => void> = [];
function addPageCss(css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.prepend(style);
  cleanups.push(() => {
    style.remove();
  });
}

function expectInViewport(rect: DOMRect): void {
  expect(rect.top).toBeGreaterThanOrEqual(-0.5);
  expect(rect.left).toBeGreaterThanOrEqual(-0.5);
  expect(rect.bottom).toBeLessThanOrEqual(document.documentElement.clientHeight + 0.5);
  expect(rect.right).toBeLessThanOrEqual(document.documentElement.clientWidth + 0.5);
}

beforeEach(async () => {
  tour = undefined;
  await page.viewport(1280, 800);
  window.scrollTo({top: 0, left: 0, behavior: 'instant'});
});

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
});

describe('TourProvider (web): global CSS and other libraries', () => {
  it('stays clickable, in place and readable under global resets and a body without pointer events', async () => {
    // Global dialog styles, a Tailwind v3 style preflight, and what modal libraries do to <body>.
    addPageCss(`
      dialog { border: 1px solid red; padding: 24px; max-width: 32rem; }
      dialog::backdrop { background: rgba(15, 23, 42, 0.6); }
      button { background: transparent; padding: 0; font-size: inherit; font-weight: inherit; line-height: inherit; }
      h1, h2, h3 { font-size: inherit; font-weight: inherit; margin: 0; }
    `);
    document.body.style.pointerEvents = 'none';
    cleanups.push(() => {
      document.body.style.pointerEvents = '';
    });
    await render(
      <Harness>
        <div id="first" style={{width: 200, height: 40, marginTop: 100}}>
          First
        </div>
        <div id="second" style={{width: 200, height: 40, marginTop: 100}}>
          Second
        </div>
      </Harness>,
    );
    tour?.startTour([
      {target: '#first', title: 'First step', content: 'Hello'},
      {target: '#second', title: 'Second step', content: 'Bye'},
    ]);
    await shown('First step');
    const root = query('[data-rtk-root]')!;
    expect(getComputedStyle(root).borderTopWidth).toBe('0px');
    expect(getComputedStyle(root).maxWidth).toBe('none');
    expect(getComputedStyle(root, '::backdrop').backgroundColor).toBe('rgba(0, 0, 0, 0)');
    const next = page.getByRole('button', {name: 'Next'}).element();
    expect(getComputedStyle(next).backgroundColor).toBe('rgb(37, 99, 235)');
    expect(getComputedStyle(next).paddingLeft).not.toBe('0px');
    expect(Number.parseFloat(getComputedStyle(query('.rtk-title')!).fontSize)).toBeGreaterThan(14);
    // Hit-testing finds the button (not the page underneath), and pressing it works.
    const box = next.getBoundingClientRect();
    expect(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).toBe(next);
    await page.getByRole('button', {name: 'Next'}).click();
    await shown('Second step');
  });

  it("keeps the tour's presses, focus and keys away from the app's outside-click handlers and shortcuts", async () => {
    const seen: string[] = [];
    function Menu(): ReactNode {
      // Like Radix, Headless UI or MUI: a menu that closes on any press outside it, and global shortcuts.
      const ref = useRef<HTMLDivElement | null>(null);
      useEffect(() => {
        const listener = (event: Event): void => {
          if (!ref.current?.contains(event.target as Node)) {
            seen.push(event.type);
          }
        };

        const types = ['pointerdown', 'mousedown', 'click', 'focusin', 'keydown'];
        for (const type of types) {
          document.addEventListener(type, listener);
        }

        return () => {
          for (const type of types) {
            document.removeEventListener(type, listener);
          }
        };
      }, []);
      return (
        <div ref={ref} id="menu" style={{width: 200, height: 120, marginTop: 100}}>
          Menu
        </div>
      );
    }

    await render(
      <Harness>
        <Menu />
        <div id="other" style={{width: 200, height: 40, marginTop: 100}}>
          Other
        </div>
      </Harness>,
    );
    tour?.startTour([
      {target: '#menu', title: 'Menu step', content: 'In the menu'},
      {target: '#other', title: 'Other step', content: 'Next'},
    ]);
    await shown('Menu step');
    seen.length = 0;
    await page.getByRole('button', {name: 'Next'}).click();
    await shown('Other step');
    await userEvent.keyboard('{ArrowLeft}');
    await shown('Menu step');
    expect(seen).toEqual([]);
  });

  it('works with native form controls in a custom tooltip', async () => {
    function Controls({step, titleId}: TourTooltipProps): ReactNode {
      return (
        <div style={{background: 'white', padding: 12}}>
          <h2 id={titleId}>{step.title}</h2>
          <label>
            <input type="checkbox" /> Do not show again
          </label>
          <label>
            <input defaultChecked type="radio" name="size" value="s" /> Small
          </label>
          <label>
            <input type="radio" name="size" value="l" /> Large
          </label>
          <input type="range" aria-label="Volume" min={0} max={10} defaultValue={5} />
        </div>
      );
    }

    await render(
      <Harness TooltipComponent={Controls}>
        <div id="a" style={{width: 200, height: 40, marginTop: 100}}>
          A
        </div>
        <div id="b" style={{width: 200, height: 40, marginTop: 100}}>
          B
        </div>
      </Harness>,
    );
    tour?.startTour([
      {target: '#a', title: 'A', content: 'x'},
      {target: '#b', title: 'B', content: 'y'},
    ]);
    await expect.element(page.getByRole('heading', {name: 'A'})).toBeVisible();
    const checkbox = page.getByRole('checkbox').element() as HTMLInputElement;
    checkbox.focus();
    await userEvent.keyboard(' ');
    expect(checkbox.checked).toBe(true);
    const small = page.getByRole('radio', {name: 'Small'}).element() as HTMLInputElement;
    small.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect((page.getByRole('radio', {name: 'Large'}).element() as HTMLInputElement).checked).toBe(true);
    const slider = page.getByRole('slider').element() as HTMLInputElement;
    slider.focus();
    await userEvent.keyboard('{ArrowRight}{ArrowUp}');
    expect(slider.value).toBe('7');
    // None of these keys moved the tour.
    expect(tour?.currentStep).toBe(0);
  });

  it('gives focus back to the trigger after showing a step over an app dialog', async () => {
    function AppDialog(): ReactNode {
      return (
        <dialog id="app-dialog">
          <div id="in-dialog" style={{width: 200, height: 40}}>
            In the dialog
          </div>
        </dialog>
      );
    }

    await render(
      <Harness>
        <button type="button" id="trigger">
          Start
        </button>
        <div id="page" style={{width: 200, height: 40, marginTop: 100}}>
          Page
        </div>
        <AppDialog />
      </Harness>,
    );
    const dialog = query<HTMLDialogElement>('#app-dialog')!;
    const trigger = query<HTMLButtonElement>('#trigger')!;
    trigger.focus();
    tour?.startTour([
      {target: '#page', title: 'Page step', content: 'x'},
      {
        target: '#in-dialog',
        title: 'Dialog step',
        content: 'y',
        onBeforeStep() {
          dialog.showModal();
        },
      },
      {
        target: '#page',
        title: 'Back on the page',
        content: 'z',
        onBeforeStep() {
          dialog.close();
        },
      },
    ]);
    await shown('Page step');
    await page.getByRole('button', {name: 'Next'}).click();
    const tooltip = await shown('Dialog step');
    await vi.waitFor(() => {
      expect(tooltip.contains(document.activeElement)).toBe(true);
    });
    await page.getByRole('button', {name: 'Next'}).click();
    await shown('Back on the page');
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => {
      expect(query('[data-rtk-root]')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('swaps the arrow keys when only <body> is right-to-left', async () => {
    document.body.dir = 'rtl';
    cleanups.push(() => {
      document.body.dir = '';
    });
    await render(
      <Harness>
        <div id="a" style={{width: 200, height: 40, marginTop: 100}}>
          A
        </div>
        <div id="b" style={{width: 200, height: 40, marginTop: 100}}>
          B
        </div>
      </Harness>,
    );
    tour?.startTour([
      {target: '#a', title: 'A', content: 'x'},
      {target: '#b', title: 'B', content: 'y'},
    ]);
    await shown('A');
    await userEvent.keyboard('{ArrowLeft}');
    await shown('B');
  });
});

describe('TourProvider (web): finding and revealing targets', () => {
  it('scrolls <body> when it is the scroll container (with an overflow on <html>)', async () => {
    addPageCss('html { overflow: hidden; height: 100%; } body { overflow: auto; height: 100%; margin: 0; }');
    const onTourEnd = vi.fn<(id: string | undefined, info: TourEndInfo) => void>();
    await render(
      <Harness onTourEnd={onTourEnd}>
        <div style={{height: 2000}} />
        <div id="deep" style={{width: 200, height: 40}}>
          Deep
        </div>
        <div style={{height: 2000}} />
      </Harness>,
    );
    tour?.startTour([{target: '#deep', title: 'Deep', content: 'In the body scroller'}]);
    await shown('Deep');
    expect(document.body.scrollTop).toBeGreaterThan(1000);
    expectInViewport(query('#deep')!.getBoundingClientRect());
    expect(onTourEnd).not.toHaveBeenCalled();
  });

  it('never scrolls an overflow: hidden container (a carousel), and leaves it as it was', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onTourEnd = vi.fn<(id: string | undefined, info: TourEndInfo) => void>();
    await render(
      <Harness onTourEnd={onTourEnd}>
        <div id="carousel" style={{width: 400, height: 100, overflow: 'hidden', marginTop: 100}}>
          <div style={{display: 'flex', width: 1200}}>
            <div style={{width: 400, flex: 'none'}}>One</div>
            <div style={{width: 400, flex: 'none'}}>Two</div>
            <div id="third-slide" style={{width: 400, flex: 'none'}}>
              Three
            </div>
          </div>
        </div>
      </Harness>,
    );
    tour?.startTour([{target: '#third-slide', title: 'Slide', content: 'Hidden by the carousel'}], 'carousel');
    await vi.waitFor(
      () => {
        expect(onTourEnd).toHaveBeenCalledWith('carousel', expect.objectContaining({reason: 'target-missing'}));
      },
      {timeout: 8000},
    );
    expect(query('#carousel')!.scrollLeft).toBe(0);
  });

  it('shows an absolutely positioned menu that sticks out of an overflow: hidden bar', async () => {
    await render(
      <Harness>
        <nav style={{position: 'relative', marginTop: 40}}>
          <div style={{overflow: 'hidden', height: 40}}>
            <div style={{position: 'absolute', top: 48, left: 0, width: 200}}>
              <div id="menu-item" style={{height: 40}}>
                Menu item
              </div>
            </div>
          </div>
        </nav>
      </Harness>,
    );
    tour?.startTour([{target: '#menu-item', title: 'Item', content: 'Outside its bar'}]);
    await shown('Item');
  });

  it('does not count invisible fixed elements (a closed menu) as covering the target', async () => {
    await render(
      <Harness>
        <div style={{position: 'fixed', top: 64, left: 0, right: 0, height: 300, visibility: 'hidden', opacity: 0}} />
        <div id="under-menu" style={{width: 200, height: 40, marginTop: 120}}>
          Under a closed menu
        </div>
      </Harness>,
    );
    tour?.startTour([{target: '#under-menu', title: 'Visible', content: 'Not covered'}]);
    await shown('Visible');
  });

  it('finds targets and fixed bars inside shadow roots', async () => {
    function Shadow({mode}: {readonly mode: 'target-in-fixed-nav' | 'fixed-toolbar'}): ReactNode {
      const ref = useRef<HTMLDivElement | null>(null);
      useEffect(() => {
        const host = ref.current!;
        const root = host.shadowRoot ?? host.attachShadow({mode: 'open'});
        root.innerHTML =
          mode === 'target-in-fixed-nav'
            ? '<nav style="position:fixed;top:0;left:0;right:0;height:60px;background:#eee"><a id="shadow-link" href="#x" style="display:inline-block;width:80px;height:40px">Link</a></nav>'
            : '<div style="position:fixed;left:0;right:0;bottom:0;height:120px;background:#ccc">Toolbar</div>';
      }, [mode]);
      return <div ref={ref} />;
    }

    const {unmount} = await render(
      <Harness>
        <Shadow mode="target-in-fixed-nav" />
        <div style={{height: 2000}} />
      </Harness>,
    );
    const link = {current: query('div')!.shadowRoot?.querySelector('#shadow-link') ?? null};
    await vi.waitFor(() => {
      link.current = [...document.querySelectorAll('div')]
        .map((element) => element.shadowRoot?.querySelector('#shadow-link'))
        .find(Boolean) as Element | null;
      expect(link.current).not.toBeNull();
    });
    tour?.startTour([{target: link, title: 'Shadow link', content: 'In a fixed nav'}]);
    await shown('Shadow link');
    await closed();
    await unmount();

    await render(
      <Harness>
        <Shadow mode="fixed-toolbar" />
        <div style={{height: 1500}} />
        <div id="above-toolbar" style={{width: 200, height: 40}}>
          Target
        </div>
        <div style={{height: 1500}} />
      </Harness>,
    );
    tour?.startTour([{target: '#above-toolbar', title: 'Clear', content: 'Not under the toolbar', placement: 'top'}]);
    await shown('Clear');
    const target = query('#above-toolbar')!.getBoundingClientRect();
    expect(target.bottom).toBeLessThanOrEqual(document.documentElement.clientHeight - 120 + 0.5);
  });

  it('resolves a percentage scroll-padding against the viewport', async () => {
    addPageCss('html { scroll-padding-top: 25%; }');
    await render(
      <Harness>
        <div style={{height: 2000}} />
        <div id="padded" style={{width: 200, height: 40}}>
          Padded
        </div>
        <div style={{height: 2000}} />
      </Harness>,
    );
    // Scrolled past the target: revealing it scrolls up and lines it up with the top of the area.
    window.scrollTo({top: 3000, behavior: 'instant'});
    tour?.startTour([{target: '#padded', title: 'Padded', content: 'Below the padding', placement: 'bottom'}]);
    await shown('Padded');
    expect(query('#padded')!.getBoundingClientRect().top).toBeGreaterThanOrEqual(800 * 0.25 - 0.5);
  });

  it('keeps the dimmed overlay on screen while scrolling to a target far away', async () => {
    await page.viewport(375, 667);
    await render(
      <Harness>
        <div id="near" style={{width: 200, height: 40, marginTop: 100}}>
          Near
        </div>
        <div style={{height: 4000}} />
        <div id="far" style={{width: 200, height: 40}}>
          Far
        </div>
      </Harness>,
    );
    tour?.startTour([
      {target: '#near', title: 'Near', content: 'x'},
      {target: '#far', title: 'Far', content: 'y'},
    ]);
    await shown('Near');
    const holes: DOMRect[] = [];
    let isSampling = true;
    const sample = (): void => {
      const spotlight = query('[data-rtk-spotlight]');
      if (spotlight) {
        holes.push(spotlight.getBoundingClientRect());
      }

      if (isSampling) {
        requestAnimationFrame(sample);
      }
    };

    requestAnimationFrame(sample);
    await page.getByRole('button', {name: 'Next'}).click();
    await shown('Far');
    isSampling = false;
    // The dim is the hole's shadow: the hole never strays further from the screen than the shadow reaches.
    for (const hole of holes) {
      expect(hole.top).toBeLessThanOrEqual(667 + 32);
      expect(hole.bottom).toBeGreaterThanOrEqual(-32);
    }
  });
});

describe('TourProvider (web): the tooltip', () => {
  it('keeps the arrow of a tooltip above or left of its target', async () => {
    await render(
      <Harness>
        <div id="low" style={{width: 200, height: 40, marginTop: 400, marginLeft: 600}}>
          Low
        </div>
      </Harness>,
    );
    for (const placement of ['top', 'left'] as const) {
      tour?.startTour([{target: '#low', title: placement, content: 'With an arrow', placement}], placement);

      const tooltip = await shown(placement);
      expect(tooltip.dataset.placement).toBe(placement);
      expect(Object.hasOwn(tooltip.dataset, 'overflowing')).toBe(false);
      expect(getComputedStyle(tooltip).overflow).toBe('visible');

      await closed();
    }
  });

  it('scrolls a long tooltip with the keyboard while the tooltip has focus', async () => {
    await page.viewport(390, 600);
    await render(
      <Harness>
        <div id="short" style={{width: 200, height: 40, marginTop: 40}}>
          Short
        </div>
      </Harness>,
    );
    tour?.startTour([{target: '#short', title: 'Long', content: 'A long text. '.repeat(200)}]);
    const tooltip = await shown('Long');
    tooltip.focus();
    await userEvent.keyboard('{PageDown}');
    await vi.waitFor(() => {
      expect(query('.rtk-body')!.scrollTop).toBeGreaterThan(0);
    });
    expect(window.scrollY).toBe(0);
  });

  it('hides the page scrollbar while the tour is open, and restores it afterwards', async () => {
    document.documentElement.style.overflowY = 'scroll';
    cleanups.push(() => {
      document.documentElement.style.overflowY = '';
    });
    await render(
      <Harness>
        <div id="top" style={{width: 200, height: 40, marginTop: 100}}>
          Top
        </div>
        <div style={{height: 3000}} />
      </Harness>,
    );
    tour?.startTour([{target: '#top', title: 'Top', content: 'Locked'}]);
    await shown('Top');
    expect(getComputedStyle(document.documentElement).overflowY).toBe('hidden');
    await closed();
    expect(document.documentElement.style.overflowY).toBe('scroll');
    document.documentElement.removeAttribute('style');
    // Nothing left behind on a page that had no inline styles.
    tour?.startTour([{target: '#top', title: 'Again', content: 'Locked'}]);
    await shown('Again');
    await closed();
    expect(document.documentElement.hasAttribute('style')).toBe(false);
  });
});

describe('TourProvider (web): leaves the page as it was', () => {
  it('removes its own element from <body> when unmounted', async () => {
    const {unmount} = await render(<Harness />);
    expect(query('[data-rtk-host]')).not.toBeNull();
    await unmount();
    expect(query('[data-rtk-host]')).toBeNull();
    await sleep(0);
  });
});
