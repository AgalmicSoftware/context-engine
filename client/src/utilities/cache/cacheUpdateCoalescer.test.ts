import { createCacheUpdateCoalescer } from './cacheUpdateCoalescer.js';

describe('cacheUpdateCoalescer', () => {
  const originalRaf = window.requestAnimationFrame;
  const originalCancel = window.cancelAnimationFrame;

  afterEach(() => {
    jest.useRealTimers();
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancel;
  });

  it('coalesces bursty schedule calls into a single flush', () => {
    jest.useFakeTimers();
    (window as any).requestAnimationFrame = undefined;
    (window as any).cancelAnimationFrame = undefined;

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
    (window as any).requestAnimationFrame = undefined;
    (window as any).cancelAnimationFrame = undefined;

    const flush = jest.fn();
    const coalescer = createCacheUpdateCoalescer(flush, { delayMs: 10 });

    coalescer.schedule();
    coalescer.cancel();
    jest.advanceTimersByTime(20);

    expect(flush).not.toHaveBeenCalled();
    expect(coalescer.isQueued()).toBe(false);
  });
});
