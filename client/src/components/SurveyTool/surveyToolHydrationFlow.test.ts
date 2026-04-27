import {
  buildCacheHydrationSlice,
  buildDraftAwareCacheHydrationState,
  buildDraftHydrationState,
  buildLocalCacheRehydrationState,
  buildPrefilledSurveyState,
} from './surveyToolHydrationFlow.js';

describe('surveyToolHydrationFlow', () => {
  it('builds draft hydration state for live and baseline slices', () => {
    const cloneBaseline = jest.fn((baseline) => JSON.parse(JSON.stringify(baseline)));
    const applyDraftEntryToSlice = jest.fn(({ targetSlice, questionId, draftEntry }) => {
      targetSlice.answers[questionId] = { value: draftEntry.value };
      targetSlice.additionalComments[questionId] = { value: `${draftEntry.value}-notes` };
      targetSlice.importance[questionId] = draftEntry.importance;
      targetSlice.conviction[questionId] = draftEntry.conviction;
      return true;
    });

    expect(buildDraftHydrationState({
      renderedQuestionIds: ['Q1', 'q2'],
      draft: {
        answers: {
          q1: { value: 'answer-1', importance: 4, conviction: 7 },
        },
        baseline: {
          q2: { value: 'baseline-2', importance: 2, conviction: 3 },
        },
      },
      prevSlice: {
        answers: { q0: { value: 'keep' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      prevBaseline: {
        answers: { q9: { value: 'baseline-keep' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      allowOverwrite: true,
      cloneBaseline,
      applyDraftEntryToSlice,
    })).toEqual({
      nextSlice: {
        answers: {
          q0: { value: 'keep' },
          q1: { value: 'answer-1' },
        },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: 'answer-1-notes' } },
      },
      nextBaseline: {
        answers: {
          q9: { value: 'baseline-keep' },
          q2: { value: 'baseline-2' },
        },
        importance: { q2: 2 },
        conviction: { q2: 3 },
        additionalComments: { q2: { value: 'baseline-2-notes' } },
      },
      changed: true,
      baselineChanged: true,
    });

    expect(cloneBaseline).toHaveBeenCalledTimes(1);
    expect(applyDraftEntryToSlice).toHaveBeenCalledTimes(2);
  });

  it('returns unchanged slices when no rendered ids or draft entries apply', () => {
    const applyDraftEntryToSlice = jest.fn();

    expect(buildDraftHydrationState({
      renderedQuestionIds: [],
      draft: null,
      prevSlice: null,
      prevBaseline: null,
      allowOverwrite: false,
      cloneBaseline: null,
      applyDraftEntryToSlice,
    })).toEqual({
      nextSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      nextBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      changed: false,
      baselineChanged: false,
    });

    expect(applyDraftEntryToSlice).not.toHaveBeenCalled();
  });

  it('builds local-cache hydration slices from rendered ids and parsed cached responses', () => {
    const parseResponse = jest.fn((raw) => {
      if (typeof raw !== 'string') return raw;
      try { return JSON.parse(raw); } catch { return null; }
    });
    const applyCachedResponseEntryToSlice = jest.fn(({ targetSlice, questionId, response }) => {
      targetSlice.answers[questionId] = { value: response.answer.value };
      targetSlice.additionalComments[questionId] = { value: response.additional.value };
      targetSlice.importance[questionId] = response.importance;
      targetSlice.conviction[questionId] = response.conviction;
      return true;
    });

    expect(buildCacheHydrationSlice({
      renderedQuestionIds: ['Q1', 'q2'],
      mergedQuestionResponses: {
        q1: {
          '0xabc': JSON.stringify({
            answer: { value: '*' },
            additional: { value: '*' },
            importance: 4,
            conviction: 7,
          }),
        },
        q2: {
          '0xabc': {
            answer: { value: 'live' },
            additional: { value: 'notes' },
            importance: 2,
            conviction: 3,
          },
        },
        q3: {
          '0xabc': {
            malformed: true,
          },
        },
      },
      account: '0xAbC',
      parseResponse,
      applyCachedResponseEntryToSlice,
    })).toEqual({
      slice: {
        answers: {
          q1: { value: '*' },
          q2: { value: 'live' },
        },
        importance: { q1: 4, q2: 2 },
        conviction: { q1: 7, q2: 3 },
        additionalComments: {
          q1: { value: '*' },
          q2: { value: 'notes' },
        },
      },
      changed: true,
    });

    expect(parseResponse).toHaveBeenCalledTimes(2);
    expect(applyCachedResponseEntryToSlice).toHaveBeenCalledTimes(2);
  });

  it('builds draft-aware cache hydration state for masked decrypted-empty carry-forward', () => {
    const areEnvelopesEquivalent = jest.fn((incomingEnvelope, currentEnvelope, incomingEncrypted, currentEncrypted) => (
      String(incomingEnvelope || '') === String(currentEnvelope || '') &&
      !!incomingEncrypted === !!currentEncrypted
    ));

    expect(buildDraftAwareCacheHydrationState({
      cachedAnswer: { value: '*', encrypted: true, encryptedPortion: 'ans-env' },
      cachedAdditional: { value: '*', encrypted: true, encryptedPortion: 'add-env' },
      draftEntry: {
        value: '',
        answerEncrypted: true,
        answerEncryptedPortion: 'ans-env',
        additional: '',
        additionalEncrypted: true,
        additionalEncryptedPortion: 'add-env',
      },
      currentAnswer: { value: '*', encrypted: true, encryptedPortion: 'ans-env' },
      currentAdditional: { value: '*', encrypted: true, encryptedPortion: 'add-env' },
      baselineAnswer: { value: '*', encrypted: true, encryptedPortion: 'ans-env' },
      baselineAdditional: { value: '*', encrypted: true, encryptedPortion: 'add-env' },
      areEnvelopesEquivalent,
    })).toEqual({
      effectiveAnswerState: { value: '', encrypted: true, encryptedPortion: 'ans-env' },
      effectiveAdditionalState: { value: '', encrypted: true, encryptedPortion: 'add-env' },
      canReplaceMaskedAnswerWithDraftEmpty: true,
      canReplaceMaskedAdditionalWithDraftEmpty: true,
      canReplaceMaskedBaselineAnswerWithDraftEmpty: true,
      canReplaceMaskedBaselineAdditionalWithDraftEmpty: true,
    });
  });

  it('builds local-cache rehydration state for live and baseline slices', () => {
    const cloneBaseline = jest.fn((baseline) => JSON.parse(JSON.stringify(baseline)));
    const buildDraftAwareState = jest.fn(() => ({
      effectiveAnswerState: { value: '', encrypted: true, encryptedPortion: 'ans-env' },
      effectiveAdditionalState: { value: '', encrypted: true, encryptedPortion: 'add-env' },
      canReplaceMaskedAnswerWithDraftEmpty: true,
      canReplaceMaskedAdditionalWithDraftEmpty: false,
      canReplaceMaskedBaselineAnswerWithDraftEmpty: false,
      canReplaceMaskedBaselineAdditionalWithDraftEmpty: true,
    }));
    const applyLocalCacheHydrationEntryToSlice = jest.fn(({
      targetSlice,
      questionId,
      cachedAnswer,
      cachedAdditional,
      cachedImportance,
      cachedConviction,
      allowMaskedAnswerDraftEmpty,
      allowMaskedAdditionalDraftEmpty,
    }) => {
      if (allowMaskedAnswerDraftEmpty && cachedAnswer) {
        targetSlice.answers[questionId] = cachedAnswer;
      }
      if (allowMaskedAdditionalDraftEmpty && cachedAdditional) {
        targetSlice.additionalComments[questionId] = cachedAdditional;
      }
      if (cachedImportance !== undefined) targetSlice.importance[questionId] = cachedImportance;
      if (cachedConviction !== undefined) targetSlice.conviction[questionId] = cachedConviction;
      return true;
    });

    expect(buildLocalCacheRehydrationState({
      renderedQuestionIds: ['Q1'],
      baseSlice: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'ans-env' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '*', encrypted: true, encryptedPortion: 'add-old' } },
      },
      prevBaseline: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'ans-old' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '*', encrypted: true, encryptedPortion: 'add-env' } },
      },
      cacheSlice: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'ans-env' } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: '*', encrypted: true, encryptedPortion: 'add-env' } },
      },
      draftAnswersByQuestionId: {
        q1: {
          value: '',
          answerEncrypted: true,
          answerEncryptedPortion: 'ans-env',
          additional: '',
          additionalEncrypted: true,
          additionalEncryptedPortion: 'add-env',
        },
      },
      cloneBaseline,
      buildDraftAwareCacheHydrationState: buildDraftAwareState,
      applyLocalCacheHydrationEntryToSlice,
      debugLabel: '[Survey][rehydrateLocal]',
    })).toEqual({
      nextSlice: {
        answers: { q1: { value: '', encrypted: true, encryptedPortion: 'ans-env' } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: '*', encrypted: true, encryptedPortion: 'add-old' } },
      },
      nextBaseline: {
        answers: { q1: { value: '*', encrypted: true, encryptedPortion: 'ans-old' } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: '', encrypted: true, encryptedPortion: 'add-env' } },
      },
      changed: true,
      baselineChanged: true,
    });

    expect(cloneBaseline).toHaveBeenCalledTimes(1);
    expect(buildDraftAwareState).toHaveBeenCalledTimes(1);
    expect(applyLocalCacheHydrationEntryToSlice).toHaveBeenCalledTimes(2);
  });

  it('builds prefilled survey state with hydrated slice and optional baseline writes', () => {
    const applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses }) => {
      const first = responses[0];
      if (!first) return false;
      targetSlice.answers.q1 = { value: first.answer.value };
      targetSlice.additionalComments.q1 = { value: first.additional.value };
      targetSlice.importance.q1 = first.importance;
      targetSlice.conviction.q1 = first.conviction;
      return true;
    });
    const buildSliceFromUserAnswers = jest.fn((_userAnswers, prevSlice) => ({
      ...(prevSlice || {}),
      answers: {
        ...((prevSlice && prevSlice.answers) || {}),
        q1: { value: 'baseline answer' },
      },
      additionalComments: {
        ...((prevSlice && prevSlice.additionalComments) || {}),
        q1: { value: 'baseline notes' },
      },
      importance: { q1: 4 },
      conviction: { q1: 7 },
    }));

    expect(buildPrefilledSurveyState({
      surveyIndex: 1,
      prevSurveysResponseState: [
        { answers: { q0: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
      ],
      prevEditBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      isDirty: false,
      submissionComplete: false,
      responses: [
        {
          answer: { value: 'hydrated answer' },
          additional: { value: 'hydrated notes' },
          importance: 4,
          conviction: 7,
        },
      ],
      applyResponseHydrationListToSlice,
      buildSliceFromUserAnswers,
    })).toEqual({
      nextSurveysResponseState: [
        { answers: { q0: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
        {
          answers: { q1: { value: 'hydrated answer' } },
          importance: { q1: 4 },
          conviction: { q1: 7 },
          additionalComments: { q1: { value: 'hydrated notes' } },
        },
      ],
      nextBaseline: {
        answers: { q1: { value: 'baseline answer' } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: 'baseline notes' } },
      },
      shouldWriteBaseline: true,
    });

    expect(buildPrefilledSurveyState({
      surveyIndex: 0,
      prevSurveysResponseState: [],
      prevEditBaseline: null,
      isDirty: true,
      submissionComplete: true,
      responses: [],
      applyResponseHydrationListToSlice,
      buildSliceFromUserAnswers,
    }).shouldWriteBaseline).toBe(false);
  });
});
