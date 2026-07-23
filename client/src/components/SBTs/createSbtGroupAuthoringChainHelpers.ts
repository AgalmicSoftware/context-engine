export type NormalizedSessionContractRef = {
  address?: string;
  chainId?: number;
};

export type CreateSbtAuthoringChainOption = Record<string, unknown> & {
  id?: string | number;
  name?: string;
};

export type CreateSbtAuthoringChainState = {
  chainId: number | null;
  chain: CreateSbtAuthoringChainOption | 'not connected';
};

type CreateSbtSessionContractsResolver = (chainId: unknown) => unknown;
type CreateSbtSessionRegistryChainsResolver = () => unknown;
type CreateSbtAuthoringChainUsabilityChecker = (chainId: unknown) => boolean;
type CreateSbtSessionContractRefResolver = (args: {
  contractKey: string;
  sessionConfig?: Record<string, unknown> | null;
}) => unknown;

export type BuildCreateSbtAuthoringChainSyncPatchArgs = {
  currentDistributionNetwork?: unknown;
  currentNetwork?: unknown;
  syncedAuthoringChain?: unknown;
};

export type BuildCreateSbtAuthoringChainSyncStatePatchArgs = {
  currentDistribution?: unknown;
  syncPatch?: { network?: unknown; sbtDistributionNetwork?: unknown } | null;
};

export type ResolveCreateSbtAuthoringChainOptionsArgs = {
  getSessionRegistryChains?: CreateSbtSessionRegistryChainsResolver | null;
  hasUsableSbtFactoryForChain?: CreateSbtAuthoringChainUsabilityChecker | null;
};

export type ResolveCreateSbtPreferredAuthoringChainIdArgs = {
  availableChainIds?: unknown[];
  network?: unknown;
  preferConnectedNetworkForAuthoring?: boolean;
  resolvedSessionConfig?: Record<string, unknown> | null;
  selectedChainId?: unknown;
  sessionConfigOverride?: Record<string, unknown> | null;
};

export type BuildCreateSbtAuthoringContractRefsArgs = {
  getSessionContractsForChain?: CreateSbtSessionContractsResolver | null;
  networkId?: unknown;
  resolveSessionContractRef?: CreateSbtSessionContractRefResolver | null;
  sessionConfig?: Record<string, unknown> | null;
};

const CREATE_SBT_AUTHORING_CHAIN_CONTRACT_KEYS = Object.freeze(['surveys', 'sbtFactory']);

const isCreateSbtAuthoringPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const normalizeCreateSbtAuthoringText = (value: unknown): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\[object\s+object\]$/i.test(text)) return '';
  return text;
};

export const normalizePositiveChainId = (value: unknown): number | null => {
  const id = Number(value || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
};

export const resolveCreateSbtCachedDistributionChainId = (distributionPayload: unknown = {}): number | null => {
  const distribution = isCreateSbtAuthoringPlainObject(distributionPayload) ? distributionPayload : {};
  const cachedNetwork = distribution.network;
  const cachedNetworkRecord = isCreateSbtAuthoringPlainObject(cachedNetwork) ? cachedNetwork : {};
  return normalizePositiveChainId(cachedNetworkRecord.id || cachedNetworkRecord.chainId || cachedNetwork);
};

export const buildCreateSbtAuthoringChainSyncPatch = ({
  currentDistributionNetwork = null,
  currentNetwork = '',
  syncedAuthoringChain = {},
}: BuildCreateSbtAuthoringChainSyncPatchArgs = {}): { network: unknown; sbtDistributionNetwork: unknown } | null => {
  const syncedChain = isCreateSbtAuthoringPlainObject(syncedAuthoringChain) ? syncedAuthoringChain : {};
  const syncedChainId = syncedChain.chainId;
  const distributionNetwork = isCreateSbtAuthoringPlainObject(currentDistributionNetwork)
    ? currentDistributionNetwork
    : {};
  const currentDistributionChainId = normalizePositiveChainId(
    distributionNetwork.id || distributionNetwork.chainId || currentDistributionNetwork,
  );
  const nextDistributionNetwork = syncedChain.chain;
  const syncedChainName = isCreateSbtAuthoringPlainObject(nextDistributionNetwork)
    ? nextDistributionNetwork.name
    : undefined;
  if (
    (currentNetwork || '') !== (syncedChainId || '') ||
    currentDistributionChainId !== syncedChainId ||
    distributionNetwork.name !== syncedChainName
  ) {
    return {
      network: syncedChainId || '',
      sbtDistributionNetwork: nextDistributionNetwork,
    };
  }
  return null;
};

export const buildCreateSbtAuthoringChainSyncStatePatch = ({
  currentDistribution = {},
  syncPatch = null,
}: BuildCreateSbtAuthoringChainSyncStatePatchArgs = {}): Record<string, unknown> | null => {
  if (!syncPatch) return null;
  return {
    network: syncPatch.network,
    sbtDistribution: {
      ...(currentDistribution as Record<string, unknown>),
      network: syncPatch.sbtDistributionNetwork,
    },
  };
};

export const getConfiguredContractAddress = (value: unknown): string =>
  normalizeCreateSbtAuthoringText(isCreateSbtAuthoringPlainObject(value) ? value.address : value);

export const hasUsableCreateSbtFactoryForChain = ({
  chainId = null,
  getSessionContractsForChain = null,
}: {
  chainId?: unknown;
  getSessionContractsForChain?: CreateSbtSessionContractsResolver | null;
} = {}): boolean => {
  const chainContracts =
    typeof getSessionContractsForChain === 'function' ? getSessionContractsForChain(chainId) : null;
  const contracts = isCreateSbtAuthoringPlainObject(chainContracts) ? chainContracts : {};
  return getConfiguredContractAddress(contracts.sbtFactory) !== '';
};

export const shouldHideCreateSbtNetworkSelector = ({
  deferredDeploy = false,
  hideNetworkSelector = false,
}: {
  deferredDeploy?: unknown;
  hideNetworkSelector?: unknown;
} = {}): boolean => !!hideNetworkSelector || !!deferredDeploy;

export const selectPreferredChainId = (candidateIds?: unknown[], availableChainIds?: unknown[]): number | null => {
  const normalizedCandidates = (candidateIds === undefined ? [] : candidateIds)
    .map((value: unknown) => normalizePositiveChainId(value))
    .filter((id): id is number => id !== null);
  const allowedIds = new Set<number>(
    (Array.isArray(availableChainIds) ? availableChainIds : [])
      .map((value: unknown) => normalizePositiveChainId(value))
      .filter((id): id is number => id !== null),
  );
  if (allowedIds.size > 0) {
    const allowedMatch = normalizedCandidates.find((id) => allowedIds.has(id));
    if (allowedMatch) return allowedMatch;
  }
  return normalizedCandidates[0] || null;
};

export const resolveCreateSbtAuthoringChainState = ({
  chainId = null,
  chainOptions = [],
  getChainById: getChainByIdFn = null,
}: {
  chainId?: number | null;
  chainOptions?: unknown;
  getChainById?: ((chainId: number) => unknown) | null;
} = {}): CreateSbtAuthoringChainState => {
  const selectedChain =
    (Array.isArray(chainOptions) ? chainOptions : []).find(
      (option) => isCreateSbtAuthoringPlainObject(option) && option.id === chainId,
    ) || (typeof getChainByIdFn === 'function' ? getChainByIdFn(chainId || 0) : null);
  return {
    chainId,
    chain: chainId
      ? (isCreateSbtAuthoringPlainObject(selectedChain) ? (selectedChain as CreateSbtAuthoringChainOption) : null) || {
          id: chainId,
          name: `Chain ${chainId}`,
        }
      : 'not connected',
  };
};

export const resolveCreateSbtAuthoringChainOptions = ({
  getSessionRegistryChains = null,
  hasUsableSbtFactoryForChain = null,
}: ResolveCreateSbtAuthoringChainOptionsArgs = {}): CreateSbtAuthoringChainOption[] => {
  const chains = typeof getSessionRegistryChains === 'function' ? getSessionRegistryChains() : [];
  return (Array.isArray(chains) ? chains : []).filter(
    (chain: unknown): chain is CreateSbtAuthoringChainOption =>
      isCreateSbtAuthoringPlainObject(chain) &&
      typeof hasUsableSbtFactoryForChain === 'function' &&
      hasUsableSbtFactoryForChain(chain.id),
  );
};

export const resolveCreateSbtPreferredAuthoringChainId = ({
  availableChainIds = [],
  network = null,
  preferConnectedNetworkForAuthoring = false,
  resolvedSessionConfig = null,
  selectedChainId = null,
  sessionConfigOverride = null,
}: ResolveCreateSbtPreferredAuthoringChainIdArgs = {}): number | null => {
  const networkRecord = isCreateSbtAuthoringPlainObject(network) ? network : {};
  const connectedNetworkCandidates = [networkRecord.id, networkRecord.chainId];
  const sessionNetworkCandidates = [sessionConfigOverride?.networkChainId, resolvedSessionConfig?.networkChainId];
  // Registry and hybrid sessions author on their configured chain. Standalone
  // SBT tooling opened from a pure Worker session has no session-owned chain,
  // so its connected network must take precedence over legacy metadata.
  return selectPreferredChainId(
    [
      selectedChainId,
      ...(preferConnectedNetworkForAuthoring ? connectedNetworkCandidates : sessionNetworkCandidates),
      ...(preferConnectedNetworkForAuthoring ? sessionNetworkCandidates : connectedNetworkCandidates),
    ],
    availableChainIds,
  );
};

export const normalizeSessionContractRef = (
  value: unknown,
  fallbackChainId?: unknown,
): NormalizedSessionContractRef | null => {
  const contractRef = isCreateSbtAuthoringPlainObject(value) ? { ...value } : {};
  const address = getConfiguredContractAddress(value);
  const chainId = normalizePositiveChainId(
    contractRef.chainId || contractRef.chainID || contractRef.networkChainId || contractRef.chain || fallbackChainId,
  );
  if (!address && !chainId) return null;
  return {
    ...(address ? { address } : {}),
    ...(chainId ? { chainId } : {}),
  };
};

export const contractRefMatchesChain = (
  contractRef: Record<string, unknown> | null | undefined,
  targetChainId: number | null,
  fallbackChainId?: unknown,
): boolean => {
  if (!contractRef?.address) return false;
  const effectiveChainId = normalizePositiveChainId(contractRef.chainId || fallbackChainId);
  if (!effectiveChainId) return true;
  return effectiveChainId === targetChainId;
};

export const buildCreateSbtAuthoringContractRefs = ({
  getSessionContractsForChain = null,
  networkId = null,
  resolveSessionContractRef = null,
  sessionConfig = null,
}: BuildCreateSbtAuthoringContractRefsArgs = {}): Record<string, NormalizedSessionContractRef> => {
  const selectedChainId = normalizePositiveChainId(networkId);
  if (!selectedChainId) return {};

  const normalizedSessionConfig = isCreateSbtAuthoringPlainObject(sessionConfig) ? sessionConfig : {};
  const baseContracts: Record<string, unknown> = isCreateSbtAuthoringPlainObject(normalizedSessionConfig.contracts)
    ? normalizedSessionConfig.contracts
    : {};
  const sessionChainId = normalizePositiveChainId(normalizedSessionConfig.networkChainId);
  const rawChainDefaultContracts =
    typeof getSessionContractsForChain === 'function' ? getSessionContractsForChain(selectedChainId) : null;
  const chainDefaultContracts: Record<string, unknown> = isCreateSbtAuthoringPlainObject(rawChainDefaultContracts)
    ? rawChainDefaultContracts
    : {};
  const contractKeys = new Set<string>([
    ...Object.keys(baseContracts),
    ...Object.keys(chainDefaultContracts),
    ...CREATE_SBT_AUTHORING_CHAIN_CONTRACT_KEYS,
  ]);
  const contracts: Record<string, NormalizedSessionContractRef> = {};

  contractKeys.forEach((key) => {
    const sessionResolvedRef =
      CREATE_SBT_AUTHORING_CHAIN_CONTRACT_KEYS.includes(key) && typeof resolveSessionContractRef === 'function'
        ? resolveSessionContractRef({ sessionConfig: normalizedSessionConfig, contractKey: key })
        : null;
    const sessionResolvedRefRecord = isCreateSbtAuthoringPlainObject(sessionResolvedRef) ? sessionResolvedRef : {};
    const explicitSessionContractRef = normalizeSessionContractRef(baseContracts[key], sessionChainId);
    const aliasSessionContractRef = normalizeSessionContractRef(
      sessionResolvedRefRecord.address || sessionResolvedRefRecord.chainId ? sessionResolvedRefRecord : null,
      sessionChainId,
    );
    const sessionContractRef = explicitSessionContractRef || aliasSessionContractRef;
    const chainDefaultRef = normalizeSessionContractRef(chainDefaultContracts[key], selectedChainId);

    // Regression guard: when the authoring chain changes, keep only session-specific
    // contracts that already belong to that chain; otherwise swap to that chain's defaults.
    const resolvedRef =
      chainDefaultRef?.address && !contractRefMatchesChain(sessionContractRef, selectedChainId, sessionChainId)
        ? chainDefaultRef
        : sessionContractRef || chainDefaultRef;

    if (!resolvedRef) return;
    const resolvedChainId = normalizePositiveChainId(resolvedRef.chainId || selectedChainId);
    contracts[key] = {
      ...resolvedRef,
      ...(resolvedChainId ? { chainId: resolvedChainId } : {}),
    };
  });

  return contracts;
};
