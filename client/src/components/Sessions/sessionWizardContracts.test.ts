import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';
import { getSessionContractsForChain, getSessionRegistryAddress } from '../../variables/chains.js';
import {
  getSessionWizardContractDefaults,
  getVisibleSessionWizardContractKeys,
  resolveSessionWizardContractViewerPlan,
  resolveSessionWizardRegistryAddress,
  sanitizeSessionWizardContracts,
} from './sessionWizardContracts.js';

const DEFAULT_CONFIG_CHAIN_ID = DEFAULT_CHAIN_ID;
type SessionWizardContractsInput = Record<string, unknown>;

describe('sessionWizardContracts', () => {
  test('defaults include session registry address from chains config', () => {
    const chainContracts = getSessionContractsForChain(DEFAULT_CONFIG_CHAIN_ID) as SessionWizardContractsInput;
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
    expect(getVisibleSessionWizardContractKeys()).toEqual(['surveys', 'sbtFactory', 'sessionRegistry']);
  });

  test('registry resolver prefers manual contract address over chain default', () => {
    expect(
      resolveSessionWizardRegistryAddress(DEFAULT_CONFIG_CHAIN_ID, {
        sessionRegistry: { address: '0xabc' },
      }),
    ).toBe('0xabc');
  });

  test('registry resolver falls back to chain default when manual value is empty', () => {
    expect(
      resolveSessionWizardRegistryAddress(DEFAULT_CONFIG_CHAIN_ID, {
        sessionRegistry: { address: '' },
      }),
    ).toBe(getSessionRegistryAddress(DEFAULT_CONFIG_CHAIN_ID));
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

  test('contract viewer plan selects the requested contract and builds its route href', () => {
    const plan = resolveSessionWizardContractViewerPlan({
      draftContracts: {
        surveys: { address: '0x111', chainId: 84532 },
        sbtFactory: { address: '0x222', chainId: 84532 },
        sessionRegistry: { address: '0x333', chainId: 84532 },
      },
      registryChainId: 84532,
      selectedContractKey: 'surveys',
      selectorSourceSessionSlug: 'source-session',
      activeSessionSlug: 'active-session',
      resolvedActiveSessionSlug: 'resolved-session',
    });

    expect(plan.resolvedChainId).toBe(84532);
    expect(plan.selectedContract?.key).toBe('surveys');
    expect(plan.selectedContractHref).toBe('/contracts?contract=surveys&session=source-session');
    expect(plan.selectedContractSessionSlug).toBe('source-session');
    expect(plan.contracts.map((contract) => contract.key)).toEqual(['surveys', 'sbtFactory', 'sessionRegistry']);
  });

  test('contract viewer plan fills visible defaults without adding the custom SBT template', () => {
    const defaults = getSessionWizardContractDefaults(DEFAULT_CONFIG_CHAIN_ID);
    const plan = resolveSessionWizardContractViewerPlan({
      draftContracts: {},
      registryChainId: DEFAULT_CONFIG_CHAIN_ID,
      network: { id: 84532 },
      selectedContractKey: 'sessionRegistry',
      activeSessionSlug: 'active-session',
    });
    const registryContract = plan.contracts.find((contract) => contract.key === 'sessionRegistry');

    expect(plan.resolvedChainId).toBe(Number(DEFAULT_CONFIG_CHAIN_ID));
    expect(registryContract?.addresses?.[0]?.address).toBe(defaults.sessionRegistry);
    expect(plan.contracts.some((contract) => contract.key === 'customSBT')).toBe(false);
    expect(plan.selectedContract?.key).toBe('sessionRegistry');
    expect(plan.selectedContractHref).toBe('/contracts?contract=sessionRegistry&session=active-session');
  });

  test('contract viewer plan falls back to the resolved active session slug', () => {
    const plan = resolveSessionWizardContractViewerPlan({
      draftContracts: {
        surveys: { address: '0x111', chainId: 84532 },
      },
      draftNetworkChainId: 84532,
      selectedContractKey: 'missing',
      resolvedActiveSessionSlug: 'resolved-session',
    });

    expect(plan.selectedContract).toBeNull();
    expect(plan.selectedContractHref).toBe('/contracts?session=resolved-session');
    expect(plan.selectedContractSessionSlug).toBe('resolved-session');
  });
});
