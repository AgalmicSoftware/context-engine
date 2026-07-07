jest.mock(
  'utilities/logging.js',
  () => ({
    __esModule: true,
    createLogger: () => ({
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }),
  }),
  { virtual: true },
);

jest.mock(
  '../../utilities/web3/chainGateway',
  () => ({
    __esModule: true,
    normalizeSessionSlug: jest.fn(),
  }),
);

const { createSessionCacheReadinessController } = require('./sessionCacheReadinessController.js');
const {
  resetCeRuntimeStats,
  snapshotCeRuntimeStats,
  startCeRuntimeStats,
  stopCeRuntimeStats,
} = require('../../utilities/ui/uiRuntimeStats.js');
const contractScriptsModule = require('../../utilities/web3/chainGateway');

const createMockHost = (overrides = {}) => {
  const { initialState, mounted, activeSlug, ...rest } = overrides;
  const state = {
    sbtCacheRevision: 0,
    questionResponsesNonce: 0,
    isSBTCacheReady: false,
    ...initialState,
  };
  return {
    getState: jest.fn(() => ({ ...state })),
    setState: jest.fn((updater, cb) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      if (patch) Object.assign(state, patch);
      if (typeof cb === 'function') cb();
    }),
    isMounted: jest.fn(() => mounted !== false),
    resolveActiveSlug: jest.fn(() => activeSlug || 'test-slug'),
    getSessionSlugFromState: jest.fn(() => activeSlug || 'test-slug'),
    getCurrentPathname: jest.fn(() => '/questions'),
    checkAllCachesReady: jest.fn(),
    syncCacheHasLoadedFlagFromPersistent: jest.fn(() => Promise.resolve(true)),
    readFlag: jest.fn(() => false),
    isInitInFlight: jest.fn(() => ({ question: false, survey: false, response: false })),
    shouldAutoRunFullSbtScan: jest.fn(() => true),
    initializeSbtCache: jest.fn(() => Promise.resolve()),
    startSbtEventListener: jest.fn(),
    ...rest,
  };
};

const createAsyncSetStateHost = (overrides = {}) => {
  const { initialState, mounted, activeSlug, ...rest } = overrides;
  const state = {
    sbtCacheRevision: 0,
    questionResponsesNonce: 0,
    isSBTCacheReady: false,
    ...initialState,
  };
  const queue = [];

  const flushNextSetState = () => {
    const next = queue.shift();
    if (!next) return;
    const patch = typeof next.updater === 'function' ? next.updater(state) : next.updater;
    if (patch) Object.assign(state, patch);
    if (typeof next.cb === 'function') next.cb();
  };

  return {
    getState: jest.fn(() => ({ ...state })),
    setState: jest.fn((updater, cb) => {
      queue.push({ updater, cb });
    }),
    isMounted: jest.fn(() => mounted !== false),
    resolveActiveSlug: jest.fn(() => activeSlug || 'test-slug'),
    getSessionSlugFromState: jest.fn(() => activeSlug || 'test-slug'),
    getCurrentPathname: jest.fn(() => '/questions'),
    checkAllCachesReady: jest.fn(),
    syncCacheHasLoadedFlagFromPersistent: jest.fn(() => Promise.resolve(true)),
    readFlag: jest.fn(() => false),
    isInitInFlight: jest.fn(() => ({ question: false, survey: false, response: false })),
    shouldAutoRunFullSbtScan: jest.fn(() => true),
    initializeSbtCache: jest.fn(() => Promise.resolve()),
    startSbtEventListener: jest.fn(),
    flushNextSetState,
    getPendingSetStateCount: () => queue.length,
    ...rest,
  };
};

const installRafTimers = () => {
  jest.useFakeTimers();
  Object.defineProperty(window, 'requestAnimationFrame', {
    configurable: true,
    writable: true,
    value: (cb) => setTimeout(cb, 0),
  });
  Object.defineProperty(window, 'cancelAnimationFrame', {
    configurable: true,
    writable: true,
    value: (id) => clearTimeout(id),
  });
};

describe('createSessionCacheReadinessController', () => {
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeAll(() => {
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    stopCeRuntimeStats();
    resetCeRuntimeStats();
    contractScriptsModule.normalizeSessionSlug.mockImplementation((slug) =>
      String(slug || '')
        .trim()
        .toLowerCase(),
    );
  });

  afterEach(() => {
    if (originalRequestAnimationFrame === undefined) {
      delete window.requestAnimationFrame;
    } else {
      Object.defineProperty(window, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: originalRequestAnimationFrame,
      });
    }
    if (originalCancelAnimationFrame === undefined) {
      delete window.cancelAnimationFrame;
    } else {
      Object.defineProperty(window, 'cancelAnimationFrame', {
        configurable: true,
        writable: true,
        value: originalCancelAnimationFrame,
      });
    }
    stopCeRuntimeStats();
    resetCeRuntimeStats();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('setReadinessStateIfChanged', () => {
    it('returns false for null or empty state and calls the callback', () => {
      const host = createMockHost();
      const controller = createSessionCacheReadinessController(host);
      const nullCallback = jest.fn();
      const emptyCallback = jest.fn();

      expect(controller.setReadinessStateIfChanged(null, nullCallback)).toBe(false);
      expect(controller.setReadinessStateIfChanged({}, emptyCallback)).toBe(false);

      expect(nullCallback).toHaveBeenCalledTimes(1);
      expect(emptyCallback).toHaveBeenCalledTimes(1);
      expect(host.setState).not.toHaveBeenCalled();
    });

    it('invokes setState when a key changes', () => {
      const host = createMockHost({
        initialState: { isResponsesCacheReady: false },
      });
      const controller = createSessionCacheReadinessController(host);

      expect(controller.setReadinessStateIfChanged({ isResponsesCacheReady: true })).toBe(true);

      expect(host.setState).toHaveBeenCalledTimes(1);
      expect(host.getState()).toMatchObject({ isResponsesCacheReady: true });
    });

    it('does not invoke setState when state already matches', () => {
      const host = createMockHost({
        initialState: { isResponsesCacheReady: true },
      });
      const controller = createSessionCacheReadinessController(host);
      const callback = jest.fn();

      expect(controller.setReadinessStateIfChanged({ isResponsesCacheReady: true }, callback)).toBe(false);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(host.setState).not.toHaveBeenCalled();
    });

    it('preserves callback ordering when the same value is already queued', () => {
      const host = createAsyncSetStateHost({
        initialState: { isResponsesCacheReady: false },
      });
      const controller = createSessionCacheReadinessController(host);
      const order = [];

      expect(controller.setReadinessStateIfChanged({ isResponsesCacheReady: true }, () => order.push('first'))).toBe(
        true,
      );
      expect(controller.setReadinessStateIfChanged({ isResponsesCacheReady: true }, () => order.push('second'))).toBe(
        false,
      );

      expect(host.setState).toHaveBeenCalledTimes(2);
      expect(host.getPendingSetStateCount()).toBe(2);
      expect(order).toEqual([]);

      host.flushNextSetState();
      expect(order).toEqual(['first']);
      expect(host.getState()).toMatchObject({ isResponsesCacheReady: true });

      host.flushNextSetState();
      expect(order).toEqual(['first', 'second']);
      expect(host.getPendingSetStateCount()).toBe(0);
    });

    it('handles multiple keys in a single call', () => {
      const host = createMockHost({
        initialState: {
          isSBTCacheReady: false,
          isResponsesCacheReady: false,
        },
      });
      const controller = createSessionCacheReadinessController(host);

      expect(
        controller.setReadinessStateIfChanged({
          isSBTCacheReady: true,
          isResponsesCacheReady: true,
        }),
      ).toBe(true);

      expect(host.setState).toHaveBeenCalledTimes(1);
      expect(host.getState()).toMatchObject({
        isSBTCacheReady: true,
        isResponsesCacheReady: true,
      });
    });
  });

  describe('checkAllCachesReady', () => {
    it('recomputes aggregate readiness and syncs the persisted loaded flag for the state slug', async () => {
      const host = createMockHost({
        initialState: {
          isSBTCacheReady: true,
          isSurveyCacheReady: true,
          isQuestionCacheReady: true,
          isAllCachesReady: false,
        },
        activeSlug: 'route-slug',
      });
      const controller = createSessionCacheReadinessController(host);

      controller.checkAllCachesReady();
      await Promise.resolve();

      expect(host.getState()).toMatchObject({ isAllCachesReady: true });
      expect(host.syncCacheHasLoadedFlagFromPersistent).toHaveBeenCalledWith('route-slug', { force: true });
      expect(host.initializeSbtCache).not.toHaveBeenCalled();
    });

    it('clears aggregate readiness without forcing cache loaded sync when a cache is not ready', async () => {
      const host = createMockHost({
        initialState: {
          isSBTCacheReady: true,
          isSurveyCacheReady: false,
          isQuestionCacheReady: true,
          isAllCachesReady: true,
        },
      });
      const controller = createSessionCacheReadinessController(host);

      controller.checkAllCachesReady();
      await Promise.resolve();

      expect(host.getState()).toMatchObject({ isAllCachesReady: false });
      expect(host.syncCacheHasLoadedFlagFromPersistent).toHaveBeenCalledWith('test-slug', { force: false });
    });

    it('runs the deferred full SBT scan only after all caches are ready on a session route', async () => {
      const host = createMockHost({
        initialState: {
          isSBTCacheReady: true,
          isSurveyCacheReady: true,
          isQuestionCacheReady: true,
        },
        getCurrentPathname: jest.fn(() => '/session/demo'),
        readFlag: jest.fn((flag) => flag === 'sbt:deferredFullScanNeeded'),
      });
      const controller = createSessionCacheReadinessController(host);

      controller.checkAllCachesReady();
      await Promise.resolve();
      await Promise.resolve();

      expect(host.shouldAutoRunFullSbtScan).toHaveBeenCalledWith({ pathname: '/session/demo' });
      expect(host.initializeSbtCache).toHaveBeenCalledWith({ mode: 'full' });
      expect(host.startSbtEventListener).toHaveBeenCalledTimes(1);
    });

    it('does not run the deferred full SBT scan while a full scan is already in progress', async () => {
      const host = createMockHost({
        initialState: {
          isSBTCacheReady: true,
          isSurveyCacheReady: true,
          isQuestionCacheReady: true,
        },
        getCurrentPathname: jest.fn(() => '/session/demo'),
        readFlag: jest.fn(() => true),
      });
      const controller = createSessionCacheReadinessController(host);

      controller.checkAllCachesReady();
      await Promise.resolve();

      expect(host.initializeSbtCache).not.toHaveBeenCalled();
      expect(host.startSbtEventListener).not.toHaveBeenCalled();
    });
  });

  describe('syncCacheHasLoadedFlagOnTransition', () => {
    it('skips unchanged slug and readiness', async () => {
      const host = createMockHost();
      const controller = createSessionCacheReadinessController(host);

      await controller.syncCacheHasLoadedFlagOnTransition('  Test-Slug  ', { isAllReady: false });
      const result = await controller.syncCacheHasLoadedFlagOnTransition('test-slug', { isAllReady: false });

      expect(result).toBe(false);
      expect(host.syncCacheHasLoadedFlagFromPersistent).toHaveBeenCalledTimes(1);
      expect(host.syncCacheHasLoadedFlagFromPersistent).toHaveBeenCalledWith('test-slug', { force: false });
    });

    it('calls the host sync when the slug changes', async () => {
      const host = createMockHost();
      const controller = createSessionCacheReadinessController(host);

      await controller.syncCacheHasLoadedFlagOnTransition('alpha', { isAllReady: false });
      await controller.syncCacheHasLoadedFlagOnTransition('beta', { isAllReady: false });

      expect(host.syncCacheHasLoadedFlagFromPersistent).toHaveBeenCalledTimes(2);
      expect(host.syncCacheHasLoadedFlagFromPersistent).toHaveBeenLastCalledWith('beta', { force: false });
    });

    it('forces sync when readiness flips to all ready', async () => {
      const host = createMockHost();
      const controller = createSessionCacheReadinessController(host);

      await controller.syncCacheHasLoadedFlagOnTransition('test-slug', { isAllReady: false });
      await controller.syncCacheHasLoadedFlagOnTransition('test-slug', { isAllReady: true });

      expect(host.syncCacheHasLoadedFlagFromPersistent).toHaveBeenCalledTimes(2);
      expect(host.syncCacheHasLoadedFlagFromPersistent).toHaveBeenLastCalledWith('test-slug', { force: true });
    });

    it('respects the force option', async () => {
      const host = createMockHost();
      const controller = createSessionCacheReadinessController(host);

      await controller.syncCacheHasLoadedFlagOnTransition('test-slug', { isAllReady: false });
      await controller.syncCacheHasLoadedFlagOnTransition('test-slug', { isAllReady: false, force: true });

      expect(host.syncCacheHasLoadedFlagFromPersistent).toHaveBeenCalledTimes(2);
      expect(host.syncCacheHasLoadedFlagFromPersistent).toHaveBeenLastCalledWith('test-slug', { force: true });
    });
  });

  describe('queueCacheUpdateFlush and flushQueuedCacheUpdates', () => {
    beforeEach(() => {
      installRafTimers();
    });

    it('increments the SBT cache revision and checks readiness after flush', () => {
      const host = createMockHost({
        initialState: { sbtCacheRevision: 4 },
      });
      const controller = createSessionCacheReadinessController(host);

      controller.queueCacheUpdateFlush({
        slug: 'test-slug',
        needsSbtRevision: true,
      });
      jest.runOnlyPendingTimers();

      expect(host.getState()).toMatchObject({ sbtCacheRevision: 5 });
      expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
    });

    it('increments question responses nonce and marks responses ready', () => {
      const host = createMockHost({
        initialState: {
          questionResponsesNonce: 2,
          isResponsesCacheReady: false,
        },
      });
      const controller = createSessionCacheReadinessController(host);

      controller.queueCacheUpdateFlush({
        slug: 'test-slug',
        needsQuestionResponsesNonce: true,
      });
      jest.runOnlyPendingTimers();

      expect(host.getState()).toMatchObject({
        questionResponsesNonce: 3,
        isResponsesCacheReady: true,
      });
    });

    it('drops stale flags when the pending slug changes before flush', () => {
      let activeSlug = 'beta';
      const host = createMockHost({
        resolveActiveSlug: jest.fn(() => activeSlug),
      });
      const controller = createSessionCacheReadinessController(host);

      controller.queueCacheUpdateFlush({
        slug: 'alpha',
        needsSbtRevision: true,
      });
      controller.queueCacheUpdateFlush({
        slug: 'beta',
        needsQuestionResponsesNonce: true,
      });
      jest.runOnlyPendingTimers();

      expect(host.getState()).toMatchObject({
        sbtCacheRevision: 0,
        questionResponsesNonce: 1,
        isResponsesCacheReady: true,
      });
    });

    it('re-verifies the active slug at flush time', () => {
      let activeSlug = 'alpha';
      const host = createMockHost({
        resolveActiveSlug: jest.fn(() => activeSlug),
      });
      const controller = createSessionCacheReadinessController(host);

      controller.queueCacheUpdateFlush({
        slug: 'alpha',
        needsSbtRevision: true,
      });
      activeSlug = 'beta';
      jest.runOnlyPendingTimers();

      expect(host.setState).not.toHaveBeenCalled();
      expect(host.checkAllCachesReady).not.toHaveBeenCalled();
      expect(host.getState()).toMatchObject({ sbtCacheRevision: 0 });
    });

    it('does not flush when unmounted', () => {
      const host = createMockHost({ mounted: false });
      const controller = createSessionCacheReadinessController(host);

      controller.queueCacheUpdateFlush({
        slug: 'test-slug',
        needsQuestionResponsesNonce: true,
      });
      jest.runOnlyPendingTimers();

      expect(host.setState).not.toHaveBeenCalled();
      expect(host.checkAllCachesReady).not.toHaveBeenCalled();
      expect(host.getState()).toMatchObject({ questionResponsesNonce: 0 });
    });
  });

  describe('queueLocalRevisionUpdate and flushLocalRevisionUpdate', () => {
    beforeEach(() => {
      installRafTimers();
    });

    it('increments the SBT cache revision', () => {
      const host = createMockHost({
        initialState: { sbtCacheRevision: 1 },
      });
      const controller = createSessionCacheReadinessController(host);

      controller.queueLocalRevisionUpdate({ needsSbtRevision: true });
      jest.runOnlyPendingTimers();

      expect(host.getState()).toMatchObject({ sbtCacheRevision: 2 });
    });

    it('increments the question responses nonce', () => {
      const host = createMockHost({
        initialState: { questionResponsesNonce: 7 },
      });
      const controller = createSessionCacheReadinessController(host);

      controller.queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
      jest.runOnlyPendingTimers();

      expect(host.getState()).toMatchObject({ questionResponsesNonce: 8 });
    });

    it('calls checkAllCachesReady when requested and mounted', () => {
      const host = createMockHost();
      const controller = createSessionCacheReadinessController(host);

      controller.queueLocalRevisionUpdate({ checkAllCachesReady: true });
      jest.runOnlyPendingTimers();

      expect(host.setState).not.toHaveBeenCalled();
      expect(host.checkAllCachesReady).toHaveBeenCalledTimes(1);
    });

    it('does not flush when unmounted', () => {
      const host = createMockHost({ mounted: false });
      const controller = createSessionCacheReadinessController(host);

      controller.queueLocalRevisionUpdate({
        needsSbtRevision: true,
        needsQuestionResponsesNonce: true,
        checkAllCachesReady: true,
      });
      jest.runOnlyPendingTimers();

      expect(host.setState).not.toHaveBeenCalled();
      expect(host.checkAllCachesReady).not.toHaveBeenCalled();
      expect(host.getState()).toMatchObject({
        sbtCacheRevision: 0,
        questionResponsesNonce: 0,
      });
    });
  });

  describe('handleCrossTabCacheUpdateEvent', () => {
    beforeEach(() => {
      installRafTimers();
    });

    it('records runtime cache events', () => {
      const host = createMockHost({ activeSlug: 'test-slug' });
      const controller = createSessionCacheReadinessController(host);
      const evt = {
        namespace: 'sbtCache',
        slug: 'other-slug',
        source: 'remote',
      };
      startCeRuntimeStats({ sampleIntervalMs: 1000, maxSamples: 5 });

      controller.handleCrossTabCacheUpdateEvent(evt);

      const snapshot = snapshotCeRuntimeStats();
      expect(snapshot.cachePressure.totals.sbtCache).toBe(1);
      expect(snapshot.cachePressure.sinceLast.sbtCache).toBe(1);
    });

    it('ignores events for non-active slugs', () => {
      const host = createMockHost({ activeSlug: 'active-slug' });
      const controller = createSessionCacheReadinessController(host);

      controller.handleCrossTabCacheUpdateEvent({
        namespace: 'sbtCache',
        slug: 'other-slug',
        source: 'remote',
      });
      jest.runOnlyPendingTimers();

      expect(host.setState).not.toHaveBeenCalled();
      expect(host.getState()).toMatchObject({ sbtCacheRevision: 0 });
    });

    it('queues sbt cache events as SBT revision updates', () => {
      const host = createMockHost();
      const controller = createSessionCacheReadinessController(host);

      controller.handleCrossTabCacheUpdateEvent({
        namespace: 'sbtCache',
        slug: 'test-slug',
        source: 'remote',
      });
      jest.runOnlyPendingTimers();

      expect(host.getState()).toMatchObject({ sbtCacheRevision: 1 });
    });

    it.each(['questionsCache', 'surveysCache'])('queues %s events as question response nonce updates', (namespace) => {
      const host = createMockHost();
      const controller = createSessionCacheReadinessController(host);

      controller.handleCrossTabCacheUpdateEvent({
        namespace,
        slug: 'test-slug',
        source: 'remote',
      });
      jest.runOnlyPendingTimers();

      expect(host.getState()).toMatchObject({
        questionResponsesNonce: 1,
        isResponsesCacheReady: true,
      });
    });

    it('suppresses local question echo events while init is in flight', () => {
      const host = createMockHost({
        isInitInFlight: jest.fn(() => ({
          question: true,
          survey: false,
          response: false,
        })),
      });
      const controller = createSessionCacheReadinessController(host);

      controller.handleCrossTabCacheUpdateEvent({
        namespace: 'questionsCache',
        slug: 'test-slug',
        source: 'local',
      });
      jest.runOnlyPendingTimers();

      expect(host.setState).not.toHaveBeenCalled();
      expect(host.getState()).toMatchObject({ questionResponsesNonce: 0 });
    });

    it('suppresses local sbt echo events while a full scan is in progress', () => {
      const host = createMockHost({
        readFlag: jest.fn((flag, slug) => flag === 'sbt:fullScanInProgress' && slug === 'test-slug'),
      });
      const controller = createSessionCacheReadinessController(host);

      controller.handleCrossTabCacheUpdateEvent({
        namespace: 'sbtCache',
        slug: 'test-slug',
        source: 'local',
      });
      jest.runOnlyPendingTimers();

      expect(host.setState).not.toHaveBeenCalled();
      expect(host.getState()).toMatchObject({ sbtCacheRevision: 0 });
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      installRafTimers();
    });

    it('cancels scheduled timers and clears pending controller state', async () => {
      const host = createMockHost();
      const controller = createSessionCacheReadinessController(host);

      controller.queueCacheUpdateFlush({
        slug: 'test-slug',
        needsSbtRevision: true,
      });
      controller.queueLocalRevisionUpdate({
        needsQuestionResponsesNonce: true,
      });
      await controller.syncCacheHasLoadedFlagOnTransition(' Test-Slug ', { isAllReady: true });

      controller.destroy();
      jest.runOnlyPendingTimers();
      controller.flushQueuedCacheUpdates();
      controller.flushLocalRevisionUpdate();

      expect(host.setState).not.toHaveBeenCalled();

      await controller.syncCacheHasLoadedFlagOnTransition('test-slug', { isAllReady: true });
      expect(host.syncCacheHasLoadedFlagFromPersistent).toHaveBeenCalledTimes(2);
    });
  });
});
