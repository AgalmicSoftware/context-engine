jest.mock('ethers', () => ({
  ethers: { utils: { isAddress: jest.fn() } },
}));

jest.mock('utilities/logging.js', () => ({
  __esModule: true,
  createLogger: () => ({
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  __esModule: true,
  getGlobalLitHooks: jest.fn(() => ({})),
}));

jest.mock('../../utilities/session/sessionScanScope.js', () => ({
  __esModule: true,
  getAllowedSessionSlugs: jest.fn(() => []),
}));

jest.mock('../../utilities/session/registryBootstrapChainIds.js', () => ({
  __esModule: true,
  resolveSessionRegistryBootstrapChainIds: jest.fn(() => undefined),
}));

jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  normalizeSessionSlug: jest.fn((s) => String(s || '').trim().toLowerCase()),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  __esModule: true,
  fetchSessionFromRegistry: jest.fn(),
  loadGroupRegistryCache: jest.fn(),
  sessionRegistryStore: {
    getAllSessionEntries: jest.fn(() => []),
    getAllSessionSlugs: jest.fn(() => []),
  },
  upsertSessionRegistryCache: jest.fn(),
}));

jest.mock('../../variables/appConfig.js', () => ({
  CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS: 12000,
  CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS: 45000,
  CE_PROFILE_SCAN_SBT_BURST_SIZE: 1,
  CE_PROFILE_SCAN_SBT_TIMEOUT_MS: 30000,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS: false,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS: false,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS: false,
  CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS: false,
  DEFAULT_CHAIN_ID: 84532,
}));

jest.mock('../../variables/chains.js', () => ({
  __esModule: true,
  getSessionRegistryChainIds: jest.fn(() => [84532]),
}));

jest.mock('./profileScanTelemetry.js', () => ({
  __esModule: true,
  emitProfileScanColdDiag: jest.fn(),
  emitProfileScanTelemetry: jest.fn(),
  isProfileScanColdDiagEnabled: jest.fn(() => false),
  isProfileScanTelemetryEnabled: jest.fn(() => false),
}));

jest.mock('./mainSiteProgressHelpers.js', () => ({
  __esModule: true,
  shouldEnableSessionRegistryRefresh: jest.fn(() => true),
}));

const { ethers } = require('ethers');
const { createSessionProfileScanController } = require('./sessionProfileScanController.js');
const litProtocolModule = require('../../utilities/crypto/litProtocol.js');
const sessionScanScopeModule = require('../../utilities/session/sessionScanScope.js');
const registryBootstrapModule = require('../../utilities/session/registryBootstrapChainIds.js');
const contractScriptsModule = require('../../utilities/web3/contractScripts.js');
const sessionRegistryModule = require('../../utilities/web3/sessionRegistry.js');
const chainsModule = require('../../variables/chains.js');
const debugTelemetryModule = require('./profileScanTelemetry.js');
const progressHelpersModule = require('./mainSiteProgressHelpers.js');

const VALID_RETRY_ADDRESS = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const makeHost = (overrides = {}) => ({
  getAccount: jest.fn().mockReturnValue('0xTestAccount'),
  getActiveSessionSlug: jest.fn().mockReturnValue('test-session'),
  getNetworkId: jest.fn().mockReturnValue(84532),
  getProvider: jest.fn().mockReturnValue({}),
  getScopeFilteredSlugs: jest.fn().mockReturnValue([]),
  getScopedSessionSlugs: jest.fn().mockReturnValue([]),
  getSessionCfg: jest.fn().mockReturnValue({}),
  getSessionChainId: jest.fn().mockReturnValue(84532),
  getSessionScanScopeContext: jest.fn().mockReturnValue({
    scope: 'all',
    list: [],
    activeSlug: 'test-session',
    activeSlugFromRoute: true,
  }),
  getSessionSlugFromState: jest.fn().mockReturnValue('test-session'),
  isMounted: jest.fn().mockReturnValue(true),
  isSessionSlugAllowedForScan: jest.fn().mockReturnValue(true),
  scanSpecificUserProfile: jest.fn().mockResolvedValue({}),
  ...overrides,
});

const setWindowValue = (value) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  if (descriptor && descriptor.configurable === false) return;
  Object.defineProperty(globalThis, 'window', {
    value,
    configurable: true,
    writable: true,
  });
};

const setWindowSearch = (search = '') => {
  if (!globalThis.window) return;
  window.history.replaceState({}, '', `/test${search}`);
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

const flushMicrotasks = async (times = 6) => {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
};

const flushEventLoop = () => new Promise((resolve) => {
  setTimeout(resolve, 0);
});

const waitForProfileScanCalls = async (host, expectedCalls) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await flushMicrotasks();
    if (host.scanSpecificUserProfile.mock.calls.length >= expectedCalls) return;
    await flushEventLoop();
    if (host.scanSpecificUserProfile.mock.calls.length >= expectedCalls) return;
  }
};

const clearRuntimeOverrides = () => {
  delete globalThis.CE_SESSION_SCAN_SCOPE;
  delete globalThis.CE_PROFILE_SCAN_SBT_TIMEOUT_MS;
  delete globalThis.CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS;
  delete globalThis.CE_PROFILE_SCAN_SLUG_TIMEOUT_MS;
  delete globalThis.CE_PROFILE_SCAN_SBT_BURST_SIZE;
  delete globalThis.CE_PROFILE_SCAN_ACTIVITY_LOOKBACK_BLOCKS;
  delete globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS;
  delete globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS;
  delete globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS;
  delete globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS;
  delete globalThis.CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS;
  delete globalThis.CE_PROFILE_SCAN_REGISTRY_LOOKUP_TIMEOUT_MS;
};

describe('createSessionProfileScanController', () => {
  let originalWindow;

  beforeAll(() => {
    originalWindow = globalThis.window;
  });

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();

    setWindowValue(originalWindow);
    setWindowSearch('');
    window.localStorage.clear();
    clearRuntimeOverrides();

    ethers.utils.isAddress.mockReturnValue(true);
    litProtocolModule.getGlobalLitHooks.mockReturnValue({});
    sessionScanScopeModule.getAllowedSessionSlugs.mockReturnValue([]);
    registryBootstrapModule.resolveSessionRegistryBootstrapChainIds.mockReturnValue(undefined);
    contractScriptsModule.normalizeSessionSlug.mockImplementation(
      (slug) => String(slug || '').trim().toLowerCase()
    );
    sessionRegistryModule.fetchSessionFromRegistry.mockResolvedValue(null);
    sessionRegistryModule.loadGroupRegistryCache.mockResolvedValue({
      __loadMeta: { hadLoadErrors: false },
    });
    sessionRegistryModule.sessionRegistryStore.getAllSessionEntries.mockReturnValue([]);
    sessionRegistryModule.sessionRegistryStore.getAllSessionSlugs.mockReturnValue([]);
    sessionRegistryModule.upsertSessionRegistryCache.mockImplementation(() => {});
    chainsModule.getSessionRegistryChainIds.mockReturnValue([84532]);
    progressHelpersModule.shouldEnableSessionRegistryRefresh.mockReturnValue(true);
    debugTelemetryModule.isProfileScanColdDiagEnabled.mockReturnValue(false);
    debugTelemetryModule.isProfileScanTelemetryEnabled.mockReturnValue(false);
    debugTelemetryModule.emitProfileScanColdDiag.mockImplementation(function emitColdDiag() {
      return this;
    });
    debugTelemetryModule.emitProfileScanTelemetry.mockImplementation(function emitTelemetry() {
      this._profileScanTelemetrySeq = Number(this._profileScanTelemetrySeq || 0) + 1;
      return this._profileScanTelemetrySeq;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    clearRuntimeOverrides();
    setWindowValue(originalWindow);
    if (globalThis.window) {
      setWindowSearch('');
      window.localStorage.clear();
    }
  });

  describe('hasExplicitProfileScanScopeOverride', () => {
    it('returns false when no explicit override is set', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(controller.hasExplicitProfileScanScopeOverride()).toBe(false);
    });

    it('returns true when the ceSessionScanScope query param is present', () => {
      const controller = createSessionProfileScanController(makeHost());

      setWindowSearch('?ceSessionScanScope=list');

      expect(controller.hasExplicitProfileScanScopeOverride()).toBe(true);
    });

    it('returns true when localStorage ce:sessionScanScope is set', () => {
      const controller = createSessionProfileScanController(makeHost());

      window.localStorage.setItem('ce:sessionScanScope', 'all');

      expect(controller.hasExplicitProfileScanScopeOverride()).toBe(true);
    });

    it('returns true when localStorage ce:selectedSessionScope is set', () => {
      const controller = createSessionProfileScanController(makeHost());

      window.localStorage.setItem('ce:selectedSessionScope', 'alpha,beta');

      expect(controller.hasExplicitProfileScanScopeOverride()).toBe(true);
    });

    it('returns true when globalThis.CE_SESSION_SCAN_SCOPE is set', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_SESSION_SCAN_SCOPE = 'all';

      expect(controller.hasExplicitProfileScanScopeOverride()).toBe(true);
    });

    it('returns false gracefully when window is undefined', () => {
      const controller = createSessionProfileScanController(makeHost());
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
      if (descriptor && descriptor.configurable === false) {
        expect(controller.hasExplicitProfileScanScopeOverride()).toBe(false);
        return;
      }

      setWindowValue(undefined);

      expect(controller.hasExplicitProfileScanScopeOverride()).toBe(false);
    });
  });

  describe('getProfileScanScopeContext', () => {
    it('returns the host scope context unmodified for non-list scopes', () => {
      const scopeContext = {
        scope: 'all',
        list: ['alpha'],
        activeSlug: 'test-session',
        activeSlugFromRoute: true,
      };
      const host = makeHost({
        getSessionScanScopeContext: jest.fn().mockReturnValue(scopeContext),
      });
      const controller = createSessionProfileScanController(host);

      expect(controller.getProfileScanScopeContext()).toBe(scopeContext);
    });

    it('returns the host scope context unmodified for list scope with an explicit override', () => {
      const scopeContext = {
        scope: 'list',
        list: ['alpha', 'beta'],
        activeSlug: 'alpha',
        activeSlugFromRoute: true,
      };
      const host = makeHost({
        getSessionScanScopeContext: jest.fn().mockReturnValue(scopeContext),
      });
      const controller = createSessionProfileScanController(host);

      window.localStorage.setItem('ce:sessionScanScope', 'list');

      expect(controller.getProfileScanScopeContext()).toBe(scopeContext);
    });

    it('overrides list scope to active scope when no explicit override exists', () => {
      const host = makeHost({
        getSessionScanScopeContext: jest.fn().mockReturnValue({
          scope: 'list',
          list: ['alpha', 'beta'],
          activeSlug: 'alpha',
          activeSlugFromRoute: true,
        }),
      });
      const controller = createSessionProfileScanController(host);

      expect(controller.getProfileScanScopeContext()).toEqual({
        scope: 'active',
        list: [],
        activeSlug: 'alpha',
        activeSlugFromRoute: true,
      });
    });
  });

  describe('readBoolishRuntimeFlag', () => {
    it('returns true for true, 1, true, yes, and on values', () => {
      const controller = createSessionProfileScanController(makeHost());

      [true, '1', 'true', 'TRUE', 'yes', 'On'].forEach((value) => {
        expect(controller.readBoolishRuntimeFlag(value, false)).toBe(true);
      });
    });

    it('returns false for false, 0, false, no, and off values', () => {
      const controller = createSessionProfileScanController(makeHost());

      [false, '0', 'false', 'FALSE', 'no', 'Off'].forEach((value) => {
        expect(controller.readBoolishRuntimeFlag(value, true)).toBe(false);
      });
    });

    it('returns the fallback for null, undefined, and empty-string values', () => {
      const controller = createSessionProfileScanController(makeHost());

      [null, undefined, '  '].forEach((value) => {
        expect(controller.readBoolishRuntimeFlag(value, true)).toBe(true);
        expect(controller.readBoolishRuntimeFlag(value, false)).toBe(false);
      });
    });

    it('returns the fallback for unrecognized strings', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(controller.readBoolishRuntimeFlag('maybe', true)).toBe(true);
      expect(controller.readBoolishRuntimeFlag('sometimes', false)).toBe(false);
    });
  });

  describe('readProfileScanStepTimeoutMs', () => {
    it('returns the default SBT timeout for kind=sbt', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(controller.readProfileScanStepTimeoutMs('sbt')).toBe(30000);
    });

    it('returns the default activity timeout for kind=activity', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(controller.readProfileScanStepTimeoutMs('activity')).toBe(12000);
    });

    it('respects the runtime override for the specific kind', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_PROFILE_SCAN_ACTIVITY_TIMEOUT_MS = 15001;

      expect(controller.readProfileScanStepTimeoutMs('activity')).toBe(15001);
    });

    it('respects the CE_PROFILE_SCAN_SLUG_TIMEOUT_MS fallback override', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_PROFILE_SCAN_SLUG_TIMEOUT_MS = 16000;

      expect(controller.readProfileScanStepTimeoutMs('sbt')).toBe(16000);
    });

    it('keeps timeout values within the 5000ms to 180000ms bounds', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_PROFILE_SCAN_SBT_TIMEOUT_MS = 5000;
      expect(controller.readProfileScanStepTimeoutMs('sbt')).toBe(5000);

      globalThis.CE_PROFILE_SCAN_SBT_TIMEOUT_MS = 999999;
      expect(controller.readProfileScanStepTimeoutMs('sbt')).toBe(180000);
    });
  });

  describe('readProfileScanSbtBurstSize', () => {
    it('returns the default burst size', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(controller.readProfileScanSbtBurstSize()).toBe(1);
    });

    it('respects the runtime override', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_PROFILE_SCAN_SBT_BURST_SIZE = 4;

      expect(controller.readProfileScanSbtBurstSize()).toBe(4);
    });

    it('falls back to the minimum size of 1 for invalid low overrides', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_PROFILE_SCAN_SBT_BURST_SIZE = 0;

      expect(controller.readProfileScanSbtBurstSize()).toBe(1);
    });

    it('caps the burst size at 16', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_PROFILE_SCAN_SBT_BURST_SIZE = 64;

      expect(controller.readProfileScanSbtBurstSize()).toBe(16);
    });
  });

  describe('readProfileScanActivityLookbackBlocks', () => {
    it('returns 0 for non-all-sessions mode', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(controller.readProfileScanActivityLookbackBlocks({ useAllSessions: false })).toBe(0);
    });

    it('returns 2500 for all-sessions mode', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(controller.readProfileScanActivityLookbackBlocks({ useAllSessions: true })).toBe(2500);
    });

    it('respects the runtime override', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_PROFILE_SCAN_ACTIVITY_LOOKBACK_BLOCKS = 12345;

      expect(controller.readProfileScanActivityLookbackBlocks({ useAllSessions: true })).toBe(12345);
    });

    it('keeps lookback values within the 0 to 200000 bounds', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_PROFILE_SCAN_ACTIVITY_LOOKBACK_BLOCKS = -10;
      expect(controller.readProfileScanActivityLookbackBlocks({ useAllSessions: false })).toBe(0);

      globalThis.CE_PROFILE_SCAN_ACTIVITY_LOOKBACK_BLOCKS = 999999;
      expect(controller.readProfileScanActivityLookbackBlocks({ useAllSessions: true })).toBe(200000);
    });
  });

  describe('getUserProfileAllSessionsScanMode', () => {
    it('returns all false when no flags are set', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(controller.getUserProfileAllSessionsScanMode()).toEqual({
        legacyAllSessions: false,
        useAllSessionsSbtScan: false,
        useAllSessionsSurveyActivityScan: false,
        useAllSessionsQuestionActivityScan: false,
        useAllSessionsActivityScan: false,
        useAllSessionsScan: false,
      });
    });

    it('enables SBT scan when the legacy flag is set', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS = 'true';

      expect(controller.getUserProfileAllSessionsScanMode().useAllSessionsSbtScan).toBe(true);
    });

    it('enables the SBT domain flag independently', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SBTS = 'true';

      expect(controller.getUserProfileAllSessionsScanMode()).toEqual(
        expect.objectContaining({
          legacyAllSessions: false,
          useAllSessionsSbtScan: true,
          useAllSessionsSurveyActivityScan: false,
          useAllSessionsQuestionActivityScan: false,
          useAllSessionsActivityScan: false,
          useAllSessionsScan: true,
        })
      );
    });

    it('enables the survey domain flag independently', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS = 'true';

      expect(controller.getUserProfileAllSessionsScanMode()).toEqual(
        expect.objectContaining({
          useAllSessionsSbtScan: false,
          useAllSessionsSurveyActivityScan: true,
          useAllSessionsQuestionActivityScan: false,
          useAllSessionsActivityScan: true,
          useAllSessionsScan: true,
        })
      );
    });

    it('enables the question domain flag independently', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_QUESTIONS = 'true';

      expect(controller.getUserProfileAllSessionsScanMode()).toEqual(
        expect.objectContaining({
          useAllSessionsSbtScan: false,
          useAllSessionsSurveyActivityScan: false,
          useAllSessionsQuestionActivityScan: true,
          useAllSessionsActivityScan: true,
          useAllSessionsScan: true,
        })
      );
    });

    it('cascades the legacy runtime override to domain flags without domain overrides', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS = '1';

      expect(controller.getUserProfileAllSessionsScanMode()).toEqual(
        expect.objectContaining({
          legacyAllSessions: true,
          useAllSessionsSbtScan: true,
          useAllSessionsSurveyActivityScan: true,
          useAllSessionsQuestionActivityScan: true,
          useAllSessionsActivityScan: true,
          useAllSessionsScan: true,
        })
      );
    });
  });

  describe('isUserProfileAllSessionsScanEnabled', () => {
    it('returns false when no all-session scan mode is enabled', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(controller.isUserProfileAllSessionsScanEnabled()).toBe(false);
    });

    it('returns true when any domain scan is enabled', () => {
      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_USER_PROFILE_SCAN_ALL_SESSIONS_SURVEYS = 'true';

      expect(controller.isUserProfileAllSessionsScanEnabled()).toBe(true);
    });
  });

  describe('getActiveProfileScanChainId', () => {
    it('returns the session chain ID when available', () => {
      const host = makeHost({
        getSessionChainId: jest.fn().mockImplementation((slug) => (
          slug === 'test-session' ? 11155420 : 0
        )),
        getNetworkId: jest.fn().mockReturnValue(84532),
      });
      const controller = createSessionProfileScanController(host);

      expect(controller.getActiveProfileScanChainId()).toBe(11155420);
    });

    it('falls back to the network ID', () => {
      const host = makeHost({
        getSessionChainId: jest.fn().mockReturnValue(0),
        getNetworkId: jest.fn().mockReturnValue(84532),
      });
      const controller = createSessionProfileScanController(host);

      expect(controller.getActiveProfileScanChainId()).toBe(84532);
    });

    it('returns null when neither a session chain ID nor network ID is available', () => {
      const host = makeHost({
        getSessionChainId: jest.fn().mockReturnValue(null),
        getNetworkId: jest.fn().mockReturnValue(null),
      });
      const controller = createSessionProfileScanController(host);

      expect(controller.getActiveProfileScanChainId()).toBeNull();
    });
  });

  describe('registry helpers', () => {
    it('getRegistrySessionEntryCount returns 0 when the store is empty', () => {
      const controller = createSessionProfileScanController(makeHost());

      sessionRegistryModule.sessionRegistryStore.getAllSessionEntries.mockReturnValue([]);

      expect(controller.getRegistrySessionEntryCount()).toBe(0);
    });

    it('getRegistrySessionEntryCount returns the correct count', () => {
      const controller = createSessionProfileScanController(makeHost());

      sessionRegistryModule.sessionRegistryStore.getAllSessionEntries.mockReturnValue([
        ['alpha', {}],
        ['beta', {}],
        ['gamma', {}],
      ]);

      expect(controller.getRegistrySessionEntryCount()).toBe(3);
    });

    it('getRegistrySessionCoverageCountForChain filters by chain ID', () => {
      const controller = createSessionProfileScanController(makeHost());

      sessionRegistryModule.sessionRegistryStore.getAllSessionEntries.mockReturnValue([
        ['alpha', { networkChainId: 84532 }],
        ['beta', { contracts: { surveys: { chainId: 84532 } } }],
        ['gamma', { contracts: { sbtFactory: { chainId: 11155420 } } }],
      ]);

      expect(controller.getRegistrySessionCoverageCountForChain(84532)).toBe(2);
    });

    it('getRegistrySessionCoverageCountForChain returns all entries when no chain ID is given', () => {
      const controller = createSessionProfileScanController(makeHost());

      sessionRegistryModule.sessionRegistryStore.getAllSessionEntries.mockReturnValue([
        ['alpha', { networkChainId: 84532 }],
        ['beta', { networkChainId: 11155420 }],
      ]);

      expect(controller.getRegistrySessionCoverageCountForChain()).toBe(2);
    });

    it('getRegistryBootstrapScopeKey returns all for an empty array', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(controller.getRegistryBootstrapScopeKey([])).toBe('all');
    });

    it('getRegistryBootstrapScopeKey sorts and dedupes chain IDs', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(
        controller.getRegistryBootstrapScopeKey([11155420, 84532, 11155420, '84532', 0, null])
      ).toBe('84532,11155420');
    });
  });

  describe('ensureRegistryHydratedForProfileScan', () => {
    it('calls loadGroupRegistryCache and returns the hydration status', async () => {
      let entries = [];
      const host = makeHost();
      const controller = createSessionProfileScanController(host);

      registryBootstrapModule.resolveSessionRegistryBootstrapChainIds.mockReturnValue([84532]);
      sessionRegistryModule.sessionRegistryStore.getAllSessionEntries.mockImplementation(() => entries);
      sessionRegistryModule.loadGroupRegistryCache.mockImplementation(({ bootstrapRpc }) => {
        expect(bootstrapRpc).toBe(true);
        entries = [['alpha', { networkChainId: 84532 }]];
        return Promise.resolve({ __loadMeta: { hadLoadErrors: false } });
      });

      const result = await controller.ensureRegistryHydratedForProfileScan();

      expect(sessionRegistryModule.loadGroupRegistryCache).toHaveBeenCalledWith(
        expect.objectContaining({
          chainIds: [84532],
          account: '0xTestAccount',
          providerLike: {},
          force: true,
          bootstrapRpc: true,
        })
      );
      expect(result).toEqual(
        expect.objectContaining({
          hasEntries: true,
          timedOut: false,
          beforeCount: 0,
          afterCount: 1,
          hadLoadErrors: false,
        })
      );
    });

    it('reuses the in-flight bootstrap promise for the same scope key', async () => {
      let entries = [];
      const deferred = createDeferred();
      const controller = createSessionProfileScanController(makeHost());

      registryBootstrapModule.resolveSessionRegistryBootstrapChainIds.mockReturnValue([84532]);
      sessionRegistryModule.sessionRegistryStore.getAllSessionEntries.mockImplementation(() => entries);
      sessionRegistryModule.loadGroupRegistryCache.mockReturnValue(deferred.promise);

      const firstRun = controller.ensureRegistryHydratedForProfileScan();
      const secondRun = controller.ensureRegistryHydratedForProfileScan();

      expect(sessionRegistryModule.loadGroupRegistryCache).toHaveBeenCalledTimes(1);
      expect(controller._registryBootstrapPromise).toBe(deferred.promise);

      entries = [['alpha', { networkChainId: 84532 }]];
      deferred.resolve({ __loadMeta: { hadLoadErrors: false } });

      const [firstResult, secondResult] = await Promise.all([firstRun, secondRun]);

      expect(firstResult.afterCount).toBe(1);
      expect(secondResult.afterCount).toBe(1);
    });

    it('restarts the bootstrap when the scope key changes', async () => {
      let entries = [];
      const oldDeferred = createDeferred();
      const newDeferred = createDeferred();
      const controller = createSessionProfileScanController(makeHost());

      controller._registryBootstrapPromise = oldDeferred.promise;
      controller._registryBootstrapScopeKey = '84532';
      registryBootstrapModule.resolveSessionRegistryBootstrapChainIds.mockReturnValue([11155420]);
      sessionRegistryModule.sessionRegistryStore.getAllSessionEntries.mockImplementation(() => entries);
      sessionRegistryModule.loadGroupRegistryCache.mockReturnValue(newDeferred.promise);

      const run = controller.ensureRegistryHydratedForProfileScan();

      expect(sessionRegistryModule.loadGroupRegistryCache).toHaveBeenCalledTimes(1);
      expect(controller._registryBootstrapPromise).toBe(newDeferred.promise);
      expect(controller._registryBootstrapScopeKey).toBe('11155420');

      entries = [['alpha', { networkChainId: 11155420 }]];
      newDeferred.resolve({ __loadMeta: { hadLoadErrors: false } });
      oldDeferred.resolve({ __loadMeta: { hadLoadErrors: false } });

      await run;
    });

    it('retries with the alternate RPC when the first attempt yields zero entries', async () => {
      let entries = [];
      const controller = createSessionProfileScanController(makeHost());

      registryBootstrapModule.resolveSessionRegistryBootstrapChainIds.mockReturnValue([84532]);
      sessionRegistryModule.sessionRegistryStore.getAllSessionEntries.mockImplementation(() => entries);
      sessionRegistryModule.loadGroupRegistryCache.mockImplementation(({ bootstrapRpc }) => {
        if (bootstrapRpc) {
          return Promise.resolve({ __loadMeta: { hadLoadErrors: true } });
        }
        entries = [['alpha', { networkChainId: 84532 }]];
        return Promise.resolve({ __loadMeta: { hadLoadErrors: false } });
      });

      const result = await controller.ensureRegistryHydratedForProfileScan();

      expect(sessionRegistryModule.loadGroupRegistryCache).toHaveBeenCalledTimes(2);
      expect(sessionRegistryModule.loadGroupRegistryCache.mock.calls[0][0].bootstrapRpc).toBe(true);
      expect(sessionRegistryModule.loadGroupRegistryCache.mock.calls[1][0].bootstrapRpc).toBe(false);
      expect(result).toEqual(
        expect.objectContaining({
          hasEntries: true,
          afterCount: 1,
          hadLoadErrors: false,
          timedOut: false,
          loadMeta: expect.objectContaining({
            alternateRpcAttempt: expect.objectContaining({
              attempted: true,
              improved: true,
              afterCount: 1,
            }),
          }),
        })
      );
    });

    it('returns timedOut=true when both attempts exceed the timeout', async () => {
      jest.useFakeTimers();

      const controller = createSessionProfileScanController(makeHost());

      globalThis.CE_PROFILE_SCAN_REGISTRY_TIMEOUT_MS = 5000;
      registryBootstrapModule.resolveSessionRegistryBootstrapChainIds.mockReturnValue([84532]);
      sessionRegistryModule.sessionRegistryStore.getAllSessionEntries.mockReturnValue([]);
      sessionRegistryModule.loadGroupRegistryCache.mockImplementation(
        () => new Promise(() => {})
      );

      const run = controller.ensureRegistryHydratedForProfileScan();

      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();

      await expect(run).resolves.toEqual(
        expect.objectContaining({
          hasEntries: false,
          timedOut: true,
          afterCount: 0,
        })
      );
    });

    it('cleans up the bootstrap promise reference after completion', async () => {
      let entries = [];
      const controller = createSessionProfileScanController(makeHost());

      registryBootstrapModule.resolveSessionRegistryBootstrapChainIds.mockReturnValue([84532]);
      sessionRegistryModule.sessionRegistryStore.getAllSessionEntries.mockImplementation(() => entries);
      sessionRegistryModule.loadGroupRegistryCache.mockImplementation(() => {
        entries = [['alpha', { networkChainId: 84532 }]];
        return Promise.resolve({ __loadMeta: { hadLoadErrors: false } });
      });

      await controller.ensureRegistryHydratedForProfileScan();
      await flushMicrotasks();

      expect(controller._registryBootstrapPromise).toBeNull();
      expect(controller._registryBootstrapScopeKey).toBe('');
    });
  });

  describe('resolveProfileDeepScanPlan', () => {
    it('returns scoped slugs when all-sessions scanning is disabled', () => {
      const host = makeHost({
        getSessionScanScopeContext: jest.fn().mockReturnValue({
          scope: 'general',
          list: [],
          activeSlug: 'test-session',
          activeSlugFromRoute: true,
        }),
        getScopedSessionSlugs: jest.fn().mockReturnValue(['alpha', '', 'test-session', 'alpha']),
      });
      const controller = createSessionProfileScanController(host);

      const plan = controller.resolveProfileDeepScanPlan({ useAllSessionsScan: false });

      expect(plan).toEqual(
        expect.objectContaining({
          slugs: ['test-session', '', 'alpha'],
          usedAllSessions: false,
          coverageComplete: true,
          coverageReason: 'scoped',
          prioritizedGeneralFirst: false,
          scanOrdering: 'active-first-general-early-scoped',
        })
      );
    });

    it('returns registry slugs filtered by the active chain when all-sessions scanning is enabled', () => {
      const host = makeHost({
        getSessionChainId: jest.fn().mockImplementation((slug) => {
          if (slug === 'beta') return 11155420;
          return 84532;
        }),
      });
      const controller = createSessionProfileScanController(host);

      sessionRegistryModule.sessionRegistryStore.getAllSessionSlugs.mockReturnValue([
        'alpha',
        'beta',
        'test-session',
        '',
      ]);

      const plan = controller.resolveProfileDeepScanPlan({
        useAllSessionsScan: true,
        registryStatus: { afterCount: 4, hasEntries: true },
      });

      expect(plan).toEqual(
        expect.objectContaining({
          slugs: ['test-session', '', 'alpha'],
          usedAllSessions: true,
          coverageComplete: true,
          coverageReason: 'registry-ready',
          rawAllSlugCount: 4,
          activeChainSlugCount: 3,
          scanOrdering: 'active-first-general-early-all',
        })
      );
    });

    it('prioritizes the active slug and general session first', () => {
      const host = makeHost({
        getSessionScanScopeContext: jest.fn().mockReturnValue({
          scope: 'all',
          list: [],
          activeSlug: 'test-session',
          activeSlugFromRoute: true,
        }),
        getScopedSessionSlugs: jest.fn().mockReturnValue(['alpha', '', 'beta', 'test-session']),
      });
      const controller = createSessionProfileScanController(host);

      expect(controller.resolveProfileDeepScanPlan({ useAllSessionsScan: false }).slugs).toEqual([
        'test-session',
        '',
        'alpha',
        'beta',
      ]);
    });

    it('reports registry-empty coverage when the registry has no entries', () => {
      const controller = createSessionProfileScanController(makeHost());

      sessionRegistryModule.sessionRegistryStore.getAllSessionSlugs.mockReturnValue([]);

      expect(
        controller.resolveProfileDeepScanPlan({
          useAllSessionsScan: true,
          registryStatus: { afterCount: 0, hasEntries: false },
        })
      ).toEqual(
        expect.objectContaining({
          coverageComplete: false,
          coverageReason: 'registry-empty',
        })
      );
    });

    it('reports registry-timeout coverage when registry hydration timed out', () => {
      const controller = createSessionProfileScanController(makeHost());

      sessionRegistryModule.sessionRegistryStore.getAllSessionSlugs.mockReturnValue(['alpha']);

      expect(
        controller.resolveProfileDeepScanPlan({
          useAllSessionsScan: true,
          registryStatus: { afterCount: 1, hasEntries: true, timedOut: true },
        })
      ).toEqual(
        expect.objectContaining({
          coverageComplete: false,
          coverageReason: 'registry-timeout',
        })
      );
    });

    it('reports registry-partial-errors coverage when registry hydration had partial errors', () => {
      const controller = createSessionProfileScanController(makeHost());

      sessionRegistryModule.sessionRegistryStore.getAllSessionSlugs.mockReturnValue(['alpha']);

      expect(
        controller.resolveProfileDeepScanPlan({
          useAllSessionsScan: true,
          registryStatus: { afterCount: 1, hasEntries: true, hadLoadErrors: true },
        })
      ).toEqual(
        expect.objectContaining({
          coverageComplete: false,
          coverageReason: 'registry-partial-errors',
        })
      );
    });
  });

  describe('scheduleProfileScanRetryAfterRegistryHydration', () => {
    it('validates the address with ethers.utils.isAddress', async () => {
      const host = makeHost();
      const controller = createSessionProfileScanController(host);

      ethers.utils.isAddress.mockReturnValue(false);

      controller.scheduleProfileScanRetryAfterRegistryHydration('not-an-address', 'invalid');
      await flushMicrotasks();

      expect(host.scanSpecificUserProfile).not.toHaveBeenCalled();
    });

    it('deduplicates retries for the same address', async () => {
      const host = makeHost();
      const controller = createSessionProfileScanController(host);

      controller.scheduleProfileScanRetryAfterRegistryHydration(VALID_RETRY_ADDRESS, 'first');
      controller.scheduleProfileScanRetryAfterRegistryHydration(VALID_RETRY_ADDRESS, 'duplicate');
      await waitForProfileScanCalls(host, 1);

      expect(host.scanSpecificUserProfile).toHaveBeenCalledTimes(1);
      expect(host.scanSpecificUserProfile).toHaveBeenCalledWith(VALID_RETRY_ADDRESS);
    });

    it('waits for the bootstrap promise before scanning', async () => {
      const host = makeHost();
      const controller = createSessionProfileScanController(host);
      const deferred = createDeferred();

      controller._registryBootstrapPromise = deferred.promise;
      controller.scheduleProfileScanRetryAfterRegistryHydration(VALID_RETRY_ADDRESS, 'wait');
      await flushMicrotasks();

      expect(host.scanSpecificUserProfile).not.toHaveBeenCalled();

      deferred.resolve(null);
      await waitForProfileScanCalls(host, 1);

      expect(host.scanSpecificUserProfile).toHaveBeenCalledTimes(1);
    });

    it('fires the scan immediately when no bootstrap is in flight', async () => {
      const host = makeHost();
      const controller = createSessionProfileScanController(host);

      controller.scheduleProfileScanRetryAfterRegistryHydration(VALID_RETRY_ADDRESS, 'immediate');

      expect(host.scanSpecificUserProfile).not.toHaveBeenCalled();

      await waitForProfileScanCalls(host, 1);

      expect(host.scanSpecificUserProfile).toHaveBeenCalledTimes(1);
    });

    it('cleans up the retry set after the scan completes', async () => {
      const host = makeHost();
      const controller = createSessionProfileScanController(host);

      controller.scheduleProfileScanRetryAfterRegistryHydration(VALID_RETRY_ADDRESS, 'first');
      await waitForProfileScanCalls(host, 1);
      controller.scheduleProfileScanRetryAfterRegistryHydration(VALID_RETRY_ADDRESS, 'second');
      await waitForProfileScanCalls(host, 2);

      expect(host.scanSpecificUserProfile).toHaveBeenCalledTimes(2);
    });

    it('does not scan if the host is unmounted', async () => {
      const host = makeHost({
        isMounted: jest.fn().mockReturnValue(false),
      });
      const controller = createSessionProfileScanController(host);

      controller.scheduleProfileScanRetryAfterRegistryHydration(VALID_RETRY_ADDRESS, 'unmounted');
      await flushMicrotasks();

      expect(host.scanSpecificUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('general session backfill helpers', () => {
    describe('shouldBackfillGeneralSession', () => {
      it('returns false for an empty slug', () => {
        const controller = createSessionProfileScanController(makeHost());

        expect(controller.shouldBackfillGeneralSession('')).toBe(false);
      });

      it('returns false for a non-general scope', () => {
        const host = makeHost({
          getSessionScanScopeContext: jest.fn().mockReturnValue({
            scope: 'all',
            list: [],
            activeSlug: 'test-session',
            activeSlugFromRoute: true,
          }),
        });
        const controller = createSessionProfileScanController(host);

        expect(controller.shouldBackfillGeneralSession('alpha')).toBe(false);
      });

      it('returns true when the general scope allows the empty slug', () => {
        const scopeContext = {
          scope: 'general',
          list: [],
          activeSlug: 'test-session',
          activeSlugFromRoute: true,
        };
        const host = makeHost({
          getSessionScanScopeContext: jest.fn().mockReturnValue(scopeContext),
          isSessionSlugAllowedForScan: jest.fn().mockReturnValue(true),
        });
        const controller = createSessionProfileScanController(host);

        expect(controller.shouldBackfillGeneralSession('alpha', scopeContext)).toBe(true);
        expect(host.isSessionSlugAllowedForScan).toHaveBeenCalledWith('', scopeContext);
      });
    });

    describe('enqueueGeneralSessionBackfill', () => {
      it('starts the general function in a background promise', async () => {
        const controller = createSessionProfileScanController(makeHost());
        const deferred = createDeferred();
        const runGeneral = jest.fn().mockImplementation(() => deferred.promise);

        controller.enqueueGeneralSessionBackfill({
          operation: 'scan',
          activeSlug: 'alpha',
          runGeneral,
        });

        expect(runGeneral).toHaveBeenCalledTimes(1);
        expect(runGeneral).toHaveBeenCalledWith('');

        deferred.resolve();
        await flushMicrotasks();
      });

      it('deduplicates concurrent runs per operation key', async () => {
        const controller = createSessionProfileScanController(makeHost());
        const firstRun = createDeferred();
        const runGeneral = jest.fn()
          .mockImplementationOnce(() => firstRun.promise)
          .mockResolvedValue(undefined);

        controller.enqueueGeneralSessionBackfill({
          operation: 'scan',
          activeSlug: 'alpha',
          runGeneral,
        });
        controller.enqueueGeneralSessionBackfill({
          operation: 'scan',
          activeSlug: 'beta',
          runGeneral,
        });
        controller.enqueueGeneralSessionBackfill({
          operation: 'scan',
          activeSlug: 'gamma',
          runGeneral,
        });

        expect(runGeneral).toHaveBeenCalledTimes(1);

        firstRun.resolve();
        await flushMicrotasks();

        expect(runGeneral).toHaveBeenCalledTimes(2);
      });

      it('stops when the host reports unmounted', async () => {
        const host = makeHost({
          isMounted: jest.fn().mockReturnValue(false),
        });
        const controller = createSessionProfileScanController(host);
        const runGeneral = jest.fn().mockResolvedValue(undefined);

        controller.enqueueGeneralSessionBackfill({
          operation: 'scan',
          activeSlug: 'alpha',
          runGeneral,
        });
        await flushMicrotasks();

        expect(runGeneral).not.toHaveBeenCalled();
      });
    });

    describe('runWithGeneralSessionBackfill', () => {
      it('runs the primary operation and then enqueues the general backfill when needed', async () => {
        const host = makeHost({
          getSessionScanScopeContext: jest.fn().mockReturnValue({
            scope: 'general',
            list: [],
            activeSlug: 'test-session',
            activeSlugFromRoute: true,
          }),
          isSessionSlugAllowedForScan: jest.fn().mockReturnValue(true),
        });
        const controller = createSessionProfileScanController(host);
        const runPrimary = jest.fn().mockResolvedValue('primary-result');
        const runGeneral = jest.fn().mockResolvedValue('general-result');

        const result = await controller.runWithGeneralSessionBackfill({
          slugIn: ' Alpha ',
          operation: 'scan',
          runPrimary,
          runGeneral,
        });

        expect(result).toBe('primary-result');
        expect(runPrimary).toHaveBeenCalledWith('alpha');
        expect(runGeneral).toHaveBeenCalledWith('');
      });

      it('skips the general backfill when shouldBackfillGeneralSession returns false', async () => {
        const host = makeHost({
          getSessionScanScopeContext: jest.fn().mockReturnValue({
            scope: 'all',
            list: [],
            activeSlug: 'test-session',
            activeSlugFromRoute: true,
          }),
        });
        const controller = createSessionProfileScanController(host);
        const runPrimary = jest.fn().mockResolvedValue('primary-result');
        const runGeneral = jest.fn().mockResolvedValue('general-result');

        const result = await controller.runWithGeneralSessionBackfill({
          slugIn: ' Alpha ',
          operation: 'scan',
          runPrimary,
          runGeneral,
        });

        expect(result).toBe('primary-result');
        expect(runPrimary).toHaveBeenCalledWith('alpha');
        expect(runGeneral).not.toHaveBeenCalled();
      });
    });
  });

  describe('destroy', () => {
    it('clears the registry bootstrap promise and scope key', () => {
      const controller = createSessionProfileScanController(makeHost());
      const deferred = createDeferred();

      controller._registryBootstrapPromise = deferred.promise;
      controller._registryBootstrapScopeKey = '84532';

      controller.destroy();

      expect(controller._registryBootstrapPromise).toBeNull();
      expect(controller._registryBootstrapScopeKey).toBe('');
    });

    it('clears the retry set so the same address can be scheduled again', async () => {
      const host = makeHost();
      const controller = createSessionProfileScanController(host);
      const deferred = createDeferred();

      controller._registryBootstrapPromise = deferred.promise;
      controller.scheduleProfileScanRetryAfterRegistryHydration(VALID_RETRY_ADDRESS, 'before-destroy');
      await flushMicrotasks();
      expect(host.scanSpecificUserProfile).not.toHaveBeenCalled();

      controller.destroy();
      controller._registryBootstrapPromise = null;
      controller.scheduleProfileScanRetryAfterRegistryHydration(VALID_RETRY_ADDRESS, 'after-destroy');
      await waitForProfileScanCalls(host, 1);

      expect(host.scanSpecificUserProfile).toHaveBeenCalledTimes(1);

      host.isMounted.mockReturnValue(false);
      deferred.resolve(null);
      await flushMicrotasks();
    });

    it('stops pending backfill operations', async () => {
      const controller = createSessionProfileScanController(makeHost());
      const firstRun = createDeferred();
      const runGeneral = jest.fn()
        .mockImplementationOnce(() => firstRun.promise)
        .mockResolvedValue(undefined);

      controller.enqueueGeneralSessionBackfill({
        operation: 'scan',
        activeSlug: 'alpha',
        runGeneral,
      });
      controller.enqueueGeneralSessionBackfill({
        operation: 'scan',
        activeSlug: 'beta',
        runGeneral,
      });

      expect(runGeneral).toHaveBeenCalledTimes(1);

      controller.destroy();
      firstRun.resolve();
      await flushMicrotasks();

      expect(runGeneral).toHaveBeenCalledTimes(1);
    });

    it('clears the session config cache', async () => {
      const cfg = { networkChainId: 84532, slug: 'alpha' };
      const host = makeHost({
        getSessionCfg: jest.fn().mockReturnValue(cfg),
        getSessionChainId: jest.fn().mockReturnValue(84532),
      });
      const controller = createSessionProfileScanController(host);

      await controller.resolveListScopeSessionConfigFromRegistry('alpha');
      await controller.resolveListScopeSessionConfigFromRegistry('alpha');

      expect(host.getSessionCfg).toHaveBeenCalledTimes(1);

      controller.destroy();
      await controller.resolveListScopeSessionConfigFromRegistry('alpha');

      expect(host.getSessionCfg).toHaveBeenCalledTimes(2);
    });

    it('resets the telemetry sequence', () => {
      const controller = createSessionProfileScanController(makeHost());

      expect(controller.emitProfileScanTelemetry('one')).toBe(1);
      expect(controller.emitProfileScanTelemetry('two')).toBe(2);

      controller.destroy();

      expect(controller.emitProfileScanTelemetry('three')).toBe(1);
    });
  });

  describe('exposed internal state properties', () => {
    it('_registryBootstrapPromise getter and setter work', () => {
      const controller = createSessionProfileScanController(makeHost());
      const promise = Promise.resolve('ok');

      controller._registryBootstrapPromise = promise;

      expect(controller._registryBootstrapPromise).toBe(promise);
    });

    it('_registryBootstrapScopeKey getter and setter work and convert values to strings', () => {
      const controller = createSessionProfileScanController(makeHost());

      controller._registryBootstrapScopeKey = 84532;
      expect(controller._registryBootstrapScopeKey).toBe('84532');

      controller._registryBootstrapScopeKey = null;
      expect(controller._registryBootstrapScopeKey).toBe('');
    });
  });
});
