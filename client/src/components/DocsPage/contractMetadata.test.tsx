import { buildDocsContractsHref, getContractDisplayName, getContractExplainer } from './contractMetadata.js';
import { t } from '../../utilities/ui/terminology.js';

describe('contractMetadata terminology', () => {
  const originalPublicUrl = process.env.PUBLIC_URL;

  afterEach(() => {
    if (typeof originalPublicUrl === 'undefined') {
      delete process.env.PUBLIC_URL;
    } else {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
  });

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

  it('builds Docs smart-contract links with normalized deep-link parameters', () => {
    expect(buildDocsContractsHref({ contractKey: 'surveys', sessionSlug: 'session-alpha' })).toBe(
      '/docs?contract=surveys&session=session-alpha',
    );
    expect(buildDocsContractsHref({ contractKey: 'not-supported', sessionSlug: '' })).toBe('/docs');
  });

  it('keeps Docs smart-contract links under PUBLIC_URL deployments', () => {
    process.env.PUBLIC_URL = '/ce/';

    expect(buildDocsContractsHref({ contractKey: 'sessionRegistry', sessionSlug: 'session-alpha' })).toBe(
      '/ce/docs?contract=sessionRegistry&session=session-alpha',
    );
  });
});
