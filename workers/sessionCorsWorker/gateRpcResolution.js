import rpcDefaults from '../../client/src/variables/rpcDefaults.js';
import {
  mergeRpcUrlLists as defaultMergeRpcUrlLists,
  normalizeRpcUrlList as defaultNormalizeRpcUrlList,
} from './rpcUrlListNormalization.js';
import {
  resolveRegistryChainId,
  toChainId as defaultToChainId,
} from './chainIdNormalization.js';

const { getPublicRpcUrls } = rpcDefaults;
const SESSION_SECRET_GATE_RPC_URLS = Symbol('session-secret-gate-rpc-urls');

const isWorkerCanonicalConfig = (config) => (
  config?.sessionModeProfile?.authority?.mode === 'worker_canonical'
);

export const canUseSessionSecretRpcForGateRuntime = (config) => (
  isWorkerCanonicalConfig(config) && !!defaultToChainId(config?.networkChainId)
);

export const resolveSessionSecretRpcUrlListForGateRuntime = ({
  config,
  gateChainId,
  deps,
} = {}) => {
  const normalizeRpcUrlList = typeof deps?.normalizeRpcUrlList === 'function'
    ? deps.normalizeRpcUrlList
    : defaultNormalizeRpcUrlList;
  const toChainId = typeof deps?.toChainId === 'function'
    ? deps.toChainId
    : defaultToChainId;
  const chainId = toChainId(gateChainId);
  if (!chainId || !isWorkerCanonicalConfig(config)) return [];
  const runtimeMap = config?.[SESSION_SECRET_GATE_RPC_URLS];
  if (!runtimeMap || typeof runtimeMap !== 'object') return [];
  return normalizeRpcUrlList(runtimeMap[chainId] || runtimeMap[String(chainId)]);
};

export const isSessionSecretRpcUrlForGateRuntime = ({
  config,
  gateChainId,
  rpcUrl,
} = {}) => {
  const target = defaultNormalizeRpcUrlList(rpcUrl)[0] || '';
  if (!target) return false;
  return resolveSessionSecretRpcUrlListForGateRuntime({ config, gateChainId }).includes(target);
};

export const attachSessionSecretRpcForGateRuntime = ({
  config,
  secrets,
} = {}) => {
  if (!config || typeof config !== 'object' || !canUseSessionSecretRpcForGateRuntime(config)) {
    return config;
  }
  const rpcUrls = defaultNormalizeRpcUrlList(secrets?.customRpcUrl);
  if (!rpcUrls.length) return config;

  const chainId = defaultToChainId(config.networkChainId);
  const runtimeConfig = { ...config };
  // Credential boundary: the URL exists only on this non-enumerable request
  // object. JSON serialization, public projection, and KV persistence cannot
  // copy it back into the canonical session config.
  Object.defineProperty(runtimeConfig, SESSION_SECRET_GATE_RPC_URLS, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ [chainId]: Object.freeze([...rpcUrls]) }),
  });
  return runtimeConfig;
};

export const resolveRpcUrlListForGate = ({
  config,
  gateChainId,
  deps,
} = {}) => {
  const normalizeRpcUrlList = typeof deps?.normalizeRpcUrlList === 'function'
    ? deps.normalizeRpcUrlList
    : defaultNormalizeRpcUrlList;
  const mergeRpcUrlLists = typeof deps?.mergeRpcUrlLists === 'function'
    ? deps.mergeRpcUrlLists
    : defaultMergeRpcUrlLists;
  const toChainId = typeof deps?.toChainId === 'function'
    ? deps.toChainId
    : defaultToChainId;
  const resolvePublicRpcUrls = typeof deps?.getPublicRpcUrls === 'function'
    ? deps.getPublicRpcUrls
    : getPublicRpcUrls;

  const configRpcUrls = normalizeRpcUrlList(config?.rpcUrl);
  const chainId = toChainId(gateChainId);
  if (!chainId) return configRpcUrls;

  const runtimeMapped = resolveSessionSecretRpcUrlListForGateRuntime({
    config,
    gateChainId: chainId,
    deps: { normalizeRpcUrlList, toChainId },
  });

  const map = config?.rpcUrlsByChainId;
  const mapped = map && typeof map === 'object'
    ? normalizeRpcUrlList(map[chainId] || map[String(chainId)])
    : [];

  const registryChainId = resolveRegistryChainId(config);
  if (registryChainId && registryChainId === chainId) {
    const configured = mergeRpcUrlLists(runtimeMapped, mapped, configRpcUrls);
    if (configured.length) return configured;
  }

  const configured = mergeRpcUrlLists(runtimeMapped, mapped);
  if (configured.length) return configured;
  if (!isWorkerCanonicalConfig(config)) return [];
  return normalizeRpcUrlList(resolvePublicRpcUrls(chainId));
};
