import type { SurveyResultsSurveyQuestionBookmarkWritePlan } from './surveyResultsCacheWriteEligibilityPlan';

type SurveyResultsRecord = Record<string, unknown>;

export type SurveyResultsBookmarksCacheWritePort = (
  namespace: 'bookmarksCache',
  slug: string,
  payload: SurveyResultsRecord,
) => Promise<unknown> | unknown;

export type SurveyResultsSurveyQuestionBookmarkWriteControllerPorts = {
  writeBookmarksCache?: SurveyResultsBookmarksCacheWritePort;
};

export type SurveyResultsSurveyQuestionBookmarkWriteControllerArgs = {
  plan?: SurveyResultsSurveyQuestionBookmarkWritePlan | null;
  ports?: SurveyResultsSurveyQuestionBookmarkWriteControllerPorts;
};

export type SurveyResultsSurveyQuestionBookmarkWriteControllerResult = {
  attempted: boolean;
  error: unknown | null;
  ok: boolean;
  statePatch: SurveyResultsSurveyQuestionBookmarkWritePlan['statePatch'];
  target: {
    namespace: 'bookmarksCache';
    slug: string;
  };
  toggled: SurveyResultsSurveyQuestionBookmarkWritePlan['toggled'];
};

const EMPTY_TARGET = Object.freeze({
  namespace: 'bookmarksCache' as const,
  slug: '',
});

export const runSurveyResultsSurveyQuestionBookmarkWriteController = async ({
  plan = null,
  ports = {},
}: SurveyResultsSurveyQuestionBookmarkWriteControllerArgs = {}): Promise<SurveyResultsSurveyQuestionBookmarkWriteControllerResult> => {
  const target = plan?.target || EMPTY_TARGET;
  if (!plan?.shouldWrite || !plan.payload || typeof ports.writeBookmarksCache !== 'function') {
    return {
      attempted: false,
      error: null,
      ok: false,
      statePatch: plan?.statePatch || null,
      target,
      toggled: plan?.toggled || null,
    };
  }

  try {
    await ports.writeBookmarksCache(plan.target.namespace, plan.target.slug, plan.payload as SurveyResultsRecord);
    return {
      attempted: true,
      error: null,
      ok: true,
      statePatch: plan.statePatch,
      target: plan.target,
      toggled: plan.toggled,
    };
  } catch (error) {
    return {
      attempted: true,
      error,
      ok: false,
      statePatch: plan.statePatch,
      target: plan.target,
      toggled: plan.toggled,
    };
  }
};
