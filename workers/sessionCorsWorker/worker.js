import { ethers } from 'ethers';
import rpcDefaults from '../../shared/rpcDefaults.cjs';
import { createWorkerLowLevelHelpersWithWorkerDeps } from './workerLowLevelHelperBinding.js';
import { createWorkerRouteRuntimeWithWorkerDeps } from './workerRouteRuntimeBinding.js';
import { resolveWorkerRuntimeDeps } from './workerRuntimeDepResolution.js';
import { resolveOpenAiTranscribeUrl } from './endpointConfig.js';

export { SessionWriteCoordinator, WorkerGroupWriteCoordinator } from './sessionWriteCoordinator.js';

let workerDebugLogsEnabled = false;

const isWorkerDebugLogsEnabled = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

const initializeWorkerDebugLogs = (env) => {
  workerDebugLogsEnabled = isWorkerDebugLogsEnabled(env?.WORKER_DEBUG_LOGS);
};

const log = (...args) => {
  if (!workerDebugLogsEnabled) return;
  console.log(...args);
};

log.warn = (...args) => console.warn(...args);
log.error = (...args) => console.error(...args);

const { getPathRpcUrl } = rpcDefaults;

const SESSION_REGISTRY_ABI = [
  'function getResourceGate(string,string) view returns (address[] sbtAddresses, uint256 chainId, uint8 mode, uint256 perMemberLimit)',
  'function sessionExists(string) view returns (bool)',
  'function getSessionBySlug(string) view returns (string,uint256,string,string,address,uint256,uint256,bytes16)',
];
const ERC721_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const SBT_ADMIN_ABI = ['function admin() view returns (address)', 'function owner() view returns (address)'];
const HATS_ABI = ['function isWearerOfHat(address wearer, uint256 hatId) view returns (bool)'];
const FAUCET_SBT_GATE_ABI = [
  'function hasPasswordMint() view returns (bool)',
  'function isPasswordValid(bytes32 hashedPassword) view returns (bool)',
  'function groupPasswordHash() view returns (bytes32)',
];

const TOKEN_TTL_SECONDS = 60 * 60 * 4;
const NONCE_TTL_SECONDS = 60 * 5;
const NONCE_RATE_LIMIT_MAX = 5;
const NONCE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const NONCE_RATE_LIMIT_TTL_SECONDS = 60;
const USED_NONCE_TTL_SECONDS = 60 * 10;
const LOGIN_SIWE_MAX_AGE_MS = 5 * 60 * 1000;
const LOGIN_SIWE_FUTURE_SKEW_MS = 60 * 1000;
const DEFAULT_FAUCET_RPC_URL = getPathRpcUrl(11155420) || '';
const DEFAULT_FAUCET_AMOUNT_ETH = '0.0002';
const DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH = '0.001';
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;

const SESSION_CONFIG_NOT_FOUND_ERROR = 'Session config not found.';
const BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR =
  'Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.';

const RESOURCE_GATE_KEYS = ['default', 'ai', 'arweave', 'txGas', 'rpc', 'lit'];
const ANONYMOUS_RATE_ID_HEADER = 'X-Anonymous-Client-Id';
const ANONYMOUS_GATE_UNAVAILABLE_ERROR = 'Access denied: on-chain gate data unavailable.';
const ANONYMOUS_ROUTE_DENIED_ERROR =
  'Anonymous access denied: AI/transcribe require open default+ai gates or a request apiKey.';
const ANONYMOUS_SCOPE_DISABLED_ERROR = 'Anonymous access denied: route scope disabled in session config.';
const ANONYMOUS_UNKNOWN_IDENTITY = 'anon:unknown';

const defaultWorkerOverrides = Object.freeze({
  ethers,
  URL,
  Headers,
  log,
  fetch: (...args) => fetch(...args),
  rpcFetch: (...args) => globalThis.fetch(...args),
  now: Date.now,
});

export const createWorkerRuntime = (env, overrides = {}) => {
  const deps = { ...defaultWorkerOverrides, ...overrides };
  const constants = {
    OPENAI_TRANSCRIBE_URL: resolveOpenAiTranscribeUrl({ env }),
    SESSION_REGISTRY_ABI,
    ERC721_ABI,
    SBT_ADMIN_ABI,
    HATS_ABI,
    FAUCET_SBT_GATE_ABI,
    TOKEN_TTL_SECONDS,
    NONCE_TTL_SECONDS,
    NONCE_RATE_LIMIT_MAX,
    NONCE_RATE_LIMIT_WINDOW_MS,
    NONCE_RATE_LIMIT_TTL_SECONDS,
    USED_NONCE_TTL_SECONDS,
    LOGIN_SIWE_MAX_AGE_MS,
    LOGIN_SIWE_FUTURE_SKEW_MS,
    ZERO_BYTES32,
    RESOURCE_GATE_KEYS,
    ANONYMOUS_RATE_ID_HEADER,
    ANONYMOUS_GATE_UNAVAILABLE_ERROR,
    ANONYMOUS_ROUTE_DENIED_ERROR,
    ANONYMOUS_SCOPE_DISABLED_ERROR,
    SESSION_CONFIG_NOT_FOUND_ERROR,
    BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR,
  };
  const runtimeDeps = {
    ethers: deps.ethers,
    URL: deps.URL,
    Headers: deps.Headers,
    log: deps.log,
    fetch: deps.fetch,
    rpcFetch: deps.rpcFetch,
    now: deps.now,
  };
  const resolved = (deps.resolveWorkerRuntimeDeps || resolveWorkerRuntimeDeps)({
    deps: runtimeDeps,
    constants,
  }) || {};
  const resolvedDeps = { ...resolved.deps, ...overrides };
  const defaults = {
    DEFAULT_FAUCET_RPC_URL,
    DEFAULT_FAUCET_AMOUNT_ETH,
    DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH,
  };
  const workerLowLevelHelpers = (
    resolvedDeps.createWorkerLowLevelHelpersWithWorkerDeps || createWorkerLowLevelHelpersWithWorkerDeps
  )({
    deps: {
      ethers: resolvedDeps.ethers,
      toStr: resolvedDeps.toStr,
      URL: resolvedDeps.URL,
      Headers: resolvedDeps.Headers,
      normalizeWorkerSessionSlug: resolvedDeps.normalizeWorkerSessionSlug,
      normalizeRpcUrlList: resolvedDeps.normalizeRpcUrlList,
      mergeRpcUrlLists: resolvedDeps.mergeRpcUrlLists,
      toChainId: resolvedDeps.toChainId,
      log: resolvedDeps.log,
      fetch: resolvedDeps.fetch,
      rpcFetch: resolvedDeps.rpcFetch,
      now: resolvedDeps.now,
    },
    constants: {
      zeroBytes32: resolved.constants.ZERO_BYTES32,
      sessionRegistryAbi: resolved.constants.SESSION_REGISTRY_ABI,
      erc721Abi: resolved.constants.ERC721_ABI,
      sbtAdminAbi: resolved.constants.SBT_ADMIN_ABI,
      hatsAbi: resolved.constants.HATS_ABI,
      faucetSbtGateAbi: resolved.constants.FAUCET_SBT_GATE_ABI,
    },
    defaults: {
      defaultFaucetRpcUrl: defaults.DEFAULT_FAUCET_RPC_URL,
    },
  });
  const workerRouteRuntime = (
    resolvedDeps.createWorkerRouteRuntimeWithWorkerDeps || createWorkerRouteRuntimeWithWorkerDeps
  )({
    deps: {
      log: resolvedDeps.log,
      fetch: resolvedDeps.fetch,
      toStr: resolvedDeps.toStr,
      now: resolvedDeps.now,
      parseAllowOrigins: resolvedDeps.parseAllowOrigins,
      originAllowed: resolvedDeps.originAllowed,
      corsHeaders: resolvedDeps.corsHeaders,
      json: resolvedDeps.json,
      normalizeWorkerSessionSlug: resolvedDeps.normalizeWorkerSessionSlug,
      getSessionConfig: resolvedDeps.getSessionConfig,
      verifyToken: resolvedDeps.verifyToken,
      validateAuthTokenRecord: resolvedDeps.validateAuthTokenRecord,
      resolveWorkerRequestSlugContext: resolvedDeps.resolveWorkerRequestSlugContext,
      toChainId: resolvedDeps.toChainId,
      normalizeRpcUrlList: resolvedDeps.normalizeRpcUrlList,
      ...workerLowLevelHelpers,
      readTranscribeRequestPayload: resolvedDeps.readTranscribeRequestPayload,
      Wallet: resolvedDeps.ethers?.Wallet,
      normalizeSignedWorkerRequest: resolvedDeps.normalizeSignedWorkerRequest,
      resolveWorkerBodySlugContext: resolvedDeps.resolveWorkerBodySlugContext,
      validateRecoveredAddressMatchesRequest: resolvedDeps.validateRecoveredAddressMatchesRequest,
      parseSiweMessage: resolvedDeps.parseSiweMessage,
      validateSiwe: resolvedDeps.validateSiwe,
      validateTrustedLoginRequestOrigin: resolvedDeps.validateTrustedLoginRequestOrigin,
      validateBrowserLoginOrigin: resolvedDeps.validateBrowserLoginOrigin,
      resolveTrustedAdminOrigins: resolvedDeps.resolveTrustedAdminOrigins,
      validateSiweAddressMatchesRequest: resolvedDeps.validateSiweAddressMatchesRequest,
      consumeNonce: resolvedDeps.consumeNonce,
      ...(resolvedDeps.recordAbuseEvent ? { recordAbuseEvent: resolvedDeps.recordAbuseEvent } : {}),
      ...(resolvedDeps.readAbuseCounterSummary
        ? { readAbuseCounterSummary: resolvedDeps.readAbuseCounterSummary }
        : {}),
      buildNonce: resolvedDeps.buildNonce,
      checkNonceRateLimit: resolvedDeps.checkNonceRateLimit,
      base64UrlEncode: resolvedDeps.base64UrlEncode,
      signToken: resolvedDeps.signToken,
      buildAuthTokenJti: resolvedDeps.buildAuthTokenJti,
      persistAuthTokenRecord: resolvedDeps.persistAuthTokenRecord,
      readArweaveBootstrapUploadPayload: resolvedDeps.readArweaveBootstrapUploadPayload,
      getSessionSecrets: resolvedDeps.getSessionSecrets,
      mergeWorkerConfigRecords: resolvedDeps.mergeWorkerConfigRecords,
      mergeWorkerLimitRecords: resolvedDeps.mergeWorkerLimitRecords,
      putSessionConfig: resolvedDeps.putSessionConfig,
      normalizeSecretValue: resolvedDeps.normalizeSecretValue,
      putSessionSecrets: resolvedDeps.putSessionSecrets,
      dispatchAnonymousRoute: resolvedDeps.dispatchAnonymousRoute,
      storageRoute: resolvedDeps.storageRoute,
      readAiRequestPayload: resolvedDeps.readAiRequestPayload,
      validateAnonymousAiRequest: resolvedDeps.validateAnonymousAiRequest,
      dispatchAuthenticatedRoute: resolvedDeps.dispatchAuthenticatedRoute,
      dispatchAuthenticatedSecretPathRoute: resolvedDeps.dispatchAuthenticatedSecretPathRoute,
      readAuthenticatedActionPayload: resolvedDeps.readAuthenticatedActionPayload,
      dispatchAuthenticatedNonSecretActionRoute: resolvedDeps.dispatchAuthenticatedNonSecretActionRoute,
      dispatchAuthenticatedSecretActionRoute: resolvedDeps.dispatchAuthenticatedSecretActionRoute,
      evaluateAuthenticatedRoutePreflight: resolvedDeps.evaluateAuthenticatedRoutePreflight,
      resolveAuthenticatedRouteSecrets: resolvedDeps.resolveAuthenticatedRouteSecrets,
      normalizeAiRequestPayload: resolvedDeps.normalizeAiRequestPayload,
    },
    constants: {
      resourceGateKeys: resolved.constants.RESOURCE_GATE_KEYS,
      anonymousRateIdHeader: resolved.constants.ANONYMOUS_RATE_ID_HEADER,
      anonymousGateUnavailableError: resolved.constants.ANONYMOUS_GATE_UNAVAILABLE_ERROR,
      missingSlugError: resolved.constants.MISSING_SLUG_ERROR,
      anonymousRouteDeniedError: resolved.constants.ANONYMOUS_ROUTE_DENIED_ERROR,
      anonymousScopeDisabledError: resolved.constants.ANONYMOUS_SCOPE_DISABLED_ERROR,
      anonymousUnknownIdentity: ANONYMOUS_UNKNOWN_IDENTITY,
      openAiTranscribeUrl: resolved.constants.OPENAI_TRANSCRIBE_URL,
      zeroBytes32: resolved.constants.ZERO_BYTES32,
      slugAliasMismatchError: resolved.constants.SLUG_ALIAS_MISMATCH_ERROR,
      slugMismatchError: resolved.constants.SLUG_MISMATCH_ERROR,
      nonceTtlSeconds: resolved.constants.NONCE_TTL_SECONDS,
      nonceRateLimitMax: resolved.constants.NONCE_RATE_LIMIT_MAX,
      nonceRateLimitWindowMs: resolved.constants.NONCE_RATE_LIMIT_WINDOW_MS,
      nonceRateLimitTtlSeconds: resolved.constants.NONCE_RATE_LIMIT_TTL_SECONDS,
      usedNonceTtlSeconds: resolved.constants.USED_NONCE_TTL_SECONDS,
      loginSiweMaxAgeMs: resolved.constants.LOGIN_SIWE_MAX_AGE_MS,
      loginSiweFutureSkewMs: resolved.constants.LOGIN_SIWE_FUTURE_SKEW_MS,
      tokenTtlSeconds: resolved.constants.TOKEN_TTL_SECONDS,
      sessionConfigNotFoundError: resolved.constants.SESSION_CONFIG_NOT_FOUND_ERROR,
      bootstrapSessionConfigRequiredError: resolved.constants.BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR,
    },
    defaults: {
      defaultRpcUrl: defaults.DEFAULT_FAUCET_RPC_URL,
      defaultAmountEth: defaults.DEFAULT_FAUCET_AMOUNT_ETH,
      defaultThresholdEth: defaults.DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH,
    },
  });
  const runtime = {
    workerLowLevelHelpers,
    workerRouteRuntime,
    workerAuthGateUtils: workerRouteRuntime.workerAuthGateUtils,
    fetch: workerRouteRuntime.fetch,
  };

  return Object.freeze(runtime);
};

const defaultWorkerRuntime = createWorkerRuntime();

export const workerAuthGateUtils = defaultWorkerRuntime.workerAuthGateUtils;

export default {
  fetch(request, env, ctx) {
    initializeWorkerDebugLogs(env);
    const workerRuntime = createWorkerRuntime(env);
    return workerRuntime.fetch(request, env, ctx);
  },
};
