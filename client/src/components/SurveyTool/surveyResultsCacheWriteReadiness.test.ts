import {
  buildSurveyResultsFilterBookmarkWritePlan,
  buildSurveyResultsSurveyQuestionBookmarkWritePlan,
} from './surveyResultsCacheWriteEligibilityPlan';
import {
  buildSurveyResultsFallbackQuestionWritePlan,
} from './surveyResultsFallbackQuestionHelpers';
import {
  buildSurveyResultsRefreshStatusWritePlan,
} from './surveyResultsHelpers';
import {
  runSurveyResultsFilterBookmarkWriteController,
} from './surveyResultsFilterBookmarkWriteController';
import {
  runSurveyResultsFallbackQuestionWriteController,
} from './surveyResultsFallbackQuestionWriteController';
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
      status: 'controller-routed',
    },
    {
      controllerReady: true,
      hasInjectedController: typeof runSurveyResultsSurveyQuestionBookmarkWriteController === 'function',
      hasPurePlan: typeof buildSurveyResultsSurveyQuestionBookmarkWritePlan === 'function',
      path: 'survey/question bookmark writes',
      status: 'controller-routed',
    },
    {
      controllerReady: true,
      hasInjectedController: typeof runSurveyResultsFallbackQuestionWriteController === 'function',
      hasPurePlan: typeof buildSurveyResultsFallbackQuestionWritePlan === 'function',
      path: 'selected-result/status writes',
      status: 'controller-routed',
    },
    {
      controllerReady: false,
      hasInjectedController: false,
      hasPurePlan: typeof buildSurveyResultsRefreshStatusWritePlan === 'function',
      path: 'refresh/status writes',
      status: 'pure-plan-only',
    },
    {
      controllerReady: false,
      hasInjectedController: false,
      hasPurePlan: false,
      path: 'analysis/export artifact writes',
      status: 'deferred',
    },
  ];

  it.each(writePathReadiness)('pins $path controller readiness', ({
    controllerReady,
    hasInjectedController,
    hasPurePlan,
    status,
  }) => {
    expect(controllerReady).toBe(hasPurePlan && hasInjectedController);
    expect([
      'controller-routed',
      'pure-plan-only',
      'deferred',
    ]).toContain(status);
    if (status === 'controller-routed') {
      expect(controllerReady).toBe(true);
      expect(hasPurePlan).toBe(true);
      expect(hasInjectedController).toBe(true);
    }
    if (status === 'pure-plan-only') {
      expect(controllerReady).toBe(false);
      expect(hasPurePlan).toBe(true);
      expect(hasInjectedController).toBe(false);
    }
    if (status === 'deferred') {
      expect(controllerReady).toBe(false);
      expect(hasPurePlan).toBe(false);
      expect(hasInjectedController).toBe(false);
    }
  });
});
