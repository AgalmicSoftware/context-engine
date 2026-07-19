import {
  appendSessionWizardRegisterTxEntry,
  isSessionWizardRegisterDuplicatePreflightError,
  resolveSessionWizardPublishCompletionRequest,
  resolveSessionWizardPublishFailureSettlementDescriptor,
  resolveSessionWizardRegisterArgsDescriptor,
  resolveSessionWizardRegisterDuplicateCheckDescriptor,
  resolveSessionWizardRegisterFailureSettlementDescriptor,
  resolveSessionWizardRegisterIdentityDescriptor,
  resolveSessionWizardRegisterPreflightDescriptor,
  resolveSessionWizardRegisterSuccessSettlementDescriptor,
  resolveSessionWizardWorkerPublishSuccessSettlementDescriptor,
  resolveSessionWizardRegisterStepRequest,
  resolveSessionWizardPublishMetadataUploadRequest,
  resolveSessionWizardPublishAdminPreflightDescriptor,
  resolveSessionWizardPublishStartPreflightDescriptor,
  runSessionWizardRegisterStepController,
  runSessionWizardPublishMetadataUploadController,
  runSessionWizardPublishCompletionController,
  runSessionWizardPublishController,
} from './sessionWizardPublishController';

const buildPlan = (overrides = {}) => ({
  shouldAutoDeployWorker: true,
  stepNumbers: {
    'deploy-worker': 1,
  },
  ...overrides,
});

describe('runSessionWizardPublishController', () => {
  it('keeps blocked publish inert without calling side-effect ports', async () => {
    const deployWorker = jest.fn().mockResolvedValue({
      ok: true,
      deployComplete: true,
      workerUrl: 'https://worker.example',
    });
    const setPublishStep = jest.fn();

    await expect(
      runSessionWizardPublishController({
        input: {
          publishAllowed: false,
          publishExecutionPlan: buildPlan(),
        },
        ports: {
          deployWorker,
        },
        callbacks: {
          setPublishStep,
        },
      }),
    ).resolves.toEqual({
      status: 'blocked',
      workerUrlOverride: '',
      deployedPendingDrafts: [],
      verifiedWorkerConfig: null,
    });

    expect(deployWorker).not.toHaveBeenCalled();
    expect(setPublishStep).not.toHaveBeenCalled();
  });

  it('calls the worker deploy port and progress callback in publish order', async () => {
    const events: string[] = [];
    const deployWorker = jest.fn().mockImplementation(async () => {
      events.push('deployWorker');
      return {
        ok: true,
        deployComplete: true,
        workerUrl: 'https://deployed-worker.example',
      };
    });
    const setPublishStep = jest.fn((step) => {
      events.push(`setPublishStep:${step}`);
    });

    await expect(
      runSessionWizardPublishController({
        input: {
          publishAllowed: true,
          publishExecutionPlan: buildPlan({
            stepNumbers: {
              'deploy-worker': 3,
            },
          }),
        },
        ports: {
          deployWorker,
        },
        callbacks: {
          setPublishStep,
        },
      }),
    ).resolves.toEqual({
      status: 'completed',
      workerUrlOverride: 'https://deployed-worker.example',
      deployedPendingDrafts: [],
      verifiedWorkerConfig: null,
    });

    expect(events).toEqual(['setPublishStep:3', 'deployWorker']);
    expect(deployWorker).toHaveBeenCalledTimes(1);
  });

  it('skips worker deploy side effects when the plan has no auto-deploy step', async () => {
    const deployWorker = jest.fn();
    const setPublishStep = jest.fn();

    await expect(
      runSessionWizardPublishController({
        input: {
          publishAllowed: true,
          publishExecutionPlan: buildPlan({
            shouldAutoDeployWorker: false,
            stepNumbers: {
              'register-session': 1,
              done: 2,
            },
          }),
        },
        ports: {
          deployWorker,
        },
        callbacks: {
          setPublishStep,
        },
      }),
    ).resolves.toEqual({
      status: 'completed',
      workerUrlOverride: '',
      deployedPendingDrafts: [],
      verifiedWorkerConfig: null,
    });

    expect(deployWorker).not.toHaveBeenCalled();
    expect(setPublishStep).not.toHaveBeenCalled();
  });

  it('deploys pending SBTs after worker deploy with the resolved worker URL', async () => {
    const events: string[] = [];
    const deployWorker = jest.fn().mockImplementation(async () => {
      events.push('deployWorker');
      return {
        ok: true,
        deployComplete: true,
        workerUrl: 'https://deployed-worker.example',
      };
    });
    const deployPendingSbts = jest.fn().mockImplementation(async (args) => {
      events.push(`deployPendingSbts:${args.workerUrlOverride}:${args.signerAccountOverride}`);
      return [{ id: 'pending-sbt-1' }];
    });
    const setPublishStep = jest.fn((step) => {
      events.push(`setPublishStep:${step}`);
    });

    await expect(
      runSessionWizardPublishController({
        input: {
          publishAllowed: true,
          publishExecutionPlan: buildPlan({
            shouldDeployPendingSbts: true,
            stepNumbers: {
              'deploy-worker': 1,
              'deploy-sbts': 2,
            },
          }),
          signerAccountOverride: '0x00000000000000000000000000000000000000aa',
        },
        ports: {
          deployWorker,
          deployPendingSbts,
        },
        callbacks: {
          setPublishStep,
        },
      }),
    ).resolves.toEqual({
      status: 'completed',
      workerUrlOverride: 'https://deployed-worker.example',
      deployedPendingDrafts: [{ id: 'pending-sbt-1' }],
      verifiedWorkerConfig: null,
    });

    expect(events).toEqual([
      'setPublishStep:1',
      'deployWorker',
      'setPublishStep:2',
      'deployPendingSbts:https://deployed-worker.example:0x00000000000000000000000000000000000000aa',
    ]);
  });

  it('keeps pending SBT deploy args unchanged when no worker auto-deploy ran first', async () => {
    const deployWorker = jest.fn();
    const deployPendingSbts = jest.fn().mockResolvedValue([{ id: 'pending-only' }]);
    const setPublishStep = jest.fn();

    await expect(
      runSessionWizardPublishController({
        input: {
          publishAllowed: true,
          publishExecutionPlan: buildPlan({
            shouldAutoDeployWorker: false,
            shouldDeployPendingSbts: true,
            stepNumbers: {
              'deploy-sbts': 1,
            },
          }),
          signerAccountOverride: '0x00000000000000000000000000000000000000bb',
        },
        ports: {
          deployWorker,
          deployPendingSbts,
        },
        callbacks: {
          setPublishStep,
        },
      }),
    ).resolves.toEqual({
      status: 'completed',
      workerUrlOverride: '',
      deployedPendingDrafts: [{ id: 'pending-only' }],
      verifiedWorkerConfig: null,
    });

    expect(deployWorker).not.toHaveBeenCalled();
    expect(setPublishStep).toHaveBeenCalledWith(1);
    expect(deployPendingSbts).toHaveBeenCalledWith({
      workerUrlOverride: '',
      signerAccountOverride: '0x00000000000000000000000000000000000000bb',
    });
  });

  it('persists and verifies worker config after deploy before completing the controller', async () => {
    const events: string[] = [];
    const persistWorkerConfig = jest.fn(async (args) => {
      events.push(`persist:${args.workerUrlOverride}:${args.signerAccountOverride}`);
      return {
        workerUrl: 'https://deployed-worker.example',
        configRevision: 'revision-a',
        publicConfig: { slug: 'worker-session' },
      };
    });

    await expect(
      runSessionWizardPublishController({
        input: {
          publishAllowed: true,
          publishExecutionPlan: buildPlan({
            shouldPersistWorkerConfig: true,
            stepNumbers: {
              'deploy-worker': 1,
              'persist-worker-config': 2,
            },
          }),
          signerAccountOverride: '0x00000000000000000000000000000000000000aa',
        },
        ports: {
          deployWorker: async () => ({
            ok: true,
            deployComplete: true,
            workerUrl: 'https://deployed-worker.example',
          }),
          persistWorkerConfig,
        },
        callbacks: {
          setPublishStep: (step) => events.push(`step:${step}`),
        },
      }),
    ).resolves.toEqual({
      status: 'completed',
      workerUrlOverride: 'https://deployed-worker.example',
      deployedPendingDrafts: [],
      verifiedWorkerConfig: {
        workerUrl: 'https://deployed-worker.example',
        configRevision: 'revision-a',
        publicConfig: { slug: 'worker-session' },
      },
    });

    expect(events).toEqual([
      'step:1',
      'step:2',
      'persist:https://deployed-worker.example:0x00000000000000000000000000000000000000aa',
    ]);
  });

  it('fails closed when a worker-canonical plan lacks a persistence port', async () => {
    await expect(
      runSessionWizardPublishController({
        input: {
          publishAllowed: true,
          publishExecutionPlan: buildPlan({
            shouldAutoDeployWorker: false,
            shouldPersistWorkerConfig: true,
          }),
        },
        ports: { deployWorker: jest.fn() },
        callbacks: { setPublishStep: jest.fn() },
      }),
    ).rejects.toThrow('Worker config persistence port is required.');
  });

  it('maps failed deploy results to the existing worker deploy error message', async () => {
    await expect(
      runSessionWizardPublishController({
        input: {
          publishAllowed: true,
          publishExecutionPlan: buildPlan(),
        },
        ports: {
          deployWorker: jest.fn().mockResolvedValue({
            ok: false,
            error: 'Worker deploy failed upstream.',
          }),
        },
        callbacks: {
          setPublishStep: jest.fn(),
        },
      }),
    ).rejects.toThrow('Worker deploy failed upstream.');
  });

  it('stops forced publication when required worker secrets were not confirmed remotely', async () => {
    const persistWorkerConfig = jest.fn();

    await expect(
      runSessionWizardPublishController({
        input: {
          publishAllowed: true,
          publishExecutionPlan: buildPlan({
            shouldPersistWorkerConfig: true,
          }),
        },
        ports: {
          deployWorker: jest.fn().mockResolvedValue({
            ok: true,
            deployComplete: false,
            workerUrl: 'https://deployed-worker.example',
            requiredWorkerSecretsReady: false,
            requiredWorkerSecretFields: ['openaiKey'],
          }),
          persistWorkerConfig,
        },
        callbacks: {
          setPublishStep: jest.fn(),
        },
      }),
    ).rejects.toThrow(
      'Required worker secrets were not confirmed after deploy. Retry session creation to resume secret sync.',
    );

    expect(persistWorkerConfig).not.toHaveBeenCalled();
  });

  it('preserves thrown deploy errors', async () => {
    const error = new Error('network refused deploy request');

    await expect(
      runSessionWizardPublishController({
        input: {
          publishAllowed: true,
          publishExecutionPlan: buildPlan(),
        },
        ports: {
          deployWorker: jest.fn().mockRejectedValue(error),
        },
        callbacks: {
          setPublishStep: jest.fn(),
        },
      }),
    ).rejects.toBe(error);
  });

  it('preserves thrown pending SBT deploy errors', async () => {
    const error = new Error('pending SBT deploy failed');

    await expect(
      runSessionWizardPublishController({
        input: {
          publishAllowed: true,
          publishExecutionPlan: buildPlan({
            shouldAutoDeployWorker: false,
            shouldDeployPendingSbts: true,
            stepNumbers: {
              'deploy-sbts': 1,
            },
          }),
        },
        ports: {
          deployWorker: jest.fn(),
          deployPendingSbts: jest.fn().mockRejectedValue(error),
        },
        callbacks: {
          setPublishStep: jest.fn(),
        },
      }),
    ).rejects.toBe(error);
  });
});

describe('resolveSessionWizardPublishStartPreflightDescriptor', () => {
  it('keeps busy publish starts inert without resetting state or opening login', () => {
    expect(
      resolveSessionWizardPublishStartPreflightDescriptor({
        publishBusy: true,
        draftSlug: 'writers-room',
        loginComplete: true,
      }),
    ).toEqual({
      status: 'blocked',
      blockedReason: 'busy',
      shouldResetPublishState: false,
      shouldOpenLoginModal: false,
      statusMessage: '',
    });
  });

  it('describes slug validation failures with the existing status text', () => {
    expect(
      resolveSessionWizardPublishStartPreflightDescriptor({
        publishBusy: false,
        draftSlug: 'Writers Room',
        loginComplete: true,
      }),
    ).toEqual({
      status: 'blocked',
      blockedReason: 'invalid-slug',
      shouldResetPublishState: true,
      shouldOpenLoginModal: false,
      statusMessage: 'Session slugs must use lowercase letters, numbers, "_" or "-".',
    });
  });

  it('describes login-required publish starts without owning modal or status effects', () => {
    expect(
      resolveSessionWizardPublishStartPreflightDescriptor({
        publishBusy: false,
        draftSlug: 'writers-room',
        loginComplete: false,
        loginInProgress: false,
      }),
    ).toEqual({
      status: 'blocked',
      blockedReason: 'login-required',
      shouldResetPublishState: true,
      shouldOpenLoginModal: true,
      statusMessage: 'Connect your wallet to publish this session.',
    });

    expect(
      resolveSessionWizardPublishStartPreflightDescriptor({
        publishBusy: false,
        draftSlug: 'writers-room',
        loginComplete: false,
        loginInProgress: true,
      }),
    ).toEqual(
      expect.objectContaining({
        shouldOpenLoginModal: true,
        statusMessage: 'Finish logging in before publishing this session.',
      }),
    );
  });

  it('marks valid connected publish starts ready for parent-owned admin resolution', () => {
    expect(
      resolveSessionWizardPublishStartPreflightDescriptor({
        publishBusy: false,
        draftSlug: 'writers-room',
        loginComplete: true,
        loginInProgress: false,
      }),
    ).toEqual({
      status: 'ready',
      blockedReason: '',
      shouldResetPublishState: true,
      shouldOpenLoginModal: false,
      statusMessage: '',
    });
  });
});

describe('resolveSessionWizardPublishAdminPreflightDescriptor', () => {
  it('describes missing publisher state without owning the async admin lookup', () => {
    expect(
      resolveSessionWizardPublishAdminPreflightDescriptor({
        resolvedPublisher: '',
      }),
    ).toEqual({
      status: 'blocked',
      blockedReason: 'publisher-required',
      signerAccountOverride: '',
      shouldOpenLoginModal: true,
      statusMessage: 'Connect your wallet to publish this session.',
    });

    expect(
      resolveSessionWizardPublishAdminPreflightDescriptor({
        resolvedPublisher: null,
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'blocked',
        shouldOpenLoginModal: true,
      }),
    );
  });

  it('passes through the resolved publisher for later parent-owned publish ports', () => {
    expect(
      resolveSessionWizardPublishAdminPreflightDescriptor({
        resolvedPublisher: '0x00000000000000000000000000000000000000aa',
      }),
    ).toEqual({
      status: 'ready',
      blockedReason: '',
      signerAccountOverride: '0x00000000000000000000000000000000000000aa',
      shouldOpenLoginModal: false,
      statusMessage: '',
    });
  });
});

describe('resolveSessionWizardPublishMetadataUploadRequest', () => {
  it('describes upload dispatch identity without owning upload, route, wallet, or state effects', () => {
    const request = resolveSessionWizardPublishMetadataUploadRequest({
      publishExecutionPlan: buildPlan({
        shouldUploadMetadata: true,
        stepNumbers: {
          'upload-metadata': 4,
        },
      }),
      workerUrlOverride: 'https://worker.example.test',
      signerAccountOverride: '0x00000000000000000000000000000000000000aa',
    });

    expect(request).toEqual({
      shouldUploadMetadata: true,
      publishStep: 4,
      uploadArgs: {
        workerUrlOverride: 'https://worker.example.test',
        signerAccountOverride: '0x00000000000000000000000000000000000000aa',
      },
    });
    expect(Object.keys(request)).toEqual(['shouldUploadMetadata', 'publishStep', 'uploadArgs']);
    expect(Object.keys(request.uploadArgs)).toEqual(['workerUrlOverride', 'signerAccountOverride']);
  });

  it('keeps no-upload plans inert while preserving the would-be request identity', () => {
    expect(
      resolveSessionWizardPublishMetadataUploadRequest({
        publishExecutionPlan: buildPlan({
          shouldUploadMetadata: false,
          stepNumbers: {
            'upload-metadata': 2,
          },
        }),
        workerUrlOverride: 'https://unused-worker.example.test',
        signerAccountOverride: '0x00000000000000000000000000000000000000bb',
      }),
    ).toEqual({
      shouldUploadMetadata: false,
      publishStep: 2,
      uploadArgs: {
        workerUrlOverride: 'https://unused-worker.example.test',
        signerAccountOverride: '0x00000000000000000000000000000000000000bb',
      },
    });
  });
});

describe('runSessionWizardPublishMetadataUploadController', () => {
  const buildUploadRequest = (overrides = {}) => ({
    shouldUploadMetadata: true,
    publishStep: 3,
    uploadArgs: {
      workerUrlOverride: 'https://worker.example.test',
      signerAccountOverride: '0x00000000000000000000000000000000000000aa',
    },
    ...overrides,
  });

  it('keeps skipped upload requests inert without calling fake ports or state callbacks', async () => {
    const uploadMetadata = jest.fn();
    const setPublishStep = jest.fn();

    await expect(
      runSessionWizardPublishMetadataUploadController({
        request: buildUploadRequest({ shouldUploadMetadata: false }),
        ports: {
          uploadMetadata,
        },
        callbacks: {
          setPublishStep,
        },
      }),
    ).resolves.toEqual({
      status: 'skipped',
      uploadResult: null,
    });

    expect(uploadMetadata).not.toHaveBeenCalled();
    expect(setPublishStep).not.toHaveBeenCalled();
  });

  it('hands exact upload args to the fake port after the parent-owned progress callback', async () => {
    const events: string[] = [];
    const uploadResult = {
      metadataUri: 'ar://uploaded-metadata',
      onChainFields: { name: 'Writers Room' },
    };
    const uploadMetadata = jest.fn(async (args) => {
      events.push(`uploadMetadata:${args.workerUrlOverride}:${args.signerAccountOverride}`);
      return uploadResult;
    });
    const setPublishStep = jest.fn((step) => {
      events.push(`setPublishStep:${step}`);
    });

    await expect(
      runSessionWizardPublishMetadataUploadController({
        request: buildUploadRequest(),
        ports: {
          uploadMetadata,
        },
        callbacks: {
          setPublishStep,
        },
      }),
    ).resolves.toEqual({
      status: 'completed',
      uploadResult,
    });

    expect(events).toEqual([
      'setPublishStep:3',
      'uploadMetadata:https://worker.example.test:0x00000000000000000000000000000000000000aa',
    ]);
    expect(Object.keys(uploadMetadata.mock.calls[0][0])).toEqual(['workerUrlOverride', 'signerAccountOverride']);
  });

  it('preserves thrown upload errors without route, register, wallet, or contract callbacks', async () => {
    const error = new Error('metadata upload rejected');
    const callbacks = {
      setPublishStep: jest.fn(),
    };

    await expect(
      runSessionWizardPublishMetadataUploadController({
        request: buildUploadRequest(),
        ports: {
          uploadMetadata: jest.fn().mockRejectedValue(error),
        },
        callbacks,
      }),
    ).rejects.toBe(error);

    expect(Object.keys(callbacks)).toEqual(['setPublishStep']);
  });
});

describe('resolveSessionWizardRegisterStepRequest', () => {
  it('describes register progress and upload overrides without owning register execution', () => {
    const request = resolveSessionWizardRegisterStepRequest({
      publishExecutionPlan: buildPlan({
        stepNumbers: {
          'register-session': 4,
        },
      }),
      uploadResult: {
        metadataUri: 'ar://uploaded-metadata',
        onChainFields: {
          name: 'Writers Room',
          workerUrl: 'https://worker.example.test',
        },
      },
    });

    expect(request).toEqual({
      publishStep: 4,
      registerGroupArgs: {
        metadataUriOverride: 'ar://uploaded-metadata',
        sessionFieldsOverride: {
          name: 'Writers Room',
          workerUrl: 'https://worker.example.test',
        },
      },
    });
    expect(Object.keys(request)).toEqual(['publishStep', 'registerGroupArgs']);
    expect(Object.keys(request.registerGroupArgs)).toEqual(['metadataUriOverride', 'sessionFieldsOverride']);
  });

  it('keeps manual metadata fallback registration args unset while preserving the progress step', () => {
    expect(
      resolveSessionWizardRegisterStepRequest({
        publishExecutionPlan: buildPlan({
          stepNumbers: {
            'register-session': 1,
          },
        }),
        uploadResult: null,
      }),
    ).toEqual({
      publishStep: 1,
      registerGroupArgs: {
        metadataUriOverride: undefined,
        sessionFieldsOverride: undefined,
      },
    });
  });
});

describe('resolveSessionWizardRegisterIdentityDescriptor', () => {
  it('normalizes register identity values without owning duplicate registry reads', () => {
    expect(
      resolveSessionWizardRegisterIdentityDescriptor({
        draftSlug: ' writers-room ',
        sessionId: '00000000-0000-0000-0000-000000000001',
        registryChainId: '84532',
        sessionNetworkChainId: '11155420',
        registryAddress: '0x0000000000000000000000000000000000000abc',
      }),
    ).toEqual({
      status: 'ready',
      blockedReason: '',
      registrySlug: 'writers-room',
      sessionIdHexValue: '0x00000000000000000000000000000001',
      registryChainIdValue: 84532,
      statusMessage: '',
    });
  });

  it('keeps the on-chain general slug mapping and falls back to the session chain id', () => {
    expect(
      resolveSessionWizardRegisterIdentityDescriptor({
        draftSlug: '',
        sessionId: '0x00000000000000000000000000000002',
        registryChainId: '',
        sessionNetworkChainId: 11155420,
        registryAddress: '0x0000000000000000000000000000000000000abc',
      }),
    ).toEqual({
      status: 'ready',
      blockedReason: '',
      registrySlug: 'general',
      sessionIdHexValue: '0x00000000000000000000000000000002',
      registryChainIdValue: 11155420,
      statusMessage: '',
    });
  });

  it('describes missing session id and registry address using the existing messages', () => {
    expect(
      resolveSessionWizardRegisterIdentityDescriptor({
        draftSlug: 'writers-room',
        sessionId: '',
        registryChainId: 84532,
        sessionNetworkChainId: 11155420,
        registryAddress: '0x0000000000000000000000000000000000000abc',
      }),
    ).toEqual({
      status: 'blocked',
      blockedReason: 'session-id-required',
      registrySlug: 'writers-room',
      sessionIdHexValue: '',
      registryChainIdValue: 84532,
      statusMessage: 'Session ID (UUID) is required.',
    });

    expect(
      resolveSessionWizardRegisterIdentityDescriptor({
        draftSlug: 'writers-room',
        sessionId: '0x00000000000000000000000000000003',
        registryChainId: 84532,
        sessionNetworkChainId: 11155420,
        registryAddress: '',
      }),
    ).toEqual({
      status: 'blocked',
      blockedReason: 'registry-address-required',
      registrySlug: 'writers-room',
      sessionIdHexValue: '0x00000000000000000000000000000003',
      registryChainIdValue: 84532,
      statusMessage: 'Registry address is not configured for this chain.',
    });
  });
});

describe('resolveSessionWizardRegisterDuplicateCheckDescriptor', () => {
  it('describes registry duplicate-check inputs and existing duplicate messages without owning contract reads', () => {
    const descriptor = resolveSessionWizardRegisterDuplicateCheckDescriptor({
      registryChainId: '84532',
      registrySlug: ' writers-room ',
      sessionIdHexValue: ' 0x00000000000000000000000000000001 ',
    });

    expect(descriptor).toEqual({
      chainId: 84532,
      registrySlug: 'writers-room',
      sessionIdHexValue: '0x00000000000000000000000000000001',
      shouldCheckSlug: true,
      shouldCheckSessionId: true,
      slugDuplicateMessage: 'Session slug already exists on-chain: writers-room',
      sessionIdDuplicateMessage: 'Session ID already exists on-chain. Generate a new session ID.',
    });
    expect(Object.keys(descriptor)).toEqual([
      'chainId',
      'registrySlug',
      'sessionIdHexValue',
      'shouldCheckSlug',
      'shouldCheckSessionId',
      'slugDuplicateMessage',
      'sessionIdDuplicateMessage',
    ]);
  });

  it('keeps empty duplicate-check targets inert for callers that own registry execution', () => {
    expect(
      resolveSessionWizardRegisterDuplicateCheckDescriptor({
        registryChainId: '',
        registrySlug: '',
        sessionIdHexValue: '',
      }),
    ).toEqual({
      chainId: 0,
      registrySlug: '',
      sessionIdHexValue: '',
      shouldCheckSlug: false,
      shouldCheckSessionId: false,
      slugDuplicateMessage: 'Session slug already exists on-chain: ',
      sessionIdDuplicateMessage: 'Session ID already exists on-chain. Generate a new session ID.',
    });
  });

  it('classifies only exact registry duplicate messages as fail-closed preflight errors', () => {
    const descriptor = resolveSessionWizardRegisterDuplicateCheckDescriptor({
      registryChainId: '84532',
      registrySlug: 'writers-room',
      sessionIdHexValue: '0x00000000000000000000000000000001',
    });

    expect(
      isSessionWizardRegisterDuplicatePreflightError('Session slug already exists on-chain: writers-room', descriptor),
    ).toBe(true);
    expect(
      isSessionWizardRegisterDuplicatePreflightError(
        'Session ID already exists on-chain. Generate a new session ID.',
        descriptor,
      ),
    ).toBe(true);
    expect(isSessionWizardRegisterDuplicatePreflightError('could not detect network', descriptor)).toBe(false);
  });
});

describe('resolveSessionWizardRegisterArgsDescriptor', () => {
  const arweaveTxId = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12';

  it('builds the on-chain register payload while preserving parent-owned execution ports', () => {
    const gateSelections = {
      default: {
        mode: 'all',
        sbts: [],
      },
    };
    const sessionFieldsOverride = {
      name: 'Writers Room',
      workerUrl: 'https://worker.example.test',
    };

    const descriptor = resolveSessionWizardRegisterArgsDescriptor({
      providerLike: { kind: 'provider' },
      registryChainId: '84532',
      sessionNetworkChainId: '11155420',
      registryAddress: '0x0000000000000000000000000000000000000abc',
      registrySlug: ' writers-room ',
      sessionIdHexValue: ' 0x00000000000000000000000000000001 ',
      metadataUriOverride: `https://arweave.net/${arweaveTxId}`,
      manualMetadataUrl: 'ar://manual-metadata',
      metadataUrl: 'ar://uploaded-metadata',
      gateSelectionsSnapshot: gateSelections,
      sessionFieldsOverride,
      pendingOnChainFields: {
        name: 'Pending Fields',
      },
      manualGasLimit: '1200000',
      manualGasPriceGwei: '',
      manualMaxFeePerGasGwei: '2',
      manualMaxPriorityFeePerGasGwei: '1',
    });

    expect(descriptor).toEqual({
      metadataUriMissing: false,
      registerArgs: {
        providerLike: { kind: 'provider' },
        chainId: 84532,
        registryAddress: '0x0000000000000000000000000000000000000abc',
        slug: 'writers-room',
        sessionId: '0x00000000000000000000000000000001',
        sessionChainId: 11155420,
        metadataURI: `ar://${arweaveTxId}`,
        encryptedMetadataURI: '',
        gateSelections,
        sessionFields: sessionFieldsOverride,
        gasLimitOverride: '1200000',
        gasPriceGwei: '',
        maxFeePerGasGwei: '2',
        maxPriorityFeePerGasGwei: '1',
      },
    });
    expect(Object.keys(descriptor.registerArgs)).toEqual([
      'providerLike',
      'chainId',
      'registryAddress',
      'slug',
      'sessionId',
      'sessionChainId',
      'metadataURI',
      'encryptedMetadataURI',
      'gateSelections',
      'sessionFields',
      'gasLimitOverride',
      'gasPriceGwei',
      'maxFeePerGasGwei',
      'maxPriorityFeePerGasGwei',
    ]);
  });

  it('falls back to manual or uploaded metadata and pending session fields', () => {
    expect(
      resolveSessionWizardRegisterArgsDescriptor({
        registryChainId: '',
        sessionNetworkChainId: 11155420,
        metadataUriOverride: '',
        manualMetadataUrl: ' ar://manual-metadata ',
        metadataUrl: 'ar://uploaded-metadata',
        sessionFieldsOverride: undefined,
        pendingOnChainFields: {
          name: 'Pending Fields',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        metadataUriMissing: false,
        registerArgs: expect.objectContaining({
          chainId: 11155420,
          sessionChainId: 11155420,
          metadataURI: 'ar://manual-metadata',
          sessionFields: {
            name: 'Pending Fields',
          },
        }),
      }),
    );

    expect(
      resolveSessionWizardRegisterArgsDescriptor({
        registryChainId: '',
        sessionNetworkChainId: 11155420,
        metadataUriOverride: '',
        manualMetadataUrl: '',
        metadataUrl: 'ar://uploaded-metadata',
        sessionFieldsOverride: null,
        pendingOnChainFields: {
          name: 'Pending Fields',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        metadataUriMissing: false,
        registerArgs: expect.objectContaining({
          metadataURI: 'ar://uploaded-metadata',
          sessionFields: {},
        }),
      }),
    );
  });

  it('reports missing metadata without throwing or calling side-effect ports', () => {
    expect(
      resolveSessionWizardRegisterArgsDescriptor({
        registryChainId: 11155420,
        sessionNetworkChainId: 11155420,
        metadataUriOverride: '',
        manualMetadataUrl: '',
        metadataUrl: '',
        gateSelectionsSnapshot: [],
        pendingOnChainFields: {},
      }),
    ).toEqual(
      expect.objectContaining({
        metadataUriMissing: true,
        registerArgs: expect.objectContaining({
          metadataURI: '',
        }),
      }),
    );
  });
});

describe('resolveSessionWizardRegisterPreflightDescriptor', () => {
  it('marks metadata-backed register requests ready without owning register execution', () => {
    const descriptor = resolveSessionWizardRegisterPreflightDescriptor({
      providerLike: { kind: 'provider' },
      registryChainId: '84532',
      sessionNetworkChainId: '11155420',
      registryAddress: '0x0000000000000000000000000000000000000abc',
      registrySlug: ' writers-room ',
      sessionIdHexValue: ' 0x00000000000000000000000000000001 ',
      metadataUriOverride: 'ar://uploaded-metadata',
      gateSelectionsSnapshot: {
        default: {
          mode: 'any',
          sbts: [],
        },
      },
      sessionFieldsOverride: {
        name: 'Writers Room',
      },
    });

    expect(descriptor).toEqual(
      expect.objectContaining({
        canRegister: true,
        metadataUriMissing: false,
        statusMessage: '',
        registerArgs: expect.objectContaining({
          chainId: 84532,
          registryAddress: '0x0000000000000000000000000000000000000abc',
          slug: 'writers-room',
          sessionId: '0x00000000000000000000000000000001',
          sessionChainId: 11155420,
          metadataURI: 'ar://uploaded-metadata',
          sessionFields: {
            name: 'Writers Room',
          },
        }),
      }),
    );
    expect(Object.keys(descriptor)).toEqual(['metadataUriMissing', 'registerArgs', 'canRegister', 'statusMessage']);
  });

  it('describes missing-metadata preflight with the existing status text and no side-effect ports', () => {
    const descriptor = resolveSessionWizardRegisterPreflightDescriptor({
      registryChainId: 11155420,
      sessionNetworkChainId: 11155420,
      metadataUriOverride: '',
      manualMetadataUrl: '',
      metadataUrl: '',
      pendingOnChainFields: {},
    });

    expect(descriptor).toEqual(
      expect.objectContaining({
        canRegister: false,
        metadataUriMissing: true,
        statusMessage: 'Upload metadata or provide a manual Arweave URI.',
        registerArgs: expect.objectContaining({
          metadataURI: '',
        }),
      }),
    );
  });

  it('allows callers to override the blocked metadata message without changing register args', () => {
    expect(
      resolveSessionWizardRegisterPreflightDescriptor({
        registryChainId: 11155420,
        sessionNetworkChainId: 11155420,
        metadataUriOverride: '',
        manualMetadataUrl: '',
        metadataUrl: '',
        missingMetadataMessage: 'Provide metadata first.',
      }),
    ).toEqual(
      expect.objectContaining({
        canRegister: false,
        statusMessage: 'Provide metadata first.',
        registerArgs: expect.objectContaining({
          chainId: 11155420,
          metadataURI: '',
        }),
      }),
    );
  });
});

describe('resolveSessionWizardRegisterSuccessSettlementDescriptor', () => {
  it('describes post-register URLs, status reset, and refresh lookup args without owning effects', () => {
    const providerLike = { kind: 'provider' };

    const descriptor = resolveSessionWizardRegisterSuccessSettlementDescriptor({
      registrySlug: ' writers-room ',
      sessionIdHexValue: '0x00000000000000000000000000000001',
      registryChainId: '84532',
      sessionNetworkChainId: '11155420',
      providerLike,
      account: '0x00000000000000000000000000000000000000aa',
      origin: 'https://context.example',
    });

    expect(descriptor).toEqual({
      formattedSessionId: '00000000-0000-0000-0000-000000000001',
      sessionUrl: 'https://context.example/session/writers-room',
      adminUrl: 'https://context.example/admin?sessionId=00000000-0000-0000-0000-000000000001&chainId=84532',
      adminUrlStatus: '',
      nextSessionIdStatus: 'Generated a new session ID for your next session.',
      registryRefreshArgs: {
        chainId: 84532,
        slug: 'writers-room',
        providerLike,
        account: '0x00000000000000000000000000000000000000aa',
      },
    });
    expect(Object.keys(descriptor)).toEqual([
      'formattedSessionId',
      'sessionUrl',
      'adminUrl',
      'adminUrlStatus',
      'nextSessionIdStatus',
      'registryRefreshArgs',
    ]);
    expect(Object.keys(descriptor.registryRefreshArgs)).toEqual(['chainId', 'slug', 'providerLike', 'account']);
  });

  it('falls back to raw session IDs and the session chain for malformed registry input', () => {
    expect(
      resolveSessionWizardRegisterSuccessSettlementDescriptor({
        registrySlug: '',
        sessionIdHexValue: 'not-a-uuid',
        registryChainId: '',
        sessionNetworkChainId: 11155420,
        origin: 'https://context.example',
      }),
    ).toEqual(
      expect.objectContaining({
        formattedSessionId: 'not-a-uuid',
        sessionUrl: '',
        adminUrl: 'https://context.example/admin?sessionId=not-a-uuid&chainId=11155420',
        registryRefreshArgs: expect.objectContaining({
          chainId: 11155420,
          slug: '',
        }),
      }),
    );
  });
});

describe('resolveSessionWizardWorkerPublishSuccessSettlementDescriptor', () => {
  it('builds reload-safe session and admin links with the verified worker origin', () => {
    expect(
      resolveSessionWizardWorkerPublishSuccessSettlementDescriptor({
        slug: 'worker-session',
        sessionId: '0x00000000000000000000000000000001',
        workerOrigin: 'https://worker.example/',
        origin: 'https://context.example',
      }),
    ).toEqual({
      formattedSessionId: '00000000-0000-0000-0000-000000000001',
      sessionUrl: 'https://context.example/session/worker-session?worker=https%3A%2F%2Fworker.example',
      adminUrl:
        'https://context.example/admin?sessionId=00000000-0000-0000-0000-000000000001&sessionSlug=worker-session&worker=https%3A%2F%2Fworker.example',
      adminUrlStatus: '',
      nextSessionIdStatus: 'Generated a new session ID for your next session.',
    });
  });
});

describe('resolveSessionWizardRegisterFailureSettlementDescriptor', () => {
  it('describes transaction hash recovery and status text for register failures', () => {
    expect(
      resolveSessionWizardRegisterFailureSettlementDescriptor({
        error: {
          transactionHash: '0xaaa',
          message: 'registry write reverted',
        },
      }),
    ).toEqual({
      txEntry: {
        action: 'createSession',
        hash: '0xaaa',
      },
      errorMessage: 'registry write reverted',
    });
  });

  it('falls back to nested transaction hashes and default failure copy', () => {
    expect(
      resolveSessionWizardRegisterFailureSettlementDescriptor({
        error: {
          transaction: {
            hash: '0xbbb',
          },
        },
      }),
    ).toEqual({
      txEntry: {
        action: 'createSession',
        hash: '0xbbb',
      },
      errorMessage: 'Failed to register session.',
    });
  });

  it('keeps malformed errors inert without creating tx entries', () => {
    expect(
      resolveSessionWizardRegisterFailureSettlementDescriptor({
        error: 'failed',
      }),
    ).toEqual({
      txEntry: null,
      errorMessage: 'Failed to register session.',
    });
  });
});

describe('appendSessionWizardRegisterTxEntry', () => {
  it('appends unique register tx entries without mutating previous state', () => {
    const previousEntries = [{ action: 'createSession', hash: '0xaaa' }];
    const nextEntries = appendSessionWizardRegisterTxEntry(previousEntries, {
      action: 'createSession',
      hash: '0xbbb',
    });

    expect(nextEntries).toEqual([
      { action: 'createSession', hash: '0xaaa' },
      { action: 'createSession', hash: '0xbbb' },
    ]);
    expect(nextEntries).not.toBe(previousEntries);
  });

  it('preserves existing state for duplicate or empty tx entries', () => {
    const previousEntries = [{ action: 'createSession', hash: '0xaaa' }];

    expect(
      appendSessionWizardRegisterTxEntry(previousEntries, {
        action: 'createSession',
        hash: '0xaaa',
      }),
    ).toBe(previousEntries);
    expect(appendSessionWizardRegisterTxEntry(previousEntries, null)).toBe(previousEntries);
    expect(
      appendSessionWizardRegisterTxEntry('not-array', {
        action: 'createSession',
        hash: '',
      }),
    ).toEqual([]);
  });
});

describe('resolveSessionWizardPublishCompletionRequest', () => {
  it('describes completion controller input without owning completion callbacks', () => {
    const deployedPendingDrafts = [{ id: 'deployed-draft', deployed: true }];
    const pendingDraftSnapshot = [{ id: 'snapshot-draft', deployed: false }];
    const publishExecutionPlan = buildPlan({
      stepNumbers: {
        done: 5,
      },
    });

    expect(
      resolveSessionWizardPublishCompletionRequest({
        publishExecutionPlan,
        deployedPendingDrafts,
        pendingDraftSnapshot,
        sessionSlug: ' writers-room ',
      }),
    ).toEqual({
      publishExecutionPlan,
      deployedPendingDrafts,
      pendingDraftSnapshot,
      sessionSlug: 'writers-room',
    });
  });

  it('keeps malformed completion draft inputs inert', () => {
    const publishExecutionPlan = buildPlan({
      stepNumbers: {
        done: 2,
      },
    });

    expect(
      resolveSessionWizardPublishCompletionRequest({
        publishExecutionPlan,
        deployedPendingDrafts: null,
        pendingDraftSnapshot: null,
        sessionSlug: null,
      }),
    ).toEqual({
      publishExecutionPlan,
      deployedPendingDrafts: [],
      pendingDraftSnapshot: [],
      sessionSlug: '',
    });
  });
});

describe('resolveSessionWizardPublishFailureSettlementDescriptor', () => {
  it('describes publish failure status and progress reset without owning state effects', () => {
    expect(
      resolveSessionWizardPublishFailureSettlementDescriptor({
        error: new Error('worker deploy rejected'),
      }),
    ).toEqual({
      errorMessage: 'worker deploy rejected',
      publishStep: 0,
    });
  });

  it('falls back to the existing publish failure copy for malformed errors', () => {
    expect(
      resolveSessionWizardPublishFailureSettlementDescriptor({
        error: 'failed',
      }),
    ).toEqual({
      errorMessage: 'Publish failed.',
      publishStep: 0,
    });

    expect(resolveSessionWizardPublishFailureSettlementDescriptor({})).toEqual({
      errorMessage: 'Publish failed.',
      publishStep: 0,
    });

    expect(
      resolveSessionWizardPublishFailureSettlementDescriptor({
        error: { message: '' },
      }),
    ).toEqual({
      errorMessage: 'Publish failed.',
      publishStep: 0,
    });
  });
});

describe('runSessionWizardPublishCompletionController', () => {
  it('promotes deployed drafts, publishes links, retains undeployed drafts, and marks done in order', () => {
    const events: string[] = [];
    const normalizedDeployedDrafts = [
      {
        predictedAddress: '0x00000000000000000000000000000000000000aA',
        deployedAddress: '0x00000000000000000000000000000000000000aA',
        displayName: 'Newly Deployed Group',
        deployed: true,
      },
    ];
    const resumedDeployedDraft = {
      predictedAddress: '0x00000000000000000000000000000000000000Bb',
      deployedAddress: '0x00000000000000000000000000000000000000Bb',
      displayName: 'Previously Deployed Group',
      deployed: true,
    };
    const pendingDraftSnapshot = [
      {
        predictedAddress: '0x00000000000000000000000000000000000000aa',
        deployedAddress: '0x00000000000000000000000000000000000000aa',
        displayName: 'Newly Deployed Group',
        deployed: true,
      },
      resumedDeployedDraft,
      {
        predictedAddress: '0x00000000000000000000000000000000000000cc',
        displayName: 'Still Pending Group',
        deployed: false,
      },
    ];
    const publishedLinks = [
      {
        address: '0x00000000000000000000000000000000000000aa',
        href: '/sbt/0xaa',
        label: 'Newly Deployed Group',
      },
    ];
    const normalizePendingDrafts = jest.fn((drafts) => {
      events.push('normalizePendingDrafts');
      expect(drafts).toEqual([{ id: 'raw-deployed-draft' }]);
      return normalizedDeployedDrafts;
    });
    const promoteDeployedPendingSbtSelections = jest.fn((drafts) => {
      events.push('promoteDeployedPendingSbtSelections');
      expect(drafts).toEqual([...normalizedDeployedDrafts, resumedDeployedDraft]);
    });
    const buildPublishedPendingSbtLinks = jest.fn((args) => {
      events.push('buildPublishedPendingSbtLinks');
      expect(args).toEqual({
        deployedDrafts: normalizedDeployedDrafts,
        pendingDraftSnapshot,
        sessionSlug: 'writers-room',
      });
      return publishedLinks;
    });
    const setPublishedPendingSbtLinks = jest.fn((links) => {
      events.push('setPublishedPendingSbtLinks');
      expect(links).toBe(publishedLinks);
    });
    const replacePendingSbtDrafts = jest.fn((drafts) => {
      events.push('replacePendingSbtDrafts');
      expect(drafts).toEqual([pendingDraftSnapshot[2]]);
    });
    const setPublishStep = jest.fn((step) => {
      events.push(`setPublishStep:${step}`);
    });

    expect(
      runSessionWizardPublishCompletionController({
        input: {
          publishExecutionPlan: buildPlan({
            shouldDeployPendingSbts: true,
            stepNumbers: {
              done: 5,
            },
          }),
          deployedPendingDrafts: [{ id: 'raw-deployed-draft' }],
          pendingDraftSnapshot,
          sessionSlug: ' writers-room ',
        },
        ports: {
          normalizePendingDrafts,
          buildPublishedPendingSbtLinks,
        },
        callbacks: {
          promoteDeployedPendingSbtSelections,
          setPublishedPendingSbtLinks,
          replacePendingSbtDrafts,
          setPublishStep,
        },
      }),
    ).toEqual({
      normalizedDeployedPendingDrafts: normalizedDeployedDrafts,
      publishedPendingSbtLinks: publishedLinks,
      remainingPendingDrafts: [pendingDraftSnapshot[2]],
    });

    expect(events).toEqual([
      'normalizePendingDrafts',
      'promoteDeployedPendingSbtSelections',
      'buildPublishedPendingSbtLinks',
      'setPublishedPendingSbtLinks',
      'replacePendingSbtDrafts',
      'setPublishStep:5',
    ]);
  });

  it('preserves undeployed pending drafts when the selected mode suppresses SBT deployment', () => {
    const pendingDraft = {
      predictedAddress: '0x00000000000000000000000000000000000000cc',
      displayName: 'Deferred Group',
      deployed: false,
    };
    const replacePendingSbtDrafts = jest.fn();

    runSessionWizardPublishCompletionController({
      input: {
        publishExecutionPlan: buildPlan({
          shouldDeployPendingSbts: false,
          stepNumbers: { done: 2 },
        }),
        deployedPendingDrafts: [],
        pendingDraftSnapshot: [pendingDraft],
        sessionSlug: 'worker-session',
      },
      ports: {
        normalizePendingDrafts: (drafts) => [...drafts],
        buildPublishedPendingSbtLinks: () => [],
      },
      callbacks: {
        promoteDeployedPendingSbtSelections: jest.fn(),
        setPublishedPendingSbtLinks: jest.fn(),
        replacePendingSbtDrafts,
        setPublishStep: jest.fn(),
      },
    });

    expect(replacePendingSbtDrafts).toHaveBeenCalledWith([pendingDraft]);
  });

  it('preserves completion failure behavior by stopping later callbacks', () => {
    const error = new Error('promotion failed');
    const setPublishedPendingSbtLinks = jest.fn();
    const replacePendingSbtDrafts = jest.fn();
    const setPublishStep = jest.fn();

    expect(() =>
      runSessionWizardPublishCompletionController({
        input: {
          publishExecutionPlan: buildPlan({
            stepNumbers: {
              done: 3,
            },
          }),
          deployedPendingDrafts: [{ predictedAddress: '0x1', deployed: true }],
          pendingDraftSnapshot: [],
          sessionSlug: 'writers-room',
        },
        ports: {
          normalizePendingDrafts: jest.fn((drafts) => drafts),
          buildPublishedPendingSbtLinks: jest.fn(() => []),
        },
        callbacks: {
          promoteDeployedPendingSbtSelections: jest.fn(() => {
            throw error;
          }),
          setPublishedPendingSbtLinks,
          replacePendingSbtDrafts,
          setPublishStep,
        },
      }),
    ).toThrow(error);

    expect(setPublishedPendingSbtLinks).not.toHaveBeenCalled();
    expect(replacePendingSbtDrafts).not.toHaveBeenCalled();
    expect(setPublishStep).not.toHaveBeenCalled();
  });
});

describe('runSessionWizardRegisterStepController', () => {
  const registerArgs = {
    providerLike: { kind: 'provider' },
    chainId: 84532,
    registryAddress: '0x0000000000000000000000000000000000000abc',
    slug: 'writers-room',
    sessionId: '0x00000000000000000000000000000001',
    sessionChainId: 11155420,
    metadataURI: 'ar://metadata-tx',
    encryptedMetadataURI: '',
    gateSelections: [{ gateId: 'gate-a', sbtAddresses: ['0x00000000000000000000000000000000000000aa'] }],
    sessionFields: {
      name: 'Writers Room',
      workerUrl: 'https://worker.example.test',
    },
    gasLimitOverride: '1200000',
    gasPriceGwei: '',
    maxFeePerGasGwei: '2',
    maxPriorityFeePerGasGwei: '1',
  };

  it('pins register payload shape and status/tx callback order around the injected port', async () => {
    const events: string[] = [];
    const txEntry = { action: 'createSession', hash: '0xaaa' };
    const finalTxs = [{ action: 'createSession', hash: '0xbbb' }];
    const registerSessionOnChain = jest.fn(async (args) => {
      events.push('registerSessionOnChain');
      expect(Object.keys(args)).toEqual([
        'providerLike',
        'chainId',
        'registryAddress',
        'slug',
        'sessionId',
        'sessionChainId',
        'metadataURI',
        'encryptedMetadataURI',
        'gateSelections',
        'sessionFields',
        'gasLimitOverride',
        'gasPriceGwei',
        'maxFeePerGasGwei',
        'maxPriorityFeePerGasGwei',
        'onTxHash',
      ]);
      expect(args).toMatchObject(registerArgs);
      args.onTxHash(txEntry);
      return { txs: finalTxs };
    });
    const setRegisterTxs = jest.fn((value) => {
      if (typeof value === 'function') {
        events.push('setRegisterTxs:update');
        expect(value([])).toEqual([txEntry]);
        return;
      }
      events.push(`setRegisterTxs:${JSON.stringify(value)}`);
    });
    const setStatus = jest.fn((status) => {
      events.push(`setStatus:${status}`);
    });

    await expect(
      runSessionWizardRegisterStepController({
        input: {
          registerArgs,
        },
        ports: {
          registerSessionOnChain,
        },
        callbacks: {
          setRegisterTxs,
          setStatus,
        },
      }),
    ).resolves.toEqual({
      status: 'completed',
      registerResult: { txs: finalTxs },
    });

    expect(events).toEqual([
      'setRegisterTxs:[]',
      'setStatus:Registering session on-chain…',
      'registerSessionOnChain',
      'setRegisterTxs:update',
      'setRegisterTxs:[{"action":"createSession","hash":"0xbbb"}]',
      'setStatus:Session registered on-chain.',
    ]);
  });

  it('does not replace tx state when the register port returns no final tx list', async () => {
    const setRegisterTxs = jest.fn();
    const onChainTx = { action: 'createSession', hash: '0xccc' };

    await runSessionWizardRegisterStepController({
      input: {
        registerArgs,
      },
      ports: {
        registerSessionOnChain: jest.fn(async (args) => {
          args.onTxHash(onChainTx);
          return { txs: [] };
        }),
      },
      callbacks: {
        setRegisterTxs,
        setStatus: jest.fn(),
      },
    });

    expect(setRegisterTxs).toHaveBeenCalledTimes(2);
    expect(setRegisterTxs).toHaveBeenNthCalledWith(1, []);
    expect(typeof setRegisterTxs.mock.calls[1][0]).toBe('function');
  });

  it('preserves thrown register errors and stops success callbacks', async () => {
    const error = new Error('registry write reverted');
    const setStatus = jest.fn();

    await expect(
      runSessionWizardRegisterStepController({
        input: {
          registerArgs,
        },
        ports: {
          registerSessionOnChain: jest.fn().mockRejectedValue(error),
        },
        callbacks: {
          setRegisterTxs: jest.fn(),
          setStatus,
        },
      }),
    ).rejects.toBe(error);

    expect(setStatus).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenCalledWith('Registering session on-chain…');
  });
});
