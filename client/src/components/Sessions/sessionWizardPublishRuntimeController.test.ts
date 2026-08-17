import { createSessionWizardPublishRuntimeController } from './sessionWizardPublishRuntimeController';

const SESSION_ID = '0x00112233445566778899aabbccddeeff';
const ADMIN_ADDRESS = '0x1111111111111111111111111111111111111111';
const WORKER_ORIGIN = 'https://session-worker.example.test';

const createControllerHarness = () => {
  const events: string[] = [];
  const dispatch = jest.fn((action) => events.push(`dispatch:${action.type}:${action.effect || ''}`));
  const buildWorkerConfig = jest.fn((input) => ({
    slug: 'worker-session',
    sessionId: SESSION_ID,
    corsWorkerUrl: WORKER_ORIGIN,
    sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    allowOrigins: input.deployPayload.allowOrigins,
  }));
  const persistWorkerConfig = jest.fn(async () => {
    events.push('persist');
    return {
      workerOrigin: WORKER_ORIGIN,
      configRevision: 'revision-1',
      publicConfig: { slug: 'worker-session' },
    };
  });
  const callbacks = {
    setSessionUrl: jest.fn((value: string) => events.push(`session-url:${value}`)),
    setAdminUrl: jest.fn((value: string) => events.push(`admin-url:${value}`)),
    setAdminUrlStatus: jest.fn((value: string) => events.push(`admin-status:${value}`)),
    setWorkerCanonicalPublishSettled: jest.fn(() => events.push('publish-settled')),
    clearSessionWizardCache: jest.fn(() => {
      events.push('clear-cache');
      return {
        ok: true,
        removed: 2,
        failed: 0,
        status: 'ok',
        draft: { ok: true, removed: 1, failed: 0, status: 'ok' },
        pendingSbtDrafts: { ok: true, removed: 1, failed: 0, status: 'ok' },
        poisoned: false,
      };
    }),
    writeSessionWizardWorkerSettlement: jest.fn(() => {
      events.push('write-settlement');
      return { ok: true, bytes: 1, key: 'settlement', status: 'ok' };
    }),
    setSessionId: jest.fn((value: string) => events.push(`session-id:${value}`)),
    setSessionIdStatus: jest.fn((value: string) => events.push(`session-id-status:${value}`)),
  };
  const handleRegisterGroup = jest.fn(async () => {
    events.push('register');
  });
  const deployPendingSbts = jest.fn(async () => []);
  const parseAllowOriginsInput = jest.fn(() => ['https://app.example.test']);
  const runtimeRef = {
    current: {
      draft: {
        slug: 'worker-session',
        networkChainId: 11155420,
        sessionModeProfile: { authority: { mode: 'worker_canonical' } },
        ai: {
          models: {
            fast: { provider: 'openai', model: 'gpt-5' },
            thinking: { provider: 'openai', model: 'gpt-5' },
          },
        },
      },
      embeddedDeployHelperEnabled: true,
      latestChainBlock: 123,
      registryAddress: '0x2222222222222222222222222222222222222222',
      registryChainId: 11155420,
      sessionId: SESSION_ID,
      sessionIdHex: SESSION_ID,
      workerLimitPerWallet: 7,
    },
  };
  const getWorkerPublishEvidence = jest.fn(() => {
    const draft = JSON.parse(JSON.stringify(runtimeRef.current.draft));
    const runtime = { ...runtimeRef.current, draft };
    return {
      verified: true,
      reason: '',
      workerUrl: WORKER_ORIGIN,
      runtime,
      draft,
      workerSecrets: { openaiKey: 'test-only-key' },
      settlementIdentity: {
        workerUrl: WORKER_ORIGIN,
        slug: draft.slug,
        sessionId: runtime.sessionIdHex || runtime.sessionId,
      },
      publishInputFingerprint: JSON.stringify({
        draft,
        sessionId: runtime.sessionId,
        sessionIdHex: runtime.sessionIdHex,
        workerLimitPerWallet: runtime.workerLimitPerWallet,
      }),
    };
  });
  const controller = createSessionWizardPublishRuntimeController({
    runtimeRef,
    dispatch,
    getErrorMessage: (error) => (error instanceof Error ? error.message : String(error)),
    deployWorker: jest.fn(async () => ({ ok: true, deployComplete: true, workerUrl: WORKER_ORIGIN })),
    deployPendingSbts,
    getWorkerPublishEvidence,
    resolveWorkerRpcUrl: jest.fn(() => ''),
    resolveWorkerRpcUrlMap: jest.fn(() => ({})),
    parseAllowOriginsInput,
    resolveWorkerFaucetConfig: jest.fn(() => ({})),
    signTypedAdminAction: jest.fn(async () => ({ signature: '0xtest' })),
    handleRegisterGroup,
    generateSessionId: jest.fn(() => 'next-session-id'),
    callbacks,
    buildWorkerConfig,
    persistWorkerConfig,
  });
  const runTrackedPublishEffect = async <Result>(effect: string, run: () => Promise<Result>): Promise<Result> => {
    events.push(`effect:${effect}`);
    return run();
  };

  return {
    buildWorkerConfig,
    callbacks,
    controller,
    dispatch,
    deployPendingSbts,
    events,
    getWorkerPublishEvidence,
    handleRegisterGroup,
    parseAllowOriginsInput,
    persistWorkerConfig,
    runtimeRef,
    runTrackedPublishEffect,
  };
};

describe('sessionWizardPublishRuntimeController', () => {
  it('keeps blocked direct-token preparation inert before config persistence', async () => {
    const harness = createControllerHarness();

    await expect(
      harness.controller.runPreparation({
        publishAllowed: false,
        publishExecutionPlan: {
          shouldPersistWorkerConfig: true,
          shouldRegisterSession: false,
          shouldRefreshRegistryCache: false,
        },
        signerAccountOverride: ADMIN_ADDRESS,
        runTrackedPublishEffect: harness.runTrackedPublishEffect,
      }),
    ).resolves.toEqual({
      status: 'blocked',
      workerUrlOverride: '',
      deployedPendingDrafts: [],
      verifiedWorkerConfig: null,
    });

    expect(harness.persistWorkerConfig).not.toHaveBeenCalled();
    expect(harness.callbacks.setWorkerCanonicalPublishSettled).not.toHaveBeenCalled();
    expect(harness.callbacks.writeSessionWizardWorkerSettlement).not.toHaveBeenCalled();
    expect(harness.callbacks.clearSessionWizardCache).not.toHaveBeenCalled();
    expect(harness.events).toEqual([]);
  });

  it('persists worker config inside the tracked publish effect and returns the verified origin', async () => {
    const harness = createControllerHarness();

    const result = await harness.controller.runPreparation({
      publishAllowed: true,
      publishExecutionPlan: {
        shouldPersistWorkerConfig: true,
        shouldRegisterSession: false,
        shouldRefreshRegistryCache: false,
      },
      signerAccountOverride: ADMIN_ADDRESS,
      runTrackedPublishEffect: harness.runTrackedPublishEffect,
    });

    expect(result).toEqual(
      expect.objectContaining({
        workerUrlOverride: WORKER_ORIGIN,
        verifiedWorkerConfig: expect.objectContaining({
          workerUrl: WORKER_ORIGIN,
          configRevision: 'revision-1',
        }),
      }),
    );
    expect(harness.events).toEqual([
      'effect:persistWorkerConfig',
      'persist',
      'dispatch:effectSucceeded:persistWorkerConfig',
    ]);
    expect(harness.buildWorkerConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'worker-session',
        account: ADMIN_ADDRESS,
        sessionId: SESSION_ID,
        workerUrl: WORKER_ORIGIN,
        deployPayload: expect.objectContaining({
          adminAddress: ADMIN_ADDRESS,
          allowOrigins: ['https://app.example.test'],
          limits: { perWalletPerDay: 7 },
        }),
      }),
    );
    expect(harness.persistWorkerConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
        adminAddress: ADMIN_ADDRESS,
      }),
    );
  });

  it('fails closed before persistence when live worker evidence is absent', async () => {
    const harness = createControllerHarness();
    harness.getWorkerPublishEvidence.mockReturnValueOnce(null);

    await expect(
      harness.controller.runPreparation({
        publishAllowed: true,
        publishExecutionPlan: {
          shouldPersistWorkerConfig: true,
          shouldRegisterSession: false,
        },
        signerAccountOverride: ADMIN_ADDRESS,
        runTrackedPublishEffect: harness.runTrackedPublishEffect,
      }),
    ).rejects.toThrow('Worker deployment requirements changed');
    expect(harness.persistWorkerConfig).not.toHaveBeenCalled();
  });

  it('revalidates live evidence after an awaited pre-persist step', async () => {
    const harness = createControllerHarness();
    let resolvePendingSbts: ((value: unknown[]) => void) | undefined;
    harness.deployPendingSbts.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePendingSbts = resolve;
        }),
    );

    const preparation = harness.controller.runPreparation({
      publishAllowed: true,
      publishExecutionPlan: {
        shouldDeployPendingSbts: true,
        shouldPersistWorkerConfig: true,
        shouldRegisterSession: false,
      },
      signerAccountOverride: ADMIN_ADDRESS,
      runTrackedPublishEffect: harness.runTrackedPublishEffect,
    });
    await Promise.resolve();
    expect(harness.deployPendingSbts).toHaveBeenCalledTimes(1);

    harness.runtimeRef.current.draft.sessionModeProfile = { authority: { mode: 'evm_registry_canonical' } };
    harness.getWorkerPublishEvidence.mockReturnValue({
      verified: false,
      reason: 'requirements-changed',
      workerUrl: WORKER_ORIGIN,
      runtime: harness.runtimeRef.current,
      draft: { ...harness.runtimeRef.current.draft },
      workerSecrets: { openaiKey: 'test-only-key' },
      settlementIdentity: {
        workerUrl: WORKER_ORIGIN,
        slug: harness.runtimeRef.current.draft.slug,
        sessionId: harness.runtimeRef.current.sessionIdHex,
      },
      publishInputFingerprint: 'changed',
    });
    resolvePendingSbts?.([]);

    await expect(preparation).rejects.toThrow('Worker deployment requirements changed');
    expect(harness.persistWorkerConfig).not.toHaveBeenCalled();
  });

  it('fails closed when provider assignments change during worker persistence readback', async () => {
    const harness = createControllerHarness();
    let resolvePersist:
      ((value: { workerOrigin: string; configRevision: string; publicConfig: { slug: string } }) => void) | undefined;
    harness.persistWorkerConfig.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePersist = resolve;
        }),
    );

    const preparation = harness.controller.runPreparation({
      publishAllowed: true,
      publishExecutionPlan: {
        shouldPersistWorkerConfig: true,
        shouldRegisterSession: false,
      },
      signerAccountOverride: ADMIN_ADDRESS,
      runTrackedPublishEffect: harness.runTrackedPublishEffect,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.persistWorkerConfig).toHaveBeenCalledTimes(1);

    harness.runtimeRef.current.draft.ai.models.fast = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
    };
    resolvePersist?.({
      workerOrigin: WORKER_ORIGIN,
      configRevision: 'revision-1',
      publicConfig: { slug: 'worker-session' },
    });

    await expect(preparation).rejects.toThrow(
      'Session inputs changed while worker config was being verified. Review and publish again.',
    );
    expect(harness.callbacks.setWorkerCanonicalPublishSettled).not.toHaveBeenCalled();
    expect(harness.callbacks.writeSessionWizardWorkerSettlement).not.toHaveBeenCalled();
    expect(harness.callbacks.clearSessionWizardCache).not.toHaveBeenCalled();
  });

  it('blocks settlement when the live draft changes after verified readback', async () => {
    const harness = createControllerHarness();
    const publishControllerResult = await harness.controller.runPreparation({
      publishAllowed: true,
      publishExecutionPlan: { shouldPersistWorkerConfig: true, shouldRegisterSession: false },
      signerAccountOverride: ADMIN_ADDRESS,
      runTrackedPublishEffect: harness.runTrackedPublishEffect,
    });
    harness.events.splice(0);
    harness.runtimeRef.current.draft.sessionName = 'Edited after readback';

    await expect(
      harness.controller.settleRegistration({
        publishExecutionPlan: { shouldRegisterSession: false },
        uploadResult: null,
        publishControllerResult,
        runTrackedPublishEffect: harness.runTrackedPublishEffect,
      }),
    ).rejects.toThrow('Session inputs changed before worker publication could settle. Review and publish again.');
    expect(harness.callbacks.setWorkerCanonicalPublishSettled).not.toHaveBeenCalled();
    expect(harness.callbacks.writeSessionWizardWorkerSettlement).not.toHaveBeenCalled();
    expect(harness.callbacks.clearSessionWizardCache).not.toHaveBeenCalled();
  });

  it('blocks settlement when non-draft config inputs change after verified readback', async () => {
    const harness = createControllerHarness();
    const publishControllerResult = await harness.controller.runPreparation({
      publishAllowed: true,
      publishExecutionPlan: { shouldPersistWorkerConfig: true, shouldRegisterSession: false },
      signerAccountOverride: ADMIN_ADDRESS,
      runTrackedPublishEffect: harness.runTrackedPublishEffect,
    });
    harness.events.splice(0);
    harness.parseAllowOriginsInput.mockReturnValue(['https://edited.example.test']);

    await expect(
      harness.controller.settleRegistration({
        publishExecutionPlan: { shouldRegisterSession: false },
        uploadResult: null,
        publishControllerResult,
        runTrackedPublishEffect: harness.runTrackedPublishEffect,
      }),
    ).rejects.toThrow(
      'Session config inputs changed before worker publication could settle. Review and publish again.',
    );
    expect(harness.callbacks.clearSessionWizardCache).not.toHaveBeenCalled();
  });

  it('settles worker-canonical publication only after verified persistence and rotates the draft identity', async () => {
    const harness = createControllerHarness();
    const preservedPendingSbtDrafts = [
      {
        predictedAddress: '0x00000000000000000000000000000000000000aa',
        deployed: false,
      },
    ];
    const publishControllerResult = await harness.controller.runPreparation({
      publishAllowed: true,
      publishExecutionPlan: {
        shouldPersistWorkerConfig: true,
        shouldRegisterSession: false,
      },
      signerAccountOverride: ADMIN_ADDRESS,
      runTrackedPublishEffect: harness.runTrackedPublishEffect,
    });
    harness.events.splice(0);

    await harness.controller.settleRegistration({
      preservedPendingSbtDrafts,
      publishExecutionPlan: {
        shouldRegisterSession: false,
        shouldRefreshRegistryCache: false,
      },
      uploadResult: null,
      publishControllerResult,
      runTrackedPublishEffect: harness.runTrackedPublishEffect,
    });

    expect(harness.handleRegisterGroup).not.toHaveBeenCalled();
    expect(harness.events).toHaveLength(8);
    expect(harness.events[0]).toContain('session-url:');
    expect(harness.events[0]).toContain('worker=');
    expect(harness.events[1]).toContain('admin-url:');
    expect(harness.events.slice(2)).toEqual([
      'admin-status:',
      'publish-settled',
      'write-settlement',
      'clear-cache',
      'session-id:next-session-id',
      'session-id-status:Generated a new session ID for your next session.',
    ]);
    const workerSettlement = {
      workerUrl: WORKER_ORIGIN,
      slug: 'worker-session',
      sessionId: SESSION_ID,
    };
    expect(harness.callbacks.setWorkerCanonicalPublishSettled).toHaveBeenCalledWith(workerSettlement);
    expect(harness.callbacks.clearSessionWizardCache).toHaveBeenCalledWith({
      preservedPendingSbtDrafts,
      workerSettlement,
    });
    expect(harness.callbacks.writeSessionWizardWorkerSettlement).toHaveBeenCalledWith(workerSettlement);
  });

  it('preserves register-then-refresh ordering for decentralized publication', async () => {
    const harness = createControllerHarness();
    const preservedPendingSbtDrafts = [
      {
        predictedAddress: '0x00000000000000000000000000000000000000cc',
        deployed: false,
      },
    ];

    await harness.controller.settleRegistration({
      preservedPendingSbtDrafts,
      publishExecutionPlan: {
        shouldRegisterSession: true,
        shouldRefreshRegistryCache: true,
      },
      uploadResult: {
        metadataUri: 'ar://metadata',
        onChainFields: { sessionName: 'Example' },
      },
      publishControllerResult: {
        status: 'completed',
        workerUrlOverride: '',
        deployedPendingDrafts: [],
        verifiedWorkerConfig: null,
      },
      runTrackedPublishEffect: harness.runTrackedPublishEffect,
    });

    expect(harness.handleRegisterGroup).toHaveBeenCalledWith({
      metadataUriOverride: 'ar://metadata',
      preservedPendingSbtDrafts,
      sessionFieldsOverride: { sessionName: 'Example' },
    });
    expect(harness.events).toEqual([
      'effect:registerSession',
      'register',
      'dispatch:effectSucceeded:registerSession',
      'dispatch:effectSucceeded:refreshRegistryCache',
    ]);
  });

  it('fails closed when worker-canonical settlement lacks verified persistence', async () => {
    const harness = createControllerHarness();

    await expect(
      harness.controller.settleRegistration({
        publishExecutionPlan: { shouldRegisterSession: false },
        uploadResult: null,
        publishControllerResult: {
          status: 'completed',
          workerUrlOverride: '',
          deployedPendingDrafts: [],
          verifiedWorkerConfig: null,
        },
        runTrackedPublishEffect: harness.runTrackedPublishEffect,
      }),
    ).rejects.toThrow('Worker-canonical publish requires verified worker config persistence.');
    expect(harness.events).toEqual([]);
  });

  it('locks the current publish and refuses identity rotation when draft cache clearing fails', async () => {
    const harness = createControllerHarness();
    const publishControllerResult = await harness.controller.runPreparation({
      publishAllowed: true,
      publishExecutionPlan: { shouldPersistWorkerConfig: true, shouldRegisterSession: false },
      signerAccountOverride: ADMIN_ADDRESS,
      runTrackedPublishEffect: harness.runTrackedPublishEffect,
    });
    harness.events.splice(0);
    harness.callbacks.clearSessionWizardCache.mockImplementationOnce(() => {
      harness.events.push('clear-cache-failed');
      return { ok: false, removed: 0, failed: 1, status: 'partial-failure' };
    });

    await expect(
      harness.controller.settleRegistration({
        publishExecutionPlan: { shouldRegisterSession: false },
        uploadResult: null,
        publishControllerResult,
        runTrackedPublishEffect: harness.runTrackedPublishEffect,
      }),
    ).rejects.toThrow('Could not durably clear the published session draft');

    expect(harness.callbacks.setWorkerCanonicalPublishSettled).toHaveBeenCalledWith({
      workerUrl: WORKER_ORIGIN,
      slug: 'worker-session',
      sessionId: SESSION_ID,
    });
    expect(harness.callbacks.writeSessionWizardWorkerSettlement).toHaveBeenCalledWith({
      workerUrl: WORKER_ORIGIN,
      slug: 'worker-session',
      sessionId: SESSION_ID,
    });
    expect(harness.events.indexOf('write-settlement')).toBeLessThan(harness.events.indexOf('clear-cache-failed'));
    expect(harness.callbacks.setSessionId).not.toHaveBeenCalled();
  });

  it('preserves the publishable draft when the durable marker write fails and refuses identity rotation', async () => {
    const harness = createControllerHarness();
    const publishControllerResult = await harness.controller.runPreparation({
      publishAllowed: true,
      publishExecutionPlan: { shouldPersistWorkerConfig: true, shouldRegisterSession: false },
      signerAccountOverride: ADMIN_ADDRESS,
      runTrackedPublishEffect: harness.runTrackedPublishEffect,
    });
    harness.events.splice(0);
    harness.callbacks.writeSessionWizardWorkerSettlement.mockImplementationOnce(() => {
      harness.events.push('write-settlement-failed');
      return { ok: false, status: 'write-failed', error: 'quota' };
    });

    await expect(
      harness.controller.settleRegistration({
        publishExecutionPlan: { shouldRegisterSession: false },
        uploadResult: null,
        publishControllerResult,
        runTrackedPublishEffect: harness.runTrackedPublishEffect,
      }),
    ).rejects.toThrow('Could not durably record the published worker identity');

    expect(harness.callbacks.setWorkerCanonicalPublishSettled).toHaveBeenCalledWith({
      workerUrl: WORKER_ORIGIN,
      slug: 'worker-session',
      sessionId: SESSION_ID,
    });
    expect(harness.callbacks.clearSessionWizardCache).not.toHaveBeenCalled();
    expect(harness.callbacks.setSessionId).not.toHaveBeenCalled();
  });
});
