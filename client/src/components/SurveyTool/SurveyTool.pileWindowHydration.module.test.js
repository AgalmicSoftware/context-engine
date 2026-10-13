import {
  executeEnsureVisiblePileResponseState,
  executePileInitializeResponseState,
  executePileQuestionSetHydration,
} from './surveyPileResponseController';
import { buildPileComponentUpdatePlan, buildPileQuestionProgressSignals } from './surveyPileLifecycle';

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

describe('SurveyTool pile visible window hydration', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
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
    let lastInitializeResponseSig = '';
    const setState = jest.fn();

    const firstPlan = executePileInitializeResponseState({
      isDirty: false,
      modifiedCount: 0,
      pileQuestions: createPileQuestions(4),
      activePileIndex: 1,
      lastInitializeResponseSig,
      buildEmptyResponseFieldState,
      setLastInitializeResponseSig: (value) => {
        lastInitializeResponseSig = value;
      },
      cloneValue,
      setState,
      onComplete: jest.fn(),
      onNoop: jest.fn(),
    });
    const secondPlan = executePileInitializeResponseState({
      isDirty: false,
      modifiedCount: 0,
      pileQuestions: createPileQuestions(4),
      activePileIndex: 1,
      lastInitializeResponseSig,
      buildEmptyResponseFieldState,
      setLastInitializeResponseSig: jest.fn(),
      cloneValue,
      setState,
      onComplete: jest.fn(),
      onNoop: jest.fn(),
    });

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
    const initializeResponseState = jest.fn();
    const rehydrateVisiblePileWindow = jest.fn();
    const onNoop = jest.fn();

    const plan = executePileQuestionSetHydration({
      requestEpoch: 4,
      resultSignature: 'same-signature',
      lastResultSignature: 'same-signature',
      shouldAbortRequest: () => false,
      initializeResponseState,
      rehydrateVisiblePileWindow,
      onNoop,
    });

    expect(plan?.shouldSkipDuplicateSignature).toBe(true);
    expect(initializeResponseState).not.toHaveBeenCalled();
    expect(rehydrateVisiblePileWindow).not.toHaveBeenCalled();
    expect(onNoop).toHaveBeenCalledTimes(1);
  });

  it('rehydrates pile windows directly when load-time hydration skips response initialization', () => {
    const initializeResponseState = jest.fn();
    const rehydrateVisiblePileWindow = jest.fn();
    const setLastResultSignature = jest.fn();

    const plan = executePileQuestionSetHydration({
      requestEpoch: 6,
      resultSignature: 'next-signature',
      lastResultSignature: '',
      initializeResponses: false,
      forceOverwriteDraft: true,
      resetAutoDecryptLedger: true,
      autoDecryptReason: 'pile-refresh',
      autoDecryptResetReason: 'pile-refresh-reset',
      shouldAbortRequest: () => false,
      setLastResultSignature,
      initializeResponseState,
      rehydrateVisiblePileWindow,
      onNoop: jest.fn(),
    });

    expect(plan?.shouldInitializeResponses).toBe(false);
    expect(initializeResponseState).not.toHaveBeenCalled();
    expect(rehydrateVisiblePileWindow).toHaveBeenCalledWith({
      requestEpoch: 6,
      forceOverwriteDraft: true,
      resetAutoDecryptLedger: true,
      autoDecryptReason: 'pile-refresh',
      autoDecryptResetReason: 'pile-refresh-reset',
    });
    expect(setLastResultSignature).toHaveBeenCalledWith('next-signature');
  });

  it('schedules pile reload when scoped hydration progress advances without nonce ticks', () => {
    const progressSignals = buildPileQuestionProgressSignals({
      previousProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 11,
      },
      nextProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 12,
      },
    });
    const updatePlan = buildPileComponentUpdatePlan({
      progressHydrationTick: progressSignals.progressHydrationTick,
      progressCompletedTick: progressSignals.progressCompletedTick,
      isOptimistic: false,
      hasLiveEdits: false,
      pileQuestionsLength: 0,
      isQuestionCacheReady: true,
      loading: false,
    });

    expect(updatePlan.cacheUpdatePlan).toEqual({ action: 'reload', delayMs: 80 });
    expect(updatePlan.shouldResetContext).toBe(false);
  });

  it('schedules pile reload when pending metadata retry count changes without hydrate count changes', () => {
    const progressSignals = buildPileQuestionProgressSignals({
      previousProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 43,
        pendingMetadataCount: 0,
      },
      nextProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 43,
        hydratedQuestions: 43,
        pendingMetadataCount: 2,
      },
    });
    const updatePlan = buildPileComponentUpdatePlan({
      progressHydrationTick: progressSignals.progressHydrationTick,
      progressCompletedTick: progressSignals.progressCompletedTick,
      isOptimistic: false,
      hasLiveEdits: false,
      pileQuestionsLength: 0,
      isQuestionCacheReady: true,
      loading: false,
    });

    expect(updatePlan.cacheUpdatePlan).toEqual({ action: 'reload', delayMs: 80 });
  });
});
