import type {Size} from '../shared/geometry/geometry.type.js';

type HostRecord = {
  readonly key: number;
  /** The provider's own host: always at the bottom of the stack, whatever the mount order. */
  readonly root: boolean;
  readonly getInstance: () => unknown;
  size: Size;
};

/**
 * The views the tour can be drawn in: the provider's own full-window layer, plus any `TourHost`
 * mounted inside native modal screens. The most recently mounted host is used.
 */
export type HostStore = {
  readonly register: (key: number, getInstance: () => unknown, root: boolean) => () => void;
  readonly setSize: (key: number, size: Size) => void;
  /** Key of the host the tour is drawn in. */
  readonly activeKey: () => number | undefined;
  /** True while the tour is drawn in the provider's own host (no `TourHost` is mounted). */
  readonly isRootActive: () => boolean;
  readonly activeHost: () => {readonly instance: unknown; readonly size: Size} | undefined;
  /** Host list changes (which host is active). */
  readonly subscribe: (listener: () => void) => () => void;
  /** Anything that can move targets relative to the layer: host changes and sizes, keyboard. */
  readonly subscribeLayout: (listener: () => void) => () => void;
  readonly notifyLayout: () => void;
};

export function createHostStore(): HostStore {
  const hosts: HostRecord[] = [];
  const listeners = new Set<() => void>();
  const layoutListeners = new Set<() => void>();
  const emit = (set: Set<() => void>): void => {
    // Snapshot: listeners may unsubscribe while being notified.
    const snapshot = [...set];
    for (const listener of snapshot) {
      listener();
    }
  };

  const store: HostStore = {
    register(key, getInstance, root) {
      const record: HostRecord = {key, root, getInstance, size: {width: 0, height: 0}};
      if (root) {
        hosts.unshift(record);
      } else {
        hosts.push(record);
      }

      emit(listeners);
      emit(layoutListeners);
      return () => {
        const index = hosts.findIndex((host) => host.key === key);
        if (index !== -1) {
          hosts.splice(index, 1);
          emit(listeners);
          emit(layoutListeners);
        }
      };
    },
    setSize(key, size) {
      const host = hosts.find((candidate) => candidate.key === key);
      if (host && (host.size.width !== size.width || host.size.height !== size.height)) {
        host.size = size;
        emit(layoutListeners);
      }
    },
    activeKey: () => hosts.at(-1)?.key,
    isRootActive: () => hosts.at(-1)?.root ?? true,
    activeHost() {
      const host = hosts.at(-1);
      return host ? {instance: host.getInstance(), size: host.size} : undefined;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeLayout(listener) {
      layoutListeners.add(listener);
      return () => {
        layoutListeners.delete(listener);
      };
    },
    notifyLayout() {
      emit(layoutListeners);
    },
  };
  return store;
}
