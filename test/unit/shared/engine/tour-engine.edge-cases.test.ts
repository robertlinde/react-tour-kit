import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createFakeAdapter, type FakeAdapter} from '../../../support/fake-adapter.js';
import {deferred} from '../../../support/deferred.js';
import type {TourEndInfo} from '../../../../src/shared/types/tour-end-info.type.js';
import type {TourStep} from '../../../../src/shared/types/tour-step.type.js';
import {beforeStepTimeoutMs, createTourEngine, type TourEngine} from '../../../../src/shared/engine/tour-engine.js';

// Edge cases found in review: races between layout changes, slow measurements, retries and chained tours.

const rect = (y: number) => ({x: 100, y, width: 120, height: 40});
const step = (id: string, extra: Partial<TourStep> = {}): TourStep => ({
  target: `#${id}`,
  title: id,
  content: 'x',
  ...extra,
});

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function setup(): {engine: TourEngine; fake: FakeAdapter; ended: TourEndInfo[]} {
  const fake = createFakeAdapter();
  const ended: TourEndInfo[] = [];
  const engine = createTourEngine({
    adapter: fake.adapter,
    onTourEnd(_id, info) {
      ended.push(info);
    },
  });
  engine.subscribe(() => {
    const {measure} = engine.getViewState();
    if (measure) {
      engine.reportTooltipSize(measure.id, {width: 300, height: 150});
    }
  });
  return {engine, fake, ended};
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('tour engine: edge cases', () => {
  it('scrolls the target back again when it is pushed out once more while it was being scrolled back', async () => {
    const {engine, fake} = setup();
    fake.setTarget('#a', rect(100));
    engine.actions.startTour([step('a')]);
    await vi.advanceTimersByTimeAsync(100);
    // The first corrective scroll: more content loads above the target meanwhile and pushes it out again.
    fake.onRevealAsync(async () => {
      fake.setTarget('#a', rect(500));
      fake.triggerObservers();
      await wait(20);
      fake.setTarget('#a', rect(1100));
      fake.triggerObservers();
      await wait(20);
    });
    fake.onReveal(() => rect(400));
    const revealsBefore = fake.calls.reveal.length;
    fake.setTarget('#a', rect(900));
    fake.triggerObservers();
    await vi.advanceTimersByTimeAsync(5000);
    // A second corrective scroll ran once the first had finished...
    expect(fake.calls.reveal.length).toBe(revealsBefore + 2);
    // ...and the target is in view (the scroll's own layout events report where it went).
    fake.triggerObservers();
    await vi.advanceTimersByTimeAsync(50);
    expect(engine.getViewState().shown?.highlight).toEqual(rect(400));
  });

  it('scrolls the target back when the list it is in has been pushed off screen (rotation)', async () => {
    const {engine, fake} = setup();
    fake.setTarget('#a', rect(100), {x: 0, y: 0, width: 800, height: 400});
    engine.actions.startTour([step('a')]);
    await vi.advanceTimersByTimeAsync(100);
    // Scrolling brings the list, and the target in it, back on screen.
    fake.onRevealAsync(async () => {
      fake.setTarget('#a', rect(300), {x: 0, y: 0, width: 800, height: 400});
    });
    const revealsBefore = fake.calls.reveal.length;
    // The list now starts below the screen: what is left of its visible area there has no height.
    fake.setTarget('#a', rect(900), {x: 0, y: 850, width: 800, height: 0});
    fake.triggerObservers();
    await vi.advanceTimersByTimeAsync(2000);
    expect(fake.calls.reveal.length).toBe(revealsBefore + 1);
    // The highlight moves with it, also where scrolling reports no layout events (React Native).
    expect(engine.getViewState().shown?.highlight).toEqual(rect(300));
  });

  it('keeps the step on screen laid out while the next one is prepared (rotation, resizing)', async () => {
    const {engine, fake} = setup();
    fake.setTarget('#a', {x: 100, y: 600, width: 120, height: 40});
    fake.setTarget('#b', rect(100));
    const gate = deferred();
    engine.actions.startTour([step('a'), step('b', {onBeforeStep: async () => gate.promise})]);
    await vi.advanceTimersByTimeAsync(50);
    engine.actions.nextStep();
    await vi.advanceTimersByTimeAsync(50);
    expect(engine.getViewState().phase).toBe('preparing');
    fake.setViewport({rect: {x: 0, y: 0, width: 800, height: 400}, insets: {top: 0, right: 0, bottom: 0, left: 0}});
    fake.triggerObservers();
    await vi.advanceTimersByTimeAsync(50);
    const {layout} = engine.getViewState().shown!;
    expect(layout.y + layout.height).toBeLessThanOrEqual(400);
    gate.resolve();
    await vi.advanceTimersByTimeAsync(100);
    expect(engine.getViewState().shown?.stepIndex).toBe(1);
  });

  it('keeps the newest tooltip size when it is reported while a measurement is slow', async () => {
    const {engine, fake} = setup();
    fake.setTarget('#a', {x: 100, y: 700, width: 120, height: 40});
    engine.actions.startTour([step('a')]);
    await vi.advanceTimersByTimeAsync(50);
    const shown = engine.getViewState().shown!;
    const release = fake.holdNextMeasure();
    fake.triggerObservers();
    await vi.advanceTimersByTimeAsync(20);
    engine.reportTooltipSize(shown.transitionId, {width: 300, height: 600});
    release();
    await vi.advanceTimersByTimeAsync(20);
    expect(engine.getViewState().shown!.layout.height).toBe(600);
  });

  it('starts the second, instant scroll from where the first one stopped', async () => {
    const {engine, fake} = setup();
    fake.setTarget('#a', rect(100));
    fake.setTarget('#b', rect(2000));
    engine.actions.startTour([step('a'), step('b')]);
    await vi.advanceTimersByTimeAsync(100);
    const highlights: number[] = [];
    engine.subscribe(() => {
      const view = engine.getViewState();
      if (view.phase === 'revealing' && view.revealHighlight) {
        highlights.push(view.revealHighlight.y);
      }
    });
    // The smooth scroll stops short: the target ends partly visible at 780.
    fake.onRevealAsync(async () => {
      for (const y of [1500, 1000, 780]) {
        fake.setTarget('#b', rect(y));
        await wait(20);
      }
    });
    fake.onReveal(() => rect(300));
    engine.actions.nextStep();
    await vi.advanceTimersByTimeAsync(200);
    expect(engine.getViewState().shown?.highlight).toEqual(rect(300));
    // Never back to where the target was before any scrolling.
    expect(highlights.at(-1)).toBe(780);
  });

  it('treats a missing inset as zero, not as "no screen at all"', async () => {
    const {engine, fake, ended} = setup();
    fake.setViewport({
      rect: {x: 0, y: 0, width: 800, height: 800},
      insets: {top: 0, right: 0, bottom: Number.NaN, left: 0},
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fake.setTarget('#far', rect(4000));
    engine.actions.startTour([step('far')], 'nan');
    await vi.advanceTimersByTimeAsync(5000);
    // The target cannot be brought into view: it is skipped, not shown off screen.
    expect(ended).toEqual([expect.objectContaining({reason: 'target-missing'})]);
  });

  it('ends every tour started from onTourEnd callbacks before starting a new one', async () => {
    const {engine} = setup();
    const ends: string[] = [];
    const chained = (id: string, next?: () => void): void => {
      engine.actions.startTour([{title: id, content: 'x'}], id, {
        onTourEnd() {
          ends.push(id);
          next?.();
        },
      });
    };

    chained('a', () => {
      chained('b', () => {
        chained('d');
      });
    });
    await vi.advanceTimersByTimeAsync(10);
    engine.actions.startTour([{title: 'c', content: 'x'}], 'c');
    await vi.advanceTimersByTimeAsync(10);
    expect(engine.getPublicState().currentTourId).toBe('c');
    expect(ends).toEqual(['a', 'b', 'd']);
  });

  it('ends the tour with "error" when onBeforeStep never finishes, and aborts its signal', async () => {
    const {engine, ended} = setup();
    let signal: AbortSignal | undefined;
    engine.actions.startTour([
      {
        title: 'stuck',
        content: 'x',
        async onBeforeStep(_target, context) {
          signal = context.signal;
          await new Promise(() => {
            // Never settles.
          });
        },
      },
    ]);
    await vi.advanceTimersByTimeAsync(beforeStepTimeoutMs - 100);
    expect(ended).toEqual([]);
    await vi.advanceTimersByTimeAsync(200);
    expect(ended).toEqual([expect.objectContaining({reason: 'error', error: expect.any(Error)})]);
    expect(signal?.aborted).toBe(true);
  });
});
