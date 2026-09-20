import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkerRouteRuntimeWithWorkerDeps } from './workerRouteRuntimeBinding.js';
import { createWorkerRuntime } from './worker.js';

test('createWorkerRouteRuntimeWithWorkerDeps returns the expected runtime contract', () => {
  const runtime = createWorkerRouteRuntimeWithWorkerDeps({
    deps: {
      createRegistryLoginBootstrapAdaptersWithWorkerDeps: () => ({
        computeScopesForLogin: 'computeScopesForLogin',
        readSessionExistsOnChain: 'readSessionExistsOnChain',
        readSessionBySlugOnChain: 'readSessionBySlugOnChain',
        validateBootstrapAdmin: 'validateBootstrapAdmin',
        readResourceGateOnChain: 'readResourceGateOnChain',
        readRegistryCodeOnChain: 'readRegistryCodeOnChain',
      }),
      createRateLimitFaucetSupportWithWorkerDeps: () => ({
        checkRateLimit: 'checkRateLimit',
        findSessionGateForSbt: 'findSessionGateForSbt',
        readSbtFaucetValidationState: 'readSbtFaucetValidationState',
        validateSbtPasswordForFaucet: 'validateSbtPasswordForFaucet',
      }),
      createAnonymousRegistrySupportAdaptersWithWorkerDeps: () => ({
        resolveRequestSlugWithoutToken: 'resolveRequestSlugWithoutToken',
        evaluateAnonymousRouteAccess: 'evaluateAnonymousRouteAccess',
        resolveAnonymousRateIdentity: 'resolveAnonymousRateIdentity',
      }),
      createAuthCorsAdminAdaptersWithWorkerDeps: () => ({
        getCorsContext: 'getCorsContext',
        resolveExistingSessionCors: 'resolveExistingSessionCors',
        requireAuth: 'requireAuth',
        validateAdmin: 'validateAdmin',
      }),
      createWorkerExecutionServicesWithWorkerDeps: () => ({
        proxyAnthropic: 'proxyAnthropic',
        proxyOpenAI: 'proxyOpenAI',
        proxyOpenRouter: 'proxyOpenRouter',
        proxyCustomRPC: 'proxyCustomRPC',
        transcribe: 'transcribe',
        faucet: 'faucet',
        fetchImage: 'fetchImage',
        fetchUrl: 'fetchUrl',
        arweaveUpload: 'arweaveUpload',
        storageRoute: 'storageRoute',
        verifyAdminSignature: 'verifyAdminSignature',
      }),
      createWorkerRouteShellWithWorkerDeps: () => ({
        fetch: 'fetch',
      }),
    },
  });

  assert.deepEqual(runtime.workerAuthGateUtils, {
    computeScopesForLogin: 'computeScopesForLogin',
    evaluateAnonymousRouteAccess: 'evaluateAnonymousRouteAccess',
    resolveAnonymousRateIdentity: 'resolveAnonymousRateIdentity',
  });
  assert.equal(runtime.fetch, 'fetch');
});

test('createWorkerRouteRuntimeWithWorkerDeps preserves route runtime assembly bundles', () => {
  const calls = [];
  const log = () => {};
  const now = () => 1234567890;

  const runtime = createWorkerRouteRuntimeWithWorkerDeps({
    deps: {
      createRegistryLoginBootstrapAdaptersWithWorkerDeps: (value) => {
        calls.push('registry');
        assert.deepEqual(value, {
          deps: {
            callRegistryFunction: 'callRegistryFunction',
            rpcRequest: 'rpcRequest',
            maskRpcUrl: 'maskRpcUrl',
            toStr: 'toStr',
            isAddress: 'isAddress',
            toChainId: 'toChainId',
            normalizeRpcUrlList: 'normalizeRpcUrlList',
            resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
            resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
            toRegistrySessionSlug: 'toRegistrySessionSlug',
            checkSbtGate: 'checkSbtGate',
            probeRpcUrls: 'probeRpcUrls',
          },
          constants: {
            resourceGateKeys: ['default', 'ai', 'arweave'],
          },
        });
        return {
          computeScopesForLogin: 'computeScopesForLogin',
          readSessionExistsOnChain: 'readSessionExistsOnChain',
          readSessionBySlugOnChain: 'readSessionBySlugOnChain',
          validateBootstrapAdmin: 'validateBootstrapAdmin',
          readResourceGateOnChain: 'readResourceGateOnChain',
          readRegistryCodeOnChain: 'readRegistryCodeOnChain',
        };
      },
      createRateLimitFaucetSupportWithWorkerDeps: (value) => {
        calls.push('rateLimit');
        assert.deepEqual(value, {
          deps: {
            toStr: 'toStr',
            now,
            isAddress: 'isAddress',
            resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
            normalizeAddressLower: 'normalizeAddressLower',
            toRegistrySessionSlug: 'toRegistrySessionSlug',
            readSessionExistsOnChain: 'readSessionExistsOnChain',
            maskRpcUrl: 'maskRpcUrl',
            readResourceGateOnChain: 'readResourceGateOnChain',
            resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
            toChainId: 'toChainId',
            rpcRequest: 'rpcRequest',
            getFaucetSbtGateInterface: 'getFaucetSbtGateInterface',
            callContractFunction: 'callContractFunction',
          },
          constants: {
            anonymousGateUnavailableError: 'anonymousGateUnavailableError',
            resourceGateKeys: ['default', 'ai', 'arweave'],
            zeroBytes32: 'zeroBytes32',
          },
        });
        return {
          checkRateLimit: 'checkRateLimit',
          findSessionGateForSbt: 'findSessionGateForSbt',
          readSbtFaucetValidationState: 'readSbtFaucetValidationState',
          validateSbtPasswordForFaucet: 'validateSbtPasswordForFaucet',
        };
      },
      createAnonymousRegistrySupportAdaptersWithWorkerDeps: (value) => {
        calls.push('anonymous');
        assert.deepEqual(value, {
          deps: {
            resolveWorkerRequestSlugContext: 'resolveWorkerRequestSlugContext',
            toStr: 'toStr',
            isAddress: 'isAddress',
            resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
            toRegistrySessionSlug: 'toRegistrySessionSlug',
            maskRpcUrl: 'maskRpcUrl',
            readSessionExistsOnChain: 'readSessionExistsOnChain',
            readResourceGateOnChain: 'readResourceGateOnChain',
          },
          constants: {
            anonymousGateUnavailableError: 'anonymousGateUnavailableError',
            anonymousRouteDeniedError: 'anonymousRouteDeniedError',
            anonymousScopeDisabledError: 'anonymousScopeDisabledError',
            anonymousRateIdHeader: 'X-Anonymous-Client-Id',
            anonymousUnknownIdentity: 'anon:unknown',
          },
        });
        return {
          resolveRequestSlugWithoutToken: 'resolveRequestSlugWithoutToken',
          evaluateAnonymousRouteAccess: 'evaluateAnonymousRouteAccess',
          resolveAnonymousRateIdentity: 'resolveAnonymousRateIdentity',
        };
      },
      createAuthCorsAdminAdaptersWithWorkerDeps: (value) => {
        calls.push('authCorsAdmin');
        assert.deepEqual(value, {
          deps: {
            parseAllowOrigins: 'parseAllowOrigins',
            originAllowed: 'originAllowed',
            corsHeaders: 'corsHeaders',
            json: 'json',
            normalizeWorkerSessionSlug: 'normalizeWorkerSessionSlug',
            getSessionConfig: 'getSessionConfig',
            resolveTrustedAdminOrigins: 'resolveTrustedAdminOrigins',
            verifyToken: 'verifyToken',
            validateAuthTokenRecord: 'validateAuthTokenRecord',
            resolveWorkerRequestSlugContext: 'resolveWorkerRequestSlugContext',
            toStr: 'toStr',
            isAddress: 'isAddress',
            resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
            rpcRequest: 'rpcRequest',
            toChainId: 'toChainId',
            getHatsInterface: 'getHatsInterface',
            callContractFunction: 'callContractFunction',
          },
          constants: {
            missingSlugError: 'missingSlugError',
          },
        });
        return {
          getCorsContext: 'getCorsContext',
          resolveExistingSessionCors: 'resolveExistingSessionCors',
          requireAuth: 'requireAuth',
          validateAdmin: 'validateAdmin',
        };
      },
      createWorkerExecutionServicesWithWorkerDeps: (value) => {
        calls.push('execution');
        assert.deepEqual(value.deps, {
          fetch: 'fetch',
          json: 'json',
          safeFetch: 'safeFetch',
          isBlockedOutboundUrl: 'isBlockedOutboundUrl',
          toStr: 'toStr',
          Wallet: 'Wallet',
          rpcRequest: 'rpcRequest',
          toChainId: 'toChainId',
          toBigInt: 'toBigInt',
          formatEther: 'formatEther',
          maskRpcUrl: 'maskRpcUrl',
          isAddress: 'isAddress',
          parseEther: 'parseEther',
          resolveFaucetRpcUrls: 'resolveFaucetRpcUrls',
          isBytes32Hex: 'isBytes32Hex',
          normalizeAddressLower: 'normalizeAddressLower',
          resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
          toRegistrySessionSlug: 'toRegistrySessionSlug',
          readSessionExistsOnChain: 'readSessionExistsOnChain',
          readResourceGateOnChain: 'readResourceGateOnChain',
          resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
          checkSbtGate: 'checkSbtGate',
          findSessionGateForSbt: 'findSessionGateForSbt',
          readSbtFaucetValidationState: 'readSbtFaucetValidationState',
          validateSbtPasswordForFaucet: 'validateSbtPasswordForFaucet',
          verifyGroupSignatureForFaucet: 'verifyGroupSignatureForFaucet',
          callContractFunction: 'callContractFunction',
          readSessionBySlugOnChain: 'readSessionBySlugOnChain',
          getErc721Interface: 'getErc721Interface',
          getSbtAdminInterface: 'getSbtAdminInterface',
          isPositiveBalance: 'isPositiveBalance',
          normalizeSessionIdHex: 'normalizeSessionIdHex',
          normalizeSignedWorkerRequest: 'normalizeSignedWorkerRequest',
          resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
          verifyMessage: 'verifyMessage',
          validateRecoveredAddressMatchesRequest: 'validateRecoveredAddressMatchesRequest',
          parseSiweMessage: 'parseSiweMessage',
          validateSiwe: 'validateSiwe',
          validateTrustedLoginRequestOrigin: 'validateTrustedLoginRequestOrigin',
          validateBrowserLoginOrigin: 'validateBrowserLoginOrigin',
          validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
          consumeNonce: 'consumeNonce',
          validateAdmin: 'validateAdmin',
          log,
          now,
          randomUUID: 'randomUUID',
          getSessionSecrets: 'getSessionSecrets',
          putSessionConfig: 'putSessionConfig',
          enqueueResultsAnalysisAutoJob: undefined,
          waitUntil: undefined,
        });
        assert.deepEqual(value.constants, {
          openAiTranscribeUrl: 'https://api.openai.example/v1/audio/transcriptions',
          anonymousGateUnavailableError: 'anonymousGateUnavailableError',
          zeroBytes32: 'zeroBytes32',
          usedNonceTtlSeconds: 600,
          missingSlugError: 'missingSlugError',
          slugAliasMismatchError: 'slugAliasMismatchError',
          slugMismatchError: 'slugMismatchError',
        });
        assert.deepEqual(value.defaults, {
          defaultRpcUrl: 'defaultRpcUrl',
          defaultAmountEth: 'defaultAmountEth',
          defaultThresholdEth: 'defaultThresholdEth',
        });
        return {
          proxyAnthropic: 'proxyAnthropic',
          proxyOpenAI: 'proxyOpenAI',
          proxyOpenRouter: 'proxyOpenRouter',
          proxyCustomRPC: 'proxyCustomRPC',
          transcribe: 'transcribe',
          faucet: 'faucet',
          fetchImage: 'fetchImage',
          fetchUrl: 'fetchUrl',
          arweaveUpload: 'arweaveUpload',
          storageRoute: 'storageRoute',
          verifyAdminSignature: 'verifyAdminSignature',
        };
      },
      createWorkerRouteShellWithWorkerDeps: (value) => {
        calls.push('routeShell');
        assert.deepEqual(value.deps, {
          log,
          fetch: 'fetch',
          toStr: 'toStr',
          corsHeaders: 'corsHeaders',
          json: 'json',
          isAddress: 'isAddress',
          resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
          resolveExistingSessionCors: 'resolveExistingSessionCors',
          resolveTrustedAdminOrigins: 'resolveTrustedAdminOrigins',
          validateTrustedLoginRequestOrigin: 'validateTrustedLoginRequestOrigin',
          buildNonce: 'buildNonce',
          checkNonceRateLimit: 'checkNonceRateLimit',
          base64UrlEncode: 'base64UrlEncode',
          normalizeSignedWorkerRequest: 'normalizeSignedWorkerRequest',
          verifyMessage: 'verifyMessage',
          validateRecoveredAddressMatchesRequest: 'validateRecoveredAddressMatchesRequest',
          parseSiweMessage: 'parseSiweMessage',
          validateSiwe: 'validateSiwe',
          validateBrowserLoginOrigin: 'validateBrowserLoginOrigin',
          validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
          consumeNonce: 'consumeNonce',
          computeScopesForLogin: 'computeScopesForLogin',
          signToken: 'signToken',
          getAddress: 'getAddress',
          buildAuthTokenJti: 'buildAuthTokenJti',
          persistAuthTokenRecord: 'persistAuthTokenRecord',
          now,
          readArweaveBootstrapUploadPayload: 'readArweaveBootstrapUploadPayload',
          getSessionConfig: 'getSessionConfig',
          getCorsContext: 'getCorsContext',
          verifyAdminSignature: 'verifyAdminSignature',
          getSessionSecrets: 'getSessionSecrets',
          arweaveUpload: 'arweaveUpload',
          storageRoute: 'storageRoute',
          authorizeCloudflareStorageResourceRead: undefined,
          readPublishedResultsAnalysisArtifact: undefined,
          evaluateResultsAnalysisViewerEligibility: undefined,
          readResourceGateOnChain: 'readResourceGateOnChain',
          resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
          toRegistrySessionSlug: 'toRegistrySessionSlug',
          resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
          checkSbtGate: 'checkSbtGate',
          validateBootstrapAdmin: 'validateBootstrapAdmin',
          validateAdmin: 'validateAdmin',
          mergeWorkerConfigRecords: 'mergeWorkerConfigRecords',
          mergeWorkerLimitRecords: 'mergeWorkerLimitRecords',
          putSessionConfig: 'putSessionConfig',
          normalizeSecretValue: 'normalizeSecretValue',
          putSessionSecrets: 'putSessionSecrets',
          resolveRequestSlugWithoutToken: 'resolveRequestSlugWithoutToken',
          resolveAnonymousRateIdentity: 'resolveAnonymousRateIdentity',
          checkRateLimit: 'checkRateLimit',
          dispatchAnonymousRoute: 'dispatchAnonymousRoute',
          readTranscribeRequestPayload: 'readTranscribeRequestPayload',
          evaluateAnonymousRouteAccess: 'evaluateAnonymousRouteAccess',
          transcribe: 'transcribe',
          readAiRequestPayload: 'readAiRequestPayload',
          validateAnonymousAiRequest: 'validateAnonymousAiRequest',
          proxyAnthropic: 'proxyAnthropic',
          proxyOpenAI: 'proxyOpenAI',
          proxyOpenRouter: 'proxyOpenRouter',
          proxyCustomRPC: 'proxyCustomRPC',
          requireAuth: 'requireAuth',
          dispatchAuthenticatedRoute: 'dispatchAuthenticatedRoute',
          dispatchAuthenticatedSecretPathRoute: 'dispatchAuthenticatedSecretPathRoute',
          readAuthenticatedActionPayload: 'readAuthenticatedActionPayload',
          dispatchAuthenticatedNonSecretActionRoute: 'dispatchAuthenticatedNonSecretActionRoute',
          dispatchAuthenticatedSecretActionRoute: 'dispatchAuthenticatedSecretActionRoute',
          evaluateAuthenticatedRoutePreflight: 'evaluateAuthenticatedRoutePreflight',
          resolveAuthenticatedRouteSecrets: 'resolveAuthenticatedRouteSecrets',
          fetchImage: 'fetchImage',
          fetchUrl: 'fetchUrl',
          normalizeAiRequestPayload: 'normalizeAiRequestPayload',
          waitUntil: undefined,
          faucet: 'faucet',
        });
        assert.deepEqual(value.constants, {
          missingSlugError: 'missingSlugError',
          nonceTtlSeconds: 300,
          nonceRateLimitMax: 5,
          nonceSharedNetworkRateLimitMax: 300,
          nonceRateLimitWindowMs: 60000,
          nonceRateLimitTtlSeconds: 60,
          usedNonceTtlSeconds: 600,
          tokenTtlSeconds: 86400,
          loginSiweMaxAgeMs: 300000,
          loginSiweFutureSkewMs: 60000,
          sessionConfigNotFoundError: 'sessionConfigNotFoundError',
          bootstrapSessionConfigRequiredError: 'bootstrapSessionConfigRequiredError',
          anonymousRouteDeniedError: 'anonymousRouteDeniedError',
        });
        return {
          fetch: 'fetch',
        };
      },
      callRegistryFunction: 'callRegistryFunction',
      rpcRequest: 'rpcRequest',
      maskRpcUrl: 'maskRpcUrl',
      toStr: 'toStr',
      isAddress: 'isAddress',
      toChainId: 'toChainId',
      normalizeRpcUrlList: 'normalizeRpcUrlList',
      resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
      resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
      toRegistrySessionSlug: 'toRegistrySessionSlug',
      checkSbtGate: 'checkSbtGate',
      probeRpcUrls: 'probeRpcUrls',
      normalizeAddressLower: 'normalizeAddressLower',
      getFaucetSbtGateInterface: 'getFaucetSbtGateInterface',
      resolveWorkerRequestSlugContext: 'resolveWorkerRequestSlugContext',
      parseAllowOrigins: 'parseAllowOrigins',
      originAllowed: 'originAllowed',
      corsHeaders: 'corsHeaders',
      json: 'json',
      normalizeWorkerSessionSlug: 'normalizeWorkerSessionSlug',
      getSessionConfig: 'getSessionConfig',
      resolveTrustedAdminOrigins: 'resolveTrustedAdminOrigins',
      verifyToken: 'verifyToken',
      validateAuthTokenRecord: 'validateAuthTokenRecord',
      getHatsInterface: 'getHatsInterface',
      callContractFunction: 'callContractFunction',
      fetch: 'fetch',
      safeFetch: 'safeFetch',
      isBlockedOutboundUrl: 'isBlockedOutboundUrl',
      readTranscribeRequestPayload: 'readTranscribeRequestPayload',
      Wallet: 'Wallet',
      toBigInt: 'toBigInt',
      formatEther: 'formatEther',
      parseEther: 'parseEther',
      resolveFaucetRpcUrls: 'resolveFaucetRpcUrls',
      isBytes32Hex: 'isBytes32Hex',
      readSessionExistsOnChain: 'readSessionExistsOnChain',
      readResourceGateOnChain: 'readResourceGateOnChain',
      verifyGroupSignatureForFaucet: 'verifyGroupSignatureForFaucet',
      getErc721Interface: 'getErc721Interface',
      getSbtAdminInterface: 'getSbtAdminInterface',
      isPositiveBalance: 'isPositiveBalance',
      normalizeSessionIdHex: 'normalizeSessionIdHex',
      normalizeSignedWorkerRequest: 'normalizeSignedWorkerRequest',
      resolveWorkerBodySlugContext: 'resolveWorkerBodySlugContext',
      verifyMessage: 'verifyMessage',
      validateRecoveredAddressMatchesRequest: 'validateRecoveredAddressMatchesRequest',
      parseSiweMessage: 'parseSiweMessage',
      validateSiwe: 'validateSiwe',
      validateTrustedLoginRequestOrigin: 'validateTrustedLoginRequestOrigin',
      validateBrowserLoginOrigin: 'validateBrowserLoginOrigin',
      validateSiweAddressMatchesRequest: 'validateSiweAddressMatchesRequest',
      consumeNonce: 'consumeNonce',
      checkNonceRateLimit: 'checkNonceRateLimit',
      buildNonce: 'buildNonce',
      base64UrlEncode: 'base64UrlEncode',
      signToken: 'signToken',
      getAddress: 'getAddress',
      buildAuthTokenJti: 'buildAuthTokenJti',
      persistAuthTokenRecord: 'persistAuthTokenRecord',
      now,
      readArweaveBootstrapUploadPayload: 'readArweaveBootstrapUploadPayload',
      getSessionSecrets: 'getSessionSecrets',
      randomUUID: 'randomUUID',
      mergeWorkerConfigRecords: 'mergeWorkerConfigRecords',
      mergeWorkerLimitRecords: 'mergeWorkerLimitRecords',
      putSessionConfig: 'putSessionConfig',
      normalizeSecretValue: 'normalizeSecretValue',
      putSessionSecrets: 'putSessionSecrets',
      dispatchAnonymousRoute: 'dispatchAnonymousRoute',
      storageRoute: 'storageRoute',
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
    },
    constants: {
      resourceGateKeys: ['default', 'ai', 'arweave'],
      anonymousRateIdHeader: 'X-Anonymous-Client-Id',
      anonymousGateUnavailableError: 'anonymousGateUnavailableError',
      missingSlugError: 'missingSlugError',
      anonymousRouteDeniedError: 'anonymousRouteDeniedError',
      anonymousScopeDisabledError: 'anonymousScopeDisabledError',
      anonymousUnknownIdentity: 'anon:unknown',
      openAiTranscribeUrl: 'https://api.openai.example/v1/audio/transcriptions',
      zeroBytes32: 'zeroBytes32',
      slugAliasMismatchError: 'slugAliasMismatchError',
      slugMismatchError: 'slugMismatchError',
      nonceTtlSeconds: 300,
      nonceRateLimitMax: 5,
      nonceSharedNetworkRateLimitMax: 300,
      nonceRateLimitWindowMs: 60000,
      nonceRateLimitTtlSeconds: 60,
      usedNonceTtlSeconds: 600,
      tokenTtlSeconds: 86400,
      loginSiweMaxAgeMs: 300000,
      loginSiweFutureSkewMs: 60000,
      sessionConfigNotFoundError: 'sessionConfigNotFoundError',
      bootstrapSessionConfigRequiredError: 'bootstrapSessionConfigRequiredError',
    },
    defaults: {
      defaultRpcUrl: 'defaultRpcUrl',
      defaultAmountEth: 'defaultAmountEth',
      defaultThresholdEth: 'defaultThresholdEth',
    },
  });

  assert.deepEqual(runtime.workerAuthGateUtils, {
    computeScopesForLogin: 'computeScopesForLogin',
    evaluateAnonymousRouteAccess: 'evaluateAnonymousRouteAccess',
    resolveAnonymousRateIdentity: 'resolveAnonymousRateIdentity',
  });
  assert.equal(runtime.fetch, 'fetch');
  assert.deepEqual(calls, [
    'registry',
    'rateLimit',
    'anonymous',
    'authCorsAdmin',
    'execution',
    'routeShell',
  ]);
});


test('createWorkerRuntime carries request waitUntil through resolved deps into execution services', () => {
  const waitUntil = () => {};
  let executionWaitUntil;
  let routeShellWaitUntil;
  const runtime = createWorkerRuntime({}, {
    waitUntil,
    resolveWorkerRuntimeDeps: ({ deps, constants }) => ({ deps, constants }),
    createWorkerLowLevelHelpersWithWorkerDeps: () => ({
      safeFetch: 'safeFetch',
      isBlockedOutboundUrl: 'isBlockedOutboundUrl',
      rpcRequest: 'rpcRequest',
      maskRpcUrl: 'maskRpcUrl',
      isAddress: 'isAddress',
      normalizeAddressLower: 'normalizeAddressLower',
      resolveRegistryRpcUrls: 'resolveRegistryRpcUrls',
      resolveRpcUrlListForGate: 'resolveRpcUrlListForGate',
      toRegistrySessionSlug: 'toRegistrySessionSlug',
      checkSbtGate: 'checkSbtGate',
      probeRpcUrls: 'probeRpcUrls',
      getFaucetSbtGateInterface: 'getFaucetSbtGateInterface',
      callContractFunction: 'callContractFunction',
      toBigInt: 'toBigInt',
      formatEther: 'formatEther',
      parseEther: 'parseEther',
      resolveFaucetRpcUrls: 'resolveFaucetRpcUrls',
      isBytes32Hex: 'isBytes32Hex',
      getErc721Interface: 'getErc721Interface',
      getSbtAdminInterface: 'getSbtAdminInterface',
      isPositiveBalance: 'isPositiveBalance',
      normalizeSessionIdHex: 'normalizeSessionIdHex',
      verifyMessage: 'verifyMessage',
      randomUUID: 'randomUUID',
      getAddress: 'getAddress',
    }),
    createWorkerRouteRuntimeWithWorkerDeps: ({ deps }) => {
      executionWaitUntil = deps.waitUntil;
      routeShellWaitUntil = deps.waitUntil;
      return {
        workerAuthGateUtils: {},
        fetch: async () => new Response('ok'),
      };
    },
  });
  assert.equal(executionWaitUntil, waitUntil);
  assert.equal(routeShellWaitUntil, waitUntil);
  assert.equal(typeof runtime.fetch, 'function');
});


const runtimeJson = (body, status = 200, headers = {}) => {
  const responseHeaders = new Headers(headers || {});
  responseHeaders.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
};
const readRuntimeJson = async (response) => JSON.parse(await response.text());

const createResultsAnalysisRuntime = ({ authorizeOk = true, deniedResources = [], requireAuthOk = true, authScopesOnPayload = false } = {}) => {
  const calls = { auth: 0, authorize: [] };
  const config = {
    slug: 'session-a',
    sessionIdHex: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    sessionModeProfile: {
      authority: { mode: 'worker_canonical' },
      storage: { backend: 'cloudflare' },
      results: { visibility: 'public_full_if_storage_public', exposure: { aggregateResultsEnabled: true } },
    },
    storageProfile: { backend: 'cloudflare', payloadAccessControl: { gate: 'none', encryption: 'none' } },
    resultsAnalysis: { version: 1, generationMode: 'manual' },
  };
  const runtime = createWorkerRuntime({}, {
    toStr: (value) => (value == null ? '' : String(value)),
    json: runtimeJson,
    corsHeaders: () => ({ 'Access-Control-Allow-Origin': 'https://viewer.example' }),
    resolveWorkerRequestSlugContext: ({ headerSlug }) => ({ ok: true, slug: headerSlug, explicitSlugProvided: !!headerSlug }),
    getSessionConfig: async () => config,
    authorizeCloudflareStorageResourceRead: async (args) => {
      calls.authorize.push(args);
      const denied = authorizeOk !== true || deniedResources.includes(args.resource);
      return !denied
        ? { ok: true }
        : { ok: false, response: runtimeJson({ ok: false, error: `Access denied: ${args.resource}` }, 403, args.baseHeaders) };
    },
    readPublishedResultsAnalysisArtifact: async () => ({
      ok: true,
      sessionSlug: 'session-a',
      sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      jobState: 'succeeded',
      generatedAt: '2026-09-17T00:00:00.000Z',
      source: { kind: 'worker-canonical' },
      artifact: { kind: 'ce_session_results_analysis_artifact' },
      snapshot: { sessionSlug: 'session-a', sessionId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', responses: [] },
    }),
    createRegistryLoginBootstrapAdaptersWithWorkerDeps: () => ({
      computeScopesForLogin: async () => ({}),
      readSessionExistsOnChain: async () => true,
      readSessionBySlugOnChain: async () => null,
      validateBootstrapAdmin: async () => false,
      readResourceGateOnChain: async () => null,
      readRegistryCodeOnChain: async () => null,
    }),
    createRateLimitFaucetSupportWithWorkerDeps: () => ({
      checkRateLimit: async () => true,
      findSessionGateForSbt: async () => null,
      readSbtFaucetValidationState: async () => null,
      validateSbtPasswordForFaucet: async () => false,
    }),
    createAnonymousRegistrySupportAdaptersWithWorkerDeps: () => ({
      resolveRequestSlugWithoutToken: ({ request }) => {
        const slug = request.headers.get('x-session-slug') || '';
        return { ok: true, slug, explicitSlugProvided: !!slug };
      },
      evaluateAnonymousRouteAccess: async () => ({ ok: true }),
      resolveAnonymousRateIdentity: () => 'anon:test',
    }),
    createAuthCorsAdminAdaptersWithWorkerDeps: () => ({
      getCorsContext: async ({ baseHeaders }) => ({ ok: true, headers: { ...(baseHeaders || {}), 'X-Cors': 'ok' } }),
      resolveExistingSessionCors: async () => ({ ok: true, headers: {} }),
      requireAuth: async () => {
        calls.auth += 1;
        const payload = { sub: '0x1234567890123456789012345678901234567890' };
        if (authScopesOnPayload) payload.scopes = { storage: true, viewer: true };
        return requireAuthOk
          ? { ok: true, slug: 'session-a', payload, ...(authScopesOnPayload ? {} : { scopes: { storage: true } }) }
          : { ok: false, response: runtimeJson({ error: 'Auth failed.' }, 401, { 'Access-Control-Allow-Origin': 'https://viewer.example' }) };
      },
      validateAdmin: async () => false,
    }),
    createWorkerExecutionServicesWithWorkerDeps: () => ({
      proxyAnthropic: async () => runtimeJson({}),
      proxyOpenAI: async () => runtimeJson({}),
      proxyOpenRouter: async () => runtimeJson({}),
      proxyCustomRPC: async () => runtimeJson({}),
      transcribe: async () => runtimeJson({}),
      faucet: async () => runtimeJson({}),
      fetchImage: async () => runtimeJson({}),
      fetchUrl: async () => runtimeJson({}),
      arweaveUpload: async () => runtimeJson({}),
      storageRoute: async () => runtimeJson({}),
      verifyAdminSignature: async () => runtimeJson({}),
    }),
  });
  return { runtime, calls };
};

test('createWorkerRuntime serves public results-analysis artifacts without authentication', async () => {
  const { runtime, calls } = createResultsAnalysisRuntime();
  const response = await runtime.fetch(new Request('https://worker.example/results-analysis/artifact?sessionSlug=session-a', {
    headers: { Origin: 'https://viewer.example' },
  }), {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://viewer.example');
  const body = await readRuntimeJson(response);
  assert.equal(body.sessionId, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(body.snapshot.sessionId, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(calls.auth, 0);
  assert.deepEqual(calls.authorize.map((call) => call.resource), ['generatedArtifacts', 'questions', 'responses']);
  assert.equal(calls.authorize[0].requesterAddress, '');
});

test('createWorkerRuntime denies generated artifacts when source resource gates deny the snapshot', async () => {
  const { runtime, calls } = createResultsAnalysisRuntime({ deniedResources: ['responses'] });
  const response = await runtime.fetch(new Request('https://worker.example/results-analysis/artifact?sessionSlug=session-a', {
    headers: { Origin: 'https://viewer.example' },
  }), {});
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://viewer.example');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(calls.authorize.map((call) => call.resource), ['generatedArtifacts', 'questions', 'responses']);
  assert.deepEqual(await readRuntimeJson(response), { ok: false, error: 'Access denied: responses' });
});

test('createWorkerRuntime accepts authenticated non-admin viewers through storage authorization', async () => {
  const { runtime, calls } = createResultsAnalysisRuntime();
  const response = await runtime.fetch(new Request('https://worker.example/results-analysis/artifact?sessionSlug=session-a', {
    headers: { Origin: 'https://viewer.example', Authorization: 'Bearer viewer-token' },
  }), {});
  assert.equal(response.status, 200);
  assert.equal(calls.auth, 1);
  assert.deepEqual(calls.authorize.map((call) => call.resource), ['generatedArtifacts', 'questions', 'responses']);
  assert.equal(calls.authorize[0].requesterAddress, '0x1234567890123456789012345678901234567890');
});

test('createWorkerRuntime forwards optional JWT payload scopes to results-analysis storage gates', async () => {
  const { runtime, calls } = createResultsAnalysisRuntime({ authScopesOnPayload: true });
  const response = await runtime.fetch(new Request('https://worker.example/results-analysis/artifact?sessionSlug=session-a', {
    headers: { Origin: 'https://viewer.example', Authorization: 'Bearer viewer-token' },
  }), {});
  assert.equal(response.status, 200);
  assert.equal(calls.auth, 1);
  assert.deepEqual(calls.authorize[0].authScopes, { storage: true, viewer: true });
});

test('createWorkerRuntime returns CORS-safe gated denial for results-analysis artifacts', async () => {
  const { runtime } = createResultsAnalysisRuntime({ authorizeOk: false });
  const response = await runtime.fetch(new Request('https://worker.example/results-analysis/artifact?sessionSlug=session-a', {
    headers: { Origin: 'https://viewer.example' },
  }), {});
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://viewer.example');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await readRuntimeJson(response), { ok: false, error: 'Access denied: generatedArtifacts' });
});
