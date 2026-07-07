import type { SessionPathResolverController } from './sessionPathResolverController';

jest.mock('../../utilities/web3/contractScripts.js', () => ({
  __esModule: true,
  normalizeSessionSlug: jest.fn((value = '') =>
    String(value || '')
      .trim()
      .toLowerCase(),
  ),
}));

jest.mock('../../utilities/web3/sessionRegistry.js', () => ({
  __esModule: true,
  sessionRegistryStore: {
    getSessionConfigById: jest.fn(),
  },
  sessionRegistryUtils: {
    formatSessionId: jest.fn((value = '') =>
      String(value || '')
        .trim()
        .toLowerCase(),
    ),
    fetchSessionFromRegistry: jest.fn(),
    upsertSessionRegistryCache: jest.fn(),
  },
}));

jest.mock('../../utilities/crypto/litProtocol.js', () => ({
  __esModule: true,
  getGlobalLitHooks: jest.fn(() => ({ lit: true })),
}));

jest.mock('../../variables/chains.js', () => ({
  __esModule: true,
  getSessionRegistryChainIds: jest.fn(() => [84532]),
}));

jest.mock('./urlUtils.js', () => ({
  __esModule: true,
  buildPublicUrl: jest.fn((path = '', search = '', hash = '') => `${path}${search}${hash}`),
}));

jest.mock('../../variables/appConfig.js', () => ({
  __esModule: true,
  DEFAULT_SESSION_SLUG_ALIAS: 'general',
}));

const { createSessionPathResolverController } = require('./sessionPathResolverController.js');
const contractScriptsModule = require('../../utilities/web3/contractScripts.js');
const sessionRegistryModule = require('../../utilities/web3/sessionRegistry.js');
const litProtocolModule = require('../../utilities/crypto/litProtocol.js');
const chainsModule = require('../../variables/chains.js');
const urlUtilsModule = require('./urlUtils.js');

type StoredSessionConfig = {
  sessionId?: unknown;
  id?: unknown;
  sessionIdHex?: unknown;
  slug?: unknown;
  [key: string]: unknown;
};

type SessionPathResolverControllerDebug = SessionPathResolverController & {
  _errorCounts: { id: Record<string, number> };
  _lastErrors: { id: Record<string, { message?: string }> };
  _retryTimers: { id: Record<string, unknown> };
};

const useModernFakeTimers = jest.useFakeTimers as unknown as (mode: 'modern') => typeof jest;

const createDeferred = <T>() => {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  let reject: (error?: unknown) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushMicrotasks = async (times = 8): Promise<void> => {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
};

const advanceTimersAndFlush = async (ms: number): Promise<void> => {
  jest.advanceTimersByTime(ms);
  await flushMicrotasks();
};

const setWindowPath = (path = '/'): void => {
  window.history.replaceState({}, '', path);
};

const getSessionTokenFromPath = (path = ''): string => {
  const parts = String(path || '')
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean);
  if (parts[0] !== 'session') return '';
  return String(parts[1] || '').trim();
};

const makeHost = (overrides: Record<string, unknown> = {}) => ({
  getProvider: jest.fn(() => ({ provider: true })),
  getAccount: jest.fn(() => '0xaccount'),
  isMounted: jest.fn(() => true),
  bumpResolutionNonce: jest.fn(),
  normalizeRoutePath: jest.fn((path = '') => String(path || '')),
  getSessionTokenFromPath: jest.fn((path = '') => getSessionTokenFromPath(path)),
  warn: jest.fn(),
  ...overrides,
});

describe('createSessionPathResolverController', () => {
  let storedConfigsById: Record<string, StoredSessionConfig | undefined>;

  beforeEach(() => {
    jest.clearAllMocks();
    useModernFakeTimers('modern');

    storedConfigsById = {};
    setWindowPath('/');

    contractScriptsModule.normalizeSessionSlug.mockImplementation((value = '') =>
      String(value || '')
        .trim()
        .toLowerCase(),
    );
    litProtocolModule.getGlobalLitHooks.mockReturnValue({ lit: true });
    chainsModule.getSessionRegistryChainIds.mockReturnValue([84532]);
    urlUtilsModule.buildPublicUrl.mockImplementation((path = '', search = '', hash = '') => `${path}${search}${hash}`);

    sessionRegistryModule.sessionRegistryUtils.formatSessionId.mockImplementation((value = '') =>
      String(value || '')
        .trim()
        .toLowerCase(),
    );
    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockResolvedValue(null);
    sessionRegistryModule.sessionRegistryUtils.upsertSessionRegistryCache.mockImplementation(
      ({ config }: { config?: StoredSessionConfig } = {}) => {
        const sessionId = sessionRegistryModule.sessionRegistryUtils.formatSessionId(
          config?.sessionId || config?.id || config?.sessionIdHex || '',
        );
        if (sessionId) {
          storedConfigsById[sessionId] = config;
        }
      },
    );
    sessionRegistryModule.sessionRegistryStore.getSessionConfigById.mockImplementation(
      (sessionId: string) =>
        storedConfigsById[
          String(sessionId || '')
            .trim()
            .toLowerCase()
        ] || null,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    setWindowPath('/');
  });

  it('deduplicates in-flight id resolves', async () => {
    const deferred = createDeferred<unknown>();
    const host = makeHost();
    const controller = createSessionPathResolverController(host);

    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockReturnValue(deferred.promise);

    controller.resolveId('0xabc');
    controller.resolveId('0xabc');

    expect(sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry).toHaveBeenCalledTimes(1);

    deferred.resolve(null);
    await flushMicrotasks();
  });

  it('throttles duplicate id attempts within 3 seconds', async () => {
    const host = makeHost();
    const controller = createSessionPathResolverController(host);

    controller.resolveId('0xabc');
    await flushMicrotasks();

    jest.advanceTimersByTime(2999);
    controller.resolveId('0xabc');
    await flushMicrotasks();

    expect(sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry).toHaveBeenCalledTimes(1);
  });

  it('reports normalized pending status snapshots for id and slug resolves', async () => {
    const idDeferred = createDeferred<unknown>();
    const slugDeferred = createDeferred<unknown>();
    const host = makeHost();
    const controller = createSessionPathResolverController(host);

    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockImplementation(
      ({ sessionId, slug }: { sessionId?: string; slug?: string } = {}) => {
        if (sessionId) return idDeferred.promise;
        if (slug) return slugDeferred.promise;
        return Promise.resolve(null);
      },
    );

    controller.resolveId(' 0xAbC ');
    controller.resolveSlug(' Alpha ');

    expect(controller.getIdStatus('0xabc')).toEqual({
      hasAttempted: true,
      isPending: true,
      retryCount: 0,
      lastErrorTs: null,
    });
    expect(controller.getSlugStatus(' alpha ')).toEqual({
      hasAttempted: true,
      isPending: true,
      retryCount: 0,
      lastErrorTs: null,
    });

    idDeferred.resolve(null);
    slugDeferred.resolve(null);
    await flushMicrotasks();

    expect(controller.getIdStatus('0xabc')).toEqual({
      hasAttempted: true,
      isPending: false,
      retryCount: 0,
      lastErrorTs: null,
    });
    expect(controller.getSlugStatus('alpha')).toEqual({
      hasAttempted: true,
      isPending: false,
      retryCount: 0,
      lastErrorTs: null,
    });
  });

  it('surfaces retry metadata through id status snapshots and clears it after recovery', async () => {
    const sessionId = '0xabc';
    const host = makeHost();
    const controller = createSessionPathResolverController(host);

    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ sessionId, slug: 'alpha' });

    controller.resolveId(sessionId);
    await flushMicrotasks();

    const failedStatus = controller.getIdStatus(sessionId);
    expect(failedStatus.hasAttempted).toBe(true);
    expect(failedStatus.isPending).toBe(false);
    expect(failedStatus.retryCount).toBe(1);
    expect(typeof failedStatus.lastErrorTs).toBe('number');

    await advanceTimersAndFlush(3200);

    expect(controller.getIdStatus(sessionId)).toEqual({
      hasAttempted: true,
      isPending: false,
      retryCount: 0,
      lastErrorTs: null,
    });
  });

  it('clears prior id error state after a successful resolve and bumps the nonce', async () => {
    const sessionId = '0xabc';
    const host = makeHost();
    const controller = createSessionPathResolverController(host) as SessionPathResolverControllerDebug;

    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ sessionId, slug: 'alpha' });

    controller.resolveId(sessionId);
    await flushMicrotasks();

    expect(controller._errorCounts.id[sessionId]).toBe(1);
    expect(controller._lastErrors.id[sessionId]).toEqual(
      expect.objectContaining({
        message: 'boom',
      }),
    );
    expect(controller._retryTimers.id[sessionId]).toBeDefined();

    await advanceTimersAndFlush(3200);

    expect(host.bumpResolutionNonce).toHaveBeenCalledTimes(2);
    expect(controller._errorCounts.id[sessionId]).toBeUndefined();
    expect(controller._lastErrors.id[sessionId]).toBeUndefined();
    expect(controller._retryTimers.id[sessionId]).toBeUndefined();
  });

  it('schedules the first retry at 3200ms after an id resolve failure', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const host = makeHost();
    const controller = createSessionPathResolverController(host);

    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockRejectedValue(new Error('boom'));

    controller.resolveId('0xabc');
    await flushMicrotasks();

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(setTimeoutSpy.mock.calls[0]?.[1]).toBe(3200);
  });

  it('applies exponential backoff for successive id resolve failures', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const host = makeHost();
    const controller = createSessionPathResolverController(host);
    const expectedDelays = [3200, 3200, 6000, 12000];

    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockRejectedValue(new Error('boom'));

    controller.resolveId('0xabc');
    await flushMicrotasks();

    await advanceTimersAndFlush(3200);

    await advanceTimersAndFlush(3200);

    await advanceTimersAndFlush(6000);

    expect(setTimeoutSpy.mock.calls.slice(0, 4).map((call) => call[1])).toEqual(expectedDelays);
  });

  it('caps retry backoff at 30000ms on the seventh and later failures', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const host = makeHost();
    const controller = createSessionPathResolverController(host);

    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockRejectedValue(new Error('boom'));

    controller.resolveId('0xabc');
    await flushMicrotasks();

    for (const delay of [3200, 3200, 6000, 12000, 24000, 30000]) {
      // eslint-disable-next-line no-await-in-loop
      await advanceTimersAndFlush(delay);
    }

    const delays = setTimeoutSpy.mock.calls.slice(0, 7).map((call) => call[1]);
    expect(delays[5]).toBe(30000);
    expect(delays[6]).toBe(30000);
  });

  it('clears retry timers on destroy and suppresses nonce bumps from in-flight resolves', async () => {
    const failingHost = makeHost();
    const failingController = createSessionPathResolverController(failingHost);

    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockRejectedValue(new Error('boom'));

    failingController.resolveId('0xdead');
    await flushMicrotasks();
    expect(sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry).toHaveBeenCalledTimes(1);

    failingController.destroy();
    await advanceTimersAndFlush(3200);

    expect(sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry).toHaveBeenCalledTimes(1);

    const pendingHost = makeHost({
      isMounted: jest.fn(() => true),
    });
    const pendingController = createSessionPathResolverController(pendingHost);
    const deferred = createDeferred<unknown>();

    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockReset();
    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockReturnValue(deferred.promise);

    pendingController.resolveId('0xbeef');
    pendingController.destroy();
    deferred.resolve(null);
    await flushMicrotasks();

    expect(pendingHost.bumpResolutionNonce).not.toHaveBeenCalled();
  });

  it('canonicalizes /session/:id routes to the resolved slug path', async () => {
    const sessionId = '0xabc';
    const host = makeHost();
    const controller = createSessionPathResolverController(host);
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    setWindowPath('/session/0xabc?foo=1#bar');
    replaceStateSpy.mockClear();
    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockResolvedValue({
      sessionId,
      slug: 'alpha',
    });

    controller.resolveId(sessionId);
    await flushMicrotasks();

    expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/session/alpha?foo=1#bar');
  });

  it('does not rewrite docs subroutes after resolving a session id', async () => {
    const sessionId = '0xabc';
    const host = makeHost();
    const controller = createSessionPathResolverController(host);
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    setWindowPath('/session/0xabc/docs/library?foo=1#bar');
    replaceStateSpy.mockClear();
    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockResolvedValue({
      sessionId,
      slug: 'alpha',
    });

    controller.resolveId(sessionId);
    await flushMicrotasks();

    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('resolves slugs, bumps the nonce, and does not rewrite the URL', async () => {
    const host = makeHost();
    const controller = createSessionPathResolverController(host);
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState');

    setWindowPath('/session/original?foo=1#bar');
    replaceStateSpy.mockClear();
    sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry.mockResolvedValue({
      sessionId: '0xabc',
      slug: 'alpha',
    });

    controller.resolveSlug(' Alpha ');
    await flushMicrotasks();

    expect(sessionRegistryModule.sessionRegistryUtils.fetchSessionFromRegistry).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'alpha',
      }),
    );
    expect(host.bumpResolutionNonce).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });
});
