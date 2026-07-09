import {
  executeSurveyDraftHydration,
  executeSurveyLocalCacheRehydrate,
  executeSurveyResponsePrefill,
  executeSurveySingleQuestionPrefill,
} from './surveyToolHydrationController';
import { buildDraftAwareCacheHydrationState } from './surveyToolHydrationFlow';

type ResponseSlice = {
  answers: Record<string, any>;
  importance: Record<string, any>;
  conviction: Record<string, any>;
  additionalComments: Record<string, any>;
};

const buildEmptySlice = (): ResponseSlice => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

describe('surveyToolHydration shared contracts', () => {
  it('hydrates baseline-only draft entries without mutating the live slice', () => {
    const stateRef: any = {
      current: {
        surveysResponseState: [
          {
            answers: { q1: { value: 'live-answer' } },
            importance: {},
            conviction: {},
            additionalComments: {},
          },
        ],
        editBaseline: buildEmptySlice(),
      },
    };
    const setState = jest.fn((update, callback) => {
      const patch = typeof update === 'function' ? update(stateRef.current) : update;
      stateRef.current = { ...stateRef.current, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    });

    const result = executeSurveyDraftHydration({
      props: {
        isStandalone: false,
        singleQuestionMode: false,
        surveyIndex: 0,
      },
      state: {
        ...stateRef.current,
        suppressPrefill: false,
        submissionError: '',
        modifiedCount: 0,
        isDirty: false,
        submittedSinceLastEdit: false,
        submissionComplete: false,
        pileQuestions: [],
      },
      loadDraft: () => ({
        answers: {},
        baseline: {
          q1: {
            value: 'baseline-answer',
            encrypted: false,
            additionalComment: '',
          },
        },
      }),
      getPendingEditStats: () => ({ total: 0 }),
      getHydrationQuestionIds: () => ['q1'],
      applyDraftHydrationEntryToSlice: ({ targetSlice, questionId, draftEntry }: any) => {
        if (!targetSlice || !questionId || !draftEntry) return false;
        targetSlice.answers[questionId] = {
          value: draftEntry.value,
          encrypted: !!draftEntry.encrypted,
        };
        targetSlice.additionalComments[questionId] = {
          value: draftEntry.additionalComment || '',
          encrypted: false,
        };
        return true;
      },
      cloneBaseline: (value) => JSON.parse(JSON.stringify(value)),
      setState,
      updateJsonPreview: jest.fn(),
    });

    expect(result).toEqual({
      reason: 'applied',
      applied: true,
      renderedQuestionIds: ['q1'],
    });
    expect(stateRef.current.surveysResponseState[0].answers.q1.value).toBe('live-answer');
    expect(stateRef.current.editBaseline.answers.q1.value).toBe('baseline-answer');
  });

  it('refreshes the full-mode baseline during shared prefill even when live edits are dirty', () => {
    const stateRef: any = {
      current: {
        surveysResponseState: [buildEmptySlice()],
        editBaseline: {
          answers: { q1: { value: 'original-baseline' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        isDirty: true,
        submissionComplete: false,
      },
    };
    const setState = jest.fn((update, callback) => {
      const patch = typeof update === 'function' ? update(stateRef.current) : update;
      stateRef.current = { ...stateRef.current, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    });

    const result = executeSurveyResponsePrefill({
      state: stateRef.current,
      surveyIndex: 0,
      userAnswers: {
        responses: [
          {
            questionID: 'q1',
            answer: { value: 'prefilled-answer' },
            additional: { value: 'prefilled-notes' },
            importance: 4,
            conviction: 7,
          },
        ],
      },
      buildSliceFromUserAnswers: () => ({
        answers: { q1: { value: 'new-baseline' } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: 'new-notes' } },
      }),
      applyResponseHydrationListToSlice: ({ targetSlice, responses }: any) => {
        targetSlice.answers.q1 = { value: responses[0].answer.value };
        targetSlice.additionalComments.q1 = { value: responses[0].additional.value };
        targetSlice.importance.q1 = responses[0].importance;
        targetSlice.conviction.q1 = responses[0].conviction;
        return true;
      },
      setState,
      updateJsonPreview: jest.fn(),
      recalculateEditStats: jest.fn(),
    });

    expect(result).toEqual({
      applied: true,
      reason: 'applied',
    });
    expect(stateRef.current.surveysResponseState[0].answers.q1.value).toBe('prefilled-answer');
    expect(stateRef.current.editBaseline.answers.q1.value).toBe('new-baseline');
  });

  it('seeds a clean single-question baseline from shared prefill orchestration', () => {
    const stateRef: any = {
      current: {
        surveysResponseState: [],
        editBaseline: buildEmptySlice(),
        isDirty: false,
        submissionComplete: false,
      },
    };
    const setState = jest.fn((update, callback) => {
      const patch = typeof update === 'function' ? update(stateRef.current) : update;
      stateRef.current = { ...stateRef.current, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    });

    const result = executeSurveySingleQuestionPrefill({
      state: stateRef.current,
      questionId: 'q1',
      userAnswer: {
        questionID: 'q1',
        answer: { value: 'single-answer' },
        additional: { value: 'single-notes' },
      },
      buildSliceFromUserAnswers: () => ({
        answers: { q1: { value: 'seeded-baseline' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: 'baseline-notes' } },
      }),
      applyResponseHydrationListToSlice: ({ targetSlice, responses, questionIdResolver }: any) => {
        const questionId = questionIdResolver(responses[0]);
        targetSlice.answers[questionId] = { value: responses[0].answer.value };
        targetSlice.additionalComments[questionId] = { value: responses[0].additional.value };
        return true;
      },
      setState,
      updateJsonPreview: jest.fn(),
      recalculateEditStats: jest.fn(),
    });

    expect(result).toEqual({
      applied: true,
      reason: 'applied',
    });
    expect(stateRef.current.surveysResponseState[0].answers.q1.value).toBe('single-answer');
    expect(stateRef.current.editBaseline.answers.q1.value).toBe('seeded-baseline');
  });

  it('preserves decrypted-empty draft intent when masked cache envelopes match', async () => {
    const stateRef: any = {
      current: {
        surveysResponseState: [
          {
            answers: {
              q1: {
                value: '*',
                encrypted: true,
                encryptedPortion: 'ans-env-1',
              },
            },
            importance: {},
            conviction: {},
            additionalComments: {},
          },
        ],
        editBaseline: {
          answers: {
            q1: {
              value: '*',
              encrypted: true,
              encryptedPortion: 'ans-env-1',
            },
          },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      },
    };
    const setState = jest.fn((update, callback) => {
      const patch = typeof update === 'function' ? update(stateRef.current) : update;
      stateRef.current = { ...stateRef.current, ...(patch || {}) };
      if (typeof callback === 'function') callback();
      return patch;
    });

    const result = await executeSurveyLocalCacheRehydrate({
      props: {
        isStandalone: false,
        singleQuestionMode: false,
        surveyIndex: 0,
      },
      state: {
        ...stateRef.current,
        suppressPrefill: false,
        submissionError: '',
        submissionComplete: false,
      },
      lastHydrationSig: '',
      getHydrationQuestionIds: () => ['q1'],
      buildHydrationSignature: () => 'rehydrate|q1|contract',
      buildSliceFromLocalCache: async () => ({
        answers: {
          q1: {
            value: '*',
            encrypted: true,
            encryptedPortion: 'ans-env-1',
          },
        },
        importance: {},
        conviction: {},
        additionalComments: {},
      }),
      setLastHydrationSig: jest.fn(),
      loadDraft: () => ({
        answers: {
          q1: {
            value: '',
            answerEncrypted: true,
            answerEncryptedPortion: 'ans-env-1',
          },
        },
      }),
      buildDraftAnswersByQuestionId: () => ({
        q1: {
          value: '',
          answerEncrypted: true,
          answerEncryptedPortion: 'ans-env-1',
        },
      }),
      cloneBaseline: (value) => JSON.parse(JSON.stringify(value)),
      buildDraftAwareCacheHydrationState: (args: any) =>
        buildDraftAwareCacheHydrationState({
          ...args,
          areEnvelopesEquivalent: (incomingEnvelope, currentEnvelope, incomingEncrypted, currentEncrypted) =>
            String(incomingEnvelope || '') === String(currentEnvelope || '') &&
            !!incomingEncrypted === !!currentEncrypted,
        }),
      applyLocalCacheHydrationEntryToSlice: ({
        targetSlice,
        questionId,
        cachedAnswer,
        allowMaskedAnswerDraftEmpty,
      }: any) => {
        if (!targetSlice || !questionId || !cachedAnswer) return false;
        targetSlice.answers[questionId] = {
          ...cachedAnswer,
          value: allowMaskedAnswerDraftEmpty ? '' : cachedAnswer.value,
        };
        return true;
      },
      setState,
      updateJsonPreview: jest.fn(),
      recalculateEditStats: jest.fn(),
      ensurePriorResponses: jest.fn(),
    });

    expect(result).toEqual({
      reason: 'applied',
      applied: true,
      renderedQuestionIds: ['q1'],
      hydrationSig: 'rehydrate|q1|contract',
    });
    expect(stateRef.current.surveysResponseState[0].answers.q1.value).toBe('');
    expect(stateRef.current.editBaseline.answers.q1.value).toBe('');
    expect(stateRef.current.editBaseline.answers.q1.encryptedPortion).toBe('ans-env-1');
  });
});
