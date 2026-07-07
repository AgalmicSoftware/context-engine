/**
 * @module uiPerfStats
 * @description UI performance telemetry — lightweight sampling-based render timing and
 *              bottleneck detection, gated by window.CE_LOGGING.
 *
 * Key exports: mkPerfSampler, nowMs
 */
const MAX_SAMPLES_PER_LABEL = 200;
const SLOW_MS_THRESHOLD = 5;

type UiPerfLabelStats = {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
  over5msCount: number;
  samples: number[];
};

type UiPerfLabelSnapshot = {
  count: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  lastMs: number;
  p95Ms: number;
  over5msCount: number;
};

type UiPerfSnapshot = {
  enabled: boolean;
  ts: number;
  byLabel: Record<string, UiPerfLabelSnapshot>;
};

type UiPerfStore = {
  labels: Record<string, UiPerfLabelStats>;
};

type UiPerfGlobalApi = {
  snapshot: () => UiPerfSnapshot;
  reset: () => void;
};

type UiPerfRuntimeGlobal = typeof globalThis & {
  ENABLE_CE_UI_PERF_STATS?: unknown;
  __CE_UI_PERF_STORE__?: unknown;
  __CE_UI_PERF__?: UiPerfGlobalApi;
};

const getRuntimeGlobal = (): UiPerfRuntimeGlobal | null =>
  typeof globalThis === 'undefined' ? null : (globalThis as UiPerfRuntimeGlobal);

const nowMs = (): number => {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
  } catch (e) {
    void e; /* fallback: performance clock detection. */
  }
  return Date.now();
};

const isCeUiPerfEnabled = (): boolean => {
  try {
    const runtimeGlobals = getRuntimeGlobal();
    return Boolean(runtimeGlobals && runtimeGlobals.ENABLE_CE_UI_PERF_STATS === true);
  } catch (_) {
    return false;
  }
};

const getStore = (): UiPerfStore => {
  const runtimeGlobals = getRuntimeGlobal();
  if (!runtimeGlobals) {
    return { labels: {} };
  }
  if (!runtimeGlobals.__CE_UI_PERF_STORE__ || typeof runtimeGlobals.__CE_UI_PERF_STORE__ !== 'object') {
    runtimeGlobals.__CE_UI_PERF_STORE__ = { labels: {} };
  }
  return runtimeGlobals.__CE_UI_PERF_STORE__ as UiPerfStore;
};

const computeP95 = (samples: number[] = []): number => {
  if (!Array.isArray(samples) || samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1));
  const value = Number(sorted[idx]);
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
};

const ensureLabelStats = (label: unknown): UiPerfLabelStats => {
  const key = String(label || 'unknown');
  const store = getStore();
  if (!store.labels[key]) {
    store.labels[key] = {
      count: 0,
      totalMs: 0,
      minMs: Number.POSITIVE_INFINITY,
      maxMs: 0,
      lastMs: 0,
      over5msCount: 0,
      samples: [],
    };
  }
  return store.labels[key];
};

const recordSample = (label: unknown, durationMs: number): void => {
  const stats = ensureLabelStats(label);
  const ms = Number.isFinite(durationMs) ? Number(durationMs.toFixed(3)) : 0;
  stats.count += 1;
  stats.totalMs += ms;
  stats.lastMs = ms;
  if (ms < stats.minMs) stats.minMs = ms;
  if (ms > stats.maxMs) stats.maxMs = ms;
  if (ms > SLOW_MS_THRESHOLD) stats.over5msCount += 1;
  stats.samples.push(ms);
  if (stats.samples.length > MAX_SAMPLES_PER_LABEL) {
    stats.samples.shift();
  }
};

const ceUiPerfSnapshot = (): UiPerfSnapshot => {
  const store = getStore();
  const byLabel: Record<string, UiPerfLabelSnapshot> = {};
  Object.entries(store.labels || {}).forEach(([label, stats]) => {
    const count = Number(stats.count || 0);
    const totalMs = Number((stats.totalMs || 0).toFixed(3));
    const avgMs = count > 0 ? Number((totalMs / count).toFixed(3)) : 0;
    byLabel[label] = {
      count,
      totalMs,
      avgMs,
      minMs: count > 0 ? Number((stats.minMs || 0).toFixed(3)) : 0,
      maxMs: Number((stats.maxMs || 0).toFixed(3)),
      lastMs: Number((stats.lastMs || 0).toFixed(3)),
      p95Ms: computeP95(stats.samples || []),
      over5msCount: Number(stats.over5msCount || 0),
    };
  });
  return {
    enabled: isCeUiPerfEnabled(),
    ts: Date.now(),
    byLabel,
  };
};

const resetCeUiPerfStats = (): void => {
  const store = getStore();
  store.labels = {};
};

const installGlobalApi = (): void => {
  if (typeof globalThis === 'undefined') return;
  const runtimeGlobals = getRuntimeGlobal();
  if (!runtimeGlobals) return;
  runtimeGlobals.__CE_UI_PERF__ = {
    snapshot: ceUiPerfSnapshot,
    reset: resetCeUiPerfStats,
  };
};

installGlobalApi();

const measureSync = <T = unknown>(label: unknown, fn: (() => T) | null | undefined): T | undefined => {
  if (typeof fn !== 'function') return undefined;
  if (!isCeUiPerfEnabled()) return fn();
  const start = nowMs();
  try {
    return fn();
  } finally {
    recordSample(label, nowMs() - start);
  }
};

export { isCeUiPerfEnabled, ceUiPerfSnapshot, resetCeUiPerfStats, measureSync };
