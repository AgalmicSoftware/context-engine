import {
  createWorkerCanonicalRouteController,
  getWorkerCanonicalRouteController,
} from './workerCanonicalRouteController';
import { resolveMainSiteDisplaySessionConfig } from './mainSiteCapabilityHostRuntime';
import { resolveMainSiteGroupWorkerRoute } from './workerCanonicalRouteResolution';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';

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
    expect(controller.isSessionSlug('worker-session')).toBe(true);
    expect(controller.getActiveVerifiedConfig('worker-session')).toBe(bootstrap.config);
    window.history.replaceState({}, '', '/session/worker-session?worker=https%3A%2F%2Fworker.example.com');
    expect(controller.isSessionSlug('worker-session')).toBe(true);
    expect(controller.isSessionSlug('other-session')).toBe(false);
    expect(controller.getActiveVerifiedConfig('worker-session')).toBe(bootstrap.config);
    expect(controller.getActiveVerifiedConfig('other-session')).toBeNull();
    expect(controller.getVerifiedConfig('worker-session', bootstrap.workerOrigin)).toBe(bootstrap.config);
    expect(controller.getVerifiedConfig('worker-session', 'https://other.example.com')).toBeNull();
    expect(controller.getVerifiedConfig('other-session', bootstrap.workerOrigin)).toBeNull();
  });

  it('uses only the selected verified Worker on home and resets stale question readiness', () => {
    window.history.replaceState({}, '', '/');
    const { host } = buildHost();
    host.getSessionSlugFromState = jest.fn(() => 'eddy-fixture');
    const controller = createWorkerCanonicalRouteController(host);
    const config = { slug: 'eddy-fixture' };
    expect(controller.isSessionSlug('eddy-fixture')).toBe(false);
    controller.handleBootstrapResolved({
      config,
      sessionSlug: 'eddy-fixture',
      sessionId: '0x00112233445566778899aabbccddeeff',
      workerOrigin: 'https://worker.example.com',
      configRevision: '1',
    });
    expect(controller.getActiveVerifiedConfig('eddy-fixture')).toBe(config);
    const patch = host.setState.mock.calls.at(-1)[0]({ isQuestionCacheReady: true });
    expect(patch).toMatchObject({ isQuestionCacheReady: false, isSurveyCacheReady: false });
    host.getSessionSlugFromState.mockReturnValue('other-session');
    expect(controller.getActiveVerifiedConfig('eddy-fixture')).toBeNull();
  });

  it.each(['https://canonical.example.com', 'https://other.example.com'])(
    'requires Home verification after visiting the same slug through %s',
    (routeOrigin) => {
      const slug = 'worker-session';
      const canonicalConfig = {
        slug,
        corsWorkerUrl: 'https://canonical.example.com',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
      };
      const routeConfig = { ...canonicalConfig, corsWorkerUrl: routeOrigin, configRevision: 'route-revision' };
      window.history.replaceState({}, '', `/session/${slug}?worker=${encodeURIComponent(routeOrigin)}`);
      const { host, readState } = buildHost();
      host.getSessionSlugFromState = jest.fn(() => slug);
      host.getSessionCfg = jest.fn(() => canonicalConfig);
      const controller = getWorkerCanonicalRouteController(host);
      const routeResolved = controller.handleBootstrapResolved;
      const bootstrap = {
        config: routeConfig,
        sessionSlug: slug,
        sessionId: '0x00112233445566778899aabbccddeeff',
        workerOrigin: routeOrigin,
        configRevision: 'route-revision',
      };
      routeResolved(bootstrap);
      expect(controller.getActiveVerifiedConfig(slug)).toBe(routeConfig);

      window.history.replaceState({}, '', '/');
      expect(controller.getActiveVerifiedConfig(slug)).toBeNull();
      expect(controller.hasVerifiedRoute(slug, routeOrigin)).toBe(false);
      expect(controller.getVerifiedConfig(slug, routeOrigin)).toBeNull();
      const displayConfig = resolveMainSiteDisplaySessionConfig(host, slug);
      expect(displayConfig?.corsWorkerUrl).toBe(canonicalConfig.corsWorkerUrl);
      expect(
        resolveMainSiteGroupWorkerRoute({
          workerSessionSlug: slug,
          sessionConfig: displayConfig,
          searchStr: '',
          controller,
        }),
      ).toMatchObject({ kind: 'bootstrap', workerOrigin: canonicalConfig.corsWorkerUrl });

      // A completion retained by the previous route cannot establish Home authority.
      const nonce = readState().sessionPathResolutionNonce;
      routeResolved(bootstrap);
      expect(controller.getActiveVerifiedConfig(slug)).toBeNull();
      expect(readState().sessionPathResolutionNonce).toBe(nonce);
      const homeResolved = controller.handleBootstrapResolved;
      expect(homeResolved).not.toBe(routeResolved);
      expect(controller.handleBootstrapResolved).toBe(homeResolved);
      homeResolved({ ...bootstrap, config: canonicalConfig, workerOrigin: canonicalConfig.corsWorkerUrl });
      expect(controller.getActiveVerifiedConfig(slug)).toBe(canonicalConfig);
      expect(controller.hasVerifiedRoute(slug, canonicalConfig.corsWorkerUrl)).toBe(true);

      window.history.replaceState({}, '', `/session/${slug}?worker=${encodeURIComponent(routeOrigin)}`);
      const resumedRouteConfig = routeOrigin === canonicalConfig.corsWorkerUrl ? routeConfig : null;
      expect(controller.getActiveVerifiedConfig(slug)).toBe(resumedRouteConfig);
      homeResolved({ ...bootstrap, config: canonicalConfig, workerOrigin: canonicalConfig.corsWorkerUrl });
      expect(controller.getActiveVerifiedConfig(slug)).toBe(resumedRouteConfig);
    },
  );

  it.each([
    ['https://other.example.com', '0x00112233445566778899aabbccddeeff', 'home-revision', true],
    ['https://canonical.example.com', '0xffeeddccbbaa99887766554433221100', 'home-revision', true],
    ['https://canonical.example.com', '0x00112233445566778899aabbccddeeff', 'route-revision', true],
    ['https://canonical.example.com', '0x00112233445566778899aabbccddeeff', 'home-revision', false],
  ])(
    'invalidates prior Home proof only after identity or revision changes (%s, %s, %s)',
    (workerOrigin, sessionId, configRevision, changed) => {
      const slug = 'worker-session';
      window.history.replaceState({}, '', '/');
      const { host } = buildHost();
      host.getSessionSlugFromState = jest.fn(() => slug);
      const controller = createWorkerCanonicalRouteController(host);
      const homeBootstrap = {
        config: { slug, configRevision: 'home-revision' },
        sessionSlug: slug,
        sessionId: '0x00112233445566778899aabbccddeeff',
        workerOrigin: 'https://canonical.example.com',
        configRevision: 'home-revision',
      };
      controller.handleBootstrapResolved(homeBootstrap);
      window.history.replaceState({}, '', `/session/${slug}?worker=${encodeURIComponent(workerOrigin)}`);
      controller.handleBootstrapResolved({
        ...homeBootstrap,
        config: { slug, configRevision },
        workerOrigin,
        sessionId,
        configRevision,
      });
      window.history.replaceState({}, '', '/');
      expect(controller.getActiveVerifiedConfig(slug)).toBe(changed ? null : homeBootstrap.config);
      expect(controller.hasVerifiedRoute(slug, homeBootstrap.workerOrigin)).toBe(!changed);
    },
  );

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
    window.history.replaceState({}, '', '/session/worker-session?worker=');
    expect(controller.getActiveVerifiedConfig('worker-session')).toBeNull();
    window.history.replaceState({}, '', '/session/worker-session');
    expect(controller.getActiveVerifiedConfig('worker-session')).toBe(secondConfig);
    window.history.replaceState({}, '', '/session/other-session');
    expect(controller.getActiveVerifiedConfig('worker-session')).toBeNull();
  });

  it.each(['/compare', '/compare/', '/u/0x1111111111111111111111111111111111111111'])(
    'scopes verified query configuration to its exact session and origin on %s',
    (path) => {
      const { host } = buildHost();
      const controller = createWorkerCanonicalRouteController(host);
      const config = { slug: 'worker-session', configRevision: 'revision-1' };
      controller.handleBootstrapResolved({
        config,
        configRevision: 'revision-1',
        sessionId: '0x00112233445566778899aabbccddeeff',
        sessionSlug: config.slug,
        workerOrigin: 'https://worker.example.com',
      });
      window.history.replaceState({}, '', `${path}?session=worker-session`);
      expect(controller.getActiveVerifiedConfig('worker-session')).toBe(config);
      expect(controller.getActiveVerifiedConfig('other-session')).toBeNull();
      window.history.replaceState({}, '', `${path}?session=worker-session&worker=https%3A%2F%2Fother.example.com`);
      expect(controller.getActiveVerifiedConfig('worker-session')).toBeNull();
      window.history.replaceState({}, '', `${path}?session=other-session`);
      expect(controller.getActiveVerifiedConfig('worker-session')).toBeNull();
    },
  );

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
