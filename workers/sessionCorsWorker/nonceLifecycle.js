import {
  ABUSE_COUNTER_TYPES,
  recordAbuseEvent as recordAbuseEventBoundary,
} from './abuseObservability.js';

const DEFAULT_USED_NONCE_TTL_SECONDS = 60 * 10;
const DEFAULT_NONCE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const DEFAULT_NONCE_RATE_LIMIT_TTL_SECONDS = 60;
const DEFAULT_NONCE_RATE_LIMIT_MAX = 5;
const nonceConsumeLocks = new Map();

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

const withNonceConsumeLock = async (key, work) => {
  const previous = nonceConsumeLocks.get(key) || Promise.resolve();
  let release = () => {};
  const next = new Promise((resolve) => {
    release = resolve;
  });
  nonceConsumeLocks.set(key, next);

  try {
    await previous;
    return await work();
  } finally {
    if (nonceConsumeLocks.get(key) === next) {
      nonceConsumeLocks.delete(key);
    }
    release();
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

const buildClaimId = (deps) => {
  if (typeof deps?.buildClaimId === 'function') return deps.buildClaimId();
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return buildNonce(deps);
};

export const consumeNonce = async (env, slug, address, nonce, deps) => {
  const groupKv = env?.GROUP_KV;
  const usedNonceTtlSeconds = Number.isFinite(deps?.usedNonceTtlSeconds)
    ? deps.usedNonceTtlSeconds
    : DEFAULT_USED_NONCE_TTL_SECONDS;
  const consumeKey = `${slug}:${address}:${nonce}`;

  return withNonceConsumeLock(consumeKey, async () => {
    const addrKey = `nonce:${slug}:${address}`;
    const usedKey = `usedNonce:${slug}:${nonce}`;
    const alreadyUsed = await groupKv?.get?.(usedKey);
    if (alreadyUsed) {
      await recordAbuseEventBestEffort({
        env,
        type: ABUSE_COUNTER_TYPES.NONCE_REPLAY,
        deps,
      });
      return { ok: false, error: 'Nonce already used.' };
    }

    const claimId = buildClaimId(deps);
    await groupKv?.put?.(usedKey, claimId, { expirationTtl: usedNonceTtlSeconds });

    const existing = await groupKv?.get?.(addrKey);
    if (!existing || existing !== nonce) {
      const currentClaim = await groupKv?.get?.(usedKey);
      if (!currentClaim || currentClaim === claimId) {
        await groupKv?.delete?.(usedKey);
      }
      return { ok: false, error: 'Nonce mismatch or expired.' };
    }

    const currentClaim = await groupKv?.get?.(usedKey);
    if (currentClaim && currentClaim !== claimId) {
      return { ok: false, error: 'Nonce already used.' };
    }

    await groupKv?.delete?.(addrKey);
    return { ok: true };
  });
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
} = {}) => {
  const numericLimit = Number(limit);
  if (!Number.isFinite(numericLimit) || numericLimit <= 0) return { ok: true };

  const currentTime = typeof now === 'function' ? now() : Date.now();
  const numericWindowMs = Number.isFinite(Number(windowMs)) && Number(windowMs) > 0
    ? Number(windowMs)
    : DEFAULT_NONCE_RATE_LIMIT_WINDOW_MS;
  const windowStart = Math.floor(currentTime / numericWindowMs) * numericWindowMs;
  const normalizedIdentity = String(identity || '').trim().toLowerCase();
  const fallbackIdentity = String(address || '').trim().toLowerCase();
  const rateIdentity = normalizedIdentity || fallbackIdentity || 'unknown';
  const sessionSlug = String(slug || '').trim();
  const key = `rate:authNonce:${sessionSlug}:${rateIdentity}:${windowStart}`;

  const raw = await env?.GROUP_KV?.get?.(key);
  const current = Number(raw || 0);
  const next = Number.isFinite(current) && current >= 0 ? current + 1 : 1;
  const expirationTtl = Number.isFinite(Number(ttlSeconds)) && Number(ttlSeconds) > 0
    ? Number(ttlSeconds)
    : DEFAULT_NONCE_RATE_LIMIT_TTL_SECONDS;
  await env?.GROUP_KV?.put?.(key, String(next), { expirationTtl });

  if (next > numericLimit) {
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
