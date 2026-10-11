import type {RefObject} from 'react';

/**
 * Targets and scroll views registered by `useTourTarget` / `useTourScrollView`, one registry per
 * `TourProvider`. A target id can be registered by several components at once (two screens of a
 * stack during a transition, tabs that stay mounted); unregistering only removes the caller's own
 * registration, and the newest registration comes first.
 */
export type TourRegistry = {
  readonly registerTarget: (id: string, ref: RefObject<unknown>) => () => void;
  /** Refs registered for `id`, newest first. */
  readonly targets: (id: string) => ReadonlyArray<RefObject<unknown>>;
  readonly registerScrollView: (ref: RefObject<unknown>) => () => void;
  readonly scrollViews: () => ReadonlyArray<RefObject<unknown>>;
  /** Called after any registration change. */
  readonly subscribe: (listener: () => void) => () => void;
};

export function createRegistry(): TourRegistry {
  const targets = new Map<string, Array<RefObject<unknown>>>();
  const scrollViews = new Set<RefObject<unknown>>();
  const listeners = new Set<() => void>();
  const notify = (): void => {
    // Snapshot: listeners may unsubscribe while being notified.
    const snapshot = [...listeners];
    for (const listener of snapshot) {
      listener();
    }
  };

  return {
    registerTarget(id, ref) {
      const entries = targets.get(id) ?? [];
      entries.push(ref);
      targets.set(id, entries);
      notify();
      return () => {
        const current = targets.get(id);
        const index = current?.lastIndexOf(ref) ?? -1;
        if (current && index !== -1) {
          current.splice(index, 1);
          if (current.length === 0) {
            targets.delete(id);
          }

          notify();
        }
      };
    },
    // Newest first. (Not `toReversed`: ES2023 is not available on every supported React Native version.)
    // eslint-disable-next-line unicorn/no-array-reverse
    targets: (id) => [...(targets.get(id) ?? [])].reverse(),
    registerScrollView(ref) {
      scrollViews.add(ref);
      notify();
      return () => {
        if (scrollViews.delete(ref)) {
          notify();
        }
      };
    },
    scrollViews: () => [...scrollViews],
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
