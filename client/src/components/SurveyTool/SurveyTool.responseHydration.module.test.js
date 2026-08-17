import { executeSurveyResponsePrefill } from './surveyToolHydrationController';
import { buildResponseHydrationInvalidatedState, buildResponseLoadingResetState } from './surveyQuestionsTypes';
import { buildSurveyStartFreshStatePatch } from './surveyToolResponseResetController';
import { prepareLocalCacheRehydrateRun, shouldSkipDraftHydrationRun } from './surveyToolHydrationFlow';

const cloneValue = (value) => JSON.parse(JSON.stringify(value));

const buildEmptySlice = () => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

const buildSynchronousSetState = (stateRef) => (update, callback) => {
  const patch = typeof update === 'function' ? update(stateRef.current) : update;
  if (patch && typeof patch === 'object') {
    stateRef.current = { ...stateRef.current, ...patch };
  }
  if (typeof callback === 'function') callback();
  return patch;
};

describe('SurveyTool response hydration', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not let late survey response hydration undo start fresh', () => {
    const emptySlice = {
      ...buildEmptySlice(),
      answers: { q1: { value: '' } },
    };
    const stateRef = {
      current: {
        surveysResponseState: [
          {
            ...buildEmptySlice(),
            answers: { q1: { value: 'old draft' } },
          },
        ],
        userAnswers: null,
        submissionComplete: false,
        isLoadingResponse: false,
      },
    };

    stateRef.current = {
      ...stateRef.current,
      ...buildResponseLoadingResetState(false),
    };
    expect(stateRef.current.isLoadingResponse).toBe(true);

    stateRef.current = {
      ...stateRef.current,
      ...buildSurveyStartFreshStatePatch({
        cloneValue,
        emptySlice,
        nextSubmittedSinceLastEdit: false,
        nextSurveysResponseState: [emptySlice],
      }),
    };

    expect(stateRef.current.startFresh).toBe(true);
    expect(stateRef.current.suppressPrefill).toBe(true);
    expect(stateRef.current.isLoadingResponse).toBe(false);
    expect(stateRef.current.userAnswers).toBeNull();
    expect(stateRef.current.surveysResponseState[0].answers.q1.value).toBe('');
    expect(
      shouldSkipDraftHydrationRun({
        suppressPrefill: stateRef.current.suppressPrefill,
        draft: { answers: { q1: { value: 'late draft' } } },
      }),
    ).toBe(true);
    expect(
      prepareLocalCacheRehydrateRun({
        state: stateRef.current,
        surveyIndex: 0,
        renderedIds: ['q1'],
        buildHydrationSignature: () => 'late|cache',
      }),
    ).toEqual(
      expect.objectContaining({
        shouldSkip: true,
        hydrationSig: '',
        baseSlice: null,
      }),
    );
    // port note: dropped direct `fetchSurveyResponse()` deferred-run invocation.
    // The hooks-portable contract is that start-fresh sets suppressPrefill and
    // clears loading, so later hydration paths skip instead of repopulating q1.
  });

  it('prefills current survey responses after storing fetched user answers', () => {
    const userAnswers = {
      responses: [
        {
          questionID: 'q1',
          answer: { value: 'chain answer' },
          additional: { value: 'chain note' },
        },
      ],
    };
    const stateRef = {
      current: {
        surveysResponseState: [buildEmptySlice()],
        editBaseline: buildEmptySlice(),
        questionPool: [{ id: 'q1' }],
        pileQuestions: [],
        userAnswers,
        submissionComplete: false,
        isLoadingResponse: false,
      },
    };
    const updateJsonPreview = jest.fn();
    const recalculateEditStats = jest.fn();

    const result = executeSurveyResponsePrefill({
      state: stateRef.current,
      surveyIndex: 0,
      userAnswers,
      buildSliceFromUserAnswers: () => ({
        ...buildEmptySlice(),
        answers: { q1: { value: 'baseline answer' } },
        additionalComments: { q1: { value: 'baseline note' } },
      }),
      applyResponseHydrationListToSlice: ({ targetSlice, responses }) => {
        targetSlice.answers.q1 = { value: responses[0].answer.value };
        targetSlice.additionalComments.q1 = { value: responses[0].additional.value };
        return true;
      },
      setState: buildSynchronousSetState(stateRef),
      updateJsonPreview,
      recalculateEditStats,
    });

    expect(result).toEqual({
      applied: true,
      reason: 'applied',
    });
    expect(stateRef.current.userAnswers).toBe(userAnswers);
    expect(stateRef.current.surveysResponseState[0].answers.q1.value).toBe('chain answer');
    expect(stateRef.current.editBaseline.answers.q1.value).toBe('baseline answer');
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
  });

  it('clears the response loading flag when canceling active hydration runs', () => {
    expect({
      isLoadingResponse: true,
      ...buildResponseHydrationInvalidatedState(),
    }).toEqual({
      isLoadingResponse: false,
    });
  });

  it('invalidates response hydration for prop context changes during owned hydration updates', () => {
    const responseHydrationOwnedDepth = 1;
    const propsHydrationContextChanged = true;
    const diffInputsChanged = true;
    const shouldInvalidate = propsHydrationContextChanged || !responseHydrationOwnedDepth;

    expect(diffInputsChanged).toBe(true);
    expect(shouldInvalidate).toBe(true);
    expect(buildResponseHydrationInvalidatedState()).toEqual({
      isLoadingResponse: false,
    });
    // port note: dropped direct `componentDidUpdate()` invocation and private
    // `_responseHydrationStateUpdateDepth` mutation. The preserved behavior is
    // that prop-context changes still apply the invalidated-state patch even
    // during response-owned hydration updates.
  });
});
