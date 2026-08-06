import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import {
  getSessionContractsForChain,
  getSessionRegistryAddress,
  getSessionRegistryChains,
} from '../../variables/chains.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { buildContractsPageHref } from '../DocsPage/contractMetadata.js';
import { buildContractViewerContracts } from '../DocsPage/contractViewerUtils.js';
import type {
  ChainIdLike,
  ContractViewerContractLike,
  NetworkLike,
  SessionContractLike,
  SessionContractsLike,
} from '../shellTypes';

export type VisibleSessionWizardContractKey = 'surveys' | 'sbtFactory' | 'sessionRegistry';
type SessionWizardContractsRecord = Record<string, unknown>;

type SessionWizardInitialRegistryChainInput = {
  draftChainId?: ChainIdLike;
  networkChainId?: ChainIdLike;
};

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

export const resolveSessionWizardInitialRegistryChainId = ({
  draftChainId,
  networkChainId,
}: SessionWizardInitialRegistryChainInput = {}): number => {
  const configuredCandidates = [draftChainId, networkChainId, DEFAULT_CHAIN_ID];
  for (const candidate of configuredCandidates) {
    const chainId = Number(candidate || 0);
    if (chainId && getSessionRegistryAddress(chainId)) return chainId;
  }
  const firstAvailableChainId = Number(getSessionRegistryChains()[0]?.id || 0);
  return firstAvailableChainId || Number(DEFAULT_CHAIN_ID || 0) || 0;
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

export const getVisibleSessionWizardContractKeys = (
  _contracts?: unknown,
  _defaults?: unknown,
  allowedKeys?: readonly string[] | null,
): VisibleSessionWizardContractKey[] => {
  const allowed = Array.isArray(allowedKeys) ? new Set(allowedKeys) : null;
  return SESSION_WIZARD_VISIBLE_CONTRACT_KEYS.filter((key) => !allowed || allowed.has(key));
};

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
