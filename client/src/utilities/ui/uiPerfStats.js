/**
 * @module uiPerfStats
 * @description UI performance telemetry — lightweight sampling-based render timing and
 *              bottleneck detection, gated by window.CE_LOGGING.
 *
 * Key exports: mkPerfSampler, nowMs
 */
const MAX_SAMPLES_PER_LABEL = 200;
const SLOW_MS_THRESHOLD = 5;

const nowMs = () => {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
  } catch (e) { void e; /* fallback: performance clock detection. */ }
  return Date.now();
};

const isCeUiPerfEnabled = () => {
  try {
    return typeof globalThis !== 'undefined' && globalThis.ENABLE_CE_UI_PERF_STATS === true;
  } catch (_) {
    return false;
  }
};

const getStore = () => {
  if (typeof globalThis === 'undefined') {
    return { labels: {} };
  }
  if (!globalThis.__CE_UI_PERF_STORE__ || typeof globalThis.__CE_UI_PERF_STORE__ !== 'object') {
    globalThis.__CE_UI_PERF_STORE__ = { labels: {} };
  }
  return globalThis.__CE_UI_PERF_STORE__;
};

const computeP95 = (samples = []) => {
  if (!Array.isArray(samples) || samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1));
  const value = Number(sorted[idx]);
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
};

const ensureLabelStats = (label) => {
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

const recordSample = (label, durationMs) => {
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

const ceUiPerfSnapshot = () => {
  const store = getStore();
  const byLabel = {};
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

const resetCeUiPerfStats = () => {
  const store = getStore();
  store.labels = {};
};

const installGlobalApi = () => {
  if (typeof globalThis === 'undefined') return;
  globalThis.__CE_UI_PERF__ = {
    snapshot: ceUiPerfSnapshot,
    reset: resetCeUiPerfStats,
  };
};

installGlobalApi();

const measureSync = (label, fn) => {
  if (typeof fn !== 'function') return undefined;
  if (!isCeUiPerfEnabled()) return fn();
  const start = nowMs();
  try {
    return fn();
  } finally {
    recordSample(label, nowMs() - start);
  }
};

export {
  isCeUiPerfEnabled,
  ceUiPerfSnapshot,
  resetCeUiPerfStats,
  measureSync,
};
