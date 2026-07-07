import {
  buildSurveyResultsAnalysisArtifactCacheKey,
  buildSurveyResultsAnalysisArtifactCacheTarget,
  buildSurveyResultsAnalysisArtifactCacheReadRequestPlan,
  selectSurveyResultsAnalysisArtifactFromCache,
} from './surveyResultsAnalysisArtifactCachePorts';

const buildArtifact = (inputSignature = 'ready-input') => ({
  generatedAt: '2026-06-01T00:00:00.000Z',
  inputSignature,
  kind: 'ce_session_results_analysis_artifact',
  participants: [],
  sections: {
    breakdown: { available: true },
  },
  source: 'ai-generated',
  version: 1,
});

describe('surveyResultsAnalysisArtifactCachePorts', () => {
  it('builds the current analysis artifact cache key shape from network identity', () => {
    expect(
      buildSurveyResultsAnalysisArtifactCacheKey({
        inputSignature: 'input-a',
        networkLabel: 'OP Sepolia',
      }),
    ).toBe('sessionResultsAnalysis:v1:OP Sepolia:input-a');

    expect(
      buildSurveyResultsAnalysisArtifactCacheKey({
        chainId: 84532,
        inputSignature: 'input-b',
        networkLabel: '',
      }),
    ).toBe('sessionResultsAnalysis:v1:84532:input-b');

    expect(
      buildSurveyResultsAnalysisArtifactCacheKey({
        inputSignature: 'input-c',
      }),
    ).toBe('sessionResultsAnalysis:v1:unknown:input-c');
  });

  it('derives a typed sync read request without performing cache execution', () => {
    expect(
      buildSurveyResultsAnalysisArtifactCacheTarget({
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
        inputSignature: 'ready-input',
        slug: 'alpha-session',
      }),
    ).toEqual({
      namespace: 'analysisCache',
      slug: 'alpha-session',
      cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
      inputSignature: 'ready-input',
    });

    const plan = buildSurveyResultsAnalysisArtifactCacheReadRequestPlan({
      cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
      inputSignature: 'ready-input',
      slug: 'alpha-session',
    });

    expect(plan).toEqual({
      readRequest: {
        namespace: 'analysisCache',
        slug: 'alpha-session',
        options: { clone: false },
      },
      shouldRead: true,
      skipReason: '',
      target: {
        namespace: 'analysisCache',
        slug: 'alpha-session',
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
        inputSignature: 'ready-input',
      },
    });
  });

  it('blocks read requests when the cache key is missing', () => {
    expect(
      buildSurveyResultsAnalysisArtifactCacheReadRequestPlan({
        cacheKey: '',
        inputSignature: 'ready-input',
        slug: 'alpha-session',
      }),
    ).toEqual({
      readRequest: null,
      shouldRead: false,
      skipReason: 'missing-cache-key',
      target: {
        namespace: 'analysisCache',
        slug: 'alpha-session',
        cacheKey: '',
        inputSignature: 'ready-input',
      },
    });
  });

  it('selects only artifacts matching the requested cache key and input signature', () => {
    const readyArtifact = buildArtifact('ready-input');
    const staleArtifact = buildArtifact('stale-input');
    const target = {
      namespace: 'analysisCache' as const,
      slug: 'alpha-session',
      cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
      inputSignature: 'ready-input',
    };

    expect(
      selectSurveyResultsAnalysisArtifactFromCache({
        cacheValue: {
          sessionResultsAnalysis: {
            'sessionResultsAnalysis:v1:OP Sepolia:ready-input': readyArtifact,
            'sessionResultsAnalysis:v1:OP Sepolia:stale-input': staleArtifact,
          },
        },
        target,
      }),
    ).toBe(readyArtifact);

    expect(
      selectSurveyResultsAnalysisArtifactFromCache({
        cacheValue: {
          sessionResultsAnalysis: {
            'sessionResultsAnalysis:v1:OP Sepolia:ready-input': staleArtifact,
          },
        },
        target,
      }),
    ).toBeNull();
  });

  it('rejects partial or malformed cached analysis artifact payloads', () => {
    const target = {
      namespace: 'analysisCache' as const,
      slug: 'alpha-session',
      cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
      inputSignature: 'ready-input',
    };

    expect(
      selectSurveyResultsAnalysisArtifactFromCache({
        cacheValue: {
          sessionResultsAnalysis: {
            'sessionResultsAnalysis:v1:OP Sepolia:ready-input': {
              generatedAt: '2026-06-01T00:00:00.000Z',
              inputSignature: 'ready-input',
              kind: 'ce_session_results_analysis_artifact',
              participants: [],
              source: 'ai-generated',
              version: 1,
            },
          },
        },
        target,
      }),
    ).toBeNull();

    expect(
      selectSurveyResultsAnalysisArtifactFromCache({
        cacheValue: {
          sessionResultsAnalysis: 'malformed',
        },
        target,
      }),
    ).toBeNull();
  });
});
