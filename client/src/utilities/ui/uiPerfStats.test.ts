import { ceUiPerfSnapshot, isCeUiPerfEnabled, measureSync, resetCeUiPerfStats } from './uiPerfStats.js';

type UiPerfTestGlobal = typeof globalThis & {
  ENABLE_CE_UI_PERF_STATS?: boolean;
  __CE_UI_PERF_STORE__?: unknown;
  __CE_UI_PERF__?: {
    snapshot: () => unknown;
    reset: () => void;
  };
};

const runtimeGlobal = globalThis as UiPerfTestGlobal;
const originalPerformanceNow = performance.now.bind(performance);

const setGlobalValue = <K extends keyof UiPerfTestGlobal>(key: K, value: UiPerfTestGlobal[K]): void => {
  Object.defineProperty(runtimeGlobal, key, {
    configurable: true,
    writable: true,
    value,
  });
};

describe('uiPerfStats', () => {
  beforeEach(() => {
    setGlobalValue('ENABLE_CE_UI_PERF_STATS', false);
    setGlobalValue('__CE_UI_PERF_STORE__', undefined);
    Object.defineProperty(performance, 'now', {
      configurable: true,
      writable: true,
      value: originalPerformanceNow,
    });
  });

  afterEach(() => {
    resetCeUiPerfStats();
    setGlobalValue('ENABLE_CE_UI_PERF_STATS', undefined);
    setGlobalValue('__CE_UI_PERF_STORE__', undefined);
    Object.defineProperty(performance, 'now', {
      configurable: true,
      writable: true,
      value: originalPerformanceNow,
    });
  });

  it('installs the global snapshot/reset API and reflects the enabled flag', () => {
    expect(runtimeGlobal.__CE_UI_PERF__?.snapshot()).toEqual(
      expect.objectContaining({
        enabled: false,
        byLabel: {},
      }),
    );

    setGlobalValue('ENABLE_CE_UI_PERF_STATS', true);

    expect(isCeUiPerfEnabled()).toBe(true);
    expect(runtimeGlobal.__CE_UI_PERF__?.snapshot()).toEqual(
      expect.objectContaining({
        enabled: true,
      }),
    );
  });

  it('returns the callback value without sampling when disabled', () => {
    expect(measureSync('disabled label', () => 'result')).toBe('result');
    expect(ceUiPerfSnapshot().byLabel).toEqual({});
  });

  it('records rounded timing stats when enabled', () => {
    setGlobalValue('ENABLE_CE_UI_PERF_STATS', true);
    Object.defineProperty(performance, 'now', {
      configurable: true,
      writable: true,
      value: jest
        .fn()
        .mockReturnValueOnce(10)
        .mockReturnValueOnce(18.4321)
        .mockReturnValueOnce(20)
        .mockReturnValueOnce(22.25),
    });

    expect(measureSync('expensive step', () => 42)).toBe(42);
    expect(measureSync('expensive step', () => 7)).toBe(7);

    expect(ceUiPerfSnapshot().byLabel['expensive step']).toEqual({
      count: 2,
      totalMs: 10.682,
      avgMs: 5.341,
      minMs: 2.25,
      maxMs: 8.432,
      lastMs: 2.25,
      p95Ms: 8.432,
      over5msCount: 1,
    });
  });
});
