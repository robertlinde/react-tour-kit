import {type ComponentRef, type RefObject, useContext, useRef} from 'react';
import type {ScrollView} from 'react-native';
import {useIsomorphicLayoutEffect} from '../../shared/react/use-isomorphic-layout-effect.hook.js';
import {NativeTourContext} from '../native-context.js';

/**
 * Lets the tour scroll a `ScrollView`, `FlatList` or `SectionList` so that targets inside it are
 * brought into view. Attach the returned ref to the list, or pass the ref the list already has.
 *
 * @example
 * ```tsx
 * const listRef = useTourScrollView();
 * return <ScrollView ref={listRef}>…</ScrollView>;
 * ```
 */
export function useTourScrollView<T = ComponentRef<typeof ScrollView>>(
  existingRef?: RefObject<T | null>,
): RefObject<T | null> {
  const ownRef = useRef<T | null>(null);
  const ref = existingRef ?? ownRef;
  const context = useContext(NativeTourContext);
  useIsomorphicLayoutEffect(() => context?.registry.registerScrollView(ref), [context, ref]);
  return ref;
}
