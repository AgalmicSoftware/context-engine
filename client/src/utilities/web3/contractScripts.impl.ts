// Mechanical Phase 4 extension migration: keep legacy runtime behavior identical and tighten types separately.
/**
 * @module contractScriptsImpl
 * @description Web3 contract interaction layer — the primary bridge between React components and on-chain state.
 *              Handles provider/signer management, SBT minting, session CRUD, survey submission, and gate queries.
 *
 * Key exports: contractScripts (default), getSessionConfigBySlug, getSBTsForUser, createSession, mintSBT
 */
/*  my‑app/client/src/utilities/contractScripts.js
    ------------------------------------------------------------------
    Resilient Infura / ethers.js helper library
    ------------------------------------------------------------------ */
import { ethers, utils } from 'ethers';
// import ARWEAVE_KEY from '../../variables/arweaveKey.json';
import {
  ARWEAVE_ACTIVE,
  ENABLE_RPC_DEBUG_LOGGING,
  ENABLE_RPC_DEBUG_STATS,
  ENABLE_RPC_DEBUG_TRACE,
  CE_RPC_VERBOSE_ERRORS,
  CE_RPC_LOG_PROVIDER_SUCCESS,
  DISABLE_SBT_INSTANCE_LISTENERS,
  MAX_SBT_INSTANCE_LISTENERS,
  SBT_INSTANCE_LISTENER_GROUPS,
  ENABLE_SBT_HISTORY_SCAN,
  USE_ONCHAIN_SESSION_REGISTRY,
  DEFAULT_CHAIN_ID,
} from '../../variables/appConfig.js';
import { ARWEAVE_DEFAULT_GATEWAY_CANDIDATES } from '../../variables/arweaveGateways.js';
import { createLogger, shouldLog } from '../logging.js';
import { notify } from '../ui/notify.js';

// Default RPCs derive from chains.js; PATH defaults live in rpcDefaults.js (Pocket/POKT gateway).

import SURVEYS from '../../contractsABI/SURVEYS_ABI.json';
import SBT_FACTORY_ABI from '../../contractsABI/SBT_FACTORY_ABI.json';
import CUSTOM_SBT_ABI from '../../contractsABI/CUSTOM_SBT_ABI.json';
import { cryptoUtils } from '../crypto/cryptography.js';
import { arweaveScripts } from '../arweave/arweaveScripts.js';
import { normalizeArweaveUrl, parseArweaveTxId } from '../arweave/arweaveUrls.js';
import { createArweaveDownloadOps } from '../arweave/arweaveDownload.js';
import {
  buildArweaveUploadTags,
  resolveArweaveUploadOpts,
} from '../arweave/arweaveUploadHelpers.js';
import { validateNoLockedPlaintextInPayload } from '../arweave/noLeakPayloads.js';
import { getCorsProxyUrlOrThrow } from '../worker/corsProxy.js';
import { fetchWorkerWithAuth } from '../worker/workerAuth.js';
import { normalizeAddress } from './addressNormalization.js';
import { createSbtEventScanProgressState } from './contractScripts.sbtProgressHelpers.js';
import { hasPasswordMintForSbtMintMode } from '../sbt/sbtMintMode.js';
import {
  normalizeHistorySummaryCount,
  normalizeSbtHistorySummary,
  deriveSbtHistorySummaryFromCounts,
} from './contractScripts.sbtHistoryHelpers.js';
import {
  BLOCK_CACHE_MS,
  HASH_MISS_SENTINEL,
  HASH_READ_MAX_ENTRIES,
  HASH_READ_TTL_MS,
  READ_INFLIGHT,
  READ_MEMO,
  buildHashReadInflightKey,
  buildHashReadMemoKey,
  createContractScriptsCache,
  gasPriceCache,
  getTimedMemoValue,
  latestBlockCache,
  markHashRevertLoggedOnce,
  memoizedResolveSession,
  setTimedMemoValue,
} from '../cache/contractScriptsCache.js';
import {
  isCallExceptionError,
  logArweaveMetadataFetchFailure,
} from '../arweave/arweaveMetadataFailureLog.js';
import {
  buildHashUnavailableMetadataError,
  normalizeArweaveFailureMeta,
} from '../arweave/arweaveFailureClassifiers.js';
import {
  getScopeDecisionForSlug,
  logScopeWindowSkipOnce,
  shouldBypassSessionScopeWindow,
} from '../session/sessionScopeWindow.js';
import { toStr } from '../shared/primitives.js';
import {
  STORAGE_BACKENDS,
  STORAGE_RESOURCE_KEYS,
  attachStorageRefCompatibilityFields,
  deriveStorageRefFromLegacyArweaveTxId,
  normalizeStorageRef,
} from '../storage/storageRefs.js';
import {
  readSessionStorageBlob,
  uploadDataToSessionStorage,
} from '../storage/storageClient.js';
import { resolveSessionStorageBackend } from '../storage/sessionStorageConfig.js';
import store from '../../store';
import { sessionRegistryStore, sessionRegistryUtils } from './sessionRegistry.js';
import { createContractHelperMethods } from './contractHelpers.js';
import { createContractEventListenerMethods } from './chainEventStreams.js';
import { createContractProfileMethods } from './contractProfile.js';
import { createContractScriptsEventScanMethods } from './contractScriptsEventScans.js';
import {
  buildArweaveReadModeTag,
  buildDecryptModeTag,
  buildFailureModeTag,
  createContractScriptsMetadataResolutionHelpers,
} from './contractScriptsMetadataResolution.js';
import {
  getReadProviderForGroup,
  getReadProviderForSession,
  getReadProviderForChain,
  getLocalAwareReadProviderForChain,
  getLocalAwareReadProviderForGroup,
  resolveGroupPathRpcPreference,
  readRpcProviderMode,
} from './rpcProviders.js';
import {
  resolveSession,
  resolveSessionByName,
  normalizeSessionSlug,
  getDefaultSessionConfig,
  getSessionConfigBySlug,
  getDemoSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  getAllSessionEntries,
  getAllSessionSlugs,
  getSessionConfigByName,
  getSessionSlugByName,
  getSessionLists,
  getSessionChainId,
  getSessionNetwork,
  getChainLabelById,
} from './sessionConfigResolvers.js';
import {
  maybeWrapUnsupportedConfiguredDeterministicFactoryError,
  isNonexistentTokenError,
  notifyUserFacingTransactionError,
} from './errorClassifiers.js';
import { getSessionAddresses, getSessionBlockWindow, parsePositiveBlockNumber } from './sessionAddressHelpers.js';
import { resolveTxGasOverrides, sendContractWriteViaProvider } from './contractWrites.js';
import { resolveReadProvider, resolveSignerProvider } from './providerAdapter.js';
import {
  resolveSessionNameValue,
  normalizeSbtSessionLinkFields,
  normalizeSessionNameFields,
} from './sessionMetadataFormatting.js';
import {
  decimalEighteen,
  toEighteenDecimals,
  getBigNumber,
  getJsNumberFromBN,
  objectIsBN,
  timeout,
} from './numberFormatting.js';
import {
  isLogsRangeTooLargeError,
  splitBlockRange,
  normalizeRpcDebugContext,
  withProviderRpcDebugContext,
  isNonRecoverableGetLogsError,
  createFetchLogsSmartWithProvider,
} from './rpcSmartLogFetch.js';
import {
  normalizeCreate2Salt,
  hasNonZeroHashValue,
} from './deterministicFactoryHelpers.js';
import {
  GAS_FALLBACKS,
  SBT_TOKENURI_METADATA_TIMEOUT_MS,
  runWithSoftTimeout,
  extractChainId,
} from './contractScripts.corePureHelpers.js';
import {
  normalizeConvictionImportance,
  normalizeQuestionFlags,
} from './contractScripts.payloadNormalizers.js';
import {
  uploadDataToArweaveWithRetry,
} from './contractArweaveUploadRuntime.js';

declare global {
  interface Window {
    [key: string]: any;
  }
}

// Embedded passkey EOA sidecar.
import * as passkeyWallet from '../../wallet/passkeyWallet.js';

export {
  normalizeSessionSlug,
  getDefaultSessionConfig,
  getSessionConfigBySlug,
  getDemoSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  getAllSessionEntries,
  getAllSessionSlugs,
  getSessionConfigByName,
  getSessionSlugByName,
  getSessionLists,
  getSessionChainId,
  getSessionNetwork,
  getChainLabelById,
};

const SBT_FACTORY_INTERFACE = new ethers.utils.Interface(SBT_FACTORY_ABI);
const SURVEYS_INTERFACE = new ethers.utils.Interface(SURVEYS);
const CUSTOM_SBT_INTERFACE = new ethers.utils.Interface(CUSTOM_SBT_ABI);

const contractsLog = createLogger('contracts');
const rpcLogger = createLogger('rpc', { prefix: '[RPC_DEBUG]' });
const inviteLog = createLogger('inviteDebug');

/** @type {Map<string, any>} */
const sbtListenerMap = new Map();
/** @type {Map<string, any>} */
const surveyListenerMap = new Map();


/* ------------------------------------------------------------------ */
/* 1.  UNIVERSAL rate‑limit‑aware RETRY WRAPPER                       */
/* ------------------------------------------------------------------ */

const MAX_RETRIES_DEFAULT       = 10;    // up to ~5 min worst-case
const INITIAL_DELAY_MS_DEFAULT  = 1500;  // 1.5 s
const DELAY_MULTIPLIER_DEFAULT  = 2;

// --- NEW: global rate-limit / quota circuit breaker ---
let GLOBAL_QUOTA_LOCK_UNTIL_MS = 0;

/**
 * Record the last rate-limit/quota error so the UI layer (PileViewMode)
 * can decide to keep showing a spinner instead of "No questions available".
 */
function recordRateLimitError(code: any, message: any) {
  try {
    if (typeof window !== 'undefined') {
      window.__LAST_RPC_RATE_LIMIT_ERROR__ = {
        code,
        message: String(message || ''),
        ts: Date.now(),
      };
    }
  } catch {
    // best effort only
  }
}

function applyWindowDebugDefaults() {
  if (typeof window === 'undefined') return;
  const setIfUndef = (key: any, value: any) => {
    if (typeof window[key] === 'undefined') window[key] = value;
  };
  setIfUndef('ENABLE_RPC_DEBUG_LOGGING', ENABLE_RPC_DEBUG_LOGGING);
  setIfUndef('ENABLE_RPC_DEBUG_STATS', ENABLE_RPC_DEBUG_STATS);
  setIfUndef('ENABLE_RPC_DEBUG_TRACE', ENABLE_RPC_DEBUG_TRACE);
  setIfUndef('CE_RPC_VERBOSE_ERRORS', CE_RPC_VERBOSE_ERRORS);
  setIfUndef('CE_RPC_LOG_PROVIDER_SUCCESS', CE_RPC_LOG_PROVIDER_SUCCESS);
  setIfUndef('DISABLE_SBT_INSTANCE_LISTENERS', DISABLE_SBT_INSTANCE_LISTENERS);
  setIfUndef(
    'SBT_INSTANCE_LISTENER_GROUPS',
    Array.isArray(SBT_INSTANCE_LISTENER_GROUPS)
      ? [...SBT_INSTANCE_LISTENER_GROUPS]
      : SBT_INSTANCE_LISTENER_GROUPS
  );
  setIfUndef('ENABLE_SBT_HISTORY_SCAN', ENABLE_SBT_HISTORY_SCAN);
  if (
    typeof window.MAX_SBT_INSTANCE_LISTENERS === 'undefined' ||
    window.MAX_SBT_INSTANCE_LISTENERS === null ||
    Number.isNaN(Number(window.MAX_SBT_INSTANCE_LISTENERS))
  ) {
    window.MAX_SBT_INSTANCE_LISTENERS = MAX_SBT_INSTANCE_LISTENERS;
  }
}

applyWindowDebugDefaults();

const RPC_STATS_MAX = 200;

/* ------------------------------------------------------------------ */
/* 1b. Lit-encrypted metadata helpers                                  */
/* ------------------------------------------------------------------ */

const MAX_CACHE_SIZE = 500;
const isObj = (val: unknown): val is Record<string, unknown> => !!val && typeof val === 'object' && !Array.isArray(val);

const isRetryableSurveyResponseReadError = (error: any) => {
  if (!error) return false;

  const arweaveFailure = normalizeArweaveFailureMeta(error);
  if (typeof arweaveFailure.retryable === 'boolean') return arweaveFailure.retryable;
  if (arweaveFailure.state === 'transient' || arweaveFailure.kind === 'cooldown') return true;
  if (
    arweaveFailure.state === 'terminal_invalid' ||
    arweaveFailure.state === 'terminal_not_found' ||
    arweaveFailure.kind === 'invalid' ||
    arweaveFailure.kind === 'not_found'
  ) {
    return false;
  }

  const code = error?.code ?? error?.error?.code;
  const status = error?.status ?? error?.statusCode ?? error?.error?.status ?? error?.error?.statusCode;
  const message = String(error?.message || error?.reason || error?.error?.message || '').toLowerCase();

  if (error?.name === 'AbortError') return false;
  if (code === 'CALL_EXCEPTION' || code === 'INVALID_ARGUMENT') return false;
  if (code === 402 || code === 408 || code === 429 || code === 500 || code === 502 || code === 503 || code === 504) return true;
  if (
    code === 'NETWORK_ERROR' ||
    code === 'SERVER_ERROR' ||
    code === 'TIMEOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT'
  ) {
    return true;
  }

  if (typeof status === 'number') {
    if (status === 402 || status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
      return true;
    }
    if (status >= 400) return false;
  }

  return (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('quota exceeded') ||
    message.includes('quota exhausted') ||
    message.includes('network error') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnrefused') ||
    message.includes('connection refused') ||
    message.includes('connection reset') ||
    message.includes('socket hang up') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('fetch failed') ||
    message.includes('failed to fetch') ||
    message.includes('server error') ||
    message.includes('temporarily unavailable')
  );
};

const WEB3_CONTEXT_CACHE = new Map();
let web3ContextCacheClearQueued = false;

const scheduleWeb3ContextCacheClear = () => {
  if (web3ContextCacheClearQueued) return;
  web3ContextCacheClearQueued = true;
  const clearCache = () => {
    WEB3_CONTEXT_CACHE.clear();
    web3ContextCacheClearQueued = false;
  };
  try {
    Promise.resolve().then(clearCache);
  } catch {
    setTimeout(clearCache, 100);
  }
};

const normalizeWeb3ContextCacheValue = (value: any, seen: any = new WeakSet()): any => {
  if (value === undefined) return '__undefined__';
  if (value === null) return null;
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return `__fn:${value.name || 'anonymous'}__`;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '__circular__';
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item: any) => normalizeWeb3ContextCacheValue(item, seen));
  }
  const out: any = {};
  Object.keys(value).sort().forEach((key: any) => {
    out[key] = normalizeWeb3ContextCacheValue(value[key], seen);
  });
  return out;
};

const serializeWeb3ContextCacheKey = (groupKeyOrCfg: any) => {
  try {
    return JSON.stringify(normalizeWeb3ContextCacheValue(groupKeyOrCfg));
  } catch {
    try {
      return String(groupKeyOrCfg);
    } catch {
      return '__unserializable__';
    }
  }
};

export function getWeb3Context(groupKeyOrCfg: any) {
  if (groupKeyOrCfg && typeof groupKeyOrCfg === 'object' && groupKeyOrCfg._isWeb3Context === true) {
    return groupKeyOrCfg;
  }

  scheduleWeb3ContextCacheClear();
  const cacheKey = serializeWeb3ContextCacheKey(groupKeyOrCfg);
  const cached = WEB3_CONTEXT_CACHE.get(cacheKey);
  if (cached) return cached;

  const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
  const chainId = extractChainId(cfg);
  const readProvider = getLocalAwareReadProviderForGroup(groupKeyOrCfg);
  const addresses = getSessionAddresses(cfg);
  const ctx: any = {
    _isWeb3Context: true,
    cfg,
    chainId,
    readProvider,
    addresses,
    groupKeyOrCfg,
  };
  WEB3_CONTEXT_CACHE.set(cacheKey, ctx);
  return ctx;
}

const SBT_READ_PROVIDER_OPTIONS = Object.freeze({ contractKey: 'sbtFactory' });
const SURVEYS_READ_PROVIDER_OPTIONS = Object.freeze({
  contractKey: 'surveys',
  skipGlobalPathDefaults: true,
  providerLabel: 'surveys-archive',
});

const getSurveysReadProviderForSession = (groupKeyOrCfg: any, cfg: any, chainId: any) => (
  getReadProviderForGroup(cfg || groupKeyOrCfg, SURVEYS_READ_PROVIDER_OPTIONS) ||
  getReadProviderForChain(chainId)
);

let contractMetadataResolutionHelpers: ReturnType<typeof createContractScriptsMetadataResolutionHelpers>;

function recordRpcStat(fnName: any, meta: any) {
  try {
    if (typeof window === 'undefined') return;
    const enabled =
      window.ENABLE_RPC_DEBUG_STATS === true ||
      shouldLog('rpc', 'log');
    if (!enabled) return;

    const key = String(fnName || 'unknown');
    const stats = window.__RPC_STATS__ || { counts: {}, recent: [] };
    stats.counts[key] = (stats.counts[key] || 0) + 1;

    const entry: any = { ts: Date.now(), fn: key };
    if (meta && typeof meta === 'object') entry.meta = meta;
    if (window.ENABLE_RPC_DEBUG_TRACE === true) {
      const stack = new Error().stack;
      if (stack) entry.stack = stack.split('\n').slice(2, 8).join('\n');
    }

    stats.recent.push(entry);
    if (stats.recent.length > RPC_STATS_MAX) stats.recent.shift();
    window.__RPC_STATS__ = stats;
  } catch {
    // best effort only
  }
}

async function withRetry(
  taskFn: any,
  functionName: any          = 'anonymous-fn',
  maxRetries: any            = MAX_RETRIES_DEFAULT,
  initialDelayMs: any        = INITIAL_DELAY_MS_DEFAULT,
  delayMultiplier: any       = DELAY_MULTIPLIER_DEFAULT
) {
  let attempt = 0, delayMs = initialDelayMs;

  while (true) {
    // --- NEW: global hard lock for known quota-exhausted windows ---
    if (GLOBAL_QUOTA_LOCK_UNTIL_MS && Date.now() < GLOBAL_QUOTA_LOCK_UNTIL_MS) {
      // Surface a synthetic 402 so UI can treat this like a global rate-limit state
      recordRateLimitError(402, `[withRetry] RPC quota lock active; skipping ${functionName}`);
      const err = new Error(`[withRetry] RPC quota lock active; skipping ${functionName}`);
      (err as any).code = 402;
      throw err;
    }

    try {
      return await taskFn();
    } catch (err: any) {
      const rawCode = err?.code ?? err?.error?.code;
      let code = Number.isFinite(Number(rawCode)) ? Number(rawCode) : null;
      const message = (err?.message || err?.error?.message || '').toLowerCase();
      const bodyStr = (typeof err?.body === 'string') ? err.body.toLowerCase() : '';

      // Some browsers surface 429 responses as CORS/preflight failures without a numeric code.
      // Example: "Preflight response is not successful. Status code: 429" / "access control checks".
      const mentions429 =
        message.includes('status code: 429') ||
        message.includes('status: 429') ||
        message.includes(' 429') ||
        bodyStr.includes('status code: 429') ||
        bodyStr.includes('status: 429');
      const mentionsPreflightOrCors =
        message.includes('preflight') ||
        message.includes('access control') ||
        message.includes('cors');
      if (!code && mentions429 && mentionsPreflightOrCors) {
        code = 429;
      }

      const is429   = code === 429;
      const is402   = code === 402 || message.includes('payment required') || bodyStr.includes('payment required') || message.includes('quota exceeded') || bodyStr.includes('quota exceeded');
      const is503   = code === 503;

      const isRate  =
        is429 || is402 || is503 ||
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('quota exceeded') ||
        bodyStr.includes('rate limit') ||
        bodyStr.includes('too many requests') ||
        bodyStr.includes('quota exceeded');

      const isInfuraRatelimit =
        code === -32005 &&
        (message.includes('rate limit') || bodyStr.includes('rate limit'));

      // Not a rate limit / quota error → bubble up immediately
      if (!(isRate || isInfuraRatelimit)) {
        throw err;
      }

      // Record for UI (PileViewMode) + debugging
      recordRateLimitError(code, err?.message || err?.error?.message || '');

      // --- NEW: HARD STOP on 402 (Payment Required / Quota Exceeded) ---
      if (is402) {
        GLOBAL_QUOTA_LOCK_UNTIL_MS = Math.max(
          GLOBAL_QUOTA_LOCK_UNTIL_MS,
          Date.now() + 10 * 60 * 1000   // 10-minute lock for all further RPC calls this session
        );
        contractsLog.error(
          `[withRetry] ❌  ${functionName}: 402 Payment Required / quota exceeded; ` +
          `locking further RPC calls for 10 minutes and aborting immediately.`
        );
        throw err; // no retries for 402
      }

      // --- 429 / 503 / generic rate-limit: bounded exponential backoff ---
      attempt += 1;
      if (attempt > maxRetries) {
        contractsLog.error(`[withRetry] ❌  ${functionName}: exceeded retries (${maxRetries}).`);
        throw err;
      }

      const capped = Math.min(delayMs, 30000);
      contractsLog.warn(
        `[withRetry] 🔄  ${functionName}: rate-limited (code=${code}), ` +
        `retry ${attempt}/${maxRetries} in ${capped} ms.`
      );
      await new Promise((r: any) => setTimeout(r, capped));
      delayMs *= delayMultiplier;
    }
  }
}


const callWithRetry = (fn: any, fnName: any, meta?: any, retryOpts: any = null) => {
  const maxRetries = Number(retryOpts?.maxRetries);
  const initialDelayMs = Number(retryOpts?.initialDelayMs);
  const delayMultiplier = Number(retryOpts?.delayMultiplier);

  return withRetry(
    () => {
      recordRpcStat(fnName, meta);
      return fn();
    },
    fnName,
    Number.isFinite(maxRetries) ? maxRetries : MAX_RETRIES_DEFAULT,
    Number.isFinite(initialDelayMs) ? initialDelayMs : INITIAL_DELAY_MS_DEFAULT,
    Number.isFinite(delayMultiplier) ? delayMultiplier : DELAY_MULTIPLIER_DEFAULT
  );
};

const fetchLogsSmartWithProvider = createFetchLogsSmartWithProvider({
  callWithRetry,
  INITIAL_DELAY_MS_DEFAULT,
  DELAY_MULTIPLIER_DEFAULT,
});

export { getReadProviderForGroup, getReadProviderForSession };

/* ------------------------------------------------------------------ */
/* 3.  LIGHTWEIGHT CACHES                                             */
/* ------------------------------------------------------------------ */

// (sbtEventsListenerAttached / surveyEventsListenerAttached removed — unused)

/* ------------------------------------------------------------------ */
/* 4.  DEBUG LOG HELPER                                               */
/* ------------------------------------------------------------------ */
const rpcLog = (...args: any[]) => {
  rpcLogger.log(...args);
};

const cloneJsonSafe = (value: any) => {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const {
  resolveReadContext,
  buildArweaveDebugContext,
  buildSbtScopeMemoTag,
  bumpSbtMemoRunVersion,
  isLatestSbtMemoRun,
  resolveSessionStartFromRegistry,
  readArweaveTxCacheEntry,
  readArweaveTxFailureCacheEntry,
  writeArweaveTxFailureCacheEntry,
  clearArweaveTxFailureCacheEntry,
  writeArweaveTxCacheEntry,
  runArweaveTxFetchCoalesced,
  clearReadCachesForGroup,
  questionHashRevertLogged,
  surveyHashRevertLogged,
} = createContractScriptsCache({
  resolveSession,
  normalizeSessionSlug,
  getSessionAddresses,
  shouldBypassSessionScopeWindow,
  sessionRegistryStore,
  sessionRegistryUtils,
  DEFAULT_CHAIN_ID,
  contractsLog,
  parsePositiveBlockNumber,
  ethers,
});

const { recordTerminalArweaveInvalidFailure, downloadArweaveTextForGroup } = createArweaveDownloadOps({
  resolveReadContext,
  readArweaveTxCacheEntry,
  writeArweaveTxCacheEntry,
  readArweaveTxFailureCacheEntry,
  writeArweaveTxFailureCacheEntry: writeArweaveTxFailureCacheEntry as any,
  clearArweaveTxFailureCacheEntry,
  runArweaveTxFetchCoalesced,
  buildArweaveDebugContext: buildArweaveDebugContext as any,
});

const SBT_TOKENURI_METADATA_GATEWAYS = Object.freeze([
  'https://arweave.net',
  'https://gateway.irys.xyz',
  'https://g8way.io',
  'https://permagate.io',
  'https://ar-io.dev',
]);

const resolveStorageSessionSlug = (groupKeyOrCfg: any, cfg: any = null) => {
  const fromCfg = normalizeSessionSlug(cfg?.slug || cfg?.sessionSlug || '');
  if (fromCfg) return fromCfg;
  if (typeof groupKeyOrCfg === 'string') return normalizeSessionSlug(groupKeyOrCfg);
  return normalizeSessionSlug(groupKeyOrCfg?.slug || groupKeyOrCfg?.sessionSlug || '');
};

const resolveStorageBackendForResource = (cfg: any, resource: any, opts: any = {}) => resolveSessionStorageBackend(cfg, {
  resource,
  encrypted: opts.encrypted === true,
});

const isCloudflareStorageResource = (cfg: any, resource: any, opts: any = {}) => (
  resolveStorageBackendForResource(cfg, resource, opts) === STORAGE_BACKENDS.CLOUDFLARE
);

const payloadPointerIdToBytes32 = (id: any, label: any = 'storage pointer') => {
  const pointerId = toStr(id).trim();
  if (!pointerId) throw new Error(`${label}: missing storage pointer id.`);
  const hex = arweaveScripts.base64urlToHex(pointerId);
  if (!/^0x[0-9a-fA-F]{64}$/.test(toStr(hex))) {
    throw new Error(`${label}: storage pointer id is not bytes32-compatible (hex length ${toStr(hex).length}).`);
  }
  return hex;
};

const uploadJsonPayloadForContractPointer = async ({
  payload,
  resource,
  groupKeyOrCfg,
  cfg,
  arweaveUploadOpts,
  uploadWithRetry = false,
  storageContext = {},
}: any) => {
  const payloadString = JSON.stringify(payload);
  if (isCloudflareStorageResource(cfg, resource)) {
    const sessionSlug = resolveStorageSessionSlug(groupKeyOrCfg, cfg);
    const result = await uploadDataToSessionStorage(payloadString, 'json', {
      sessionSlug,
      sessionConfig: cfg,
      context: storageContext,
      resource,
      contentType: 'application/json',
    });
    const storageRef = normalizeStorageRef(result?.storageRef || result, {
      fallbackBackend: STORAGE_BACKENDS.CLOUDFLARE,
      resource,
    });
    if (!storageRef || storageRef.backend !== STORAGE_BACKENDS.CLOUDFLARE) {
      throw new Error(`${resource} storage upload did not return a Cloudflare storageRef.`);
    }
    return {
      pointerId: storageRef.id,
      pointerBytes: payloadPointerIdToBytes32(storageRef.id, `${resource} storage upload`),
      storageRef,
      arweaveTxId: '',
    };
  }

  if (!ARWEAVE_ACTIVE) {
    throw new Error(`${resource} upload requires Arweave because this session resource is not Cloudflare-active.`);
  }
  const txId = uploadWithRetry
    ? await uploadDataToArweaveWithRetry(payloadString, 'json', arweaveUploadOpts)
    : await arweaveScripts.uploadDataToArweave(payloadString, 'json', arweaveUploadOpts);
  return {
    pointerId: txId,
    pointerBytes: payloadPointerIdToBytes32(txId, `${resource} Arweave upload`),
    storageRef: deriveStorageRefFromLegacyArweaveTxId(txId, { resource }),
    arweaveTxId: txId,
  };
};

const readCloudflarePointerTextForGroup = async ({
  pointerId,
  resource,
  groupKeyOrCfg,
  cfg,
}: any) => {
  const storageRef = normalizeStorageRef({
    backend: STORAGE_BACKENDS.CLOUDFLARE,
    id: pointerId,
    resource,
    contentType: 'application/json',
  }, { fallbackBackend: STORAGE_BACKENDS.CLOUDFLARE, resource });
  if (!storageRef) throw new Error(`Invalid Cloudflare ${resource} storage pointer.`);
  const response = await readSessionStorageBlob({
    storageRef,
    sessionSlug: resolveStorageSessionSlug(groupKeyOrCfg, cfg),
    sessionConfig: cfg,
    context: { sessionSlug: resolveStorageSessionSlug(groupKeyOrCfg, cfg) },
  });
  return {
    text: await response.text(),
    storageRef,
  };
};

const readPayloadPointerTextForGroup = async ({
  pointerId,
  resource,
  groupKeyOrCfg,
  cfg,
  arweaveOpts,
}: any) => {
  if (isCloudflareStorageResource(cfg, resource)) {
    try {
      return await readCloudflarePointerTextForGroup({ pointerId, resource, groupKeyOrCfg, cfg });
    } catch (cloudflareError: any) {
      contractsLog.warn(`Cloudflare ${resource} payload read failed; trying legacy Arweave fallback.`, cloudflareError);
      if (!ARWEAVE_ACTIVE) throw cloudflareError;
    }
  }
  if (!ARWEAVE_ACTIVE) return null;
  return {
    text: await downloadArweaveTextForGroup({
      txId: pointerId,
      groupKeyOrCfg,
      arweaveOpts,
    }),
    storageRef: deriveStorageRefFromLegacyArweaveTxId(pointerId, { resource }),
  };
};

const attachPayloadPointerFields = (payload: any, pointerId: any, resource: any, storageRef: any = null) => (
  attachStorageRefCompatibilityFields({
    ...(payload || {}),
    ...(storageRef?.backend === STORAGE_BACKENDS.CLOUDFLARE
      ? { storageRef }
      : { arweaveTxId: pointerId }),
    resource,
  }, { resource })
);

const recordInFlightStat = (kind: any = 'miss') => {
  try {
    if (typeof window === 'undefined') return;
    const stats = window.__RPC_STATS__ || { counts: {}, recent: [] };
    const inflight = stats.inflight || {};
    inflight[kind] = Number(inflight[kind] || 0) + 1;
    stats.inflight = inflight;
    window.__RPC_STATS__ = stats;
  } catch {
    // best effort only
  }
};

const runInFlightCoalesced = async (map: any, key: any, task: any) => {
  if (map.has(key)) {
    recordInFlightStat('hit');
    return await map.get(key);
  }
  recordInFlightStat('miss');
  const run = (async () => await task())();
  map.set(key, run);
  try {
    return await run;
  } finally {
    if (map.get(key) === run) map.delete(key);
  }
};

const contractHelperDeps: any = {
  resolveSession,
  latestBlockCache,
  gasPriceCache,
  BLOCK_CACHE_MS,
  getReadProviderForGroup,
  shouldLog,
  rpcLog,
  callWithRetry,
  MAX_CACHE_SIZE,
  isLogsRangeTooLargeError,
  contractsLog,
  getReadProviderForChain,
  normalizeSessionSlug,
  shouldBypassSessionScopeWindow,
  getScopeDecisionForSlug,
  logScopeWindowSkipOnce,
  parsePositiveBlockNumber,
  resolveSessionStartFromRegistry,
  DEFAULT_CHAIN_ID,
  store,
  getSessionConfigBySlug,
  refreshSessionRegistryFieldsCache: sessionRegistryUtils.refreshSessionRegistryFieldsCache,
  getCorsProxyUrlOrThrow,
  fetchWorkerWithAuth,
};

const contractEventListenerDeps: any = {
  resolveSession,
  getSessionAddresses,
  contractsLog,
  sbtListenerMap,
  surveyListenerMap,
  getReadProviderForChain,
  getReadProviderForGroup: getLocalAwareReadProviderForGroup,
  SBT_FACTORY_ABI,
  CUSTOM_SBT_ABI,
  SURVEYS,
  shouldLog,
};

const contractProfileDeps: any = {
  resolveSession,
  getReadProviderForChain: getLocalAwareReadProviderForChain,
  getReadProviderForGroup: getLocalAwareReadProviderForGroup,
  CUSTOM_SBT_ABI,
  callWithRetry,
  rpcLog,
  isNonexistentTokenError,
  contractsLog,
  getSessionAddresses,
  buildSbtScopeMemoTag,
  bumpSbtMemoRunVersion,
  isLatestSbtMemoRun,
  SBT_FACTORY_ABI,
  shouldLog,
  fetchLogsSmartWithProvider,
  resolveSessionNameValue,
  normalizeSessionSlug,
  normalizeSbtSessionLinkFields,
  normalizeSessionNameFields,
  latestBlockCache,
};

const contractEventScanMethods = createContractScriptsEventScanMethods({
  ethers,
  SURVEYS,
  SURVEYS_INTERFACE,
  resolveSession,
  getSessionAddresses,
  getSurveysReadProviderForSession,
  fetchLogsSmartWithProvider,
  normalizeRpcDebugContext,
  rpcLog,
  contractsLog,
});

async function resolveGroupPasswordWalletScopeSbtAddress({
  password,
  sbtAddress,
  walletScopeSbtAddress,
  getGroupPasswordHashFn,
}: any) {
  if (typeof walletScopeSbtAddress !== 'undefined') {
    return walletScopeSbtAddress;
  }

  try {
    const onchainHash = await getGroupPasswordHashFn('none', sbtAddress, null);
    if (onchainHash && onchainHash !== ethers.constants.HashZero) {
      const resolved = cryptoUtils.resolveGroupPasswordWalletScopeAddress({
        password,
        sbtAddress,
        groupPasswordHash: onchainHash,
      });
      if (resolved !== null) {
        return resolved;
      }
    }
  } catch {
    // Fall back to SBT-scoped signing below when the hash cannot be read.
  }

  return sbtAddress;
}

/* ------------------------------------------------------------------ */
/* 5.  MAIN LIBRARY                                                   */
/* ------------------------------------------------------------------ */

const contractScripts: any = {
  _blockCache: {}, // For the memoized getBlockWithCaching

  // Expose embedded passkey wallet auth for UI.
  createPasskeyWallet: passkeyWallet.createPasskeyWallet,

  invalidateReadCachesForGroup: (groupKeyOrCfg: any = null) => {
    clearReadCachesForGroup(groupKeyOrCfg);
  },
  ...createContractHelperMethods(contractHelperDeps),
  ...createContractEventListenerMethods(contractEventListenerDeps),

  async fetchAllQuestionIDs(providerName: any, fromBlock: any = null, toBlock: any = null, groupKeyOrCfg: any = null) {
    return contractEventScanMethods.fetchAllQuestionIDs(this, providerName, fromBlock, toBlock, groupKeyOrCfg);
  },

  // === CHANGED: +groupKeyOrCfg (optional). Uses group provider/addr and clamps
  async getAllQuestionIDsChunkedWithCallback(
    providerName: any,
    fromBlock: any = 0,
    toBlock: any = 'latest',
    onChunkProgress: any = null,
    onPartialData: any = null,
    groupKeyOrCfg: any,
    scanOptions: any = null
  ) {
    return contractEventScanMethods.getAllQuestionIDsChunkedWithCallback(
      this,
      providerName,
      fromBlock,
      toBlock,
      onChunkProgress,
      onPartialData,
      groupKeyOrCfg,
      scanOptions
    );
  },

  async getResponsesByQuestionID(providerName: any, questionId: any, fromBlock: any = null, toBlock: any = null, groupKeyOrCfg: any = null) {
  const cfg    = resolveSession(groupKeyOrCfg || '');
  const gAddrs = getSessionAddresses(cfg);
  const addr   = (gAddrs.surveys?.address);
  const chId   = (gAddrs.surveys?.chainId) || (cfg?.networkChainId) || undefined;

  const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
  const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);
  const responseSubmittedEventFilter = SurveyContract.filters.ResponsesSubmitted();

  // 🔐 Normalize
  const ensureHash = (v: any) => {
    try {
      if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
    } catch {}
    try { if (utils.isHexString(v, 32)) return String(v).toLowerCase(); } catch {}
    const s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
  };
  const qIdB32 = ensureHash(questionId);
  if (!utils.isHexString(qIdB32, 32)) return [];

  // Per-group base window + clamp caller overrides
  const { fromBlock: baseFrom, toBlock: baseTo } =
    await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, { _resolvedCfg: cfg });

  const fromBlockNum = Number.isFinite(Number(fromBlock))
    ? Math.max(Number(fromBlock), baseFrom)
    : baseFrom;

  const toBlockNum = (toBlock === 'latest' || typeof toBlock !== 'number')
    ? baseTo
    : Math.min(Number(toBlock), baseTo);

  if (fromBlockNum > toBlockNum) return [];

  rpcLog('getResponsesByQuestionID: Fetching logs with fetchLogsSmartWithProvider:', {
    address: SurveyContract.address, fromBlock: fromBlockNum, toBlock: toBlockNum
  });
  const rawLogs = await fetchLogsSmartWithProvider(provider, responseSubmittedEventFilter, fromBlockNum, toBlockNum);
  const events = rawLogs.map((log: any) => SURVEYS_INTERFACE.parseLog(log));

  const responses = await Promise.all(
    events
      .filter((event: any) => {
        try {
          const evIds = (event.args.questionIds || []).map((x: any) => String(x).toLowerCase());
          return evIds.includes(qIdB32.toLowerCase());
        } catch { return false; }
      })
      .map(async (event: any) => {
        const responder = event.args.responder;
        const surveyId = event.args.surveyId;
        let blockTimestamp = 0;
        try {
            const blockData = await this.getBlockWithCaching(provider, event.blockNumber, providerName, String(chId));
            if (blockData) {
                blockTimestamp = blockData.timestamp;
            }
        } catch (e: any) { /* ignore */ }
        let responseData = null;
        try {
          responseData = await this.getResponse(providerName, responder, qIdB32, groupKeyOrCfg, {
            _resolvedCfg: cfg,
          });
        } catch (e: any) {
          contractsLog.warn('[getResponsesByQuestionID] individual response read failed; skipping', { responder, qId: qIdB32, error: e?.message });
        }
        return {
          responder,
          questionId: qIdB32,
          surveyId,
          response: responseData,
          timestamp: blockTimestamp
        };
      })
  );
  return responses;
},

  submitSurveyResponse: async function(providerName: any, surveyId: any, arweaveHash: any, groupKeyOrCfg: any = null) {
  if (providerName === 'none') throw new Error('submitSurveyResponse requires a signer-capable provider (not read-only).');
  const providerLocation = contractScripts.getProviderLocation(providerName);
  const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
  const signer = ethersProvider.getSigner();

  // === Address resolution (group-aware; no SURVEYS_ADDRESS fallback)
  const cfg    = resolveSession(groupKeyOrCfg || '');
  const gAddrs = getSessionAddresses(cfg);
  const addr   = gAddrs.surveys?.address;
  if (!addr) {
    contractsLog.log('[submitSurveyResponse] Missing surveys address in group config; aborting tx.');
    return; // early return, no throw
  }
  const SurveyContract = new ethers.Contract(addr, SURVEYS, signer as any);

  // 🔐 Normalize & preflight
  const ensureHash = (v: any) => {
    try {
      if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
    } catch {}
    try { if (utils.isHexString(v, 32)) return String(v).toLowerCase(); } catch {}
    const s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
  };
  const hashedSurveyId = ensureHash(surveyId);
  if (!utils.isHexString(hashedSurveyId, 32)) throw new Error('submitSurveyResponse: surveyId is not a bytes32.');

  rpcLog('RPC Call (Tx):', {
    function: 'submitSurveyResponse',
    method:   'SurveyContract.submitResponse',
    params:   { surveyId: hashedSurveyId, arweaveHash }
  });
  const txOverrides = await resolveTxGasOverrides({
    contract: SurveyContract,
    method: 'submitResponse',
    args: [hashedSurveyId, arweaveHash],
    fallbackGasLimit: String(GAS_FALLBACKS.submitResponse),
    minEstimate: '50000',
    logLabel: 'submitSurveyResponse',
    preferFallbackGasLimit: true,
  });
  const { receipt } = await sendContractWriteViaProvider({
    signingProvider: providerLocation,
    ethersProvider,
    signer,
    contract: SurveyContract,
    method: 'submitResponse',
    args: [hashedSurveyId, arweaveHash],
    txOverrides,
    rpcFunction: 'submitSurveyResponse',
    revertMessage: 'submitSurveyResponse transaction reverted on-chain.',
  });
  return receipt;
},

  predictSBTAddress: async function(
    providerName: any,
    name: any,
    symbol: any,
    limitedNumber: any,
    adminAddress: any,
    mintingEndTime: any,
    hasPasswordMint: any,
    burnAuth: any,
    hashedPasswords: any,
    tokenURI: any,
    groupPasswordHash: any = ethers.constants.HashZero,
    groupKeyOrCfg: any = null,
    create2Salt: any = '',
    predictOptions: any = {}
  ) {
    const create2SaltNormalized = normalizeCreate2Salt(create2Salt);
    if (!create2SaltNormalized) {
      throw new Error('predictSBTAddress requires a CREATE2 salt.');
    }
    const useConfiguredDeterministic = !!predictOptions?.useConfiguredDeterministic;
    const initializeGroupPasswordHash = !!predictOptions?.initializeGroupPasswordHash;
    if (
      useConfiguredDeterministic &&
      !initializeGroupPasswordHash &&
      hasNonZeroHashValue(groupPasswordHash)
    ) {
      throw new Error(
        'Configured deterministic SBT prediction cannot preinitialize a group password hash.'
      );
    }

    const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
    const slugOrEmpty = (cfg && typeof cfg.slug !== 'undefined') ? cfg.slug : '';
    const gAddrs = getSessionAddresses(cfg);
    const addr   = gAddrs.sbtFactory?.address;
    if (!addr) {
      contractsLog.log("No SBT factory address in group config:", slugOrEmpty);
      return '';
    }

    let provider = null;
    const chainId = Number(cfg?.networkChainId || 0) || null;
    if (chainId) {
      try {
        provider = getReadProviderForChain(chainId);
      } catch {
        provider = null;
      }
    }
    if (!provider) {
      const providerLocation = contractScripts.getProviderLocation(providerName);
      provider = new ethers.providers.Web3Provider(providerLocation as any);
    }

    const SBTFactory = new ethers.Contract(addr, SBT_FACTORY_ABI, provider as any);
    try {
      if (useConfiguredDeterministic) {
        return await SBTFactory.predictConfiguredSBTAddress(
          create2SaltNormalized,
          name,
          symbol,
          limitedNumber,
          adminAddress,
          mintingEndTime,
          hasPasswordMint,
          burnAuth,
          hashedPasswords,
          initializeGroupPasswordHash
        );
      }
      return await SBTFactory.predictSBTAddress(
        create2SaltNormalized,
        name,
        symbol,
        limitedNumber,
        adminAddress,
        mintingEndTime,
        hasPasswordMint,
        burnAuth,
        hashedPasswords,
        tokenURI,
        groupPasswordHash
      );
    } catch (err: any) {
      const normalizedError = useConfiguredDeterministic
        ? maybeWrapUnsupportedConfiguredDeterministicFactoryError(err, addr)
        : err;
      contractsLog.error('[predictSBTAddress] failed:', normalizedError?.message || normalizedError);
      throw normalizedError;
    }
  },


  async getSurveyResponsesByAddress(providerName: any, userAddress: any, fromBlock: any = null, toBlock: any = null, groupKeyOrCfg: any = null) {
  return contractEventScanMethods.getSurveyResponsesByAddress(
    this,
    providerName,
    userAddress,
    fromBlock,
    toBlock,
    groupKeyOrCfg
  );
},

  async getSurveyResponses(providerName: any, fromCustomBlock: any = 0, toCustomBlock: any = 'latest', groupKeyOrCfg: any = null) {
  const cfg    = resolveSession(groupKeyOrCfg || '');
  const gAddrs = getSessionAddresses(cfg);
  const addr   = (gAddrs.surveys?.address);
  const chId   = (gAddrs.surveys?.chainId) || (cfg?.networkChainId) || undefined;

  const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
  const contract = new ethers.Contract(addr, SURVEYS, provider as any);
  const responsesSubmittedEventFilter = contract.filters.ResponsesSubmitted(null, null, null);

  // Per-group base window + clamp caller overrides
  const { fromBlock: baseFrom, toBlock: baseTo } =
    await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, { _resolvedCfg: cfg });

  const fromBlock = Number.isFinite(Number(fromCustomBlock))
    ? Math.max(Number(fromCustomBlock), baseFrom)
    : baseFrom;

  const toBlock = (toCustomBlock === 'latest' || typeof toCustomBlock !== 'number')
    ? baseTo
    : Math.min(Number(toCustomBlock), baseTo);

  if (fromBlock > toBlock) return {};

  rpcLog('getSurveyResponses: Fetching logs with fetchLogsSmartWithProvider:', {
    address: contract.address, fromBlock, toBlock
  });
  const rawLogs = await fetchLogsSmartWithProvider(provider, responsesSubmittedEventFilter, fromBlock, toBlock);
  const events = rawLogs.map((log: any) => SURVEYS_INTERFACE.parseLog(log));

  const surveyResponses: any = {};
  const responseEntries = await Promise.all(events.map(async (event: any) => {
    const responder = event.args.responder.toLowerCase();
    const surveyId = event.args.surveyId.toLowerCase();
    const responseData = await this.getSurveyResponse(providerName, responder, surveyId, groupKeyOrCfg);
    return { responder, responseData, surveyId };
  }));
  for (const { responder, responseData, surveyId } of responseEntries) {
    if (responseData) {
      if (!surveyResponses[surveyId]) {
        surveyResponses[surveyId] = {};
      }
      surveyResponses[surveyId][responder] = responseData;
    }
  }
  return surveyResponses;
},

  async getSurveysCreatedByAddress(providerName: any, userAddress: any, fromBlock: any = null, toBlock: any = null, groupKeyOrCfg: any = null) {
  return contractEventScanMethods.getSurveysCreatedByAddress(
    this,
    providerName,
    userAddress,
    fromBlock,
    toBlock,
    groupKeyOrCfg
  );
},

  async getQuestionResponses(
  providerName: any,
  fromCustomBlock: any = 0,
  toCustomBlock: any = 'latest',
  onChunkProgress: any = null,
  groupKeyOrCfg: any = null
) {
  const cfg    = resolveSession(groupKeyOrCfg || '');
  const gAddrs = getSessionAddresses(cfg);
  const addr   = (gAddrs.surveys?.address);
  const chId   = (gAddrs.surveys?.chainId) || (cfg?.networkChainId) || undefined;

  const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
  const contract = new ethers.Contract(addr, SURVEYS, provider as any);
  const responsesSubmittedEventFilter = contract.filters.ResponsesSubmitted(null, null, null);

  // Per-group base window + clamp caller overrides
  const { fromBlock: baseFrom, toBlock: baseTo } =
    await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, { _resolvedCfg: cfg });

  const fromBlock = Number.isFinite(Number(fromCustomBlock))
    ? Math.max(Number(fromCustomBlock), baseFrom)
    : baseFrom;

  const toBlock = (toCustomBlock === 'latest' || typeof toCustomBlock !== 'number')
    ? baseTo
    : Math.min(Number(toCustomBlock), baseTo);

  if (fromBlock > toBlock) {
    return {};
  }

  rpcLog('getQuestionResponses: Fetching logs with fetchLogsSmartWithProvider:', {
    address: contract.address, fromBlock, toBlock
  });
  const rawLogs = await fetchLogsSmartWithProvider(provider, responsesSubmittedEventFilter, fromBlock, toBlock);
  const allEventData = rawLogs.map((log: any) => SURVEYS_INTERFACE.parseLog(log));

  const questionResponses: any = {};
  await Promise.all(
    allEventData.map(async (event: any) => {
      const responder = event.args.responder.toLowerCase();
      const questionIds = event.args.questionIds.map((q: any) => q.toLowerCase());

      const respArray = await Promise.all(
        questionIds.map((qId: any) => this.getResponse(providerName, responder, qId, groupKeyOrCfg, {
          _resolvedCfg: cfg,
        }).catch((e: any) => {
          contractsLog.warn('[getQuestionResponses] individual response read failed; skipping', { qId, error: e?.message });
          return null;
        }))
      );

      respArray.forEach((responseData: any, idx: any) => {
        if (responseData) {
          const qId = questionIds[idx];
          if (!questionResponses[qId]) questionResponses[qId] = {};
          questionResponses[qId][responder] = responseData;
        }
      });
    })
  );

  if (onChunkProgress) {
    onChunkProgress({
      chunkFrom: fromBlock,
      chunkTo: toBlock,
      doneSoFarBlocks: toBlock - fromBlock + 1,
      totalRangeBlocks: toBlock - fromBlock + 1,
      chunkEventCount: allEventData.length,
      overallEventCount: allEventData.length
    });
  }

  return questionResponses;
},

  async getQuestionResponsesChunkedWithCallback(
  providerName: any,
  fromCustomBlock: any = 0,
  toCustomBlock: any = 'latest',
  onChunkProgress: any = null,
  onPartialData: any = null,
  groupKeyOrCfg: any,
  opts: { forceArweaveFetch?: boolean } = {}
) {
  let resolvedFromBlockNum;
  let resolvedToBlockNum;

  try {
    const cfg    = resolveSession(groupKeyOrCfg || '');
    const forceArweaveFetch = !!(opts && opts.forceArweaveFetch === true);
    const gAddrs = getSessionAddresses(cfg);
    const addr   = (gAddrs.surveys?.address);
    const chId   = (gAddrs.surveys?.chainId) || (cfg?.networkChainId) || undefined;
    if (!addr) {
      contractsLog.warn('[getQuestionResponsesChunkedWithCallback] Missing surveys address; skipping scan.', {
        group: cfg?.slug || '',
      });
      if (onPartialData) onPartialData({}, Math.max(0, Number(fromCustomBlock || 0) - 1));
      return;
    }

    const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);

    const contract = new ethers.Contract(addr, SURVEYS, provider as any);
    const responsesSubmittedEventFilter = contract.filters.ResponsesSubmitted(null, null, null);

    // Per-group base window + clamp caller overrides
    const { fromBlock: baseFrom, toBlock: baseTo } =
      await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, { _resolvedCfg: cfg });

    resolvedFromBlockNum = Number.isFinite(Number(fromCustomBlock))
      ? Math.max(Number(fromCustomBlock), baseFrom)
      : baseFrom;

    resolvedToBlockNum = (toCustomBlock === 'latest' || typeof toCustomBlock !== 'number')
      ? baseTo
      : Math.min(Number(toCustomBlock), baseTo);

    if (resolvedFromBlockNum > resolvedToBlockNum) {
      if (onPartialData) onPartialData({}, resolvedFromBlockNum);
      return;
    }

    rpcLog('getQuestionResponsesChunkedWithCallback: Fetching logs:', {
      contractAddress: contract.address, fromBlock: resolvedFromBlockNum, toBlock: resolvedToBlockNum
    });
    const rawLogs = await fetchLogsSmartWithProvider(provider, responsesSubmittedEventFilter, resolvedFromBlockNum, resolvedToBlockNum);
    const parsedEvents = rawLogs.map((log: any) => ({
      event: SURVEYS_INTERFACE.parseLog(log),
      blockNumber: Number(log?.blockNumber || 0),
      transactionIndex: Number(log?.transactionIndex || 0),
      logIndex: Number(log?.logIndex || 0),
    }));

    // Deduplicate by (questionId,responder), keeping only the latest event for each pair.
    const latestByPair = new Map();
    parsedEvents.forEach(({ event, blockNumber, transactionIndex, logIndex }: any) => {
      const responder = String(event?.args?.responder || '').toLowerCase();
      const questionIds = Array.isArray(event?.args?.questionIds)
        ? event.args.questionIds.map((id: any) => String(id || '').toLowerCase())
        : [];
      questionIds.forEach((qId: any) => {
        if (!qId) return;
        const pairKey = `${qId}|${responder}`;
        const prev = latestByPair.get(pairKey);
        const isNewer =
          !prev ||
          blockNumber > Number(prev.blockNumber || 0) ||
          (
            blockNumber === Number(prev.blockNumber || 0) &&
            (
              transactionIndex > Number(prev.transactionIndex || 0) ||
              (
                transactionIndex === Number(prev.transactionIndex || 0) &&
                logIndex > Number(prev.logIndex || 0)
              )
            )
          );
        if (isNewer) {
          latestByPair.set(pairKey, { responder, qId, blockNumber, transactionIndex, logIndex });
        }
      });
    });

    const uniquePairs = Array.from(latestByPair.values());
    const fullRangeAggregator: any = {};
    await Promise.all(
      uniquePairs.map(async ({ responder, qId, blockNumber, transactionIndex, logIndex }: any) => {
        let blockTimestamp = 0;
        try {
          const blockData = await this.getBlockWithCaching(provider, blockNumber, providerName, String(chId));
          blockTimestamp = blockData ? (blockData.timestamp || 0) : 0;
        } catch (error: any) {
          blockTimestamp = Math.floor(Date.now() / 1000);
        }

        let respData = null;
        try {
          respData = await this.getResponse(providerName, responder, qId, groupKeyOrCfg, {
            _resolvedCfg: cfg,
            forceArweaveFetch,
          });
        } catch (e: any) {
          contractsLog.warn('[getQuestionResponsesFullRange] individual response read failed; skipping', { responder, qId, error: e?.message });
        }
        if (!respData) return;
        if (!fullRangeAggregator[qId]) fullRangeAggregator[qId] = [];
        fullRangeAggregator[qId].push({
          responder,
          questionId: qId,
          response: respData,
          timestamp: blockTimestamp,
          blockNumber,
          transactionIndex,
          logIndex,
        });
      })
    );

    if (onChunkProgress) {
      const totalRangeBlocks = resolvedToBlockNum - resolvedFromBlockNum + 1;
      onChunkProgress({
        chunkFrom: resolvedFromBlockNum,
        chunkTo: resolvedToBlockNum,
        doneSoFarBlocks: totalRangeBlocks,
        totalRangeBlocks: totalRangeBlocks,
        remainingBlocks: 0,
        chunkEventCount: parsedEvents.length,
        overallEventCount: uniquePairs.length
      });
    }

    if (onPartialData) {
      onPartialData(fullRangeAggregator, resolvedToBlockNum);
    }

  } catch (err: any) {
    contractsLog.error("Critical Error in getQuestionResponsesChunkedWithCallback:", err);
    if (onPartialData && resolvedFromBlockNum !== undefined) {
      onPartialData({}, resolvedFromBlockNum - 1);
    }
  }
},

  async getQuestionsCreatedByAddress(providerName: any, userAddress: any, fromBlock: any = null, toBlock: any = null, groupKeyOrCfg: any = null) {
  return contractEventScanMethods.getQuestionsCreatedByAddress(
    this,
    providerName,
    userAddress,
    fromBlock,
    toBlock,
    groupKeyOrCfg
  );
},

  async getQuestionResponsesByAddress(providerName: any, userAddress: any, fromBlock: any = null, toBlock: any = null, groupKeyOrCfg: any = null, opts: any = {}) {
  return contractEventScanMethods.getQuestionResponsesByAddress(
    this,
    providerName,
    userAddress,
    fromBlock,
    toBlock,
    groupKeyOrCfg,
    opts
  );
},

  async fetchUserSubmittedSurveyIDs(providerName: any, fromBlock: any = null, toBlock: any = null, groupKeyOrCfg: any) {
    const cfg    = resolveSession(groupKeyOrCfg || '');
    const blocklist = new Set(((cfg?.BLOCKED_SURVEY_IDS) || []).map((id: any) => id.toLowerCase()));

    const gAddrs = getSessionAddresses(cfg);
    const addr   = (gAddrs.surveys?.address);
    const chId   = (gAddrs.surveys?.chainId) || (cfg?.networkChainId) || undefined;
    if (!addr) {
      contractsLog.warn('[fetchUserSubmittedSurveyIDs] Missing surveys address; skipping scan.', {
        group: cfg?.slug || '',
      });
      return [];
    }

    // Provider resolution: group → chain provider; otherwise defaultProvider/Infura (no signer)
    const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);

    const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);
    const surveyAddedEventFilter = SurveyContract.filters.SurveyAdded(null, null);

    // Per-group base window + clamp caller overrides
    const { fromBlock: baseFrom, toBlock: baseTo } =
      await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, { _resolvedCfg: cfg });

    const fromBlockNum = Number.isFinite(Number(fromBlock))
      ? Math.max(Number(fromBlock), baseFrom)
      : baseFrom;

    const toBlockNum = (toBlock === 'latest' || typeof toBlock !== 'number')
      ? baseTo
      : Math.min(Number(toBlock), baseTo);

    if (fromBlockNum > toBlockNum) return [];

    rpcLog('fetchUserSubmittedSurveyIDs: Fetching logs:', {
      address: SurveyContract.address, fromBlock: fromBlockNum, toBlock: toBlockNum
    });
    const rawLogs = await fetchLogsSmartWithProvider(provider, surveyAddedEventFilter, fromBlockNum, toBlockNum);
    const events = rawLogs.map((log: any) => SURVEYS_INTERFACE.parseLog(log));

    // Refactored to return object with creationBlock
    const surveyMap = new Map();
    events.forEach((event: any) => {
        const id = event.args.surveyId.toLowerCase();
        if (id && id !== ethers.constants.HashZero.toLowerCase() && !blocklist.has(id)) {
            // Keep the earliest block number if duplicates exist (though unlikely for creation)
            if (!surveyMap.has(id) || event.blockNumber < surveyMap.get(id)) {
                surveyMap.set(id, event.blockNumber);
            }
        }
    });

    // Return array of objects: { surveyId, creationBlock }
    return Array.from(surveyMap.entries()).map(([sid, bn]: any) => ({ surveyId: sid, creationBlock: bn }));
  },


  async fetchAllSurveyResponses(providerName: any, surveyId: any, fromBlockParam: any = null, toBlockParam: any = null, groupKeyOrCfg: any) {
  const cfg    = resolveSession(groupKeyOrCfg || '');
  const gAddrs = getSessionAddresses(cfg);
  const addr   = (gAddrs.surveys?.address);
  const chId   = (gAddrs.surveys?.chainId) || (cfg?.networkChainId) || undefined;

  const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);

  const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

  // 🔐 Normalize
  const ensureHash = (v: any) => {
    try {
      if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
    } catch {}
    try { if (utils.isHexString(v, 32)) return String(v).toLowerCase(); } catch {}
    const s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
  };
  const sId = ensureHash(surveyId);
  if (!utils.isHexString(sId, 32)) {
    return { responses: [], hadPartialFailure: false, lowestFailedBlock: null };
  }

  const responseSubmittedEventTopic = SurveyContract.filters.ResponsesSubmitted(null, null, sId);

  // Per-group base window + clamp caller overrides
  const { fromBlock: baseFrom, toBlock: baseTo } =
    await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, { _resolvedCfg: cfg });

  const fromBlockNum = Number.isFinite(Number(fromBlockParam))
    ? Math.max(Number(fromBlockParam), baseFrom)
    : baseFrom;

  const toBlockNum = (toBlockParam === 'latest' || typeof toBlockParam !== 'number')
    ? baseTo
    : Math.min(Number(toBlockParam), baseTo);

  if (fromBlockNum > toBlockNum) {
    return { responses: [], hadPartialFailure: false, lowestFailedBlock: null };
  }

  rpcLog('fetchAllSurveyResponses: Fetching logs:', {
    address: SurveyContract.address, fromBlock: fromBlockNum, toBlock: toBlockNum, surveyId: sId
  });
  const rawLogs = await fetchLogsSmartWithProvider(provider, responseSubmittedEventTopic, fromBlockNum, toBlockNum);
  const parsedEvents = rawLogs.map((log: any) => ({
    event: SURVEYS_INTERFACE.parseLog(log),
    blockNumber: Number(log?.blockNumber || 0),
    logIndex: Number(log?.logIndex || 0),
  }));

  // Deduplicate by responder; keep only the newest event to avoid repeated response fetches.
  const latestByResponder = new Map();
  parsedEvents.forEach(({ event, blockNumber, logIndex }: any) => {
    const responder = String(event?.args?.responder || '').toLowerCase();
    if (!responder) return;
    const prev = latestByResponder.get(responder);
    const isNewer =
      !prev ||
      blockNumber > Number(prev.blockNumber || 0) ||
      (blockNumber === Number(prev.blockNumber || 0) && logIndex > Number(prev.logIndex || 0));
    if (isNewer) {
      latestByResponder.set(responder, { responder, blockNumber, logIndex });
    }
  });

  const responderEntries = Array.from(latestByResponder.values());
  const responseReadResults = await Promise.all(
    responderEntries.map(async ({ responder, blockNumber, logIndex }: any) => {
      let blockTimestamp = 0;
      try {
        const blockData = await this.getBlockWithCaching(provider, blockNumber, providerName, String(chId));
        if (blockData) blockTimestamp = blockData.timestamp;
      } catch {}
      let surveyResponseData = null;
      try {
        surveyResponseData = await this.getSurveyResponse(
          providerName,
          responder,
          sId,
          groupKeyOrCfg,
          { throwOnError: true }
        );
      } catch (error: any) {
        const retryable = isRetryableSurveyResponseReadError(error);
        contractsLog.warn('[fetchAllSurveyResponses] individual response read failed; skipping', {
          error: error?.message,
          retryable,
        });
        return { failed: true, blockNumber, retryable };
      }
      if (surveyResponseData === null) return null;
      return {
        failed: false,
        response: {
          responder,
          surveyId: sId,
          response: surveyResponseData,
          timestamp: blockTimestamp,
          blockNumber,
          logIndex,
        },
      };
    })
  );

  let hadPartialFailure = false;
  let lowestFailedBlock: number | null = null;
  const responses = responseReadResults.reduce((acc: any, result: any) => {
    if (!result) return acc;
    if (result.failed) {
      if (!result.retryable) return acc;
      hadPartialFailure = true;
      const failedBlock = Number(result.blockNumber || 0);
      if (
        Number.isFinite(failedBlock) &&
        failedBlock > 0 &&
        (lowestFailedBlock === null || failedBlock < lowestFailedBlock)
      ) {
        lowestFailedBlock = failedBlock;
      }
      return acc;
    }
    acc.push(result.response);
    return acc;
  }, []);

  return {
    responses,
    hadPartialFailure,
    lowestFailedBlock,
  };
},

    // === CHANGED: +groupKeyOrCfg (optional). Threads group to getSurveyHash.
async getSurveyDataById(providerName: any, surveyId: any, groupKeyOrCfg: any, opts: any = {}) {
  if (!surveyId || surveyId === ethers.constants.HashZero) {
    return null;
  }
  const sId = String(surveyId || '').toLowerCase();
  const { baseKey } = resolveReadContext(groupKeyOrCfg);
  const modeTag = buildDecryptModeTag(opts);
  const failureModeTag = buildFailureModeTag(opts);
  const forceArweaveFetch = !!(opts && opts.forceArweaveFetch === true);
  const inflightKey = `${baseKey}|${sId}|${modeTag}|${failureModeTag}|force:${forceArweaveFetch ? '1' : '0'}`;

  try {
    const result = await runInFlightCoalesced(
      READ_INFLIGHT.surveyData,
      inflightKey,
      async () => {
        rpcLog('RPC Call:', { function: 'getSurveyDataById', method: 'this.getSurveyHash', params: { surveyId: sId } });
        const arweaveSurveyHash = await this.getSurveyHash(providerName, sId, groupKeyOrCfg, {
          throwOnError: !!(opts && opts.throwOnFailure),
        });

        if (!ARWEAVE_ACTIVE || !arweaveSurveyHash || arweaveSurveyHash === arweaveScripts.hexToBase64url(ethers.constants.HashZero)) {
          if (opts && opts.throwOnFailure && ARWEAVE_ACTIVE) {
            throw buildHashUnavailableMetadataError(
              `Survey hash unavailable for survey ${sId}`,
              { txId: '' }
            );
          }
          return null;
        }

        const arweaveSurveyData = await downloadArweaveTextForGroup({
          txId: arweaveSurveyHash,
          groupKeyOrCfg,
          arweaveOpts: {
            disableExistencePrecheck: true,
            preflightTxExistence: false,
            forceRetry: forceArweaveFetch,
            cacheBypass: forceArweaveFetch,
            bypassFailureCache: forceArweaveFetch,
            debugContext: buildArweaveDebugContext(groupKeyOrCfg, 'survey_metadata', {
              fn: 'getSurveyDataById',
              surveyId: sId,
            }),
          },
        });
        let surveyData = null;
        try {
          surveyData = JSON.parse(arweaveSurveyData);
        } catch (parseErr: any) {
          throw await recordTerminalArweaveInvalidFailure({
            groupKeyOrCfg,
            txId: arweaveSurveyHash,
            message: `Invalid survey metadata JSON for tx ${arweaveSurveyHash}`,
            cause: parseErr,
          });
        }
        normalizeSessionNameFields(surveyData);
        const skipDecrypt = !!(opts && (opts.skipDecrypt || opts.decrypt === false));
        if (!skipDecrypt) {
          await contractMetadataResolutionHelpers.maybeDecryptSurveyPayload(surveyData, groupKeyOrCfg, opts);
        }
        return surveyData;
      }
    );
    return cloneJsonSafe(result);
  } catch (error: any) {
    logArweaveMetadataFetchFailure({ scope: 'survey', error });
    if (opts && opts.throwOnFailure) throw error;
    return null;
  }
},


    // === CHANGED: pass-through group to getResponse
  async getSurveyResponse(providerName: any, userAddress: any, surveyId: any, groupKeyOrCfg: any, opts: any = {}) {
    const response = await this.getResponse(providerName, userAddress, surveyId, groupKeyOrCfg, {
      ...(opts && typeof opts === 'object' ? opts : {}),
      responseCategory: 'survey_response_payload',
    });
    return response;
  },

  addSurveyWithQuestions: async function (
    providerName: any,
    surveyId: any,
    surveyData: any,
    questionIds: any,
    questionDataArray: any,
    groupKeyOrCfg: any = null
  ) {
    if (providerName === 'none') {
      throw new Error('addSurveyWithQuestions requires a signer-capable provider (not read-only).');
    }

    const providerLocation = contractScripts.getProviderLocation(providerName);
    const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
    const signer = ethersProvider.getSigner();

    // Group-aware address resolution (no hard-coded fallback)
    const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
    const gAddrs = getSessionAddresses(cfg);
    const addr = gAddrs.surveys?.address;
    if (!addr) {
      const slug = normalizeSessionSlug(typeof groupKeyOrCfg === 'string' ? groupKeyOrCfg : cfg?.slug || '');
      throw new Error(`[addSurveyWithQuestions] Missing surveys contract address for session slug "${slug || 'general'}".`);
    }
    const SurveyContract = new ethers.Contract(addr, SURVEYS, signer as any);

    let surveyPayloadUpload = null;
    let questionPayloadUploads: any[] = [];

    // Normalize IDs to bytes32
    const ensureHash = (v: any) => {
      try {
        if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
      } catch {}
      try {
        if (utils.isHexString(v, 32)) return String(v).toLowerCase();
      } catch {}
      const s = v == null ? '' : String(v);
      return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
    };

    const sId = ensureHash(surveyId);
    const qIds32 = (Array.isArray(questionIds) ? questionIds : []).map(ensureHash);

    if (!utils.isHexString(sId, 32)) throw new Error('addSurveyWithQuestions: surveyId is not a bytes32.');
    qIds32.forEach((id: any, i: any) => {
      if (!utils.isHexString(id, 32)) throw new Error(`addSurveyWithQuestions: questionIds[${i}] is not bytes32.`);
    });

    const canUseSessionStorage = isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.SURVEYS)
      || isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.QUESTIONS);
    if (ARWEAVE_ACTIVE || canUseSessionStorage) {
      // Safety net: inject sessionName/sessionSlug if caller omitted it
      const _sessionName = String((cfg?.sessionName || cfg?.slug || '') || '');
      const _sessionSlug = resolveStorageSessionSlug(groupKeyOrCfg, cfg);
      const _sessionMetadataOptions = _sessionSlug ? { sessionSlug: _sessionSlug } : {};
      const surveyDataToUpload = normalizeSessionNameFields({
        ...(surveyData || {}),
      }, _sessionName, _sessionMetadataOptions);

      const qArrayToUpload = (Array.isArray(questionDataArray) ? questionDataArray : []).map((q: any) => (
        normalizeSessionNameFields({
          ...(q || {}),
        }, _sessionName, _sessionMetadataOptions)
      ));

      validateNoLockedPlaintextInPayload(surveyDataToUpload, {
        family: 'survey_metadata',
        path: 'survey metadata',
      });
      qArrayToUpload.forEach((questionData: any, index: any) => {
        validateNoLockedPlaintextInPayload(questionData, {
          family: 'question_metadata',
          path: `question metadata[${index}]`,
        });
      });

      const arweaveUploadOpts = await resolveArweaveUploadOpts(groupKeyOrCfg, {
          providerLike: ethersProvider,
          signer,
      });
      surveyPayloadUpload = await uploadJsonPayloadForContractPointer({
        payload: surveyDataToUpload,
        resource: STORAGE_RESOURCE_KEYS.SURVEYS,
        groupKeyOrCfg,
        cfg,
        arweaveUploadOpts,
        storageContext: {
          account: await signer.getAddress().catch(() => ''),
          providerLike: ethersProvider,
        },
      });

      for (let questionData of qArrayToUpload) {
        const questionPayloadUpload = await uploadJsonPayloadForContractPointer({
          payload: questionData,
          resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
          groupKeyOrCfg,
          cfg,
          arweaveUploadOpts,
          storageContext: {
            account: await signer.getAddress().catch(() => ''),
            providerLike: ethersProvider,
          },
        });
        questionPayloadUploads.push(questionPayloadUpload);
      }
    } else {
      throw new Error('Payload uploads are disabled; cannot create survey/questions.');
    }

    const surveyArweaveHashBytes = surveyPayloadUpload.pointerBytes;
    const questionArweaveHashesBytes = questionPayloadUploads.map((upload: any) => upload.pointerBytes);

    rpcLog('RPC Call (Tx):', {
      function: 'addSurveyWithQuestions',
      method: 'SurveyContract.addSurvey',
      params: {
        surveyId: sId,
        surveyArweaveHashBytes,
        questionIdsCount: qIds32.length,
        questionArweaveHashesBytesCount: questionArweaveHashesBytes.length,
      },
    });

    const txOverrides = await resolveTxGasOverrides({
      contract: SurveyContract,
      method: 'addSurvey',
      args: [sId, surveyArweaveHashBytes, qIds32, questionArweaveHashesBytes],
      fallbackGasLimit: String(GAS_FALLBACKS.addSurvey(qIds32.length)),
      minEstimate: '80000',
      logLabel: 'addSurveyWithQuestions',
      preferFallbackGasLimit: true,
    });
    try {
      const { receipt } = await sendContractWriteViaProvider({
        signingProvider: providerLocation,
        ethersProvider,
        signer,
        contract: SurveyContract,
        method: 'addSurvey',
        args: [sId, surveyArweaveHashBytes, qIds32, questionArweaveHashesBytes],
        txOverrides,
        rpcFunction: 'addSurveyWithQuestions',
        revertMessage: 'addSurveyWithQuestions transaction reverted on-chain.',
      });
      clearReadCachesForGroup(groupKeyOrCfg);
      const surveyStorageRef = surveyPayloadUpload.storageRef;
      const uploadedQuestions = qIds32.map((id: any, index: any) => (
        attachStorageRefCompatibilityFields({
          questionId: id,
          arweaveTxId: questionPayloadUploads[index]?.arweaveTxId || '',
          storageRef: questionPayloadUploads[index]?.storageRef || null,
          resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
        }, { resource: STORAGE_RESOURCE_KEYS.QUESTIONS })
      ));
      return {
        receipt,
        ...(surveyPayloadUpload.arweaveTxId ? { surveyArweaveTxId: surveyPayloadUpload.arweaveTxId } : {}),
        ...(surveyStorageRef ? { surveyStorageRef } : {}),
        uploadedQuestions,
      };
    } catch (error: any) {
      notifyUserFacingTransactionError(error);
      throw error;
    }
  },


  addQuestions: async function (
    providerName: any,
    questionIds: any,
    questionDataArray: any,
    surveyIds: any,
    groupKeyOrCfg: any = null
  ) {
    if (providerName === 'none') {
      throw new Error('addQuestions requires a signer-capable provider (not read-only).');
    }

    const providerLocation = contractScripts.getProviderLocation(providerName);
    const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
    const signer = ethersProvider.getSigner();

    // Group-aware address resolution (no hard-coded fallback)
    const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
    const gAddrs = getSessionAddresses(cfg);
    const addr = gAddrs.surveys?.address;
    if (!addr) {
      const slug = normalizeSessionSlug(typeof groupKeyOrCfg === 'string' ? groupKeyOrCfg : cfg?.slug || '');
      throw new Error(`[addQuestions] Missing surveys contract address for session slug "${slug || 'general'}".`);
    }
    const SurveyContract = new ethers.Contract(addr, SURVEYS, signer as any);

    let questionPayloadUploads: any[] = [];

    // Normalize IDs to bytes32
    const ensureHash = (v: any) => {
      try {
        if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
      } catch {}
      try {
        if (utils.isHexString(v, 32)) return String(v).toLowerCase();
      } catch {}
      const s = v == null ? '' : String(v);
      return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
    };

    const qIds32 = (Array.isArray(questionIds) ? questionIds : []).map(ensureHash);
    const sIds32 = (Array.isArray(surveyIds) ? surveyIds : []).map(ensureHash);

    qIds32.forEach((id: any, i: any) => {
      if (!utils.isHexString(id, 32)) throw new Error(`addQuestions: questionIds[${i}] is not a bytes32.`);
    });
    sIds32.forEach((id: any, i: any) => {
      if (!utils.isHexString(id, 32)) throw new Error(`addQuestions: surveyIds[${i}] is not a bytes32.`);
    });

    const canUseSessionStorage = isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.QUESTIONS);
    if (ARWEAVE_ACTIVE || canUseSessionStorage) {
      // Safety net: inject sessionName/sessionSlug if caller omitted it
      const _sessionName = String((cfg?.sessionName || cfg?.slug || '') || '');
      const _sessionSlug = resolveStorageSessionSlug(groupKeyOrCfg, cfg);
      const _sessionMetadataOptions = _sessionSlug ? { sessionSlug: _sessionSlug } : {};
      const qArrayToUpload = (Array.isArray(questionDataArray) ? questionDataArray : []).map((q: any) => (
        normalizeSessionNameFields({
          ...(q || {}),
        }, _sessionName, _sessionMetadataOptions)
      ));

      qArrayToUpload.forEach((questionData: any, index: any) => {
        validateNoLockedPlaintextInPayload(questionData, {
          family: 'question_metadata',
          path: `question metadata[${index}]`,
        });
      });

      const arweaveUploadOpts = await resolveArweaveUploadOpts(groupKeyOrCfg, {
        providerLike: ethersProvider,
        signer,
      });

      for (let questionData of qArrayToUpload) {
        const questionPayloadUpload = await uploadJsonPayloadForContractPointer({
          payload: questionData,
          resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
          groupKeyOrCfg,
          cfg,
          arweaveUploadOpts,
          storageContext: {
            account: await signer.getAddress().catch(() => ''),
            providerLike: ethersProvider,
          },
        });
        questionPayloadUploads.push(questionPayloadUpload);
      }
    } else {
      throw new Error('Payload uploads are disabled; cannot add questions.');
    }

    const questionArweaveHashBytesArray = questionPayloadUploads.map((upload: any) => upload.pointerBytes);

    rpcLog('RPC Call (Tx):', {
      function: 'addQuestions',
      method: 'SurveyContract.addQuestions',
      params: {
        questionIdsCount: qIds32.length,
        questionArweaveHashBytesArrayCount: questionArweaveHashBytesArray.length,
        surveyIdsCount: sIds32.length,
      },
    });

    const txOverrides = await resolveTxGasOverrides({
      contract: SurveyContract,
      method: 'addQuestions',
      args: [qIds32, questionArweaveHashBytesArray, sIds32],
      fallbackGasLimit: String(GAS_FALLBACKS.addQuestions(qIds32.length)),
      minEstimate: '80000',
      logLabel: 'addQuestions',
      preferFallbackGasLimit: true,
    });
    const { receipt } = await sendContractWriteViaProvider({
      signingProvider: providerLocation,
      ethersProvider,
      signer,
      contract: SurveyContract,
      method: 'addQuestions',
      args: [qIds32, questionArweaveHashBytesArray, sIds32],
      txOverrides,
      rpcFunction: 'addQuestions',
      revertMessage: 'addQuestions transaction reverted on-chain.',
    });

    const uploadedQuestions = qIds32.map((id: any, index: any) => {
      const upload = questionPayloadUploads[index] || {};
      return attachStorageRefCompatibilityFields({
        questionId: id,
        arweaveTxId: upload.arweaveTxId || '',
        storageRef: upload.storageRef || null,
        resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
      }, { resource: STORAGE_RESOURCE_KEYS.QUESTIONS });
    });

    clearReadCachesForGroup(groupKeyOrCfg);
    return { receipt, uploadedQuestions };
  },


  submitResponses: async function (providerName: any, questionIds: any, questionResponses: any, surveyId: any, surveyResponse: any, groupKeyOrCfg: any = null) {
  if (providerName === 'none') {
    throw new Error('submitResponses: read-only provider is not allowed here. Connect a wallet first.');
  }
  // Resolve the interactive signing provider based on the caller's intent.
  // Keep all ethers logic here, as requested.
  let signingProvider = contractScripts.getProviderLocation(providerName);

  // Keep Web3Auth override for easy re-enable; it is no-op without a provider.
  if (providerName === 'web3auth') {
    if (window.web3authProvider) {
      signingProvider = window.web3authProvider;
    } else {
      throw new Error('Selected wallet provider is not available. Log in or reconnect your wallet first.');
    }
  }

  // 🔐 Normalize identifiers to bytes32 at the boundary
  const ensureHash = (v: any) => {
    try {
      if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') {
        return cryptoUtils.hashIdentifier(v);
      }
    } catch {}
    try { if (utils.isHexString(v, 32)) return String(v).toLowerCase(); } catch {}
    const s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
  };

  const hashedQuestionIds = Array.isArray(questionIds) ? questionIds.map(ensureHash) : [];
  const hashedSurveyId = ensureHash(surveyId);

  // Optional preflight
  hashedQuestionIds.forEach((id: any, i: any) => {
    if (!utils.isHexString(id, 32)) throw new Error(`submitResponses: questionIds[${i}] is not a bytes32.`);
  });
  if (!utils.isHexString(hashedSurveyId, 32)) {
    throw new Error('submitResponses: surveyId is not a bytes32.');
  }

  // Build ethers provider/signer from the chosen interactive provider.
  const ethersProvider = new ethers.providers.Web3Provider(signingProvider as any);
  const signer = ethersProvider.getSigner();
  const userAddress = await signer.getAddress(); // throws if no account

  // Prepare data to upload and on-chain params.
  let questionResponseUploads: any[] = [];
  let surveyResponseHashBytes = ethers.constants.HashZero;

  const cfg = resolveSession(groupKeyOrCfg || '');
  const canUseSessionStorage = isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.RESPONSES);
  if (ARWEAVE_ACTIVE || canUseSessionStorage) {
    const uploadContext = {
      account: userAddress,
      providerLike: ethersProvider,
      signer,
      chainId: cfg?.networkChainId || null,
    };
    const arweaveOpts = {
      ...(await resolveArweaveUploadOpts(groupKeyOrCfg, {
        providerLike: ethersProvider,
        signer,
      })),
      context: uploadContext,
    };
    if (surveyResponse) {
      validateNoLockedPlaintextInPayload(surveyResponse, {
        family: 'survey_response_payload',
        path: 'survey response',
      });
      const surveyResponseUpload = await uploadJsonPayloadForContractPointer({
        payload: surveyResponse,
        resource: STORAGE_RESOURCE_KEYS.RESPONSES,
        groupKeyOrCfg,
        cfg,
        arweaveUploadOpts: arweaveOpts,
        uploadWithRetry: true,
        storageContext: uploadContext,
      });
      surveyResponseHashBytes = surveyResponseUpload.pointerBytes;
    }
    // Upload response objects sequentially to avoid Arweave anchor/signature races
    // that can appear when multiple uploads are posted in parallel for one wallet.
    questionResponseUploads = [];
    for (const response of questionResponses) {
      validateNoLockedPlaintextInPayload(response, {
        family: 'question_response_payload',
        path: 'question response',
      });
      // eslint-disable-next-line no-await-in-loop
      const responseUpload = await uploadJsonPayloadForContractPointer({
        payload: response,
        resource: STORAGE_RESOURCE_KEYS.RESPONSES,
        groupKeyOrCfg,
        cfg,
        arweaveUploadOpts: arweaveOpts,
        uploadWithRetry: true,
        storageContext: uploadContext,
      });
      questionResponseUploads.push(responseUpload);
    }
  } else {
    return; // no-op when no configured payload storage path is available
  }

  const questionResponseHashesBytes = questionResponseUploads.map((upload: any) => upload.pointerBytes);

  // === Address resolution (group-aware; no SURVEYS_ADDRESS fallback)
  const gAddrs = getSessionAddresses(cfg);
  const addr   = gAddrs.surveys?.address;
  if (!addr) {
    contractsLog.log('[submitResponses] Missing surveys address in group config; aborting tx.');
    return; // early return (no throw)
  }

  const SurveyContract = new ethers.Contract(addr, SURVEYS, signer as any);
  const txArgs: any[] = [
    hashedQuestionIds,
    questionResponseHashesBytes,
    hashedSurveyId,
    surveyResponseHashBytes,
  ];
  const txOverrides = await resolveTxGasOverrides({
    contract: SurveyContract,
    method: 'submitResponses',
    args: txArgs,
    fallbackGasLimit: String(GAS_FALLBACKS.submitResponses(hashedQuestionIds.length)),
    minEstimate: '80000',
    logLabel: 'submitResponses',
    preferFallbackGasLimit: true,
  });

  rpcLog('RPC Call (Tx):', {
    function: 'submitResponses',
    method: 'SurveyContract.submitResponses',
    params: {
      userAddress,
      questionIdsCount: hashedQuestionIds.length,
      gasLimit: txOverrides?.gasLimit?.toString?.() || null,
    }
  });

  try {
    const { receipt } = await sendContractWriteViaProvider({
      signingProvider,
      ethersProvider,
      signer,
      contract: SurveyContract,
      method: 'submitResponses',
      args: txArgs,
      txOverrides,
      rpcFunction: 'submitResponses',
      revertMessage: 'submitResponses transaction reverted on-chain.',
    });
    clearReadCachesForGroup(groupKeyOrCfg);
    return receipt;
  } catch (error: any) {
    notifyUserFacingTransactionError(error);
    contractsLog.error('Error sending transaction with provider.request:', error);
    throw error;
  }
  },

  async getResponseHash(providerName: any, userAddress: any, id: any, groupKeyOrCfg: any, opts: any = {}) {
  const cfg    = (
    opts &&
    typeof opts === 'object' &&
    opts._resolvedCfg &&
    typeof opts._resolvedCfg === 'object'
  ) ? opts._resolvedCfg : resolveSession(groupKeyOrCfg || '');
  const gAddrs = getSessionAddresses(cfg);
  const addr   = (gAddrs.surveys?.address);
  const chId   = (gAddrs.surveys?.chainId) || (cfg?.networkChainId) || undefined;
  const throwOnError = !!(opts && opts.throwOnError);

  if (!addr) {
    if (throwOnError) throw new Error('Missing surveys address for response hash lookup.');
    return null;
  }

  const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
  const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

  // 🔐 Normalize ID to bytes32
  const ensureHash = (v: any) => {
    try {
      if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
    } catch {}
    try { if (utils.isHexString(v, 32)) return String(v).toLowerCase(); } catch {}
    const s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
  };
  const idB32 = ensureHash(id);
  const responderLower = String(userAddress || '').toLowerCase();
  const { baseKey } = resolveReadContext(groupKeyOrCfg);
  const inflightKey = `${baseKey}|${responderLower}|${idB32}|hash`;

  try {
    const result = await runInFlightCoalesced(
      READ_INFLIGHT.response,
      inflightKey,
      async () => {
        rpcLog('RPC Call:', {
          function: 'getResponseHash',
          method: 'SurveyContract.getResponse',
          params: { userAddress: responderLower, id: idB32 },
        });
        const arweaveHash = await callWithRetry(
          () => SurveyContract.getResponse(responderLower, idB32),
          'SurveyContract.getResponse'
        );
        if (!arweaveHash || arweaveHash === ethers.constants.HashZero) {
          return null;
        }
        return arweaveScripts.hexToBase64url(arweaveHash);
      }
    );
    return (typeof result === 'string' && result) ? result : null;
  } catch (error: any) {
    if (throwOnError) throw error;
    contractsLog.error('Error getting response hash:', error);
    return null;
  }
  },

  async getResponse(providerName: any, userAddress: any, id: any, groupKeyOrCfg: any, opts: any = {}) {
  const cfg    = (
    opts &&
    typeof opts === 'object' &&
    opts._resolvedCfg &&
    typeof opts._resolvedCfg === 'object'
  ) ? opts._resolvedCfg : resolveSession(groupKeyOrCfg || '');
  const gAddrs = getSessionAddresses(cfg);
  const addr   = (gAddrs.surveys?.address);
  const chId   = (gAddrs.surveys?.chainId) || (cfg?.networkChainId) || undefined;
  const throwOnError = !!(opts && (opts.throwOnError || opts.throwOnFailure));

  if (!addr) {
    if (throwOnError) {
      throw new Error('Missing surveys address for response lookup.');
    }
    return null;
  }

  const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);

  const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

  // 🔐 Normalize ID to bytes32
  const ensureHash = (v: any) => {
    try {
      if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
    } catch {}
    try { if (utils.isHexString(v, 32)) return String(v).toLowerCase(); } catch {}
    const s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
  };
  const idB32 = ensureHash(id);
  const responderLower = String(userAddress || '').toLowerCase();
  const responseCategory = String(opts?.responseCategory || '').trim().toLowerCase() === 'survey_response_payload'
    ? 'survey_response_payload'
    : 'question_response_payload';
  const forceArweaveFetch = !!opts?.forceArweaveFetch;
  const { baseKey } = resolveReadContext(groupKeyOrCfg);
  const inflightKey = `${baseKey}|${responderLower}|${idB32}|strict:${throwOnError ? '1' : '0'}|force:${forceArweaveFetch ? '1' : '0'}`;
  const readE2EMockedViewedResponse = () => {
    if (typeof window === 'undefined') return null;
    if (globalThis.CE_E2E_LIT_MOCK !== true) return null;
    const responseKey = `${responderLower}|${idB32}`;

    try {
      const globalMocks = (
        window.__CE_E2E_MOCKED_VIEWED_RESPONSES__
        && typeof window.__CE_E2E_MOCKED_VIEWED_RESPONSES__ === 'object'
      ) ? window.__CE_E2E_MOCKED_VIEWED_RESPONSES__ : null;
      const globalHit = globalMocks?.[responseKey];
      if (globalHit && typeof globalHit === 'object') {
        return cloneJsonSafe(globalHit);
      }
    } catch {}

    try {
      const raw = window.sessionStorage?.getItem('ce:e2e:mockedViewedResponses:v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const hit = parsed?.[responseKey];
      if (hit && typeof hit === 'object') {
        return cloneJsonSafe(hit);
      }
    } catch {}

    return null;
  };
  try {
    const result = await runInFlightCoalesced(
      READ_INFLIGHT.response,
      inflightKey,
      async () => {
        rpcLog('RPC Call:', { function: 'getResponse', method: 'SurveyContract.getResponse', params: { userAddress: responderLower, id: idB32 } });
        const arweaveHash = await callWithRetry(() => SurveyContract.getResponse(responderLower, idB32), 'SurveyContract.getResponse');

        if (!arweaveHash || arweaveHash === ethers.constants.HashZero) {
          if (throwOnError && ARWEAVE_ACTIVE) {
            throw buildHashUnavailableMetadataError(
              `Response hash unavailable for responder ${responderLower} and id ${idB32}`,
              { txId: '' }
            );
          }
          return null;
        }
        const payloadPointerId = arweaveScripts.hexToBase64url(arweaveHash);
        const mockedResponse = readE2EMockedViewedResponse();
        if (mockedResponse) {
          normalizeSessionNameFields(mockedResponse);
          const mockedStorageRef = isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.RESPONSES)
            ? normalizeStorageRef({
              backend: STORAGE_BACKENDS.CLOUDFLARE,
              id: payloadPointerId,
              resource: STORAGE_RESOURCE_KEYS.RESPONSES,
            }, { fallbackBackend: STORAGE_BACKENDS.CLOUDFLARE, resource: STORAGE_RESOURCE_KEYS.RESPONSES })
            : null;
          return normalizeConvictionImportance(attachPayloadPointerFields(
            mockedResponse,
            payloadPointerId,
            STORAGE_RESOURCE_KEYS.RESPONSES,
            mockedStorageRef
          ));
        }
        if (!ARWEAVE_ACTIVE && !isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.RESPONSES)) {
          return null;
        }
        const storageRead = await readPayloadPointerTextForGroup({
          pointerId: payloadPointerId,
          resource: STORAGE_RESOURCE_KEYS.RESPONSES,
          groupKeyOrCfg,
          cfg,
          arweaveOpts: {
            debugContext: buildArweaveDebugContext(groupKeyOrCfg, responseCategory, {
              fn: 'getResponse',
              responder: responderLower,
              id: idB32,
            }),
            // Response reports should not be held hostage by the ar.io-only
            // troubleshooting path. The on-chain pointer is immutable, so the
            // regular gateway fanout is safe and prevents a single ar.io outage
            // from making live response rows disappear.
            directToArIo: false,
            gatewayTimeoutMs: Number.isFinite(Number(opts?.arweaveGatewayTimeoutMs))
              ? Number(opts.arweaveGatewayTimeoutMs)
              : 4500,
            forceRetry: forceArweaveFetch,
            cacheBypass: forceArweaveFetch,
            bypassFailureCache: forceArweaveFetch,
          },
        });
        const arweaveData = storageRead?.text;
        let responseJson = null;
        try {
          responseJson = JSON.parse(arweaveData as string);
        } catch (parseErr: any) {
          throw await recordTerminalArweaveInvalidFailure({
            groupKeyOrCfg,
            txId: payloadPointerId,
            message: `Invalid response JSON for pointer ${payloadPointerId}`,
            cause: parseErr,
          });
        }
        normalizeSessionNameFields(responseJson);
        return normalizeConvictionImportance(attachPayloadPointerFields(
          responseJson,
          payloadPointerId,
          STORAGE_RESOURCE_KEYS.RESPONSES,
          storageRead?.storageRef || null
        ));
      }
    );
    return cloneJsonSafe(result);
  } catch (error: any) {
    logArweaveMetadataFetchFailure({ scope: 'response', error });
    if (throwOnError) throw error;
    return null;
  }
  },

  async getQuestionHash(providerName: any, questionId: any, groupKeyOrCfg: any, opts: any = {}) {
  const cfg    = resolveSession(groupKeyOrCfg || '');
  const gAddrs = getSessionAddresses(cfg);
  const addr   = (gAddrs.surveys?.address);
  const chId   = (gAddrs.surveys?.chainId) || (cfg?.networkChainId) || undefined;
  const throwOnError = !!(opts && opts.throwOnError);

  if (!addr || !utils.isAddress(addr)) {
    if (throwOnError) throw new Error('Missing surveys address for question hash lookup.');
    return null;
  }

  const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
  if (!provider) {
    if (throwOnError) throw new Error(`Missing read provider for question hash lookup (chainId=${String(chId || '') || 'unknown'}).`);
    return null;
  }

  const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);


  // 🔐 Normalize
  const ensureHash = (v: any) => {
    try {
      if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
    } catch {}
    try { if (utils.isHexString(v, 32)) return String(v).toLowerCase(); } catch {}
    const s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
  };
  const qId = ensureHash(questionId);
  const { baseKey } = resolveReadContext(groupKeyOrCfg);
  const memoKey = buildHashReadMemoKey({ baseKey, id: qId });
  const inflightKey = buildHashReadInflightKey({ baseKey, id: qId, throwOnError });
  const memoValue = getTimedMemoValue(READ_MEMO.questionHash, memoKey, HASH_READ_TTL_MS);
  if (memoValue === HASH_MISS_SENTINEL) return null;
  if (memoValue !== null && memoValue !== undefined) return memoValue;

  try {
    const result = await runInFlightCoalesced(
      READ_INFLIGHT.questionHash,
      inflightKey,
      async () => {
        rpcLog('RPC Call:', { function: 'getQuestionHash', method: 'SurveyContract.getQuestionHash', params: { questionId: qId } });
        const arweaveHashBytes = await callWithRetry(() => SurveyContract.getQuestionHash(qId), 'SurveyContract.getQuestionHash');
        if (!arweaveHashBytes || arweaveHashBytes === ethers.constants.HashZero) {
          return null;
        }
        return arweaveScripts.hexToBase64url(arweaveHashBytes);
      }
    );
    setTimedMemoValue(
      READ_MEMO.questionHash,
      memoKey,
      result == null ? HASH_MISS_SENTINEL : result,
      HASH_READ_MAX_ENTRIES
    );
    return result;
  } catch (error: any) {
    if (isCallExceptionError(error)) {
      READ_MEMO.questionHash.delete(memoKey);
      const didLog = markHashRevertLoggedOnce(questionHashRevertLogged, memoKey);
      if (didLog) {
        contractsLog.warn('Question hash lookup reverted; not memoizing a long-lived miss.', {
          questionId: qId,
          code: error?.code ?? error?.error?.code ?? null,
          message: error?.message || error?.error?.message || '',
        });
      }
      // Treat revert as "hash unavailable" (not a transport failure), even in strict mode.
      // Strict callers will still surface terminal_not_found via getQuestionData/getSurveyDataById.
      return null;
    }
    if (throwOnError) throw error;
    contractsLog.error("Error getting question hash:", error);
    return null;
  }
},

    async getSurveyHash(providerName: any, surveyId: any, groupKeyOrCfg: any, opts: any = {}) {
  if (!surveyId || surveyId === ethers.constants.HashZero) {
    return null;
  }
  const cfg    = resolveSession(groupKeyOrCfg || '');
  const gAddrs = getSessionAddresses(cfg);
  const addr   = (gAddrs.surveys?.address);
  const chId   = (gAddrs.surveys?.chainId) || (cfg?.networkChainId) || undefined;
  const throwOnError = !!(opts && opts.throwOnError);

  if (!addr || !utils.isAddress(addr)) {
    if (throwOnError) throw new Error('Missing surveys address for survey hash lookup.');
    return null;
  }

  const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
  if (!provider) {
    if (throwOnError) throw new Error(`Missing read provider for survey hash lookup (chainId=${String(chId || '') || 'unknown'}).`);
    return null;
  }

  const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

  // 🔐 Normalize
  const ensureHash = (v: any) => {
    try {
      if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
    } catch {}
    try { if (utils.isHexString(v, 32)) return String(v).toLowerCase(); } catch {}
    const s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
  };
  const sId = ensureHash(surveyId);
  const { baseKey } = resolveReadContext(groupKeyOrCfg);
  const memoKey = buildHashReadMemoKey({ baseKey, id: sId });
  const inflightKey = buildHashReadInflightKey({ baseKey, id: sId, throwOnError });
  const memoValue = getTimedMemoValue(READ_MEMO.surveyHash, memoKey, HASH_READ_TTL_MS);
  if (memoValue === HASH_MISS_SENTINEL) return null;
  if (memoValue !== null && memoValue !== undefined) return memoValue;

  try {
    const result = await runInFlightCoalesced(
      READ_INFLIGHT.surveyHash,
      inflightKey,
      async () => {
        rpcLog('RPC Call:', { function: 'getSurveyHash', method: 'SurveyContract.getSurveyHash', params: { surveyId: sId } });
        const arweaveHashBytes = await callWithRetry(() => SurveyContract.getSurveyHash(sId), 'SurveyContract.getSurveyHash');
        if (!arweaveHashBytes || arweaveHashBytes === ethers.constants.HashZero) {
            return null;
        }
        return arweaveScripts.hexToBase64url(arweaveHashBytes);
      }
    );
    setTimedMemoValue(
      READ_MEMO.surveyHash,
      memoKey,
      result == null ? HASH_MISS_SENTINEL : result,
      HASH_READ_MAX_ENTRIES
    );
    return result;
  } catch (error: any) {
    if (isCallExceptionError(error)) {
      READ_MEMO.surveyHash.delete(memoKey);
      const didLog = markHashRevertLoggedOnce(surveyHashRevertLogged, memoKey);
      if (didLog) {
        contractsLog.warn('Survey hash lookup reverted; not memoizing a long-lived miss.', {
          surveyId: sId,
          code: error?.code ?? error?.error?.code ?? null,
          message: error?.message || error?.error?.message || '',
        });
      }
      // Treat revert as "hash unavailable" (not a transport failure), even in strict mode.
      // Strict callers will still surface terminal_not_found via getQuestionData/getSurveyDataById.
      return null;
    }
    if (throwOnError) throw error;
    contractsLog.error("Error getting survey hash:", error);
    return null;
  }
},

    getQuestionSurvey: async function(providerName: any, questionId: any, groupKeyOrCfg: any = null) {
  const cfg    = resolveSession(groupKeyOrCfg || '');
  const gAddrs = getSessionAddresses(cfg);
  const addr   = (gAddrs.surveys?.address);
  const chId   = (gAddrs.surveys?.chainId) || (cfg?.networkChainId) || undefined;

  if (!addr || !utils.isAddress(addr)) {
    return null;
  }

  const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
  if (!provider) {
    return null;
  }
  const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

  // 🔐 Normalize
  const ensureHash = (v: any) => {
    try {
      if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
    } catch {}
    try { if (utils.isHexString(v, 32)) return String(v).toLowerCase(); } catch {}
    const s = (v === null || v === undefined) ? '' : String(v);
    return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
  };
  const qId = ensureHash(questionId);

  try {
    rpcLog('RPC Call:', { function: 'getQuestionSurvey', method: 'SurveyContract.getQuestionSurvey', params: { questionId: qId } });
    const surveyIdResult = await callWithRetry(() => SurveyContract.getQuestionSurvey(qId), 'SurveyContract.getQuestionSurvey');
    return surveyIdResult;
  } catch (error: any) {
    contractsLog.error("Error getting question's associated survey:", error);
    return null;
  }
},

    // === CHANGED: +groupKeyOrCfg (optional). Threads group to getQuestionHash.
  async getQuestionData(providerName: any, questionId: any, groupKeyOrCfg: any, opts: any = {}) {
    const qId = String(questionId || '').toLowerCase();
    const { baseKey } = resolveReadContext(groupKeyOrCfg);
    const modeTag = buildDecryptModeTag(opts);
    const failureModeTag = buildFailureModeTag(opts);
    const arweaveReadModeTag = buildArweaveReadModeTag(opts);
    const forceArweaveFetch = !!(opts && opts.forceArweaveFetch === true);
    const inflightKey = `${baseKey}|${qId}|${modeTag}|${failureModeTag}|${arweaveReadModeTag}|force:${forceArweaveFetch ? '1' : '0'}`;
    try {
      const result = await runInFlightCoalesced(
        READ_INFLIGHT.questionData,
        inflightKey,
        async () => {
          const payloadPointerId = await this.getQuestionHash(providerName, qId, groupKeyOrCfg, {
            throwOnError: !!(opts && opts.throwOnFailure),
          });
          if (!payloadPointerId) {
            if (opts && opts.throwOnFailure && (ARWEAVE_ACTIVE || isCloudflareStorageResource(resolveSession(groupKeyOrCfg || ''), STORAGE_RESOURCE_KEYS.QUESTIONS))) {
              throw buildHashUnavailableMetadataError(
                `Question hash unavailable for question ${qId}`,
                { txId: '' }
              );
            }
            return null;
          }
          const cfg = resolveSession(groupKeyOrCfg || '');
          if (!ARWEAVE_ACTIVE && !isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.QUESTIONS)) {
            return null;
          }
          const storageRead = await readPayloadPointerTextForGroup({
            pointerId: payloadPointerId,
            resource: STORAGE_RESOURCE_KEYS.QUESTIONS,
            groupKeyOrCfg,
            cfg,
            arweaveOpts: {
              disableExistencePrecheck: true,
              preflightTxExistence: false,
              forceRetry: forceArweaveFetch,
              cacheBypass: forceArweaveFetch,
              bypassFailureCache: forceArweaveFetch,
              ...(Number.isFinite(Number(opts?.arweaveRetries))
                ? { retries: Math.max(0, Number(opts.arweaveRetries)) }
                : {}),
              ...(Number.isFinite(Number(opts?.arweaveGatewayTimeoutMs))
                ? { gatewayTimeoutMs: Math.max(300, Number(opts.arweaveGatewayTimeoutMs)) }
                : {}),
              debugContext: buildArweaveDebugContext(groupKeyOrCfg, 'question_metadata', {
                fn: 'getQuestionData',
                questionId: qId,
              }),
            },
          });
          const questionDataString = storageRead?.text;
          if (!questionDataString) {
            contractsLog.error(`No data found for question payload pointer: ${payloadPointerId}`);
            return null;
          }
          let questionData = null;
          try {
            questionData = JSON.parse(questionDataString);
          } catch (parseErr: any) {
            throw await recordTerminalArweaveInvalidFailure({
              groupKeyOrCfg,
              txId: payloadPointerId,
              message: `Invalid question metadata JSON for pointer ${payloadPointerId}`,
              cause: parseErr,
            });
          }
          normalizeSessionNameFields(questionData);
          normalizeQuestionFlags(questionData);
          const skipDecrypt = !!(opts && (opts.skipDecrypt || opts.decrypt === false));
          if (!skipDecrypt) {
            await contractMetadataResolutionHelpers.maybeDecryptQuestionPayload(questionData, groupKeyOrCfg, opts);
          }
          return attachPayloadPointerFields(
            questionData,
            payloadPointerId,
            STORAGE_RESOURCE_KEYS.QUESTIONS,
            storageRead?.storageRef || null
          );
        }
      );
      return cloneJsonSafe(result);
  } catch (error: any) {
    logArweaveMetadataFetchFailure({ scope: 'question', error });
    if (opts && opts.throwOnFailure) throw error;
    return null;
  }
},

  // Decrypt masked question metadata without re-downloading the payload from Arweave.
  // This is useful for "gate just changed" refreshes where we already have the encrypted
  // prompt/options/tags envelopes cached locally.
  async decryptQuestionPayloadInPlace(questionData: any, groupKeyOrCfg: any = null, opts: any = {}) {
    return contractMetadataResolutionHelpers.maybeDecryptQuestionPayload(questionData, groupKeyOrCfg, opts);
  },

  // Decrypt masked survey metadata without re-downloading the payload from Arweave.
  async decryptSurveyPayloadInPlace(surveyData: any, groupKeyOrCfg: any = null, opts: any = {}) {
    return contractMetadataResolutionHelpers.maybeDecryptSurveyPayload(surveyData, groupKeyOrCfg, opts);
  },


  getSurveyData: async function(providerName: any, surveyId: any, groupKeyOrCfg: any = null, opts: any = {}) {
    const sId = String(surveyId || '').toLowerCase();
    const { baseKey } = resolveReadContext(groupKeyOrCfg);
    const modeTag = buildDecryptModeTag(opts);
    const failureModeTag = buildFailureModeTag(opts);
    const forceArweaveFetch = !!(opts && opts.forceArweaveFetch === true);
    const inflightKey = `${baseKey}|${sId}|${modeTag}|${failureModeTag}|force:${forceArweaveFetch ? '1' : '0'}`;
    try {
      const result = await runInFlightCoalesced(
        READ_INFLIGHT.surveyData,
        inflightKey,
        async () => {
          const payloadPointerId = await this.getSurveyHash(providerName, sId, groupKeyOrCfg, {
            throwOnError: !!(opts && opts.throwOnFailure),
          });
          if (!payloadPointerId) {
            if (opts && opts.throwOnFailure) {
              throw buildHashUnavailableMetadataError(
                `Survey hash unavailable for survey ${sId}`,
                { txId: '' }
              );
            }
            return null;
          }
          const cfg = resolveSession(groupKeyOrCfg || '');
          if (!ARWEAVE_ACTIVE && !isCloudflareStorageResource(cfg, STORAGE_RESOURCE_KEYS.SURVEYS)) {
            return null;
          }
          const storageRead = await readPayloadPointerTextForGroup({
            pointerId: payloadPointerId,
            resource: STORAGE_RESOURCE_KEYS.SURVEYS,
            groupKeyOrCfg,
            cfg,
            arweaveOpts: {
              disableExistencePrecheck: true,
              preflightTxExistence: false,
              forceRetry: forceArweaveFetch,
              cacheBypass: forceArweaveFetch,
              bypassFailureCache: forceArweaveFetch,
              debugContext: buildArweaveDebugContext(groupKeyOrCfg, 'survey_metadata', {
                fn: 'getSurveyData',
                surveyId: sId,
              }),
            },
          });
          const surveyData = storageRead?.text;
          let parsed = null;
          try {
            parsed = JSON.parse(surveyData as string);
          } catch (parseErr: any) {
            throw await recordTerminalArweaveInvalidFailure({
              groupKeyOrCfg,
              txId: payloadPointerId,
              message: `Invalid survey JSON for pointer ${payloadPointerId}`,
              cause: parseErr,
            });
          }
          normalizeSessionNameFields(parsed);
          const skipDecrypt = !!(opts && (opts.skipDecrypt || opts.decrypt === false));
          if (!skipDecrypt) {
            await contractMetadataResolutionHelpers.maybeDecryptSurveyPayload(parsed, groupKeyOrCfg, opts);
          }
          return attachPayloadPointerFields(
            parsed,
            payloadPointerId,
            STORAGE_RESOURCE_KEYS.SURVEYS,
            storageRead?.storageRef || null
          );
        }
      );
      return cloneJsonSafe(result);
  } catch (error: any) {
      logArweaveMetadataFetchFailure({ scope: 'survey', error });
      if (opts && opts.throwOnFailure) throw error;
      return null;
    }
  },


  createSBT: async function(
  providerName: any,
  name: any,
  symbol: any,
  limitedNumber: any,
  adminAddress: any,
  mintingEndTime: any,
  hasPasswordMint: any,
  burnAuth: any,
  hashedPasswords: any,
  tokenURI: any,
  groupPasswordHash: any = ethers.constants.HashZero, // <-- ADDED (default = 0)
  groupKeyOrCfg: any = null,
  create2Salt: any = '',
  createOptions: any = {}
) {
  if (providerName === 'none') {
    throw new Error('createSBT: read-only provider is not allowed here. Connect a wallet first.');
  }
  const providerLocation = contractScripts.getProviderLocation(providerName);
  const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
  const signer = ethersProvider.getSigner();

  // === Address resolution (group-aware; no constant fallback)
  const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
  const slugOrEmpty = (cfg && typeof cfg.slug !== 'undefined') ? cfg.slug : '';
  const gAddrs = getSessionAddresses(cfg);
  const addr   = gAddrs.sbtFactory?.address;
  if (!addr) {
    contractsLog.log("No SBT factory address in group config:", slugOrEmpty);
    return; // early return, no tx
  }
  const SBTFactory = new ethers.Contract(addr, SBT_FACTORY_ABI, signer as any);

  const create2SaltNormalized = normalizeCreate2Salt(create2Salt);
  const useCreate2 = !!create2SaltNormalized;
  const useConfiguredDeterministic = !!(useCreate2 && createOptions?.useConfiguredDeterministic);
  const initializeGroupPasswordHash = !!createOptions?.initializeGroupPasswordHash;
  if (
    useConfiguredDeterministic &&
    !initializeGroupPasswordHash &&
    hasNonZeroHashValue(groupPasswordHash)
  ) {
    throw new Error(
      'Configured deterministic SBT deployment cannot preinitialize a group password hash.'
    );
  }

  rpcLog('RPC Call (Tx):', {
    function: 'createSBT',
    method: useConfiguredDeterministic
      ? 'SBTFactory.createSBTDeterministicConfigured'
      : (useCreate2 ? 'SBTFactory.createSBTDeterministic' : 'SBTFactory.createSBT'),
    params: {
      ...(useCreate2 ? { create2Salt: create2SaltNormalized } : {}),
      name,
      symbol,
      limitedNumber,
      adminAddress,
      mintingEndTime,
      hasPasswordMint,
      burnAuth,
      hashedPasswordsCount: hashedPasswords.length,
      tokenURI,
      groupPasswordHash,
      ...(useConfiguredDeterministic ? { initializeGroupPasswordHash } : {}),
    }
  });
  const numPasswords = Array.isArray(hashedPasswords) ? hashedPasswords.length : 0;
  const fallbackGasValue = useConfiguredDeterministic
    ? GAS_FALLBACKS.createSBTDeterministicConfigured(numPasswords)
    : useCreate2
      ? GAS_FALLBACKS.createSBTDeterministic(numPasswords)
      : GAS_FALLBACKS.createSBT(numPasswords);
  const createArgs = useConfiguredDeterministic
    ? [
        create2SaltNormalized,
        name,
        symbol,
        limitedNumber,
        adminAddress,
        mintingEndTime,
        hasPasswordMint,
        burnAuth,
        hashedPasswords,
        tokenURI,
        groupPasswordHash,
        initializeGroupPasswordHash,
      ]
    : useCreate2
    ? [
        create2SaltNormalized,
        name,
        symbol,
        limitedNumber,
        adminAddress,
        mintingEndTime,
        hasPasswordMint,
        burnAuth,
        hashedPasswords,
        tokenURI,
        groupPasswordHash,
      ]
    : [
        name,
        symbol,
        limitedNumber,
        adminAddress,
        mintingEndTime,
        hasPasswordMint,
        burnAuth,
        hashedPasswords,
        tokenURI,
        groupPasswordHash,
      ];
  let txOverrides;
  try {
    txOverrides = await resolveTxGasOverrides({
      contract: SBTFactory,
      method: useConfiguredDeterministic
        ? 'createSBTDeterministicConfigured'
        : (useCreate2 ? 'createSBTDeterministic' : 'createSBT'),
      args: createArgs,
      fallbackGasLimit: String(fallbackGasValue),
      minEstimate: '3500000',
      logLabel: 'CREATE_SBT',
      preferFallbackGasLimit: true,
    });
  } catch (error: any) {
    throw useConfiguredDeterministic
      ? maybeWrapUnsupportedConfiguredDeterministicFactoryError(error, addr)
      : error;
  }
  contractsLog.log('[CREATE_SBT] tx gasLimit:', txOverrides?.gasLimit?.toString?.() || String(txOverrides?.gasLimit || ''));

  try {
    const createMethod = useConfiguredDeterministic
      ? 'createSBTDeterministicConfigured'
      : (useCreate2 ? 'createSBTDeterministic' : 'createSBT');
    const { receipt } = await sendContractWriteViaProvider({
      signingProvider: providerLocation,
      ethersProvider,
      signer,
      contract: SBTFactory,
      method: createMethod,
      args: createArgs,
      txOverrides,
      rpcFunction: 'createSBT',
      revertMessage: 'createSBT transaction reverted on-chain.',
    });
    return receipt;
  } catch (error: any) {
    const normalizedError = useConfiguredDeterministic
      ? maybeWrapUnsupportedConfiguredDeterministicFactoryError(error, addr)
      : error;
    if (normalizedError !== error) {
      notify.error(normalizedError.message);
    } else {
      notifyUserFacingTransactionError(error);
    }
    throw normalizedError;
  }
},

  countSBTCreated: async function(providerName: any, groupKeyOrCfg: any = null) {
    try {
      // Read-only: use group-aware read provider; no signer.
      const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const slugOrEmpty = (cfg && typeof cfg.slug !== 'undefined') ? cfg.slug : '';
      const gAddrs = getSessionAddresses(cfg);
      const addr   = gAddrs.sbtFactory?.address;

      if (!addr) {
        contractsLog.log("No SBT factory address in group config:", slugOrEmpty);
        return 0; // neutral
      }

      const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const SBTFactory = new ethers.Contract(addr, SBT_FACTORY_ABI, provider as any);
      const sbtCount = await SBTFactory.sbtCount();
      return (ethers.BigNumber.isBigNumber(sbtCount) ? sbtCount.toNumber() : Number(sbtCount || 0)) || 0;
    } catch (error: any) {
      contractsLog.error('Error in countSBTCreated function:', error);
      throw error;
    }
  },

  async getSbtsCreated(providerName: any, fromCustomBlock: any = 0, toCustomBlock: any = 'latest', groupKeyOrCfg: any, options: any = null) {
  const cfg    = resolveSession(groupKeyOrCfg || '');
  const slugOrEmpty = (cfg && typeof cfg.slug !== 'undefined') ? cfg.slug : '';
  const gAddrs = getSessionAddresses(cfg);
  const addr   = gAddrs.sbtFactory?.address;
  const onProgress = options && typeof options.onProgress === 'function'
    ? options.onProgress
    : null;

  if (!addr) {
    contractsLog.log("No SBT factory address in group config:", slugOrEmpty);
    return []; // neutral
  }

  const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
  const SBTFactory = new ethers.Contract(addr, SBT_FACTORY_ABI, provider as any);
  const sbtCreatedEventFilter = SBTFactory.filters.SBTCreated();

  // Per-group base window + clamp caller overrides
  const { fromBlock: baseFrom, toBlock: baseTo } =
    await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, {
      ...SBT_READ_PROVIDER_OPTIONS,
      _resolvedCfg: cfg,
    });

  const fromBlock = Number.isFinite(Number(fromCustomBlock))
    ? Math.max(Number(fromCustomBlock), baseFrom)
    : baseFrom;

  const toBlock = (toCustomBlock === 'latest' || typeof toCustomBlock !== 'number')
    ? baseTo
    : Math.min(Number(toCustomBlock), baseTo);

  if (fromBlock > toBlock) return [];

  rpcLog('getSbtsCreated: Fetching logs:', {
    address: SBTFactory.address, fromBlock, toBlock
  });

  const totalBlocks = Math.max(0, Number(toBlock) - Number(fromBlock) + 1);
  const rawLogs = await fetchLogsSmartWithProvider(
    provider,
    sbtCreatedEventFilter,
    fromBlock,
    toBlock,
    0,
    20,
    onProgress ? {
      phase: 'discover',
      fromBlock: Number(fromBlock),
      toBlock: Number(toBlock),
      totalBlocks,
      scannedBlocks: 0,
      onProgress,
    } : null
  );
  const sbtCreatedEvents = rawLogs
    .map((log: any) => {
      let parsed = null;
      try {
        parsed = SBT_FACTORY_INTERFACE.parseLog(log);
      } catch {
        return null;
      }
      const sbtAddress = (parsed?.args?.sbtAddress) || parsed?.args?.[0] || parsed?.args?.['0'];
      if (!sbtAddress) return null;
      return { sbtAddress, blockNumber: log?.blockNumber };
    })
    .filter(Boolean);

  const creationByAddress = new Map();
  for (const ev of sbtCreatedEvents as any[]) {
    const key = String(ev.sbtAddress || '').toLowerCase();
    if (!key) continue;
    const bn = Number(ev.blockNumber);
    const normalized = Number.isFinite(bn) ? bn : null;
    const prev = creationByAddress.get(key);
    if (!prev || (normalized != null && (prev.creationBlock == null || normalized < prev.creationBlock))) {
      creationByAddress.set(key, { sbtAddress: ev.sbtAddress, creationBlock: normalized });
    }
  }

  const discovered = Array.from(creationByAddress.values());

  const results = await Promise.all(discovered.map(async ({ sbtAddress, creationBlock }: any) => {
    let meta = null;
    try {
      // IMPORTANT: pass through the SAME groupKeyOrCfg, not a transformed cfg
      meta = await this.getSbtMetadata(providerName, sbtAddress, groupKeyOrCfg);
    } catch {}
    return {
      sbtAddress,
      tokenURI: meta?.tokenURI || null,
      tokenURIInfo: meta || null,
      creationBlock: (creationBlock != null && Number.isFinite(Number(creationBlock)))
        ? Math.floor(Number(creationBlock))
        : null
    };
  }));

  return results;
},

  // Fetch a single SBT's creation block by scanning factory logs.
  // Attempts the full range first; falls back to split queries if the provider rejects wide ranges.
  async getSbtCreationBlockByAddress(providerName: any, sbtAddress: any, groupKeyOrCfg: any = null, options: any = {}) {
    try {
      if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) return null;

      const metaSessionSlug =
        options?.sessionSlug ??
        options?.metadata?.sessionSlug ??
        options?.meta?.sessionSlug ??
        null;
      const metaSessionName =
        options?.sessionName ||
        options?.metadata?.sessionName ||
        options?.meta?.sessionName;
      const metaCfg = (
        metaSessionSlug != null
          ? resolveSession(normalizeSessionSlug(metaSessionSlug))
          : resolveSessionByName(metaSessionName)
      );
      const baseCfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);

      let cfg = metaCfg || baseCfg;
      let gAddrs = getSessionAddresses(cfg);
      if (!gAddrs.sbtFactory?.address && metaCfg && baseCfg) {
        cfg = baseCfg;
        gAddrs = getSessionAddresses(cfg);
      }

      const addr = gAddrs.sbtFactory?.address;
      if (!addr) return null;

      const provider = getLocalAwareReadProviderForGroup(cfg || groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const SBTFactory = new ethers.Contract(addr, SBT_FACTORY_ABI, provider as any);
      const sbtCreatedEventFilter = SBTFactory.filters.SBTCreated(sbtAddress);

      const { fromBlock: baseFrom, toBlock: baseTo } =
        await this.getRelevantBlockWindowForFilter(cfg || groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);

      const logs = await fetchLogsSmartWithProvider(
        provider,
        sbtCreatedEventFilter,
        Number(baseFrom),
        Number(baseTo)
      );
      if (!Array.isArray(logs) || logs.length === 0) return null;

      let best = null;
      for (const lg of logs) {
        const bn = Number(lg?.blockNumber);
        if (Number.isFinite(bn) && (best == null || bn < best)) best = bn;
      }
      return best;
    } catch (e: any) {
      contractsLog.warn('[getSbtCreationBlockByAddress] failed:', e?.message || e);
      return null;
    }
  },


  getSbtMintBurnCountsByAddress: async function(providerName: any, sbtAddress: any, fromBlock: any = 0, toBlock: any = 'latest', groupKeyOrCfg: any = null, options: any = null) {
    try {
      let groupCfg = groupKeyOrCfg;
      let opts = options;
      if (groupCfg && typeof groupCfg === 'object' && opts == null && typeof groupCfg.onProgress === 'function') {
        opts = groupCfg;
        groupCfg = null;
      }
      if (!opts || typeof opts !== 'object') opts = {};
      const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
      const onCheckpoint = typeof opts.onCheckpoint === 'function' ? opts.onCheckpoint : null;

      if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) {
        contractsLog.warn('[getSbtMintBurnCountsByAddress] invalid SBT address:', sbtAddress);
        return {
          mintedCountByAddress: {},
          burnedCountByAddress: {},
          mintedEventCount: 0,
          burnedEventCount: 0,
          scannedToBlock: null,
          ok: false
        };
      }

      const provider = getLocalAwareReadProviderForGroup(groupCfg, SBT_READ_PROVIDER_OPTIONS);

      // Clamp to group's relevant window
      const { fromBlock: baseFrom, toBlock: baseTo } = await this.getRelevantBlockWindowForFilter(
        groupCfg,
        SBT_READ_PROVIDER_OPTIONS
      );
      const f = Number.isFinite(Number(fromBlock)) ? Math.max(Number(fromBlock), baseFrom) : baseFrom;
      const t = (toBlock === 'latest' || typeof toBlock !== 'number') ? baseTo : Math.min(Number(toBlock), baseTo);
      if (f > t) {
        return {
          mintedCountByAddress: {},
          burnedCountByAddress: {},
          mintedEventCount: 0,
          burnedEventCount: 0,
          scannedToBlock: Number.isFinite(Number(t)) ? Number(t) : null,
          ok: false
        };
      }

      const sbt = new ethers.Contract(sbtAddress, CUSTOM_SBT_ABI, provider as any);
      const totalBlocks = Math.max(0, Number(t) - Number(f) + 1);
      const normalizeCountMap = (value: any) => {
        const out = Object.create(null);
        Object.entries(value || {}).forEach(([addrRaw, countRaw]: any) => {
          const addr = String(addrRaw || '').toLowerCase();
          if (!addr) return;
          const count = Math.max(0, Math.floor(Number(countRaw || 0)));
          if (count <= 0) return;
          out[addr] = count;
        });
        return out;
      };
      const sumCountMap = (value: any) => Object.values(value || {}).reduce((sum: any, count: any) => {
        const n = Math.max(0, Math.floor(Number(count || 0)));
        return sum + n;
      }, 0);
      const phaseOrder: any = { activity: 0 };
      const normalizeResumeState = (resumeIn: any) => {
        if (!resumeIn || typeof resumeIn !== 'object') return null;
        const phase = String(resumeIn.phase || '').trim();
        if (!Object.prototype.hasOwnProperty.call(phaseOrder, phase)) return null;
        const blockNumber = Math.max(
          f - 1,
          Math.min(t, Math.floor(Number(resumeIn.blockNumber ?? (f - 1))))
        );
        const mintedCountByAddress = normalizeCountMap(resumeIn.mintedCountByAddress);
        const burnedCountByAddress = normalizeCountMap(resumeIn.burnedCountByAddress);
        const mintedEventCountRaw = Math.floor(Number(resumeIn.mintedEventCount || 0));
        const burnedEventCountRaw = Math.floor(Number(resumeIn.burnedEventCount || 0));
        return {
          phase,
          blockNumber,
          mintedCountByAddress,
          burnedCountByAddress,
          mintedEventCount: mintedEventCountRaw > 0 ? mintedEventCountRaw : (sumCountMap(mintedCountByAddress) as number),
          burnedEventCount: burnedEventCountRaw > 0 ? burnedEventCountRaw : (sumCountMap(burnedCountByAddress) as number),
        };
      };
      const resumeState = normalizeResumeState(opts.resumeState);

      const mintedCountByAddress = normalizeCountMap(resumeState?.mintedCountByAddress);
      const burnedCountByAddress = normalizeCountMap(resumeState?.burnedCountByAddress);
      let mintedEventCount: number = Number(resumeState?.mintedEventCount || 0) || (sumCountMap(mintedCountByAddress) as number);
      let burnedEventCount: number = Number(resumeState?.burnedEventCount || 0) || (sumCountMap(burnedCountByAddress) as number);
      const addCount = (bucket: any, addressRaw: any) => {
        const address = String(addressRaw || '').toLowerCase();
        if (!address) return false;
        bucket[address] = (bucket[address] || 0) + 1;
        return true;
      };
      const addMintedToken = (accountRaw: any) => {
        if (addCount(mintedCountByAddress, accountRaw)) {
          mintedEventCount += 1;
        }
      };
      const addBurnedToken = (accountRaw: any) => {
        if (addCount(burnedCountByAddress, accountRaw)) {
          burnedEventCount += 1;
        }
      };
      const emitCheckpoint = (phase: any, blockNumber: any) => {
        if (!onCheckpoint) return;
        try {
          onCheckpoint({
            phase,
            blockNumber: Math.max(f - 1, Math.min(t, Math.floor(Number(blockNumber || (f - 1))))),
            scanStartBlock: f,
            scanToBlock: t,
            mintedCountByAddress: { ...mintedCountByAddress },
            burnedCountByAddress: { ...burnedCountByAddress },
            mintedEventCount,
            burnedEventCount,
          });
        } catch (err: any) {
          contractsLog.warn('[getSbtMintBurnCountsByAddress] checkpoint callback failed:', err?.message || err);
        }
      };
      const getPassResumeState = (passName: any = 'activity') => {
        const passIndex = phaseOrder[passName];
        const resumePhase = resumeState?.phase || '';
        const resumeIndex = Object.prototype.hasOwnProperty.call(phaseOrder, resumePhase)
          ? phaseOrder[resumePhase]
          : null;
        if (resumeIndex == null || resumeIndex < passIndex) {
          return { skip: false, passFrom: f, initialScannedBlocks: 0 };
        }
        if (resumeIndex > passIndex) {
          return { skip: true, passFrom: t + 1, initialScannedBlocks: totalBlocks };
        }
        const checkpointBlock = Math.max(
          f - 1,
          Math.min(t, Math.floor(Number(resumeState?.blockNumber ?? (f - 1))))
        );
        return {
          skip: false,
          passFrom: Math.min(t + 1, checkpointBlock + 1),
          initialScannedBlocks: Math.max(0, checkpointBlock - f + 1),
        };
      };

      const activityResume = getPassResumeState('activity');
      if (!activityResume.skip && activityResume.passFrom <= t) {
        const activityFilter = sbt.filters.SBTActivity();
        await fetchLogsSmartWithProvider(
          provider,
          activityFilter,
          activityResume.passFrom,
          t,
          0,
          20,
          createSbtEventScanProgressState({
            onProgress,
            onLogs: ({ logs = [], scanTo }: any) => {
              logs.forEach((lg: any) => {
                let parsed;
                try { parsed = CUSTOM_SBT_INTERFACE.parseLog(lg); } catch { return; }
                const account = parsed?.args?.account ?? parsed?.args?.[0];
                const burned = parsed?.args?.burned ?? parsed?.args?.[2];
                if (burned === true) {
                  addBurnedToken(account);
                } else {
                  addMintedToken(account);
                }
              });
              emitCheckpoint('activity', scanTo);
            },
            phase: 'activity',
            fromBlock: f,
            toBlock: t,
            scanTotalBlocks: totalBlocks,
            phaseTotalBlocks: totalBlocks,
            passOffsetBlocks: 0,
            initialScannedBlocks: activityResume.initialScannedBlocks,
            maxConcurrency: onCheckpoint ? 1 : null,
          })
        );
      }

      return {
        mintedCountByAddress,
        burnedCountByAddress,
        mintedEventCount,
        burnedEventCount,
        scannedToBlock: Number.isFinite(Number(t)) ? Number(t) : null,
        ok: true
      };
    } catch (e: any) {
      contractsLog.error('[getSbtMintBurnCountsByAddress] failed:', e);
      return {
        mintedCountByAddress: {},
        burnedCountByAddress: {},
        mintedEventCount: 0,
        burnedEventCount: 0,
        scannedToBlock: null,
        ok: false
      };
    }
  },

  getSBTsByUserAddress: async function(providerName: any, userAddress: any, fromBlock: any = null, groupKeyOrCfg: any = null) {
    // Per-group base window + clamp caller override (fromBlock only)
    const { fromBlock: baseFrom } = await this.getRelevantBlockWindowForFilter(
      groupKeyOrCfg,
      SBT_READ_PROVIDER_OPTIONS
    );
    const fromBlockNum = Number.isFinite(Number(fromBlock))
      ? Math.max(Number(fromBlock), baseFrom)
      : baseFrom;

    const sbts = await this.getSbtsCreated('none', fromBlockNum, 'latest', groupKeyOrCfg);
    try {
      const holdings = await this.getUserSbtNetHoldings(
        'none',
        userAddress,
        { fromBlock: fromBlockNum },
        groupKeyOrCfg
      );
      const heldSet = new Set(
        (Array.isArray(holdings?.addresses) ? holdings.addresses : [])
          .map((address: any) => normalizeAddress(address))
          .filter(Boolean)
      );
      if (heldSet.size > 0) {
        return sbts.filter((sbt: any) => heldSet.has(normalizeAddress(sbt?.sbtAddress || '')));
      }
      return [];
    } catch (error: any) {
      contractsLog.warn('[getSBTsByUserAddress] holdings lookup failed; falling back to per-SBT checks:', error?.message || error);
    }

    let claimedSBTs: any[] = [];
    for (let sbt of sbts) {
      const userHasClaimed = await this.userHasSBT('none', sbt.sbtAddress, userAddress, fromBlockNum, 'latest', groupKeyOrCfg);
      if (userHasClaimed) {
        const addressesWhoMinted = await this.getAddressesWhoMintedSBT('none', sbt.sbtAddress, fromBlockNum, 'latest', groupKeyOrCfg);
        const addressesWhoBurned = await this.getAddressesWhoBurnedSBT('none', sbt.sbtAddress, fromBlockNum, 'latest', groupKeyOrCfg);
        if (addressesWhoMinted.map((a: any) =>a.toLowerCase()).includes(userAddress.toLowerCase()) && !addressesWhoBurned.map((a: any) =>a.toLowerCase()).includes(userAddress.toLowerCase())) {
          claimedSBTs.push(sbt);
        }
      }
    }
    return claimedSBTs;
  },


  async getSbtMetadata(providerName: any, sbtAddress: any, groupKeyOrCfg: any = null) {
    try {
      if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) {
        contractsLog.warn('[getSbtMetadata] invalid SBT address:', sbtAddress);
        return null;
      }

      // Read-only provider resolved from group
      const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const chId = extractChainId(cfg, SBT_READ_PROVIDER_OPTIONS);

      // Helpers (local scope)
      const normalizeUri = (u: any, options: any = {}) => {
        if (!u) return null;
        const s = String(u).trim();
        if (!s) return null;
        const arweaveNormalized = normalizeArweaveUrl(s, options);
        if (arweaveNormalized !== s) return arweaveNormalized;
        if (/^ipfs:\/\//i.test(s)) return `https://ipfs.io/ipfs/${s.replace(/^ipfs:\/\//i, '')}`;
        return s;
      };
      const toSeconds = (v: any) => {
        if (v == null) return undefined;
        const n = Number(v);
        if (!Number.isFinite(n)) return undefined;
        if (n <= 0) return 0;
        return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
      };
      const toBlockNumber = (v: any) => {
        if (v == null) return undefined;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) return undefined;
        return Math.floor(n);
      };
      const mapBurnAuth = (raw: any) => {
        const MAP: any = { AdminOnly: 0, OwnerOnly: 1, Both: 2, Neither: 3 };
        if (typeof raw === 'number') return raw;
        if (typeof raw === 'string' && Object.prototype.hasOwnProperty.call(MAP, raw)) return MAP[raw];
        return raw;
      };
      const inferDirectImageUrl = (uriIn: any) => {
        const normalized = normalizeUri(uriIn);
        if (!normalized) return null;
        if (/^data:image\//i.test(normalized)) return normalized;
        try {
          const parsed = new URL(normalized);
          if (/\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i.test(parsed.pathname || '')) {
            return normalized;
          }
        } catch {
          // ignore
        }
        return null;
      };

      const extractSbtMetadataTokenURI = (metadata: any) => {
        if (!metadata) return null;
        const indexedTokenUri = Array.isArray(metadata) ? metadata[8] : null;
        const namedTokenUri = typeof metadata === 'object'
          ? (metadata.tokenURI_ || metadata.tokenURI || null)
          : null;
        return namedTokenUri || indexedTokenUri || null;
      };

      const sbt = new ethers.Contract(sbtAddress, CUSTOM_SBT_ABI, provider as any);
      const readCollectionTokenURI = async () => {
        try {
          const metadata = await callWithRetry(() => sbt.getSBTMetadata(), 'SBT.getSBTMetadata');
          const metadataTokenURI = extractSbtMetadataTokenURI(metadata);
          if (metadataTokenURI) return metadataTokenURI;
        } catch {
          // Legacy SBTs may not expose the aggregate metadata getter.
        }

        try { return await callWithRetry(() => sbt.tokenURI(), 'SBT.tokenURI()'); }
        catch {
          try { return await callWithRetry(() => sbt.tokenURI(0), 'SBT.tokenURI(0)'); }
          catch { return null; }
        }
      };

      // OPTIMIZATION: Removed redundant provider.getNetwork() call.
      // We already know 'chId' from the config used to create the provider.
      const [name, symbol, admin, tokenURI_raw] = await Promise.all([
        callWithRetry(() => sbt.name(),   'SBT.name').catch(() => null),
        callWithRetry(() => sbt.symbol(), 'SBT.symbol').catch(() => null),
        (async () => {
          try { return await callWithRetry(() => sbt.admin(), 'SBT.admin'); }
          catch {
            try { return await callWithRetry(() => sbt.owner(), 'SBT.owner'); }
            catch { return ethers.constants.AddressZero; }
          }
        })(),
        readCollectionTokenURI()
      ]);

      const tokenURI = normalizeUri(tokenURI_raw);

      const out: any = {
        contractName: name || null,
        name: name || null,
        symbol: symbol || null,
        admin: admin || ethers.constants.AddressZero,
        tokenURI: tokenURI || null,
        chainID: chId // Use the config-derived chain ID
      };
      const directImageFromTokenUri = inferDirectImageUrl(tokenURI);
      if (directImageFromTokenUri) out.image = directImageFromTokenUri;

      // Merge tokenURI JSON (fail-soft)
      if (tokenURI) {
        try {
          const tokenUriLogMeta: any = {
            sbtAddress: String(sbtAddress || '').toLowerCase(),
            tokenURI,
          };
          const tokenUriArweaveTxId = parseArweaveTxId(tokenURI);
          let tokenUriMetadataTimedOut = false;
          const tokenUriOut: any = {};
          const tokenUriMetadataTask = (async () => {
            if (tokenUriArweaveTxId) {
              const tokenUriText = await downloadArweaveTextForGroup({
                txId: tokenUriArweaveTxId,
                groupKeyOrCfg,
                arweaveOpts: {
                  directToArIo: false,
                  gateways: SBT_TOKENURI_METADATA_GATEWAYS,
                  bypassFailureCache: true,
                  shortCircuitNotFound: true,
                  retries: 0,
                  gatewayTimeoutMs: Math.max(1000, SBT_TOKENURI_METADATA_TIMEOUT_MS - 500),
                  debugContext: buildArweaveDebugContext(groupKeyOrCfg, 'sbt_metadata', {
                    fn: 'getSbtMetadata',
                    sbtAddress: String(sbtAddress || '').toLowerCase(),
                  }),
                },
              });
              return JSON.parse(tokenUriText);
            }
            const res = await fetch(tokenURI, { headers: { accept: 'application/json' } });
            if (res && res.ok) {
              const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase();
              if (contentType.includes('json')) {
                return await res.json().catch(() => null);
              }
              if (contentType.startsWith('image/')) {
                tokenUriOut.image = tokenURI;
              }
              const text = await res.text().catch(() => '');
              if (!text) return null;
              try {
                return JSON.parse(text);
              } catch {
                return null;
              }
            }
            return null;
          })();
          const json = await runWithSoftTimeout(
            tokenUriMetadataTask.then((result: any) => {
              if (!tokenUriMetadataTimedOut && Object.keys(tokenUriOut).length > 0) {
                Object.assign(out, tokenUriOut);
                out.tokenUriMetadataFetched = true;
              }
              return result;
            }),
            {
              timeoutMs: SBT_TOKENURI_METADATA_TIMEOUT_MS,
              fallbackValue: null,
              onTimeout: () => {
                tokenUriMetadataTimedOut = true;
                contractsLog.warn('[getSbtMetadata] tokenURI metadata fetch timed out; using on-chain fallback', {
                  ...tokenUriLogMeta,
                  txId: tokenUriArweaveTxId || null,
                  timeoutMs: SBT_TOKENURI_METADATA_TIMEOUT_MS,
                });
              },
            }
          );

          if (!tokenUriMetadataTimedOut && json && typeof json === 'object') {
            out.tokenUriMetadataFetched = true;
            const MASKED_SBT_FIELD_VALUE = '[encrypted]';
            const hasJsonField = (fieldKey: any) => Object.prototype.hasOwnProperty.call(json, fieldKey);
            const encryptedFields = isObj(json.encryptedFields) ? json.encryptedFields : null;
            const targets = isObj(json?.encryption?.targets) ? json.encryption.targets : {};
            const legacyEncryptedFieldKeys: any = {
              name: ['nameEncrypted', 'encryptedName'],
              description: ['descriptionEncrypted', 'encryptedDescription'],
              tags: ['tagsEncrypted', 'encryptedTags'],
              documentURLs: ['documentURLsEncrypted', 'docUrlsEncrypted'],
            };
            const isLockedField = (fieldKey: any) => {
              if (encryptedFields && Object.prototype.hasOwnProperty.call(encryptedFields, fieldKey) && encryptedFields[fieldKey]) {
                return true;
              }
              if (targets?.[fieldKey] === true) return true;
              return (legacyEncryptedFieldKeys[fieldKey] || []).some((legacyKey: any) => !!json?.[legacyKey]);
            };

            if (hasJsonField('name')) {
              out.name = typeof json.name === 'string' ? json.name : '';
            } else if (!out.name) {
              if (typeof json.title === 'string') out.name = json.title;
            }
            if (encryptedFields && typeof encryptedFields === 'object') {
              out.encryptedFields = encryptedFields;
            }
            if (json.encryption && typeof json.encryption === 'object') {
              out.encryption = json.encryption;
            }
            if (encryptedFields?.name) out.nameEncrypted = encryptedFields.name;
            if (isLockedField('name')) {
              out.nameLocked = true;
              out.name = MASKED_SBT_FIELD_VALUE;
            }
            if (!isLockedField('image') && typeof json.image === 'string') {
              const normalizedImage = normalizeUri(json.image, { gateway: 'https://arweave.net' });
              if (normalizedImage) {
                out.image = normalizedImage;
              }
            }
            if (encryptedFields?.image) out.imageEncrypted = encryptedFields.image;
            if (isLockedField('image')) {
              out.imageLocked = true;
              out.image = '';
            }
            if (typeof json.description === 'string') out.description = json.description;
            if (encryptedFields?.description) out.descriptionEncrypted = encryptedFields.description;
            if (typeof json.descriptionEncrypted === 'string') out.descriptionEncrypted = json.descriptionEncrypted;
            if (typeof json.encryptedDescription === 'string') out.descriptionEncrypted = json.encryptedDescription;
            if (json.descriptionAccess && typeof json.descriptionAccess === 'object') {
              out.descriptionAccess = json.descriptionAccess;
            }
            if ((out.description == null || out.description === '') && out.descriptionEncrypted) {
              out.description = '';
            }
            if (out.descriptionEncrypted) out.descriptionLocked = true;
            if (encryptedFields?.tags) out.tagsEncrypted = encryptedFields.tags;
            if (typeof json.tagsEncrypted === 'string') out.tagsEncrypted = json.tagsEncrypted;
            if (typeof json.encryptedTags === 'string') out.tagsEncrypted = json.encryptedTags;
            if (json.tagsAccess && typeof json.tagsAccess === 'object') {
              out.tagsAccess = json.tagsAccess;
            }
            if (encryptedFields?.documentURLs) out.documentURLsEncrypted = encryptedFields.documentURLs;
            if (typeof json.documentURLsEncrypted === 'string') out.documentURLsEncrypted = json.documentURLsEncrypted;
            if (typeof json.docUrlsEncrypted === 'string') out.documentURLsEncrypted = json.docUrlsEncrypted;
            if (json.documentURLsAccess && typeof json.documentURLsAccess === 'object') {
              out.documentURLsAccess = json.documentURLsAccess;
            }
            if (json.encryptedFieldGates && typeof json.encryptedFieldGates === 'object') {
              out.encryptedFieldGates = json.encryptedFieldGates;
            }

            const secs = toSeconds(json.mintingEndTime);
            if (secs !== undefined) out.mintingEndTime = secs;          // 0 = never

            if (typeof json.unlisted === 'boolean') out.unlisted = json.unlisted;
            if (json.burnAuth !== undefined) out.burnAuth = mapBurnAuth(json.burnAuth);

            if (typeof json.hasPasswordMint === 'boolean') out.hasPasswordMint = !!json.hasPasswordMint;
            if (json.maxTokens != null) out.maxTokens = String(json.maxTokens);

            if (Array.isArray(json.tags)) out.tags = json.tags;
            if ((out.tags == null) && out.tagsEncrypted) out.tags = [];
            if (out.tagsEncrypted) out.tagsLocked = true;
            const documentUrlValue =
              json.documentURLs ||
              json.documentUrls ||
              json.docURLs ||
              json.docUrls ||
              json.documentURL ||
              json.documentUrl ||
              json.docURL ||
              json.docUrl ||
              null;
            if (Array.isArray(documentUrlValue)) {
              out.documentURLs = documentUrlValue.filter(Boolean);
            } else if (typeof documentUrlValue === 'string' && documentUrlValue.trim()) {
              out.documentURLs = [documentUrlValue.trim()];
            } else if (Array.isArray(json.documents)) {
              out.documentURLs = json.documents
                .map((entry: any) => {
                  if (typeof entry === 'string') return entry.trim();
                  if (entry && typeof entry === 'object') {
                    const record = entry as Record<string, unknown>;
                    return String(
                      record.url ||
                      record.href ||
                      record.link ||
                      record.documentURL ||
                      record.documentUrl ||
                      record.docURL ||
                      record.docUrl ||
                      record.value ||
                      ''
                    ).trim();
                  }
                  return '';
                })
                .filter(Boolean);
            }
            if (out.documentURLs == null) out.documentURLs = [];
            if (out.documentURLsEncrypted) out.documentURLsLocked = true;
            if (typeof json.creator === 'string') out.creator = json.creator;
            if (typeof json.sessionSlug === 'string') out.sessionSlug = json.sessionSlug;
            if (!out.sessionSlug && typeof json.slug === 'string') out.sessionSlug = json.slug;
            if (typeof json.sessionName === 'string') out.sessionName = json.sessionName;
            if (json.network !== undefined) out.network = json.network;

            const creationBlock = toBlockNumber(
              json.creationBlock ??
              json.createdBlock ??
              json.sbtCreatedBlock ??
              json.creation_block ??
              json.created_block
            );
            if (creationBlock !== undefined) out.creationBlock = creationBlock;
          } else if (!tokenUriMetadataTimedOut) {
            out.tokenUriMetadataFetched = true;
          }
        } catch {}
      }

      // Always prefer on-chain mint flags over tokenURI hints when the reads succeed.
      {
        const FRAG: any[] = [
          "function maxTokens() view returns (uint256)",
          "function collectionBurnAuth() view returns (uint8)",
          "function mintingEndTime() view returns (uint256)",
          "function hasPasswordMint() view returns (bool)",
          "function mintMode() view returns (uint8)"
        ];
        const c = new ethers.Contract(sbtAddress, FRAG, provider as any);
        const mintModeRead = typeof c.mintMode === 'function'
          ? c.mintMode().catch(() => null)
          : Promise.resolve(null);
        const [max, burn, end, hasPw, mintMode] = await Promise.all([
          c.maxTokens().catch(() => null),
          c.collectionBurnAuth().catch(() => null),
          c.mintingEndTime().catch(() => null),
          c.hasPasswordMint().catch(() => null),
          mintModeRead
        ]);

        if (max  != null) out.maxTokens      = ethers.BigNumber.isBigNumber(max)  ? max.toString() : String(max);
        if (burn != null) out.burnAuth       = Number(ethers.BigNumber.isBigNumber(burn) ? burn.toNumber() : burn);
        if (end  != null) out.mintingEndTime = toSeconds(ethers.BigNumber.isBigNumber(end) ? end.toNumber() : Number(end));
        if (mintMode != null) {
          out.mintMode = Number(ethers.BigNumber.isBigNumber(mintMode) ? mintMode.toNumber() : mintMode);
          out.hasPasswordMint = hasPasswordMintForSbtMintMode(out.mintMode);
        } else if (hasPw != null) {
          out.hasPasswordMint = !!hasPw;
        }
      }

      // Final guard: ensure mintingEndTime is normalized to seconds if present
      if (out.mintingEndTime != null) {
        const n = Number(out.mintingEndTime);
        out.mintingEndTime = (n > 1e12) ? Math.floor(n / 1000) : Math.max(0, Math.floor(n));
      }

      if (!out.admin_ && out.admin) out.admin_ = out.admin;
      const adminNormalized = normalizeAddress(out.admin || out.admin_ || '');
      const hasAdminAddress = !!adminNormalized && adminNormalized !== normalizeAddress(ethers.constants.AddressZero);
      if (hasAdminAddress && !out.deployer) out.deployer = adminNormalized;
      if (hasAdminAddress && (!out.creator || !String(out.creator).trim())) {
        out.creator = adminNormalized;
      }

      const fallbackSessionSlug = normalizeSessionSlug(cfg?.slug || '');
      normalizeSbtSessionLinkFields(out, fallbackSessionSlug);

      const fallbackSessionName = (() => {
        const fromCfg = resolveSessionNameValue(cfg || {});
        if (fromCfg) return fromCfg;
        return fallbackSessionSlug || 'general';
      })();
      normalizeSessionNameFields(out, fallbackSessionName);

      return out;
    } catch (e: any) {
      contractsLog.error('[getSbtMetadata] failed:', e);
      return null;
    }
  },



  startClaim: async function(providerName: any, SBTAddress: any, userCommit: any) {
    if (providerName === 'none') throw new Error('startClaim requires a signer-capable provider (not read-only).');
    const providerLocation = contractScripts.getProviderLocation(providerName);
    const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
    const signer = ethersProvider.getSigner();
    const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
    const txOverrides = await resolveTxGasOverrides({
      contract: CustomSBT,
      method: 'startClaim',
      args: [userCommit],
      fallbackGasLimit: '400000',
      minEstimate: '70000',
      logLabel: 'startClaim',
      preferFallbackGasLimit: true,
    });
    rpcLog('RPC Call (Tx):', { function: 'startClaim', method: 'CustomSBT.startClaim', params: { userCommitLength: userCommit?.length || 0 } });
    const { receipt } = await sendContractWriteViaProvider({
      signingProvider: providerLocation,
      ethersProvider,
      signer,
      contract: CustomSBT,
      method: 'startClaim',
      args: [userCommit],
      txOverrides,
      rpcFunction: 'startClaim',
      revertMessage: 'startClaim transaction reverted on-chain.',
    });
    return receipt;
  },

  claimWithPassword: async function(providerName: any, SBTAddress: any, password: any) {
    if (providerName === 'none') throw new Error('claimWithPassword requires a signer-capable provider (not read-only).');
    const providerLocation = contractScripts.getProviderLocation(providerName);
    const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
    const signer = ethersProvider.getSigner();
    const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
    const txOverrides = await resolveTxGasOverrides({
      contract: CustomSBT,
      method: 'claimWithPassword',
      args: [password],
      fallbackGasLimit: '700000',
      minEstimate: '120000',
      logLabel: 'claimWithPassword',
      preferFallbackGasLimit: true,
    });
    rpcLog('RPC Call (Tx):', { function: 'claimWithPassword', method: 'CustomSBT.claimWithPassword', params: { passwordProvided: !!password } });
    const { receipt } = await sendContractWriteViaProvider({
      signingProvider: providerLocation,
      ethersProvider,
      signer,
      contract: CustomSBT,
      method: 'claimWithPassword',
      args: [password],
      txOverrides,
      rpcFunction: 'claimWithPassword',
      revertMessage: 'claimWithPassword transaction reverted on-chain.',
    });
    return receipt;
  },

  claimWithInvite: async function(providerName: any, SBTAddress: any, nonce: any, signature: any) {
    if (providerName === 'none') throw new Error('claimWithInvite requires a signer-capable provider (not read-only).');
    inviteLog.log('[INVITE_DEBUG v4] claimWithInvite (instrumented)');
    inviteLog.log('--- Debug ClaimWithInvite ---');
    inviteLog.log('SBT Address:', SBTAddress);
    inviteLog.log('Nonce:', nonce);
    inviteLog.log('Signature:', signature);
    if (!SBTAddress || !ethers.utils.isAddress(SBTAddress)) {
      throw new Error('Invalid SBT address for claimWithInvite.');
    }
    const providerLocation = contractScripts.getProviderLocation(providerName);
    const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
    const signer = ethersProvider.getSigner();
    let signerAddress = null;
    try {
      signerAddress = await signer.getAddress();
      inviteLog.log('Signer Address:', signerAddress);
    } catch (err: any) {
      inviteLog.warn('Failed to resolve signer address:', err?.message || err);
    }
    const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
    let callStaticFailure = null;

    // Preflight debug: recover signer + compare to on-chain hash + nonce expectations.
    try {
      const messageHash = cryptoUtils.buildInviteMessageHash({ sbtAddress: SBTAddress, nonce });
      const recovered = ethers.utils.verifyMessage(ethers.utils.arrayify(messageHash), signature);
      const recoveredHash = ethers.utils.solidityKeccak256(['address'], [recovered]);
      inviteLog.log('[INVITE_DEBUG v4] recovered signer:', recovered);
      inviteLog.log('[INVITE_DEBUG v4] recovered hash:', recoveredHash);

      const onchainHash = await this.getGroupPasswordHash('none', SBTAddress, '');
      inviteLog.log('[INVITE_DEBUG v4] on-chain groupPasswordHash:', onchainHash);
      if (onchainHash && onchainHash !== ethers.constants.HashZero) {
        inviteLog.log('[INVITE_DEBUG v4] signature matches on-chain:', String(onchainHash).toLowerCase() === recoveredHash.toLowerCase());
      }

      const mintedTokens = await this.getMintedTokens('none', SBTAddress, '');
      inviteLog.log('[INVITE_DEBUG v4] mintedTokens:', mintedTokens);
      if (mintedTokens != null) {
        try {
          const expected = ethers.BigNumber.from(mintedTokens).add(1).toString();
          inviteLog.log('[INVITE_DEBUG v4] expected nonce:', expected);
        } catch {}
      }

      try {
        const signerHash = await CustomSBT.groupPasswordHash?.().catch(() => null);
        if (signerHash) {
          inviteLog.log('[INVITE_DEBUG v4] signer groupPasswordHash:', signerHash);
          inviteLog.log('[INVITE_DEBUG v4] signature matches signer:', String(signerHash).toLowerCase() === recoveredHash.toLowerCase());
        }
      } catch {}

      try {
        const signerMinted = await CustomSBT.mintedTokens?.().catch(() => null);
        if (signerMinted != null) {
          inviteLog.log('[INVITE_DEBUG v4] signer mintedTokens:', ethers.BigNumber.from(signerMinted).toString());
        }
      } catch {}

      try {
        let readProvider = null;
        let readChainId = null;
        try {
          const net = await ethersProvider.getNetwork();
          readChainId = net?.chainId;
          inviteLog.log('[INVITE_DEBUG v4] signer chainId:', readChainId);
        } catch {}

        if (readChainId) {
          try {
            readProvider = getReadProviderForChain(readChainId);
          } catch {
            readProvider = null;
          }
        }

        if (readProvider) {
          const readContract = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, readProvider as any);
          const [mintingEndTime, maxTokens, hasPasswordMint, userTokenId] = await Promise.all([
            readContract.mintingEndTime?.().catch(() => null),
            readContract.maxTokens?.().catch(() => null),
            readContract.hasPasswordMint?.().catch(() => null),
            readContract.getTokenIdByOwner?.(signerAddress || ethers.constants.AddressZero).catch(() => null)
          ]);
          let code = null;
          let balanceOf = null;
          try {
            code = signerAddress ? await readProvider.getCode(signerAddress) : null;
          } catch {}
          try {
            balanceOf = signerAddress ? await readContract.balanceOf?.(signerAddress).catch(() => null) : null;
          } catch {}
          const endSec = mintingEndTime != null ? Number(ethers.BigNumber.from(mintingEndTime).toString()) : null;
          const nowSec = Math.floor(Date.now() / 1000);
          inviteLog.log('[INVITE_DEBUG v4] mintingEndTime:', endSec, 'now:', nowSec);
          inviteLog.log('[INVITE_DEBUG v4] maxTokens:', maxTokens != null ? ethers.BigNumber.from(maxTokens).toString() : null);
          inviteLog.log('[INVITE_DEBUG v4] hasPasswordMint:', hasPasswordMint);
          inviteLog.log('[INVITE_DEBUG v4] userTokenId:', userTokenId != null ? ethers.BigNumber.from(userTokenId).toString() : null);
          if (code != null) {
            inviteLog.log('[INVITE_DEBUG v4] signer code length:', code.length);
            inviteLog.log('[INVITE_DEBUG v4] signer is contract:', code !== '0x');
          }
          if (balanceOf != null) {
            inviteLog.log('[INVITE_DEBUG v4] balanceOf:', ethers.BigNumber.from(balanceOf).toString());
          }

          try {
            await readContract.callStatic.claimWithInvite(nonce, signature, { from: signerAddress || undefined });
            inviteLog.log('[INVITE_DEBUG v4] read callStatic.claimWithInvite: ok');
          } catch (callErr: any) {
            const errMsg =
              callErr?.reason ||
              callErr?.errorName ||
              callErr?.error?.message ||
              callErr?.data?.message ||
              callErr?.message ||
              callErr;
            inviteLog.warn('[INVITE_DEBUG v4] read callStatic.claimWithInvite failed:', errMsg);
          }
        } else {
          inviteLog.warn('[INVITE_DEBUG v4] read provider unavailable; skipping read callStatic');
        }

        try {
          await CustomSBT.callStatic.claimWithInvite(nonce, signature, { from: signerAddress || undefined });
          inviteLog.log('[INVITE_DEBUG v4] signer callStatic.claimWithInvite: ok');
        } catch (callErr: any) {
          const errMsg =
            callErr?.reason ||
            callErr?.errorName ||
            callErr?.error?.message ||
            callErr?.data?.message ||
            callErr?.message ||
            callErr;
          inviteLog.error('[INVITE_DEBUG v4] signer callStatic.claimWithInvite failed:', errMsg);
          if (callErr instanceof Error) {
            callStaticFailure = callErr;
          } else {
            callStaticFailure = new Error(String(errMsg || 'callStatic.claimWithInvite failed'));
          }
        }
      } catch (metaErr: any) {
        inviteLog.warn('[INVITE_DEBUG v4] metadata checks failed:', metaErr?.message || metaErr);
      }
    } catch (preErr: any) {
      inviteLog.warn('[INVITE_DEBUG v4] preflight check failed:', preErr?.message || preErr);
    }
    if (callStaticFailure) {
      throw callStaticFailure;
    }
    const txOverrides = await resolveTxGasOverrides({
      contract: CustomSBT,
      method: 'claimWithInvite',
      args: [nonce, signature],
      fallbackGasLimit: '10000000',
      minEstimate: '120000',
      logLabel: 'claimWithInvite',
      preferFallbackGasLimit: true,
    });
    rpcLog('RPC Call (Tx):', {
      function: 'claimWithInvite',
      method: 'CustomSBT.claimWithInvite',
      params: {
        nonce,
        signatureLength: signature ? signature.length : 0,
        gasLimit: txOverrides?.gasLimit?.toString?.() || null
      }
    });
    const { receipt } = await sendContractWriteViaProvider({
      signingProvider: providerLocation,
      ethersProvider,
      signer,
      contract: CustomSBT,
      method: 'claimWithInvite',
      args: [nonce, signature],
      txOverrides,
      rpcFunction: 'claimWithInvite',
      revertMessage: 'claimWithInvite transaction reverted on-chain.',
    });
    return receipt;
  },

  isPasswordValid: async function(providerLike: any, sbtAddress: any, hashedPasswordBytes32: any, groupKeyOrCfg: any = null) {
    try {
      const cfg  = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
      const chId = Number(
        cfg?.networkChainId ||
        cfg?.contracts?.sbtFactory?.chainId ||
        cfg?.contracts?.surveys?.chainId ||
        0
      ) || undefined;

      const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);

      let ok = false;
      try {
        const contract = new ethers.Contract(sbtAddress, CUSTOM_SBT_ABI, provider as any);
        ok = await callWithRetry(() => contract.isPasswordValid(hashedPasswordBytes32), 'CustomSBT.isPasswordValid');
      } catch (e: any) {
        inviteLog.error('[LIMITED][isPasswordValid] call failed:', e);
        ok = false;
      }
      inviteLog.log(`[LIMITED][isPasswordValid] sbt=${sbtAddress}, hash=${hashedPasswordBytes32}, ok=${ok}`);
      return ok;
    } catch (e: any) {
      inviteLog.error('[LIMITED][isPasswordValid] provider resolution failed:', e);
      return false;
    }
  },

  /**
   * Deterministic group password hash scoped to an SBT address.
   * Predeploy callers fall back to AddressZero by passing an empty sbtAddress.
   */
  computeGroupPasswordHash({ password, sbtAddress, adminAddress, chainId, name, symbol, tokenURI }: any) {
    return cryptoUtils.computeGroupPasswordHash({
      password,
      sbtAddress,
      adminAddress,
      chainId,
      name,
      symbol,
      tokenURI
    } as any);
  },


  async signGroupMintAuthorization({
    password,
    sbtAddress,
    userAddress,
    walletScopeSbtAddress
  }: any) {
    const resolvedWalletScopeSbtAddress = await resolveGroupPasswordWalletScopeSbtAddress({
      password,
      sbtAddress,
      walletScopeSbtAddress,
      getGroupPasswordHashFn: this.getGroupPasswordHash.bind(this),
    });
    rpcLog('Local Sign (SBT-scoped group signature):', {
      function: 'signGroupMintAuthorization',
      params: { sbtAddress, userAddress }
    });
    return cryptoUtils.signGroupMintAuthorization({
      password,
      sbtAddress,
      userAddress,
      walletScopeSbtAddress: resolvedWalletScopeSbtAddress
    });
  },

  async generateInvitePayloads({
    password,
    sbtAddress,
    nonces,
    walletScopeSbtAddress
  }: any) {
    if (!Array.isArray(nonces) || nonces.length === 0) {
      throw new Error('generateInvitePayloads requires a non-empty nonces array.');
    }
    const normalizedPassword = cryptoUtils.normalizeGroupPasswordInput(password);
    if (!normalizedPassword) {
      throw new Error('generateInvitePayloads requires a non-empty group password.');
    }
    const resolvedWalletScopeSbtAddress = await resolveGroupPasswordWalletScopeSbtAddress({
      password: normalizedPassword,
      sbtAddress,
      walletScopeSbtAddress,
      getGroupPasswordHashFn: this.getGroupPasswordHash.bind(this),
    });
    inviteLog.log('[INVITE_DEBUG v4] generateInvitePayloads (SBT-scoped derivation)', {
      sbtAddress,
      nonceCount: nonces.length
    });
    try {
      const localHash = cryptoUtils.computeGroupPasswordHash({
        password: normalizedPassword,
        sbtAddress: resolvedWalletScopeSbtAddress
      });
      inviteLog.log('[INVITE_DEBUG v4] derived groupPasswordHash:', localHash);
    } catch {}
    const out: any[] = [];
    for (const nonce of nonces) {
      const signature = await cryptoUtils.signInvite({
        password: normalizedPassword,
        sbtAddress,
        nonce,
        walletScopeSbtAddress: resolvedWalletScopeSbtAddress
      });
      const payload: any = { n: String(nonce), s: signature };
      const inviteCode = cryptoUtils.encodeInvite(payload);
      out.push({ nonce: String(nonce), signature, inviteCode });
    }
    return out;
  },

  // "Group" here refers to SBT token group/collection, not session group
  /** Read helper for on-chain groupPasswordHash */
  async getGroupPasswordHash(providerName: any, SBTAddress: any, groupKeyOrCfg: any = null, options: any = {}) {
    try {
      const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider as any);
      if (!CustomSBT.groupPasswordHash) return null;
      const v = await callWithRetry(() => CustomSBT.groupPasswordHash(), 'CustomSBT.groupPasswordHash');
      return v;
    } catch (error: any) {
      try {
        const win: any = typeof window !== 'undefined' ? window : {};
        const fallback = resolveReadProvider({
          groupKeyOrCfg,
          readOptions: SBT_READ_PROVIDER_OPTIONS,
          allowInjectedReadFallback: !!options?.allowInjectedReadFallback,
          injectedProvider: win.ethereum,
          readProviderFactory: () => {
            throw error;
          },
        });
        if (fallback.ok && fallback.source === 'injected-wallet') {
          const provider = new ethers.providers.Web3Provider(fallback.provider as any, 'any');
          const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider as any);
          if (!CustomSBT.groupPasswordHash) return null;
          inviteLog.warn('[INVITE_DEBUG v2] getGroupPasswordHash falling back to injected provider by explicit opt-in');
          const v = await CustomSBT.groupPasswordHash();
          return v;
        }
      } catch {}
      return null;
    }
  },

  /** Read helper for on-chain mintedTokens */
  async getMintedTokens(providerName: any, SBTAddress: any, groupKeyOrCfg: any = null, options: any = {}) {
    try {
      if (!SBTAddress || !ethers.utils.isAddress(SBTAddress)) return null;
      const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const CustomSBT = new ethers.Contract(SBTAddress, ["function mintedTokens() view returns (uint256)"], provider as any);
      const v = await callWithRetry(() => CustomSBT.mintedTokens(), 'CustomSBT.mintedTokens');
      return v != null ? v.toString() : null;
    } catch (error: any) {
      try {
        const win: any = typeof window !== 'undefined' ? window : {};
        const fallback = resolveReadProvider({
          groupKeyOrCfg,
          readOptions: SBT_READ_PROVIDER_OPTIONS,
          allowInjectedReadFallback: !!options?.allowInjectedReadFallback,
          injectedProvider: win.ethereum,
          readProviderFactory: () => {
            throw error;
          },
        });
        if (fallback.ok && fallback.source === 'injected-wallet') {
          const provider = new ethers.providers.Web3Provider(fallback.provider as any, 'any');
          const CustomSBT = new ethers.Contract(SBTAddress, ["function mintedTokens() view returns (uint256)"], provider as any);
          inviteLog.warn('[INVITE_DEBUG v2] getMintedTokens falling back to injected provider by explicit opt-in');
          const v = await CustomSBT.mintedTokens();
          return v != null ? v.toString() : null;
        }
      } catch {}
      return null;
    }
  },

  async getSbtHistorySummary(providerName: any, SBTAddress: any, groupKeyOrCfg: any = null) {
    try {
      if (!SBTAddress || !ethers.utils.isAddress(SBTAddress)) return null;
      const provider = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
      const CustomSBT = new ethers.Contract(
        SBTAddress,
        [
          "function getHistorySummary() view returns (uint256 totalMinted,uint256 totalBurned,uint256 activeSupply,uint256 currentHolderCount,uint256 historicalHolderCount)"
        ],
        provider as any
      );
      const summary = await callWithRetry(() => CustomSBT.getHistorySummary(), 'CustomSBT.getHistorySummary');
      return normalizeSbtHistorySummary(summary);
    } catch {
      try {
        if (typeof window !== 'undefined' && window.ethereum) {
          const provider = new ethers.providers.Web3Provider(window.ethereum as any, 'any');
          const CustomSBT = new ethers.Contract(
            SBTAddress,
            [
              "function getHistorySummary() view returns (uint256 totalMinted,uint256 totalBurned,uint256 activeSupply,uint256 currentHolderCount,uint256 historicalHolderCount)"
            ],
            provider as any
          );
          inviteLog.warn('[INVITE_DEBUG v2] getSbtHistorySummary falling back to injected provider');
          const summary = await CustomSBT.getHistorySummary();
          return normalizeSbtHistorySummary(summary);
        }
      } catch {}
      return null;
    }
  },



  computeGroupMintMessageHash: function (sbtAddress: any, userAddress: any) {
    return cryptoUtils.computeGroupMintMessageHash(sbtAddress, userAddress);
  },

  mintWithGroupSignature: async function(providerName: any, SBTAddress: any, signature: any) {
    if (providerName === 'none') throw new Error('mintWithGroupSignature requires a signer-capable provider (not read-only).');
    const providerLocation = contractScripts.getProviderLocation(providerName);
    const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
    const signer = ethersProvider.getSigner();
    const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
    const txOverrides = await resolveTxGasOverrides({
      contract: CustomSBT,
      method: 'mintWithGroupSignature',
      args: [signature],
      fallbackGasLimit: '700000',
      minEstimate: '120000',
      logLabel: 'mintWithGroupSignature',
      preferFallbackGasLimit: true,
    });
    rpcLog('RPC Call (Tx):', {
      function: 'mintWithGroupSignature',
      method: 'CustomSBT.mintWithGroupSignature',
      params: { signatureLength: signature ? signature.length : 0 }
    });
    const { receipt } = await sendContractWriteViaProvider({
      signingProvider: providerLocation,
      ethersProvider,
      signer,
      contract: CustomSBT,
      method: 'mintWithGroupSignature',
      args: [signature],
      txOverrides,
      rpcFunction: 'mintWithGroupSignature',
      revertMessage: 'mintWithGroupSignature transaction reverted on-chain.',
    });
    return receipt;
  },


  claim: async function(providerName: any, SBTAddress: any) {
    if (providerName === 'none') throw new Error('claim requires a signer-capable provider (not read-only).');
    const providerLocation = contractScripts.getProviderLocation(providerName);
    const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
    const signer = ethersProvider.getSigner();
    const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
    const txOverrides = await resolveTxGasOverrides({
      contract: CustomSBT,
      method: 'claim',
      args: [],
      fallbackGasLimit: '400000',
      minEstimate: '70000',
      logLabel: 'claim',
      preferFallbackGasLimit: true,
    });
    rpcLog('RPC Call (Tx):', { function: 'claim', method: 'CustomSBT.claim', params: {} });
    const { receipt } = await sendContractWriteViaProvider({
      signingProvider: providerLocation,
      ethersProvider,
      signer,
      contract: CustomSBT,
      method: 'claim',
      args: [],
      txOverrides,
      rpcFunction: 'claim',
      revertMessage: 'claim transaction reverted on-chain.',
    });
    return receipt;
  },

  addHashedPasswords: async function(providerName: any, SBTAddress: any, hashedPasswords: any) {
    if (providerName === 'none') throw new Error('addHashedPasswords requires a signer-capable provider (not read-only).');
    const providerLocation = contractScripts.getProviderLocation(providerName);
    const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
    const signer = ethersProvider.getSigner();
    const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
    const txOverrides = await resolveTxGasOverrides({
      contract: CustomSBT,
      method: 'addHashedPasswords',
      args: [hashedPasswords],
      fallbackGasLimit: String(GAS_FALLBACKS.addHashedPasswords(hashedPasswords.length)),
      minEstimate: '100000',
      logLabel: 'addHashedPasswords',
      preferFallbackGasLimit: true,
    });
    rpcLog('RPC Call (Tx):', { function: 'addHashedPasswords', method: 'CustomSBT.addHashedPasswords', params: { hashedPasswordsCount: hashedPasswords.length } });
    const { receipt } = await sendContractWriteViaProvider({
      signingProvider: providerLocation,
      ethersProvider,
      signer,
      contract: CustomSBT,
      method: 'addHashedPasswords',
      args: [hashedPasswords],
      txOverrides,
      rpcFunction: 'addHashedPasswords',
      revertMessage: 'addHashedPasswords transaction reverted on-chain.',
    });
    return receipt;
  },

  burnToken: async function(providerName: any, SBTAddress: any, tokenId: any) {
    if (providerName === 'none') throw new Error('burnToken requires a signer-capable provider (not read-only).');
    const providerLocation = contractScripts.getProviderLocation(providerName);
    const ethersProvider = new ethers.providers.Web3Provider(providerLocation as any, 'any');
    const signer = ethersProvider.getSigner();
    const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, signer as any);
    const tokenIdFormatted = this.getBigNumber(tokenId);
    const txOverrides = await resolveTxGasOverrides({
      contract: CustomSBT,
      method: 'burn',
      args: [tokenIdFormatted],
      fallbackGasLimit: '500000',
      minEstimate: '100000',
      logLabel: 'burnToken',
      preferFallbackGasLimit: true,
    });
    rpcLog('RPC Call (Tx):', { function: 'burnToken', method: 'CustomSBT.burn', params: { tokenId: tokenIdFormatted.toString() } });
    const { receipt } = await sendContractWriteViaProvider({
      signingProvider: providerLocation,
      ethersProvider,
      signer,
      contract: CustomSBT,
      method: 'burn',
      args: [tokenIdFormatted],
      txOverrides,
      rpcFunction: 'burnToken',
      revertMessage: 'burnToken transaction reverted on-chain.',
    });
    return receipt;
  },

  async userHasSBT(providerName: any, SBTAddress: any, userAddress: any, fromBlock: any = 0, toBlock: any = "latest", groupKeyOrCfg: any = null) {
    // Resolve group-aware read provider
    const provider  = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
    const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider as any);

    void fromBlock;
    void toBlock;

    // Fast path: use the dedicated owner mapping when available.
    try {
      if (ethers.utils.isAddress(userAddress) && CustomSBT && typeof CustomSBT.getTokenIdByOwner === 'function') {
        const tokenId = await callWithRetry(
          () => CustomSBT.getTokenIdByOwner(userAddress),
          'CustomSBT.getTokenIdByOwner (userHasSBT)',
        );
        if (tokenId && typeof tokenId.gt === 'function' && tokenId.gt(0)) return true;
      }
    } catch {
      // Fall back to balanceOf below if the helper is unavailable.
    }

    try {
      if (ethers.utils.isAddress(userAddress) && CustomSBT && typeof CustomSBT.balanceOf === 'function') {
        const bal = await callWithRetry(
          () => CustomSBT.balanceOf(userAddress),
          'CustomSBT.balanceOf (userHasSBT)',
        );
        if (bal && typeof bal.gt === 'function' && bal.gt(0)) return true;
      }
    } catch {
      // Fall through to false when neither direct ownership helper succeeds.
    }

    return false;
  },

  userCanBurnSBTs: async function(providerName: any, SBTAddress: any, userAddress: any, groupKeyOrCfg: any = null) {
    const provider  = getLocalAwareReadProviderForGroup(groupKeyOrCfg, SBT_READ_PROVIDER_OPTIONS);
    const CustomSBT = new ethers.Contract(SBTAddress, CUSTOM_SBT_ABI, provider as any);

    const admin = await callWithRetry(() => CustomSBT.admin(), 'CustomSBT.admin (userCanBurnSBTs)');
    const burnAuth = await callWithRetry(
      () => CustomSBT.collectionBurnAuth(),
      'CustomSBT.collectionBurnAuth (userCanBurnSBTs)'
    );
    const burnAuthNum = ethers.BigNumber.isBigNumber(burnAuth) ? burnAuth.toNumber() : Number(burnAuth);
    const hasSBT = await this.userHasSBT('none', SBTAddress, userAddress, 0, 'latest', groupKeyOrCfg);
    const isAdmin = normalizeAddress(admin) === normalizeAddress(userAddress);

    if (burnAuthNum === 0) return isAdmin;
    if (burnAuthNum === 1) return hasSBT;
    if (burnAuthNum === 2) return isAdmin || hasSBT;
    return false;
  },

  async getCachedSbtMintBurnCountsByAddress(providerName: any, SBTAddress: any, fromBlock: any = 0, toBlock: any = "latest", groupKeyOrCfg: any = null) {
    const scanFn = this.getSbtMintBurnCountsByAddress;
    if (typeof scanFn !== 'function') {
      return {
        mintedCountByAddress: {},
        burnedCountByAddress: {},
        mintedEventCount: 0,
        burnedEventCount: 0,
        scannedToBlock: null,
        ok: false,
      };
    }
    const self = scanFn as any;
    const memo = (self._sharedAddressMemo ??= {});
    const inflight = (self._sharedAddressInflight ??= {});
    const cfg = memoizedResolveSession(groupKeyOrCfg === undefined ? '' : groupKeyOrCfg);
    const scopeTag = buildSbtScopeMemoTag(groupKeyOrCfg, cfg);
    const memoKey = [
      String(providerName || 'none'),
      normalizeAddress(SBTAddress || ''),
      String(fromBlock ?? ''),
      String(toBlock ?? ''),
      scopeTag,
    ].join(':');
    const TTL_MS = 45 * 1000;
    const now = Date.now();
    const hit = memo[memoKey];
    if (hit && (now - hit.ts) < TTL_MS) return hit.value;
    if (inflight[memoKey]) return inflight[memoKey];
    const run = Promise.resolve(
      scanFn.call(this, providerName, SBTAddress, fromBlock, toBlock, groupKeyOrCfg)
    ).then((value: any) => {
      memo[memoKey] = { ts: Date.now(), value };
      return value;
    }).finally(() => {
      if (inflight[memoKey] === run) delete inflight[memoKey];
    });
    inflight[memoKey] = run;
    return run;
  },

  async getAddressesWhoMintedSBT(providerName: any, SBTAddress: any, fromBlock: any = 0, toBlock: any = "latest", groupKeyOrCfg: any = null) {
    const counts = await this.getCachedSbtMintBurnCountsByAddress(
      providerName,
      SBTAddress,
      fromBlock,
      toBlock,
      groupKeyOrCfg
    );
    return Object.keys(counts?.mintedCountByAddress || {});
  },

  async getAddressesWhoBurnedSBT(providerName: any, SBTAddress: any, fromBlock: any = 0, toBlock: any = "latest", groupKeyOrCfg: any = null) {
    const counts = await this.getCachedSbtMintBurnCountsByAddress(
      providerName,
      SBTAddress,
      fromBlock,
      toBlock,
      groupKeyOrCfg
    );
    return Object.keys(counts?.burnedCountByAddress || {});
  },

  ...createContractProfileMethods(contractProfileDeps),


  // SBT Functionality Ends -----------------------------

  getProviderLocation: function(providerName: any) {
    const win: any = typeof window !== 'undefined' ? window : {};
    const resolved = resolveSignerProvider({
      providerName,
      injectedProvider: win.ethereum,
      web3AuthProvider: win.web3authProvider,
      passkeyProviderFactory: () => passkeyWallet.createPasskeyEip1193Provider(),
      // Legacy empty provider state can still use an injected wallet. Named
      // providers must resolve explicitly so passkey flows cannot silently
      // degrade to a different signer.
      allowInjectedSignerFallback: true,
    });
    if (resolved.ok) return resolved.provider;
    throw new Error(resolved.error || `Could not determine provider for "${providerName}".`);
  },

  decimalEighteen,
  toEighteenDecimals,
  getBigNumber,
  getJsNumberFromBN,
  objectIsBN,
  timeout,

};

// Convenience: expose named read-provider resolver on default export
(contractScripts as any).getReadProviderForGroup = getReadProviderForGroup;
contractMetadataResolutionHelpers = createContractScriptsMetadataResolutionHelpers({
  userHasSBT: (...args: unknown[]) => contractScripts.userHasSBT(...args),
});
// Back-compat alias retained for older callers that still use the legacy name.
(contractScripts as any).getETHBalance = (contractScripts as any).getNativeBalance;
export const __test__contractScriptsArweaveCache: any = {
  resolveReadContext,
  downloadArweaveTextForGroup,
  readArweaveTxCacheEntry,
  writeArweaveTxCacheEntry,
  readArweaveTxFailureCacheEntry,
  writeArweaveTxFailureCacheEntry,
  clearArweaveTxFailureCacheEntry,
  recordTerminalArweaveInvalidFailure,
};
export const __test__contractScriptsArweaveUploads: any = {
  buildArweaveUploadTags,
  resolveArweaveUploadOpts,
};
export const __test__contractScriptsSessionNameFields: any = {
  normalizeSessionNameFields,
};
export const __test__contractScriptsSbtMemo: any = {
  bumpSbtMemoRunVersion,
  isLatestSbtMemoRun,
};
export const __test__contractScriptsSbtProgress: any = {
  createSbtEventScanProgressState,
};
export const __test__contractScriptsSbtHistory: any = {
  normalizeHistorySummaryCount,
  normalizeSbtHistorySummary,
  deriveSbtHistorySummaryFromCounts,
};
export const __test__contractScriptsErrors: any = {
  isNonexistentTokenError,
  isRetryableSurveyResponseReadError,
};
export const __test__contractScriptsReadCaches: any = {
  clearLatestBlockCache: () => {
    (latestBlockCache as any)._map = {};
  },
};
export default contractScripts;
