import {
  buildCacheHydrationSlice,
  buildDraftAwareCacheHydrationState,
  buildHydratedResponseSlice,
  loadLocalCacheHydrationSlice,
  buildLocalCacheHydrationMemoKey,
  buildMergedHydrationQuestionResponses,
  buildLocalCacheRehydrationState,
} from './surveyToolHydrationFlow.js';

describe('surveyToolHydrationFlow local-cache hydration helpers', () => {
  it('builds local-cache hydration slices from rendered ids and parsed cached responses', () => {
    const parseResponse = jest.fn((raw) => {
      if (typeof raw !== 'string') return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    });
    const applyCachedResponseEntryToSlice = jest.fn(({ targetSlice, questionId, response }) => {
      targetSlice.answers[questionId] = { value: response.answer.value };
      targetSlice.additionalComments[questionId] = { value: response.additional.value };
      targetSlice.importance[questionId] = response.importance;
      targetSlice.conviction[questionId] = response.conviction;
      return true;
    });

    expect(
      buildCacheHydrationSlice({
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
      }),
    ).toEqual({
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

    expect(
      buildCacheHydrationSlice({
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
      }),
    ).toEqual({
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
    const areEnvelopesEquivalent = jest.fn(
      (incomingEnvelope, currentEnvelope, incomingEncrypted, currentEncrypted) =>
        String(incomingEnvelope || '') === String(currentEnvelope || '') && !!incomingEncrypted === !!currentEncrypted,
    );

    expect(
      buildDraftAwareCacheHydrationState({
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
      }),
    ).toEqual({
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
    const applyLocalCacheHydrationEntryToSlice = jest.fn(
      ({
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
      },
    );

    expect(
      buildLocalCacheRehydrationState({
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
      }),
    ).toEqual({
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

    expect(
      buildHydratedResponseSlice({
        userAnswers: {
          responses: [
            { answer: { value: '{"label":"first"}' }, additional: { value: 'notes-1' } },
            { answer: { value: 'second' }, additional: { value: '["notes-2"]' } },
          ],
        },
        prevSlice: { answers: { q0: { value: 'keep' } } },
        applyResponseHydrationListToSlice,
        parseValue,
      }),
    ).toEqual({
      answers: { q1: { value: { label: 'first' } } },
      importance: {},
      conviction: {},
      additionalComments: { q2: { value: ['notes-2'] } },
    });

    expect(
      buildHydratedResponseSlice({
        userAnswers: { answer: { value: 'solo' }, additional: { value: 'notes' } },
        prevSlice: null,
        applyResponseHydrationListToSlice,
        parseValue,
      }),
    ).toEqual({
      answers: { q1: { value: 'solo' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(
      buildHydratedResponseSlice({
        userAnswers: null,
        prevSlice: null,
        applyResponseHydrationListToSlice,
        parseValue,
      }),
    ).toEqual({
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(applyResponseHydrationListToSlice).toHaveBeenCalledTimes(2);
    expect(parseValue).toHaveBeenCalledTimes(3);
  });

  it('builds stable local-cache hydration memo keys', () => {
    const normalizeSlug = jest.fn((value) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    );

    expect(
      buildLocalCacheHydrationMemoKey({
        scopeSlugs: [' Demo ', 'SECOND'],
        networkIdStr: 84532,
        account: '0xAbC',
        renderedSignature: 'q1|q2',
        questionsCacheNonce: '4',
        questionResponsesNonce: 7,
        normalizeSessionSlugValue: normalizeSlug,
      }),
    ).toBe('demo,second|84532|0xAbC|q1|q2|4|7');

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

    expect(
      buildMergedHydrationQuestionResponses({
        scopeSlugs: ['alpha', 'beta'],
        networkIdStr: '84532',
        readQuestionsCache,
        mergeQuestionResponses: mergeResponses,
      }),
    ).toEqual({
      q1: {
        '0xabc': { answer: { value: 'beta' } },
      },
    });

    expect(
      buildMergedHydrationQuestionResponses({
        scopeSlugs: ['alpha'],
        networkIdStr: '',
        readQuestionsCache,
        mergeQuestionResponses: mergeResponses,
      }),
    ).toEqual({});
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

    expect(
      loadLocalCacheHydrationSlice({
        scopeSlugs: ['alpha', 'beta'],
        networkIdStr: '84532',
        account: '0xAbC',
        renderedQuestionIds: ['q1', 'q2'],
        readQuestionsCache,
        mergeQuestionResponses: mergeResponses,
        parseResponse: (raw) => {
          if (typeof raw !== 'string') return raw;
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        },
        applyCachedResponseEntryToSlice,
      }),
    ).toEqual({
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

    expect(
      loadLocalCacheHydrationSlice({
        scopeSlugs: ['alpha'],
        networkIdStr: '',
        account: '0xabc',
        renderedQuestionIds: ['q1'],
        readQuestionsCache,
        mergeQuestionResponses: mergeResponses,
        parseResponse: (raw) => raw,
        applyCachedResponseEntryToSlice,
      }),
    ).toBeNull();
  });
});
