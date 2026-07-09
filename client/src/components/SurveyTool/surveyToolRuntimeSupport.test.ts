import { bumpSurveyPerfCounter, isSurveyPerfCountersEnabled, scheduleMicrotask } from './surveyToolRuntimeSupport.js';

describe('surveyToolRuntimeSupport', () => {
  const originalEnableUiPerfStats = (globalThis as any).ENABLE_CE_UI_PERF_STATS;
  const originalEnableDebugCounters = (globalThis as any).ENABLE_CE_DEBUG_COUNTERS;
  const originalDebugCounters = (globalThis as any).__CE_DEBUG_COUNTERS__;
  const originalPerfCounters = (globalThis as any).__CE_PERF_COUNTERS__;
  const originalQueueMicrotask = globalThis.queueMicrotask;

  afterEach(() => {
    (globalThis as any).ENABLE_CE_UI_PERF_STATS = originalEnableUiPerfStats;
    (globalThis as any).ENABLE_CE_DEBUG_COUNTERS = originalEnableDebugCounters;
    (globalThis as any).__CE_DEBUG_COUNTERS__ = originalDebugCounters;
    (globalThis as any).__CE_PERF_COUNTERS__ = originalPerfCounters;
    globalThis.queueMicrotask = originalQueueMicrotask;
  });

  it('only enables survey perf counters when a debug flag is active', () => {
    (globalThis as any).ENABLE_CE_UI_PERF_STATS = false;
    (globalThis as any).ENABLE_CE_DEBUG_COUNTERS = false;
    (globalThis as any).__CE_DEBUG_COUNTERS__ = false;
    expect(isSurveyPerfCountersEnabled()).toBe(false);

    (globalThis as any).ENABLE_CE_UI_PERF_STATS = true;
    expect(isSurveyPerfCountersEnabled()).toBe(true);
  });

  it('increments scoped perf counters only when enabled', () => {
    (globalThis as any).__CE_PERF_COUNTERS__ = {};
    bumpSurveyPerfCounter('noopSkipCount');
    expect((globalThis as any).__CE_PERF_COUNTERS__).toEqual({});

    (globalThis as any).ENABLE_CE_UI_PERF_STATS = true;
    bumpSurveyPerfCounter('noopSkipCount');
    bumpSurveyPerfCounter('noopSkipCount', 2);

    expect((globalThis as any).__CE_PERF_COUNTERS__).toEqual({
      surveyTool: {
        noopSkipCount: 3,
      },
    });
  });

  it('uses queueMicrotask when available and Promise fallback otherwise', async () => {
    const queued = jest.fn((cb: VoidFunction) => cb());
    const immediate = jest.fn();
    globalThis.queueMicrotask = queued;
    scheduleMicrotask(immediate);
    expect(queued).toHaveBeenCalledTimes(1);
    expect(immediate).toHaveBeenCalledTimes(1);

    const deferred = jest.fn();
    globalThis.queueMicrotask = undefined as any;
    scheduleMicrotask(deferred);
    expect(deferred).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(deferred).toHaveBeenCalledTimes(1);
  });
});
