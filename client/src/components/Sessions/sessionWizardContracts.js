import { getSessionContractsForChain, getSessionRegistryAddress } from '../../variables/chains.js';
import { toStr } from '../../utilities/shared/primitives.js';

export const SESSION_WIZARD_VISIBLE_CONTRACT_KEYS = Object.freeze([
  'surveys',
  'sbtFactory',
  'sessionRegistry',
]);

export const getSessionWizardContractDefaults = (chainId) => {
  const defaults = getSessionContractsForChain(chainId);
  const contracts = defaults && typeof defaults === 'object' ? { ...defaults } : {};
  const registryAddress = toStr(getSessionRegistryAddress(chainId)).trim();
  if (registryAddress) {
    contracts.sessionRegistry = registryAddress;
  }
  return contracts;
};

export const resolveSessionWizardRegistryAddress = (chainId, contracts) => {
  const entry = contracts?.sessionRegistry;
  if (entry && typeof entry === 'object') {
    const manualFromObject = toStr(entry.address || entry.contractAddress || '').trim();
    if (manualFromObject) return manualFromObject;
  } else {
    const manual = toStr(entry).trim();
    if (manual) return manual;
  }
  return toStr(getSessionRegistryAddress(chainId)).trim();
};

export const getVisibleSessionWizardContractKeys = () => (
  [...SESSION_WIZARD_VISIBLE_CONTRACT_KEYS]
);

export const sanitizeSessionWizardContracts = (contracts) => {
  if (!contracts || typeof contracts !== 'object') return {};
  const nextContracts = {};
  SESSION_WIZARD_VISIBLE_CONTRACT_KEYS.forEach((key) => {
    const entry = contracts[key];
    if (entry && typeof entry === 'object') {
      nextContracts[key] = entry;
    }
  });
  return nextContracts;
};
