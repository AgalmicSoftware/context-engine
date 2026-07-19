import {
  defaultCorsProxyAllowDemoFallback,
  defaultStrictAllowDemoFallback,
  defaultWorkerAuthAllowDemoFallback,
  resolveWorkerAllowDemoFallback,
  resolveWorkerSessionConfigBySlug,
  resolveWorkerSessionContext,
} from './workerSessionResolution.js';
import {
  markWorkerCanonicalSessionBootstrapVerified,
  upsertWorkerCanonicalSessionBootstrap,
} from '../session/sessionWorkerConfigCache.js';

const mockGetState = jest.fn();
const mockGetRegistrySessionConfig = jest.fn();

jest.mock('../../store.js', () => ({
  __esModule: true,
  default: {
    getState: (...args: unknown[]) => mockGetState(...args),
  },
}));

jest.mock('../../variables/appConfig.js', () => ({
  USE_ONCHAIN_SESSION_REGISTRY: true,
}));

jest.mock('../session/sessionRegistryReader.js', () => ({
  getRegistrySessionConfig: (...args: unknown[]) => mockGetRegistrySessionConfig(...args),
}));

jest.mock('../../variables/demo/demo_sessions.json', () => ({
  general: {
    slug: '',
    sessionName: 'Context Engine',
    corsWorkerUrl: 'https://demo-general.example',
  },
  edge: {
    slug: 'edge',
    sessionName: 'Edge Session',
    corsWorkerUrl: 'https://demo-edge.example',
  },
}));

describe('workerSessionResolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockReturnValue({
      sessionState: {
        activeSessionSlug: 'edge',
      },
    });
    mockGetRegistrySessionConfig.mockReturnValue(null);
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('lets explicit allowDemoFallback override the injected default policy', () => {
    expect(
      resolveWorkerAllowDemoFallback({
        sessionSlug: 'edge',
        allowDemoFallback: true,
        getDefaultAllowDemoFallback: () => false,
      }),
    ).toBe(true);

    expect(
      resolveWorkerAllowDemoFallback({
        sessionSlug: 'edge',
        allowDemoFallback: false,
        getDefaultAllowDemoFallback: () => true,
      }),
    ).toBe(false);
  });

  it('uses the injected default fallback policy when no explicit boolean is provided', () => {
    expect(
      resolveWorkerAllowDemoFallback({
        sessionSlug: 'edge',
        getDefaultAllowDemoFallback: (slug) => slug === 'edge',
      }),
    ).toBe(true);

    expect(
      resolveWorkerAllowDemoFallback({
        sessionSlug: 'general',
        getDefaultAllowDemoFallback: () => false,
      }),
    ).toBe(false);
  });

  it('defaults to mode-aware demo fallback when no policy is provided', () => {
    expect(resolveWorkerAllowDemoFallback({})).toBe(false);
    expect(resolveWorkerAllowDemoFallback()).toBe(false);
    expect(resolveWorkerAllowDemoFallback({ sessionSlug: 'edge' })).toBe(false);
    expect(resolveWorkerAllowDemoFallback({ sessionSlug: '' })).toBe(false);
  });

  it('keeps auth and cors proxy defaults fail-closed in on-chain mode', () => {
    expect(defaultWorkerAuthAllowDemoFallback()).toBe(false);
    expect(defaultStrictAllowDemoFallback()).toBe(false);
    expect(defaultCorsProxyAllowDemoFallback('edge')).toBe(false);
    expect(defaultCorsProxyAllowDemoFallback('general')).toBe(false);
    expect(defaultCorsProxyAllowDemoFallback('')).toBe(false);
  });

  it('keeps the strict shared fallback policy aligned with worker auth defaults', () => {
    expect(defaultStrictAllowDemoFallback()).toBe(defaultWorkerAuthAllowDemoFallback());
  });

  it('resolves worker session config by slug through the shared registry/demo wrapper', () => {
    mockGetRegistrySessionConfig.mockImplementation((slug) =>
      slug === 'edge'
        ? { slug: 'edge', sessionName: 'Registry Edge', corsWorkerUrl: 'https://registry-edge.example' }
        : null,
    );

    expect(
      resolveWorkerSessionConfigBySlug({
        sessionSlug: 'edge',
        getDefaultAllowDemoFallback: () => false,
      }),
    ).toEqual({
      slug: 'edge',
      sessionName: 'Registry Edge',
      corsWorkerUrl: 'https://registry-edge.example',
    });

    expect(
      resolveWorkerSessionConfigBySlug({
        sessionSlug: 'missing',
        getDefaultAllowDemoFallback: () => false,
      }),
    ).toBeNull();

    expect(
      resolveWorkerSessionConfigBySlug({
        sessionSlug: 'edge',
        getDefaultAllowDemoFallback: () => true,
        allowDemoFallback: true,
      }),
    ).toEqual({
      slug: 'edge',
      sessionName: 'Registry Edge',
      corsWorkerUrl: 'https://registry-edge.example',
    });
  });

  it('resolves a currently verified worker-canonical login target without registry identity', () => {
    const workerOrigin = 'https://worker-login.example.com';
    const sessionId = '0xaabbccddeeff00112233445566778899';
    const config = {
      slug: 'worker-login',
      sessionId,
      corsWorkerUrl: workerOrigin,
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    };
    upsertWorkerCanonicalSessionBootstrap({
      slug: config.slug,
      sessionIdHex: sessionId,
      workerOrigin,
      config,
    });
    expect(
      markWorkerCanonicalSessionBootstrapVerified({ slug: config.slug, sessionIdHex: sessionId, workerOrigin }),
    ).toBe(true);
    window.history.replaceState({}, '', `/session/worker-login?worker=${encodeURIComponent(workerOrigin)}`);

    expect(resolveWorkerSessionConfigBySlug({ sessionSlug: 'worker-login' })).toEqual(config);
    expect(resolveWorkerSessionContext()).toEqual(
      expect.objectContaining({
        sessionSlug: 'worker-login',
        sessionConfig: config,
        sessionConfigSource: 'resolved',
      }),
    );
    expect(mockGetRegistrySessionConfig).not.toHaveBeenCalled();
  });

  it('does not use registry fallback for an unverified or invalid explicit worker target', () => {
    mockGetRegistrySessionConfig.mockReturnValue({
      slug: 'worker-login',
      corsWorkerUrl: 'https://registry-worker.example.com',
    });
    window.history.replaceState({}, '', '/session/worker-login?worker=https%3A%2F%2Funverified-worker.example.com');
    expect(resolveWorkerSessionConfigBySlug({ sessionSlug: 'worker-login' })).toBeNull();

    window.history.replaceState(
      {},
      '',
      '/session/worker-login?worker=https%3A%2F%2Ffirst.example.com&worker=https%3A%2F%2Fsecond.example.com',
    );
    expect(resolveWorkerSessionConfigBySlug({ sessionSlug: 'worker-login' })).toBeNull();
    expect(mockGetRegistrySessionConfig).not.toHaveBeenCalled();
  });

  it('resolves worker session context from the active store slug when no explicit slug is provided', () => {
    mockGetRegistrySessionConfig.mockImplementation((slug) =>
      slug === 'edge'
        ? { slug: 'edge', sessionName: 'Registry Edge', corsWorkerUrl: 'https://registry-edge.example' }
        : null,
    );

    expect(
      resolveWorkerSessionContext({
        getDefaultAllowDemoFallback: () => false,
      }),
    ).toEqual(
      expect.objectContaining({
        hasExplicitSessionSlug: false,
        sessionSlug: 'edge',
        sessionConfig: {
          slug: 'edge',
          sessionName: 'Registry Edge',
          corsWorkerUrl: 'https://registry-edge.example',
        },
        sessionConfigSource: 'resolved',
      }),
    );
  });

  it('resolves the default/general session through the shared scaffold when the active store slug is empty', () => {
    mockGetState.mockReturnValue({
      sessionState: {
        activeSessionSlug: '',
      },
    });

    expect(
      resolveWorkerSessionContext({
        getDefaultAllowDemoFallback: () => true,
      }),
    ).toEqual(
      expect.objectContaining({
        hasExplicitSessionSlug: false,
        sessionSlug: '',
        sessionConfig: {
          slug: '',
          sessionName: 'Context Engine',
          corsWorkerUrl: 'https://demo-general.example',
        },
        sessionConfigSource: 'resolved',
      }),
    );
  });

  it('preserves provided session config while still canonicalizing the requested slug alias', () => {
    const provided = {
      slug: 'general',
      sessionName: 'Provided General',
      corsWorkerUrl: 'https://provided.example',
    };

    expect(
      resolveWorkerSessionContext({
        sessionSlug: ' GeNeRal!!! ',
        sessionConfig: provided,
        getDefaultAllowDemoFallback: () => false,
      }),
    ).toEqual(
      expect.objectContaining({
        hasExplicitSessionSlug: true,
        sessionSlug: '',
        sessionConfig: provided,
        sessionConfigSource: 'provided',
      }),
    );
  });
});
