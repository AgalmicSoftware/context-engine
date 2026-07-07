export const ABUSE_COUNTER_TYPES = Object.freeze({
  AUTH_FAILURE: 'auth_failures',
  NONCE_REPLAY: 'nonce_replays',
  RATE_LIMIT_TRIP: 'rate_limit_trips',
});

export const DEFAULT_ABUSE_COUNTER_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_ABUSE_COUNTER_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_ABUSE_COUNTER_SUMMARY_WINDOWS = 24;
const MAX_ABUSE_COUNTER_SUMMARY_WINDOWS = 168;

const normalizeWindowMs = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : DEFAULT_ABUSE_COUNTER_WINDOW_MS;
};

const normalizeNowMs = (now) => {
  const value = typeof now === 'function' ? now() : Date.now();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
};

const normalizeSummaryWindowCount = (windows) => {
  const numeric = Number(windows);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_ABUSE_COUNTER_SUMMARY_WINDOWS;
  return Math.min(Math.floor(numeric), MAX_ABUSE_COUNTER_SUMMARY_WINDOWS);
};

const resolveWindowStart = ({ now, windowMs } = {}) => {
  const normalizedWindowMs = normalizeWindowMs(windowMs);
  return Math.floor(normalizeNowMs(now) / normalizedWindowMs) * normalizedWindowMs;
};

const resolveAbuseCounterKv = (env) => (
  env?.CE_ABUSE_COUNTERS_KV || env?.ABUSE_COUNTERS_KV || null
);

const isKnownAbuseCounterType = (type) => (
  Object.values(ABUSE_COUNTER_TYPES).includes(type)
);

export const buildAbuseCounterKey = ({
  type,
  now,
  windowMs,
} = {}) => {
  if (!isKnownAbuseCounterType(type)) {
    throw new Error('Unknown abuse counter type.');
  }
  const windowStart = resolveWindowStart({ now, windowMs });
  return `abuse:v1:${new Date(windowStart).toISOString()}:${type}`;
};

export const recordAbuseEvent = async ({
  env,
  type,
  now,
  windowMs,
  ttlSeconds = DEFAULT_ABUSE_COUNTER_TTL_SECONDS,
} = {}) => {
  try {
    if (!isKnownAbuseCounterType(type)) {
      return { ok: false, skipped: true, error: 'Unknown abuse counter type.' };
    }

    const kv = resolveAbuseCounterKv(env);
    if (!kv) return { ok: false, skipped: true };

    const key = buildAbuseCounterKey({ type, now, windowMs });
    const current = Number(await kv.get(key));
    const next = Number.isFinite(current) && current >= 0 ? current + 1 : 1;
    const expirationTtl = Number.isFinite(Number(ttlSeconds)) && Number(ttlSeconds) > 0
      ? Number(ttlSeconds)
      : DEFAULT_ABUSE_COUNTER_TTL_SECONDS;
    await kv.put(key, String(next), { expirationTtl });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error: error?.message || String(error || 'Abuse counter update failed.'),
    };
  }
};

export const readAbuseCounterSummary = async ({
  env,
  now,
  windows,
  windowMs,
} = {}) => {
  try {
    const kv = resolveAbuseCounterKv(env);
    const normalizedWindowMs = normalizeWindowMs(windowMs);
    const currentWindowStart = resolveWindowStart({ now, windowMs: normalizedWindowMs });
    const windowCount = normalizeSummaryWindowCount(windows);
    const counterTypes = Object.values(ABUSE_COUNTER_TYPES);

    const summaryWindows = [];
    for (let offset = 0; offset < windowCount; offset += 1) {
      const windowStart = currentWindowStart - (offset * normalizedWindowMs);
      const counts = {};
      for (const type of counterTypes) {
        const raw = kv?.get
          ? await kv.get(buildAbuseCounterKey({ type, now: () => windowStart, windowMs: normalizedWindowMs }))
          : null;
        const numeric = Number(raw || 0);
        counts[type] = Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
      }
      summaryWindows.push({
        windowStart,
        window: new Date(windowStart).toISOString(),
        counts,
      });
    }

    return {
      ok: true,
      windowMs: normalizedWindowMs,
      windows: summaryWindows,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error || 'Abuse counter summary failed.'),
    };
  }
};
