import {type ReactNode, useState} from 'react';
import {Text, View} from 'react-native';
import {beforeEach, describe, expect, it} from 'vitest';
import {page} from 'vitest/browser';
import {render} from 'vitest-browser-react';
import type {TourContextType} from '../../src/shared/types/tour-context.type.js';
import {TourHost, TourProvider, type TourProviderProps, useTour, useTourTarget} from '../../src/react-native.js';

// React Native only: what the shared behaviour suite (tour-behavior.test.tsx) cannot cover.

const screen = {width: 390, height: 844};
let tour: TourContextType | undefined;

function Capture(): ReactNode {
  tour = useTour();
  return null;
}

function Target({id, style}: {readonly id: string; readonly style?: object}): ReactNode {
  const ref = useTourTarget(id);
  return (
    <View ref={ref} testID={id} style={[{width: 160, height: 44, backgroundColor: '#ddd'}, style]}>
      <Text>{id}</Text>
    </View>
  );
}

function Phone({children, ...props}: Omit<TourProviderProps, 'children'> & {readonly children?: ReactNode}): ReactNode {
  return (
    <View style={{width: screen.width, height: screen.height}}>
      <TourProvider insets={{top: 47, bottom: 34}} {...props}>
        <Capture />
        {children}
      </TourProvider>
    </View>
  );
}

function rectOf(testId: string): DOMRect {
  const element = document.querySelector(`[data-testid="${testId}"]`);
  if (!element) {
    throw new Error(`No element ${testId}`);
  }

  return element.getBoundingClientRect();
}

/** Waits until the real tooltip (not the invisible measuring copy) shows `title` and has finished entering. */
async function shown(title: string): Promise<HTMLElement> {
  const tooltip = page.getByTestId('rtk-tooltip').getByText(title, {exact: true});
  await expect.element(tooltip).toBeVisible();
  await new Promise((resolve) => {
    setTimeout(resolve, 350);
  });
  return tooltip.element() as HTMLElement;
}

beforeEach(async () => {
  tour = undefined;
  await page.viewport(1000, 1000);
});

describe('TourProvider (React Native)', () => {
  it('keeps finding a target when one of two components with its id unmounts', async () => {
    function Two(): ReactNode {
      const [showFirst, setShowFirst] = useState(true);
      return (
        <View style={{paddingTop: 200}}>
          {showFirst ? <Target id="shared" /> : null}
          <Target id="shared" />
          <Text
            testID="toggle"
            onPress={() => {
              setShowFirst(false);
            }}
          >
            toggle
          </Text>
        </View>
      );
    }

    await render(
      <Phone>
        <Two />
      </Phone>,
    );
    document.querySelector<HTMLElement>('[data-testid="toggle"]')?.click();
    tour?.startTour([{target: 'shared', title: 'Shared', content: 'Still here'}]);
    await shown('Shared');
  });

  it('draws the tour in the newest TourHost', async () => {
    function ModalScreen(): ReactNode {
      return (
        <View testID="modal" style={{position: 'absolute', top: 100, left: 0, right: 0, bottom: 0}}>
          <Target id="in-modal" style={{marginTop: 50}} />
          <TourHost />
        </View>
      );
    }

    await render(
      <Phone>
        <ModalScreen />
      </Phone>,
    );
    tour?.startTour([{target: 'in-modal', title: 'In the modal', content: 'Drawn in the modal host'}]);
    const title = await shown('In the modal');
    expect(document.querySelector('[data-testid="modal"]')?.contains(title)).toBe(true);
    const tooltip = title.closest('[data-testid="rtk-tooltip"]');
    expect(tooltip?.getBoundingClientRect().top).toBeGreaterThan(rectOf('in-modal').bottom);
  });
});
