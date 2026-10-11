import {requestFrame} from '../utils/frame.util.js';

/**
 * Runs `run` with a child signal that is aborted when `parent` aborts or after `timeoutMs`.
 * Resolves `undefined` on timeout, abort, or when `run` rejects (callers check `parent.aborted`
 * to tell an abort apart from a timeout).
 *
 * Only `aborted` and the `abort` event are used, because the AbortController shipped with
 * React Native supports nothing else (no `reason`, no `throwIfAborted`, no `AbortSignal.any`).
 */
export async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T | undefined>,
  parent: AbortSignal,
  timeoutMs: number,
): Promise<T | undefined> {
  if (parent.aborted) {
    return undefined;
  }

  const child = new AbortController();
  const abortChild = (): void => {
    child.abort();
  };

  parent.addEventListener('abort', abortChild);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopped = new Promise<undefined>((resolve) => {
    child.signal.addEventListener('abort', () => {
      resolve(undefined);
    });
    timer = setTimeout(abortChild, timeoutMs);
  });

  try {
    return await Promise.race([run(child.signal).catch((): undefined => undefined), stopped]);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener('abort', abortChild);
    child.abort();
  }
}

/**
 * Resolves on the next frame, after `ms` at the latest (browsers stop frames in background tabs,
 * but not timers), or right away when `signal` is aborted.
 */
export async function nextFrameOrAfter(signal: AbortSignal, ms: number): Promise<void> {
  if (signal.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const done = (): void => {
      cancelFrame();
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };

    const cancelFrame = requestFrame(done);
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done);
  });
}

/** Resolves on the next frame, or immediately when `signal` is aborted. */
export async function nextFrame(signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const onAbort = (): void => {
      cancelFrame();
      resolve();
    };

    const cancelFrame = requestFrame(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    });
    signal.addEventListener('abort', onAbort);
  });
}
