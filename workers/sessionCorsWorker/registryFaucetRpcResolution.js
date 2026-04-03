import rpcDefaults from '../../client/src/variables/rpcDefaults.js';
import {
  mergeRpcUrlLists as defaultMergeRpcUrlLists,
  normalizeRpcUrlList as defaultNormalizeRpcUrlList,
} from './rpcUrlListNormalization.js';
import { toChainId as defaultToChainId } from './chainIdNormalization.js';

const { getFaucetFallbackRpcUrls } = rpcDefaults;
const fallbackToString = (value) => (
  typeof value === 'string'
    ? value
    : value == null
      ? ''
      : String(value)
);

const BASE_SEPOLIA_FAUCET_FALLBACKS = Object.freeze(getFaucetFallbackRpcUrls(84532));
const OP_SEPOLIA_FAUCET_FALLBACKS = Object.freeze(getFaucetFallbackRpcUrls(11155420));
const BASE_MAINNET_FAUCET_FALLBACKS = Object.freeze(getFaucetFallbackRpcUrls(8453));

export const resolveRegistryRpcUrls = ({
  config,
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

  const registryChainId = toChainId(config?.registryChainId);
  const map = config?.rpcUrlsByChainId;
  const mapped = registryChainId && map && typeof map === 'object'
    ? normalizeRpcUrlList(map[registryChainId] || map[String(registryChainId)])
    : [];
  const direct = normalizeRpcUrlList(config?.rpcUrl);
  return mergeRpcUrlLists(mapped, direct);
};

export const resolveFaucetRpcUrl = ({
  config,
  faucetCfg,
  deps,
} = {}) => {
  const toStr = typeof deps?.toStr === 'function' ? deps.toStr : fallbackToString;
  const toChainId = typeof deps?.toChainId === 'function'
    ? deps.toChainId
    : defaultToChainId;
  const normalizeRpcUrlList = typeof deps?.normalizeRpcUrlList === 'function'
    ? deps.normalizeRpcUrlList
    : defaultNormalizeRpcUrlList;
  const resolveRpcUrlListForGate = typeof deps?.resolveRpcUrlListForGate === 'function'
    ? deps.resolveRpcUrlListForGate
    : () => [];

  const explicit = toStr(faucetCfg?.rpcUrl).trim();
  if (explicit) return explicit;

  const chainId = toChainId(faucetCfg?.chainId || config?.networkChainId || config?.registryChainId);
  const mapped = chainId ? resolveRpcUrlListForGate(config, chainId) : [];
  const fallback = normalizeRpcUrlList(config?.rpcUrl);
  const specialFallbacks = chainId === 84532
    ? BASE_SEPOLIA_FAUCET_FALLBACKS
    : chainId === 11155420
      ? OP_SEPOLIA_FAUCET_FALLBACKS
      : chainId === 8453
        ? BASE_MAINNET_FAUCET_FALLBACKS
        : [];
  return (mapped[0] || fallback[0] || specialFallbacks[0] || '').trim();
};

export const resolveFaucetRpcUrls = ({
  config,
  faucetCfg,
  defaultFaucetRpcUrl,
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
  const resolveRpcUrlListForGate = typeof deps?.resolveRpcUrlListForGate === 'function'
    ? deps.resolveRpcUrlListForGate
    : () => [];

  const explicit = normalizeRpcUrlList(faucetCfg?.rpcUrl);
  const chainId = toChainId(faucetCfg?.chainId || config?.networkChainId || config?.registryChainId);
  const mapped = chainId ? resolveRpcUrlListForGate(config, chainId) : [];
  const fallback = normalizeRpcUrlList(config?.rpcUrl);
  const specialFallbacks = chainId === 84532
    ? BASE_SEPOLIA_FAUCET_FALLBACKS
    : chainId === 11155420
      ? OP_SEPOLIA_FAUCET_FALLBACKS
      : [];

  if (specialFallbacks.length) {
    return mergeRpcUrlLists(
      explicit,
      specialFallbacks,
      mapped,
      fallback,
      [defaultFaucetRpcUrl],
    );
  }

  const baseMainnetFallbacks = chainId === 8453 ? BASE_MAINNET_FAUCET_FALLBACKS : [];

  return mergeRpcUrlLists(
    explicit,
    mapped,
    fallback,
    baseMainnetFallbacks,
    [defaultFaucetRpcUrl],
  );
};
