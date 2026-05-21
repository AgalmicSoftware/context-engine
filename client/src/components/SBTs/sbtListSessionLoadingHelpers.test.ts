import {
  buildSbtListSessionChipStateBySlug,
  buildSbtListSessionLoadingStatus,
  buildSbtListSessionProgressSnapshot,
} from './sbtListSessionLoadingHelpers';
import { SBT_LIST_NO_SESSION_UNIVERSE_SLUG } from './sbtListSessionUniverseHelpers';

describe('sbtListSessionLoadingHelpers', () => {
  it('builds session loading status, chip state, and progress snapshots', () => {
    expect(buildSbtListSessionLoadingStatus({
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
    })).toEqual(expect.objectContaining({
      chipBlockProgressText: '#1050 / #1100',
      chipRemainingText: '#50 remaining',
      displayName: 'Alpha',
      progressPct: 50,
      progressText: 'Remaining Blocks: #50 (Current: #1050 / Latest: #1100)',
      statusLabel: 'Scanning',
    }));
    expect(buildSbtListSessionLoadingStatus({
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
    })).toBeNull();
    expect(buildSbtListSessionLoadingStatus({
      alwaysShow: true,
      snapshot: {
        cfg: { sessionName: 'General' },
        displayCurrentBlock: 0,
        hasLatest: false,
        slug: '',
      },
    })).toEqual(expect.objectContaining({
      chipRemainingText: 'Syncing',
      displayName: 'General',
      slugLabel: 'general',
      statusLabel: 'Loading',
    }));
    expect(buildSbtListSessionChipStateBySlug({
      allSessionsMode: true,
      displayedSessionUniverseSlugs: ['alpha', 'beta', SBT_LIST_NO_SESSION_UNIVERSE_SLUG],
      getSessionProgressSnapshot: (slug) => (
        slug === 'alpha' ? { scanInProgress: true } : null
      ),
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
    })).toEqual({
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
    expect(buildSbtListSessionProgressSnapshot({
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
    })).toEqual(expect.objectContaining({
      displayCurrentBlock: 198,
      hasCache: true,
      hasLatest: true,
      latestForGroup: 200,
      liveCurrentBlock: 198,
      remainingBlocks: 2,
      scanInProgress: false,
    }));
    expect(buildSbtListSessionProgressSnapshot({
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
    })).toEqual(expect.objectContaining({
      displayCurrentBlock: 220,
      liveProgress: null,
      remainingBlocks: 0,
      scanInProgress: false,
      deferred: false,
    }));
  });
});
