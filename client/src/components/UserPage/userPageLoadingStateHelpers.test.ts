import {
  buildUserPageCacheRefreshDisplayState,
  buildUserPageCacheRefreshStatePatch,
  buildUserPageRenderLoadingState,
  buildUserPageSectionLoadingEmptyState,
  buildUserPageUncertainEmptyText,
  buildUserPageUncertaintyLoadingFlags,
  buildUserPageUserStatsMergePatch,
  resolveUserPageAiActionAvailability,
  resolveUserPageAiActionPlan,
  resolveUserPageAnalyzeButtonDisplayState,
  resolveUserPageCacheReadinessDisplayPlan,
  resolveUserPageCompareButtonDisplayState,
  resolveUserPageSectionToggleDisplayState,
  shouldRetryUserPageQuestionData,
} from './userPageLoadingStateHelpers';

describe('userPageLoadingStateHelpers', () => {
  it('builds cache refresh display descriptors for idle, loading, disabled, and cache-miss states', () => {
    const readyInputs = {
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isSBTCacheReady: true,
      isSurveyCacheReady: true,
    };

    const idle = buildUserPageCacheRefreshDisplayState({
      ...readyInputs,
      aiAvailable: true,
      questionResponseInfo: [{ id: 'question-response' }],
      sbtList: [{ id: 'sbt' }],
      surveyResponseInfo: [{ id: 'survey-response' }],
    });
    expect(idle.cacheActionKind).toBe('enabled');
    expect(idle.cacheDisplayKind).toBe('idle');
    expect(idle.hasAnyLoading).toBe(false);
    expect(idle.hasVisibleData).toBe(true);
    expect(idle.loadingIndicators).toEqual({
      questionResponses: false,
      questionsCreated: false,
      sbt: false,
      surveyResponses: false,
      surveysCreated: false,
    });
    expect(idle.aiActionPlan.analyzeButtonDisplayState.disabled).toBe(false);

    const loading = buildUserPageCacheRefreshDisplayState({
      ...readyInputs,
      loadingQuestions: true,
      loadingSBTs: true,
      loadingSurveys: true,
    });
    expect(loading.cacheDisplayKind).toBe('loading');
    expect(loading.hasMissingDataFallback).toBe(false);
    expect(loading.loadingIndicators).toEqual({
      questionResponses: true,
      questionsCreated: true,
      sbt: true,
      surveyResponses: true,
      surveysCreated: true,
    });
    expect(loading.sectionLoadingEmptyState).toEqual({
      questionResponsesLoadingEmpty: true,
      questionsCreatedLoadingEmpty: true,
      sbtSectionLoadingEmpty: true,
      surveyResponsesLoadingEmpty: true,
      surveysCreatedLoadingEmpty: true,
    });

    const disabled = buildUserPageCacheRefreshDisplayState({
      ...readyInputs,
      isResponsesCacheReady: false,
      walletLabel: 'wallet',
    });
    expect(disabled.cacheActionKind).toBe('disabled');
    expect(disabled.aiActionPlan.analyzeButtonDisplayState).toMatchObject({
      disabled: true,
      title: 'Available when the user page fully loads.',
    });
    expect(disabled.aiActionPlan.compareButtonDisplayState.disabled).toBe(true);

    const cacheMiss = buildUserPageCacheRefreshDisplayState(readyInputs);
    expect(cacheMiss.cacheActionKind).toBe('enabled');
    expect(cacheMiss.cacheDisplayKind).toBe('stale-or-cache-miss');
    expect(cacheMiss.hasMissingDataFallback).toBe(true);
  });

  it('resolves cache readiness display plans from passed values only', () => {
    expect(
      resolveUserPageCacheReadinessDisplayPlan({
        disabledByCache: true,
        hasAnyLoading: true,
        hasVisibleData: true,
      }),
    ).toEqual({
      cacheActionKind: 'disabled',
      cacheDisplayKind: 'loading',
      hasMissingDataFallback: false,
    });

    expect(
      resolveUserPageCacheReadinessDisplayPlan({
        disabledByCache: false,
        hasAnyLoading: false,
        hasVisibleData: true,
      }),
    ).toEqual({
      cacheActionKind: 'enabled',
      cacheDisplayKind: 'idle',
      hasMissingDataFallback: false,
    });

    expect(
      resolveUserPageCacheReadinessDisplayPlan({
        disabledByCache: false,
        hasAnyLoading: false,
        hasVisibleData: false,
      }),
    ).toEqual({
      cacheActionKind: 'enabled',
      cacheDisplayKind: 'stale-or-cache-miss',
      hasMissingDataFallback: true,
    });
  });

  it('keeps gated display fallback metadata pure without mutating inputs', () => {
    const questionResponses = Object.freeze([{ id: 'q1' }]) as unknown as { length: number };
    const surveysCreated = Object.freeze([{ id: 's1' }]) as unknown as { length: number };
    const inputSnapshot = JSON.stringify({ questionResponses, surveysCreated });

    const descriptor = buildUserPageCacheRefreshDisplayState({
      hasUncertainGateAccess: true,
      hasUncertainSbtData: true,
      hasUncertainUserData: true,
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isSBTCacheReady: true,
      isSurveyCacheReady: true,
      questionResponseInfo: questionResponses,
      surveyCreationInfo: surveysCreated,
    });

    expect(descriptor.hasGatedOrDecryptDisplayFallback).toBe(true);
    expect(descriptor.hasMissingDataFallback).toBe(false);
    expect(descriptor.uncertainEmptyText).toEqual({
      questionResponsesEmptyText: 'Question responses may be incomplete due scan/RPC issues. Try refresh.',
      sbtEmptyText: 'SBT results may be incomplete due scan/RPC issues. Try refresh.',
    });
    expect(JSON.stringify({ questionResponses, surveysCreated })).toBe(inputSnapshot);
  });

  it('keeps visible profile data analyzable while incomplete cache lanes continue loading', () => {
    const readyInputs = {
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isSBTCacheReady: true,
      isSurveyCacheReady: true,
    };
    const incompleteLanes = [
      { isQuestionCacheReady: false },
      { isResponsesCacheReady: false },
      { isSBTCacheReady: false },
      { isSurveyCacheReady: false },
    ];

    incompleteLanes.forEach((lane) => {
      const descriptor = buildUserPageCacheRefreshDisplayState({
        ...readyInputs,
        ...lane,
        aiAvailable: true,
        questionResponseInfo: [{ id: 'cached-response' }],
      });

      expect(descriptor.loadingState.disabledByCache).toBe(true);
      expect(descriptor.cacheActionKind).toBe('disabled');
      expect(descriptor.aiActionPlan.analyzeButtonDisplayState).toMatchObject({ disabled: false });
      expect(descriptor.aiActionPlan.compareButtonDisplayState).toMatchObject({ disabled: false });
      expect(descriptor.hasVisibleData).toBe(true);
      expect(descriptor.hasMissingDataFallback).toBe(false);
    });

    const gatedVisible = buildUserPageCacheRefreshDisplayState({
      ...readyInputs,
      hasUncertainGateAccess: true,
      hasUncertainUserData: true,
      questionResponseInfo: [{ id: 'gated-cached-response' }],
    });

    expect(gatedVisible.cacheActionKind).toBe('enabled');
    expect(gatedVisible.cacheDisplayKind).toBe('idle');
    expect(gatedVisible.hasGatedOrDecryptDisplayFallback).toBe(true);
    expect(gatedVisible.hasMissingDataFallback).toBe(false);
    expect(gatedVisible.hasVisibleData).toBe(true);
  });

  it('builds loading state from cache readiness and deep-scan activity', () => {
    expect(
      buildUserPageRenderLoadingState({
        isDeepScanLoadingEnabledForSection: (section) => section === 'surveys',
        isDeepScanning: true,
        isQuestionCacheReady: true,
        isResponsesCacheReady: true,
        isSBTCacheReady: true,
        isSurveyCacheReady: true,
        loadingQuestions: false,
        loadingSBTs: false,
        loadingSurveys: false,
      }),
    ).toMatchObject({
      disabledByCache: false,
      isQuestionLoadingAny: false,
      isSbtLoadingAny: true,
      isSurveyLoadingAny: true,
      questionDeepScanLoadingActive: false,
      surveyDeepScanLoadingActive: true,
    });

    expect(
      buildUserPageRenderLoadingState({
        isQuestionCacheReady: true,
        isResponsesCacheReady: false,
        isSBTCacheReady: true,
        isSurveyCacheReady: true,
      }),
    ).toMatchObject({
      disabledByCache: true,
      isQuestionLoadingAny: true,
      isSurveyLoadingAny: true,
    });
  });

  it('resolves AI action and button display states', () => {
    expect(
      resolveUserPageAiActionAvailability({
        aiAvailable: false,
        disabledByCache: false,
        walletLabel: 'wallet',
      }),
    ).toEqual({
      disabled: true,
      title: 'AI not available — connect a wallet or use a session with sponsored AI',
    });
    expect(
      resolveUserPageAiActionAvailability({
        aiAvailable: true,
        disabledByCache: true,
      }),
    ).toEqual({
      disabled: true,
      title: 'Available when the user page fully loads.',
    });
    expect(
      resolveUserPageAnalyzeButtonDisplayState({
        aiActionAvailability: { disabled: true, title: 'Wait' },
        analyzing: true,
      }),
    ).toEqual({
      ariaBusy: 'true',
      disabled: true,
      label: 'Analyzing',
      shouldRenderAnalyzing: true,
      title: 'Wait',
    });
    expect(
      resolveUserPageCompareButtonDisplayState({
        aiActionAvailability: { disabled: false },
        collapseOpen: false,
      }),
    ).toEqual({
      disabled: false,
      shouldRenderCollapseClosedIcon: true,
      shouldRenderCollapseOpenIcon: false,
      title: undefined,
    });
    expect(resolveUserPageSectionToggleDisplayState({ open: true })).toEqual({
      isOpen: true,
      shouldRenderClosedIcon: false,
      shouldRenderOpenIcon: true,
    });
  });

  it('plans AI-bound header actions without invoking analysis handlers', () => {
    expect(
      resolveUserPageAiActionPlan({
        aiAvailable: false,
        analyzing: false,
        collapseOpen: false,
        disabledByCache: false,
        walletLabel: 'wallet',
      }),
    ).toEqual({
      aiActionAvailability: {
        disabled: true,
        title: 'AI not available — connect a wallet or use a session with sponsored AI',
      },
      analyzeButtonDisplayState: {
        ariaBusy: 'false',
        disabled: true,
        label: 'Analyze',
        shouldRenderAnalyzing: false,
        title: 'AI not available — connect a wallet or use a session with sponsored AI',
      },
      compareButtonDisplayState: {
        disabled: true,
        shouldRenderCollapseClosedIcon: true,
        shouldRenderCollapseOpenIcon: false,
        title: 'AI not available — connect a wallet or use a session with sponsored AI',
      },
    });

    expect(
      resolveUserPageAiActionPlan({
        aiAvailable: true,
        analyzing: true,
        collapseOpen: true,
        disabledByCache: false,
      }),
    ).toEqual({
      aiActionAvailability: {
        disabled: false,
        title: undefined,
      },
      analyzeButtonDisplayState: {
        ariaBusy: 'true',
        disabled: true,
        label: 'Analyzing',
        shouldRenderAnalyzing: true,
        title: undefined,
      },
      compareButtonDisplayState: {
        disabled: false,
        shouldRenderCollapseClosedIcon: false,
        shouldRenderCollapseOpenIcon: true,
        title: undefined,
      },
    });
  });

  it('builds section empty states and uncertainty copy', () => {
    expect(buildUserPageSectionLoadingEmptyState()).toEqual({
      questionResponsesLoadingEmpty: false,
      questionsCreatedLoadingEmpty: true,
      sbtSectionLoadingEmpty: false,
      surveyResponsesLoadingEmpty: false,
      surveysCreatedLoadingEmpty: true,
    });
    expect(
      buildUserPageSectionLoadingEmptyState({
        isQuestionLoadingAny: true,
        isQuestionReady: true,
        isSbtLoadingAny: true,
        isSurveyLoadingAny: true,
        isSurveyReady: true,
        questionDeepScanLoadingActive: true,
        sbtList: [],
        surveyDeepScanLoadingActive: true,
      }),
    ).toEqual({
      questionResponsesLoadingEmpty: true,
      questionsCreatedLoadingEmpty: true,
      sbtSectionLoadingEmpty: true,
      surveyResponsesLoadingEmpty: true,
      surveysCreatedLoadingEmpty: true,
    });
    expect(
      buildUserPageUncertainEmptyText({
        hasUncertainSbtData: true,
        hasUncertainUserData: true,
        sbtLabel: 'Badge',
        sbtsLowerLabel: 'badges',
      }),
    ).toEqual({
      questionResponsesEmptyText: 'Question responses may be incomplete due scan/RPC issues. Try refresh.',
      sbtEmptyText: 'Badge results may be incomplete due scan/RPC issues. Try refresh.',
    });
  });

  it('keeps retry and loading flags only while uncertainty remains actionable', () => {
    expect(
      shouldRetryUserPageQuestionData({
        hasUncertainUserData: false,
        holdQuestionLoading: true,
        questionSection: null,
      }),
    ).toBe(false);
    expect(
      shouldRetryUserPageQuestionData({
        hasUncertainUserData: true,
        holdQuestionLoading: false,
        questionSection: { questionResponseInfo: [] },
      }),
    ).toBe(true);
    expect(
      shouldRetryUserPageQuestionData({
        hasUncertainUserData: true,
        holdQuestionLoading: false,
        questionSection: { questionResponseInfo: [{ id: 'q1' }] },
      }),
    ).toBe(false);

    expect(
      buildUserPageUncertaintyLoadingFlags({
        hasQuestionSources: true,
        hasSbtSources: false,
        hasSurveySources: false,
        keepQuestionLoadingDuringDeepScan: true,
        prevState: {
          hasUncertainUserData: true,
          isDeepScanning: false,
        },
        uncertainResources: new Set(['surveyResponses']),
      }),
    ).toEqual({
      hasGateUncertainty: true,
      hasQuestionGateUncertainty: false,
      hasSurveyGateUncertainty: true,
      keepQuestionLoadingDuringDeepScan: true,
      keepQuestionLoadingFromUserUncertainty: false,
      keepSbtLoadingFromUserUncertainty: true,
      keepSurveyLoadingDuringDeepScan: false,
      keepSurveyLoadingFromUserUncertainty: true,
      preserveUserDataUncertainty: true,
    });
  });

  it('builds cache refresh state patches from section plans without applying parent state', () => {
    const plan = buildUserPageCacheRefreshStatePatch({
      aggregatePresent: true,
      deepScanCarryPatch: { deepScanTooltipLines: ['synced through parent'] },
      hasQuestionSources: true,
      hasSbtSources: true,
      hasSurveySources: true,
      keepQuestionLoadingDuringDeepScan: true,
      keepSurveyLoadingDuringDeepScan: true,
      prevState: {
        hasUncertainUserData: true,
        isDeepScanning: true,
        userStats: { existing: 1, badgesReceived: 1 },
      },
      questionSection: {
        detailedQuestionResponses: { q1: { id: 'q1' } },
        questionCreationInfo: [{ id: 'created-q1' }],
        questionResponseInfo: [],
        questionsCreated: 1,
        questionsResponded: 0,
      },
      sbtSection: {
        badgesReceived: 2,
        sbtList: [],
      },
      surveySection: {
        detailedSurveyResponses: { s1: { id: 's1' } },
        surveyCreationInfo: [{ id: 'created-s1' }],
        surveyResponseInfo: [],
        surveysCreated: 1,
        surveysResponded: 0,
      },
      uncertainResources: new Set(['questionResponses']),
    });

    expect(plan.statePatch).toMatchObject({
      deepScanTooltipLines: ['synced through parent'],
      hasUncertainGateAccess: true,
      loadingQuestions: true,
      loadingSBTs: true,
      loadingSurveys: true,
      questionCreationInfo: [{ id: 'created-q1' }],
      questionResponseInfo: [],
      sbtList: [],
      surveyCreationInfo: [{ id: 'created-s1' }],
      surveyResponseInfo: [],
      userStats: {
        badgesReceived: 2,
        existing: 1,
        questionsCreated: 1,
        questionsResponded: 0,
        surveysCreated: 1,
        surveysResponded: 0,
      },
    });
    expect(plan.loadingDiag).toMatchObject({
      hasQuestionGateUncertainty: true,
      hasSurveyGateUncertainty: false,
      loadingQuestions: true,
      loadingSBTs: true,
      loadingSurveys: true,
      preserveUserDataUncertainty: true,
      questionResponseCount: 0,
      sbtCount: 0,
      surveyResponseCount: 0,
    });
  });

  it('composes cache refresh deep-scan carry and loading inputs without parent state application', () => {
    const plan = buildUserPageCacheRefreshStatePatch({
      aggregatePresent: true,
      deepScanProgressRows: [{ slug: 'session-a', percentComplete: 50 }],
      deepScanTooltipLines: ['session-a scanning'],
      isDeepScanLoadingEnabledForSection: (section) => section === 'questions',
      prevState: {
        isDeepScanning: true,
        userStats: {},
      },
      questionSection: {
        detailedQuestionResponses: {},
        questionCreationInfo: [],
        questionResponseInfo: [],
        questionsCreated: 0,
        questionsResponded: 0,
      },
      surveySection: {
        detailedSurveyResponses: {},
        surveyCreationInfo: [],
        surveyResponseInfo: [],
        surveysCreated: 0,
        surveysResponded: 0,
      },
    });

    expect(plan.statePatch).toMatchObject({
      deepScanProgressRows: [{ slug: 'session-a', percentComplete: 50 }],
      deepScanTooltipLines: ['session-a scanning'],
      loadingQuestions: true,
      loadingSurveys: false,
    });
    expect(plan.loadingDiag).toMatchObject({
      keepQuestionLoadingDuringDeepScan: true,
      keepSurveyLoadingDuringDeepScan: false,
      loadingQuestions: true,
      loadingSurveys: false,
    });
  });

  it('keeps held cache lanes loading when section derivation is skipped', () => {
    const plan = buildUserPageCacheRefreshStatePatch({
      aggregatePresent: false,
      holdQuestionLoading: true,
      holdSbtLoading: true,
      holdSurveyLoading: true,
      markLoading: true,
      prevState: {
        hasUncertainUserData: false,
        isDeepScanning: false,
      },
    });

    expect(plan.statePatch).toEqual({
      hasUncertainGateAccess: false,
      loadingQuestions: true,
      loadingSBTs: true,
      loadingSurveys: true,
    });
    expect(plan.loadingDiag).toMatchObject({
      loadingQuestions: true,
      loadingSBTs: true,
      loadingSurveys: true,
      questionResponseCount: 'N/A (held)',
      sbtCount: 'N/A (held)',
      surveyResponseCount: 'N/A (held)',
    });
  });

  it('merges user stats patches without creating empty updates', () => {
    expect(
      buildUserPageUserStatsMergePatch({
        prevUserStats: { badgesReceived: 1, surveysCreated: 2 },
        userStatsPatch: { badgesReceived: 3 },
      }),
    ).toEqual({
      badgesReceived: 3,
      surveysCreated: 2,
    });
    expect(
      buildUserPageUserStatsMergePatch({
        prevUserStats: { badgesReceived: 1 },
        userStatsPatch: {},
      }),
    ).toBeNull();
  });
});
