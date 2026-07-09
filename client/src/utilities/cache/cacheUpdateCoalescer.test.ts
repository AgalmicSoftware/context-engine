import { createCacheUpdateCoalescer } from './cacheUpdateCoalescer.js';

describe('cacheUpdateCoalescer', () => {
  const originalRaf = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;
  const setAnimationFrameGlobals = (
    requestAnimationFrame: Window['requestAnimationFrame'] | undefined,
    cancelAnimationFrame: Window['cancelAnimationFrame'] | undefined,
  ): void => {
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: requestAnimationFrame,
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      writable: true,
      value: cancelAnimationFrame,
    });
  };

  afterEach(() => {
    jest.useRealTimers();
    setAnimationFrameGlobals(originalRaf, originalCancel);
  });

  it('coalesces bursty schedule calls into a single flush', () => {
    jest.useFakeTimers();
    setAnimationFrameGlobals(undefined, undefined);

    const flush = jest.fn();
    const coalescer = createCacheUpdateCoalescer(flush, { delayMs: 12 });

    coalescer.schedule();
    coalescer.schedule();
    coalescer.schedule();

    expect(flush).not.toHaveBeenCalled();
    jest.advanceTimersByTime(12);

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('cancels queued flushes', () => {
    jest.useFakeTimers();
    setAnimationFrameGlobals(undefined, undefined);

    const flush = jest.fn();
    const coalescer = createCacheUpdateCoalescer(flush, { delayMs: 10 });

    coalescer.schedule();
    coalescer.cancel();
    jest.advanceTimersByTime(20);

    expect(flush).not.toHaveBeenCalled();
    expect(coalescer.isQueued()).toBe(false);
  });
});
