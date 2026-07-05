import {
  createAiProviderProxiesWithWorkerDeps as createAiProviderProxiesWithWorkerDepsBoundary,
} from './aiProviderExecutionBinding.js';
import {
  createArweaveUploadWithWorkerDeps as createArweaveUploadWithWorkerDepsBoundary,
} from './arweaveUploadExecutionBinding.js';
import {
  createFaucetWithWorkerDeps as createFaucetWithWorkerDepsBoundary,
} from './faucetExecutionBinding.js';
import {
  createFetchHelpersWithWorkerDeps as createFetchHelpersWithWorkerDepsBoundary,
} from './fetchExecutionBinding.js';
import {
  createVerifyAdminSignatureWithWorkerDeps as createVerifyAdminSignatureWithWorkerDepsBoundary,
} from './adminSignatureVerificationBinding.js';
import {
  createTranscribeWithWorkerDeps as createTranscribeWithWorkerDepsBoundary,
} from './transcribeExecutionBinding.js';
import {
  storageRoute as storageRouteBoundary,
} from './storageRouteExecution.js';

export const createWorkerExecutionServicesWithWorkerDeps = ({
  deps,
  constants,
  defaults,
} = {}) => {
  const workerLog = typeof deps?.log === 'function' ? deps.log : () => {};

  const aiProxies = (
    deps?.createAiProviderProxiesWithWorkerDeps || createAiProviderProxiesWithWorkerDepsBoundary
  )({
    deps: {
      json: deps?.json,
      safeFetch: deps?.safeFetch,
      isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
    },
  });

  const transcribe = (
    deps?.createTranscribeWithWorkerDeps || createTranscribeWithWorkerDepsBoundary
  )({
    deps: {
      json: deps?.json,
      toStr: deps?.toStr,
      readTranscribeRequestPayload: deps?.readTranscribeRequestPayload,
      isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
      safeFetch: deps?.safeFetch,
    },
    constants: {
      openAiTranscribeUrl: constants?.openAiTranscribeUrl,
    },
  });

  const faucet = (
    deps?.createFaucetWithWorkerDeps || createFaucetWithWorkerDepsBoundary
  )({
    deps: {
      json: deps?.json,
      log: workerLog,
      normalizeFaucetRequest: deps?.normalizeFaucetRequest,
      validateFaucetEligibilityRequest: deps?.validateFaucetEligibilityRequest,
      Wallet: deps?.Wallet,
      rpcRequest: deps?.rpcRequest,
      toStr: deps?.toStr,
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
      readSessionExistsOnChain: deps?.readSessionExistsOnChain,
      readResourceGateOnChain: deps?.readResourceGateOnChain,
      resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
      checkSbtGate: deps?.checkSbtGate,
      findSessionGateForSbt: deps?.findSessionGateForSbt,
      readSbtFaucetValidationState: deps?.readSbtFaucetValidationState,
      validateSbtPasswordForFaucet: deps?.validateSbtPasswordForFaucet,
      verifyGroupSignatureForFaucet: deps?.verifyGroupSignatureForFaucet,
    },
    constants: {
      anonymousGateUnavailableError: constants?.anonymousGateUnavailableError,
      zeroBytes32: constants?.zeroBytes32,
    },
    defaults: {
      defaultRpcUrl: defaults?.defaultRpcUrl,
      defaultAmountEth: defaults?.defaultAmountEth,
      defaultThresholdEth: defaults?.defaultThresholdEth,
    },
  });

  const fetchHelpers = (
    deps?.createFetchHelpersWithWorkerDeps || createFetchHelpersWithWorkerDepsBoundary
  )({
    deps: {
      json: deps?.json,
      normalizeFetchTargetUrl: deps?.normalizeFetchTargetUrl,
      isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
      safeFetch: deps?.safeFetch,
    },
  });

  const arweaveUpload = (
    deps?.createArweaveUploadWithWorkerDeps || createArweaveUploadWithWorkerDepsBoundary
  )({
    deps: {
      json: deps?.json,
      log: workerLog,
      toStr: deps?.toStr,
      readArweaveUploadRequestPayload: deps?.readArweaveUploadRequestPayload,
      resolveArweaveUploadJwk: deps?.resolveArweaveUploadJwk,
      normalizeArweaveCeTags: deps?.normalizeArweaveCeTags,
      normalizeArweaveAssociationTags: deps?.normalizeArweaveAssociationTags,
      callContractFunction: deps?.callContractFunction,
      readSessionBySlugOnChain: deps?.readSessionBySlugOnChain,
      getErc721Interface: deps?.getErc721Interface,
      getSbtAdminInterface: deps?.getSbtAdminInterface,
      isAddress: deps?.isAddress,
      isPositiveBalance: deps?.isPositiveBalance,
      normalizeSessionIdHex: deps?.normalizeSessionIdHex,
      resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
      resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
      toChainId: deps?.toChainId,
      toRegistrySessionSlug: deps?.toRegistrySessionSlug,
    },
  });

  const storageRoute = async (value = {}) => storageRouteBoundary({
    ...value,
    deps: {
      json: deps?.json,
      getSessionSecrets: deps?.getSessionSecrets,
      arweaveUpload,
      randomUUID: deps?.randomUUID,
      now: deps?.now,
      log: workerLog,
      putSessionConfig: deps?.putSessionConfig,
      readResourceGateOnChain: deps?.readResourceGateOnChain,
      resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
      toRegistrySessionSlug: deps?.toRegistrySessionSlug,
      resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
      checkSbtGate: deps?.checkSbtGate,
    },
  });

  const verifyAdminSignature = (
    deps?.createVerifyAdminSignatureWithWorkerDeps || createVerifyAdminSignatureWithWorkerDepsBoundary
  )({
    deps: {
      normalizeSignedWorkerRequest: deps?.normalizeSignedWorkerRequest,
      resolveWorkerBodySlugContext: deps?.resolveWorkerBodySlugContext,
      toStr: deps?.toStr,
      isAddress: deps?.isAddress,
      json: deps?.json,
      verifyMessage: deps?.verifyMessage,
      validateRecoveredAddressMatchesRequest: deps?.validateRecoveredAddressMatchesRequest,
      parseSiweMessage: deps?.parseSiweMessage,
      validateSiwe: deps?.validateSiwe,
      validateSiweAddressMatchesRequest: deps?.validateSiweAddressMatchesRequest,
      consumeNonce: deps?.consumeNonce,
      validateAdmin: deps?.validateAdmin,
      log: workerLog,
    },
    constants: {
      usedNonceTtlSeconds: constants?.usedNonceTtlSeconds,
      missingSlugError: constants?.missingSlugError,
      slugAliasMismatchError: constants?.slugAliasMismatchError,
      slugMismatchError: constants?.slugMismatchError,
    },
  });

  return {
    proxyAnthropic: aiProxies.proxyAnthropic,
    proxyOpenAI: aiProxies.proxyOpenAI,
    proxyOpenRouter: aiProxies.proxyOpenRouter,
    proxyCustomRPC: aiProxies.proxyCustomRPC,
    transcribe,
    faucet,
    fetchImage: fetchHelpers.fetchImage,
    fetchUrl: fetchHelpers.fetchUrl,
    arweaveUpload,
    storageRoute,
    verifyAdminSignature,
  };
};
