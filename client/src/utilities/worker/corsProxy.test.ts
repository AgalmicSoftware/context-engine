import { CLOUDFLARE_CORS_WORKER_URL } from '../../variables/appConfig.js';
import demoSessions from '../../variables/demo/demo_sessions.json';
import { resolveCorsProxyUrl } from './corsProxy.js';
import { upsertCachedSessionWorkerConfig } from '../session/sessionWorkerConfigCache.js';

describe('corsProxy fallback policy', () => {
  const expectedSharedFallbackWorkerUrl = CLOUDFLARE_CORS_WORKER_URL.replace(/\/+$/, '');

  beforeEach(() => {
    try {
      localStorage.removeItem('dg:sessionRegistryCache:v1');
    } catch (_) {}
    try {
      localStorage.removeItem('ce:sessionWorkerConfigCache:v1');
    } catch (_) {}
  });

  it('uses shared fallback for general session when no worker URL is configured', async () => {
    const resolved = await resolveCorsProxyUrl({
      sessionSlug: '',
      sessionConfig: { slug: '', corsWorkerUrl: '' },
    });

    expect(CLOUDFLARE_CORS_WORKER_URL).toBeTruthy();
    expect(resolved.status).toBe('fallback');
    expect(resolved.source).toBe('default');
    expect(resolved.url).toBe(expectedSharedFallbackWorkerUrl);
  });

  it('treats "general" alias as default session for shared fallback', async () => {
    const resolved = await resolveCorsProxyUrl({
      sessionSlug: 'general',
      sessionConfig: { slug: 'general', corsWorkerUrl: '' },
    });

    expect(resolved.status).toBe('fallback');
    expect(resolved.source).toBe('default');
    expect(resolved.url).toBe(expectedSharedFallbackWorkerUrl);
  });

  it('treats canonicalized general aliases as the default session for shared fallback', async () => {
    const resolved = await resolveCorsProxyUrl({
      sessionSlug: ' GeNeRal!!! ',
      sessionConfig: { slug: ' GeNeRal!!! ', corsWorkerUrl: '' },
    });

    expect(resolved.status).toBe('fallback');
    expect(resolved.source).toBe('default');
    expect(resolved.url).toBe(expectedSharedFallbackWorkerUrl);
  });

  it('injects the appConfig fallback worker for the default session when configured', async () => {
    const resolved = await resolveCorsProxyUrl({
      sessionSlug: '',
    });

    expect(resolved.status).toBe('fallback');
    expect(resolved.source).toBe('default');
    expect(resolved.url).toBe(expectedSharedFallbackWorkerUrl);
  });

  it('uses the shared fallback for demoSessions.general when no session worker URL is configured', async () => {
    const resolved = await resolveCorsProxyUrl({
      sessionSlug: '',
      sessionConfig: demoSessions.general,
    });

    expect(resolved.status).toBe('fallback');
    expect(resolved.source).toBe('default');
    expect(resolved.url).toBe(expectedSharedFallbackWorkerUrl);
  });

  it('does not use local demo-1 fixture data as worker authority', async () => {
    const resolved = await resolveCorsProxyUrl({
      sessionSlug: 'demo-1',
      sessionConfig: demoSessions['demo-1'],
    });

    expect(resolved.status).toBe('missing');
    expect(resolved.url).toBe('');
  });

  it('suppresses shared fallback for non-general slugs with missing worker URL', async () => {
    const resolved = await resolveCorsProxyUrl({
      sessionSlug: 'test-3',
      sessionConfig: { slug: 'test-3', corsWorkerUrl: '' },
    });

    expect(resolved.status).toBe('missing');
    expect(resolved.url).toBe('');
  });

  it('prefers cached worker-config replicas over an older registry compatibility mirror', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-kv-cache.example',
      },
    });
    nowSpy.mockRestore();

    const resolved = await resolveCorsProxyUrl({
      sessionSlug: 'edge',
      sessionConfig: {
        slug: 'edge',
        corsWorkerUrl: 'https://registry-mirror.example',
        __registry: {
          updatedAt: 1699999999,
        },
      },
    });

    expect(resolved.status).toBe('plain');
    expect(resolved.source).toBe('worker-config-cache');
    expect(resolved.url).toBe('https://worker-kv-cache.example');
  });

  it('prefers the registry compatibility mirror when it is newer than the cached replica', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-kv-cache.example',
      },
    });
    nowSpy.mockRestore();

    const resolved = await resolveCorsProxyUrl({
      sessionSlug: 'edge',
      sessionConfig: {
        slug: 'edge',
        corsWorkerUrl: 'https://registry-mirror.example',
        __registry: {
          updatedAt: 1700000001,
        },
      },
    });

    expect(resolved.status).toBe('plain');
    expect(resolved.source).toBe('session');
    expect(resolved.url).toBe('https://registry-mirror.example');
  });

  it('accepts compatibility worker URL keys for plain session reads', async () => {
    const resolved = await resolveCorsProxyUrl({
      sessionSlug: 'edge',
      sessionConfig: { slug: 'edge', workerUrl: 'https://compat-worker.example/path/' },
    });

    expect(resolved.status).toBe('plain');
    expect(resolved.source).toBe('session');
    expect(resolved.url).toBe('https://compat-worker.example/path');
  });

  it('requires explicit demo fallback to resolve non-general demo session config in on-chain mode', async () => {
    const withoutDemoFallback = await resolveCorsProxyUrl({
      sessionSlug: 'edge',
      allowDemoFallback: false,
    });
    const withDemoFallback = await resolveCorsProxyUrl({
      sessionSlug: 'edge',
      allowDemoFallback: true,
    });

    expect(withoutDemoFallback.session).toBeNull();
    expect(withoutDemoFallback.status).toBe('missing');
    expect(withDemoFallback.session).toBeNull();
    expect(withDemoFallback.status).toBe('missing');
  });
});
