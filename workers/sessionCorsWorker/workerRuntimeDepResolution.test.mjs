import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveWorkerRuntimeDeps,
} from './workerRuntimeDepResolution.js';

test('resolveWorkerRuntimeDeps preserves worker-local and imported dependency wiring', () => {
  const deps = {
    ethers: 'ethers',
    URL: 'URL',
    Headers: 'Headers',
    log: 'log',
    fetch: 'fetch',
    rpcFetch: 'rpcFetch',
    now: 'now',
    toStr: 'toStr',
    normalizeWorkerSessionSlug: 'normalizeWorkerSessionSlug',
    normalizeRpcUrlList: 'normalizeRpcUrlList',
    mergeRpcUrlLists: 'mergeRpcUrlLists',
    toChainId: 'toChainId',
    parseAllowOrigins: 'parseAllowOrigins',
    originAllowed: 'originAllowed',
    corsHeaders: 'corsHeaders',
    json: 'json',
    getSessionConfig: 'getSessionConfig',
    verifyToken: 'verifyToken',
    validateAuthTokenRecord: 'validateAuthTokenRecord',
    resolveWorkerRequestSlugContext: 'resolveWorkerRequestSlugContext',
    readTranscribeRequestPayload: 'readTranscribeRequestPayload',
    normalizeFaucetRequest: 'normalizeFaucetRequest',
    validateFaucetEligibilityRequest: 'validateFaucetEligibilityRequest',
    normalizeFetchTargetUrl: 'normalizeFetchTargetUrl',
    readArweaveUploadRequestPayload: 'readArweaveUploadRequestPayload',
    resolveArweaveUploadJwk: 'resolveArweaveUploadJwk',
    normalizeArweaveCeTags: 'normalizeArweaveCeTags',
    normalizeArweaveAssociationTags: 'normalizeArweaveAssociationTags',
    normalizeSignedWorkerRequest: 'normalizeSignedWorkerRequest',
    resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
    validateRecoveredAddressMatchesRequest: 'validateRecoveredAddressMatchesRequest',
    parseSiweMessage: 'parseSiweMessage',
    resolveTrustedAdminOrigins: 'resolveTrustedAdminOrigins',
    validateSiwe: 'validateSiwe',
    validateTrustedLoginRequestOrigin: 'validateTrustedLoginRequestOrigin',
    validateBrowserLoginOrigin: 'validateBrowserLoginOrigin',
    validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
    buildNonce: 'buildNonce',
    checkNonceRateLimit: 'checkNonceRateLimit',
    consumeNonce: 'consumeNonce',
    recordAbuseEvent: 'recordAbuseEvent',
    readAbuseCounterSummary: 'readAbuseCounterSummary',
    base64UrlEncode: 'base64UrlEncode',
    signToken: 'signToken',
    buildAuthTokenJti: 'buildAuthTokenJti',
    persistAuthTokenRecord: 'persistAuthTokenRecord',
    readArweaveBootstrapUploadPayload: 'readArweaveBootstrapUploadPayload',
    getSessionSecrets: 'getSessionSecrets',
    mergeWorkerConfigRecords: 'mergeWorkerConfigRecords',
    mergeWorkerLimitRecords: 'mergeWorkerLimitRecords',
    putSessionConfig: 'putSessionConfig',
    normalizeSecretValue: 'normalizeSecretValue',
    putSessionSecrets: 'putSessionSecrets',
    dispatchAnonymousRoute: 'dispatchAnonymousRoute',
    readAiRequestPayload: 'readAiRequestPayload',
    validateAnonymousAiRequest: 'validateAnonymousAiRequest',
    dispatchAuthenticatedRoute: 'dispatchAuthenticatedRoute',
    dispatchAuthenticatedSecretPathRoute: 'dispatchAuthenticatedSecretPathRoute',
    readAuthenticatedActionPayload: 'readAuthenticatedActionPayload',
    dispatchAuthenticatedNonSecretActionRoute: 'dispatchAuthenticatedNonSecretActionRoute',
    dispatchAuthenticatedSecretActionRoute: 'dispatchAuthenticatedSecretActionRoute',
    evaluateAuthenticatedRoutePreflight: 'evaluateAuthenticatedRoutePreflight',
    resolveAuthenticatedRouteSecrets: 'resolveAuthenticatedRouteSecrets',
    normalizeAiRequestPayload: 'normalizeAiRequestPayload',
  };

  const constants = {
    OPENAI_TRANSCRIBE_URL: 'openAiTranscribeUrl',
    SESSION_REGISTRY_ABI: ['registry'],
    ERC721_ABI: ['erc721'],
    SBT_ADMIN_ABI: ['sbtAdmin'],
    HATS_ABI: ['hats'],
    FAUCET_SBT_GATE_ABI: ['faucet'],
    TOKEN_TTL_SECONDS: 86400,
    NONCE_TTL_SECONDS: 300,
    NONCE_RATE_LIMIT_MAX: 5,
    NONCE_RATE_LIMIT_WINDOW_MS: 60000,
    NONCE_RATE_LIMIT_TTL_SECONDS: 60,
    USED_NONCE_TTL_SECONDS: 600,
    LOGIN_SIWE_MAX_AGE_MS: 300000,
    LOGIN_SIWE_FUTURE_SKEW_MS: 60000,
    ZERO_BYTES32: 'zeroBytes32',
    RESOURCE_GATE_KEYS: ['default', 'ai', 'arweave'],
    ANONYMOUS_RATE_ID_HEADER: 'X-Anonymous-Client-Id',
    ANONYMOUS_GATE_UNAVAILABLE_ERROR: 'anonymousGateUnavailableError',
    ANONYMOUS_ROUTE_DENIED_ERROR: 'anonymousRouteDeniedError',
    ANONYMOUS_SCOPE_DISABLED_ERROR: 'anonymousScopeDisabledError',
    SESSION_CONFIG_NOT_FOUND_ERROR: 'sessionConfigNotFoundError',
    BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR: 'bootstrapSessionConfigRequiredError',
    MISSING_SLUG_ERROR: 'missingSlugError',
    SLUG_ALIAS_MISMATCH_ERROR: 'slugAliasMismatchError',
    SLUG_MISMATCH_ERROR: 'slugMismatchError',
  };

  assert.deepEqual(
    resolveWorkerRuntimeDeps({ deps, constants }),
    {
      deps,
      constants,
    },
  );
});

test('resolveWorkerRuntimeDeps preserves missing-slug and slug-mismatch constant fallbacks', () => {
  const result = resolveWorkerRuntimeDeps({
    deps: {},
    constants: {
      OPENAI_TRANSCRIBE_URL: 'openAiTranscribeUrl',
      SESSION_REGISTRY_ABI: ['registry'],
      ERC721_ABI: ['erc721'],
      SBT_ADMIN_ABI: ['sbtAdmin'],
      HATS_ABI: ['hats'],
      FAUCET_SBT_GATE_ABI: ['faucet'],
      TOKEN_TTL_SECONDS: 86400,
      NONCE_TTL_SECONDS: 300,
      NONCE_RATE_LIMIT_MAX: 5,
      NONCE_RATE_LIMIT_WINDOW_MS: 60000,
      NONCE_RATE_LIMIT_TTL_SECONDS: 60,
      USED_NONCE_TTL_SECONDS: 600,
      LOGIN_SIWE_MAX_AGE_MS: 300000,
      LOGIN_SIWE_FUTURE_SKEW_MS: 60000,
      ZERO_BYTES32: 'zeroBytes32',
      RESOURCE_GATE_KEYS: ['default', 'ai', 'arweave'],
      ANONYMOUS_RATE_ID_HEADER: 'X-Anonymous-Client-Id',
      ANONYMOUS_GATE_UNAVAILABLE_ERROR: 'anonymousGateUnavailableError',
      ANONYMOUS_ROUTE_DENIED_ERROR: 'anonymousRouteDeniedError',
      ANONYMOUS_SCOPE_DISABLED_ERROR: 'anonymousScopeDisabledError',
      SESSION_CONFIG_NOT_FOUND_ERROR: 'sessionConfigNotFoundError',
      BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR: 'bootstrapSessionConfigRequiredError',
    },
  });

  assert.equal(
    result.constants.MISSING_SLUG_ERROR,
    'Missing sessionSlug.',
  );
  assert.equal(
    result.constants.SLUG_ALIAS_MISMATCH_ERROR,
    'sessionSlug aliases do not match.',
  );
  assert.equal(
    result.constants.SLUG_MISMATCH_ERROR,
    'sessionSlug does not match worker session.',
  );
});
