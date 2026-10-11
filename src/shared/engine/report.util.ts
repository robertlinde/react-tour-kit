declare const process: {readonly env: {readonly NODE_ENV?: string}};

function computeIsDevelopment(): boolean {
  try {
    // Bundlers (Vite, webpack, Metro, Next.js) replace this expression statically.
    return process.env.NODE_ENV !== 'production';
  } catch {
    // Unbundled browser ESM: no `process`, treat as production.
    return false;
  }
}

export const isDevelopment = computeIsDevelopment();

/** Prints a development-only warning, prefixed so it is easy to find. */
export function devWarn(message: string): void {
  if (isDevelopment) {
    // eslint-disable-next-line no-console -- intentional development warning
    console.warn(`[react-tour-kit] ${message}`);
  }
}

/**
 * Reports an error thrown by user code without interrupting the tour. Uses `reportError` where it
 * exists (browsers; error trackers pick it up), otherwise `console.error` (React Native shows a
 * red box in development and does not crash in production).
 */
export function reportError(error: unknown): void {
  const report = (globalThis as {reportError?: (error: unknown) => void}).reportError;
  if (typeof report === 'function') {
    report(error);
    return;
  }

  // eslint-disable-next-line no-console -- fallback error reporting
  console.error(error);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

/** Calls a user callback; errors (sync or async) are reported and never propagate. */
export function safeInvoke(callback: () => unknown): void {
  try {
    const result = callback();
    if (isPromiseLike(result)) {
      result.then(undefined, reportError);
    }
  } catch (error) {
    reportError(error);
  }
}
