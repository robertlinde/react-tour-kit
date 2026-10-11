import {type ComponentRef, type ReactNode, useContext, useRef, useState, useSyncExternalStore} from 'react';
import {Dimensions, type LayoutChangeEvent, StyleSheet, View} from 'react-native';
import {devWarn, isDevelopment} from '../../shared/engine/report.util.js';
import {useIsomorphicLayoutEffect} from '../../shared/react/use-isomorphic-layout-effect.hook.js';
import {NativeTourContext} from '../native-context.js';
import {TourOverlay} from '../../shared/renderer/tour-overlay.js';
import {LayerSizeContext} from './native-renderer.js';

let hostCounter = 0;

/**
 * Where the tour is drawn. `TourProvider` already renders one around your app; add another
 * `<TourHost />` as the last child of a screen presented as a native modal (react-native-screens
 * `presentation: 'modal'`, or inside your own `<Modal>`), so tours can highlight elements there.
 * The most recently mounted host is used.
 */
export function TourHost(): ReactNode {
  return <HostView isRoot={false} />;
}

/** @internal Also used by `TourProvider` for its root host. */
export function HostView({isRoot}: {readonly isRoot: boolean}): ReactNode {
  const context = useContext(NativeTourContext);
  const viewRef = useRef<ComponentRef<typeof View> | null>(null);
  const [key] = useState(() => ++hostCounter);
  const [size, setSize] = useState({width: 0, height: 0});
  const hosts = context?.hosts;
  const activeKey = useSyncExternalStore(
    hosts?.subscribe ?? subscribeNothing,
    () => hosts?.activeKey(),
    () => hosts?.activeKey(),
  );
  const engine = context?.overlay.engine;
  const isTourActive = useSyncExternalStore(
    engine?.subscribe ?? subscribeNothing,
    () => engine?.getPublicState().isActive ?? false,
    () => engine?.getPublicState().isActive ?? false,
  );

  useIsomorphicLayoutEffect(() => hosts?.register(key, () => viewRef.current, isRoot), [hosts, key, isRoot]);

  if (!context) {
    if (!isRoot) {
      devWarn('<TourHost /> must be rendered inside <TourProvider>.');
    }

    return null;
  }

  const onLayout = (event: LayoutChangeEvent): void => {
    const {width, height} = event.nativeEvent.layout;
    const next = {width, height};
    setSize(next);
    context.hosts.setSize(key, next);
    if (isRoot && isDevelopment) {
      warnIfNotFullWindow(viewRef.current);
    }
  };

  const isActive = activeKey === key;
  const isModal = !isRoot && isActive && isTourActive;
  return (
    <View
      ref={viewRef}
      collapsable={false}
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      // A TourHost drawing the tour hides the screen it is in from VoiceOver (its siblings).
      accessibilityViewIsModal={isModal}
      onLayout={onLayout}
    >
      {/* Drawn in the active host only, once it has been laid out. */}
      {isActive && size.width > 0 && size.height > 0 ? (
        <LayerSizeContext.Provider value={size}>
          <TourOverlay {...context.overlay} />
        </LayerSizeContext.Provider>
      ) : null}
    </View>
  );
}

function subscribeNothing(): () => void {
  return () => {
    // Nothing to unsubscribe.
  };
}

let warnedNotFullWindow = false;

function warnIfNotFullWindow(view: ComponentRef<typeof View> | null): void {
  if (!view || warnedNotFullWindow) {
    return;
  }

  view.measureInWindow((x: number, y: number, width: number, height: number) => {
    const window = Dimensions.get('window');
    if (x > 1 || y > 1 || width + 1 < window.width || height + 1 < window.height) {
      warnedNotFullWindow = true;
      devWarn(
        'TourProvider does not fill the window, so the overlay will not cover the whole screen. ' +
          'Place it at the root of your app, outside SafeAreaView or padded containers, and pass `insets` instead.',
      );
    }
  });
}
