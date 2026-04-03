import { getSessionContractsForChain, getSessionRegistryAddress } from '../../variables/chains.js';
import {
  getSessionWizardContractDefaults,
  getVisibleSessionWizardContractKeys,
  resolveSessionWizardRegistryAddress,
  sanitizeSessionWizardContracts,
} from './sessionWizardContracts.js';

describe('sessionWizardContracts', () => {
  test('defaults include session registry address from chains config', () => {
    const chainContracts = getSessionContractsForChain(84532);
    const defaults = getSessionWizardContractDefaults(84532);

    expect(defaults.surveys).toBe(chainContracts.surveys);
    expect(defaults.sbtFactory).toBe(chainContracts.sbtFactory);
    expect(defaults.sessionRegistry).toBe(getSessionRegistryAddress(84532));
  });

  test('defaults omit session registry when chains config has none', () => {
    const defaults = getSessionWizardContractDefaults(8453);
    expect(defaults.sessionRegistry).toBeUndefined();
  });

  test('visible contract keys include session registry row', () => {
    expect(getVisibleSessionWizardContractKeys()).toEqual([
      'surveys',
      'sbtFactory',
      'sessionRegistry',
    ]);
  });

  test('registry resolver prefers manual contract address over chain default', () => {
    expect(resolveSessionWizardRegistryAddress(84532, {
      sessionRegistry: { address: '0xabc' },
    })).toBe('0xabc');
  });

  test('registry resolver falls back to chain default when manual value is empty', () => {
    expect(resolveSessionWizardRegistryAddress(84532, {
      sessionRegistry: { address: '' },
    })).toBe(getSessionRegistryAddress(84532));
  });

  test('sanitize keeps visible contracts and drops hidden entries', () => {
    const contracts = {
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
