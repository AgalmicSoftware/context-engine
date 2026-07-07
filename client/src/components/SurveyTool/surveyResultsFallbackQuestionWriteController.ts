import type {
  SurveyResultsFallbackQuestion,
  SurveyResultsFallbackQuestionBucketName,
  SurveyResultsFallbackQuestionWritePlan,
} from './surveyResultsFallbackQuestionHelpers';

export type SurveyResultsFallbackQuestionWritePort = (
  bucketName: SurveyResultsFallbackQuestionBucketName,
  cacheKey: string,
  payload: SurveyResultsFallbackQuestion,
) => unknown;

export type SurveyResultsFallbackQuestionWriteControllerPorts = {
  writeFallbackQuestion?: SurveyResultsFallbackQuestionWritePort;
};

export type SurveyResultsFallbackQuestionWriteControllerArgs = {
  plan?: SurveyResultsFallbackQuestionWritePlan | null;
  ports?: SurveyResultsFallbackQuestionWriteControllerPorts;
};

export type SurveyResultsFallbackQuestionWriteControllerResult = {
  attempted: boolean;
  fallbackQuestion: SurveyResultsFallbackQuestion | null;
  ok: boolean;
  statePatch: Record<string, never>;
  target: {
    bucketName: SurveyResultsFallbackQuestionBucketName;
    cacheKey: string;
  };
};

const EMPTY_TARGET = Object.freeze({
  bucketName: 'summary' as const,
  cacheKey: '',
});

export const runSurveyResultsFallbackQuestionWriteController = ({
  plan = null,
  ports = {},
}: SurveyResultsFallbackQuestionWriteControllerArgs = {}): SurveyResultsFallbackQuestionWriteControllerResult => {
  const target = plan?.target || EMPTY_TARGET;
  if (!plan?.shouldWrite || !plan.payload || typeof ports.writeFallbackQuestion !== 'function') {
    return {
      attempted: false,
      fallbackQuestion: plan?.fallbackQuestion || null,
      ok: false,
      statePatch: {},
      target,
    };
  }

  ports.writeFallbackQuestion(plan.target.bucketName, plan.target.cacheKey, plan.payload);

  return {
    attempted: true,
    fallbackQuestion: plan.fallbackQuestion,
    ok: true,
    statePatch: {},
    target: plan.target,
  };
};
