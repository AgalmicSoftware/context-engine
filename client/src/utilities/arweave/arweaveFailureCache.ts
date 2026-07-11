import { classifyStatusKind, createArweaveFetchError } from './arweaveFetchErrors';

const ARWEAVE_FAILURE_CACHE_MAX = 1200;
const ARWEAVE_FAILURE_BASE_RETRY_MS = 1500;
const ARWEAVE_FAILURE_MAX_RETRY_MS = 2 * 60 * 1000;
const ARWEAVE_FAILURE_NOT_FOUND_RETRY_MS = 10 * 60 * 1000;
const ARWEAVE_FAILURE_RESPONSE_NOT_FOUND_RETRY_MS = 30 * 1000;
const ARWEAVE_FAILURE_PENDING_RETRY_MS = 30 * 1000;
const ARWEAVE_FAILURE_INVALID_RETRY_MS = 30 * 60 * 1000;
const MAX_FAILURE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

export type FailureCacheEntry = {
  attempts?: number;
  firstFailedAtMs?: number;
  kind?: string;
  lastFailedAtMs?: number;
  message?: string;
  nextRetryAtMs?: number;
  retryable?: boolean;
  status?: number | null;
};

type ErrorLike = {
  kind?: unknown;
  message?: unknown;
  retryable?: unknown;
  status?: unknown;
};

const arweaveFailureCache = new Map<string, FailureCacheEntry>();

const computeFailureRetryAtMs = ({
  status = null,
  kind = 'unknown',
  retryable = true,
  attempts = 1,
  useShortNotFoundCooldown = false,
}: {
  attempts?: unknown;
  kind?: unknown;
  retryable?: unknown;
  status?: unknown;
  useShortNotFoundCooldown?: boolean;
}): number => {
  const now = Date.now();
  const safeAttempts = Math.max(1, Number(attempts || 1));
  if (status === 404 || kind === 'not_found') {
    // Gateway-first metadata misses are usually propagation lag, so use a
    // short retry window instead of hiding the asset for the full metadata TTL.
    if (useShortNotFoundCooldown) {
      return now + ARWEAVE_FAILURE_RESPONSE_NOT_FOUND_RETRY_MS;
    }
    return now + ARWEAVE_FAILURE_NOT_FOUND_RETRY_MS;
  }
  if (status === 202 || kind === 'pending') return now + ARWEAVE_FAILURE_PENDING_RETRY_MS;
  if (!retryable || kind === 'invalid') return now + ARWEAVE_FAILURE_INVALID_RETRY_MS;
  const n = Math.max(0, Math.min(10, safeAttempts - 1));
  const delay = Math.min(ARWEAVE_FAILURE_MAX_RETRY_MS, Math.round(ARWEAVE_FAILURE_BASE_RETRY_MS * Math.pow(2, n)));
  return now + delay;
};

export const clearFailureCacheEntry = (txId: unknown): void => {
  const key = String(txId || '').trim();
  if (!key) return;
  arweaveFailureCache.delete(key);
};

export const getFailureCacheEntry = (txId: unknown): FailureCacheEntry | null => {
  const key = String(txId || '').trim();
  if (!key) return null;
  const entry = arweaveFailureCache.get(key);
  if (!entry || typeof entry !== 'object') return null;
  const nextRetryAtMs = Number(entry.nextRetryAtMs || 0);
  if (nextRetryAtMs <= 0) {
    clearFailureCacheEntry(key);
    return null;
  }
  if (nextRetryAtMs > Date.now() + MAX_FAILURE_COOLDOWN_MS) {
    clearFailureCacheEntry(key);
    return null;
  }
  return { ...entry };
};

const setFailureCacheEntry = (txId: unknown, entry: unknown): void => {
  const key = String(txId || '').trim();
  if (!key || !entry || typeof entry !== 'object') return;
  arweaveFailureCache.delete(key);
  arweaveFailureCache.set(key, { ...(entry as FailureCacheEntry) });
  while (arweaveFailureCache.size > ARWEAVE_FAILURE_CACHE_MAX) {
    const oldest = arweaveFailureCache.keys().next().value;
    if (!oldest) break;
    arweaveFailureCache.delete(oldest);
  }
};

export const recordFailureCacheEntry = (
  txId: unknown,
  error: ErrorLike | null | undefined,
  { useShortNotFoundCooldown = false }: { useShortNotFoundCooldown?: boolean } = {},
): FailureCacheEntry | null => {
  const key = String(txId || '').trim();
  if (!key) return null;
  const prev = getFailureCacheEntry(key) || {};
  const attempts = Math.max(1, Number(prev.attempts || 0) + 1);
  const now = Date.now();
  const status = Number.isFinite(Number(error?.status)) ? Number(error?.status) : null;
  const kind = String(error?.kind || classifyStatusKind(status) || 'unknown');
  const retryable =
    typeof error?.retryable === 'boolean'
      ? error.retryable
      : status === 404 || status === 202 || status === 429 || Number(status) >= 500 || kind === 'network';
  const nextRetryAtMs = computeFailureRetryAtMs({
    status,
    kind,
    retryable,
    attempts,
    useShortNotFoundCooldown,
  });
  const cappedRetryAt = Math.min(nextRetryAtMs, Date.now() + MAX_FAILURE_COOLDOWN_MS);
  const entry = {
    attempts,
    firstFailedAtMs: Number(prev.firstFailedAtMs || 0) > 0 ? Number(prev.firstFailedAtMs) : now,
    lastFailedAtMs: now,
    nextRetryAtMs: cappedRetryAt,
    status,
    kind,
    retryable,
    message: String(error?.message || prev.message || 'Arweave fetch failed'),
  };
  setFailureCacheEntry(key, entry);
  return entry;
};

export const buildFailureCacheError = ({
  txId,
  failureEntry,
}: {
  failureEntry?: FailureCacheEntry | null;
  txId: unknown;
}) => {
  const entry = failureEntry && typeof failureEntry === 'object' ? failureEntry : {};
  const status = Number.isFinite(Number(entry.status)) ? Number(entry.status) : null;
  const kind = String(entry.kind || (status === 404 ? 'not_found' : 'cooldown') || 'cooldown');
  const retryable =
    typeof entry.retryable === 'boolean'
      ? entry.retryable
      : kind === 'not_found' ||
        kind === 'pending' ||
        kind === 'network' ||
        kind === 'server' ||
        kind === 'rate_limited';
  const err = createArweaveFetchError({
    txId,
    status,
    retryable,
    kind,
    gateway: 'memo',
    attempt: Number(entry.attempts || 0),
    message: String(entry.message || 'Arweave content not available yet. Retry later.'),
  });
  err.nextRetryAtMs = Number(entry.nextRetryAtMs || 0);
  err.failureAttempts = Number(entry.attempts || 0);
  return err;
};
