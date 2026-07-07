import { getSessionAiSettings } from './aiSettings.js';

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';

describe('aiSettings session resolution', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('resolves canonical general alias as missing when no registry data exists in on-chain mode', () => {
    const resolved = getSessionAiSettings(' GeNeRal!!! ');

    expect(resolved._sessionSlug).toBe('');
    expect(resolved._sessionConfigSource).toBe('missing');
  });

  it('uses canonical general aliases with registry data for the default session', () => {
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          '': {
            slug: '',
            sessionName: 'Registry General',
          },
        },
      }),
    );

    const resolved = getSessionAiSettings(' GeNeRal!!! ');

    expect(resolved._sessionSlug).toBe('');
    expect(resolved._sessionName).toBe('Registry General');
    expect(resolved._sessionConfigSource).toBe('registry');
  });

  it('prefers registry cache for explicit non-general session slugs', () => {
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          rxc: {
            slug: 'rxc',
            sessionName: 'Registry RXC',
            ai: {
              mode: 'anthropic',
              models: {
                fast: 'claude-sonnet-4-6',
              },
              modelProviders: {
                fast: 'anthropic',
              },
            },
          },
        },
      }),
    );

    const resolved = getSessionAiSettings('rxc');

    expect(resolved._sessionSlug).toBe('rxc');
    expect(resolved._sessionName).toBe('Registry RXC');
    expect(resolved._sessionConfigSource).toBe('registry');
    expect(resolved.mode).toBe('anthropic');
    expect(resolved.models.fast).toBe('claude-sonnet-4-6');
    expect(resolved.modelProviders.fast).toBe('anthropic');
  });

  it('does not inherit the general session identity for unknown non-general slugs', () => {
    const resolved = getSessionAiSettings('missing-session-slug');

    expect(resolved._sessionSlug).toBe('missing-session-slug');
    expect(resolved._sessionName).toBe('');
    expect(resolved._sessionConfigSource).toBe('missing');
  });
});
