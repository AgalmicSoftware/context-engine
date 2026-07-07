import {
  recordCeRuntimeCacheEvent,
  resetCeRuntimeStats,
  snapshotCeRuntimeStats,
  startCeRuntimeStats,
  statusCeRuntimeStats,
  stopCeRuntimeStats,
} from './uiRuntimeStats.js';

const setGlobalValue = (key, value) => {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
};

describe('uiRuntimeStats', () => {
  const originalPerformanceObserver = globalThis.PerformanceObserver;
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancelRaf = globalThis.cancelAnimationFrame;
  const originalPerfMemory = performance.memory;
  const originalUaMemory = performance.measureUserAgentSpecificMemory;

  beforeEach(() => {
    jest.useFakeTimers();
    stopCeRuntimeStats();
    resetCeRuntimeStats();
    delete globalThis.__CE_PERF_COUNTERS__;
    delete globalThis.__CE_UI_PERF__;
  });

  afterEach(() => {
    stopCeRuntimeStats();
    resetCeRuntimeStats();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();

    setGlobalValue('PerformanceObserver', originalPerformanceObserver);
    setGlobalValue('requestAnimationFrame', originalRaf);
    setGlobalValue('cancelAnimationFrame', originalCancelRaf);
    setGlobalValue('__CE_PERF_COUNTERS__', undefined);
    setGlobalValue('__CE_UI_PERF__', undefined);

    Object.defineProperty(performance, 'memory', {
      configurable: true,
      writable: true,
      value: originalPerfMemory,
    });
    Object.defineProperty(performance, 'measureUserAgentSpecificMemory', {
      configurable: true,
      writable: true,
      value: originalUaMemory,
    });
  });

  it('starts/stops cleanly without duplicate timers or observers', () => {
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
    const observeSpy = jest.fn();
    const disconnectSpy = jest.fn();

    const PerformanceObserverMock = jest.fn(function PerformanceObserverMock() {
      this.observe = observeSpy;
      this.disconnect = disconnectSpy;
    });
    PerformanceObserverMock.supportedEntryTypes = ['longtask'];
    setGlobalValue('PerformanceObserver', PerformanceObserverMock);
    setGlobalValue(
      'requestAnimationFrame',
      jest.fn(() => 1),
    );
    setGlobalValue('cancelAnimationFrame', jest.fn());

    startCeRuntimeStats({ sampleIntervalMs: 250 });
    startCeRuntimeStats({ sampleIntervalMs: 250 });
    const runningStatus = statusCeRuntimeStats();

    expect(runningStatus.running).toBe(true);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(observeSpy).toHaveBeenCalledTimes(1);

    stopCeRuntimeStats();
    const stoppedStatus = statusCeRuntimeStats();

    expect(stoppedStatus.running).toBe(false);
    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it('caps the sample ring buffer', () => {
    startCeRuntimeStats({
      sampleIntervalMs: 100,
      maxSamples: 3,
    });

    jest.advanceTimersByTime(1000);
    const snapshot = snapshotCeRuntimeStats();

    expect(snapshot.recentSamples).toHaveLength(3);
    expect(snapshot.recentSamples[2].seq).toBeGreaterThan(snapshot.recentSamples[0].seq);
  });

  it('falls back safely when browser APIs are missing', () => {
    setGlobalValue('PerformanceObserver', undefined);
    setGlobalValue('requestAnimationFrame', undefined);
    setGlobalValue('cancelAnimationFrame', undefined);
    Object.defineProperty(performance, 'memory', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(performance, 'measureUserAgentSpecificMemory', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    startCeRuntimeStats({ sampleIntervalMs: 100 });
    jest.advanceTimersByTime(200);

    const snapshot = snapshotCeRuntimeStats();

    expect(snapshot.capabilities.longTaskObserver).toBe(false);
    expect(snapshot.capabilities.requestAnimationFrame).toBe(false);
    expect(snapshot.latestSample.memory.heap.supported).toBe(false);
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });

  it('updates long-task and jank counters when simulated', () => {
    let observerCallback = null;
    const observeSpy = jest.fn();
    const PerformanceObserverMock = jest.fn(function PerformanceObserverMock(cb) {
      observerCallback = cb;
      this.observe = observeSpy;
      this.disconnect = jest.fn();
    });
    PerformanceObserverMock.supportedEntryTypes = ['longtask'];
    setGlobalValue('PerformanceObserver', PerformanceObserverMock);

    const rafQueue = [];
    setGlobalValue(
      'requestAnimationFrame',
      jest.fn((cb) => {
        rafQueue.push(cb);
        return rafQueue.length;
      }),
    );
    setGlobalValue('cancelAnimationFrame', jest.fn());

    startCeRuntimeStats({ sampleIntervalMs: 1000, maxSamples: 10 });
    expect(observeSpy).toHaveBeenCalledTimes(1);

    const runNextFrame = (ts) => {
      const cb = rafQueue.shift();
      cb(ts);
    };
    runNextFrame(0);
    runNextFrame(16);
    runNextFrame(96);

    observerCallback({
      getEntries: () => [{ duration: 60 }, { duration: 140 }],
    });

    jest.advanceTimersByTime(1000);
    const latest = snapshotCeRuntimeStats().latestSample;

    expect(latest.longTasks.sinceLast.count).toBe(2);
    expect(latest.longTasks.sinceLast.totalDurationMs).toBe(200);
    expect(latest.frame.sinceLast.stalledFrames).toBeGreaterThanOrEqual(1);
    expect(latest.frame.sinceLast.maxDeltaMs).toBeGreaterThanOrEqual(80);
  });

  it('returns a stable serializable snapshot shape', () => {
    globalThis.__CE_PERF_COUNTERS__ = {
      onePageDemo: { renderPasses: 4 },
      surveyTool: { filterRecomputes: 2 },
    };
    globalThis.__CE_UI_PERF__ = {
      snapshot: jest.fn(() => ({
        enabled: true,
        byLabel: {
          heavyStep: { count: 2, avgMs: 3.5 },
        },
      })),
    };

    startCeRuntimeStats({ sampleIntervalMs: 1000, maxSamples: 10 });

    globalThis.__CE_PERF_COUNTERS__.onePageDemo.renderPasses += 3;
    recordCeRuntimeCacheEvent({ namespace: 'questionsCache' });
    recordCeRuntimeCacheEvent({ namespace: 'questionsCache' });
    recordCeRuntimeCacheEvent({ namespace: 'sbtCache' });

    jest.advanceTimersByTime(1000);

    const snapshot = snapshotCeRuntimeStats();
    const latest = snapshot.latestSample;

    expect(snapshot).toEqual(
      expect.objectContaining({
        v: 1,
        running: true,
        cachePressure: expect.any(Object),
        latestSample: expect.any(Object),
        recentSamples: expect.any(Array),
      }),
    );
    expect(latest.perfCounterDelta['onePageDemo.renderPasses']).toBe(3);
    expect(latest.uiPerf).toEqual(expect.objectContaining({ enabled: true }));
    expect(snapshot.cachePressure.perMinute.questionsCache).toBeGreaterThanOrEqual(2);
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });
});
