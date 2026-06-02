import {
  buildSurveyResultsCacheReadinessDisplayPlan,
} from './surveyResultsCacheReadinessDisplayPlan';

describe('surveyResultsCacheReadinessDisplayPlan', () => {
  it('plans question-mode missing-cache loading without mutating inputs', () => {
    const args = {
      viewMode: 'questions',
      networkLatestBlock: 0,
      questionLocalBlock: 0,
      responseLocalBlock: 0,
      questionResultsHydrated: false,
      aggregatorEntriesCount: 0,
      filterLoading: false,
    };

    expect(buildSurveyResultsCacheReadinessDisplayPlan(args)).toMatchObject({
      areSummaryCountsHydrated: false,
      filterSummaryDisplay: {
        showFilteredCountSpinner: true,
      },
      questionListDisplay: {
        isInert: true,
        shouldRenderQuestionTable: false,
        showEmptyState: true,
      },
      syncStatusDisplay: {
        isSyncingOrLoading: true,
        showQuickRefresh: true,
        syncStatusText: 'Loading...',
      },
    });
    expect(args).toEqual({
      viewMode: 'questions',
      networkLatestBlock: 0,
      questionLocalBlock: 0,
      responseLocalBlock: 0,
      questionResultsHydrated: false,
      aggregatorEntriesCount: 0,
      filterLoading: false,
    });
  });

  it('uses survey hydration and aggregate counts for ready display plans', () => {
    expect(buildSurveyResultsCacheReadinessDisplayPlan({
      viewMode: 'survey',
      surveyViewMode: 'aggregate',
      aggregatorEntriesCount: 4,
      filteredResponsesCount: 3,
      surveyResultsHydrated: true,
      totalQuestionsCount: 9,
      totalResponsesCount: 12,
      networkLatestBlock: 50,
      surveyLocalBlock: 50,
    })).toMatchObject({
      areSummaryCountsHydrated: true,
      filterSummaryDisplay: {
        displayedTotalQuestionsCount: 9,
        displayedTotalResponsesCount: 12,
        normalizedFilteredQuestionsCount: 4,
        normalizedFilteredResponsesCount: 3,
        showFilteredCountSpinner: false,
      },
      syncStatusDisplay: {
        isSynced: true,
        showQuickRefresh: false,
        syncStatusText: 'In Sync',
      },
    });
  });

  it('keeps stale sync and long-loading notice derivation passive', () => {
    expect(buildSurveyResultsCacheReadinessDisplayPlan({
      viewMode: 'questions',
      networkLatestBlock: 100,
      questionLocalBlock: 25,
      responseLocalBlock: 50,
      refreshTargetQuestionBlock: 80,
      refreshTargetResponseBlock: 75,
      questionResultsHydrated: true,
      syncLoadingStartedAt: 1000,
      nowMs: 17000,
    })).toMatchObject({
      filterSummaryDisplay: {
        showFilteredCountSpinner: false,
      },
      syncStatusDisplay: {
        isSynced: false,
        showLongSyncNotice: true,
        showQuickRefresh: true,
        syncStatusText: 'Syncing...',
        question: {
          label: 'Remaining Blocks: 55',
          progress: 31,
          showRemainingSpinner: true,
        },
        response: {
          label: 'Remaining Blocks: 25',
          progress: 66,
          showRemainingSpinner: true,
        },
      },
    });
  });
});
