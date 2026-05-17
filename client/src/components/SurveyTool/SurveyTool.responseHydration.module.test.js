import { SurveyQuestions } from './SurveyQuestions';

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushAsyncCallbacks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const syncClassSetState = (subject) => {
  subject.setState = jest.fn((next, cb) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    if (patch && typeof patch === 'object') {
      subject.state = { ...subject.state, ...patch };
    }
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject.setState;
};

describe('SurveyTool response hydration', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not let late survey response hydration undo start fresh', async () => {
    const deferred = createDeferred();
    const subject = new SurveyQuestions({
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      surveyId: 'survey-a',
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: { q1: { value: 'old draft' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      ],
      userAnswers: null,
      submissionComplete: false,
      isLoadingResponse: false,
    };
    syncClassSetState(subject);
    subject.getLatestSurveyResponse = jest.fn(() => deferred.promise);
    subject.prefillSurveyResponses = jest.fn();
    subject.getCurrentRenderedQuestionIds = jest.fn(() => ['q1']);
    subject.buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));
    subject.deepClone = jest.fn((value) => JSON.parse(JSON.stringify(value)));
    subject.clearDraftFor = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.persistDraftSafely = jest.fn();

    const pendingHydration = subject.fetchSurveyResponse();
    await Promise.resolve();
    expect(subject.state.isLoadingResponse).toBe(true);

    subject.handleStartFresh();
    expect(subject.state.startFresh).toBe(true);
    expect(subject.state.suppressPrefill).toBe(true);
    expect(subject.state.isLoadingResponse).toBe(false);

    deferred.resolve({
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'late chain answer' },
          additional: { value: 'late chain note' },
        },
      ],
    });
    await pendingHydration;
    await flushAsyncCallbacks();

    expect(subject.prefillSurveyResponses).not.toHaveBeenCalled();
    expect(subject.state.startFresh).toBe(true);
    expect(subject.state.suppressPrefill).toBe(true);
    expect(subject.state.userAnswers).toBeNull();
    expect(subject.state.surveysResponseState[0].answers.q1.value).toBe('');
  });

  it('prefills current survey responses after storing fetched user answers', async () => {
    const userAnswers = {
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'chain answer' },
          additional: { value: 'chain note' },
        },
      ],
    };
    const subject = new SurveyQuestions({
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      surveyId: 'survey-a',
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      surveysResponseState: [
        {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      ],
      editBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      userAnswers: null,
      submissionComplete: false,
      isLoadingResponse: false,
    };
    subject.getLatestSurveyResponse = jest.fn().mockResolvedValue(userAnswers);
    subject.prefillSurveyResponses = jest.fn();
    subject.invalidateResponseHydrationRuns = jest.fn(
      subject.invalidateResponseHydrationRuns.bind(subject),
    );
    subject.invalidateDiffCaches = jest.fn(subject.invalidateDiffCaches.bind(subject));
    subject.setState = jest.fn((next, cb) => {
      const prevState = subject.state;
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      const diffInputsChanged = subject.didEditDiffInputsChange(subject.props, prevState);
      if (diffInputsChanged) {
        if (!subject._responseHydrationStateUpdateDepth) {
          subject.invalidateResponseHydrationRuns();
        }
        subject.invalidateDiffCaches();
      }
      if (prevState.userAnswers !== subject.state.userAnswers) {
        subject._userAnswersSliceCache = { source: null, value: null };
        if (!diffInputsChanged) subject.invalidateDiffCaches();
      }
      if (typeof cb === 'function') cb();
      return patch;
    });

    await subject.fetchSurveyResponse();

    expect(subject.state.userAnswers).toBe(userAnswers);
    expect(subject.prefillSurveyResponses).toHaveBeenCalledWith(userAnswers, {
      responseHydrationOwned: true,
    });
    expect(subject.invalidateResponseHydrationRuns).not.toHaveBeenCalled();
    expect(subject.state.isLoadingResponse).toBe(false);
  });

  it('clears the response loading flag when canceling active hydration runs', () => {
    const subject = new SurveyQuestions({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      account: '0xabc',
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      isLoadingResponse: true,
    };
    syncClassSetState(subject);

    subject.invalidateResponseHydrationRuns();

    expect(subject.state.isLoadingResponse).toBe(false);
  });

  it('invalidates response hydration for prop context changes during owned hydration updates', async () => {
    const subject = new SurveyQuestions({
      account: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      surveyId: 'survey-b',
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 0,
      loginComplete: true,
      network: { id: 84532 },
      networkChainId: 84532,
    });
    subject._isMounted = true;
    subject._responseHydrationStateUpdateDepth = 1;
    subject.state = {
      ...subject.state,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      questionPool: [{ id: 'q1' }],
      pileQuestions: [],
      userAnswers: null,
      submissionComplete: false,
      isLoadingResponse: true,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      isDirty: false,
      autoDecryptEnabled: false,
      showComments: {},
      prefillQueuedAfterCache: false,
      submittedSinceLastEdit: false,
    };
    syncClassSetState(subject);
    subject.invalidateResponseHydrationRuns = jest.fn(
      subject.invalidateResponseHydrationRuns.bind(subject),
    );
    subject.invalidateDiffCaches = jest.fn(subject.invalidateDiffCaches.bind(subject));
    subject.getPendingEditStats = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.emitPendingStats = jest.fn();
    subject.recalculateEditStats = jest.fn();
    subject.maybeRefreshCanDecryptOtherResponses = jest.fn();
    subject.fetchQuestionPool = jest.fn().mockResolvedValue(undefined);
    subject.initializeSurveyResponseState = jest.fn(() => [
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
    ]);
    subject.fetchSurveyResponse = jest.fn().mockResolvedValue(undefined);
    subject.checkAndHandleStartFresh = jest.fn();
    subject.hydrateGateSbtLabels = jest.fn();
    subject.isAutoDecryptBlocked = () => false;

    const prevProps = {
      ...subject.props,
      surveyId: 'survey-a',
    };
    const prevState = { ...subject.state };

    await subject.componentDidUpdate(prevProps, prevState);

    expect(subject.invalidateResponseHydrationRuns).toHaveBeenCalledTimes(1);
    expect(subject.state.isLoadingResponse).toBe(false);
  });
});
