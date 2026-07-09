import {
  buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan,
  runSurveyResultsAnalysisGeneratedArtifactCompletion,
} from './surveyResultsAnalysisGeneratedArtifactCompletionPlan';
import type {
  SessionResultsAnalysisSectionKey,
  SessionResultsGeneratedAnalysisArtifact,
} from '../../utilities/sessionResultsExport';

const requestedSections: SessionResultsAnalysisSectionKey[] = ['breakdown', 'riskMatrix'];

const createArtifact = (
  inputSignature = 'ready-input',
  riskMatrixAvailable = true,
): SessionResultsGeneratedAnalysisArtifact => ({
  generatedAt: '2026-06-01T00:00:00.000Z',
  inputSignature,
  kind: 'ce_session_results_analysis_artifact',
  participants: [],
  sections: {
    argumentMap: { available: false, debates: [] },
    atlas: { available: false, edges: [], nodes: [] },
    breakdown: {
      available: true,
      dimensions: [],
      groups: [{ id: 'group_1', label: 'Ready group' }],
      summary: { overview: 'Ready completion.' },
    },
    riskMatrix: {
      available: riskMatrixAvailable,
      categories: riskMatrixAvailable ? [{ id: 'risk_1', label: 'Ready risk' }] : [],
      comments: [],
      heatmap: {},
      scenarioLinks: [],
    },
  },
  source: 'ai-generated',
  version: 1,
});

describe('surveyResultsAnalysisGeneratedArtifactCompletionPlan', () => {
  it('builds cache write and lifecycle descriptors for a generated artifact matching the current input', () => {
    const artifact = createArtifact('ready-input');

    expect(
      buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan({
        artifact,
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
        inputSignature: 'ready-input',
        requestedSections,
        slug: 'alpha-session',
      }),
    ).toEqual({
      blockedReason: '',
      cacheWriteBlockedReason: '',
      cacheWriteDescriptor: {
        payload: artifact,
        target: {
          namespace: 'analysisCache',
          slug: 'alpha-session',
          cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
          inputSignature: 'ready-input',
        },
      },
      failurePatchDescriptor: null,
      lifecyclePatchDescriptor: {
        htmlReportAnalysisArtifact: artifact,
        htmlReportAnalysisGenerating: false,
        htmlReportAnalysisError: '',
        htmlReportAnalysisProgress: '',
      },
      payloadDescriptor: {
        artifactInputSignature: 'ready-input',
        artifactPresent: true,
        availableSections: ['breakdown', 'riskMatrix'],
        inputSignature: 'ready-input',
        missingSections: [],
        requestedSections,
      },
      shouldWriteCache: true,
      status: 'usable',
      target: {
        namespace: 'analysisCache',
        slug: 'alpha-session',
        cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:ready-input',
        inputSignature: 'ready-input',
        artifactInputSignature: 'ready-input',
      },
      usable: true,
    });
  });

  it('keeps missing requested sections visible without moving completion failure ownership', () => {
    const artifact = createArtifact('partial-input', false);

    const plan = buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan({
      artifact,
      cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:partial-input',
      inputSignature: 'partial-input',
      requestedSections,
      slug: 'partial-session',
    });

    expect(plan.usable).toBe(true);
    expect(plan.shouldWriteCache).toBe(true);
    expect(plan.payloadDescriptor.availableSections).toEqual(['breakdown']);
    expect(plan.payloadDescriptor.missingSections).toEqual(['riskMatrix']);
    expect(plan.cacheWriteDescriptor?.payload).toBe(artifact);
    expect(plan.lifecyclePatchDescriptor?.htmlReportAnalysisArtifact).toBe(artifact);
  });

  it('rejects missing or malformed generated artifacts with the lifecycle failure patch descriptor', () => {
    const failureStatePatch = {
      htmlReportAnalysisGenerating: false,
      htmlReportAnalysisError: 'Retry analysis generation.',
      htmlReportAnalysisProgress: '',
    };

    expect(
      buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan({
        artifact: null,
        failureStatePatch,
        inputSignature: 'missing-input',
        requestedSections,
        slug: 'missing-session',
      }),
    ).toEqual(
      expect.objectContaining({
        blockedReason: 'missing-artifact',
        cacheWriteDescriptor: null,
        failurePatchDescriptor: failureStatePatch,
        lifecyclePatchDescriptor: null,
        shouldWriteCache: false,
        status: 'skipped',
        usable: false,
      }),
    );
  });

  it('rejects stale generated artifacts before they become cache-write payloads or lifecycle patches', () => {
    const staleArtifact = createArtifact('stale-input');

    const plan = buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan({
      artifact: staleArtifact,
      cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:fresh-input',
      inputSignature: 'fresh-input',
      requestedSections,
      slug: 'fresh-session',
    });

    expect(plan.blockedReason).toBe('stale-input-signature');
    expect(plan.cacheWriteDescriptor).toBeNull();
    expect(plan.lifecyclePatchDescriptor).toBeNull();
    expect(plan.payloadDescriptor).toEqual({
      artifactInputSignature: 'stale-input',
      artifactPresent: true,
      availableSections: ['breakdown', 'riskMatrix'],
      inputSignature: 'fresh-input',
      missingSections: [],
      requestedSections,
    });
    expect(plan.usable).toBe(false);
  });

  it('can apply UI completion while explicitly skipping cache writes for missing cache identity', () => {
    const artifact = createArtifact('display-only-input');

    const plan = buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan({
      artifact,
      cacheKey: '',
      inputSignature: 'display-only-input',
      requestedSections,
      slug: 'display-session',
    });

    expect(plan.usable).toBe(true);
    expect(plan.shouldWriteCache).toBe(false);
    expect(plan.cacheWriteBlockedReason).toBe('missing-cache-key');
    expect(plan.cacheWriteDescriptor).toBeNull();
    expect(plan.lifecyclePatchDescriptor?.htmlReportAnalysisArtifact).toBe(artifact);
  });

  it('runs cache write before returning lifecycle completion eligibility', async () => {
    const artifact = createArtifact('runner-input');
    const events: string[] = [];
    const plan = buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan({
      artifact,
      cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:runner-input',
      inputSignature: 'runner-input',
      requestedSections,
      slug: 'runner-session',
    });

    const result = await runSurveyResultsAnalysisGeneratedArtifactCompletion({
      plan,
      ports: {
        writeArtifactToCache: async (payload) => {
          events.push(`write:${payload.inputSignature}`);
        },
      },
    });

    expect(events).toEqual(['write:runner-input']);
    expect(result).toEqual(
      expect.objectContaining({
        cacheWriteAttempted: true,
        cacheWriteSucceeded: true,
        error: null,
        errorMessage: '',
        ok: true,
      }),
    );
    expect(result.lifecyclePatchDescriptor?.htmlReportAnalysisArtifact).toBe(artifact);
  });

  it('does not write cache or expose lifecycle completion for unusable plans', async () => {
    const plan = buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan({
      artifact: null,
      inputSignature: 'missing-input',
      requestedSections,
      slug: 'missing-session',
    });
    const writes: SessionResultsGeneratedAnalysisArtifact[] = [];

    const result = await runSurveyResultsAnalysisGeneratedArtifactCompletion({
      plan,
      ports: {
        writeArtifactToCache: (payload) => {
          writes.push(payload);
        },
      },
    });

    expect(writes).toEqual([]);
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBe('Generated analysis artifact completion failed: missing-artifact');
    expect(result.lifecyclePatchDescriptor).toBeNull();
  });

  it('allows display-only lifecycle completion when cache identity is unavailable', async () => {
    const artifact = createArtifact('display-only-runner');
    const plan = buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan({
      artifact,
      cacheKey: '',
      inputSignature: 'display-only-runner',
      requestedSections,
      slug: 'display-session',
    });

    const result = await runSurveyResultsAnalysisGeneratedArtifactCompletion({
      plan,
      ports: {
        writeArtifactToCache: () => {
          throw new Error('should not write');
        },
      },
    });

    expect(result.cacheWriteAttempted).toBe(false);
    expect(result.cacheWriteSucceeded).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.lifecyclePatchDescriptor?.htmlReportAnalysisArtifact).toBe(artifact);
  });

  it('blocks lifecycle completion when cache write fails', async () => {
    const artifact = createArtifact('cache-failure');
    const error = new Error('cache unavailable');
    const plan = buildSurveyResultsAnalysisGeneratedArtifactCompletionPlan({
      artifact,
      cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:cache-failure',
      inputSignature: 'cache-failure',
      requestedSections,
      slug: 'cache-failure-session',
    });

    const result = await runSurveyResultsAnalysisGeneratedArtifactCompletion({
      plan,
      ports: {
        writeArtifactToCache: () => {
          throw error;
        },
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        cacheWriteAttempted: true,
        cacheWriteSucceeded: false,
        error,
        errorMessage: 'Generated analysis artifact completion cache write failed.',
        lifecyclePatchDescriptor: null,
        ok: false,
      }),
    );
  });
});
