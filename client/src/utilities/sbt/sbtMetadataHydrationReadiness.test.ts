import { hasListVisibleSbtTokenUriMetadata, needsSbtListMetadataHydration } from './sbtMetadataHydrationReadiness';

const hasCoreMetadata = jest.fn((info: unknown) => {
  const record = info as Record<string, unknown> | null;
  return !!record?.name && !!record?.symbol;
});

describe('hasListVisibleSbtTokenUriMetadata', () => {
  it('treats explicit token URI metadata fetches as list-visible', () => {
    expect(hasListVisibleSbtTokenUriMetadata({ tokenUriMetadataFetched: true })).toBe(true);
  });

  it('recognizes text, encrypted, and list fields used by SBT cards', () => {
    expect(hasListVisibleSbtTokenUriMetadata({ description: 'Voting credential' })).toBe(true);
    expect(hasListVisibleSbtTokenUriMetadata({ imageEncrypted: 'ciphertext' })).toBe(true);
    expect(hasListVisibleSbtTokenUriMetadata({ encryptedFields: { image: 'ciphertext' } })).toBe(true);
    expect(hasListVisibleSbtTokenUriMetadata({ tags: ['governance'] })).toBe(true);
    expect(hasListVisibleSbtTokenUriMetadata({ documentURLs: ['ar://doc'] })).toBe(true);
    expect(hasListVisibleSbtTokenUriMetadata({ documentUrls: ['ar://doc'] })).toBe(true);
    expect(hasListVisibleSbtTokenUriMetadata({ docURLs: ['ar://doc'] })).toBe(true);
    expect(hasListVisibleSbtTokenUriMetadata({ documents: [{ id: 'doc' }] })).toBe(true);
  });

  it('rejects empty objects and blank visible fields', () => {
    expect(hasListVisibleSbtTokenUriMetadata(null)).toBe(false);
    expect(hasListVisibleSbtTokenUriMetadata({ description: '  ', encryptedFields: { image: '' }, tags: [] })).toBe(
      false,
    );
  });
});

describe('needsSbtListMetadataHydration', () => {
  beforeEach(() => {
    hasCoreMetadata.mockClear();
  });

  it('requires hydration when core metadata is missing', () => {
    const info = { description: 'Visible but missing core fields' };

    expect(needsSbtListMetadataHydration(info, hasCoreMetadata)).toBe(true);
    expect(hasCoreMetadata).toHaveBeenCalledWith(info);
  });

  it('requires hydration when list-visible token URI metadata is missing', () => {
    expect(needsSbtListMetadataHydration({ name: 'Member', symbol: 'MBR' }, hasCoreMetadata)).toBe(true);
  });

  it('skips hydration when core and list-visible metadata are both present', () => {
    expect(
      needsSbtListMetadataHydration(
        {
          name: 'Member',
          symbol: 'MBR',
          image: 'ar://image',
        },
        hasCoreMetadata,
      ),
    ).toBe(false);
  });
});
