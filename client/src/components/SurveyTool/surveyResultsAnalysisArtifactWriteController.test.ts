import { runSurveyResultsAnalysisArtifactWriteController } from './surveyResultsAnalysisArtifactWriteController';
import type { SurveyResultsAnalysisArtifactWritePlan } from './surveyResultsCacheWriteEligibilityPlan';

const buildPlan = (
  overrides: Partial<SurveyResultsAnalysisArtifactWritePlan> = {},
): SurveyResultsAnalysisArtifactWritePlan => ({
  blockedReason: '',
  payload: {
    sessionResultsAnalysis: {
      'sessionResultsAnalysis:v1:OP Sepolia:new-input': {
        inputSignature: 'new-input',
      },
    },
  },
  shouldWrite: true,
  target: {
    namespace: 'analysisCache',
    slug: 'alpha-session',
    cacheKey: 'sessionResultsAnalysis:v1:OP Sepolia:new-input',
    inputSignature: 'new-input',
  },
  ...overrides,
});

describe('surveyResultsAnalysisArtifactWriteController', () => {
  it('dispatches analysis artifact writes through the injected cache port', async () => {
    const writeAnalysisArtifact = jest.fn().mockResolvedValue(undefined);
    const plan = buildPlan();

    await expect(
      runSurveyResultsAnalysisArtifactWriteController({
        plan,
        ports: { writeAnalysisArtifact },
      }),
    ).resolves.toEqual({
      attempted: true,
      error: null,
      ok: true,
      target: plan.target,
    });

    expect(writeAnalysisArtifact).toHaveBeenCalledWith('analysisCache', 'alpha-session', plan.payload);
  });

  it('stays inert when the pure plan is blocked or the write port is missing', async () => {
    const blockedPlan = buildPlan({
      blockedReason: 'missing-cache-key',
      payload: null,
      shouldWrite: false,
      target: {
        namespace: 'analysisCache',
        slug: 'beta-session',
        cacheKey: '',
        inputSignature: '',
      },
    });

    await expect(
      runSurveyResultsAnalysisArtifactWriteController({
        plan: blockedPlan,
        ports: { writeAnalysisArtifact: jest.fn() },
      }),
    ).resolves.toEqual({
      attempted: false,
      error: null,
      ok: false,
      target: blockedPlan.target,
    });

    await expect(
      runSurveyResultsAnalysisArtifactWriteController({
        plan: buildPlan(),
        ports: {},
      }),
    ).resolves.toEqual({
      attempted: false,
      error: null,
      ok: false,
      target: buildPlan().target,
    });
  });

  it('does not write when a plan has no artifact payload even if marked write-ready', async () => {
    const writeAnalysisArtifact = jest.fn();
    const plan = buildPlan({
      payload: null,
      shouldWrite: true,
    });

    await expect(
      runSurveyResultsAnalysisArtifactWriteController({
        plan,
        ports: {
          writeAnalysisArtifact,
        },
      }),
    ).resolves.toEqual({
      attempted: false,
      error: null,
      ok: false,
      target: plan.target,
    });
    expect(writeAnalysisArtifact).not.toHaveBeenCalled();
  });

  it('captures write failures while preserving the planned target', async () => {
    const error = new Error('analysis cache write failed');
    const plan = buildPlan({
      target: {
        namespace: 'analysisCache',
        slug: 'retry-session',
        cacheKey: 'sessionResultsAnalysis:v1:Base Sepolia:retry-input',
        inputSignature: 'retry-input',
      },
    });

    await expect(
      runSurveyResultsAnalysisArtifactWriteController({
        plan,
        ports: {
          writeAnalysisArtifact: jest.fn().mockRejectedValue(error),
        },
      }),
    ).resolves.toEqual({
      attempted: true,
      error,
      ok: false,
      target: plan.target,
    });
  });
});
