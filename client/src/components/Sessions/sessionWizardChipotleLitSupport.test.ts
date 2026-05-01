import {
  buildSessionWizardLitBootstrapRequest,
  buildSessionWizardLitProvisionRequest,
  SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION,
  SESSION_WIZARD_CHIPOTLE_ACTION_NAME,
  syncWorkerLitSessionBootstrapAfterDeploy,
  syncWorkerLitActionProvisionAfterDeploy,
  withLitBootstrapSyncStatus,
  withLitProvisionSyncStatus,
} from './sessionWizardChipotleLitSupport';

describe('sessionWizardChipotleLitSupport', () => {
  test('buildSessionWizardLitBootstrapRequest returns the default action payload when only Lit API base is present', () => {
    const result = buildSessionWizardLitBootstrapRequest({
      litApiBase: ' https://api.chipotle.litprotocol.com ',
    }, {
      sessionName: ' Session A ',
    });

    expect(result).toEqual(expect.objectContaining({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      sessionName: 'Session A',
      actionName: SESSION_WIZARD_CHIPOTLE_ACTION_NAME,
    }));
    expect(result?.actionCode).toBe(SESSION_WIZARD_CHIPOTLE_DEFAULT_ACTION.code);
  });

  test('buildSessionWizardLitBootstrapRequest skips auto-bootstrap when an existing Lit account config is already being supplied', () => {
    expect(buildSessionWizardLitBootstrapRequest({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: '7',
      litPkpId: '0xpkp123',
    })).toBeNull();
    expect(buildSessionWizardLitBootstrapRequest({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litUsageApiKey: 'usage-key',
    })).toBeNull();
  });

  test('buildSessionWizardLitProvisionRequest returns the default action payload when config is present without a CID', () => {
    const result = buildSessionWizardLitProvisionRequest({
      litApiBase: ' https://api.chipotle.litprotocol.com ',
      litGroupId: ' ce-session-content-prod ',
      litPkpId: ' 0xpkp123 ',
    });

    expect(result).toEqual(expect.objectContaining({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'ce-session-content-prod',
      litPkpId: '0xpkp123',
      actionName: SESSION_WIZARD_CHIPOTLE_ACTION_NAME,
    }));
    expect(String(result?.actionCode || '')).toContain('async function main(params)');
  });

  test('buildSessionWizardLitProvisionRequest skips auto-provision when a CID already exists', () => {
    expect(buildSessionWizardLitProvisionRequest({
      litApiBase: 'https://api.chipotle.litprotocol.com',
      litGroupId: 'ce-session-content-prod',
      litPkpId: '0xpkp123',
      litActionCid: 'QmExistingCid',
    })).toBeNull();
  });

  test('syncWorkerLitActionProvisionAfterDeploy retries after config bootstrap and applies the returned CID', async () => {
    const signAdminAction = jest.fn().mockResolvedValue({ signature: 'sig' });
    const postProvision = jest
      .fn()
      .mockRejectedValueOnce(new Error('Admin authorization failed.'))
      .mockResolvedValueOnce({
        ok: true,
        litActionCid: 'QmAction123',
        litGroupId: '7',
      });
    const ensureSessionConfig = jest.fn(async () => ({}));
    const applyProvisionedConfig = jest.fn(async () => ({}));

    const result = await syncWorkerLitActionProvisionAfterDeploy({
      workerUrl: 'https://worker.example',
      account: '0xabc',
      slug: 'session-a',
      provisionRequest: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        litGroupId: 'ce-session-content-prod',
        litPkpId: '0xpkp123',
        actionCode: 'async function main() { return { ok: true }; }',
      },
      signAdminAction,
      postProvision,
      ensureSessionConfig,
      applyProvisionedConfig,
    });

    expect(result).toEqual(expect.objectContaining({
      synced: true,
      litActionCid: 'QmAction123',
      litGroupId: '7',
      note: 'Lit action auto-provisioned.',
    }));
    expect(ensureSessionConfig).toHaveBeenCalledTimes(1);
    expect(applyProvisionedConfig).toHaveBeenCalledWith(expect.objectContaining({
      litActionCid: 'QmAction123',
      litGroupId: '7',
    }));
    expect(signAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'lit-chipotle-provision',
    }));
  });

  test('syncWorkerLitSessionBootstrapAfterDeploy retries after config bootstrap and applies the returned Lit ids', async () => {
    const signAdminAction = jest.fn().mockResolvedValue({ signature: 'sig' });
    const postBootstrap = jest
      .fn()
      .mockRejectedValueOnce(new Error('Session config not found.'))
      .mockResolvedValueOnce({
        ok: true,
        litActionCid: 'QmAction123',
        litGroupId: '7',
        litPkpId: '0xpkp123',
      });
    const ensureSessionConfig = jest.fn(async () => ({}));
    const applyBootstrappedConfig = jest.fn(async () => ({}));

    const result = await syncWorkerLitSessionBootstrapAfterDeploy({
      workerUrl: 'https://worker.example',
      account: '0xabc',
      slug: 'session-a',
      bootstrapRequest: {
        litApiBase: 'https://api.chipotle.litprotocol.com',
        actionCode: 'async function main() { return { ok: true }; }',
      },
      signAdminAction,
      postBootstrap,
      ensureSessionConfig,
      applyBootstrappedConfig,
    });

    expect(result).toEqual(expect.objectContaining({
      synced: true,
      litActionCid: 'QmAction123',
      litGroupId: '7',
      litPkpId: '0xpkp123',
      note: 'Lit session account auto-created.',
    }));
    expect(ensureSessionConfig).toHaveBeenCalledTimes(1);
    expect(applyBootstrappedConfig).toHaveBeenCalledWith(expect.objectContaining({
      litActionCid: 'QmAction123',
      litGroupId: '7',
      litPkpId: '0xpkp123',
    }));
    expect(signAdminAction).toHaveBeenCalledWith(expect.objectContaining({
      action: 'lit-chipotle-bootstrap-session',
    }));
  });

  test('withLitBootstrapSyncStatus appends note copy when bootstrap succeeds', () => {
    expect(withLitBootstrapSyncStatus('Worker deployed.', {
      note: 'Lit session account auto-created.',
    })).toBe('Worker deployed. Lit bootstrap note: Lit session account auto-created.');
  });

  test('withLitProvisionSyncStatus appends note copy when provisioning succeeds', () => {
    expect(withLitProvisionSyncStatus('Worker deployed.', {
      note: 'Lit action auto-provisioned.',
    })).toBe('Worker deployed. Lit provisioning note: Lit action auto-provisioned.');
  });
});
