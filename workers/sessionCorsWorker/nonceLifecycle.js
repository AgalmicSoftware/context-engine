const DEFAULT_USED_NONCE_TTL_SECONDS = 60 * 10;
const nonceConsumeLocks = new Map();

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

export const consumeNonce = async (env, slug, address, nonce, deps) => {
  const groupKv = env?.GROUP_KV;
  const usedNonceTtlSeconds = Number.isFinite(deps?.usedNonceTtlSeconds)
    ? deps.usedNonceTtlSeconds
    : DEFAULT_USED_NONCE_TTL_SECONDS;
  const consumeKey = `${slug}:${address}:${nonce}`;

  return withNonceConsumeLock(consumeKey, async () => {
    const addrKey = `nonce:${slug}:${address}`;
    const existing = await groupKv?.get?.(addrKey);
    if (!existing || existing !== nonce) {
      return { ok: false, error: 'Nonce mismatch or expired.' };
    }

    const usedKey = `usedNonce:${slug}:${nonce}`;
    const alreadyUsed = await groupKv?.get?.(usedKey);
    if (alreadyUsed) {
      return { ok: false, error: 'Nonce already used.' };
    }

    await groupKv?.put?.(usedKey, '1', { expirationTtl: usedNonceTtlSeconds });
    await groupKv?.delete?.(addrKey);
    return { ok: true };
  });
};
