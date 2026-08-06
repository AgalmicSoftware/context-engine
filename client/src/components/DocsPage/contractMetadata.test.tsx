import { getContractDisplayName, getContractExplainer } from './contractMetadata.js';
import { t } from '../../utilities/ui/terminology.js';

describe('contractMetadata terminology', () => {
  it('uses terminology-aware display names for SBT contracts', () => {
    expect(getContractDisplayName('sbtFactory')).toBe(`${t('sbt')} Factory`);
    expect(getContractDisplayName('customSBT')).toBe(`Custom ${t('sbt')} (Template)`);
  });

  it('uses terminology-aware explainers for SBT contracts', () => {
    expect(getContractExplainer('sbtFactory')).toBe(
      `Allows anyone to easily create ${t('sbtFull')}s (Non-transferrable NFTs) to signify event participation, ${t('sbtLower')} membership, or public belief / association.`,
    );
    expect(getContractExplainer('customSBT')).toBe(
      `${t('sbtFull')} contract template deployed by ${t('sbt')} Factory for each ${t('sbtLower')}. Non-transferable ERC-721.`,
    );
  });
});
