import {
  E2E_TESTIDS,
  REGISTRY_CACHE_KEY,
  arweaveClient,
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

  it('treats question cache seeding as best-effort when write-through fails', async () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    writeCacheOptimisticMock.mockRejectedValueOnce(new Error('quota exceeded')).mockResolvedValue(undefined);

    const instance = makeInstance();
    instance.getSessionConfig = jest.fn(() => ({
      slug: 'edge',
      networkChainId: 84532,
      contracts: { surveys: { chainId: 84532 } },
    }));

    await expect(
      instance.seedUploadedQuestionsCache({
        questionDataArray: [{ id: 'q1', type: 'freeform', prompt: 'Question 1', creator: '0xabc' }],
        uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'arweave-tx-1' }],
        sourceQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Question 1' }],
      }),
    ).resolves.toBe(false);

    expect(writeCacheOptimisticMock).toHaveBeenCalled();
  });

  it('keeps question cache write-through scoped to unresolved non-general slugs', async () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    writeCacheOptimisticMock.mockResolvedValue(undefined);

    const instance = makeInstance({
      activeSessionSlug: 'missing-session',
      sessionSlug: 'missing-session',
      network: { id: 84532 },
    });
    instance.getSessionConfig = jest.fn(() => ({
      slug: 'missing-session',
      networkChainId: 84532,
      contracts: {},
    }));

    await expect(
      instance.seedUploadedQuestionsCache({
        questionDataArray: [{ id: 'q1', type: 'freeform', prompt: 'Question 1', creator: '0xabc' }],
        uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'arweave-tx-1' }],
        sourceQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Question 1' }],
      }),
    ).resolves.toBe(true);

    expect(writeCacheOptimisticMock).toHaveBeenCalledWith('questionsCache', 'missing-session', expect.any(Object));
    expect(writeCacheOptimisticMock).not.toHaveBeenCalledWith('questionsCache', '', expect.anything());
  });

  it('seeds uploaded question cache with storageRef-first compatibility fields', async () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    writeCacheOptimisticMock.mockResolvedValue(undefined);

    const instance = makeInstance();
    instance.getSessionConfig = jest.fn(() => ({
      slug: 'edge',
      networkChainId: 84532,
      contracts: { surveys: { chainId: 84532 } },
    }));

    await expect(
      instance.seedUploadedQuestionsCache({
        questionDataArray: [
          {
            id: 'q1',
            type: 'freeform',
            prompt: 'Question 1',
            creator: '0xabc',
            arweaveTxId: 'legacy-tx',
          },
        ],
        uploadedQuestions: [
          {
            questionId: 'q1',
            storageRef: { backend: 'arweave', id: 'preferred-tx', resource: 'questions' },
          },
        ],
        sourceQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Question 1' }],
      }),
    ).resolves.toBe(true);

    const cacheWrite = writeCacheOptimisticMock.mock.calls.find(([namespace]) => namespace === 'questionsCache');
    const writtenQuestions = cacheWrite?.[2]?.['84532']?.questions || {};
    expect(writtenQuestions.q1.arweaveTxId).toBe('preferred-tx');
    expect(writtenQuestions.q1.storageRef).toEqual({
      backend: 'arweave',
      id: 'preferred-tx',
      uri: 'ar://preferred-tx',
      resource: 'questions',
    });
  });

  it('still writes question cache through the general bucket for general-session authoring', async () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    writeCacheOptimisticMock.mockResolvedValue(undefined);

    const instance = makeInstance({
      activeSessionSlug: '',
      sessionSlug: '',
      network: { id: 84532 },
    });
    instance.getSessionConfig = jest.fn(() => ({
      slug: '',
      networkChainId: 84532,
      contracts: {},
    }));

    await expect(
      instance.seedUploadedQuestionsCache({
        questionDataArray: [{ id: 'q1', type: 'freeform', prompt: 'Question 1', creator: '0xabc' }],
        uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'arweave-tx-1' }],
        sourceQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Question 1' }],
      }),
    ).resolves.toBe(true);

    expect(writeCacheOptimisticMock).toHaveBeenCalledWith('questionsCache', '', expect.any(Object));
  });

  it('seeds question cache only for the primary authoring slug when stale slug hints exist', async () => {
    peekCacheSyncMock.mockReturnValue({
      '84532': {
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
      },
    });
    writeCacheOptimisticMock.mockResolvedValue(undefined);

    const instance = makeInstance({
      activeSessionSlug: 'primary-session',
      sessionSlug: 'stale-session',
      network: { id: 84532 },
    });
    instance.getSessionConfig = jest.fn(() => ({
      slug: 'primary-session',
      networkChainId: 84532,
      contracts: {},
    }));
    instance.getActiveSessionSlug = jest.fn(() => 'stale-session');

    await expect(
      instance.seedUploadedQuestionsCache({
        questionDataArray: [{ id: 'q1', type: 'freeform', prompt: 'Question 1', creator: '0xabc' }],
        uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'arweave-tx-1' }],
        sourceQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Question 1' }],
      }),
    ).resolves.toBe(true);

    expect(writeCacheOptimisticMock).toHaveBeenCalledTimes(1);
    expect(writeCacheOptimisticMock).toHaveBeenCalledWith('questionsCache', 'primary-session', expect.any(Object));
  });

  it('does not clear managed caches after standalone question submit success', async () => {
    const addQuestionsSpy = jest.spyOn(contractScripts, 'addQuestions').mockResolvedValue({
      receipt: { status: 1 },
      uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'tx-1' }],
    });

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
    instance.clearUnfinishedSurveyDraft = jest.fn();
    instance.seedUploadedQuestionsCache = jest.fn().mockResolvedValue(true);
    instance.startCacheWatch = jest.fn();
    instance.state = {
      ...instance.state,
      isStandaloneQuestion: true,
      title: '',
      questions: [
        {
          id: 'q1',
          type: 'freeform',
          prompt: 'Question 1',
          tags: [],
        },
      ],
      documentURLs: [],
      surveyHash: '',
    };

    await instance.createSurvey();

    expect(instance.seedUploadedQuestionsCache).toHaveBeenCalled();
    expect(cacheScripts.removeCache).not.toHaveBeenCalled();
    expect(addQuestionsSpy).toHaveBeenCalled();
    addQuestionsSpy.mockRestore();
  });

  it('keeps only primitive tags for render and submit paths', async () => {
    const addQuestionsSpy = jest.spyOn(contractScripts, 'addQuestions').mockResolvedValue({
      receipt: { status: 1 },
      uploadedQuestions: [{ questionId: 'q1', arweaveTxId: 'tx-1' }],
    });

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
      instance.resolveGateOptions = jest.fn(() => ({
        gateMap: {},
        gateOptions: [],
        defaultGateId: '',
      }));
      instance.clearUnfinishedSurveyDraft = jest.fn();
      instance.seedUploadedQuestionsCache = jest.fn().mockResolvedValue(true);
      instance.startCacheWatch = jest.fn();
      instance.state = {
        ...instance.state,
        showAutoTool: false,
        isStandaloneQuestion: true,
        title: '',
        questions: [
          {
            id: 'q1',
            uiKey: 'q1',
            type: 'freeform',
            prompt: 'Question 1',
            tags: [42, null, true, false, ' topic ', {}, ['nested']],
            aiGeneratedTagsFromSource: [42, null, true, false, ' topic ', {}, ['nested']],
            currentTagInputValue: '',
            isGeneratingTags: false,
          },
        ],
        documentURLs: [],
        surveyHash: '',
      };

      const markup = renderToStaticMarkup(instance.render());
      expect(markup).not.toContain('[object Object]');

      await instance.createSurvey();

      expect(addQuestionsSpy).toHaveBeenCalled();
      expect(addQuestionsSpy.mock.calls[0][2][0].tags).toEqual(['42', 'true', 'false', 'topic']);
    } finally {
      addQuestionsSpy.mockRestore();
    }
  });

  it('keeps standalone question submit scoped to the unresolved requested slug when exact session config is missing', async () => {
    const addQuestionsSpy = jest
      .spyOn(contractScripts, 'addQuestions')
      .mockRejectedValue(
        new Error('[addQuestions] Missing surveys contract address for session slug "missing-session".'),
      );
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const instance = makeInstance({
        loginComplete: true,
        provider: 'web3auth',
        account: '0xabc',
        activeSessionSlug: 'missing-session',
        network: { id: 84532 },
      });

      instance.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue({
        slug: 'missing-session',
        networkChainId: 84532,
        contracts: {},
      });
      instance.resolveGateOptions = jest.fn(() => ({ gateMap: {} }));
      instance.state = {
        ...instance.state,
        isStandaloneQuestion: true,
        title: '',
        questions: [
          {
            id: 'q1',
            type: 'freeform',
            prompt: 'Question 1',
            tags: [],
          },
        ],
        documentURLs: [],
        surveyHash: '',
      };

      await instance.createSurvey();

      expect(addQuestionsSpy).toHaveBeenCalledWith(
        'web3auth',
        ['q1'],
        expect.any(Array),
        [expect.any(String)],
        expect.objectContaining({
          slug: 'missing-session',
          networkChainId: 84532,
        }),
      );
      expect(instance.state.isSubmitting).toBe(false);
      expect(instance.state.submissionError).toContain('missing-session');
    } finally {
      consoleSpy.mockRestore();
      addQuestionsSpy.mockRestore();
    }
  });
});
