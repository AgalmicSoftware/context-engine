import rpcDefaults from '../../client/src/variables/rpcDefaults.js';
import {
  mergeRpcUrlLists as defaultMergeRpcUrlLists,
  normalizeRpcUrlList as defaultNormalizeRpcUrlList,
} from './rpcUrlListNormalization.js';
import {
  resolveChainIdWithLegacyFallback,
  resolveRegistryChainId,
  toChainId as defaultToChainId,
} from './chainIdNormalization.js';
import { resolveSessionSecretRpcUrlListForGateRuntime } from './gateRpcResolution.js';

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
const isWorkerCanonicalConfig = (config) => (
  config?.sessionModeProfile?.authority?.mode === 'worker_canonical'
);
const resolveFaucetChainId = (config, faucetCfg) => resolveChainIdWithLegacyFallback(
  faucetCfg?.chainId,
  resolveChainIdWithLegacyFallback(
    config?.networkChainId,
    resolveChainIdWithLegacyFallback(config?.registryChainId, 0),
  ),
);

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

  const registryChainId = resolveRegistryChainId(config);
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

  const chainId = resolveFaucetChainId(config, faucetCfg);
  const runtimeSecret = resolveSessionSecretRpcUrlListForGateRuntime({
    config,
    gateChainId: chainId,
    deps: { normalizeRpcUrlList, toChainId },
  });
  if (runtimeSecret.length) return runtimeSecret[0];

  const explicit = toStr(faucetCfg?.rpcUrl).trim();
  if (explicit) return explicit;

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
  const chainId = resolveFaucetChainId(config, faucetCfg);
  const mapped = chainId ? resolveRpcUrlListForGate(config, chainId) : [];
  const runtimeSecret = resolveSessionSecretRpcUrlListForGateRuntime({
    config,
    gateChainId: chainId,
    deps: { normalizeRpcUrlList, toChainId },
  });
  const fallback = normalizeRpcUrlList(config?.rpcUrl);
  const specialFallbacks = chainId === 84532
    ? BASE_SEPOLIA_FAUCET_FALLBACKS
    : chainId === 11155420
      ? OP_SEPOLIA_FAUCET_FALLBACKS
      : [];

  if (isWorkerCanonicalConfig(config)) {
    const baseMainnetFallbacks = chainId === 8453 ? BASE_MAINNET_FAUCET_FALLBACKS : [];
    // Worker-managed credentials are authoritative for this deployment. Keep
    // the legacy explicit value as the next fallback, ahead of every public RPC.
    return mergeRpcUrlLists(
      runtimeSecret,
      explicit,
      mapped,
      specialFallbacks,
      fallback,
      baseMainnetFallbacks,
      [defaultFaucetRpcUrl],
    );
  }

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
