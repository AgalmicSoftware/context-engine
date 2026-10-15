import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { createMainSiteSessionScanPolicy } from './mainSiteSessionScanPolicyBinding';
import { createWorkerCanonicalRouteController } from './workerCanonicalRouteController';
import type { AppShell } from './AppShell';

const SESSION_SLUG = 'worker-session';
const FIRST_ORIGIN = 'https://first.example.com';
const SECOND_ORIGIN = 'https://second.example.com';
const ALL_SCOPE = {
  scope: 'all',
  list: [],
  activeSlug: SESSION_SLUG,
  activeSlugFromRoute: true,
};

describe('mainSiteSessionScanPolicyBinding', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it.each([`/session/${SESSION_SLUG}`, '/'])(
    'retains verified Worker on-chain SBT scans without a worker query on %s',
    (path) => {
      window.history.replaceState({}, '', path);
      const profile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
      profile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
      profile.evm.registryChainId = 11155420;
      profile.encryption.accessConditions = {
        match: 'any',
        conditions: [
          {
            kind: 'sbt_onchain',
            chainId: 11155420,
            contract: '0x1111111111111111111111111111111111111111',
            anyOrAll: 'any',
          },
        ],
      };
      const controller = createWorkerCanonicalRouteController({
        getCurrentPathname: () => window.location.pathname,
        getSessionTokenFromPath: () => SESSION_SLUG,
        getSessionSlugFromState: () => SESSION_SLUG,
        setState: jest.fn(),
      } as unknown as AppShell);
      const policy = createMainSiteSessionScanPolicy({
        _routeRenderers: { workerCanonicalRoutes: controller },
        getActiveSessionSlug: () => SESSION_SLUG,
        getCurrentPathname: () => window.location.pathname,
        getSessionSlugHintFromSearch: () => null,
        getSessionTokenFromPath: () => SESSION_SLUG,
        getDisplaySessionCfg: () => ({ __registry: { registryChainId: 11155420 } }),
        isSbtListRoutePath: () => false,
      } as unknown as AppShell);
      controller.handleBootstrapResolved({
        config: { slug: SESSION_SLUG, sessionModeProfile: profile },
        configRevision: 'revision-1',
        sessionId: '0x00112233445566778899aabbccddeeff',
        sessionSlug: SESSION_SLUG,
        workerOrigin: FIRST_ORIGIN,
      });
      expect(policy.shouldSkipSessionScanForSlug(SESSION_SLUG, 'sbt', ALL_SCOPE)).toBe(false);
      for (const query of [
        `worker=${encodeURIComponent(SECOND_ORIGIN)}`,
        'worker=',
        'worker=https%3A%2F%2Fsecret%40worker.example.com',
        `worker=${encodeURIComponent(FIRST_ORIGIN)}&worker=${encodeURIComponent(SECOND_ORIGIN)}`,
      ]) {
        window.history.replaceState({}, '', `${path}?${query}`);
        expect(policy.shouldSkipSessionScanForSlug(SESSION_SLUG, 'sbt', ALL_SCOPE)).toBe(true);
      }
    },
  );

  it('uses only the active origin-and-slug config when deciding whether SBT scans are allowed', () => {
    const controller = createWorkerCanonicalRouteController({
      getCurrentPathname: () => `/session/${SESSION_SLUG}`,
      getSessionTokenFromPath: () => SESSION_SLUG,
      setState: jest.fn(),
    } as any);
    const pureWorkerProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    const workerSbtProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
    workerSbtProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
    workerSbtProfile.evm.registryChainId = 11155420;
    workerSbtProfile.encryption.accessConditions = {
      match: 'any',
      conditions: [
        {
          kind: 'sbt_onchain',
          chainId: 11155420,
          contract: '0x1111111111111111111111111111111111111111',
          anyOrAll: 'any',
        },
      ],
    };

    controller.handleBootstrapResolved({
      config: { slug: SESSION_SLUG, sessionModeProfile: pureWorkerProfile },
      configRevision: 'revision-1',
      sessionId: '0x00112233445566778899aabbccddeeff',
      sessionSlug: SESSION_SLUG,
      workerOrigin: FIRST_ORIGIN,
    });
    controller.handleBootstrapResolved({
      config: { slug: SESSION_SLUG, sessionModeProfile: workerSbtProfile },
      configRevision: 'revision-2',
      sessionId: '0xffeeddccbbaa99887766554433221100',
      sessionSlug: SESSION_SLUG,
      workerOrigin: SECOND_ORIGIN,
    });

    const policy = createMainSiteSessionScanPolicy({
      _routeRenderers: { workerCanonicalRoutes: controller },
      getActiveSessionSlug: () => SESSION_SLUG,
      getCurrentPathname: () => `/session/${SESSION_SLUG}`,
      getSessionSlugHintFromSearch: () => null,
      getSessionTokenFromPath: () => SESSION_SLUG,
      getDisplaySessionCfg: () => ({
        __registry: {
          registryChainId: 11155420,
          sessionIdHex: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      }),
      isSbtListRoutePath: () => false,
    } as any);

    window.history.replaceState({}, '', `/session/${SESSION_SLUG}?worker=${encodeURIComponent(SECOND_ORIGIN)}`);
    expect(policy.shouldSkipSessionScanForSlug(SESSION_SLUG, 'sbt', ALL_SCOPE)).toBe(false);

    window.history.replaceState({}, '', `/session/${SESSION_SLUG}?worker=${encodeURIComponent(FIRST_ORIGIN)}`);
    expect(policy.shouldSkipSessionScanForSlug(SESSION_SLUG, 'sbt', ALL_SCOPE)).toBe(true);
  });
});
