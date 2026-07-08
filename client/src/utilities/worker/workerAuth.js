/**
 * @file workerAuth.js
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

const shouldAllowDemoSessionFallback = (allowDemoFallback) =>
  resolveWorkerAllowDemoFallback({
    allowDemoFallback,
    getDefaultAllowDemoFallback: defaultWorkerAuthAllowDemoFallback,
  });
const resolveDefaultProviderLike = () => {
  try {
    const state = store?.getState?.();
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
const getWalletContext = (override = {}) => {
  const overrideProviderLike = toStr(override.providerLike || override.provider || '').trim();
  try {
    const state = store?.getState?.();
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

const inFlightTokenRequests = new Map();
let workerAuthEpoch = 0;
const getCurrentWorkerAuthStoreAddress = () => {
  try {
    return normalizeAddress(store?.getState?.()?.profile?.account);
  } catch (_) {
    return '';
  }
};

const doesWorkerAuthAddressMatchStore = (address) => {
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
  trackedWorkerAuthAddress = normalizeAddress(nextAddress);
  return workerAuthEpoch;
};

const syncWorkerAuthAddress = (address) => {
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

const assertWorkerAuthRequestCurrent = (signal, requestAuthEpoch, requestAddress = '') => {
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

const resolveWorkerTokenRequestContext = async ({
  sessionSlug,
  sessionConfig,
  context,
  workerUrl,
  allowDemoFallback,
  resolveWorkerUrl = false,
  resolvedAddress,
} = {}) => {
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
} = {}) => {
  const addr = toStr(address).trim();
  const host = toStr(domain || (typeof window !== 'undefined' ? window.location.host : '')).trim();
  const origin = toStr(uri || (typeof window !== 'undefined' ? window.location.origin : '')).trim();
  const chain = Number(chainId || 1);
  const issued = issuedAt || new Date().toISOString();
  const exp = expirationTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const note = statement || 'Sign in to Context Engine.';

  return `${host} wants you to sign in with your Ethereum account:\n${addr}\n\n${note}\n\nURI: ${origin}\nVersion: 1\nChain ID: ${chain}\nNonce: ${nonce}\nIssued At: ${issued}\nExpiration Time: ${exp}`;
};

const signMessage = async ({ message, providerLike, address }) => {
  const provider = cryptoUtils._getProvider(providerLike || resolveDefaultProviderLike());
  const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
  const signer = address ? ethersProvider.getSigner(address) : ethersProvider.getSigner();
  return signer.signMessage(message);
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
} = {}) => {
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
  const bodyHash = buildAdminActionBodyHash(body);
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
} = {}) => {
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
  if (cached?.token) {
    return cached.token;
  }

  if (inFlightTokenRequests.has(storageKey)) {
    return inFlightTokenRequests.get(storageKey).promise;
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
        signal,
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
        signal,
      });
      const loginData = await loginResp.json().catch(() => ({}));
      if (!loginResp.ok) {
        if (Number(loginResp.status || 0) === 404) {
          throw new Error('Worker auth login route not supported (404).');
        }
        throw new Error(loginData?.error || `Worker login failed (${loginResp.status}).`);
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
        if (isNonceMismatchError(err?.message) && !retriedNonceMismatch) {
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
} = {}) => {
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

const buildWorkerAuthHeadersForToken = ({ token, slug } = {}) => {
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  if (slug) {
    // NOTE: Some deployed workers (ex: older "test-*" builds) only allow `X-Group-Slug`
    // in CORS preflights. Sending `X-Session-Slug` can cause browsers to block requests
    // with a generic "Load failed" network error even when the worker is healthy.
    //
    // The worker-side auth handler accepts either header (it checks `x-session-slug ?? x-group-slug`),
    // so sending only `X-Group-Slug` keeps compatibility without sacrificing modern workers.
    headers['X-Group-Slug'] = slug;
  }
  return headers;
};

const getWorkerAuthHeadersWithMeta = async ({
  sessionSlug,
  sessionConfig,
  context,
  workerUrl,
  allowDemoFallback,
} = {}) => {
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
} = {}) => {
  const { headers } = await getWorkerAuthHeadersWithMeta({
    sessionSlug,
    sessionConfig,
    context,
    workerUrl,
    allowDemoFallback,
  });
  return headers;
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
  const canAttemptAnonymous = opts.preferAnonymous && !isStreamBody(options?.body);
  let anonymousResponse = null;
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
  let authHeaders = null;
  let authRequestContext = null;
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
    if (anonymousResponse && /authenticate with the worker/i.test(toStr(err?.message))) {
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
