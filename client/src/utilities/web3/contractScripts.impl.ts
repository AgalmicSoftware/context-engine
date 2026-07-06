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

type SbtReadProviderRef = string | Record<string, unknown>;
type SbtReadGroupKeyOrConfig = string | Record<string, unknown> | null | undefined;
type SbtReadOptions = { allowInjectedReadFallback?: boolean; [key: string]: unknown };
type SignGroupMintAuthorizationInput = {
  password?: unknown;
  sbtAddress?: string | null;
  userAddress?: string | null;
  walletScopeSbtAddress?: string | null;
};
type GenerateInvitePayloadsInput = {
  password?: unknown;
  sbtAddress?: string | null;
  nonces?: Array<string | number>;
  walletScopeSbtAddress?: string | null;
};
type InvitePayloadResult = {
  nonce: string;
  signature: string;
  inviteCode: string;
};
type EncodedInvitePayload = {
  n: string;
  s: string;
};
type SbtMintBurnCountsByAddressResult = {
  mintedCountByAddress: Record<string, number>;
  burnedCountByAddress: Record<string, number>;
  mintedEventCount?: number;
  burnedEventCount?: number;
  scannedToBlock?: number | null;
  ok?: boolean;
  [key: string]: unknown;
};

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
import { createProfileChainReadMethods } from './profileChainReads.js';
import { createChainEventScanMethods } from './chainEventScans.js';
import {
  buildArweaveReadModeTag,
  buildDecryptModeTag,
  buildFailureModeTag,
  createChainMetadataResolutionHelpers,
} from './chainMetadataResolution.js';
import { createContractScriptsSurveyEventReadMethods } from './contractScripts.surveyEventReadMethods.js';
import { createContractScriptsSurveyPayloadReadMethods } from './contractScripts.surveyPayloadReadMethods.js';
import { createContractScriptsSurveyWriteMethods } from './contractScripts.surveyWriteMethods.js';
import { createContractScriptsSbtRegistryMethods } from './contractScripts.sbtRegistryMethods.js';
import { createContractScriptsSbtMintMethods } from './contractScripts.sbtMintMethods.js';
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

let contractMetadataResolutionHelpers: ReturnType<typeof createChainMetadataResolutionHelpers>;

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

const contractEventScanMethods = createChainEventScanMethods({
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

const contractScriptsRuntimeDeps = {
  ARWEAVE_ACTIVE,
  CUSTOM_SBT_ABI,
  CUSTOM_SBT_INTERFACE,
  GAS_FALLBACKS,
  HASH_MISS_SENTINEL,
  HASH_READ_MAX_ENTRIES,
  HASH_READ_TTL_MS,
  READ_INFLIGHT,
  READ_MEMO,
  SBT_FACTORY_ABI,
  SBT_FACTORY_INTERFACE,
  SBT_READ_PROVIDER_OPTIONS,
  SBT_TOKENURI_METADATA_GATEWAYS,
  SBT_TOKENURI_METADATA_TIMEOUT_MS,
  STORAGE_BACKENDS,
  STORAGE_RESOURCE_KEYS,
  SURVEYS,
  SURVEYS_INTERFACE,
  arweaveScripts,
  attachStorageRefCompatibilityFields,
  attachPayloadPointerFields,
  buildArweaveDebugContext,
  buildArweaveReadModeTag,
  buildDecryptModeTag,
  buildFailureModeTag,
  buildHashReadInflightKey,
  buildHashReadMemoKey,
  buildHashUnavailableMetadataError,
  buildSbtScopeMemoTag,
  callWithRetry,
  clearReadCachesForGroup,
  cloneJsonSafe,
  contractEventScanMethods,
  contractsLog,
  createSbtEventScanProgressState,
  cryptoUtils,
  deriveSbtHistorySummaryFromCounts,
  downloadArweaveTextForGroup,
  ethers,
  extractChainId,
  fetchLogsSmartWithProvider,
  getLocalAwareReadProviderForGroup,
  getReadProviderForChain,
  getSessionAddresses,
  getSurveysReadProviderForSession,
  getTimedMemoValue,
  hasNonZeroHashValue,
  hasPasswordMintForSbtMintMode,
  inviteLog,
  isCallExceptionError,
  isCloudflareStorageResource,
  isNonexistentTokenError,
  isObj,
  isRetryableSurveyResponseReadError,
  latestBlockCache,
  logArweaveMetadataFetchFailure,
  markHashRevertLoggedOnce,
  maybeWrapUnsupportedConfiguredDeterministicFactoryError,
  memoizedResolveSession,
  normalizeAddress,
  normalizeArweaveUrl,
  normalizeConvictionImportance,
  normalizeCreate2Salt,
  normalizeHistorySummaryCount,
  normalizeQuestionFlags,
  normalizeSbtHistorySummary,
  normalizeSbtSessionLinkFields,
  normalizeSessionNameFields,
  normalizeSessionSlug,
  normalizeStorageRef,
  notify,
  notifyUserFacingTransactionError,
  parseArweaveTxId,
  questionHashRevertLogged,
  readPayloadPointerTextForGroup,
  recordTerminalArweaveInvalidFailure,
  resolveGroupPasswordWalletScopeSbtAddress,
  resolveReadContext,
  resolveReadProvider,
  resolveArweaveUploadOpts,
  resolveSession,
  resolveSessionByName,
  resolveSessionNameValue,
  resolveStorageSessionSlug,
  resolveTxGasOverrides,
  rpcLog,
  runInFlightCoalesced,
  runWithSoftTimeout,
  sendContractWriteViaProvider,
  setTimedMemoValue,
  shouldLog,
  surveyHashRevertLogged,
  uploadJsonPayloadForContractPointer,
  utils,
  validateNoLockedPlaintextInPayload,
  get contractMetadataResolutionHelpers() {
    return contractMetadataResolutionHelpers;
  },
};

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

  ...createContractScriptsSurveyEventReadMethods(contractScriptsRuntimeDeps),
  ...createContractScriptsSurveyWriteMethods(contractScriptsRuntimeDeps),
  ...createContractScriptsSbtRegistryMethods(contractScriptsRuntimeDeps),
  ...createContractScriptsSurveyPayloadReadMethods(contractScriptsRuntimeDeps),
  ...createContractScriptsSbtMintMethods(contractScriptsRuntimeDeps),
  ...createProfileChainReadMethods(contractProfileDeps),


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
contractMetadataResolutionHelpers = createChainMetadataResolutionHelpers({
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
