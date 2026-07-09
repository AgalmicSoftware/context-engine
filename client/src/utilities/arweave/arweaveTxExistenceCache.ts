const ARWEAVE_TX_EXISTENCE_CACHE_TTL_MS = 15 * 60 * 1000;
const ARWEAVE_TX_EXISTENCE_CACHE_MAX = 2400;

type TxExistenceCacheEntry = {
  exists: boolean;
  ts: number;
};

const arweaveTxExistenceCache = new Map<string, TxExistenceCacheEntry>();

export const getTxExistenceCacheEntry = (txId: unknown): boolean | null => {
  const key = String(txId || '').trim();
  if (!key) return null;
  const entry = arweaveTxExistenceCache.get(key);
  if (!entry || typeof entry !== 'object') return null;
  const ageMs = Date.now() - Number(entry.ts || 0);
  if (!Number.isFinite(ageMs) || ageMs > ARWEAVE_TX_EXISTENCE_CACHE_TTL_MS) {
    arweaveTxExistenceCache.delete(key);
    return null;
  }
  arweaveTxExistenceCache.delete(key);
  arweaveTxExistenceCache.set(key, entry);
  return entry.exists === true;
};

export const setTxExistenceCacheEntry = (txId: unknown, exists: unknown): void => {
  const key = String(txId || '').trim();
  if (!key || typeof exists !== 'boolean') return;
  arweaveTxExistenceCache.delete(key);
  arweaveTxExistenceCache.set(key, { exists, ts: Date.now() });
  while (arweaveTxExistenceCache.size > ARWEAVE_TX_EXISTENCE_CACHE_MAX) {
    const oldest = arweaveTxExistenceCache.keys().next().value;
    if (!oldest) break;
    arweaveTxExistenceCache.delete(oldest);
  }
};
