import {
  createAnonymousRegistrySupportAdaptersWithWorkerDeps as createAnonymousRegistrySupportAdaptersWithWorkerDepsBoundary,
} from './anonymousRegistrySupportBinding.js';
import {
  createAuthCorsAdminAdaptersWithWorkerDeps as createAuthCorsAdminAdaptersWithWorkerDepsBoundary,
} from './authCorsAdminBinding.js';
import {
  createRateLimitFaucetSupportWithWorkerDeps as createRateLimitFaucetSupportWithWorkerDepsBoundary,
} from './rateLimitFaucetSupportBinding.js';
import {
  createRegistryLoginBootstrapAdaptersWithWorkerDeps as createRegistryLoginBootstrapAdaptersWithWorkerDepsBoundary,
} from './registryLoginBootstrapBinding.js';
import {
  createWorkerExecutionServicesWithWorkerDeps as createWorkerExecutionServicesWithWorkerDepsBoundary,
} from './workerExecutionServiceBinding.js';
import {
  createWorkerRouteShellWithWorkerDeps as createWorkerRouteShellWithWorkerDepsBoundary,
} from './workerRouteShellBinding.js';

export const createWorkerRouteRuntimeWithWorkerDeps = ({
  deps,
  constants,
  defaults,
} = {}) => {
  const registryLoginBootstrapAdapters = (
    deps?.createRegistryLoginBootstrapAdaptersWithWorkerDeps ||
    createRegistryLoginBootstrapAdaptersWithWorkerDepsBoundary
  )({
    deps: {
      callRegistryFunction: deps?.callRegistryFunction,
      rpcRequest: deps?.rpcRequest,
      maskRpcUrl: deps?.maskRpcUrl,
      toStr: deps?.toStr,
      isAddress: deps?.isAddress,
      toChainId: deps?.toChainId,
      normalizeRpcUrlList: deps?.normalizeRpcUrlList,
      resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
      resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
      toRegistrySessionSlug: deps?.toRegistrySessionSlug,
      checkSbtGate: deps?.checkSbtGate,
      probeRpcUrls: deps?.probeRpcUrls,
    },
    constants: {
      resourceGateKeys: constants?.resourceGateKeys,
    },
  });

  const rateLimitFaucetSupport = (
    deps?.createRateLimitFaucetSupportWithWorkerDeps ||
    createRateLimitFaucetSupportWithWorkerDepsBoundary
  )({
    deps: {
      toStr: deps?.toStr,
      now: deps?.now,
      ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
      isAddress: deps?.isAddress,
      resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
      normalizeAddressLower: deps?.normalizeAddressLower,
      toRegistrySessionSlug: deps?.toRegistrySessionSlug,
      readSessionExistsOnChain: registryLoginBootstrapAdapters.readSessionExistsOnChain,
      maskRpcUrl: deps?.maskRpcUrl,
      readResourceGateOnChain: registryLoginBootstrapAdapters.readResourceGateOnChain,
      resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
      toChainId: deps?.toChainId,
      getFaucetSbtGateInterface: deps?.getFaucetSbtGateInterface,
      callContractFunction: deps?.callContractFunction,
    },
    constants: {
      anonymousGateUnavailableError: constants?.anonymousGateUnavailableError,
      resourceGateKeys: constants?.resourceGateKeys,
      zeroBytes32: constants?.zeroBytes32,
    },
  });

  const anonymousRegistrySupport = (
    deps?.createAnonymousRegistrySupportAdaptersWithWorkerDeps ||
    createAnonymousRegistrySupportAdaptersWithWorkerDepsBoundary
  )({
    deps: {
      resolveWorkerRequestSlugContext: deps?.resolveWorkerRequestSlugContext,
      toStr: deps?.toStr,
      isAddress: deps?.isAddress,
      resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
      toRegistrySessionSlug: deps?.toRegistrySessionSlug,
      maskRpcUrl: deps?.maskRpcUrl,
      readSessionExistsOnChain: registryLoginBootstrapAdapters.readSessionExistsOnChain,
      readResourceGateOnChain: registryLoginBootstrapAdapters.readResourceGateOnChain,
    },
    constants: {
      anonymousGateUnavailableError: constants?.anonymousGateUnavailableError,
      anonymousRouteDeniedError: constants?.anonymousRouteDeniedError,
      anonymousScopeDisabledError: constants?.anonymousScopeDisabledError,
      anonymousRateIdHeader: constants?.anonymousRateIdHeader,
      anonymousUnknownIdentity: constants?.anonymousUnknownIdentity,
    },
  });

  const authCorsAdminAdapters = (
    deps?.createAuthCorsAdminAdaptersWithWorkerDeps ||
    createAuthCorsAdminAdaptersWithWorkerDepsBoundary
  )({
    deps: {
      parseAllowOrigins: deps?.parseAllowOrigins,
      originAllowed: deps?.originAllowed,
      corsHeaders: deps?.corsHeaders,
      json: deps?.json,
      normalizeWorkerSessionSlug: deps?.normalizeWorkerSessionSlug,
      getSessionConfig: deps?.getSessionConfig,
      resolveTrustedAdminOrigins: deps?.resolveTrustedAdminOrigins,
      verifyToken: deps?.verifyToken,
      validateAuthTokenRecord: deps?.validateAuthTokenRecord,
      resolveWorkerRequestSlugContext: deps?.resolveWorkerRequestSlugContext,
      ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
      ...(deps?.recordAbuseEvent && deps?.now ? { now: deps.now } : {}),
      toStr: deps?.toStr,
      isAddress: deps?.isAddress,
      resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
      getHatsInterface: deps?.getHatsInterface,
      callContractFunction: deps?.callContractFunction,
    },
    constants: {
      missingSlugError: constants?.missingSlugError,
    },
  });

  const executionServices = (
    deps?.createWorkerExecutionServicesWithWorkerDeps ||
    createWorkerExecutionServicesWithWorkerDepsBoundary
  )({
    deps: {
      json: deps?.json,
      safeFetch: deps?.safeFetch,
      isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
      toStr: deps?.toStr,
      readTranscribeRequestPayload: deps?.readTranscribeRequestPayload,
      normalizeFaucetRequest: deps?.normalizeFaucetRequest,
      validateFaucetEligibilityRequest: deps?.validateFaucetEligibilityRequest,
      Wallet: deps?.Wallet,
      rpcRequest: deps?.rpcRequest,
      toChainId: deps?.toChainId,
      toBigInt: deps?.toBigInt,
      formatEther: deps?.formatEther,
      maskRpcUrl: deps?.maskRpcUrl,
      isAddress: deps?.isAddress,
      parseEther: deps?.parseEther,
      resolveFaucetRpcUrls: deps?.resolveFaucetRpcUrls,
      isBytes32Hex: deps?.isBytes32Hex,
      normalizeAddressLower: deps?.normalizeAddressLower,
      resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
      toRegistrySessionSlug: deps?.toRegistrySessionSlug,
      readSessionExistsOnChain: registryLoginBootstrapAdapters.readSessionExistsOnChain,
      readResourceGateOnChain: registryLoginBootstrapAdapters.readResourceGateOnChain,
      resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
      checkSbtGate: deps?.checkSbtGate,
      findSessionGateForSbt: rateLimitFaucetSupport.findSessionGateForSbt,
      readSbtFaucetValidationState: rateLimitFaucetSupport.readSbtFaucetValidationState,
      validateSbtPasswordForFaucet: rateLimitFaucetSupport.validateSbtPasswordForFaucet,
      verifyGroupSignatureForFaucet: deps?.verifyGroupSignatureForFaucet,
      normalizeFetchTargetUrl: deps?.normalizeFetchTargetUrl,
      readArweaveUploadRequestPayload: deps?.readArweaveUploadRequestPayload,
      resolveArweaveUploadJwk: deps?.resolveArweaveUploadJwk,
      normalizeArweaveCeTags: deps?.normalizeArweaveCeTags,
      normalizeArweaveAssociationTags: deps?.normalizeArweaveAssociationTags,
      callContractFunction: deps?.callContractFunction,
      readSessionBySlugOnChain: registryLoginBootstrapAdapters.readSessionBySlugOnChain,
      getErc721Interface: deps?.getErc721Interface,
      getSbtAdminInterface: deps?.getSbtAdminInterface,
      isPositiveBalance: deps?.isPositiveBalance,
      normalizeSessionIdHex: deps?.normalizeSessionIdHex,
      normalizeSignedWorkerRequest: deps?.normalizeSignedWorkerRequest,
      resolveWorkerBodySlugContext: deps?.resolveWorkerBodySlugContext,
      verifyMessage: deps?.verifyMessage,
      validateRecoveredAddressMatchesRequest: deps?.validateRecoveredAddressMatchesRequest,
      parseSiweMessage: deps?.parseSiweMessage,
      validateSiwe: deps?.validateSiwe,
      validateTrustedLoginRequestOrigin: deps?.validateTrustedLoginRequestOrigin,
      validateBrowserLoginOrigin: deps?.validateBrowserLoginOrigin,
      validateSiweAddressMatchesRequest: deps?.validateSiweAddressMatchesRequest,
      consumeNonce: deps?.consumeNonce,
      ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
      validateAdmin: authCorsAdminAdapters.validateAdmin,
      log: deps?.log,
      now: deps?.now,
      randomUUID: deps?.randomUUID,
      getSessionSecrets: deps?.getSessionSecrets,
      putSessionConfig: deps?.putSessionConfig,
    },
    constants: {
      openAiTranscribeUrl: constants?.openAiTranscribeUrl,
      anonymousGateUnavailableError: constants?.anonymousGateUnavailableError,
      zeroBytes32: constants?.zeroBytes32,
      usedNonceTtlSeconds: constants?.usedNonceTtlSeconds,
      missingSlugError: constants?.missingSlugError,
      slugAliasMismatchError: constants?.slugAliasMismatchError,
      slugMismatchError: constants?.slugMismatchError,
    },
    defaults: {
      defaultRpcUrl: defaults?.defaultRpcUrl,
      defaultAmountEth: defaults?.defaultAmountEth,
      defaultThresholdEth: defaults?.defaultThresholdEth,
    },
  });

  const routeShell = (
    deps?.createWorkerRouteShellWithWorkerDeps ||
    createWorkerRouteShellWithWorkerDepsBoundary
  )({
    deps: {
      log: deps?.log,
      fetch: deps?.fetch,
      toStr: deps?.toStr,
      corsHeaders: deps?.corsHeaders,
      json: deps?.json,
      isAddress: deps?.isAddress,
      resolveWorkerBodySlugContext: deps?.resolveWorkerBodySlugContext,
      resolveExistingSessionCors: authCorsAdminAdapters.resolveExistingSessionCors,
      resolveTrustedAdminOrigins: deps?.resolveTrustedAdminOrigins,
      buildNonce: deps?.buildNonce,
      base64UrlEncode: deps?.base64UrlEncode,
      normalizeSignedWorkerRequest: deps?.normalizeSignedWorkerRequest,
      verifyMessage: deps?.verifyMessage,
      validateRecoveredAddressMatchesRequest: deps?.validateRecoveredAddressMatchesRequest,
      parseSiweMessage: deps?.parseSiweMessage,
      validateSiwe: deps?.validateSiwe,
      validateTrustedLoginRequestOrigin: deps?.validateTrustedLoginRequestOrigin,
      validateBrowserLoginOrigin: deps?.validateBrowserLoginOrigin,
      validateSiweAddressMatchesRequest: deps?.validateSiweAddressMatchesRequest,
      consumeNonce: deps?.consumeNonce,
      checkNonceRateLimit: deps?.checkNonceRateLimit,
      ...(deps?.recordAbuseEvent ? { recordAbuseEvent: deps.recordAbuseEvent } : {}),
      computeScopesForLogin: registryLoginBootstrapAdapters.computeScopesForLogin,
      signToken: deps?.signToken,
      getAddress: deps?.getAddress,
      buildAuthTokenJti: deps?.buildAuthTokenJti,
      persistAuthTokenRecord: deps?.persistAuthTokenRecord,
      now: deps?.now,
      readArweaveBootstrapUploadPayload: deps?.readArweaveBootstrapUploadPayload,
      getSessionConfig: deps?.getSessionConfig,
      getCorsContext: authCorsAdminAdapters.getCorsContext,
      verifyAdminSignature: executionServices.verifyAdminSignature,
      getSessionSecrets: deps?.getSessionSecrets,
      arweaveUpload: executionServices.arweaveUpload,
      storageRoute: executionServices.storageRoute,
      validateBootstrapAdmin: registryLoginBootstrapAdapters.validateBootstrapAdmin,
      validateAdmin: authCorsAdminAdapters.validateAdmin,
      mergeWorkerConfigRecords: deps?.mergeWorkerConfigRecords,
      mergeWorkerLimitRecords: deps?.mergeWorkerLimitRecords,
      putSessionConfig: deps?.putSessionConfig,
      normalizeSecretValue: deps?.normalizeSecretValue,
      putSessionSecrets: deps?.putSessionSecrets,
      ...(deps?.readAbuseCounterSummary ? { readAbuseCounterSummary: deps.readAbuseCounterSummary } : {}),
      resolveRequestSlugWithoutToken: anonymousRegistrySupport.resolveRequestSlugWithoutToken,
      resolveAnonymousRateIdentity: anonymousRegistrySupport.resolveAnonymousRateIdentity,
      checkRateLimit: rateLimitFaucetSupport.checkRateLimit,
      dispatchAnonymousRoute: deps?.dispatchAnonymousRoute,
      readTranscribeRequestPayload: deps?.readTranscribeRequestPayload,
      evaluateAnonymousRouteAccess: anonymousRegistrySupport.evaluateAnonymousRouteAccess,
      transcribe: executionServices.transcribe,
      readAiRequestPayload: deps?.readAiRequestPayload,
      validateAnonymousAiRequest: deps?.validateAnonymousAiRequest,
      proxyAnthropic: executionServices.proxyAnthropic,
      proxyOpenAI: executionServices.proxyOpenAI,
      proxyOpenRouter: executionServices.proxyOpenRouter,
      proxyCustomRPC: executionServices.proxyCustomRPC,
      requireAuth: authCorsAdminAdapters.requireAuth,
      dispatchAuthenticatedRoute: deps?.dispatchAuthenticatedRoute,
      dispatchAuthenticatedSecretPathRoute: deps?.dispatchAuthenticatedSecretPathRoute,
      readAuthenticatedActionPayload: deps?.readAuthenticatedActionPayload,
      dispatchAuthenticatedNonSecretActionRoute: deps?.dispatchAuthenticatedNonSecretActionRoute,
      dispatchAuthenticatedSecretActionRoute: deps?.dispatchAuthenticatedSecretActionRoute,
      evaluateAuthenticatedRoutePreflight: deps?.evaluateAuthenticatedRoutePreflight,
      resolveAuthenticatedRouteSecrets: deps?.resolveAuthenticatedRouteSecrets,
      fetchImage: executionServices.fetchImage,
      fetchUrl: executionServices.fetchUrl,
      normalizeAiRequestPayload: deps?.normalizeAiRequestPayload,
      faucet: executionServices.faucet,
    },
    constants: {
      missingSlugError: constants?.missingSlugError,
      nonceTtlSeconds: constants?.nonceTtlSeconds,
      nonceRateLimitMax: constants?.nonceRateLimitMax,
      nonceRateLimitWindowMs: constants?.nonceRateLimitWindowMs,
      nonceRateLimitTtlSeconds: constants?.nonceRateLimitTtlSeconds,
      usedNonceTtlSeconds: constants?.usedNonceTtlSeconds,
      tokenTtlSeconds: constants?.tokenTtlSeconds,
      loginSiweMaxAgeMs: constants?.loginSiweMaxAgeMs,
      loginSiweFutureSkewMs: constants?.loginSiweFutureSkewMs,
      sessionConfigNotFoundError: constants?.sessionConfigNotFoundError,
      bootstrapSessionConfigRequiredError: constants?.bootstrapSessionConfigRequiredError,
      anonymousRouteDeniedError: constants?.anonymousRouteDeniedError,
    },
  });

  return {
    workerAuthGateUtils: {
      computeScopesForLogin: registryLoginBootstrapAdapters.computeScopesForLogin,
      evaluateAnonymousRouteAccess: anonymousRegistrySupport.evaluateAnonymousRouteAccess,
      resolveAnonymousRateIdentity: anonymousRegistrySupport.resolveAnonymousRateIdentity,
    },
    fetch: routeShell.fetch,
  };
};
