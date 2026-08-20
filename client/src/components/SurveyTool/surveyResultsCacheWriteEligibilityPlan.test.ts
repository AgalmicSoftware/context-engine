import {
  buildSurveyResultsAnalysisArtifactWritePlan,
  buildSurveyResultsAnalysisArtifactWriteReadinessPlan,
  buildSurveyResultsSurveyQuestionBookmarkWritePlan,
} from './surveyResultsCacheWriteEligibilityPlan';

describe('surveyResultsCacheWriteEligibilityPlan', () => {
  it('derives analysis artifact write payloads without mutating sibling artifacts', () => {
    const artifact = {
      inputSignature: 'new-input',
      kind: 'ce_session_results_analysis_artifact',
    };
    const currentCache = {
      existingFlag: true,
      sessionResultsAnalysis: {
        'sessionResultsAnalysis:v1:OP Sepolia:old-input': {
          inputSignature: 'old-input',
        },
      },
    };

    const plan = buildSurveyResultsAnalysisArtifactWritePlan({
      artifact,
      cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:new-input',
      currentCache,
      inputSignature: 'new-input',
      slug: 'alpha-session',
    });

    expect(plan).toEqual({
      blockedReason: '',
      payload: {
        existingFlag: true,
        sessionResultsAnalysis: {
          'sessionResultsAnalysis:v1:OP Sepolia:old-input': {
            inputSignature: 'old-input',
          },
          'sessionResultsAnalysis:v1:OP Sepolia:new-input': artifact,
        },
      },
      shouldWrite: true,
      target: {
        namespace: 'analysisCache',
        slug: 'alpha-session',
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:new-input',
        inputSignature: 'new-input',
      },
    });
    expect(currentCache.sessionResultsAnalysis).toEqual({
      'sessionResultsAnalysis:v1:OP Sepolia:old-input': {
        inputSignature: 'old-input',
      },
    });
  });

  it('normalizes malformed analysis artifact buckets while preserving unrelated fields', () => {
    const artifact = {
      inputSignature: 'retry-input',
      kind: 'ce_session_results_analysis_artifact',
    };

    expect(
      buildSurveyResultsAnalysisArtifactWritePlan({
        artifact,
        cacheKey: 'sessionResultsAnalysis:v1:Base Sepolia:retry-input',
        currentCache: {
          existingFlag: true,
          sessionResultsAnalysis: 'bad-artifacts',
        },
        slug: 'beta-session',
      }),
    ).toEqual({
      blockedReason: '',
      payload: {
        existingFlag: true,
        sessionResultsAnalysis: {
          'sessionResultsAnalysis:v1:Base Sepolia:retry-input': artifact,
        },
      },
      shouldWrite: true,
      target: {
        namespace: 'analysisCache',
        slug: 'beta-session',
        cacheKey: 'sessionResultsAnalysis:v1:Base Sepolia:retry-input',
        inputSignature: '',
      },
    });
  });

  it('pins analysis artifact payload normalization for empty, partial, and ready source caches', () => {
    const artifact = {
      inputSignature: 'matrix-input',
      kind: 'ce_session_results_analysis_artifact',
    };
    const cacheKey = 'sessionResultsAnalysis:v1:OP Sepolia:matrix-input';

    const cases = [
      {
        currentCache: undefined,
        expectedPayload: {
          sessionResultsAnalysis: {
            [cacheKey]: artifact,
          },
        },
      },
      {
        currentCache: {
          staleLatestBlock: 41,
        },
        expectedPayload: {
          staleLatestBlock: 41,
          sessionResultsAnalysis: {
            [cacheKey]: artifact,
          },
        },
      },
      {
        currentCache: {
          sessionResultsAnalysis: {
            'sessionResultsAnalysis:v1:OP Sepolia:old-input': {
              inputSignature: 'old-input',
            },
          },
        },
        expectedPayload: {
          sessionResultsAnalysis: {
            'sessionResultsAnalysis:v1:OP Sepolia:old-input': {
              inputSignature: 'old-input',
            },
            [cacheKey]: artifact,
          },
        },
      },
    ];

    cases.forEach(({ currentCache, expectedPayload }) => {
      expect(
        buildSurveyResultsAnalysisArtifactWritePlan({
          artifact,
          cacheKey,
          currentCache,
          slug: 'payload-session',
        }),
      ).toEqual({
        blockedReason: '',
        payload: expectedPayload,
        shouldWrite: true,
        target: {
          namespace: 'analysisCache',
          slug: 'payload-session',
          cacheKey,
          inputSignature: '',
        },
      });
    });
  });

  it('blocks analysis artifact write plans without moving cache reads or writes', () => {
    expect(
      buildSurveyResultsAnalysisArtifactWriteReadinessPlan({
        artifact: null,
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:missing',
        slug: '',
      }),
    ).toEqual({
      blockedReason: 'missing-artifact',
      shouldReadCache: false,
      shouldWrite: false,
      target: {
        namespace: 'analysisCache',
        slug: '',
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:missing',
        inputSignature: '',
      },
    });

    expect(
      buildSurveyResultsAnalysisArtifactWritePlan({
        artifact: null,
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:missing',
        currentCache: {
          sessionResultsAnalysis: {
            existing: { inputSignature: 'existing' },
          },
        },
        slug: '',
      }),
    ).toEqual({
      blockedReason: 'missing-artifact',
      payload: null,
      shouldWrite: false,
      target: {
        namespace: 'analysisCache',
        slug: '',
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:missing',
        inputSignature: '',
      },
    });

    expect(
      buildSurveyResultsAnalysisArtifactWriteReadinessPlan({
        artifact: { inputSignature: 'missing-key' },
        cacheKey: '',
        slug: 'gamma-session',
      }),
    ).toEqual({
      blockedReason: 'missing-cache-key',
      shouldReadCache: false,
      shouldWrite: false,
      target: {
        namespace: 'analysisCache',
        slug: 'gamma-session',
        cacheKey: '',
        inputSignature: '',
      },
    });

    expect(
      buildSurveyResultsAnalysisArtifactWritePlan({
        artifact: { inputSignature: 'missing-key' },
        cacheKey: '',
        slug: 'gamma-session',
      }),
    ).toEqual({
      blockedReason: 'missing-cache-key',
      payload: null,
      shouldWrite: false,
      target: {
        namespace: 'analysisCache',
        slug: 'gamma-session',
        cacheKey: '',
        inputSignature: '',
      },
    });
  });

  it('allows analysis artifact write readiness to hand off valid targets before payload construction', () => {
    expect(
      buildSurveyResultsAnalysisArtifactWriteReadinessPlan({
        artifact: {
          inputSignature: 'ready-input',
          kind: 'ce_session_results_analysis_artifact',
        },
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
        inputSignature: 'ready-input',
        slug: 'ready-session',
      }),
    ).toEqual({
      blockedReason: '',
      shouldReadCache: true,
      shouldWrite: true,
      target: {
        namespace: 'analysisCache',
        slug: 'ready-session',
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
        inputSignature: 'ready-input',
      },
    });
  });

  it('pins analysis artifact target identity for missing route and cache identifiers', () => {
    const artifact = {
      inputSignature: 'missing-route-input',
      kind: 'ce_session_results_analysis_artifact',
    };

    expect(
      buildSurveyResultsAnalysisArtifactWritePlan({
        artifact,
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:missing-route-input',
        currentCache: null,
        slug: undefined,
      }),
    ).toEqual({
      blockedReason: '',
      payload: {
        sessionResultsAnalysis: {
          'sessionResultsAnalysis:v1:OP Sepolia:missing-route-input': artifact,
        },
      },
      shouldWrite: true,
      target: {
        namespace: 'analysisCache',
        slug: '',
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:missing-route-input',
        inputSignature: '',
      },
    });

    expect(
      buildSurveyResultsAnalysisArtifactWritePlan({
        artifact,
        cacheKey: undefined,
        currentCache: null,
        slug: 'missing-key-session',
      }),
    ).toEqual({
      blockedReason: 'missing-cache-key',
      payload: null,
      shouldWrite: false,
      target: {
        namespace: 'analysisCache',
        slug: 'missing-key-session',
        cacheKey: '',
        inputSignature: '',
      },
    });
  });

  it('plans survey bookmark payloads without mutating the source cache', () => {
    const bookmarksCache = {
      surveys: ['existing-survey'],
      questions: ['existing-question'],
      otherField: 'kept',
    };

    const plan = buildSurveyResultsSurveyQuestionBookmarkWritePlan({
      bookmarkId: 's2',
      bookmarkType: 'survey',
      bookmarksCache,
      slug: 'edge',
    });

    expect(plan).toEqual({
      blockedReason: '',
      payload: {
        surveys: ['existing-survey', 's2'],
        questions: ['existing-question'],
        otherField: 'kept',
      },
      shouldWrite: true,
      statePatch: {
        key: 'bookmarkedSurveyIDs',
        value: ['existing-survey', 's2'],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: 'edge',
      },
      toggled: {
        action: 'add',
        bookmarkType: 'survey',
        id: 's2',
      },
    });
    expect(bookmarksCache).toEqual({
      surveys: ['existing-survey'],
      questions: ['existing-question'],
      otherField: 'kept',
    });
  });

  it('plans question bookmark removals and preserves current empty-slug identity', () => {
    expect(
      buildSurveyResultsSurveyQuestionBookmarkWritePlan({
        bookmarkId: 'q1',
        bookmarkType: 'question',
        bookmarksCache: {
          surveys: ['s1'],
          questions: ['q1', 'q2'],
        },
        slug: '',
      }),
    ).toEqual({
      blockedReason: '',
      payload: {
        surveys: ['s1'],
        questions: ['q2'],
      },
      shouldWrite: true,
      statePatch: {
        key: 'bookmarkedQuestionIDs',
        value: ['q2'],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: '',
      },
      toggled: {
        action: 'remove',
        bookmarkType: 'question',
        id: 'q1',
      },
    });
  });

  it('pins survey/question bookmark payload normalization for empty and partial cache shapes', () => {
    expect(
      buildSurveyResultsSurveyQuestionBookmarkWritePlan({
        bookmarkId: 's1',
        bookmarkType: 'survey',
        bookmarksCache: undefined,
        slug: 'payload-session',
      }),
    ).toEqual({
      blockedReason: '',
      payload: {
        surveys: ['s1'],
        questions: [],
      },
      shouldWrite: true,
      statePatch: {
        key: 'bookmarkedSurveyIDs',
        value: ['s1'],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: 'payload-session',
      },
      toggled: {
        action: 'add',
        bookmarkType: 'survey',
        id: 's1',
      },
    });

    expect(
      buildSurveyResultsSurveyQuestionBookmarkWritePlan({
        bookmarkId: 'q1',
        bookmarkType: 'question',
        bookmarksCache: {
          surveys: ['s1'],
          unrelated: 'kept',
        },
        slug: 'payload-session',
      }),
    ).toEqual({
      blockedReason: '',
      payload: {
        surveys: ['s1'],
        questions: ['q1'],
        unrelated: 'kept',
      },
      shouldWrite: true,
      statePatch: {
        key: 'bookmarkedQuestionIDs',
        value: ['q1'],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: 'payload-session',
      },
      toggled: {
        action: 'add',
        bookmarkType: 'question',
        id: 'q1',
      },
    });
  });

  it('normalizes malformed bookmark cache lists while preserving unrelated fields', () => {
    expect(
      buildSurveyResultsSurveyQuestionBookmarkWritePlan({
        bookmarkId: 'q2',
        bookmarkType: 'question',
        bookmarksCache: {
          surveys: 'bad-surveys',
          questions: 'bad-questions',
          otherField: 'kept',
        },
        slug: 'edge',
      }),
    ).toEqual({
      blockedReason: '',
      payload: {
        surveys: [],
        questions: ['q2'],
        otherField: 'kept',
      },
      shouldWrite: true,
      statePatch: {
        key: 'bookmarkedQuestionIDs',
        value: ['q2'],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: 'edge',
      },
      toggled: {
        action: 'add',
        bookmarkType: 'question',
        id: 'q2',
      },
    });
  });

  it('blocks invalid survey/question bookmark write plan kinds', () => {
    expect(
      buildSurveyResultsSurveyQuestionBookmarkWritePlan({
        bookmarkId: 'x1',
        bookmarkType: 'unsupported',
        bookmarksCache: {
          surveys: ['s1'],
          questions: ['q1'],
        },
        slug: 'edge',
      }),
    ).toEqual({
      blockedReason: 'invalid-bookmark-type',
      payload: null,
      shouldWrite: false,
      statePatch: null,
      target: {
        namespace: 'bookmarksCache',
        slug: 'edge',
      },
      toggled: null,
    });
  });

  it('documents current parent-owned bookmark id validation boundary', () => {
    expect(
      buildSurveyResultsSurveyQuestionBookmarkWritePlan({
        bookmarkId: undefined,
        bookmarkType: 'survey',
        bookmarksCache: {
          questions: ['q1'],
          surveys: [],
        },
        slug: undefined,
      }),
    ).toEqual({
      blockedReason: '',
      payload: {
        questions: ['q1'],
        surveys: [undefined],
      },
      shouldWrite: true,
      statePatch: {
        key: 'bookmarkedSurveyIDs',
        value: [undefined],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: '',
      },
      toggled: {
        action: 'add',
        bookmarkType: 'survey',
        id: undefined,
      },
    });

    expect(
      buildSurveyResultsSurveyQuestionBookmarkWritePlan({
        bookmarkId: 'q-missing-kind',
        bookmarkType: '',
        bookmarksCache: {
          questions: ['q1'],
          surveys: ['s1'],
        },
        slug: undefined,
      }),
    ).toEqual({
      blockedReason: 'invalid-bookmark-type',
      payload: null,
      shouldWrite: false,
      statePatch: null,
      target: {
        namespace: 'bookmarksCache',
        slug: '',
      },
      toggled: null,
    });
  });
});
