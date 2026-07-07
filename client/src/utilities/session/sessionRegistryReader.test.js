import { readRegistryCache, getRegistrySessionConfig } from './sessionRegistryReader.js';
import { upsertCachedSessionWorkerConfig } from './sessionWorkerConfigCache.js';

describe('sessionRegistryReader', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no cache exists', () => {
    expect(readRegistryCache()).toBeNull();
    expect(getRegistrySessionConfig('alpha')).toBeNull();
  });

  it('reads and normalizes registry cache from localStorage', () => {
    const cache = {
      sessions: {
        alpha: { slug: 'alpha', sessionName: 'Alpha' },
      },
    };
    localStorage.setItem('dg:sessionRegistryCache:v1', JSON.stringify(cache));

    const result = readRegistryCache();
    expect(result.sessions.alpha.sessionName).toBe('Alpha');
    expect(result.groups.alpha.sessionName).toBe('Alpha');
  });

  it('resolves session config by slug', () => {
    const cache = {
      sessions: {
        alpha: { slug: 'alpha', sessionName: 'Alpha' },
        beta: { slug: 'beta', sessionName: 'Beta' },
      },
    };
    localStorage.setItem('dg:sessionRegistryCache:v1', JSON.stringify(cache));

    expect(getRegistrySessionConfig('alpha')).toEqual({ slug: 'alpha', sessionName: 'Alpha' });
    expect(getRegistrySessionConfig('beta')).toEqual({ slug: 'beta', sessionName: 'Beta' });
    expect(getRegistrySessionConfig('missing')).toBeNull();
  });

  it('normalizes general alias slugs before lookup', () => {
    const cache = {
      sessions: {
        '': { slug: '', sessionName: 'General' },
        alpha: { slug: 'alpha', sessionName: 'Alpha' },
      },
    };
    localStorage.setItem('dg:sessionRegistryCache:v1', JSON.stringify(cache));

    expect(getRegistrySessionConfig('general')).toEqual({ slug: '', sessionName: 'General' });
    expect(getRegistrySessionConfig(' alpha ')).toEqual({ slug: 'alpha', sessionName: 'Alpha' });
  });

  it('preserves exact non-alias slugs with punctuation when reading the cache', () => {
    const cache = {
      sessions: {
        'Alpha Team!': { slug: 'Alpha Team!', sessionName: 'Alpha Team' },
      },
    };
    localStorage.setItem('dg:sessionRegistryCache:v1', JSON.stringify(cache));

    expect(getRegistrySessionConfig(' Alpha Team! ')).toEqual({
      slug: 'Alpha Team!',
      sessionName: 'Alpha Team',
    });
    expect(getRegistrySessionConfig('alphateam')).toBeNull();
  });

  it('aliases groups to sessions when only groups key exists', () => {
    const cache = {
      groups: {
        gamma: { slug: 'gamma', sessionName: 'Gamma' },
      },
    };
    localStorage.setItem('dg:sessionRegistryCache:v1', JSON.stringify(cache));

    expect(getRegistrySessionConfig('gamma')).toEqual({ slug: 'gamma', sessionName: 'Gamma' });
  });

  it('overlays cached worker config onto registry session reads', () => {
    localStorage.setItem(
      'dg:sessionRegistryCache:v1',
      JSON.stringify({
        sessions: {
          edge: { slug: 'edge', sessionName: 'Edge', corsWorkerUrl: 'https://registry-mirror.example' },
        },
      }),
    );
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-kv-cache.example',
      },
    });

    expect(getRegistrySessionConfig('edge')).toEqual({
      slug: 'edge',
      sessionName: 'Edge',
      corsWorkerUrl: 'https://worker-kv-cache.example',
    });
  });

  it('returns null for corrupt cache data', () => {
    localStorage.setItem('dg:sessionRegistryCache:v1', 'not-json');
    expect(readRegistryCache()).toBeNull();
  });

  it('returns null when cache contains literal null string', () => {
    localStorage.setItem('dg:sessionRegistryCache:v1', 'null');
    expect(readRegistryCache()).toBeNull();
  });

  it('returns null when window is undefined (SSR guard)', () => {
    const origWindow = global.window;
    delete global.window;
    try {
      expect(readRegistryCache()).toBeNull();
      expect(getRegistrySessionConfig('alpha')).toBeNull();
    } finally {
      global.window = origWindow;
    }
  });
});
