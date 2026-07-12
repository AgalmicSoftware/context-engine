import {
  validateBootstrapAdmin as validateBootstrapAdminBoundary,
} from './bootstrapAdminValidation.js';
import {
  readSessionExistsOnChain as readSessionExistsOnChainBoundary,
} from './sessionExistenceRead.js';
import {
  readResourceGateOnChain as readResourceGateOnChainBoundary,
} from './sessionResourceGateRead.js';
import {
  readRegistryCodeOnChain as readRegistryCodeOnChainBoundary,
} from './sessionRegistryCodeRead.js';
import {
  readSessionBySlugOnChain as readSessionBySlugOnChainBoundary,
} from './sessionTupleRead.js';
import {
  computeLoginScopes as computeLoginScopesBoundary,
} from './loginScopeEvaluation.js';
import {
  resolveLoginAuthorityContext as resolveLoginAuthorityContextBoundary,
} from './loginAuthorityPreflight.js';

export const createRegistryLoginBootstrapAdaptersWithWorkerDeps = ({
  deps,
  constants,
} = {}) => {
  const readSessionExistsOnChain = async (value = {}) => (
    (deps?.readSessionExistsOnChain || readSessionExistsOnChainBoundary)({
      ...value,
      deps: {
        callRegistryFunction: deps?.callRegistryFunction,
        maskRpcUrl: deps?.maskRpcUrl,
        toStr: deps?.toStr,
      },
    })
  );

  const readSessionBySlugOnChain = async (value = {}) => (
    (deps?.readSessionBySlugOnChain || readSessionBySlugOnChainBoundary)({
      ...value,
      deps: {
        callRegistryFunction: deps?.callRegistryFunction,
        maskRpcUrl: deps?.maskRpcUrl,
        toStr: deps?.toStr,
      },
    })
  );

  const readResourceGateOnChain = async (value = {}) => (
    (deps?.readResourceGateOnChain || readResourceGateOnChainBoundary)({
      ...value,
      deps: {
        callRegistryFunction: deps?.callRegistryFunction,
        maskRpcUrl: deps?.maskRpcUrl,
        toStr: deps?.toStr,
        toChainId: deps?.toChainId,
      },
    })
  );

  const readRegistryCodeOnChain = async (value = {}) => (
    (deps?.readRegistryCodeOnChain || readRegistryCodeOnChainBoundary)({
      ...value,
      deps: {
        rpcRequest: deps?.rpcRequest,
        maskRpcUrl: deps?.maskRpcUrl,
        toStr: deps?.toStr,
      },
    })
  );

  const computeScopesForLogin = async ({
    env,
    slug,
    address,
    config,
  } = {}) => {
    const {
      authorityMode,
      registryAddress,
      registryRpcUrls,
      registrySlug,
      sessionCheck,
    } = await (deps?.resolveLoginAuthorityContext || resolveLoginAuthorityContextBoundary)({
      slug,
      address,
      config,
      deps: {
        toStr: deps?.toStr,
        isAddress: deps?.isAddress,
        resolveRegistryRpcUrls: deps?.resolveRegistryRpcUrls,
        toRegistrySessionSlug: deps?.toRegistrySessionSlug,
        readSessionExistsOnChain,
        maskRpcUrl: deps?.maskRpcUrl,
        warn: deps?.warn || console.warn,
      },
    });

    return (deps?.computeLoginScopes || computeLoginScopesBoundary)({
      address,
      authorityMode,
      config,
      env,
      registryAddress,
      registryRpcUrls,
      registrySlug,
      sessionCheck,
      resourceKeys: constants?.resourceGateKeys,
      deps: {
        readResourceGateOnChain,
        resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
        checkSbtGate: deps?.checkSbtGate,
        probeRpcUrls: deps?.probeRpcUrls,
        readRegistryCodeOnChain,
        maskRpcUrl: deps?.maskRpcUrl,
        toChainId: deps?.toChainId,
        toStr: deps?.toStr,
        log: deps?.log || console.log,
        ...(deps?.isWorkerGroupMember ? { isWorkerGroupMember: deps.isWorkerGroupMember } : {}),
      },
    });
  };

  const validateBootstrapAdmin = async (value = {}) => (
    (deps?.validateBootstrapAdmin || validateBootstrapAdminBoundary)({
      ...value,
      deps: {
        toStr: deps?.toStr,
        isAddress: deps?.isAddress,
        normalizeRpcUrlList: deps?.normalizeRpcUrlList,
        toRegistrySessionSlug: deps?.toRegistrySessionSlug,
        readSessionExistsOnChain,
        readSessionBySlugOnChain,
      },
    })
  );

  return {
    computeScopesForLogin,
    readSessionExistsOnChain,
    readSessionBySlugOnChain,
    validateBootstrapAdmin,
    readResourceGateOnChain,
    readRegistryCodeOnChain,
  };
};
