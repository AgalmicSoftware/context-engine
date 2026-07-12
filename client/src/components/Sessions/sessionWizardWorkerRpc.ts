import rpcDefaults from '../../variables/rpcDefaults.js';
import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import { getDefaultHttpRpc, isChainWithFaucetRpcFallback } from '../../variables/chains.js';
import { toStr } from '../../utilities/shared/primitives.js';
import type { AnyRecord, ChainIdLike } from '../shellTypes';

const { getPathRpcUrl } = rpcDefaults;

const DEFAULT_RPC_FALLBACKS = {
  [DEFAULT_CHAIN_ID]: getDefaultHttpRpc(DEFAULT_CHAIN_ID, { allowPath: false }) || '',
};

export const resolveFallbackRpcUrl = (chainId: ChainIdLike): string => {
  const resolvedChainId = Number(chainId || 0) || 0;
  if (!resolvedChainId) {
    return DEFAULT_RPC_FALLBACKS[DEFAULT_CHAIN_ID] || '';
  }
  return (
    DEFAULT_RPC_FALLBACKS[resolvedChainId] ||
    getDefaultHttpRpc(resolvedChainId, { allowPath: false }) ||
    getPathRpcUrl(resolvedChainId) ||
    ''
  );
};

const normalizeRpcUrlList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((url) => toStr(url).trim()).filter(Boolean);
  }
  const str = toStr(value).trim();
  return str ? [str] : [];
};

const mergeRpcUrlLists = (...lists: unknown[]): string[] => {
  const seen = new Set();
  const merged: string[] = [];
  lists.forEach((list) => {
    if (!Array.isArray(list)) return;
    list.forEach((url) => {
      const trimmed = toStr(url).trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      merged.push(trimmed);
    });
  });
  return merged;
};

const getDefaultWorkerRpcUrlsForChain = (chainId: ChainIdLike): string[] => {
  if (!chainId) return [];
  const pathDefault = normalizeRpcUrlList(getPathRpcUrl(chainId));
  const fallbackDefault = normalizeRpcUrlList(resolveFallbackRpcUrl(chainId));
  return isChainWithFaucetRpcFallback(chainId)
    ? mergeRpcUrlLists(fallbackDefault, pathDefault)
    : mergeRpcUrlLists(pathDefault, fallbackDefault);
};

export const buildSessionWizardWorkerRpcUrlMap = ({
  chainId,
  pathProvider,
}: {
  chainId?: ChainIdLike;
  pathProvider?: AnyRecord | null;
} = {}): Record<string, string[]> => {
  const provider: AnyRecord = pathProvider && typeof pathProvider === 'object' ? pathProvider : {};
  const rawMap = provider.rpcUrlsByChainId;
  const normalized: Record<string, string[]> = {};
  if (rawMap && typeof rawMap === 'object') {
    Object.entries(rawMap).forEach(([key, value]) => {
      const list = normalizeRpcUrlList(value);
      if (list.length) normalized[key] = list;
    });
  }
  const resolvedChainId = Number(chainId || 0) || null;
  if (!resolvedChainId) return normalized;
  const configured = mergeRpcUrlLists(
    normalizeRpcUrlList(normalized[resolvedChainId] || normalized[String(resolvedChainId)]),
    normalizeRpcUrlList(provider.rpcUrl),
  );
  const defaults = getDefaultWorkerRpcUrlsForChain(resolvedChainId);
  const merged = configured.length ? mergeRpcUrlLists(configured, defaults) : defaults;
  if (merged.length) {
    normalized[String(resolvedChainId)] = merged;
  }
  return normalized;
};

export const resolveSessionWizardWorkerRpcUrl = ({
  chainId,
  pathProvider,
  faucetRpcUrl,
}: {
  chainId?: ChainIdLike;
  pathProvider?: AnyRecord | null;
  faucetRpcUrl?: unknown;
} = {}): string => {
  const resolvedChainId = Number(chainId || 0) || null;
  const map = buildSessionWizardWorkerRpcUrlMap({ chainId: resolvedChainId, pathProvider });
  const byChain = resolvedChainId ? map[resolvedChainId] || map[String(resolvedChainId)] : '';
  const ordered = mergeRpcUrlLists(
    normalizeRpcUrlList(byChain),
    normalizeRpcUrlList(pathProvider?.rpcUrl),
    normalizeRpcUrlList(faucetRpcUrl),
  );
  return ordered[0] || '';
};

export const getSessionWizardWorkerDeployValidationError = ({
  registryAddress,
  registryChainId,
  networkChainId,
  pathProvider,
  faucetRpcUrl,
  requiresRegistry = true,
  requiresRpc = true,
}: {
  registryAddress?: unknown;
  registryChainId?: ChainIdLike;
  networkChainId?: ChainIdLike;
  pathProvider?: AnyRecord | null;
  faucetRpcUrl?: unknown;
  requiresRegistry?: boolean;
  requiresRpc?: boolean;
} = {}): string => {
  const chainId = Number(registryChainId || networkChainId || 0) || 0;
  if (requiresRegistry && !toStr(registryAddress).trim()) {
    return 'Registry address is required before deploying a worker.';
  }
  if (!requiresRpc) return '';
  const rpcUrl = resolveSessionWizardWorkerRpcUrl({
    chainId,
    pathProvider,
    faucetRpcUrl,
  });
  if (!rpcUrl) {
    return chainId
      ? `RPC URL is required for chain ${chainId} before deploying a worker.`
      : 'RPC URL is required before deploying a worker.';
  }
  return '';
};
