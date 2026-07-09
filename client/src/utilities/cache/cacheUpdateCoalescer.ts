/**
 * @module cacheUpdateCoalescer
 * @description Batch cache update coalescing — debounces rapid cache writes into
 *              consolidated flushes to reduce IndexedDB write pressure.
 *
 * Key exports: createCacheUpdateCoalescer
 */
export const createCacheUpdateCoalescer = (flush?: (() => void) | null, options: { delayMs?: number } = {}) => {
  const delayMs = Number(options.delayMs);
  const fallbackDelayMs = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 16;

  let queued = false;
  let rafId: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearScheduled = () => {
    if (rafId != null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(rafId);
    }
    if (timeoutId != null) {
      clearTimeout(timeoutId);
    }
    rafId = null;
    timeoutId = null;
  };

  const run = () => {
    rafId = null;
    timeoutId = null;
    if (!queued) return;
    queued = false;
    if (typeof flush === 'function') {
      flush();
    }
  };

  const schedule = () => {
    if (queued) return false;
    queued = true;

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      rafId = window.requestAnimationFrame(run);
      return true;
    }

    timeoutId = setTimeout(run, fallbackDelayMs);
    return true;
  };

  const cancel = () => {
    queued = false;
    clearScheduled();
  };

  const flushNow = () => {
    if (!queued) return false;
    clearScheduled();
    run();
    return true;
  };

  const isQueued = () => queued;

  return {
    schedule,
    cancel,
    flushNow,
    isQueued,
  };
};
