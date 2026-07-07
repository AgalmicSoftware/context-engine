jest.mock('utilities/logging.js', () => {
  const mockLogger = {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  return {
    __esModule: true,
    mockLogger,
    createLogger: jest.fn(() => mockLogger),
    emitForcedLog: jest.fn(),
  };
});

jest.mock('ethers', () => ({
  __esModule: true,
  ethers: {
    constants: {
      AddressZero: '0x0000000000000000000000000000000000000000',
    },
  },
}));

type MainSiteTestGlobals = typeof globalThis & {
  CE_SBT_SELECTOR_DEBUG?: unknown;
  ENABLE_CE_UI_PERF_STATS?: boolean;
  ENABLE_CE_DEBUG_COUNTERS?: boolean;
  __CE_DEBUG_COUNTERS__?: boolean;
  __CE_PERF_COUNTERS__?: Record<string, unknown>;
};

const globals = globalThis as MainSiteTestGlobals;
const SBT_SELECTOR_DEBUG_STORAGE_KEY = 'ce:sbtSelectorDebug';
const loggingModule = jest.requireMock('utilities/logging.js') as {
  mockLogger: {
    log: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };
  emitForcedLog: jest.Mock;
};
const { emitForcedLog } = loggingModule;
const {
  readBoolishDebugFlag,
  isForcedSbtSelectorDebugEnabled,
  emitMainSiteSbtDebug,
  buildMainSiteCacheManagerReadyStatePatch,
  buildMainSiteLitHooksStatePatch,
  isRouteResponderAddress,
  hasCoreSbtMetadata,
  isMainSitePerfCountersEnabled,
  bumpMainSitePerfCounter,
  getMainSitePerfNow,
} = require('./mainSiteUtils') as typeof import('./mainSiteUtils');

const clearMainSiteTestState = (): void => {
  delete globals.CE_SBT_SELECTOR_DEBUG;
  delete globals.ENABLE_CE_UI_PERF_STATS;
  delete globals.ENABLE_CE_DEBUG_COUNTERS;
  delete globals.__CE_DEBUG_COUNTERS__;
  delete globals.__CE_PERF_COUNTERS__;
  localStorage.clear();
  sessionStorage.clear();
};

describe('readBoolishDebugFlag', () => {
  afterEach(() => {
    jest.clearAllMocks();
    clearMainSiteTestState();
  });

  it.each([true, 'true', '1', 'yes', 'on', 'TRUE', ' true '])('returns true for %p', (value) => {
    expect(readBoolishDebugFlag(value)).toBe(true);
  });

  it.each([false, null, undefined, '', '0', 'false', 'no', 'off', 'random'])('returns false for %p', (value) => {
    expect(readBoolishDebugFlag(value)).toBe(false);
  });
});

describe('isForcedSbtSelectorDebugEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMainSiteTestState();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearMainSiteTestState();
  });

  it('returns false when no flags are set', () => {
    expect(isForcedSbtSelectorDebugEnabled()).toBe(false);
  });

  it('returns true when the global flag is true', () => {
    globals.CE_SBT_SELECTOR_DEBUG = true;

    expect(isForcedSbtSelectorDebugEnabled()).toBe(true);
  });

  it('returns true when localStorage enables it', () => {
    localStorage.setItem(SBT_SELECTOR_DEBUG_STORAGE_KEY, 'true');

    expect(isForcedSbtSelectorDebugEnabled()).toBe(true);
  });

  it('returns false when sessionStorage sets it to false', () => {
    sessionStorage.setItem(SBT_SELECTOR_DEBUG_STORAGE_KEY, 'false');

    expect(isForcedSbtSelectorDebugEnabled()).toBe(false);
  });
});

describe('emitMainSiteSbtDebug', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMainSiteTestState();
  });

  afterEach(() => {
    clearMainSiteTestState();
  });

  it('writes to the logger when forced debug is disabled', () => {
    emitMainSiteSbtDebug('info', 'selector updated', { source: 'test' });

    expect(loggingModule.mockLogger.info).toHaveBeenCalledWith('selector updated', { source: 'test' });
    expect(emitForcedLog).not.toHaveBeenCalled();
  });

  it('emits a forced log when forced debug is enabled', () => {
    globals.CE_SBT_SELECTOR_DEBUG = true;

    emitMainSiteSbtDebug('warn', 'selector forced');

    expect(emitForcedLog).toHaveBeenCalledWith('warn', 'selector forced');
    expect(loggingModule.mockLogger.warn).not.toHaveBeenCalled();
  });
});

describe('isRouteResponderAddress', () => {
  afterEach(() => {
    jest.clearAllMocks();
    clearMainSiteTestState();
  });

  it('returns true for a valid lowercase address', () => {
    expect(isRouteResponderAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
  });

  it('returns true for a valid uppercase address', () => {
    expect(isRouteResponderAddress('0xABCDEFABCDEFABCDEFABCDEFABCDEFABCDEFABCD')).toBe(true);
  });

  it.each(['0x1234', '0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz', '', null, undefined])(
    'returns false for %p',
    (value) => {
      expect(isRouteResponderAddress(value)).toBe(false);
    },
  );
});

describe('hasCoreSbtMetadata', () => {
  const validMetadata = {
    tokenURI: 'ar://metadata',
    mintingEndTime: '123',
    burnAuth: 1,
    hasPasswordMint: false,
    maxTokens: '10',
    admin: '0x1234567890abcdef1234567890abcdef12345678',
  };

  afterEach(() => {
    jest.clearAllMocks();
    clearMainSiteTestState();
  });

  it.each([null, undefined, 'not-an-object', 12])('returns false for %p', (value) => {
    expect(hasCoreSbtMetadata(value)).toBe(false);
  });

  it('returns false when required fields are missing', () => {
    expect(hasCoreSbtMetadata({ tokenURI: 'ar://metadata' })).toBe(false);
  });

  it('returns false when admin is the zero address', () => {
    expect(
      hasCoreSbtMetadata({
        ...validMetadata,
        admin: '0x0000000000000000000000000000000000000000',
      }),
    ).toBe(false);
  });

  it('returns true when all required fields are present', () => {
    expect(hasCoreSbtMetadata(validMetadata)).toBe(true);
  });
});

describe('main site state patch helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
    clearMainSiteTestState();
  });

  it('builds the Lit hooks state patch without altering the hooks value', () => {
    const hooks = { getKey: jest.fn(), network: 'test' };

    expect(buildMainSiteLitHooksStatePatch(hooks)).toEqual({
      litHooks: hooks,
    });
    expect(buildMainSiteLitHooksStatePatch(null)).toEqual({
      litHooks: null,
    });
  });

  it('builds cache-manager readiness patches with boolean-only semantics', () => {
    expect(buildMainSiteCacheManagerReadyStatePatch()).toEqual({
      isCacheManagerReady: true,
    });
    expect(buildMainSiteCacheManagerReadyStatePatch({ ready: false })).toEqual({
      isCacheManagerReady: false,
    });
    expect(buildMainSiteCacheManagerReadyStatePatch({ ready: 'true' })).toEqual({
      isCacheManagerReady: false,
    });
  });
});

describe('isMainSitePerfCountersEnabled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMainSiteTestState();
  });

  afterEach(() => {
    clearMainSiteTestState();
  });

  it('returns false by default', () => {
    expect(isMainSitePerfCountersEnabled()).toBe(false);
  });

  it('returns true when ENABLE_CE_UI_PERF_STATS is true', () => {
    globals.ENABLE_CE_UI_PERF_STATS = true;

    expect(isMainSitePerfCountersEnabled()).toBe(true);
  });

  it('returns true when ENABLE_CE_DEBUG_COUNTERS is true', () => {
    globals.ENABLE_CE_DEBUG_COUNTERS = true;

    expect(isMainSitePerfCountersEnabled()).toBe(true);
  });
});

describe('bumpMainSitePerfCounter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearMainSiteTestState();
  });

  afterEach(() => {
    clearMainSiteTestState();
  });

  it('does nothing when perf counters are disabled', () => {
    globals.__CE_PERF_COUNTERS__ = {};

    bumpMainSitePerfCounter('renderCount');

    expect(globals.__CE_PERF_COUNTERS__).toEqual({});
  });

  it('increments a counter when enabled', () => {
    globals.ENABLE_CE_UI_PERF_STATS = true;
    globals.__CE_PERF_COUNTERS__ = {
      mainSite: {
        renderCount: 2,
      },
    };

    bumpMainSitePerfCounter('renderCount', 3);

    expect(globals.__CE_PERF_COUNTERS__).toEqual({
      mainSite: {
        renderCount: 5,
      },
    });
  });

  it('creates the scope when it is missing', () => {
    globals.ENABLE_CE_UI_PERF_STATS = true;
    globals.__CE_PERF_COUNTERS__ = {};

    bumpMainSitePerfCounter('routeHits');

    expect(globals.__CE_PERF_COUNTERS__).toEqual({
      mainSite: {
        routeHits: 1,
      },
    });
  });
});

describe('getMainSitePerfNow', () => {
  afterEach(() => {
    jest.clearAllMocks();
    clearMainSiteTestState();
  });

  it('returns a number', () => {
    expect(typeof getMainSitePerfNow()).toBe('number');
  });
});
