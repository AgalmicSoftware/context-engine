import {
  collectSbtDocumentUrls,
  collectSbtTagValues,
  getSbtCardDetails,
  normalizeSbtListTokenUri,
} from './sbtListCardDetailsHelpers';

describe('sbtListCardDetailsHelpers', () => {
  it('collects card tags and document URLs from metadata variants', () => {
    expect(collectSbtTagValues(['Builder', { label: 'builder' }], 'Research, Ops', [{ name: 'Signal' }])).toEqual([
      'Builder',
      'Research',
      'Ops',
      'Signal',
    ]);
    expect(
      collectSbtDocumentUrls([{ href: 'ipfs://bafy-doc' }], { docUrl: 'ar://abc123' }, 'https://example.com/readme', {
        url: 'https://example.com/readme',
      }),
    ).toEqual(['ipfs://bafy-doc', 'ar://abc123', 'https://example.com/readme']);
  });

  it('normalizes SBT card detail links without hydrating token metadata', () => {
    const details = getSbtCardDetails({
      tags: ['Builder', { label: 'builder' }],
      documentUrls: [{ href: 'ipfs://bafy-doc' }, { value: 'https://example.com/readme' }],
      sbtInfo: {
        featuredSbtTags: [{ value: 'Signal' }],
        documents: [{ docUrl: 'ar://abc123' }],
      },
    });

    expect(normalizeSbtListTokenUri('ipfs://bafy-image')).toBe('https://ipfs.io/ipfs/bafy-image');
    expect(details.tags).toEqual(['Builder', 'Signal']);
    expect(details.documentUrls).toEqual([
      { href: 'ar://abc123', label: 'ar://abc123' },
      { href: 'https://ipfs.io/ipfs/bafy-doc', label: 'ipfs://bafy-doc' },
      { href: 'https://example.com/readme', label: 'https://example.com/readme' },
    ]);
    expect(details.hasDetails).toBe(true);
  });

  it('uses AR.IO for Arweave-backed list card images while direct routing is enabled', () => {
    const txId = 'NMc_EMP1kKWx9hL17XrDhvFBSEnmLIO1DivrOUsBwIE';

    expect(normalizeSbtListTokenUri(txId)).toBe(`https://ar-io.dev/${txId}`);
    expect(normalizeSbtListTokenUri(`ar://${txId}`)).toBe(`https://ar-io.dev/${txId}`);
  });
});
