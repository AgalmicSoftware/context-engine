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
  buildUserPageDeepScanReportSignature,
  buildUserPageDeepScanReportSamples,
  buildUserPageDeepScanReportStatus,
  buildUserPageDeepScanReportStatePatch,
  buildUserPageDeepScanReportTelemetryPayloads,
  buildUserPageDeepScanRefreshCarryPatch,
  buildUserPageDeepScanTooltipDisplayState,
  buildUserPageDeepScanTooltipOutputSignature,
  buildUserPageDeepScanProgressStatePatch,
  buildUserPageDeepScanProgressRow,
  buildUserPageDeepScanProgressRowDisplayState,
  buildUserPageDeepScanProgressRowsSignature,
  buildUserPageDeepScanPrioritySlugs,
  buildUserPageDeepScanRequestStatePatch,
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
  shouldApplyUserPageDeepScanResponse,
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

// User page helper coverage for analysis result state, cache refresh telemetry, AI availability, and address reset helpers.
describe('userPage analysis refresh helpers', () => {
  it('normalizes user analysis results and fallback fields', () => {
    expect(
      normalizeUserAnalysisResult({
        name: 'Analysis',
        summary: 'Summary',
        details: 'Details',
        historicalAlignment: {
          figure: 'Ada',
          reasoning: 'Pattern match',
        },
      }),
    ).toEqual({
      name: 'Analysis',
      summary: 'Summary',
      details: 'Details',
      historicalAlignment: {
        figure: 'Ada',
        reasoning: 'Pattern match',
      },
    });

    expect(normalizeUserAnalysisResult(null)).toEqual({
      name: 'User Analysis',
      summary: '',
      details: '',
      historicalAlignment: {
        figure: '',
        reasoning: '',
      },
    });
    expect(
      buildUserPageAnalysisResultStatePatch({
        cachedAt: '1710000000000',
        includeElapsed: true,
        includeError: true,
        includeModal: true,
        result: {
          name: 'Cached',
          summary: 'Summary',
          details: 'Details',
          historicalAlignment: {
            figure: 'Ada',
            reasoning: 'Reason',
          },
        },
        servedFromCache: true,
      }),
    ).toEqual({
      showAnalysisModal: true,
      aiAnalysis: 'Summary',
      analysisDetails: 'Details',
      analysisName: 'Cached',
      analysisHistoricalFigure: 'Ada',
      analysisHistoricalReasoning: 'Reason',
      analysisElapsedMs: 0,
      analysisError: '',
      analyzing: false,
      analysisServedFromCache: true,
      analysisCachedAt: 1710000000000,
    });
    expect(
      buildUserPageAnalysisResultStatePatch({
        result: null,
      }),
    ).toEqual({
      aiAnalysis: '',
      analysisDetails: '',
      analysisName: 'User Analysis',
      analysisHistoricalFigure: '',
      analysisHistoricalReasoning: '',
      analyzing: false,
      analysisServedFromCache: false,
      analysisCachedAt: null,
    });
    expect(buildUserPageAnalysisResetStatePatch({ analyzing: true })).toEqual({
      showAnalysisModal: true,
      analyzing: true,
      analysisError: '',
      aiAnalysis: '',
      analysisDetails: '',
      analysisName: '',
      analysisElapsedMs: 0,
      analysisHistoricalFigure: '',
      analysisHistoricalReasoning: '',
      analysisServedFromCache: false,
      analysisCachedAt: null,
    });
    expect(buildUserPageAnalysisResetStatePatch({ analyzing: 'yes' }).analyzing).toBe(false);
    expect(buildUserPageAnalysisModalStatePatch({ open: true })).toEqual({
      showAnalysisModal: true,
    });
    expect(buildUserPageAnalysisModalStatePatch({ open: 1 })).toEqual({
      showAnalysisModal: false,
    });
    expect(buildUserPageFullProfileModalStatePatch({ open: true })).toEqual({
      showFullProfileModal: true,
    });
    expect(buildUserPageFullProfileModalStatePatch({ open: 'true' })).toEqual({
      showFullProfileModal: false,
    });
    expect(buildUserPageCopiedStatePatch({ copied: true })).toEqual({
      copied: true,
    });
    expect(buildUserPageCopiedStatePatch({ copied: 1 })).toEqual({
      copied: false,
    });
    expect(resolveUserPageCopyIconDisplayState({ copied: true })).toEqual({
      copiedIconStyle: { display: 'inline' },
      defaultIconStyle: { display: 'none' },
    });
    expect(resolveUserPageCopyIconDisplayState({ copied: false })).toEqual({
      copiedIconStyle: { display: 'none' },
      defaultIconStyle: { display: 'inline' },
    });
    expect(resolveUserPageBookmarkButtonDisplayState({ bookmarked: true })).toEqual({
      ariaLabel: 'Remove bookmark',
      iconStyle: { color: 'yellow' },
      title: 'Remove bookmark',
    });
    expect(resolveUserPageBookmarkButtonDisplayState({ bookmarked: false })).toEqual({
      ariaLabel: 'Bookmark user',
      iconStyle: { color: undefined },
      title: 'Bookmark user',
    });
    expect(
      buildUserPageRootClassName({
        baseClassName: 'user-page',
        minimized: false,
        minimizedClassName: 'minimized',
      }),
    ).toBe('user-page');
    expect(
      buildUserPageRootClassName({
        baseClassName: 'user-page',
        minimized: true,
        minimizedClassName: 'minimized',
      }),
    ).toBe('user-page minimized');
    expect(
      buildUserPageHeaderBookmarkClassName({
        baseClassName: 'bookmark-button',
        headerClassName: 'header-bookmark',
      }),
    ).toBe('bookmark-button header-bookmark');
    expect(
      buildUserPageCreatedQuestionWrapperClassName({
        baseClassName: 'created-question',
        bolderClassName: 'created-question-bolder',
      }),
    ).toBe('created-question created-question-bolder');
    expect(resolveUserPageAvatarDisplayState({ blockieUrl: 'data:image/png;base64,abc' })).toEqual({
      avatarStyle: {
        backgroundImage: 'url(data:image/png;base64,abc)',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      },
    });
    expect(
      resolveUserPageBookmarksLinkDisplayState({
        baseClassName: 'bookmarks-link',
        inlineClassName: 'bookmarks-link-inline',
      }),
    ).toEqual({
      className: 'bookmarks-link bookmarks-link-inline',
      style: { marginLeft: '12px' },
    });
    expect(resolveUserPageInlineEnteredIndicatorDisplayState({ value: 'Alpha' })).toEqual({
      shouldRenderEnteredIndicator: true,
    });
    expect(resolveUserPageInlineEnteredIndicatorDisplayState({ value: '' })).toEqual({
      shouldRenderEnteredIndicator: false,
    });
    expect(resolveUserPageInlineEnteredIndicatorDisplayState({ value: 0 })).toEqual({
      shouldRenderEnteredIndicator: false,
    });
    expect(buildUserPageNicknameEditOpenStatePatch()).toEqual({
      isEditingNickname: true,
    });
    expect(buildUserPageNicknameEditCancelStatePatch({ nicknameInput: ' Cached ' })).toEqual({
      isEditingNickname: false,
      nicknameInput: ' Cached ',
    });
    expect(buildUserPageNicknameInputStatePatch({ nicknameInput: 0 })).toEqual({
      nicknameInput: '',
    });
    expect(buildUserPageNicknameSaveStatePatch({ nickname: 'Alpha', bookmarked: true })).toEqual({
      nicknameInput: 'Alpha',
      bookmarked: true,
      isEditingNickname: false,
    });
    expect(buildUserPageUsernameChangeStatePatch({ username: 'alpha.eth' })).toEqual({
      username: 'alpha.eth',
      usernameError: '',
    });
    expect(buildUserPageUsernameLoadedStatePatch({ username: 'cached.eth' })).toEqual({
      username: 'cached.eth',
    });
    expect(buildUserPageUsernameEditOpenStatePatch()).toEqual({
      isEditingUsername: true,
    });
    expect(buildUserPageUsernameEditCancelStatePatch()).toEqual({
      isEditingUsername: false,
    });
    expect(buildUserPageUsernameSaveStatePatch({ username: 'saved.eth' })).toEqual({
      username: 'saved.eth',
      usernameError: '',
      isEditingUsername: false,
    });
    expect(buildUserPageUsernameErrorStatePatch({ usernameError: 'Failed' })).toEqual({
      usernameError: 'Failed',
    });
    expect(resolveUserPageUsernameErrorDisplayState({ usernameError: '' })).toEqual({
      shouldRenderUsernameError: false,
      usernameErrorText: '',
    });
    expect(resolveUserPageUsernameErrorDisplayState({ usernameError: 'Failed' })).toEqual({
      shouldRenderUsernameError: true,
      usernameErrorText: 'Failed',
    });
    expect(buildUserPageViewAddressStatePatch({ viewAddress: '0xabc' })).toEqual({
      viewAddress: '0xabc',
    });
    expect(buildUserPageViewAddressStatePatch({ viewAddress: undefined })).toEqual({
      viewAddress: undefined,
    });
    expect(
      buildUserPageAnalysisElapsedStatePatch({
        nowMs: 1250,
        startedAt: 1000,
      }),
    ).toEqual({
      analysisElapsedMs: 250,
    });
    const sessionConfig = { ai: { provider: 'openai' } };
    expect(
      buildUserPageAnalysisAiOptions({
        analysisSession: {
          slug: 'analysis-session',
          sessionConfig,
          status: 'allowed',
          reason: 'selected',
        },
      }),
    ).toEqual({
      sessionSlug: 'analysis-session',
      sessionConfig,
      sessionSelection: {
        gateStatus: 'allowed',
        reason: 'selected',
      },
    });
    expect(
      buildUserPageAnalysisAiOptions({
        analysisSession: {
          sessionConfig,
        },
        defaultReason: 'fallback-gate-unavailable',
      }),
    ).toEqual({
      sessionSlug: '',
      sessionConfig,
      sessionSelection: {
        gateStatus: 'unknown',
        reason: 'fallback-gate-unavailable',
      },
    });
    expect(buildUserPageAnalysisErrorStatePatch()).toEqual({
      analyzing: false,
      analysisError: 'Unable to generate analysis right now. Please try again later.',
      showAnalysisModal: true,
      analysisServedFromCache: false,
      analysisCachedAt: null,
    });
    expect(
      buildUserPageAnalysisErrorStatePatch({
        message: 'Try again',
      }).analysisError,
    ).toBe('Try again');
    expect(
      resolveUserPageResponseNonceRefresh({
        account: '0x00000000000000000000000000000000000000aa',
        connectedAddress: '',
        nextNonce: 2,
        prevNonce: 1,
        viewAddress: '0x00000000000000000000000000000000000000AA',
      }),
    ).toEqual({
      isOwnProfile: true,
      options: { force: true, markLoading: false, bypassSignature: true },
    });
    expect(
      resolveUserPageResponseNonceRefresh({
        connectedAddress: '0x00000000000000000000000000000000000000bb',
        nextNonce: 2,
        prevNonce: 1,
        viewAddress: '0x00000000000000000000000000000000000000aa',
      }),
    ).toEqual({
      isOwnProfile: false,
      options: { markLoading: false },
    });
    expect(
      resolveUserPageResponseNonceRefresh({
        nextNonce: 1,
        prevNonce: 1,
        viewAddress: '0x00000000000000000000000000000000000000aa',
      }),
    ).toBeNull();
    expect(
      resolveUserPageManagedCacheUpdate({
        bookmarksSlug: 'alpha',
        namespace: 'bookmarksCache',
        slug: 'alpha',
      }),
    ).toEqual({ action: 'bookmarks' });
    expect(
      resolveUserPageManagedCacheUpdate({
        bookmarksSlug: 'alpha',
        namespace: 'bookmarksCache',
        slug: 'beta',
      }),
    ).toEqual({ action: 'ignore' });
    expect(
      resolveUserPageManagedCacheUpdate({
        namespace: 'sbtCache',
        slug: 'beta',
      }),
    ).toEqual({ action: 'refresh' });
    expect(
      resolveUserPageManagedCacheUpdate({
        namespace: 'unknownCache',
      }),
    ).toEqual({ action: 'ignore' });
    expect(
      resolveUserPageAddressContextChange({
        prevViewAddress: '0x1',
        nextViewAddress: '0x2',
        prevNetwork: { id: 84532 },
        nextNetwork: { id: 84532 },
      }),
    ).toEqual({
      nextViewAddress: '0x2',
      shouldReset: true,
    });
    expect(
      resolveUserPageAddressContextChange({
        prevViewAddress: '0x1',
        nextViewAddress: '0x1',
        prevNetwork: { id: 84532 },
        nextNetwork: { id: 11155420 },
      }).shouldReset,
    ).toBe(true);
    expect(
      resolveUserPageAddressContextChange({
        prevViewAddress: '0x1',
        nextViewAddress: '0x1',
        prevNetwork: null,
        nextNetwork: {},
      }).shouldReset,
    ).toBe(false);
    expect(
      resolveUserPageCacheUpdateRefresh({
        prevSbtCacheRevision: 1,
        nextSbtCacheRevision: 2,
        prevAccount: '0xA',
        nextAccount: '0xA',
      }),
    ).toEqual({
      accountChanged: false,
      sbtRevisionChanged: true,
      shouldQueueCacheRefresh: true,
      shouldResetGateAccess: true,
    });
    expect(
      resolveUserPageCacheUpdateRefresh({
        prevSbtCacheRevision: 2,
        nextSbtCacheRevision: 2,
        prevAccount: '0xA',
        nextAccount: '0xB',
      }),
    ).toMatchObject({
      accountChanged: true,
      sbtRevisionChanged: false,
      shouldQueueCacheRefresh: true,
    });
    expect(
      resolveUserPageCacheUpdateRefresh({
        prevSbtCacheRevision: 2,
        nextSbtCacheRevision: 2,
        prevAccount: '0xA',
        nextAccount: '0xA',
      }).shouldQueueCacheRefresh,
    ).toBe(false);
    expect(
      mergeUserPageQueuedCacheRefreshFlags({
        bypassSignature: true,
        currentBypassSignature: false,
        currentForce: true,
        currentMarkLoading: false,
        force: false,
        markLoading: true,
      }),
    ).toEqual({
      bypassSignature: true,
      force: true,
      markLoading: true,
    });
    expect(mergeUserPageQueuedCacheRefreshFlags()).toEqual({
      bypassSignature: false,
      force: false,
      markLoading: false,
    });
    expect(
      buildUserPageCacheRefreshOptions({
        bypassSignature: true,
        force: true,
        markLoading: false,
      }),
    ).toEqual({
      bypassSignature: true,
      force: true,
      markLoading: false,
    });
    expect(
      buildUserPageCacheRefreshOptions({
        bypassSignature: false,
        force: false,
        markLoading: true,
      }),
    ).toEqual({
      force: false,
      markLoading: true,
    });
    expect(
      buildUserPageCacheRefreshInputSignature({
        account: ' 0xABC ',
        gateRecheckEpoch: 4,
        hasQuestionSources: false,
        hasSbtSources: true,
        hasSurveySources: true,
        hasUncertainGateAccess: true,
        hasUncertainUserData: false,
        isQuestionCacheReady: true,
        isResponsesCacheReady: false,
        isSBTCacheReady: true,
        isSurveyCacheReady: true,
        networkID: 84532,
        questionResponsesNonce: 7,
        responseGateAccessGeneration: 2,
        responseGateAccessStatusVersion: 3,
        sbtCacheRevision: 11,
        sourceMembershipSignature: 'survey|question|sbt',
        viewAddressLower: '0xuser',
      }),
    ).toBe('0xuser|84532|0xabc|1101|101|survey|question|sbt|7|11|0|1|2|3|4');
    expect(
      buildUserPageCacheLoadingHoldFlags({
        force: false,
        hasQuestionSources: false,
        hasSbtSources: false,
        hasSurveySources: false,
        questionsReady: true,
        responsesReady: false,
        sbtReady: false,
        surveysReady: false,
      }),
    ).toEqual({
      holdQuestionLoading: true,
      holdSbtLoading: true,
      holdSurveyLoading: true,
    });
    expect(
      buildUserPageCacheLoadingHoldFlags({
        force: false,
        hasQuestionSources: true,
        hasSbtSources: true,
        hasSurveySources: true,
        questionsReady: false,
        responsesReady: false,
        sbtReady: false,
        surveysReady: false,
      }),
    ).toEqual({
      holdQuestionLoading: false,
      holdSbtLoading: false,
      holdSurveyLoading: false,
    });
    expect(
      buildUserPageCacheLoadingHoldFlags({
        force: true,
        questionsReady: false,
        responsesReady: false,
        sbtReady: false,
        surveysReady: false,
      }),
    ).toEqual({
      holdQuestionLoading: false,
      holdSbtLoading: false,
      holdSurveyLoading: false,
    });
    expect(
      buildUserPageDeriveTelemetrySnapshot({
        aggregate: {
          combinedQuestions: { q1: {} },
          combinedQuestionResponses: { q1: {}, q2: {} },
          combinedSurveys: { s1: {}, s2: {} },
          combinedSurveyResponses: { s1: {} },
          sbtAggregate: { badge1: {}, badge2: {}, badge3: {} },
        },
        questionSection: {
          questionCreationInfo: [{ id: 'q1' }, { id: 'q2' }],
          questionResponseInfo: [{ id: 'q1' }],
        },
        sbtSection: { sbtList: [{}, {}] },
        surveySection: {
          surveyCreationInfo: [{ id: 's1' }],
          surveyResponseInfo: [{ id: 's1' }, { id: 's2' }],
        },
      }),
    ).toEqual({
      aggregateBuilt: true,
      combinedSurveys: 2,
      combinedQuestions: 1,
      combinedSurveyResponses: 1,
      combinedQuestionResponses: 2,
      sbtAggregateKeys: 3,
      surveySection: { responseCount: 2, createdCount: 1 },
      questionSection: { responseCount: 1, createdCount: 2 },
      sbtSection: { sbtCount: 2 },
    });
    expect(buildUserPageDeriveTelemetrySnapshot()).toEqual({
      aggregateBuilt: false,
      combinedSurveys: 0,
      combinedQuestions: 0,
      combinedSurveyResponses: 0,
      combinedQuestionResponses: 0,
      sbtAggregateKeys: 0,
      surveySection: null,
      questionSection: null,
      sbtSection: null,
    });
    expect(
      buildUserPageNoSbtVisibleTelemetryState({
        isSBTReady: false,
        sbtList: [],
      }),
    ).toEqual({
      payload: null,
      shouldEmit: false,
      signature: '',
    });
    expect(
      buildUserPageNoSbtVisibleTelemetryState({
        isSBTReady: true,
        sbtList: [{ sbtAddress: '0x1' }],
      }).shouldEmit,
    ).toBe(false);
    const noSbtTelemetry = buildUserPageNoSbtVisibleTelemetryState({
      hasUncertainGateAccess: true,
      hasUncertainSbtData: true,
      hasUncertainUserData: true,
      isDeepScanning: false,
      isSBTReady: true,
      latestRefreshTelemetry: {
        aggregateSbtAddresses: 2,
        derivedSbtCount: null,
        heldAggregateSbtCount: 0,
      },
      loadingSBTs: false,
      networkID: 84532,
      sbtList: [],
      viewAddress: '0x00000000000000000000000000000000000000AA',
    });
    expect(noSbtTelemetry).toEqual({
      payload: {
        viewAddress: '0x00000000000000000000000000000000000000aa',
        networkID: '84532',
        loadingSBTs: false,
        isSBTReady: true,
        isDeepScanning: false,
        hasUncertainUserData: true,
        hasUncertainSbtData: true,
        hasUncertainGateAccess: true,
        sbtListCount: 0,
        refreshSnapshot: {
          aggregateSbtAddresses: 2,
          derivedSbtCount: null,
          heldAggregateSbtCount: 0,
        },
      },
      shouldEmit: true,
      signature: '0x00000000000000000000000000000000000000aa|84532|0|1|0|1|1|1|0|2|0|',
    });
    const telemetryAddress = '0x00000000000000000000000000000000000000aa';
    const sourcePresence = {
      hasQuestionsCache: true,
      hasSbtCache: true,
      hasSurveysCache: false,
      hasUserCache: true,
    };
    const refreshTelemetry = buildUserPageRefreshTelemetrySnapshot({
      aggregate: {
        combinedQuestions: { q1: {} },
        combinedQuestionResponses: {
          Q1: { [telemetryAddress]: { answer: 'yes' } },
          q2: { [telemetryAddress]: { answer: 'no' } },
          q3: { '0xother': { answer: 'maybe' } },
        },
        combinedSurveys: { s1: {}, s2: {} },
        combinedSurveyResponses: {
          SurveyA: { [telemetryAddress]: { submittedAt: 1 } },
          surveyb: { '0xother': { submittedAt: 2 } },
        },
        sbtAggregate: {
          '0xsbt1': { burnedSet: new Set(), mintedSet: new Set([telemetryAddress]) },
          '0xsbt2': { burnedSet: new Set([telemetryAddress]), mintedSet: new Set([telemetryAddress]) },
          '0xsbt3': { burnedSet: new Set(), mintedSet: new Set() },
        },
      },
      bypassSignature: true,
      deepScanTooltipLines: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
      force: true,
      hasSbtSources: true,
      hasUncertainGateAccess: true,
      hasUncertainUserData: true,
      holdSbtLoading: false,
      isDeepScanning: true,
      networkID: 84532,
      sbtReady: true,
      sbtSection: { sbtList: [{}, {}] },
      sourcePresence,
      viewAddressLower: telemetryAddress,
    });
    expect(refreshTelemetry).toEqual({
      viewAddress: telemetryAddress,
      networkID: '84532',
      force: true,
      markLoading: false,
      bypassSignature: true,
      isDeepScanning: true,
      hasUncertainUserData: true,
      hasUncertainGateAccess: true,
      sbtReady: true,
      holdSbtLoading: false,
      hasSbtSources: true,
      aggregateSbtAddresses: 3,
      heldAggregateSbtCount: 1,
      heldAggregateSbtSample: ['0xsbt1'],
      aggregateSurveyCount: 2,
      aggregateQuestionCount: 1,
      aggregateSurveyResponseCount: 1,
      aggregateQuestionResponseCount: 2,
      aggregateSurveyResponseSample: ['SurveyA'],
      aggregateQuestionResponseSample: ['Q1', 'q2'],
      derivedSbtCount: 2,
      sourcePresence,
      deepScanTooltipLines: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'],
    });
    expect(buildUserPageRefreshTelemetrySignature(refreshTelemetry)).toBe(
      `${telemetryAddress}|84532|1|1|1|0|1|3|1|2|1|1|2|2|one|two|three|four|five|six|seven|eight`,
    );
    expect(
      resolveUserPageAiAvailabilityRefresh({
        nextAccount: '0xB',
        nextIsQuestionCacheReady: true,
        nextIsResponsesCacheReady: true,
        nextIsSBTCacheReady: true,
        nextIsSurveyCacheReady: true,
        nextNetworkId: 84532,
        nextViewAddress: '0xVIEW',
        prevAccount: '0xA',
        prevIsQuestionCacheReady: true,
        prevIsResponsesCacheReady: true,
        prevIsSBTCacheReady: true,
        prevIsSurveyCacheReady: true,
        prevNetworkId: 84532,
        prevViewAddress: '0xVIEW',
      }),
    ).toEqual({
      allCachesReady: true,
      contextChanged: true,
      shouldCheckAfterReset: true,
      shouldCheckNow: false,
    });
    expect(
      resolveUserPageAiAvailabilityRefresh({
        nextAccount: '0xA',
        nextIsQuestionCacheReady: true,
        nextIsResponsesCacheReady: false,
        nextIsSBTCacheReady: true,
        nextIsSurveyCacheReady: true,
        nextNetworkId: 84532,
        nextViewAddress: '0xVIEW2',
        prevAccount: '0xA',
        prevIsQuestionCacheReady: true,
        prevIsResponsesCacheReady: true,
        prevIsSBTCacheReady: true,
        prevIsSurveyCacheReady: true,
        prevNetworkId: 84532,
        prevViewAddress: '0xVIEW',
      }),
    ).toMatchObject({
      allCachesReady: false,
      contextChanged: true,
      shouldCheckAfterReset: false,
      shouldCheckNow: false,
    });
    expect(
      resolveUserPageAiAvailabilityRefresh({
        nextAccount: '0xA',
        nextIsQuestionCacheReady: true,
        nextIsResponsesCacheReady: true,
        nextIsSBTCacheReady: true,
        nextIsSurveyCacheReady: true,
        nextNetworkId: 84532,
        nextViewAddress: '0xVIEW',
        prevAccount: '0xA',
        prevIsQuestionCacheReady: true,
        prevIsResponsesCacheReady: false,
        prevIsSBTCacheReady: true,
        prevIsSurveyCacheReady: true,
        prevNetworkId: 84532,
        prevViewAddress: '0xVIEW',
      }),
    ).toEqual({
      allCachesReady: true,
      contextChanged: false,
      shouldCheckAfterReset: false,
      shouldCheckNow: true,
    });
    expect(
      resolveUserPageAiAvailabilityRefresh({
        nextAccount: '0xA',
        nextIsQuestionCacheReady: true,
        nextIsResponsesCacheReady: true,
        nextIsSBTCacheReady: true,
        nextIsSurveyCacheReady: true,
        nextNetworkId: '84532',
        nextViewAddress: '0xVIEW',
        prevAccount: '0xA',
        prevIsQuestionCacheReady: true,
        prevIsResponsesCacheReady: true,
        prevIsSBTCacheReady: true,
        prevIsSurveyCacheReady: true,
        prevNetworkId: 84532,
        prevViewAddress: '0xVIEW',
      }),
    ).toEqual({
      allCachesReady: true,
      contextChanged: true,
      shouldCheckAfterReset: true,
      shouldCheckNow: false,
    });
    expect(buildUserPageAiAvailabilityStatePatch()).toEqual({
      aiAvailable: null,
    });
    expect(buildUserPageAiAvailabilityStatePatch({ available: true })).toEqual({
      aiAvailable: true,
    });
    expect(buildUserPageAiAvailabilityStatePatch({ available: 0 })).toEqual({
      aiAvailable: false,
    });
    expect(buildUserPageMissingAddressCacheStatePatch()).toEqual({
      loadingSurveys: false,
      loadingQuestions: false,
      loadingSBTs: false,
      hasUncertainGateAccess: false,
      deepScanTooltipLines: null,
      deepScanProgressRows: null,
    });
    expect(
      buildUserPageMissingAddressCacheStateUpdate({
        loadingSurveys: false,
        loadingQuestions: false,
        loadingSBTs: false,
        hasUncertainGateAccess: false,
        deepScanTooltipLines: null,
        deepScanProgressRows: null,
      }),
    ).toBeNull();
    expect(
      buildUserPageMissingAddressCacheStateUpdate({
        loadingSurveys: true,
        deepScanTooltipLines: ['pending'],
      }),
    ).toEqual({
      loadingSurveys: false,
      loadingQuestions: false,
      loadingSBTs: false,
      hasUncertainGateAccess: false,
      deepScanTooltipLines: null,
      deepScanProgressRows: null,
    });
    expect(
      buildUserPageAddressContextResetStatePatch({
        viewAddress: '0x00000000000000000000000000000000000000aa',
      }),
    ).toMatchObject({
      surveyResponseInfo: [],
      surveyCreationInfo: [],
      questionCreationInfo: [],
      questionResponseInfo: [],
      detailedSurveyResponses: {},
      detailedQuestionResponses: {},
      sbtList: [],
      userStats: {
        surveysResponded: 0,
        surveysCreated: 0,
        questionsResponded: 0,
        questionsCreated: 0,
        mostUniqueIdea: ' ... ',
        badgesReceived: 0,
        worryScore: 'x%',
        enthusiasmScore: 'y%',
        topTags: ['#cybersecurity', '#ubi', '#mechinterp'],
      },
      loadingSurveys: true,
      loadingQuestions: true,
      loadingSBTs: true,
      username: '',
      usernameError: '',
      isEditingUsername: false,
      bookmarked: false,
      expandedSurveyResponses: {},
      expandedSurveysCreated: {},
      viewAddress: '0x00000000000000000000000000000000000000aa',
      nicknameInput: '',
      isEditingNickname: false,
      isDeepScanning: false,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
      hasUncertainGateAccess: false,
      deepScanTooltipLines: null,
      deepScanProgressRows: null,
    });
  });

  it('extracts analysis additional comments and importance from visible response fields', () => {
    expect(
      extractUserPageAnalysisAdditionalComment({
        additionalComment: { value: '*' },
        additionalComments: { value: 'extra context' },
      }),
    ).toBe('extra context');
    expect(
      extractUserPageAnalysisAdditionalComment({
        comment: { text: 'hidden', encrypted: true },
        comments: ' fallback note ',
      }),
    ).toBe(' fallback note ');
    expect(extractUserPageAnalysisAdditionalComment({ additionalComment: '*' })).toBeNull();
    expect(extractUserPageAnalysisImportance({ conviction: 4 })).toBe(4);
    expect(extractUserPageAnalysisImportance({ meta: { importance: 2 } })).toBe(2);
    expect(extractUserPageAnalysisImportance({ answer: { conviction: { encrypted: true } } })).toBeUndefined();
    expect(extractUserPageAnalysisImportance({ importance: '*' })).toBeUndefined();
  });
});
