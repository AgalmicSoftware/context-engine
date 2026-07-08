import { toStr } from '../shared/primitives.js';
import { normalizeWorkerUrl } from './workerUrl.js';

const ANONYMOUS_RATE_ID_STORAGE_KEY = 'ce:anonClientId:v1';

type HeaderExtras = Record<string, string | undefined>;

export const mergeHeaders = (base?: HeadersInit | null, extra?: HeaderExtras): Headers => {
  const out = new Headers(base || {});
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value !== undefined) out.set(key, value);
  });
  return out;
};

export const normalizeAnonymousRateId = (raw: unknown): string => {
  const cleaned = toStr(raw).trim().toLowerCase();
  if (!cleaned) return '';
  if (!/^[a-z0-9_-]{8,128}$/.test(cleaned)) return '';
  return cleaned;
};

export const createAnonymousRateId = (): string => {
  try {
    if (
      typeof globalThis !== 'undefined' &&
      globalThis.crypto &&
      typeof globalThis.crypto.getRandomValues === 'function'
    ) {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (_) {}
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
};

export const getAnonymousRateId = (): string => {
  if (typeof window === 'undefined') return '';
  const storage = globalThis.localStorage;
  try {
    const cached = normalizeAnonymousRateId(storage.getItem(ANONYMOUS_RATE_ID_STORAGE_KEY) || '');
    if (cached) return cached;
  } catch (_) {}
  const generated = normalizeAnonymousRateId(createAnonymousRateId());
  if (!generated) return '';
  try {
    storage.setItem(ANONYMOUS_RATE_ID_STORAGE_KEY, generated);
  } catch (_) {}
  return generated;
};

export const buildWorkerAuthNonceHeaders = (baseHeaders?: HeadersInit | null): Headers => {
  const headers = mergeHeaders(baseHeaders, {});
  const anonRateId = getAnonymousRateId();
  if (anonRateId && !headers.has('X-Anonymous-Client-Id')) {
    headers.set('X-Anonymous-Client-Id', anonRateId);
  }
  return headers;
};

export const isStreamBody = (body: unknown): boolean => {
  if (!body) return false;
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return true;
  return typeof (body as { getReader?: unknown })?.getReader === 'function';
};

export const buildAnonymousHeaders = ({
  baseHeaders,
  slug,
}: {
  baseHeaders?: HeadersInit | null;
  slug?: string;
} = {}): Headers => {
  const headers = mergeHeaders(baseHeaders, {});
  headers.delete('Authorization');
  headers.delete('authorization');
  const anonRateId = getAnonymousRateId();
  if (anonRateId && !headers.has('X-Anonymous-Client-Id')) {
    headers.set('X-Anonymous-Client-Id', anonRateId);
  }
  if (!headers.has('X-Session-Slug') && !headers.has('X-Group-Slug')) {
    headers.set('X-Group-Slug', slug || 'general');
  }
  return headers;
};

export const stripAnonymousRateIdHeader = (baseHeaders?: HeadersInit | null): Headers => {
  const headers = mergeHeaders(baseHeaders, {});
  headers.delete('X-Anonymous-Client-Id');
  headers.delete('x-anonymous-client-id');
  return headers;
};

export const normalizeHttpMethod = (methodIn: unknown = 'GET'): string => {
  const normalized = toStr(methodIn || 'GET')
    .trim()
    .toUpperCase();
  return normalized || 'GET';
};

export const isIdempotentRequestMethod = (methodIn: unknown = 'GET'): boolean => {
  const method = normalizeHttpMethod(methodIn);
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
};

export const buildProbeInit = (headers: HeadersInit, options: RequestInit = {}): RequestInit => {
  const init: RequestInit = {
    method: 'GET',
    headers,
    cache: 'no-store',
  };
  if (options && typeof options === 'object') {
    if (options.credentials !== undefined) init.credentials = options.credentials;
    if (options.mode !== undefined) init.mode = options.mode;
    if (options.redirect !== undefined) init.redirect = options.redirect;
    if (options.referrerPolicy !== undefined) init.referrerPolicy = options.referrerPolicy;
    if (options.signal !== undefined) init.signal = options.signal;
  }
  return init;
};

export const shouldRetryAnonymousWithoutRateId = async ({
  workerUrl,
  anonymousHeaders,
  options = {},
}: {
  workerUrl?: string;
  anonymousHeaders?: HeadersInit | null;
  options?: RequestInit;
} = {}): Promise<boolean> => {
  if (isIdempotentRequestMethod(options?.method)) return true;
  const baseUrl = normalizeWorkerUrl(workerUrl);
  if (!baseUrl) return false;

  // For non-idempotent requests, verify likely CORS-preflight incompatibility first.
  const probeUrl = `${baseUrl.replace(/\/+$/, '')}/health`;
  const probeHeadersWithRateId = mergeHeaders(anonymousHeaders, {});
  const probeHeadersWithoutRateId = stripAnonymousRateIdHeader(probeHeadersWithRateId);
  try {
    await fetch(probeUrl, buildProbeInit(probeHeadersWithRateId, options));
    // Any transport-level success means this header is not preflight-blocked.
    // Do not replay non-idempotent writes when that signal is present.
    return false;
  } catch (_) {}
  try {
    await fetch(probeUrl, buildProbeInit(probeHeadersWithoutRateId, options));
    // A successful transport response (even 401/403) is enough to confirm
    // the header-triggered preflight issue has been avoided.
    return true;
  } catch (_) {
    return false;
  }
};
