import {
  buildWorkerSecretsPayload,
  resolveWorkerSecretsSnapshot,
  syncWorkerConfigAfterPartialDeploy,
  syncWorkerSecretsAfterDeploy,
  withSecretsSyncStatus,
  withSecretsSyncWarning,
  withWorkerConfigSyncWarning,
} from './sessionWizardSecrets.js';

describe('sessionWizardSecrets', () => {
  test('resolveWorkerSecretsSnapshot prefers the ref snapshot and falls back to state/defaults', () => {
    expect(
      resolveWorkerSecretsSnapshot({
        workerSecrets: {
          openaiKey: 'sk-state',
          customRpcUrl: 'https://state.example',
          arweaveJwk: '{"state":true}',
        },
        workerSecretsRef: {
          current: {
            openaiKey: 'sk-ref',
            arweaveJwk: '',
            faucetPrivateKey: 'abc123',
          },
        },
        defaults: {
          openaiKey: '',
          anthropicKey: '',
          customRpcUrl: '',
          arweaveJwk: '',
          faucetPrivateKey: '',
        },
      }),
    ).toEqual({
      openaiKey: 'sk-ref',
      anthropicKey: '',
      customRpcUrl: 'https://state.example',
      arweaveJwk: '',
      faucetPrivateKey: 'abc123',
    });
  });

  test('buildWorkerSecretsPayload trims values and drops empty keys', () => {
    expect(
      buildWorkerSecretsPayload({
        openaiKey: ' sk-123 ',
        anthropicKey: '',
        arweaveJwk: '   {"kty":"RSA"}   ',
        customRpcUrl: '   ',
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'group_123',
        litAccountApiKey: ' account-secret ',
        litUsageApiKey: ' lit-secret ',
      }),
    ).toEqual({
      openaiKey: 'sk-123',
      arweaveJwk: '{"kty":"RSA"}',
      litAccountApiKey: 'account-secret',
      litUsageApiKey: 'lit-secret',
    });
  });

  test('withSecretsSyncWarning appends warning copy', () => {
    expect(withSecretsSyncWarning('Worker deployed.', 'Failed to sync secrets')).toBe(
      'Worker deployed. Secrets sync warning: Failed to sync secrets',
    );
  });

  test('withSecretsSyncWarning preserves base status when warning is empty', () => {
    expect(withSecretsSyncWarning('Worker deployed.', '')).toBe('Worker deployed.');
  });

  test('withSecretsSyncStatus appends note copy when warning is empty', () => {
    expect(
      withSecretsSyncStatus('Worker deployed.', {
        note: 'Post-deploy auth sync not yet confirmed.',
      }),
    ).toBe('Worker deployed. Secrets sync note: Post-deploy auth sync not yet confirmed.');
  });

  test('withWorkerConfigSyncWarning appends warning copy', () => {
    expect(withWorkerConfigSyncWarning('Worker deployed.', 'Config reseed failed')).toBe(
      'Worker deployed. Config sync warning: Config reseed failed',
    );
  });

  test('syncWorkerSecretsAfterDeploy retries transient auth failures and succeeds', async () => {
    const signAdminAction = jest
      .fn()
      .mockRejectedValueOnce(new Error('Failed to reach worker auth endpoint (https://worker.example/auth/nonce).'))
      .mockResolvedValueOnce({
        address: '0xabc',
        message: 'msg',
        signature: 'sig',
        sessionSlug: 'test-5',
      });
    const postSecrets = jest.fn(async () => ({}));
    const wait = jest.fn(async () => undefined);

    const result = await syncWorkerSecretsAfterDeploy({
      workerUrl: 'https://worker.example',
      account: '0xabc',
      slug: 'test-5',
      deploySecrets: { openaiKey: 'sk-test' },
      signAdminAction,
      postSecrets,
      retryDelaysMs: [10, 20],
      wait,
      helperWritesSecrets: false,
    });

    expect(result).toEqual(expect.objectContaining({ synced: true, warning: '', note: '' }));
    expect(signAdminAction).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(10);
    expect(postSecrets).toHaveBeenCalledTimes(1);
  });

  test('syncWorkerSecretsAfterDeploy retries while an accepted config becomes visible', async () => {
    const signAdminAction = jest
      .fn()
      .mockRejectedValueOnce(new Error('Admin authorization failed.'))
      .mockResolvedValueOnce({ address: '0xabc', signature: 'sig' });
    const postSecrets = jest.fn(async () => ({}));
    const wait = jest.fn(async () => undefined);

    const result = await syncWorkerSecretsAfterDeploy({
      workerUrl: 'https://worker.example',
      account: '0xabc',
      slug: 'test-5',
      deploySecrets: { openaiKey: 'sk-test' },
      signAdminAction,
      postSecrets,
      retryDelaysMs: [10],
      wait,
      helperWritesSecrets: false,
    });

    expect(result).toEqual(expect.objectContaining({ synced: true, attempts: 2, warning: '' }));
    expect(signAdminAction).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(10);
    expect(postSecrets).toHaveBeenCalledTimes(1);
  });

  test('syncWorkerSecretsAfterDeploy binds canonical secret writes to the session ID', async () => {
    const signAdminAction = jest.fn(async () => ({ address: '0xabc', signature: 'sig' }));
    const postSecrets = jest.fn(async () => ({}));
    const sessionId = '0x12121212121212121212121212121212';

    const result = await syncWorkerSecretsAfterDeploy({
      workerUrl: 'https://worker.example',
      account: '0xabc',
      slug: 'test-5',
      sessionId,
      deploySecrets: { openaiKey: 'sk-test' },
      signAdminAction,
      postSecrets,
      retryDelaysMs: [],
      helperWritesSecrets: false,
    });

    expect(result).toEqual(expect.objectContaining({ synced: true, warning: '' }));
    expect(signAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          sessionSlug: 'test-5',
          sessionId,
          secrets: { openaiKey: 'sk-test' },
        },
      }),
    );
    expect(postSecrets).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          sessionSlug: 'test-5',
          sessionId,
          secrets: { openaiKey: 'sk-test' },
        },
      }),
    );
  });

  test('syncWorkerSecretsAfterDeploy skips browser sync when helper already wrote secrets', async () => {
    const signAdminAction = jest
      .fn()
      .mockRejectedValue(new Error('Failed to reach worker auth endpoint (https://worker.example/auth/nonce).'));
    const postSecrets = jest.fn(async () => ({}));

    const result = await syncWorkerSecretsAfterDeploy({
      workerUrl: 'https://worker.example',
      account: '0xabc',
      slug: 'test-5',
      deploySecrets: { openaiKey: 'sk-test' },
      signAdminAction,
      postSecrets,
      retryDelaysMs: [1],
      wait: jest.fn(async () => undefined),
      helperWritesSecrets: true,
    });

    expect(result.warning).toBe('');
    expect(result.note).toContain('Deploy helper already wrote secrets; skipped browser post-deploy secret sync.');
    expect(signAdminAction).not.toHaveBeenCalled();
    expect(postSecrets).not.toHaveBeenCalled();
  });

  test('syncWorkerSecretsAfterDeploy keeps a warning for allowOrigins/config failures when helper did not write secrets', async () => {
    const signAdminAction = jest
      .fn()
      .mockRejectedValue(
        new Error(
          'Failed to reach worker auth endpoint (https://worker.example/auth/nonce). Check worker URL and allowOrigins includes http://localhost:3000.',
        ),
      );

    const result = await syncWorkerSecretsAfterDeploy({
      workerUrl: 'https://worker.example',
      account: '0xabc',
      slug: 'test-5',
      deploySecrets: { openaiKey: 'sk-test' },
      signAdminAction,
      postSecrets: jest.fn(async () => ({})),
      retryDelaysMs: [],
      helperWritesSecrets: false,
    });

    expect(result.note).toBe('');
    expect(result.warning).toContain('allowOrigins');
  });

  test('syncWorkerSecretsAfterDeploy seeds config then retries when admin auth fails on set-secrets', async () => {
    const signAdminAction = jest.fn().mockResolvedValue({
      address: '0xabc',
      message: 'msg',
      signature: 'sig',
      sessionSlug: 'test-5',
    });
    const postSecrets = jest
      .fn()
      .mockRejectedValueOnce(new Error('Admin authorization failed.'))
      .mockResolvedValueOnce({});
    const ensureSessionConfig = jest.fn(async () => ({}));

    const result = await syncWorkerSecretsAfterDeploy({
      workerUrl: 'https://worker.example',
      account: '0xabc',
      slug: 'test-5',
      deploySecrets: { openaiKey: 'sk-test' },
      signAdminAction,
      postSecrets,
      ensureSessionConfig,
      retryDelaysMs: [],
      helperWritesSecrets: false,
    });

    expect(result).toEqual(expect.objectContaining({ synced: true, warning: '', note: '' }));
    expect(ensureSessionConfig).toHaveBeenCalledTimes(1);
    expect(postSecrets).toHaveBeenCalledTimes(2);
    expect(signAdminAction).toHaveBeenCalledTimes(2);
  });

  test('syncWorkerConfigAfterPartialDeploy reseeds config for partial deploy responses', async () => {
    const ensureSessionConfig = jest.fn(async () => ({}));

    const result = await syncWorkerConfigAfterPartialDeploy({
      deployResponse: {
        partial: true,
        configWriteError: 'final config rewrite failed',
      },
      workerUrl: 'https://worker.example',
      account: '0xabc',
      slug: 'test-5',
      ensureSessionConfig,
    });

    expect(result).toEqual(expect.objectContaining({ synced: true, warning: '', note: '' }));
    expect(ensureSessionConfig).toHaveBeenCalledTimes(1);
    expect(ensureSessionConfig).toHaveBeenCalledWith({
      workerUrl: 'https://worker.example',
      slug: 'test-5',
      account: '0xabc',
    });
  });

  test('syncWorkerConfigAfterPartialDeploy returns a warning when config reseed fails', async () => {
    const ensureSessionConfig = jest.fn(async () => {
      throw new Error('Connect a wallet, then save worker config from /admin.');
    });

    const result = await syncWorkerConfigAfterPartialDeploy({
      deployResponse: {
        partial: true,
        configWriteError: 'final config rewrite failed',
      },
      workerUrl: 'https://worker.example',
      account: '',
      slug: 'test-5',
      ensureSessionConfig,
    });

    expect(result).toEqual(
      expect.objectContaining({
        synced: false,
        warning: 'Connect a wallet, then save worker config from /admin.',
        note: '',
      }),
    );
  });
});
