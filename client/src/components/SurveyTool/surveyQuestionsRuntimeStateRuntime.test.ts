import { createSurveyQuestionsRuntimeStateRuntime } from './surveyQuestionsRuntimeStateRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  buildCanDecryptContext: jest.fn(() => ({
    cfg: { gates: [] },
    slug: 'edge',
    snapshot: {
      account: '0xabc',
      key: 'edge|0xabc',
      resourceKeysToCheck: ['questionResponses'],
      signature: 'sig-1',
    },
  })),
  buildCanDecryptOtherResponsesState: jest.fn((patch) => ({
    canDecryptOtherResponses: !!patch.canDecrypt,
    canDecryptOtherResponsesStatus: patch.status,
  })),
  buildQuestionIdScopeSignature: jest.fn((pool = []) =>
    Array.isArray(pool) ? pool.map((entry) => String(entry?.id || '')).join(',') : '',
  ),
  checkSponsoredAccess: jest.fn(),
  clearAutoDecryptSweepScheduling: jest.fn(),
  evaluateCanDecryptPreCheck: jest.fn(() => ({
    earlyExit: true,
    status: 'not-connected',
  })),
  getPendingStatsSnapshotFromState: jest.fn(() => ({ encrypted: 1, total: 2 })),
  getResponseGatePolicy: jest.fn(() => ({ primaryResource: 'questionResponses' })),
  getSessionSlugHintFromProps: jest.fn((props) => props.sessionSlug || ''),
  getSessionSlugPinnedFromProps: jest.fn((props) => props.pinnedSessionSlug || ''),
  inst: {
    _autoDecryptMaskedAttemptSignature: { q1: true },
    _autoDecryptVisibleSweepCache: { previous: true },
    _autoDecProcessing: true,
    _autoDecQueue: ['q1'],
    _canDecryptOtherResponsesInFlight: null,
    _canDecryptOtherResponsesKey: '',
    _canDecryptOtherResponsesRunId: 0,
    _canDecryptOtherResponsesSig: '',
    _changedQidsAndFieldsCache: { cached: true },
    _lastPendingStats: null,
    _pendingEditStatsCache: { cached: true },
  },
  isResponseGateQuestionFlow: jest.fn(() => true),
  propsRef: {
    current: {
      account: '0xabc',
      isStandalone: false,
      loginComplete: true,
      network: { id: '11155420' },
      networkChainId: 11155420,
      onPendingStatsChange: jest.fn(),
      questionID: 'q1',
      questionPool: [{ id: 'q1' }],
      responderAddress: '',
      sbtCacheRevision: 1,
      singleQuestionMode: false,
      surveyId: 'survey-1',
      surveyIndex: 3,
      viewAddress: '',
    },
  },
  resolveCanDecryptGateAccess: jest.fn(async () => ({ canDecrypt: true, status: 'allowed' })),
  resolveEffectiveResponseGateConfig: jest.fn(() => ({ gates: [] })),
  resolveEffectiveSlug: jest.fn(() => 'edge'),
  resolveResponseGateSessionSlug: jest.fn(() => 'edge'),
  setState: jest.fn(),
  stateRef: {
    current: {
      canDecryptOtherResponses: true,
      canDecryptOtherResponsesStatus: 'allowed',
      editBaseline: { q1: 'old' },
      isSubmitting: false,
      pileQuestions: [],
      questionPool: [{ id: 'q1' }],
      submittedSinceLastEdit: false,
      surveysResponseState: [{ answers: {} }],
      userAnswers: {},
    },
  },
  surveyLog: {
    warn: jest.fn(),
  },
  ...overrides,
});

describe('surveyQuestionsRuntimeStateRuntime', () => {
  it('tracks can-decrypt run ownership and clears only the tracked promise', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRuntimeStateRuntime(context);
    const tracked = Promise.resolve(true);
    const other = Promise.resolve(false);

    const runId = runtime.startCanDecryptOtherResponsesRun('sig-1');
    context.inst._canDecryptOtherResponsesInFlight = tracked;

    expect(runId).toBe(1);
    expect(runtime.isCurrentCanDecryptOtherResponsesRun(1, 'sig-1')).toBe(true);
    runtime.clearCanDecryptOtherResponsesInFlightIfTracked(other);
    expect(context.inst._canDecryptOtherResponsesInFlight).toBe(tracked);
    runtime.clearCanDecryptOtherResponsesInFlightIfTracked(tracked);
    expect(context.inst._canDecryptOtherResponsesInFlight).toBeNull();

    runtime.invalidateCanDecryptOtherResponsesTracking();
    expect(runtime.isCurrentCanDecryptOtherResponsesRun(1, 'sig-1')).toBe(false);
  });

  it('resets blocked auto-decrypt queues and visible sweep cache', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRuntimeStateRuntime(context);

    runtime.resetVisibleAutoDecryptSweepState();

    expect(context.inst._autoDecryptVisibleSweepCache).toBeNull();
    expect(context.inst._autoDecQueue).toEqual([]);
    expect(context.inst._autoDecProcessing).toBe(false);
    expect(context.inst._autoDecryptMaskedAttemptSignature).toEqual({});
    expect(context.clearAutoDecryptSweepScheduling).toHaveBeenCalled();
  });

  it('early-exits can-decrypt refresh and clears stale grants', async () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRuntimeStateRuntime(context);

    await expect(runtime.refreshCanDecryptOtherResponses()).resolves.toBe(false);

    expect(context.evaluateCanDecryptPreCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'edge|0xabc',
      }),
    );
    expect(context.setState).toHaveBeenCalledWith({
      canDecryptOtherResponses: false,
      canDecryptOtherResponsesStatus: 'not-connected',
    });
    expect(context.resolveCanDecryptGateAccess).not.toHaveBeenCalled();
  });

  it('emits pending stats only when the observable payload changes', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRuntimeStateRuntime(context);

    runtime.emitPendingStats({ encrypted: 1, total: 2 });
    runtime.emitPendingStats({ encrypted: 1, total: 2 });
    runtime.emitPendingStats({ encrypted: 2, total: 2 });

    expect(context.propsRef.current.onPendingStatsChange).toHaveBeenCalledTimes(2);
    expect(context.propsRef.current.onPendingStatsChange).toHaveBeenLastCalledWith({
      encrypted: 2,
      isSubmitting: false,
      submittedSinceLastEdit: false,
      total: 2,
    });
    expect(runtime.getPendingStatsSnapshot()).toEqual({ encrypted: 1, total: 2 });
  });

  it('resolves active survey index and edit-diff invalidation state', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsRuntimeStateRuntime(context);

    expect(runtime.getActiveSurveyIndex()).toBe(3);
    expect(
      runtime.didEditDiffInputsChange(context.propsRef.current, {
        ...context.stateRef.current,
        questionPool: [{ id: 'q1' }],
        pileQuestions: [],
      }),
    ).toBe(false);

    runtime.invalidateDiffCaches();
    expect(context.inst._changedQidsAndFieldsCache).toBeNull();
    expect(context.inst._pendingEditStatsCache).toBeNull();
  });
});
