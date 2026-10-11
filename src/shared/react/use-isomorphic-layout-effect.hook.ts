import {useEffect, useLayoutEffect} from 'react';

const canUseLayoutEffect =
  typeof document !== 'undefined' || (typeof navigator !== 'undefined' && navigator.product === 'ReactNative');

/** `useLayoutEffect` in the browser and on React Native; `useEffect` during server rendering (avoids React 18's SSR warning). */
export const useIsomorphicLayoutEffect = canUseLayoutEffect ? useLayoutEffect : useEffect;
