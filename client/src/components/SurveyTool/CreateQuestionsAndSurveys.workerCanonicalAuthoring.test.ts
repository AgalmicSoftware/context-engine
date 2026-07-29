import {
  arweaveClient,
  contractScripts,
  makeInstance,
  peekCacheSyncMock,
  renderToStaticMarkup,
  sessionRegistryStore,
  sessionRegistryUtils,
  writeCacheOptimisticMock,
} from './CreateQuestionsAndSurveys.cacheTestUtils';
import { workerCanonicalAuthoringPort } from '../../domains/surveys/workerCanonicalAuthoringPort';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import {
  resolveWorkerCanonicalCacheIdentity,
  workerCanonicalCacheIdentityMatches,
  withWorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';

const SESSION_ID = `0x${'2'.repeat(32)}`;
const WORKER_URL = 'https://worker-authoring.example.test';
type WorkerCacheNode = Record<string, unknown> & {
  questions?: Record<string, unknown>;
  surveys?: Record<string, unknown>;
};
type WorkerScopedCache = Record<string, unknown> & {
  worker?: WorkerCacheNode;
};

const buildWorkerSessionConfig = ({
  sessionId = SESSION_ID,
  workerUrl = WORKER_URL,
}: {
  sessionId?: string;
  workerUrl?: string;
} = {}): any => ({
  slug: 'worker-session',
  sessionId,
  corsWorkerUrl: workerUrl,
  networkChainId: 11155420,
  contracts: {},
  sessionModeProfile: {
    profileVersion: 1,
    preset: 'custom',
    authority: { mode: 'worker_canonical' },
    evm: { registryChainId: null },
    storage: {
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'none', encryption: 'none' },
    },
    identity: { default: 'passkey', enabled: ['passkey'] },
    authorization: { mechanisms: ['worker_roles'] },
    encryption: { mode: 'none' },
    surfaces: {
      web: true,
      telegram: false,
      miniApp: false,
      agentHttp: false,
      mcp: false,
      ceCc: false,
    },
    results: {
      visibility: 'public_full_if_storage_public',
      exposure: {
        aggregateResultsEnabled: true,
        anonymizedGroupsEnabled: false,
        minGroupSize: 2,
      },
    },
    export: { scope: 'all_session' },
  },
  storageProfile: {
    backend: 'cloudflare',
    resources: {
      questions: 'active',
      surveys: 'active',
    },
    payloadAccessControl: {
      gate: 'none',
      encryption: 'none',
      mode: 'public_read',
    },
  },
});

const buildWorkerSbtHybridSessionConfig = (): any => {
  const config = buildWorkerSessionConfig();
  config.sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  config.sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  config.sessionModeProfile.evm.registryChainId = 11155420;
  config.sessionModeProfile.encryption.accessConditions = {
    match: 'any',
    conditions: [
      {
        kind: 'sbt_onchain',
        chainId: 11155420,
        contract: '0x1111111111111111111111111111111111111111',
        anyOrAll: 'any',
      },
    ],
  };
  return config;
};

const buildWorkerLitSessionConfig = ({ workerUrl = WORKER_URL }: { workerUrl?: string } = {}): any => {
  const config = buildWorkerSessionConfig({ workerUrl });
  config.sessionModeProfile = cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE);
  config.sessionModeProfile.preset = SESSION_MODE_PRESET_IDS.CUSTOM;
  config.sessionModeProfile.evm.registryChainId = 11155420;
  config.sessionModeProfile.encryption = { mode: 'lit' };
  config.sessionModeProfile.storage.payloadAccessControl.encryption = 'lit';
  if (!workerUrl) delete config.corsWorkerUrl;
  return config;
};

describe('CreateQuestionsAndSurveys Worker-canonical authoring', () => {
  const originalEthereum = window.ethereum;

  beforeEach(() => {
    peekCacheSyncMock.mockReset();
    peekCacheSyncMock.mockReturnValue(null);
    writeCacheOptimisticMock.mockReset();
    writeCacheOptimisticMock.mockImplementation(async (..._args: unknown[]) => undefined);
  });

  afterEach(() => {
    window.ethereum = originalEthereum;
    jest.restoreAllMocks();
  });

  it('does not ask the wallet for a chain when priming a pure Worker authoring surface', async () => {
    const request = jest.fn();
    window.ethereum = { request } as any;
    const instance = makeInstance({
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig: buildWorkerSessionConfig(),
      provider: 'wagmi',
      loginComplete: true,
      network: { id: 11155420 },
    });

    await instance.updateNeedsNetworkSwitch();

    expect(request).not.toHaveBeenCalled();
    expect(instance.state.needsNetworkSwitch).toBe(false);
  });

  it('seeds authored Worker resources into the same stable cache scope used by the Worker question pile', () => {
    const instance = makeInstance({
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig: buildWorkerSessionConfig(),
      network: { id: 11155420 },
    });
    instance.resolveSessionChainId = jest.fn();

    expect(instance.resolveManagedCacheSeedTargets()).toEqual({
      primaryNetId: 'worker',
      primarySlug: 'worker-session',
    });
    expect(instance.resolveSessionChainId).not.toHaveBeenCalled();
  });

  it('keeps authored Worker/SBT hybrid resources in the Worker cache partition', () => {
    const instance = makeInstance({
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig: buildWorkerSbtHybridSessionConfig(),
      network: { id: 11155420 },
    });
    instance.resolveSessionChainId = jest.fn();

    expect(instance.resolveManagedCacheSeedTargets()).toEqual({
      primaryNetId: 'worker',
      primarySlug: 'worker-session',
    });
    expect(instance.resolveSessionChainId).not.toHaveBeenCalled();
  });

  it('isolates Worker Lit authoring from a same-slug registry collision and fails closed without its own Worker URL', () => {
    const registryConfigSpy = jest.spyOn(sessionRegistryStore, 'getSessionConfig').mockReturnValue({
      slug: 'worker-session',
      corsWorkerUrl: 'https://registry-worker.example.test',
      lit: { network: 'chipotle', userMaxPrice: '999' },
      litCredentials: {
        litApiBase: 'https://registry-lit.example.test',
        litActionCid: 'registry-action',
        litPkpId: 'registry-pkp',
      },
      contracts: {
        surveys: {
          address: '0x1111111111111111111111111111111111111111',
          chainId: 84532,
        },
      },
      sponsored: {
        defaultGateId: 'registry-gate',
        gates: {
          'registry-gate': {
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            chainId: 84532,
          },
        },
      },
      __registry: {
        registryChainId: 84532,
        gatesByResource: {
          default: {
            gateId: 'registry-gate',
            sbtAddresses: ['0x2222222222222222222222222222222222222222'],
            chainId: 84532,
          },
        },
      },
    } as any);
    delete (window as any).__litHooks;
    delete (window as any).litHooks;

    const workerConfig = buildWorkerLitSessionConfig();
    const instance = makeInstance({
      account: '0x1111111111111111111111111111111111111111',
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig: workerConfig,
    });
    const resolved = instance.getResolvedSessionConfig();

    expect(resolved).toEqual({
      ...workerConfig,
      contracts: {},
      networkChainId: 11155420,
    });
    expect(resolved).not.toHaveProperty('lit');
    expect(resolved).not.toHaveProperty('litCredentials');
    expect(resolved).not.toHaveProperty('sponsored');
    expect(resolved).not.toHaveProperty('__registry');
    expect(instance.resolveGateOptions(resolved, { isStandaloneQuestion: true }).gateOptions).toEqual([]);
    expect(instance.resolveLitHooksForSubmit(resolved, 11155420)).toEqual(
      expect.objectContaining({ saveKey: expect.any(Function) }),
    );

    const incompleteWorkerConfig = buildWorkerLitSessionConfig({ workerUrl: '' });
    const incompleteInstance = makeInstance({
      account: '0x1111111111111111111111111111111111111111',
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig: incompleteWorkerConfig,
    });
    const incompleteResolved = incompleteInstance.getResolvedSessionConfig();

    expect(incompleteResolved).not.toHaveProperty('corsWorkerUrl');
    expect(incompleteInstance.resolveLitHooksForSubmit(incompleteResolved, 11155420)).toBeNull();
    expect(registryConfigSpy).not.toHaveBeenCalled();
  });

  it('fails closed on an invalid Worker authority claim without registry or Lit fallback', async () => {
    const registryConfigSpy = jest.spyOn(sessionRegistryStore, 'getSessionConfig').mockReturnValue({
      slug: 'worker-session',
      networkChainId: 84532,
      lit: { network: 'chipotle' },
      sponsored: { defaultGateId: 'registry-gate' },
    } as any);
    const fetchRegistrySpy = jest.spyOn(sessionRegistryUtils, 'fetchSessionFromRegistry');
    const invalidWorkerConfig = {
      slug: 'worker-session',
      sessionModeProfile: {
        profileVersion: 1,
        preset: 'custom',
        authority: { mode: 'worker_canonical' },
      },
    };
    (window as any).__litHooks = { saveKey: jest.fn() };
    const instance = makeInstance({
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig: invalidWorkerConfig,
      litHooks: { saveKey: jest.fn() },
      network: { id: 84532, chainId: 84532 },
      networkChainId: 84532,
    });

    try {
      const resolved = instance.getResolvedSessionConfig();

      expect(resolved).toEqual({
        ...invalidWorkerConfig,
        contracts: {},
        networkChainId: null,
      });
      expect(instance.resolveSessionChainId(resolved)).toBeNull();
      expect(instance.resolveTargetNetwork(resolved)).toBeNull();
      expect(instance.resolveGateOptions(resolved, { isStandaloneQuestion: true }).gateOptions).toEqual([]);
      expect(instance.resolveLitHooksForSubmit(resolved, 84532)).toBeNull();
      await expect(instance.ensureResolvedSessionConfigForSubmit(resolved)).resolves.toEqual(resolved);
      expect(registryConfigSpy).not.toHaveBeenCalled();
      expect(fetchRegistrySpy).not.toHaveBeenCalled();
    } finally {
      delete (window as any).__litHooks;
    }
  });

  it('replaces same-slug cache nodes from another Worker identity before optimistic authoring writes', async () => {
    const workerAConfig = buildWorkerSessionConfig({
      sessionId: `0x${'1'.repeat(32)}`,
      workerUrl: 'https://worker-a-authoring.example.test',
    });
    const workerBConfig = buildWorkerSessionConfig({
      sessionId: `0x${'2'.repeat(32)}`,
      workerUrl: 'https://worker-b-authoring.example.test',
    });
    const workerAIdentity = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: workerAConfig,
      sessionSlug: 'worker-session',
    });
    const workerBIdentity = resolveWorkerCanonicalCacheIdentity({
      sessionConfig: workerBConfig,
      sessionSlug: 'worker-session',
    });
    peekCacheSyncMock.mockImplementation((...args: unknown[]) => {
      const namespace = String(args[0] || '');
      if (namespace === 'questionsCache') {
        return {
          worker: withWorkerCanonicalCacheIdentity(
            {
              questions: {
                'question-a': { id: 'question-a', prompt: 'Worker A question' },
              },
              questionResponses: {},
            },
            workerAIdentity,
          ),
        };
      }
      if (namespace === 'surveysCache') {
        return {
          worker: withWorkerCanonicalCacheIdentity(
            {
              surveys: {
                'survey-a': { id: 'survey-a', title: 'Worker A survey' },
              },
            },
            workerAIdentity,
          ),
        };
      }
      return null;
    });
    const instance = makeInstance({
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig: workerBConfig,
    });

    await expect(
      instance.seedUploadedQuestionsCache({
        questionDataArray: [{ id: 'question-b', prompt: 'Worker B question', type: 'freeform' }],
        uploadedQuestions: [{ questionId: 'question-b' }],
        sourceQuestions: [{ id: 'question-b', prompt: 'Worker B question', type: 'freeform' }],
      }),
    ).resolves.toBe(true);
    await expect(
      instance.seedSubmittedSurveyCache({
        surveyData: {
          surveyID: 'survey-b',
          title: 'Worker B survey',
          questionIDs: ['question-b'],
        },
        surveyId: 'survey-b',
      }),
    ).resolves.toBe(true);

    const questionsWrite = writeCacheOptimisticMock.mock.calls.find(([namespace]) => namespace === 'questionsCache');
    const surveysWrite = writeCacheOptimisticMock.mock.calls.find(([namespace]) => namespace === 'surveysCache');
    const questionsWorkerNode = (questionsWrite?.[2] as WorkerScopedCache | undefined)?.worker;
    const surveysWorkerNode = (surveysWrite?.[2] as WorkerScopedCache | undefined)?.worker;

    expect(workerCanonicalCacheIdentityMatches(questionsWorkerNode, workerBIdentity)).toBe(true);
    expect(workerCanonicalCacheIdentityMatches(surveysWorkerNode, workerBIdentity)).toBe(true);
    expect(questionsWorkerNode?.questions).toEqual(
      expect.objectContaining({
        'question-b': expect.objectContaining({ prompt: 'Worker B question' }),
      }),
    );
    expect(questionsWorkerNode?.questions).not.toHaveProperty('question-a');
    expect(surveysWorkerNode?.surveys).toEqual(
      expect.objectContaining({
        'survey-b': expect.objectContaining({ title: 'Worker B survey' }),
      }),
    );
    expect(surveysWorkerNode?.surveys).not.toHaveProperty('survey-a');
  });

  it('publishes standalone questions through Worker storage without registry, contract, or chain calls', async () => {
    const sessionConfig = buildWorkerSessionConfig();
    const publishQuestions = jest.spyOn(workerCanonicalAuthoringPort, 'publishQuestions').mockResolvedValue({
      sessionConfig,
      sessionId: SESSION_ID,
      sessionSlug: 'worker-session',
      workerUrl: WORKER_URL,
      workerCanonicalSubmission: true,
      uploadedQuestions: [
        {
          questionId: '0xquestion',
          resource: 'questions',
          storageRef: {
            backend: 'cloudflare',
            id: 'cf_question_opaque_03',
            resource: 'questions',
          },
        },
      ],
    });
    const addQuestions = jest.spyOn(contractScripts, 'addQuestions');
    const fetchRegistry = jest.spyOn(sessionRegistryUtils, 'fetchSessionFromRegistry');
    const instance = makeInstance({
      account: '0x1111111111111111111111111111111111111111',
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig,
      provider: 'passkey_eoa',
      loginComplete: true,
      network: { id: 11155420 },
    });
    instance.ensureResolvedSessionConfigForSubmit = jest.fn();
    instance.getWalletChainId = jest.fn();
    instance.resolveSessionChainId = jest.fn();
    instance.seedUploadedQuestionsCache = jest.fn().mockResolvedValue(true);
    instance.clearUnfinishedSurveyDraft = jest.fn();
    instance.startCacheWatch = jest.fn();
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      questions: [
        {
          id: '0xquestion',
          prompt: 'Worker-native prompt',
          tags: [],
          type: 'freeform',
        },
      ],
    };

    await instance.createSurvey();

    expect(publishQuestions).toHaveBeenCalledWith({
      account: '0x1111111111111111111111111111111111111111',
      providerLike: 'passkey_eoa',
      questions: [
        expect.objectContaining({
          id: '0xquestion',
          prompt: 'Worker-native prompt',
          sessionSlug: 'worker-session',
        }),
      ],
      sessionConfig: expect.objectContaining({
        sessionId: SESSION_ID,
        slug: 'worker-session',
      }),
      sessionSlug: 'worker-session',
    });
    expect(instance.ensureResolvedSessionConfigForSubmit).not.toHaveBeenCalled();
    expect(instance.getWalletChainId).not.toHaveBeenCalled();
    expect(instance.resolveSessionChainId).not.toHaveBeenCalled();
    expect(fetchRegistry).not.toHaveBeenCalled();
    expect(addQuestions).not.toHaveBeenCalled();
    expect(instance.state.questionsAddedSuccessfully).toBe(true);
  });

  it('publishes surveys through Worker storage without a block read, Arweave upload, or contract call', async () => {
    const sessionConfig = buildWorkerSessionConfig();
    const publishSurvey = jest.spyOn(workerCanonicalAuthoringPort, 'publishSurvey').mockResolvedValue({
      sessionConfig,
      sessionId: SESSION_ID,
      sessionSlug: 'worker-session',
      workerUrl: WORKER_URL,
      workerCanonicalSubmission: true,
      surveyStorageRef: {
        backend: 'cloudflare',
        id: 'cf_survey_opaque_02',
        resource: 'surveys',
      },
      uploadedQuestions: [
        {
          questionId: '0xquestion',
          resource: 'questions',
          storageRef: {
            backend: 'cloudflare',
            id: 'cf_question_opaque_04',
            resource: 'questions',
          },
        },
      ],
    });
    const addSurvey = jest.spyOn(contractScripts, 'addSurveyWithQuestions');
    const latestBlock = jest.spyOn(contractScripts, 'getLatestBlockNumber');
    const arweaveUpload = jest.spyOn(arweaveClient, 'uploadDataToArweave');
    const instance = makeInstance({
      account: '0x1111111111111111111111111111111111111111',
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig,
      provider: 'passkey_eoa',
      loginComplete: true,
      network: { id: 11155420 },
    });
    instance.ensureResolvedSessionConfigForSubmit = jest.fn();
    instance.getWalletChainId = jest.fn();
    instance.resolveSessionChainId = jest.fn();
    instance.seedUploadedQuestionsCache = jest.fn().mockResolvedValue(true);
    instance.seedSubmittedSurveyCache = jest.fn().mockResolvedValue(true);
    instance.clearUnfinishedSurveyDraft = jest.fn();
    instance.startCacheWatch = jest.fn();
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: false,
      title: 'Worker survey',
      surveyHash: '0xsurvey',
      questions: [
        {
          id: '0xquestion',
          prompt: 'Worker-native prompt',
          tags: [],
          type: 'freeform',
        },
      ],
    };

    await instance.createSurvey();

    expect(publishSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        providerLike: 'passkey_eoa',
        sessionConfig: expect.objectContaining({
          sessionId: SESSION_ID,
          slug: 'worker-session',
        }),
        sessionSlug: 'worker-session',
        survey: expect.objectContaining({
          creationBlock: 0,
          surveyID: '0xsurvey',
          title: 'Worker survey',
        }),
      }),
    );
    expect(instance.ensureResolvedSessionConfigForSubmit).not.toHaveBeenCalled();
    expect(instance.getWalletChainId).not.toHaveBeenCalled();
    expect(instance.resolveSessionChainId).not.toHaveBeenCalled();
    expect(latestBlock).not.toHaveBeenCalled();
    expect(arweaveUpload).not.toHaveBeenCalled();
    expect(addSurvey).not.toHaveBeenCalled();
    expect(instance.state.surveyAddedSuccessfully).toBe(true);
  });

  it('publishes a Worker/SBT hybrid through Worker storage while retaining its explicit chain context', async () => {
    const sessionConfig = buildWorkerSbtHybridSessionConfig();
    const publishQuestions = jest.spyOn(workerCanonicalAuthoringPort, 'publishQuestions').mockResolvedValue({
      sessionConfig,
      sessionId: SESSION_ID,
      sessionSlug: 'worker-session',
      workerUrl: WORKER_URL,
      workerCanonicalSubmission: true,
      uploadedQuestions: [
        {
          questionId: '0xhybrid-question',
          resource: 'questions',
          storageRef: {
            backend: 'cloudflare',
            id: 'cf_hybrid_question_opaque_01',
            resource: 'questions',
          },
        },
      ],
    });
    const addQuestions = jest.spyOn(contractScripts, 'addQuestions');
    const fetchRegistry = jest.spyOn(sessionRegistryUtils, 'fetchSessionFromRegistry');
    const instance = makeInstance({
      account: '0x1111111111111111111111111111111111111111',
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig,
      provider: 'passkey_eoa',
      loginComplete: true,
      network: { id: 11155420 },
    });
    instance.ensureResolvedSessionConfigForSubmit = jest.fn();
    instance.resolveSessionChainId = jest.fn(() => 11155420);
    instance.resolveGateOptions = jest.fn(() => ({
      defaultGateId: '',
      gateMap: {},
      gateOptions: [],
    }));
    instance.seedUploadedQuestionsCache = jest.fn().mockResolvedValue(true);
    instance.clearUnfinishedSurveyDraft = jest.fn();
    instance.startCacheWatch = jest.fn();
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      questions: [
        {
          id: '0xhybrid-question',
          prompt: 'Worker hybrid prompt',
          tags: [],
          type: 'freeform',
        },
      ],
    };

    await instance.createSurvey();

    expect(publishQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        questions: [expect.objectContaining({ id: '0xhybrid-question' })],
        sessionConfig: expect.objectContaining({
          sessionModeProfile: sessionConfig.sessionModeProfile,
          slug: 'worker-session',
        }),
        sessionSlug: 'worker-session',
      }),
    );
    expect(instance.ensureResolvedSessionConfigForSubmit).not.toHaveBeenCalled();
    expect(instance.resolveSessionChainId).toHaveBeenCalledWith(
      expect.objectContaining({ sessionModeProfile: sessionConfig.sessionModeProfile }),
    );
    expect(fetchRegistry).not.toHaveBeenCalled();
    expect(addQuestions).not.toHaveBeenCalled();
    expect(instance.state.questionsAddedSuccessfully).toBe(true);
  });

  it('labels pure Worker progress as session storage instead of Arweave and contract work', () => {
    const instance = makeInstance({
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig: buildWorkerSessionConfig(),
      provider: 'passkey_eoa',
      loginComplete: true,
    });
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      isSubmitting: true,
      questions: [{ id: '0xquestion', prompt: 'Prompt', tags: [], type: 'freeform' }],
      showAutoTool: false,
      showSubmitSteps: true,
      submitStep: 1,
    };

    const markup = renderToStaticMarkup(instance.render());

    expect(markup).toContain('Store in session');
    expect(markup).toContain('Update question index');
    expect(markup).not.toContain('Upload Arweave');
    expect(markup).not.toContain('Submit Contract');
  });

  it('labels Worker/SBT hybrid persistence as session storage, not registry-canonical contract work', () => {
    const instance = makeInstance({
      activeSessionSlug: 'worker-session',
      sessionSlug: 'worker-session',
      sessionConfig: buildWorkerSbtHybridSessionConfig(),
      provider: 'passkey_eoa',
      loginComplete: true,
    });
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      isSubmitting: true,
      questions: [{ id: '0xhybrid-question', prompt: 'Prompt', tags: [], type: 'freeform' }],
      showAutoTool: false,
      showSubmitSteps: true,
      submitStep: 1,
    };

    const markup = renderToStaticMarkup(instance.render());

    expect(markup).toContain('Store in session');
    expect(markup).toContain('Update question index');
    expect(markup).not.toContain('Upload Arweave');
    expect(markup).not.toContain('Submit Contract');
  });
});
