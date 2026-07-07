import type { SurveyResultsAnalysisArtifactWritePlan } from './surveyResultsCacheWriteEligibilityPlan';
import type {
  SurveyResultsAnalysisArtifactCacheWritePort,
  SurveyResultsAnalysisArtifactCacheTarget,
} from './surveyResultsAnalysisArtifactCachePorts';

type SurveyResultsRecord = Record<string, unknown>;

export type SurveyResultsAnalysisArtifactWritePort = SurveyResultsAnalysisArtifactCacheWritePort;

export type SurveyResultsAnalysisArtifactWriteControllerPorts = {
  writeAnalysisArtifact?: SurveyResultsAnalysisArtifactWritePort;
};

export type SurveyResultsAnalysisArtifactWriteControllerArgs = {
  plan?: SurveyResultsAnalysisArtifactWritePlan | null;
  ports?: SurveyResultsAnalysisArtifactWriteControllerPorts;
};

export type SurveyResultsAnalysisArtifactWriteControllerResult = {
  attempted: boolean;
  error: unknown | null;
  ok: boolean;
  target: SurveyResultsAnalysisArtifactCacheTarget;
};

const EMPTY_TARGET = Object.freeze({
  namespace: 'analysisCache' as const,
  slug: '',
  cacheKey: '',
  inputSignature: '',
});

export const runSurveyResultsAnalysisArtifactWriteController = async ({
  plan = null,
  ports = {},
}: SurveyResultsAnalysisArtifactWriteControllerArgs = {}): Promise<SurveyResultsAnalysisArtifactWriteControllerResult> => {
  const target = plan?.target || EMPTY_TARGET;
  if (!plan?.shouldWrite || !plan.payload || typeof ports.writeAnalysisArtifact !== 'function') {
    return {
      attempted: false,
      error: null,
      ok: false,
      target,
    };
  }

  try {
    await ports.writeAnalysisArtifact(plan.target.namespace, plan.target.slug, plan.payload as SurveyResultsRecord);
    return {
      attempted: true,
      error: null,
      ok: true,
      target: plan.target,
    };
  } catch (error) {
    return {
      attempted: true,
      error,
      ok: false,
      target: plan.target,
    };
  }
};
