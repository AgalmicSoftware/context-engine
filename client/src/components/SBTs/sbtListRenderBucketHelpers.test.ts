import { buildSbtListRenderBuckets } from './sbtListRenderBucketHelpers';
import { resolveSbtListItemSessionSlug } from './sbtListSessionBindingHelpers';
import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';

describe('sbtListRenderBucketHelpers', () => {
  it('builds render buckets with featured, ignored, and synthetic no-session handling', () => {
    const featuredAddress = '0x00000000000000000000000000000000000000f1';
    const ignoredAddress = '0x00000000000000000000000000000000000000d1';
    const hiddenAddress = '0x00000000000000000000000000000000000000b1';
    const getSessionListsForSlug = jest.fn(() => ({
      featured_SBTs_LIST: [featuredAddress],
      ignored_SBTs_LIST: [ignoredAddress],
    }));

    expect(
      buildSbtListRenderBuckets({
        allSessionsMode: true,
        excludePasswordLocked: false,
        getSessionListsForSlug,
        isListModeScopeEnabled: true,
        isMintingLive: (sbt) => sbt.sbtInfo?.mintingEndTime === 0,
        isPasswordLocked: () => false,
        listSlug: 'alpha',
        resolveSbtSessionSlug: (sbt) => String(sbt.slug || ''),
        sbtList: [
          { sbtAddress: featuredAddress, slug: 'alpha', sbtInfo: { name: 'Featured', mintingEndTime: 0 } },
          { sbtAddress: ignoredAddress, slug: 'alpha', sbtInfo: { name: 'Ignored', mintingEndTime: 0 } },
          {
            sbtAddress: hiddenAddress,
            slug: SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
            sbtInfo: { name: 'Hidden', mintingEndTime: 1 },
          },
        ],
        sectionSessionSlugs: ['alpha', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
      }).displayedFeatured.map((sbt) => sbt.sbtAddress),
    ).toEqual([featuredAddress]);
    expect(getSessionListsForSlug).not.toHaveBeenCalledWith(SBT_LIST_NO_SESSION_UNIVERSE_SLUG);
  });

  it('keeps list-mode cache items scoped by discovery slug in the selected session bucket', () => {
    const demoAddress = '0x0000000000000000000000000000000000000d01';

    const buckets = buildSbtListRenderBuckets({
      allSessionsMode: true,
      excludePasswordLocked: false,
      getSessionListsForSlug: () => ({
        featured_SBTs_LIST: [],
        ignored_SBTs_LIST: [],
      }),
      isListModeScopeEnabled: true,
      isMintingLive: (sbt) => sbt.sbtInfo?.mintingEndTime === 0,
      isPasswordLocked: () => false,
      listSlug: 'demo',
      resolveSbtSessionSlug: (sbt) =>
        resolveSbtListItemSessionSlug(sbt, {
          allSessionsMode: true,
          isListModeScopeEnabled: true,
        }),
      sbtList: [
        {
          sbtAddress: demoAddress,
          slug: 'demo',
          sessionSlug: 'demo',
          sessionSlugExplicit: true,
          sbtInfo: {
            name: 'Discovered Demo SBT',
            mintingEndTime: 0,
            sessionSlug: 'demo',
            sessionSlugExplicit: true,
          },
        },
      ],
      sectionSessionSlugs: ['demo'],
    });

    expect(buckets.mintingLiveList.map((sbt) => sbt.sbtAddress)).toEqual([demoAddress]);
    expect(buckets.baseFilteredList.map((sbt) => sbt.sbtAddress)).toEqual([demoAddress]);
  });

  it('reads all-session group lists once per session slug while building buckets', () => {
    const alphaFeatured = '0x0000000000000000000000000000000000000a01';
    const alphaPlain = '0x0000000000000000000000000000000000000a02';
    const betaFeatured = '0x0000000000000000000000000000000000000b01';
    const getSessionListsForSlug = jest.fn((slug: string) => ({
      featured_SBTs_LIST: slug === 'alpha' ? [alphaFeatured] : [betaFeatured],
      ignored_SBTs_LIST: [],
    }));

    const buckets = buildSbtListRenderBuckets({
      allSessionsMode: true,
      excludePasswordLocked: false,
      getSessionListsForSlug,
      isListModeScopeEnabled: true,
      isMintingLive: () => true,
      isPasswordLocked: () => false,
      listSlug: 'alpha',
      resolveSbtSessionSlug: (sbt) => String(sbt.slug || ''),
      sbtList: [
        { sbtAddress: alphaFeatured, slug: 'alpha', sbtInfo: { name: 'Alpha Featured' } },
        { sbtAddress: alphaPlain, slug: 'alpha', sbtInfo: { name: 'Alpha Plain' } },
        { sbtAddress: betaFeatured, slug: 'beta', sbtInfo: { name: 'Beta Featured' } },
      ],
      sectionSessionSlugs: ['alpha', 'beta'],
    });

    expect(buckets.displayedFeatured.map((sbt) => sbt.sbtAddress)).toEqual([alphaFeatured, betaFeatured]);
    expect(getSessionListsForSlug).toHaveBeenCalledTimes(2);
    expect(getSessionListsForSlug).toHaveBeenNthCalledWith(1, 'alpha');
    expect(getSessionListsForSlug).toHaveBeenNthCalledWith(2, 'beta');
  });
});
