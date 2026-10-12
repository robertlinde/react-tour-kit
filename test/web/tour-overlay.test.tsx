import {type ReactNode, useLayoutEffect} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render} from 'vitest-browser-react';
import {createFakeAdapter, type FakeAdapter} from '../support/fake-adapter.js';
import {tourLayout} from '../../src/shared/engine/tour-engine.js';
import {boxesEqual, inflate} from '../../src/shared/geometry/box.util.js';
import type {Box, Size} from '../../src/shared/geometry/geometry.type.js';
import {TourRoot, useTourEngine} from '../../src/shared/react/tour-root.js';
import {useTour} from '../../src/shared/react/use-tour.hook.js';
import {motion} from '../../src/shared/renderer/motion.js';
import type {SpotlightProps, TourRenderer} from '../../src/shared/renderer/renderer.type.js';
import {TourOverlay} from '../../src/shared/renderer/tour-overlay.js';
import type {TourContextType} from '../../src/shared/types/tour-context.type.js';
import {resolveI18n} from '../../src/shared/utils/i18n.util.js';
import {resolveTheme} from '../../src/shared/utils/theme.util.js';

// The shared overlay's decisions, seen through a renderer that draws nothing and records what it is asked to do.

const rect = (y: number): Box => ({x: 100, y, width: 120, height: 40});
const holeOf = (box: Box): Box => inflate(box, tourLayout.highlightPadding);

/** Every change the spotlight was asked to make: where its hole goes, and how. */
let moves: Array<Pick<SpotlightProps, 'hole' | 'transition'>> = [];
let tour: TourContextType | undefined;

function RecordingSpotlight({hole, transition}: SpotlightProps): ReactNode {
  useLayoutEffect(() => {
    const last = moves.at(-1);
    const isChange =
      !last ||
      !boxesEqual(last.hole, hole) ||
      last.transition?.durationMs !== transition?.durationMs ||
      last.transition?.easing !== transition?.easing;
    if (isChange) {
      moves.push({hole, transition});
    }
  });
  return null;
}

/** How the spotlight was first asked to move to `hole`. */
function moveTo(hole: Box): Pick<SpotlightProps, 'hole' | 'transition'> | undefined {
  return moves.find((move) => boxesEqual(move.hole, hole));
}

function ReportsSize({
  children,
  onSize,
}: {
  readonly children: ReactNode;
  readonly onSize: (size: Size) => void;
}): ReactNode {
  useLayoutEffect(() => {
    onSize({width: 300, height: 150});
  }, [onSize]);
  return children;
}

function Nothing(): ReactNode {
  return null;
}

function Passthrough({children}: {readonly children?: ReactNode}): ReactNode {
  return children;
}

const renderer: TourRenderer = {
  Layer: Passthrough,
  Backdrop: Nothing,
  Spotlight: RecordingSpotlight,
  TooltipFrame: ReportsSize,
  MeasureFrame: ReportsSize,
  Waiting: Nothing,
  card: {
    Card: Passthrough,
    Arrow: Nothing,
    Header: Passthrough,
    Counter: Nothing,
    CloseButton: Nothing,
    Body: Passthrough,
    Title: Passthrough,
    Content: Passthrough,
    Footer: Passthrough,
    Button: Nothing,
    Dots: Passthrough,
    Dot: Nothing,
    Ellipsis: Nothing,
  },
};

function Capture(): ReactNode {
  tour = useTour();
  return null;
}

function Overlay({fake}: {readonly fake: FakeAdapter}): ReactNode {
  const engine = useTourEngine(fake.adapter, undefined);
  return (
    <TourRoot engine={engine}>
      <Capture />
      <TourOverlay
        isOverlayDismissible
        engine={engine}
        renderer={renderer}
        theme={resolveTheme(undefined)}
        i18n={resolveI18n(undefined)}
        Tooltip={Nothing}
        isReducedMotion={false}
      />
    </TourRoot>
  );
}

async function startedOnSecondStep(): Promise<FakeAdapter> {
  moves = [];
  const fake = createFakeAdapter();
  fake.setTarget('#first', rect(100));
  fake.setTarget('#second', rect(300));
  await render(<Overlay fake={fake} />);
  tour!.startTour([
    {target: '#first', title: 'First', content: ''},
    {target: '#second', title: 'Second', content: ''},
    {target: '#first', title: 'Third', content: ''},
  ]);
  await vi.waitFor(() => {
    expect(moveTo(holeOf(rect(100)))).toBeDefined();
  });
  tour!.nextStep();
  await vi.waitFor(() => {
    expect(moveTo(holeOf(rect(300)))).toBeDefined();
  });
  moves = [];
  return fake;
}

describe('TourOverlay: the spotlight', () => {
  it('glides to the next step', async () => {
    moves = [];
    const fake = createFakeAdapter();
    fake.setTarget('#first', rect(100));
    fake.setTarget('#second', rect(300));
    await render(<Overlay fake={fake} />);
    tour!.startTour([
      {target: '#first', title: 'First', content: ''},
      {target: '#second', title: 'Second', content: ''},
    ]);
    await vi.waitFor(() => {
      // The first step appears in place.
      expect(moveTo(holeOf(rect(100)))).toEqual({hole: holeOf(rect(100)), transition: undefined});
    });
    tour!.nextStep();
    await vi.waitFor(() => {
      expect(moveTo(holeOf(rect(300)))?.transition).toEqual({durationMs: motion.morphMs, easing: 'standard'});
    });
  });

  it('follows a target that moves on its own instantly, like the tooltip, also while still gliding to it', async () => {
    const fake = await startedOnSecondStep();
    // Right after the step appears, an animation ends and moves the target: no event, no delay.
    fake.setTarget('#second', rect(360));
    await vi.waitFor(() => {
      expect(moveTo(holeOf(rect(360)))).toEqual({hole: holeOf(rect(360)), transition: undefined});
    });
    // Back where the glide went: still instant, the glide is over.
    moves = [];
    fake.setTarget('#second', rect(300));
    await vi.waitFor(() => {
      expect(moveTo(holeOf(rect(300)))).toEqual({hole: holeOf(rect(300)), transition: undefined});
    });
    // The next step glides again.
    tour!.nextStep();
    await vi.waitFor(() => {
      expect(moveTo(holeOf(rect(100)))?.transition).toEqual({durationMs: motion.morphMs, easing: 'standard'});
    });
  });
});
