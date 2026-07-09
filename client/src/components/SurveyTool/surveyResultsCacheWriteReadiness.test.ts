import {
  buildSurveyResultsAnalysisArtifactWritePlan,
  buildSurveyResultsFilterBookmarkWritePlan,
  buildSurveyResultsSurveyQuestionBookmarkWritePlan,
} from './surveyResultsCacheWriteEligibilityPlan';
import { buildSurveyResultsAnalysisLifecyclePlan } from './surveyResultsAnalysisLifecyclePlan';
import { runSurveyResultsAnalysisLifecycleController } from './surveyResultsAnalysisLifecycleController';
import { buildSurveyResultsCacheControllerSnapshot } from './surveyResultsCacheControllerSnapshot';
import { buildSurveyResultsCacheReadinessDisplayPlan } from './surveyResultsCacheReadinessDisplayPlan';
import { buildSurveyResultsFallbackQuestionWritePlan } from './surveyResultsFallbackQuestionHelpers';
import {
  buildSurveyResultsRefreshStatusSequencePlan,
  buildSurveyResultsRefreshStatusWritePlan,
} from './surveyResultsHelpers';
import { runSurveyResultsFilterBookmarkWriteController } from './surveyResultsFilterBookmarkWriteController';
import { runSurveyResultsFallbackQuestionWriteController } from './surveyResultsFallbackQuestionWriteController';
import { runSurveyResultsAnalysisArtifactWriteController } from './surveyResultsAnalysisArtifactWriteController';
import { runSurveyResultsSurveyQuestionBookmarkWriteController } from './surveyResultsSurveyQuestionBookmarkWriteController';

describe('surveyResultsCacheWriteReadiness', () => {
  const writePathReadiness = [
    {
      controllerReady: true,
      hasInjectedController: typeof runSurveyResultsFilterBookmarkWriteController === 'function',
      hasMethodBoundaryCoverage: true,
      hasPurePlan: typeof buildSurveyResultsFilterBookmarkWritePlan === 'function',
      path: 'filter bookmark writes',
      status: 'controller-routed',
    },
    {
      controllerReady: true,
      hasInjectedController: typeof runSurveyResultsSurveyQuestionBookmarkWriteController === 'function',
      hasMethodBoundaryCoverage: true,
      hasPurePlan: typeof buildSurveyResultsSurveyQuestionBookmarkWritePlan === 'function',
      path: 'survey/question bookmark writes',
      status: 'controller-routed',
    },
    {
      controllerReady: true,
      hasInjectedController: typeof runSurveyResultsFallbackQuestionWriteController === 'function',
      hasMethodBoundaryCoverage: true,
      hasPurePlan: typeof buildSurveyResultsFallbackQuestionWritePlan === 'function',
      path: 'selected-result/status writes',
      status: 'controller-routed',
    },
    {
      blockers: [
        'parent-owned setState application',
        'polling/backoff lifecycle',
        'latest-block network reads',
        'queued refresh dispatch',
      ],
      controllerReady: false,
      hasInjectedController: false,
      hasMethodBoundaryCoverage: true,
      hasPurePlan:
        typeof buildSurveyResultsRefreshStatusWritePlan === 'function' &&
        typeof buildSurveyResultsRefreshStatusSequencePlan === 'function',
      path: 'refresh/status sequencing',
      status: 'pure-sequence-plan-only',
    },
    {
      blockers: ['AI generation flow', 'report export/download execution', 'parent-owned cache reads'],
      controllerReady: true,
      hasInjectedController: typeof runSurveyResultsAnalysisArtifactWriteController === 'function',
      hasMethodBoundaryCoverage: true,
      hasPurePlan: typeof buildSurveyResultsAnalysisArtifactWritePlan === 'function',
      path: 'analysis artifact cache writes',
      status: 'controller-routed',
    },
    {
      blockers: [
        'AI generation flow',
        'section artifact merge',
        'cache read/write execution',
        'parent-owned setState application',
      ],
      controllerReady: true,
      hasInjectedController: typeof runSurveyResultsAnalysisLifecycleController === 'function',
      hasMethodBoundaryCoverage: true,
      hasPurePlan: typeof buildSurveyResultsAnalysisLifecyclePlan === 'function',
      path: 'analysis lifecycle status and recovery',
      status: 'controller-routed',
    },
    {
      blockers: [
        'normalization shape',
        'stale/latest-block precedence',
        'missing key behavior',
        'partial payloads',
        'failure/recovery',
      ],
      controllerReady: false,
      hasInjectedController: false,
      hasMethodBoundaryCoverage: true,
      hasPurePlan:
        typeof buildSurveyResultsCacheControllerSnapshot === 'function' &&
        typeof buildSurveyResultsCacheReadinessDisplayPlan === 'function',
      path: 'broad results cache normalization',
      status: 'test-pinned-only',
    },
    {
      blockers: [
        'DOM download execution',
        'export payload generation',
        'report modal state',
        'analysis artifact availability',
      ],
      controllerReady: false,
      hasInjectedController: false,
      hasMethodBoundaryCoverage: true,
      hasPurePlan: false,
      path: 'HTML report export/download persistence',
      status: 'blocked',
    },
  ];

  it.each(writePathReadiness)(
    'pins $path controller readiness',
    ({ blockers = [], controllerReady, hasInjectedController, hasMethodBoundaryCoverage, hasPurePlan, status }) => {
      expect(controllerReady).toBe(hasPurePlan && hasInjectedController);
      expect(hasMethodBoundaryCoverage).toBe(true);
      expect([
        'controller-routed',
        'pure-plan-only',
        'pure-sequence-plan-only',
        'method-covered-deferred',
        'test-pinned-only',
        'blocked',
      ]).toContain(status);
      if (status === 'controller-routed') {
        expect(controllerReady).toBe(true);
        expect(hasPurePlan).toBe(true);
        expect(hasInjectedController).toBe(true);
      }
      if (status === 'pure-sequence-plan-only') {
        expect(controllerReady).toBe(false);
        expect(hasPurePlan).toBe(true);
        expect(hasInjectedController).toBe(false);
        expect(blockers).toEqual(
          expect.arrayContaining(['parent-owned setState application', 'polling/backoff lifecycle']),
        );
      }
      if (status === 'pure-plan-only') {
        expect(controllerReady).toBe(false);
        expect(hasPurePlan).toBe(true);
        expect(hasInjectedController).toBe(false);
        expect(blockers).toEqual(expect.arrayContaining(['AI generation flow', 'cache read/write execution']));
      }
      if (status === 'test-pinned-only') {
        expect(controllerReady).toBe(false);
        expect(hasMethodBoundaryCoverage).toBe(true);
        expect(hasInjectedController).toBe(false);
        expect(blockers).toEqual(
          expect.arrayContaining([
            'normalization shape',
            'stale/latest-block precedence',
            'missing key behavior',
            'partial payloads',
            'failure/recovery',
          ]),
        );
      }
      if (status === 'blocked') {
        expect(controllerReady).toBe(false);
        expect(hasPurePlan).toBe(false);
        expect(hasInjectedController).toBe(false);
        expect(blockers.length).toBeGreaterThan(0);
      }
      if (status === 'method-covered-deferred') {
        expect(controllerReady).toBe(false);
        expect(hasPurePlan).toBe(false);
        expect(hasInjectedController).toBe(false);
        expect(blockers).toEqual(expect.arrayContaining(['AI generation flow', 'broad analysis cache persistence']));
      }
    },
  );
});
