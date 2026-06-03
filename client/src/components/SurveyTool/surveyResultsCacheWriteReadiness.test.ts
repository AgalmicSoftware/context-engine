import {
  buildSurveyResultsFilterBookmarkWritePlan,
  buildSurveyResultsSurveyQuestionBookmarkWritePlan,
} from './surveyResultsCacheWriteEligibilityPlan';
import {
  runSurveyResultsFilterBookmarkWriteController,
} from './surveyResultsFilterBookmarkWriteController';
import {
  runSurveyResultsSurveyQuestionBookmarkWriteController,
} from './surveyResultsSurveyQuestionBookmarkWriteController';

describe('surveyResultsCacheWriteReadiness', () => {
  const writePathReadiness = [
    {
      controllerReady: true,
      hasInjectedController: typeof runSurveyResultsFilterBookmarkWriteController === 'function',
      hasPurePlan: typeof buildSurveyResultsFilterBookmarkWritePlan === 'function',
      path: 'filter bookmark writes',
    },
    {
      controllerReady: true,
      hasInjectedController: typeof runSurveyResultsSurveyQuestionBookmarkWriteController === 'function',
      hasPurePlan: typeof buildSurveyResultsSurveyQuestionBookmarkWritePlan === 'function',
      path: 'survey/question bookmark writes',
    },
    {
      controllerReady: false,
      hasInjectedController: false,
      hasPurePlan: false,
      path: 'selected-result/status writes',
    },
    {
      controllerReady: false,
      hasInjectedController: false,
      hasPurePlan: false,
      path: 'refresh/status writes',
    },
  ];

  it.each(writePathReadiness)('pins $path controller readiness', ({
    controllerReady,
    hasInjectedController,
    hasPurePlan,
  }) => {
    expect(controllerReady).toBe(hasPurePlan && hasInjectedController);
  });
});
