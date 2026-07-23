import { CLOUDFLARE_CORS_WORKER_URL } from '../../variables/appConfig.js';
import demoSessions from '../../variables/demo/demo_sessions.json';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from './sessionModeProfile.js';
import { upsertCachedSessionWorkerConfig } from './sessionWorkerConfigCache.js';
import {
  getConfiguredSessionWorkerUrlFromConfig,
  getSharedFallbackWorkerUrl,
  getUsableSessionWorkerUrl,
  hasUsableSessionWorkerConfig,
  shouldUseSharedFallbackWorkerUrl,
} from './sessionWorkerAvailability.js';

describe('sessionWorkerAvailability', () => {
  const expectedSharedFallbackWorkerUrl = CLOUDFLARE_CORS_WORKER_URL.replace(/\/+$/, '');

  beforeEach(() => {
    localStorage.clear();
  });

  it('treats the default/general session as worker-backed when a shared fallback is configured', () => {
    expect(hasUsableSessionWorkerConfig({ slug: '' })).toBe(true);
    expect(hasUsableSessionWorkerConfig({ slug: 'general' })).toBe(true);
  });

  it('exposes the configured shared fallback worker URL by default', () => {
    expect(CLOUDFLARE_CORS_WORKER_URL).toBeTruthy();
    expect(getSharedFallbackWorkerUrl()).toBe(expectedSharedFallbackWorkerUrl);
  });

  it('returns the shared fallback URL for the default/general session when fallback is allowed', () => {
    expect(
      getUsableSessionWorkerUrl({
        slug: '',
        sessionConfig: { slug: '', corsWorkerUrl: '' },
        allowSharedFallback: true,
      }),
    ).toBe(expectedSharedFallbackWorkerUrl);
    expect(
      getUsableSessionWorkerUrl({
        slug: 'general',
        sessionConfig: { slug: 'general', corsWorkerUrl: '' },
        allowSharedFallback: true,
      }),
    ).toBe(expectedSharedFallbackWorkerUrl);
  });

  it('still returns no shared fallback URL for the default/general session when fallback is disabled', () => {
    expect(
      getUsableSessionWorkerUrl({
        slug: '',
        sessionConfig: { slug: '', corsWorkerUrl: '' },
        allowSharedFallback: false,
      }),
    ).toBe('');
    expect(
      getUsableSessionWorkerUrl({
        slug: 'general',
        sessionConfig: { slug: 'general', corsWorkerUrl: '' },
        allowSharedFallback: false,
      }),
    ).toBe('');
  });

  it('treats general-session configs as authoritative when they provide an explicit worker URL', () => {
    const sessionConfig = {
      ...demoSessions.general,
      corsWorkerUrl: 'https://demo-general.example',
    };

    expect(
      shouldUseSharedFallbackWorkerUrl({
        slug: '',
        sessionConfig,
      }),
    ).toBe(false);
    expect(
      getUsableSessionWorkerUrl({
        slug: '',
        sessionConfig,
        allowSharedFallback: true,
      }),
    ).toBe(sessionConfig.corsWorkerUrl);
    expect(
      getUsableSessionWorkerUrl({
        slug: '',
        sessionConfig,
        allowSharedFallback: false,
      }),
    ).toBe(sessionConfig.corsWorkerUrl);
  });

  it('treats cloned general-session configs as authoritative when they provide an explicit worker URL', () => {
    const demoGeneralWithWorkerUrl = {
      ...demoSessions.general,
      corsWorkerUrl: 'https://demo-general.example',
    };
    const clonedDemoGeneral = { ...demoGeneralWithWorkerUrl };

    expect(
      shouldUseSharedFallbackWorkerUrl({
        slug: 'general',
        sessionConfig: demoGeneralWithWorkerUrl,
      }),
    ).toBe(false);
    expect(
      shouldUseSharedFallbackWorkerUrl({
        slug: 'general',
        sessionConfig: clonedDemoGeneral,
      }),
    ).toBe(false);

    const usableWorkerUrl = getUsableSessionWorkerUrl({
      slug: 'general',
      sessionConfig: clonedDemoGeneral,
      allowSharedFallback: true,
    });

    expect(usableWorkerUrl).toBe(demoGeneralWithWorkerUrl.corsWorkerUrl);
  });

  it('does not suppress explicit general-session worker URLs that lack registry metadata', () => {
    const sessionConfig = {
      slug: 'general',
      corsWorkerUrl: 'https://custom.example',
    };

    expect(
      shouldUseSharedFallbackWorkerUrl({
        slug: 'general',
        sessionConfig,
      }),
    ).toBe(false);
    expect(
      getUsableSessionWorkerUrl({
        slug: 'general',
        sessionConfig,
        allowSharedFallback: true,
      }),
    ).toBe('https://custom.example');
  });

  it('reads compatibility worker URL keys from session config objects', () => {
    expect(
      getConfiguredSessionWorkerUrlFromConfig({
        workerUrl: 'https://compat-worker.example/path/',
      }),
    ).toBe('https://compat-worker.example/path');
    expect(
      getConfiguredSessionWorkerUrlFromConfig({
        sessionWorkerUrl: 'https://session-worker.example',
      }),
    ).toBe('https://session-worker.example');
  });

  it('uses the cached worker-config replica when the session config mirror is stale', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-kv-cache.example',
      },
    });
    nowSpy.mockRestore();

    expect(
      hasUsableSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: '',
          __registry: {
            updatedAt: 1699999999,
          },
        },
      }),
    ).toBe(true);
  });

  it('returns the cached worker-config URL when the session config mirror is stale', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-kv-cache.example',
      },
    });
    nowSpy.mockRestore();

    expect(
      getUsableSessionWorkerUrl({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: '',
          __registry: {
            updatedAt: 1699999999,
          },
        },
        allowSharedFallback: true,
      }),
    ).toBe('https://worker-kv-cache.example');
  });

  it('prefers the registry mirror when it is newer than the cached worker-config replica', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-kv-cache.example',
      },
    });
    nowSpy.mockRestore();

    expect(
      getUsableSessionWorkerUrl({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: 'https://registry-mirror.example',
          __registry: {
            updatedAt: 1700000001,
          },
        },
        allowSharedFallback: true,
      }),
    ).toBe('https://registry-mirror.example');
  });

  it('still prefers the cached worker-config replica over the shared fallback for the default session', () => {
    upsertCachedSessionWorkerConfig({
      slug: '',
      config: {
        corsWorkerUrl: 'https://worker-kv-cache.example',
      },
    });

    expect(
      getUsableSessionWorkerUrl({
        slug: '',
        sessionConfig: demoSessions.general,
        allowSharedFallback: true,
      }),
    ).toBe('https://worker-kv-cache.example');
  });

  it('fails closed for non-general sessions with no usable worker config', () => {
    expect(
      hasUsableSessionWorkerConfig({
        slug: 'edge',
        sessionConfig: {
          slug: 'edge',
          corsWorkerUrl: '',
        },
      }),
    ).toBe(false);
  });

  it('resolves an exact Worker target only for a matching slug and validated Worker profile', () => {
    const exactConfig = {
      ...demoSessions['demo-sh'],
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    };
    expect(
      getUsableSessionWorkerUrl({
        slug: 'demo-sh',
        sessionConfig: exactConfig,
        requireExactWorkerSession: true,
      }),
    ).toBe(exactConfig.corsWorkerUrl.replace(/\/+$/, ''));

    expect(
      getUsableSessionWorkerUrl({
        slug: 'other-session',
        sessionConfig: exactConfig,
        requireExactWorkerSession: true,
      }),
    ).toBe('');

    expect(
      getUsableSessionWorkerUrl({
        slug: 'demo-sh',
        sessionConfig: {
          ...exactConfig,
          sessionModeProfile: { authority: { mode: 'worker_canonical' } },
        },
        requireExactWorkerSession: true,
      }),
    ).toBe('');
  });
});
