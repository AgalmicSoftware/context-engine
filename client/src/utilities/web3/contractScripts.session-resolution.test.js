import demoSessions from '../../variables/demo/demo_sessions.json';
import {
  getDefaultSessionConfig,
  getAllSessionEntries,
  getAllSessionSlugs,
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  normalizeSessionSlug,
} from './chainGateway.js';
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
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          rxc: {
            slug: 'rxc',
            sessionName: 'Registry RXC',
          },
        },
      }),
    );

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
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          '': {
            slug: '',
            sessionName: 'Registry General',
            sessionInfo: 'Registry Info',
            orgName: 'Legacy Group Name',
            orgInfo: 'Legacy Group Info',
          },
        },
      }),
    );

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

  it('allows explicit demo fallback while preserving the primary demo alias', () => {
    expect(getDemoSessionConfigBySlug(' GeNeRal!!! ', { allowDemoFallback: true })).toEqual(
      expect.objectContaining({
        slug: '',
        sessionName: 'Context Engine',
      }),
    );
    expect(getDemoSessionConfigBySlug('demo', { allowDemoFallback: true })).toEqual(
      expect.objectContaining({
        slug: 'demo-sh',
        sessionName: 'Demo Session',
        sessionModeProfile: expect.objectContaining({
          authority: { mode: 'worker_canonical' },
          evm: { registryChainId: null },
        }),
      }),
    );
    expect(getDemoSessionConfigBySlug('DEBATE', { allowDemoFallback: true })).toBeNull();
  });

  it('exposes demo-1 through explicit demo fallback without weakening strict registry lookup', () => {
    expect(getSessionConfigBySlug('demo-1')).toBeNull();
    expect(getSessionConfigBySlugOrDefault('demo-1')).toBeNull();
    expect(getDemoSessionConfigBySlug('demo-1', { allowDemoFallback: true })).toEqual(
      expect.objectContaining({
        slug: 'demo-1',
        networkChainId: 11155420,
        blockLimits: expect.objectContaining({ start: 44967477 }),
        contracts: expect.objectContaining({
          surveys: expect.objectContaining({
            address: '0x59664B9dA510a33F2edB7E14Cf0c2749bf506B8A',
          }),
        }),
        defaultFeaturedSBTs: expect.arrayContaining([
          '0x29563ff3aCC8AFb220D810F8022218095e25C1f6',
          '0x5d2f0207B7EB26e807C4a12f2A185928558C00b9',
          '0xeAe3498C31302B421E19Cf30A3e87E814ae5C955',
        ]),
      }),
    );
  });

  it('does not silently demo-fallback non-general shared getters in on-chain mode', () => {
    expect(getSessionConfigBySlug('edge')).toBeNull();
    expect(getSessionConfigBySlugOrDefault('edge')).toBeNull();
  });

  it('overlays cached worker config onto shared session-config getters', () => {
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          edge: {
            slug: 'edge',
            sessionName: 'Registry Edge',
            corsWorkerUrl: 'https://registry-mirror.example',
          },
        },
      }),
    );
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

    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          edge: { slug: 'edge', sessionName: 'Edge' },
        },
      }),
    );

    expect(getAllSessionSlugs()).toEqual(['edge']);
    expect(getAllSessionSlugs({ includeEmpty: false })).toEqual(['edge']);
  });

  it('getAllSessionEntries returns registry entries when registry cache is populated', () => {
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          '': { slug: '', sessionName: 'General' },
          edge: { slug: 'edge', sessionName: 'Edge' },
        },
      }),
    );

    const entries = getAllSessionEntries();
    expect(entries.length).toBe(2);
    expect(entries.find(([k]) => k === '')).toBeTruthy();
    expect(entries.find(([k]) => k === 'edge')).toBeTruthy();
  });

  it('getAllSessionSlugs still includes the general session when it exists authoritatively', () => {
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          '': { slug: '', sessionName: 'General' },
          edge: { slug: 'edge', sessionName: 'Edge' },
        },
      }),
    );

    expect(getAllSessionSlugs()).toEqual(['', 'edge']);
    expect(getAllSessionSlugs({ includeEmpty: false })).toEqual(['edge']);
  });
});
