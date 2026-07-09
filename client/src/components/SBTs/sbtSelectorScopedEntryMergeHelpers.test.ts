import {
  decorateScopedSbtEntry,
  mergeScopedSbtEntry,
  resolveSbtEntryChainId,
  shouldPreferIncomingScopedSbtEntry,
} from './sbtSelectorScopedEntryMergeHelpers';

describe('sbtSelectorScopedEntryMergeHelpers', () => {
  it('resolves entry chain IDs without changing fallback precedence', () => {
    expect(resolveSbtEntryChainId({ chainId: '10' }, 84532)).toBe(10);
    expect(resolveSbtEntryChainId({ sbtInfo: { chainID: '84532' } })).toBe(84532);
    expect(resolveSbtEntryChainId({}, '11155420')).toBe(11155420);
    expect(resolveSbtEntryChainId({})).toBeNull();
  });

  it('decorates entries with source slug, binding slug, and normalized chain', () => {
    expect(
      decorateScopedSbtEntry(
        {
          chainId: '84532',
          sessionBindingSlug: 'Binding',
          slug: 'Alpha',
        },
        'Fallback',
      ),
    ).toMatchObject({
      chainId: 84532,
      slug: 'Alpha',
      __sourceSessionSlug: 'Alpha',
      sessionBindingSlug: 'Binding',
    });
    expect(decorateScopedSbtEntry({ __sourceSessionSlug: 'General' }, 'Fallback')).toMatchObject({
      slug: 'Fallback',
      __sourceSessionSlug: '',
    });
  });

  it('merges scoped entries while preserving binding precedence', () => {
    const merged = mergeScopedSbtEntry(
      {
        sbtAddress: '0x1111',
        sbtInfo: { image: 'old.png' },
        sessionBindingSlug: 'ExistingBinding',
        slug: 'Existing',
      },
      {
        sbtAddress: '0x1111',
        sbtInfo: { name: 'Named Badge', image: 'new.png' },
        sessionBindingSlug: 'IncomingBinding',
        slug: 'Incoming',
      },
      'Fallback',
    );

    expect(merged).toMatchObject({
      sbtInfo: { name: 'Named Badge', image: 'new.png' },
      sessionBindingSlug: 'ExistingBinding',
      slug: 'Existing',
    });
    expect(
      shouldPreferIncomingScopedSbtEntry({ sbtInfo: { image: 'old.png' } }, { sbtInfo: { name: 'Named Badge' } }),
    ).toBe(true);
    expect(
      shouldPreferIncomingScopedSbtEntry({ sbtInfo: { image: 'old.png' } }, { sbtInfo: { image: 'new.png' } }),
    ).toBe(false);
  });
});
