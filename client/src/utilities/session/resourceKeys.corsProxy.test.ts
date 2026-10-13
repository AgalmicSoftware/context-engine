import { getEffectiveArweaveKey, getLocalResourceKeys, saveLocalResourceKeys } from './resourceKeys.js';

describe('resourceKeys session fallback policy', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('does not inherit the general session config for unknown non-general slugs', async () => {
    const resolved = await getEffectiveArweaveKey({
      sessionSlug: 'missing-session-slug',
    });

    expect(resolved.sessionConfigSource).toBe('missing');
    expect(resolved.arweaveJwk).toBe('');
  });

  it('treats canonicalized general aliases as the default session', async () => {
    const general = await getEffectiveArweaveKey({ sessionSlug: '' });
    const alias = await getEffectiveArweaveKey({ sessionSlug: ' GeNeRal!!! ' });

    expect(general.sessionConfigSource).not.toBe('missing');
    expect(alias.sessionConfigSource).toBe(general.sessionConfigSource);
  });

  it('preserves exact non-alias session slugs in in-memory resource-key state', () => {
    saveLocalResourceKeys(' Team A! ', {
      rpc: {
        useLocal: true,
        apiKey: 'secret-key',
      },
    });

    const exact = getLocalResourceKeys('Team A!');
    const collapsed = getLocalResourceKeys('teama');

    expect(exact.rpc.useLocal).toBe(true);
    expect(exact.rpc.apiKey).toBe('secret-key');
    expect(collapsed.rpc.useLocal).toBe(false);
    expect(collapsed.rpc.apiKey).toBe('');
    expect(localStorage.getItem('ce:resourceKeys:v1')).toBeNull();
  });

  it('purges legacy browser-storage keys without importing their secrets into memory', () => {
    localStorage.setItem(
      'ce:resourceKeys:v1',
      '{"bySession":{"legacy":{"rpc":{"useLocal":true,"apiKey":"legacy-secret"}}}}',
    );
    sessionStorage.setItem(
      'ce:resourceKeys:v1',
      '{"bySession":{"legacy":{"rpc":{"useLocal":true,"apiKey":"legacy-session-secret"}}}}',
    );

    const legacy = getLocalResourceKeys('legacy');

    expect(legacy.rpc.useLocal).toBe(false);
    expect(legacy.rpc.apiKey).toBe('');
    expect(localStorage.getItem('ce:resourceKeys:v1')).toBeNull();
    expect(sessionStorage.getItem('ce:resourceKeys:v1')).toBeNull();
  });
});
