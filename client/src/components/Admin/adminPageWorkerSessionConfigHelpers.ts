import { getDefaultHttpRpc, getSessionRegistryAddress } from '../../variables/chains.js';
import { normalizeBlockLimitsForConfig } from '../../utilities/session/blockLimits.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { sessionRegistryUtils } from '../../utilities/web3/sessionRegistry.js';
import { normalizeSlug } from './adminPageHelpers';

type AdminRecord = Record<string, unknown>;
type RpcUrlMap = Record<string, string[]>;

export type GetSessionReadRpcConfigArgs = {
  sessionConfig?: unknown;
  fallbackChainId?: unknown;
};

export type SessionReadRpcConfig = {
  chainId: number;
  rpcUrl: string;
};

export type BuildWorkerSessionConfigPayloadArgs = {
  sessionConfig?: unknown;
  account?: unknown;
  fallbackChainId?: unknown;
};

export type WorkerSessionConfigPayload = AdminRecord & {
  adminAddress: string;
};

export type WorkerUrlResolutionDisplay = {
  debug: string;
  status: string;
  url: string;
};

const asRecord = (value: unknown): AdminRecord => (value && typeof value === 'object' ? (value as AdminRecord) : {});

export const normalizeRpcUrlList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => toStr(entry).trim()).filter(Boolean);
  }
  const trimmed = toStr(value).trim();
  return trimmed ? [trimmed] : [];
};

export const sanitizeRpcUrlMap = (value: unknown): RpcUrlMap => {
  if (!value || typeof value !== 'object') return {};
  const out: RpcUrlMap = {};
  Object.entries(value as AdminRecord).forEach(([chainKey, urls]) => {
    const normalized = normalizeRpcUrlList(urls);
    if (normalized.length) out[String(chainKey)] = normalized;
  });
  return out;
};

export const pickFirstNonEmptyRpcUrlMap = (...candidates: unknown[]): RpcUrlMap =>
  candidates.reduce<RpcUrlMap>((found, candidate) => {
    if (found && Object.keys(found).length > 0) return found;
    const sanitized = sanitizeRpcUrlMap(candidate);
    return Object.keys(sanitized).length > 0 ? sanitized : found;
  }, {});

export const buildWorkerUrlResolutionDisplay = ({
  resolved,
  normalizeWorkerUrl,
}: {
  resolved?: unknown;
  normalizeWorkerUrl: (value: unknown) => string;
}): WorkerUrlResolutionDisplay => {
  const resolvedRecord = asRecord(resolved);
  const resolvedUrl = normalizeWorkerUrl(resolvedRecord.url || '');
  const url = resolvedUrl || '';
  const rawStatus = resolvedRecord.status;
  const status = rawStatus || 'ok';
  return {
    url,
    debug: `source=${resolvedRecord.source || 'unknown'} status=${toStr(status)} url=${resolvedUrl || '(none)'}`,
    status: url ? `Resolved (${toStr(status)})` : rawStatus ? `Missing (${toStr(rawStatus)})` : 'Missing worker URL',
  };
};

const mergeRpcUrlMaps = (...candidates: unknown[]): RpcUrlMap =>
  candidates.reduce<RpcUrlMap>((merged, candidate) => {
    const sanitized = sanitizeRpcUrlMap(candidate);
    Object.entries(sanitized).forEach(([chainId, urls]) => {
      if (!normalizeRpcUrlList(merged[chainId]).length && urls.length) {
        merged[chainId] = urls;
      }
    });
    return merged;
  }, {});

const getRpcUrlsForChain = (rpcUrlsByChainId: RpcUrlMap, chainId: unknown): string[] => {
  const numericChainId = Number(chainId || 0) || 0;
  if (!numericChainId) return [];
  return normalizeRpcUrlList(rpcUrlsByChainId[String(numericChainId)] || rpcUrlsByChainId[numericChainId]);
};

const getDefaultRpcForChain = (chainId: unknown, opts: AdminRecord = {}): string => {
  const numericChainId = Number(chainId || 0) || 0;
  if (!numericChainId) return '';
  return toStr(getDefaultHttpRpc(numericChainId, opts) || getDefaultHttpRpc(numericChainId)).trim();
};

export const getSessionReadRpcConfig = ({
  sessionConfig,
  fallbackChainId,
}: GetSessionReadRpcConfigArgs = {}): SessionReadRpcConfig => {
  const cfg = asRecord(sessionConfig);
  const registry = asRecord(cfg.__registry);
  const rpcRoot = asRecord(cfg.rpc);
  const rpcProviders = asRecord(rpcRoot.providers);
  const pathProvider = asRecord(rpcProviders.path);
  const faucetCfg = asRecord(cfg.faucet);
  const chainId =
    Number(cfg.networkChainId || registry.chainId || registry.registryChainId || fallbackChainId || 0) || 0;
  const rpcUrlsByChainId = mergeRpcUrlMaps(
    pathProvider.rpcUrlsByChainId,
    rpcRoot.rpcUrlsByChainId,
    cfg.rpcUrlsByChainId,
  );
  const chainRpcUrl = getRpcUrlsForChain(rpcUrlsByChainId, chainId)[0] || '';
  const defaultRpcUrl = getDefaultRpcForChain(chainId, { allowPath: false });
  const rpcUrl =
    normalizeRpcUrlList(faucetCfg.rpcUrl)[0] ||
    chainRpcUrl ||
    normalizeRpcUrlList(pathProvider.rpcUrl)[0] ||
    normalizeRpcUrlList(rpcRoot.rpcUrl)[0] ||
    normalizeRpcUrlList(cfg.rpcUrl)[0] ||
    defaultRpcUrl;
  return {
    chainId,
    rpcUrl: toStr(rpcUrl).trim(),
  };
};

const normalizeContractEntry = (entry: unknown, chainIdFallback: unknown): AdminRecord | null => {
  const entryRecord = asRecord(entry);
  if (!Object.keys(entryRecord).length) return null;
  const address = toStr(entryRecord.address || entryRecord.contractAddress || '').trim();
  const chainId = Number(entryRecord.chainId || entryRecord.networkChainId || chainIdFallback || 0) || 0;
  if (!address) return null;
  return {
    address,
    ...(chainId ? { chainId } : {}),
  };
};

export const buildWorkerSessionConfigPayload = ({
  sessionConfig,
  account,
  fallbackChainId,
}: BuildWorkerSessionConfigPayloadArgs = {}): WorkerSessionConfigPayload => {
  const cfg = asRecord(sessionConfig);
  const registry = asRecord(cfg.__registry);
  const rpcRoot = asRecord(cfg.rpc);
  const rpcProviders = asRecord(rpcRoot.providers);
  const pathProvider = asRecord(rpcProviders.path);
  const inferredSessionChainId = Number(cfg.networkChainId || fallbackChainId || 0) || 0;
  const registryChainId = Number(registry.registryChainId || registry.chainId || inferredSessionChainId || 0) || 0;
  const faucetCfg = asRecord(cfg.faucet);
  const genericRpcUrlFromConfig =
    normalizeRpcUrlList(pathProvider.rpcUrl)[0] ||
    normalizeRpcUrlList(rpcRoot.rpcUrl)[0] ||
    normalizeRpcUrlList(cfg.rpcUrl)[0] ||
    '';
  const rpcUrlsByChainId = mergeRpcUrlMaps(
    pathProvider.rpcUrlsByChainId,
    rpcRoot.rpcUrlsByChainId,
    cfg.rpcUrlsByChainId,
  );
  const sessionChainRpcUrl = getRpcUrlsForChain(rpcUrlsByChainId, inferredSessionChainId)[0] || '';
  const defaultSessionRpcUrl = getDefaultRpcForChain(inferredSessionChainId);
  const resolvedRpcUrl = sessionChainRpcUrl || genericRpcUrlFromConfig || defaultSessionRpcUrl;
  const resolvedRpcUrlsByChainId = { ...rpcUrlsByChainId };
  if (inferredSessionChainId && resolvedRpcUrl) {
    const key = String(inferredSessionChainId);
    if (!normalizeRpcUrlList(resolvedRpcUrlsByChainId[key]).length) {
      resolvedRpcUrlsByChainId[key] = [resolvedRpcUrl];
    }
  }
  if (registryChainId) {
    const key = String(registryChainId);
    const registryChainRpcUrl = getRpcUrlsForChain(resolvedRpcUrlsByChainId, registryChainId)[0] || '';
    const fallbackRegistryRpcUrl =
      registryChainRpcUrl ||
      (registryChainId === inferredSessionChainId ? resolvedRpcUrl : '') ||
      getDefaultRpcForChain(registryChainId);
    if (fallbackRegistryRpcUrl && !normalizeRpcUrlList(resolvedRpcUrlsByChainId[key]).length) {
      resolvedRpcUrlsByChainId[key] = [fallbackRegistryRpcUrl];
    }
  }
  const allowOriginsRaw = cfg.allowOrigins;
  const allowOrigins = Array.isArray(allowOriginsRaw)
    ? allowOriginsRaw.map((entry) => toStr(entry).trim()).filter(Boolean)
    : toStr(allowOriginsRaw)
        .split(/[\n,]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
  const limits = asRecord(cfg.limits);
  const scopes = asRecord(cfg.scopes);

  const out: WorkerSessionConfigPayload = {
    adminAddress: toStr(registry.adminAddress || cfg.adminAddress || account).trim(),
  };
  const slug = normalizeSlug(cfg.slug || '');
  const registryAddress = toStr(registry.registryAddress || registry.address || '').trim();
  const resolvedRegistryAddress =
    registryAddress ||
    toStr(
      registryChainId
        ? getSessionRegistryAddress(registryChainId) || sessionRegistryUtils.resolveRegistryAddress(registryChainId)
        : '',
    ).trim();
  const hatsAddress = toStr(registry.hatsAddress || cfg.hatsAddress || '').trim();
  const adminHatId = toStr(registry.adminHatId || cfg.adminHatId || '').trim();
  if (slug || slug === '') out.slug = slug;
  if (resolvedRegistryAddress) out.registryAddress = resolvedRegistryAddress;
  if (registryChainId) out.registryChainId = registryChainId;
  if (hatsAddress) out.hatsAddress = hatsAddress;
  if (adminHatId) out.adminHatId = adminHatId;
  if (inferredSessionChainId) {
    out.networkChainId = inferredSessionChainId;
  }
  const sessionId = toStr(registry.sessionId || registry.sessionIdHex || cfg.sessionId || '').trim();
  if (sessionId) out.sessionId = sessionId;
  if (resolvedRpcUrl) out.rpcUrl = resolvedRpcUrl;
  if (Object.keys(resolvedRpcUrlsByChainId).length) out.rpcUrlsByChainId = resolvedRpcUrlsByChainId;
  if (allowOrigins.length) out.allowOrigins = allowOrigins;
  if (Object.keys(limits).length) out.limits = limits;
  if (Object.keys(scopes).length) out.scopes = scopes;
  const blockLimits = normalizeBlockLimitsForConfig(cfg.blockLimits);
  if (blockLimits) out.blockLimits = blockLimits;

  const contractsObj = asRecord(cfg.contracts);
  const normalizedContracts: AdminRecord = {};
  Object.entries(contractsObj).forEach(([key, value]) => {
    const normalized = normalizeContractEntry(value, cfg.networkChainId || fallbackChainId);
    if (!normalized) return;
    normalizedContracts[key] = normalized;
  });
  if (Object.keys(normalizedContracts).length) out.contracts = normalizedContracts;

  const faucet: AdminRecord = {};
  const faucetChainId = Number(faucetCfg.chainId || faucetCfg.networkChainId || inferredSessionChainId || 0) || 0;
  const faucetChainRpcUrl = getRpcUrlsForChain(resolvedRpcUrlsByChainId, faucetChainId)[0] || '';
  const defaultFaucetRpcUrl = getDefaultRpcForChain(faucetChainId);
  const faucetRpcUrl =
    normalizeRpcUrlList(faucetCfg.rpcUrl)[0] ||
    faucetChainRpcUrl ||
    (faucetChainId === inferredSessionChainId ? resolvedRpcUrl : '') ||
    defaultFaucetRpcUrl ||
    resolvedRpcUrl;
  const faucetAmountEth = toStr(faucetCfg.amountEth).trim();
  const faucetBalanceThresholdEth = toStr(faucetCfg.balanceThresholdEth).trim();
  if (faucetRpcUrl) faucet.rpcUrl = faucetRpcUrl;
  if (faucetAmountEth) faucet.amountEth = faucetAmountEth;
  if (faucetBalanceThresholdEth) faucet.balanceThresholdEth = faucetBalanceThresholdEth;
  if (Object.keys(faucet).length) out.faucet = faucet;

  return out;
};
