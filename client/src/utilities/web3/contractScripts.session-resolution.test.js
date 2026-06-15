import demoSessions from '../../variables/demo/demo_sessions.json';
import {
  getDefaultSessionConfig,
  getAllSessionEntries,
  getAllSessionSlugs,
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from './contractScripts.js';
import { upsertCachedSessionWorkerConfig } from '../session/sessionWorkerConfigCache.js';

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';

describe('contractScripts session resolution helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('delegates normalizeSessionSlug to the canonical slug rules', () => {
    expect(normalizeSessionSlug('Team A!')).toBe('Team A!');
    expect(normalizeSessionSlug('General')).toBe('');
    expect(normalizeSessionSlug('DEBATE')).toBe('DEBATE');
  });

  it('prefers registry cache for explicit session slugs', () => {
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({
      sessions: {
        rxc: {
          slug: 'rxc',
          sessionName: 'Registry RXC',
        },
      },
    }));

    expect(getSessionConfigBySlug('rxc')).toEqual({
      slug: 'rxc',
      sessionName: 'Registry RXC',
    });
  });

  it('does not inherit demo config for unknown non-general slugs in on-chain mode', () => {
    expect(getSessionConfigBySlug('missing-session-slug')).toBeNull();
    expect(getDemoSessionConfigBySlug('missing-session-slug')).toBeNull();
    expect(getSessionConfigBySlugOrDefault('missing-session-slug')).toBeNull();
  });

  it('normalizes registry-backed default session naming without mutating legacy fields into authority', () => {
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({
      sessions: {
        '': {
          slug: '',
          sessionName: 'Registry General',
          sessionInfo: 'Registry Info',
          orgName: 'Legacy Group Name',
          orgInfo: 'Legacy Group Info',
        },
      },
    }));

    const resolved = getDefaultSessionConfig();

    expect(resolved).toEqual({
      slug: '',
      sessionName: 'Registry General',
      sessionInfo: 'Registry Info',
    });
    expect(resolved.orgName).toBeUndefined();
    expect(resolved.orgInfo).toBeUndefined();
    expect(getSessionConfigBySlugOrDefault('')).toEqual(getDefaultSessionConfig());
    expect(getSessionConfigBySlugOrDefault('general')).toEqual(getDefaultSessionConfig());
  });

  it('keeps demo-only helper defaults fail-closed in on-chain mode', () => {
    expect(demoSessions.general.slug).toBe('');
    expect(getDemoSessionConfigBySlug(' GeNeRal!!! ')).toBeNull();
    expect(getDemoSessionConfigBySlug('demo')).toBeNull();
    expect(getDemoSessionConfigBySlug('DEBATE')).toBeNull();
  });

  it('still allows explicit demo fallback for compatibility readers that opt in', () => {
    expect(getDemoSessionConfigBySlug(' GeNeRal!!! ', { allowDemoFallback: true })).toEqual(
      expect.objectContaining({
        slug: '',
        sessionName: 'Context Engine',
      })
    );
    expect(getDemoSessionConfigBySlug('demo', { allowDemoFallback: true })).toEqual(
      expect.objectContaining({
        slug: '',
        sessionName: 'Context Engine',
      })
    );
    expect(getDemoSessionConfigBySlug('DEBATE', { allowDemoFallback: true })).toBeNull();
  });

  it('does not silently demo-fallback non-general shared getters in on-chain mode', () => {
    expect(getSessionConfigBySlug('edge')).toBeNull();
    expect(getSessionConfigBySlugOrDefault('edge')).toBeNull();
  });

  it('overlays cached worker config onto shared session-config getters', () => {
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({
      sessions: {
        edge: {
          slug: 'edge',
          sessionName: 'Registry Edge',
          corsWorkerUrl: 'https://registry-mirror.example',
        },
      },
    }));
    upsertCachedSessionWorkerConfig({
      slug: 'edge',
      config: {
        corsWorkerUrl: 'https://worker-kv-cache.example',
      },
    });

    expect(getSessionConfigBySlug('edge')).toEqual({
      slug: 'edge',
      sessionName: 'Registry Edge',
      corsWorkerUrl: 'https://worker-kv-cache.example',
    });
  });

  it('getAllSessionEntries returns empty array when registry cache is empty in on-chain mode', () => {
    // No registry cache populated — on-chain mode should not fall back to demoSessions.
    const entries = getAllSessionEntries();
    expect(entries).toEqual([]);
  });

  it('getAllSessionSlugs does not auto-inject the general session when no authoritative empty slug exists', () => {
    expect(getAllSessionSlugs()).toEqual([]);
    expect(getAllSessionSlugs({ includeEmpty: false })).toEqual([]);

    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({
      sessions: {
        edge: { slug: 'edge', sessionName: 'Edge' },
      },
    }));

    expect(getAllSessionSlugs()).toEqual(['edge']);
    expect(getAllSessionSlugs({ includeEmpty: false })).toEqual(['edge']);
  });

  it('getAllSessionEntries returns registry entries when registry cache is populated', () => {
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({
      sessions: {
        '': { slug: '', sessionName: 'General' },
        edge: { slug: 'edge', sessionName: 'Edge' },
      },
    }));

    const entries = getAllSessionEntries();
    expect(entries.length).toBe(2);
    expect(entries.find(([k]) => k === '')).toBeTruthy();
    expect(entries.find(([k]) => k === 'edge')).toBeTruthy();
  });

  it('getAllSessionSlugs still includes the general session when it exists authoritatively', () => {
    localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify({
      sessions: {
        '': { slug: '', sessionName: 'General' },
        edge: { slug: 'edge', sessionName: 'Edge' },
      },
    }));

    expect(getAllSessionSlugs()).toEqual(['', 'edge']);
    expect(getAllSessionSlugs({ includeEmpty: false })).toEqual(['edge']);
  });
});
