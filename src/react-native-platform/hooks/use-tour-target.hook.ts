import {type ComponentRef, type RefObject, useContext, useRef} from 'react';
import type {View} from 'react-native';
import {devWarn} from '../../shared/engine/report.util.js';
import {useIsomorphicLayoutEffect} from '../../shared/react/use-isomorphic-layout-effect.hook.js';
import {NativeTourContext} from '../native-context.js';

/**
 * Registers a view as a tour target. Attach the returned ref to the view and use `id` as the
 * step's `target`. The ref is typed for `View` (and components that forward to it, such as
 * `Pressable`); pass a type argument for other components.
 *
 * @example
 * ```tsx
 * const ref = useTourTarget('profile-button');
 * return <Pressable ref={ref}>…</Pressable>;
 * ```
 */
export function useTourTarget<T = ComponentRef<typeof View>>(id: string): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const context = useContext(NativeTourContext);
  useIsomorphicLayoutEffect(() => {
    if (!context) {
      devWarn(`useTourTarget('${id}') was called outside of <TourProvider>; the target cannot be found.`);
      return undefined;
    }

    return context.registry.registerTarget(id, ref);
  }, [context, id]);
  return ref;
}
