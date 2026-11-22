import { createSurveyQuestionsResponseEditingRuntime } from './surveyQuestionsResponseEditingRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const createStateRef = (patch: SurveyQuestionsLegacyRecord = {}) => ({
  current: {
    displayAnswerMode: false,
    showJson: false,
    submittedSinceLastEdit: false,
    surveysResponseState: [
      {
        additionalComments: {},
        answers: {},
        conviction: {},
        importance: {},
      },
    ],
    ...patch,
  },
});

const createSetState = (stateRef: { current: SurveyQuestionsLegacyRecord }) =>
  jest.fn((updater: unknown, callback?: () => void | Promise<void>) => {
    const patch =
      typeof updater === 'function'
        ? (updater as (prev: SurveyQuestionsLegacyRecord) => SurveyQuestionsLegacyRecord)(stateRef.current)
        : (updater as SurveyQuestionsLegacyRecord);
    stateRef.current = {
      ...stateRef.current,
      ...patch,
    };
    callback?.();
  });

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => {
  const stateRef = overrides.stateRef || createStateRef();
  const setState = overrides.setState || createSetState(stateRef);

  return {
    bottomRef: { current: null },
    buildAdditionalEncryptionToggleResponseState: jest.fn((prev) => prev),
    buildAdditionalUpdatePlan: jest.fn(() => ({ changed: false })),
    buildAnswerEncryptionToggleResponseState: jest.fn((prev) => prev),
    buildAnswerUpdatePlan: jest.fn(() => ({ changed: false })),
    buildDisplayAnswerModeToggleState: jest.fn((prev) => ({
      displayAnswerMode: !prev.displayAnswerMode,
    })),
    buildEmptyResponseFieldState: jest.fn(() => ({})),
    buildEncryptionTogglePlan: jest.fn(),
    buildInheritedAdditionalFieldState: jest.fn(() => ({})),
    buildParsedViewAddressAnswersState: jest.fn(() => ({
      parsedViewAddressAnswers: {},
    })),
    buildShowJsonState: jest.fn((showJson) => ({ showJson })),
    buildSurveyUserEditResponseStatePatch: jest.fn((surveysResponseState, submittedSinceLastEdit) => ({
      submittedSinceLastEdit,
      surveysResponseState,
    })),
    fetchSingleQuestionData: jest.fn(),
    fetchSurveyResponse: jest.fn(),
    getEffectiveRecipientsForQid: jest.fn(() => []),
    getQuestionById: jest.fn(() => ({ id: 'q1' })),
    inst: {
      _draftDirtyQids: new Set<string>(),
    },
    invalidateDiffCaches: jest.fn(),
    isQuestionLockedForResponse: jest.fn(() => false),
    normalizeFieldAudienceMode: jest.fn((value) => value || 'self'),
    normalizeQuestionIdKey: jest.fn((value) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    ),
    normalizeResponseEncryptionAudience: jest.fn((value) => value || 'self'),
    persistDraftSafely: jest.fn(),
    propsRef: {
      current: {
        isStandalone: false,
        singleQuestionMode: false,
      },
    },
    // Nothing submitted yet.
    resolveDiffBaselineSlice: jest.fn(() => ({})),
    resolveFieldEncryptionAudience: jest.fn(() => 'self'),
    resolveFieldEncryptionGateId: jest.fn(() => ''),
    scheduleJsonPreviewUpdate: jest.fn(),
    setState,
    stateRef,
    topRef: { current: null },
    updateJsonPreview: jest.fn(),
    updateSubmittedSinceLastEdit: jest.fn(() => true),
    utils: {
      keccak256: jest.fn(() => '0xhash'),
      toUtf8Bytes: jest.fn((value) => String(value)),
    },
    valuesEqual: jest.fn(Object.is),
    ...overrides,
  };
};

describe('surveyQuestionsResponseEditingRuntime', () => {
  it('normalizes answer edits and preserves draft side effects', () => {
    const stateRef = createStateRef();
    const afterUpdate = jest.fn();
    const buildAnswerUpdatePlan = jest.fn(() => ({
      changed: true,
      nextAdditionalState: {
        value: 'extra',
      },
      nextAnswerState: {
        encrypted: false,
        value: 'answer',
      },
    }));
    const context = createContext({
      buildAnswerUpdatePlan,
      propsRef: {
        current: {
          isStandalone: true,
          singleQuestionMode: false,
        },
      },
      stateRef,
    });

    createSurveyQuestionsResponseEditingRuntime(context).handleAnswer(4, ' Q1 ', 'answer', { afterUpdate });

    expect(buildAnswerUpdatePlan).toHaveBeenCalledWith(
      'q1',
      'answer',
      expect.objectContaining({
        answers: {},
      }),
      expect.objectContaining({
        computeHash: expect.any(Function),
        getEffectiveRecipientsForQid: expect.any(Function),
        resolveFieldEncryptionAudience: expect.any(Function),
      }),
    );
    expect(stateRef.current.surveysResponseState[0]).toEqual(
      expect.objectContaining({
        additionalComments: {
          q1: {
            value: 'extra',
          },
        },
        answers: {
          q1: {
            encrypted: false,
            value: 'answer',
          },
        },
      }),
    );
    expect(context.inst._draftDirtyQids.has('q1')).toBe(true);
    expect(context.invalidateDiffCaches).toHaveBeenCalledTimes(1);
    expect(context.scheduleJsonPreviewUpdate).toHaveBeenCalledTimes(1);
    expect(context.persistDraftSafely).toHaveBeenCalledTimes(1);
    expect(afterUpdate).toHaveBeenCalledTimes(1);
  });

  it('completes no-op response callbacks so sequenced draft application cannot stall', () => {
    const afterAnswer = jest.fn();
    const afterAdditional = jest.fn();
    const afterConviction = jest.fn();
    const afterImportance = jest.fn();
    const context = createContext({
      stateRef: createStateRef({
        surveysResponseState: [
          {
            answers: {},
            additionalComments: {},
            conviction: { q1: 70 },
            importance: { q1: 80 },
          },
        ],
      }),
    });
    const runtime = createSurveyQuestionsResponseEditingRuntime(context);

    runtime.handleAnswer(0, 'q1', 'same', { afterUpdate: afterAnswer });
    runtime.handleAdditional(0, 'q1', 'same', { afterUpdate: afterAdditional });
    runtime.handleConviction(0, 'q1', 70, { afterUpdate: afterConviction });
    runtime.handleImportance(0, 'q1', 80, { afterUpdate: afterImportance });

    expect(afterAnswer).toHaveBeenCalledTimes(1);
    expect(afterAdditional).toHaveBeenCalledTimes(1);
    expect(afterConviction).toHaveBeenCalledTimes(1);
    expect(afterImportance).toHaveBeenCalledTimes(1);
  });

  it('preserves sequenced interview draft writes when the state ref has not refreshed yet', () => {
    const stateRef = createStateRef();
    let latestState = stateRef.current;
    const setState = jest.fn((updater: unknown, callback?: () => void | Promise<void>) => {
      const patch =
        typeof updater === 'function'
          ? (updater as (prev: SurveyQuestionsLegacyRecord) => SurveyQuestionsLegacyRecord)(latestState)
          : (updater as SurveyQuestionsLegacyRecord);
      latestState = {
        ...latestState,
        ...patch,
      };
      callback?.();
    });
    const runtime = createSurveyQuestionsResponseEditingRuntime(
      createContext({
        buildAdditionalUpdatePlan: jest.fn(() => ({
          changed: true,
          nextAdditionalState: { value: 'reviewed note' },
        })),
        buildAnswerUpdatePlan: jest.fn(() => ({
          changed: true,
          nextAnswerState: { encrypted: false, value: 'Agree' },
        })),
        setState,
        stateRef,
      }),
    );

    runtime.handleAnswer(0, 'q1', 'Agree', { persistDraft: false });
    runtime.handleAdditional(0, 'q1', 'reviewed note', { persistDraft: false });
    runtime.handleImportance(0, 'q1', 70, { persistDraft: false });
    runtime.handleConviction(0, 'q1', 70, { persistDraft: false });

    expect(latestState.surveysResponseState[0]).toEqual(
      expect.objectContaining({
        additionalComments: { q1: { value: 'reviewed note' } },
        answers: { q1: { encrypted: false, value: 'Agree' } },
        importance: { q1: 70 },
        conviction: { q1: 70 },
      }),
    );
    expect(stateRef.current.surveysResponseState[0].answers).toEqual({});
    expect(stateRef.current.surveysResponseState[0].importance).toEqual({});
  });

  it('clears ratings never submitted and closes the slider, as before it opened', () => {
    const stateRef = createStateRef({
      sliderModeByQuestion: { Q1: 'importance', q2: 'conviction' },
      sliderToggleExpandedByQuestion: { Q1: true, q2: true },
      surveysResponseState: [
        {
          answers: { q1: { value: 'Agree' } },
          additionalComments: {},
          conviction: { q1: 6, q2: 3 },
          importance: { q1: 8 },
        },
      ],
    });
    const context = createContext({ stateRef });
    createSurveyQuestionsResponseEditingRuntime(context).clearConvictionImportance(0, 'Q1');

    expect(stateRef.current.surveysResponseState[0]).toEqual({
      answers: { q1: { value: 'Agree' } },
      additionalComments: {},
      conviction: { q2: 3 },
      importance: {},
    });
    const closed = stateRef.current as SurveyQuestionsLegacyRecord;
    expect(closed.sliderModeByQuestion).toEqual({ q2: 'conviction' });
    expect(closed.sliderToggleExpandedByQuestion).toEqual({ q2: true });
    expect(stateRef.current.submittedSinceLastEdit).toBe(true);
    expect(context.inst._draftDirtyQids.has('q1')).toBe(true);
    expect(context.invalidateDiffCaches).toHaveBeenCalledTimes(1);
    expect(context.persistDraftSafely).toHaveBeenCalledWith(0);
  });

  it('returns submitted ratings to their saved values instead of removing them', () => {
    const stateRef = createStateRef({
      sliderToggleExpandedByQuestion: { q1: true },
      surveysResponseState: [{ answers: {}, additionalComments: {}, conviction: { q1: 7 }, importance: { q1: 8 } }],
    });
    // The saved response keys the question in another case and has no importance. It is read
    // with the local cache allowed, like the pending-edit count.
    const resolveDiffBaselineSlice = jest.fn((allowLocalCache: boolean) =>
      allowLocalCache ? { conviction: { Q1: 5 } } : {},
    );
    const context = createContext({ stateRef, resolveDiffBaselineSlice });
    createSurveyQuestionsResponseEditingRuntime(context).clearConvictionImportance(0, 'q1');

    expect(stateRef.current.surveysResponseState[0]).toMatchObject({ conviction: { q1: 5 }, importance: {} });
    expect((stateRef.current as SurveyQuestionsLegacyRecord).sliderToggleExpandedByQuestion).toEqual({});
    expect(context.inst._draftDirtyQids.has('q1')).toBe(true);
    expect(context.persistDraftSafely).toHaveBeenCalledWith(0);
  });

  it('only closes the slider when the ratings already match what was submitted', () => {
    const stateRef = createStateRef({
      sliderToggleExpandedByQuestion: { q1: true },
      surveysResponseState: [{ answers: {}, additionalComments: {}, conviction: { q1: 5 }, importance: {} }],
    });
    const context = createContext({ stateRef, resolveDiffBaselineSlice: jest.fn(() => ({ conviction: { q1: 5 } })) });
    createSurveyQuestionsResponseEditingRuntime(context).clearConvictionImportance(0, 'q1');

    expect(stateRef.current.surveysResponseState[0].conviction).toEqual({ q1: 5 });
    expect((stateRef.current as SurveyQuestionsLegacyRecord).sliderToggleExpandedByQuestion).toEqual({});
    expect(stateRef.current.submittedSinceLastEdit).toBe(false);
    expect(context.persistDraftSafely).not.toHaveBeenCalled();
  });

  it('only closes a slider that was opened without setting a value', () => {
    const stateRef = createStateRef({
      sliderModeByQuestion: { q1: 'conviction' },
      sliderToggleExpandedByQuestion: { q1: true },
    });
    const context = createContext({ stateRef });
    createSurveyQuestionsResponseEditingRuntime(context).clearConvictionImportance(0, 'q1');

    expect((stateRef.current as SurveyQuestionsLegacyRecord).sliderToggleExpandedByQuestion).toEqual({});
    expect(stateRef.current.submittedSinceLastEdit).toBe(false);
    expect(context.inst._draftDirtyQids.size).toBe(0);
    expect(context.persistDraftSafely).not.toHaveBeenCalled();
  });

  it('routes answer encryption toggles through the normalized builder input', () => {
    const toggleInputs: SurveyQuestionsLegacyRecord[] = [];
    const buildAnswerEncryptionToggleResponseState = jest.fn((prev, input) => {
      toggleInputs.push(input);
      return {
        ...prev,
        answerEncryptionUpdated: true,
      };
    });
    const stateRef = createStateRef({
      surveysResponseState: [{ answers: {} }, { answers: {} }, { answers: {} }],
    });
    const context = createContext({
      buildAnswerEncryptionToggleResponseState,
      propsRef: {
        current: {
          isStandalone: false,
          singleQuestionMode: false,
        },
      },
      stateRef,
    });

    createSurveyQuestionsResponseEditingRuntime(context).toggleAnswerEncryption(2, 'Q2', true);

    expect(toggleInputs).toEqual([
      expect.objectContaining({
        newEncryptedState: true,
        questionId: 'q2',
        surveyIndex: 2,
      }),
    ]);
    expect(toggleInputs[0].deps).toEqual(
      expect.objectContaining({
        buildEmptyResponseFieldState: expect.any(Function),
        normalizeResponseEncryptionAudience: expect.any(Function),
        resolveFieldEncryptionAudience: expect.any(Function),
      }),
    );
    expect(stateRef.current.answerEncryptionUpdated).toBe(true);
    expect(context.invalidateDiffCaches).toHaveBeenCalledTimes(1);
    expect(context.scheduleJsonPreviewUpdate).toHaveBeenCalledTimes(1);
    expect(context.persistDraftSafely).toHaveBeenCalledTimes(1);
  });

  it('refreshes the viewed response after enabling display-answer mode', async () => {
    const stateRef = createStateRef();
    const fetchSurveyResponse = jest.fn().mockResolvedValue(undefined);
    const context = createContext({
      fetchSurveyResponse,
      propsRef: {
        current: {
          singleQuestionMode: false,
          viewAddress: '0xabc',
        },
      },
      stateRef,
    });

    createSurveyQuestionsResponseEditingRuntime(context).toggleDisplayAnswerMode();
    await Promise.resolve();

    expect(stateRef.current.displayAnswerMode).toBe(true);
    expect(fetchSurveyResponse).toHaveBeenCalledTimes(1);
    expect(context.updateJsonPreview).toHaveBeenCalledTimes(1);
  });
});
