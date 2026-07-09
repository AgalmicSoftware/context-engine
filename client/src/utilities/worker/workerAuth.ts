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
  clearTokenCache,
  isWorkerTokenCacheKey,
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

const accountLog = createLogger('account');

const NONCE_MISMATCH_ERROR = 'nonce mismatch or expired';
const ONCHAIN_GATE_UNAVAILABLE_ERROR = 'on-chain gate data unavailable';
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
type ResolveWorkerTokenRequestContextOptions = {
  allowDemoFallback?: boolean;
  context?: unknown;
  resolvedAddress?: unknown;
  resolveWorkerUrl?: boolean;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  workerUrl?: unknown;
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
type WorkerFetchAuthOptions = ResolveWorkerTokenRequestContextOptions & {
  fallbackOnGateUnavailable?: boolean;
  preferAnonymous?: boolean;
  retry?: boolean;
};
type InFlightTokenRequest = {
  abortController: {
    abort: () => void;
    signal: AbortSignal | null;
  };
  promise: Promise<string> | null;
};
type WorkerLoginResponse = {
  error?: unknown;
  exp?: unknown;
  token?: string;
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
  const overrideProviderLike = toStr(override.providerLike || override.provider || '').trim();
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

const isNonceMismatchError = (message: unknown): boolean => toStr(message).toLowerCase().includes(NONCE_MISMATCH_ERROR);

const isOnChainGateUnavailableError = (message: unknown): boolean =>
  toStr(message).toLowerCase().includes(ONCHAIN_GATE_UNAVAILABLE_ERROR);

const createAbortError = (message = 'Worker auth request aborted.') => {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError');
  }
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
};

const isAbortError = (error: unknown): boolean =>
  toStr(error && typeof error === 'object' ? (error as { name?: unknown }).name : '') === 'AbortError';

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

const sleep = (ms: number, { signal, requestAuthEpoch, requestAddress }: SleepOptions = {}) =>
  new Promise<void>((resolve, reject) => {
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const clearTimer = () => {
      if (timerId !== null) clearTimeout(timerId);
    };
    const onAbort = () => {
      clearTimer();
      if (signal && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onAbort);
      }
      reject(createAbortError());
    };
    const finish = (cb: () => void) => {
      clearTimer();
      if (signal && typeof signal.removeEventListener === 'function') {
        signal.removeEventListener('abort', onAbort);
      }
      cb();
    };
    try {
      assertWorkerAuthRequestCurrent(signal ?? null, requestAuthEpoch, requestAddress);
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
          assertWorkerAuthRequestCurrent(signal ?? null, requestAuthEpoch, requestAddress);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }, ms);
  });

const resolveSignerAddress = async (providerLike: unknown, fallbackAddress: unknown = '') => {
  const provider = getWorkerProvider(providerLike);
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
    storageKey: resolvedWorkerUrl ? buildTokenCacheKey({ workerUrl: resolvedWorkerUrl, slug, address }) : '',
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

const signTypedDataV4 = async ({
  typedData,
  provider,
  address,
}: {
  address: string;
  provider: WorkerProvider | null | undefined;
  typedData: unknown;
}) => {
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
  const audience = resolveAdminActionAudience(resolvedWorkerUrl);
  if (!audience) {
    throw new Error('Unable to resolve admin audience.');
  }

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
      throw new Error(nonceData?.error || `Failed to request admin nonce (${nonceResp.status}).`);
    }
    if (!nonceData?.nonce) {
      throw new Error('Worker nonce response missing nonce.');
    }
    nonce = toStr(nonceData.nonce).trim();
  }

  const expiration = Math.floor(Date.now() / 1000) + ADMIN_ACTION_EXPIRATION_WINDOW_SECONDS;
  const bodyHash = buildAdminActionBodyHash(body && typeof body === 'object' ? body : {});
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
      throw new Error(nonceData?.error || `Failed to request admin nonce (${nonceResp.status}).`);
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
}: WorkerSessionTokenOptions = {}) => {
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
        body: JSON.stringify({ address, sessionSlug: slug }),
        signal: signal || undefined,
      });
      const nonceData = await nonceResp.json().catch(() => ({}));
      if (!nonceResp.ok) {
        if (Number(nonceResp.status || 0) === 404) {
          throw new Error('Worker auth nonce route not supported (404).');
        }
        throw new Error(nonceData?.error || `Failed to request worker nonce (${nonceResp.status}).`);
      }
      if (!nonceData?.nonce) {
        throw new Error('Worker nonce response missing nonce.');
      }

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
        body: JSON.stringify({ address, message, signature, sessionSlug: slug }),
        signal: signal || undefined,
      });
      const loginData: WorkerLoginResponse = await loginResp.json().catch(() => ({}));
      if (!loginResp.ok) {
        if (Number(loginResp.status || 0) === 404) {
          throw new Error('Worker auth login route not supported (404).');
        }
        throw new Error(toStr(loginData?.error || `Worker login failed (${loginResp.status}).`));
      }
      if (!loginData?.token) {
        throw new Error('Worker login did not return a token.');
      }
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
          isOnChainGateUnavailableError(getErrorMessage(err)) && attempt < LOGIN_GATE_UNAVAILABLE_RETRIES;
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
        sessionSlug: slug,
        address,
      }),
    );

    return loginData.token;
  };

  const inFlightRequest: InFlightTokenRequest = { abortController, promise: null };
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
  if (typeof window === 'undefined') return;
  try {
    Object.keys(localStorage).forEach((key) => {
      if (isWorkerTokenCacheKey(key)) {
        localStorage.removeItem(key);
      }
    });
  } catch (_) {}
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

export const fetchWorkerWithAuth = async (
  url: RequestInfo | URL,
  options: RequestInit = {},
  opts: WorkerFetchAuthOptions = {},
) => {
  const resolvedSession = resolveWorkerSessionContext({
    sessionSlug: opts.sessionSlug,
    sessionConfig: opts.sessionConfig,
    allowDemoFallback: shouldAllowDemoSessionFallback(opts.allowDemoFallback),
    getDefaultAllowDemoFallback: defaultWorkerAuthAllowDemoFallback,
  });
  const slug = resolvedSession.sessionSlug;
  const workerUrl = normalizeWorkerUrl(opts.workerUrl || url);
  const canAttemptAnonymous = opts.preferAnonymous && !isStreamBody(options?.body);
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

export const workerAuthUtils = {
  buildSiweMessage,
  buildSignedBootstrapAdminAuth,
  buildSignedAdminActionAuth,
  getWorkerSessionToken,
  getWorkerAuthHeaders,
  clearWorkerSessionToken,
  clearAllWorkerSessionTokens,
  fetchWorkerWithAuth,
};

export const __test__workerAuthTokenCache = {
  buildTokenCacheEnvelope,
  buildTokenCacheKey,
  normalizeTokenCacheEntry,
};
