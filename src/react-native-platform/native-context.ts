import {createContext} from 'react';
import type {TourOverlayProps} from '../shared/renderer/tour-overlay.js';
import type {HostStore} from './host-store.js';
import type {TourRegistry} from './registry.js';

/** Everything the native hooks and hosts need from the provider. Internal. */
export type NativeTourContextValue = {
  readonly registry: TourRegistry;
  readonly hosts: HostStore;
  /** Rendered by the active host. */
  readonly overlay: TourOverlayProps;
};

export const NativeTourContext = createContext<NativeTourContextValue | undefined>(undefined);
NativeTourContext.displayName = 'NativeTourContext';
