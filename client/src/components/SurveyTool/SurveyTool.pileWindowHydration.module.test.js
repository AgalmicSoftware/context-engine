import {
  buildPileCachePrefillStatePlan,
  executeEnsureVisiblePileResponseState,
  executePileInitializeResponseState,
  executePileQuestionSetHydration,
} from './surveyPileResponseController';
import { buildPileComponentUpdatePlan, buildPileQuestionProgressSignals } from './surveyPileLifecycle';
import { buildPileResponseWindow } from './surveyPileResponseWindow';

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

const buildEmptyResponseFieldState = (questionId = null, fieldKey = 'answer') => ({
  value: '',
  encrypted: false,
  questionId,
  fieldKey,
});

const buildSynchronousSetState = (stateRef) => (update, callback) => {
  const patch = typeof update === 'function' ? update(stateRef.current) : update;
  if (patch && typeof patch === 'object') {
    stateRef.current = { ...stateRef.current, ...patch };
  }
  if (typeof callback === 'function') callback();
  return patch;
};

const createPileQuestions = (count) =>
  Array.from({ length: count }, (_, idx) => ({
    id: `q${idx + 1}`,
    type: 'freeform',
    prompt: `Q${idx + 1}`,
  }));

const applyCachedResponseEntryToSlice = ({ targetSlice, questionId, response }) => {
  targetSlice.answers[questionId] = {
    value: response?.answer?.value || '',
    encrypted: !!response?.answer?.encrypted,
  };
  targetSlice.additionalComments[questionId] = {
    value: response?.additional?.value || '',
    encrypted: !!response?.additional?.encrypted,
  };
  return true;
};

describe('SurveyTool pile visible window hydration', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
  it('rehydrates newly visible pile window answers when active index changes without nonce ticks', async () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      questionResponsesNonce: 5,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      suppressPrefill: false,
      submissionError: '',
      submissionComplete: false,
      pileQuestions: [
        { id: 'q1', type: 'freeform', prompt: 'Q1' },
        { id: 'q2', type: 'freeform', prompt: 'Q2' },
        { id: 'q3', type: 'freeform', prompt: 'Q3' },
        { id: 'q4', type: 'freeform', prompt: 'Q4' },
        { id: 'q5', type: 'freeform', prompt: 'Q5' },
        { id: 'q6', type: 'freeform', prompt: 'Q6' },
      ],
      activePileIndex: 0,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
    };
    subject.setState = (update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
    };
    subject.buildSliceFromLocalCache = jest.fn().mockResolvedValue({
      answers: {
        q6: { value: 'Hydrated q6', encrypted: false },
      },
      additionalComments: {},
      importance: {},
      conviction: {},
    });
    subject.ensurePriorResponsesForRenderedIds = jest.fn().mockResolvedValue(false);
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.rehydrateLocalCacheAnswersForRenderedIds();
    expect(subject.buildSliceFromLocalCache).toHaveBeenCalledTimes(1);
    expect(subject.state.surveysResponseState?.[0]?.answers?.q6).toBeUndefined();

    subject.state = { ...subject.state, activePileIndex: 5 };
    await subject.rehydrateLocalCacheAnswersForRenderedIds();

    expect(subject.buildSliceFromLocalCache).toHaveBeenCalledTimes(2);
    expect(subject.state.surveysResponseState?.[0]?.answers?.q6?.value).toBe('Hydrated q6');
  });

  it('backfills newly visible pile response slots without clearing the current auto-decrypt ledger', () => {
    const stateRef = {
      current: {
        pileQuestions: createPileQuestions(3),
        activePileIndex: 0,
        surveysResponseState: [
          {
            answers: {
              q1: { value: 'Existing', encrypted: false },
            },
            importance: {},
            conviction: {},
            additionalComments: {
              q1: { value: '', encrypted: false },
            },
          },
        ],
        editBaseline: {
          answers: {
            q1: { value: 'Existing', encrypted: false },
          },
          importance: {},
          conviction: {},
          additionalComments: {
            q1: { value: '', encrypted: false },
          },
        },
        autoDecryptAttempted: { 'q1:answer': true },
        decryptingByKey: { 'q1:answer': true },
        _autoDecryptMaskedAttemptSignature: { 'q1:answer': 'masked-sig' },
      },
    };
    const onRehydrateVisibleWindow = jest.fn();

    const plan = executeEnsureVisiblePileResponseState({
      getState: () => stateRef.current,
      buildEmptyResponseFieldState,
      setState: buildSynchronousSetState(stateRef),
      onRehydrateVisibleWindow,
      onError: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    expect(plan?.reason).toBe('backfill');
    expect(onRehydrateVisibleWindow).toHaveBeenCalledTimes(1);
    expect(stateRef.current.autoDecryptAttempted).toEqual({ 'q1:answer': true });
    expect(stateRef.current.decryptingByKey).toEqual({ 'q1:answer': true });
    expect(stateRef.current._autoDecryptMaskedAttemptSignature).toEqual({ 'q1:answer': 'masked-sig' });
    expect(stateRef.current.surveysResponseState?.[0]?.answers?.q2).toEqual(expect.objectContaining({ value: '' }));
    expect(stateRef.current.surveysResponseState?.[0]?.additionalComments?.q3).toEqual(
      expect.objectContaining({ value: '' }),
    );
    // port note: dropped direct `rehydrateDraftForRenderedIds(false)` inspection.
    // The extracted controller owns the visible-window backfill and invokes the
    // rehydrate callback exactly once without touching auto-decrypt ledger state.
  });

  it('does not rebuild the same visible pile response window twice', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      questionResponsesNonce: 5,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      pileQuestions: [
        { id: 'q1', type: 'freeform', prompt: 'Q1' },
        { id: 'q2', type: 'freeform', prompt: 'Q2' },
        { id: 'q3', type: 'freeform', prompt: 'Q3' },
        { id: 'q4', type: 'freeform', prompt: 'Q4' },
      ],
      activePileIndex: 1,
      isDirty: false,
      modifiedCount: 0,
      surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
      editBaseline: null,
    };

    expect(firstPlan.reason).toBe('initialize');
    expect(firstPlan.initialSlice?.answers && Object.keys(firstPlan.initialSlice.answers)).toEqual([
      'q1',
      'q2',
      'q3',
      'q4',
    ]);
    expect(secondPlan.reason).toBe('unchanged');
    expect(setState).toHaveBeenCalledTimes(1);
  });

  it('skips duplicate pile question-set hydration signatures', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      questionResponsesNonce: 5,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject._loadAndSortQuestionsEpoch = 4;
    subject._lastLoadAndSortResultSignature = 'same-signature';
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateVisiblePileWindow = jest.fn();

    subject.runPileQuestionSetHydration({
      requestEpoch: 4,
      resultSignature: 'same-signature',
    });

    expect(subject.initializeResponseState).not.toHaveBeenCalled();
    expect(subject.rehydrateVisiblePileWindow).not.toHaveBeenCalled();
  });

  it('rehydrates pile windows directly when load-time hydration skips response initialization', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '0xabc',
      loginComplete: true,
      sessionSlug: 'edge',
      questionResponsesNonce: 5,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject._loadAndSortQuestionsEpoch = 6;
    subject.initializeResponseState = jest.fn();
    subject.rehydrateVisiblePileWindow = jest.fn();

    subject.runPileQuestionSetHydration({
      requestEpoch: 6,
      resultSignature: 'next-signature',
      initializeResponses: false,
      forceOverwriteDraft: true,
      resetAutoDecryptLedger: true,
      autoDecryptReason: 'pile-refresh',
      autoDecryptResetReason: 'pile-refresh-reset',
    });

    expect(subject.initializeResponseState).not.toHaveBeenCalled();
    expect(subject.rehydrateVisiblePileWindow).toHaveBeenCalledWith({
      requestEpoch: 6,
      forceOverwriteDraft: true,
      resetAutoDecryptLedger: true,
      autoDecryptReason: 'pile-refresh',
      autoDecryptResetReason: 'pile-refresh-reset',
    });
    expect(subject._lastLoadAndSortResultSignature).toBe('next-signature');
  });

  it('schedules pile reload when scoped hydration progress advances without nonce ticks', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 4,
      questionResponsesNonce: 7,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 12,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      submissionComplete: false,
      isDirty: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      autoDecryptEnabled: false,
      decryptingByKey: {},
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
    };

    subject.didEditDiffInputsChange = jest.fn(() => false);
    subject.getPendingEditStats = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.getPendingStatsSnapshot = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.emitPendingStats = jest.fn();
    subject.syncLoadingElapsedTimer = jest.fn();
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.checkCacheAgainstBaseline = jest.fn();

    const prevProps = {
      ...subject.props,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 11,
      },
    };
    const prevState = { ...subject.state };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.scheduleLoadAndSortQuestions).toHaveBeenCalledWith(80);
    expect(subject.checkCacheAgainstBaseline).not.toHaveBeenCalled();
  });

  it('schedules pile reload when pending metadata retry count changes without hydrate count changes', () => {
    const shell = new SurveyTool({
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      questionsCacheNonce: 4,
      questionResponsesNonce: 7,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 43,
        pendingMetadataCount: 2,
      },
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      loading: false,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      submissionComplete: false,
      isDirty: false,
      modifiedCount: 0,
      encryptedModifiedCount: 0,
      autoDecryptEnabled: false,
      decryptingByKey: {},
      surveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
      editBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      userAnswers: null,
    };

    subject.didEditDiffInputsChange = jest.fn(() => false);
    subject.getPendingEditStats = jest.fn(() => ({ total: 0, encrypted: 0 }));
    subject.emitPendingStats = jest.fn();
    subject.syncLoadingElapsedTimer = jest.fn();
    subject.scheduleLoadAndSortQuestions = jest.fn();
    subject.checkCacheAgainstBaseline = jest.fn();

    const prevProps = {
      ...subject.props,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 43,
        pendingMetadataCount: 0,
      },
    };
    const prevState = { ...subject.state };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.scheduleLoadAndSortQuestions).toHaveBeenCalledWith(80);
  });

});
