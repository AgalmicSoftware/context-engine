import type { SurveyResultsSurveyQuestionBookmarkWritePlan } from './surveyResultsCacheWriteEligibilityPlan';
import { applyBookmarkChange } from '../../utilities/cache/bookmarkChanges';

/** Saves a change to the latest saved bookmarks (updateCacheAtomic), keeping another tab's. */
export type SurveyResultsBookmarksCacheUpdatePort = (
  namespace: 'bookmarksCache',
  slug: string,
  update: (saved: unknown) => Record<string, unknown>,
) => Promise<unknown> | unknown;

export type SurveyResultsSurveyQuestionBookmarkWriteControllerPorts = {
  updateBookmarksCache?: SurveyResultsBookmarksCacheUpdatePort;
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
  const toggled = plan?.toggled;
  if (!plan?.shouldWrite || !plan.payload || !toggled || typeof ports.updateBookmarksCache !== 'function') {
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
    // The toggle follows what this page showed; it applies to the latest saved bookmarks.
    const list = toggled.bookmarkType === 'survey' ? 'surveys' : 'questions';
    await ports.updateBookmarksCache(plan.target.namespace, plan.target.slug, (saved) =>
      applyBookmarkChange(saved, list, toggled.id, toggled.action === 'add'),
    );
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
