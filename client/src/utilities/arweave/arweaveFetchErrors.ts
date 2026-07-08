export type ArweaveFetchErrorKind =
  'invalid' | 'network' | 'not_found' | 'pending' | 'rate_limited' | 'server' | 'unknown';

export type ArweaveFetchError = Error & {
  attempt?: number;
  cause?: unknown;
  code?: string;
  failureAttempts?: number;
  gateway?: string;
  kind?: ArweaveFetchErrorKind | string;
  nextRetryAtMs?: number;
  retryable?: boolean;
  status?: number | null;
  timeoutMs?: number;
  txId?: string;
  url?: string;
};

export const isRetryableStatus = (status: unknown): boolean =>
  status === 202 ||
  status === 425 ||
  status === 429 ||
  status === 500 ||
  status === 502 ||
  status === 503 ||
  status === 504;

export const classifyStatusKind = (status: unknown): ArweaveFetchErrorKind => {
  if (status === 404) return 'not_found';
  if (status === 202) return 'pending';
  if (status === 425 || status === 429) return 'rate_limited';
  const comparableStatus = status as number;
  if (comparableStatus >= 500) return 'server';
  if (comparableStatus >= 400) return 'invalid';
  return 'unknown';
};

export const looksLikeHtmlGatewayPayload = ({
  text = '',
  contentType = '',
}: {
  contentType?: unknown;
  text?: unknown;
} = {}): boolean => {
  const type = String(contentType || '')
    .trim()
    .toLowerCase();
  const snippet = String(text || '')
    .trimStart()
    .slice(0, 256)
    .toLowerCase();
  if (type.includes('text/html') || type.includes('application/xhtml+xml')) return true;
  return (
    snippet.startsWith('<!doctype html') ||
    snippet.startsWith('<html') ||
    snippet.startsWith('<head') ||
    snippet.startsWith('<body')
  );
};

export const inferStatusFromHtmlGatewayPayload = (text: unknown = ''): number | null => {
  const body = String(text || '');
  const snippet = body.slice(0, 2048);
  const hasTitleStatus = (status: unknown) => {
    const escapedStatus = String(status || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`<title[^>]*>\\s*${escapedStatus}\\b`, 'i').test(snippet);
  };

  if (hasTitleStatus(404) || (/\b404\b/.test(snippet) && /page not found|not found/i.test(snippet))) return 404;
  if (hasTitleStatus(429) || (/\b429\b/.test(snippet) && /too many requests|rate limit/i.test(snippet))) return 429;
  if (hasTitleStatus(401) || (/\b401\b/.test(snippet) && /unauthorized|not authorized/i.test(snippet))) return 401;
  if (hasTitleStatus(403) || (/\b403\b/.test(snippet) && /forbidden|access denied|permission denied/i.test(snippet)))
    return 403;
  if (hasTitleStatus(502) || (/\b502\b/.test(snippet) && /bad gateway/i.test(snippet))) return 502;
  if (hasTitleStatus(503) || (/\b503\b/.test(snippet) && /service unavailable|temporarily unavailable/i.test(snippet)))
    return 503;
  if (hasTitleStatus(504) || (/\b504\b/.test(snippet) && /gateway timeout/i.test(snippet))) return 504;
  if (hasTitleStatus(500) || (/\b500\b/.test(snippet) && /internal server error/i.test(snippet))) return 500;
  return null;
};

export const createArweaveFetchError = ({
  txId = '',
  status = null,
  retryable = false,
  kind = 'unknown',
  message = 'Arweave fetch failed',
  gateway = '',
  attempt = 0,
  cause = null,
}: {
  attempt?: unknown;
  cause?: unknown;
  gateway?: unknown;
  kind?: unknown;
  message?: unknown;
  retryable?: unknown;
  status?: unknown;
  txId?: unknown;
} = {}): ArweaveFetchError => {
  const err: ArweaveFetchError = new Error(String(message || 'Arweave fetch failed'));
  err.name = 'ArweaveFetchError';
  err.txId = String(txId || '');
  err.status = Number.isFinite(Number(status)) ? Number(status) : null;
  err.retryable = !!retryable;
  err.kind = String(kind || 'unknown');
  err.gateway = String(gateway || '');
  err.attempt = Number(attempt || 0);
  if (cause) err.cause = cause;
  return err;
};

export const buildRetryableTimeoutError = (label: unknown = 'operation', timeoutMs: unknown = 0): ArweaveFetchError => {
  const err: ArweaveFetchError = new Error(`${String(label || 'operation')} timed out after ${timeoutMs}ms`);
  err.name = 'TimeoutError';
  err.code = 'ETIMEDOUT';
  err.retryable = true;
  err.kind = 'network';
  err.timeoutMs = Number(timeoutMs || 0) || 0;
  return err;
};

export const withTimeout = async <T>(
  promise: PromiseLike<T> | T,
  ms: unknown,
  label: unknown = 'operation',
): Promise<T> => {
  const timeoutMs = Math.max(1, Number(ms || 0));
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(buildRetryableTimeoutError(label, timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
};

export const isEmptyGatewayResponseText = (text: unknown): boolean => String(text ?? '').trim().length === 0;

export const createEmptyGatewayResponseError = ({
  txId = '',
  gateway = '',
  attempt = 0,
}: {
  attempt?: unknown;
  gateway?: unknown;
  txId?: unknown;
} = {}): ArweaveFetchError =>
  createArweaveFetchError({
    txId,
    status: null,
    retryable: true,
    kind: 'network',
    gateway,
    attempt,
    message: 'Arweave gateway returned empty response body.',
  });

export const buildFetchTimeoutError = (url: unknown, timeoutMs: unknown, cause: unknown = null): ArweaveFetchError => {
  const err: ArweaveFetchError = new Error(`Arweave fetch timed out after ${timeoutMs}ms`);
  err.name = 'AbortError';
  err.code = 'ETIMEDOUT';
  err.url = String(url || '');
  err.timeoutMs = Number(timeoutMs || 0) || 0;
  if (cause) {
    try {
      err.cause = cause;
    } catch {
      // Ignore cause assignment failures on runtimes with non-writable Error.cause.
    }
  }
  return err;
};
