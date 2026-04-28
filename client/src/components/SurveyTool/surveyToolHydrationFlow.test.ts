import {
  buildCacheHydrationSlice,
  buildDraftHydrationUpdatePlan,
  buildDraftAwareCacheHydrationState,
  buildDraftHydrationState,
  buildExitEditingStatePatch,
  buildHydratedResponseSlice,
  buildInitializedSurveyResponseState,
  loadLocalCacheHydrationSlice,
  buildLocalCacheRehydrationUpdatePlan,
  prepareLocalCacheRehydrateRun,
  prepareLocalCacheSliceBuild,
  buildRevertPendingStatePatch,
  buildResetFormStatePatch,
  buildStartFreshSurveyState,
  buildLocalCacheHydrationMemoKey,
  buildMergedSurveyResponseState,
  buildMergedHydrationQuestionResponses,
  buildLocalCacheRehydrationState,
  buildPrefilledSingleQuestionState,
  buildPrefilledSingleQuestionUpdatePlan,
  buildPrefilledSurveyState,
  buildPrefilledSurveyUpdatePlan,
  applyLocalCacheRehydrateMissEffects,
  applyLocalCacheRehydrateNoChangeEffects,
  applyLocalCacheRehydrateAppliedEffects,
  applyLocalCacheRehydrateSuccessEffects,
  applyPrefillStateEffects,
  applyPriorResponseFetchSuccessEffects,
  buildGroupedRenderedResponseScopePlan,
  buildLocalCacheHydrationSignature,
  clearPriorResponseAttemptedKeys,
  executePriorResponseFetchPlan,
  loadMissingResponseIdsForScope,
  loadGroupedMissingResponseRequests,
  trackPriorResponseAttemptedKeys,
  buildMissingRenderedResponseResult,
  buildMissingResponseIdsForRenderedQuestions,
  buildNormalizedRenderedQuestionIds,
  buildPriorResponseFetchPlan,
  buildQuestionSlugMapForIds,
  buildRevertedResponseSlice,
  buildSubmissionGroupContext,
  buildSurveyResponseStateArray,
  resolveExitEditingBaselineSlice,
  resolveRevertPendingBaselineSlice,
  shouldBackfillPriorResponses,
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

  it('builds single-question prefill state with ensured survey slots', () => {
    const applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses, questionIdResolver }) => {
      const questionId = questionIdResolver(responses[0]);
      targetSlice.answers[questionId] = { value: responses[0].answer.value };
      targetSlice.additionalComments[questionId] = { value: responses[0].additional.value };
      return true;
    });
    const buildSliceFromUserAnswers = jest.fn((_userAnswer, prevSlice) => ({
      ...(prevSlice || {}),
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: {},
      conviction: {},
    }));

    expect(buildPrefilledSingleQuestionState({
      surveyIndex: 2,
      questionId: 'Q1',
      prevSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
      ],
      prevEditBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      isDirty: false,
      submissionComplete: false,
      userAnswer: {
        questionID: 'q1',
        answer: { value: 'hydrated answer' },
        additional: { value: 'hydrated notes' },
      },
      applyResponseHydrationListToSlice,
      buildSliceFromUserAnswers,
    })).toEqual({
      nextSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
        {
          answers: { q1: { value: 'hydrated answer' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { value: 'hydrated notes' } },
        },
      ],
      nextBaseline: {
        answers: { q1: { value: 'baseline answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: 'baseline notes' } },
      },
      shouldWriteBaseline: true,
    });

    expect(buildPrefilledSingleQuestionState({
      surveyIndex: 0,
      questionId: '',
      prevSurveysResponseState: [],
      prevEditBaseline: null,
      isDirty: true,
      submissionComplete: true,
      userAnswer: null,
      applyResponseHydrationListToSlice,
      buildSliceFromUserAnswers,
    }).shouldWriteBaseline).toBe(false);
  });

  it('builds single-question prefill update plans with optional baseline writes', () => {
    const applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses, questionIdResolver }) => {
      const questionId = questionIdResolver(responses[0]);
      targetSlice.answers[questionId] = { value: responses[0].answer.value };
      return true;
    });
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'baseline' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));

    expect(buildPrefilledSingleQuestionUpdatePlan({
      surveyIndex: 1,
      questionId: 'q1',
      prevSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
      ],
      prevEditBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      isDirty: false,
      submissionComplete: false,
      userAnswer: { answer: { value: 'answer-1' } },
      applyResponseHydrationListToSlice,
      buildSliceFromUserAnswers,
    })).toEqual({
      nextSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
        {
          answers: { q1: { value: 'answer-1' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      ],
      nextBaseline: {
        answers: { q1: { value: 'baseline' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      shouldWriteBaseline: true,
      updates: {
        surveysResponseState: [
          { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
          {
            answers: { q1: { value: 'answer-1' } },
            importance: {},
            conviction: {},
            additionalComments: {},
          },
        ],
        editBaseline: {
          answers: { q1: { value: 'baseline' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      },
    });
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

  it('builds survey prefill update plans with optional baseline writes', () => {
    const responses = [{ answer: { value: 'answer-1' }, additional: { value: 'notes-1' }, importance: 4, conviction: 7 }];
    const applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses: nextResponses }) => {
      const first = nextResponses[0];
      targetSlice.answers.q1 = { value: first.answer.value };
      targetSlice.additionalComments.q1 = { value: first.additional.value };
      targetSlice.importance.q1 = first.importance;
      targetSlice.conviction.q1 = first.conviction;
      return true;
    });
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'baseline' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: { q1: { value: 'baseline notes' } },
    }));

    expect(buildPrefilledSurveyUpdatePlan({
      surveyIndex: 1,
      prevSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
      ],
      prevEditBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      isDirty: false,
      submissionComplete: false,
      responses,
      applyResponseHydrationListToSlice,
      buildSliceFromUserAnswers,
    })).toEqual({
      nextSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
        {
          answers: { q1: { value: 'answer-1' } },
          importance: { q1: 4 },
          conviction: { q1: 7 },
          additionalComments: { q1: { value: 'notes-1' } },
        },
      ],
      nextBaseline: {
        answers: { q1: { value: 'baseline' } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: 'baseline notes' } },
      },
      shouldWriteBaseline: true,
      updates: {
        surveysResponseState: [
          { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
          {
            answers: { q1: { value: 'answer-1' } },
            importance: { q1: 4 },
            conviction: { q1: 7 },
            additionalComments: { q1: { value: 'notes-1' } },
          },
        ],
        editBaseline: {
          answers: { q1: { value: 'baseline' } },
          importance: { q1: 4 },
          conviction: { q1: 7 },
          additionalComments: { q1: { value: 'baseline notes' } },
        },
      },
    });
  });

  it('decides when prior-response backfill is allowed', () => {
    expect(shouldBackfillPriorResponses({
      loginComplete: true,
      account: '0xabc',
      displayAnswerMode: false,
      viewAddress: '',
      singleQuestionMode: false,
      responderAddress: '',
      hasRefreshQuestionResponses: true,
      submissionComplete: false,
      isSubmitting: false,
    })).toBe(true);

    expect(shouldBackfillPriorResponses({
      loginComplete: true,
      account: '0xabc',
      displayAnswerMode: true,
      viewAddress: '0xdef',
      singleQuestionMode: false,
      responderAddress: '',
      hasRefreshQuestionResponses: true,
      submissionComplete: false,
      isSubmitting: false,
    })).toBe(false);

    expect(shouldBackfillPriorResponses({
      loginComplete: true,
      account: '0xabc',
      displayAnswerMode: false,
      viewAddress: '',
      singleQuestionMode: true,
      responderAddress: '0xdef',
      hasRefreshQuestionResponses: true,
      submissionComplete: false,
      isSubmitting: false,
    })).toBe(false);
  });

  it('builds grouped prior-response fetch plans without reusing attempted ids', () => {
    expect(buildPriorResponseFetchPlan({
      missingInfo: {
        requests: [
          { slug: 'alpha', missingIds: ['q1', 'q2'] },
          { slug: 'beta', missingIds: ['q3'] },
        ],
      },
      responderLower: '0xabc',
      attemptedKeys: new Set(['alpha|0xabc|q2']),
    })).toEqual({
      requestsToFetch: [
        { slug: 'alpha', idsToFetch: ['q1'] },
        { slug: 'beta', idsToFetch: ['q3'] },
      ],
      attemptedKeysToMark: [
        'alpha|0xabc|q1',
        'beta|0xabc|q3',
      ],
    });
  });

  it('tracks and clears attempted prior-response keys', () => {
    const attempted = new Set(['existing']);

    expect(trackPriorResponseAttemptedKeys({
      attemptedSet: attempted,
      attemptedKeysToMark: ['alpha|0xabc|q1', '', 'beta|0xabc|q2'],
    })).toEqual(['alpha|0xabc|q1', 'beta|0xabc|q2']);

    expect(Array.from(attempted)).toEqual([
      'existing',
      'alpha|0xabc|q1',
      'beta|0xabc|q2',
    ]);

    clearPriorResponseAttemptedKeys({
      attemptedSet: attempted,
      attemptedKeys: ['alpha|0xabc|q1', null],
    });

    expect(Array.from(attempted)).toEqual([
      'existing',
      'beta|0xabc|q2',
    ]);
  });

  it('applies prior-response fetch success effects only when mounted and fetched', () => {
    const resetLocalCacheMemo = jest.fn();
    const triggerRehydrate = jest.fn();

    expect(applyPriorResponseFetchSuccessEffects({
      fetched: true,
      isMounted: true,
      resetLocalCacheMemo,
      triggerRehydrate,
    })).toBe(true);
    expect(resetLocalCacheMemo).toHaveBeenCalledTimes(1);
    expect(triggerRehydrate).toHaveBeenCalledTimes(1);

    resetLocalCacheMemo.mockClear();
    triggerRehydrate.mockClear();

    expect(applyPriorResponseFetchSuccessEffects({
      fetched: false,
      isMounted: true,
      resetLocalCacheMemo,
      triggerRehydrate,
    })).toBe(false);
    expect(resetLocalCacheMemo).not.toHaveBeenCalled();
    expect(triggerRehydrate).not.toHaveBeenCalled();
  });

  it('applies local-cache rehydrate miss, no-change, and success effects', () => {
    const clearHydrationSignature = jest.fn();
    const ensurePriorResponses = jest.fn();
    const callback = jest.fn();

    applyLocalCacheRehydrateMissEffects({
      clearHydrationSignature,
      ensurePriorResponses,
      callback,
    });
    expect(clearHydrationSignature).toHaveBeenCalledTimes(1);
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);

    ensurePriorResponses.mockClear();
    callback.mockClear();

    applyLocalCacheRehydrateNoChangeEffects({
      ensurePriorResponses,
      callback,
    });
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);

    const applyStateUpdates = jest.fn((updates, done) => {
      if (typeof done === 'function') done();
    });
    const afterStateApplied = jest.fn();

    expect(applyLocalCacheRehydrateSuccessEffects({
      updates: { surveysResponseState: [] },
      applyStateUpdates,
      afterStateApplied,
    })).toBe(true);
    expect(applyStateUpdates).toHaveBeenCalledWith({ surveysResponseState: [] }, expect.any(Function));
    expect(afterStateApplied).toHaveBeenCalledTimes(1);

    const functionalApplyStateUpdates = jest.fn((updater, done) => {
      if (typeof updater === 'function') {
        updater({ surveysResponseState: [], editBaseline: null, isDirty: false, submissionComplete: false });
      }
      if (typeof done === 'function') done();
    });
    afterStateApplied.mockClear();

    expect(applyLocalCacheRehydrateSuccessEffects({
      updates: (prev) => ({ surveysResponseState: prev.surveysResponseState }),
      applyStateUpdates: functionalApplyStateUpdates,
      afterStateApplied,
    })).toBe(true);
    expect(functionalApplyStateUpdates).toHaveBeenCalledWith(expect.any(Function), expect.any(Function));
    expect(afterStateApplied).toHaveBeenCalledTimes(1);

    expect(applyLocalCacheRehydrateSuccessEffects({
      updates: null,
      applyStateUpdates,
      afterStateApplied,
    })).toBe(false);
  });

  it('applies prefill and local-cache post-apply follow-up effects', () => {
    const updateJsonPreview = jest.fn();
    const recalculateEditStats = jest.fn();
    const ensurePriorResponses = jest.fn();
    const callback = jest.fn();

    applyPrefillStateEffects({
      updateJsonPreview,
      recalculateEditStats,
    });
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);

    updateJsonPreview.mockClear();
    recalculateEditStats.mockClear();

    applyLocalCacheRehydrateAppliedEffects({
      updateJsonPreview,
      recalculateEditStats,
      ensurePriorResponses,
      callback,
    });
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(ensurePriorResponses).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('executes grouped prior-response fetch plans in normalized order', async () => {
    const refreshQuestionResponses = jest.fn().mockResolvedValue(undefined);
    const readQuestionsCacheAsync = jest.fn().mockResolvedValue(undefined);

    await expect(executePriorResponseFetchPlan({
      requestsToFetch: [
        { slug: 'alpha', idsToFetch: ['Q1', 'q1'] },
        { slug: 'beta', idsToFetch: ['q2'] },
        { slug: '', idsToFetch: ['q3'] },
      ],
      responderLower: '0xAbC',
      refreshQuestionResponses,
      readQuestionsCacheAsync,
    })).resolves.toEqual({
      fetched: true,
      slug: 'beta',
    });

    expect(refreshQuestionResponses).toHaveBeenNthCalledWith(1, ['q1'], {
      slug: 'alpha',
      responder: '0xabc',
    });
    expect(refreshQuestionResponses).toHaveBeenNthCalledWith(2, ['q2'], {
      slug: 'beta',
      responder: '0xabc',
    });
    expect(readQuestionsCacheAsync).toHaveBeenNthCalledWith(1, 'alpha');
    expect(readQuestionsCacheAsync).toHaveBeenNthCalledWith(2, 'beta');
  });

  it('loads missing response ids for a single scope from cache state', async () => {
    const readQuestionsCacheAsync = jest.fn().mockResolvedValue({
      '84532': {
        questionResponses: {
          q1: { '0xabc': { answer: { value: 'present' } } },
          q2: {},
        },
      },
    });
    const ensureQuestionsNet = jest.fn((cache) => cache);

    await expect(loadMissingResponseIdsForScope({
      slug: 'alpha',
      netId: '84532',
      renderedIds: ['q1', 'q2', 'q3'],
      responderLower: '0xAbC',
      readQuestionsCacheAsync,
      ensureQuestionsNet,
    })).resolves.toEqual(['q2', 'q3']);
  });

  it('loads grouped missing-response requests from scoped caches', async () => {
    const readQuestionsCacheAsync = jest.fn(async (slug) => {
      if (slug === 'alpha') {
        return {
          '84532': {
            questionResponses: {
              q1: { '0xabc': { answer: { value: 'present' } } },
              q2: {},
            },
          },
        };
      }
      if (slug === 'beta') {
        return {
          '84532': {
            questionResponses: {
              q3: {},
            },
          },
        };
      }
      return {};
    });
    const ensureQuestionsNet = jest.fn((cache) => cache);

    await expect(loadGroupedMissingResponseRequests({
      scopePlan: [
        { slug: 'alpha', netId: '84532', questionIds: ['q1', 'q2'] },
        { slug: 'alpha', netId: '84532', questionIds: ['q2'] },
        { slug: 'beta', netId: '84532', questionIds: ['q3'] },
      ],
      fallbackNetId: '11155420',
      responderLower: '0xAbC',
      resolveScopeNetId: (slug, entryNetId) => (slug === 'beta' ? '84532' : entryNetId),
      readQuestionsCacheAsync,
      ensureQuestionsNet,
    })).resolves.toEqual([
      { slug: 'alpha', netId: '84532', missingIds: ['q2'] },
      { slug: 'alpha', netId: '84532', missingIds: ['q2'] },
      { slug: 'beta', netId: '84532', missingIds: ['q3'] },
    ]);

    expect(readQuestionsCacheAsync).toHaveBeenCalledTimes(2);
    expect(readQuestionsCacheAsync).toHaveBeenNthCalledWith(1, 'alpha');
    expect(readQuestionsCacheAsync).toHaveBeenNthCalledWith(2, 'beta');
  });

  it('builds grouped rendered-response scope plans by slug and network', () => {
    expect(buildGroupedRenderedResponseScopePlan({
      renderedIds: ['q1', 'q2', 'q3'],
      slugByQuestionId: new Map([
        ['q1', 'alpha'],
        ['q2', 'alpha'],
        ['q3', 'beta'],
      ]),
      fallbackSlug: 'edge',
      fallbackNetId: '84532',
    })).toEqual([
      { slug: 'alpha', netId: '84532', questionIds: ['q1', 'q2'] },
      { slug: 'beta', netId: '84532', questionIds: ['q3'] },
    ]);
  });

  it('builds missing response ids for rendered questions from cached responses', () => {
    expect(buildMissingResponseIdsForRenderedQuestions({
      renderedIds: ['q1', 'q2', 'q3'],
      questionResponses: {
        q1: { '0xabc': { answer: { value: 'present' } } },
        q2: {},
      },
      responderLower: '0xabc',
    })).toEqual(['q2', 'q3']);
  });

  it('builds normalized missing-response results from grouped scope requests', () => {
    expect(buildMissingRenderedResponseResult({
      requests: [
        { slug: 'alpha', netId: '84532', missingIds: ['Q1', 'q1'] },
        { slug: 'beta', netId: '84532', missingIds: [] },
      ],
      fallbackSlug: 'edge',
      fallbackNetId: '11155420',
    })).toEqual({
      slug: 'alpha',
      netId: '84532',
      missingIds: ['q1'],
      requests: [
        { slug: 'alpha', netId: '84532', missingIds: ['q1'] },
      ],
    });

    expect(buildMissingRenderedResponseResult({
      requests: [
        { slug: 'alpha', netId: '84532', missingIds: ['q1'] },
        { slug: 'beta', netId: '84532', missingIds: ['q2'] },
      ],
      fallbackSlug: 'edge',
      fallbackNetId: '11155420',
    })).toEqual({
      slug: 'edge',
      netId: '11155420',
      missingIds: [],
      requests: [
        { slug: 'alpha', netId: '84532', missingIds: ['q1'] },
        { slug: 'beta', netId: '84532', missingIds: ['q2'] },
      ],
    });
  });

  it('normalizes rendered question ids for hydration', () => {
    expect(buildNormalizedRenderedQuestionIds({
      renderedIds: ['Q1', 'q1', null, 'q2', '', undefined, 'Q2'],
    })).toEqual(['q1', 'q2']);
  });

  it('builds question slug maps for normalized rendered ids', () => {
    expect(buildQuestionSlugMapForIds({
      questionIds: ['Q1', 'q2', 'q1', null],
      poolQuestions: [
        { id: 'q1', sessionSlug: 'Edge' },
        { id: 'q2', sessionSlug: 'alpha' },
      ],
      normalizeSlug: (value) => String(value || '').trim().toLowerCase(),
      resolveQuestionSlug: ({ questionId, question }) => {
        const questionRecord = question && typeof question === 'object'
          ? question as Record<string, unknown>
          : {};
        return questionRecord.sessionSlug || `fallback-${questionId}`;
      },
    })).toEqual(new Map([
      ['q1', 'edge'],
      ['q2', 'alpha'],
    ]));
  });

  it('builds submission group contexts from slug-mapped questions', () => {
    expect(buildSubmissionGroupContext({
      questionIds: ['Q1', 'q2', 'q1'],
      slugByQuestionId: new Map([
        ['q1', 'Edge'],
        ['q2', 'Edge'],
      ]),
      fallbackSlug: 'general',
      normalizeSlug: (value) => String(value || '').trim().toLowerCase(),
    })).toEqual({
      ok: true,
      submissionGroupKey: 'edge',
      sessionSlugs: ['edge'],
      slugByQuestionId: new Map([
        ['q1', 'edge'],
        ['q2', 'edge'],
      ]),
    });

    expect(buildSubmissionGroupContext({
      questionIds: ['q1', 'q2'],
      slugByQuestionId: new Map([
        ['q1', 'alpha'],
        ['q2', 'beta'],
      ]),
      fallbackSlug: 'general',
      normalizeSlug: (value) => String(value || '').trim().toLowerCase(),
    })).toEqual({
      ok: false,
      submissionGroupKey: '',
      sessionSlugs: ['alpha', 'beta'],
      slugByQuestionId: new Map([
        ['q1', 'alpha'],
        ['q2', 'beta'],
      ]),
      error: 'Cannot submit responses from multiple sessions at once. Narrow the question view to one session and try again.',
    });
  });

  it('builds local-cache hydration signatures from normalized state inputs', () => {
    expect(buildLocalCacheHydrationSignature({
      surveyIndex: 2,
      scopeSlugs: ['edge', 'alpha'],
      networkIdStr: '84532',
      account: '0xAbC',
      renderedIds: ['q2', 'q1'],
      questionsCacheNonce: 4,
      questionResponsesNonce: 7,
      suppressPrefill: true,
      submissionError: 'boom',
      submissionComplete: false,
    })).toBe('2|edge,alpha|84532|0xabc|q2|q1|4|7|1|1|0');
  });

  it('prepares local-cache slice builds with memo reuse and normalized account state', () => {
    expect(prepareLocalCacheSliceBuild({
      scopeSlugs: ['Edge', 'alpha'],
      networkIdStr: '84532',
      account: '0xAbC',
      renderedIds: ['q2', 'q1'],
      questionsCacheNonce: 4,
      questionResponsesNonce: 7,
      existingMemo: {
        key: '84532|mismatch',
        value: { stale: true },
        hasValue: true,
      },
      normalizeSessionSlugValue: (value) => String(value || '').trim().toLowerCase(),
    })).toEqual({
      renderedIds: ['q2', 'q1'],
      normalizedAccount: '0xabc',
      memoKey: 'edge,alpha|84532|0xabc|q2|q1|4|7',
      shouldUseMemo: false,
      memoizedValue: null,
    });

    expect(prepareLocalCacheSliceBuild({
      scopeSlugs: ['Edge', 'alpha'],
      networkIdStr: '84532',
      account: '0xAbC',
      renderedIds: ['q2', 'q1'],
      questionsCacheNonce: 4,
      questionResponsesNonce: 7,
      existingMemo: {
        key: 'edge,alpha|84532|0xabc|q2|q1|4|7',
        value: { cached: true },
        hasValue: true,
      },
      normalizeSessionSlugValue: (value) => String(value || '').trim().toLowerCase(),
    })).toEqual({
      renderedIds: ['q2', 'q1'],
      normalizedAccount: '0xabc',
      memoKey: 'edge,alpha|84532|0xabc|q2|q1|4|7',
      shouldUseMemo: true,
      memoizedValue: { cached: true },
    });
  });

  it('builds reverted response slices from baseline state plus rendered empty shells', () => {
    const cloneFieldState = jest.fn((value) => JSON.parse(JSON.stringify(value)));
    const buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      encrypted: false,
      questionId,
      fieldKey,
    }));

    expect(buildRevertedResponseSlice({
      baselineSlice: {
        answers: { q1: { value: 'saved answer' } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: 'saved notes' } },
      },
      renderedQuestionIds: ['Q1', 'q2'],
      cloneFieldState,
      buildEmptyResponseFieldState,
    })).toEqual({
      answers: {
        q1: { value: 'saved answer' },
        q2: { value: '', encrypted: false, questionId: 'q2', fieldKey: 'answer' },
      },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: {
        q1: { value: 'saved notes' },
        q2: { value: '', encrypted: false, questionId: 'q2', fieldKey: 'additional' },
      },
    });

    expect(cloneFieldState).toHaveBeenCalledTimes(2);
    expect(buildEmptyResponseFieldState).toHaveBeenCalledTimes(2);
  });
});
