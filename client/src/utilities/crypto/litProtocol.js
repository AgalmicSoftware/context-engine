/**
 * @file litProtocol.js
 * @module litProtocol
 * @description Lit Protocol client setup, encrypt/decrypt operations, and SBT-gated access control.
 *              Manages Lit client lifecycle, builds access control conditions, and handles Arweave-backed encrypted payloads.
 *
 * Key exports: getGlobalLitHooks, buildSbtAccessControlConditions, resolveLitChain, litStorage, uploadEncryptedArweaveData
 */
import { Buffer } from 'buffer/';
import { ethers } from 'ethers';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { cryptoUtils } from './cryptography.js';
import { arweaveScripts } from '../arweave/arweaveScripts.js';
import { createLogger } from '../logging';
import { perfDebugLitGetKey } from '../web3/rpcDebugStats.js';
import { toStr } from '../shared/primitives.js';
import {
  fetchWorkerWithAuth,
  buildSignedBootstrapAdminAuth,
  normalizeWorkerUrl,
} from '../worker/workerAuth.js';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';

/**
 * @typedef {import('ethers').providers.Provider} EthersProvider
 * @typedef {import('ethers').Signer} EthersSigner
 * @typedef {typeof import('buffer').Buffer} BufferConstructorLike
 */

/**
 * @typedef {string | EthersProvider | EthersSigner | {
 *   provider?: unknown,
 *   request?: (request: { method: string, params?: unknown[] }) => Promise<unknown>
 * } | null | undefined} LitProviderLike
 */

/**
 * @typedef {object} LitAccessControlCondition
 * @property {'and' | 'or'=} operator
 * @property {string=} contractAddress
 * @property {string=} standardContractType
 * @property {string=} chain
 * @property {string=} method
 * @property {string[]=} parameters
 * @property {{ comparator?: string, value?: string }=} returnValueTest
 */

/**
 * @typedef {object} LitEncryptResult
 * @property {string} ciphertext
 * @property {string} dataToEncryptHash
 */

/**
 * @typedef {object} LitUploadPayload
 * @property {1} v
 * @property {'text' | 'file'} kind
 * @property {string} name
 * @property {string} format
 * @property {string} mime
 * @property {'utf-8' | 'base64'} encoding
 * @property {string} data
 */

/**
 * @typedef {object} LitDecryptResult
 * @property {LitUploadPayload} payload
 * @property {string} txId
 * @property {string} url
 */

/**
 * @typedef {object} LitUploadResult
 * @property {string} txId
 * @property {string} url
 * @property {string} arweaveUrl
 * @property {string} envelope
 */

/**
 * @typedef {object} LitHooksApi
 * @property {(symmetricKey: Uint8Array | ArrayLike<number>, opts?: {
 *   accessControlConditions?: LitAccessControlCondition[],
 *   chain?: string,
 *   connectTimeout?: number,
 *   litNetwork?: string,
 *   resourceId?: Record<string, any>,
 *   providerLike?: LitProviderLike,
 *   resourceAbilityRequests?: unknown,
 *   userMaxPrice?: unknown,
 *   paymentDelegation?: Record<string, any>,
 *   account?: string,
 *   rpcUrl?: string
 * }) => Promise<LitEncryptResult>} saveKey
 * @property {(opts?: {
 *   accessControlConditions?: LitAccessControlCondition[],
 *   chain?: string,
 *   connectTimeout?: number,
 *   litNetwork?: string,
 *   resourceId?: Record<string, any>,
 *   providerLike?: LitProviderLike,
 *   resourceAbilityRequests?: unknown,
 *   userMaxPrice?: unknown,
 *   paymentDelegation?: Record<string, any>,
 *   account?: string,
 *   requesterAddress?: string,
 *   ciphertext?: string,
 *   dataToEncryptHash?: string,
 *   encryptedSymmetricKey?: string,
 *   toDecrypt?: string,
 *   rpcUrl?: string
 * }) => Promise<Uint8Array | string>} getKey
 * @property {(() => void)=} clearCache
 * @property {LitAccessControlCondition[] | null=} accessControlConditions
 * @property {string=} litChain
 * @property {string=} litNetwork
 * @property {string=} chain
 * @property {LitProviderLike=} providerLike
 * @property {number=} connectTimeout
 * @property {unknown=} resourceAbilityRequests
 * @property {unknown=} userMaxPrice
 * @property {Record<string, any>=} paymentDelegation
 * @property {boolean=} __e2eMock
 */

/**
 * @typedef {object} LitDevToolsApi
 * @property {(options?: {
 *   value?: unknown,
 *   sbtAddresses?: string | string[],
 *   contextLabel?: string,
 *   chain?: string | number
 * }) => Promise<string>} encryptForSbt
 * @property {(envelopeJson: string | Record<string, any>) => Promise<any>} decryptEnvelope
 */

/**
 * @typedef {object} LitStorageApi
 * @property {(txId: unknown) => string} buildLitArweaveUrl
 * @property {(url: unknown) => string | null} parseLitArweaveUrl
 * @property {(url: unknown) => boolean} isLitArweaveUrl
 * @property {(options?: {
 *   data?: unknown,
 *   format?: string,
 *   name?: string,
 *   mime?: string,
 *   arweaveJwk?: Record<string, any>,
 *   tags?: Array<Record<string, any>>,
 *   arweave?: Record<string, any>,
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   contextLabel?: string,
 *   lit?: LitHooksApi & { accessControlConditions: LitAccessControlCondition[] }
 * }) => Promise<LitUploadResult>} uploadEncryptedArweaveData
 * @property {(options?: {
 *   url?: string,
 *   txId?: string,
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   lit?: LitHooksApi,
 *   arweave?: Record<string, any>
 * }) => Promise<LitDecryptResult>} downloadEncryptedArweaveData
 * @property {(payload: LitUploadPayload | null | undefined) => string} decodeLitPayloadToText
 * @property {(payload: LitUploadPayload | null | undefined) => Blob | null} decodeLitPayloadToBlob
 */

const log = createLogger('sbt');

const DEFAULT_LIT_NETWORK = 'naga-dev';
const DEFAULT_LIT_CHAIN = 'ethereum';
const DEFAULT_LIT_CONNECT_TIMEOUT = 45000;
const DEFAULT_LIT_SESSION_TTL_MS = 1000 * 60 * 10;
const DEFAULT_LIT_PAYMENT_DELEGATION_TTL_MS = 1000 * 60 * 10;
const LIT_AUTH_APP_NAME = 'context-engine';
const NAGA_DEFAULT_KEY_SET_ID = 'naga-keyset1';
const NAGA_ROOT_KEY_TYPE_SUBNET = 1;
const NAGA_ROOT_KEY_TYPE_HD_ROOT = 2;
const NAGA_HANDSHAKE_V1_NETWORKS = Object.freeze(new Set(['naga-dev']));

let litClientModulePromise = null;
let litAuthModulePromise = null;
let litContractsModulePromise = null;
let litNetworksModulePromise = null;

const getLitClientModule = async () => {
  if (!litClientModulePromise) {
    litClientModulePromise = import('@lit-protocol/lit-client').catch((err) => {
      litClientModulePromise = null;
      throw err;
    });
  }
  return litClientModulePromise;
};

const getLitAuthModule = async () => {
  if (!litAuthModulePromise) {
    litAuthModulePromise = import('@lit-protocol/auth').catch((err) => {
      litAuthModulePromise = null;
      throw err;
    });
  }
  return litAuthModulePromise;
};

const getLitContractsModule = async () => {
  if (!litContractsModulePromise) {
    litContractsModulePromise = import('@lit-protocol/contracts').catch((err) => {
      litContractsModulePromise = null;
      throw err;
    });
  }
  return litContractsModulePromise;
};

const getLitNetworksModule = async () => {
  if (!litNetworksModulePromise) {
    litNetworksModulePromise = import('@lit-protocol/networks').catch((err) => {
      litNetworksModulePromise = null;
      throw err;
    });
  }
  return litNetworksModulePromise;
};

const getGlobalScope = () => {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  return null;
};

const bufferHasBigUIntWrite = (BufferCtor) => {
  try {
    if (!BufferCtor || typeof BufferCtor.alloc !== 'function') return false;
    const probe = BufferCtor.alloc(8);
    return (
      typeof probe?.writeBigUInt64BE === 'function' ||
      typeof probe?.writeBigUint64BE === 'function'
    );
  } catch (_) {
    return false;
  }
};

const installBufferBigUIntWriteShim = (BufferCtor) => {
  if (!BufferCtor || !BufferCtor.prototype) return false;

  const writeCompat = function writeBigUInt64BECompat(value, offset = 0) {
    const bigIntCtor = (
      typeof globalThis !== 'undefined' &&
      typeof globalThis.BigInt === 'function'
    )
      ? globalThis.BigInt
      : null;
    if (!bigIntCtor) {
      throw new TypeError('BigInt is not supported in this runtime.');
    }
    const start = Number(offset);
    if (!Number.isInteger(start) || start < 0 || start + 8 > this.length) {
      throw new RangeError('Index out of range');
    }

    let x = typeof value === 'bigint' ? value : bigIntCtor(value);
    if (x < 0n || x > 0xffffffffffffffffn) {
      throw new RangeError('value out of range');
    }

    for (let i = 7; i >= 0; i -= 1) {
      this[start + i] = Number(x & 0xffn);
      x >>= 8n;
    }
    return start + 8;
  };

  if (typeof BufferCtor.prototype.writeBigUInt64BE !== 'function') {
    BufferCtor.prototype.writeBigUInt64BE = writeCompat;
  }
  if (typeof BufferCtor.prototype.writeBigUint64BE !== 'function') {
    BufferCtor.prototype.writeBigUint64BE = BufferCtor.prototype.writeBigUInt64BE;
  }
  return bufferHasBigUIntWrite(BufferCtor);
};

/**
 * Ensures the active runtime exposes a Buffer implementation compatible with Lit's bigint writes.
 *
 * @returns {BufferConstructorLike | null}
 */
export const ensureLitBufferCompatibility = () => {
  const scope = getGlobalScope();
  if (!scope) return null;

  const runtimeBuffer = scope.Buffer;
  if (bufferHasBigUIntWrite(runtimeBuffer)) return runtimeBuffer;

  if (bufferHasBigUIntWrite(Buffer)) {
    scope.Buffer = Buffer;
    return scope.Buffer;
  }

  if (installBufferBigUIntWriteShim(runtimeBuffer)) {
    return runtimeBuffer;
  }
  if (installBufferBigUIntWriteShim(Buffer)) {
    scope.Buffer = Buffer;
    return scope.Buffer;
  }
  return null;
};

ensureLitBufferCompatibility();

const logLit = (level, message, meta) => {
  const fn = log[level] || log.log;
  if (meta === undefined) {
    fn(message);
  } else {
    fn(message, meta);
  }
};

const normalizeConnectTimeout = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_LIT_CONNECT_TIMEOUT;
  return Math.floor(num);
};

const isE2eLitMockEnabled = () => {
  // Dev/e2e only: never enable in production builds.
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
      return false;
    }
  } catch (e) { void e; /* fallback: lit mock detection. */ }

  if (typeof window === 'undefined') return false;

  try {
    if (globalThis.CE_E2E_LIT_MOCK === true) return true;
  } catch (e) { void e; /* fallback: lit mock detection. */ }
  try {
    if (localStorage.getItem('ce-e2e-lit-mock') === '1') return true;
  } catch (e) { void e; /* fallback: lit mock detection. */ }
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('litMock') === '1') return true;
  } catch (e) { void e; /* fallback: lit mock detection. */ }
  return false;
};

const runWithTimeout = async ({ run, timeoutMs, timeoutMessage }) => {
  let timeoutId = null;
  let timedOut = false;
  const taskPromise = Promise.resolve()
    .then(() => run())
    .catch((err) => {
      // Avoid an unhandled rejection if the task fails after timeout wins the race.
      if (timedOut) return null;
      throw err;
    });

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([taskPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const createLitClientWithTimeout = async ({ network, timeoutMs }) => {
  let timeoutId = null;
  let timedOut = false;
  const createPromise = getLitClientModule()
    .then((module) => {
      const createLitClient = module?.createLitClient;
      if (typeof createLitClient !== 'function') {
        throw new Error('Lit client module missing createLitClient export.');
      }
      return createLitClient({ network });
    })
    .then((client) => {
      if (timedOut && client && typeof client.disconnect === 'function') {
        try {
          client.disconnect();
        } catch (e) { log.warn('litProtocol: cleanup', e); }
      }
      return client;
    })
    .catch((err) => {
      // Avoid an unhandled rejection if createLitClient fails after timeout wins the race.
      if (timedOut) return null;
      throw err;
    });

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(new Error(`Lit connect timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([createPromise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const LIT_CHAIN_BY_ID = Object.freeze({
  1: 'ethereum',
  10: 'optimism',
  56: 'bsc',
  137: 'polygon',
  42161: 'arbitrum',
  42220: 'celo',
  8453: 'base',
  84532: 'baseSepolia',
  11155111: 'sepolia',
  421614: 'arbitrumSepolia',
  11155420: 'optimismSepolia',
});

const LIT_NETWORK_ALIASES = Object.freeze({
  // Intentionally no datil-dev/datil-test aliases: datil is deprecated and
  // this project is still in testing where strict backward compatibility is not required.
  'naga-dev': 'naga-dev',
  nagadev: 'naga-dev',
  'naga-test': 'naga-test',
  nagatest: 'naga-test',
  'naga-mainnet': 'naga',
  datil: 'naga',
  custom: 'custom',
});

/**
 * Normalizes Lit network aliases to the runtime identifier expected by the Lit client.
 *
 * @param {string | null | undefined} litNetwork
 * @returns {string}
 */
export const resolveLitNetwork = (litNetwork) => {
  const raw = toStr(litNetwork || DEFAULT_LIT_NETWORK).trim();
  if (!raw) return DEFAULT_LIT_NETWORK;
  const normalized = raw.toLowerCase().replace(/_/g, '-');
  return LIT_NETWORK_ALIASES[normalized] || raw;
};

const resolveLitCipherPayload = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value.ciphertext && value.dataToEncryptHash) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && parsed.ciphertext && parsed.dataToEncryptHash) return parsed;
    } catch (e) { log.warn('litProtocol: fallback', e); }
  }
  return null;
};

const resolveLitErrorMessage = (err) => {
  if (!err) return 'Unknown Lit error';
  const direct = toStr(err?.message || '').trim();
  if (direct) return direct;
  const nested = toStr(
    err?.error?.message ||
    err?.cause?.message ||
    err?.reason ||
    err?.details ||
    ''
  ).trim();
  if (nested) return nested;
  try {
    const asJson = JSON.stringify(err);
    if (asJson && asJson !== '{}') return asJson;
  } catch (e) { log.warn('litProtocol: fallback', e); }
  return String(err);
};

const normalizeAccessControlConditions = (conditions, chainFallback) => {
  if (!Array.isArray(conditions)) return null;
  const chain = toStr(chainFallback || '').trim();
  return conditions
    .map((cond) => {
      if (!cond || typeof cond !== 'object') return cond;
      if (cond.operator) return cond;
      if (cond.chain) return cond;
      if (!chain) return cond;
      return { ...cond, chain };
    });
};

const summarizeAccConditions = (conditions) => {
  if (!Array.isArray(conditions) || !conditions.length) {
    return {
      hasConditions: false,
      conditionCount: 0,
      firstChain: null,
      firstMethod: null,
      operatorCount: 0,
    };
  }
  const firstCond = conditions.find((c) => c && typeof c === 'object' && !c.operator) || null;
  const operatorCount = conditions.filter((c) => c && typeof c === 'object' && !!c.operator).length;
  return {
    hasConditions: true,
    conditionCount: conditions.length,
    firstChain: toStr(firstCond?.chain || '').trim() || null,
    firstMethod: toStr(firstCond?.method || '').trim() || null,
    operatorCount,
  };
};

/* ----------------------- Lit getKey memoization ------------------------ */

const LIT_GETKEY_SUCCESS_TTL_MS = DEFAULT_LIT_SESSION_TTL_MS; // 10m (matches Lit session ttl)
const LIT_GETKEY_NEG_TTL_MS = 10000; // transient failures only
const LIT_GETKEY_ACC_NEG_TTL_MS = 500; // avoid "mint then still denied" UX
const LIT_GETKEY_SUCCESS_CACHE_MAX = 600;
const LIT_GETKEY_NEG_CACHE_MAX = 250;
const LIT_GETKEY_PRUNE_EVERY_N = 25;

const stableKeyStringify = (value) => {
  const seen = new Set();
  const walk = (v) => {
    if (v == null) return v;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'bigint') return `bigint:${v.toString()}`;
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === 'object') {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
      const out = {};
      Object.keys(v).sort().forEach((k) => {
        out[k] = walk(v[k]);
      });
      return out;
    }
    return toStr(v);
  };
  try {
    return JSON.stringify(walk(value));
  } catch (_) {
    try {
      return JSON.stringify(value);
    } catch {
      return toStr(value);
    }
  }
};

const hashStable = (value) => {
  const raw = typeof value === 'string' ? value : stableKeyStringify(value);
  try {
    return ethers.utils.id(raw);
  } catch (_) {
    return raw;
  }
};

const isAccFailure = (err) => {
  const msg = toStr(err?.message || err?.reason || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('access control') ||
    msg.includes('not authorized') ||
    msg.includes('unauthorized') ||
    msg.includes('not satisfied') ||
    msg.includes('auth sig')
  );
};

const isTransientLitError = (err) => {
  const msg = toStr(err?.message || err?.reason || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('econn') ||
    msg.includes('enotfound') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('service unavailable')
  );
};

const buildLitGetKeyCacheKey = ({
  requesterAddress,
  litNetwork,
  chain,
  accessControlConditions,
  resourceId,
  ciphertext,
  dataToEncryptHash,
  encryptedSymmetricKey,
} = {}) => {
  const requester = toStr(requesterAddress).trim().toLowerCase();
  const network = resolveLitNetwork(litNetwork);
  const resolvedChain = toStr(chain).trim();
  const condsHash = hashStable(accessControlConditions || null);
  const resourceHash = hashStable(resourceId || null);
  const cipherHash = hashStable({
    ciphertext: toStr(ciphertext).trim(),
    dataToEncryptHash: toStr(dataToEncryptHash).trim(),
    encryptedSymmetricKey: toStr(encryptedSymmetricKey).trim(),
  });
  return hashStable([requester, network, resolvedChain, condsHash, resourceHash, cipherHash].join('|'));
};

const touchLru = (map, key, value) => {
  try {
    map.delete(key);
    map.set(key, value);
  } catch (e) { log.warn('litProtocol: fallback', e); }
};

const cacheLruSet = (map, key, entry, maxSize) => {
  if (!map) return;
  try {
    if (map.has(key)) map.delete(key);
    map.set(key, entry);
    const limit = Number(maxSize || 0);
    if (limit > 0) {
      while (map.size > limit) {
        const oldest = map.keys().next().value;
        if (!oldest) break;
        map.delete(oldest);
      }
    }
  } catch (e) { log.warn('litProtocol: fallback', e); }
};

const pruneExpiredCacheEntries = (map, now) => {
  try {
    if (!map || map.size === 0) return;
    const dead = [];
    for (const [k, v] of map.entries()) {
      if (!v || typeof v !== 'object') continue;
      if (Number(v.expiresAt || 0) <= now) dead.push(k);
    }
    dead.forEach((k) => map.delete(k));
  } catch (e) { log.warn('litProtocol: fallback', e); }
};

const wrapLitGetKeyWithCache = (getKeyUncached, context = {}) => {
  const successCache = new Map(); // key -> { expiresAt, value }
  const negativeCache = new Map(); // key -> { expiresAt, errMsg }
  const inflight = new Map(); // key -> Promise

  let opCount = 0;

  const clearCache = () => {
    successCache.clear();
    negativeCache.clear();
    inflight.clear();
    opCount = 0;
  };

  const getKey = async (opts = {}) => {
    perfDebugLitGetKey('attempt');

    const requester = toStr(
      opts.requesterAddress ||
      opts.account ||
      context.account ||
      ''
    ).trim();

    // Fail closed: if there's no valid requester, do not cache (prevents "<anon>" leakage).
    if (!ethers.utils.isAddress(requester)) {
      return await getKeyUncached(opts);
    }

    const effectiveNetwork = resolveLitNetwork(opts.litNetwork || context.litNetwork);
    const chain = opts.chain || context.chain;
    const rawConditions = Array.isArray(opts.accessControlConditions)
      ? opts.accessControlConditions
      : context.accessControlConditions;
    const conditions = normalizeAccessControlConditions(rawConditions, chain);

    const cipherPayload =
      opts.ciphertext && opts.dataToEncryptHash
        ? { ciphertext: opts.ciphertext, dataToEncryptHash: opts.dataToEncryptHash }
        : resolveLitCipherPayload(opts.encryptedSymmetricKey || opts.toDecrypt);

    const key = buildLitGetKeyCacheKey({
      requesterAddress: requester,
      litNetwork: effectiveNetwork,
      chain,
      accessControlConditions: conditions,
      resourceId: opts.resourceId || null,
      ciphertext: cipherPayload?.ciphertext || opts.ciphertext || '',
      dataToEncryptHash: cipherPayload?.dataToEncryptHash || opts.dataToEncryptHash || '',
      encryptedSymmetricKey: opts.encryptedSymmetricKey || opts.toDecrypt || '',
    });

    const now = Date.now();

    // Opportunistic pruning keeps long-lived sessions bounded even if many unique resources are decrypted.
    opCount += 1;
    if (opCount % LIT_GETKEY_PRUNE_EVERY_N === 0) {
      pruneExpiredCacheEntries(successCache, now);
      pruneExpiredCacheEntries(negativeCache, now);
    }

    const cached = successCache.get(key);
    if (cached) {
      if (Number(cached.expiresAt || 0) > now) {
        perfDebugLitGetKey('cache_hit');
        touchLru(successCache, key, cached);
        return cached.value;
      }
      successCache.delete(key);
    }

    const neg = negativeCache.get(key);
    if (neg) {
      if (Number(neg.expiresAt || 0) > now) {
        perfDebugLitGetKey('neg_cache_hit');
        touchLru(negativeCache, key, neg);
        throw new Error(neg.errMsg || 'Lit getKey failed (cached).');
      }
      negativeCache.delete(key);
    }

    const inFlight = inflight.get(key);
    if (inFlight) {
      perfDebugLitGetKey('inflight_hit');
      return await inFlight;
    }

    // Some callers only pass requester via hook context; ensure the underlying getKey sees it.
    const callOpts = (opts && typeof opts === 'object')
      ? (opts.requesterAddress || opts.account ? opts : { ...opts, requesterAddress: requester })
      : { requesterAddress: requester };

    const run = (async () => await getKeyUncached(callOpts))();
    inflight.set(key, run);

    try {
      const value = await run;
      cacheLruSet(
        successCache,
        key,
        { expiresAt: now + LIT_GETKEY_SUCCESS_TTL_MS, value },
        LIT_GETKEY_SUCCESS_CACHE_MAX
      );
      negativeCache.delete(key);
      return value;
    } catch (err) {
      perfDebugLitGetKey('error');

      const accFail = isAccFailure(err);
      const transient = isTransientLitError(err);
      const ttl = transient ? LIT_GETKEY_NEG_TTL_MS : (accFail ? LIT_GETKEY_ACC_NEG_TTL_MS : 0);
      if (ttl > 0) {
        cacheLruSet(
          negativeCache,
          key,
          { expiresAt: Date.now() + ttl, errMsg: resolveLitErrorMessage(err) },
          LIT_GETKEY_NEG_CACHE_MAX
        );
      }
      throw err;
    } finally {
      if (inflight.get(key) === run) inflight.delete(key);
    }
  };

  return { getKey, clearCache };
};

// Test-only export to validate caching and key scoping without initializing a real Lit client.
export const __test__wrapLitGetKeyWithCache = wrapLitGetKeyWithCache;

const resolveLitChainFallbackWarnings = new Set();

/**
 * Resolves a chain name for Lit access control conditions from chain id or explicit chain labels.
 *
 * @param {{ chainId?: number | string | null, litChain?: number | string | null, chain?: number | string | null }} [options={}]
 * @returns {string}
 */
export const resolveLitChain = ({ chainId, litChain, chain } = {}) => {
  const rawLitChain = litChain || chain;
  if (rawLitChain) {
    const numericId = Number(rawLitChain);
    if (Number.isFinite(numericId) && LIT_CHAIN_BY_ID[numericId]) {
      return LIT_CHAIN_BY_ID[numericId];
    }
    return toStr(rawLitChain);
  }
  const id = Number(chainId);
  if (Number.isFinite(id) && LIT_CHAIN_BY_ID[id]) return LIT_CHAIN_BY_ID[id];
  const hasExplicitChainInfo =
    chainId !== undefined &&
    chainId !== null &&
    String(chainId).trim() !== '';
  if (!hasExplicitChainInfo && !toStr(litChain).trim() && !toStr(chain).trim()) {
    const warningKey = 'missing-chain-info';
    if (!resolveLitChainFallbackWarnings.has(warningKey)) {
      resolveLitChainFallbackWarnings.add(warningKey);
      log.warn('[lit] resolveLitChain falling back to default chain.', {
        defaultChain: DEFAULT_LIT_CHAIN,
        chainId: null,
        litChain: null,
        chain: null,
      });
    }
  }
  return DEFAULT_LIT_CHAIN;
};

const ensureArray = (val) => (Array.isArray(val) ? val : (val ? [val] : []));

/**
 * Builds Lit access control conditions that require ownership of one or more SBT contracts.
 *
 * @param {{
 *   sbtAddress?: string | string[],
 *   sbtAddresses?: string | string[],
 *   chain?: string | number | null,
 *   litChain?: string | number | null,
 *   chainId?: number | string | null,
 *   mode?: string | number | null,
 *   requireAll?: boolean | number | string | null
 * }} [options={}]
 * @returns {LitAccessControlCondition[] | null}
 */
export const buildSbtAccessControlConditions = ({
  sbtAddress,
  sbtAddresses,
  chain,
  litChain,
  chainId,
  mode,
  requireAll,
} = {}) => {
  const addresses = ensureArray(sbtAddresses || sbtAddress).filter(Boolean);
  const resolvedChain = resolveLitChain({ chainId, litChain, chain });
  const normalizedMode = mode == null ? '' : String(mode).trim().toLowerCase();
  // SessionRegistry / on-chain gates may store mode as an enum (0=Any, 1=All). Accept both.
  const requireAllFlag = requireAll === true || requireAll === 1 || String(requireAll || '').trim() === '1';
  const isAll =
    requireAllFlag ||
    normalizedMode === 'all' ||
    normalizedMode === 'and' ||
    normalizedMode === '1';
  const operator = isAll ? 'and' : 'or';
  const conditions = addresses
    .filter((addr) => ethers.utils.isAddress(addr))
    .map((addr) => ({
      contractAddress: addr,
      standardContractType: 'ERC721',
      chain: resolvedChain,
      method: 'balanceOf',
      parameters: [':userAddress'],
      returnValueTest: { comparator: '>', value: '0' },
    }));

  if (!conditions.length) return null;
  if (conditions.length === 1) return conditions;
  const out = [];
  conditions.forEach((cond, idx) => {
    if (idx > 0) out.push({ operator });
    out.push(cond);
  });
  return out;
};

/**
 * Builds Lit access control conditions that match a specific wallet address.
 *
 * @param {{
 *   walletAddress?: string,
 *   chain?: string | number | null,
 *   litChain?: string | number | null,
 *   chainId?: number | string | null
 * }} [options={}]
 * @returns {LitAccessControlCondition[] | null}
 */
export const buildWalletAddressAccessControlConditions = ({
  walletAddress,
  chain,
  litChain,
  chainId,
} = {}) => {
  const address = toStr(walletAddress).trim().toLowerCase();
  if (!ethers.utils.isAddress(address)) return null;
  const resolvedChain = resolveLitChain({ chainId, litChain, chain });
  return [
    {
      contractAddress: '',
      standardContractType: '',
      chain: resolvedChain,
      method: '',
      parameters: [':userAddress'],
      returnValueTest: { comparator: '=', value: address.toLowerCase() },
    },
  ];
};

/**
 * Builds Lit access control conditions that require a Hats Protocol wearer check to pass.
 *
 * @param {{
 *   hatsAddress?: string,
 *   hatId?: string | number | null,
 *   chain?: string | number | null,
 *   litChain?: string | number | null,
 *   chainId?: number | string | null
 * }} [options={}]
 * @returns {LitAccessControlCondition[] | null}
 */
export const buildHatAccessControlConditions = ({
  hatsAddress,
  hatId,
  chain,
  litChain,
  chainId,
} = {}) => {
  const address = toStr(hatsAddress).trim();
  const id = toStr(hatId).trim();
  if (!address || !ethers.utils.isAddress(address) || !id) return null;
  const resolvedChain = resolveLitChain({ chainId, litChain, chain });
  return [
    {
      contractAddress: address,
      standardContractType: '',
      chain: resolvedChain,
      method: 'isWearerOfHat',
      parameters: [':userAddress', id],
      returnValueTest: { comparator: '=', value: 'true' },
    },
  ];
};

const createMemoryAuthStorage = (networkName) => {
  const authDataByAddress = new Map();
  const delegationSigByPublicKey = new Map();
  const pkpTokenIdsByAuth = new Map();

  return {
    config: { appName: LIT_AUTH_APP_NAME, networkName, type: 'memory' },
    read: async ({ address }) => authDataByAddress.get(String(address || '').toLowerCase()) || null,
    write: async ({ address, authData }) => {
      authDataByAddress.set(String(address || '').toLowerCase(), authData);
    },
    writeInnerDelegationAuthSig: async ({ publicKey, authSig }) => {
      delegationSigByPublicKey.set(String(publicKey || ''), String(authSig || ''));
    },
    readInnerDelegationAuthSig: async ({ publicKey }) => (
      delegationSigByPublicKey.get(String(publicKey || '')) || null
    ),
    writePKPTokens: async ({ authMethodType, authMethodId, tokenIds }) => {
      const key = `${String(authMethodType)}:${String(authMethodId || '')}`;
      pkpTokenIdsByAuth.set(key, Array.isArray(tokenIds) ? tokenIds : []);
    },
    readPKPTokens: async ({ authMethodType, authMethodId }) => {
      const key = `${String(authMethodType)}:${String(authMethodId || '')}`;
      return pkpTokenIdsByAuth.get(key) || null;
    },
  };
};

const authManagerByNetwork = new Map();

const getAuthManager = async (networkName) => {
  if (authManagerByNetwork.has(networkName)) {
    return authManagerByNetwork.get(networkName);
  }

  const authModule = await getLitAuthModule();
  const createAuthManager = authModule?.createAuthManager;
  if (typeof createAuthManager !== 'function') {
    throw new Error('Lit auth module missing createAuthManager export.');
  }

  // Keep Lit auth material in-memory only. The SDK localStorage plugin persists
  // session keypairs and delegation auth signatures, which extends decryption
  // capability beyond the current tab lifetime.
  const storage = createMemoryAuthStorage(networkName);

  const manager = createAuthManager({ storage });
  authManagerByNetwork.set(networkName, manager);
  return manager;
};

let litClientPromise = null;
let litClientKey = null;
let litClientInstance = null;
const nagaRootKeyMaterialPromiseByNetwork = new Map();

const resolveLitNetworkModule = async ({ litNetwork, rpcUrl } = {}) => {
  const resolvedNetwork = resolveLitNetwork(litNetwork);
  const networksModule = await getLitNetworksModule();
  const naga = networksModule?.naga;
  const nagaDev = networksModule?.nagaDev;
  const nagaTest = networksModule?.nagaTest;
  const networkByName = {
    'naga-dev': nagaDev,
    'naga-test': nagaTest,
    naga,
  };

  if (resolvedNetwork === 'custom') {
    if (!rpcUrl) {
      throw new Error('Custom Lit network requires rpcUrl.');
    }
    if (!nagaDev || typeof nagaDev.withOverrides !== 'function') {
      throw new Error('Lit networks module missing nagaDev.withOverrides.');
    }
    return nagaDev.withOverrides({ rpcUrl });
  }
  const baseNetwork = networkByName[resolvedNetwork];
  if (!baseNetwork) {
    throw new Error(`Unsupported Lit network "${resolvedNetwork}".`);
  }
  if (rpcUrl && typeof baseNetwork.withOverrides === 'function') {
    return baseNetwork.withOverrides({ rpcUrl });
  }
  return baseNetwork;
};

const resolveNetworkRpcUrl = (networkModule) => {
  try {
    if (networkModule && typeof networkModule.getRpcUrl === 'function') {
      return networkModule.getRpcUrl();
    }
  } catch (e) { log.warn('litProtocol: fallback', e); }
  return null;
};

const normalizeHexNoPrefix = (value) => {
  const raw = toStr(value).trim();
  if (!raw) return '';
  return raw.startsWith('0x') ? raw.slice(2) : raw;
};

const normalizeAddressLower = (value) => toStr(value).trim().toLowerCase();
const NAGA_ROOT_KEY_LOG_SCAN_BLOCKS = 50000n;

const normalizeBlockNumberBigInt = (value, fallback = 0n) => {
  if (typeof value === 'bigint') return value >= 0n ? value : fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  const bigIntCtor = (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.BigInt === 'function'
  ) ? globalThis.BigInt : null;
  if (!bigIntCtor) return fallback;
  return bigIntCtor(Math.floor(num));
};

const readLatestRootKeyTypeFromLog = ({ log, latestByType, targetStaking } = {}) => {
  if (!(latestByType instanceof Map)) return;
  if (normalizeAddressLower(log?.args?.stakingContract) !== targetStaking) return;
  const keyType = Number(log?.args?.rootKey?.keyType);
  if (!Number.isFinite(keyType)) return;
  const pubkey = normalizeHexNoPrefix(log?.args?.rootKey?.pubkey);
  if (!pubkey) return;
  const blockNumber = normalizeBlockNumberBigInt(log?.blockNumber, 0n);
  const current = latestByType.get(keyType);
  if (!current || blockNumber > current.blockNumber) {
    latestByType.set(keyType, { blockNumber, values: [pubkey] });
    return;
  }
  if (blockNumber === current.blockNumber) {
    current.values.push(pubkey);
  }
};

const hasLatestRootKeyTypes = (latestByType, types = []) => (
  ensureArray(types)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .every((value) => latestByType.has(value))
);

const scanNagaRootKeySetLogsReverse = async ({
  publicClient,
  pubkeyRouterAddress,
  rootKeySetEvent,
  stakingAddress,
  blockChunkSize = NAGA_ROOT_KEY_LOG_SCAN_BLOCKS,
} = {}) => {
  if (!publicClient || typeof publicClient.getBlockNumber !== 'function' || typeof publicClient.getLogs !== 'function') {
    throw new Error('Lit root key scan requires a public client with getBlockNumber/getLogs.');
  }

  const chunkSize = normalizeBlockNumberBigInt(blockChunkSize, NAGA_ROOT_KEY_LOG_SCAN_BLOCKS) || NAGA_ROOT_KEY_LOG_SCAN_BLOCKS;
  const latestByType = new Map();
  const targetStaking = normalizeAddressLower(stakingAddress);
  let toBlock = normalizeBlockNumberBigInt(await publicClient.getBlockNumber(), 0n);

  while (toBlock >= 0n) {
    const fromBlock = toBlock >= (chunkSize - 1n)
      ? (toBlock - chunkSize + 1n)
      : 0n;
    const logs = await publicClient.getLogs({
      address: pubkeyRouterAddress,
      event: rootKeySetEvent,
      fromBlock,
      toBlock,
    });

    (Array.isArray(logs) ? logs : []).forEach((log) => {
      readLatestRootKeyTypeFromLog({ log, latestByType, targetStaking });
    });

    if (hasLatestRootKeyTypes(latestByType, [NAGA_ROOT_KEY_TYPE_SUBNET, NAGA_ROOT_KEY_TYPE_HD_ROOT])) {
      break;
    }
    if (fromBlock === 0n) break;
    toBlock = fromBlock - 1n;
  }

  return latestByType;
};

const cloneLitNetworkModule = (networkModule) => {
  if (!networkModule || typeof networkModule.withOverrides !== 'function') {
    return networkModule;
  }
  try {
    return networkModule.withOverrides({ rpcUrl: resolveNetworkRpcUrl(networkModule) || undefined });
  } catch (_) {
    return networkModule;
  }
};

const resolveRootKeyMaterialFromChain = async ({ resolvedNetwork, networkModule }) => {
  if (resolvedNetwork !== 'naga-dev') {
    throw new Error(`Root key material resolver is unavailable for network "${resolvedNetwork}".`);
  }
  const contractsModule = await getLitContractsModule();
  const signatures = contractsModule?.nagaDevSignatures;
  const rootKeySetEvent = signatures?.PubkeyRouter?.events?.find((entry) => entry?.name === 'RootKeySet');
  const pubkeyRouterAddress = signatures?.PubkeyRouter?.address;
  const stakingAddress = signatures?.Staking?.address;
  const rpcUrl = resolveNetworkRpcUrl(networkModule);
  const chainConfig = networkModule?.getChainConfig?.();

  if (!rootKeySetEvent || !pubkeyRouterAddress || !stakingAddress || !rpcUrl || !chainConfig) {
    throw new Error('Unable to resolve naga-dev root key metadata from Lit contracts/network module.');
  }

  const publicClient = createPublicClient({
    chain: chainConfig,
    transport: http(rpcUrl),
  });
  const latestByType = await scanNagaRootKeySetLogsReverse({
    publicClient,
    pubkeyRouterAddress,
    rootKeySetEvent,
    stakingAddress,
  });

  const subnetKeys = Array.from(
    new Set((latestByType.get(NAGA_ROOT_KEY_TYPE_SUBNET)?.values || []).filter(Boolean))
  );
  if (!subnetKeys.length) {
    throw new Error('Lit naga-dev root key event logs are missing keyType=1 (subnet key).');
  }
  const hdRootPubkeys = Array.from(
    new Set((latestByType.get(NAGA_ROOT_KEY_TYPE_HD_ROOT)?.values || []).filter(Boolean))
  );

  return {
    subnetPublicKey: subnetKeys[0],
    hdRootPubkeys,
  };
};

export const __test__scanNagaRootKeySetLogsReverse = scanNagaRootKeySetLogsReverse;

const getCachedRootKeyMaterial = async ({ resolvedNetwork, networkModule }) => {
  const cacheKey = `${resolvedNetwork}::${resolveNetworkRpcUrl(networkModule) || ''}`;
  if (nagaRootKeyMaterialPromiseByNetwork.has(cacheKey)) {
    return nagaRootKeyMaterialPromiseByNetwork.get(cacheKey);
  }
  const loadPromise = resolveRootKeyMaterialFromChain({ resolvedNetwork, networkModule }).catch((err) => {
    nagaRootKeyMaterialPromiseByNetwork.delete(cacheKey);
    throw err;
  });
  nagaRootKeyMaterialPromiseByNetwork.set(cacheKey, loadPromise);
  return loadPromise;
};

const createNagaHandshakeV1Schema = ({ rootKeys }) => ({
  parse: (rawResponse) => {
    const payload = rawResponse?.data && typeof rawResponse.data === 'object'
      ? rawResponse.data
      : rawResponse;
    const latestBlockhash = toStr(payload?.latestBlockhash).trim();
    const nodeIdentityKey = toStr(payload?.nodeIdentityKey).trim();
    if (!latestBlockhash || !nodeIdentityKey) {
      throw new Error('Lit handshake response is missing latestBlockhash or nodeIdentityKey.');
    }

    const keySetEpochRaw = payload?.keySets?.[NAGA_DEFAULT_KEY_SET_ID]?.epoch;
    const keySetEpoch = Number(keySetEpochRaw ?? payload?.epoch ?? 0);
    const subnetFromResponse = normalizeHexNoPrefix(
      payload?.subnetPublicKey ||
      payload?.serverPublicKey ||
      payload?.networkPublicKey ||
      payload?.networkPublicKeySet
    );
    const subnetPublicKey = (
      subnetFromResponse && subnetFromResponse.toUpperCase() !== 'ERR'
        ? subnetFromResponse
        : rootKeys.subnetPublicKey
    );
    const hdRootPubkeys = Array.from(
      new Set(
        (
          Array.isArray(payload?.hdRootPubkeys) && payload.hdRootPubkeys.length
            ? payload.hdRootPubkeys
            : rootKeys.hdRootPubkeys
        )
          .map(normalizeHexNoPrefix)
          .filter(Boolean)
      )
    );

    const normalized = {
      serverPublicKey: subnetPublicKey,
      subnetPublicKey,
      networkPublicKey: subnetPublicKey,
      networkPublicKeySet: subnetPublicKey,
      clientSdkVersion: toStr(payload?.clientSdkVersion).trim() || '8.0.0-naga-dev',
      hdRootPubkeys,
      attestation: payload?.attestation ?? null,
      latestBlockhash,
      nodeVersion: toStr(payload?.nodeVersion).trim() || 'unknown',
      nodeIdentityKey,
      epoch: Number.isFinite(keySetEpoch) ? keySetEpoch : 0,
    };

    return {
      parseData: () => normalized,
    };
  },
});

const withPatchedHandshakeFetch = async ({ handshakeKeySetId, run }) => {
  if (!handshakeKeySetId || typeof globalThis.fetch !== 'function') {
    return run();
  }
  const originalFetch = globalThis.fetch.bind(globalThis);
  const patchedFetch = async (input, init) => {
    const urlText = typeof input === 'string' ? input : (input?.url || '');
    if (!urlText) return originalFetch(input, init);
    let pathname = '';
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
      pathname = new URL(urlText, base).pathname;
    } catch (_) {
      pathname = '';
    }
    if (!/\/web\/handshake\/v1\/?$/.test(pathname)) {
      return originalFetch(input, init);
    }

    const method = toStr(init?.method || (typeof input === 'object' ? input?.method : '') || 'GET').toUpperCase();
    if (method !== 'POST') {
      return originalFetch(input, init);
    }

    if (typeof init?.body !== 'string') {
      return originalFetch(input, init);
    }

    let parsedBody = null;
    try {
      parsedBody = JSON.parse(init.body);
    } catch (_) {
      parsedBody = null;
    }
    if (!parsedBody || typeof parsedBody !== 'object') {
      return originalFetch(input, init);
    }
    if (!parsedBody.keySetId) parsedBody.keySetId = handshakeKeySetId;
    if (!parsedBody.keySetIdentifier) parsedBody.keySetIdentifier = handshakeKeySetId;
    return originalFetch(input, {
      ...(init || {}),
      body: JSON.stringify(parsedBody),
    });
  };

  globalThis.fetch = patchedFetch;
  if (typeof window !== 'undefined') {
    window.fetch = patchedFetch;
  }
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof window !== 'undefined') {
      window.fetch = originalFetch;
    }
  }
};

const prepareNetworkModuleForHandshake = async ({ resolvedNetwork, networkModule }) => {
  if (!NAGA_HANDSHAKE_V1_NETWORKS.has(resolvedNetwork)) {
    return { networkModule, handshakeKeySetId: null };
  }

  const compatibleModule = cloneLitNetworkModule(networkModule);
  const endpoints = compatibleModule?.getEndpoints?.();
  const handshakeInput = compatibleModule?.api?.handshake?.schemas?.Input;
  if (!endpoints?.HANDSHAKE || !handshakeInput) {
    return { networkModule: compatibleModule, handshakeKeySetId: null };
  }

  const rootKeys = await getCachedRootKeyMaterial({
    resolvedNetwork,
    networkModule: compatibleModule,
  });

  endpoints.HANDSHAKE.version = '/v1';
  handshakeInput.ResponseData = createNagaHandshakeV1Schema({ rootKeys });

  logLit('info', '[lit] naga handshake compat enabled', {
    litNetwork: resolvedNetwork,
    handshakeVersion: '/v1',
    keySetId: NAGA_DEFAULT_KEY_SET_ID,
    hdRootCount: rootKeys.hdRootPubkeys.length,
  });

  return {
    networkModule: compatibleModule,
    handshakeKeySetId: NAGA_DEFAULT_KEY_SET_ID,
  };
};

const getLitClient = async (opts = {}) => {
  ensureLitBufferCompatibility();
  const { litNetwork, connectTimeout, litConnectTimeout, rpcUrl } = opts || {};
  const resolvedNetwork = resolveLitNetwork(litNetwork);
  const resolvedConnectTimeout = normalizeConnectTimeout(connectTimeout || litConnectTimeout);
  const networkModule = await resolveLitNetworkModule({ litNetwork: resolvedNetwork, rpcUrl });
  const rpc = resolveNetworkRpcUrl(networkModule);
  const nextClientKey = `${resolvedNetwork}::${rpc || ''}`;

  if (litClientPromise && litClientKey === nextClientKey) return litClientPromise;

  if (litClientInstance && litClientKey && litClientKey !== nextClientKey) {
    try {
      if (typeof litClientInstance.disconnect === 'function') {
        litClientInstance.disconnect();
      }
    } catch (e) { log.warn('litProtocol: cleanup', e); }
  }

  litClientKey = nextClientKey;
  litClientPromise = (async () => {
    const connectStartedAt = Date.now();
    const getPhaseTimeout = (phaseLabel) => {
      const elapsed = Date.now() - connectStartedAt;
      const remaining = resolvedConnectTimeout - elapsed;
      if (remaining <= 0) {
        throw new Error(`Lit connect timed out during ${phaseLabel} after ${resolvedConnectTimeout}ms.`);
      }
      return Math.max(1, Math.ceil(remaining));
    };

    logLit('info', '[lit] connect start', {
      litNetwork: resolvedNetwork,
      connectTimeout: resolvedConnectTimeout,
      rpcUrl: rpc || null,
    });
    const prepared = await runWithTimeout({
      run: () => prepareNetworkModuleForHandshake({
        resolvedNetwork,
        networkModule,
      }),
      timeoutMs: getPhaseTimeout('handshake bootstrap'),
      timeoutMessage: `Lit connect timed out during handshake bootstrap after ${resolvedConnectTimeout}ms.`,
    });
    const client = await withPatchedHandshakeFetch({
      handshakeKeySetId: prepared.handshakeKeySetId,
      run: () => createLitClientWithTimeout({
        network: prepared.networkModule,
        timeoutMs: getPhaseTimeout('client initialization'),
      }),
    });
    litClientInstance = client;
    logLit('info', '[lit] connect ok', { litNetwork: resolvedNetwork });
    return client;
  })().catch((err) => {
    logLit('error', '[lit] connect failed', {
      litNetwork: resolvedNetwork,
      connectTimeout: resolvedConnectTimeout,
      rpcUrl: rpc || null,
      message: err?.message || err,
    });
    litClientPromise = null;
    litClientKey = null;
    litClientInstance = null;
    throw err;
  });
  return litClientPromise;
};

const resolveProvider = (providerLike) => {
  const provider = cryptoUtils._getProvider(providerLike);
  if (!provider || typeof provider.request !== 'function') {
    throw new Error('Lit requires an EIP-1193 provider to sign.');
  }
  return provider;
};

const resolveWalletClient = async (providerLike) => {
  const provider = resolveProvider(providerLike);
  const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
  const signer = ethersProvider.getSigner();
  const address = await signer.getAddress();
  return createWalletClient({
    account: address,
    transport: custom(provider),
  });
};

const LIT_ABILITY_ALIASES = Object.freeze({
  'access-control-condition-decryption': 'access-control-condition-decryption',
  accesscontrolconditiondecryption: 'access-control-condition-decryption',
  AccessControlConditionDecryption: 'access-control-condition-decryption',
  'access-control-condition-signing': 'access-control-condition-signing',
  accesscontrolconditionsigning: 'access-control-condition-signing',
  AccessControlConditionSigning: 'access-control-condition-signing',
  'pkp-signing': 'pkp-signing',
  pkpsigning: 'pkp-signing',
  PKPSigning: 'pkp-signing',
  'lit-payment-delegation': 'lit-payment-delegation',
  paymentdelegation: 'lit-payment-delegation',
  PaymentDelegation: 'lit-payment-delegation',
  'lit-action-execution': 'lit-action-execution',
  litactionexecution: 'lit-action-execution',
  LitActionExecution: 'lit-action-execution',
});

const toLitAbility = (ability) => {
  const raw = toStr(ability).trim();
  if (!raw) return null;
  return LIT_ABILITY_ALIASES[raw] || LIT_ABILITY_ALIASES[raw.replace(/[-_]/g, '')] || null;
};

const toResourceWildcard = (resource) => {
  if (resource == null) return '*';
  if (typeof resource === 'string') {
    const trimmed = resource.trim();
    return trimmed || '*';
  }
  if (typeof resource?.resource === 'string' && resource.resource.trim()) {
    return resource.resource.trim();
  }
  if (typeof resource?.toString === 'function') {
    const text = toStr(resource.toString()).trim();
    if (text.includes('://')) return '*';
    return text || '*';
  }
  return '*';
};

// Lit decrypt uses the ENCRYPTION_SIGN endpoint under the hood, which requires both
// decryption and signing capabilities on the session.
const DEFAULT_LIT_RESOURCES = Object.freeze([
  ['access-control-condition-decryption', '*'],
  ['access-control-condition-signing', '*'],
]);

const resolveLitResources = (resourceAbilityRequests) => {
  if (!Array.isArray(resourceAbilityRequests) || !resourceAbilityRequests.length) {
    return DEFAULT_LIT_RESOURCES;
  }

  const mapped = resourceAbilityRequests
    .map((item) => {
      if (Array.isArray(item)) {
        const ability = toLitAbility(item[0]);
        const resource = toResourceWildcard(item[1]);
        return ability ? [ability, resource] : null;
      }
      const ability = toLitAbility(item?.ability);
      const resource = toResourceWildcard(item?.resource);
      return ability ? [ability, resource] : null;
    })
    .filter(Boolean);

  return mapped.length ? mapped : DEFAULT_LIT_RESOURCES;
};

const normalizeUserMaxPrice = (value) => {
  if (typeof value === 'bigint') return value;
  const raw = toStr(value).trim();
  if (!raw) return undefined;
  const parseBigInt = (
    typeof globalThis !== 'undefined' && typeof globalThis.BigInt === 'function'
  )
    ? globalThis.BigInt
    : null;
  if (!parseBigInt) return undefined;
  try {
    const parsed = parseBigInt(raw);
    return parsed >= 0n ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const shouldUseSponsoredLitDelegation = (paymentDelegation = {}) => {
  if (!paymentDelegation || typeof paymentDelegation !== 'object') return false;
  if (toStr(paymentDelegation.bootstrapLitPayerPrivateKey).trim()) return true;
  return paymentDelegation.enabled === true || paymentDelegation.sponsored === true;
};

// Regression guard: createLitHooks can receive bootstrap payer keys for worker
// delegation, but returned hooks may be published on window.__litHooks.
// Strip secret-only fields before exposing hook metadata outside this module.
const sanitizePublicPaymentDelegation = (paymentDelegation) => {
  if (!paymentDelegation || typeof paymentDelegation !== 'object') return paymentDelegation;
  const { bootstrapLitPayerPrivateKey, ...rest } = paymentDelegation;
  return Object.keys(rest).length ? rest : undefined;
};

const sanitizePublicLitHooks = (hooks = {}) => {
  if (!hooks || typeof hooks !== 'object') return hooks;
  if (!Object.prototype.hasOwnProperty.call(hooks, 'paymentDelegation')) return hooks;
  return {
    ...hooks,
    paymentDelegation: sanitizePublicPaymentDelegation(hooks.paymentDelegation),
  };
};

const buildLitPaymentDelegationAudience = () => {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return toStr(window.location.origin).trim();
    }
  } catch (_) {}
  return '';
};

const resolveDelegationWorkerUrl = (value) => {
  if (typeof value !== 'string') return '';
  const normalized = normalizeWorkerUrl(value);
  if (!normalized) return '';
  try {
    return new URL(normalized).toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
};

const requestLitPaymentDelegationAuthSig = async ({
  sessionPublicKey,
  litNetwork,
  paymentDelegation,
  context,
} = {}) => {
  const delegation = paymentDelegation && typeof paymentDelegation === 'object' ? paymentDelegation : {};
  if (!shouldUseSponsoredLitDelegation(delegation)) return null;

  const sessionSlug = toStr(delegation.sessionSlug).trim();
  const sessionConfig = delegation.sessionConfig && typeof delegation.sessionConfig === 'object'
    ? delegation.sessionConfig
    : null;
  const bootstrapLitPayerPrivateKey = toStr(delegation.bootstrapLitPayerPrivateKey).trim();
  const explicitWorkerUrl = resolveDelegationWorkerUrl(delegation.workerUrl);
  const workerUrl = toStr(
    explicitWorkerUrl || await getCorsProxyUrlOrThrow({
      sessionSlug,
      sessionConfig,
      context,
      allowDemoFallback: delegation.allowDemoFallback,
    })
  ).trim();
  if (!workerUrl) {
    throw new Error('Lit sponsorship worker URL is missing.');
  }

  const audience = buildLitPaymentDelegationAudience();
  if (bootstrapLitPayerPrivateKey) {
    const adminAuth = await buildSignedBootstrapAdminAuth({
      slug: sessionSlug,
      workerUrl,
      statement: 'Admin request: bootstrap lit payment delegation',
      context,
    });
    const response = await fetch(`${workerUrl.replace(/\/+$/, '')}/lit/payment-delegation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...adminAuth,
        sessionSlug,
        sessionPublicKey,
        litNetwork,
        litPayerPrivateKey: bootstrapLitPayerPrivateKey,
        expiresAt: new Date(Date.now() + DEFAULT_LIT_PAYMENT_DELEGATION_TTL_MS).toISOString(),
        audience,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to bootstrap Lit payment delegation.');
    }
    return data?.capabilityAuthSig || null;
  }

  const response = await fetchWorkerWithAuth(
    `${workerUrl.replace(/\/+$/, '')}/lit/payment-delegation`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionPublicKey,
        litNetwork,
        expiresAt: new Date(Date.now() + DEFAULT_LIT_PAYMENT_DELEGATION_TTL_MS).toISOString(),
        audience,
      }),
    },
    {
      sessionSlug,
      sessionConfig,
      context,
      workerUrl,
      allowDemoFallback: delegation.allowDemoFallback,
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to load Lit payment delegation.');
  }
  return data?.capabilityAuthSig || null;
};

const getAuthContext = async ({
  litClient,
  providerLike,
  chain,
  resourceAbilityRequests,
  litNetwork,
  paymentDelegation,
  context,
} = {}) => {
  ensureLitBufferCompatibility();
  const resources = resolveLitResources(resourceAbilityRequests);

  logLit('info', '[lit] session start', {
    litNetwork: litNetwork || null,
    chain: chain || null,
    resourceCount: resources.length,
  });

  try {
    const walletClient = await resolveWalletClient(providerLike);
    const authManager = await getAuthManager(litNetwork || DEFAULT_LIT_NETWORK);
    const authContext = await authManager.createEoaAuthContext({
      config: { account: walletClient },
      authConfig: {
        domain: (typeof window !== 'undefined' && window.location?.host) ? window.location.host : 'localhost',
        statement: 'Authorize Lit session',
        resources,
        expiration: new Date(Date.now() + DEFAULT_LIT_SESSION_TTL_MS).toISOString(),
      },
      litClient,
    });
    const sessionPublicKey = toStr(authContext?.sessionKeyPair?.publicKey).trim();
    const capabilityAuthSig = await requestLitPaymentDelegationAuthSig({
      sessionPublicKey,
      litNetwork: litNetwork || DEFAULT_LIT_NETWORK,
      paymentDelegation,
      context,
    }).catch((error) => {
      if (!shouldUseSponsoredLitDelegation(paymentDelegation)) return null;
      throw error;
    });
    if (capabilityAuthSig) {
      authContext.authConfig = {
        ...(authContext.authConfig || {}),
        capabilityAuthSigs: [
          ...(
            Array.isArray(authContext?.authConfig?.capabilityAuthSigs)
              ? authContext.authConfig.capabilityAuthSigs
              : []
          ),
          capabilityAuthSig,
        ],
      };
    }
    logLit('info', '[lit] session ok', { litNetwork: litNetwork || null, chain: chain || null });
    return authContext;
  } catch (err) {
    logLit('error', '[lit] session failed', {
      litNetwork: litNetwork || null,
      chain: chain || null,
      message: err?.message || err,
    });
    throw err;
  }
};

let e2eLitMockMasterKeyPromise = null;
const getE2eLitMockMasterKey = async () => {
  if (e2eLitMockMasterKeyPromise) return e2eLitMockMasterKeyPromise;
  e2eLitMockMasterKeyPromise = (async () => {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      throw new Error('Lit mock requires WebCrypto support.');
    }
    const seed = new TextEncoder().encode('ce-e2e-lit-mock-master-key-v1');
    const digest = await window.crypto.subtle.digest('SHA-256', seed);
    return window.crypto.subtle.importKey(
      'raw',
      digest,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  })();
  return e2eLitMockMasterKeyPromise;
};

const e2eLitMockEncodePayload = async (keyBytes) => {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Lit mock requires WebCrypto support.');
  }
  const master = await getE2eLitMockMasterKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, master, keyBytes);
  const cipherBytes = new Uint8Array(cipherBuf);

  const payloadObj = {
    v: 1,
    alg: 'aes-gcm-256',
    iv: Buffer.from(iv).toString('base64'),
    ciphertext: Buffer.from(cipherBytes).toString('base64'),
  };
  const payloadJson = JSON.stringify(payloadObj);
  const payloadBytes = new TextEncoder().encode(payloadJson);
  const hashBuf = await window.crypto.subtle.digest('SHA-256', payloadBytes);

  return {
    ciphertext: Buffer.from(payloadBytes).toString('base64'),
    dataToEncryptHash: `0x${Buffer.from(new Uint8Array(hashBuf)).toString('hex')}`,
  };
};

const e2eLitMockDecodePayload = async (ciphertextB64) => {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Lit mock requires WebCrypto support.');
  }
  const rawBytes = new Uint8Array(Buffer.from(String(ciphertextB64 || ''), 'base64'));
  const payloadJson = new TextDecoder().decode(rawBytes);
  const payload = JSON.parse(payloadJson || '{}');
  const iv = new Uint8Array(Buffer.from(String(payload?.iv || ''), 'base64'));
  const ct = new Uint8Array(Buffer.from(String(payload?.ciphertext || ''), 'base64'));
  if (!iv.length || !ct.length) {
    throw new Error('Lit mock payload malformed.');
  }
  const master = await getE2eLitMockMasterKey();
  const plainBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, master, ct);
  return new Uint8Array(plainBuf);
};

const e2eLitMockParseConditions = (conditions) => {
  const list = Array.isArray(conditions) ? conditions : [];
  let operator = null;
  const checks = [];

  for (const cond of list) {
    if (!cond || typeof cond !== 'object') continue;
    if (cond.operator) {
      const op = toStr(cond.operator).trim().toLowerCase();
      if (op === 'and' || op === 'or') operator = operator || op;
      continue;
    }
    const method = toStr(cond.method).trim().toLowerCase();
    const addr = toStr(cond.contractAddress).trim();
    const comparator = toStr(cond.returnValueTest?.comparator).trim();
    const value = toStr(cond.returnValueTest?.value).trim().toLowerCase();
    const parameters = Array.isArray(cond.parameters) ? cond.parameters.map((entry) => toStr(entry).trim()) : [];
    if (method === 'balanceof' && ethers.utils.isAddress(addr)) {
      checks.push({ type: 'erc721-balance', address: addr.toLowerCase() });
      continue;
    }
    if (!addr && !method && parameters[0] === ':userAddress' && (comparator === '=' || comparator === '==') && ethers.utils.isAddress(value)) {
      checks.push({ type: 'wallet-address', address: value });
    }
  }

  return {
    operator: operator || 'or',
    checks,
  };
};

const e2eLitMockCheckAccessControlConditions = async ({ requesterAddress, conditions, providerLike }) => {
  if (!Array.isArray(conditions) || !conditions.length) return false;
  const req = toStr(requesterAddress).trim();
  if (!ethers.utils.isAddress(req)) return false;

  const parsed = e2eLitMockParseConditions(conditions);
  if (!parsed.checks.length) {
    // Fail closed for unknown/unhandled conditions to avoid false-positive decrypts.
    return false;
  }

  const provider = cryptoUtils._getProvider(providerLike);
  const ethersProvider = new ethers.providers.Web3Provider(provider, 'any');
  const abi = ['function balanceOf(address owner) view returns (uint256)'];

  const checks = [];
  for (const check of parsed.checks) {
    if (check?.type === 'wallet-address') {
      checks.push(check.address === req.toLowerCase());
      continue;
    }
    if (check?.type === 'erc721-balance' && ethers.utils.isAddress(check.address)) {
      // eslint-disable-next-line no-await-in-loop
      const balance = await new ethers.Contract(check.address, abi, ethersProvider).balanceOf(req);
      checks.push(ethers.BigNumber.isBigNumber(balance) ? balance.gt(0) : Number(balance || 0) > 0);
    }
  }

  const requireAll = parsed.operator === 'and';
  return requireAll ? checks.every(Boolean) : checks.some(Boolean);
};

const createE2eLitMockHooks = ({
  providerLike,
  account,
  chainId,
  litChain,
  litNetwork,
  userMaxPrice,
  paymentDelegation,
  accessControlConditions,
  resourceAbilityRequests,
  connectTimeout,
  litConnectTimeout,
} = {}) => {
  ensureLitBufferCompatibility();
  const resolvedChain = resolveLitChain({ chainId, litChain });
  const resolvedNetwork = resolveLitNetwork(litNetwork);
  const resolvedConnectTimeout = normalizeConnectTimeout(connectTimeout || litConnectTimeout);
  const baseConditions = Array.isArray(accessControlConditions) ? accessControlConditions : null;

  const saveKey = async (symmetricKey, opts = {}) => {
    ensureLitBufferCompatibility();
    const conditions = Array.isArray(opts.accessControlConditions)
      ? opts.accessControlConditions
      : baseConditions;
    if (!conditions || !conditions.length) {
      throw new Error('Lit mock saveKey requires access control conditions.');
    }
    const keyBytes = symmetricKey instanceof Uint8Array ? symmetricKey : new Uint8Array(symmetricKey || []);
    if (!keyBytes.length) throw new Error('Lit mock saveKey requires key bytes.');
    return e2eLitMockEncodePayload(keyBytes);
  };

  const getKeyUncached = async (opts = {}) => {
    ensureLitBufferCompatibility();
    const effectiveProviderLike = opts.providerLike || providerLike;
    const requester = toStr(opts.requesterAddress || opts.account || account || '').trim();
    const rawConditions = Array.isArray(opts.accessControlConditions) ? opts.accessControlConditions : baseConditions;
    if (!rawConditions || !rawConditions.length) {
      throw new Error('Lit mock getKey requires access control conditions.');
    }
    const conditions = normalizeAccessControlConditions(
      rawConditions,
      opts.chain || resolvedChain
    );

    const allowed = await e2eLitMockCheckAccessControlConditions({
      requesterAddress: requester,
      conditions,
      providerLike: effectiveProviderLike,
    });
    if (!allowed) {
      throw new Error('Lit mock: access control conditions not satisfied.');
    }

    const ciphertext = toStr(opts.ciphertext || '').trim();
    if (!ciphertext) {
      throw new Error('Lit mock getKey requires ciphertext.');
    }

    const cekBytes = await e2eLitMockDecodePayload(ciphertext);
    if (!(cekBytes instanceof Uint8Array) || cekBytes.length !== 32) {
      throw new Error('Lit mock unwrapped key has invalid length.');
    }
    return cekBytes;
  };

  const { getKey, clearCache } = wrapLitGetKeyWithCache(getKeyUncached, {
    account,
    litNetwork: resolvedNetwork,
    chain: resolvedChain,
    accessControlConditions: baseConditions,
  });

  return sanitizePublicLitHooks({
    saveKey,
    getKey,
    clearCache,
    accessControlConditions: baseConditions,
    litChain: resolvedChain,
    litNetwork: resolvedNetwork,
    chain: resolvedChain,
    providerLike,
    connectTimeout: resolvedConnectTimeout,
    resourceAbilityRequests,
    userMaxPrice: normalizeUserMaxPrice(userMaxPrice),
    paymentDelegation,
    __e2eMock: true,
  });
};

/**
 * Creates Lit helper hooks for saving and retrieving symmetric keys under access control conditions.
 *
 * @param {{
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   litChain?: string | number | null,
 *   litNetwork?: string | null,
 *   userMaxPrice?: unknown,
 *   paymentDelegation?: Record<string, any>,
 *   accessControlConditions?: LitAccessControlCondition[],
 *   resourceAbilityRequests?: unknown,
 *   connectTimeout?: number | string | null,
 *   litConnectTimeout?: number | string | null
 * }} [options={}]
 * @returns {LitHooksApi}
 */
export const createLitHooks = ({
  providerLike,
  account,
  chainId,
  litChain,
  litNetwork,
  userMaxPrice,
  paymentDelegation,
  accessControlConditions,
  resourceAbilityRequests,
  connectTimeout,
  litConnectTimeout,
} = {}) => {
  ensureLitBufferCompatibility();
  const resolvedChain = resolveLitChain({ chainId, litChain });
  const resolvedNetwork = resolveLitNetwork(litNetwork);
  const resolvedConnectTimeout = normalizeConnectTimeout(connectTimeout || litConnectTimeout);
  const resolvedUserMaxPrice = normalizeUserMaxPrice(userMaxPrice);
  const baseConditions = Array.isArray(accessControlConditions) ? accessControlConditions : null;

  if (isE2eLitMockEnabled()) {
    return createE2eLitMockHooks({
      providerLike,
      account,
      chainId,
      litChain: resolvedChain,
      litNetwork: resolvedNetwork,
      userMaxPrice: resolvedUserMaxPrice,
      paymentDelegation,
      accessControlConditions: baseConditions || undefined,
      resourceAbilityRequests,
      connectTimeout: resolvedConnectTimeout,
    });
  }

  logLit('info', '[lit] hooks init', {
    litNetwork: resolvedNetwork,
    chain: resolvedChain,
    conditionCount: baseConditions ? baseConditions.length : 0,
    connectTimeout: resolvedConnectTimeout,
  });

  const getSession = async (override = {}) => {
    const effectiveNetwork = resolveLitNetwork(override.litNetwork || resolvedNetwork);
    const client = await getLitClient({
      litNetwork: effectiveNetwork,
      connectTimeout: override.connectTimeout || resolvedConnectTimeout,
      rpcUrl: override.rpcUrl,
    });
    return getAuthContext({
      litClient: client,
      providerLike: override.providerLike || providerLike,
      chain: override.chain || resolvedChain,
      resourceAbilityRequests: override.resourceAbilityRequests || resourceAbilityRequests,
      litNetwork: effectiveNetwork,
      paymentDelegation: override.paymentDelegation || paymentDelegation,
      context: {
        account: override.account || account,
        providerLike: override.providerLike || providerLike,
        chainId,
      },
    });
  };

  const saveKey = async (symmetricKey, opts = {}) => {
    const conditions = Array.isArray(opts.accessControlConditions)
      ? opts.accessControlConditions
      : baseConditions;
    if (!conditions || !conditions.length) {
      throw new Error('Lit saveKey requires access control conditions.');
    }
    const chain = opts.chain || resolvedChain;
    const timeout = normalizeConnectTimeout(opts.connectTimeout || resolvedConnectTimeout);
    const effectiveNetwork = resolveLitNetwork(opts.litNetwork || resolvedNetwork);
    const effectiveUserMaxPrice = normalizeUserMaxPrice(opts.userMaxPrice) ?? resolvedUserMaxPrice;
    logLit('info', '[lit] saveKey start', {
      litNetwork: effectiveNetwork,
      chain,
      connectTimeout: timeout,
      conditionCount: conditions.length,
      hasResourceId: !!opts.resourceId,
    });
    let client;
    try {
      client = await getLitClient({
        litNetwork: effectiveNetwork,
        connectTimeout: timeout,
        rpcUrl: opts.rpcUrl,
      });
    } catch (err) {
      logLit('error', '[lit] saveKey connect failed', {
        litNetwork: effectiveNetwork,
        chain,
        connectTimeout: timeout,
        message: err?.message || err,
      });
      throw err;
    }
    const keyBytes = symmetricKey instanceof Uint8Array ? symmetricKey : new Uint8Array(symmetricKey || []);

    // Lit encrypt (saving the wrapped CEK) requires an authenticated session; without it Lit nodes
    // can return 401s from the ENCRYPTION_SIGN endpoint (seen in no-mock E2E runs).
    const authContext = await getSession({
      chain,
      connectTimeout: timeout,
      providerLike: opts.providerLike,
      resourceAbilityRequests: opts.resourceAbilityRequests,
      litNetwork: effectiveNetwork,
      rpcUrl: opts.rpcUrl,
      paymentDelegation: opts.paymentDelegation || paymentDelegation,
      account: opts.account || account,
    });

    try {
      const { ciphertext, dataToEncryptHash } = await client.encrypt({
        accessControlConditions: conditions,
        chain,
        dataToEncrypt: keyBytes,
        ...(effectiveUserMaxPrice !== undefined ? { userMaxPrice: effectiveUserMaxPrice } : {}),
        ...(opts.resourceId ? { resourceId: opts.resourceId } : {}),
        authContext,
      });
      if (!ciphertext || !dataToEncryptHash) {
        throw new Error('Lit encrypt did not return ciphertext/dataToEncryptHash.');
      }
      logLit('info', '[lit] saveKey ok', {
        litNetwork: effectiveNetwork,
        chain,
        mode: 'ciphertext',
      });
      return { ciphertext, dataToEncryptHash };
    } catch (err) {
      logLit('error', '[lit] saveKey encrypt failed', {
        litNetwork: effectiveNetwork,
        chain,
        connectTimeout: timeout,
        message: err?.message || err,
      });
      throw err;
    }
  };

  const getKeyUncached = async (opts = {}) => {
    const conditions = normalizeAccessControlConditions(
      Array.isArray(opts.accessControlConditions) ? opts.accessControlConditions : baseConditions,
      opts.chain || resolvedChain
    );
    const toDecrypt = opts.encryptedSymmetricKey || opts.toDecrypt;
    const cipherPayload = resolveLitCipherPayload(
      opts.ciphertext && opts.dataToEncryptHash
        ? { ciphertext: opts.ciphertext, dataToEncryptHash: opts.dataToEncryptHash }
        : toDecrypt
    );
    if (!cipherPayload && !toDecrypt) {
      throw new Error('Lit getKey requires ciphertext/dataToEncryptHash.');
    }
    const chain = opts.chain || resolvedChain;
    const timeout = normalizeConnectTimeout(opts.connectTimeout || resolvedConnectTimeout);
    const effectiveNetwork = resolveLitNetwork(opts.litNetwork || resolvedNetwork);
    const effectiveUserMaxPrice = normalizeUserMaxPrice(opts.userMaxPrice) ?? resolvedUserMaxPrice;
    const accSummary = summarizeAccConditions(conditions);
    logLit('info', '[lit] getKey start', {
      litNetwork: effectiveNetwork,
      chain,
      connectTimeout: timeout,
      hasCiphertext: !!cipherPayload,
      hasEncryptedSymmetricKey: !!toDecrypt,
      hasConditions: accSummary.hasConditions,
      conditionCount: accSummary.conditionCount,
      firstConditionChain: accSummary.firstChain,
      firstConditionMethod: accSummary.firstMethod,
    });
    let client;
    try {
      client = await getLitClient({
        litNetwork: effectiveNetwork,
        connectTimeout: timeout,
        rpcUrl: opts.rpcUrl,
      });
    } catch (err) {
      logLit('error', '[lit] getKey connect failed', {
        litNetwork: effectiveNetwork,
        chain,
        connectTimeout: timeout,
        message: err?.message || err,
      });
      throw err;
    }

    const authContext = await getSession({
      chain,
      connectTimeout: timeout,
      providerLike: opts.providerLike,
      resourceAbilityRequests: opts.resourceAbilityRequests,
      litNetwork: effectiveNetwork,
      rpcUrl: opts.rpcUrl,
      paymentDelegation: opts.paymentDelegation || paymentDelegation,
      account: opts.account || account,
    });

    if (cipherPayload && typeof client.decrypt === 'function') {
      if (!accSummary.hasConditions) {
        const missingConditionsError = new Error(
          'Lit ciphertext payload is missing accessControlConditions.'
        );
        logLit('error', '[lit] getKey decrypt failed', {
          litNetwork: effectiveNetwork,
          chain,
          connectTimeout: timeout,
          hasCiphertext: true,
          hasEncryptedSymmetricKey: !!toDecrypt,
          hasConditions: false,
          message: missingConditionsError.message,
        });
        if (!(typeof client.getEncryptionKey === 'function' && toDecrypt)) {
          throw missingConditionsError;
        }
      }
      try {
        logLit('info', '[lit] decrypt start', {
          litNetwork: effectiveNetwork,
          chain,
          conditionCount: accSummary.conditionCount,
        });
        const { decryptedData } = await client.decrypt({
          accessControlConditions: conditions,
          chain,
          ciphertext: cipherPayload.ciphertext,
          dataToEncryptHash: cipherPayload.dataToEncryptHash,
          ...(effectiveUserMaxPrice !== undefined ? { userMaxPrice: effectiveUserMaxPrice } : {}),
          authContext,
        });
        logLit('info', '[lit] decrypt ok', {
          litNetwork: effectiveNetwork,
          chain,
        });
        logLit('info', '[lit] getKey ok', {
          litNetwork: effectiveNetwork,
          chain,
          mode: 'ciphertext',
        });
        return decryptedData;
      } catch (err) {
        const message = resolveLitErrorMessage(err);
        logLit('error', '[lit] getKey decrypt failed', {
          litNetwork: effectiveNetwork,
          chain,
          connectTimeout: timeout,
          hasCiphertext: true,
          hasEncryptedSymmetricKey: !!toDecrypt,
          hasConditions: accSummary.hasConditions,
          conditionCount: accSummary.conditionCount,
          firstConditionChain: accSummary.firstChain,
          firstConditionMethod: accSummary.firstMethod,
          resourceId: opts.resourceId || null,
          name: err?.name || null,
          code: err?.code ?? err?.errorCode ?? null,
          message,
          cause: resolveLitErrorMessage(err?.cause || err?.error || ''),
        });
        if (typeof client.getEncryptionKey === 'function' && toDecrypt) {
          try {
            logLit('info', '[lit] decrypt fallback unwrap start', {
              litNetwork: effectiveNetwork,
              chain,
            });
            const fallbackKey = await client.getEncryptionKey({
              accessControlConditions: conditions,
              chain,
              resourceId: opts.resourceId,
              toDecrypt,
              encryptedSymmetricKey: toDecrypt,
              ...(effectiveUserMaxPrice !== undefined ? { userMaxPrice: effectiveUserMaxPrice } : {}),
              authContext,
            });
            logLit('info', '[lit] decrypt fallback unwrap ok', {
              litNetwork: effectiveNetwork,
              chain,
            });
            return fallbackKey;
          } catch (fallbackErr) {
            logLit('error', '[lit] decrypt fallback unwrap failed', {
              litNetwork: effectiveNetwork,
              chain,
              connectTimeout: timeout,
              name: fallbackErr?.name || null,
              code: fallbackErr?.code ?? fallbackErr?.errorCode ?? null,
              message: resolveLitErrorMessage(fallbackErr),
            });
          }
        }
        throw err instanceof Error ? err : new Error(message);
      }
    }

    if (typeof client.getEncryptionKey === 'function' && toDecrypt) {
      try {
        logLit('info', '[lit] unwrap start', {
          litNetwork: effectiveNetwork,
          chain,
        });
        const decryptedKey = await client.getEncryptionKey({
          accessControlConditions: conditions,
          chain,
          resourceId: opts.resourceId,
          toDecrypt,
          encryptedSymmetricKey: toDecrypt,
          ...(effectiveUserMaxPrice !== undefined ? { userMaxPrice: effectiveUserMaxPrice } : {}),
          authContext,
        });
        logLit('info', '[lit] unwrap ok', {
          litNetwork: effectiveNetwork,
          chain,
        });
        logLit('info', '[lit] getKey ok', {
          litNetwork: effectiveNetwork,
          chain,
          mode: 'encryptedSymmetricKey',
        });
        return decryptedKey;
      } catch (err) {
        logLit('error', '[lit] getKey key-unwrap failed', {
          litNetwork: effectiveNetwork,
          chain,
          connectTimeout: timeout,
          hasConditions: accSummary.hasConditions,
          conditionCount: accSummary.conditionCount,
          firstConditionChain: accSummary.firstChain,
          firstConditionMethod: accSummary.firstMethod,
          name: err?.name || null,
          code: err?.code ?? err?.errorCode ?? null,
          message: resolveLitErrorMessage(err),
        });
        throw err instanceof Error ? err : new Error(resolveLitErrorMessage(err));
      }
    }

    if (toDecrypt && !cipherPayload) {
      throw new Error('Legacy encryptedSymmetricKey payload requires re-encryption for Lit v8.');
    }

    throw new Error('Lit decrypt is unavailable on this client.');
  };

  const { getKey, clearCache } = wrapLitGetKeyWithCache(getKeyUncached, {
    account,
    litNetwork: resolvedNetwork,
    chain: resolvedChain,
    accessControlConditions: baseConditions,
  });

  return sanitizePublicLitHooks({
    saveKey,
    getKey,
    clearCache,
    accessControlConditions: baseConditions,
    litChain: resolvedChain,
    litNetwork: resolvedNetwork,
    userMaxPrice: resolvedUserMaxPrice,
    paymentDelegation,
  });
};

/**
 * Publishes a sanitized Lit hook set on `window.__litHooks`.
 *
 * @param {LitHooksApi | Record<string, any> | null | undefined} hooks
 * @returns {LitHooksApi | null}
 */
export const setGlobalLitHooks = (hooks) => {
  if (typeof window === 'undefined') return null;
  if (hooks && typeof hooks === 'object') {
    const publicHooks = sanitizePublicLitHooks(hooks);
    window.__litHooks = publicHooks;
    return publicHooks;
  }
  delete window.__litHooks;
  return null;
};

/**
 * Reads the currently registered global Lit hooks from the browser runtime.
 *
 * @returns {LitHooksApi | null}
 */
export const getGlobalLitHooks = () => {
  if (typeof window === 'undefined') return null;
  return window.__litHooks || window.litHooks || null;
};

/**
 * Attaches lightweight Lit encryption helpers to `window.__litTools` for debugging flows in-browser.
 *
 * @param {{
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   litChain?: string | number | null
 * }} [options={}]
 * @returns {LitDevToolsApi | null}
 */
export const attachLitDevTools = ({ providerLike, account, chainId, litChain } = {}) => {
  if (typeof window === 'undefined') return null;
  const tools = {
    encryptForSbt: async ({ value, sbtAddresses, contextLabel, chain } = {}) => {
      const hooks = getGlobalLitHooks();
      if (!hooks || typeof hooks.saveKey !== 'function') {
        throw new Error('Lit hooks not initialized.');
      }
      const resolvedChain = resolveLitChain({ chainId, litChain, chain });
      const accessControlConditions = buildSbtAccessControlConditions({
        sbtAddresses,
        chainId,
        litChain: resolvedChain,
      });
      if (!accessControlConditions) {
        throw new Error('Invalid SBT access control conditions.');
      }
      return cryptoUtils.encryptEnvelopeValue(value, {
        providerLike,
        account,
        chainId,
        contextLabel: contextLabel || 'lit-secret',
        lit: {
          saveKey: hooks.saveKey,
          accessControlConditions,
          chain: resolvedChain,
        },
      });
    },
    decryptEnvelope: async (envelopeJson) => {
      const hooks = getGlobalLitHooks();
      if (!hooks || typeof hooks.getKey !== 'function') {
        throw new Error('Lit hooks not initialized.');
      }
      return cryptoUtils.decryptEnvelopeValue(envelopeJson, {
        account,
        chainId,
        providerLike,
        litOpts: { getKey: hooks.getKey },
      });
    },
  };
  window.__litTools = tools;
  return tools;
};

/* ----------------------------- Lit storage ------------------------------ */

const LIT_ARWEAVE_PREFIX = 'lit://arweave/';
const ALT_LIT_AR_PREFIX = 'lit+ar://';

/**
 * Builds the canonical `lit://arweave/` URL for a stored encrypted payload.
 *
 * @param {unknown} txId
 * @returns {string}
 */
export const buildLitArweaveUrl = (txId) => `${LIT_ARWEAVE_PREFIX}${toStr(txId).trim()}`;

/**
 * Extracts an Arweave transaction id from a Lit storage URL.
 *
 * @param {unknown} url
 * @returns {string | null}
 */
export const parseLitArweaveUrl = (url) => {
  const raw = toStr(url).trim();
  if (!raw) return null;
  if (raw.startsWith(LIT_ARWEAVE_PREFIX)) {
    return raw.slice(LIT_ARWEAVE_PREFIX.length).trim() || null;
  }
  if (raw.startsWith(ALT_LIT_AR_PREFIX)) {
    return raw.slice(ALT_LIT_AR_PREFIX.length).trim() || null;
  }
  return null;
};

/**
 * Indicates whether a string is one of the supported Lit Arweave URL forms.
 *
 * @param {unknown} url
 * @returns {boolean}
 */
export const isLitArweaveUrl = (url) => !!parseLitArweaveUrl(url);

const readBlobAsArrayBuffer = (blob) =>
  new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file data.'));
      reader.readAsArrayBuffer(blob);
    } catch (err) {
      reject(err);
    }
  });

const MIME_BY_EXT = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
});

const resolveExt = ({ name, format } = {}) => {
  const fmt = toStr(format).trim().toLowerCase();
  if (fmt) return fmt;
  const rawName = toStr(name).trim();
  const dot = rawName.lastIndexOf('.');
  if (dot > 0 && dot < rawName.length - 1) {
    return rawName.slice(dot + 1).toLowerCase();
  }
  return '';
};

const resolveMimeFromParts = ({ mime, name, format, type } = {}) => {
  const raw = toStr(mime || type).trim();
  const ext = resolveExt({ name, format });
  if (raw && raw !== 'application/octet-stream') return raw;
  if (ext && MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  return raw || 'application/octet-stream';
};

const resolveMimeFromPayload = (payload) =>
  resolveMimeFromParts({
    mime: payload?.mime,
    name: payload?.name,
    format: payload?.format,
  });

const isTextLikeMime = (mime) => {
  if (!mime) return false;
  if (mime.startsWith('text/')) return true;
  return [
    'application/json',
    'application/xml',
    'application/xhtml+xml',
    'application/javascript',
    'application/x-javascript',
    'image/svg+xml',
  ].includes(mime);
};

const encodeEncryptedPayload = async (data, opts = {}) => {
  const name = toStr(opts.name || '');
  const format = toStr(opts.format || '');
  const mime = toStr(opts.mime || '');

  if (typeof File !== 'undefined' && (data instanceof File || data instanceof Blob)) {
    const buf = await readBlobAsArrayBuffer(data);
    const b64 = Buffer.from(new Uint8Array(buf || [])).toString('base64');
    const resolvedName = name || data.name || 'encrypted-file';
    const resolvedFormat = resolveExt({ name: resolvedName, format });
    const resolvedMime = resolveMimeFromParts({
      mime,
      name: resolvedName,
      format: resolvedFormat,
      type: data.type,
    });
    return {
      v: 1,
      kind: 'file',
      name: resolvedName,
      format: resolvedFormat,
      mime: resolvedMime,
      encoding: 'base64',
      data: b64,
    };
  }

  return {
    v: 1,
    kind: 'text',
    name: name || 'encrypted-text',
    format: format || '',
    mime: mime || 'text/plain',
    encoding: 'utf-8',
    data: toStr(data),
  };
};

/**
 * Encrypts a text or file payload with the active Lit hooks and uploads the resulting envelope to Arweave.
 *
 * @param {{
 *   data?: unknown,
 *   format?: string,
 *   name?: string,
 *   mime?: string,
 *   arweaveJwk?: Record<string, any>,
 *   tags?: Array<Record<string, any>>,
 *   arweave?: Record<string, any>,
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   contextLabel?: string,
 *   lit?: LitHooksApi & { accessControlConditions: LitAccessControlCondition[] }
 * }} [options={}]
 * @returns {Promise<LitUploadResult>}
 */
export const uploadEncryptedArweaveData = async ({
  data,
  format,
  name,
  mime,
  arweaveJwk,
  tags,
  arweave,
  providerLike,
  account,
  chainId,
  contextLabel,
  lit,
} = {}) => {
  if (!lit || typeof lit.saveKey !== 'function') {
    throw new Error('Lit saveKey is required to encrypt Arweave data.');
  }
  if (!lit.accessControlConditions || !Array.isArray(lit.accessControlConditions)) {
    throw new Error('Lit accessControlConditions are required to encrypt Arweave data.');
  }

  const payload = await encodeEncryptedPayload(data, { format, name, mime });
  const envelope = await cryptoUtils.encryptEnvelopeValue(payload, {
    providerLike,
    account,
    chainId,
    contextLabel: contextLabel || 'lit-arweave',
    lit: {
      saveKey: lit.saveKey,
      accessControlConditions: lit.accessControlConditions,
      chain: lit.chain || lit.litChain,
    },
  });

  const txId = await arweaveScripts.uploadDataToArweave(envelope, 'json', {
    arweaveJwk,
    tags,
    ...(arweave && typeof arweave === 'object' ? arweave : {}),
  });
  return {
    txId,
    url: buildLitArweaveUrl(txId),
    arweaveUrl: arweaveScripts.buildArweaveGatewayUrl(txId, 'https://arweave.net'),
    envelope,
  };
};

/**
 * Downloads an encrypted Lit payload from Arweave and decrypts it with the active Lit hooks.
 *
 * @param {{
 *   url?: string,
 *   txId?: string,
 *   providerLike?: LitProviderLike,
 *   account?: string,
 *   chainId?: number | string | null,
 *   lit?: LitHooksApi,
 *   arweave?: Record<string, any>
 * }} [options={}]
 * @returns {Promise<LitDecryptResult>}
 */
export const downloadEncryptedArweaveData = async ({
  url,
  txId,
  providerLike,
  account,
  chainId,
  lit,
  arweave,
} = {}) => {
  const resolvedTx = toStr(txId || '') || parseLitArweaveUrl(url);
  if (!resolvedTx) throw new Error('Missing Arweave transaction ID for Lit doc.');
  if (!lit || typeof lit.getKey !== 'function') {
    throw new Error('Lit getKey is required to decrypt Arweave data.');
  }

  const arweaveOpts = (arweave && typeof arweave === 'object') ? { ...arweave } : {};
  const existingDebugContext = (
    arweaveOpts.debugContext && typeof arweaveOpts.debugContext === 'object'
  )
    ? arweaveOpts.debugContext
    : {};
  arweaveOpts.debugContext = {
    ...existingDebugContext,
    category: toStr(existingDebugContext.category).trim() || 'doc_lit_payload',
    caller: toStr(existingDebugContext.caller).trim() || 'litProtocol.downloadEncryptedArweaveData',
  };

  const envelopeJson = await arweaveScripts.downloadDataFromArweave(resolvedTx, arweaveOpts);
  const payload = await cryptoUtils.decryptEnvelopeValue(envelopeJson, {
    account,
    chainId,
    providerLike,
    litOpts: { getKey: lit.getKey },
  });
  return { payload, txId: resolvedTx, url: buildLitArweaveUrl(resolvedTx) };
};

/**
 * Decodes a Lit upload payload to text when the payload metadata indicates a text-like resource.
 *
 * @param {LitUploadPayload | null | undefined} payload
 * @returns {string}
 */
export const decodeLitPayloadToText = (payload) => {
  if (!payload || typeof payload !== 'object') return '';
  const mime = resolveMimeFromPayload(payload);
  const shouldDecode =
    payload.kind === 'text' ||
    payload.encoding === 'utf-8' ||
    isTextLikeMime(mime);
  if (!shouldDecode) return '';
  if (payload.encoding === 'utf-8' || payload.kind === 'text') {
    return toStr(payload.data || '');
  }
  if (payload.encoding === 'base64' && typeof payload.data === 'string') {
    try {
      return Buffer.from(payload.data, 'base64').toString('utf8');
    } catch (_) {
      return '';
    }
  }
  return '';
};

/**
 * Decodes a base64-backed Lit upload payload into a Blob for binary consumption.
 *
 * @param {LitUploadPayload | null | undefined} payload
 * @returns {Blob | null}
 */
export const decodeLitPayloadToBlob = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.encoding !== 'base64' || typeof payload.data !== 'string') return null;
  try {
    const bytes = Uint8Array.from(Buffer.from(payload.data, 'base64'));
    return new Blob([bytes], { type: resolveMimeFromPayload(payload) });
  } catch (_) {
    return null;
  }
};

/** @type {LitStorageApi} */
export const litStorage = {
  buildLitArweaveUrl,
  parseLitArweaveUrl,
  isLitArweaveUrl,
  uploadEncryptedArweaveData,
  downloadEncryptedArweaveData,
  decodeLitPayloadToText,
  decodeLitPayloadToBlob,
};
