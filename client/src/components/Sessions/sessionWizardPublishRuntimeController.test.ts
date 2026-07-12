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
    clearSessionWizardCache: jest.fn(() => events.push('clear-cache')),
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

    await harness.controller.settleRegistration({
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
    expect(harness.events).toHaveLength(6);
    expect(harness.events[0]).toContain('session-url:');
    expect(harness.events[0]).toContain('worker=');
    expect(harness.events[1]).toContain('admin-url:');
    expect(harness.events.slice(2)).toEqual([
      'admin-status:',
      'clear-cache',
      'session-id:next-session-id',
      'session-id-status:Generated a new session ID for your next session.',
    ]);
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
});
