import { normalizeSessionSlug } from '../session/sessionNaming.js';
import { toStr } from '../shared/primitives.js';
import { normalizeAddress } from '../web3/addressNormalization.js';
import { normalizeWorkerUrl } from './workerUrl.js';

const STORAGE_PREFIX = 'ce:workerToken:v1';
const TOKEN_SKEW_SECONDS = 30;
const MAX_TOKEN_CACHE_TTL_SECONDS = 24 * 60 * 60;

type TokenCacheScope = {
  address?: unknown;
  maxTtlSeconds?: unknown;
  nowSeconds?: unknown;
  sessionSlug?: unknown;
  skewSeconds?: unknown;
  workerUrl?: unknown;
};

type TokenCacheEnvelopeInput = {
  address?: unknown;
  exp?: unknown;
  issuedAt?: unknown;
  sessionSlug?: unknown;
  token?: unknown;
  workerUrl?: unknown;
};

type TokenCacheEntry = Record<string, unknown>;

export const isWorkerTokenCacheKey = (key: unknown): boolean => String(key || '').startsWith(`${STORAGE_PREFIX}:`);

export const readTokenCache = (key: string): unknown | null => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};

export const normalizeTokenCacheEntry = (
  entry: unknown,
  {
    workerUrl,
    sessionSlug,
    address,
    nowSeconds = Math.floor(Date.now() / 1000),
    skewSeconds = TOKEN_SKEW_SECONDS,
    maxTtlSeconds = MAX_TOKEN_CACHE_TTL_SECONDS,
  }: TokenCacheScope = {},
):
  | {
      exp: number;
      expiresAt: number;
      issuedAt: number | null;
      legacy: boolean;
      ok: true;
      token: string;
    }
  | { ok: false; status: string } => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { ok: false, status: 'malformed' };
  }
  const record = entry as TokenCacheEntry;

  const token = toStr(record.token).trim();
  const expiresAt = Number(record.expiresAt || record.exp || 0);
  if (!token) return { ok: false, status: 'missing-token' };
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    return { ok: false, status: 'missing-expiry' };
  }
  if (expiresAt <= Number(nowSeconds || 0) + Number(skewSeconds || 0)) {
    return { ok: false, status: 'expired' };
  }

  if (Number(record.v || 0) >= 1) {
    const issuedAt = Number(record.issuedAt || 0) || null;
    const maxTtl = Number(maxTtlSeconds || 0);
    if (issuedAt && Number.isFinite(maxTtl) && maxTtl > 0 && expiresAt > issuedAt + maxTtl) {
      return { ok: false, status: 'ttl-too-long' };
    }
    const expectedWorkerUrl = normalizeWorkerUrl(workerUrl);
    const expectedSlug = normalizeSessionSlug(sessionSlug);
    const expectedAddress = normalizeAddress(address);
    const entryWorkerUrl = normalizeWorkerUrl(record.workerUrl);
    const entrySlug = normalizeSessionSlug(record.sessionSlug);
    const entryAddress = normalizeAddress(record.address);
    if (
      (expectedWorkerUrl && entryWorkerUrl && expectedWorkerUrl !== entryWorkerUrl) ||
      entrySlug !== expectedSlug ||
      (expectedAddress && entryAddress && expectedAddress !== entryAddress)
    ) {
      return { ok: false, status: 'scope-mismatch' };
    }
  }

  return {
    ok: true,
    token,
    exp: expiresAt,
    expiresAt,
    issuedAt: Number(record.issuedAt || 0) || null,
    legacy: Number(record.v || 0) < 1,
  };
};

export const readScopedTokenCache = (
  key: string,
  scope: TokenCacheScope = {},
): ReturnType<typeof normalizeTokenCacheEntry> | null => {
  const parsed = readTokenCache(key);
  const normalized = normalizeTokenCacheEntry(parsed, scope);
  if (normalized.ok) return normalized;
  if (parsed) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }
  return null;
};

export const buildTokenCacheEnvelope = ({
  token,
  exp,
  workerUrl,
  sessionSlug,
  address,
  issuedAt = Math.floor(Date.now() / 1000),
}: TokenCacheEnvelopeInput = {}): {
  address: string;
  expiresAt: number;
  issuedAt: number;
  sessionSlug: string;
  token: string;
  v: 1;
  workerUrl: string;
} => ({
  v: 1,
  workerUrl: normalizeWorkerUrl(workerUrl),
  sessionSlug: normalizeSessionSlug(sessionSlug),
  address: normalizeAddress(address),
  issuedAt: Number(issuedAt || 0) || Math.floor(Date.now() / 1000),
  expiresAt: Number(exp || 0),
  token: toStr(token).trim(),
});

export const writeTokenCache = (key: string, payload: unknown): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (_) {}
};

export const clearTokenCache = (key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (_) {}
};

export const buildTokenCacheKey = ({
  workerUrl,
  slug,
  address,
}: {
  address?: unknown;
  slug?: unknown;
  workerUrl?: unknown;
} = {}): string => {
  const resolvedUrl = normalizeWorkerUrl(workerUrl);
  const normalizedSlug = normalizeSessionSlug(slug);
  const normalizedAddress = normalizeAddress(address);
  if (normalizedAddress) {
    return `${STORAGE_PREFIX}:${resolvedUrl}:${normalizedSlug}:${normalizedAddress}`;
  }
  return `${STORAGE_PREFIX}:${resolvedUrl}:${normalizedSlug}`;
};
