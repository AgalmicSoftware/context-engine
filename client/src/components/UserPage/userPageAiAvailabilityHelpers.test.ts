import {
  buildUserPageAiAvailabilityStatePatch,
  resolveUserPageAiAvailabilityRefresh,
} from './userPageAiAvailabilityHelpers';

describe('userPageAiAvailabilityHelpers', () => {
  it('resolves refresh timing from cache readiness and context changes', () => {
    expect(
      resolveUserPageAiAvailabilityRefresh({
        nextAccount: '0xB',
        nextIsQuestionCacheReady: true,
        nextIsResponsesCacheReady: true,
        nextIsSBTCacheReady: true,
        nextIsSurveyCacheReady: true,
        nextNetworkId: 84532,
        nextViewAddress: '0xVIEW',
        prevAccount: '0xA',
        prevIsQuestionCacheReady: true,
        prevIsResponsesCacheReady: true,
        prevIsSBTCacheReady: true,
        prevIsSurveyCacheReady: true,
        prevNetworkId: 84532,
        prevViewAddress: '0xVIEW',
      }),
    ).toEqual({
      allCachesReady: true,
      contextChanged: true,
      shouldCheckAfterReset: true,
      shouldCheckNow: false,
    });
    expect(
      resolveUserPageAiAvailabilityRefresh({
        nextAccount: '0xA',
        nextIsQuestionCacheReady: true,
        nextIsResponsesCacheReady: false,
        nextIsSBTCacheReady: true,
        nextIsSurveyCacheReady: true,
        nextNetworkId: 84532,
        nextViewAddress: '0xVIEW2',
        prevAccount: '0xA',
        prevIsQuestionCacheReady: true,
        prevIsResponsesCacheReady: true,
        prevIsSBTCacheReady: true,
        prevIsSurveyCacheReady: true,
        prevNetworkId: 84532,
        prevViewAddress: '0xVIEW',
      }),
    ).toMatchObject({
      allCachesReady: false,
      contextChanged: true,
      shouldCheckAfterReset: false,
      shouldCheckNow: false,
    });
    expect(
      resolveUserPageAiAvailabilityRefresh({
        nextAccount: '0xA',
        nextIsQuestionCacheReady: true,
        nextIsResponsesCacheReady: true,
        nextIsSBTCacheReady: true,
        nextIsSurveyCacheReady: true,
        nextNetworkId: 84532,
        nextViewAddress: '0xVIEW',
        prevAccount: '0xA',
        prevIsQuestionCacheReady: true,
        prevIsResponsesCacheReady: false,
        prevIsSBTCacheReady: true,
        prevIsSurveyCacheReady: true,
        prevNetworkId: 84532,
        prevViewAddress: '0xVIEW',
      }),
    ).toEqual({
      allCachesReady: true,
      contextChanged: false,
      shouldCheckAfterReset: false,
      shouldCheckNow: true,
    });
    expect(
      resolveUserPageAiAvailabilityRefresh({
        nextAccount: '0xA',
        nextIsQuestionCacheReady: true,
        nextIsResponsesCacheReady: true,
        nextIsSBTCacheReady: true,
        nextIsSurveyCacheReady: true,
        nextNetworkId: '84532',
        nextViewAddress: '0xVIEW',
        prevAccount: '0xA',
        prevIsQuestionCacheReady: true,
        prevIsResponsesCacheReady: true,
        prevIsSBTCacheReady: true,
        prevIsSurveyCacheReady: true,
        prevNetworkId: 84532,
        prevViewAddress: '0xVIEW',
      }),
    ).toEqual({
      allCachesReady: true,
      contextChanged: true,
      shouldCheckAfterReset: true,
      shouldCheckNow: false,
    });
  });

  it('builds nullable AI availability state patches', () => {
    expect(buildUserPageAiAvailabilityStatePatch()).toEqual({
      aiAvailable: null,
    });
    expect(buildUserPageAiAvailabilityStatePatch({ available: true })).toEqual({
      aiAvailable: true,
    });
    expect(buildUserPageAiAvailabilityStatePatch({ available: 0 })).toEqual({
      aiAvailable: false,
    });
  });
});
