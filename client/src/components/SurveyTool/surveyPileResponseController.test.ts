import {
  buildPileInitializeResponseStatePatch,
  executeEnsureVisiblePileResponseState,
  executePileInitializeResponseState,
  executePileQuestionSetHydration,
  hasPileResponseSliceValues,
  shouldInitializePileResponses,
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
  it('detects existing submitted pile ratings before response initialization', () => {
    expect(
      hasPileResponseSliceValues({
        answers: {},
        importance: { q1: 70 },
        conviction: {},
        additionalComments: {},
      }),
    ).toBe(true);
    expect(
      hasPileResponseSliceValues({
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      }),
    ).toBe(false);
  });

  it('preserves submitted pile values while still initializing empty reset slices', () => {
    expect(
      shouldInitializePileResponses({
        submissionComplete: false,
        currentSlice: {
          answers: {},
          importance: { q1: 70 },
          conviction: { q1: 70 },
          additionalComments: {},
        },
      }),
    ).toBe(false);

    expect(
      shouldInitializePileResponses({
        submissionComplete: false,
        currentSlice: {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      }),
    ).toBe(true);

    expect(
      shouldInitializePileResponses({
        submissionComplete: true,
        currentSlice: null,
      }),
    ).toBe(false);
  });

  it('backfills visible pile questions when initialization is skipped for an existing response slice', () => {
    const initializeResponseState = jest.fn();
    const rehydrateVisiblePileWindow = jest.fn();

    const plan = executePileQuestionSetHydration({
      resultSignature: 'q1|q2',
      initializeResponses: shouldInitializePileResponses({
        submissionComplete: false,
        currentSlice: {
          answers: { q1: { value: 'Agree', encrypted: false } },
          importance: { q1: 70 },
          conviction: { q1: 70 },
          additionalComments: {},
        },
      }),
      initializeResponseState,
      rehydrateVisiblePileWindow,
    });

    expect(plan?.shouldInitializeResponses).toBe(false);
    expect(initializeResponseState).not.toHaveBeenCalled();
    expect(rehydrateVisiblePileWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        autoDecryptReason: 'pile-hydration',
      }),
    );
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
