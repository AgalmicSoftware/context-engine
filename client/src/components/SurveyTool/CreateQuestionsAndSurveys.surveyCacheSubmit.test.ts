import {
  E2E_TESTIDS,
  REGISTRY_CACHE_KEY,
  arweaveScripts,
  cacheScripts,
  collectTreeNodes,
  contractScripts,
  cryptoUtils,
  getChainById,
  getDefaultHttpRpc,
  makeInstance,
  nodeHasClassName,
  normalizeArweaveUrl,
  peekCacheSyncMock,
  renderToStaticMarkup,
  resourceKeys,
  sessionRegistryStore,
  sessionRegistryUtils,
  subscribeCacheUpdatesMock,
  treeHasText,
  writeCacheOptimisticMock,
  hasSubmittedResourcesInManagedCache,
  readManagedCacheSnapshot,
  sanitizeDocumentUrls,
  selectManagedNetBucketSnapshot,
} from './CreateQuestionsAndSurveys.cacheTestUtils';

describe('CreateQuestionsAndSurveys managed cache reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    try {
      delete (globalThis as any).CE_ARWEAVE_GATEWAY_URL;
    } catch (_) {}
    try {
      delete (globalThis as any).CE_ARWEAVE_AR_IO_URL;
    } catch (_) {}
    try {
      delete (globalThis as any).CE_ARWEAVE_DIRECT_TO_AR_IO;
    } catch (_) {}
  });

  it('resets submit progress UI when the survey Arweave upload fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const latestBlockSpy = jest.spyOn(contractScripts, 'getLatestBlockNumber').mockResolvedValue(123);
    const addSurveySpy = jest.spyOn(contractScripts, 'addSurveyWithQuestions').mockResolvedValue({
      uploadedQuestions: [],
      receipt: { status: 1 },
    });
    const keySpy = jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({
      arweaveJwk: '{"kty":"RSA"}',
    } as any);
    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockRejectedValue(new Error('upload failed'));

    try {
      const instance = makeInstance({
        loginComplete: true,
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'edge',
        network: { id: 84532 },
      });

      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'edge',
        sessionName: 'edge',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      });
      instance.resolveGateOptions = jest.fn(() => ({ gateMap: {} }));
      instance.state = {
        ...instance.state,
        showAutoTool: false,
        isStandaloneQuestion: false,
        title: 'Survey Title',
        surveyHash: '0xsurvey',
        questions: [
          {
            id: 'q1',
            uiKey: 'q1',
            type: 'freeform',
            prompt: 'Question 1',
            tags: [],
            currentTagInputValue: '',
            aiGeneratedTagsFromSource: [],
            isGeneratingTags: false,
          },
        ],
        documentURLs: ['https://safe.example/doc'],
      };

      await instance.createSurvey();

      expect(uploadSpy).toHaveBeenCalled();
      expect(addSurveySpy).not.toHaveBeenCalled();
      expect(instance.state.isSubmitting).toBe(false);
      expect(instance.state.progress).toBe(0);
      expect(instance.state.showSubmitSteps).toBe(false);
      expect(instance.state.submitStep).toBe(0);
      expect(instance.state.submissionError).toBe('upload failed');
    } finally {
      consoleSpy.mockRestore();
      latestBlockSpy.mockRestore();
      addSurveySpy.mockRestore();
      keySpy.mockRestore();
      uploadSpy.mockRestore();
    }
  });

  it('forces direct Arweave for survey metadata when the effective key is local', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const latestBlockSpy = jest.spyOn(contractScripts, 'getLatestBlockNumber').mockResolvedValue(123);
    const addSurveySpy = jest.spyOn(contractScripts, 'addSurveyWithQuestions').mockResolvedValue({
      uploadedQuestions: [],
      receipt: { status: 1 },
    });
    const keySpy = jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({
      arweaveJwk: '{"kty":"RSA"}',
      source: 'local',
    } as any);
    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockResolvedValue('survey-arweave-tx');
    writeCacheOptimisticMock.mockResolvedValue(undefined);
    peekCacheSyncMock.mockReturnValue({});

    try {
      const instance = makeInstance({
        loginComplete: true,
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'demo-session-2',
        sessionSlug: 'demo-session-2',
        network: { id: 8453, chainId: 8453 },
        networkChainId: 84532,
      });

      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'demo-session-2',
        sessionName: 'Demo Session 2',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      });
      instance.resolveGateOptions = jest.fn(() => ({ gateMap: {} }));
      instance.clearUnfinishedSurveyDraft = jest.fn();
      instance.startCacheWatch = jest.fn();
      instance.state = {
        ...instance.state,
        showAutoTool: false,
        isStandaloneQuestion: false,
        title: 'Fresh Survey',
        surveyHash: '0xsurvey',
        questions: [
          {
            id: 'q1',
            uiKey: 'q1',
            type: 'freeform',
            prompt: 'Question 1',
            tags: [],
            currentTagInputValue: '',
            aiGeneratedTagsFromSource: [],
            isGeneratingTags: false,
          },
        ],
        documentURLs: ['https://safe.example/doc'],
      };

      await instance.createSurvey();

      expect(uploadSpy).toHaveBeenCalledWith(
        expect.any(String),
        'json',
        expect.objectContaining({
          arweaveJwk: '{"kty":"RSA"}',
          forceDirectArweaveUpload: true,
          sessionSlug: 'demo-session-2',
        }),
      );
      expect(addSurveySpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
      latestBlockSpy.mockRestore();
      addSurveySpy.mockRestore();
      keySpy.mockRestore();
      uploadSpy.mockRestore();
    }
  });

  it('seeds surveys and questions caches after survey creation so deep links can resolve immediately', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const latestBlockSpy = jest.spyOn(contractScripts, 'getLatestBlockNumber').mockResolvedValue(123);
    const addSurveySpy = jest.spyOn(contractScripts, 'addSurveyWithQuestions').mockResolvedValue({
      uploadedQuestions: [],
      receipt: { status: 1 },
    });
    const keySpy = jest.spyOn(resourceKeys, 'getEffectiveArweaveKey').mockResolvedValue({
      arweaveJwk: '{"kty":"RSA"}',
    } as any);
    const uploadSpy = jest.spyOn(arweaveScripts, 'uploadDataToArweave').mockResolvedValue('survey-arweave-tx');
    writeCacheOptimisticMock.mockResolvedValue(undefined);
    peekCacheSyncMock.mockReturnValue({});

    try {
      const instance = makeInstance({
        loginComplete: true,
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'demo-session-2',
        sessionSlug: 'demo-session-2',
        network: { id: 8453, chainId: 8453 },
        networkChainId: 84532,
        sessionConfig: {
          slug: 'demo-session-2',
          sessionName: 'Demo Session 2',
          networkChainId: 84532,
          contracts: { surveys: { chainId: 84532 } },
        },
      });

      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'demo-session-2',
        sessionName: 'Demo Session 2',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      });
      instance.resolveGateOptions = jest.fn(() => ({ gateMap: {} }));
      instance.clearUnfinishedSurveyDraft = jest.fn();
      instance.startCacheWatch = jest.fn();
      instance.state = {
        ...instance.state,
        showAutoTool: false,
        isStandaloneQuestion: false,
        title: 'Fresh Survey',
        surveyHash: '0xsurvey',
        questions: [
          {
            id: 'q1',
            uiKey: 'q1',
            type: 'freeform',
            prompt: 'Question 1',
            tags: [],
            currentTagInputValue: '',
            aiGeneratedTagsFromSource: [],
            isGeneratingTags: false,
          },
        ],
        documentURLs: ['https://safe.example/doc'],
      };

      await instance.createSurvey();

      expect(addSurveySpy).toHaveBeenCalled();
      const questionsWrite = writeCacheOptimisticMock.mock.calls.find((args: any[]) => args[0] === 'questionsCache');
      const surveysWrite = writeCacheOptimisticMock.mock.calls.find((args: any[]) => args[0] === 'surveysCache');

      expect(questionsWrite).toBeTruthy();
      expect(questionsWrite[1]).toBe('demo-session-2');
      expect(Object.keys(questionsWrite[2])).toEqual(['84532']);
      expect(questionsWrite[2]).toEqual(
        expect.objectContaining({
          '84532': expect.objectContaining({
            questions: expect.objectContaining({
              q1: expect.objectContaining({
                id: 'q1',
                associatedSurveyId: '0xsurvey',
              }),
            }),
          }),
        }),
      );

      expect(surveysWrite).toBeTruthy();
      expect(surveysWrite[1]).toBe('demo-session-2');
      expect(Object.keys(surveysWrite[2])).toEqual(['84532']);
      expect(surveysWrite[2]).toEqual(
        expect.objectContaining({
          '84532': expect.objectContaining({
            surveys: expect.objectContaining({
              '0xsurvey': expect.objectContaining({
                surveyID: '0xsurvey',
                id: '0xsurvey',
                title: 'Fresh Survey',
                sessionSlug: 'demo-session-2',
                slug: 'demo-session-2',
                questionIDs: ['q1'],
              }),
            }),
          }),
        }),
      );
      expect(instance.startCacheWatch).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
      latestBlockSpy.mockRestore();
      addSurveySpy.mockRestore();
      keySpy.mockRestore();
      uploadSpy.mockRestore();
    }
  });

  it('watches the resolved session chain bucket after submit when wallet-facing network props differ', () => {
    peekCacheSyncMock.mockImplementation((namespace: any) => {
      if (namespace !== 'surveysCache') return {};
      return {
        '84532': {
          surveys: {
            '0xsurvey': { id: '0xsurvey' },
          },
        },
        '8453': {
          surveys: {},
        },
      };
    });

    const instance = makeInstance({
      activeSessionSlug: 'demo-session-2',
      sessionSlug: 'demo-session-2',
      network: { id: 8453, chainId: 8453, name: 'Base' },
      networkChainId: 84532,
      sessionConfig: {
        slug: 'demo-session-2',
        networkChainId: 84532,
        contracts: { surveys: { chainId: 84532 } },
      },
    });
    instance.state = {
      ...instance.state,
      surveyAddedSuccessfully: true,
      questionsAddedSuccessfully: false,
      lastSubmittedSurveyId: '0xSurvey',
      uploadedQuestions: [],
      cacheLoaded: false,
      submitStep: 2,
    };

    instance.startCacheWatch();

    expect(instance.state.cacheLoaded).toBe(true);
    expect(instance.state.submitStep).toBe(3);
    expect(instance._cacheWatchTimer).toBeNull();
  });

  it('keeps authoring lock options empty for unresolved non-general slugs even when the general session is authoritative', () => {
    const priorRegistryCache = localStorage.getItem(REGISTRY_CACHE_KEY);
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({
        sessions: {
          '': {
            slug: '',
            sessionName: 'Registry General',
            networkChainId: 84532,
            __registry: {
              gateAuthority: 'onchain',
              gatesByResource: {
                questionResponses: {
                  gateId: 'question_gate',
                  sbtAddresses: ['0x1111111111111111111111111111111111111111'],
                  lookupStatus: 'ok',
                },
                default: {
                  gateId: 'default_gate',
                  sbtAddresses: ['0x2222222222222222222222222222222222222222'],
                  lookupStatus: 'ok',
                },
              },
            },
            sponsored: {
              defaultGateId: 'default_gate',
              gates: {
                question_gate: {
                  label: 'Registry questionResponses gate',
                  sbtAddresses: ['0x1111111111111111111111111111111111111111'],
                  mode: 'all',
                },
                default_gate: {
                  label: 'Registry default gate',
                  sbtAddresses: ['0x2222222222222222222222222222222222222222'],
                  mode: 'any',
                },
              },
            },
          },
        },
      }),
    );

    try {
      const instance = makeInstance({
        activeSessionSlug: 'missing-session',
        sessionSlug: 'missing-session',
      });

      const resolved = instance.getResolvedSessionConfig();
      const { gateOptions, defaultGateId } = instance.resolveGateOptions(resolved, { isStandaloneQuestion: true });

      expect(resolved).toEqual(
        expect.objectContaining({
          slug: 'missing-session',
          networkChainId: 84532,
        }),
      );
      expect(instance.resolveLockAudienceSessionName(resolved)).toBe('missing-session');
      expect(defaultGateId).toBe('');
      expect(gateOptions).toEqual([]);
    } finally {
      if (priorRegistryCache == null) {
        localStorage.removeItem(REGISTRY_CACHE_KEY);
      } else {
        localStorage.setItem(REGISTRY_CACHE_KEY, priorRegistryCache);
      }
    }
  });

  it('keeps submit-time registry refresh scoped to the unresolved requested slug when exact session config is missing', async () => {
    const fetchSpy = jest.spyOn(sessionRegistryUtils, 'fetchSessionFromRegistry').mockResolvedValue(null);
    const upsertSpy = jest.spyOn(sessionRegistryUtils, 'upsertSessionRegistryCache').mockImplementation(() => null);

    try {
      const instance = makeInstance({
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'missing-session',
        sessionSlug: 'missing-session',
        network: { id: 84532, chainId: 84532 },
      });

      const resolved = await instance.ensureResolvedSessionConfigForSubmit({
        slug: 'missing-session',
        networkChainId: 84532,
        contracts: {},
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 84532,
          slug: 'missing-session',
          providerLike: 'web3auth',
          account: '0xabc',
        }),
      );
      expect(upsertSpy).not.toHaveBeenCalled();
      expect(resolved).toEqual(
        expect.objectContaining({
          slug: 'missing-session',
          networkChainId: 84532,
          contracts: {},
        }),
      );
    } finally {
      fetchSpy.mockRestore();
      upsertSpy.mockRestore();
    }
  });

  it('uses the session chain for wagmi network guard even when the wallet-facing network prop is Base mainnet', async () => {
    const instance = makeInstance({
      provider: 'wagmi',
      loginComplete: true,
      account: '0xabc',
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
      network: { id: 8453, chainId: 8453, name: 'Base' },
      networkChainId: 84532,
      sessionConfig: {
        slug: 'edge',
        networkChainId: 84532,
        contracts: {
          surveys: { address: '0x1111111111111111111111111111111111111111', chainId: 84532 },
        },
      },
    });
    instance.getWalletChainId = jest.fn().mockResolvedValue('0x2105');
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      questions: [
        {
          id: 'q1',
          type: 'freeform',
          prompt: 'Prompt 1',
          tags: [],
        },
      ],
    };

    await instance.createSurvey();

    expect(instance.state.needsNetworkSwitch).toBe(true);
    expect(instance.state.isSubmitting).toBe(false);
  });

  it('updates associated survey ids without regenerating question ids', () => {
    const instance = makeInstance();
    instance.saveToLocalStorage = jest.fn();
    instance.generateQuestionId = jest.fn(() => 'regenerated-id');
    instance.state = {
      ...instance.state,
      questions: [
        {
          id: 'existing-id',
          type: 'multichoice',
          prompt: 'Pick one',
          options: ['Alpha'],
          singleSelect: false,
          associatedSurveyId: '',
        },
      ],
    };

    instance.handleAssociatedSurveyIdChange(0, 'survey-2');

    expect(instance.generateQuestionId).not.toHaveBeenCalled();
    expect(instance.state.questions[0]).toMatchObject({
      id: 'existing-id',
      associatedSurveyId: 'survey-2',
    });
    expect(instance.saveToLocalStorage).toHaveBeenCalled();
  });
});
