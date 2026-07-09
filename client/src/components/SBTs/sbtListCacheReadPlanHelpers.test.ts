import { buildSbtListCacheReadPlan } from './sbtListCacheReadPlanHelpers';
import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';

const alphaItem = {
  mintedAddresses: ['0x1', '0x2'],
  sbtAddress: '0xAlpha',
  sbtInfo: { name: 'Alpha' },
};
const betaItem = {
  mintedAddresses: ['0x1'],
  sbtAddress: '0xBeta',
  sbtInfo: { name: 'Beta' },
  slug: 'beta-existing',
};

describe('sbtListCacheReadPlanHelpers', () => {
  it('normalizes network-scoped cache entries into a cache read plan', () => {
    const plan = buildSbtListCacheReadPlan({
      netKey: 11155420,
      rawCache: {
        11155420: {
          lastBlock: '240',
          sbtList: {
            beta: betaItem,
            invalid: { sbtAddress: '0xInvalid' },
            alpha: alphaItem,
          },
        },
      },
      targetSlug: 'Alpha Session',
    });

    expect(plan).toMatchObject({
      hasCacheRecord: true,
      hasNetworkCacheEntry: true,
      meta: {
        lastBlock: 240,
        sbtCount: 2,
      },
      netKey: '11155420',
      shouldApplyCards: true,
      shouldEnsurePasswordFlags: true,
      shouldKeepExistingCards: false,
      targetSlug: 'Alpha Session',
    });
    expect(plan.hydrated.map((item) => item.sbtAddress)).toEqual(['0xAlpha', '0xBeta']);
    expect(plan.passwordFlagItems).toEqual([{ ...alphaItem, slug: 'Alpha Session' }, betaItem]);
  });

  it('keeps previously loaded cards when a non-forced read returns an empty cache', () => {
    const currentItems = [{ sbtAddress: '0xExisting', sbtInfo: { name: 'Existing' } }];

    expect(
      buildSbtListCacheReadPlan({
        currentItems,
        forceRefresh: false,
        hasLoadedBefore: true,
        netKey: '11155420',
        rawCache: {},
        targetSlug: 'alpha',
      }),
    ).toMatchObject({
      hasCacheRecord: true,
      hasNetworkCacheEntry: false,
      hydrated: [],
      meta: {
        lastBlock: 0,
        sbtCount: 0,
      },
      shouldApplyCards: false,
      shouldEnsurePasswordFlags: false,
      shouldKeepExistingCards: true,
    });

    expect(
      buildSbtListCacheReadPlan({
        currentItems,
        forceRefresh: false,
        hasLoadedBefore: false,
        netKey: '11155420',
        rawCache: {},
        targetSlug: 'alpha',
      }),
    ).toMatchObject({
      shouldApplyCards: true,
      shouldKeepExistingCards: false,
    });

    expect(
      buildSbtListCacheReadPlan({
        currentItems,
        forceRefresh: true,
        hasLoadedBefore: true,
        netKey: '11155420',
        rawCache: {},
        targetSlug: 'alpha',
      }),
    ).toMatchObject({
      shouldApplyCards: true,
      shouldKeepExistingCards: false,
    });
  });

  it('defensively handles missing cache records, non-object network nodes, and synthetic sessions', () => {
    expect(
      buildSbtListCacheReadPlan({
        netKey: '11155420',
        rawCache: null,
        targetSlug: 'alpha',
      }),
    ).toMatchObject({
      hasCacheRecord: false,
      hasNetworkCacheEntry: false,
      hydrated: [],
      meta: {
        lastBlock: 0,
        sbtCount: 0,
      },
    });

    expect(
      buildSbtListCacheReadPlan({
        netKey: '11155420',
        rawCache: { 11155420: 'bad' },
        targetSlug: 'alpha',
      }),
    ).toMatchObject({
      hasCacheRecord: true,
      hasNetworkCacheEntry: true,
      hydrated: [],
      meta: {
        lastBlock: 0,
        sbtCount: 0,
      },
    });

    expect(
      buildSbtListCacheReadPlan({
        netKey: '11155420',
        rawCache: {
          11155420: {
            lastBlock: 10,
            sbtList: { alpha: alphaItem },
          },
        },
        targetSlug: SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
      }),
    ).toMatchObject({
      hasNetworkCacheEntry: false,
      hydrated: [],
      netKey: '',
      targetSlug: SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
    });
  });
});
