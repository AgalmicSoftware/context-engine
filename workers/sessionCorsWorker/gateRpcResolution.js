import {
  mergeRpcUrlLists as defaultMergeRpcUrlLists,
  normalizeRpcUrlList as defaultNormalizeRpcUrlList,
} from './rpcUrlListNormalization.js';
import { toChainId as defaultToChainId } from './chainIdNormalization.js';

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

  const configRpcUrls = normalizeRpcUrlList(config?.rpcUrl);
  const chainId = toChainId(gateChainId);
  if (!chainId) return configRpcUrls;

  const map = config?.rpcUrlsByChainId;
  const mapped = map && typeof map === 'object'
    ? normalizeRpcUrlList(map[chainId] || map[String(chainId)])
    : [];

  const registryChainId = toChainId(config?.registryChainId);
  if (registryChainId && registryChainId === chainId) {
    return mergeRpcUrlLists(mapped, configRpcUrls);
  }

  return mapped;
};
