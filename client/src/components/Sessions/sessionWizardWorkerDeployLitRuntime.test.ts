import {
  buildSessionWizardLitBootstrapRecovery,
  createSessionWizardEnsureWorkerSessionConfig,
  matchesSessionWizardLitBootstrapRecovery,
  mergeRecoveredSessionWizardLitRuntime,
  resolveCompleteSessionWizardLitRuntime,
  syncSessionWizardLitRuntimeConfigAfterDeploy,
} from './sessionWizardWorkerDeployLitRuntime';

const litCredentials = {
  litApiBase: 'https://api.chipotle.litprotocol.com',
  litGroupId: 'group-1',
  litPkpId: 'pkp-1',
  litActionCid: 'bafy-action-1',
};

describe('sessionWizardWorkerDeployLitRuntime', () => {
  it('requires and normalizes the exact four-field public Lit tuple', () => {
    expect(resolveCompleteSessionWizardLitRuntime({ ...litCredentials, litGroupId: ' group-1 ' })).toEqual(
      litCredentials,
    );
    expect(resolveCompleteSessionWizardLitRuntime({ ...litCredentials, litPkpId: '' })).toBeNull();
  });

  it('keeps a bootstrap tuple recoverable without clearing account authority', () => {
    expect(mergeRecoveredSessionWizardLitRuntime({ litAccountApiKey: 'account-key' }, litCredentials)).toEqual({
      litAccountApiKey: 'account-key',
      ...litCredentials,
      litRuntimeRecovered: 'bootstrap',
    });
  });

  it('matches recovery only for the same worker, slug, and tuple', () => {
    const recovery = buildSessionWizardLitBootstrapRecovery({
      workerUrl: 'https://worker.example.test/',
      slug: 'lit-session',
      litCredentials,
    });
    expect(
      matchesSessionWizardLitBootstrapRecovery({
        recovery,
        workerUrl: 'https://worker.example.test',
        slug: 'lit-session',
        litCredentials,
      }),
    ).toBe(true);
    expect(
      matchesSessionWizardLitBootstrapRecovery({
        recovery,
        workerUrl: 'https://worker.example.test',
        slug: 'lit-session',
        litCredentials: { ...litCredentials, litGroupId: 'edited' },
      }),
    ).toBe(false);
  });

  it('requires a tuple-specific remote config write before reporting sync', async () => {
    const ensureSessionConfig = jest.fn(async () => undefined);
    await expect(
      syncSessionWizardLitRuntimeConfigAfterDeploy({
        requiresLit: true,
        workerUrl: 'https://worker.example.test',
        slug: 'lit-session',
        litCredentials,
        ensureSessionConfig,
      }),
    ).resolves.toEqual(expect.objectContaining({ synced: true }));
    expect(ensureSessionConfig).toHaveBeenCalledWith({
      workerUrl: 'https://worker.example.test',
      slug: 'lit-session',
    });
  });

  it('builds each signed config write from the latest mutable config snapshot', async () => {
    let config = { slug: 'lit-session', revision: 1 };
    const signTypedAdminAction = jest.fn(async () => ({ address: '0xadmin', signature: '0xsig' }));
    const fetchImpl = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as unknown as typeof fetch;
    const ensureSessionConfig = createSessionWizardEnsureWorkerSessionConfig({
      getWorkerConfig: () => config,
      getAdminAddress: () => '0xadmin',
      signTypedAdminAction,
      fetchImpl,
    });
    config = { slug: 'lit-session', revision: 2 };

    await ensureSessionConfig({ workerUrl: 'https://worker.example.test', slug: 'lit-session' });

    expect(signTypedAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ config: expect.objectContaining({ revision: 2 }) }) }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://worker.example.test/admin/set-config',
      expect.objectContaining({ body: expect.stringContaining('"revision":2') }),
    );
  });
});
