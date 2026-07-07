/**
 * @module uiRuntimeStats
 * @description UI runtime statistics — periodic sampling of heap size, DOM node count,
 *              and other browser performance metrics for diagnostics.
 *
 * Key exports: (self-initializing module, attaches to window)
 */

import { createLogger } from '../logging.js';

const log = createLogger('uiRuntimeStats');
const DEFAULT_SAMPLE_INTERVAL_MS = 5000;
const DEFAULT_RETENTION_MINUTES = 30;
const DEFAULT_UA_MEMORY_INTERVAL_MS = 60 * 1000;
const DEFAULT_MAX_SAMPLES = Math.floor((DEFAULT_RETENTION_MINUTES * 60 * 1000) / DEFAULT_SAMPLE_INTERVAL_MS);
const FRAME_STALL_THRESHOLD_MS = 50;
const CACHE_RATE_WINDOW_MS = 60 * 1000;
const CACHE_RATE_PRUNE_WINDOW_MS = 5 * 60 * 1000;
const TRACKED_CACHE_NAMESPACES = ['questionsCache', 'surveysCache', 'sbtCache'];

const toFinite = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toPositiveInt = (value, fallback) => {
  const num = Math.floor(toFinite(value, Number.NaN));
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const roundTo3 = (value) => Number(toFinite(value, 0).toFixed(3));

const safeNow = () => Date.now();

const safeClone = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return null;
  }
};

const getGlobal = () => {
  try {
    if (typeof globalThis !== 'undefined') return globalThis;
  } catch (e) {
    void e; /* fallback: feature detection. */
  }
  return null;
};

const getPerformance = () => {
  try {
    if (typeof performance !== 'undefined') return performance;
  } catch (e) {
    void e; /* fallback: feature detection. */
  }
  return null;
};

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const createFrameCounter = () => ({
  frames: 0,
  stalledFrames: 0,
  totalDeltaMs: 0,
  maxDeltaMs: 0,
});

const createLongTaskCounter = () => ({
  count: 0,
  totalDurationMs: 0,
  maxDurationMs: 0,
});

const createInitialState = () => ({
  v: 1,
  running: false,
  startedAt: 0,
  stoppedAt: 0,
  lastSampleAt: 0,
  seq: 0,
  config: {
    sampleIntervalMs: DEFAULT_SAMPLE_INTERVAL_MS,
    retentionMinutes: DEFAULT_RETENTION_MINUTES,
    maxSamples: DEFAULT_MAX_SAMPLES,
    uaMemoryIntervalMs: DEFAULT_UA_MEMORY_INTERVAL_MS,
  },
  capabilities: {
    performanceMemory: false,
    uaSpecificMemory: false,
    longTaskObserver: false,
    requestAnimationFrame: false,
  },
  samples: [],
  timerId: null,
  rafId: null,
  lastRafTs: 0,
  longTaskObserver: null,
  frameTotals: createFrameCounter(),
  frameSinceLast: createFrameCounter(),
  longTaskTotals: createLongTaskCounter(),
  longTaskSinceLast: createLongTaskCounter(),
  lastPerfCountersFlat: {},
  lastUaMemoryAt: 0,
  lastUaMemory: null,
  uaMemoryInFlight: false,
  cacheEventTsByNamespace: {},
  cacheEventTotalsByNamespace: {},
  cacheEventSinceLastByNamespace: {},
});

const getState = () => {
  const g = getGlobal();
  if (!g) return createInitialState();
  if (!isPlainObject(g.__CE_RUNTIME_STATS_STATE__)) {
    g.__CE_RUNTIME_STATS_STATE__ = createInitialState();
  }
  return g.__CE_RUNTIME_STATS_STATE__;
};

const isCeRuntimeStatsEnabled = () => {
  const g = getGlobal();
  if (!g) return false;
  try {
    return g.ENABLE_CE_RUNTIME_STATS === true;
  } catch (_) {
    return false;
  }
};

const normalizeNamespace = (namespaceIn = '') => {
  const raw = String(namespaceIn || '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  if (raw === 'questionscache' || raw === 'questions' || raw === 'question') {
    return 'questionsCache';
  }
  if (raw === 'surveyscache' || raw === 'surveys' || raw === 'survey') {
    return 'surveysCache';
  }
  if (raw === 'sbtcache' || raw === 'sbt') {
    return 'sbtCache';
  }
  return String(namespaceIn || '').trim();
};

const flattenNumericLeaves = (value, prefix = '', out = {}) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (prefix) out[prefix] = value;
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((child, idx) => {
      const nextPrefix = prefix ? `${prefix}.${idx}` : String(idx);
      flattenNumericLeaves(child, nextPrefix, out);
    });
    return out;
  }
  if (!isPlainObject(value)) return out;
  Object.keys(value).forEach((key) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : String(key);
    flattenNumericLeaves(value[key], nextPrefix, out);
  });
  return out;
};

const computeDeltaMap = (prevMap = {}, nextMap = {}) => {
  const delta = {};
  Object.keys(nextMap || {}).forEach((key) => {
    const next = toFinite(nextMap[key], Number.NaN);
    if (!Number.isFinite(next)) return;
    const prev = toFinite(prevMap[key], 0);
    const diff = roundTo3(next - prev);
    if (diff !== 0) delta[key] = diff;
  });
  return delta;
};

const sanitizeStartOptions = (opts = {}) => {
  const sampleIntervalMs = toPositiveInt(opts.sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS);
  const retentionMinutes = toPositiveInt(opts.retentionMinutes, DEFAULT_RETENTION_MINUTES);
  const computedMaxSamples = Math.max(1, Math.floor((retentionMinutes * 60 * 1000) / sampleIntervalMs));
  const maxSamples = toPositiveInt(opts.maxSamples, computedMaxSamples);
  const uaMemoryIntervalMs = toPositiveInt(opts.uaMemoryIntervalMs, DEFAULT_UA_MEMORY_INTERVAL_MS);
  return {
    sampleIntervalMs,
    retentionMinutes,
    maxSamples,
    uaMemoryIntervalMs,
  };
};

const canUseLongTaskObserver = () => {
  try {
    if (typeof PerformanceObserver === 'undefined') return false;
    const supported = PerformanceObserver.supportedEntryTypes;
    if (Array.isArray(supported) && supported.length > 0) {
      return supported.includes('longtask');
    }
    return true;
  } catch (_) {
    return false;
  }
};

const refreshCapabilities = (state) => {
  const perf = getPerformance();
  const hasRaf = (() => {
    const g = getGlobal();
    return !!(g && typeof g.requestAnimationFrame === 'function');
  })();
  state.capabilities = {
    performanceMemory: !!(perf && isPlainObject(perf.memory)),
    uaSpecificMemory: !!(perf && typeof perf.measureUserAgentSpecificMemory === 'function'),
    longTaskObserver: canUseLongTaskObserver(),
    requestAnimationFrame: hasRaf,
  };
};

const readHeapMemory = () => {
  const perf = getPerformance();
  const mem = perf && isPlainObject(perf.memory) ? perf.memory : null;
  if (!mem) {
    return {
      supported: false,
      usedJSHeapSize: null,
      totalJSHeapSize: null,
      jsHeapSizeLimit: null,
    };
  }
  return {
    supported: true,
    usedJSHeapSize: toFinite(mem.usedJSHeapSize, 0),
    totalJSHeapSize: toFinite(mem.totalJSHeapSize, 0),
    jsHeapSizeLimit: toFinite(mem.jsHeapSizeLimit, 0),
  };
};

const maybeSampleUaMemory = (state, nowTs) => {
  const perf = getPerformance();
  if (!perf || typeof perf.measureUserAgentSpecificMemory !== 'function') return;
  if (state.uaMemoryInFlight) return;
  const minGap = toPositiveInt(state.config.uaMemoryIntervalMs, DEFAULT_UA_MEMORY_INTERVAL_MS);
  if (nowTs - toFinite(state.lastUaMemoryAt, 0) < minGap) return;

  state.uaMemoryInFlight = true;
  Promise.resolve()
    .then(async () => {
      const result = await perf.measureUserAgentSpecificMemory();
      state.lastUaMemoryAt = safeNow();
      state.lastUaMemory = {
        supported: true,
        sampledAt: state.lastUaMemoryAt,
        success: true,
        bytes: toFinite(result?.bytes, 0),
        breakdownCount: Array.isArray(result?.breakdown) ? result.breakdown.length : 0,
      };
    })
    .catch((error) => {
      state.lastUaMemoryAt = safeNow();
      state.lastUaMemory = {
        supported: true,
        sampledAt: state.lastUaMemoryAt,
        success: false,
        bytes: null,
        breakdownCount: 0,
        error: String(error?.message || error || 'ua-memory-failed'),
      };
    })
    .finally(() => {
      state.uaMemoryInFlight = false;
    });
};

const readPerfCounters = () => {
  const g = getGlobal();
  const counters = g && isPlainObject(g.__CE_PERF_COUNTERS__) ? g.__CE_PERF_COUNTERS__ : null;
  const snapshot = counters ? safeClone(counters) : null;
  return {
    snapshot,
    flat: snapshot ? flattenNumericLeaves(snapshot) : {},
  };
};

const readUiPerfSnapshot = () => {
  const g = getGlobal();
  const api = g && isPlainObject(g.__CE_UI_PERF__) ? g.__CE_UI_PERF__ : null;
  if (!api || typeof api.snapshot !== 'function') return null;
  try {
    return safeClone(api.snapshot());
  } catch (_) {
    return null;
  }
};

const mergeCounter = (target, source) => {
  target.frames += Number(source.frames || 0);
  target.stalledFrames += Number(source.stalledFrames || 0);
  target.totalDeltaMs += Number(source.totalDeltaMs || 0);
  target.maxDeltaMs = Math.max(Number(target.maxDeltaMs || 0), Number(source.maxDeltaMs || 0));
};

const mergeLongTaskCounter = (target, source) => {
  target.count += Number(source.count || 0);
  target.totalDurationMs += Number(source.totalDurationMs || 0);
  target.maxDurationMs = Math.max(Number(target.maxDurationMs || 0), Number(source.maxDurationMs || 0));
};

const flushFrameSinceLast = (state) => {
  const current = state.frameSinceLast;
  const frames = Number(current.frames || 0);
  const totalDeltaMs = Number(current.totalDeltaMs || 0);
  const out = {
    frames,
    stalledFrames: Number(current.stalledFrames || 0),
    avgDeltaMs: frames > 0 ? roundTo3(totalDeltaMs / frames) : 0,
    maxDeltaMs: roundTo3(current.maxDeltaMs || 0),
    totalDeltaMs: roundTo3(totalDeltaMs),
  };
  state.frameSinceLast = createFrameCounter();
  return out;
};

const flushLongTaskSinceLast = (state) => {
  const current = state.longTaskSinceLast;
  const count = Number(current.count || 0);
  const totalDurationMs = Number(current.totalDurationMs || 0);
  const out = {
    count,
    totalDurationMs: roundTo3(totalDurationMs),
    maxDurationMs: roundTo3(current.maxDurationMs || 0),
    avgDurationMs: count > 0 ? roundTo3(totalDurationMs / count) : 0,
  };
  state.longTaskSinceLast = createLongTaskCounter();
  return out;
};

const readTotalsFrame = (state) => {
  const totals = state.frameTotals || createFrameCounter();
  const frames = Number(totals.frames || 0);
  const totalDeltaMs = Number(totals.totalDeltaMs || 0);
  return {
    frames,
    stalledFrames: Number(totals.stalledFrames || 0),
    avgDeltaMs: frames > 0 ? roundTo3(totalDeltaMs / frames) : 0,
    maxDeltaMs: roundTo3(totals.maxDeltaMs || 0),
    totalDeltaMs: roundTo3(totalDeltaMs),
  };
};

const readTotalsLongTask = (state) => {
  const totals = state.longTaskTotals || createLongTaskCounter();
  const count = Number(totals.count || 0);
  const totalDurationMs = Number(totals.totalDurationMs || 0);
  return {
    count,
    totalDurationMs: roundTo3(totalDurationMs),
    maxDurationMs: roundTo3(totals.maxDurationMs || 0),
    avgDurationMs: count > 0 ? roundTo3(totalDurationMs / count) : 0,
  };
};

const pruneNamespaceEvents = (arr = [], nowTs = safeNow(), windowMs = CACHE_RATE_PRUNE_WINDOW_MS) => {
  const cutoff = nowTs - windowMs;
  while (arr.length > 0 && Number(arr[0] || 0) < cutoff) {
    arr.shift();
  }
};

const readCachePressureSnapshot = (state, nowTs = safeNow(), { resetSinceLast = false } = {}) => {
  const namespaceSet = new Set([
    ...TRACKED_CACHE_NAMESPACES,
    ...Object.keys(state.cacheEventTsByNamespace || {}),
    ...Object.keys(state.cacheEventTotalsByNamespace || {}),
  ]);

  const perMinute = {};
  const totals = {};
  const sinceLast = {};
  const lastEventTsByNamespace = {};

  namespaceSet.forEach((namespace) => {
    const key = String(namespace || '');
    const events = Array.isArray(state.cacheEventTsByNamespace[key]) ? state.cacheEventTsByNamespace[key] : [];
    state.cacheEventTsByNamespace[key] = events;
    pruneNamespaceEvents(events, nowTs, CACHE_RATE_PRUNE_WINDOW_MS);
    const minuteCutoff = nowTs - CACHE_RATE_WINDOW_MS;
    let minuteCount = 0;
    for (let i = events.length - 1; i >= 0; i -= 1) {
      if (Number(events[i] || 0) >= minuteCutoff) minuteCount += 1;
      else break;
    }

    perMinute[key] = minuteCount;
    totals[key] = Number(state.cacheEventTotalsByNamespace[key] || 0);
    sinceLast[key] = Number(state.cacheEventSinceLastByNamespace[key] || 0);
    if (events.length > 0) {
      lastEventTsByNamespace[key] = Number(events[events.length - 1] || 0);
    } else {
      lastEventTsByNamespace[key] = null;
    }
    if (resetSinceLast) state.cacheEventSinceLastByNamespace[key] = 0;
  });

  const totalPerMinute = Object.values(perMinute).reduce((sum, val) => sum + Number(val || 0), 0);
  const totalSinceLast = Object.values(sinceLast).reduce((sum, val) => sum + Number(val || 0), 0);
  const totalEvents = Object.values(totals).reduce((sum, val) => sum + Number(val || 0), 0);

  return {
    perMinute,
    totals,
    sinceLast,
    lastEventTsByNamespace,
    totalPerMinute,
    totalSinceLast,
    totalEvents,
  };
};

const pushSample = (state, sample) => {
  state.samples.push(sample);
  while (state.samples.length > Number(state.config.maxSamples || DEFAULT_MAX_SAMPLES)) {
    state.samples.shift();
  }
};

const collectSample = (reason = 'timer') => {
  const state = getState();
  if (!state.running) return null;
  const ts = safeNow();

  maybeSampleUaMemory(state, ts);

  const heapMemory = readHeapMemory();
  const perfCounters = readPerfCounters();
  const perfCounterDelta = computeDeltaMap(state.lastPerfCountersFlat, perfCounters.flat);
  state.lastPerfCountersFlat = perfCounters.flat;

  const frameSinceLast = flushFrameSinceLast(state);
  const frameTotals = readTotalsFrame(state);
  const longTaskSinceLast = flushLongTaskSinceLast(state);
  const longTaskTotals = readTotalsLongTask(state);
  const cachePressure = readCachePressureSnapshot(state, ts, { resetSinceLast: true });
  const uiPerf = readUiPerfSnapshot();

  state.seq += 1;
  state.lastSampleAt = ts;

  const sample = {
    seq: state.seq,
    ts,
    reason,
    memory: {
      heap: heapMemory,
      ua: state.lastUaMemory ? { ...state.lastUaMemory } : null,
      uaMemorySampleAgeMs: state.lastUaMemoryAt > 0 ? Math.max(0, ts - state.lastUaMemoryAt) : null,
    },
    longTasks: {
      sinceLast: longTaskSinceLast,
      totals: longTaskTotals,
    },
    frame: {
      stallThresholdMs: FRAME_STALL_THRESHOLD_MS,
      sinceLast: frameSinceLast,
      totals: frameTotals,
    },
    cachePressure,
    perfCounters: perfCounters.snapshot,
    perfCounterDelta,
    uiPerf: uiPerf || null,
  };

  pushSample(state, sample);
  return sample;
};

const handleLongTaskEntries = (entryList) => {
  const state = getState();
  if (!state.running) return;
  const entries = (() => {
    try {
      if (entryList && typeof entryList.getEntries === 'function') {
        return entryList.getEntries();
      }
    } catch (e) {
      log.warn('uiRuntimeStats: fallback', e);
    }
    return Array.isArray(entryList) ? entryList : [];
  })();
  if (!Array.isArray(entries) || entries.length === 0) return;

  const next = createLongTaskCounter();
  entries.forEach((entry) => {
    const duration = toFinite(entry?.duration, 0);
    if (!Number.isFinite(duration) || duration <= 0) return;
    next.count += 1;
    next.totalDurationMs += duration;
    next.maxDurationMs = Math.max(next.maxDurationMs, duration);
  });

  if (next.count <= 0) return;
  mergeLongTaskCounter(state.longTaskSinceLast, next);
  mergeLongTaskCounter(state.longTaskTotals, next);
};

const startLongTaskObserver = () => {
  const state = getState();
  if (!state.running) return;
  if (!state.capabilities.longTaskObserver) return;
  if (state.longTaskObserver) return;

  try {
    const observer = new PerformanceObserver((list) => {
      handleLongTaskEntries(list);
    });
    observer.observe({ entryTypes: ['longtask'] });
    state.longTaskObserver = observer;
  } catch (_) {
    state.longTaskObserver = null;
  }
};

const stopLongTaskObserver = () => {
  const state = getState();
  const observer = state.longTaskObserver;
  if (!observer) return;
  try {
    if (typeof observer.disconnect === 'function') observer.disconnect();
  } catch (e) {
    log.warn('uiRuntimeStats: cleanup', e);
  }
  state.longTaskObserver = null;
};

const rafLoop = (ts) => {
  const state = getState();
  if (!state.running) return;
  const nowTs = toFinite(ts, safeNow());
  const lastTs = toFinite(state.lastRafTs, 0);
  state.lastRafTs = nowTs;

  if (lastTs > 0 && nowTs > lastTs) {
    const deltaMs = nowTs - lastTs;
    const stalled = deltaMs >= FRAME_STALL_THRESHOLD_MS ? 1 : 0;
    const batch = {
      frames: 1,
      stalledFrames: stalled,
      totalDeltaMs: deltaMs,
      maxDeltaMs: deltaMs,
    };
    mergeCounter(state.frameSinceLast, batch);
    mergeCounter(state.frameTotals, batch);
  }

  try {
    const g = getGlobal();
    if (!g || typeof g.requestAnimationFrame !== 'function') {
      state.rafId = null;
      return;
    }
    state.rafId = g.requestAnimationFrame(rafLoop);
  } catch (_) {
    state.rafId = null;
  }
};

const startRafLoop = () => {
  const state = getState();
  if (!state.running) return;
  if (!state.capabilities.requestAnimationFrame) return;
  if (state.rafId != null) return;
  state.lastRafTs = 0;
  try {
    const g = getGlobal();
    if (!g || typeof g.requestAnimationFrame !== 'function') return;
    state.rafId = g.requestAnimationFrame(rafLoop);
  } catch (_) {
    state.rafId = null;
  }
};

const stopRafLoop = () => {
  const state = getState();
  const id = state.rafId;
  state.rafId = null;
  state.lastRafTs = 0;
  if (id == null) return;
  try {
    const g = getGlobal();
    if (g && typeof g.cancelAnimationFrame === 'function') {
      g.cancelAnimationFrame(id);
    }
  } catch (e) {
    log.warn('uiRuntimeStats: cleanup', e);
  }
};

const startSampleTimer = () => {
  const state = getState();
  if (!state.running) return;
  if (state.timerId != null) return;
  const intervalMs = toPositiveInt(state.config.sampleIntervalMs, DEFAULT_SAMPLE_INTERVAL_MS);
  state.timerId = setInterval(() => {
    collectSample('timer');
  }, intervalMs);
};

const stopSampleTimer = () => {
  const state = getState();
  if (state.timerId == null) return;
  try {
    clearInterval(state.timerId);
  } catch (e) {
    log.warn('uiRuntimeStats: cleanup', e);
  }
  state.timerId = null;
};

const getStatusInternal = (state) => ({
  v: 1,
  running: !!state.running,
  enabledByFlag: isCeRuntimeStatsEnabled(),
  startedAt: state.startedAt || null,
  stoppedAt: state.stoppedAt || null,
  lastSampleAt: state.lastSampleAt || null,
  sampleCount: Array.isArray(state.samples) ? state.samples.length : 0,
  config: {
    sampleIntervalMs: Number(state.config.sampleIntervalMs || DEFAULT_SAMPLE_INTERVAL_MS),
    retentionMinutes: Number(state.config.retentionMinutes || DEFAULT_RETENTION_MINUTES),
    maxSamples: Number(state.config.maxSamples || DEFAULT_MAX_SAMPLES),
    uaMemoryIntervalMs: Number(state.config.uaMemoryIntervalMs || DEFAULT_UA_MEMORY_INTERVAL_MS),
  },
  capabilities: {
    performanceMemory: !!state.capabilities.performanceMemory,
    uaSpecificMemory: !!state.capabilities.uaSpecificMemory,
    longTaskObserver: !!state.capabilities.longTaskObserver,
    requestAnimationFrame: !!state.capabilities.requestAnimationFrame,
  },
});

const resetCeRuntimeStats = () => {
  const state = getState();
  state.seq = 0;
  state.samples = [];
  state.lastSampleAt = 0;
  state.frameTotals = createFrameCounter();
  state.frameSinceLast = createFrameCounter();
  state.longTaskTotals = createLongTaskCounter();
  state.longTaskSinceLast = createLongTaskCounter();
  state.lastUaMemoryAt = 0;
  state.lastUaMemory = null;
  state.uaMemoryInFlight = false;
  state.cacheEventTsByNamespace = {};
  state.cacheEventTotalsByNamespace = {};
  state.cacheEventSinceLastByNamespace = {};
  state.lastPerfCountersFlat = readPerfCounters().flat;
  return snapshotCeRuntimeStats();
};

const startCeRuntimeStats = (opts = {}) => {
  const state = getState();
  if (state.running) {
    return getStatusInternal(state);
  }

  state.config = sanitizeStartOptions(opts);
  refreshCapabilities(state);
  state.running = true;
  state.startedAt = safeNow();
  state.stoppedAt = 0;
  state.lastPerfCountersFlat = readPerfCounters().flat;
  state.frameSinceLast = createFrameCounter();
  state.longTaskSinceLast = createLongTaskCounter();
  state.lastRafTs = 0;

  startLongTaskObserver();
  startRafLoop();
  collectSample('start');
  startSampleTimer();
  return getStatusInternal(state);
};

const stopCeRuntimeStats = () => {
  const state = getState();
  if (!state.running) {
    return getStatusInternal(state);
  }

  state.running = false;
  state.stoppedAt = safeNow();
  stopSampleTimer();
  stopRafLoop();
  stopLongTaskObserver();
  return getStatusInternal(state);
};

const statusCeRuntimeStats = () => {
  const state = getState();
  return getStatusInternal(state);
};

const snapshotCeRuntimeStats = () => {
  const state = getState();
  const nowTs = safeNow();
  const status = getStatusInternal(state);
  const cachePressure = readCachePressureSnapshot(state, nowTs, { resetSinceLast: false });
  const samples = Array.isArray(state.samples) ? state.samples : [];
  const latestSample = samples.length > 0 ? safeClone(samples[samples.length - 1]) : null;
  return {
    ...status,
    ts: nowTs,
    cachePressure,
    latestSample,
    recentSamples: safeClone(samples) || [],
  };
};

const recordCeRuntimeCacheEvent = (evt = {}) => {
  const state = getState();
  if (!state.running) return false;
  const namespace = normalizeNamespace(evt?.namespace || evt);
  if (!namespace) return false;
  const ts = safeNow();
  if (!Array.isArray(state.cacheEventTsByNamespace[namespace])) {
    state.cacheEventTsByNamespace[namespace] = [];
  }
  state.cacheEventTsByNamespace[namespace].push(ts);
  pruneNamespaceEvents(state.cacheEventTsByNamespace[namespace], ts, CACHE_RATE_PRUNE_WINDOW_MS);
  state.cacheEventTotalsByNamespace[namespace] = Number(state.cacheEventTotalsByNamespace[namespace] || 0) + 1;
  state.cacheEventSinceLastByNamespace[namespace] = Number(state.cacheEventSinceLastByNamespace[namespace] || 0) + 1;
  return true;
};

const shouldAutoStartCeRuntimeStats = () => isCeRuntimeStatsEnabled();

const installGlobalApi = () => {
  const g = getGlobal();
  if (!g) return;
  const existing = isPlainObject(g.__CE_RUNTIME_STATS__) ? g.__CE_RUNTIME_STATS__ : {};
  g.__CE_RUNTIME_STATS__ = {
    ...existing,
    start: startCeRuntimeStats,
    stop: stopCeRuntimeStats,
    reset: resetCeRuntimeStats,
    snapshot: snapshotCeRuntimeStats,
    status: statusCeRuntimeStats,
  };
};

installGlobalApi();

export {
  shouldAutoStartCeRuntimeStats,
  startCeRuntimeStats,
  stopCeRuntimeStats,
  resetCeRuntimeStats,
  snapshotCeRuntimeStats,
  statusCeRuntimeStats,
  recordCeRuntimeCacheEvent,
};
