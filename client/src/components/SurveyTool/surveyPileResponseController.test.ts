import {
  buildPileCachePrefillStatePlan,
  buildPileInitializeResponseStatePatch,
  executeEnsureVisiblePileResponseState,
  executePileInitializeResponseState,
  executePileQuestionSetHydration,
} from './surveyPileResponseController';
import type { PileResponseSlice } from './surveyPileResponseWindow';

type TestResponseField = {
  value: string;
  encrypted: boolean;
  questionId?: string | null;
  fieldKey?: string;
};

type TestResponseSlice = Omit<PileResponseSlice, 'answers' | 'additionalComments'> & {
  answers: Record<string, TestResponseField>;
  additionalComments: Record<string, TestResponseField>;
};

type CachedResponseRecord = {
  answer?: {
    value?: string;
    encrypted?: boolean;
  };
  additional?: {
    value?: string;
    encrypted?: boolean;
  };
};

type PileQuestion = {
  id: string;
};

type TestPileState = {
  pileQuestions: PileQuestion[];
  activePileIndex: number;
  surveysResponseState: TestResponseSlice[];
  editBaseline: TestResponseSlice;
};

type SeedBaselineNextState = {
  surveysResponseState: TestResponseSlice[];
  baselineResponses: TestResponseSlice;
  editBaseline: TestResponseSlice;
  modifiedCount: number;
  isDirty: boolean;
};

type PatchLiveNextState = {
  surveysResponseState: TestResponseSlice[];
};

const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const buildEmptyResponseFieldState = (questionId: string | null = null, fieldKey = 'answer'): TestResponseField => ({
  value: '',
  encrypted: false,
  questionId,
  fieldKey,
});

type TestSetStateUpdate<State> = Partial<State> | null | ((prevState: State) => Partial<State> | null);

const buildSynchronousSetState =
  <State extends Record<string, unknown>>(stateRef: { current: State }) =>
  (update: TestSetStateUpdate<State>, callback?: () => void) => {
    const patch = typeof update === 'function' ? update(stateRef.current) : update;
    if (patch && typeof patch === 'object') {
      stateRef.current = { ...stateRef.current, ...patch };
    }
    if (typeof callback === 'function') callback();
    return patch;
  };

describe('surveyPileResponseController', () => {
  it('seeds pile baseline from cache-prefilled responses when no edit baseline exists', () => {
    const plan = buildPileCachePrefillStatePlan({
      pileQuestions: [{ id: 'q1' }],
      questionResponsesByQuestionId: {
        q1: {
          '0xabc': {
            answer: { value: 'cached-answer', encrypted: false },
            additional: { value: 'cached-note', encrypted: false },
          },
        },
      },
      account: '0xAbC',
      currentSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      editBaseline: null,
      pendingTotal: 0,
      cloneValue,
      applyCachedResponseEntryToSlice: ({ targetSlice, questionId, response }) => {
        const responseRecord = response as CachedResponseRecord;
        targetSlice.answers[questionId] = { value: responseRecord.answer?.value || '', encrypted: false };
        targetSlice.additionalComments[questionId] = {
          value: responseRecord.additional?.value || '',
          encrypted: false,
        };
        return true;
      },
    });
    const nextState = plan.nextState as unknown as SeedBaselineNextState;

    expect(plan.reason).toBe('seed-baseline');
    expect(nextState.surveysResponseState?.[0]?.answers?.q1?.value).toBe('cached-answer');
    expect(nextState.editBaseline?.answers?.q1?.value).toBe('cached-answer');
    expect(nextState.baselineResponses?.additionalComments?.q1?.value).toBe('cached-note');
    expect(nextState.modifiedCount).toBe(0);
    expect(nextState.isDirty).toBe(false);
  });

  it('patches the live pile slice from cache prefill without replacing an existing baseline', () => {
    const plan = buildPileCachePrefillStatePlan({
      pileQuestions: [{ id: 'q1' }],
      questionResponsesByQuestionId: {
        q1: {
          '0xabc': {
            answer: { value: 'cached-answer', encrypted: false },
            additional: { value: '', encrypted: false },
          },
        },
      },
      account: '0xabc',
      currentSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      editBaseline: {
        answers: { q1: { value: '', encrypted: false } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '', encrypted: false } },
      },
      pendingTotal: 0,
      cloneValue,
      applyCachedResponseEntryToSlice: ({ targetSlice, questionId, response }) => {
        const responseRecord = response as CachedResponseRecord;
        targetSlice.answers[questionId] = { value: responseRecord.answer?.value || '', encrypted: false };
        targetSlice.additionalComments[questionId] = {
          value: responseRecord.additional?.value || '',
          encrypted: false,
        };
        return true;
      },
    });
    const nextState = plan.nextState as unknown as PatchLiveNextState;

    expect(plan.reason).toBe('patch-live');
    expect(nextState.surveysResponseState?.[0]?.answers?.q1?.value).toBe('cached-answer');
    expect(nextState).not.toHaveProperty('editBaseline');
    expect(nextState).not.toHaveProperty('baselineResponses');
  });

  it('builds pile response initialization state patches with a normalized baseline', () => {
    const initialSlice = {
      answers: { q1: { value: 'answer', encrypted: false } },
      additionalComments: {},
    };

    const patch = buildPileInitializeResponseStatePatch({
      cloneValue,
      initialSlice,
    });

    expect(patch.surveysResponseState).toEqual([initialSlice]);
    expect(patch.editBaseline).toEqual({
      answers: { q1: { value: 'answer', encrypted: false } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });
    expect(patch.editBaseline).not.toBe(initialSlice);
  });

  it('skips duplicate pile response-window initialization while still invoking the completion callback', () => {
    const setState = jest.fn();
    const onComplete = jest.fn();
    const onNoop = jest.fn();

    const plan = executePileInitializeResponseState({
      isDirty: false,
      modifiedCount: 0,
      pileQuestions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }],
      activePileIndex: 0,
      lastInitializeResponseSig: 'q1|q2|q3',
      buildEmptyResponseFieldState,
      setLastInitializeResponseSig: jest.fn(),
      cloneValue,
      setState,
      onComplete,
      onNoop,
    });

    expect(plan.reason).toBe('unchanged');
    expect(setState).not.toHaveBeenCalled();
    expect(onNoop).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('backfills missing visible pile response slots and rehydrates the visible window once', () => {
    const stateRef: { current: TestPileState } = {
      current: {
        pileQuestions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }],
        activePileIndex: 0,
        surveysResponseState: [
          {
            answers: {
              q1: { value: '', encrypted: false },
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
            q1: { value: '', encrypted: false },
          },
          importance: {},
          conviction: {},
          additionalComments: {
            q1: { value: '', encrypted: false },
          },
        },
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
    expect(stateRef.current.surveysResponseState?.[0]?.answers?.q2).toEqual(
      expect.objectContaining({
        questionId: 'q2',
        fieldKey: 'answer',
      }),
    );
    expect(stateRef.current.editBaseline?.additionalComments?.q3).toEqual(
      expect.objectContaining({
        questionId: 'q3',
        fieldKey: 'additional',
      }),
    );
  });

  it('skips duplicate pile question-set hydration signatures', () => {
    const initializeResponseState = jest.fn();
    const rehydrateVisiblePileWindow = jest.fn();
    const onNoop = jest.fn();

    const plan = executePileQuestionSetHydration({
      requestEpoch: 7,
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

  it('rehydrates pile windows directly when response initialization is intentionally skipped', () => {
    const initializeResponseState = jest.fn();
    const rehydrateVisiblePileWindow = jest.fn();
    const setLastResultSignature = jest.fn();

    const plan = executePileQuestionSetHydration({
      requestEpoch: 9,
      resultSignature: 'next-signature',
      lastResultSignature: 'prev-signature',
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
    expect(setLastResultSignature).toHaveBeenCalledWith('next-signature');
    expect(initializeResponseState).not.toHaveBeenCalled();
    expect(rehydrateVisiblePileWindow).toHaveBeenCalledWith({
      requestEpoch: 9,
      forceOverwriteDraft: true,
      resetAutoDecryptLedger: true,
      autoDecryptReason: 'pile-refresh',
      autoDecryptResetReason: 'pile-refresh-reset',
    });
  });
});
