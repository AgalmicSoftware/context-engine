import { registerNormalizedArweaveTxContext, getNormalizedArweaveTxContextLabels } from './arweaveTxContext';
import { extractArweaveTxId } from './arweaveGatewayPayloads';

const ARWEAVE_TEXT_CACHE_TTL_MS = 10 * 60 * 1000;
const ARWEAVE_TEXT_CACHE_MAX = 600;
const ARWEAVE_TX_EVENT_DEDUPE_MAX = 3000;
const ARWEAVE_TX_EVENT_DEDUPE_TTL_MS = 30 * 1000;

type ArweaveTextCacheEntry = {
  text: unknown;
  ts: number;
};

const arweaveTextCache = new Map<string, ArweaveTextCacheEntry>();
const arweaveTxEventDedupe = new Map<unknown, number>();

export const getArweaveTextCacheEntry = (txId: unknown): ArweaveTextCacheEntry | null => {
  const key = String(txId || '').trim();
  if (!key) return null;
  const entry = arweaveTextCache.get(key);
  if (!entry) return null;
  if (Date.now() - Number(entry.ts || 0) > ARWEAVE_TEXT_CACHE_TTL_MS) {
    arweaveTextCache.delete(key);
    return null;
  }
  // LRU touch
  arweaveTextCache.delete(key);
  arweaveTextCache.set(key, entry);
  return entry;
};

export const setArweaveTextCacheEntry = (txId: unknown, text: unknown): void => {
  const key = String(txId || '').trim();
  if (!key || String(text ?? '').trim().length === 0) return;
  arweaveTextCache.delete(key);
  arweaveTextCache.set(key, { text, ts: Date.now() });
  while (arweaveTextCache.size > ARWEAVE_TEXT_CACHE_MAX) {
    const oldest = arweaveTextCache.keys().next().value;
    if (!oldest) break;
    arweaveTextCache.delete(oldest);
  }
};

export const dedupeTxEvent = (key: unknown): boolean => {
  if (!key) return true;
  const now = Date.now();
  const prev = Number(arweaveTxEventDedupe.get(key) || 0);
  if (prev > 0 && now - prev < ARWEAVE_TX_EVENT_DEDUPE_TTL_MS) return false;
  arweaveTxEventDedupe.set(key, now);
  while (arweaveTxEventDedupe.size > ARWEAVE_TX_EVENT_DEDUPE_MAX) {
    const oldest = arweaveTxEventDedupe.keys().next().value;
    if (!oldest) break;
    arweaveTxEventDedupe.delete(oldest);
  }
  return true;
};

export const registerArweaveTxContext = (txId: unknown, context: unknown = {}): void =>
  registerNormalizedArweaveTxContext(extractArweaveTxId(txId), context);

export const getArweaveTxContextLabels = (txId: unknown): string[] =>
  getNormalizedArweaveTxContextLabels(extractArweaveTxId(txId));
