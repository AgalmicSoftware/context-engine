import { getSessionContractsForChain, getSessionRegistryAddress } from '../../variables/chains.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { buildContractsPageHref } from '../ContractPage/contractMetadata.js';
import { buildContractViewerContracts } from '../ContractPage/contractViewerUtils.js';
import type {
  ChainIdLike,
  ContractViewerContractLike,
  NetworkLike,
  SessionContractLike,
  SessionContractsLike,
} from '../shellTypes';

type VisibleSessionWizardContractKey = 'surveys' | 'sbtFactory' | 'sessionRegistry';
type SessionWizardContractsRecord = Record<string, unknown>;

type SessionWizardContractViewerPlanInput = {
  activeSessionSlug?: unknown;
  draftContracts?: SessionContractsLike | null;
  draftNetworkChainId?: ChainIdLike;
  network?: NetworkLike;
  registryChainId?: ChainIdLike;
  resolvedActiveSessionSlug?: unknown;
  selectedContractKey?: unknown;
  selectorSourceSessionSlug?: unknown;
};

type SessionWizardContractViewerPlan = {
  contracts: ContractViewerContractLike[];
  resolvedChainId: number | null;
  selectedContract: ContractViewerContractLike | null;
  selectedContractHref: string;
  selectedContractSessionSlug: string;
};

export const SESSION_WIZARD_VISIBLE_CONTRACT_KEYS = Object.freeze([
  'surveys',
  'sbtFactory',
  'sessionRegistry',
] as const);

export const getSessionWizardContractDefaults = (chainId: unknown): SessionWizardContractsRecord => {
  const defaults = getSessionContractsForChain(chainId) as SessionWizardContractsRecord | null | undefined;
  const contracts: SessionWizardContractsRecord = defaults && typeof defaults === 'object' ? { ...defaults } : {};
  const registryAddress = toStr(getSessionRegistryAddress(chainId)).trim();
  if (registryAddress) {
    contracts.sessionRegistry = registryAddress;
  }
  return contracts;
};

export const resolveSessionWizardRegistryAddress = (
  chainId: unknown,
  contracts: SessionWizardContractsRecord | null | undefined,
): string => {
  const entry = contracts?.sessionRegistry;
  if (entry && typeof entry === 'object') {
    const entryRecord = entry as Record<string, unknown>;
    const manualFromObject = toStr(entryRecord.address || entryRecord.contractAddress || '').trim();
    if (manualFromObject) return manualFromObject;
  } else {
    const manual = toStr(entry).trim();
    if (manual) return manual;
  }
  return toStr(getSessionRegistryAddress(chainId)).trim();
};

export const getVisibleSessionWizardContractKeys = (..._args: unknown[]): VisibleSessionWizardContractKey[] => [
  ...SESSION_WIZARD_VISIBLE_CONTRACT_KEYS,
];

export const sanitizeSessionWizardContracts = (
  contracts: SessionWizardContractsRecord | null | undefined,
): Partial<Record<VisibleSessionWizardContractKey, Record<string, unknown>>> => {
  if (!contracts || typeof contracts !== 'object') return {};
  const nextContracts: Partial<Record<VisibleSessionWizardContractKey, Record<string, unknown>>> = {};
  SESSION_WIZARD_VISIBLE_CONTRACT_KEYS.forEach((key) => {
    const entry = contracts[key];
    if (entry && typeof entry === 'object') {
      nextContracts[key] = entry as Record<string, unknown>;
    }
  });
  return nextContracts;
};

export const resolveSessionWizardContractViewerPlan = ({
  activeSessionSlug = '',
  draftContracts = null,
  draftNetworkChainId = null,
  network = null,
  registryChainId = null,
  resolvedActiveSessionSlug = '',
  selectedContractKey = '',
  selectorSourceSessionSlug = '',
}: SessionWizardContractViewerPlanInput = {}): SessionWizardContractViewerPlan => {
  const sessionContracts = draftContracts && typeof draftContracts === 'object' ? draftContracts : {};
  const defaults = getSessionWizardContractDefaults(registryChainId);
  const visibleKeys = getVisibleSessionWizardContractKeys(sessionContracts, defaults);
  const resolvedChainId =
    Number(registryChainId || draftNetworkChainId || network?.id || network?.chainId || 0) || null;
  const mergedContracts = visibleKeys.reduce<SessionContractsLike>((acc, contractKey) => {
    const entry =
      sessionContracts[contractKey] && typeof sessionContracts[contractKey] === 'object'
        ? (sessionContracts[contractKey] as SessionContractLike)
        : {};
    const address = toStr(entry.address || '').trim() || toStr(defaults?.[contractKey] || '').trim();
    acc[contractKey] = {
      ...entry,
      address,
      chainId: Number(entry.chainId || resolvedChainId || 0) || null,
    };
    return acc;
  }, {});
  const contracts = buildContractViewerContracts({
    sessionContracts: mergedContracts,
    chainId: resolvedChainId,
    includeSessionRegistry: true,
    includeCustomSBT: false,
  });
  const normalizedSelectedContractKey = toStr(selectedContractKey).trim();
  const selectedContract = contracts.find((contract) => contract.key === normalizedSelectedContractKey) || null;
  const selectedContractSessionSlug = toStr(
    selectorSourceSessionSlug || activeSessionSlug || resolvedActiveSessionSlug || '',
  ).trim();
  const selectedContractHref = buildContractsPageHref({
    contractKey: selectedContract?.key || '',
    sessionSlug: selectedContractSessionSlug,
  });

  return {
    contracts,
    resolvedChainId,
    selectedContract,
    selectedContractHref,
    selectedContractSessionSlug,
  };
};
