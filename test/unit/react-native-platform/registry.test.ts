import {describe, expect, it, vi} from 'vitest';
import {createRegistry} from '../../../src/react-native-platform/registry.js';

const ref = (name: string) => ({current: name});

describe('target registry', () => {
  it('keeps the other registration when one of two components with the same id unmounts', () => {
    const registry = createRegistry();
    const a = ref('a');
    const b = ref('b');
    const unregisterA = registry.registerTarget('header', a);
    const unregisterB = registry.registerTarget('header', b);
    expect(registry.targets('header')).toEqual([b, a]);
    unregisterA();
    expect(registry.targets('header')).toEqual([b]);
    unregisterA();
    expect(registry.targets('header')).toEqual([b]);
    unregisterB();
    expect(registry.targets('header')).toEqual([]);
  });

  it('survives StrictMode’s register, unregister, register sequence', () => {
    const registry = createRegistry();
    const a = ref('a');
    registry.registerTarget('x', a)();
    registry.registerTarget('x', a);
    expect(registry.targets('x')).toEqual([a]);
  });

  it('notifies on every registration change and tracks scroll views', () => {
    const registry = createRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    const unregister = registry.registerScrollView(ref('list'));
    expect(registry.scrollViews()).toHaveLength(1);
    unregister();
    unregister();
    expect(registry.scrollViews()).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
