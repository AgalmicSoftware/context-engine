import {
  createWorkerCanonicalRouteController,
  getWorkerCanonicalRouteController,
} from './workerCanonicalRouteController';

const buildHost = () => {
  let state = { sessionPathResolutionNonce: 0 };
  const host = {
    getCurrentPathname: jest.fn(() => window.location.pathname),
    getSessionTokenFromPath: jest.fn((path: string) => path.split('/').filter(Boolean)[1] || ''),
    setState: jest.fn((updater) => {
      state = { ...state, ...updater(state) };
    }),
  };
  return { host: host as any, readState: () => state };
};

describe('workerCanonicalRouteController', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/session/worker-session');
  });

  it('pins a verified origin and slug in memory and bumps route resolution once', () => {
    const { host, readState } = buildHost();
    const controller = createWorkerCanonicalRouteController(host);
    const bootstrap = {
      config: { slug: 'worker-session', configRevision: 'revision-1' },
      configRevision: 'revision-1',
      sessionId: '0x00112233445566778899aabbccddeeff',
      sessionSlug: 'worker-session',
      workerOrigin: 'https://worker.example.com',
    };

    expect(controller.hasVerifiedRoute(bootstrap.sessionSlug, bootstrap.workerOrigin)).toBe(false);
    controller.handleBootstrapResolved(bootstrap);

    expect(controller.hasVerifiedRoute(bootstrap.sessionSlug, bootstrap.workerOrigin)).toBe(true);
    expect(controller.hasVerifiedRoute(bootstrap.sessionSlug, 'https://other.example.com')).toBe(false);
    expect(readState().sessionPathResolutionNonce).toBe(1);
    window.history.replaceState({}, '', '/session/worker-session?worker=https%3A%2F%2Fworker.example.com');
    expect(controller.isSessionSlug('worker-session')).toBe(true);
    expect(controller.isSessionSlug('other-session')).toBe(false);
    expect(controller.getActiveVerifiedConfig('worker-session')).toBe(bootstrap.config);
    expect(controller.getActiveVerifiedConfig('other-session')).toBeNull();
    expect(controller.getVerifiedConfig('worker-session', bootstrap.workerOrigin)).toBe(bootstrap.config);
    expect(controller.getVerifiedConfig('worker-session', 'https://other.example.com')).toBeNull();
    expect(controller.getVerifiedConfig('other-session', bootstrap.workerOrigin)).toBeNull();
  });

  it('replaces same-slug route state without leaking config across Worker origins', () => {
    const { host } = buildHost();
    const controller = createWorkerCanonicalRouteController(host);
    const firstConfig = { slug: 'worker-session', marker: 'first' };
    const secondConfig = { slug: 'worker-session', marker: 'second' };

    controller.handleBootstrapResolved({
      config: firstConfig,
      configRevision: 'revision-1',
      sessionId: '0x00112233445566778899aabbccddeeff',
      sessionSlug: 'worker-session',
      workerOrigin: 'https://first.example.com',
    });
    controller.handleBootstrapResolved({
      config: secondConfig,
      configRevision: 'revision-2',
      sessionId: '0xffeeddccbbaa99887766554433221100',
      sessionSlug: 'worker-session',
      workerOrigin: 'https://second.example.com',
    });

    expect(controller.hasVerifiedRoute('worker-session', 'https://first.example.com')).toBe(false);
    expect(controller.getVerifiedConfig('worker-session', 'https://first.example.com')).toBeNull();
    expect(controller.hasVerifiedRoute('worker-session', 'https://second.example.com')).toBe(true);
    expect(controller.getVerifiedConfig('worker-session', 'https://second.example.com')).toBe(secondConfig);
    window.history.replaceState({}, '', '/session/worker-session?worker=https%3A%2F%2Fsecond.example.com');
    expect(controller.getActiveVerifiedConfig('worker-session')).toBe(secondConfig);
    window.history.replaceState({}, '', '/session/worker-session?worker=https%3A%2F%2Ffirst.example.com');
    expect(controller.getActiveVerifiedConfig('worker-session')).toBeNull();
  });

  it('returns one stable controller per AppShell host', () => {
    const { host } = buildHost();
    expect(getWorkerCanonicalRouteController(host)).toBe(getWorkerCanonicalRouteController(host));
  });

  it('suppresses scans only for the explicit worker route, including invalid fail-closed queries', () => {
    const { host } = buildHost();
    const controller = createWorkerCanonicalRouteController(host);

    window.history.replaceState({}, '', '/session/worker-session?worker=https%3A%2F%2Fworker.example.com');
    expect(controller.isSessionSlug('worker-session')).toBe(true);
    expect(controller.isSessionSlug('other-session')).toBe(false);

    window.history.replaceState(
      {},
      '',
      '/session/worker-session?worker=https%3A%2F%2Ffirst.example.com&worker=https%3A%2F%2Fsecond.example.com',
    );
    expect(controller.isSessionSlug('worker-session')).toBe(true);
    expect(controller.getActiveVerifiedConfig('worker-session')).toBeNull();

    window.history.replaceState({}, '', '/session/worker-session');
    expect(controller.isSessionSlug('worker-session')).toBe(false);
  });
});
