import {
  ABUSE_COUNTER_TYPES,
  recordAbuseEvent as recordAbuseEventBoundary,
} from './abuseObservability.js';
import {
  checkCoordinatedAuthRateLimit as checkCoordinatedAuthRateLimitBoundary,
  consumeCoordinatedAuthNonce as consumeCoordinatedAuthNonceBoundary,
  issueCoordinatedAuthNonce as issueCoordinatedAuthNonceBoundary,
} from './sessionWriteCoordinator.js';

const DEFAULT_USED_NONCE_TTL_SECONDS = 60 * 10;
const DEFAULT_NONCE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_NONCE_RATE_LIMIT_TTL_SECONDS = 60;
const DEFAULT_NONCE_RATE_LIMIT_MAX = 5;

const recordAbuseEventBestEffort = async ({
  env,
  type,
  deps,
  now,
} = {}) => {
  try {
    const record = deps?.recordAbuseEvent || recordAbuseEventBoundary;
    await record({ env, type, now });
  } catch {
    // Abuse telemetry is diagnostic only and must not alter auth/rate-limit responses.
  }
};

const fillRandomValues = (bytes, deps) => {
  if (typeof deps?.getRandomValues === 'function') {
    return deps.getRandomValues(bytes);
  }
  return crypto.getRandomValues(bytes);
};

export const buildNonce = (deps) => {
  const bytes = new Uint8Array(16);
  fillRandomValues(bytes, deps);

  const encode = typeof deps?.base64UrlEncode === 'function'
    ? deps.base64UrlEncode
    : () => {
      throw new Error('base64UrlEncode unavailable');
    };
  return encode(bytes);
};

export const issueNonce = async (env, slug, address, nonce, ttlSeconds, deps = {}) => {
  const coordinate = deps?.issueCoordinatedAuthNonce || issueCoordinatedAuthNonceBoundary;
  const result = await coordinate({
    env,
    slug,
    address,
    nonce,
    ttlSeconds,
    usedNonceTtlSeconds: deps?.usedNonceTtlSeconds ?? DEFAULT_USED_NONCE_TTL_SECONDS,
    now: deps?.now,
  });
  if (!result?.ok) {
    return {
      ok: false,
      status: Number(result?.status || 0) || 503,
      error: result?.error || 'Authorization state coordination is unavailable.',
    };
  }
  await env?.GROUP_KV?.put?.(
    `nonce:${slug}:${String(address || '').toLowerCase()}`,
    nonce,
    { expirationTtl: ttlSeconds },
  );
  return { ok: true };
};

export const consumeNonce = async (env, slug, address, nonce, deps = {}) => {
  const usedNonceTtlSeconds = Number.isFinite(deps?.usedNonceTtlSeconds)
    ? deps.usedNonceTtlSeconds
    : DEFAULT_USED_NONCE_TTL_SECONDS;
  const coordinate = deps?.consumeCoordinatedAuthNonce || consumeCoordinatedAuthNonceBoundary;
  const result = await coordinate({
    env,
    slug,
    address,
    nonce,
    usedNonceTtlSeconds,
    now: deps?.now,
  });
  if (!result?.ok) {
    if (result?.error === 'Nonce already used.') {
      await recordAbuseEventBestEffort({
        env,
        type: ABUSE_COUNTER_TYPES.NONCE_REPLAY,
        deps,
      });
    }
    return {
      ok: false,
      error: result?.error || 'Authorization state coordination is unavailable.',
      status: Number(result?.status || 0) || 503,
    };
  }

  await env?.GROUP_KV?.put?.(
    `usedNonce:${slug}:${nonce}`,
    '1',
    { expirationTtl: usedNonceTtlSeconds },
  );
  await env?.GROUP_KV?.delete?.(`nonce:${slug}:${address}`);
  return { ok: true };
};

export const checkNonceRateLimit = async ({
  env,
  slug,
  identity,
  address,
  limit = DEFAULT_NONCE_RATE_LIMIT_MAX,
  now,
  windowMs = DEFAULT_NONCE_RATE_LIMIT_WINDOW_MS,
  ttlSeconds = DEFAULT_NONCE_RATE_LIMIT_TTL_SECONDS,
  recordAbuseEvent,
  checkCoordinatedAuthRateLimit,
} = {}) => {
  const numericLimit = Number(limit);
  if (!Number.isFinite(numericLimit) || numericLimit <= 0) return { ok: true };

  const numericWindowMs = Number.isFinite(Number(windowMs)) && Number(windowMs) > 0
    ? Number(windowMs)
    : DEFAULT_NONCE_RATE_LIMIT_WINDOW_MS;
  const normalizedIdentity = String(identity || '').trim().toLowerCase();
  const fallbackIdentity = String(address || '').trim().toLowerCase();
  const rateIdentity = normalizedIdentity || fallbackIdentity || 'unknown';
  const sessionSlug = String(slug || '').trim();
  const expirationTtl = Number.isFinite(Number(ttlSeconds)) && Number(ttlSeconds) > 0
    ? Number(ttlSeconds)
    : DEFAULT_NONCE_RATE_LIMIT_TTL_SECONDS;
  const coordinate = checkCoordinatedAuthRateLimit || checkCoordinatedAuthRateLimitBoundary;
  const result = await coordinate({
    env,
    slug: sessionSlug,
    route: 'authNonce',
    identity: rateIdentity,
    limit: numericLimit,
    windowMs: numericWindowMs,
    now,
  });
  if (!result?.ok) {
    return {
      ok: false,
      status: Number(result?.status || 0) || 503,
      error: result?.error || 'Authorization state coordination is unavailable.',
    };
  }
  if (!result?.allowed) {
    await recordAbuseEventBestEffort({
      env,
      type: ABUSE_COUNTER_TYPES.RATE_LIMIT_TRIP,
      deps: { recordAbuseEvent },
      now,
    });
    return {
      ok: false,
      error: 'Too many nonce requests. Try again shortly.',
      retryAfterSeconds: expirationTtl,
    };
  }
  return { ok: true };
};
