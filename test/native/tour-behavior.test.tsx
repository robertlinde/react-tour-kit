import {Profiler, type ReactNode} from 'react';
import {BackHandler, Pressable, ScrollView, Text, View} from 'react-native';
import {beforeEach, expect, vi} from 'vitest';
import {page} from 'vitest/browser';
import {render} from 'vitest-browser-react';
import {describeTourBehavior, type TourBehaviorHarness} from '../support/tour-behavior.suite.js';
import {useTourScrollView} from '../../src/react-native-platform/hooks/use-tour-scroll-view.hook.js';
import {useTourTarget} from '../../src/react-native-platform/hooks/use-tour-target.hook.js';
import {TourProvider} from '../../src/react-native-platform/tour-provider.js';

// The shared behaviour suite, on React Native (rendered with react-native-web).

const insets = {top: 47, right: 0, bottom: 34, left: 0};
type BackHandlerCallback = Parameters<typeof BackHandler.addEventListener>[1];
let backHandler: BackHandlerCallback | undefined;

function element(testId: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!found) {
    throw new Error(`No element ${testId}`);
  }

  return found;
}

const tooltip = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-testid="rtk-tooltip"]');

function Target({id, style}: {readonly id: string; readonly style?: {readonly marginLeft?: number}}): ReactNode {
  const ref = useTourTarget(id);
  return (
    <View ref={ref} testID={id} style={[{width: 160, height: 44, backgroundColor: '#ddd'}, style]}>
      <Text>{id}</Text>
    </View>
  );
}

function Scroller({height, children}: {readonly height: number; readonly children: ReactNode}): ReactNode {
  const ref = useTourScrollView();
  return (
    <ScrollView ref={ref} style={{height, flexGrow: 0}}>
      {children}
    </ScrollView>
  );
}

const native: TourBehaviorHarness = {
  platform: 'React Native',
  async render(children, props, options) {
    const app = (
      <View testID="screen" style={{width: 390, height: 844}}>
        <TourProvider insets={insets} {...props}>
          {children}
        </TourProvider>
      </View>
    );
    await render(
      options?.onCommit ? (
        <Profiler id="tour" onRender={options.onCommit}>
          {app}
        </Profiler>
      ) : (
        app
      ),
    );
  },
  insets,
  screenRect: () => element('screen').getBoundingClientRect(),
  Target,
  targetOf: (id) => id,
  rectOf: (id) => element(id).getBoundingClientRect(),
  Scroller,
  Spacer: ({height}) => <View style={{height}} />,
  ui: {
    Box: ({children}) => <View style={{width: 240, padding: 12, backgroundColor: 'white'}}>{children}</View>,
    Heading: ({id, children}) => (
      <Text nativeID={id} accessibilityRole="header">
        {children}
      </Text>
    ),
    Button: ({label, onPress}) => (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{label}</Text>
      </Pressable>
    ),
  },
  moveSilently(id, {x, y}) {
    // A native-driver animation changes the view's transform without React or any layout event knowing.
    element(id).style.transform = `translate(${x}px, ${y}px)`;
  },
  tooltip,
  async waitForStep(title) {
    await expect.element(page.getByTestId('rtk-tooltip').getByText(title, {exact: true})).toBeVisible();
    // The entrance is animated with Animated: wait for it to finish.
    await new Promise((resolve) => {
      setTimeout(resolve, 350);
    });
    const shown = tooltip();
    if (!shown) {
      throw new Error(`"${title}" is not on screen`);
    }

    return shown;
  },
  async pressAt(point) {
    const target = document.elementFromPoint(point.x, point.y);
    if (!target) {
      throw new TypeError('Nothing to press there');
    }

    const origin = target.getBoundingClientRect();
    // Forced: a disabled button is pressed like any other element, as a real finger would.
    await page
      .elementLocator(target)
      .click({position: {x: point.x - origin.left, y: point.y - origin.top}, force: true});
  },
  dismiss: {
    reason: 'closed',
    async perform() {
      expect(backHandler?.({} as Parameters<BackHandlerCallback>[0])).toBe(true);
    },
  },
};

beforeEach(async () => {
  await page.viewport(1000, 1000);
  backHandler = undefined;
  vi.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandler = handler;
    return {remove() {}};
  });
});

describeTourBehavior(native);
