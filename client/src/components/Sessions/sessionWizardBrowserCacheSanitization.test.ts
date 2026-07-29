import { sanitizeSessionWizardDraftForBrowserCache } from './sessionWizardBrowserCacheSanitization';

describe('sanitizeSessionWizardDraftForBrowserCache', () => {
  it('keeps public configuration while stripping every draft credential path', () => {
    const sanitized = sanitizeSessionWizardDraftForBrowserCache({
      slug: 'safe-session',
      ai: {
        models: { fast: { provider: 'openai', model: 'gpt-safe' } },
        providers: { openai: { apiKey: 'openai-secret', encryptedApiKey: 'openai-envelope' } },
      },
      rpc: {
        provider: 'path',
        providers: {
          path: {
            rpcUrl: 'https://rpc.example/credential',
            apiKey: 'rpc-secret',
            encryptedApiKey: 'rpc-envelope',
          },
        },
      },
      arweave: { jwk: '{"k":"secret"}', encryptedJwk: 'jwk-envelope' },
      faucet: {
        amountEth: '0.001',
        privateKey: 'faucet-secret',
        encryptedPrivateKey: 'faucet-envelope',
      },
      litCredentials: {
        litApiBase: 'https://lit.example',
        litGroupId: 'group-public',
        litPkpId: 'pkp-public',
        litActionCid: 'bafy-public',
        litAccountApiKey: 'lit-secret',
        capacityDelegationAuthSig: 'lit-auth',
      },
      storage: { cloudflare: { apiToken: 'cloudflare-secret', bucket: 'safe-bucket' } },
      sponsored: { faucetGrantToken: 'grant-secret', enabled: true },
      encryptedFields: {
        'ai.providers.openai.apiKey': 'encrypted-secret',
        sessionInfo: 'safe-encrypted-session-info',
      },
      encryptedFieldGates: {
        'faucet.privateKey': 'gate-secret',
        sessionInfo: 'gate-public',
      },
    });

    expect(sanitized).toEqual(
      expect.objectContaining({
        slug: 'safe-session',
        ai: { models: { fast: { provider: 'openai', model: 'gpt-safe' } } },
        faucet: { amountEth: '0.001' },
        litCredentials: {
          litApiBase: 'https://lit.example',
          litGroupId: 'group-public',
          litPkpId: 'pkp-public',
          litActionCid: 'bafy-public',
        },
        storage: { cloudflare: { bucket: 'safe-bucket' } },
        sponsored: { enabled: true },
        encryptedFields: { sessionInfo: 'safe-encrypted-session-info' },
        encryptedFieldGates: { sessionInfo: 'gate-public' },
      }),
    );
    expect(sanitized.rpc).toBeUndefined();
    expect(sanitized.arweave).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toContain('secret');
    expect(JSON.stringify(sanitized)).not.toContain('lit-auth');
    expect(JSON.stringify(sanitized)).not.toContain('credential');
  });
});
