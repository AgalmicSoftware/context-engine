import {
  resolveLoginGateAuthority,
} from './loginGateAuthority.js';
import {
  resolveWorkerCanonicalLoginScopes as resolveWorkerCanonicalLoginScopesBoundary,
} from './workerCanonicalAuthority.js';

export const computeLoginScopes = async ({
  address,
  authorityMode,
  config,
  env,
  registryAddress,
  registryRpcUrls,
  registrySlug,
  sessionCheck,
  resourceKeys,
  deps,
} = {}) => {
  if (authorityMode === 'worker_canonical') {
    return (deps?.resolveWorkerCanonicalLoginScopes || resolveWorkerCanonicalLoginScopesBoundary)({
      address,
      config,
      env,
      slug: registrySlug,
      deps: {
        isWorkerGroupMember: deps?.isWorkerGroupMember,
      },
    });
  }

  const keys = Array.isArray(resourceKeys) ? resourceKeys : [];
  const gateResults = await (
    deps?.resolveLoginGateAuthority || resolveLoginGateAuthority
  )({
    address,
    config,
    registryAddress,
    registryRpcUrls,
    registrySlug,
    sessionCheck,
    resourceKeys: keys,
    deps: {
      readResourceGateOnChain: deps?.readResourceGateOnChain,
      resolveRpcUrlListForGate: deps?.resolveRpcUrlListForGate,
      checkSbtGate: deps?.checkSbtGate,
      probeRpcUrls: deps?.probeRpcUrls,
      readRegistryCodeOnChain: deps?.readRegistryCodeOnChain,
      ...(deps?.chainAttestationCache instanceof Map
        ? { chainAttestationCache: deps.chainAttestationCache }
        : {}),
      maskRpcUrl: deps?.maskRpcUrl,
      toChainId: deps?.toChainId,
      toStr: deps?.toStr,
      log: deps?.log,
    },
  });

  if (!gateResults.default) {
    throw new Error('Access denied: default gate failed.');
  }

  const scopes = {
    ai: !!gateResults.ai,
    arweave: !!gateResults.arweave,
    transcribe: !!gateResults.ai,
    faucet: !!gateResults.txGas,
    fetch: !!gateResults.rpc,
    lit: !!gateResults.lit,
  };

  const scopeOverrides = config?.scopes && typeof config.scopes === 'object' ? config.scopes : null;
  if (scopeOverrides) {
    Object.keys(scopes).forEach((key) => {
      if (typeof scopeOverrides[key] === 'boolean') {
        scopes[key] = scopes[key] && scopeOverrides[key];
      }
    });
  }

  return scopes;
};
