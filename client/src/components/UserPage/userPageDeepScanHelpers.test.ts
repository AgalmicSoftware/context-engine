import {
  applyUserPageBookmarkNicknameSave,
  applyUserPageBookmarkToggle,
  buildUserPageAnalysisAiOptions,
  buildUserPageAnalysisCacheEntry,
  buildUserPageAnalysisErrorStatePatch,
  buildUserPageAnalysisFingerprint,
  buildUserPageAnalysisCacheWritePayload,
  buildUserPageCacheRefreshOptions,
  buildUserPageRefreshTelemetrySignature,
  buildUserPageRefreshTelemetrySnapshot,
  buildUserPageAnalysisCreatedQuestions,
  buildUserPageAnalysisCreatedSurveys,
  buildUserPageAnalysisCandidateLogRows,
  buildUserPageAnalysisExcludeSlugSet,
  buildUserPageAnalysisElapsedStatePatch,
  buildUserPageAnalysisModalStatePatch,
  buildUserPageAnalysisQuestions,
  buildUserPageAnalysisResetStatePatch,
  buildUserPageAnalysisResultStatePatch,
  buildUserPageAnalysisSbts,
  buildUserPageAnalysisSurveys,
  buildUserPageAddressContextResetStatePatch,
  buildUserPageAiAvailabilityStatePatch,
  buildUserPageAiSessionSlugCandidates,
  buildUserPageAiSessionScopeContext,
  buildUserPageBookmarkStatusStateUpdate,
  buildUserPageBooleanTogglePatch,
  buildUserPageCacheRefreshInputSignature,
  buildUserPageCacheLoadingHoldFlags,
  buildUserPageCacheSourcePresence,
  buildUserPageCacheSourceSnapshot,
  buildUserPageCopiedStatePatch,
  buildUserPageBookmarkToggleStatePatch,
  buildUserPageDeepScanRefreshCarryPatch,
  buildUserPageDeepScanTooltipDisplayState,
  buildUserPageDeepScanProgressStatePatch,
  buildUserPageDeepScanPrioritySlugs,
  buildUserPageDeepScanTooltipInputSignature,
  buildUserPageDeriveTelemetrySnapshot,
  buildUserPageUserStatsMergePatch,
  buildUserPageDecryptableResponseField,
  buildUserPageDecryptedResponsePatch,
  buildUserPageGateAccessCacheKey,
  buildUserPageGatePendingKey,
  buildUserPageFullProfileModalStatePatch,
  buildUserPageMissingAddressCacheStatePatch,
  buildUserPageMissingAddressCacheStateUpdate,
  buildUserPageNamespaceSourceMembershipSignature,
  buildUserPageNicknameEditCancelStatePatch,
  buildUserPageNicknameEditOpenStatePatch,
  buildUserPageNicknameInputStatePatch,
  buildUserPageNicknameSaveStatePatch,
  buildUserPageNoSbtVisibleTelemetryState,
  buildUserPageProfileEditVisibility,
  buildUserPageResponseDecryptSurveyBindings,
  buildUserPageResponseSectionDeriveSignature,
  buildUserPageRenderLoadingState,
  buildUserPageCreatedQuestionWrapperClassName,
  buildUserPageHeaderBookmarkClassName,
  buildUserPageRootClassName,
  buildUserPageSbtSection,
  buildUserPageSbtSectionDeriveSignature,
  buildUserPageSectionLoadingEmptyState,
  buildUserPageSelectedTabStatePatch,
  buildUserPageSurveyExpansionTogglePatch,
  buildUserPageTooltipTargetIds,
  buildUserPageUnifiedCacheAggregateMemoKey,
  buildUserPageUncertainEmptyText,
  buildUserPageUncertaintyLoadingFlags,
  buildUserPageUsernameChangeStatePatch,
  buildUserPageUsernameEditCancelStatePatch,
  buildUserPageUsernameEditOpenStatePatch,
  buildUserPageUsernameErrorStatePatch,
  buildUserPageUsernameLoadedStatePatch,
  buildUserPageUsernameSaveStatePatch,
  buildUserPageViewAddressStatePatch,
  applyUserPageOwnershipSignal,
  cloneUserPageParsedResponsePayload,
  compareUserPageResponseRecency,
  deriveAnalysisAiContextFromSessionConfig,
  extractUserPageAnalysisAdditionalComment,
  extractUserPageAnalysisImportance,
  extractUserPageFirstDefinedValue,
  extractUserPageResponseRecency,
  extractUserPageResponseRecencyWithHints,
  formatAnalysisCacheAge,
  formatUserPageDeepScanBlockCount,
  formatUserPageDeepScanTooltipLinesFromRows,
  getActiveUserPageChainNode,
  getPrioritizedUserPageChainNodes,
  getPrioritizedUserPageNetworkCacheNodes,
  getUserPageOwnershipCountMaps,
  getUserPageGateResourceKeysToCheck,
  getUserPageErrorMessage,
  hasDisplayableUserPageResponsePayload,
  hasUserPageResponseSubmissionHints,
  inferUserPageResponseEncryptionAudience,
  inferUserPageResponseFieldEncryptionAudience,
  isBookmarkUserEntry,
  isBookmarkUserObjectForAddress,
  isBookmarkValueForAddress,
  isDisplayableUserPageResponseValue,
  isPlainAnalysisObject,
  isUserPageAdditionalFieldEncrypted,
  isUserPageAnswerFieldEncrypted,
  isUserPageEncryptedResponseField,
  isUserPageGateAccessContext,
  isUserPageResponsePayloadEncrypted,
  isUserPageSbtAggregateEntry,
  normalizeUserAnalysisResult,
  normalizeUserPageBookmarksCache,
  normalizeUserPageGateResourceKey,
  normalizeUserPageGateSlug,
  normalizeUserPageQuestionResponseInfoOrder,
  normalizeUserPageResponseField,
  normalizeUserPageSingleQuestionResponsePayload,
  normalizeUserPageSourceSlugForSignature,
  mergeUserPageQueuedCacheRefreshFlags,
  parseUserPageCachedResponsePayload,
  readBoolishUserPageTelemetryFlag,
  readUserPageCacheSourcePresence,
  readUserPageCacheSourceSnapshot,
  readUserPageNamespaceSourceEntries,
  readUserPageOwnershipCount,
  readUserPageAnalysisCacheEntry,
  readUserPageDirectNetworkCacheBucket,
  readUserPageNetworkCache,
  resolveUserPageAnalysisAiContext,
  resolveUserPageAnalysisCacheStatusState,
  resolveUserPageAnalysisModalDisplayState,
  resolveUserPageAnalysisSessionConfigForSlug,
  resolveUserPageAnalysisSessionFallback,
  resolveUserPageAddressContextChange,
  resolveUserPageAddressDisplayState,
  resolveUserPageAiActionAvailability,
  resolveUserPageAiAvailabilityRefresh,
  resolveUserPageAnalyzeButtonDisplayState,
  resolveUserPageAvatarDisplayState,
  resolveUserPageBlockieSeed,
  hasMeaningfulUserPageOwnershipCounts,
  resolveUserPageBookmarkButtonDisplayState,
  resolveUserPageBookmarkNickname,
  resolveUserPageBookmarkStatus,
  resolveUserPageBookmarksLinkDisplayState,
  resolveUserPageCompareButtonDisplayState,
  resolveUserPageInlineEnteredIndicatorDisplayState,
  resolveUserPageCopyIconDisplayState,
  resolveUserPageCacheUpdateRefresh,
  resolveUserPageManagedCacheUpdate,
  resolveUserPageDeepScanSessionDisplayConfig,
  resolveUserPageFullProfileModalDisplayState,
  resolveUserPageHeaderActionVisibility,
  resolveUserPageQuestionSectionDisplayState,
  resolveUserPageQuestionPromptText,
  resolveUserPageQuestionSourceSessionSlug,
  resolveUserPageSectionToggleDisplayState,
  resolveUserPageSbtDisplayState,
  resolveUserPageSurveyCountDisplayState,
  resolveUserPageSurveyCreatedCardState,
  resolveUserPageSurveyPreviewDisplayState,
  resolveUserPageSurveyResponseCardState,
  resolveUserPageSurveySectionDisplayState,
  resolveUserPageUsernameErrorDisplayState,
  resolveUserPageResponseNonceRefresh,
  shortenUserPageQuestionId,
  shouldRetryUserPageQuestionData,
  sortUserAnalysisKeys,
  toAnalysisCacheBucket,
  toAnalysisRecord,
  upsertUserPageResponseByRecency,
  writeUserPageResponseSourceSlug,
  writeUserPageSourceSlug,
  type UserPageDeepScanProgressRow,
  applyUserPageDecryptedPatchToResponseField,
} from './userPageHelpers';

const makeRow = (overrides: Partial<UserPageDeepScanProgressRow> = {}): UserPageDeepScanProgressRow => ({
  slug: 'alpha',
  chainId: 84532,
  lastBlockScanned: 1000,
  latestBlock: 1200,
  remainingBlocks: 200,
  percentComplete: 50,
  isDeterminate: true,
  label: 'Alpha',
  startBlock: 800,
  displayLastBlock: 1000,
  ...overrides,
});

describe('userPageDeepScanHelpers', () => {
  it('formats deep-scan block counts and tooltip lines', () => {
    expect(formatUserPageDeepScanBlockCount(12345.9)).toBe('12,345');
    expect(formatUserPageDeepScanBlockCount(-5)).toBe('0');
    expect(formatUserPageDeepScanBlockCount('bad')).toBe('0');

    expect(
      formatUserPageDeepScanTooltipLinesFromRows([
        makeRow({ label: 'Alpha Session', remainingBlocks: 99 }),
        makeRow({
          label: 'Beta Session',
          latestBlock: null,
          lastBlockScanned: 3210,
          remainingBlocks: null,
        }),
      ]),
    ).toEqual(['Session: Alpha Session', 'Up to date', '', 'Session: Beta Session', '3,210 scanned']);
    expect(formatUserPageDeepScanTooltipLinesFromRows([])).toBeNull();

    expect(buildUserPageDeepScanTooltipDisplayState()).toEqual({
      deepScanTooltipContent: null,
      deepScanTooltipText: '',
      deepScanTooltipTitle: '',
    });
    expect(
      buildUserPageDeepScanTooltipDisplayState({
        isDeepScanning: true,
      }),
    ).toEqual({
      deepScanTooltipContent: ['Deep scan in progress...'],
      deepScanTooltipText: 'Deep scan in progress...',
      deepScanTooltipTitle: 'Deep scan: Deep scan in progress...',
    });
    expect(
      buildUserPageDeepScanTooltipDisplayState({
        deepScanTooltipLines: ['Alpha', '', ' Beta '],
      }),
    ).toEqual({
      deepScanTooltipContent: ['Alpha', '', ' Beta '],
      deepScanTooltipText: 'Alpha |  Beta ',
      deepScanTooltipTitle: 'Deep scan: Alpha |  Beta ',
    });
    expect(
      buildUserPageDeepScanTooltipDisplayState({
        deepScanProgressRows: [makeRow({ label: 'Gamma' })],
        fallbackLine: 'Scanning...',
      }),
    ).toEqual({
      deepScanTooltipContent: ['Scanning...'],
      deepScanTooltipText: 'Scanning...',
      deepScanTooltipTitle: 'Deep scan: Scanning...',
    });
    expect(
      buildUserPageDeepScanTooltipDisplayState({
        deepScanTooltipLines: [],
        isDeepScanning: true,
      }),
    ).toEqual({
      deepScanTooltipContent: [],
      deepScanTooltipText: '',
      deepScanTooltipTitle: '',
    });
  });

  it('builds section loading-empty state from cache and deep-scan readiness flags', () => {
    const loadingState = buildUserPageRenderLoadingState({
      isDeepScanLoadingEnabledForSection: (section) => section === 'surveys',
      isDeepScanning: true,
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isSBTCacheReady: true,
      isSurveyCacheReady: true,
      loadingQuestions: false,
      loadingSBTs: false,
      loadingSurveys: false,
    });
    expect(loadingState).toMatchObject({
      disabledByCache: false,
      isQuestionLoadingAny: false,
      isQuestionReady: true,
      isResponsesReady: true,
      isSBTReady: true,
      isSbtLoadingAny: true,
      isSurveyLoadingAny: true,
      isSurveyReady: true,
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
      resolveUserPageAiActionAvailability({
        aiAvailable: true,
        disabledByCache: false,
      }),
    ).toEqual({
      disabled: false,
      title: undefined,
    });
    expect(
      resolveUserPageAnalyzeButtonDisplayState({
        aiActionAvailability: { disabled: false },
        analyzing: false,
      }),
    ).toEqual({
      ariaBusy: 'false',
      disabled: false,
      label: 'Analyze',
      shouldRenderAnalyzing: false,
      title: undefined,
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
        aiActionAvailability: { disabled: true, title: 'Wait' },
        collapseOpen: true,
      }),
    ).toEqual({
      disabled: true,
      shouldRenderCollapseClosedIcon: false,
      shouldRenderCollapseOpenIcon: true,
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
    expect(resolveUserPageSectionToggleDisplayState({ open: false })).toEqual({
      isOpen: false,
      shouldRenderClosedIcon: true,
      shouldRenderOpenIcon: false,
    });

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
        loadingQuestions: false,
        loadingSurveys: false,
        questionCreationInfo: [],
        questionDeepScanLoadingActive: true,
        questionResponseInfo: [],
        sbtList: [],
        surveyCreationInfo: [],
        surveyDeepScanLoadingActive: true,
        surveyResponseInfo: [],
      }),
    ).toEqual({
      questionResponsesLoadingEmpty: true,
      questionsCreatedLoadingEmpty: true,
      sbtSectionLoadingEmpty: true,
      surveyResponsesLoadingEmpty: true,
      surveysCreatedLoadingEmpty: true,
    });
    expect(
      buildUserPageSectionLoadingEmptyState({
        isQuestionLoadingAny: true,
        isQuestionReady: false,
        isSbtLoadingAny: true,
        isSurveyLoadingAny: true,
        isSurveyReady: false,
        loadingQuestions: true,
        loadingSurveys: true,
        questionCreationInfo: [{}],
        questionResponseInfo: [{}],
        sbtList: [{}],
        surveyCreationInfo: [{}],
        surveyResponseInfo: [{}],
      }),
    ).toEqual({
      questionResponsesLoadingEmpty: false,
      questionsCreatedLoadingEmpty: false,
      sbtSectionLoadingEmpty: false,
      surveyResponsesLoadingEmpty: false,
      surveysCreatedLoadingEmpty: false,
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
    expect(
      buildUserPageUncertainEmptyText({
        hasUncertainSbtData: false,
        hasUncertainUserData: false,
        sbtsLowerLabel: 'badges',
      }),
    ).toEqual({
      questionResponsesEmptyText: 'No question responses found.',
      sbtEmptyText: 'No badges found.',
    });
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
        holdQuestionLoading: true,
        questionSection: { questionResponseInfo: [{ id: 'q1' }] },
      }),
    ).toBe(true);
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
        keepSurveyLoadingDuringDeepScan: false,
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
    expect(
      buildUserPageUncertaintyLoadingFlags({
        hasQuestionSources: true,
        hasSbtSources: true,
        hasSurveySources: true,
        prevState: {
          hasUncertainUserData: false,
          isDeepScanning: true,
        },
        uncertainResources: new Set(['questionResponses']),
      }),
    ).toMatchObject({
      hasGateUncertainty: true,
      hasQuestionGateUncertainty: true,
      hasSurveyGateUncertainty: false,
      keepQuestionLoadingFromUserUncertainty: false,
      keepSbtLoadingFromUserUncertainty: false,
      keepSurveyLoadingFromUserUncertainty: false,
      preserveUserDataUncertainty: false,
    });
    expect(
      buildUserPageDeepScanRefreshCarryPatch({
        deepScanProgressRows: [{ slug: 'alpha' }],
        deepScanTooltipLines: ['line-a'],
        prevState: {},
      }),
    ).toEqual({
      deepScanProgressRows: [{ slug: 'alpha' }],
      deepScanTooltipLines: ['line-a'],
    });
    expect(
      buildUserPageDeepScanRefreshCarryPatch({
        prevState: {
          deepScanProgressRows: [{ slug: 'old' }],
          deepScanTooltipLines: ['old-line'],
        },
      }),
    ).toEqual({
      deepScanProgressRows: null,
      deepScanTooltipLines: null,
    });
    expect(
      buildUserPageDeepScanRefreshCarryPatch({
        prevState: {
          deepScanProgressRows: [],
          deepScanTooltipLines: [],
        },
      }),
    ).toEqual({});
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

  it('builds deep-scan tooltip input signatures from cache progress', () => {
    const viewAddress = '0x00000000000000000000000000000000000000AA';
    const viewLower = viewAddress.toLowerCase();
    const peekCache = jest.fn((namespace: string, slug: string) => ({
      [viewLower]: {
        '84532': {
          lastBlockScanned: slug === '' ? 10 : 12,
          lastScanTimestamp: slug === '' ? 1 : 2,
        },
      },
    }));

    expect(buildUserPageDeepScanTooltipInputSignature({
      latestBlockNumber: 120,
      listNamespaceSlugs: () => ['edge', ''],
      network: { id: 84532 },
      peekCache,
      viewAddress,
    })).toBe(`${viewLower}|84532|120|:84532:10;edge:84532:12`);
    expect(peekCache).toHaveBeenCalledWith('userCache', '', { clone: false });
    expect(
      buildUserPageDeepScanTooltipInputSignature({
        viewAddress: '',
      }),
    ).toBe('');
    expect(
      buildUserPageDeepScanTooltipInputSignature({
        latestBlockNumber: 'bad',
        listNamespaceSlugs: () => ['edge'],
        network: { id: 'bad' },
        peekCache: () => ({}),
        viewAddress,
      }),
    ).toBe(`${viewLower}|NaN||edge:`);
  });

  it('builds deep-scan priority slugs from scan scope settings', () => {
    const getAllowedSessionSlugs = jest.fn((_scope: string, slugs: unknown[]) => slugs);

    expect(
      buildUserPageDeepScanPrioritySlugs({
        activeSessionSlug: 'primary-session',
        getAllowedSessionSlugs,
        readSessionScanScope: () => 'list',
        readSessionScanSlugs: () => ['', 'edge', 'primary-session', 'edge'],
      }),
    ).toEqual(['', 'edge', 'primary-session']);
    expect(
      buildUserPageDeepScanPrioritySlugs({
        activeSessionSlug: 'primary-session',
        getAllowedSessionSlugs,
        readSessionScanScope: () => 'list',
        readSessionScanSlugs: () => ['', 'edge'],
      }),
    ).toEqual(['primary-session', '', 'edge']);
    expect(
      buildUserPageDeepScanPrioritySlugs({
        activeSessionSlug: 'primary-session',
        getAllowedSessionSlugs,
        readSessionScanScope: () => 'active',
        readSessionScanSlugs: () => ['ignored'],
      }),
    ).toEqual(['primary-session', 'ignored']);
    expect(
      buildUserPageDeepScanPrioritySlugs({
        activeSessionSlug: '',
        getAllowedSessionSlugs,
        readSessionScanScope: () => 'active',
        readSessionScanSlugs: () => ['ignored'],
      }),
    ).toEqual([]);
  });

  it('resolves deep-scan session display config with default and demo fallbacks', () => {
    const getSessionConfigBySlug = jest.fn((slug: string) => (slug === 'edge' ? { sessionName: 'Edge' } : null));
    const getSessionConfigBySlugOrDefault = jest.fn(() => ({ sessionName: 'General' }));
    const getDemoSessionConfigBySlug = jest.fn((slug: string) => (slug === 'demo' ? { sessionName: 'Demo' } : null));

    expect(
      resolveUserPageDeepScanSessionDisplayConfig({
        getDemoSessionConfigBySlug,
        getSessionConfigBySlug,
        getSessionConfigBySlugOrDefault,
        slugIn: '',
      }),
    ).toEqual({ sessionName: 'General' });
    expect(getSessionConfigBySlugOrDefault).toHaveBeenCalledWith('');
    expect(
      resolveUserPageDeepScanSessionDisplayConfig({
        getDemoSessionConfigBySlug,
        getSessionConfigBySlug,
        getSessionConfigBySlugOrDefault,
        slugIn: 'edge',
      }),
    ).toEqual({ sessionName: 'Edge' });
    expect(
      resolveUserPageDeepScanSessionDisplayConfig({
        getDemoSessionConfigBySlug,
        getSessionConfigBySlug,
        getSessionConfigBySlugOrDefault,
        slugIn: 'demo',
      }),
    ).toEqual({ sessionName: 'Demo' });
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('demo', { allowDemoFallback: true });
    expect(
      resolveUserPageDeepScanSessionDisplayConfig({
        getDemoSessionConfigBySlug: () => 'bad',
        getSessionConfigBySlug: () => null,
        slugIn: 'missing',
      }),
    ).toBeNull();
  });
});
