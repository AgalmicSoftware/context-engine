import {
  resolveSessionWizardPublishMetadataUploadRequest,
  runSessionWizardRegisterStepController,
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

    await expect(runSessionWizardPublishController({
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
    })).resolves.toEqual({
      status: 'blocked',
      workerUrlOverride: '',
      deployedPendingDrafts: [],
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

    await expect(runSessionWizardPublishController({
      input: {
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
    })).resolves.toEqual({
      status: 'completed',
      workerUrlOverride: 'https://deployed-worker.example',
      deployedPendingDrafts: [],
    });

    expect(events).toEqual([
      'setPublishStep:3',
      'deployWorker',
    ]);
    expect(deployWorker).toHaveBeenCalledTimes(1);
  });

  it('skips worker deploy side effects when the plan has no auto-deploy step', async () => {
    const deployWorker = jest.fn();
    const setPublishStep = jest.fn();

    await expect(runSessionWizardPublishController({
      input: {
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
    })).resolves.toEqual({
      status: 'completed',
      workerUrlOverride: '',
      deployedPendingDrafts: [],
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

    await expect(runSessionWizardPublishController({
      input: {
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
    })).resolves.toEqual({
      status: 'completed',
      workerUrlOverride: 'https://deployed-worker.example',
      deployedPendingDrafts: [{ id: 'pending-sbt-1' }],
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

    await expect(runSessionWizardPublishController({
      input: {
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
    })).resolves.toEqual({
      status: 'completed',
      workerUrlOverride: '',
      deployedPendingDrafts: [{ id: 'pending-only' }],
    });

    expect(deployWorker).not.toHaveBeenCalled();
    expect(setPublishStep).toHaveBeenCalledWith(1);
    expect(deployPendingSbts).toHaveBeenCalledWith({
      workerUrlOverride: '',
      signerAccountOverride: '0x00000000000000000000000000000000000000bb',
    });
  });

  it('maps failed deploy results to the existing worker deploy error message', async () => {
    await expect(runSessionWizardPublishController({
      input: {
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
    })).rejects.toThrow('Worker deploy failed upstream.');
  });

  it('preserves thrown deploy errors', async () => {
    const error = new Error('network refused deploy request');

    await expect(runSessionWizardPublishController({
      input: {
        publishExecutionPlan: buildPlan(),
      },
      ports: {
        deployWorker: jest.fn().mockRejectedValue(error),
      },
      callbacks: {
        setPublishStep: jest.fn(),
      },
    })).rejects.toBe(error);
  });

  it('preserves thrown pending SBT deploy errors', async () => {
    const error = new Error('pending SBT deploy failed');

    await expect(runSessionWizardPublishController({
      input: {
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
    })).rejects.toBe(error);
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
    expect(Object.keys(request)).toEqual([
      'shouldUploadMetadata',
      'publishStep',
      'uploadArgs',
    ]);
    expect(Object.keys(request.uploadArgs)).toEqual([
      'workerUrlOverride',
      'signerAccountOverride',
    ]);
  });

  it('keeps no-upload plans inert while preserving the would-be request identity', () => {
    expect(resolveSessionWizardPublishMetadataUploadRequest({
      publishExecutionPlan: buildPlan({
        shouldUploadMetadata: false,
        stepNumbers: {
          'upload-metadata': 2,
        },
      }),
      workerUrlOverride: 'https://unused-worker.example.test',
      signerAccountOverride: '0x00000000000000000000000000000000000000bb',
    })).toEqual({
      shouldUploadMetadata: false,
      publishStep: 2,
      uploadArgs: {
        workerUrlOverride: 'https://unused-worker.example.test',
        signerAccountOverride: '0x00000000000000000000000000000000000000bb',
      },
    });
  });
});

describe('runSessionWizardPublishCompletionController', () => {
  it('promotes pending drafts, publishes links, clears drafts, and marks done in order', () => {
    const events: string[] = [];
    const normalizedDeployedDrafts = [{
      predictedAddress: '0x00000000000000000000000000000000000000aA',
      deployedAddress: '0x00000000000000000000000000000000000000aA',
      displayName: 'Newly Deployed Group',
      deployed: true,
    }];
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
    const publishedLinks = [{ href: '/sbt/0xaa', label: 'Newly Deployed Group' }];
    const normalizePendingDrafts = jest.fn((drafts) => {
      events.push('normalizePendingDrafts');
      expect(drafts).toEqual([{ id: 'raw-deployed-draft' }]);
      return normalizedDeployedDrafts;
    });
    const promoteDeployedPendingSbtSelections = jest.fn((drafts) => {
      events.push('promoteDeployedPendingSbtSelections');
      expect(drafts).toEqual([
        ...normalizedDeployedDrafts,
        resumedDeployedDraft,
      ]);
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
    const clearPendingSbtDrafts = jest.fn(() => {
      events.push('clearPendingSbtDrafts');
    });
    const setPublishStep = jest.fn((step) => {
      events.push(`setPublishStep:${step}`);
    });

    expect(runSessionWizardPublishCompletionController({
      input: {
        publishExecutionPlan: buildPlan({
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
        clearPendingSbtDrafts,
        setPublishStep,
      },
    })).toEqual({
      normalizedDeployedPendingDrafts: normalizedDeployedDrafts,
      publishedPendingSbtLinks: publishedLinks,
    });

    expect(events).toEqual([
      'normalizePendingDrafts',
      'promoteDeployedPendingSbtSelections',
      'buildPublishedPendingSbtLinks',
      'setPublishedPendingSbtLinks',
      'clearPendingSbtDrafts',
      'setPublishStep:5',
    ]);
  });

  it('preserves completion failure behavior by stopping later callbacks', () => {
    const error = new Error('promotion failed');
    const setPublishedPendingSbtLinks = jest.fn();
    const clearPendingSbtDrafts = jest.fn();
    const setPublishStep = jest.fn();

    expect(() => runSessionWizardPublishCompletionController({
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
        clearPendingSbtDrafts,
        setPublishStep,
      },
    })).toThrow(error);

    expect(setPublishedPendingSbtLinks).not.toHaveBeenCalled();
    expect(clearPendingSbtDrafts).not.toHaveBeenCalled();
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

    await expect(runSessionWizardRegisterStepController({
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
    })).resolves.toEqual({
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

    await expect(runSessionWizardRegisterStepController({
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
    })).rejects.toBe(error);

    expect(setStatus).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenCalledWith('Registering session on-chain…');
  });
});
