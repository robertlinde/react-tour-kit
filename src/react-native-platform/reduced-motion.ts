import {AccessibilityInfo} from 'react-native';
import type {ExternalValue} from '../shared/platform/platform.type.js';

/** The system's "reduce motion" setting, live. Listens to the system only while someone is subscribed. */
export function createReducedMotionSetting(): ExternalValue<boolean> {
  let value = false;
  const listeners = new Set<() => void>();
  let stop: (() => void) | undefined;
  const set = (next: boolean): void => {
    if (next !== value) {
      value = next;
      // Snapshot: listeners may unsubscribe while being notified.
      const snapshot = [...listeners];
      for (const listener of snapshot) {
        listener();
      }
    }
  };

  return {
    get: () => value,
    subscribe(listener) {
      listeners.add(listener);
      if (!stop) {
        let isListening = true;
        void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
          if (isListening) {
            set(enabled);
          }
        });
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', set);
        stop = (): void => {
          isListening = false;
          subscription.remove();
        };
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop?.();
          stop = undefined;
        }
      };
    },
  };
}
