jest.mock('utilities/logging', () => ({
  __esModule: true,
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    isEnabled: jest.fn(() => false),
  }),
}));

jest.mock('../web3/chainGateway.js', () => {
  const defaultExport = {
    getRelevantBlockWindowForFilter: jest.fn(),
    getAllSessionSlugs: jest.fn(() => []),
    getReadProviderForSession: jest.fn(),
    getSbtMetadata: jest.fn(),
    fetchSbtIDs: jest.fn(),
    fetchSbtTransactions: jest.fn(),
    getSbtBalance: jest.fn(),
    getAllSbtAddressesCached: jest.fn(),
    getSbtsCreated: jest.fn(),
    getSbtMintBurnCountsByAddress: jest.fn(),
    getSbtHistorySummary: jest.fn(),
    getSbtCreationBlockByAddress: jest.fn(),
    listenForSBTEvents: jest.fn(),
    listenForSBTInstanceEvents: jest.fn(),
    removeSBTEventListener: jest.fn(),
    removeSBTInstanceEventsListener: jest.fn(),
  };

  return {
    __esModule: true,
    default: defaultExport,
    getAllSessionSlugs: defaultExport.getAllSessionSlugs,
    getReadProviderForSession: defaultExport.getReadProviderForSession,
    normalizeSessionSlug: jest.fn((s) => String(s || '')),
  };
});

jest.mock('../../components/MainSite/mainSiteUtils', () => ({
  __esModule: true,
  emitMainSiteSbtDebug: jest.fn(),
  hasCoreSbtMetadata: jest.fn((info) => {
    if (!info || typeof info !== 'object') return false;
    const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';
    const tokenUri = info.tokenURI ?? info.tokenUri ?? null;
    const mintingEndRaw = info.mintingEndTime;
    const burnAuthRaw = info.burnAuth;
    const admin = String(info.admin || info.admin_ || '')
      .trim()
      .toLowerCase();
    const mintingEndOk =
      mintingEndRaw !== undefined && mintingEndRaw !== null && Number.isFinite(Number(mintingEndRaw));
    const burnAuthOk = burnAuthRaw !== undefined && burnAuthRaw !== null && Number.isFinite(Number(burnAuthRaw));
    return (
      hasValue(tokenUri) &&
      mintingEndOk &&
      burnAuthOk &&
      typeof info.hasPasswordMint === 'boolean' &&
      hasValue(info.maxTokens) &&
      !!admin &&
      admin !== '0x0000000000000000000000000000000000000000'
    );
  }),
  isForcedSbtSelectorDebugEnabled: jest.fn(() => false),
}));

jest.mock('../../components/MainSite/progressHelpers', () => ({
  __esModule: true,
  mapSbtWorkProgressToBlock: jest.fn(
    ({ baseFrom = 0, baseTo = 0, completedUnits = 0, totalUnits = 1, reserveTailBlocks = 0 }) => {
      const start = Math.max(0, Number(baseFrom) || 0);
      const end = Math.max(start, (Number(baseTo) || 0) - (Number(reserveTailBlocks) || 0));
      const ratio = totalUnits > 0 ? Math.max(0, Math.min(1, completedUnits / totalUnits)) : 1;
      return Math.floor(start + (end - start) * ratio);
    },
  ),
  mergeSbtLiveProgressEntry: jest.fn(),
  SBT_FULL_SCAN_DISCOVERY_UNITS: 60,
  SBT_FULL_SCAN_PROCESS_UNITS: 40,
  SBT_LIGHT_DISCOVERY_HYDRATION_UNITS: 30,
  SBT_LIGHT_DISCOVERY_SCAN_UNITS: 70,
  SBT_PROGRESS_FINAL_TAIL_BLOCKS: 3,
  SBT_PROGRESS_MIN_INTERVAL_MS: 250,
  shouldCommitThrottledProgress: jest.fn(() => true),
}));

const { createSessionSbtCacheController } = require('./sessionSbtCacheController.js');
const contractScriptsModule = require('../web3/chainGateway.js');
const contractScripts = contractScriptsModule.default;
const { normalizeSessionSlug } = contractScriptsModule;
const {
  emitMainSiteSbtDebug,
  hasCoreSbtMetadata,
  isForcedSbtSelectorDebugEnabled,
} = require('../session/mainSiteUtils');
const { mergeSbtLiveProgressEntry, shouldCommitThrottledProgress } = require('../session/mainSiteProgressHelpers');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const createCompleteSbtMetadata = (overrides = {}) => ({
  name: 'Mock SBT',
  tokenURI: 'ar://mock-sbt',
  tokenUri: 'ar://mock-sbt',
  mintingEndTime: 0,
  burnAuth: 0,
  hasPasswordMint: false,
  maxTokens: '1',
  admin: '0x00000000000000000000000000000000000000a1',
  ...overrides,
});

const hasMockCoreSbtMetadata = (info) => {
  if (!info || typeof info !== 'object') return false;
  const hasValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';
  const tokenUri = info.tokenURI ?? info.tokenUri ?? null;
  const mintingEndRaw = info.mintingEndTime;
  const burnAuthRaw = info.burnAuth;
  const admin = String(info.admin || info.admin_ || '')
    .trim()
    .toLowerCase();
  const mintingEndOk = mintingEndRaw !== undefined && mintingEndRaw !== null && Number.isFinite(Number(mintingEndRaw));
  const burnAuthOk = burnAuthRaw !== undefined && burnAuthRaw !== null && Number.isFinite(Number(burnAuthRaw));
  return (
    hasValue(tokenUri) &&
    mintingEndOk &&
    burnAuthOk &&
    typeof info.hasPasswordMint === 'boolean' &&
    hasValue(info.maxTokens) &&
    !!admin &&
    admin !== ZERO_ADDRESS
  );
};

const deepClone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

const buildSbtLiveProgressEntryForTests = (input = {}) => {
  const { prevEntry = null, nextPatch = null, nowMs = Date.now() } = input && typeof input === 'object' ? input : {};
  const prev = prevEntry && typeof prevEntry === 'object' ? prevEntry : {};
  const patch = nextPatch && typeof nextPatch === 'object' ? nextPatch : {};
  const rawCurrentBlock = Number(patch.currentBlock != null ? patch.currentBlock : prev.currentBlock);
  const rawLatestBlock = Number(patch.latestBlock != null ? patch.latestBlock : prev.latestBlock);
  const currentBlock = Math.max(
    Math.floor(Number(prev.currentBlock || 0)),
    Number.isFinite(rawCurrentBlock) ? Math.floor(rawCurrentBlock) : 0,
  );
  const latestBlock = Math.max(
    currentBlock,
    Math.floor(Number(prev.latestBlock || 0)),
    Number.isFinite(rawLatestBlock) ? Math.floor(rawLatestBlock) : 0,
  );
  return {
    ...prev,
    ...patch,
    currentBlock,
    latestBlock,
    updatedAtMs: Math.max(0, Math.floor(Number(patch.updatedAtMs || nowMs) || 0)),
  };
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const createMockHost = (overrides = {}) => {
  const { initialState, initialStorage, activeSlug, chainId, sessionScanScope, currentPath, account, ...rest } =
    overrides;

  let state = {
    isSBTCacheReady: false,
    sbtCacheRevision: 0,
    sbtScanProgressBySlug: {},
    sbtRealtimeCoverageBySlug: {},
    ...(deepClone(initialState) || {}),
  };
  const storage = deepClone(initialStorage || {});
  const applyStatePatch = (patch) => {
    if (!patch || typeof patch !== 'object') return;
    state = {
      ...state,
      ...patch,
    };
  };

  return {
    setState: jest.fn((updater, cb) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      applyStatePatch(patch);
      if (typeof cb === 'function') cb();
    }),
    dgRead: jest.fn((key, slug) => {
      const bucket = storage[key];
      if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, slug)) {
        return null;
      }
      return deepClone(bucket[slug]);
    }),
    dgWrite: jest.fn((key, slug, value) => {
      if (!storage[key]) storage[key] = {};
      storage[key][slug] = deepClone(value);
      return true;
    }),
    getActiveSessionSlug: jest.fn(() => activeSlug || 'alpha'),
    getSessionCfg: jest.fn((slug) => {
      if (slug === 'general') {
        return { featured_SBTs_LIST: [] };
      }
      return { ignored_SBTs_LIST: [], featured_SBTs_LIST: [] };
    }),
    getSessionChainId: jest.fn(() =>
      Object.prototype.hasOwnProperty.call(overrides, 'chainId') ? chainId : '11155420',
    ),
    getSessionScanScope: jest.fn(() => sessionScanScope || 'session'),
    getSessionScanScopeContext: jest.fn((scope) => ({
      scope: String(scope || ''),
      list: [activeSlug || 'alpha'],
      activeSlug: activeSlug || 'alpha',
      activeSlugFromRoute: true,
    })),
    getAccount: jest.fn(() => (Object.prototype.hasOwnProperty.call(overrides, 'account') ? account : '0xUser')),
    getCurrentPath: jest.fn(() => currentPath || '/session/alpha'),
    getEffectiveRoutePath: jest.fn((pathIn = '') => pathIn),
    getScopeFilteredSlugs: jest.fn((slugs = []) => slugs),
    getScopedSessionSlugs: jest.fn(() => [activeSlug || 'alpha']),
    shouldSkipSessionScanForSlug: jest.fn(() => false),
    scanScopeNoop: jest.fn(() => false),
    logScopeSkipOnce: jest.fn(),
    isSbtInstanceListenerEnabledForGroup: jest.fn(() => true),
    isSbtHistoryScanEnabled: jest.fn(() => true),
    shouldAutoRunFullSbtScan: jest.fn(() => true),
    checkAllCachesReady: jest.fn(),
    setReadinessStateIfChanged: jest.fn((patch, cb) => {
      applyStatePatch(patch);
      if (typeof cb === 'function') cb();
      return true;
    }),
    queueLocalRevisionUpdate: jest.fn(),
    mergeLegacyNumericNetworkKey: jest.fn(() => false),
    readFlag: jest.fn(() => false),
    writeFlag: jest.fn(),
    refreshEncryptedQuestionPayloadsForGroup: jest.fn(() => Promise.resolve()),
    runWithGeneralSessionBackfill: jest.fn(({ runPrimary, slugIn }) =>
      Promise.resolve(
        typeof runPrimary === 'function'
          ? runPrimary(normalizeSessionSlug(slugIn || activeSlug || 'alpha'))
          : undefined,
      ),
    ),
    getStateSnapshot: () => deepClone(state),
    getStored: (key, slug) => {
      const bucket = storage[key];
      if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, slug)) {
        return null;
      }
      return deepClone(bucket[slug]);
    },
    ...rest,
  };
};

describe('createSessionSbtCacheController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    normalizeSessionSlug.mockImplementation((s) => String(s || ''));
    contractScripts.getRelevantBlockWindowForFilter.mockResolvedValue({ fromBlock: 10, toBlock: 12 });
    contractScripts.getAllSessionSlugs.mockReturnValue([]);
    contractScripts.getReadProviderForSession.mockReturnValue(null);
    contractScripts.getSbtMetadata.mockResolvedValue(createCompleteSbtMetadata());
    contractScripts.fetchSbtIDs.mockResolvedValue([]);
    contractScripts.fetchSbtTransactions.mockResolvedValue([]);
    contractScripts.getSbtBalance.mockResolvedValue(0);
    contractScripts.getAllSbtAddressesCached.mockResolvedValue([]);
    contractScripts.getSbtsCreated.mockResolvedValue([]);
    contractScripts.getSbtMintBurnCountsByAddress.mockResolvedValue({
      mintedCountByAddress: {},
      burnedCountByAddress: {},
      mintedEventCount: 0,
      burnedEventCount: 0,
      ok: true,
    });
    contractScripts.getSbtHistorySummary.mockResolvedValue(null);
    contractScripts.getSbtCreationBlockByAddress.mockResolvedValue(null);
    hasCoreSbtMetadata.mockImplementation(hasMockCoreSbtMetadata);
    isForcedSbtSelectorDebugEnabled.mockReturnValue(false);
    mergeSbtLiveProgressEntry.mockImplementation(buildSbtLiveProgressEntryForTests);
    shouldCommitThrottledProgress.mockReturnValue(true);
    if (typeof window !== 'undefined') {
      window.ENABLE_RPC_DEBUG_LOGGING = false;
      delete window.MAX_SBT_INSTANCE_LISTENERS;
    }
  });

  afterEach(() => {
    jest.useRealTimers();
    if (typeof window !== 'undefined') {
      window.ENABLE_RPC_DEBUG_LOGGING = false;
      delete window.MAX_SBT_INSTANCE_LISTENERS;
    }
  });

  describe('count map utilities', () => {
    it('normalizes empty count maps to an empty object', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(controller.normalizeSbtCountMap(null)).toEqual({});
      expect(controller.normalizeSbtCountMap(undefined)).toEqual({});
      expect(controller.normalizeSbtCountMap({})).toEqual({});
    });

    it('normalizes count map addresses to lowercase and documents current numeric coercion behavior', () => {
      const controller = createSessionSbtCacheController(createMockHost());
      const normalized = controller.normalizeSbtCountMap({
        '0xAbC': '2',
        '0xDef': 0,
        '0xJKL': '1.9',
        '0xBad': -3,
        '0xNope': 'not-a-number',
        '': 4,
      });

      expect(normalized['0xabc']).toBe(2);
      expect(normalized['0xjkl']).toBe(1);
      expect(Object.prototype.hasOwnProperty.call(normalized, '0xdef')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(normalized, '0xbad')).toBe(false);
      // current controller coercion - not ideal
      expect(Object.prototype.hasOwnProperty.call(normalized, '0xnope')).toBe(true);
      expect(normalized['0xnope']).toBeNaN();
    });

    it('merges SBT count maps by normalized address', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(controller.mergeSbtCountMaps({ '0xabc': 1, '0xdef': 2 }, { '0xABC': 3, '0xGHI': 4 })).toEqual({
        '0xabc': 4,
        '0xdef': 2,
        '0xghi': 4,
      });
    });

    it('merges minted and burned payloads with event counters', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(
        controller.mergeSbtCountsPayload(
          {
            mintedCountByAddress: { '0xabc': 1 },
            burnedCountByAddress: { '0xdef': 2 },
            mintedEventCount: 3,
            burnedEventCount: 1,
          },
          {
            mintedCountByAddress: { '0xABC': 2, '0x999': 1 },
            burnedCountByAddress: { '0xDEF': 4 },
            mintedEventCount: '5',
            burnedEventCount: '6',
          },
        ),
      ).toEqual({
        mintedCountByAddress: {
          '0x999': 1,
          '0xabc': 3,
        },
        burnedCountByAddress: {
          '0xdef': 6,
        },
        mintedEventCount: 8,
        burnedEventCount: 7,
      });
    });

    it('sums normalized SBT count maps', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(
        controller.sumSbtCountMap({
          '0xAbC': '2',
          '0xDef': '3.9',
          '0xBad': -1,
          '0xNope': 'x',
        }),
      ).toBe(5);
    });

    it('seeds missing count entries from legacy address arrays', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(
        controller.seedSbtCountMapFromLegacyAddresses({ '0xabc': 2, '0xdef': 0 }, [
          '0xABC',
          '0xdef',
          '0xghi',
          '',
          null,
        ]),
      ).toEqual({
        '0xabc': 2,
        '0xdef': 1,
        '0xghi': 1,
      });
    });

    it('returns only current holders from minted and burned counts', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(
        controller.getCurrentHolderAddressesFromCounts({
          mintedCountByAddress: {
            '0xA': 2,
            '0xB': 1,
            '0xC': 1,
          },
          burnedCountByAddress: {
            '0xA': 1,
            '0xB': 1,
            '0xD': 5,
          },
        }),
      ).toEqual(['0xa', '0xc']);
    });

    it('builds history summaries from count maps', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(
        controller.buildSbtHistorySummaryFromCounts({
          mintedCountByAddress: {
            '0xA': 2,
            '0xB': 1,
          },
          burnedCountByAddress: {
            '0xA': 1,
          },
          mintedEventCount: 5,
          burnedEventCount: 2,
        }),
      ).toEqual({
        totalMinted: '5',
        totalBurned: '2',
        activeSupply: '2',
        currentHolderCount: '2',
        historicalHolderCount: '2',
      });
    });

    it('normalizes invalid history summaries to null', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(controller.normalizeSbtHistorySummary(null)).toBeNull();
      expect(controller.normalizeSbtHistorySummary({})).toBeNull();
      expect(
        controller.normalizeSbtHistorySummary({
          totalMinted: 'x',
          totalBurned: '0',
          activeSupply: '0',
          currentHolderCount: '0',
          historicalHolderCount: '0',
        }),
      ).toBeNull();
    });

    it('normalizes valid history summary fields as canonical digit strings', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(
        controller.normalizeSbtHistorySummary({
          totalMinted: '005',
          totalBurned: '000',
          activeSupply: '03',
          currentHolderCount: '02',
          historicalHolderCount: '010',
        }),
      ).toEqual({
        totalMinted: '5',
        totalBurned: '0',
        activeSupply: '3',
        currentHolderCount: '2',
        historicalHolderCount: '10',
      });
    });

    it('hydrates legacy address arrays into normalized count state', () => {
      const controller = createSessionSbtCacheController(createMockHost());
      const entry = {
        mintedAddresses: ['0xAAA', '0xbbb', '0xAAA'],
        burnedAddresses: ['0xccc'],
        mintedCountByAddress: { '0xAAA': 2 },
        burnedCountByAddress: { '0xBBB': 2 },
        mintedEventCount: 1,
        burnedEventCount: 0,
      };

      const hydrated = controller.hydrateLegacySbtCountState(entry);

      expect(hydrated).toBe(entry);
      expect(hydrated).toEqual({
        mintedAddresses: ['0xaaa', '0xbbb'],
        burnedAddresses: ['0xccc'],
        mintedCountByAddress: {
          '0xaaa': 2,
          '0xbbb': 1,
        },
        burnedCountByAddress: {
          '0xbbb': 2,
          '0xccc': 1,
        },
        mintedEventCount: 3,
        burnedEventCount: 3,
      });
    });
  });

  describe('realtime event cursor utilities', () => {
    it('normalizes nullish and invalid cursors to null', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(controller.normalizeSbtRealtimeEventCursor(null)).toBeNull();
      expect(controller.normalizeSbtRealtimeEventCursor(undefined)).toBeNull();
      expect(controller.normalizeSbtRealtimeEventCursor({})).toBeNull();
      expect(controller.normalizeSbtRealtimeEventCursor({ blockNumber: -1 })).toBeNull();
    });

    it('normalizes valid cursors and defaults missing indexes to -1', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(
        controller.normalizeSbtRealtimeEventCursor({
          blockNumber: '12.9',
          transactionIndex: '3.2',
          logIndex: '4.7',
        }),
      ).toEqual({
        blockNumber: 12,
        transactionIndex: 3,
        logIndex: 4,
      });

      expect(
        controller.normalizeSbtRealtimeEventCursor({
          blockNumber: 9,
        }),
      ).toEqual({
        blockNumber: 9,
        transactionIndex: -1,
        logIndex: -1,
      });
    });

    it('orders cursors by block number first', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(
        controller.compareSbtRealtimeEventCursor(
          { blockNumber: 10, transactionIndex: 1, logIndex: 1 },
          { blockNumber: 11, transactionIndex: 0, logIndex: 0 },
        ),
      ).toBeLessThan(0);
    });

    it('orders equal-block cursors by transaction and log index, with null semantics', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(
        controller.compareSbtRealtimeEventCursor(
          { blockNumber: 10, transactionIndex: 2, logIndex: 1 },
          { blockNumber: 10, transactionIndex: 2, logIndex: 3 },
        ),
      ).toBeLessThan(0);
      expect(controller.compareSbtRealtimeEventCursor(null, null)).toBe(0);
      expect(controller.compareSbtRealtimeEventCursor(null, { blockNumber: 1 })).toBe(-1);
      expect(controller.compareSbtRealtimeEventCursor({ blockNumber: 1 }, null)).toBe(1);
    });
  });

  describe('progress and realtime state', () => {
    it('begins, updates, and clears live progress entries through host state', () => {
      const host = createMockHost({
        initialState: {
          sbtScanProgressBySlug: {
            beta: {
              slug: 'beta',
              currentBlock: 1,
              latestBlock: 2,
            },
          },
        },
      });
      const controller = createSessionSbtCacheController(host);

      const token = controller.beginSbtLiveProgress('alpha', {
        currentBlock: 10,
        latestBlock: 20,
      });

      expect(token).toBe(1);
      expect(host.getStateSnapshot().sbtScanProgressBySlug.beta).toMatchObject({
        slug: 'beta',
        currentBlock: 1,
        latestBlock: 2,
      });
      expect(host.getStateSnapshot().sbtScanProgressBySlug.alpha).toMatchObject({
        slug: 'alpha',
        currentBlock: 10,
        latestBlock: 20,
      });

      expect(
        controller.updateSbtLiveProgress('alpha', token, {
          currentBlock: 15,
          latestBlock: 20,
        }),
      ).toBe(true);
      expect(host.getStateSnapshot().sbtScanProgressBySlug.alpha).toMatchObject({
        currentBlock: 15,
        latestBlock: 20,
      });

      expect(
        controller.updateSbtLiveProgress('alpha', token, {
          currentBlock: 14,
          latestBlock: 19,
        }),
      ).toBe(true);
      expect(host.getStateSnapshot().sbtScanProgressBySlug.alpha).toMatchObject({
        currentBlock: 15,
        latestBlock: 20,
      });

      controller.clearSbtLiveProgress('alpha', token);

      expect(host.getStateSnapshot().sbtScanProgressBySlug).toEqual({
        beta: {
          slug: 'beta',
          currentBlock: 1,
          latestBlock: 2,
        },
      });
    });

    it('does not commit throttled live progress updates when the helper declines the write', () => {
      const host = createMockHost();
      const controller = createSessionSbtCacheController(host);

      const token = controller.beginSbtLiveProgress('alpha', {
        currentBlock: 10,
        latestBlock: 20,
      });

      expect(
        controller.updateSbtLiveProgress('alpha', token, {
          currentBlock: 15,
          latestBlock: 20,
        }),
      ).toBe(true);
      const committedSnapshot = host.getStateSnapshot();

      shouldCommitThrottledProgress.mockReturnValue(false);

      expect(
        controller.updateSbtLiveProgress('alpha', token, {
          currentBlock: 18,
          latestBlock: 20,
        }),
      ).toBe(false);
      expect(host.setState).toHaveBeenCalledTimes(2);
      expect(host.getStateSnapshot()).toEqual(committedSnapshot);
    });

    it('sets and clears realtime coverage flags per group', () => {
      const host = createMockHost();
      const controller = createSessionSbtCacheController(host);

      controller.setSbtRealtimeCoverageForGroup('alpha', true);
      expect(host.getStateSnapshot().sbtRealtimeCoverageBySlug).toEqual({
        alpha: true,
      });

      controller.clearSbtRealtimeCoverageForGroup('alpha');
      expect(host.getStateSnapshot().sbtRealtimeCoverageBySlug).toEqual({});
    });

    it('removes realtime listeners for a group and clears coverage', () => {
      const host = createMockHost({
        initialState: {
          sbtRealtimeCoverageBySlug: {
            alpha: true,
          },
        },
      });
      const controller = createSessionSbtCacheController(host);

      controller.removeSbtRealtimeListenersForGroup('alpha');

      expect(contractScripts.removeSBTEventListener).toHaveBeenCalledWith('none', 'alpha');
      expect(contractScripts.removeSBTInstanceEventsListener).toHaveBeenCalledWith('none', [], 'alpha');
      expect(host.getStateSnapshot().sbtRealtimeCoverageBySlug).toEqual({});
    });
  });

  describe('factory and host adapter smoke coverage', () => {
    it('creates a controller with the expected public API surface', () => {
      const controller = createSessionSbtCacheController(createMockHost());

      expect(controller).toMatchObject({
        beginSbtLiveProgress: expect.any(Function),
        ensureLightSbtDiscovery: expect.any(Function),
        initializeSbtCacheForGroup: expect.any(Function),
        startSbtEventListenerForGroup: expect.any(Function),
        onNewSbtEventDetectedForGroup: expect.any(Function),
        destroy: expect.any(Function),
      });
      expect(controller.normalizeSbtCountMap({})).toEqual({});
      expect(controller.sumSbtCountMap({})).toBe(0);
      expect(controller.normalizeSbtRealtimeEventCursor({ blockNumber: 4 })).toEqual({
        blockNumber: 4,
        transactionIndex: -1,
        logIndex: -1,
      });
    });

    it('does not throw and still enters controller logic on a minimal chainless host', async () => {
      const host = createMockHost({
        chainId: '',
        currentPath: '/dashboard',
      });
      const controller = createSessionSbtCacheController(host);

      expect(() => controller.beginSbtLiveProgress('alpha')).not.toThrow();
      expect(() => controller.clearSbtLiveProgress('alpha')).not.toThrow();
      expect(() => controller.setSbtRealtimeCoverageForGroup('alpha')).not.toThrow();
      expect(() => controller.clearSbtRealtimeCoverageForGroup('alpha')).not.toThrow();
      expect(() => controller.startSbtEventListener()).not.toThrow();

      await expect(controller.initializeSbtCache()).resolves.toBeUndefined();

      expect(host.getActiveSessionSlug).toHaveBeenCalled();
      expect(host.runWithGeneralSessionBackfill).toHaveBeenCalledWith(
        expect.objectContaining({
          slugIn: 'alpha',
          operation: 'initializeSbtCache',
          runPrimary: expect.any(Function),
          runGeneral: expect.any(Function),
        }),
      );
      expect(host.getSessionChainId).toHaveBeenCalledWith('alpha');
      expect(host.getStateSnapshot()).toMatchObject({ isSBTCacheReady: true });

      host.getSessionChainId.mockClear();
      emitMainSiteSbtDebug.mockClear();

      await expect(controller.ensureLightSbtDiscovery('alpha')).resolves.toBeUndefined();

      expect(host.getSessionChainId).toHaveBeenCalledWith('alpha');
      expect(emitMainSiteSbtDebug).toHaveBeenNthCalledWith(
        1,
        'info',
        '[ensureLightSbtDiscovery] start',
        expect.objectContaining({
          slug: 'alpha',
          force: false,
          hasForcedScopeSlug: false,
          forcedScopeSlug: '',
        }),
      );
      expect(emitMainSiteSbtDebug).toHaveBeenNthCalledWith(
        2,
        'warn',
        '[ensureLightSbtDiscovery] skipped (missing chain)',
        expect.objectContaining({
          slug: 'alpha',
          hasForcedScopeSlug: false,
          forcedScopeSlug: '',
        }),
      );
      expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
      expect(() => controller.destroy()).not.toThrow();
    });
  });

  describe('guard behaviors', () => {
    it('short-circuits initializeSbtCacheForGroup via scan scope noop', async () => {
      const host = createMockHost({
        scanScopeNoop: jest.fn((slug, op, onSkipped) => {
          onSkipped();
          return true;
        }),
      });
      const controller = createSessionSbtCacheController(host);

      await controller.initializeSbtCacheForGroup('alpha');

      expect(host.getStateSnapshot()).toMatchObject({ isSBTCacheReady: true });
      expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
      expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
    });

    it('marks SBT cache ready and skips RPC work when chain ID is missing during init', async () => {
      const host = createMockHost({
        chainId: '',
        currentPath: '/dashboard',
      });
      const controller = createSessionSbtCacheController(host);

      await controller.initializeSbtCacheForGroup('alpha');

      expect(host.getStateSnapshot()).toMatchObject({ isSBTCacheReady: true });
      expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
    });

    it('passes the resolved demo session config to SBT block-window initialization', async () => {
      const demoCfg = {
        slug: 'demo-1',
        networkChainId: 11155420,
        blockLimits: { start: 44967477, end: null },
        ignored_SBTs_LIST: [],
        featured_SBTs_LIST: [],
      };
      const host = createMockHost({
        activeSlug: 'demo-1',
        currentPath: '/session/demo-1',
        getSessionCfg: jest.fn((slug) => (slug === 'demo-1' ? demoCfg : null)),
      });
      const controller = createSessionSbtCacheController(host);

      await controller.initializeSbtCacheForGroup('demo-1', { mode: 'partial' });

      expect(contractScripts.getRelevantBlockWindowForFilter.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          slug: 'demo-1',
          blockLimits: { start: 44967477, end: null },
        }),
      );
    });

    it('skips light discovery early when chain ID is missing', async () => {
      const host = createMockHost({ chainId: '' });
      const controller = createSessionSbtCacheController(host);

      await expect(controller.ensureLightSbtDiscovery('alpha')).resolves.toBeUndefined();

      expect(contractScripts.getRelevantBlockWindowForFilter).not.toHaveBeenCalled();
      expect(emitMainSiteSbtDebug).toHaveBeenCalledWith(
        'warn',
        expect.stringContaining('missing chain'),
        expect.objectContaining({ slug: 'alpha' }),
      );
    });

    it('uses display alias chain/config for light discovery while writing to the alias cache bucket', async () => {
      const demoSbt = '0x00000000000000000000000000000000000000d1';
      const displayCfg = {
        slug: 'demo',
        networkChainId: 11155420,
        ignored_SBTs_LIST: [],
        featured_SBTs_LIST: [],
      };
      const host = createMockHost({
        activeSlug: 'demo',
        currentPath: '/session/demo',
        getSessionChainId: jest.fn((slug) => (slug === 'demo' ? '11155420' : '')),
        getSessionCfg: jest.fn((slug) => (slug === 'demo' ? displayCfg : null)),
      });
      const controller = createSessionSbtCacheController(host);

      contractScripts.getAllSbtAddressesCached.mockResolvedValueOnce([demoSbt]);

      await controller.ensureLightSbtDiscovery('demo', {
        force: true,
        forceScopeSlug: 'demo',
      });

      expect(host.getSessionChainId).toHaveBeenCalledWith('demo');
      expect(host.getSessionCfg).toHaveBeenCalledWith('demo');
      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'demo',
          networkChainId: 11155420,
          __ignoreSessionScanScope: true,
        }),
      );
      expect(contractScripts.getAllSbtAddressesCached).toHaveBeenCalledWith(
        'none',
        expect.objectContaining({
          slug: 'demo',
          networkChainId: 11155420,
          __ignoreSessionScanScope: true,
        }),
        expect.objectContaining({
          force: true,
          fromBlock: 10,
          toBlock: 12,
          onProgress: expect.any(Function),
          onDiscoveredAddresses: expect.any(Function),
        }),
      );
      expect(host.getStored('sbtCache', 'demo')).toEqual(
        expect.objectContaining({
          11155420: expect.objectContaining({
            lastBlock: 12,
            sbtList: expect.objectContaining({
              [demoSbt.toLowerCase()]: expect.objectContaining({
                sbtAddress: demoSbt,
                slug: 'demo',
                sessionSlug: 'demo',
                sessionSlugExplicit: false,
                sbtInfo: expect.objectContaining({
                  name: 'Mock SBT',
                  sessionSlug: 'demo',
                  sessionSlugExplicit: false,
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('preserves explicit SBT metadata session bindings during light discovery', async () => {
      const sbtAddress = '0x0000000000000000000000000000000000000e01';
      const explicitMetadata = createCompleteSbtMetadata({
        name: 'Explicit Alpha SBT',
        sessionSlug: 'alpha',
        sessionSlugExplicit: true,
      });
      const host = createMockHost({
        initialStorage: {
          sbtCache: {
            alpha: {
              11155420: {
                lastBlock: 12,
                sbtList: {
                  [sbtAddress.toLowerCase()]: {
                    sbtAddress,
                    sbtInfo: {
                      name: 'Needs Hydration',
                    },
                    blockNumber: 12,
                  },
                },
              },
            },
          },
        },
      });
      const controller = createSessionSbtCacheController(host);

      contractScripts.getSbtMetadata.mockResolvedValueOnce(explicitMetadata);
      contractScripts.getAllSbtAddressesCached.mockResolvedValueOnce([]);

      await controller.ensureLightSbtDiscovery('alpha');

      expect(host.getStored('sbtCache', 'alpha')).toEqual(
        expect.objectContaining({
          11155420: expect.objectContaining({
            sbtList: expect.objectContaining({
              [sbtAddress.toLowerCase()]: expect.objectContaining({
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
                sbtInfo: expect.objectContaining({
                  name: 'Explicit Alpha SBT',
                  sessionSlug: 'alpha',
                  sessionSlugExplicit: true,
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('downgrades stale cache-scoped explicit flags when hydrated metadata is inferred', async () => {
      const sbtAddress = '0x0000000000000000000000000000000000000e02';
      const staleMetadata = createCompleteSbtMetadata({
        name: 'Stale Bucket-Promoted SBT',
        sessionSlug: 'alpha',
        sessionSlugExplicit: true,
      });
      delete staleMetadata.tokenUriMetadataFetched;
      const hydratedMetadata = createCompleteSbtMetadata({
        name: 'Hydrated Inferred SBT',
        image: 'ar://image-tx',
        sessionSlug: 'alpha',
        sessionSlugExplicit: false,
        tokenUriMetadataFetched: true,
      });
      const host = createMockHost({
        initialStorage: {
          sbtCache: {
            alpha: {
              11155420: {
                lastBlock: 12,
                sbtList: {
                  [sbtAddress.toLowerCase()]: {
                    sbtAddress,
                    sessionSlug: 'alpha',
                    sessionSlugExplicit: true,
                    sbtInfo: staleMetadata,
                    blockNumber: 12,
                  },
                },
              },
            },
          },
        },
      });
      const controller = createSessionSbtCacheController(host);

      contractScripts.getSbtMetadata.mockResolvedValueOnce(hydratedMetadata);
      contractScripts.getAllSbtAddressesCached.mockResolvedValueOnce([]);

      await controller.ensureLightSbtDiscovery('alpha');

      expect(host.getStored('sbtCache', 'alpha')).toEqual(
        expect.objectContaining({
          11155420: expect.objectContaining({
            sbtList: expect.objectContaining({
              [sbtAddress.toLowerCase()]: expect.objectContaining({
                sessionSlug: 'alpha',
                sessionSlugExplicit: false,
                sbtInfo: expect.objectContaining({
                  name: 'Hydrated Inferred SBT',
                  sessionSlug: 'alpha',
                  sessionSlugExplicit: false,
                  tokenUriMetadataFetched: true,
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('rehydrates core-only cached SBT metadata so list cards recover tokenURI image and description fields', async () => {
      const sbtAddress = '0x00000000000000000000000000000000000000a1';
      const cachedCoreOnly = createCompleteSbtMetadata({
        name: 'Cached Core Only',
      });
      delete cachedCoreOnly.description;
      delete cachedCoreOnly.image;
      delete cachedCoreOnly.tokenUriMetadataFetched;
      const hydratedMetadata = createCompleteSbtMetadata({
        name: 'Hydrated SBT',
        description: 'Visible list description',
        image: 'ar://image-tx',
        tokenUriMetadataFetched: true,
      });
      const host = createMockHost({
        initialStorage: {
          sbtCache: {
            alpha: {
              11155420: {
                lastBlock: 12,
                sbtList: {
                  [sbtAddress.toLowerCase()]: {
                    sbtAddress,
                    sbtInfo: cachedCoreOnly,
                    blockNumber: 12,
                  },
                },
              },
            },
          },
        },
      });
      const controller = createSessionSbtCacheController(host);

      contractScripts.getSbtMetadata.mockResolvedValueOnce(hydratedMetadata);
      contractScripts.getAllSbtAddressesCached.mockResolvedValueOnce([]);

      await controller.ensureLightSbtDiscovery('alpha');

      expect(contractScripts.getSbtMetadata).toHaveBeenCalledWith('none', sbtAddress, 'alpha');
      expect(contractScripts.getAllSbtAddressesCached).not.toHaveBeenCalled();
      expect(host.getStored('sbtCache', 'alpha')).toEqual(
        expect.objectContaining({
          11155420: expect.objectContaining({
            sbtList: expect.objectContaining({
              [sbtAddress.toLowerCase()]: expect.objectContaining({
                blockNumber: 12,
                sbtInfo: expect.objectContaining({
                  description: 'Visible list description',
                  image: 'ar://image-tx',
                  tokenUriMetadataFetched: true,
                  sessionSlug: 'alpha',
                  sessionSlugExplicit: false,
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('keeps light discovery watermark behind failed metadata hydration so later runs retry', async () => {
      const sbtAddress = '0x0000000000000000000000000000000000000f01';
      const hydratedMetadata = createCompleteSbtMetadata({
        name: 'Hydrated After Retry',
        description: 'Recovered description',
        image: 'ar://retry-image',
        tokenUriMetadataFetched: true,
      });
      const host = createMockHost();
      const controller = createSessionSbtCacheController(host);

      contractScripts.getAllSbtAddressesCached.mockReset();
      contractScripts.getAllSbtAddressesCached.mockResolvedValue([sbtAddress]);
      contractScripts.getSbtMetadata
        .mockRejectedValueOnce(new Error('metadata gateway down'))
        .mockResolvedValueOnce(hydratedMetadata);

      await controller.ensureLightSbtDiscovery('alpha');

      const afterFailure = host.getStored('sbtCache', 'alpha');
      expect(afterFailure[11155420].lastBlock).toBe(9);
      expect(afterFailure[11155420].sbtList[sbtAddress.toLowerCase()]).toEqual(
        expect.objectContaining({
          sbtAddress,
          sbtInfo: null,
        }),
      );

      await controller.ensureLightSbtDiscovery('alpha');

      expect(contractScripts.getSbtMetadata).toHaveBeenCalledTimes(2);
      expect(contractScripts.getAllSbtAddressesCached).toHaveBeenNthCalledWith(
        2,
        'none',
        'alpha',
        expect.objectContaining({
          fromBlock: 10,
          toBlock: 12,
        }),
      );
      expect(host.getStored('sbtCache', 'alpha')).toEqual(
        expect.objectContaining({
          11155420: expect.objectContaining({
            lastBlock: 12,
            sbtList: expect.objectContaining({
              [sbtAddress.toLowerCase()]: expect.objectContaining({
                sbtInfo: expect.objectContaining({
                  name: 'Hydrated After Retry',
                  description: 'Recovered description',
                  image: 'ar://retry-image',
                  tokenUriMetadataFetched: true,
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('completes full scan holder writes when user cache has malformed SBT rows', async () => {
      const sbtAddress = '0x0000000000000000000000000000000000000f02';
      const holder = '0x0000000000000000000000000000000000000abc';
      const sbtMetadata = createCompleteSbtMetadata({
        name: 'Full Scan Holder SBT',
        creationBlock: 10,
      });
      const host = createMockHost({
        currentPath: '/dashboard',
        initialStorage: {
          userCache: {
            alpha: {
              [holder]: {
                11155420: {
                  lastBlockScanned: 9,
                  lastScanTimestamp: 1,
                  data: {
                    sbts: [{ sbtInfo: { name: 'legacy row without address' } }],
                    createdSurveys: [],
                    createdQuestions: [],
                    surveyResponses: [],
                    questionResponses: [],
                  },
                },
              },
            },
          },
        },
      });
      const controller = createSessionSbtCacheController(host);

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValueOnce({ fromBlock: 10, toBlock: 12 });
      contractScripts.getSbtsCreated.mockResolvedValueOnce([{ sbtAddress, creationBlock: 10 }]);
      contractScripts.getSbtMetadata.mockResolvedValueOnce(sbtMetadata);
      contractScripts.getSbtMintBurnCountsByAddress.mockResolvedValueOnce({
        ok: true,
        mintedCountByAddress: {
          [holder]: 1,
        },
        burnedCountByAddress: {},
        mintedEventCount: 1,
        burnedEventCount: 0,
      });

      await controller.initializeSbtCacheForGroup('alpha', { mode: 'full' });

      const storedUserCache = host.getStored('userCache', 'alpha');
      const storedSbtCache = host.getStored('sbtCache', 'alpha');

      expect(storedSbtCache[11155420]).toEqual(
        expect.objectContaining({
          lastBlock: 12,
          sbtList: expect.objectContaining({
            [sbtAddress.toLowerCase()]: expect.objectContaining({
              sbtAddress,
              sbtInfo: expect.objectContaining({ name: 'Full Scan Holder SBT' }),
            }),
          }),
        }),
      );
      expect(storedUserCache[holder][11155420].data.sbts).toEqual([
        { sbtInfo: { name: 'legacy row without address' } },
        {
          sbtAddress,
          sbtInfo: expect.objectContaining({ name: 'Full Scan Holder SBT' }),
        },
      ]);
      expect(host.writeFlag).toHaveBeenCalledWith('sbt:fullScanInProgress', 'alpha', false);
    });

    it('keeps full-scan discovery watermark behind when factory discovery fails', async () => {
      const sbtAddress = '0x0000000000000000000000000000000000000f03';
      const existingMetadata = createCompleteSbtMetadata({
        name: 'Existing Full Scan SBT',
        creationBlock: 10,
      });
      const host = createMockHost({
        currentPath: '/dashboard',
        initialStorage: {
          sbtCache: {
            alpha: {
              11155420: {
                lastBlock: 9,
                sbtList: {
                  [sbtAddress.toLowerCase()]: {
                    sbtAddress,
                    sbtInfo: existingMetadata,
                    blockNumber: 9,
                    countsLoaded: false,
                  },
                },
              },
            },
          },
        },
      });
      const controller = createSessionSbtCacheController(host);

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValueOnce({ fromBlock: 10, toBlock: 40 });
      contractScripts.getSbtsCreated.mockRejectedValueOnce(new Error('factory logs unavailable'));
      contractScripts.getSbtMintBurnCountsByAddress.mockResolvedValueOnce({
        ok: true,
        mintedCountByAddress: {},
        burnedCountByAddress: {},
        mintedEventCount: 0,
        burnedEventCount: 0,
      });

      await controller.initializeSbtCacheForGroup('alpha', { mode: 'full' });

      const storedSbtCache = host.getStored('sbtCache', 'alpha');

      expect(contractScripts.getSbtsCreated).toHaveBeenCalledWith(
        'none',
        10,
        40,
        'alpha',
        expect.objectContaining({ onProgress: expect.any(Function) }),
      );
      expect(storedSbtCache[11155420]).toEqual(
        expect.objectContaining({
          lastBlock: 9,
          sbtList: expect.objectContaining({
            [sbtAddress.toLowerCase()]: expect.objectContaining({
              sbtAddress,
              blockNumber: 40,
            }),
          }),
        }),
      );
      expect(host.writeFlag).toHaveBeenCalledWith('sbt:deferredFullScanNeeded', 'alpha', true);
      expect(host.writeFlag).toHaveBeenCalledWith('sbt:partialReady', 'alpha', true);
      expect(host.writeFlag).toHaveBeenCalledWith('sbt:fullScanInProgress', 'alpha', false);
    });

    it('deduplicates concurrent light discovery calls for the same in-flight key', async () => {
      const host = createMockHost();
      const controller = createSessionSbtCacheController(host);
      const deferred = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter.mockReturnValueOnce(deferred.promise);

      const firstRun = controller.ensureLightSbtDiscovery('alpha');
      const secondRun = controller.ensureLightSbtDiscovery('alpha');

      expect(secondRun).toBe(firstRun);

      deferred.resolve({ fromBlock: 10, toBlock: 12 });
      await Promise.all([firstRun, secondRun]);

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(1);
    });

    it('skips instance listener attachment when chain ID is missing', () => {
      const host = createMockHost({ chainId: '' });
      const controller = createSessionSbtCacheController(host);

      controller.startSbtEventListenerForGroup('alpha');

      expect(contractScripts.removeSBTEventListener).toHaveBeenCalledWith('none', 'alpha');
      expect(contractScripts.removeSBTInstanceEventsListener).toHaveBeenCalledWith('none', [], 'alpha');
      expect(contractScripts.listenForSBTEvents).toHaveBeenCalledWith('none', expect.any(Function), 'alpha');
      expect(contractScripts.listenForSBTInstanceEvents).not.toHaveBeenCalled();
      expect(host.dgRead).not.toHaveBeenCalled();
    });

    it('uses an injected event stream port for SBT listener wiring', () => {
      const sbtEventStreamsPort = {
        listenForSBTEvents: jest.fn(),
        removeSBTEventListener: jest.fn(),
        listenForSurveyEvents: jest.fn(),
        removeSurveyEventsListener: jest.fn(),
        listenForSBTInstanceEvents: jest.fn(),
        removeSBTInstanceEventsListener: jest.fn(),
      };
      const host = createMockHost({ chainId: '', sbtEventStreamsPort });
      const controller = createSessionSbtCacheController(host);

      controller.startSbtEventListenerForGroup('alpha');

      expect(sbtEventStreamsPort.removeSBTEventListener).toHaveBeenCalledWith('none', 'alpha');
      expect(sbtEventStreamsPort.removeSBTInstanceEventsListener).toHaveBeenCalledWith('none', [], 'alpha');
      expect(sbtEventStreamsPort.listenForSBTEvents).toHaveBeenCalledWith('none', expect.any(Function), 'alpha');
      expect(sbtEventStreamsPort.listenForSBTInstanceEvents).not.toHaveBeenCalled();
      expect(contractScripts.removeSBTEventListener).not.toHaveBeenCalled();
      expect(contractScripts.removeSBTInstanceEventsListener).not.toHaveBeenCalled();
      expect(contractScripts.listenForSBTEvents).not.toHaveBeenCalled();
      expect(contractScripts.listenForSBTInstanceEvents).not.toHaveBeenCalled();
    });

    it('attaches a detail-page instance listener through the controller', () => {
      const host = createMockHost();
      const controller = createSessionSbtCacheController(host);

      expect(controller.startSbtDetailInstanceListenerForGroup('alpha', ['0xSbt'])).toBe(true);

      expect(contractScripts.listenForSBTInstanceEvents).toHaveBeenCalledWith(
        'none',
        ['0xSbt'],
        expect.any(Function),
        'alpha',
      );
      expect(contractScripts.removeSBTEventListener).not.toHaveBeenCalled();
      expect(contractScripts.removeSBTInstanceEventsListener).not.toHaveBeenCalled();
    });

    it('does not attach a detail-page instance listener without a slug and address', () => {
      const host = createMockHost();
      const controller = createSessionSbtCacheController(host);

      expect(controller.startSbtDetailInstanceListenerForGroup('', ['0xSbt'])).toBe(false);
      expect(controller.startSbtDetailInstanceListenerForGroup('alpha', [])).toBe(false);

      expect(contractScripts.listenForSBTInstanceEvents).not.toHaveBeenCalled();
    });
  });

  describe('refreshSbtDataForGroup', () => {
    it('writes refreshed count data into the cache on the happy path', async () => {
      const host = createMockHost({
        initialStorage: {
          sbtCache: {
            alpha: {
              11155420: {
                lastBlock: 9,
                sbtList: {
                  '0xsbt': {
                    sbtAddress: '0xSBT',
                    sbtInfo: createCompleteSbtMetadata({
                      name: 'Cached SBT',
                      creationBlock: 10,
                    }),
                    slug: 'alpha',
                    creationBlock: 10,
                  },
                },
              },
            },
          },
        },
      });
      const controller = createSessionSbtCacheController(host);

      contractScripts.getRelevantBlockWindowForFilter.mockResolvedValueOnce({
        fromBlock: 10,
        toBlock: 12,
      });
      contractScripts.getSbtMintBurnCountsByAddress.mockResolvedValueOnce({
        ok: true,
        mintedCountByAddress: {
          '0xaaa': 2,
          '0xbbb': 1,
        },
        burnedCountByAddress: {
          '0xaaa': 1,
        },
        mintedEventCount: 3,
        burnedEventCount: 1,
      });

      await controller.refreshSbtDataForGroup('alpha', '0xSBT', {
        forceCounts: true,
        countsOnly: true,
      });

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'alpha' }),
      );
      expect(contractScripts.getSbtMetadata).not.toHaveBeenCalled();
      expect(contractScripts.getSbtMintBurnCountsByAddress).toHaveBeenCalledWith(
        'none',
        '0xSBT',
        10,
        12,
        'alpha',
        expect.objectContaining({
          onCheckpoint: expect.any(Function),
        }),
      );
      expect(contractScripts.getSbtHistorySummary).not.toHaveBeenCalled();
      expect(host.dgWrite).toHaveBeenLastCalledWith(
        'sbtCache',
        'alpha',
        expect.objectContaining({
          11155420: expect.objectContaining({
            lastBlock: 9,
            sbtList: expect.objectContaining({
              '0xsbt': expect.objectContaining({
                schemaVersion: 1,
                sbtAddress: '0xSBT',
                sbtInfo: expect.objectContaining({
                  name: 'Cached SBT',
                  creationBlock: 10,
                }),
                creationBlock: 10,
                countsLoaded: true,
                mintedAddresses: ['0xaaa', '0xbbb'],
                burnedAddresses: ['0xaaa'],
                mintedCountByAddress: {
                  '0xaaa': 2,
                  '0xbbb': 1,
                },
                burnedCountByAddress: {
                  '0xaaa': 1,
                },
                mintedEventCount: 3,
                burnedEventCount: 1,
                historySummary: {
                  totalMinted: '3',
                  totalBurned: '1',
                  activeSupply: '2',
                  currentHolderCount: '2',
                  historicalHolderCount: '2',
                },
                blockNumber: 12,
                countsScanCheckpoint: null,
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('destroy', () => {
    it('clears progress token state so later updates are ignored', () => {
      const controller = createSessionSbtCacheController(createMockHost());
      const token = controller.beginSbtLiveProgress('alpha', { currentBlock: 1, latestBlock: 2 });

      controller.destroy();

      expect(controller.updateSbtLiveProgress('alpha', token, { currentBlock: 2 })).toBe(false);
    });

    it('resets light discovery in-flight tracking so a new run can start', async () => {
      const controller = createSessionSbtCacheController(createMockHost());
      const firstWindow = createDeferred();
      const secondWindow = createDeferred();

      contractScripts.getRelevantBlockWindowForFilter
        .mockReturnValueOnce(firstWindow.promise)
        .mockReturnValueOnce(secondWindow.promise);

      const firstRun = controller.ensureLightSbtDiscovery('alpha');
      const duplicateRun = controller.ensureLightSbtDiscovery('alpha');

      expect(duplicateRun).toBe(firstRun);

      controller.destroy();

      const secondRun = controller.ensureLightSbtDiscovery('alpha');

      expect(secondRun).not.toBe(firstRun);

      firstWindow.resolve({ fromBlock: 10, toBlock: 12 });
      secondWindow.resolve({ fromBlock: 10, toBlock: 12 });

      await Promise.all([firstRun, secondRun]);

      expect(contractScripts.getRelevantBlockWindowForFilter).toHaveBeenCalledTimes(2);
    });
  });
});
