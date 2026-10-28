// Keep the label registry independent of URL parsing so URL helpers can record context.
const ARWEAVE_TX_CONTEXT_CACHE_MAX = 3000;
const ARWEAVE_TX_CONTEXT_LABEL_MAX = 8;

type TxContextCacheEntry = {
  labels: string[];
  ts: number;
};

type TxContextRecord = {
  [field: string]: unknown;
};

const arweaveTxContextCache = new Map<string, TxContextCacheEntry>();

const asContextRecord = (context: unknown): TxContextRecord =>
  context && typeof context === 'object' ? (context as TxContextRecord) : {};

export const registerNormalizedArweaveTxContext = (normalizedTxId: string, context: unknown = {}): void => {
  if (!normalizedTxId) return;
  const contextRecord = asContextRecord(context);
  const category =
    String(contextRecord.category || '')
      .trim()
      .toLowerCase() || 'unknown';
  const caller = String(contextRecord.caller || contextRecord.fn || '').trim() || '';
  const source =
    String(contextRecord.source || '')
      .trim()
      .toLowerCase() || 'unknown';
  const label = caller ? `${category}:${caller}:${source}` : `${category}:${source}`;
  const prev = arweaveTxContextCache.get(normalizedTxId) || { labels: [], ts: 0 };
  const labels = Array.isArray(prev.labels) ? [...prev.labels] : [];
  if (!labels.includes(label)) labels.push(label);
  while (labels.length > ARWEAVE_TX_CONTEXT_LABEL_MAX) labels.shift();
  arweaveTxContextCache.set(normalizedTxId, { labels, ts: Date.now() });
  while (arweaveTxContextCache.size > ARWEAVE_TX_CONTEXT_CACHE_MAX) {
    const oldest = arweaveTxContextCache.keys().next().value;
    if (!oldest) break;
    arweaveTxContextCache.delete(oldest);
  }
};

export const getNormalizedArweaveTxContextLabels = (normalizedTxId: string): string[] => {
  if (!normalizedTxId) return [];
  const entry = arweaveTxContextCache.get(normalizedTxId);
  if (!entry || !Array.isArray(entry.labels)) return [];
  return [...entry.labels];
};
