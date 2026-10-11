import type {Box} from '../shared/geometry/geometry.type.js';

/** React Native's `measure` callback signature. */
// eslint-disable-next-line max-params -- signature defined by React Native
type MeasureCallback = (x: number, y: number, width: number, height: number, pageX: number, pageY: number) => void;

type MeasurableInstance = {
  getBoundingClientRect?: () => {x: number; y: number; width: number; height: number};
  measure?: (callback: MeasureCallback) => void;
  measureLayout?: (
    relativeTo: unknown,
    onSuccess: (left: number, top: number, width: number, height: number) => void,
    onFail?: () => void,
  ) => void;
  contains?: (other: unknown) => boolean;
};

function isMeasurable(value: unknown): value is MeasurableInstance {
  return typeof value === 'object' && value !== null;
}

/**
 * Measures a native view relative to the root view. Uses the synchronous `getBoundingClientRect`
 * (New Architecture, includes transforms) and falls back to `measure`. Resolves `undefined` for
 * views that are not rendered (unmounted, zero size, or flattened away on the old architecture).
 *
 * Positions are only compared with other positions from this function, so whichever origin the
 * platform uses (status bar, edge-to-edge) cancels out.
 */
export async function measureView(instance: unknown): Promise<Box | undefined> {
  if (!isMeasurable(instance)) {
    return undefined;
  }

  if (typeof instance.getBoundingClientRect === 'function') {
    const rect = instance.getBoundingClientRect();
    return valid({x: rect.x, y: rect.y, width: rect.width, height: rect.height});
  }

  const {measure} = instance;
  if (typeof measure !== 'function') {
    return undefined;
  }

  return new Promise((resolve) => {
    try {
      // eslint-disable-next-line max-params -- signature defined by React Native
      measure.call(instance, (_x, _y, width, height, pageX, pageY) => {
        resolve(valid({x: pageX, y: pageY, width, height}));
      });
    } catch {
      resolve(undefined);
    }
  });
}

function valid(box: Box): Box | undefined {
  const finite = [box.x, box.y, box.width, box.height].every(
    (value) => typeof value === 'number' && Number.isFinite(value),
  );
  if (!finite || (box.width <= 0 && box.height <= 0)) {
    return undefined;
  }

  return box;
}

export function relativeTo(box: Box, origin: Box): Box {
  return {x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height};
}

/** Longest wait for `measureLayout` (on the Old Architecture a round trip to native). */
const measureLayoutTimeoutMs = 500;

/**
 * Where `instance` is inside `ancestor` (from the layout, so also for views that cannot be
 * measured on screen; possibly zero-sized), `false` when it is not inside it, or `undefined` when
 * React Native cannot tell.
 */
export async function measureLayoutIn(instance: unknown, ancestor: unknown): Promise<Box | false | undefined> {
  if (!isMeasurable(instance) || !isMeasurable(ancestor) || typeof instance.measureLayout !== 'function') {
    return undefined;
  }

  const {measureLayout} = instance;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(undefined);
    }, measureLayoutTimeoutMs);
    const settle = (result: Box | false | undefined): void => {
      clearTimeout(timer);
      resolve(result);
    };

    try {
      measureLayout.call(
        instance,
        ancestor,
        (left, top, width, height) => {
          const box = {x: left, y: top, width, height};
          settle(Object.values(box).every((value) => Number.isFinite(value)) ? box : undefined);
        },
        () => {
          settle(false);
        },
      );
    } catch {
      settle(undefined);
    }
  });
}

/** Ancestry does not change for a mounted view (React Native never moves views to another parent). */
const ancestry = new WeakMap<object, WeakMap<object, boolean>>();

/** Whether `instance` is a descendant of `ancestor`, or `undefined` when React Native cannot tell. */
export async function isDescendant(instance: unknown, ancestor: unknown): Promise<boolean | undefined> {
  if (!isMeasurable(instance) || !isMeasurable(ancestor)) {
    return undefined;
  }

  const known = ancestry.get(instance)?.get(ancestor);
  if (known !== undefined) {
    return known;
  }

  const result =
    typeof ancestor.contains === 'function'
      ? ancestor.contains(instance)
      : await measureLayoutIn(instance, ancestor).then((position) =>
          position === undefined ? undefined : position !== false,
        );
  if (result !== undefined) {
    const forInstance = ancestry.get(instance) ?? new WeakMap<object, boolean>();
    forInstance.set(ancestor, result);
    ancestry.set(instance, forInstance);
  }

  return result;
}
