const frameMs = 16;

/**
 * Calls `callback` before the next frame is drawn, or after about one frame where there are no
 * frames (test environments without `requestAnimationFrame`). Returns the cancellation.
 */
export function requestFrame(callback: () => void): () => void {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    const frame = globalThis.requestAnimationFrame(() => {
      callback();
    });
    return () => {
      globalThis.cancelAnimationFrame(frame);
    };
  }

  const timer = setTimeout(callback, frameMs);
  return () => {
    clearTimeout(timer);
  };
}
