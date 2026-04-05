import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import { getSessionContractsForChain, getSessionRegistryAddress } from '../../variables/chains.js';
import {
  getSessionWizardContractDefaults,
  getVisibleSessionWizardContractKeys,
  resolveSessionWizardRegistryAddress,
  sanitizeSessionWizardContracts,
} from './sessionWizardContracts.js';

const DEFAULT_CONFIG_CHAIN_ID = DEFAULT_CHAIN_ID;

describe('sessionWizardContracts', () => {
  test('defaults include session registry address from chains config', () => {
    const chainContracts = getSessionContractsForChain(DEFAULT_CONFIG_CHAIN_ID);
    const defaults = getSessionWizardContractDefaults(DEFAULT_CONFIG_CHAIN_ID);

    expect(defaults.surveys).toBe(chainContracts.surveys);
    expect(defaults.sbtFactory).toBe(chainContracts.sbtFactory);
    expect(defaults.sessionRegistry).toBe(getSessionRegistryAddress(DEFAULT_CONFIG_CHAIN_ID));
  });

  test('defaults omit session registry when chains config has none', () => {
    const defaults = getSessionWizardContractDefaults(84532);
    expect(defaults).toEqual({});
  });

  test('visible contract keys include session registry row', () => {
    expect(getVisibleSessionWizardContractKeys()).toEqual([
      'surveys',
      'sbtFactory',
      'sessionRegistry',
    ]);
  });

  test('registry resolver prefers manual contract address over chain default', () => {
    expect(resolveSessionWizardRegistryAddress(DEFAULT_CONFIG_CHAIN_ID, {
      sessionRegistry: { address: '0xabc' },
    })).toBe('0xabc');
  });

  test('registry resolver falls back to chain default when manual value is empty', () => {
    expect(resolveSessionWizardRegistryAddress(DEFAULT_CONFIG_CHAIN_ID, {
      sessionRegistry: { address: '' },
    })).toBe(getSessionRegistryAddress(DEFAULT_CONFIG_CHAIN_ID));
  });

  test('sanitize keeps visible contracts and drops hidden entries', () => {
    const contracts: SessionWizardContractsInput = {
      surveys: { address: '0x111', chainId: 84532 },
      sbtFactory: { address: '0x222', chainId: 84532 },
      sessionRegistry: { address: '0x333', chainId: 84532 },
      reputation: { address: '0x444', chainId: 84532 },
      invalid: '0x555',
    };
    expect(sanitizeSessionWizardContracts(contracts)).toEqual({
      surveys: { address: '0x111', chainId: 84532 },
      sbtFactory: { address: '0x222', chainId: 84532 },
      sessionRegistry: { address: '0x333', chainId: 84532 },
    });
  });
});
