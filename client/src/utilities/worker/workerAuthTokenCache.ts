import { normalizeSessionSlug } from '../session/sessionNaming.js';
import { normalizeWorkerCanonicalSessionIdHex } from '../session/sessionWorkerDiscovery.js';
import { toStr } from '../shared/primitives.js';
import { normalizeAddress } from '../web3/addressNormalization.js';
import { normalizeWorkerUrl } from './workerUrl.js';

const STORAGE_PREFIX = 'ce:workerToken:v1';
// Changes with every sign-out or account switch in any tab of this browser.
const SIGN_IN_GENERATION_KEY = 'ce:workerSignIns:v1';
const TOKEN_SKEW_SECONDS = 30;
const MAX_TOKEN_CACHE_TTL_SECONDS = 24 * 60 * 60;
const tokenMemoryCache = new Map<string, string>();
// The sign-in generation this page saves under, from when it learned who is signed in.
let tabGeneration = '';

type TokenCacheScope = {
  address?: unknown;
  maxTtlSeconds?: unknown;
  nowSeconds?: unknown;
  sessionId?: unknown;
  sessionSlug?: unknown;
  skewSeconds?: unknown;
  workerUrl?: unknown;
};

type TokenCacheEnvelopeInput = {
  address?: unknown;
  exp?: unknown;
  issuedAt?: unknown;
  sessionId?: unknown;
  sessionSlug?: unknown;
  token?: unknown;
  workerUrl?: unknown;
};

type TokenCacheEntry = Record<string, unknown>;

export const isWorkerTokenCacheKey = (key: unknown): boolean => String(key || '').startsWith(`${STORAGE_PREFIX}:`);

export const purgePersistedTokenCache = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const storage = window.localStorage;
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (isWorkerTokenCacheKey(key)) storage.removeItem(String(key));
    }
  } catch (_) {}
};

// Worker bearer credentials used to be written to localStorage. Purge those
// records at startup; no tab reads them.
purgePersistedTokenCache();

// This tab's sessionStorage keeps its sign-ins across a reload. No other tab reads it, and a record
// saved before any tab's last sign-out or account switch is never used.
const tabStorage = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const currentGeneration = (): string => {
  try {
    return window.localStorage.getItem(SIGN_IN_GENERATION_KEY) || '';
  } catch {
    return '';
  }
};

const startGeneration = (): string => {
  const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  try {
    // Removing needs no space, so a full localStorage leaves no generation and no saved sign-in counts.
    window.localStorage.removeItem(SIGN_IN_GENERATION_KEY);
    window.localStorage.setItem(SIGN_IN_GENERATION_KEY, generation);
    return generation;
  } catch {
    return '';
  }
};

const readSavedRecord = (key: string): unknown | null => {
  try {
    const saved = JSON.parse(tabStorage()?.getItem(key) || 'null');
    const generation = currentGeneration();
    return generation && saved?.generation === generation && saved.record ? saved.record : null;
  } catch {
    return null;
  }
};

const forEachTabTokenKey = (visit: (key: string) => void): void => {
  const storage = tabStorage();
  if (!storage) return;
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (isWorkerTokenCacheKey(key)) visit(String(key));
    }
  } catch (_) {}
};

// Page memory first; a miss reads this tab's saved record once, as after a reload.
export const readTokenCache = (key: string): unknown | null => {
  if (typeof window === 'undefined') return null;
  try {
    const held = tokenMemoryCache.get(key);
    if (held) return JSON.parse(held);
    const saved = readSavedRecord(key);
    if (saved) tokenMemoryCache.set(key, JSON.stringify(saved));
    return saved;
  } catch {
    return null;
  }
};

export const normalizeTokenCacheEntry = (
  entry: unknown,
  {
    workerUrl,
    sessionId,
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
      ok: true;
      token: string;
    }
  | { ok: false; status: string } => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { ok: false, status: 'malformed' };
  }
  const record = entry as TokenCacheEntry;
  // buildTokenCacheEnvelope writes every record, so a record without its
  // scope fields was not issued by this page and is never trusted.
  if (record.v !== 1) return { ok: false, status: 'unsupported-version' };

  const token = toStr(record.token).trim();
  const expiresAt = Number(record.expiresAt || 0);
  if (!token) return { ok: false, status: 'missing-token' };
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    return { ok: false, status: 'missing-expiry' };
  }
  if (expiresAt <= Number(nowSeconds || 0) + Number(skewSeconds || 0)) {
    return { ok: false, status: 'expired' };
  }

  const issuedAt = Number(record.issuedAt || 0) || null;
  const maxTtl = Number(maxTtlSeconds || 0);
  if (issuedAt && Number.isFinite(maxTtl) && maxTtl > 0 && expiresAt > issuedAt + maxTtl) {
    return { ok: false, status: 'ttl-too-long' };
  }
  const expectedWorkerUrl = normalizeWorkerUrl(workerUrl);
  const expectedSlug = normalizeSessionSlug(sessionSlug);
  const expectedSessionId = normalizeWorkerCanonicalSessionIdHex(sessionId);
  const expectedAddress = normalizeAddress(address);
  const entryWorkerUrl = normalizeWorkerUrl(record.workerUrl);
  const entrySlug = normalizeSessionSlug(record.sessionSlug);
  const entrySessionId = normalizeWorkerCanonicalSessionIdHex(record.sessionId);
  const entryAddress = normalizeAddress(record.address);
  if (
    (expectedWorkerUrl && entryWorkerUrl && expectedWorkerUrl !== entryWorkerUrl) ||
    entrySlug !== expectedSlug ||
    (expectedSessionId && entrySessionId !== expectedSessionId) ||
    (expectedAddress && entryAddress && expectedAddress !== entryAddress)
  ) {
    return { ok: false, status: 'scope-mismatch' };
  }

  return { ok: true, token, exp: expiresAt, expiresAt, issuedAt };
};

export const readScopedTokenCache = (
  key: string,
  scope: TokenCacheScope = {},
): ReturnType<typeof normalizeTokenCacheEntry> | null => {
  const parsed = readTokenCache(key);
  const normalized = normalizeTokenCacheEntry(parsed, scope);
  if (normalized.ok) return normalized;
  if (parsed) clearTokenCache(key);
  return null;
};

export const buildTokenCacheEnvelope = ({
  token,
  exp,
  workerUrl,
  sessionId,
  sessionSlug,
  address,
  issuedAt = Math.floor(Date.now() / 1000),
}: TokenCacheEnvelopeInput = {}): {
  address: string;
  expiresAt: number;
  issuedAt: number;
  sessionId: string;
  sessionSlug: string;
  token: string;
  v: 1;
  workerUrl: string;
} => ({
  v: 1,
  workerUrl: normalizeWorkerUrl(workerUrl),
  sessionId: normalizeWorkerCanonicalSessionIdHex(sessionId),
  sessionSlug: normalizeSessionSlug(sessionSlug),
  address: normalizeAddress(address),
  issuedAt: Number(issuedAt || 0) || Math.floor(Date.now() / 1000),
  expiresAt: Number(exp || 0),
  token: toStr(token).trim(),
});

// Sign-ins this page replaced without ending them at their Worker, as after a refused scope. Each still stands
// there until it runs out, and with it any key an agent was given from it, so they are kept to be ended when the
// person signs their agents out. Saved as a sign-in is: in this tab only, and never used after a sign-out or
// account switch.
const REPLACED_KEY = 'ce:workerTokensReplaced:v1';
const MAX_REPLACED = 24;
type HeldToken = { sessionSlug: string; token: string; workerUrl: string };
type ReplacedToken = HeldToken & { expiresAt: number };
let replacedTokens: ReplacedToken[] | null = null;

const unexpiredSignIn = (record: unknown, nowSeconds: number): ReplacedToken | null => {
  const entry = record as TokenCacheEntry | null;
  const token = toStr(entry?.token).trim();
  const workerUrl = normalizeWorkerUrl(entry?.workerUrl);
  const expiresAt = Number(entry?.expiresAt || 0);
  return token && workerUrl && expiresAt > nowSeconds
    ? { workerUrl, sessionSlug: normalizeSessionSlug(entry?.sessionSlug), token, expiresAt }
    : null;
};

const readReplacedTokens = (nowSeconds: number): ReplacedToken[] => {
  if (!replacedTokens) {
    const saved = typeof window === 'undefined' ? null : readSavedRecord(REPLACED_KEY);
    replacedTokens = Array.isArray(saved) ? saved.flatMap((entry) => unexpiredSignIn(entry, 0) || []) : [];
  }
  return replacedTokens.filter((entry) => entry.expiresAt > nowSeconds);
};

const saveReplacedTokens = (list: ReplacedToken[]): void => {
  replacedTokens = list.slice(-MAX_REPLACED);
  try {
    if (!replacedTokens.length) tabStorage()?.removeItem(REPLACED_KEY);
    else if (tabGeneration) {
      tabStorage()?.setItem(REPLACED_KEY, JSON.stringify({ generation: tabGeneration, record: replacedTokens }));
    }
  } catch (_) {}
};

// Before a held sign-in is dropped or written over: if it still stands, it is remembered as replaced.
const setAsideSignIn = (key: string, keptToken = ''): void => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const entry = unexpiredSignIn(readTokenCache(key), nowSeconds);
  if (!entry || entry.token === keptToken) return;
  const list = readReplacedTokens(nowSeconds);
  if (!list.some((known) => known.token === entry.token)) saveReplacedTokens([...list, entry]);
};

/** Sign-ins this page replaced that may still stand at their Workers. */
export const listReplacedTokens = (nowSeconds = Math.floor(Date.now() / 1000)): HeldToken[] =>
  readReplacedTokens(nowSeconds).map(({ workerUrl, sessionSlug, token }) => ({ workerUrl, sessionSlug, token }));

export const writeTokenCache = (key: string, payload: unknown): void => {
  if (typeof window === 'undefined') return;
  setAsideSignIn(key, toStr((payload as TokenCacheEntry | null)?.token).trim());
  try {
    window.localStorage.removeItem(key);
  } catch (_) {}
  try {
    const serialized = JSON.stringify(payload);
    if (typeof serialized !== 'string') return;
    tokenMemoryCache.set(key, serialized);
    // Until the page knows who is signed in, a sign-in stays in page memory.
    if (tabGeneration) tabStorage()?.setItem(key, JSON.stringify({ generation: tabGeneration, record: payload }));
  } catch (_) {}
};

const dropTokenCache = (key: string): void => {
  tokenMemoryCache.delete(key);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch (_) {}
  try {
    tabStorage()?.removeItem(key);
  } catch (_) {}
};

export const clearTokenCache = (key: string): void => {
  if (typeof window !== 'undefined') setAsideSignIn(key);
  dropTokenCache(key);
};

export const clearAllTokenCaches = (): void => {
  tokenMemoryCache.clear();
  purgePersistedTokenCache();
  forEachTabTokenKey((key) => tabStorage()?.removeItem(key));
  saveReplacedTokens([]);
};

/** This page's unexpired sign-ins, so a sign-out can end each one at its Worker. */
export const listHeldTokens = (
  nowSeconds = Math.floor(Date.now() / 1000),
): Array<{ sessionSlug: string; token: string; workerUrl: string }> => {
  const keys = new Set(tokenMemoryCache.keys());
  forEachTabTokenKey((key) => keys.add(key));
  const held: Array<{ sessionSlug: string; token: string; workerUrl: string }> = [];
  keys.forEach((key) => {
    const record = readTokenCache(key) as TokenCacheEntry | null;
    const token = toStr(record?.token).trim();
    const workerUrl = normalizeWorkerUrl(record?.workerUrl);
    if (token && workerUrl && Number(record?.expiresAt || 0) > nowSeconds) {
      held.push({ workerUrl, sessionSlug: normalizeSessionSlug(record?.sessionSlug), token });
    }
  });
  return held;
};

/** Forgets one sign-in, held or replaced, as when it was ended at its Worker: the page then signs in afresh. */
export const forgetHeldToken = (token: unknown): void => {
  const ended = toStr(token).trim();
  if (!ended) return;
  const keys = new Set(tokenMemoryCache.keys());
  forEachTabTokenKey((key) => keys.add(key));
  keys.forEach((key) => {
    if (toStr((readTokenCache(key) as TokenCacheEntry | null)?.token).trim() === ended) dropTokenCache(key);
  });
  const replaced = readReplacedTokens(0);
  if (replaced.some((entry) => entry.token === ended)) {
    saveReplacedTokens(replaced.filter((entry) => entry.token !== ended));
  }
};

/** The page has learned who is signed in, as after a reload: this tab's saved sign-ins for them still count. */
export const adoptTokenCaches = (address: unknown): void => {
  if (typeof window === 'undefined') return;
  tabGeneration = currentGeneration() || startGeneration();
  const suffix = `:${normalizeAddress(address)}`;
  forEachTabTokenKey((key) => {
    if (!key.endsWith(suffix) || !readSavedRecord(key)) tabStorage()?.removeItem(key);
  });
};

/** A sign-out or account switch ends every sign-in, and other tabs' saved ones once they reload. */
export const resetTokenCaches = (nextAddress: unknown): void => {
  clearAllTokenCaches();
  if (typeof window === 'undefined') return;
  const generation = startGeneration();
  tabGeneration = normalizeAddress(nextAddress) ? generation : '';
};

export const buildTokenCacheKey = ({
  workerUrl,
  slug,
  sessionId,
  address,
}: {
  address?: unknown;
  sessionId?: unknown;
  slug?: unknown;
  workerUrl?: unknown;
} = {}): string => {
  const resolvedUrl = normalizeWorkerUrl(workerUrl);
  const normalizedSlug = normalizeSessionSlug(slug);
  const normalizedSessionId = normalizeWorkerCanonicalSessionIdHex(sessionId);
  const normalizedAddress = normalizeAddress(address);
  const identityScope = normalizedSessionId ? `:${normalizedSessionId}` : '';
  if (normalizedAddress) {
    return `${STORAGE_PREFIX}:${resolvedUrl}:${normalizedSlug}${identityScope}:${normalizedAddress}`;
  }
  return `${STORAGE_PREFIX}:${resolvedUrl}:${normalizedSlug}${identityScope}`;
};

/** This tab's unexpired sign-in for a session, or '' without one. */
export const heldSessionToken = (workerUrl: unknown, sessionSlug: unknown): string => {
  const origin = normalizeWorkerUrl(workerUrl);
  const slug = normalizeSessionSlug(sessionSlug);
  if (!origin || !slug) return '';
  return listHeldTokens().find((held) => held.workerUrl === origin && held.sessionSlug === slug)?.token || '';
};
