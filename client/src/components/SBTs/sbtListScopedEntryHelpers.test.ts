import { collectSbtListLinkedScopedEntries } from './sbtListScopedEntryHelpers';
import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';

const entries = [
  {
    slug: 'source-alpha',
    value: {
      11155420: {
        sbtList: {
          '0xA': {
            sbtInfo: { name: 'Alpha' },
          },
          '0xB': {
            bindingSlug: 'target-beta',
            sbtAddress: '0xB',
            sbtInfo: { name: 'Beta' },
            slug: 'outside',
          },
          '0xC': {
            sbtAddress: '0xC',
            sbtInfo: { name: 'Gamma' },
            slug: 'outside',
          },
        },
      },
    },
  },
  {
    slug: 'source-duplicate',
    value: {
      11155420: {
        sbtList: {
          '0xa': {
            sbtInfo: { name: 'Duplicate Alpha' },
          },
        },
      },
    },
  },
];

describe('sbtListScopedEntryHelpers', () => {
  it('collects linked scoped cache entries by resolved or concrete session binding', () => {
    const collected = collectSbtListLinkedScopedEntries({
      entries,
      resolveConcreteSessionBindingSlug: (item) => item.bindingSlug ?? null,
      resolveSbtSessionSlug: (item) => item.slug,
      targetSlugs: ['source-alpha', 'target-beta'],
    });

    expect(collected).toEqual([
      {
        __sourceSessionSlug: 'source-alpha',
        sbtAddress: '0xA',
        sbtInfo: { name: 'Alpha' },
        slug: 'source-alpha',
      },
      {
        __sourceSessionSlug: 'source-alpha',
        bindingSlug: 'target-beta',
        sbtAddress: '0xB',
        sbtInfo: { name: 'Beta' },
        slug: 'target-beta',
      },
    ]);
  });

  it('can require a concrete binding and ignore resolved-only cache entries', () => {
    const collected = collectSbtListLinkedScopedEntries({
      entries,
      options: { requireConcreteBinding: true },
      resolveConcreteSessionBindingSlug: (item) => item.bindingSlug ?? null,
      resolveSbtSessionSlug: (item) => item.slug,
      targetSlugs: ['source-alpha', 'target-beta'],
    });

    expect(collected).toEqual([
      {
        __sourceSessionSlug: 'source-alpha',
        bindingSlug: 'target-beta',
        sbtAddress: '0xB',
        sbtInfo: { name: 'Beta' },
        slug: 'target-beta',
      },
    ]);
  });

  it('handles malformed entries, empty targets, and synthetic no-session slugs defensively', () => {
    expect(
      collectSbtListLinkedScopedEntries({
        entries,
        targetSlugs: [],
      }),
    ).toEqual([]);

    expect(
      collectSbtListLinkedScopedEntries({
        entries: [
          null,
          { slug: 'bad', value: null },
          { slug: 'bad-list', value: { 11155420: { sbtList: null } } },
          {
            slug: 'source-none',
            value: {
              11155420: {
                sbtList: {
                  '0xNone': {
                    sbtInfo: { name: 'No Session' },
                    slug: SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
                  },
                },
              },
            },
          },
        ],
        resolveSbtSessionSlug: (item) => item.slug,
        targetSlugs: [SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
      }),
    ).toEqual([
      {
        __sourceSessionSlug: 'source-none',
        sbtAddress: '0xNone',
        sbtInfo: { name: 'No Session' },
        slug: SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
      },
    ]);
  });
});
