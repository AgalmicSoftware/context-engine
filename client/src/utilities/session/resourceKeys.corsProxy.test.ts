import { getEffectiveFaucetConfig, getLocalResourceKeys, saveLocalResourceKeys } from './resourceKeys.js';

describe('resourceKeys session fallback policy', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not inherit the general session faucet config for unknown non-general slugs', async () => {
    const resolved = await getEffectiveFaucetConfig({
      sessionSlug: 'missing-session-slug',
    });

    expect(resolved.rpcUrl).toBe('');
    expect(resolved.amountEth).toBe('');
    expect(resolved.balanceThresholdEth).toBe('');
  });

  it('keeps the general session faucet config empty in the oss demo seed', async () => {
    const resolved = await getEffectiveFaucetConfig({
      sessionSlug: '',
    });

    expect(resolved.amountEth).toBe('');
    expect(resolved.balanceThresholdEth).toBe('');
  });

  it('treats canonicalized general aliases as the default session', async () => {
    const resolved = await getEffectiveFaucetConfig({
      sessionSlug: ' GeNeRal!!! ',
    });

    expect(resolved.amountEth).toBe('');
    expect(resolved.balanceThresholdEth).toBe('');
  });

  it('preserves exact non-alias session slugs in local resource key storage', () => {
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
  });

  it('skips reserved local-storage session keys instead of collapsing them into the general session', () => {
    localStorage.setItem(
      'ce:resourceKeys:v1',
      '{"bySession":{"":{"rpc":{"useLocal":true,"apiKey":"general-key"}},"__proto__":{"rpc":{"useLocal":true,"apiKey":"proto-key"}},"constructor":{"rpc":{"useLocal":true,"apiKey":"constructor-key"}},"prototype":{"rpc":{"useLocal":true,"apiKey":"prototype-key"}},"alpha":{"rpc":{"useLocal":true,"apiKey":"alpha-key"}}}}',
    );

    const general = getLocalResourceKeys('');
    const alpha = getLocalResourceKeys('alpha');

    expect(general.rpc.useLocal).toBe(true);
    expect(general.rpc.apiKey).toBe('general-key');
    expect(alpha.rpc.useLocal).toBe(true);
    expect(alpha.rpc.apiKey).toBe('alpha-key');
  });
});
