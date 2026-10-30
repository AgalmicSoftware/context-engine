import { workerCanonicalAuthoringPort } from '../../domains/surveys/workerCanonicalAuthoringPort';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import {
  resolveWorkerCanonicalCacheIdentity,
  workerCanonicalCacheIdentityMatches,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import {
  arweaveClient,
  buildCreateSurveyDraftStorageKey,
  contractScripts,
  makeInstance,
  peekCacheSyncMock,
  resourceKeys,
  writeCacheOptimisticMock,
} from './CreateQuestionsAndSurveys.cacheTestUtils';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const config = (slug: string, chainId = 1) => ({ slug, networkChainId: chainId, contracts: { surveys: { chainId } } });
const setup = (standalone: boolean) => {
  const subject = makeInstance({
    loginComplete: true,
    provider: 'web3auth',
    account: '0xaaa',
    activeSessionSlug: 'session-a',
    sessionSlug: 'session-a',
    sessionConfig: config('session-a'),
    network: { id: 1 },
  });
  subject.ensureResolvedSessionConfigForSubmit = jest.fn().mockResolvedValue(config('session-a'));
  subject.resolveGateOptions = jest.fn(() => ({ gateMap: {}, gateOptions: [], defaultGateId: '' }));
  subject.startCacheWatch = jest.fn();
  subject.state = {
    ...subject.state,
    showAutoTool: false,
    isStandaloneQuestion: standalone,
    cacheLoaded: true,
    lastSubmittedSurveyId: 'previous',
    lastSubmittedSurveyArweaveTxId: 'previous-ref',
    title: 'Submitted title',
    surveyHash: '0xsurvey',
    questions: [{ id: 'q1', type: 'freeform', prompt: 'Submitted question', tags: [] }],
  };
  subject.saveToLocalStorage({ immediate: true });
  const published = deferred<{ receipt: { status: number }; uploadedQuestions: { questionId: string }[] }>();
  const entered = deferred<void>();
  jest.spyOn(contractScripts, standalone ? 'addQuestions' : 'addSurveyWithQuestions').mockImplementation(async () => {
    entered.resolve();
    return published.promise;
  });
  return { subject, published, entered };
};

describe('publication completes in its captured session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    peekCacheSyncMock.mockReturnValue({});
    writeCacheOptimisticMock.mockImplementation(async () => undefined);
    jest.spyOn(contractScripts, 'getLatestBlockNumber').mockResolvedValue(123);
    jest
      .spyOn(resourceKeys, 'getEffectiveArweaveKey')
      .mockResolvedValue({ arweaveJwk: '', source: 'session' } as Awaited<
        ReturnType<typeof resourceKeys.getEffectiveArweaveKey>
      >);
    jest.spyOn(arweaveClient, 'uploadDataToArweave').mockResolvedValue('fixture-arweave');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([true, false])('keeps B untouched after switching from A (questions=%s)', async (standalone) => {
    const { subject, published, entered } = setup(standalone);
    const aKey = buildCreateSurveyDraftStorageKey('session-a');
    const bKey = buildCreateSurveyDraftStorageKey('session-b');
    localStorage.setItem(bKey, 'draft-b');
    const operation = subject.createSurvey();
    await entered.promise;
    subject.props = {
      ...subject.props,
      activeSessionSlug: 'session-b',
      sessionSlug: 'session-b',
      sessionConfig: config('session-b', 2),
      network: { id: 2 },
      account: '0xbbb',
    };
    subject.state = {
      ...subject.state,
      title: 'B title',
      questions: [{ id: 'q-b', type: 'freeform', prompt: 'B question', tags: [] }],
    };
    const bState = JSON.stringify(subject.state);
    const timer = setTimeout(() => {}, 60000);
    subject._draftSaveTimer = timer;
    published.resolve({ receipt: { status: 1 }, uploadedQuestions: [{ questionId: 'q1' }] });
    await operation;
    expect(localStorage.getItem(bKey)).toBe('draft-b');
    expect(JSON.stringify(subject.state)).toBe(bState);
    expect(subject._draftSaveTimer).toBe(timer);
    expect(localStorage.getItem(aKey)).toBeNull();
    expect(subject.startCacheWatch).not.toHaveBeenCalled();
    expect(writeCacheOptimisticMock).toHaveBeenCalledWith(
      'questionsCache',
      'session-a',
      expect.objectContaining({
        '1': expect.objectContaining({
          questions: expect.objectContaining({
            q1: expect.objectContaining({ prompt: 'Submitted question', creator: '0xaaa' }),
          }),
        }),
      }),
    );
    expect(writeCacheOptimisticMock.mock.calls.every(([, slug]) => slug === 'session-a')).toBe(true);
    if (!standalone) expect(writeCacheOptimisticMock.mock.calls.some(([name]) => name === 'surveysCache')).toBe(true);
    clearTimeout(timer);
  });

  it.each([true, false])('preserves edits made while publishing (questions=%s)', async (standalone) => {
    const { subject, published, entered } = setup(standalone);
    const operation = subject.createSurvey();
    await entered.promise;
    subject.state = {
      ...subject.state,
      title: 'Edited while pending',
      questions: [{ id: 'q2', type: 'freeform', prompt: 'New draft', tags: [] }],
    };
    subject.saveToLocalStorage({ immediate: true });
    const key = buildCreateSurveyDraftStorageKey('session-a');
    const edited = localStorage.getItem(key);
    published.resolve({ receipt: { status: 1 }, uploadedQuestions: [{ questionId: 'q1' }] });
    await operation;
    expect(localStorage.getItem(key)).toBe(edited);
    expect(subject.state.isSubmitting).toBe(false);
    expect(subject.state.title).toBe('Edited while pending');
    expect(subject.state.questions[0].prompt).toBe('New draft');
  });

  it.each([true, false])(
    'clears the stored draft even when its last debounced save predates submit (questions=%s)',
    async (standalone) => {
      const { subject, published, entered } = setup(standalone);
      subject.state = { ...subject.state, title: 'Latest submitted title' };
      const operation = subject.createSurvey();
      await entered.promise;
      published.resolve({ receipt: { status: 1 }, uploadedQuestions: [{ questionId: 'q1' }] });
      await operation;
      expect(localStorage.getItem(buildCreateSurveyDraftStorageKey('session-a'))).toBeNull();
    },
  );

  it('preserves a draft saved by another editor during publication', async () => {
    const { subject, published, entered } = setup(true);
    const operation = subject.createSurvey();
    await entered.promise;
    const key = buildCreateSurveyDraftStorageKey('session-a');
    localStorage.setItem(key, 'newer-editor-draft');
    published.resolve({ receipt: { status: 1 }, uploadedQuestions: [{ questionId: 'q1' }] });
    await operation;
    expect(localStorage.getItem(key)).toBe('newer-editor-draft');
  });

  it.each([true, false])('clears the unchanged submitted draft without a switch (questions=%s)', async (standalone) => {
    const { subject, published, entered } = setup(standalone);
    const operation = subject.createSurvey();
    await entered.promise;
    published.resolve({ receipt: { status: 1 }, uploadedQuestions: [{ questionId: 'q1' }] });
    await operation;
    expect(localStorage.getItem(buildCreateSurveyDraftStorageKey('session-a'))).toBeNull();
    expect(subject.state.title).toBe('');
    expect(subject.startCacheWatch).toHaveBeenCalled();
  });
});

describe('publication capture boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    peekCacheSyncMock.mockReturnValue({});
    writeCacheOptimisticMock.mockImplementation(async () => undefined);
    jest.spyOn(contractScripts, 'getLatestBlockNumber').mockResolvedValue(123);
    jest
      .spyOn(resourceKeys, 'getEffectiveArweaveKey')
      .mockResolvedValue({ arweaveJwk: '', source: 'session' } as Awaited<
        ReturnType<typeof resourceKeys.getEffectiveArweaveKey>
      >);
    jest.spyOn(arweaveClient, 'uploadDataToArweave').mockResolvedValue('fixture-arweave');
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['account', 'chain'])('leaves the current form and timer alone after a %s change', async (change) => {
    const { subject, published, entered } = setup(true);
    const operation = subject.createSurvey();
    await entered.promise;
    subject.props =
      change === 'account'
        ? { ...subject.props, account: '0xbbb' }
        : { ...subject.props, sessionConfig: config('session-a', 2), network: { id: 2 } };
    const stateBefore = JSON.stringify(subject.state);
    const timer = setTimeout(() => {}, 60000);
    subject._draftSaveTimer = timer;
    try {
      published.resolve({ receipt: { status: 1 }, uploadedQuestions: [{ questionId: 'q1' }] });
      await operation;
      expect(JSON.stringify(subject.state)).toBe(stateBefore);
      expect(subject._draftSaveTimer).toBe(timer);
      expect(subject.startCacheWatch).not.toHaveBeenCalled();
    } finally {
      clearTimeout(timer);
    }
  });

  it('captures the submitted draft and account before resolving session configuration', async () => {
    const { subject, published, entered } = setup(true);
    const resolveConfig = deferred<ReturnType<typeof config>>();
    subject.ensureResolvedSessionConfigForSubmit = jest.fn(() => resolveConfig.promise);
    const operation = subject.createSurvey();
    subject.props = {
      ...subject.props,
      activeSessionSlug: 'session-b',
      sessionSlug: 'session-b',
      account: '0xbbb',
      sessionConfig: config('session-b', 2),
      network: { id: 2 },
    };
    subject.state = {
      ...subject.state,
      title: 'B',
      questions: [{ id: 'b', type: 'freeform', prompt: 'B question', tags: [] }],
    };
    resolveConfig.resolve(config('session-a'));
    await entered.promise;
    published.resolve({ receipt: { status: 1 }, uploadedQuestions: [{ questionId: 'q1' }] });
    await operation;
    expect(subject.state.title).toBe('B');
    expect(contractScripts.addQuestions).toHaveBeenCalledWith(
      'web3auth',
      ['q1'],
      [expect.objectContaining({ prompt: 'Submitted question', creator: '0xaaa', sessionSlug: 'session-a' })],
      expect.anything(),
      expect.objectContaining({ slug: 'session-a' }),
    );
  });

  it.each([true, false])(
    'keeps the captured Worker cache identity after switching sessions (questions=%s)',
    async (standalone) => {
      const { subject } = setup(standalone);
      const workerConfig = {
        slug: 'session-a',
        sessionId: `0x${'1'.repeat(32)}`,
        corsWorkerUrl: 'https://worker-a.example.test',
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        contracts: {},
      };
      subject.props = { ...subject.props, sessionConfig: workerConfig };
      subject.saveToLocalStorage({ immediate: true });
      const published = deferred<Awaited<ReturnType<typeof workerCanonicalAuthoringPort.publishSurvey>>>();
      const entered = deferred<void>();
      jest
        .spyOn(workerCanonicalAuthoringPort, standalone ? 'publishQuestions' : 'publishSurvey')
        .mockImplementation(async () => {
          entered.resolve();
          return published.promise;
        });
      const operation = subject.createSurvey();
      await entered.promise;
      subject.props = {
        ...subject.props,
        activeSessionSlug: 'session-b',
        sessionSlug: 'session-b',
        sessionConfig: { ...workerConfig, slug: 'session-b', corsWorkerUrl: 'https://worker-b.example.test' },
      };
      published.resolve({
        sessionConfig: workerConfig,
        sessionSlug: 'session-a',
        sessionId: workerConfig.sessionId,
        workerUrl: workerConfig.corsWorkerUrl,
        workerCanonicalSubmission: true,
        uploadedQuestions: [{ questionId: 'q1', resource: 'questions' }],
        surveyStorageRef: { backend: 'cloudflare', id: 'survey', resource: 'surveys' },
      });
      await operation;
      const expectedIdentity = resolveWorkerCanonicalCacheIdentity({
        sessionConfig: workerConfig,
        sessionSlug: 'session-a',
      });
      const calls = writeCacheOptimisticMock.mock.calls;
      expect(calls).toHaveLength(standalone ? 1 : 2);
      for (const [, slug, snapshot] of calls) {
        expect(slug).toBe('session-a');
        expect(
          workerCanonicalCacheIdentityMatches((snapshot as Record<string, unknown>).worker, expectedIdentity),
        ).toBe(true);
      }
    },
  );
});
