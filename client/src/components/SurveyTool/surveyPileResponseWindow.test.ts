import {
  buildEnsureVisiblePileResponseStatePlan,
  buildInitializePileResponseStatePlan,
  buildPileResponseWindow,
} from './surveyPileResponseWindow';

const buildEmptyResponseFieldState = (questionId: string | null = null, fieldKey = 'answer') => ({
  value: '',
  encrypted: false,
  questionId,
  fieldKey,
});

const pileQuestions = [{ id: 'Q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }, { id: 'q5' }, { id: 'q6' }];

describe('surveyPileResponseWindow', () => {
  it('builds the centered pile response window and normalized signature', () => {
    expect(
      buildPileResponseWindow({
        pileQuestions,
        activePileIndex: 3,
      }),
    ).toEqual({
      startIdx: 1,
      endIdx: 6,
      visibleQuestions: pileQuestions.slice(1, 6),
      visibleIdsSignature: 'q2|q3|q4|q5|q6',
    });
  });

  it('initializes only the currently visible pile response slots', () => {
    const plan = buildInitializePileResponseStatePlan({
      pileQuestions,
      activePileIndex: 3,
      lastInitializeResponseSig: '',
      buildEmptyResponseFieldState,
    });

    expect(plan.shouldSkip).toBe(false);
    expect(plan.reason).toBe('initialize');
    expect(plan.nextInitializeResponseSig).toBe('q2|q3|q4|q5|q6');
    expect(Object.keys(plan.initialSlice?.answers || {})).toEqual(['q2', 'q3', 'q4', 'q5', 'q6']);
    expect(plan.initialSlice?.answers?.q2).toEqual(
      expect.objectContaining({
        value: '',
        fieldKey: 'answer',
        questionId: 'q2',
      }),
    );
    expect(plan.initialSlice?.additionalComments?.q6).toEqual(
      expect.objectContaining({
        value: '',
        fieldKey: 'additional',
        questionId: 'q6',
      }),
    );
    expect(plan.initialSlice?.answers?.Q1).toBeUndefined();
  });

  it('skips pile response initialization while dirty or when the visible signature is unchanged', () => {
    expect(
      buildInitializePileResponseStatePlan({
        pileQuestions,
        activePileIndex: 0,
        isDirty: true,
        buildEmptyResponseFieldState,
      }),
    ).toEqual(
      expect.objectContaining({
        shouldSkip: true,
        reason: 'dirty',
      }),
    );

    expect(
      buildInitializePileResponseStatePlan({
        pileQuestions,
        activePileIndex: 0,
        lastInitializeResponseSig: 'q1|q2|q3',
        buildEmptyResponseFieldState,
      }),
    ).toEqual(
      expect.objectContaining({
        shouldSkip: true,
        reason: 'unchanged',
        nextInitializeResponseSig: 'q1|q2|q3',
      }),
    );
  });

  it('backfills missing visible pile response and baseline slots without overwriting existing entries', () => {
    const plan = buildEnsureVisiblePileResponseStatePlan({
      pileQuestions,
      activePileIndex: 1,
      currentSlice: {
        answers: {
          Q1: { value: 'Existing answer' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          Q1: { value: 'Existing note' },
          q2: { value: 'Keep note' },
        },
      },
      currentBaseline: {
        answers: {
          Q1: { value: 'Existing answer' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          Q1: { value: 'Existing note' },
        },
      },
      buildEmptyResponseFieldState,
    });

    expect(plan.shouldSkip).toBe(false);
    expect(plan.reason).toBe('backfill');
    expect(plan.updates?.surveysResponseState?.[0]?.answers?.Q1).toEqual({ value: 'Existing answer' });
    expect(plan.updates?.surveysResponseState?.[0]?.answers?.q2).toEqual(
      expect.objectContaining({
        fieldKey: 'answer',
        questionId: 'q2',
      }),
    );
    expect(plan.updates?.surveysResponseState?.[0]?.additionalComments?.q3).toEqual(
      expect.objectContaining({
        fieldKey: 'additional',
        questionId: 'q3',
      }),
    );
    expect(plan.updates?.editBaseline?.answers?.q4).toEqual(
      expect.objectContaining({
        fieldKey: 'answer',
        questionId: 'q4',
      }),
    );
    expect(plan.updates?.editBaseline?.additionalComments?.q4).toEqual(
      expect.objectContaining({
        fieldKey: 'additional',
        questionId: 'q4',
      }),
    );
  });

  it('returns a no-op plan when every visible pile card already has response slots', () => {
    const filledPlan = buildEnsureVisiblePileResponseStatePlan({
      pileQuestions,
      activePileIndex: 0,
      currentSlice: {
        answers: {
          Q1: { value: '' },
          q2: { value: '' },
          q3: { value: '' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          Q1: { value: '' },
          q2: { value: '' },
          q3: { value: '' },
        },
      },
      currentBaseline: {
        answers: {
          Q1: { value: '' },
          q2: { value: '' },
          q3: { value: '' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          Q1: { value: '' },
          q2: { value: '' },
          q3: { value: '' },
        },
      },
      buildEmptyResponseFieldState,
    });

    expect(filledPlan).toEqual(
      expect.objectContaining({
        shouldSkip: true,
        reason: 'already-ready',
        updates: null,
      }),
    );
  });
});
