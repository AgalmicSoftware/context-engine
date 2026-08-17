import { toStr } from '../../utilities/shared/primitives.js';
import { SESSION_WIZARD_REQUIREMENT_LINKS } from './SessionWizardRequirementsBanner';

type ChainLike =
  | {
      id?: number | string | null;
      name?: unknown;
      nativeCurrency?: {
        symbol?: unknown;
      } | null;
    }
  | null
  | undefined;

type ResolveFundingRequirementArgs = {
  defaultChainId?: number | string | null;
  getChainById?: (chainId: number) => ChainLike;
  getChainName?: (chainId: number | string | null | undefined) => string;
  registryChainId?: number | string | null;
  purpose?: 'registration' | 'SBT publishing';
};

export const resolveSessionWizardFundingRequirement = ({
  defaultChainId = 0,
  getChainById = () => null,
  getChainName = () => '',
  registryChainId = 0,
  purpose = 'registration',
}: ResolveFundingRequirementArgs = {}): { href: string; label: string } => {
  const chainId = Number(registryChainId || defaultChainId || 0) || 0;
  const chain =
    getChainById(chainId) ||
    (chainId
      ? { id: chainId, name: getChainName(chainId) || `Chain ${chainId}`, nativeCurrency: { symbol: 'ETH' } }
      : null);
  const chainName = toStr(chain?.name).trim();
  const chainSymbol = toStr(chain?.nativeCurrency?.symbol).trim() || 'ETH';
  return {
    label: `${chainName || 'Selected network'} ${chainSymbol} for on-chain ${purpose}`,
    href: Number(chain?.id || 0) === 11155420 ? SESSION_WIZARD_REQUIREMENT_LINKS.optimismSepoliaFaucet : '',
  };
};
