import {act, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {describe, expect, it, vi} from 'vitest';
import type {TourContextType} from '../../src/shared/types/tour-context.type.js';
import {TourProvider, useTour} from '../../src/react.js';

// jsdom has no layout engine, no ResizeObserver and no top layer: the tour must still run (so apps
// can test their own code that starts tours), with steps that point at elements too.
describe('jsdom smoke test', () => {
  it('runs a whole tour without layout support', async () => {
    (globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;
    expect(globalThis.ResizeObserver).toBeUndefined();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onTourEnd = vi.fn();
    let tour: TourContextType | undefined;
    function Capture(): ReactNode {
      tour = useTour();
      return null;
    }

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <TourProvider onTourEnd={onTourEnd}>
          <Capture />
          <button type="button" id="target">
            Target
          </button>
        </TourProvider>,
      );
    });
    const wait = async (ms: number): Promise<void> => {
      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
      });
    };

    await act(async () => {
      tour?.startTour(
        [
          {target: '#target', title: 'Targeted', content: 'Points at a button'},
          {title: 'Welcome', content: 'Centred step'},
        ],
        'smoke',
      );
    });
    await wait(300);
    expect(tour?.isActive).toBe(true);
    expect(document.querySelector('[data-rtk-root]')?.textContent).toContain('Targeted');
    await act(async () => {
      tour?.nextStep();
    });
    await wait(300);
    expect(document.querySelector('[data-rtk-root]')?.textContent).toContain('Welcome');
    await act(async () => {
      tour?.endTour();
    });
    expect(onTourEnd).toHaveBeenCalledWith('smoke', expect.objectContaining({reason: 'closed', stepIndex: 1}));
    expect(warn).not.toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
  });
});
