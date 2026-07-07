jest.mock('utilities/logging.js', () => ({
  __esModule: true,
  createLogger: jest.fn(),
}));

jest.mock('../../utilities/web3/chainGateway.js', () => ({
  __esModule: true,
  getAllSessionSlugs: jest.fn(),
  normalizeSessionSlug: jest.fn(),
}));

jest.mock('../../utilities/session/sessionScanScope.js', () => ({
  __esModule: true,
  readSessionScanScope: jest.fn(),
  readSessionScanSlugs: jest.fn(),
  getAllowedSessionSlugs: jest.fn(),
  isSessionSlugAllowedByScope: jest.fn(),
}));

jest.mock('../../utilities/sbt/sbtInstanceListenersMode.js', () => ({
  __esModule: true,
  readSbtInstanceListenersMode: jest.fn(),
}));

jest.mock('../../utilities/sbt/sbtFullScanPolicy.js', () => ({
  __esModule: true,
  readSbtFullScanPolicy: jest.fn(),
}));

const makeHost = (overrides = {}) => ({
  getActiveSessionSlug: jest.fn().mockReturnValue(''),
  getCurrentPath: jest.fn().mockReturnValue(''),
  getSessionSlugHintFromSearch: jest.fn().mockReturnValue(null),
  getSessionTokenFromPath: jest.fn().mockReturnValue(''),
  isSbtListRoutePath: jest.fn().mockReturnValue(false),
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

let contractScriptsModule;
let scanScopeModule;
let listenersModule;
let fullScanModule;
let loggingModule;
let createSessionScanPolicy;
let mockLogger;
let originalWindow;
let consoleInfoSpy;

describe('createSessionScanPolicy', () => {
  beforeAll(() => {
    originalWindow = globalThis.window;
  });

  beforeEach(() => {
    jest.resetModules();

    contractScriptsModule = jest.requireMock('../../utilities/web3/chainGateway.js');
    scanScopeModule = jest.requireMock('../../utilities/session/sessionScanScope.js');
    listenersModule = jest.requireMock('../../utilities/sbt/sbtInstanceListenersMode.js');
    fullScanModule = jest.requireMock('../../utilities/sbt/sbtFullScanPolicy.js');
    loggingModule = jest.requireMock('utilities/logging.js');

    jest.clearAllMocks();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    mockLogger = {
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      isEnabled: jest.fn(() => false),
    };
    loggingModule.createLogger.mockReturnValue(mockLogger);

    contractScriptsModule.normalizeSessionSlug.mockImplementation((slug) =>
      String(slug || '')
        .trim()
        .toLowerCase(),
    );
    contractScriptsModule.getAllSessionSlugs.mockReturnValue(['alpha', 'beta']);
    scanScopeModule.readSessionScanScope.mockReturnValue('all');
    scanScopeModule.readSessionScanSlugs.mockReturnValue([]);
    scanScopeModule.getAllowedSessionSlugs.mockReturnValue([]);
    scanScopeModule.isSessionSlugAllowedByScope.mockReturnValue(true);
    listenersModule.readSbtInstanceListenersMode.mockReturnValue('auto');
    fullScanModule.readSbtFullScanPolicy.mockReturnValue('auto');

    ({ createSessionScanPolicy } = require('./mainSiteSessionScanPolicy.js'));

    setWindowValue(originalWindow);
    window.history.replaceState({}, '', '/');
    delete window.ENABLE_SBT_HISTORY_SCAN;
    delete window.SBT_INSTANCE_LISTENER_GROUPS;
    delete window.DISABLE_SBT_INSTANCE_LISTENERS;
    delete window.MAX_SBT_INSTANCE_LISTENERS;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setWindowValue(originalWindow);
    if (globalThis.window) {
      window.history.replaceState({}, '', '/');
      delete window.ENABLE_SBT_HISTORY_SCAN;
      delete window.SBT_INSTANCE_LISTENER_GROUPS;
      delete window.DISABLE_SBT_INSTANCE_LISTENERS;
      delete window.MAX_SBT_INSTANCE_LISTENERS;
    }
  });

  it('returns false without window and true when the history scan flag is enabled', () => {
    const policy = createSessionScanPolicy(makeHost());
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

    if (!descriptor || descriptor.configurable !== false) {
      setWindowValue(undefined);
      expect(policy.isSbtHistoryScanEnabled()).toBe(false);
    }

    setWindowValue(originalWindow);
    window.ENABLE_SBT_HISTORY_SCAN = true;
    expect(policy.isSbtHistoryScanEnabled()).toBe(true);
  });

  it('enables SBT instance listeners for the default general group', () => {
    const policy = createSessionScanPolicy(makeHost());

    listenersModule.readSbtInstanceListenersMode.mockReturnValue('on');

    expect(policy.isSbtInstanceListenerEnabledForGroup('general')).toBe(true);
  });

  it('enables SBT instance listeners for wildcard groups', () => {
    const policy = createSessionScanPolicy(makeHost());

    listenersModule.readSbtInstanceListenersMode.mockReturnValue('on');
    window.SBT_INSTANCE_LISTENER_GROUPS = ['*'];

    expect(policy.isSbtInstanceListenerEnabledForGroup('alpha')).toBe(true);
  });

  it('suppresses SBT instance listeners when the mode disables them', () => {
    const policy = createSessionScanPolicy(makeHost());

    listenersModule.readSbtInstanceListenersMode.mockReturnValue('off');

    expect(policy.isSbtInstanceListenerEnabledForGroup('general')).toBe(false);
  });

  it('suppresses SBT instance listeners in auto mode for non-all scopes and only logs once', () => {
    listenersModule.readSbtInstanceListenersMode.mockReturnValue('auto');
    scanScopeModule.readSessionScanScope.mockReturnValue('active');

    let policy = createSessionScanPolicy(makeHost());
    const suppressionMessage =
      '[Context Engine] SBT instance listeners suppressed (auto) because CE_SESSION_SCAN_SCOPE=active. ' +
      'Set CE_SBT_INSTANCE_LISTENERS_MODE=on to override.';

    expect(policy.isSbtInstanceListenerEnabledForGroup('general')).toBe(false);
    expect(consoleInfoSpy.mock.calls.filter(([message]) => message === suppressionMessage)).toHaveLength(1);

    expect(policy.isSbtInstanceListenerEnabledForGroup('general')).toBe(false);
    expect(consoleInfoSpy.mock.calls.filter(([message]) => message === suppressionMessage)).toHaveLength(1);

    scanScopeModule.readSessionScanScope.mockReturnValue('all');
    policy = createSessionScanPolicy(makeHost());

    expect(policy.isSbtInstanceListenerEnabledForGroup('general')).toBe(true);
  });

  it('returns the scan scope and logs the non-all scope warning only once', () => {
    const policy = createSessionScanPolicy(makeHost());

    scanScopeModule.readSessionScanScope.mockReturnValue('active');

    expect(policy.getSessionScanScope()).toBe('active');
    expect(policy.getSessionScanScope()).toBe('active');
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[Context Engine] CE_SESSION_SCAN_SCOPE=active (cross-session RPC scans clamped)',
    );
  });

  it('assembles scan scope context from host state and imported helpers', () => {
    const host = makeHost({
      getActiveSessionSlug: jest.fn().mockReturnValue(' Active '),
      getCurrentPath: jest.fn().mockReturnValue('/group/active?tab=sbts'),
      getSessionSlugHintFromSearch: jest.fn().mockReturnValue(null),
      getSessionTokenFromPath: jest.fn().mockReturnValue('active'),
    });
    const policy = createSessionScanPolicy(host);

    scanScopeModule.readSessionScanScope.mockReturnValue('active');
    scanScopeModule.readSessionScanSlugs.mockReturnValue(['alpha', 'beta']);
    window.history.replaceState({}, '', '/session/active?foo=1');

    expect(policy.getSessionScanScopeContext()).toEqual({
      scope: 'active',
      list: ['alpha', 'beta'],
      activeSlug: 'active',
      activeSlugFromRoute: true,
    });
    expect(host.getSessionSlugHintFromSearch).toHaveBeenCalledWith('?foo=1');
    expect(host.getCurrentPath).toHaveBeenCalledTimes(1);
    expect(host.getSessionTokenFromPath).toHaveBeenCalledWith('/group/active?tab=sbts');
  });

  it('honors query slug hints before route token checks in the scan scope context', () => {
    const host = makeHost({
      getActiveSessionSlug: jest.fn().mockReturnValue('alpha'),
      getSessionSlugHintFromSearch: jest.fn().mockReturnValue(' Beta '),
      getSessionTokenFromPath: jest.fn().mockReturnValue('new'),
    });
    const policy = createSessionScanPolicy(host);

    scanScopeModule.readSessionScanSlugs.mockReturnValue(['beta']);
    window.history.replaceState({}, '', '/session/new?sessionSlug=beta');

    expect(policy.getSessionScanScopeContext('list')).toEqual({
      scope: 'list',
      list: ['beta'],
      activeSlug: 'beta',
      activeSlugFromRoute: true,
    });
    expect(host.getSessionTokenFromPath).not.toHaveBeenCalled();
  });

  it('applies manual, sbts, and auto full-scan policies with pathname overrides', () => {
    const host = makeHost({
      getCurrentPath: jest.fn().mockReturnValue('/sessions/list?tab=sbts'),
      isSbtListRoutePath: jest.fn().mockReturnValue(true),
    });
    const policy = createSessionScanPolicy(host);

    fullScanModule.readSbtFullScanPolicy.mockReturnValue('manual');
    expect(policy.shouldAutoRunFullSbtScan()).toBe(false);

    fullScanModule.readSbtFullScanPolicy.mockReturnValue('sbts');
    expect(policy.shouldAutoRunFullSbtScan({ pathname: '/sbt/123?view=detail' })).toBe(true);
    expect(host.getCurrentPath).not.toHaveBeenCalled();

    host.getCurrentPath.mockClear();
    expect(policy.shouldAutoRunFullSbtScan()).toBe(true);
    expect(host.getCurrentPath).toHaveBeenCalledTimes(1);
    expect(host.isSbtListRoutePath).toHaveBeenCalledWith('/sessions/list');

    fullScanModule.readSbtFullScanPolicy.mockReturnValue('auto');
    expect(policy.shouldAutoRunFullSbtScan()).toBe(true);
  });

  it('respects listener suppression, MAX overrides, and the disable flag for detail listeners', () => {
    listenersModule.readSbtInstanceListenersMode.mockReturnValue('off');
    let policy = createSessionScanPolicy(makeHost());
    expect(policy.shouldAttachSbtDetailInstanceListener()).toBe(false);

    listenersModule.readSbtInstanceListenersMode.mockReturnValue('on');
    window.MAX_SBT_INSTANCE_LISTENERS = 0;
    policy = createSessionScanPolicy(makeHost());
    expect(policy.shouldAttachSbtDetailInstanceListener()).toBe(false);

    delete window.MAX_SBT_INSTANCE_LISTENERS;
    window.DISABLE_SBT_INSTANCE_LISTENERS = true;
    policy = createSessionScanPolicy(makeHost());
    expect(policy.shouldAttachSbtDetailInstanceListener()).toBe(false);

    delete window.DISABLE_SBT_INSTANCE_LISTENERS;
    policy = createSessionScanPolicy(makeHost());
    expect(policy.shouldAttachSbtDetailInstanceListener()).toBe(true);
  });

  it('returns all slugs for all-scope and allowed slugs for restricted scope', () => {
    let policy = createSessionScanPolicy(makeHost());

    scanScopeModule.readSessionScanScope.mockReturnValue('all');
    expect(policy.getScopedSessionSlugs()).toEqual(['alpha', 'beta']);
    expect(contractScriptsModule.getAllSessionSlugs).toHaveBeenCalledTimes(1);

    scanScopeModule.readSessionScanScope.mockReturnValue('list');
    scanScopeModule.readSessionScanSlugs.mockReturnValue(['alpha']);
    scanScopeModule.getAllowedSessionSlugs.mockReturnValue(['alpha']);
    policy = createSessionScanPolicy(
      makeHost({
        getActiveSessionSlug: jest.fn().mockReturnValue('Alpha'),
      }),
    );

    expect(policy.getScopedSessionSlugs()).toEqual(['alpha']);
    expect(scanScopeModule.getAllowedSessionSlugs).toHaveBeenCalledWith('list', ['alpha'], 'alpha');
  });

  it('never skips scans in all scope and skips disallowed slugs in restricted scope', () => {
    let policy = createSessionScanPolicy(makeHost());

    scanScopeModule.readSessionScanScope.mockReturnValue('all');
    expect(policy.shouldSkipSessionScanForSlug('beta', 'scan')).toBe(false);
    expect(scanScopeModule.isSessionSlugAllowedByScope).not.toHaveBeenCalled();

    scanScopeModule.readSessionScanScope.mockReturnValue('active');
    scanScopeModule.isSessionSlugAllowedByScope.mockReturnValue(false);
    scanScopeModule.getAllowedSessionSlugs.mockReturnValue(['alpha']);
    policy = createSessionScanPolicy(
      makeHost({
        getActiveSessionSlug: jest.fn().mockReturnValue('alpha'),
      }),
    );

    expect(policy.shouldSkipSessionScanForSlug('beta', 'scan')).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
  });

  it('runs the onSkipped callback when a slug is out of scope', () => {
    const onSkipped = jest.fn();
    const policy = createSessionScanPolicy(
      makeHost({
        getActiveSessionSlug: jest.fn().mockReturnValue('alpha'),
      }),
    );

    scanScopeModule.readSessionScanScope.mockReturnValue('active');
    scanScopeModule.isSessionSlugAllowedByScope.mockReturnValue(false);
    scanScopeModule.getAllowedSessionSlugs.mockReturnValue(['alpha']);

    expect(policy.scanScopeNoop('beta', 'scan', onSkipped)).toBe(true);
    expect(onSkipped).toHaveBeenCalledTimes(1);
  });

  it('filters and dedupes slugs for restricted and all-scope scans', () => {
    let policy = createSessionScanPolicy(makeHost());

    scanScopeModule.readSessionScanScope.mockReturnValue('active');
    scanScopeModule.getAllowedSessionSlugs.mockReturnValue(['alpha']);
    scanScopeModule.isSessionSlugAllowedByScope.mockImplementation((slug) => slug === 'alpha');

    expect(policy.getScopeFilteredSlugs([' Alpha ', 'alpha', 'Beta', 'beta'])).toEqual(['alpha']);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);

    scanScopeModule.readSessionScanScope.mockReturnValue('all');
    policy = createSessionScanPolicy(makeHost());

    expect(policy.getScopeFilteredSlugs([' Alpha ', 'alpha', 'Beta '])).toEqual(['alpha', 'beta']);
  });

  it('delegates slug allowance checks to isSessionSlugAllowedByScope', () => {
    const policy = createSessionScanPolicy(makeHost());
    const scopeContext = {
      scope: 'active',
      list: ['alpha'],
      activeSlug: 'alpha',
      activeSlugFromRoute: true,
    };

    scanScopeModule.isSessionSlugAllowedByScope.mockReturnValue(false);

    expect(policy.isSessionSlugAllowedForScan(' Alpha ', scopeContext)).toBe(false);
    expect(scanScopeModule.isSessionSlugAllowedByScope).toHaveBeenCalledWith('alpha', scopeContext);
  });

  it('logs scope skips only once per operation and slug key', () => {
    const policy = createSessionScanPolicy(makeHost());
    const scopeContext = {
      scope: 'active',
      list: ['alpha'],
      activeSlug: 'alpha',
      activeSlugFromRoute: true,
    };

    scanScopeModule.getAllowedSessionSlugs.mockReturnValue(['', 'alpha']);

    policy.logScopeSkipOnce('scan', 'beta', scopeContext);
    policy.logScopeSkipOnce('scan', 'beta', scopeContext);

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    expect(mockLogger.info).toHaveBeenCalledWith('[SessionScanScope] skipped out-of-scope scan/listener', {
      operation: 'scan',
      slug: 'beta',
      scope: 'active',
      allowedSlugs: ['general', 'alpha'],
      activeSlug: 'alpha',
    });
  });

  it('clears skip-log dedupe state on destroy', () => {
    const policy = createSessionScanPolicy(makeHost());
    const scopeContext = {
      scope: 'active',
      list: ['alpha'],
      activeSlug: 'alpha',
      activeSlugFromRoute: true,
    };

    scanScopeModule.getAllowedSessionSlugs.mockReturnValue(['alpha']);

    policy.logScopeSkipOnce('scan', 'beta', scopeContext);
    policy.destroy();
    policy.logScopeSkipOnce('scan', 'beta', scopeContext);

    expect(mockLogger.info).toHaveBeenCalledTimes(2);
  });
});
