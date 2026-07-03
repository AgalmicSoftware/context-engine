import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkerRuntimeInputWithWorkerDeps } from './workerRuntimeInputBinding.js';

test('createWorkerRuntimeInputWithWorkerDeps returns the expected runtime export contract', () => {
  const workerLowLevelHelpers = { id: 'workerLowLevelHelpers' };
  const workerRouteRuntime = {
    workerAuthGateUtils: { id: 'workerAuthGateUtils' },
    fetch: 'fetch',
  };

  const runtime = createWorkerRuntimeInputWithWorkerDeps({
    deps: {
      createWorkerLowLevelHelpersWithWorkerDeps: () => workerLowLevelHelpers,
      createWorkerRouteRuntimeWithWorkerDeps: () => workerRouteRuntime,
    },
  });

  assert.equal(runtime.workerLowLevelHelpers, workerLowLevelHelpers);
  assert.equal(runtime.workerRouteRuntime, workerRouteRuntime);
  assert.equal(runtime.workerAuthGateUtils, workerRouteRuntime.workerAuthGateUtils);
  assert.equal(runtime.fetch, workerRouteRuntime.fetch);
});

test('createWorkerRuntimeInputWithWorkerDeps preserves worker-local runtime assembly bundles', () => {
  const log = () => {};
  const fetch = () => {};
  const rpcFetch = () => {};
  const now = () => 1234567890;
  const walletCtor = function Wallet() {};

  const workerLowLevelHelpers = {
    isBlockedOutboundUrl: 'isBlockedOutboundUrl',
    safeFetch: 'safeFetch',
    normalizeSessionIdHex: 'normalizeSessionIdHex',
    toBigInt: 'toBigInt',
    isAddress: 'isAddress',
    getAddress: 'getAddress',
    verifyMessage: 'verifyMessage',
    getBytes: 'getBytes',
    solidityKeccak256: 'solidityKeccak256',
    parseEther: 'parseEther',
    formatEther: 'formatEther',
    toRegistrySessionSlug: 'toRegistrySessionSlug',
    resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
    resolveRegistryRpcUrl: 'resolveRegistryRpcUrl',
    resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
    resolveFaucetRpcUrls: 'resolveFaucetRpcUrls',
    isBytes32Hex: 'isBytes32Hex',
    getRegistryInterface: 'getRegistryInterface',
    getErc721Interface: 'getErc721Interface',
    getSbtAdminInterface: 'getSbtAdminInterface',
    getHatsInterface: 'getHatsInterface',
    getFaucetSbtGateInterface: 'getFaucetSbtGateInterface',
    isPositiveBalance: 'isPositiveBalance',
    checkSbtGate: 'checkSbtGate',
    normalizeAddressLower: 'normalizeAddressLower',
    verifyGroupSignatureForFaucet: 'verifyGroupSignatureForFaucet',
    maskRpcUrl: 'maskRpcUrl',
    rpcRequest: 'rpcRequest',
    callContractFunction: 'callContractFunction',
    callRegistryFunction: 'callRegistryFunction',
    probeRpcUrls: 'probeRpcUrls',
  };
  const resolvedRouteRuntimeInput = {
    deps: { id: 'route-runtime-deps' },
    constants: { id: 'route-runtime-constants' },
    defaults: { id: 'route-runtime-defaults' },
  };

  const runtime = createWorkerRuntimeInputWithWorkerDeps({
    deps: {
      createWorkerLowLevelHelpersWithWorkerDeps: (value) => {
        assert.deepEqual(value, {
          deps: {
            ethers: { Wallet: walletCtor },
            toStr: 'toStr',
            URL: 'URL',
            Headers: 'Headers',
            normalizeWorkerSessionSlug: 'normalizeWorkerSessionSlug',
            normalizeRpcUrlList: 'normalizeRpcUrlList',
            mergeRpcUrlLists: 'mergeRpcUrlLists',
            toChainId: 'toChainId',
            log,
            fetch,
            rpcFetch,
            now,
          },
          constants: {
            zeroBytes32: 'zeroBytes32',
            sessionRegistryAbi: ['registry'],
            erc721Abi: ['erc721'],
            sbtAdminAbi: ['sbtAdmin'],
            hatsAbi: ['hats'],
            faucetSbtGateAbi: ['faucet'],
          },
          defaults: {
            defaultFaucetRpcUrl: 'defaultFaucetRpcUrl',
          },
        });
        return workerLowLevelHelpers;
      },
      resolveWorkerRouteRuntimeInput: (value) => {
        assert.deepEqual(value, {
          deps: {
            createWorkerLowLevelHelpersWithWorkerDeps: value.deps.createWorkerLowLevelHelpersWithWorkerDeps,
            resolveWorkerRouteRuntimeInput: value.deps.resolveWorkerRouteRuntimeInput,
            createWorkerRouteRuntimeWithWorkerDeps: value.deps.createWorkerRouteRuntimeWithWorkerDeps,
            ethers: { Wallet: walletCtor },
            toStr: 'toStr',
            URL: 'URL',
            Headers: 'Headers',
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
            validateSiwe: 'validateSiwe',
            validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
            consumeNonce: 'consumeNonce',
            buildNonce: 'buildNonce',
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
            log,
            fetch,
            rpcFetch,
            now,
          },
          constants: {
            OPENAI_TRANSCRIBE_URL: 'https://api.openai.example/v1/audio/transcriptions',
            SESSION_REGISTRY_ABI: ['registry'],
            ERC721_ABI: ['erc721'],
            SBT_ADMIN_ABI: ['sbtAdmin'],
            HATS_ABI: ['hats'],
            FAUCET_SBT_GATE_ABI: ['faucet'],
            TOKEN_TTL_SECONDS: 86400,
            NONCE_TTL_SECONDS: 300,
            USED_NONCE_TTL_SECONDS: 600,
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
          },
          defaults: {
            DEFAULT_FAUCET_RPC_URL: 'defaultFaucetRpcUrl',
            DEFAULT_FAUCET_AMOUNT_ETH: 'defaultAmountEth',
            DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH: 'defaultThresholdEth',
          },
          workerLowLevelHelpers,
          anonymousUnknownIdentity: 'anon:unknown',
        });
        return resolvedRouteRuntimeInput;
      },
      createWorkerRouteRuntimeWithWorkerDeps: (value) => {
        assert.deepEqual(value, resolvedRouteRuntimeInput);
        return {
          workerAuthGateUtils: {
            computeScopesForLogin: 'computeScopesForLogin',
            evaluateAnonymousRouteAccess: 'evaluateAnonymousRouteAccess',
            resolveAnonymousRateIdentity: 'resolveAnonymousRateIdentity',
          },
          fetch: 'fetch',
        };
      },
      ethers: { Wallet: walletCtor },
      toStr: 'toStr',
      URL: 'URL',
      Headers: 'Headers',
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
      validateSiwe: 'validateSiwe',
      validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
      consumeNonce: 'consumeNonce',
      buildNonce: 'buildNonce',
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
      log,
      fetch,
      rpcFetch,
      now,
    },
    constants: {
      OPENAI_TRANSCRIBE_URL: 'https://api.openai.example/v1/audio/transcriptions',
      SESSION_REGISTRY_ABI: ['registry'],
      ERC721_ABI: ['erc721'],
      SBT_ADMIN_ABI: ['sbtAdmin'],
      HATS_ABI: ['hats'],
      FAUCET_SBT_GATE_ABI: ['faucet'],
      TOKEN_TTL_SECONDS: 86400,
      NONCE_TTL_SECONDS: 300,
      USED_NONCE_TTL_SECONDS: 600,
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
    },
    defaults: {
      DEFAULT_FAUCET_RPC_URL: 'defaultFaucetRpcUrl',
      DEFAULT_FAUCET_AMOUNT_ETH: 'defaultAmountEth',
      DEFAULT_FAUCET_BALANCE_THRESHOLD_ETH: 'defaultThresholdEth',
    },
  });

  assert.deepEqual(runtime.workerLowLevelHelpers, workerLowLevelHelpers);
  assert.deepEqual(runtime.workerAuthGateUtils, {
    computeScopesForLogin: 'computeScopesForLogin',
    evaluateAnonymousRouteAccess: 'evaluateAnonymousRouteAccess',
    resolveAnonymousRateIdentity: 'resolveAnonymousRateIdentity',
  });
  assert.equal(runtime.fetch, 'fetch');
});
