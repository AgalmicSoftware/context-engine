import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../utilities/session/sessionModeProfile';
import { createMainSiteSessionScanPolicy } from './mainSiteSessionScanPolicyBinding';
import { createWorkerCanonicalRouteController } from './workerCanonicalRouteController';

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
