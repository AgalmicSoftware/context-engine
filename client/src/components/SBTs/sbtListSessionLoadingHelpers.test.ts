import {
  buildSbtListChipLoadingStatusBySlug,
  buildSbtListInitialLoaderStatuses,
  buildSbtListSessionChipStateBySlug,
  buildSbtListSessionLoadingStatus,
  buildSbtListSessionProgressSnapshot,
  resolveSbtListReadinessDisplayPlan,
  resolveSbtListSectionLoadingState,
} from './sbtListSessionLoadingHelpers';
import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';

describe('sbtListSessionLoadingHelpers', () => {
  const makeStatus = (slug: string, statusLabel = 'Loading') => ({
    chipBlockProgressText: `Current ${slug || 'general'}`,
    chipRemainingText: 'Syncing',
    deferred: false,
    displayCurrentBlock: 0,
    displayName: slug || 'General',
    hasLatest: false,
    lastBlock: 0,
    latestForGroup: null,
    progressPct: 0,
    progressText: `Loading ${slug || 'general'}`,
    remainingBlocks: null,
    scanInProgress: false,
    slug,
    slugLabel: slug || 'general',
    statusLabel,
  });

  it('plans initial loader status rows with fallback resolution', () => {
    const calls: unknown[] = [];
    const resolveStatus = (slug: unknown, options?: unknown) => {
      calls.push([slug, options]);
      return String(slug || '') === 'beta' ? null : makeStatus(String(slug || ''));
    };

    expect(
      buildSbtListInitialLoaderStatuses({
        fallbackSlug: 'fallback',
        loaderSessionSlugs: ['alpha', 'beta'],
        resolveStatus,
      }),
    ).toEqual([
      expect.objectContaining({
        displayName: 'alpha',
        slug: 'alpha',
        slugLabel: 'alpha',
      }),
    ]);
    expect(calls).toEqual([
      ['alpha', undefined],
      ['beta', undefined],
    ]);

    calls.length = 0;
    expect(
      buildSbtListInitialLoaderStatuses({
        fallbackSlug: 'fallback',
        loaderSessionSlugs: ['beta'],
        resolveStatus,
      }),
    ).toEqual([
      expect.objectContaining({
        displayName: 'fallback',
        slug: 'fallback',
        slugLabel: 'fallback',
      }),
    ]);
    expect(calls).toEqual([
      ['beta', undefined],
      ['fallback', { forceShow: true }],
    ]);

    calls.length = 0;
    expect(
      buildSbtListInitialLoaderStatuses({
        fallbackSlug: 'fallback',
        loaderSessionSlugs: ['alpha'],
        resolveStatus,
        windowAvailable: false,
      }),
    ).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('plans chip loading status maps with selected-scope filtering', () => {
    const calls: unknown[] = [];
    const resolveStatus = (slug: unknown, options?: unknown) => {
      calls.push([slug, options]);
      return makeStatus(String(slug || ''));
    };

    expect(
      buildSbtListChipLoadingStatusBySlug({
        allSessionsMode: false,
        displayedSessionUniverseSlugs: ['alpha'],
        resolveStatus,
      }),
    ).toEqual({});
    expect(calls).toEqual([]);

    const result = buildSbtListChipLoadingStatusBySlug({
      allSessionsMode: true,
      displayedSessionUniverseSlugs: ['alpha', 'beta', 'alpha'],
      isListModeScopeEnabled: true,
      resolveStatus,
      selectedSessionUniverseSlugs: new Set(['beta']),
    });

    expect(result).toEqual({
      beta: expect.objectContaining({
        displayName: 'beta',
        slug: 'beta',
        slugLabel: 'beta',
      }),
    });
    expect(calls).toEqual([['beta', { alwaysShow: true }]]);
  });

  it('plans section loading readiness and search flags', () => {
    expect(resolveSbtListSectionLoadingState()).toEqual({
      refreshButtonBusy: false,
      sectionSessionDiscoveryPending: false,
      sectionSessionSearchFlag: false,
      shouldKeepSectionSpinnersOn: false,
    });

    expect(
      resolveSbtListSectionLoadingState({
        isSBTCacheReady: true,
        sectionSessionSlugs: ['alpha'],
        sessionLoadStateBySlug: { alpha: 'loading' },
      }),
    ).toEqual({
      refreshButtonBusy: true,
      sectionSessionDiscoveryPending: true,
      sectionSessionSearchFlag: false,
      shouldKeepSectionSpinnersOn: true,
    });

    expect(
      resolveSbtListSectionLoadingState({
        getSessionProgressSnapshot: () => ({
          hasLatest: true,
          remainingBlocks: 0,
        }),
        isSBTCacheReady: true,
        sbtListBySlug: {
          alpha: [{ sbtAddress: '0x1111111111111111111111111111111111111111' }],
        },
        sectionSessionSlugs: ['alpha'],
        sessionHasLoadedOnceBySlug: { alpha: true },
        sessionLoadStateBySlug: { alpha: 'loaded' },
      }),
    ).toEqual({
      refreshButtonBusy: false,
      sectionSessionDiscoveryPending: false,
      sectionSessionSearchFlag: false,
      shouldKeepSectionSpinnersOn: false,
    });

    expect(
      resolveSbtListSectionLoadingState({
        getSessionProgressSnapshot: () => ({
          hasLatest: true,
          remainingBlocks: 10,
          scanInProgress: true,
        }),
        isSBTCacheReady: true,
        revisionSyncPending: true,
        sectionSessionSlugs: ['alpha'],
        sessionHasLoadedOnceBySlug: { alpha: true },
      }),
    ).toEqual({
      refreshButtonBusy: true,
      sectionSessionDiscoveryPending: true,
      sectionSessionSearchFlag: true,
      shouldKeepSectionSpinnersOn: true,
    });

    expect(
      resolveSbtListSectionLoadingState({
        hasNoSessionCards: true,
        isSBTCacheReady: true,
        refreshing: false,
        sectionSessionSlugs: [SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
        sessionHasLoadedOnceBySlug: { alpha: true },
      }),
    ).toEqual({
      refreshButtonBusy: false,
      sectionSessionDiscoveryPending: false,
      sectionSessionSearchFlag: false,
      shouldKeepSectionSpinnersOn: false,
    });

    expect(
      resolveSbtListSectionLoadingState({
        hasNoSessionCards: true,
        isSBTCacheReady: true,
        refreshing: true,
        sectionSessionSlugs: [SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
        sessionHasLoadedOnceBySlug: { alpha: true },
      }),
    ).toEqual({
      refreshButtonBusy: true,
      sectionSessionDiscoveryPending: true,
      sectionSessionSearchFlag: false,
      shouldKeepSectionSpinnersOn: true,
    });
  });

  it('plans section readiness display without owning loading execution', () => {
    expect(
      resolveSbtListReadinessDisplayPlan({
        allSessionsMode: false,
        availableSessionSlugCount: 1,
        initialLoadCompleted: false,
        isSBTCacheReady: false,
        loading: true,
      }),
    ).toEqual(
      expect.objectContaining({
        canShowSectionEmptyState: false,
        initialLoadingActive: true,
        sectionHeaderSpinnerVisible: false,
        sectionReadinessPending: true,
        shouldDeferInitialLoaderForUniverse: false,
        showInitialLoader: true,
        showFeaturedSectionLoadingHint: true,
        showLiveSectionLoadingHint: true,
        showExpiredSectionLoadingHint: true,
        showSectionBodyLoadingHint: true,
        showUniverseSpinner: true,
      }),
    );

    expect(
      resolveSbtListReadinessDisplayPlan({
        allSessionsMode: true,
        availableSessionSlugCount: 2,
        displayedSessionUniverseSlugs: ['alpha', 'beta'],
        initialLoadCompleted: false,
        isSBTCacheReady: false,
        sectionSessionDiscoveryPending: true,
      }),
    ).toEqual(
      expect.objectContaining({
        initialLoadingActive: true,
        shouldDeferInitialLoaderForUniverse: true,
        showInitialLoader: false,
        showSectionBodyLoadingHint: true,
        showUniverseSpinner: true,
      }),
    );

    expect(
      resolveSbtListReadinessDisplayPlan({
        allSessionsMode: true,
        availableSessionSlugCount: 2,
        displayedFeaturedCount: 0,
        expiredCount: 0,
        initialLoadCompleted: true,
        isSBTCacheReady: true,
        mintingLiveCount: 0,
      }),
    ).toEqual(
      expect.objectContaining({
        canShowSectionEmptyState: true,
        initialLoadingActive: false,
        sectionReadinessPending: false,
        showExpiredSectionLoadingHint: false,
        showFeaturedSectionLoadingHint: false,
        showInitialLoader: false,
        showLiveSectionLoadingHint: false,
        showSectionBodyLoadingHint: false,
        showUniverseSpinner: false,
      }),
    );

    expect(
      resolveSbtListReadinessDisplayPlan({
        availableSessionSlugCount: 0,
        displayedFeaturedCount: 1,
        expiredCount: 1,
        initialLoadCompleted: true,
        isSBTCacheReady: true,
        mintingLiveCount: 1,
        revisionSyncPending: true,
      }),
    ).toEqual(
      expect.objectContaining({
        canShowSectionEmptyState: false,
        showExpiredSectionLoadingHint: false,
        showFeaturedSectionLoadingHint: false,
        showLiveSectionLoadingHint: false,
        showSectionBodyLoadingHint: true,
        showUniverseSpinner: true,
      }),
    );
  });

  it('builds session loading status, chip state, and progress snapshots', () => {
    expect(
      buildSbtListSessionLoadingStatus({
        allSessionsMode: true,
        formatBlockCount: (value) => `#${value}`,
        snapshot: {
          cfg: { sessionName: 'Alpha' },
          displayCurrentBlock: 1050,
          hasCache: true,
          hasLatest: true,
          lastBlock: 1040,
          latestForGroup: 1100,
          remainingBlocks: 50,
          scanInProgress: true,
          slug: 'alpha',
          startBlock: 1000,
        },
      }),
    ).toEqual(
      expect.objectContaining({
        chipBlockProgressText: '#1050 / #1100',
        chipRemainingText: '#50 remaining',
        displayName: 'Alpha',
        progressPct: 50,
        progressText: 'Remaining Blocks: #50 (Current: #1050 / Latest: #1100)',
        statusLabel: 'Scanning',
      }),
    );
    expect(
      buildSbtListSessionLoadingStatus({
        allSessionsMode: true,
        loading: false,
        snapshot: {
          cfg: { sessionName: 'Alpha' },
          displayCurrentBlock: 1100,
          hasCache: true,
          hasLatest: true,
          latestForGroup: 1100,
          remainingBlocks: 0,
          slug: 'alpha',
          startBlock: 1000,
        },
      }),
    ).toBeNull();
    expect(
      buildSbtListSessionLoadingStatus({
        alwaysShow: true,
        snapshot: {
          cfg: { sessionName: 'General' },
          displayCurrentBlock: 0,
          hasLatest: false,
          slug: '',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        chipRemainingText: 'Syncing',
        displayName: 'General',
        slugLabel: 'general',
        statusLabel: 'Loading',
      }),
    );
    expect(
      buildSbtListSessionChipStateBySlug({
        allSessionsMode: true,
        displayedSessionUniverseSlugs: ['alpha', 'beta', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
        getSessionProgressSnapshot: (slug) => (slug === 'alpha' ? { scanInProgress: true } : null),
        hasNoSessionCards: false,
        readSbtCacheMeta: (slug) => (slug === 'beta' ? { lastBlock: 200 } : null),
        refreshing: false,
        sbtListBySlug: {
          beta: [{ sbtAddress: '0x2222222222222222222222222222222222222222' }],
        },
        sessionHasLoadedOnceBySlug: {
          alpha: true,
          beta: true,
        },
        sessionLoadStateBySlug: {
          alpha: 'loaded',
          beta: 'idle',
        },
      }),
    ).toEqual({
      alpha: {
        hasCards: false,
        hasLoadedOnce: true,
        isLoaded: false,
        isLoading: true,
      },
      beta: {
        hasCards: true,
        hasLoadedOnce: true,
        isLoaded: true,
        isLoading: false,
      },
      [SBT_LIST_NO_SESSION_UNIVERSE_SLUG]: {
        hasCards: false,
        hasLoadedOnce: true,
        isLoaded: true,
        isLoading: false,
      },
    });
    expect(
      buildSbtListSessionProgressSnapshot({
        allSessionsMode: true,
        bridgeMs: 2500,
        bridgeTailBlocks: 5,
        bridgedLiveProgress: {
          currentBlock: 198,
          latestBlock: 200,
          updatedAtMs: 1000,
        },
        cacheMeta: {
          lastBlock: 150,
          sbtCount: 3,
        },
        cfg: {
          blockLimits: { start: 100 },
        },
        recentLiveProgressNowMs: 1200,
        slug: 'alpha',
      }),
    ).toEqual(
      expect.objectContaining({
        displayCurrentBlock: 198,
        hasCache: true,
        hasLatest: true,
        latestForGroup: 200,
        liveCurrentBlock: 198,
        remainingBlocks: 2,
        scanInProgress: false,
      }),
    );
    expect(
      buildSbtListSessionProgressSnapshot({
        allSessionsMode: true,
        bridgeMs: 2500,
        bridgeTailBlocks: 5,
        bridgedLiveProgress: {
          currentBlock: 198,
          latestBlock: 220,
          updatedAtMs: 1000,
        },
        cacheMeta: {
          lastBlock: 220,
          sbtCount: 3,
        },
        cfg: {
          blockLimits: { start: 100 },
        },
        latestBlock: 220,
        recentLiveProgressNowMs: 4000,
        scanInProgressRaw: true,
        deferredRaw: true,
        slug: 'alpha',
      }),
    ).toEqual(
      expect.objectContaining({
        displayCurrentBlock: 220,
        liveProgress: null,
        remainingBlocks: 0,
        scanInProgress: false,
        deferred: false,
      }),
    );
  });
});
