import { buildSurveyResultsCacheControllerSnapshot } from './surveyResultsCacheControllerSnapshot';

describe('surveyResultsCacheControllerSnapshot', () => {
  it('packages question-mode cache, filter, polling, refresh, and selected result inputs without mutating them', () => {
    const filterState = {
      text: 'edge case',
      sbtFilter: { selectedSBTGroups: ['group-a'] },
    };
    const args = {
      activeSessionSlug: 'edge',
      aggregatorEntriesCount: 2,
      currentSurveyId: '',
      currentSurveyIdForUrl: null,
      currentViewModeForUrl: 'questions',
      filterLoading: true,
      filterState,
      filteredQuestionsCount: 1,
      filteredResponsesCount: 3,
      hasRefreshQuestionMetadata: true,
      hasRefreshQuestionResponses: false,
      hasRefreshSurveyResponsesByID: true,
      isQuestionCacheReady: false,
      isSBTCacheReady: true,
      networkLatestBlock: 100,
      nowMs: 2000,
      questionLocalBlock: 40,
      questionResponsesNonce: 'responses-nonce',
      questionsCacheNonce: 'questions-nonce',
      questionResultsHydrated: false,
      refreshTargetQuestionBlock: 80,
      refreshTargetResponseBlock: 70,
      responseLocalBlock: 20,
      sbtCacheRevision: 'sbt-revision',
      showQuestionFilter: true,
      storageKeyPrefix: 'dg:filters:edge',
      surveyLocalBlock: 0,
      surveyResultsHydrated: true,
      surveyViewMode: 'aggregate',
      syncLoadingStartedAt: 1000,
      totalQuestionsCount: 5,
      totalResponsesCount: 8,
      viewMode: 'questions',
    };

    expect(buildSurveyResultsCacheControllerSnapshot(args)).toEqual({
      cacheReadinessInput: {
        aggregatorEntriesCount: 2,
        filteredQuestionsCount: 1,
        filteredResponsesCount: 3,
        filterLoading: true,
        networkLatestBlock: 100,
        nowMs: 2000,
        questionLocalBlock: 40,
        questionResultsHydrated: false,
        refreshTargetQuestionBlock: 80,
        refreshTargetResponseBlock: 70,
        refreshTargetSurveyBlock: 0,
        responseLocalBlock: 20,
        surveyLocalBlock: 0,
        surveyResultsHydrated: true,
        surveyViewMode: 'aggregate',
        syncLoadingStartedAt: 1000,
        totalQuestionsCount: 5,
        totalResponsesCount: 8,
        viewMode: 'questions',
      },
      filterInput: {
        activeSessionSlug: 'edge',
        currentSurveyIdForUrl: null,
        currentViewModeForUrl: 'questions',
        filterLoading: true,
        filterState,
        isQuestionCacheReady: false,
        isSBTCacheReady: true,
        questionResponsesNonce: 'responses-nonce',
        questionsCacheNonce: 'questions-nonce',
        sbtCacheRevision: 'sbt-revision',
        showQuestionFilter: true,
        storageKeyPrefix: 'dg:filters:edge',
      },
      manualRefreshInput: {
        canDispatch: true,
        canRefreshQuestions: true,
        canRefreshSurvey: false,
        status: 'questions',
        surveyId: '',
        viewMode: 'questions',
      },
      pollingInput: {
        networkLatestBlock: 100,
        questionLocalBlock: 40,
        refreshTargetQuestionBlock: 80,
        refreshTargetResponseBlock: 70,
        refreshTargetSurveyBlock: 0,
        responseLocalBlock: 20,
        surveyLocalBlock: 0,
      },
      selectedIdentityInput: {
        activeSessionSlug: 'edge',
        currentSurveyId: '',
        currentSurveyIdForUrl: null,
        currentViewModeForUrl: 'questions',
        viewMode: 'questions',
      },
      selectedResultInput: {
        activeSessionSlug: 'edge',
        currentSurveyId: '',
        questionResponsesNonce: 'responses-nonce',
        questionsCacheNonce: 'questions-nonce',
        sbtCacheRevision: 'sbt-revision',
      },
    });
    expect(args.filterState).toBe(filterState);
  });

  it('keeps survey manual refresh inert until the survey id and refresh port are available', () => {
    expect(
      buildSurveyResultsCacheControllerSnapshot({
        currentSurveyId: '0xabc',
        hasRefreshSurveyResponsesByID: true,
        viewMode: 'survey',
      }).manualRefreshInput,
    ).toEqual({
      canDispatch: true,
      canRefreshQuestions: false,
      canRefreshSurvey: true,
      status: 'survey',
      surveyId: '0xabc',
      viewMode: 'survey',
    });

    expect(
      buildSurveyResultsCacheControllerSnapshot({
        currentSurveyId: '',
        hasRefreshSurveyResponsesByID: true,
        viewMode: 'survey',
      }).manualRefreshInput,
    ).toEqual({
      canDispatch: false,
      canRefreshQuestions: false,
      canRefreshSurvey: false,
      status: 'inert',
      surveyId: '',
      viewMode: 'survey',
    });
  });

  it('preserves survey-mode identity, readiness, and polling inputs as passive descriptors', () => {
    const snapshot = buildSurveyResultsCacheControllerSnapshot({
      activeSessionSlug: 'alpha-session',
      currentSurveyId: 42,
      currentSurveyIdForUrl: 'route-survey-42',
      currentViewModeForUrl: 'survey',
      hasRefreshQuestionMetadata: true,
      hasRefreshQuestionResponses: true,
      hasRefreshSurveyResponsesByID: true,
      networkLatestBlock: 180,
      questionLocalBlock: 150,
      questionResponsesNonce: 'qr-nonce',
      questionsCacheNonce: 'q-nonce',
      questionResultsHydrated: false,
      refreshTargetQuestionBlock: 160,
      refreshTargetResponseBlock: 170,
      refreshTargetSurveyBlock: 175,
      responseLocalBlock: 140,
      sbtCacheRevision: 'sbt-revision',
      surveyLocalBlock: 130,
      surveyResultsHydrated: true,
      surveyViewMode: 'individual',
      totalQuestionsCount: 8,
      totalResponsesCount: 21,
      viewMode: 'survey',
    });

    expect(snapshot.selectedIdentityInput).toEqual({
      activeSessionSlug: 'alpha-session',
      currentSurveyId: '42',
      currentSurveyIdForUrl: 'route-survey-42',
      currentViewModeForUrl: 'survey',
      viewMode: 'survey',
    });
    expect(snapshot.selectedResultInput).toEqual({
      activeSessionSlug: 'alpha-session',
      currentSurveyId: '42',
      questionResponsesNonce: 'qr-nonce',
      questionsCacheNonce: 'q-nonce',
      sbtCacheRevision: 'sbt-revision',
    });
    expect(snapshot.cacheReadinessInput).toMatchObject({
      questionResultsHydrated: false,
      surveyResultsHydrated: true,
      surveyViewMode: 'individual',
      totalQuestionsCount: 8,
      totalResponsesCount: 21,
      viewMode: 'survey',
    });
    expect(snapshot.pollingInput).toEqual({
      networkLatestBlock: 180,
      questionLocalBlock: 150,
      refreshTargetQuestionBlock: 160,
      refreshTargetResponseBlock: 170,
      refreshTargetSurveyBlock: 175,
      responseLocalBlock: 140,
      surveyLocalBlock: 130,
    });
    expect(snapshot.manualRefreshInput).toEqual({
      canDispatch: true,
      canRefreshQuestions: false,
      canRefreshSurvey: true,
      status: 'survey',
      surveyId: '42',
      viewMode: 'survey',
    });
  });
});
