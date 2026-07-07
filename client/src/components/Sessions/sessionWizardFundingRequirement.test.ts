import { SESSION_WIZARD_REQUIREMENT_LINKS } from './SessionWizardRequirementsBanner';
import { resolveSessionWizardFundingRequirement } from './sessionWizardFundingRequirement';

describe('resolveSessionWizardFundingRequirement', () => {
  it('links OP Sepolia funding to the Optimism faucet', () => {
    expect(resolveSessionWizardFundingRequirement({
      defaultChainId: 11155420,
      getChainById: (chainId) => ({
        id: chainId,
        name: 'OP Sepolia',
        nativeCurrency: { symbol: 'ETH' },
      }),
    })).toEqual({
      href: SESSION_WIZARD_REQUIREMENT_LINKS.optimismSepoliaFaucet,
      label: 'OP Sepolia ETH for on-chain registration',
    });
  });

  it('uses a chain-name fallback for unknown configured chains', () => {
    expect(resolveSessionWizardFundingRequirement({
      defaultChainId: 31337,
      getChainById: () => null,
      getChainName: () => 'Local Foundry',
    })).toEqual({
      href: '',
      label: 'Local Foundry ETH for on-chain registration',
    });
  });

  it('keeps an actionable label when no chain is configured', () => {
    expect(resolveSessionWizardFundingRequirement()).toEqual({
      href: '',
      label: 'Selected network ETH for on-chain registration',
    });
  });
});
