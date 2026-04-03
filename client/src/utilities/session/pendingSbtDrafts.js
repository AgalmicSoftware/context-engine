import { toStr } from '../shared/primitives.js';

const normalizePendingSbtContractEntry = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const address = toStr(value).trim();
    return address ? { address } : null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const address = toStr(
    value.address ||
    value.contractAddress ||
    value.addr ||
    value.target ||
    ''
  ).trim();
  const chainId = Number(
    value.chainId ||
    value.chainID ||
    value.networkChainId ||
    value.chain ||
    0
  ) || null;

  if (!address && !chainId) return null;

  return {
    ...(address ? { address } : {}),
    ...(chainId ? { chainId } : {}),
  };
};

export const clonePendingSbtDeployContracts = (contractsIn = {}) => {
  if (!contractsIn || typeof contractsIn !== 'object' || Array.isArray(contractsIn)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(contractsIn)
      .map(([key, value]) => [key, normalizePendingSbtContractEntry(value)])
      .filter(([, value]) => !!value)
  );
};

export const buildPendingSbtDeploySessionConfig = ({
  sessionConfig,
  sessionSlug = '',
  networkChainId = null,
  contracts = null,
} = {}) => {
  const source = (
    sessionConfig &&
    typeof sessionConfig === 'object' &&
    !Array.isArray(sessionConfig)
  ) ? sessionConfig : {};

  const slug = toStr(source.slug || source.sessionSlug || sessionSlug).trim();
  const resolvedNetworkChainId = Number(
    source.networkChainId ||
    source.chainId ||
    networkChainId ||
    0
  ) || null;
  const resolvedContracts = clonePendingSbtDeployContracts(
    contracts && typeof contracts === 'object' && !Array.isArray(contracts)
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
