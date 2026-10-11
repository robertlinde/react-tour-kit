import {type ReactNode, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {TourRoot} from '../shared/react/tour-root.js';
import {type TourProviderBaseProps, useTourCore} from '../shared/react/tour-provider-core.js';
import {useIsomorphicLayoutEffect} from '../shared/react/use-isomorphic-layout-effect.hook.js';
import {TourOverlay, type TourOverlayProps} from '../shared/renderer/tour-overlay.js';
import {acquireSafeAreaProbe} from './dom/viewport.util.js';
import {createWebPlatform, type WebPlatform} from './dom/web-platform.js';
import {webRenderer} from './layer/web-renderer.js';

export type TourProviderProps = TourProviderBaseProps;

/**
 * Provides `useTour()` to its children and renders the tour. Place it around your app, inside
 * your router if steps navigate between pages.
 */
export function TourProvider(props: TourProviderProps): ReactNode {
  const [platform] = useState(createWebPlatform);
  const {engine, overlay} = useTourCore(props, platform, webRenderer);
  useEffect(() => acquireSafeAreaProbe(), []);
  return (
    <TourRoot engine={engine}>
      {props.children}
      <WebMount platform={platform} overlay={overlay} />
    </TourRoot>
  );
}

/** Draws the tour into its own element at the end of `<body>`, on the client only (after hydration). */
function WebMount({
  platform,
  overlay,
}: {
  readonly platform: WebPlatform;
  readonly overlay: TourOverlayProps;
}): ReactNode {
  const [container, setContainer] = useState<HTMLElement | undefined>(undefined);
  useIsomorphicLayoutEffect(() => {
    const host = platform.mountHost();
    setContainer(host.container);
    return host.unmount;
  }, [platform]);
  return container ? createPortal(<TourOverlay {...overlay} />, container) : null;
}
