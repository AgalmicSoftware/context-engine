import rpcDefaults from '../../client/src/variables/rpcDefaults.js';
import {
  mergeRpcUrlLists as defaultMergeRpcUrlLists,
  normalizeRpcUrlList as defaultNormalizeRpcUrlList,
} from './rpcUrlListNormalization.js';
import { toChainId as defaultToChainId } from './chainIdNormalization.js';

const { getPublicRpcUrls } = rpcDefaults;

const isWorkerCanonicalConfig = (config) => (
  config?.sessionModeProfile?.authority?.mode === 'worker_canonical'
);

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

  const map = config?.rpcUrlsByChainId;
  const mapped = map && typeof map === 'object'
    ? normalizeRpcUrlList(map[chainId] || map[String(chainId)])
    : [];

  const registryChainId = toChainId(config?.registryChainId);
  if (registryChainId && registryChainId === chainId) {
    const configured = mergeRpcUrlLists(mapped, configRpcUrls);
    if (configured.length) return configured;
  }

  if (mapped.length) return mapped;
  if (!isWorkerCanonicalConfig(config)) return [];
  return normalizeRpcUrlList(resolvePublicRpcUrls(chainId));
};
