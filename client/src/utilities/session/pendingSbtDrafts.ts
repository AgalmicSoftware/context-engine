import { toStr } from '../shared/primitives.js';

type PendingSbtContractEntry = {
  address?: string;
  chainId?: number;
};

type PendingSbtContractsMap = Record<string, PendingSbtContractEntry>;
type SessionConfigLike = Record<string, any>;

type BuildPendingSbtDeploySessionConfigOptions = {
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  networkChainId?: unknown;
  contracts?: unknown;
};

const normalizePendingSbtContractEntry = (value: unknown): PendingSbtContractEntry | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    const address = toStr(value).trim();
    return address ? { address } : null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as SessionConfigLike;

  const address = toStr(
    source.address ||
    source.contractAddress ||
    source.addr ||
    source.target ||
    ''
  ).trim();
  const chainId = Number(
    source.chainId ||
    source.chainID ||
    source.networkChainId ||
    source.chain ||
    0
  ) || null;

  if (!address && !chainId) return null;

  return {
    ...(address ? { address } : {}),
    ...(chainId ? { chainId } : {}),
  };
};

export const clonePendingSbtDeployContracts = (
  contractsIn: unknown = {}
): PendingSbtContractsMap => {
  if (!contractsIn || typeof contractsIn !== 'object' || Array.isArray(contractsIn)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(contractsIn)
      .map(([key, value]) => [key, normalizePendingSbtContractEntry(value)])
      .filter(([, value]) => !!value)
  ) as PendingSbtContractsMap;
};

export const buildPendingSbtDeploySessionConfig = ({
  sessionConfig,
  sessionSlug = '',
  networkChainId = null,
  contracts = null,
}: BuildPendingSbtDeploySessionConfigOptions = {}): (
  { slug?: string; networkChainId?: number; contracts: PendingSbtContractsMap } | null
) => {
  const source = (
    sessionConfig &&
    typeof sessionConfig === 'object' &&
    !Array.isArray(sessionConfig)
  ) ? sessionConfig as SessionConfigLike : {};

  const slug = toStr(source.slug || source.sessionSlug || sessionSlug).trim();
  const resolvedNetworkChainId = Number(
    source.networkChainId ||
    source.chainId ||
    networkChainId ||
    0
  ) || null;
  const resolvedContracts = clonePendingSbtDeployContracts(
    isObj(contracts)
      ? contracts
      : source.contracts
  );

  if (!slug && !resolvedNetworkChainId && !Object.keys(resolvedContracts).length) {
    return null;
  }

  return {
    ...(slug ? { slug } : {}),
    ...(resolvedNetworkChainId ? { networkChainId: resolvedNetworkChainId } : {}),
    contracts: resolvedContracts,
  };
};
