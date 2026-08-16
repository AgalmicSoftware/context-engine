/**
 * @file workerAuth.ts
 * @module workerAuth
 * @description SIWE authentication flows and worker token management.
 *              Builds SIWE login messages, signs admin EIP-712 actions, obtains scoped JWT tokens from the CORS worker,
 *              and provides authenticated fetch.
 *
 * Key exports: buildSiweMessage, buildSignedBootstrapAdminAuth, buildSignedAdminActionAuth,
 *              getWorkerSessionToken, fetchWorkerWithAuth, clearAllWorkerSessionTokens,
 *              getWorkerAuthHeaders
 */
import { ethers } from 'ethers';
import store from '../../store.js';
import { getCorsProxyUrlOrThrow } from './corsProxy.js';
import { cryptoUtils } from '../crypto/cryptography.js';
import { normalizeSessionSlug } from '../session/sessionNaming.js';
import { toStr } from '../shared/primitives.js';
import { createLogger } from '../logging.js';
import { normalizeAddress } from '../web3/addressNormalization.js';
import { normalizeWorkerUrl } from './workerUrl.js';
import {
  defaultWorkerAuthAllowDemoFallback,
  resolveWorkerAllowDemoFallback,
  resolveWorkerSessionContext,
} from './workerSessionResolution.js';
import {
  buildTokenCacheEnvelope,
  buildTokenCacheKey,
  clearAllTokenCaches,
  clearTokenCache,
  normalizeTokenCacheEntry,
  readScopedTokenCache,
  writeTokenCache,
} from './workerAuthTokenCache.js';
import {
  buildAnonymousHeaders,
  buildWorkerAuthNonceHeaders,
  isStreamBody,
  mergeHeaders,
  shouldRetryAnonymousWithoutRateId,
  stripAnonymousRateIdHeader,
} from './workerAuthAnonymousHeaders.js';
import {
  readRequestApiKey,
  shouldFallbackToAuthenticatedFlow,
  shouldRetryAuthenticatedResponse,
} from './workerAuthFallbackPolicy.js';
import { fetchWorkerAuthEndpoint, resolveAdminActionAudience } from './workerAuthReachability.js';
import { ADMIN_ACTION_TYPES, buildAdminActionBodyHash, buildAdminActionTypedData } from './adminTypedData.mjs';
import {
  assertWorkerAuthResponseIdentity,
  bindWorkerAuthRequestIdentity,
  resolveAdminActionSessionId,
  resolveWorkerAuthSessionId,
  shouldBootstrapWorkerCanonicalIdentity,
  type WorkerLoginResponse,
} from './workerAuthSessionIdentity.js';
import {
  createWorkerAuthRemoteError,
  NONCE_MISMATCH_ERROR,
  ONCHAIN_GATE_UNAVAILABLE_ERROR,
} from './workerAuthRemoteError.js';
import type {
  ResolveWorkerTokenRequestContextOptions,
  WorkerFetchAuthOptions,
} from './workerAuthRequestTypes.js';

const accountLog = createLogger('account');

const LOGIN_GATE_UNAVAILABLE_RETRIES = 2;
const LOGIN_GATE_UNAVAILABLE_RETRY_BASE_MS = 700;
const ADMIN_ACTION_EXPIRATION_WINDOW_SECONDS = 5 * 60;
export { normalizeWorkerUrl };

type UnknownRecord = Record<string, unknown>;
type CryptoProviderLike = Parameters<typeof cryptoUtils._getProvider>[0];
type WorkerAuthContext = {
  account?: unknown;
  chainId?: unknown;
  provider?: unknown;
  providerLike?: unknown;
};
type WorkerProvider = ethers.providers.ExternalProvider & {
  address?: unknown;
  request?: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
  selectedAddress?: unknown;
};
type WorkerAuthStoreState = {
  profile?: {
    account?: unknown;
    network?: {
      chainId?: unknown;
      id?: unknown;
    };
    provider?: unknown;
  };
};
type SleepOptions = {
  requestAddress?: unknown;
  requestAuthEpoch?: number;
  signal?: AbortSignal | null;
};
type BuildSiweMessageOptions = {
  address?: unknown;
  chainId?: unknown;
  domain?: unknown;
  expirationTime?: string;
  issuedAt?: string;
  nonce?: unknown;
  statement?: unknown;
  uri?: unknown;
};
type AdminActionAuthOptions = {
  action?: unknown;
  body?: unknown;
  context?: unknown;
  nonce?: unknown;
  sessionId?: unknown;
  sessionAuthorityMode?: unknown;
  slug?: unknown;
  workerUrl?: unknown;
};
type BootstrapAdminAuthOptions = {
  context?: unknown;
  nonce?: unknown;
  slug?: unknown;
  statement?: string;
  workerUrl?: unknown;
};
type WorkerSessionTokenOptions = ResolveWorkerTokenRequestContextOptions & {
  requestContext?: WorkerTokenRequestContext;
};
type InFlightTokenRequest = {
  abortController: {
    abort: () => void;
    signal: AbortSignal | null;
  };
  promise: Promise<string> | null;
};
const asStoreState = (value: unknown): WorkerAuthStoreState =>
  value && typeof value === 'object' ? (value as WorkerAuthStoreState) : {};
const asWorkerAuthContext = (value: unknown): WorkerAuthContext =>
  value && typeof value === 'object' ? (value as WorkerAuthContext) : {};
const getWorkerProvider = (providerLike: unknown): WorkerProvider =>
  cryptoUtils._getProvider((providerLike || resolveDefaultProviderLike()) as CryptoProviderLike) as WorkerProvider;
const getErrorMessage = (error: unknown): string =>
  toStr(error && typeof error === 'object' ? (error as { message?: unknown }).message : '');

const shouldAllowDemoSessionFallback = (allowDemoFallback?: boolean): boolean =>
  resolveWorkerAllowDemoFallback({
    allowDemoFallback,
    getDefaultAllowDemoFallback: defaultWorkerAuthAllowDemoFallback,
  });
const resolveDefaultProviderLike = () => {
  try {
    const state = asStoreState(store?.getState?.());
    const fromStore = toStr(state?.profile?.provider || '').trim();
    if (fromStore) return fromStore;
  } catch (_) {}
  if (typeof window !== 'undefined') {
    if (window.__passkeyEoaProvider && window.__passkeyEoaProvider.isPasskeyEoa) return 'passkey_eoa';
    if (window.ethereum) return 'wagmi';
    if (window.web3authProvider) return 'web3auth';
  }
  // Default to the embedded passkey EOA because passkey auth is the primary wallet path.
  return 'passkey_eoa';
};
const getWalletContext = (overrideIn: unknown = {}) => {
  const override = asWorkerAuthContext(overrideIn);
  const overrideProviderLikeRaw = override.providerLike || override.provider || '';
  // Regression guard: ethers Web3Provider objects carry the passkey EIP-1193
  // provider. Stringifying them loses that provider in passkey-only builds.
  const overrideProviderLike =
    typeof overrideProviderLikeRaw === 'string' ? overrideProviderLikeRaw.trim() : overrideProviderLikeRaw;
  try {
    const state = asStoreState(store?.getState?.());
    const profile = state?.profile || {};
    const network = profile?.network || {};
    const storeProviderLike = toStr(profile.provider || '').trim();
    return {
      account: override.account || profile.account || '',
      providerLike: overrideProviderLike || storeProviderLike || resolveDefaultProviderLike(),
      chainId: override.chainId || network.id || network.chainId || null,
    };
  } catch {
    return {
      account: override.account || '',
      providerLike: overrideProviderLike || resolveDefaultProviderLike(),
      chainId: override.chainId || null,
    };
  }
};

const inFlightTokenRequests = new Map<string, InFlightTokenRequest>();
let workerAuthEpoch = 0;
const getCurrentWorkerAuthStoreAddress = () => {
  try {
    return normalizeAddress(store?.getState?.()?.profile?.account);
  } catch (_) {
    return '';
  }
};

const doesWorkerAuthAddressMatchStore = (address: unknown): boolean => {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) return false;
  return normalizedAddress === getCurrentWorkerAuthStoreAddress();
};

let trackedWorkerAuthAddress = getCurrentWorkerAuthStoreAddress();

const isNonceMismatchError = (message) => toStr(message).toLowerCase().includes(NONCE_MISMATCH_ERROR);

const isOnChainGateUnavailableError = (message) =>
  toStr(message).toLowerCase().includes(ONCHAIN_GATE_UNAVAILABLE_ERROR);

const createAbortError = (message = 'Worker auth request aborted.') => {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
};

const isAbortError = (error) => toStr(error?.name) === 'AbortError';

const abortInFlightTokenRequests = () => {
  inFlightTokenRequests.forEach((request) => {
    try {
      request?.abortController?.abort();
    } catch (_) {}
  });
  inFlightTokenRequests.clear();
};

const invalidateWorkerAuthState = ({ nextAddress = '' } = {}) => {
  workerAuthEpoch += 1;
  abortInFlightTokenRequests();
  clearAllTokenCaches();
  trackedWorkerAuthAddress = normalizeAddress(nextAddress);
  return workerAuthEpoch;
};

const syncWorkerAuthAddress = (address: unknown): number => {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) return workerAuthEpoch;
  // The Redux store is the active-account source of truth. Stale request
  // context must not be able to re-adopt a logged-out or switched account.
  if (!doesWorkerAuthAddressMatchStore(normalizedAddress)) {
    return workerAuthEpoch;
  }
  if (trackedWorkerAuthAddress && trackedWorkerAuthAddress !== normalizedAddress) {
    return invalidateWorkerAuthState({ nextAddress: normalizedAddress });
  }
  trackedWorkerAuthAddress = normalizedAddress;
  return workerAuthEpoch;
};

const assertWorkerAuthRequestCurrent = (
  signal: AbortSignal | null,
  requestAuthEpoch: number | undefined,
  requestAddress: unknown = '',
): void => {
  if (signal?.aborted) {
    throw createAbortError();
  }
  if (requestAuthEpoch !== workerAuthEpoch) {
    throw createAbortError('Worker auth request invalidated.');
  }
  const normalizedRequestAddress = normalizeAddress(requestAddress);
  if (normalizedRequestAddress && !doesWorkerAuthAddressMatchStore(normalizedRequestAddress)) {
    throw createAbortError('Worker auth request no longer matches the active account.');
  }
};

const sleep = (ms, { signal, requestAuthEpoch, requestAddress } = {}) =>
  new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timerId);
      if (signal && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onAbort);
      }
      reject(createAbortError());
    };
    const finish = (cb) => {
      clearTimeout(timerId);
      if (signal && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onAbort);
      }
      cb();
    };
    let timerId = null;
    try {
      assertWorkerAuthRequestCurrent(signal, requestAuthEpoch, requestAddress);
    } catch (error) {
      reject(error);
      return;
    }
    if (signal && typeof signal.addEventListener === 'function') {
      signal.addEventListener('abort', onAbort, { once: true });
    }
    timerId = setTimeout(() => {
      finish(() => {
        try {
          assertWorkerAuthRequestCurrent(signal, requestAuthEpoch, requestAddress);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }, ms);
  });

const resolveSignerAddress = async (providerLike, fallbackAddress = '') => {
  const provider = cryptoUtils._getProvider(providerLike || resolveDefaultProviderLike());
  let address = normalizeAddress(fallbackAddress) || normalizeAddress(provider?.selectedAddress || provider?.address);
  if (provider && typeof provider.request === 'function') {
    try {
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (Array.isArray(accounts) && accounts[0]) {
        address = normalizeAddress(accounts[0]);
      }
    } catch (_) {}
  }
  return { provider, address };
};

const readTokenCache = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};

const normalizeTokenCacheEntry = (
  entry,
  {
    workerUrl,
    sessionSlug,
    address,
    nowSeconds = Math.floor(Date.now() / 1000),
    skewSeconds = TOKEN_SKEW_SECONDS,
    maxTtlSeconds = MAX_TOKEN_CACHE_TTL_SECONDS,
  } = {},
) => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return { ok: false, status: 'malformed' };
  }

  const token = toStr(entry.token).trim();
  const expiresAt = Number(entry.expiresAt || entry.exp || 0);
  if (!token) return { ok: false, status: 'missing-token' };
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
    return { ok: false, status: 'missing-expiry' };
  }
  if (expiresAt <= Number(nowSeconds || 0) + Number(skewSeconds || 0)) {
    return { ok: false, status: 'expired' };
  }

  if (Number(entry.v || 0) >= 1) {
    const issuedAt = Number(entry.issuedAt || 0) || null;
    const maxTtl = Number(maxTtlSeconds || 0);
    if (issuedAt && Number.isFinite(maxTtl) && maxTtl > 0 && expiresAt > issuedAt + maxTtl) {
      return { ok: false, status: 'ttl-too-long' };
    }
    const expectedWorkerUrl = normalizeWorkerUrl(workerUrl);
    const expectedSlug = normalizeSessionSlug(sessionSlug);
    const expectedAddress = normalizeAddress(address);
    const entryWorkerUrl = normalizeWorkerUrl(entry.workerUrl);
    const entrySlug = normalizeSessionSlug(entry.sessionSlug);
    const entryAddress = normalizeAddress(entry.address);
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
    issuedAt: Number(entry.issuedAt || 0) || null,
    legacy: Number(entry.v || 0) < 1,
  };
};

const readScopedTokenCache = (key, scope = {}) => {
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

const buildTokenCacheEnvelope = ({
  token,
  exp,
  workerUrl,
  sessionSlug,
  address,
  issuedAt = Math.floor(Date.now() / 1000),
} = {}) => ({
  v: 1,
  workerUrl: normalizeWorkerUrl(workerUrl),
  sessionSlug: normalizeSessionSlug(sessionSlug),
  address: normalizeAddress(address),
  issuedAt: Number(issuedAt || 0) || Math.floor(Date.now() / 1000),
  expiresAt: Number(exp || 0),
  token: toStr(token).trim(),
});

const writeTokenCache = (key, payload) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (_) {}
};

const clearTokenCache = (key) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (_) {}
};

const buildTokenCacheKey = ({ workerUrl, slug, address }) => {
  const resolvedUrl = normalizeWorkerUrl(workerUrl);
  const normalizedSlug = normalizeSessionSlug(slug);
  const normalizedAddress = normalizeAddress(address);
  if (normalizedAddress) {
    return `${STORAGE_PREFIX}:${resolvedUrl}:${normalizedSlug}:${normalizedAddress}`;
  }
  return `${STORAGE_PREFIX}:${resolvedUrl}:${normalizedSlug}`;
};

const resolveWorkerTokenRequestContext = async ({
  sessionSlug,
  sessionConfig,
  context,
  workerUrl,
  allowDemoFallback,
  resolveWorkerUrl = false,
  resolvedAddress,
}: ResolveWorkerTokenRequestContextOptions = {}) => {
  const allowDemoFallbackResolved = shouldAllowDemoSessionFallback(allowDemoFallback);
  const resolvedSession = resolveWorkerSessionContext({
    sessionSlug,
    sessionConfig,
    allowDemoFallback: allowDemoFallbackResolved,
    getDefaultAllowDemoFallback: defaultWorkerAuthAllowDemoFallback,
  });
  const slug = resolvedSession.sessionSlug;
  const sessionId = resolveWorkerAuthSessionId(resolvedSession.sessionConfig);
  const wallet = getWalletContext(context || {});
  const resolvedSigner = normalizeAddress(resolvedAddress)
    ? null
    : await resolveSignerAddress(wallet.providerLike, wallet.account);
  const address = normalizeAddress(resolvedAddress || resolvedSigner?.address);
  const authEpoch = syncWorkerAuthAddress(address);
  assertWorkerAuthRequestCurrent(null, authEpoch, address);
  const resolvedWorkerUrl = normalizeWorkerUrl(
    workerUrl ||
      (resolveWorkerUrl
        ? await getCorsProxyUrlOrThrow({
            sessionSlug: slug,
            sessionConfig: resolvedSession.sessionConfig,
            context,
            allowDemoFallback: allowDemoFallbackResolved,
          })
        : ''),
  );
  return {
    allowDemoFallbackResolved,
    resolvedSession,
    slug,
    wallet,
    resolvedSigner,
    address,
    resolvedWorkerUrl,
    sessionId,
    storageKey: resolvedWorkerUrl ? buildTokenCacheKey({ workerUrl: resolvedWorkerUrl, slug, sessionId, address }) : '',
    authEpoch,
  };
};

type WorkerTokenRequestContext = Awaited<ReturnType<typeof resolveWorkerTokenRequestContext>>;

try {
  if (typeof store?.subscribe === 'function') {
    store.subscribe(() => {
      let nextAddress = '';
      try {
        nextAddress = normalizeAddress(store?.getState?.()?.profile?.account);
      } catch (_) {
        nextAddress = '';
      }
      if (nextAddress === trackedWorkerAuthAddress) return;
      invalidateWorkerAuthState({ nextAddress });
    });
  }
} catch (_) {}

export const buildSiweMessage = ({
  address,
  nonce,
  chainId,
  domain,
  uri,
  statement,
  issuedAt,
  expirationTime,
}: BuildSiweMessageOptions = {}) => {
  const addr = toStr(address).trim();
  const host = toStr(domain || (typeof window !== 'undefined' ? window.location.host : '')).trim();
  const origin = toStr(uri || (typeof window !== 'undefined' ? window.location.origin : '')).trim();
  const chain = Number(chainId || 1);
  const issued = issuedAt || new Date().toISOString();
  const exp = expirationTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const note = statement || 'Sign in to Context Engine.';

  return `${host} wants you to sign in with your Ethereum account:\n${addr}\n\n${note}\n\nURI: ${origin}\nVersion: 1\nChain ID: ${chain}\nNonce: ${nonce}\nIssued At: ${issued}\nExpiration Time: ${exp}`;
};

const signMessage = async ({
  message,
  providerLike,
  address,
}: {
  address?: string;
  message: string;
  providerLike?: unknown;
}) => {
  const provider = getWorkerProvider(providerLike);
  const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
  const signer = address ? ethersProvider.getSigner(address) : ethersProvider.getSigner();
  return signer.signMessage(message);
};

const normalizeOrigin = (value) => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if ((parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && !parsed.port) {
      return DEFAULT_LOCAL_ADMIN_ORIGIN;
    }
    return parsed.origin;
  } catch {
    return '';
  }
};

const WORKER_AUTH_FETCH_ERROR_PATTERNS = [
  'failed to fetch',
  'network request failed',
  'networkerror',
  'load failed',
  'fetch failed',
];

const isWorkerAuthFetchReachabilityError = (error) => {
  const message = toStr(error?.message || error)
    .trim()
    .toLowerCase();
  if (!message || message.includes('failed to reach worker auth endpoint')) return false;
  return WORKER_AUTH_FETCH_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

const buildWorkerAuthReachabilityMessage = (endpoint) => {
  const normalizedEndpoint = toStr(endpoint).trim();
  const browserOrigin = (() => {
    try {
      if (typeof window !== 'undefined') return normalizeOrigin(window.location?.origin);
    } catch (_) {}
    return '';
  })();
  const allowOriginsHint = browserOrigin ? ` Check worker URL and allowOrigins includes ${browserOrigin}.` : '';
  return `Failed to reach worker auth endpoint (${normalizedEndpoint}).${allowOriginsHint}`;
};

const normalizeWorkerAuthFetchError = (error, endpoint) => {
  if (!isWorkerAuthFetchReachabilityError(error)) return error;
  const normalized = new Error(buildWorkerAuthReachabilityMessage(endpoint));
  try {
    normalized.cause = error;
  } catch (_) {}
  return normalized;
};

const fetchWorkerAuthEndpoint = async (endpoint, init) => {
  try {
    return await fetch(endpoint, init);
  } catch (error) {
    throw normalizeWorkerAuthFetchError(error, endpoint);
  }
};

const resolveAdminActionAudience = (workerUrl) => {
  const browserOrigin = (() => {
    try {
      if (typeof window !== 'undefined') return normalizeOrigin(window.location?.origin);
    } catch (_) {}
    return '';
  })();
  if (browserOrigin) return browserOrigin;
  return normalizeOrigin(normalizeWorkerUrl(workerUrl));
};

const signTypedDataV4 = async ({ typedData, provider, address }) => {
  if (!provider || typeof provider.request !== 'function') {
    throw new Error('Wallet provider does not support typed-data signing.');
  }
  return provider.request({
    method: 'eth_signTypedData_v4',
    params: [address, JSON.stringify(typedData)],
  });
};

export const buildSignedAdminActionAuth = async ({
  action,
  slug,
  body,
  workerUrl,
  context,
  nonce: providedNonce,
  sessionId: providedSessionId,
  sessionAuthorityMode,
}: AdminActionAuthOptions = {}) => {
  const actionName = toStr(action).trim().toLowerCase();
  if (!actionName) throw new Error('Admin action is required.');

  const resolvedWorkerUrl = normalizeWorkerUrl(workerUrl);
  if (!resolvedWorkerUrl) throw new Error('Worker URL is missing.');

  const wallet = getWalletContext(context || {});
  const resolvedSigner = await resolveSignerAddress(wallet.providerLike, wallet.account);
  const address = normalizeAddress(resolvedSigner.address);
  if (!address) {
    throw new Error('Connect a wallet to sign admin requests.');
  }

  const targetSlug = normalizeSessionSlug(slug);
  const actionBody = body && typeof body === 'object' ? (body as UnknownRecord) : {};
  const exactSessionId = resolveAdminActionSessionId({
    body: actionBody,
    providedSessionId,
    sessionAuthorityMode,
  });
  const bootstrapWorkerCanonicalIdentity =
    !!exactSessionId && shouldBootstrapWorkerCanonicalIdentity({ action: actionName, body: actionBody });
  const audience = resolveAdminActionAudience(resolvedWorkerUrl);
  if (!audience) {
    throw new Error('Unable to resolve admin audience.');
  }

  // An externally supplied slug-scoped nonce cannot prove which same-slug
  // Worker identity issued it. Exact Worker actions always obtain a fresh
  // nonce bound to the canonical session ID.
  let nonce = exactSessionId ? '' : toStr(providedNonce).trim();
  if (!nonce) {
    const nonceEndpoint = `${resolvedWorkerUrl}/auth/nonce`;
    const nonceResp = await fetchWorkerAuthEndpoint(nonceEndpoint, {
      method: 'POST',
      headers: buildWorkerAuthNonceHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        address,
        sessionSlug: targetSlug,
        ...(exactSessionId ? { sessionId: exactSessionId } : {}),
        adminAction: true,
        ...(bootstrapWorkerCanonicalIdentity ? { bootstrapWorkerCanonicalIdentity: true } : {}),
      }),
    });
    const nonceData = await nonceResp.json().catch(() => ({}));
    if (!nonceResp.ok) {
      if (Number(nonceResp.status || 0) === 404) {
        throw new Error('Worker auth nonce route not supported (404).');
      }
      throw createWorkerAuthRemoteError({ kind: 'admin_nonce', payload: nonceData, status: nonceResp.status });
    }
    if (!nonceData?.nonce) {
      throw new Error('Worker nonce response missing nonce.');
    }
    assertWorkerAuthResponseIdentity(nonceData, {
      expectedSessionId: exactSessionId,
      expectedSessionSlug: targetSlug,
      kind: 'admin_nonce',
    });
    nonce = toStr(nonceData.nonce).trim();
  }

  const expiration = Math.floor(Date.now() / 1000) + ADMIN_ACTION_EXPIRATION_WINDOW_SECONDS;
  const bodyHash = buildAdminActionBodyHash(actionBody);
  const typedData = buildAdminActionTypedData({
    action: actionName,
    slug: targetSlug,
    bodyHash,
    nonce,
    audience,
    expiration,
  });
  const signature = await signTypedDataV4({
    typedData,
    provider: resolvedSigner.provider,
    address,
  });

  let recovered = '';
  try {
    recovered = ethers.utils.verifyTypedData(typedData.domain, ADMIN_ACTION_TYPES, typedData.message, signature);
  } catch (_) {
    recovered = '';
  }
  if (!recovered || normalizeAddress(recovered) !== address) {
    throw new Error(
      `Typed data signature does not match signer address${recovered ? ` (recovered ${recovered})` : ''}. Reconnect wallet and try again.`,
    );
  }

  return {
    address,
    signature,
    action: actionName,
    slug: targetSlug,
    bodyHash,
    nonce,
    audience,
    expiration,
  };
};

export const buildSignedBootstrapAdminAuth = async ({
  slug,
  workerUrl,
  context,
  statement = 'Admin request: bootstrap arweave upload',
  nonce: providedNonce,
}: BootstrapAdminAuthOptions = {}) => {
  const resolvedWorkerUrl = normalizeWorkerUrl(workerUrl);
  if (!resolvedWorkerUrl) throw new Error('Worker URL is missing.');

  const wallet = getWalletContext(context || {});
  const resolvedSigner = await resolveSignerAddress(wallet.providerLike, wallet.account);
  const address = normalizeAddress(resolvedSigner.address);
  if (!address) {
    throw new Error('Connect a wallet to sign admin requests.');
  }

  const targetSlug = normalizeSessionSlug(slug);
  let nonce = toStr(providedNonce).trim();
  if (!nonce) {
    const nonceEndpoint = `${resolvedWorkerUrl}/auth/nonce`;
    const nonceResp = await fetchWorkerAuthEndpoint(nonceEndpoint, {
      method: 'POST',
      headers: buildWorkerAuthNonceHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ address, sessionSlug: targetSlug, adminAction: true }),
    });
    const nonceData = await nonceResp.json().catch(() => ({}));
    if (!nonceResp.ok) {
      if (Number(nonceResp.status || 0) === 404) {
        throw new Error('Worker auth nonce route not supported (404).');
      }
      throw createWorkerAuthRemoteError({ kind: 'admin_nonce', payload: nonceData, status: nonceResp.status });
    }
    if (!nonceData?.nonce) {
      throw new Error('Worker nonce response missing nonce.');
    }
    nonce = toStr(nonceData.nonce).trim();
  }

  const message = buildSiweMessage({
    address,
    nonce,
    chainId: wallet.chainId || 1,
    statement: toStr(statement).trim() || 'Admin request: bootstrap arweave upload',
  });
  const signature = await signMessage({
    message,
    providerLike: wallet.providerLike,
    address,
  });

  return {
    address,
    message,
    signature,
    sessionSlug: targetSlug,
  };
};

export const getWorkerSessionToken = async ({
  sessionSlug,
  sessionConfig,
  context,
  workerUrl,
  allowDemoFallback,
  requestContext,
} = {}) => {
  const resolvedRequest =
    requestContext ||
    (await resolveWorkerTokenRequestContext({
      sessionSlug,
      sessionConfig,
      context,
      workerUrl,
      allowDemoFallback,
      resolveWorkerUrl: true,
    }));
  const {
    slug,
    wallet,
    resolvedSigner,
    address,
    resolvedWorkerUrl,
    sessionId,
    storageKey,
    authEpoch: requestAuthEpoch,
  } = resolvedRequest;
  if (!address) {
    throw new Error('Connect a wallet to authenticate with the worker.');
  }

  assertWorkerAuthRequestCurrent(null, requestAuthEpoch, address);
  if (typeof window !== 'undefined') {
    accountLog.log('[workerAuth] resolved worker URL', { slug, resolvedWorkerUrl });
  }
  const cached = readScopedTokenCache(storageKey, {
    workerUrl: resolvedWorkerUrl,
    sessionId,
    sessionSlug: slug,
    address,
  });
  if (cached?.ok && cached.token) {
    return cached.token;
  }

  const existingRequest = inFlightTokenRequests.get(storageKey);
  if (existingRequest?.promise) {
    return existingRequest.promise;
  }

  const abortController =
    typeof AbortController === 'function' ? new AbortController() : { abort: () => {}, signal: null };
  const requestToken = async () => {
    const signal = abortController.signal;
    const chainId = wallet.chainId || 1;
    const providerLike = resolvedSigner?.provider || wallet.providerLike;

    const performLogin = async () => {
      assertWorkerAuthRequestCurrent(signal, requestAuthEpoch, address);
      const nonceResp = await fetch(`${resolvedWorkerUrl}/auth/nonce`, {
        method: 'POST',
        headers: buildWorkerAuthNonceHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(bindWorkerAuthRequestIdentity({ address, sessionSlug: slug }, sessionId)),
        signal: signal || undefined,
      });
      const nonceData = await nonceResp.json().catch(() => ({}));
      if (!nonceResp.ok) {
        if (Number(nonceResp.status || 0) === 404) {
          throw new Error('Worker auth nonce route not supported (404).');
        }
        throw createWorkerAuthRemoteError({ kind: 'worker_nonce', payload: nonceData, status: nonceResp.status });
      }
      if (!nonceData?.nonce) {
        throw new Error('Worker nonce response missing nonce.');
      }
      assertWorkerAuthResponseIdentity(nonceData, {
        expectedSessionId: sessionId,
        expectedSessionSlug: slug,
        kind: 'nonce',
      });

      assertWorkerAuthRequestCurrent(signal, requestAuthEpoch, address);
      const message = buildSiweMessage({
        address,
        nonce: nonceData.nonce,
        chainId,
        statement: 'Sign in to Context Engine.',
      });
      const signature = await signMessage({
        message,
        providerLike,
        address,
      });

      assertWorkerAuthRequestCurrent(signal, requestAuthEpoch, address);
      const loginResp = await fetch(`${resolvedWorkerUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          bindWorkerAuthRequestIdentity({ address, message, signature, sessionSlug: slug }, sessionId),
        ),
        signal: signal || undefined,
      });
      const loginData: WorkerLoginResponse = await loginResp.json().catch(() => ({}));
      if (!loginResp.ok) {
        if (Number(loginResp.status || 0) === 404) {
          throw new Error('Worker auth login route not supported (404).');
        }
        throw createWorkerAuthRemoteError({ kind: 'worker_login', payload: loginData, status: loginResp.status });
      }
      if (!loginData?.token) {
        throw new Error('Worker login did not return a token.');
      }
      assertWorkerAuthResponseIdentity(loginData, {
        expectedSessionId: sessionId,
        expectedSessionSlug: slug,
        kind: 'login',
      });
      return loginData;
    };

    let loginData = null;
    let retriedNonceMismatch = false;
    for (let attempt = 0; attempt <= LOGIN_GATE_UNAVAILABLE_RETRIES; attempt += 1) {
      try {
        loginData = await performLogin();
        break;
      } catch (err) {
        if (isAbortError(err)) throw err;
        if (isNonceMismatchError(getErrorMessage(err)) && !retriedNonceMismatch) {
          // A concurrent auth flow may have rotated nonce for this address.
          // Retry once with a fresh nonce to recover without user intervention.
          retriedNonceMismatch = true;
          continue;
        }
        const canRetryGateUnavailable =
          isOnChainGateUnavailableError(err?.message) && attempt < LOGIN_GATE_UNAVAILABLE_RETRIES;
        if (!canRetryGateUnavailable) throw err;
        const retryInMs = LOGIN_GATE_UNAVAILABLE_RETRY_BASE_MS * (attempt + 1);
        accountLog.warn('[workerAuth] transient gate-read failure during login; retrying', {
          slug,
          workerUrl: resolvedWorkerUrl,
          attempt: attempt + 1,
          retryInMs,
        });
        await sleep(retryInMs, { signal, requestAuthEpoch, requestAddress: address });
      }
    }
    if (!loginData?.token) {
      throw new Error('Worker login did not return a token.');
    }

    // Regression guard: keep the cache write gated by the same auth epoch that
    // started this request; otherwise logout/account-switch can resurrect auth.
    assertWorkerAuthRequestCurrent(signal, requestAuthEpoch, address);
    writeTokenCache(
      storageKey,
      buildTokenCacheEnvelope({
        token: loginData.token,
        exp: Number(loginData.exp || 0),
        workerUrl: resolvedWorkerUrl,
        sessionId,
        sessionSlug: slug,
        address,
      }),
    );

    return loginData.token;
  };

  const inFlightRequest = { abortController, promise: null };
  const inFlight = requestToken().finally(() => {
    if (inFlightTokenRequests.get(storageKey) === inFlightRequest) {
      inFlightTokenRequests.delete(storageKey);
    }
  });
  inFlightRequest.promise = inFlight;
  inFlightTokenRequests.set(storageKey, inFlightRequest);
  return inFlight;
};

export const clearWorkerSessionToken = ({
  requestContext,
  sessionSlug,
  sessionConfig,
  context,
  workerUrl,
  allowDemoFallback,
}: WorkerSessionTokenOptions = {}) => {
  const clearToken = async () => {
    const resolvedRequest =
      requestContext ||
      (await resolveWorkerTokenRequestContext({
        sessionSlug,
        sessionConfig,
        context,
        workerUrl,
        allowDemoFallback,
        resolveWorkerUrl: false,
      }));
    const storageKey = toStr(resolvedRequest?.storageKey).trim();
    if (!storageKey) return;
    clearTokenCache(storageKey);
  };
  return clearToken();
};

export const clearAllWorkerSessionTokens = () => {
  invalidateWorkerAuthState({ nextAddress: '' });
};

const buildWorkerAuthHeadersForToken = ({ token, slug }: { slug?: unknown; token?: unknown } = {}) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (slug) {
    // NOTE: Some deployed workers (ex: older "test-*" builds) only allow `X-Group-Slug`
    // in CORS preflights. Sending `X-Session-Slug` can cause browsers to block requests
    // with a generic "Load failed" network error even when the worker is healthy.
    //
    // The worker-side auth handler accepts either header (it checks `x-session-slug ?? x-group-slug`),
    // so sending only `X-Group-Slug` keeps compatibility without sacrificing modern workers.
    headers['X-Group-Slug'] = toStr(slug);
  }
  return headers;
};

const getWorkerAuthHeadersWithMeta = async ({
  sessionSlug,
  sessionConfig,
  context,
  workerUrl,
  allowDemoFallback,
}: ResolveWorkerTokenRequestContextOptions = {}) => {
  const resolvedRequest = await resolveWorkerTokenRequestContext({
    sessionSlug,
    sessionConfig,
    context,
    workerUrl,
    allowDemoFallback,
    resolveWorkerUrl: true,
  });
  const token = await getWorkerSessionToken({
    requestContext: resolvedRequest,
  });
  const headers = buildWorkerAuthHeadersForToken({ token, slug: resolvedRequest.slug });
  return { headers, requestContext: resolvedRequest };
};

export const getWorkerAuthHeaders = async ({
  sessionSlug,
  sessionConfig,
  context,
  workerUrl,
  allowDemoFallback,
}: ResolveWorkerTokenRequestContextOptions = {}) => {
  const { headers } = await getWorkerAuthHeadersWithMeta({
    sessionSlug,
    sessionConfig,
    context,
    workerUrl,
    allowDemoFallback,
  });
  return headers;
};

const mergeHeaders = (base, extra) => {
  const out = new Headers(base || {});
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value !== undefined) out.set(key, value);
  });
  return out;
};

const ANONYMOUS_RATE_ID_STORAGE_KEY = 'ce:anonClientId:v1';

const normalizeAnonymousRateId = (raw) => {
  const cleaned = toStr(raw).trim().toLowerCase();
  if (!cleaned) return '';
  if (!/^[a-z0-9_-]{8,128}$/.test(cleaned)) return '';
  return cleaned;
};

const createAnonymousRateId = () => {
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

const getAnonymousRateId = () => {
  if (typeof window === 'undefined') return '';
  try {
    const cached = normalizeAnonymousRateId(localStorage.getItem(ANONYMOUS_RATE_ID_STORAGE_KEY) || '');
    if (cached) return cached;
  } catch (_) {}
  const generated = normalizeAnonymousRateId(createAnonymousRateId());
  if (!generated) return '';
  try {
    localStorage.setItem(ANONYMOUS_RATE_ID_STORAGE_KEY, generated);
  } catch (_) {}
  return generated;
};

const buildWorkerAuthNonceHeaders = (baseHeaders) => {
  const headers = mergeHeaders(baseHeaders, {});
  const anonRateId = getAnonymousRateId();
  if (anonRateId && !headers.has('X-Anonymous-Client-Id')) {
    headers.set('X-Anonymous-Client-Id', anonRateId);
  }
  return headers;
};

const isStreamBody = (body) => {
  if (!body) return false;
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return true;
  return typeof body?.getReader === 'function';
};

const buildAnonymousHeaders = ({ baseHeaders, slug }) => {
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

const stripAnonymousRateIdHeader = (baseHeaders) => {
  const headers = mergeHeaders(baseHeaders, {});
  headers.delete('X-Anonymous-Client-Id');
  headers.delete('x-anonymous-client-id');
  return headers;
};

const normalizeHttpMethod = (methodIn = 'GET') => {
  const normalized = toStr(methodIn || 'GET')
    .trim()
    .toUpperCase();
  return normalized || 'GET';
};

const isIdempotentRequestMethod = (methodIn = 'GET') => {
  const method = normalizeHttpMethod(methodIn);
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
};

const buildProbeInit = (headers, options = {}) => {
  const init = {
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

const shouldRetryAnonymousWithoutRateId = async ({ workerUrl, anonymousHeaders, options = {} } = {}) => {
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

const AUTH_OR_GATE_DENIAL_PATTERNS = [
  /missing authorization header/i,
  /missing requester address for worker sbt gate/i,
  /token missing .* scope/i,
  /token does not match requested session slug/i,
  /token expired/i,
];

const AUTHENTICATED_RETRY_DENIAL_PATTERNS = [
  /missing authorization header/i,
  /token missing .* scope/i,
  /token does not match requested session slug/i,
  /token expired/i,
  /invalid token/i,
];

const shouldFallbackForAnonymousDeny = (normalizedError) => {
  const msg = toStr(normalizedError).trim().toLowerCase();
  if (!msg.includes('anonymous access denied')) return false;
  return true;
};

const readRequestApiKey = (body) => {
  if (!body) return '';
  try {
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      return toStr(body.get('apiKey')).trim();
    }
  } catch (_) {}
  try {
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
      return toStr(body.get('apiKey')).trim();
    }
  } catch (_) {}

  if (typeof body === 'string') {
    const raw = body.trim();
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      return toStr(parsed?.apiKey).trim();
    } catch (e) {
      accountLog.warn('workerAuth: JSON parse failed', e);
      return '';
    }
  }

  if (typeof body === 'object') {
    return toStr(body?.apiKey).trim();
  }
  return '';
};

const parseErrorMessage = (payload) => {
  if (!payload || typeof payload !== 'object') return '';
  const direct = typeof payload?.error === 'string' ? payload.error : '';
  const nested = typeof payload?.error?.message === 'string' ? payload.error.message : '';
  const message = typeof payload?.message === 'string' ? payload.message : '';
  return toStr(direct || nested || message).trim();
};

const readResponseErrorMessage = async (response) => {
  if (!response || typeof response.clone !== 'function') return '';
  let text = '';
  try {
    text = await response.clone().text();
  } catch {
    return '';
  }
  const trimmed = toStr(text).trim();
  if (!trimmed) return '';
  try {
    const parsed = JSON.parse(trimmed);
    return parseErrorMessage(parsed) || trimmed;
  } catch (e) {
    accountLog.warn('workerAuth: JSON parse failed', e);
    return trimmed;
  }
};

const shouldFallbackToAuthenticatedFlow = async (
  response,
  { requestApiKey = '', fallbackOnGateUnavailable = false } = {},
) => {
  const status = Number(response?.status || 0);
  const errorMessage = await readResponseErrorMessage(response);
  if (!errorMessage) return false;
  const normalizedError = toStr(errorMessage).trim().toLowerCase();
  if (normalizedError.includes('on-chain gate data unavailable')) {
    return fallbackOnGateUnavailable === true;
  }
  if (status === 429 && (normalizedError === 'rate limit exceeded.' || normalizedError === 'rate limit exceeded')) {
    if (toStr(requestApiKey).trim()) return false;
    return true;
  }
  if (status !== 401 && status !== 403) return false;
  if (shouldFallbackForAnonymousDeny(normalizedError)) {
    return true;
  }
  return AUTH_OR_GATE_DENIAL_PATTERNS.some((pattern) => pattern.test(errorMessage));
};

const shouldRetryAuthenticatedResponse = async (response) => {
  const status = Number(response?.status || 0);
  if (status === 401) return true;
  if (status !== 403) return false;
  const errorMessage = await readResponseErrorMessage(response);
  if (!errorMessage) return false;
  return AUTHENTICATED_RETRY_DENIAL_PATTERNS.some((pattern) => pattern.test(errorMessage));
};

export const fetchWorkerWithAuth = async (url, options = {}, opts = {}) => {
  const resolvedSession = resolveWorkerSessionContext({
    sessionSlug: opts.sessionSlug,
    sessionConfig: opts.sessionConfig,
    allowDemoFallback: shouldAllowDemoSessionFallback(opts.allowDemoFallback),
    getDefaultAllowDemoFallback: defaultWorkerAuthAllowDemoFallback,
  });
  const slug = resolvedSession.sessionSlug;
  const workerUrl = normalizeWorkerUrl(opts.workerUrl || url);
  const bodyIsStream = isStreamBody(options?.body);
  const anonymousOnly = opts.anonymousOnly === true;
  const canAttemptAnonymous = (opts.preferAnonymous || anonymousOnly) && (!bodyIsStream || anonymousOnly);
  let anonymousResponse: Response | null = null;
  if (canAttemptAnonymous) {
    const requestApiKey = readRequestApiKey(options?.body);
    const anonymousHeaders = buildAnonymousHeaders({
      baseHeaders: options.headers,
      slug,
    });
    try {
      anonymousResponse = await fetch(url, { ...options, headers: anonymousHeaders });
    } catch (anonymousError) {
      if (bodyIsStream) throw anonymousError;
      // Backward compatibility: older workers may reject preflight when this header is unknown.
      const hasAnonRateId = toStr(anonymousHeaders.get('X-Anonymous-Client-Id')).trim().length > 0;
      if (!hasAnonRateId) throw anonymousError;
      const canRetryWithoutRateId = await shouldRetryAnonymousWithoutRateId({
        workerUrl,
        anonymousHeaders,
        options,
      });
      if (!canRetryWithoutRateId) throw anonymousError;
      const fallbackAnonymousHeaders = stripAnonymousRateIdHeader(anonymousHeaders);
      anonymousResponse = await fetch(url, { ...options, headers: fallbackAnonymousHeaders });
    }
    // Regression guard: user-initiated media capture must never turn a denied
    // anonymous request into an unexpected wallet or passkey signing prompt.
    if (anonymousOnly) return anonymousResponse;
    const shouldFallback = await shouldFallbackToAuthenticatedFlow(anonymousResponse, {
      requestApiKey,
      fallbackOnGateUnavailable: opts.fallbackOnGateUnavailable === true,
    });
    if (!shouldFallback) {
      return anonymousResponse;
    }
  }
  let authHeaders: Record<string, string> | null = null;
  let authRequestContext: WorkerTokenRequestContext | null = null;
  try {
    const authResult = await getWorkerAuthHeadersWithMeta({
      sessionSlug: slug,
      sessionConfig: resolvedSession.sessionConfig,
      context: opts.context,
      workerUrl,
      allowDemoFallback: opts.allowDemoFallback,
    });
    authHeaders = authResult.headers;
    authRequestContext = authResult.requestContext;
  } catch (err) {
    // When anonymous-first is enabled and no wallet is connected, surface
    // the original anonymous worker denial instead of a wallet-auth error.
    if (anonymousResponse && /authenticate with the worker/i.test(getErrorMessage(err))) {
      return anonymousResponse;
    }
    throw err;
  }
  const headers = mergeHeaders(options.headers, authHeaders);
  const response = await fetch(url, { ...options, headers });
  if (
    (response.status === 401 || response.status === 403) &&
    opts.retry !== false &&
    (await shouldRetryAuthenticatedResponse(response))
  ) {
    await clearWorkerSessionToken({
      requestContext: authRequestContext,
      sessionSlug: slug,
      sessionConfig: resolvedSession.sessionConfig,
      context: opts.context,
      workerUrl,
      allowDemoFallback: opts.allowDemoFallback,
    });
    const retryToken = await getWorkerSessionToken({
      requestContext: authRequestContext,
    });
    const retryAuth = buildWorkerAuthHeadersForToken({
      token: retryToken,
      slug: authRequestContext?.slug || slug,
    });
    const retryHeaders = mergeHeaders(options.headers, retryAuth);
    return fetch(url, { ...options, headers: retryHeaders });
  }
  return response;
};

export const __test__workerAuthTokenCache = {
  buildTokenCacheEnvelope,
  buildTokenCacheKey,
  normalizeTokenCacheEntry,
};
