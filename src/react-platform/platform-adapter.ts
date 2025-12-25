import {type RefObject} from 'react';
import {
  type PlatformAdapter,
  type Rect,
  type TourTarget,
  type KeyboardHandlers,
  // eslint-disable-next-line import-x/extensions
} from '../shared';
// eslint-disable-next-line import-x/extensions
import {findVisibleElement} from './utils';

/**
 * Converts a DOMRect to our platform-agnostic Rect type.
 */
function domRectToRect(domRect: DOMRect): Rect {
  return {
    top: domRect.top,
    left: domRect.left,
    width: domRect.width,
    height: domRect.height,
    bottom: domRect.bottom,
    right: domRect.right,
  };
}

/**
 * Web platform adapter implementation using DOM APIs.
 */
export const webPlatformAdapter: PlatformAdapter = {
  async measureElement(target: TourTarget): Promise<Rect | undefined> {
    if (typeof target !== 'string') {
      // Web primarily uses string selectors, but can support refs too
      const element = (target as RefObject<Element>).current;
      if (!element) {
        return undefined;
      }

      return domRectToRect(element.getBoundingClientRect());
    }

    const element = findVisibleElement(target);
    if (!element) {
      return undefined;
    }

    return domRectToRect(element.getBoundingClientRect());
  },

  measureTooltip(ref: RefObject<unknown>): {width: number; height: number} {
    const element = ref.current as HTMLElement | undefined;
    return {
      width: element?.offsetWidth ?? 0,
      height: element?.offsetHeight ?? 0,
    };
  },

  getViewportDimensions(): {width: number; height: number} {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  },

  async scrollToElement(target: TourTarget): Promise<void> {
    const element = typeof target === 'string' ? findVisibleElement(target) : (target as RefObject<Element>).current;

    if (element) {
      element.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
  },

  subscribeToKeyboard(handlers: KeyboardHandlers): () => void {
    const handleKeyDown = (event: KeyboardEvent): void => {
      switch (event.key) {
        case 'Escape': {
          handlers.onEscape();
          break;
        }

        case 'ArrowRight': {
          handlers.onNext();
          break;
        }

        case 'ArrowLeft': {
          handlers.onPrev();
          break;
        }

        default: {
          break;
        }
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return (): void => {
      globalThis.removeEventListener('keydown', handleKeyDown);
    };
  },

  subscribeToLayout(callback: () => void): () => void {
    window.addEventListener('resize', callback);
    window.addEventListener('scroll', callback, true);

    return (): void => {
      window.removeEventListener('resize', callback);
      window.removeEventListener('scroll', callback, true);
    };
  },

  scheduleFrame(callback: () => void): number {
    return requestAnimationFrame(callback);
  },

  cancelFrame(id: number): void {
    cancelAnimationFrame(id);
  },

  findElement(target: TourTarget): Element | undefined {
    if (typeof target === 'string') {
      return findVisibleElement(target);
    }

    return (target as RefObject<Element>).current ?? undefined;
  },
};
