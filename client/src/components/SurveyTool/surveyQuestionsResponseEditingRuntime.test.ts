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
