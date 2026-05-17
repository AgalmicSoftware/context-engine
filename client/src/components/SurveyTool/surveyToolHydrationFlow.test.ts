import {
  buildCacheHydrationSlice,
  buildDraftHydrationUpdatePlan,
  shouldSkipDraftHydrationRun,
  buildDraftHydrationSeedContext,
  buildDraftHydrationRunPlan,
  buildDraftHydrationRenderedQuestionIds,
  buildDraftHydrationOverwriteDecision,
  buildDraftAwareCacheHydrationState,
  buildDraftHydrationState,
  loadDraftAnswersByQuestionIdSafely,
  buildExitEditingStatePatch,
  buildHydratedResponseSlice,
  buildInitializedSurveyResponseState,
  loadLocalCacheHydrationSlice,
  buildLocalCacheRehydrationUpdatePlan,
  prepareLocalCacheRehydrateRun,
  buildRevertPendingStatePatch,
  buildResetFormStatePatch,
  buildStartFreshSurveyState,
  buildLocalCacheHydrationMemoKey,
  buildMergedSurveyResponseState,
  buildMergedHydrationQuestionResponses,
  buildLocalCacheRehydrationState,
  buildSurveyResponseStateArray,
  resolveExitEditingBaselineSlice,
  resolveRevertPendingBaselineSlice,
  shouldHandleStartFresh,
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

  it('loads draft answers safely for local-cache rehydrate fallback handling', () => {
    const buildDraftAnswersByQuestionId = jest.fn(() => ({
      q1: { value: 'draft-answer' },
    }));
    const onError = jest.fn();

    expect(loadDraftAnswersByQuestionIdSafely({
      loadDraft: () => ({ answers: { q1: { value: 'raw-draft' } } }),
      buildDraftAnswersByQuestionId,
      onError,
    })).toEqual({
      q1: { value: 'draft-answer' },
    });
    expect(onError).not.toHaveBeenCalled();

    const draftError = new Error('draft-load-failed');
    expect(loadDraftAnswersByQuestionIdSafely({
      loadDraft: () => {
        throw draftError;
      },
      buildDraftAnswersByQuestionId,
      onError,
    })).toEqual({});
    expect(onError).toHaveBeenCalledWith(draftError);

    onError.mockClear();
    const buildError = new Error('draft-map-failed');
    expect(loadDraftAnswersByQuestionIdSafely({
      loadDraft: () => ({ answers: { q1: { value: 'raw-draft' } } }),
      buildDraftAnswersByQuestionId: () => {
        throw buildError;
      },
      onError,
    })).toEqual({});
    expect(onError).toHaveBeenCalledWith(buildError);
  });

  it('builds draft hydration rendered ids with optional pile expansion', () => {
    expect(buildDraftHydrationRenderedQuestionIds({
      hydrationQuestionIds: ['q1', 'Q2'],
      pileQuestions: [
        { id: 'q2' },
        { id: 'q3' },
      ],
      forceOverwrite: false,
    })).toEqual(['q1', 'q2']);

    expect(buildDraftHydrationRenderedQuestionIds({
      hydrationQuestionIds: ['q1', 'Q2'],
      pileQuestions: [
        { id: 'q2' },
        { id: 'q3' },
      ],
      forceOverwrite: true,
    })).toEqual(['q1', 'q2', 'q3']);
  });

  it('builds draft hydration overwrite decisions from pending edit state', () => {
    expect(buildDraftHydrationOverwriteDecision({
      forceOverwrite: true,
      isDirty: false,
      modifiedCount: 0,
      pendingStats: { total: 0 },
      submittedSinceLastEdit: false,
      submissionComplete: false,
    })).toEqual({
      pendingTotal: 0,
      submittedStateActive: false,
      allowOverwrite: true,
    });

    expect(buildDraftHydrationOverwriteDecision({
      forceOverwrite: false,
      isDirty: true,
      modifiedCount: 2,
      pendingStats: { total: 2 },
      submittedSinceLastEdit: true,
      submissionComplete: true,
    })).toEqual({
      pendingTotal: 2,
      submittedStateActive: true,
      allowOverwrite: false,
    });
  });

  it('decides when draft hydration should skip and resolves its seed context', () => {
    expect(shouldSkipDraftHydrationRun({
      suppressPrefill: true,
      submissionError: '',
      draft: { answers: { q1: { value: 'x' } } },
    })).toBe(true);

    expect(shouldSkipDraftHydrationRun({
      suppressPrefill: false,
      submissionError: 'failed',
      draft: { answers: { q1: { value: 'x' } } },
    })).toBe(true);

    expect(shouldSkipDraftHydrationRun({
      suppressPrefill: false,
      submissionError: '',
      draft: { answers: {}, baseline: {} },
    })).toBe(false);

    expect(buildDraftHydrationSeedContext({
      isStandalone: false,
      singleQuestionMode: false,
      surveyIndex: 2,
      surveysResponseState: [
        { answers: { q0: { value: 'keep-0' } }, importance: {}, conviction: {}, additionalComments: {} },
      ],
    })).toEqual({
      surveyIndex: 2,
      prevSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
    });

    expect(buildDraftHydrationSeedContext({
      isStandalone: true,
      singleQuestionMode: false,
      surveyIndex: 3,
      surveysResponseState: [
        { answers: { q1: { value: 'keep-1' } }, importance: {}, conviction: {}, additionalComments: {} },
      ],
    })).toEqual({
      surveyIndex: 0,
      prevSlice: {
        answers: { q1: { value: 'keep-1' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
    });
  });

  it('builds draft hydration run plans from rendered ids, overwrite rules, and update plan state', () => {
    const cloneBaseline = jest.fn((baseline) => JSON.parse(JSON.stringify(baseline)));
    const applyDraftEntryToSlice = jest.fn(({ targetSlice, questionId, draftEntry }) => {
      targetSlice.answers[questionId] = { value: draftEntry.value };
      return true;
    });

    expect(buildDraftHydrationRunPlan({
      hydrationQuestionIds: ['q1'],
      pileQuestions: [{ id: 'q2' }],
      forceOverwrite: true,
      isDirty: false,
      modifiedCount: 0,
      pendingStats: { total: 0 },
      submittedSinceLastEdit: false,
      submissionComplete: false,
      prevSurveysResponseState: [
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      ],
      surveyIndex: 0,
      draft: {
        answers: {
          q2: { value: 'off-screen' },
        },
      },
      prevSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      prevBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      cloneBaseline,
      applyDraftEntryToSlice,
    })).toEqual({
      renderedQuestionIds: ['q1', 'q2'],
      allowOverwrite: true,
      nextSlice: {
        answers: { q2: { value: 'off-screen' } },
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
      changed: true,
      baselineChanged: false,
      updates: {
        surveysResponseState: [
          {
            answers: { q2: { value: 'off-screen' } },
            importance: {},
            conviction: {},
            additionalComments: {},
          },
        ],
      },
    });
  });

  it('builds draft hydration update plans from slice and baseline changes', () => {
    const cloneBaseline = jest.fn((baseline) => JSON.parse(JSON.stringify(baseline)));
    const applyDraftEntryToSlice = jest.fn(({ targetSlice, questionId, draftEntry }) => {
      targetSlice.answers[questionId] = { value: draftEntry.value };
      targetSlice.additionalComments[questionId] = { value: `${draftEntry.value}-notes` };
      targetSlice.importance[questionId] = draftEntry.importance;
      targetSlice.conviction[questionId] = draftEntry.conviction;
      return true;
    });

    expect(buildDraftHydrationUpdatePlan({
      prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      surveyIndex: 2,
      renderedQuestionIds: ['q1'],
      draft: {
        answers: {
          q1: { value: 'answer-1', importance: 4, conviction: 7 },
        },
        baseline: {
          q1: { value: 'baseline-1', importance: 2, conviction: 3 },
        },
      },
      prevSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      prevBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      allowOverwrite: true,
      cloneBaseline,
      applyDraftEntryToSlice,
    })).toEqual({
      nextSlice: {
        answers: { q1: { value: 'answer-1' } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: 'answer-1-notes' } },
      },
      nextBaseline: {
        answers: { q1: { value: 'baseline-1' } },
        importance: { q1: 2 },
        conviction: { q1: 3 },
        additionalComments: { q1: { value: 'baseline-1-notes' } },
      },
      changed: true,
      baselineChanged: true,
      updates: {
        surveysResponseState: [
          { answers: { keep: { value: 'persisted' } } },
          {
            answers: {},
            importance: {},
            conviction: {},
            additionalComments: {},
          },
          {
            answers: { q1: { value: 'answer-1' } },
            importance: { q1: 4 },
            conviction: { q1: 7 },
            additionalComments: { q1: { value: 'answer-1-notes' } },
          },
        ],
        editBaseline: {
          answers: { q1: { value: 'baseline-1' } },
          importance: { q1: 2 },
          conviction: { q1: 3 },
          additionalComments: { q1: { value: 'baseline-1-notes' } },
        },
      },
    });
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

  it('hydrates partial encrypted cached responses without requiring comments', () => {
    const applyCachedResponseEntryToSlice = jest.fn(({ targetSlice, questionId, response }) => {
      if (response.answer) {
        targetSlice.answers[questionId] = {
          value: response.answer.encrypted ? '*' : response.answer.value,
          encrypted: !!response.answer.encrypted,
          encryptedPortion: response.answer.encryptedPortion || '',
        };
      }
      if (response.additional) {
        targetSlice.additionalComments[questionId] = { value: response.additional.value };
      }
      if (response.importance !== undefined) {
        targetSlice.importance[questionId] = response.importance;
      }
      if (response.conviction !== undefined) {
        targetSlice.conviction[questionId] = response.conviction;
      }
      return true;
    });

    expect(buildCacheHydrationSlice({
      renderedQuestionIds: ['q1', 'q2', 'q3'],
      mergedQuestionResponses: {
        q1: {
          '0xabc': {
            answer: {
              value: 'encrypted plaintext should stay masked',
              encrypted: true,
              encryptedPortion: 'answer-env',
            },
            importance: 4,
          },
        },
        q2: {
          '0xabc': {
            additional: { value: 'notes-only' },
            conviction: 6,
          },
        },
        q3: {
          '0xabc': {
            answer: {},
          },
        },
      },
      account: '0xAbC',
      applyCachedResponseEntryToSlice,
    })).toEqual({
      slice: {
        answers: {
          q1: { value: '*', encrypted: true, encryptedPortion: 'answer-env' },
        },
        importance: { q1: 4 },
        conviction: { q2: 6 },
        additionalComments: {
          q2: { value: 'notes-only' },
        },
      },
      changed: true,
    });

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

  it('builds hydrated response slices from single or multi-response payloads', () => {
    const applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses, parseValue }) => {
      const [first, second] = responses;
      targetSlice.answers.q1 = { value: parseValue(first.answer.value) };
      if (second) {
        targetSlice.additionalComments.q2 = { value: parseValue(second.additional.value) };
      }
      return true;
    });
    const parseValue = jest.fn((value) => {
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        return JSON.parse(value);
      }
      return value;
    });

    expect(buildHydratedResponseSlice({
      userAnswers: {
        responses: [
          { answer: { value: '{"label":"first"}' }, additional: { value: 'notes-1' } },
          { answer: { value: 'second' }, additional: { value: '["notes-2"]' } },
        ],
      },
      prevSlice: { answers: { q0: { value: 'keep' } } },
      applyResponseHydrationListToSlice,
      parseValue,
    })).toEqual({
      answers: { q1: { value: { label: 'first' } } },
      importance: {},
      conviction: {},
      additionalComments: { q2: { value: ['notes-2'] } },
    });

    expect(buildHydratedResponseSlice({
      userAnswers: { answer: { value: 'solo' }, additional: { value: 'notes' } },
      prevSlice: null,
      applyResponseHydrationListToSlice,
      parseValue,
    })).toEqual({
      answers: { q1: { value: 'solo' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(buildHydratedResponseSlice({
      userAnswers: null,
      prevSlice: null,
      applyResponseHydrationListToSlice,
      parseValue,
    })).toEqual({
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(applyResponseHydrationListToSlice).toHaveBeenCalledTimes(2);
    expect(parseValue).toHaveBeenCalledTimes(3);
  });

  it('builds stable local-cache hydration memo keys', () => {
    const normalizeSlug = jest.fn((value) => String(value || '').trim().toLowerCase());

    expect(buildLocalCacheHydrationMemoKey({
      scopeSlugs: [' Demo ', 'SECOND'],
      networkIdStr: 84532,
      account: '0xAbC',
      renderedSignature: 'q1|q2',
      questionsCacheNonce: '4',
      questionResponsesNonce: 7,
      normalizeSessionSlugValue: normalizeSlug,
    })).toBe('demo,second|84532|0xAbC|q1|q2|4|7');

    expect(normalizeSlug).toHaveBeenCalledTimes(2);
  });

  it('merges hydration question responses across scoped caches', () => {
    const readQuestionsCache = jest.fn((slug: string) => {
      const caches: Record<string, unknown> = {
      alpha: {
        84532: {
          questionResponses: {
            q1: { '0xabc': { answer: { value: slug } } },
          },
        },
      },
      beta: {
        84532: {
          questionResponses: {
            q1: { '0xabc': { answer: { value: slug } } },
          },
        },
      },
      };
      return caches[slug] || {};
    });
    const mergeResponses = jest.fn((target, source) => {
      Object.entries(source).forEach(([questionId, value]) => {
        target[questionId] = {
          ...(target[questionId] || {}),
          ...(value || {}),
        };
      });
    });

    expect(buildMergedHydrationQuestionResponses({
      scopeSlugs: ['alpha', 'beta'],
      networkIdStr: '84532',
      readQuestionsCache,
      mergeQuestionResponses: mergeResponses,
    })).toEqual({
      q1: {
        '0xabc': { answer: { value: 'beta' } },
      },
    });

    expect(buildMergedHydrationQuestionResponses({
      scopeSlugs: ['alpha'],
      networkIdStr: '',
      readQuestionsCache,
      mergeQuestionResponses: mergeResponses,
    })).toEqual({});
    expect(readQuestionsCache).toHaveBeenCalledTimes(2);
    expect(mergeResponses).toHaveBeenCalledTimes(2);
  });

  it('loads local-cache hydration slices from merged scoped caches', () => {
    const readQuestionsCache = jest.fn((slug: string) => {
      const caches: Record<string, unknown> = {
        alpha: {
          84532: {
            questionResponses: {
              q1: {
                '0xabc': JSON.stringify({
                  answer: { value: 'alpha-answer' },
                  additional: { value: 'alpha-notes' },
                  importance: 4,
                  conviction: 7,
                }),
              },
            },
          },
        },
        beta: {
          84532: {
            questionResponses: {
              q2: {
                '0xabc': {
                  answer: { value: 'beta-answer' },
                  additional: { value: 'beta-notes' },
                  importance: 2,
                  conviction: 3,
                },
              },
            },
          },
        },
      };
      return caches[slug] || {};
    });
    const mergeResponses = jest.fn((target, source) => {
      Object.entries(source).forEach(([questionId, value]) => {
        target[questionId] = {
          ...(target[questionId] || {}),
          ...(value || {}),
        };
      });
    });
    const applyCachedResponseEntryToSlice = jest.fn(({ targetSlice, questionId, response }) => {
      targetSlice.answers[questionId] = { value: response.answer.value };
      targetSlice.additionalComments[questionId] = { value: response.additional.value };
      targetSlice.importance[questionId] = response.importance;
      targetSlice.conviction[questionId] = response.conviction;
      return true;
    });

    expect(loadLocalCacheHydrationSlice({
      scopeSlugs: ['alpha', 'beta'],
      networkIdStr: '84532',
      account: '0xAbC',
      renderedQuestionIds: ['q1', 'q2'],
      readQuestionsCache,
      mergeQuestionResponses: mergeResponses,
      parseResponse: (raw) => {
        if (typeof raw !== 'string') return raw;
        try { return JSON.parse(raw); } catch { return null; }
      },
      applyCachedResponseEntryToSlice,
    })).toEqual({
      answers: {
        q1: { value: 'alpha-answer' },
        q2: { value: 'beta-answer' },
      },
      importance: { q1: 4, q2: 2 },
      conviction: { q1: 7, q2: 3 },
      additionalComments: {
        q1: { value: 'alpha-notes' },
        q2: { value: 'beta-notes' },
      },
    });

    expect(loadLocalCacheHydrationSlice({
      scopeSlugs: ['alpha'],
      networkIdStr: '',
      account: '0xabc',
      renderedQuestionIds: ['q1'],
      readQuestionsCache,
      mergeQuestionResponses: mergeResponses,
      parseResponse: (raw) => raw,
      applyCachedResponseEntryToSlice,
    })).toBeNull();
  });

  it('builds survey response state arrays with ensured indexes', () => {
    expect(buildSurveyResponseStateArray({
      prevSurveysResponseState: [
        { answers: { q0: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
      ],
      surveyIndex: 2,
      nextSlice: {
        answers: { q2: { value: 'answer' } },
        importance: { q2: 4 },
        conviction: { q2: 7 },
        additionalComments: { q2: { value: 'notes' } },
      },
    })).toEqual([
      { answers: { q0: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      {
        answers: { q2: { value: 'answer' } },
        importance: { q2: 4 },
        conviction: { q2: 7 },
        additionalComments: { q2: { value: 'notes' } },
      },
    ]);

    expect(buildSurveyResponseStateArray({
      prevSurveysResponseState: null,
      surveyIndex: 1,
      nextSlice: null,
    })).toEqual([
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
    ]);
  });

  it('builds merged survey response state into ensured survey slots', () => {
    const buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));

    expect(buildMergedSurveyResponseState({
      currentState: [
        {
          answers: { keep: { value: 'persisted' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      ],
      newQuestionPool: [{ id: 'q1' }],
      renderedQuestionIds: ['q2'],
      surveyIndex: 2,
      buildEmptyResponseFieldState,
    })).toEqual([
      {
        answers: { keep: { value: 'persisted' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      {
        answers: { q1: { value: '', questionId: 'q1', fieldKey: 'answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '', questionId: 'q1', fieldKey: 'additional' } },
      },
    ]);

    expect(buildEmptyResponseFieldState).toHaveBeenCalledTimes(2);
  });

  it('builds initialized survey response state for single and survey modes', () => {
    const buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));

    expect(buildInitializedSurveyResponseState({
      singleQuestionMode: true,
      isStandalone: false,
      surveyIndex: 0,
      renderedQuestionIds: ['q1'],
      questionPoolIds: ['qPool'],
      prevSurveysResponseState: [],
      buildEmptyResponseFieldState,
    })).toEqual([
      {
        answers: { q1: { value: '', questionId: 'q1', fieldKey: 'answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '', questionId: 'q1', fieldKey: 'additional' } },
      },
    ]);

    expect(buildInitializedSurveyResponseState({
      singleQuestionMode: false,
      isStandalone: false,
      surveyIndex: 2,
      renderedQuestionIds: ['q2'],
      questionPoolIds: ['qPool'],
      prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      buildEmptyResponseFieldState,
    })).toEqual([
      { answers: { keep: { value: 'persisted' } } },
      null,
      {
        answers: { q2: { value: '', questionId: 'q2', fieldKey: 'answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q2: { value: '', questionId: 'q2', fieldKey: 'additional' } },
      },
    ]);
  });

  it('detects whether start-fresh should run for the current slice', () => {
    expect(shouldHandleStartFresh({
      viewAddress: '',
      userHasResponse: false,
      editBaseline: null,
      isDirty: false,
      currentSlice: {
        answers: { q1: { value: '   ' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      renderedQuestionIds: ['q1'],
    })).toBe(false);

    expect(shouldHandleStartFresh({
      viewAddress: '',
      userHasResponse: false,
      editBaseline: null,
      isDirty: false,
      currentSlice: {
        answers: {},
        importance: { q2: undefined },
        conviction: {},
        additionalComments: {},
      },
      renderedQuestionIds: ['q2'],
    })).toBe(false);

    expect(shouldHandleStartFresh({
      viewAddress: '',
      userHasResponse: false,
      editBaseline: null,
      isDirty: false,
      currentSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      renderedQuestionIds: ['q3'],
    })).toBe(true);
  });

  it('builds start-fresh survey state for rendered questions', () => {
    const buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));

    expect(buildStartFreshSurveyState({
      surveyIndex: 2,
      renderedQuestionIds: ['q1', 'q2'],
      prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      buildEmptyResponseFieldState,
    })).toEqual({
      emptySlice: {
        answers: {
          q1: { value: '', questionId: 'q1', fieldKey: 'answer' },
          q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
          q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
        },
      },
      nextSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } } },
        {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        {
          answers: {
            q1: { value: '', questionId: 'q1', fieldKey: 'answer' },
            q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
          },
          importance: {},
          conviction: {},
          additionalComments: {
            q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
            q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
          },
        },
      ],
    });

    expect(buildEmptyResponseFieldState).toHaveBeenCalledTimes(4);
  });

  it('builds reset-form state patches from initialized survey responses', () => {
    const cloneValue = jest.fn((value) => JSON.parse(JSON.stringify(value)));

    expect(buildResetFormStatePatch({
      initialSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } } },
        {
          answers: { q2: { value: '' } },
          importance: {},
          conviction: {},
          additionalComments: { q2: { value: '' } },
        },
      ],
      baselineIndex: 1,
      nextSubmittedSinceLastEdit: false,
      cloneValue,
    })).toEqual({
      surveysResponseState: [
        { answers: { keep: { value: 'persisted' } } },
        {
          answers: { q2: { value: '' } },
          importance: {},
          conviction: {},
          additionalComments: { q2: { value: '' } },
        },
      ],
      isEditing: false,
      submissionError: '',
      submissionComplete: false,
      submittedSinceLastEdit: false,
      submitProgress: 0,
      userHasResponse: false,
      userAnswers: null,
      isDirty: false,
      modifiedCount: 0,
      hasEncryptedChanges: false,
      editBaseline: {
        answers: { q2: { value: '' } },
        importance: {},
        conviction: {},
        additionalComments: { q2: { value: '' } },
      },
      isLoadingResponse: true,
    });

    expect(cloneValue).toHaveBeenCalledTimes(1);
  });

  it('prepares local-cache rehydrate runs with skip and base-slice decisions', () => {
    expect(prepareLocalCacheRehydrateRun({
      state: {
        suppressPrefill: true,
        submissionError: '',
        submissionComplete: false,
      },
      surveyIndex: 0,
      renderedIds: ['q1'],
      lastHydrationSig: '',
      buildHydrationSignature: jest.fn(),
    })).toEqual({
      shouldSkip: true,
      shouldBumpNoop: false,
      hydrationSig: '',
      baseSlice: null,
    });

    expect(prepareLocalCacheRehydrateRun({
      state: {
        suppressPrefill: false,
        submissionError: '',
        submissionComplete: false,
        surveysResponseState: [
          { answers: { q1: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
        ],
      },
      surveyIndex: 0,
      renderedIds: ['q1'],
      lastHydrationSig: 'same|sig',
      buildHydrationSignature: () => 'same|sig',
    })).toEqual({
      shouldSkip: true,
      shouldBumpNoop: true,
      hydrationSig: 'same|sig',
      baseSlice: null,
    });

    expect(prepareLocalCacheRehydrateRun({
      state: {
        suppressPrefill: false,
        submissionError: '',
        submissionComplete: false,
        surveysResponseState: [
          { answers: { q1: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
        ],
      },
      surveyIndex: 0,
      renderedIds: ['q1'],
      lastHydrationSig: '',
      buildHydrationSignature: () => 'next|sig',
    })).toEqual({
      shouldSkip: false,
      shouldBumpNoop: false,
      hydrationSig: 'next|sig',
      baseSlice: {
        answers: { q1: { value: 'keep' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
    });
  });

  it('resolves revert-pending baseline slices from edit, saved, or cached sources', () => {
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'saved' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));
    const buildSliceFromLocalCache = jest.fn(() => ({
      answers: { q2: { value: 'cached' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));

    expect(resolveRevertPendingBaselineSlice({
      editBaseline: {
        answers: { q0: { value: 'edit' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      isLoggedIn: true,
      userAnswers: { answer: { value: 'saved' } },
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
    })).toEqual({
      answers: { q0: { value: 'edit' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(resolveRevertPendingBaselineSlice({
      editBaseline: null,
      isLoggedIn: true,
      userAnswers: { answer: { value: 'saved' } },
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
    })).toEqual({
      answers: { q1: { value: 'saved' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(resolveRevertPendingBaselineSlice({
      editBaseline: null,
      isLoggedIn: true,
      userAnswers: null,
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
    })).toEqual({
      answers: { q2: { value: 'cached' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });
  });

  it('builds revert-pending state patches for the active survey slice', () => {
    expect(buildRevertPendingStatePatch({
      prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      surveyIndex: 2,
      nextSlice: {
        answers: { q1: { value: 'saved' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      isLoggedIn: false,
    })).toEqual({
      surveysResponseState: [
        { answers: { keep: { value: 'persisted' } } },
        {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        {
          answers: { q1: { value: 'saved' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      ],
      isEditing: true,
      displayAnswerMode: false,
      startFresh: true,
      isDirty: false,
      modifiedCount: 0,
      hasEncryptedChanges: false,
      submissionError: '',
    });
  });

  it('builds local-cache rehydration update plans from slice/baseline changes', () => {
    const cloneBaseline = jest.fn((baseline) => JSON.parse(JSON.stringify(baseline)));
    const buildDraftAwareState = jest.fn(() => ({
      effectiveAnswerState: { value: 'cached-answer' },
      effectiveAdditionalState: { value: 'cached-notes' },
      canReplaceMaskedAnswerWithDraftEmpty: false,
      canReplaceMaskedAdditionalWithDraftEmpty: false,
      canReplaceMaskedBaselineAnswerWithDraftEmpty: false,
      canReplaceMaskedBaselineAdditionalWithDraftEmpty: false,
    }));
    const applyLocalCacheHydrationEntryToSlice = jest.fn(({
      targetSlice,
      questionId,
      cachedAnswer,
      cachedAdditional,
    }) => {
      if (cachedAnswer) targetSlice.answers[questionId] = cachedAnswer;
      if (cachedAdditional) targetSlice.additionalComments[questionId] = cachedAdditional;
      return true;
    });

    expect(buildLocalCacheRehydrationUpdatePlan({
      prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      surveyIndex: 2,
      renderedQuestionIds: ['q1'],
      baseSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      prevBaseline: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      cacheSlice: {
        answers: { q1: { value: 'cached-answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: 'cached-notes' } },
      },
      draftAnswersByQuestionId: {},
      cloneBaseline,
      buildDraftAwareCacheHydrationState: buildDraftAwareState,
      applyLocalCacheHydrationEntryToSlice,
      debugLabel: '[test][rehydrateLocal]',
    })).toEqual({
      nextSlice: {
        answers: { q1: { value: 'cached-answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: 'cached-notes' } },
      },
      nextBaseline: {
        answers: { q1: { value: 'cached-answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: 'cached-notes' } },
      },
      changed: true,
      baselineChanged: true,
      updates: {
        surveysResponseState: [
          { answers: { keep: { value: 'persisted' } } },
          {
            answers: {},
            importance: {},
            conviction: {},
            additionalComments: {},
          },
          {
            answers: { q1: { value: 'cached-answer' } },
            importance: {},
            conviction: {},
            additionalComments: { q1: { value: 'cached-notes' } },
          },
        ],
        editBaseline: {
          answers: { q1: { value: 'cached-answer' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { value: 'cached-notes' } },
        },
      },
    });
  });

  it('resolves exit-editing baseline slices from viewed, self, or cached sources', () => {
    const buildSliceFromUserAnswers = jest.fn((sourceAnswers) => ({
      answers: { q1: { value: sourceAnswers.answer?.value || sourceAnswers.responses?.[0]?.answer?.value } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));
    const buildSliceFromLocalCache = jest.fn(() => ({
      answers: { q2: { value: 'cached' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));

    expect(resolveExitEditingBaselineSlice({
      responderAddress: '0xdef',
      parsedViewAddressAnswers: { answer: { value: 'viewed' } },
      userAnswers: { answer: { value: 'self' } },
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
    })).toEqual({
      answers: { q1: { value: 'viewed' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(resolveExitEditingBaselineSlice({
      responderAddress: '',
      parsedViewAddressAnswers: { answer: { value: 'viewed' } },
      userAnswers: { answer: { value: 'self' } },
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
    })).toEqual({
      answers: { q1: { value: 'self' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(resolveExitEditingBaselineSlice({
      responderAddress: '',
      parsedViewAddressAnswers: null,
      userAnswers: null,
      buildSliceFromUserAnswers,
      buildSliceFromLocalCache,
    })).toEqual({
      answers: { q2: { value: 'cached' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });
  });

  it('builds exit-editing state patches for the restored survey slice', () => {
    const cloneValue = jest.fn((value) => JSON.parse(JSON.stringify(value)));
    const buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));

    expect(buildExitEditingStatePatch({
      prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
      surveyIndex: 2,
      baselineSlice: {
        answers: { q1: { value: 'saved' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      renderedQuestionIds: ['q1', 'q2'],
      buildEmptyResponseFieldState,
      cloneValue,
      nextSubmittedSinceLastEdit: false,
    })).toEqual({
      surveysResponseState: [
        { answers: { keep: { value: 'persisted' } } },
        {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        {
          answers: {
            q1: { value: 'saved' },
            q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
          },
          importance: {},
          conviction: {},
          additionalComments: {
            q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
            q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
          },
        },
      ],
      isEditing: false,
      displayAnswerMode: true,
      startFresh: false,
      editBaseline: {
        answers: {
          q1: { value: 'saved' },
          q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
          q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
        },
      },
      isDirty: false,
      modifiedCount: 0,
      hasEncryptedChanges: false,
      submissionError: '',
      submissionComplete: false,
      submittedSinceLastEdit: false,
    });

    expect(cloneValue).toHaveBeenCalledTimes(3);
  });
});
