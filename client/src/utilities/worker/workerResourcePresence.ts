import { resolveCorsProxyUrl } from './corsProxy.js';

type UnknownRecord = Record<string, unknown>;

export type WorkerResourcePresence = {
  ai: boolean;
  arweave: boolean;
  rpc: boolean;
  txGas: boolean;
};

const RESOURCE_KEYS = ['ai', 'arweave', 'rpc', 'txGas'] as const;
const CACHE_TTL_MS = 30_000;
const presenceCache = new Map<string, { expiresAt: number; value: WorkerResourcePresence | null }>();
const presenceInflight = new Map<string, Promise<WorkerResourcePresence | null>>();

const normalizePresence = (value: unknown): WorkerResourcePresence | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as UnknownRecord;
  return RESOURCE_KEYS.reduce(
    (acc, key) => {
      acc[key] = source[key] === true;
      return acc;
    },
    { ai: false, arweave: false, rpc: false, txGas: false } as WorkerResourcePresence,
  );
};

export const readWorkerResourcePresence = async ({
  sessionSlug = '',
  sessionConfig = null,
  context = null,
  fetchImpl = fetch,
}: {
  sessionSlug?: unknown;
  sessionConfig?: unknown;
  context?: unknown;
  fetchImpl?: typeof fetch;
} = {}): Promise<WorkerResourcePresence | null> => {
  const slug = String(sessionSlug || '').trim();
  const resolved = await resolveCorsProxyUrl({ sessionSlug: slug, sessionConfig, context });
  const workerUrl = String(resolved?.url || '')
    .trim()
    .replace(/\/+$/, '');
  if (!workerUrl) return null;

  const cacheKey = `${workerUrl}|${slug}`;
  const cached = presenceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const inflight = presenceInflight.get(cacheKey);
  if (inflight) return inflight;

  const run = (async () => {
    try {
      const response = await fetchImpl(`${workerUrl}/resource-presence`, {
        method: 'GET',
        headers: { 'X-Session-Slug': slug || 'general' },
        cache: 'no-store',
      });
      if (!response.ok) return null;
      const data = (await response.json().catch(() => null)) as UnknownRecord | null;
      return normalizePresence(data?.resources);
    } catch {
      return null;
    }
  })();
  presenceInflight.set(cacheKey, run);
  try {
    const value = await run;
    presenceCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } finally {
    if (presenceInflight.get(cacheKey) === run) presenceInflight.delete(cacheKey);
  }
};
