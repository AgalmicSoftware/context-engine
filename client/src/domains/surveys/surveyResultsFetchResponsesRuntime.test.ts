import { createSurveyResultsFetchResponsesRuntime } from './surveyResultsFetchResponsesRuntime';

describe('surveyResultsFetchResponsesRuntime', () => {
  it('coalesces repeated requests into one promise-microtask flush', async () => {
    const microtasks: VoidFunction[] = [];
    const fetchResponses = jest.fn(async () => {});
    const runtime = createSurveyResultsFetchResponsesRuntime({
      fetchResponses,
      isMounted: () => true,
      scheduleRequestMicrotask: (callback) => microtasks.push(callback),
    });

    runtime.request();
    runtime.request();

    expect(runtime.getSnapshot()).toEqual({
      inFlight: false,
      queued: false,
      requestScheduled: true,
    });
    expect(fetchResponses).not.toHaveBeenCalled();

    microtasks.shift()?.();
    await Promise.resolve();

    expect(fetchResponses).toHaveBeenCalledTimes(1);
    expect(runtime.getSnapshot()).toEqual({
      inFlight: false,
      queued: false,
      requestScheduled: false,
    });
  });

  it('queues exactly one follow-up flush when a request arrives in flight', async () => {
    const microtasks: VoidFunction[] = [];
    let resolveFirstFetch: (() => void) | null = null;
    const fetchResponses = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstFetch = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const runtime = createSurveyResultsFetchResponsesRuntime({
      fetchResponses,
      isMounted: () => true,
      scheduleRequestMicrotask: (callback) => microtasks.push(callback),
    });

    void runtime.flush();
    await Promise.resolve();
    expect(runtime.getSnapshot().inFlight).toBe(true);

    runtime.request();
    microtasks.shift()?.();
    expect(runtime.getSnapshot()).toEqual({
      inFlight: true,
      queued: true,
      requestScheduled: false,
    });

    resolveFirstFetch?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchResponses).toHaveBeenCalledTimes(2);
    expect(runtime.getSnapshot()).toEqual({
      inFlight: false,
      queued: false,
      requestScheduled: false,
    });
  });

  it('drops scheduled work when unmounted before the microtask runs', () => {
    const microtasks: VoidFunction[] = [];
    let mounted = true;
    const fetchResponses = jest.fn();
    const runtime = createSurveyResultsFetchResponsesRuntime({
      fetchResponses,
      isMounted: () => mounted,
      scheduleRequestMicrotask: (callback) => microtasks.push(callback),
    });

    runtime.request();
    mounted = false;
    microtasks.shift()?.();

    expect(fetchResponses).not.toHaveBeenCalled();
    expect(runtime.getSnapshot()).toEqual({
      inFlight: false,
      queued: false,
      requestScheduled: false,
    });
  });

  it('destroy clears request state after unmount without invoking fetch', () => {
    const microtasks: VoidFunction[] = [];
    let mounted = true;
    const fetchResponses = jest.fn();
    const runtime = createSurveyResultsFetchResponsesRuntime({
      fetchResponses,
      isMounted: () => mounted,
      scheduleRequestMicrotask: (callback) => microtasks.push(callback),
    });

    runtime.request();
    mounted = false;
    runtime.destroy();

    expect(runtime.getSnapshot()).toEqual({
      inFlight: false,
      queued: false,
      requestScheduled: false,
    });

    microtasks.shift()?.();
    expect(fetchResponses).not.toHaveBeenCalled();
  });
});
