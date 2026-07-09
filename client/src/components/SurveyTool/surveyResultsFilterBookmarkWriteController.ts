import type { SurveyResultsFilterBookmarkWritePlan } from './surveyResultsCacheWriteEligibilityPlan';

type SurveyResultsRecord = Record<string, unknown>;

export type SurveyResultsFilterBookmarkWritePort = (
  namespace: 'filters',
  slug: string,
  payload: SurveyResultsRecord,
) => Promise<unknown> | unknown;

export type SurveyResultsFilterBookmarkWriteControllerPorts = {
  writeFilterBookmark?: SurveyResultsFilterBookmarkWritePort;
};

export type SurveyResultsFilterBookmarkWriteControllerArgs = {
  plan?: SurveyResultsFilterBookmarkWritePlan | null;
  ports?: SurveyResultsFilterBookmarkWriteControllerPorts;
};

export type SurveyResultsFilterBookmarkWriteControllerResult = {
  attempted: boolean;
  error: unknown | null;
  ok: boolean;
  shouldApplySuccessFeedback: boolean;
  statePatch: SurveyResultsRecord;
  target: {
    namespace: 'filters';
    slug: string;
  };
};

const EMPTY_TARGET = Object.freeze({
  namespace: 'filters' as const,
  slug: '',
});

export const runSurveyResultsFilterBookmarkWriteController = async ({
  plan = null,
  ports = {},
}: SurveyResultsFilterBookmarkWriteControllerArgs = {}): Promise<SurveyResultsFilterBookmarkWriteControllerResult> => {
  const target = plan?.target || EMPTY_TARGET;
  if (!plan?.shouldWrite || !plan.payload || typeof ports.writeFilterBookmark !== 'function') {
    return {
      attempted: false,
      error: null,
      ok: false,
      shouldApplySuccessFeedback: false,
      statePatch: {},
      target,
    };
  }

  try {
    await ports.writeFilterBookmark(plan.target.namespace, plan.target.slug, plan.payload as SurveyResultsRecord);
    return {
      attempted: true,
      error: null,
      ok: true,
      shouldApplySuccessFeedback: plan.successFeedback === true,
      statePatch: {},
      target: plan.target,
    };
  } catch (error) {
    return {
      attempted: true,
      error,
      ok: false,
      shouldApplySuccessFeedback: false,
      statePatch: {},
      target: plan.target,
    };
  }
};
