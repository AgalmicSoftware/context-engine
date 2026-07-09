import {
  resolveSbtPageAdminCreatorAddresses,
  resolveSbtPageBurnAuthLabel,
  resolveSbtPageMaxTokensDisplay,
  resolveSbtPageRelevantInfoDisplayState,
  resolveSbtPageRelevantInfoLists,
  toSbtPageDocumentUrlList,
  toStringList,
} from './sbtPageMetadataDisplayHelpers';

describe('sbtPageMetadataDisplayHelpers', () => {
  it('formats burn auth, max tokens, and admin/creator display values', () => {
    expect(resolveSbtPageBurnAuthLabel('AdminOnly')).toBe('Admin Only');
    expect(resolveSbtPageBurnAuthLabel('OwnerOnly')).toBe('Owner Only');
    expect(resolveSbtPageBurnAuthLabel(2)).toBe('Both');
    expect(resolveSbtPageBurnAuthLabel('3')).toBe('?');
    expect(resolveSbtPageBurnAuthLabel(null)).toBe('?');
    expect(resolveSbtPageMaxTokensDisplay('0')).toBe('∞');
    expect(resolveSbtPageMaxTokensDisplay(0)).toBe('0');
    expect(resolveSbtPageMaxTokensDisplay(25)).toBe('25');
    expect(resolveSbtPageMaxTokensDisplay(null)).toBe('-');
    expect(
      resolveSbtPageAdminCreatorAddresses({
        admin_: '0xAdmin',
        creator: '',
        deployer: '0xDeploy',
      }),
    ).toEqual({
      adminAddress: '0xAdmin',
      creatorAddress: '0xAdmin',
    });
  });

  it('normalizes relevant info lists without changing empty-string behavior', () => {
    expect(toStringList(['a', null, 2])).toEqual(['a', '', '2']);
    expect(toStringList('bad')).toEqual([]);
    expect(
      toSbtPageDocumentUrlList(
        ['https://example.test/doc', 7],
        { href: 'https://example.test/object-doc' },
        { value: ' ' },
      ),
    ).toEqual(['https://example.test/doc', '7', 'https://example.test/object-doc']);
    expect(
      resolveSbtPageRelevantInfoLists({
        sbtInfo: {
          documentIDHashes: ['hash-a', null, 3],
          docURL: 'https://example.test/single-doc',
          documents: [{ href: 'https://example.test/object-doc' }],
          tags: ['tag-a', undefined],
        },
      }),
    ).toEqual({
      documentIDHashes: ['hash-a', '', '3'],
      documentURLs: ['https://example.test/single-doc', 'https://example.test/object-doc'],
      tags: ['tag-a', ''],
    });
  });

  it('builds relevant info display state from list presence only', () => {
    expect(
      resolveSbtPageRelevantInfoDisplayState({
        documentIDHashes: ['hash-a'],
        documentURLs: [],
        tags: ['tag-a'],
      }),
    ).toEqual({
      shouldRenderDocumentIdHashes: true,
      shouldRenderDocumentUrls: false,
      shouldRenderTags: true,
    });
  });
});
