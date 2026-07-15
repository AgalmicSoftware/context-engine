import { createSessionWizardPublishRuntimeController } from './sessionWizardPublishRuntimeController';

const SESSION_ID = '0x00112233445566778899aabbccddeeff';
const ADMIN_ADDRESS = '0x1111111111111111111111111111111111111111';
const WORKER_ORIGIN = 'https://session-worker.example.test';

const createControllerHarness = () => {
  const events: string[] = [];
  const dispatch = jest.fn((action) => events.push(`dispatch:${action.type}:${action.effect || ''}`));
  const buildWorkerConfig = jest.fn(() => ({
    slug: 'worker-session',
    sessionId: SESSION_ID,
    corsWorkerUrl: WORKER_ORIGIN,
    sessionModeProfile: { authority: { mode: 'worker_canonical' } },
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
  const controller = createSessionWizardPublishRuntimeController({
    runtimeRef: {
      current: {
        draft: {
          slug: 'worker-session',
          networkChainId: 11155420,
          sessionModeProfile: { authority: { mode: 'worker_canonical' } },
        },
        embeddedDeployHelperEnabled: true,
        latestChainBlock: 123,
        registryAddress: '0x2222222222222222222222222222222222222222',
        registryChainId: 11155420,
        sessionId: SESSION_ID,
        sessionIdHex: SESSION_ID,
        workerLimitPerWallet: 7,
      },
    },
    dispatch,
    getErrorMessage: (error) => (error instanceof Error ? error.message : String(error)),
    deployWorker: jest.fn(async () => ({ ok: true, deployComplete: true, workerUrl: WORKER_ORIGIN })),
    deployPendingSbts: jest.fn(async () => []),
    getCurrentWorkerSecrets: jest.fn(() => ({ openaiKey: 'test-only-key' })),
    resolveWorkerBaseUrl: jest.fn(() => WORKER_ORIGIN),
    resolveWorkerRpcUrl: jest.fn(() => ''),
    resolveWorkerRpcUrlMap: jest.fn(() => ({})),
    parseAllowOriginsInput: jest.fn(() => ['https://app.example.test']),
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
    events,
    handleRegisterGroup,
    persistWorkerConfig,
    runTrackedPublishEffect,
  };
};

describe('sessionWizardPublishRuntimeController', () => {
  it('persists worker config inside the tracked publish effect and returns the verified origin', async () => {
    const harness = createControllerHarness();

    const result = await harness.controller.runPreparation({
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

  it('settles worker-canonical publication only after verified persistence and rotates the draft identity', async () => {
    const harness = createControllerHarness();
    const preservedPendingSbtDrafts = [{
      predictedAddress: '0x00000000000000000000000000000000000000aa',
      deployed: false,
    }];

    await harness.controller.settleRegistration({
      preservedPendingSbtDrafts,
      publishExecutionPlan: {
        shouldRegisterSession: false,
        shouldRefreshRegistryCache: false,
      },
      uploadResult: null,
      publishControllerResult: {
        status: 'completed',
        workerUrlOverride: WORKER_ORIGIN,
        deployedPendingDrafts: [],
        verifiedWorkerConfig: { workerUrl: WORKER_ORIGIN },
      },
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
      'clear-cache',
      'write-settlement',
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

    await harness.controller.settleRegistration({
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
    harness.callbacks.clearSessionWizardCache.mockImplementationOnce(() => {
      harness.events.push('clear-cache-failed');
      return { ok: false, removed: 0, failed: 1, status: 'partial-failure' };
    });

    await expect(
      harness.controller.settleRegistration({
        publishExecutionPlan: { shouldRegisterSession: false },
        uploadResult: null,
        publishControllerResult: {
          status: 'completed',
          workerUrlOverride: WORKER_ORIGIN,
          deployedPendingDrafts: [],
          verifiedWorkerConfig: { workerUrl: WORKER_ORIGIN },
        },
        runTrackedPublishEffect: harness.runTrackedPublishEffect,
      }),
    ).rejects.toThrow('Could not durably clear the published session draft');

    expect(harness.callbacks.setWorkerCanonicalPublishSettled).toHaveBeenCalledWith({
      workerUrl: WORKER_ORIGIN,
      slug: 'worker-session',
      sessionId: SESSION_ID,
    });
    expect(harness.callbacks.writeSessionWizardWorkerSettlement).not.toHaveBeenCalled();
    expect(harness.callbacks.setSessionId).not.toHaveBeenCalled();
  });

  it('clears every publishable draft before a failed UX marker write and refuses identity rotation', async () => {
    const harness = createControllerHarness();
    harness.callbacks.writeSessionWizardWorkerSettlement.mockImplementationOnce(() => {
      harness.events.push('write-settlement-failed');
      return { ok: false, status: 'write-failed', error: 'quota' };
    });

    await expect(
      harness.controller.settleRegistration({
        publishExecutionPlan: { shouldRegisterSession: false },
        uploadResult: null,
        publishControllerResult: {
          status: 'completed',
          workerUrlOverride: WORKER_ORIGIN,
          deployedPendingDrafts: [],
          verifiedWorkerConfig: { workerUrl: WORKER_ORIGIN },
        },
        runTrackedPublishEffect: harness.runTrackedPublishEffect,
      }),
    ).rejects.toThrow('Could not durably record the published worker identity');

    expect(harness.callbacks.setWorkerCanonicalPublishSettled).toHaveBeenCalledWith({
      workerUrl: WORKER_ORIGIN,
      slug: 'worker-session',
      sessionId: SESSION_ID,
    });
    expect(harness.callbacks.clearSessionWizardCache).toHaveBeenCalledWith({
      workerSettlement: {
        workerUrl: WORKER_ORIGIN,
        slug: 'worker-session',
        sessionId: SESSION_ID,
      },
    });
    expect(harness.events.indexOf('clear-cache')).toBeLessThan(harness.events.indexOf('write-settlement-failed'));
    expect(harness.callbacks.setSessionId).not.toHaveBeenCalled();
  });
});
