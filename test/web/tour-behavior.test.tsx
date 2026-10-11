import {Profiler} from 'react';
import {beforeEach, expect, vi} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {render} from 'vitest-browser-react';
import {describeTourBehavior, type TourBehaviorHarness} from '../support/tour-behavior.suite.js';
import {TourProvider} from '../../src/react-platform/tour-provider.js';

// The shared behaviour suite, on the web.

function element(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) {
    throw new Error(`No element ${selector}`);
  }

  return found;
}

const tooltip = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-rtk-tooltip]:not([data-hidden])');

const web: TourBehaviorHarness = {
  platform: 'web',
  async render(children, props, options) {
    const provider = <TourProvider {...props}>{children}</TourProvider>;
    await render(
      options?.onCommit ? (
        <Profiler id="tour" onRender={options.onCommit}>
          {provider}
        </Profiler>
      ) : (
        provider
      ),
    );
  },
  insets: {top: 0, right: 0, bottom: 0, left: 0},
  screenRect: () => new DOMRect(0, 0, document.documentElement.clientWidth, document.documentElement.clientHeight),
  Target: ({id, style}) => (
    <div id={id} style={{width: 160, height: 44, background: '#ddd', ...style}}>
      {id}
    </div>
  ),
  targetOf: (id) => `#${id}`,
  rectOf: (id) => element(`#${id}`).getBoundingClientRect(),
  Scroller: ({height, children}) => <div style={{height, overflow: 'auto'}}>{children}</div>,
  Spacer: ({height}) => <div style={{height}} />,
  ui: {
    Box: ({children}) => <div style={{width: 240, padding: 12, background: 'white'}}>{children}</div>,
    Heading: ({id, children}) => <h2 id={id}>{children}</h2>,
    Button: ({label, onPress}) => (
      <button type="button" onClick={onPress}>
        {label}
      </button>
    ),
  },
  tooltip,
  async waitForStep(title) {
    await expect.element(page.getByRole('heading', {name: title})).toBeVisible();
    return vi.waitFor(() => {
      const shown = tooltip();
      if (!shown?.textContent?.includes(title) || Object.hasOwn(shown.dataset, 'entering')) {
        throw new Error(`"${title}" is not on screen yet`);
      }

      return shown;
    });
  },
  async pressAt(point) {
    const target = document.elementFromPoint(point.x, point.y);
    if (!target) {
      throw new TypeError('Nothing to press there');
    }

    const origin = target.getBoundingClientRect();
    // Forced: a disabled button is pressed like any other element, as a real pointer would.
    await page
      .elementLocator(target)
      .click({position: {x: point.x - origin.left, y: point.y - origin.top}, force: true});
  },
  dismiss: {
    reason: 'escape',
    async perform() {
      await userEvent.keyboard('{Escape}');
    },
  },
};

beforeEach(async () => {
  await page.viewport(390, 844);
  globalThis.scrollTo({top: 0, left: 0, behavior: 'instant'});
});

describeTourBehavior(web);
