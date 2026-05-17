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
  buildUserPageDeepScanTooltipOutputSignature,
  buildUserPageDeepScanProgressStatePatch,
  buildUserPageDeepScanProgressRow,
  buildUserPageDeepScanProgressRowDisplayState,
  buildUserPageDeepScanProgressRowsSignature,
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
  deriveUserPageDeepScanProgressRows,
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
  normalizeUserPageDeepScanProgressRows,
  normalizeUserPageDeepScanTooltipLines,
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
  resolveUserPageDeepScanProgressStateUpdate,
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
  sortUserPageDeepScanProgressRows,
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

    expect(formatUserPageDeepScanTooltipLinesFromRows([
      makeRow({ label: 'Alpha Session', remainingBlocks: 99 }),
      makeRow({
        label: 'Beta Session',
        latestBlock: null,
        lastBlockScanned: 3210,
        remainingBlocks: null,
      }),
    ])).toEqual([
      'Session: Alpha Session',
      'Up to date',
      '',
      'Session: Beta Session',
      '3,210 scanned',
    ]);
    expect(formatUserPageDeepScanTooltipLinesFromRows([])).toBeNull();

    expect(buildUserPageDeepScanTooltipDisplayState()).toEqual({
      deepScanTooltipContent: null,
      deepScanTooltipText: '',
      deepScanTooltipTitle: '',
    });
    expect(buildUserPageDeepScanTooltipDisplayState({
      isDeepScanning: true,
    })).toEqual({
      deepScanTooltipContent: ['Deep scan in progress...'],
      deepScanTooltipText: 'Deep scan in progress...',
      deepScanTooltipTitle: 'Deep scan: Deep scan in progress...',
    });
    expect(buildUserPageDeepScanTooltipDisplayState({
      deepScanTooltipLines: ['Alpha', '', ' Beta '],
    })).toEqual({
      deepScanTooltipContent: ['Alpha', '', ' Beta '],
      deepScanTooltipText: 'Alpha |  Beta ',
      deepScanTooltipTitle: 'Deep scan: Alpha |  Beta ',
    });
    expect(buildUserPageDeepScanTooltipDisplayState({
      deepScanProgressRows: [makeRow({ label: 'Gamma' })],
      fallbackLine: 'Scanning...',
    })).toEqual({
      deepScanTooltipContent: ['Scanning...'],
      deepScanTooltipText: 'Scanning...',
      deepScanTooltipTitle: 'Deep scan: Scanning...',
    });
    expect(buildUserPageDeepScanTooltipDisplayState({
      deepScanTooltipLines: [],
      isDeepScanning: true,
    })).toEqual({
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
    expect(resolveUserPageAiActionAvailability({
      aiAvailable: true,
      disabledByCache: false,
    })).toEqual({
      disabled: false,
      title: undefined,
    });
    expect(resolveUserPageAnalyzeButtonDisplayState({
      aiActionAvailability: { disabled: false },
      analyzing: false,
    })).toEqual({
      ariaBusy: 'false',
      disabled: false,
      label: 'Analyze',
      shouldRenderAnalyzing: false,
      title: undefined,
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
      aiActionAvailability: { disabled: true, title: 'Wait' },
      collapseOpen: true,
    })).toEqual({
      disabled: true,
      shouldRenderCollapseClosedIcon: false,
      shouldRenderCollapseOpenIcon: true,
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
    expect(buildUserPageSectionLoadingEmptyState({
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
    })).toEqual({
      questionResponsesLoadingEmpty: true,
      questionsCreatedLoadingEmpty: true,
      sbtSectionLoadingEmpty: true,
      surveyResponsesLoadingEmpty: true,
      surveysCreatedLoadingEmpty: true,
    });
    expect(buildUserPageSectionLoadingEmptyState({
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
    })).toEqual({
      questionResponsesLoadingEmpty: false,
      questionsCreatedLoadingEmpty: false,
      sbtSectionLoadingEmpty: false,
      surveyResponsesLoadingEmpty: false,
      surveysCreatedLoadingEmpty: false,
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
    expect(buildUserPageUncertainEmptyText({
      hasUncertainSbtData: false,
      hasUncertainUserData: false,
      sbtsLowerLabel: 'badges',
    })).toEqual({
      questionResponsesEmptyText: 'No question responses found.',
      sbtEmptyText: 'No badges found.',
    });
    expect(shouldRetryUserPageQuestionData({
      hasUncertainUserData: false,
      holdQuestionLoading: true,
      questionSection: null,
    })).toBe(false);
    expect(shouldRetryUserPageQuestionData({
      hasUncertainUserData: true,
      holdQuestionLoading: true,
      questionSection: { questionResponseInfo: [{ id: 'q1' }] },
    })).toBe(true);
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
      keepSurveyLoadingDuringDeepScan: false,
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
    expect(buildUserPageUncertaintyLoadingFlags({
      hasQuestionSources: true,
      hasSbtSources: true,
      hasSurveySources: true,
      prevState: {
        hasUncertainUserData: false,
        isDeepScanning: true,
      },
      uncertainResources: new Set(['questionResponses']),
    })).toMatchObject({
      hasGateUncertainty: true,
      hasQuestionGateUncertainty: true,
      hasSurveyGateUncertainty: false,
      keepQuestionLoadingFromUserUncertainty: false,
      keepSbtLoadingFromUserUncertainty: false,
      keepSurveyLoadingFromUserUncertainty: false,
      preserveUserDataUncertainty: false,
    });
    expect(buildUserPageDeepScanRefreshCarryPatch({
      deepScanProgressRows: [{ slug: 'alpha' }],
      deepScanTooltipLines: ['line-a'],
      prevState: {},
    })).toEqual({
      deepScanProgressRows: [{ slug: 'alpha' }],
      deepScanTooltipLines: ['line-a'],
    });
    expect(buildUserPageDeepScanRefreshCarryPatch({
      prevState: {
        deepScanProgressRows: [{ slug: 'old' }],
        deepScanTooltipLines: ['old-line'],
      },
    })).toEqual({
      deepScanProgressRows: null,
      deepScanTooltipLines: null,
    });
    expect(buildUserPageDeepScanRefreshCarryPatch({
      prevState: {
        deepScanProgressRows: [],
        deepScanTooltipLines: [],
      },
    })).toEqual({});
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
    })).toBe(`${viewLower}|84532|120|:84532:10:1;edge:84532:12:2`);
    expect(peekCache).toHaveBeenCalledWith('userCache', '', { clone: false });
    expect(buildUserPageDeepScanTooltipInputSignature({
      viewAddress: '',
    })).toBe('');
    expect(buildUserPageDeepScanTooltipInputSignature({
      latestBlockNumber: 'bad',
      listNamespaceSlugs: () => ['edge'],
      network: { id: 'bad' },
      peekCache: () => ({}),
      viewAddress,
    })).toBe(`${viewLower}|NaN||edge:`);
  });

  it('builds deep-scan priority slugs from scan scope settings', () => {
    const getAllowedSessionSlugs = jest.fn((_scope: string, slugs: unknown[]) => slugs);

    expect(buildUserPageDeepScanPrioritySlugs({
      activeSessionSlug: 'primary-session',
      getAllowedSessionSlugs,
      readSessionScanScope: () => 'list',
      readSessionScanSlugs: () => ['', 'edge', 'primary-session', 'edge'],
    })).toEqual(['', 'edge', 'primary-session']);
    expect(buildUserPageDeepScanPrioritySlugs({
      activeSessionSlug: 'primary-session',
      getAllowedSessionSlugs,
      readSessionScanScope: () => 'list',
      readSessionScanSlugs: () => ['', 'edge'],
    })).toEqual(['primary-session', '', 'edge']);
    expect(buildUserPageDeepScanPrioritySlugs({
      activeSessionSlug: 'primary-session',
      getAllowedSessionSlugs,
      readSessionScanScope: () => 'active',
      readSessionScanSlugs: () => ['ignored'],
    })).toEqual(['primary-session', 'ignored']);
    expect(buildUserPageDeepScanPrioritySlugs({
      activeSessionSlug: '',
      getAllowedSessionSlugs,
      readSessionScanScope: () => 'active',
      readSessionScanSlugs: () => ['ignored'],
    })).toEqual([]);
  });

  it('resolves deep-scan session display config with default and demo fallbacks', () => {
    const getSessionConfigBySlug = jest.fn((slug: string) => (
      slug === 'edge' ? { sessionName: 'Edge' } : null
    ));
    const getSessionConfigBySlugOrDefault = jest.fn(() => ({ sessionName: 'General' }));
    const getDemoSessionConfigBySlug = jest.fn((slug: string) => (
      slug === 'demo' ? { sessionName: 'Demo' } : null
    ));

    expect(resolveUserPageDeepScanSessionDisplayConfig({
      getDemoSessionConfigBySlug,
      getSessionConfigBySlug,
      getSessionConfigBySlugOrDefault,
      slugIn: '',
    })).toEqual({ sessionName: 'General' });
    expect(getSessionConfigBySlugOrDefault).toHaveBeenCalledWith('');
    expect(resolveUserPageDeepScanSessionDisplayConfig({
      getDemoSessionConfigBySlug,
      getSessionConfigBySlug,
      getSessionConfigBySlugOrDefault,
      slugIn: 'edge',
    })).toEqual({ sessionName: 'Edge' });
    expect(resolveUserPageDeepScanSessionDisplayConfig({
      getDemoSessionConfigBySlug,
      getSessionConfigBySlug,
      getSessionConfigBySlugOrDefault,
      slugIn: 'demo',
    })).toEqual({ sessionName: 'Demo' });
    expect(getDemoSessionConfigBySlug).toHaveBeenCalledWith('demo', { allowDemoFallback: true });
    expect(resolveUserPageDeepScanSessionDisplayConfig({
      getDemoSessionConfigBySlug: () => 'bad',
      getSessionConfigBySlug: () => null,
      slugIn: 'missing',
    })).toBeNull();
  });

  it('sorts deep-scan rows by priority, attention, recency, label, and chain', () => {
    const rows = [
      makeRow({ slug: 'beta', label: 'Beta', lastBlockScanned: 900, remainingBlocks: 0 }),
      makeRow({ slug: 'alpha', label: 'Alpha', lastBlockScanned: 700, remainingBlocks: 500 }),
      makeRow({ slug: 'gamma', label: 'Gamma', lastBlockScanned: 1200, latestBlock: null, remainingBlocks: null }),
      makeRow({ slug: 'beta', label: 'Beta B', chainId: 10, lastBlockScanned: 900, remainingBlocks: 0 }),
    ];

    expect(sortUserPageDeepScanProgressRows(rows, ['beta', 'alpha'])?.map((row) => row.label)).toEqual([
      'Beta',
      'Beta B',
      'Alpha',
      'Gamma',
    ]);
    expect(sortUserPageDeepScanProgressRows([], ['beta'])).toBeNull();
  });

  it('builds deep-scan rows with display labels and determinate progress', () => {
    const determinateRow = buildUserPageDeepScanProgressRow({
      slug: 'edge-session',
      chainId: 11155420,
      lastBlock: 125,
      latestBlock: 200,
      startBlock: 100,
      sessionConfig: { sessionName: 'Edge Session' },
      slugHasMultipleNetworks: true,
    });
    expect(determinateRow).toEqual({
      slug: 'edge-session',
      chainId: 11155420,
      lastBlockScanned: 125,
      latestBlock: 200,
      remainingBlocks: 75,
      percentComplete: 25,
      isDeterminate: true,
      label: 'Edge Session (edge-session) (chain 11155420)',
      startBlock: 100,
      displayLastBlock: 125,
    });
    expect(buildUserPageDeepScanProgressRowDisplayState({
      index: 2,
      row: determinateRow,
    })).toEqual({
      indeterminateText: '125 scanned',
      progressFillStyle: { width: '25%' },
      progressWidth: '25%',
      remainingText: '75 blocks remaining',
      rowKey: 'edge-session_11155420_2',
      scannedText: '125 / 200 scanned',
      shouldRenderScannedText: true,
    });

    const indeterminateRow = buildUserPageDeepScanProgressRow({
      slug: '',
      chainId: null,
      lastBlock: '50',
      latestBlock: null,
      sessionConfig: { sessionName: 'general' },
      startBlock: null,
    });
    expect(indeterminateRow).toMatchObject({
      slug: 'general',
      label: 'general',
      lastBlockScanned: 50,
      latestBlock: null,
      remainingBlocks: null,
      percentComplete: null,
      isDeterminate: false,
    });
    expect(buildUserPageDeepScanProgressRowDisplayState({
      row: indeterminateRow,
      showScannedText: false,
    })).toMatchObject({
      indeterminateText: 'Syncing... latest block pending',
      progressFillStyle: { width: '0%' },
      progressWidth: '0%',
      remainingText: 'Up to date',
      rowKey: 'general_na_0',
      scannedText: '',
      shouldRenderScannedText: false,
    });
  });

  it('derives deep-scan progress rows from user cache entries', () => {
    const viewAddress = '0x00000000000000000000000000000000000000AA';
    const viewLower = viewAddress.toLowerCase();
    const getSessionDisplayConfig = jest.fn((slug: string) => (
      slug === 'edge-session'
        ? { sessionName: 'Edge Session', blockLimits: { start: 100 } }
        : null
    ));

    const rows = deriveUserPageDeepScanProgressRows({
      currentChainId: 84532,
      getSessionDisplayConfig,
      latestBlockNum: 200,
      prioritySlugs: ['edge-session'],
      userCaches: [
        {
          slug: 'edge-session',
          data: {
            [viewLower]: {
              '84532': { lastBlockScanned: 125 },
              '10': { lastBlockScanned: 80 },
              bad: { lastBlockScanned: 0 },
            },
          },
        },
      ],
      viewLower,
    });

    expect(rows).toEqual([
      {
        slug: 'edge-session',
        chainId: 84532,
        lastBlockScanned: 125,
        latestBlock: 200,
        remainingBlocks: 75,
        percentComplete: 25,
        isDeterminate: true,
        label: 'Edge Session (edge-session) (chain 84532)',
        startBlock: 100,
        displayLastBlock: 125,
      },
      {
        slug: 'edge-session',
        chainId: 10,
        lastBlockScanned: 80,
        latestBlock: null,
        remainingBlocks: null,
        percentComplete: null,
        isDeterminate: false,
        label: 'Edge Session (edge-session) (chain 10)',
        startBlock: 100,
        displayLastBlock: 100,
      },
    ]);
    expect(getSessionDisplayConfig).toHaveBeenCalledTimes(1);
    expect(deriveUserPageDeepScanProgressRows({ userCaches: [], viewLower })).toBeNull();
  });

  it('builds deep-scan row signatures from progress fields', () => {
    expect(buildUserPageDeepScanProgressRowsSignature([
      makeRow({ label: 'Alpha Session' }),
    ])).toBe('alpha:84532:1000:1200:200:50:1:Alpha Session');
    expect(buildUserPageDeepScanProgressRowsSignature(null)).toBe('');
    expect(buildUserPageDeepScanTooltipOutputSignature({
      deepScanTooltipLines: ['Alpha', 'Beta'],
      deepScanProgressRows: [makeRow({ label: 'Alpha Session' })],
    })).toBe('Alpha|Beta||alpha:84532:1000:1200:200:50:1:Alpha Session');
    expect(buildUserPageDeepScanTooltipOutputSignature({
      deepScanTooltipLines: null,
      deepScanProgressRows: null,
    })).toBe('||');
    expect(resolveUserPageDeepScanProgressStateUpdate({
      currentDeepScanProgressRows: [makeRow({ label: 'Alpha Session' })],
      currentDeepScanTooltipLines: ['Alpha', 'Beta'],
      nextDeepScanProgressRows: [makeRow({ label: 'Alpha Session' })],
      nextDeepScanTooltipLines: ['Alpha', 'Beta'],
    })).toEqual({
      nextOutputSignature: 'Alpha|Beta||alpha:84532:1000:1200:200:50:1:Alpha Session',
      shouldUpdate: false,
    });
    expect(resolveUserPageDeepScanProgressStateUpdate({
      currentDeepScanProgressRows: [makeRow({ label: 'Alpha Session' })],
      currentDeepScanTooltipLines: ['Alpha'],
      nextDeepScanProgressRows: [makeRow({ label: 'Beta Session', remainingBlocks: 150 })],
      nextDeepScanTooltipLines: ['Beta'],
    })).toEqual({
      nextOutputSignature: 'Beta||alpha:84532:1000:1200:150:50:1:Beta Session',
      shouldUpdate: true,
    });
    expect(normalizeUserPageDeepScanTooltipLines(['Alpha', 2])).toEqual(['Alpha', '2']);
    expect(normalizeUserPageDeepScanTooltipLines([])).toBeNull();
    expect(normalizeUserPageDeepScanProgressRows([makeRow({ label: 'Alpha Session' })])).toEqual([
      makeRow({ label: 'Alpha Session' }),
    ]);
    expect(normalizeUserPageDeepScanProgressRows([])).toBeNull();
  });
});
