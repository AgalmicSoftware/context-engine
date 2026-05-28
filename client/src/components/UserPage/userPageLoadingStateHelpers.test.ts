import {
  buildUserPageRenderLoadingState,
  buildUserPageSectionLoadingEmptyState,
  buildUserPageUncertainEmptyText,
  buildUserPageUncertaintyLoadingFlags,
  buildUserPageUserStatsMergePatch,
  resolveUserPageAiActionAvailability,
  resolveUserPageAiActionPlan,
  resolveUserPageAnalyzeButtonDisplayState,
  resolveUserPageCompareButtonDisplayState,
  resolveUserPageSectionToggleDisplayState,
  shouldRetryUserPageQuestionData,
} from './userPageLoadingStateHelpers';

describe('userPageLoadingStateHelpers', () => {
  it('builds loading state from cache readiness and deep-scan activity', () => {
    expect(buildUserPageRenderLoadingState({
      isDeepScanLoadingEnabledForSection: (section) => section === 'surveys',
      isDeepScanning: true,
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isSBTCacheReady: true,
      isSurveyCacheReady: true,
      loadingQuestions: false,
      loadingSBTs: false,
      loadingSurveys: false,
    })).toMatchObject({
      disabledByCache: false,
      isQuestionLoadingAny: false,
      isSbtLoadingAny: true,
      isSurveyLoadingAny: true,
      questionDeepScanLoadingActive: false,
      surveyDeepScanLoadingActive: true,
    });

    expect(buildUserPageRenderLoadingState({
      isQuestionCacheReady: true,
      isResponsesCacheReady: false,
      isSBTCacheReady: true,
      isSurveyCacheReady: true,
    })).toMatchObject({
      disabledByCache: true,
      isQuestionLoadingAny: true,
      isSurveyLoadingAny: true,
    });
  });

  it('resolves AI action and button display states', () => {
    expect(resolveUserPageAiActionAvailability({
      aiAvailable: false,
      disabledByCache: false,
      walletLabel: 'wallet',
    })).toEqual({
      disabled: true,
      title: 'AI not available — connect a wallet or use a session with sponsored AI',
    });
    expect(resolveUserPageAiActionAvailability({
      aiAvailable: true,
      disabledByCache: true,
    })).toEqual({
      disabled: true,
      title: 'Available when the user page fully loads.',
    });
    expect(resolveUserPageAnalyzeButtonDisplayState({
      aiActionAvailability: { disabled: true, title: 'Wait' },
      analyzing: true,
    })).toEqual({
      ariaBusy: 'true',
      disabled: true,
      label: 'Analyzing',
      shouldRenderAnalyzing: true,
      title: 'Wait',
    });
    expect(resolveUserPageCompareButtonDisplayState({
      aiActionAvailability: { disabled: false },
      collapseOpen: false,
    })).toEqual({
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
    expect(resolveUserPageAiActionPlan({
      aiAvailable: false,
      analyzing: false,
      collapseOpen: false,
      disabledByCache: false,
      walletLabel: 'wallet',
    })).toEqual({
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

    expect(resolveUserPageAiActionPlan({
      aiAvailable: true,
      analyzing: true,
      collapseOpen: true,
      disabledByCache: false,
    })).toEqual({
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
    expect(buildUserPageSectionLoadingEmptyState({
      isQuestionLoadingAny: true,
      isQuestionReady: true,
      isSbtLoadingAny: true,
      isSurveyLoadingAny: true,
      isSurveyReady: true,
      questionDeepScanLoadingActive: true,
      sbtList: [],
      surveyDeepScanLoadingActive: true,
    })).toEqual({
      questionResponsesLoadingEmpty: true,
      questionsCreatedLoadingEmpty: true,
      sbtSectionLoadingEmpty: true,
      surveyResponsesLoadingEmpty: true,
      surveysCreatedLoadingEmpty: true,
    });
    expect(buildUserPageUncertainEmptyText({
      hasUncertainSbtData: true,
      hasUncertainUserData: true,
      sbtLabel: 'Badge',
      sbtsLowerLabel: 'badges',
    })).toEqual({
      questionResponsesEmptyText: 'Question responses may be incomplete due scan/RPC issues. Try refresh.',
      sbtEmptyText: 'Badge results may be incomplete due scan/RPC issues. Try refresh.',
    });
  });

  it('keeps retry and loading flags only while uncertainty remains actionable', () => {
    expect(shouldRetryUserPageQuestionData({
      hasUncertainUserData: false,
      holdQuestionLoading: true,
      questionSection: null,
    })).toBe(false);
    expect(shouldRetryUserPageQuestionData({
      hasUncertainUserData: true,
      holdQuestionLoading: false,
      questionSection: { questionResponseInfo: [] },
    })).toBe(true);
    expect(shouldRetryUserPageQuestionData({
      hasUncertainUserData: true,
      holdQuestionLoading: false,
      questionSection: { questionResponseInfo: [{ id: 'q1' }] },
    })).toBe(false);

    expect(buildUserPageUncertaintyLoadingFlags({
      hasQuestionSources: true,
      hasSbtSources: false,
      hasSurveySources: false,
      keepQuestionLoadingDuringDeepScan: true,
      prevState: {
        hasUncertainUserData: true,
        isDeepScanning: false,
      },
      uncertainResources: new Set(['surveyResponses']),
    })).toEqual({
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

  it('merges user stats patches without creating empty updates', () => {
    expect(buildUserPageUserStatsMergePatch({
      prevUserStats: { badgesReceived: 1, surveysCreated: 2 },
      userStatsPatch: { badgesReceived: 3 },
    })).toEqual({
      badgesReceived: 3,
      surveysCreated: 2,
    });
    expect(buildUserPageUserStatsMergePatch({
      prevUserStats: { badgesReceived: 1 },
      userStatsPatch: {},
    })).toBeNull();
  });
});
