import * as Dialog from '@radix-ui/react-dialog';
import {type ReactNode, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {render} from 'vitest-browser-react';
import {useTour} from '../../src/shared/react/use-tour.hook.js';
import type {TourEndInfo} from '../../src/shared/types/tour-end-info.type.js';
import type {TourStep} from '../../src/shared/types/tour-step.type.js';
import {TourProvider} from '../../src/react-platform/tour-provider.js';

// Web only: tours started inside the app's own modal dialogs, as built with modal libraries.

let isDialogOpen = false;
const onTourEnd = vi.fn<(tourId: string | undefined, info: TourEndInfo) => void>();

const steps: TourStep[] = [
  {target: '#first', title: 'First', content: 'In the dialog'},
  {target: '#second', title: 'Second', content: 'Long. '.repeat(400)},
];

function StartButton(): ReactNode {
  const {startTour} = useTour();
  return (
    <button
      type="button"
      onClick={() => {
        startTour(steps);
      }}
    >
      Start tour
    </button>
  );
}

function DialogContent(): ReactNode {
  return (
    <>
      <StartButton />
      <div id="first" style={{height: 40}}>
        First target
      </div>
      <div id="second" style={{height: 40}}>
        Second target
      </div>
    </>
  );
}

function RadixPage(): ReactNode {
  const [isOpen, setIsOpen] = useState(true);
  isDialogOpen = isOpen;
  return (
    <TourProvider onTourEnd={onTourEnd}>
      <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={{position: 'fixed', inset: 0, background: 'rgb(0 0 0 / 50%)'}} />
          <Dialog.Content style={{position: 'fixed', top: 100, left: 100, width: 300, background: 'white'}}>
            <Dialog.Title>Export</Dialog.Title>
            <Dialog.Description>Settings</Dialog.Description>
            <DialogContent />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </TourProvider>
  );
}

/**
 * A modal like those of libraries that make the rest of the page inert (Headless UI, for one):
 * drawn in its own element on `<body>`, everything else on `<body>` is made inert.
 */
function InertModal({children}: {readonly children: ReactNode}): ReactNode {
  const [root] = useState(() => {
    const element = document.createElement('div');
    element.dataset.inertModal = '';
    return element;
  });
  useEffect(() => {
    document.body.append(root);
    const makeOthersInert = (): void => {
      for (const element of document.body.children) {
        if (element !== root) {
          element.setAttribute('inert', '');
        }
      }
    };

    makeOthersInert();
    // Also what is added while it is open, such as the tour's own element.
    const observer = new MutationObserver(makeOthersInert);
    observer.observe(document.body, {childList: true});
    return () => {
      observer.disconnect();
      for (const element of document.body.children) {
        element.removeAttribute('inert');
      }

      root.remove();
    };
  }, [root]);
  return createPortal(children, root);
}

async function startedTour(): Promise<HTMLElement> {
  await page.getByRole('button', {name: 'Start tour'}).click();
  // Found by role: the tour must not be hidden from screen readers.
  await expect.element(page.getByRole('heading', {name: 'First'})).toBeVisible();
  const tooltip = document.querySelector<HTMLElement>('[data-rtk-tooltip]')!;
  await vi.waitFor(() => {
    expect(Object.hasOwn(tooltip.dataset, 'entering')).toBe(false);
  });
  return tooltip;
}

afterEach(() => {
  onTourEnd.mockClear();
});

describe('a tour inside a Radix modal dialog', () => {
  it('can be reached by screen readers', async () => {
    await render(<RadixPage />);
    const tooltip = await startedTour();
    expect(tooltip.closest('[aria-hidden="true"], [inert]')).toBeNull();
    expect(tooltip.contains(document.activeElement)).toBe(true);
  });

  it('takes Escape first, and leaves the dialog open', async () => {
    await render(<RadixPage />);
    await startedTour();
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => {
      expect(onTourEnd).toHaveBeenCalledWith(undefined, expect.objectContaining({reason: 'escape'}));
    });
    expect(isDialogOpen).toBe(true);
    // Once the tour is over, Escape closes the dialog again.
    await expect.element(page.getByRole('button', {name: 'Start tour'})).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => {
      expect(isDialogOpen).toBe(false);
    });
  });

  it('leaves the dialog open while the tour is used and dismissed', async () => {
    await render(<RadixPage />);
    await startedTour();
    await page.getByRole('button', {name: 'Next'}).click();
    await expect.element(page.getByRole('heading', {name: 'Second'})).toBeVisible();
    await page.getByRole('button', {name: 'Close tour'}).click();
    await vi.waitFor(() => {
      expect(onTourEnd).toHaveBeenCalledWith(undefined, expect.objectContaining({reason: 'closed'}));
    });
    expect(isDialogOpen).toBe(true);
  });

  it("scrolls a long tooltip, despite the dialog's scroll lock", async () => {
    await render(<RadixPage />);
    await startedTour();
    await page.getByRole('button', {name: 'Next'}).click();
    await expect.element(page.getByRole('heading', {name: 'Second'})).toBeVisible();
    const body = document.querySelector('[data-rtk-tooltip] .rtk-body')!;
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    const wheel = new WheelEvent('wheel', {deltaY: 100, bubbles: true, cancelable: true});
    body.dispatchEvent(wheel);
    // Cancelling it would stop the browser from scrolling the tooltip.
    expect(wheel.defaultPrevented).toBe(false);
  });
});

describe('a tour inside a modal that makes the rest of the page inert', () => {
  it('stays usable and reachable', async () => {
    await render(
      <TourProvider onTourEnd={onTourEnd}>
        <InertModal>
          <DialogContent />
        </InertModal>
      </TourProvider>,
    );
    const tooltip = await startedTour();
    expect(tooltip.closest('[aria-hidden="true"], [inert]')).toBeNull();
    await page.getByRole('button', {name: 'Next'}).click();
    await expect.element(page.getByRole('heading', {name: 'Second'})).toBeVisible();
  });
});
