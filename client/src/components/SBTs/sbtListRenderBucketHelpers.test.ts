import { buildSbtListRenderBuckets } from './sbtListRenderBucketHelpers';
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

    expect(buildSbtListRenderBuckets({
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
        { sbtAddress: hiddenAddress, slug: SBT_LIST_NO_SESSION_UNIVERSE_SLUG, sbtInfo: { name: 'Hidden', mintingEndTime: 1 } },
      ],
      sectionSessionSlugs: ['alpha', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
    }).displayedFeatured.map((sbt) => sbt.sbtAddress)).toEqual([featuredAddress]);
    expect(getSessionListsForSlug).not.toHaveBeenCalledWith(SBT_LIST_NO_SESSION_UNIVERSE_SLUG);
  });
});
