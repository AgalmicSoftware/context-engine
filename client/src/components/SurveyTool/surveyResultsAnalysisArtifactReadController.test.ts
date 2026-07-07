import { runSurveyResultsAnalysisArtifactReadController } from './surveyResultsAnalysisArtifactReadController';
import type {
  SurveyResultsAnalysisArtifactCacheReadRequest,
  SurveyResultsAnalysisArtifactCacheTarget,
} from './surveyResultsAnalysisArtifactCachePorts';

const target: SurveyResultsAnalysisArtifactCacheTarget = {
  namespace: 'analysisCache',
  slug: 'alpha-session',
  cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
  inputSignature: 'ready-input',
};

const readRequest: SurveyResultsAnalysisArtifactCacheReadRequest = {
  namespace: 'analysisCache',
  slug: 'alpha-session',
  options: { clone: false },
};

const artifact = {
  generatedAt: '2026-06-01T00:00:00.000Z',
  inputSignature: 'ready-input',
  kind: 'ce_session_results_analysis_artifact' as const,
  participants: [],
  sections: {
    argumentMap: { available: true, debates: [] },
    atlas: { available: true, edges: [], nodes: [] },
    breakdown: { available: true, dimensions: [], groups: [], summary: {} },
    riskMatrix: { available: true, categories: [], comments: [], heatmap: {}, scenarioLinks: [] },
  },
  source: 'ai-generated' as const,
  version: 1 as const,
};

describe('surveyResultsAnalysisArtifactReadController', () => {
  it('skips when no read request is provided', () => {
    const readAnalysisArtifactCache = jest.fn();

    expect(
      runSurveyResultsAnalysisArtifactReadController({
        ports: { readAnalysisArtifactCache },
        readRequest: null,
        target,
      }),
    ).toEqual({
      artifact: null,
      error: null,
      ok: true,
      readRequest: null,
      skipReason: 'missing-read-request',
      status: 'skipped',
      target,
    });
    expect(readAnalysisArtifactCache).not.toHaveBeenCalled();
  });

  it('skips when the read port is missing', () => {
    expect(
      runSurveyResultsAnalysisArtifactReadController({
        ports: {},
        readRequest,
        target,
      }),
    ).toEqual({
      artifact: null,
      error: null,
      ok: true,
      readRequest,
      skipReason: 'missing-read-port',
      status: 'skipped',
      target,
    });
  });

  it('calls the read port with exact request identity and selects the cached artifact', () => {
    const cacheValue = {
      sessionResultsAnalysis: {
        [target.cacheKey]: artifact,
      },
    };
    const readAnalysisArtifactCache = jest.fn(() => cacheValue);
    const selectAnalysisArtifact = jest.fn(() => artifact);

    expect(
      runSurveyResultsAnalysisArtifactReadController({
        ports: {
          readAnalysisArtifactCache,
          selectAnalysisArtifact,
        },
        readRequest,
        target,
      }),
    ).toEqual({
      artifact,
      error: null,
      ok: true,
      readRequest,
      skipReason: '',
      status: 'read',
      target,
    });
    expect(readAnalysisArtifactCache).toHaveBeenCalledWith('analysisCache', 'alpha-session', { clone: false });
    expect(selectAnalysisArtifact).toHaveBeenCalledWith({
      cacheValue,
      target,
    });
  });

  it('returns a read result with no artifact when stale or partial cache values are rejected', () => {
    const readAnalysisArtifactCache = jest.fn(() => ({
      sessionResultsAnalysis: {
        [target.cacheKey]: {
          ...artifact,
          inputSignature: 'stale-input',
        },
      },
    }));

    expect(
      runSurveyResultsAnalysisArtifactReadController({
        ports: { readAnalysisArtifactCache },
        readRequest,
        target,
      }),
    ).toEqual({
      artifact: null,
      error: null,
      ok: true,
      readRequest,
      skipReason: '',
      status: 'read',
      target,
    });

    readAnalysisArtifactCache.mockReturnValueOnce({
      sessionResultsAnalysis: {
        [target.cacheKey]: {
          generatedAt: artifact.generatedAt,
          inputSignature: artifact.inputSignature,
          kind: artifact.kind,
          participants: [],
          source: artifact.source,
          version: artifact.version,
        },
      },
    });

    expect(
      runSurveyResultsAnalysisArtifactReadController({
        ports: { readAnalysisArtifactCache },
        readRequest,
        target,
      }).artifact,
    ).toBeNull();
  });

  it('returns a failed result when the read port throws', () => {
    const error = new Error('analysis cache read failed');
    const readAnalysisArtifactCache = jest.fn(() => {
      throw error;
    });

    expect(
      runSurveyResultsAnalysisArtifactReadController({
        ports: { readAnalysisArtifactCache },
        readRequest,
        target,
      }),
    ).toEqual({
      artifact: null,
      error,
      ok: false,
      readRequest,
      skipReason: '',
      status: 'failed',
      target,
    });
  });
});
