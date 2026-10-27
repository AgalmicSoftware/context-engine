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
  it('merges only the target artifact into the saved cache through the atomic port', async () => {
    const plan = buildPlan();
    plan.payload = {
      ...plan.payload,
      staleFlag: true,
      sessionResultsAnalysis: {
        ...(plan.payload?.sessionResultsAnalysis as Record<string, unknown>),
        other: { inputSignature: 'stale-sibling' },
        removed: { inputSignature: 'removed-in-another-tab' },
      },
    };
    const saved = {
      latestFlag: true,
      11155420: { '0x00000000000000000000000000000000000000aa': { profile: { expiresAt: 1000 } } },
      sessionResultsAnalysis: { other: { inputSignature: 'updated-in-another-tab' } },
    };
    let persisted: unknown;
    const writeAnalysisArtifact = jest.fn(
      async (_namespace: string, _slug: string, update: (saved: unknown) => Record<string, unknown>) => {
        persisted = update(saved);
      },
    );

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

    expect(writeAnalysisArtifact).toHaveBeenCalledWith('analysisCache', 'alpha-session', expect.any(Function));
    expect(persisted).toEqual({
      ...saved,
      sessionResultsAnalysis: {
        other: { inputSignature: 'updated-in-another-tab' },
        [plan.target.cacheKey]: { inputSignature: 'new-input' },
      },
    });
    expect(saved.sessionResultsAnalysis).toEqual({ other: { inputSignature: 'updated-in-another-tab' } });
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
