import {
  buildWorkerLitCredentialsConfig,
  CHIPOTLE_LIT_CONFIG_FIELDS,
  DEFAULT_WORKER_SECRETS,
  getSessionWizardWorkerResourceKeys,
  mergeSponsoredBundleDeployForm,
  mergeSponsoredBundleWorkerSecrets,
  normalizeWorkerSecrets,
  resolveSessionWizardEnabledWorkerSecrets,
  sanitizeSessionWizardSponsoredFieldSnapshotForLitMode,
  sanitizeSessionWizardWorkerSecretsForLitMode,
} from './sessionWizardWorkerSecretSupport';

describe('sessionWizardWorkerSecretSupport', () => {
  it('normalizes worker secrets and strips redacted placeholders', () => {
    expect(
      normalizeWorkerSecrets({
        ...DEFAULT_WORKER_SECRETS,
        openaiKey: ' sk-openai ',
        customRpcKey: '[redacted]',
        litApiBase: ' https://api.chipotle.litprotocol.com ',
      }),
    ).toEqual(
      expect.objectContaining({
        openaiKey: 'sk-openai',
        customRpcKey: '',
        litApiBase: 'https://api.chipotle.litprotocol.com',
      }),
    );
  });

  it('builds worker Lit credentials from the non-secret Chipotle fields only', () => {
    expect(
      buildWorkerLitCredentialsConfig({
        litApiBase: ' https://api.chipotle.litprotocol.com ',
        litGroupId: ' group_123 ',
        litPkpId: ' pkp_123 ',
        litActionCid: ' bafy123 ',
        litAccountApiKey: ' account-secret ',
        litUsageApiKey: 'sk-secret',
      }),
    ).toEqual({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'group_123',
      litPkpId: 'pkp_123',
      litActionCid: 'bafy123',
    });
    expect(CHIPOTLE_LIT_CONFIG_FIELDS).toEqual(['litApiBase', 'litGroupId', 'litPkpId', 'litActionCid']);
  });

  it('normalizes worker secrets and strips hidden scoped Chipotle fields when account authority is present', () => {
    expect(
      sanitizeSessionWizardWorkerSecretsForLitMode({
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'group_123',
        litPkpId: 'pkp_123',
        litActionCid: 'bafy123',
        litAccountApiKey: ' account-secret ',
        litUsageApiKey: ' usage-secret ',
      }),
    ).toEqual(
      expect.objectContaining({
        litApiBase: '',
        litGroupId: '',
        litPkpId: '',
        litActionCid: '',
        litAccountApiKey: 'account-secret',
        litUsageApiKey: '',
      }),
    );
  });

  it('drops uploaded worker secrets when sponsored worker secrets are disabled', () => {
    expect(
      resolveSessionWizardEnabledWorkerSecrets({
        workerSecretsEnabled: false,
        workerSecrets: {
          openaiKey: 'sk-openai',
          customRpcUrl: 'https://uploaded-rpc.example',
          arweaveJwk: '{"kty":"RSA"}',
        },
      }),
    ).toEqual(DEFAULT_WORKER_SECRETS);

    expect(
      resolveSessionWizardEnabledWorkerSecrets({
        workerSecretsEnabled: true,
        workerSecrets: {
          customRpcUrl: ' https://uploaded-rpc.example ',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        customRpcUrl: 'https://uploaded-rpc.example',
      }),
    );
  });

  it('preserves the Lit resource bucket and sponsored flags in Chipotle-only mode', () => {
    expect(
      sanitizeSessionWizardSponsoredFieldSnapshotForLitMode({
        sponsored_lit: '1',
        sponsored_ai: '1',
      }),
    ).toEqual(
      expect.objectContaining({
        sponsored_lit: '1',
        sponsored_ai: '1',
      }),
    );

    expect(getSessionWizardWorkerResourceKeys()).toContain('lit');
  });

  it('merges sponsored worker secrets while clearing stale custom RPC keys', () => {
    expect(
      mergeSponsoredBundleWorkerSecrets(
        {
          openaiKey: 'cached-openai',
          arweaveJwk: '{"kty":"cached"}',
          faucetPrivateKey: '0xcachedfaucet',
          customRpcKey: 'keep-me',
        },
        {
          openaiKey: 'sponsored-openai',
          customRpcUrl: 'https://sponsored-rpc.example.test',
          customRpcKey: 'ignore-me',
        },
      ),
    ).toEqual(
      expect.objectContaining({
        openaiKey: 'sponsored-openai',
        arweaveJwk: '{"kty":"cached"}',
        faucetPrivateKey: '0xcachedfaucet',
        customRpcUrl: 'https://sponsored-rpc.example.test',
        customRpcKey: '',
      }),
    );
  });

  it('merges sponsored Lit authority fields into worker secrets', () => {
    expect(
      mergeSponsoredBundleWorkerSecrets(
        {},
        {
          litAccountApiKey: 'account-secret',
          litUsageApiKey: 'usage-secret',
        },
      ),
    ).toEqual(
      expect.objectContaining({
        litAccountApiKey: 'account-secret',
        litUsageApiKey: 'usage-secret',
      }),
    );
  });

  it('leaves the deploy form unchanged because sponsored bundles do not ship raw deploy credentials', () => {
    expect(
      mergeSponsoredBundleDeployForm(
        {
          apiToken: '',
          workerName: 'launch-week-worker',
        },
        {
          deployGrantToken: 'deploy-grant-token',
          bootstrapWorkerUrl: 'https://source-worker.example.test',
          openaiKey: 'sponsored-openai',
        },
      ),
    ).toEqual({
      apiToken: '',
      workerName: 'launch-week-worker',
    });
  });
});
