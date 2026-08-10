import {
  proxyAnthropic as proxyAnthropicBoundary,
  proxyCustomRPC as proxyCustomRPCBoundary,
  proxyOpenAI as proxyOpenAIBoundary,
  proxyOpenRouter as proxyOpenRouterBoundary,
} from './aiProviderExecution.js';
import {
  arweaveUpload as arweaveUploadBoundary,
} from './arweaveUploadExecution.js';
import {
  faucet as faucetBoundary,
} from './faucetExecution.js';
import {
  fetchImage as fetchImageBoundary,
  fetchUrl as fetchUrlBoundary,
} from './fetchExecution.js';
import {
  createVerifyAdminSignatureWithWorkerDeps as createVerifyAdminSignatureWithWorkerDepsBoundary,
} from './adminSignatureVerificationBinding.js';
import {
  transcribe as transcribeBoundary,
} from './transcribeExecution.js';
import {
  storageRoute as storageRouteBoundary,
} from './storageRouteExecution.js';

export const createWorkerExecutionServicesWithWorkerDeps = ({
  deps,
  constants,
  defaults,
} = {}) => {
  const workerLog = typeof deps?.log === 'function' ? deps.log : () => {};

  const aiDeps = {
    fetch: deps?.fetch,
    json: deps?.json,
    safeFetch: deps?.safeFetch,
    isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
  };
  const aiProxies = {
    proxyAnthropic: async (value = {}) => proxyAnthropicBoundary({
      ...value,
      deps: aiDeps,
    }),
    proxyOpenAI: async (value = {}) => proxyOpenAIBoundary({
      ...value,
      deps: aiDeps,
    }),
    proxyOpenRouter: async (value = {}) => proxyOpenRouterBoundary({
      ...value,
      deps: aiDeps,
    }),
    proxyCustomRPC: async (value = {}) => proxyCustomRPCBoundary({
      ...value,
      deps: aiDeps,
    }),
  };

  const transcribe = async (value = {}) => transcribeBoundary({
    ...value,
    deps: {
      json: deps?.json,
      toStr: deps?.toStr,
      isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
      safeFetch: deps?.safeFetch,
    },
    constants: {
      openAiTranscribeUrl: constants?.openAiTranscribeUrl,
    },
  });

  const faucet = async (value = {}) => faucetBoundary({
    ...value,
    deps: {
      json: deps?.json,
      log: workerLog,
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

  const fetchDeps = {
    json: deps?.json,
    isBlockedOutboundUrl: deps?.isBlockedOutboundUrl,
    safeFetch: deps?.safeFetch,
  };
  const fetchHelpers = {
    fetchImage: async (url, baseHeaders) => fetchImageBoundary({
      url,
      baseHeaders,
      deps: fetchDeps,
    }),
    fetchUrl: async (url, baseHeaders) => fetchUrlBoundary({
      url,
      baseHeaders,
      deps: fetchDeps,
    }),
  };

  const arweaveUploadExecution = deps?.arweaveUpload || arweaveUploadBoundary;
  const arweaveUpload = async (value = {}) => arweaveUploadExecution({
    ...value,
    deps: {
      json: deps?.json,
      log: workerLog,
      toStr: deps?.toStr,
      rpcRequest: deps?.rpcRequest,
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
