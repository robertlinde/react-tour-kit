import {useRef, useEffect, type RefObject} from 'react';
import {targetRegistry} from '../target-registry';

/**
 * Hook for registering a React Native component as a tour target.
 * Returns a ref that should be attached to the component.
 *
 * @param id - Unique identifier for this target, used in tour step definitions
 * @returns A ref to attach to the target component
 *
 * @example
 * ```tsx
 * function MyButton() {
 *   const ref = useTourTarget('welcome-button');
 *   return <TouchableOpacity ref={ref}>...</TouchableOpacity>;
 * }
 *
 * // In tour steps:
 * const steps = [
 *   { target: 'welcome-button', title: 'Welcome!', content: '...' }
 * ];
 * ```
 */
export function useTourTarget<T = unknown>(id: string): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    targetRegistry.register(id, ref as RefObject<unknown>);

    return (): void => {
      targetRegistry.unregister(id);
    };
  }, [id]);

  return ref;
}
