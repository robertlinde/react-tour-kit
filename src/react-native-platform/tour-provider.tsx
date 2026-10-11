import {type ReactNode, useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {Keyboard, PixelRatio, Platform, StyleSheet, View} from 'react-native';
import {useIsomorphicLayoutEffect} from '../shared/react/use-isomorphic-layout-effect.hook.js';
import {TourRoot} from '../shared/react/tour-root.js';
import {type TourProviderBaseProps, useTourCore} from '../shared/react/tour-provider-core.js';
import {createHostStore} from './host-store.js';
import type {TourInsets} from './insets.util.js';
import {nativeRenderer} from './layer/native-renderer.js';
import {HostView} from './layer/tour-host.js';
import {NativeTourContext, type NativeTourContextValue} from './native-context.js';
import {createNativeEnvironment} from './native-environment.js';
import {createNativePlatform} from './native-platform.js';
import {createReducedMotionSetting} from './reduced-motion.js';
import {createRegistry} from './registry.js';

export type TourProviderProps = TourProviderBaseProps & {
  /**
   * Safe-area insets, for example `useSafeAreaInsets()` from react-native-safe-area-context.
   * Without them, conservative defaults keep the tooltip clear of notches and system bars.
   */
  readonly insets?: TourInsets;
};

/**
 * Provides `useTour()` and renders the tour above your app. Place it at the root, around your
 * navigation container and outside any `SafeAreaView`; pass safe-area `insets` instead.
 */
export function TourProvider({insets, ...props}: TourProviderProps): ReactNode {
  const [registry] = useState(createRegistry);
  const [hosts] = useState(createHostStore);
  const [environment] = useState(createNativeEnvironment);
  const [platform] = useState(() =>
    createNativePlatform({
      registry,
      getHost: hosts.activeHost,
      getInsets: () => environment.getInsets(hosts.activeHost()?.size ?? {width: 0, height: 0}),
      subscribeLayout: hosts.subscribeLayout,
      reducedMotion: createReducedMotionSetting(),
      getPixelRatio: () => PixelRatio.get(),
    }),
  );
  const {engine, overlay} = useTourCore(props, platform, nativeRenderer);
  const {isActive} = useSyncExternalStore(engine.subscribe, engine.getPublicState, engine.getPublicState);
  const isRootActive = useSyncExternalStore(hosts.subscribe, hosts.isRootActive, hosts.isRootActive);

  // New insets (rotation, split screen) move the safe area.
  useIsomorphicLayoutEffect(() => {
    environment.setInsets(insets);
    hosts.notifyLayout();
  }, [environment, hosts, insets?.top, insets?.right, insets?.bottom, insets?.left]);

  // The keyboard shrinks the area the tooltip may use.
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    let keyboard: {readonly top: number; readonly height: number} | undefined;
    const apply = (overlap: number): void => {
      if (environment.setKeyboardOverlap(overlap)) {
        hosts.notifyLayout();
      }
    };

    const update = (): void => {
      const current = keyboard;
      if (!current) {
        apply(0);
        return;
      }

      // Android apps that resize with the keyboard (`adjustResize` without edge-to-edge) have
      // already made room for it: only the part still covering the layer counts.
      const host = hosts.activeHost()?.instance;
      if (Platform.OS !== 'android' || !canMeasureInWindow(host)) {
        apply(current.height);
        return;
      }

      host.measureInWindow((_x, y, _width, height) => {
        if (keyboard === current) {
          apply(y + height - current.top);
        }
      });
    };

    const subscriptions = [
      Keyboard.addListener(show, (event) => {
        keyboard = {top: event.endCoordinates.screenY, height: event.endCoordinates.height};
        update();
      }),
      Keyboard.addListener(hide, () => {
        keyboard = undefined;
        update();
      }),
    ];
    // The layer resizing for the keyboard changes how much of it the keyboard covers.
    const unsubscribeLayout = hosts.subscribeLayout(() => {
      if (keyboard) {
        update();
      }
    });
    return (): void => {
      unsubscribeLayout();
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [environment, hosts]);

  const context = useMemo<NativeTourContextValue>(() => ({registry, hosts, overlay}), [registry, hosts, overlay]);
  const hidesApp = isActive && isRootActive;

  return (
    <TourRoot engine={engine}>
      <NativeTourContext.Provider value={context}>
        <View collapsable={false} style={styles.root}>
          {/* Hidden from screen readers while the tour (a modal) is open over it. Not while a
              TourHost draws the tour: that host can be inside this view (modal screens on Android). */}
          <View
            collapsable={false}
            style={styles.root}
            importantForAccessibility={hidesApp ? 'no-hide-descendants' : 'auto'}
            accessibilityElementsHidden={hidesApp}
          >
            {props.children}
          </View>
          <HostView isRoot />
        </View>
      </NativeTourContext.Provider>
    </TourRoot>
  );
}

type WindowMeasurable = {
  readonly measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

function canMeasureInWindow(value: unknown): value is WindowMeasurable {
  return (
    typeof value === 'object' &&
    value !== null &&
    'measureInWindow' in value &&
    typeof value.measureInWindow === 'function'
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
});
