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
      config: {},
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
    expect(controller.isSessionSlug('worker-session')).toBe(true);
    expect(controller.isSessionSlug('other-session')).toBe(false);
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

    window.history.replaceState({}, '', '/session/worker-session');
    expect(controller.isSessionSlug('worker-session')).toBe(false);
  });
});
