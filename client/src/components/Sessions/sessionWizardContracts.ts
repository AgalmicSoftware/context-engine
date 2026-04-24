import { getSessionContractsForChain, getSessionRegistryAddress } from '../../variables/chains.js';
import { toStr } from '../../utilities/shared/primitives.js';

type VisibleSessionWizardContractKey = 'surveys' | 'sbtFactory' | 'sessionRegistry';
type SessionWizardContractsRecord = Record<string, unknown>;

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
  contracts: SessionWizardContractsRecord | null | undefined
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
  ..._args: unknown[]
): VisibleSessionWizardContractKey[] => (
  [...SESSION_WIZARD_VISIBLE_CONTRACT_KEYS]
);

export const sanitizeSessionWizardContracts = (
  contracts: SessionWizardContractsRecord | null | undefined
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
