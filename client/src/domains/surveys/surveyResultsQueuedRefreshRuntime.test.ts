import { createSurveyResultsQueuedRefreshRuntime } from './surveyResultsQueuedRefreshRuntime';

describe('surveyResultsQueuedRefreshRuntime', () => {
  it('coalesces queued reasons into one measured refresh after the microtask', () => {
    const microtasks: VoidFunction[] = [];
    const measureFlush = jest.fn((_label: string, callback: VoidFunction) => callback());
    const requestFetchResponses = jest.fn();
    const runtime = createSurveyResultsQueuedRefreshRuntime({
      isMounted: () => true,
      isOpen: () => true,
      requestFetchResponses,
      scheduleMicrotask: (callback) => microtasks.push(callback),
      shouldUseAnimationFrame: () => false,
      measureFlush,
    });

    runtime.queue('cache-ready');
    runtime.queue('responses-cache-ready');

    expect(runtime.getQueuedReasons()).toEqual(['cache-ready', 'responses-cache-ready']);
    expect(runtime.isMicrotaskScheduled()).toBe(true);
    expect(requestFetchResponses).not.toHaveBeenCalled();

    microtasks.shift()?.();

    expect(measureFlush).toHaveBeenCalledWith('ce.surveyResults.flushQueuedResultsRefresh', expect.any(Function));
    expect(requestFetchResponses).toHaveBeenCalledTimes(1);
    expect(runtime.getQueuedReasons()).toEqual([]);
    expect(runtime.isMicrotaskScheduled()).toBe(false);
  });

  it('drops queued reasons while closed without dispatching a fetch', () => {
    const microtasks: VoidFunction[] = [];
    let open = false;
    const requestFetchResponses = jest.fn();
    const runtime = createSurveyResultsQueuedRefreshRuntime({
      isMounted: () => true,
      isOpen: () => open,
      requestFetchResponses,
      scheduleMicrotask: (callback) => microtasks.push(callback),
      shouldUseAnimationFrame: () => false,
    });

    runtime.queue('modal-closed');
    microtasks.shift()?.();

    expect(requestFetchResponses).not.toHaveBeenCalled();
    expect(runtime.getQueuedReasons()).toEqual([]);

    open = true;
    runtime.queue('modal-open');
    microtasks.shift()?.();

    expect(requestFetchResponses).toHaveBeenCalledTimes(1);
  });

  it('uses animation frames when requested and cancels the pending frame on destroy', () => {
    const microtasks: VoidFunction[] = [];
    const frameCallbacks: VoidFunction[] = [];
    const cancelAnimationFrame = jest.fn();
    const requestFetchResponses = jest.fn();
    const runtime = createSurveyResultsQueuedRefreshRuntime({
      isMounted: () => true,
      isOpen: () => true,
      requestFetchResponses,
      scheduleMicrotask: (callback) => microtasks.push(callback),
      shouldUseAnimationFrame: () => true,
      animationFrame: {
        requestAnimationFrame: (callback) => {
          frameCallbacks.push(callback);
          return 77;
        },
        cancelAnimationFrame,
      },
    });

    runtime.queue('cache-ready');
    microtasks.shift()?.();

    expect(runtime.hasPendingFrame()).toBe(true);
    expect(requestFetchResponses).not.toHaveBeenCalled();

    runtime.destroy();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(77);
    expect(runtime.hasPendingFrame()).toBe(false);
    expect(runtime.getQueuedReasons()).toEqual([]);
  });

  it('stays inert after unmount and lets already-scheduled microtasks fall through safely', () => {
    const microtasks: VoidFunction[] = [];
    let mounted = true;
    const requestFetchResponses = jest.fn();
    const runtime = createSurveyResultsQueuedRefreshRuntime({
      isMounted: () => mounted,
      isOpen: () => true,
      requestFetchResponses,
      scheduleMicrotask: (callback) => microtasks.push(callback),
      shouldUseAnimationFrame: () => false,
    });

    runtime.queue('cache-ready');
    mounted = false;
    microtasks.shift()?.();
    runtime.queue('after-unmount');

    expect(requestFetchResponses).not.toHaveBeenCalled();
    expect(runtime.getQueuedReasons()).toEqual(['cache-ready']);

    runtime.destroy();
    expect(runtime.getQueuedReasons()).toEqual([]);
  });
});
