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

describe('userPageHelpers', () => {
  it('coerces analysis objects and sorts canonical keys', () => {
    expect(isPlainAnalysisObject({ a: 1 })).toBe(true);
    expect(isPlainAnalysisObject([['a', 1]])).toBe(false);
    expect(toAnalysisRecord({ a: 1 })).toEqual({ a: 1 });
    expect(toAnalysisRecord(null)).toEqual({});
    expect(toAnalysisCacheBucket(['kept'])).toEqual(['kept']);
    expect(sortUserAnalysisKeys({
      z: 1,
      a: { y: 2, x: 1 },
      list: [{ b: 2, a: 1 }],
    })).toEqual({
      a: { x: 1, y: 2 },
      list: [{ a: 1, b: 2 }],
      z: 1,
    });
  });

  it('builds stable user analysis fingerprints from canonical inputs', async () => {
    const first = await buildUserPageAnalysisFingerprint({
      version: 1,
      userData: { b: 2, a: { y: 1, x: 2 } },
      address: ' 0xABC ',
      networkId: 84532,
      sessionSlug: 'alpha',
      provider: ' OpenAI ',
      model: ' gpt-5 ',
    });
    const second = await buildUserPageAnalysisFingerprint({
      version: 1,
      userData: { a: { x: 2, y: 1 }, b: 2 },
      address: '0xabc',
      networkId: '84532',
      sessionSlug: 'alpha',
      provider: 'openai',
      model: 'gpt-5',
    });
    const changedVersion = await buildUserPageAnalysisFingerprint({
      version: 2,
      userData: { a: { x: 2, y: 1 }, b: 2 },
      address: '0xabc',
      networkId: '84532',
      sessionSlug: 'alpha',
      provider: 'openai',
      model: 'gpt-5',
    });

    expect(first).toBe(second);
    expect(first).not.toBe(changedVersion);
  });

  it('normalizes errors and detects analysis guard records', () => {
    expect(getUserPageErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getUserPageErrorMessage({ message: 123 }, 'fallback')).toBe('fallback');
    expect(getUserPageErrorMessage(null, 'fallback')).toBe('fallback');
    expect(isUserPageGateAccessContext({
      pendingKeys: new Set(['a']),
      uncertainResources: new Set(['b']),
    })).toBe(true);
    expect(isUserPageGateAccessContext({
      pendingKeys: [],
      uncertainResources: new Set(['b']),
    })).toBe(false);
    expect(isUserPageSbtAggregateEntry({
      mintedSet: new Set(['0xA']),
      burnedSet: new Set(['0xB']),
    })).toBe(true);
    expect(isUserPageSbtAggregateEntry({
      mintedSet: new Set(['0xA']),
      burnedSet: [],
    })).toBe(false);
  });

  it('builds boolean and survey expansion toggle patches', () => {
    expect(buildUserPageBooleanTogglePatch({
      state: { collapseOpen: false },
      stateKey: 'collapseOpen',
    })).toEqual({ collapseOpen: true });
    expect(buildUserPageBooleanTogglePatch({
      state: { showSectionSurveyResponsesOpen: 'open' },
      stateKey: 'showSectionSurveyResponsesOpen',
    })).toEqual({ showSectionSurveyResponsesOpen: false });
    expect(buildUserPageSelectedTabStatePatch({ selectedTab: 'surveys' })).toEqual({
      selectedTab: 'surveys',
    });
    expect(buildUserPageSelectedTabStatePatch({ selectedTab: null })).toEqual({
      selectedTab: '',
    });

    expect(buildUserPageSurveyExpansionTogglePatch({
      state: {
        expandedSurveyResponses: {
          alpha: true,
          beta: false,
        },
      },
      stateKey: 'expandedSurveyResponses',
      surveyId: 'alpha',
    })).toEqual({
      expandedSurveyResponses: {
        alpha: false,
        beta: false,
      },
    });
    expect(buildUserPageSurveyExpansionTogglePatch({
      state: {},
      stateKey: 'expandedSurveysCreated',
      surveyId: 42,
    })).toEqual({
      expandedSurveysCreated: {
        42: true,
      },
    });
  });

  it('formats analysis cache age labels', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);
    try {
      expect(formatAnalysisCacheAge(null)).toBe('');
      expect(formatAnalysisCacheAge(1_710_000_000_000 - 10_000)).toBe('just now');
      expect(formatAnalysisCacheAge(1_710_000_000_000 - (5 * 60 * 1000))).toBe('5m ago');
      expect(formatAnalysisCacheAge(1_710_000_000_000 - (2 * 60 * 60 * 1000))).toBe('2h ago');
      expect(formatAnalysisCacheAge(1_710_000_000_000 - (3 * 24 * 60 * 60 * 1000))).toBe('3d ago');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('resolves analysis cache status display state', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);
    try {
      expect(resolveUserPageAnalysisCacheStatusState({
        analysisCachedAt: 1_710_000_000_000 - (5 * 60 * 1000),
        analysisServedFromCache: false,
      })).toEqual({
        analysisCacheAge: '',
        shouldRenderAnalysisCacheStatus: false,
      });
      expect(resolveUserPageAnalysisCacheStatusState({
        analysisCachedAt: null,
        analysisServedFromCache: true,
      })).toEqual({
        analysisCacheAge: '',
        shouldRenderAnalysisCacheStatus: false,
      });
      expect(resolveUserPageAnalysisCacheStatusState({
        analysisCachedAt: 1_710_000_000_000 - (5 * 60 * 1000),
        analysisServedFromCache: true,
      })).toEqual({
        analysisCacheAge: '5m ago',
        shouldRenderAnalysisCacheStatus: true,
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('resolves analysis modal display states', () => {
    expect(resolveUserPageAnalysisModalDisplayState({
      analysisDetails: 'detail',
      analysisError: 'error',
      analyzing: true,
    })).toEqual({
      shouldRenderAnalysisBody: false,
      shouldRenderAnalyzing: true,
      shouldRenderDetails: false,
      shouldRenderError: false,
      shouldRenderHistoricalAlignment: false,
      shouldRenderHistoricalFigure: false,
      shouldRenderHistoricalReasoning: false,
    });
    expect(resolveUserPageAnalysisModalDisplayState({
      analysisError: 'error',
      analyzing: false,
    })).toEqual({
      shouldRenderAnalysisBody: false,
      shouldRenderAnalyzing: false,
      shouldRenderDetails: false,
      shouldRenderError: true,
      shouldRenderHistoricalAlignment: false,
      shouldRenderHistoricalFigure: false,
      shouldRenderHistoricalReasoning: false,
    });
    expect(resolveUserPageAnalysisModalDisplayState({
      analysisDetails: 'detail',
      analysisHistoricalFigure: 'Ada Lovelace',
      analysisHistoricalReasoning: 'reasoning',
      analyzing: false,
    })).toEqual({
      shouldRenderAnalysisBody: true,
      shouldRenderAnalyzing: false,
      shouldRenderDetails: true,
      shouldRenderError: false,
      shouldRenderHistoricalAlignment: true,
      shouldRenderHistoricalFigure: true,
      shouldRenderHistoricalReasoning: true,
    });
  });

  it('resolves full profile modal display states', () => {
    expect(resolveUserPageFullProfileModalDisplayState({
      account: '0xabc',
      explorerUrl: 'https://explorer.test/address/0xabc',
      minimized: false,
      propViewAddress: '0xABC',
      surveyResponseInfo: [{ id: 'survey-1' }],
    })).toEqual({
      shouldRenderBookmarksLink: true,
      shouldRenderModalActions: true,
      shouldRenderSurveyEmptyText: false,
      shouldRenderSurveyList: true,
      shouldRenderSurveySpinner: false,
    });
    expect(resolveUserPageFullProfileModalDisplayState({
      explorerUrl: 'https://explorer.test/address/0xabc',
      propViewAddress: '0xabc',
      surveyResponseInfo: [],
    })).toEqual({
      shouldRenderBookmarksLink: false,
      shouldRenderModalActions: true,
      shouldRenderSurveyEmptyText: true,
      shouldRenderSurveyList: false,
      shouldRenderSurveySpinner: false,
    });
    expect(resolveUserPageFullProfileModalDisplayState({
      minimized: true,
      propViewAddress: '0xabc',
      surveyResponseInfo: [{ id: 'survey-1' }],
      surveyResponsesLoadingEmpty: true,
    })).toEqual({
      shouldRenderBookmarksLink: false,
      shouldRenderModalActions: false,
      shouldRenderSurveyEmptyText: false,
      shouldRenderSurveyList: false,
      shouldRenderSurveySpinner: true,
    });
  });

  it('builds stable tooltip and spinner target ids from view addresses', () => {
    expect(buildUserPageTooltipTargetIds('0xABCDEF123456')).toEqual({
      addrFragment: 'abcdef',
      analyzeBtnWrapId: 'analyzeBtnWrap_abcdef',
      compareBtnWrapId: 'compareBtnWrap_abcdef',
      questionSpinnerId: 'questionSpinner_abcdef',
      questionsCreatedSpinnerId: 'questionsCreatedSpinner_abcdef',
      sbtSpinnerId: 'sbtSpinner_abcdef',
      surveySpinnerId: 'surveySpinner_abcdef',
      surveysCreatedSpinnerId: 'surveysCreatedSpinner_abcdef',
    });

    expect(buildUserPageTooltipTargetIds('/u/0xAB-CD_12')).toMatchObject({
      addrFragment: 'u0xab-',
      analyzeBtnWrapId: 'analyzeBtnWrap_u0xab-',
      compareBtnWrapId: 'compareBtnWrap_u0xab-',
    });

    expect(buildUserPageTooltipTargetIds(null)).toMatchObject({
      addrFragment: 'addr',
      surveySpinnerId: 'surveySpinner_addr',
    });
  });

  it('builds deep-scan progress state patches', () => {
    const rows = [makeRow({ slug: 'alpha' })];
    expect(buildUserPageDeepScanProgressStatePatch({
      deepScanProgressRows: rows,
      deepScanTooltipLines: ['Alpha: 50%'],
      now: 1234,
    })).toEqual({
      deepScanProgressTick: 1234,
      deepScanTooltipLines: ['Alpha: 50%'],
      deepScanProgressRows: rows,
    });
    expect(buildUserPageDeepScanProgressStatePatch({
      deepScanProgressRows: [],
      deepScanTooltipLines: [],
      now: 0,
    })).toEqual({
      deepScanProgressTick: 0,
      deepScanTooltipLines: [],
      deepScanProgressRows: [],
    });
  });

  it('reads boolish telemetry flags with fallback semantics', () => {
    expect(readBoolishUserPageTelemetryFlag(true, false)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag(false, true)).toBe(false);
    expect(readBoolishUserPageTelemetryFlag(' YES ', false)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag('on', false)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag('0', true)).toBe(false);
    expect(readBoolishUserPageTelemetryFlag('off', true)).toBe(false);
    expect(readBoolishUserPageTelemetryFlag('', true)).toBe(true);
    expect(readBoolishUserPageTelemetryFlag('maybe', 0)).toBe(false);
  });

  it('builds profile edit visibility for nickname and username controls', () => {
    expect(buildUserPageProfileEditVisibility({
      account: '0xABC',
      cachedNickname: '',
      isEditingNickname: false,
      isEditingUsername: false,
      minimized: false,
      pendingNickname: 'Pending',
      viewAddress: '0xabc',
    })).toEqual({
      hasNickForThis: true,
      isOwner: true,
      notOwnPage: false,
      showPen: false,
      showUsernamePen: true,
    });
    expect(buildUserPageProfileEditVisibility({
      account: '0xABC',
      isEditingNickname: false,
      minimized: false,
      viewAddress: '0xDEF',
    })).toMatchObject({
      isOwner: false,
      notOwnPage: true,
      showPen: true,
      showUsernamePen: false,
    });
    expect(buildUserPageProfileEditVisibility({
      account: '0xABC',
      isEditingNickname: true,
      minimized: true,
      viewAddress: '0xDEF',
    })).toMatchObject({
      showPen: false,
      showUsernamePen: false,
    });
    expect(resolveUserPageHeaderActionVisibility({
      explorerUrl: 'https://explorer.test/address/0xabc',
      isEditingNickname: true,
      isOwner: false,
      isSimulated: false,
      minimized: false,
      notOwnPage: true,
      propViewAddress: '0xabc',
    })).toEqual({
      showBookmarkButton: true,
      showBookmarksLink: false,
      showCopyAddressButton: true,
      showExplorerLink: false,
      showNicknameEditor: true,
      showSimulatedBadge: false,
    });
    expect(resolveUserPageHeaderActionVisibility({
      explorerUrl: 'https://explorer.test/address/0xabc',
      isEditingNickname: false,
      isOwner: true,
      isSimulated: false,
      minimized: true,
      notOwnPage: false,
      propViewAddress: '0xabc',
    })).toEqual({
      showBookmarkButton: false,
      showBookmarksLink: false,
      showCopyAddressButton: true,
      showExplorerLink: true,
      showNicknameEditor: false,
      showSimulatedBadge: false,
    });
    expect(resolveUserPageHeaderActionVisibility({
      isOwner: false,
      isSimulated: true,
      minimized: false,
      propViewAddress: '0xsim',
    })).toMatchObject({
      showBookmarkButton: false,
      showCopyAddressButton: false,
      showSimulatedBadge: true,
    });
  });

  it('resolves address display label and link precedence', () => {
    const shorten = jest.fn((address) => `short:${address}`);
    expect(resolveUserPageAddressDisplayState({
      cachedNickname: 'Cached Nick',
      explorerUrl: 'https://explorer.test/address/0xABC',
      getShortenedAddress: shorten,
      minimized: false,
      propViewAddress: '0xABC',
      username: 'user.eth',
    })).toMatchObject({
      addressHref: 'https://explorer.test/address/0xABC',
      addressLabel: 'Cached Nick',
      nicknameToUse: 'Cached Nick',
      pendingNicknameForThis: '',
      profileUrl: '/u/0xABC',
      shouldLinkAddressLabel: true,
    });

    expect(resolveUserPageAddressDisplayState({
      bookmarked: true,
      explorerUrl: 'https://explorer.test/address/0xABC',
      getShortenedAddress: shorten,
      minimized: true,
      nicknameInput: '  Pending Nick  ',
      propViewAddress: '0xABC',
      stateViewAddress: '0xabc',
      username: 'user.eth',
    })).toMatchObject({
      addressHref: '/u/0xABC',
      addressLabel: 'Pending Nick',
      nicknameToUse: 'Pending Nick',
      pendingNicknameForThis: 'Pending Nick',
    });

    expect(resolveUserPageAddressDisplayState({
      getShortenedAddress: shorten,
      isSimulated: false,
      propViewAddress: '0xDEF',
      stateViewAddress: '0xabc',
      username: 'real.eth',
    }).addressLabel).toBe('real.eth');
    expect(resolveUserPageAddressDisplayState({
      getShortenedAddress: shorten,
      isSimulated: false,
      propViewAddress: '0xDEF',
    }).addressLabel).toBe('short:0xDEF');
    expect(resolveUserPageBlockieSeed({
      propViewAddress: '0xABC',
      username: 'user.eth',
    })).toBe('0xABC');
    expect(resolveUserPageBlockieSeed({
      username: 'user.eth',
    })).toBe('user.eth');
    expect(resolveUserPageBlockieSeed()).toBe('contextengine-default-seed');
  });

  it('builds AI session scope contexts from scan globals', () => {
    expect(buildUserPageAiSessionScopeContext({
      scanScope: ' General ',
      activeSessionSlug: 'alpha',
    })).toEqual({
      mode: 'general',
      strict: true,
      allowedSlugs: [''],
    });

    expect(buildUserPageAiSessionScopeContext({
      scanScope: 'active',
      activeSessionSlug: ' Alpha Session ',
    })).toEqual({
      mode: 'active',
      strict: true,
      allowedSlugs: ['Alpha Session'],
    });

    expect(buildUserPageAiSessionScopeContext({
      scanScope: 'active',
      activeSessionSlug: '',
    })).toEqual({
      mode: 'active',
      strict: false,
      allowedSlugs: [],
    });

    expect(buildUserPageAiSessionScopeContext({
      scanScope: 'list',
      scanSlugs: [' Beta ', 'beta', '', 'General'],
    })).toEqual({
      mode: 'list',
      strict: true,
      allowedSlugs: ['Beta', 'beta', ''],
    });

    expect(buildUserPageAiSessionScopeContext()).toEqual({
      mode: 'all',
      strict: false,
      allowedSlugs: [],
    });
  });

  it('builds AI session slug candidates from active, scope, cache, and SBT sources', () => {
    const listNamespaceSlugs = jest.fn((namespace: string) => {
      if (namespace === 'userCache') return ['cached-user', 'active-session'];
      if (namespace === 'surveysCache') return ['survey-session'];
      if (namespace === 'questionsCache') return [''];
      return ['sbt-cache-session'];
    });

    expect(buildUserPageAiSessionSlugCandidates({
      activeSessionSlug: ' active-session ',
      listNamespaceSlugs,
      sbtList: [{ slug: 'minted-session' }, { slug: 'cached-user' }],
      scopeContext: { mode: 'all', strict: false, allowedSlugs: [] },
    })).toEqual([
      'active-session',
      'cached-user',
      'survey-session',
      '',
      'sbt-cache-session',
      'minted-session',
    ]);

    expect(listNamespaceSlugs).toHaveBeenCalledWith('userCache');
    expect(listNamespaceSlugs).toHaveBeenCalledWith('surveysCache');
    expect(listNamespaceSlugs).toHaveBeenCalledWith('questionsCache');
    expect(listNamespaceSlugs).toHaveBeenCalledWith('sbtCache');
  });

  it('keeps active AI session candidates eligible under strict scope filters', () => {
    expect(buildUserPageAiSessionSlugCandidates({
      activeSessionSlug: 'active-out-of-scope',
      listNamespaceSlugs: () => ['stale-cache'],
      scopeContext: {
        mode: 'list',
        strict: true,
        allowedSlugs: ['in-scope'],
      },
    })).toEqual(['active-out-of-scope', 'in-scope']);

    expect(buildUserPageAiSessionSlugCandidates({
      activeSessionSlug: '',
      listNamespaceSlugs: () => ['stale-cache'],
      scopeContext: {
        mode: 'general',
        strict: true,
        allowedSlugs: [''],
      },
    })).toEqual(['']);
  });

  it('resolves analysis session configs without demo fallback for unknown slugs', () => {
    const defaultConfig = { slug: '', ai: { enabled: true } };
    const alphaConfig = { slug: 'alpha', ai: { enabled: true } };
    const getSessionConfigBySlug = jest.fn((slug: string) => (
      slug === 'alpha' ? alphaConfig : null
    ));
    const getSessionConfigBySlugOrDefault = jest.fn(() => defaultConfig);

    expect(resolveUserPageAnalysisSessionConfigForSlug({
      getSessionConfigBySlug,
      getSessionConfigBySlugOrDefault,
      slugIn: '',
    })).toBe(defaultConfig);
    expect(resolveUserPageAnalysisSessionConfigForSlug({
      getSessionConfigBySlug,
      getSessionConfigBySlugOrDefault,
      slugIn: ' alpha ',
    })).toBe(alphaConfig);
    expect(resolveUserPageAnalysisSessionConfigForSlug({
      getSessionConfigBySlug,
      getSessionConfigBySlugOrDefault,
      slugIn: 'missing',
    })).toBeNull();
    expect(getSessionConfigBySlugOrDefault).toHaveBeenCalledTimes(1);
  });

  it('normalizes excluded analysis session slugs', () => {
    expect(Array.from(buildUserPageAnalysisExcludeSlugSet({
      excludeSlugs: [' alpha ', null, undefined, '', 'beta'],
    }).values())).toEqual(['alpha', '', 'beta']);
    expect(buildUserPageAnalysisExcludeSlugSet({ excludeSlugs: 'alpha' }).size).toBe(0);
  });

  it('resolves analysis session fallback precedence', () => {
    const activeCandidate = { slug: 'active', status: 'denied' };
    const firstUsable = { slug: 'usable', status: 'unknown' };
    const firstChecked = { slug: 'first', status: 'denied' };

    expect(resolveUserPageAnalysisSessionFallback({
      activeCandidate,
      checked: [firstChecked],
      firstUsable,
    })).toEqual({
      candidate: activeCandidate,
      reason: 'fallback-active-session',
    });
    expect(resolveUserPageAnalysisSessionFallback({
      checked: [firstChecked],
      firstUsable,
    })).toEqual({
      candidate: firstUsable,
      reason: 'fallback-first-usable-session',
    });
    expect(resolveUserPageAnalysisSessionFallback({
      checked: [firstChecked],
    })).toEqual({
      candidate: firstChecked,
      reason: 'fallback-first-checked-session',
    });
    expect(resolveUserPageAnalysisSessionFallback()).toBeNull();
  });

  it('builds analysis candidate log rows with general fallback labels', () => {
    expect(buildUserPageAnalysisCandidateLogRows([
      { slug: 'alpha', status: 'granted' },
      { slug: '', status: 'no-gate' },
      null,
    ])).toEqual([
      { slug: 'alpha', status: 'granted' },
      { slug: 'general', status: 'no-gate' },
      { slug: 'general', status: undefined },
    ]);
    expect(buildUserPageAnalysisCandidateLogRows(null)).toEqual([]);
  });

  it('reads valid analysis cache entries and rejects stale or mismatched entries', () => {
    const now = 1710000000000;
    const validEntry = {
      version: 1,
      fingerprint: 'fingerprint-a',
      networkId: '84532',
      address: '0xabc',
      expiresAt: now + 1000,
      result: { summary: 'cached' },
    };
    const cacheObj = {
      84532: {
        '0xabc': {
          'fingerprint-a': validEntry,
        },
      },
    };
    const readArgs = {
      addressLower: '0xabc',
      cacheObj,
      cacheVersion: 1,
      fingerprint: 'fingerprint-a',
      networkId: '84532',
      now,
    };

    expect(readUserPageAnalysisCacheEntry(readArgs)).toBe(validEntry);
    expect(readUserPageAnalysisCacheEntry({
      ...readArgs,
      cacheObj: { 84532: { '0xabc': { 'fingerprint-a': { ...validEntry, version: 0 } } } },
    })).toBeNull();
    expect(readUserPageAnalysisCacheEntry({
      ...readArgs,
      cacheObj: { 84532: { '0xabc': { 'fingerprint-a': { ...validEntry, fingerprint: 'other' } } } },
    })).toBeNull();
    expect(readUserPageAnalysisCacheEntry({
      ...readArgs,
      cacheObj: { 84532: { '0xabc': { 'fingerprint-a': { ...validEntry, networkId: '10' } } } },
    })).toBeNull();
    expect(readUserPageAnalysisCacheEntry({
      ...readArgs,
      cacheObj: { 84532: { '0xabc': { 'fingerprint-a': { ...validEntry, address: '0xdef' } } } },
    })).toBeNull();
    expect(readUserPageAnalysisCacheEntry({
      ...readArgs,
      cacheObj: { 84532: { '0xabc': { 'fingerprint-a': { ...validEntry, expiresAt: now } } } },
    })).toBeNull();
    expect(readUserPageAnalysisCacheEntry({
      ...readArgs,
      fingerprint: 'missing',
    })).toBeNull();
  });

  it('builds analysis cache entries and prunes expired siblings during writes', () => {
    const cachedAt = 1710000000000;
    const entry = buildUserPageAnalysisCacheEntry({
      addressLower: '0xabc',
      aiContext: { provider: 'openai', model: 'gpt-5' },
      cachedAt,
      cacheVersion: 2,
      fingerprint: 'fingerprint-new',
      networkId: '84532',
      result: { summary: 'fresh summary' },
      sessionSlug: 'edge',
      ttlMs: 1000,
    });

    expect(entry).toMatchObject({
      version: 2,
      fingerprint: 'fingerprint-new',
      cachedAt,
      expiresAt: cachedAt + 1000,
      address: '0xabc',
      networkId: '84532',
      aiContext: {
        sessionSlug: 'edge',
        provider: 'openai',
        model: 'gpt-5',
      },
      result: {
        summary: 'fresh summary',
      },
    });

    const staleSibling = { fingerprint: 'stale', expiresAt: cachedAt - 1 };
    const liveSibling = { fingerprint: 'live', expiresAt: cachedAt + 1 };
    const next = buildUserPageAnalysisCacheWritePayload({
      addressLower: '0xabc',
      cachedAt,
      currentCache: {
        84532: {
          '0xabc': {
            stale: staleSibling,
            live: liveSibling,
          },
          '0xdef': {
            keep: { expiresAt: cachedAt + 1 },
          },
        },
        other: { untouched: true },
      },
      entry,
      fingerprint: 'fingerprint-new',
      networkId: '84532',
    });

    expect(next).toEqual({
      84532: {
        '0xabc': {
          live: liveSibling,
          'fingerprint-new': entry,
        },
        '0xdef': {
          keep: { expiresAt: cachedAt + 1 },
        },
      },
      other: { untouched: true },
    });
  });

  it('builds analysis created-content samples from direct network caches', () => {
    const surveysCache = {
      84532: {
        surveys: {
          survey_a: {
            questionIDs: ['Q_A', 'Q_B', 'Q_missing'],
          },
        },
      },
    };
    const questionsCache = {
      84532: {
        questions: {
          q_a: { id: 'q_a', type: 'text', prompt: 'Prompt A' },
          q_b: { type: 'number', prompt: 'Prompt B' },
        },
      },
    };

    expect(readUserPageDirectNetworkCacheBucket(surveysCache, 84532)).toBe(surveysCache[84532]);
    expect(readUserPageDirectNetworkCacheBucket(surveysCache, '')).toEqual({});
    expect(buildUserPageAnalysisCreatedQuestions([
      { id: 'q1', type: 'text', prompt: 'Question one', ignored: true },
    ])).toEqual([
      { id: 'q1', type: 'text', prompt: 'Question one' },
    ]);
    expect(buildUserPageAnalysisCreatedSurveys({
      networkID: 84532,
      questionsCache,
      surveyCreationInfo: [
        { id: 'survey_a', title: 'Survey A', questionsCount: 3 },
      ],
      surveysCache,
    })).toEqual([
      {
        surveyId: 'survey_a',
        title: 'Survey A',
        questionsCount: 3,
        sampleQuestions: [
          { id: 'q_a', type: 'text', prompt: 'Prompt A' },
          { id: 'q_b', type: 'number', prompt: 'Prompt B' },
          { id: 'q_missing' },
        ],
      },
    ]);
  });

  it('builds analysis SBT, question, and survey response inputs', () => {
    expect(buildUserPageAnalysisSbts({
      getSbtDisplayName: (sbtInfo) => (sbtInfo as any)?.title,
      sbtList: [
        { sbtInfo: { title: 'Alpha Badge', sbtAddress: '0xA' } },
        { name: 'Missing Address', sbtInfo: {} },
      ],
    })).toEqual([
      { name: 'Alpha Badge', address: '0xA' },
    ]);

    const derivedSbtSection = buildUserPageSbtSection({
      aggregate: {
        sbtAggregate: {
          '0xBadgeA': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(),
            sbtAddress: '0xBadgeA',
            sbtInfo: { title: 'Alpha Badge' },
            slug: 'alpha',
          },
          '0xBadgeB': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(),
            sbtAddress: '0x1234567890abcdef',
            sbtInfo: {},
            slug: 'beta',
          },
          '0xBadgeC': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(['0xviewer']),
            sbtInfo: { title: 'Burned Badge' },
          },
          '0xBadgeD': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(),
            sbtInfo: { title: 'Hidden Badge', unlisted: true },
          },
        },
      },
      getSbtDisplayName: (sbtInfo) => (sbtInfo as any)?.title,
      getShortenedAddress: (address) => `short:${address}`,
      translate: () => 'Badge',
      viewAddressLower: '0xviewer',
    });
    expect(derivedSbtSection.sbtList).toEqual([
      {
        sbtInfo: {
          title: 'Alpha Badge',
          name: 'Alpha Badge',
          sbtAddress: '0xBadgeA',
        },
        slug: 'alpha',
      },
      {
        sbtInfo: {
          name: 'Badge short:0x1234567890abcdef',
          sbtAddress: '0x1234567890abcdef',
        },
        slug: 'beta',
      },
    ]);
    expect(derivedSbtSection.badgesReceived).toBe(2);
    expect(derivedSbtSection.telemetry).toEqual({
      signature: '0xviewer|4|3|2',
      payload: {
        viewAddress: '0xviewer',
        aggregateSbtAddresses: 4,
        heldAggregateSbtCount: 3,
        derivedSbtCount: 2,
        derivedSbtSample: ['0xbadgea', '0x1234567890abcdef'],
      },
    });
    expect(buildUserPageSbtSection({
      aggregate: { sbtAggregate: {} },
      viewAddressLower: '0xviewer',
    }).telemetry).toBeNull();

    expect(buildUserPageAnalysisQuestions({
      detailedQuestionResponses: {
        q1: {
          answer: { value: ['yes'] },
          additionalComments: 'Useful context',
          importance: { value: 'high' },
        },
        q2: { answer: { value: '*' } },
      },
      questionResponseInfo: [
        { id: 'q1', type: 'multi', prompt: 'Question one' },
        { id: 'q2', type: 'text', prompt: 'Encrypted' },
      ],
    })).toEqual([
      {
        id: 'q1',
        type: 'multi',
        prompt: 'Question one',
        answer: ['yes'],
        importance: { value: 'high' },
        additionalComment: 'Useful context',
      },
    ]);

    expect(buildUserPageAnalysisSurveys({
      detailedSurveyResponses: {
        s1: [
          {
            questionData: { prompt: 'Prompt one', type: 'text' },
            responseData: {
              answer: { value: 'answer one' },
              additionalComment: { value: 'Survey note' },
            },
          },
          {
            questionData: { prompt: 'Hidden prompt' },
            responseData: { answer: { value: '*' } },
          },
        ],
      },
      surveyResponseInfo: [
        { id: 's1', title: 'Survey one' },
      ],
    })).toEqual([
      {
        surveyId: 's1',
        title: 'Survey one',
        answeredCount: 1,
        sample: [
          {
            prompt: 'Prompt one',
            type: 'text',
            answer: 'answer one',
            importance: undefined,
            additionalComment: 'Survey note',
          },
        ],
        additionalCommentsSample: ['Survey note'],
      },
    ]);
  });

  it('resolves question display text and shortened ids', () => {
    expect(resolveUserPageQuestionPromptText({ question: '  Question text  ', prompt: 'Prompt text' })).toBe('Question text');
    expect(resolveUserPageQuestionPromptText({ question: '   ', prompt: '  Prompt text  ' })).toBe('Prompt text');
    expect(resolveUserPageQuestionPromptText({ question: 123, prompt: null })).toBe('');
    expect(shortenUserPageQuestionId('12345678901234567890')).toBe('12345678901234567890');
    expect(shortenUserPageQuestionId('123456789012345678901')).toBe('12345678...678901');
    expect(resolveUserPageSurveyCreatedCardState({
      survey: {
        tags: ['tag-a'],
        documentURLs: ['https://example.test/doc'],
        questionIDs: ['q-one', 'q-two'],
        slug: ' Survey Session ',
      },
    })).toEqual({
      hasDocURLs: true,
      hasExpandContent: true,
      hasQuestionIDs: true,
      hasTags: true,
      questionPreviewEntries: [
        { id: 'q-one', text: '' },
        { id: 'q-two', text: '' },
      ],
      surveyLinkSlug: 'Survey Session',
    });
    expect(resolveUserPageSurveyCreatedCardState({
      survey: {
        questionPreviews: [{ id: 'preview-one', text: 'Preview text' }],
      },
    })).toEqual({
      hasDocURLs: false,
      hasExpandContent: false,
      hasQuestionIDs: false,
      hasTags: false,
      questionPreviewEntries: [{ id: 'preview-one', text: 'Preview text' }],
      surveyLinkSlug: '',
    });
    expect(resolveUserPageSurveyCreatedCardState()).toMatchObject({
      hasExpandContent: false,
      questionPreviewEntries: [],
      surveyLinkSlug: '',
    });
    expect(resolveUserPageSurveyPreviewDisplayState({
      actionsClassName: 'survey-preview-actions',
      baseClassName: 'survey-preview',
      interactive: true,
    })).toEqual({
      className: 'survey-preview survey-preview-actions',
      style: { cursor: 'pointer' },
    });
    expect(resolveUserPageSurveyPreviewDisplayState({
      actionsClassName: 'survey-preview-actions',
      baseClassName: 'survey-preview',
      interactive: false,
    })).toEqual({
      className: 'survey-preview survey-preview-actions',
      style: { cursor: 'default' },
    });
    expect(resolveUserPageSurveyCountDisplayState({
      count: 7,
      countOnlyClassName: 'survey-count-only',
      infoClassName: 'survey-info',
    })).toEqual({
      ariaLabel: '7 questions',
      className: 'survey-info survey-count-only',
      title: '7 questions',
    });
    expect(resolveUserPageSurveyResponseCardState({
      questionArray: [{ id: 'q-one' }],
      survey: {
        tags: ['tag-a'],
        documentURLs: ['https://example.test/doc'],
      },
    })).toEqual({
      hasDocURLs: true,
      hasResponses: true,
      hasTags: true,
    });
    expect(resolveUserPageSurveyResponseCardState({
      questionArray: [],
      survey: {
        tags: [],
        documentURLs: null,
      },
    })).toEqual({
      hasDocURLs: false,
      hasResponses: false,
      hasTags: false,
    });
    expect(resolveUserPageSurveySectionDisplayState({
      surveyCreationInfo: [{ id: 'created-survey' }],
      surveyResponseInfo: [{ id: 'response-survey' }],
      surveyResponsesLoadingEmpty: false,
      surveysCreatedLoadingEmpty: false,
    })).toEqual({
      hasCreatedSurveys: true,
      hasSurveyResponses: true,
      shouldRenderSurveyResponsesEmptyText: false,
      shouldRenderSurveysCreatedEmptyText: false,
    });
    expect(resolveUserPageSurveySectionDisplayState({
      isDeepScanning: true,
      surveyCreationInfo: [],
      surveyResponseInfo: [],
      surveyResponsesLoadingEmpty: true,
      surveysCreatedLoadingEmpty: false,
    })).toEqual({
      hasCreatedSurveys: false,
      hasSurveyResponses: false,
      shouldRenderSurveyResponsesEmptyText: false,
      shouldRenderSurveysCreatedEmptyText: false,
    });
    expect(resolveUserPageQuestionSectionDisplayState({
      questionCreationInfo: [{ id: 'created-one' }],
      questionResponseInfo: [{ id: 'response-one' }],
      questionResponsesLoadingEmpty: false,
      questionsCreatedLoadingEmpty: false,
    })).toEqual({
      hasCreatedQuestions: true,
      hasQuestionResponses: true,
      shouldRenderQuestionResponsesEmptyText: false,
      shouldRenderQuestionsCreatedEmptyText: false,
    });
    expect(resolveUserPageQuestionSectionDisplayState({
      questionCreationInfo: [],
      questionResponseInfo: [],
      questionResponsesLoadingEmpty: true,
      questionsCreatedLoadingEmpty: false,
    })).toEqual({
      hasCreatedQuestions: false,
      hasQuestionResponses: false,
      shouldRenderQuestionResponsesEmptyText: false,
      shouldRenderQuestionsCreatedEmptyText: true,
    });
    expect(resolveUserPageSbtDisplayState({
      isSBTCacheReady: true,
      loadingSBTs: false,
      sbtList: [{ address: '0xA' }],
      sbtSectionLoadingEmpty: false,
    })).toEqual({
      hasSbts: true,
      shouldRenderMainEmptyText: false,
      shouldRenderModalEmptyText: false,
      shouldRenderModalSpinner: false,
    });
    expect(resolveUserPageSbtDisplayState({
      isSBTCacheReady: false,
      loadingSBTs: false,
      sbtList: [],
      sbtSectionLoadingEmpty: true,
    })).toEqual({
      hasSbts: false,
      shouldRenderMainEmptyText: false,
      shouldRenderModalEmptyText: false,
      shouldRenderModalSpinner: true,
    });
  });

  it('resolves question source session slug precedence', () => {
    const getSessionSlugByName = jest.fn((name: unknown) => (
      name === 'Mapped Session' ? 'mapped-session' : null
    ));

    expect(resolveUserPageQuestionSourceSessionSlug({
      fallbackSlug: 'fallback',
      getSessionSlugByName,
      questionData: {
        sessionSlug: ' explicit-session ',
        sessionName: 'Mapped Session',
      },
    })).toBe('explicit-session');

    expect(resolveUserPageQuestionSourceSessionSlug({
      fallbackSlug: 'fallback',
      getSessionSlugByName,
      questionData: { sessionName: 'Mapped Session' },
    })).toBe('mapped-session');

    expect(resolveUserPageQuestionSourceSessionSlug({
      fallbackSlug: 'fallback',
      getSessionSlugByName,
      questionData: { sessionName: 'Local-Session_1' },
    })).toBe('Local-Session_1');

    expect(resolveUserPageQuestionSourceSessionSlug({
      fallbackSlug: ' fallback-session ',
      getSessionSlugByName,
      questionData: { sessionName: 'bad session name' },
    })).toBe('fallback-session');
  });

  it('builds gate and source cache keys from normalized parts', () => {
    expect(normalizeUserPageGateSlug(' General ')).toBe('');
    expect(normalizeUserPageGateSlug(' Session-One ')).toBe('session-one');
    expect(normalizeUserPageSourceSlugForSignature('general')).toBe('general');
    expect(normalizeUserPageSourceSlugForSignature(' Session-One ')).toBe('session-one');
    expect(normalizeUserPageGateResourceKey('  field-1  ')).toBe('field-1');
    expect(normalizeUserPageGateResourceKey('')).toBe('default');

    expect(buildUserPageGateAccessCacheKey({
      account: ' 0xABC ',
      networkID: 84532,
      resourceKey: ' field-1 ',
      sbtCacheRevision: 7,
      slug: ' General ',
    })).toBe('0xabc|84532|7||field-1');

    expect(buildUserPageGateAccessCacheKey({
      resourceKey: '',
      slug: 'alpha',
    })).toBe('anon||0|alpha|default');

    expect(buildUserPageGatePendingKey({
      resourceKey: ' response ',
      slug: 'Beta',
    })).toBe('beta::response');
    expect(buildUserPageGatePendingKey({ slug: 'general' })).toBe('::default');
  });

  it('builds gate resource key fallback lists', () => {
    expect(getUserPageGateResourceKeysToCheck()).toEqual(['default']);
    expect(getUserPageGateResourceKeysToCheck('')).toEqual(['default']);
    expect(getUserPageGateResourceKeysToCheck(' response ')).toEqual(['response', 'default']);
  });

  it('detects encrypted response fields and payloads', () => {
    expect(isUserPageEncryptedResponseField(null)).toBe(false);
    expect(isUserPageEncryptedResponseField({ value: '*' })).toBe(false);
    expect(isUserPageEncryptedResponseField({ value: '*', encryptionAudience: 'self' })).toBe(true);
    expect(isUserPageEncryptedResponseField({ encryptedPortion: 'ciphertext' })).toBe(true);

    const response = {
      answer: { value: '*', encryptionAudience: 'gate' },
      additional: { encrypted: true },
    };
    expect(isUserPageAnswerFieldEncrypted(response)).toBe(true);
    expect(isUserPageAdditionalFieldEncrypted(response)).toBe(true);
    expect(isUserPageResponsePayloadEncrypted(response)).toBe(true);
    expect(isUserPageResponsePayloadEncrypted({ answer: { value: 'plain' } })).toBe(false);
  });

  it('infers response encryption audiences with field precedence', () => {
    expect(inferUserPageResponseFieldEncryptionAudience({
      answer: { encryptionAudience: ' Self ' },
    }, 'answer', 'gate')).toBe('self');

    expect(inferUserPageResponseFieldEncryptionAudience({
      answer: { encryptionAudience: 'public' },
    }, 'answer', ' Self ')).toBe('self');

    expect(inferUserPageResponseEncryptionAudience({
      answer: { encryptionAudience: 'self' },
      additional: { encryptionAudience: 'self' },
    })).toBe('self');
    expect(inferUserPageResponseEncryptionAudience({
      answer: { encryptionAudience: 'self' },
      additional: { encryptionAudience: 'gate' },
    })).toBe('gate');
    expect(inferUserPageResponseEncryptionAudience({}, 'custom')).toBe('custom');
    expect(inferUserPageResponseEncryptionAudience({}, '')).toBe('gate');
  });

  it('builds decryptable response fields and decrypted patches', () => {
    expect(buildUserPageDecryptableResponseField({
      value: 'ciphertext',
      encryptedPortion: 'payload',
      keep: 'yes',
    })).toEqual({
      value: 'ciphertext',
      encryptedPortion: 'payload',
      keep: 'yes',
      encrypted: true,
    });

    expect(buildUserPageDecryptableResponseField({ encrypted: false })).toEqual({
      encrypted: false,
      value: '',
    });

    const originalField = { value: '*', encrypted: true, encryptedPortion: 'payload', keep: 'yes' };
    expect(applyUserPageDecryptedPatchToResponseField(originalField, {})).toBe(originalField);
    expect(applyUserPageDecryptedPatchToResponseField(originalField, {
      value: 'clear',
      zkSalt: 'salt-1',
    })).toEqual({
      value: 'clear',
      encrypted: false,
      keep: 'yes',
      zkSalt: 'salt-1',
    });

    expect(buildUserPageDecryptedResponsePatch({
      responseObj: {
        answer: { value: '*', encrypted: true, encryptedPortion: 'answer-cipher' },
        additional: { value: '*', encrypted: true, encryptedPortion: 'additional-cipher' },
        untouched: true,
      },
      questionId: ' Q1 ',
      fieldToDecrypt: 'both',
      decryptedResult: {
        answers: {
          q1: { value: 'answer clear' },
        },
        additionalComments: {
          q1: { value: 'additional clear' },
        },
      },
    })).toEqual({
      answer: { value: 'answer clear', encrypted: false },
      additional: { value: 'additional clear', encrypted: false },
      untouched: true,
    });

    expect(buildUserPageDecryptedResponsePatch({
      responseObj: { answer: { value: '*' } },
      questionId: 'q1',
      fieldToDecrypt: 'additional',
      decryptedResult: { answers: { q1: { value: 'ignored' } } },
    })).toBeNull();
  });

  it('builds response decrypt survey bindings from response and survey details', () => {
    const hashZero = '0x0000000000000000000000000000000000000000000000000000000000000000';
    const responseOverride = { surveyID: 'OverrideSurvey' };

    expect(buildUserPageResponseDecryptSurveyBindings({
      hashZero,
      questionId: ' Q1 ',
      responseOverride,
      questionResponseInfo: [
        { id: 'q1', associatedSurveyId: 'InfoAssoc', surveyId: 'InfoSurvey' },
        { id: 'other', surveyId: 'IgnoredInfo' },
      ],
      detailedSurveyResponses: {
        'Survey-Key': [
          {
            questionData: { id: 'Q1', surveyID: 'QuestionSurvey' },
            responseData: { surveyId: 'ResponseSurvey' },
          },
        ],
        ReferenceSurvey: [
          {
            questionData: { id: 'Other' },
            responseData: responseOverride,
          },
        ],
        IgnoredSurvey: [
          {
            questionData: { id: 'Other', surveyID: 'IgnoredQuestion' },
            responseData: { surveyId: 'IgnoredResponse' },
          },
        ],
      },
    })).toEqual({
      surveyId: 'overridesurvey',
      acceptedSurveyIds: [
        'overridesurvey',
        'infoassoc',
        'infosurvey',
        'survey-key',
        'questionsurvey',
        'responsesurvey',
        'referencesurvey',
        hashZero,
      ],
    });

    expect(buildUserPageResponseDecryptSurveyBindings({
      hashZero,
      questionId: 'missing',
    })).toEqual({
      surveyId: hashZero,
      acceptedSurveyIds: [hashZero],
    });
  });

  it('builds sorted namespace source membership signatures', () => {
    const listNamespaceSlugs = jest.fn((namespace: unknown) => (
      namespace === 'questionsCache'
        ? ['Beta', 'general', 'alpha', '', 'Alpha']
        : 'bad'
    ));

    expect(buildUserPageNamespaceSourceMembershipSignature({
      listNamespaceSlugs,
      namespace: 'questionsCache',
    })).toBe('alpha,alpha,beta,general,general');
    expect(listNamespaceSlugs).toHaveBeenCalledWith('questionsCache');

    expect(buildUserPageNamespaceSourceMembershipSignature({
      listNamespaceSlugs,
      namespace: 'missing',
    })).toBe('');
  });

  it('reads namespace source entries from object cache nodes only', () => {
    const listNamespaceSlugs = jest.fn((namespace: unknown) => (
      namespace === 'userCache'
        ? ['Alpha', '', 'Beta', 'ArrayNode']
        : 'bad'
    ));
    const peekCache = jest.fn((namespace: string, slug: string) => {
      if (namespace !== 'userCache') return null;
      if (slug === 'Alpha') return { alpha: true };
      if (slug === '') return { general: true };
      if (slug === 'ArrayNode') return ['not', 'plain'];
      return null;
    });

    expect(readUserPageNamespaceSourceEntries({
      listNamespaceSlugs,
      namespace: 'userCache',
      peekCache,
    })).toEqual([
      { slug: 'Alpha', data: { alpha: true } },
      { slug: '', data: { general: true } },
    ]);
    expect(peekCache).toHaveBeenCalledWith('userCache', 'Alpha', { clone: false });
    expect(peekCache).toHaveBeenCalledWith('userCache', '', { clone: false });
    expect(readUserPageNamespaceSourceEntries({
      listNamespaceSlugs,
      namespace: 'missing',
      peekCache,
    })).toEqual([]);
  });

  it('reads cache source presence from the expected namespaces', () => {
    const hasNamespaceEntries = jest.fn((namespace: unknown) => (
      namespace === 'surveysCache' || namespace === 'userCache'
    ));

    expect(readUserPageCacheSourcePresence({ hasNamespaceEntries })).toEqual({
      hasSurveysCache: true,
      hasQuestionsCache: false,
      hasSbtCache: false,
      hasUserCache: true,
    });
    expect(hasNamespaceEntries.mock.calls.map(([namespace]) => namespace)).toEqual([
      'surveysCache',
      'questionsCache',
      'sbtCache',
      'userCache',
    ]);
  });

  it('reads full cache source snapshots from namespace readers', () => {
    const hasNamespaceEntries = jest.fn((namespace: unknown) => (
      namespace !== 'sbtCache'
    ));
    const listNamespaceSlugs = jest.fn((namespace: unknown) => {
      if (namespace === 'surveysCache') return ['General', 'Alpha'];
      if (namespace === 'questionsCache') return ['Beta'];
      if (namespace === 'userCache') return ['User'];
      return [];
    });

    expect(readUserPageCacheSourceSnapshot({
      hasNamespaceEntries,
      listNamespaceSlugs,
    })).toEqual({
      hasSurveysCache: true,
      hasQuestionsCache: true,
      hasSbtCache: false,
      hasUserCache: true,
      hasQuestionSources: true,
      hasSbtSources: true,
      hasSurveySources: true,
      questionSourcesSignature: 'beta|user',
      sbtSourcesSignature: '|user',
      surveySourcesSignature: 'alpha,general|beta|user',
      membershipSignature: 'alpha,general||beta||||user',
    });
  });

  it('builds cache source snapshots from namespace presence and signatures', () => {
    expect(buildUserPageCacheSourcePresence({
      hasQuestionsCache: 1 as unknown as boolean,
      hasSbtCache: '' as unknown as boolean,
      hasSurveysCache: 'yes' as unknown as boolean,
      hasUserCache: null as unknown as boolean,
    })).toEqual({
      hasQuestionsCache: true,
      hasSbtCache: false,
      hasSurveysCache: true,
      hasUserCache: false,
    });
    expect(buildUserPageCacheSourceSnapshot({
      hasQuestionsCache: true,
      hasSbtCache: false,
      hasSurveysCache: false,
      hasUserCache: true,
      questionsNamespaceSignature: 'questions',
      sbtNamespaceSignature: 'sbts',
      surveysNamespaceSignature: 'surveys',
      userNamespaceSignature: 'users',
    })).toEqual({
      hasQuestionsCache: true,
      hasSbtCache: false,
      hasSurveysCache: false,
      hasUserCache: true,
      hasQuestionSources: true,
      hasSbtSources: true,
      hasSurveySources: true,
      questionSourcesSignature: 'questions|users',
      sbtSourcesSignature: 'sbts|users',
      surveySourcesSignature: 'surveys|questions|users',
      membershipSignature: 'surveys||questions||sbts||users',
    });

    expect(buildUserPageCacheSourceSnapshot()).toMatchObject({
      hasQuestionSources: false,
      hasSbtSources: false,
      hasSurveySources: false,
      membershipSignature: '||||||',
    });
  });

  it('builds cache aggregate and section derive signatures', () => {
    expect(buildUserPageUnifiedCacheAggregateMemoKey({
      networkID: 84532,
      questionResponsesNonce: 2,
      sbtCacheRevision: 3,
      sourceMembershipSignature: 'surveys|questions',
      viewAddressLower: '0xabc',
    })).toBe('0xabc|84532|2|3|surveys|questions');

    expect(buildUserPageUnifiedCacheAggregateMemoKey()).toBe('||0|0|');

    expect(buildUserPageResponseSectionDeriveSignature({
      account: ' 0xABC ',
      networkID: 84532,
      questionResponsesNonce: 4,
      responseGateAccessGeneration: 5,
      responseGateAccessStatusVersion: 6,
      sourceSignature: 'questions',
      viewAddressLower: '0xdef',
    })).toBe('0xdef|84532|questions|4|0xabc|5|6');

    expect(buildUserPageResponseSectionDeriveSignature()).toBe('|||0||0|0');

    expect(buildUserPageSbtSectionDeriveSignature({
      networkID: 11155420,
      sbtCacheRevision: 9,
      sourceSignature: 'sbt',
      viewAddressLower: '0xaaa',
    })).toBe('0xaaa|11155420|sbt|9');
    expect(buildUserPageSbtSectionDeriveSignature()).toBe('|||0');
  });

  it('derives AI context from session config with provider and model precedence', () => {
    expect(deriveAnalysisAiContextFromSessionConfig('alpha', {
      ai: {
        mode: ' Anthropic ',
        modelProviders: {
          default: 'openai',
          reasoning: 'google',
        },
        models: {
          thinking: {
            provider: ' OpenAI ',
            model: ' gpt-5.2 ',
          },
        },
      },
    })).toEqual({
      sessionSlug: 'alpha',
      provider: 'openai',
      model: 'gpt-5.2',
    });

    expect(deriveAnalysisAiContextFromSessionConfig('', {})).toEqual({
      sessionSlug: '',
      provider: 'openai',
      model: 'gpt-5',
    });
  });

  it('resolves analysis AI context from effective config with fallback logging', async () => {
    const getEffectiveAiConfig = jest.fn(async () => ({
      provider: ' Anthropic ',
      model: ' claude-sonnet ',
    }));
    await expect(resolveUserPageAnalysisAiContext({
      getEffectiveAiConfig,
      sessionConfig: {
        ai: {
          provider: 'openai',
          models: { thinking: 'gpt-5' },
        },
      },
      sessionSlug: 'alpha',
    })).resolves.toEqual({
      sessionSlug: 'alpha',
      provider: 'anthropic',
      model: 'claude-sonnet',
    });
    expect(getEffectiveAiConfig).toHaveBeenCalledWith({
      sessionSlug: 'alpha',
      thinking: true,
      resolveSecrets: false,
    });

    const logger = { warn: jest.fn() };
    await expect(resolveUserPageAnalysisAiContext({
      getEffectiveAiConfig: jest.fn(async () => { throw new Error('offline'); }),
      logger,
      sessionConfig: {
        ai: {
          provider: 'Google',
          models: { thinking: { model: 'gemini-pro' } },
        },
      },
      sessionSlug: 'beta',
    })).resolves.toEqual({
      sessionSlug: 'beta',
      provider: 'google',
      model: 'gemini-pro',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      '[UserPage] analysis AI context fallback:',
      expect.any(Error)
    );
  });

  it('normalizes user analysis results and fallback fields', () => {
    expect(normalizeUserAnalysisResult({
      name: 'Analysis',
      summary: 'Summary',
      details: 'Details',
      historicalAlignment: {
        figure: 'Ada',
        reasoning: 'Pattern match',
      },
    })).toEqual({
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
    expect(buildUserPageAnalysisResultStatePatch({
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
    })).toEqual({
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
    expect(buildUserPageAnalysisResultStatePatch({
      result: null,
    })).toEqual({
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
    expect(buildUserPageRootClassName({
      baseClassName: 'user-page',
      minimized: false,
      minimizedClassName: 'minimized',
    })).toBe('user-page');
    expect(buildUserPageRootClassName({
      baseClassName: 'user-page',
      minimized: true,
      minimizedClassName: 'minimized',
    })).toBe('user-page minimized');
    expect(buildUserPageHeaderBookmarkClassName({
      baseClassName: 'bookmark-button',
      headerClassName: 'header-bookmark',
    })).toBe('bookmark-button header-bookmark');
    expect(buildUserPageCreatedQuestionWrapperClassName({
      baseClassName: 'created-question',
      bolderClassName: 'created-question-bolder',
    })).toBe('created-question created-question-bolder');
    expect(resolveUserPageAvatarDisplayState({ blockieUrl: 'data:image/png;base64,abc' })).toEqual({
      avatarStyle: {
        backgroundImage: 'url(data:image/png;base64,abc)',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      },
    });
    expect(resolveUserPageBookmarksLinkDisplayState({
      baseClassName: 'bookmarks-link',
      inlineClassName: 'bookmarks-link-inline',
    })).toEqual({
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
    expect(buildUserPageAnalysisElapsedStatePatch({
      nowMs: 1250,
      startedAt: 1000,
    })).toEqual({
      analysisElapsedMs: 250,
    });
    const sessionConfig = { ai: { provider: 'openai' } };
    expect(buildUserPageAnalysisAiOptions({
      analysisSession: {
        slug: 'analysis-session',
        sessionConfig,
        status: 'allowed',
        reason: 'selected',
      },
    })).toEqual({
      sessionSlug: 'analysis-session',
      sessionConfig,
      sessionSelection: {
        gateStatus: 'allowed',
        reason: 'selected',
      },
    });
    expect(buildUserPageAnalysisAiOptions({
      analysisSession: {
        sessionConfig,
      },
      defaultReason: 'fallback-gate-unavailable',
    })).toEqual({
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
    expect(buildUserPageAnalysisErrorStatePatch({
      message: 'Try again',
    }).analysisError).toBe('Try again');
    expect(resolveUserPageResponseNonceRefresh({
      account: '0x00000000000000000000000000000000000000aa',
      connectedAddress: '',
      nextNonce: 2,
      prevNonce: 1,
      viewAddress: '0x00000000000000000000000000000000000000AA',
    })).toEqual({
      isOwnProfile: true,
      options: { force: true, markLoading: false, bypassSignature: true },
    });
    expect(resolveUserPageResponseNonceRefresh({
      connectedAddress: '0x00000000000000000000000000000000000000bb',
      nextNonce: 2,
      prevNonce: 1,
      viewAddress: '0x00000000000000000000000000000000000000aa',
    })).toEqual({
      isOwnProfile: false,
      options: { markLoading: false },
    });
    expect(resolveUserPageResponseNonceRefresh({
      nextNonce: 1,
      prevNonce: 1,
      viewAddress: '0x00000000000000000000000000000000000000aa',
    })).toBeNull();
    expect(resolveUserPageManagedCacheUpdate({
      bookmarksSlug: 'alpha',
      namespace: 'bookmarksCache',
      slug: 'alpha',
    })).toEqual({ action: 'bookmarks' });
    expect(resolveUserPageManagedCacheUpdate({
      bookmarksSlug: 'alpha',
      namespace: 'bookmarksCache',
      slug: 'beta',
    })).toEqual({ action: 'ignore' });
    expect(resolveUserPageManagedCacheUpdate({
      namespace: 'sbtCache',
      slug: 'beta',
    })).toEqual({ action: 'refresh' });
    expect(resolveUserPageManagedCacheUpdate({
      namespace: 'unknownCache',
    })).toEqual({ action: 'ignore' });
    expect(resolveUserPageAddressContextChange({
      prevViewAddress: '0x1',
      nextViewAddress: '0x2',
      prevNetwork: { id: 84532 },
      nextNetwork: { id: 84532 },
    })).toEqual({
      nextViewAddress: '0x2',
      shouldReset: true,
    });
    expect(resolveUserPageAddressContextChange({
      prevViewAddress: '0x1',
      nextViewAddress: '0x1',
      prevNetwork: { id: 84532 },
      nextNetwork: { id: 11155420 },
    }).shouldReset).toBe(true);
    expect(resolveUserPageAddressContextChange({
      prevViewAddress: '0x1',
      nextViewAddress: '0x1',
      prevNetwork: null,
      nextNetwork: {},
    }).shouldReset).toBe(false);
    expect(resolveUserPageCacheUpdateRefresh({
      prevSbtCacheRevision: 1,
      nextSbtCacheRevision: 2,
      prevAccount: '0xA',
      nextAccount: '0xA',
    })).toEqual({
      accountChanged: false,
      sbtRevisionChanged: true,
      shouldQueueCacheRefresh: true,
      shouldResetGateAccess: true,
    });
    expect(resolveUserPageCacheUpdateRefresh({
      prevSbtCacheRevision: 2,
      nextSbtCacheRevision: 2,
      prevAccount: '0xA',
      nextAccount: '0xB',
    })).toMatchObject({
      accountChanged: true,
      sbtRevisionChanged: false,
      shouldQueueCacheRefresh: true,
    });
    expect(resolveUserPageCacheUpdateRefresh({
      prevSbtCacheRevision: 2,
      nextSbtCacheRevision: 2,
      prevAccount: '0xA',
      nextAccount: '0xA',
    }).shouldQueueCacheRefresh).toBe(false);
    expect(mergeUserPageQueuedCacheRefreshFlags({
      bypassSignature: true,
      currentBypassSignature: false,
      currentForce: true,
      currentMarkLoading: false,
      force: false,
      markLoading: true,
    })).toEqual({
      bypassSignature: true,
      force: true,
      markLoading: true,
    });
    expect(mergeUserPageQueuedCacheRefreshFlags()).toEqual({
      bypassSignature: false,
      force: false,
      markLoading: false,
    });
    expect(buildUserPageCacheRefreshOptions({
      bypassSignature: true,
      force: true,
      markLoading: false,
    })).toEqual({
      bypassSignature: true,
      force: true,
      markLoading: false,
    });
    expect(buildUserPageCacheRefreshOptions({
      bypassSignature: false,
      force: false,
      markLoading: true,
    })).toEqual({
      force: false,
      markLoading: true,
    });
    expect(buildUserPageCacheRefreshInputSignature({
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
    })).toBe('0xuser|84532|0xabc|1101|101|survey|question|sbt|7|11|0|1|2|3|4');
    expect(buildUserPageCacheLoadingHoldFlags({
      force: false,
      hasQuestionSources: false,
      hasSbtSources: false,
      hasSurveySources: false,
      questionsReady: true,
      responsesReady: false,
      sbtReady: false,
      surveysReady: false,
    })).toEqual({
      holdQuestionLoading: true,
      holdSbtLoading: true,
      holdSurveyLoading: true,
    });
    expect(buildUserPageCacheLoadingHoldFlags({
      force: false,
      hasQuestionSources: true,
      hasSbtSources: true,
      hasSurveySources: true,
      questionsReady: false,
      responsesReady: false,
      sbtReady: false,
      surveysReady: false,
    })).toEqual({
      holdQuestionLoading: false,
      holdSbtLoading: false,
      holdSurveyLoading: false,
    });
    expect(buildUserPageCacheLoadingHoldFlags({
      force: true,
      questionsReady: false,
      responsesReady: false,
      sbtReady: false,
      surveysReady: false,
    })).toEqual({
      holdQuestionLoading: false,
      holdSbtLoading: false,
      holdSurveyLoading: false,
    });
    expect(buildUserPageDeriveTelemetrySnapshot({
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
    })).toEqual({
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
    expect(buildUserPageNoSbtVisibleTelemetryState({
      isSBTReady: false,
      sbtList: [],
    })).toEqual({
      payload: null,
      shouldEmit: false,
      signature: '',
    });
    expect(buildUserPageNoSbtVisibleTelemetryState({
      isSBTReady: true,
      sbtList: [{ sbtAddress: '0x1' }],
    }).shouldEmit).toBe(false);
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
      `${telemetryAddress}|84532|1|1|1|0|1|3|1|2|1|1|2|2|one|two|three|four|five|six|seven|eight`
    );
    expect(resolveUserPageAiAvailabilityRefresh({
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
    })).toEqual({
      allCachesReady: true,
      contextChanged: true,
      shouldCheckAfterReset: true,
      shouldCheckNow: false,
    });
    expect(resolveUserPageAiAvailabilityRefresh({
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
    })).toMatchObject({
      allCachesReady: false,
      contextChanged: true,
      shouldCheckAfterReset: false,
      shouldCheckNow: false,
    });
    expect(resolveUserPageAiAvailabilityRefresh({
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
    })).toEqual({
      allCachesReady: true,
      contextChanged: false,
      shouldCheckAfterReset: false,
      shouldCheckNow: true,
    });
    expect(resolveUserPageAiAvailabilityRefresh({
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
    })).toEqual({
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
    expect(buildUserPageMissingAddressCacheStateUpdate({
      loadingSurveys: false,
      loadingQuestions: false,
      loadingSBTs: false,
      hasUncertainGateAccess: false,
      deepScanTooltipLines: null,
      deepScanProgressRows: null,
    })).toBeNull();
    expect(buildUserPageMissingAddressCacheStateUpdate({
      loadingSurveys: true,
      deepScanTooltipLines: ['pending'],
    })).toEqual({
      loadingSurveys: false,
      loadingQuestions: false,
      loadingSBTs: false,
      hasUncertainGateAccess: false,
      deepScanTooltipLines: null,
      deepScanProgressRows: null,
    });
    expect(buildUserPageAddressContextResetStatePatch({
      viewAddress: '0x00000000000000000000000000000000000000aa',
    })).toMatchObject({
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
    expect(extractUserPageAnalysisAdditionalComment({
      additionalComment: { value: '*' },
      additionalComments: { value: 'extra context' },
    })).toBe('extra context');
    expect(extractUserPageAnalysisAdditionalComment({
      comment: { text: 'hidden', encrypted: true },
      comments: ' fallback note ',
    })).toBe(' fallback note ');
    expect(extractUserPageAnalysisAdditionalComment({ additionalComment: '*' })).toBeNull();
    expect(extractUserPageAnalysisImportance({ conviction: 4 })).toBe(4);
    expect(extractUserPageAnalysisImportance({ meta: { importance: 2 } })).toBe(2);
    expect(extractUserPageAnalysisImportance({ answer: { conviction: { encrypted: true } } })).toBeUndefined();
    expect(extractUserPageAnalysisImportance({ importance: '*' })).toBeUndefined();
  });

  it('matches bookmark entries by legacy string and object address forms', () => {
    const address = '0x00000000000000000000000000000000000000aa';
    const addressLower = address.toLowerCase();

    expect(isBookmarkUserEntry({ address, nickname: 'Alice' })).toBe(true);
    expect(isBookmarkUserEntry(address)).toBe(false);
    expect(isBookmarkUserObjectForAddress({ address: address.toUpperCase() }, addressLower)).toBe(true);
    expect(isBookmarkUserObjectForAddress({ address: '0x00000000000000000000000000000000000000bb' }, addressLower)).toBe(false);
    expect(isBookmarkValueForAddress(address.toUpperCase(), addressLower)).toBe(true);
    expect(isBookmarkValueForAddress({ address: address.toUpperCase() }, addressLower)).toBe(true);
    expect(isBookmarkValueForAddress({ address: '0x00000000000000000000000000000000000000bb' }, addressLower)).toBe(false);
    expect(isBookmarkValueForAddress(null, addressLower)).toBe(false);
  });

  it('normalizes bookmark caches with cloned array fields', () => {
    const surveys = [{ id: 'survey-a' }];
    const users = [{ address: '0xA', nickname: 'Alpha' }];
    const cache = normalizeUserPageBookmarksCache({
      surveys,
      questions: 'bad',
      users,
      filters: ['recent'],
      extra: true,
    });

    expect(cache).toEqual({
      surveys,
      questions: [],
      users,
      filters: ['recent'],
      extra: true,
    });
    expect(cache.surveys).not.toBe(surveys);
    expect(cache.users).not.toBe(users);
    expect(normalizeUserPageBookmarksCache(null)).toEqual({
      surveys: [],
      questions: [],
      users: [],
      filters: [],
    });
  });

  it('resolves bookmark status and nickname prefill from mixed user entries', () => {
    const address = '0x00000000000000000000000000000000000000aa';
    expect(resolveUserPageBookmarkStatus({
      address,
      users: [
        '0x00000000000000000000000000000000000000bb',
        { address: address.toUpperCase(), nickname: 'Alpha' },
      ],
    })).toEqual({
      bookmarked: true,
      nickname: 'Alpha',
    });
    expect(resolveUserPageBookmarkStatus({
      address,
      users: [address.toUpperCase()],
    })).toEqual({
      bookmarked: true,
      nickname: null,
    });
    expect(resolveUserPageBookmarkStatus({
      address,
      users: [{ address, nickname: '' }],
    })).toEqual({
      bookmarked: true,
      nickname: null,
    });
    expect(resolveUserPageBookmarkStatus({
      address,
      users: null,
    })).toEqual({
      bookmarked: false,
      nickname: null,
    });
    expect(buildUserPageBookmarkStatusStateUpdate({
      bookmarked: true,
      nickname: 'Alpha',
      state: {
        bookmarked: false,
        nicknameInput: '',
      },
    })).toEqual({
      bookmarked: true,
      nicknameInput: 'Alpha',
    });
    expect(buildUserPageBookmarkStatusStateUpdate({
      bookmarked: true,
      nickname: null,
      state: {
        bookmarked: true,
        nicknameInput: 'Existing',
      },
    })).toBeNull();
  });

  it('resolves cached bookmark nicknames with optional trimming', () => {
    const address = '0x00000000000000000000000000000000000000aa';
    const users = [
      { address: '0x00000000000000000000000000000000000000bb', nickname: 'Other' },
      { address: address.toUpperCase(), nickname: '  Alpha  ' },
    ];

    expect(resolveUserPageBookmarkNickname({ address, users })).toBe('  Alpha  ');
    expect(resolveUserPageBookmarkNickname({ address, users, trim: true })).toBe('Alpha');
    expect(resolveUserPageBookmarkNickname({
      address,
      users: [{ address, nickname: '   ' }],
      trim: true,
    })).toBe('');
    expect(resolveUserPageBookmarkNickname({ address: '', users })).toBe('');
    expect(resolveUserPageBookmarkNickname({ address, users: null })).toBe('');
  });

  it('applies bookmark nickname saves while preserving legacy bookmark behavior', () => {
    const address = '0x00000000000000000000000000000000000000aa';
    const cache = {
      surveys: 'bad',
      questions: [],
      users: [
        { address: address.toUpperCase(), nickname: 'Old', color: 'blue' },
        '0x00000000000000000000000000000000000000bb',
      ],
      filters: null,
    };

    const updated = applyUserPageBookmarkNicknameSave({
      address,
      bookmarksCache: cache,
      networkId: 84532,
      nickname: '  Alpha  ',
      onchainUsername: 'alpha.eth',
    });
    expect(updated).toMatchObject({
      nickname: 'Alpha',
      stillBookmarked: true,
    });
    expect(updated.bookmarksCache.users[0]).toEqual({
      address,
      nickname: 'Alpha',
      username: 'alpha.eth',
      networkId: '84532',
      color: 'blue',
    });
    expect(updated.bookmarksCache.surveys).toEqual([]);
    expect(updated.bookmarksCache.filters).toEqual([]);

    const cleared = applyUserPageBookmarkNicknameSave({
      address,
      bookmarksCache: updated.bookmarksCache,
      nickname: '',
    });
    expect(cleared.bookmarksCache.users[0]).toEqual({
      address,
      username: 'alpha.eth',
      networkId: '84532',
      color: 'blue',
    });
    expect(cleared.stillBookmarked).toBe(true);

    const legacyAddress = '0x00000000000000000000000000000000000000bb';
    const legacy = applyUserPageBookmarkNicknameSave({
      address: legacyAddress,
      bookmarksCache: cleared.bookmarksCache,
      nickname: 'Beta',
    });
    expect(legacy.bookmarksCache.users[1]).toEqual({
      address: legacyAddress,
      nickname: 'Beta',
    });

    const created = applyUserPageBookmarkNicknameSave({
      address: '0x00000000000000000000000000000000000000cc',
      bookmarksCache: { users: [], surveys: [], questions: [], filters: [] },
      nickname: 'Gamma',
    });
    expect(created.bookmarksCache.users).toEqual([{
      address: '0x00000000000000000000000000000000000000cc',
      nickname: 'Gamma',
    }]);
    expect(applyUserPageBookmarkNicknameSave({
      address: '0x00000000000000000000000000000000000000dd',
      bookmarksCache: { users: [], surveys: [], questions: [], filters: [] },
      nickname: '',
    }).stillBookmarked).toBe(false);
  });

  it('applies bookmark toggles while preserving legacy add and remove behavior', () => {
    const address = '0x00000000000000000000000000000000000000aa';
    const mixedCaseAddress = address.toUpperCase();
    const legacyAdd = applyUserPageBookmarkToggle({
      address: mixedCaseAddress,
      bookmarkMeta: {},
      bookmarksCache: {
        surveys: 'bad',
        questions: null,
        users: [],
        filters: null,
      },
      currentNickname: '',
      networkId: 84532,
      onchainUsername: '',
    });
    expect(legacyAdd.bookmarked).toBe(true);
    expect(legacyAdd.statePatch).toEqual({});
    expect(buildUserPageBookmarkToggleStatePatch(legacyAdd)).toEqual({
      bookmarked: true,
    });
    expect(legacyAdd.bookmarksCache.users).toEqual([mixedCaseAddress]);
    expect(legacyAdd.bookmarksCache.surveys).toEqual([]);
    expect(legacyAdd.bookmarksCache.questions).toEqual([]);
    expect(legacyAdd.bookmarksCache.filters).toEqual([]);

    const removed = applyUserPageBookmarkToggle({
      address,
      bookmarksCache: legacyAdd.bookmarksCache,
    });
    expect(removed.bookmarked).toBe(false);
    expect(removed.bookmarksCache.users).toEqual([]);
    expect(removed.statePatch).toEqual({
      isEditingNickname: false,
      nicknameInput: '',
    });
    expect(buildUserPageBookmarkToggleStatePatch(removed)).toEqual({
      bookmarked: false,
      isEditingNickname: false,
      nicknameInput: '',
    });

    const objectAdd = applyUserPageBookmarkToggle({
      address: mixedCaseAddress,
      bookmarkMeta: { nickname: 'Meta Nick', username: 'meta.eth' },
      bookmarksCache: { surveys: [], questions: [], users: [], filters: [] },
      currentNickname: 'Draft Nick',
      networkId: 11155420,
      onchainUsername: 'chain.eth',
    });
    expect(objectAdd.bookmarked).toBe(true);
    expect(objectAdd.bookmarksCache.users).toEqual([{
      address,
      nickname: 'Meta Nick',
      username: 'meta.eth',
      networkId: '11155420',
    }]);
  });

  it('clones parsed response payloads without preserving object references', () => {
    const source = {
      answer: { value: 'yes' },
      nested: [{ value: 'one' }],
    };

    const clone = cloneUserPageParsedResponsePayload(source);

    expect(clone).toEqual(source);
    expect(clone).not.toBe(source);
    expect((clone as any).answer).not.toBe(source.answer);
    expect((clone as any).nested).not.toBe(source.nested);
    expect((clone as any).nested[0]).not.toBe(source.nested[0]);
  });

  it('parses cached response payloads through a memo while returning detached clones', () => {
    const memo = new Map<string, unknown>();
    const payload = '{"answer":{"value":"safe"}}';

    const first = parseUserPageCachedResponsePayload(payload, memo, 2);
    const second = parseUserPageCachedResponsePayload(payload, memo, 2);

    expect(first).toEqual({ answer: { value: 'safe' } });
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect((second as any).answer).not.toBe((first as any).answer);
    expect(memo.size).toBe(1);

    parseUserPageCachedResponsePayload('{"next":1}', memo, 2);
    parseUserPageCachedResponsePayload('{"third":1}', memo, 2);
    expect(memo.has(payload)).toBe(false);
    expect(parseUserPageCachedResponsePayload('not json', memo, 2)).toBe('not json');
  });

  it('clones __proto__ response keys as data without mutating object prototype', () => {
    const parsed = parseUserPageCachedResponsePayload(
      '{"__proto__":{"polluted":"yes"},"answer":{"value":"safe"}}',
      new Map(),
      10
    );

    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(true);
    expect((parsed as any).__proto__).toEqual({ polluted: 'yes' });
    expect((parsed as any).polluted).toBeUndefined();
    expect((parsed as any).answer.value).toBe('safe');
  });

  it('normalizes response fields with first-defined fallback precedence', () => {
    expect(extractUserPageFirstDefinedValue(undefined, '', 'fallback')).toBe('');
    expect(extractUserPageFirstDefinedValue(undefined, undefined)).toBeUndefined();
    expect(normalizeUserPageResponseField({ value: 'kept', encrypted: true }, ['fallback'])).toEqual({
      value: 'kept',
      encrypted: true,
    });
    expect(normalizeUserPageResponseField('scalar', ['fallback'])).toEqual({ value: 'scalar' });
    expect(normalizeUserPageResponseField({}, [undefined, 'fallback'])).toEqual({ value: 'fallback' });
  });

  it('normalizes single-question response payload variants', () => {
    expect(normalizeUserPageSingleQuestionResponsePayload(null)).toBeNull();
    expect(normalizeUserPageSingleQuestionResponsePayload('plain answer')).toEqual({
      answer: { value: 'plain answer' },
      additional: { value: '' },
    });
    expect(normalizeUserPageSingleQuestionResponsePayload({
      response: {
        value: 'nested answer',
        additionalComment: 'nested note',
      },
      blockNumber: 50,
    })).toEqual(expect.objectContaining({
      value: 'nested answer',
      blockNumber: 50,
      answer: { value: 'nested answer' },
      additional: { value: 'nested note' },
    }));
    expect(normalizeUserPageSingleQuestionResponsePayload({ arbitrary: 'legacy' })).toEqual(expect.objectContaining({
      arbitrary: 'legacy',
      answer: {},
      additional: {},
      __ceMalformedPayload: true,
    }));
  });

  it('detects displayable response values and submission hints', () => {
    expect(isDisplayableUserPageResponseValue('*')).toBe(false);
    expect(isDisplayableUserPageResponseValue('  ')).toBe(false);
    expect(isDisplayableUserPageResponseValue(['*', { value: 'yes' }])).toBe(true);
    expect(isDisplayableUserPageResponseValue({ nested: true })).toBe(true);

    expect(hasDisplayableUserPageResponsePayload({
      answer: { value: '*' },
      additional: { value: 'comment' },
    })).toBe(true);
    expect(hasDisplayableUserPageResponsePayload({
      answer: { value: '*' },
      additional: { value: '' },
    })).toBe(false);

    expect(hasUserPageResponseSubmissionHints('answer')).toBe(true);
    expect(hasUserPageResponseSubmissionHints('  ')).toBe(false);
    expect(hasUserPageResponseSubmissionHints({ answer: {} })).toBe(true);
    expect(hasUserPageResponseSubmissionHints({ transactionHash: '0xabc' })).toBe(true);
    expect(hasUserPageResponseSubmissionHints({})).toBe(false);
  });

  it('extracts and compares response recency fields with metadata precedence', () => {
    expect(extractUserPageResponseRecency({
      blockNumber: 10,
      transactionIndex: 2,
      logIndex: 4,
      timestamp: 100,
    }, {
      bn: 11,
      txi: 1,
      li: 3,
      ts: 200,
    })).toEqual({
      bn: 11,
      txi: 1,
      li: 3,
      ts: 200,
    });
    expect(extractUserPageResponseRecency({
      bn: 'bad',
      txIndex: 5,
    })).toEqual({
      bn: 0,
      txi: 5,
      li: 0,
      ts: 0,
    });
    expect(extractUserPageResponseRecencyWithHints({
      timestamp: 0,
    }, {
      bn: 12,
    })).toEqual({
      bn: 12,
      txi: 0,
      li: 0,
      ts: 0,
      hasHints: true,
    });
    expect(extractUserPageResponseRecencyWithHints()).toEqual({
      bn: 0,
      txi: 0,
      li: 0,
      ts: 0,
      hasHints: false,
    });
    expect(compareUserPageResponseRecency({ blockNumber: 10 }, { blockNumber: 9 })).toBe(1);
    expect(compareUserPageResponseRecency({ blockNumber: 10, transactionIndex: 1 }, { blockNumber: 10, transactionIndex: 3 })).toBe(-2);
    expect(compareUserPageResponseRecency({ blockNumber: 10, logIndex: 3 }, { blockNumber: 10, logIndex: 3 })).toBe(0);
  });

  it('normalizes question response info by recency and strips private sort metadata', () => {
    const input = [
      { id: 'z', prompt: 'Older', _responseRecency: { bn: 1 } },
      { id: 'b', prompt: 'Newest B', _responseRecency: { bn: 3, txi: 1 } },
      { id: 'a', prompt: 'Newest A', _responseRecency: { bn: 3, txi: 1 } },
    ];

    expect(normalizeUserPageQuestionResponseInfoOrder(input)).toEqual([
      { id: 'a', prompt: 'Newest A' },
      { id: 'b', prompt: 'Newest B' },
      { id: 'z', prompt: 'Older' },
    ]);
    expect(input[0].id).toBe('z');
  });

  it('reads user-page ownership count maps for viewer ownership signals', () => {
    const entry = {
      countsLoaded: false,
      mintedCountByAddress: {
        '0xabc': 2,
      },
      burnedCountByAddress: {
        '0xabc': 1,
      },
    };

    expect(getUserPageOwnershipCountMaps(entry)).toEqual({
      mintedCountMap: { '0xabc': 2 },
      burnedCountMap: { '0xabc': 1 },
    });
    expect(hasMeaningfulUserPageOwnershipCounts(entry, '0xABC')).toBe(true);
    expect(hasMeaningfulUserPageOwnershipCounts({
      countsLoaded: true,
      mintedCountByAddress: {},
    }, '')).toBe(true);
    expect(hasMeaningfulUserPageOwnershipCounts({}, '0xabc')).toBe(false);
    expect(readUserPageOwnershipCount({ '0xabc': '3' }, '0xABC')).toBe(3);
    expect(readUserPageOwnershipCount({ '0xabc': -2 }, '0xABC')).toBe(0);
    expect(readUserPageOwnershipCount(null, '0xABC')).toBe(0);
  });

  it('applies user-page ownership signals from count maps to aggregate sets', () => {
    const mintedAggregate = {
      mintedSet: new Set<string>(),
      burnedSet: new Set<string>(['0xabc']),
    };
    applyUserPageOwnershipSignal(mintedAggregate, {
      countsLoaded: false,
      mintedCountByAddress: { '0xabc': 2 },
      burnedCountByAddress: { '0xabc': 1 },
    }, '0xABC');
    expect(mintedAggregate.mintedSet.has('0xabc')).toBe(true);
    expect(mintedAggregate.burnedSet.has('0xabc')).toBe(false);

    const burnedAggregate = {
      mintedSet: new Set<string>(),
      burnedSet: new Set<string>(),
    };
    applyUserPageOwnershipSignal(burnedAggregate, {
      countsLoaded: false,
      mintedCountByAddress: { '0xabc': 1 },
      burnedCountByAddress: { '0xabc': 2 },
    }, '0xABC');
    expect(burnedAggregate.mintedSet.has('0xabc')).toBe(false);
    expect(burnedAggregate.burnedSet.has('0xabc')).toBe(true);

    const legacyAggregate = {
      mintedSet: new Set<string>(['0xabc']),
      burnedSet: new Set<string>(),
    };
    applyUserPageOwnershipSignal(legacyAggregate, {
      mintedSet: ['0xabc'],
    }, '0xABC');
    expect(legacyAggregate.mintedSet.has('0xabc')).toBe(true);
    expect(legacyAggregate.burnedSet.has('0xabc')).toBe(false);
  });

  it('writes normalized user-page source slugs without replacing existing sources by default', () => {
    const sourceSlugById: Record<string, string> = {};
    writeUserPageSourceSlug(sourceSlugById, '  SurveyA  ', ' Session-One ');
    writeUserPageSourceSlug(sourceSlugById, '  SurveyA  ', 'ignored');
    writeUserPageSourceSlug(sourceSlugById, '  SurveyA  ', 'general', { replace: true });
    writeUserPageSourceSlug(sourceSlugById, '', 'missing');

    expect(sourceSlugById).toEqual({
      '  surveya  ': '',
    });
  });

  it('writes normalized user-page response source slugs by response key', () => {
    const responseSourceSlugByKey: Record<string, string> = {};
    writeUserPageResponseSourceSlug(responseSourceSlugByKey, ' SurveyA ', ' 0xABC ', ' Session-One ');
    writeUserPageResponseSourceSlug(responseSourceSlugByKey, ' SurveyA ', ' 0xABC ', 'ignored');
    writeUserPageResponseSourceSlug(responseSourceSlugByKey, ' SurveyA ', ' 0xABC ', ' Session-Two ', { replace: true });
    writeUserPageResponseSourceSlug(responseSourceSlugByKey, ' SurveyA ', '', 'missing');

    expect(responseSourceSlugByKey).toEqual({
      'surveya|0xabc': 'session-two',
    });
  });

  it('upserts user-page responses by recency while tracking source slugs', () => {
    const responses: Record<string, Record<string, unknown>> = {};
    const responseRecencyMeta: Record<string, Record<string, any>> = {};
    const sourceSlugById: Record<string, string> = {};
    const responseSourceSlugByKey: Record<string, string> = {};

    upsertUserPageResponseByRecency({
      id: ' SurveyA ',
      responder: ' 0xABC ',
      responseRecencyMeta,
      responses,
      responseSourceSlugByKey,
      responseValue: { answer: 'old' },
      sourceSlugById,
      metaValue: { blockNumber: 10, transactionIndex: 1 },
      slug: 'alpha',
    });
    upsertUserPageResponseByRecency({
      id: 'surveya',
      responder: '0xabc',
      responseRecencyMeta,
      responses,
      responseSourceSlugByKey,
      responseValue: { answer: 'older' },
      sourceSlugById,
      metaValue: { blockNumber: 9 },
      slug: 'ignored',
    });
    expect(responses.surveya['0xabc']).toEqual({ answer: 'old' });
    expect(sourceSlugById.surveya).toBe('alpha');
    expect(responseSourceSlugByKey['surveya|0xabc']).toBe('alpha');

    upsertUserPageResponseByRecency({
      id: 'surveya',
      responder: '0xabc',
      responseRecencyMeta,
      responses,
      responseSourceSlugByKey,
      responseValue: { answer: 'newer' },
      sourceSlugById,
      metaValue: { blockNumber: 11 },
      slug: 'beta',
    });

    expect(responses.surveya['0xabc']).toEqual({ answer: 'newer' });
    expect(responseRecencyMeta.surveya['0xabc']).toMatchObject({ bn: 11, hasHints: true });
    expect(sourceSlugById.surveya).toBe('beta');
    expect(responseSourceSlugByKey['surveya|0xabc']).toBe('beta');

    upsertUserPageResponseByRecency({
      id: '',
      responder: '0xabc',
      responseRecencyMeta,
      responses,
      responseSourceSlugByKey,
      responseValue: { answer: 'invalid' },
      sourceSlugById,
    });
    expect(Object.keys(responses)).toEqual(['surveya']);
  });

  it('merges user-page network cache buckets with active network taking precedence', () => {
    expect(readUserPageNetworkCache(null, 84532)).toEqual({});
    expect(readUserPageNetworkCache({
      '11155420': {
        surveys: { a: 'global-a' },
        questionResponses: { q1: 'op' },
        ignored: { value: true },
      },
      '84532': {
        surveys: { a: 'base-a', b: 'base-b' },
        questionResponses: { q2: 'base' },
        questionResponsesMeta: { q2: { blockNumber: 2 } },
      },
    }, 84532)).toEqual({
      surveys: { a: 'base-a', b: 'base-b' },
      questionResponses: { q1: 'op', q2: 'base' },
      questionResponsesMeta: { q2: { blockNumber: 2 } },
    });
  });

  it('prioritizes active user-page network cache nodes and skips non-object buckets', () => {
    const cacheObj = {
      '11155420': { surveys: { op: true } },
      '84532': { surveys: { base: true } },
      empty: null,
    };
    expect(getPrioritizedUserPageNetworkCacheNodes(cacheObj, 84532)).toEqual([
      { key: '84532', value: { surveys: { base: true } } },
      { key: '11155420', value: { surveys: { op: true } } },
    ]);
    expect(getPrioritizedUserPageNetworkCacheNodes(cacheObj, 0)).toEqual([
      { key: '84532', value: { surveys: { base: true } } },
      { key: '11155420', value: { surveys: { op: true } } },
    ]);
    expect(getPrioritizedUserPageNetworkCacheNodes(null, 84532)).toEqual([]);
  });

  it('prioritizes active user-page chain nodes and skips non-object nodes', () => {
    const userNode = {
      '11155420': { data: { sbts: ['op-sbt'] } },
      '84532': { data: { sbts: ['base-sbt'] } },
      ignored: 'bad',
    };
    expect(getPrioritizedUserPageChainNodes(userNode, 84532)).toEqual([
      { chainKey: '84532', node: { data: { sbts: ['base-sbt'] } } },
      { chainKey: '11155420', node: { data: { sbts: ['op-sbt'] } } },
    ]);
    expect(getPrioritizedUserPageChainNodes(userNode, '')).toEqual([
      { chainKey: '84532', node: { data: { sbts: ['base-sbt'] } } },
      { chainKey: '11155420', node: { data: { sbts: ['op-sbt'] } } },
    ]);
    expect(getPrioritizedUserPageChainNodes(undefined, 84532)).toEqual([]);
  });

  it('merges active user-page chain data before fallback chain data', () => {
    const userNode = {
      '11155420': {
        data: {
          sbts: ['op-sbt'],
          createdSurveys: ['op-survey'],
          surveyResponses: ['op-response'],
        },
      },
      '84532': {
        data: {
          sbts: ['base-sbt'],
          createdQuestions: ['base-question'],
          questionResponses: ['base-response'],
        },
      },
      ignored: { data: 'bad' },
    };

    expect(getActiveUserPageChainNode(userNode, 84532)).toEqual({
      data: {
        sbts: ['base-sbt', 'op-sbt'],
        createdSurveys: ['op-survey'],
        createdQuestions: ['base-question'],
        surveyResponses: ['op-response'],
        questionResponses: ['base-response'],
      },
    });
    expect(getActiveUserPageChainNode(null, 84532)).toBeNull();
  });

  it('preserves empty arrays for plain active user-page chain data', () => {
    expect(getActiveUserPageChainNode({
      '84532': { data: {} },
    }, 84532)).toEqual({
      data: {
        sbts: [],
        createdSurveys: [],
        createdQuestions: [],
        surveyResponses: [],
        questionResponses: [],
      },
    });
  });

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

  it('builds stable deep-scan report signatures for background event dedupe', () => {
    expect(buildUserPageDeepScanReportSignature({
      reportTargetLower: '0xabc',
      report: {
        hadRpcErrors: true,
        coverageReason: 'partial',
        coverageComplete: false,
        attemptedSlugs: ['alpha', 'beta'],
        scannedSlugs: ['alpha'],
        skippedSlugs: ['gamma'],
        failedSlugs: ['delta'],
        failedActivitySlugs: ['epsilon'],
      },
    })).toBe('0xabc|1|partial|0|alpha,beta|alpha|gamma|delta|epsilon');

    expect(buildUserPageDeepScanReportSignature({
      reportTargetLower: '0xabc',
      report: {
        attemptedSlugs: 'bad',
        scannedSlugs: ['alpha'],
      },
    })).toBe('0xabc|0||||alpha|||');
  });

  it('classifies deep-scan report uncertainty from coverage and failure evidence', () => {
    expect(buildUserPageDeepScanReportStatus({
      report: {
        hadRpcErrors: true,
        attemptedSlugs: ['alpha', 'beta'],
        scannedSlugs: [],
        failedActivitySlugs: ['alpha', 'beta'],
      },
    })).toMatchObject({
      attemptedSlugs: ['alpha', 'beta'],
      scannedSlugs: [],
      failedActivitySlugs: ['alpha', 'beta'],
      rawHadRpcErrors: true,
      totalActivityFailure: true,
      totalSbtFailure: false,
      totalSkippedScan: false,
      hasCoverageGap: false,
      hasUncertainUserData: true,
      hasUncertainSbtData: false,
    });

    expect(buildUserPageDeepScanReportStatus({
      report: {
        hadRpcErrors: true,
        coverageComplete: false,
        attemptedSlugs: ['alpha', 'beta'],
        scannedSlugs: ['alpha'],
        failedSlugs: ['beta'],
      },
    })).toMatchObject({
      totalActivityFailure: false,
      totalSbtFailure: false,
      totalSkippedScan: false,
      hasCoverageGap: true,
      hasUncertainUserData: true,
      hasUncertainSbtData: true,
    });

    expect(buildUserPageDeepScanReportStatus({ report: null })).toMatchObject({
      attemptedSlugs: [],
      rawHadRpcErrors: false,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
    });

    expect(buildUserPageDeepScanRequestStatePatch()).toEqual({
      isDeepScanning: true,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
      hasUncertainGateAccess: false,
    });
    expect(buildUserPageDeepScanReportStatePatch({
      hasUncertainUserData: 1,
      hasUncertainSbtData: '',
    })).toEqual({
      isDeepScanning: false,
      hasUncertainUserData: true,
      hasUncertainSbtData: false,
      hasUncertainGateAccess: false,
    });

    expect(shouldApplyUserPageDeepScanResponse({
      activeRequestSeq: 3,
      currentViewAddress: '0xABC',
      isMounted: true,
      requestSeq: 3,
      targetLower: '0xabc',
    })).toBe(true);
    expect(shouldApplyUserPageDeepScanResponse({
      activeRequestSeq: 4,
      currentViewAddress: '0xABC',
      isMounted: true,
      requestSeq: 3,
      targetLower: '0xabc',
    })).toBe(false);
    expect(shouldApplyUserPageDeepScanResponse({
      activeRequestSeq: 3,
      currentViewAddress: '0xABC',
      isMounted: false,
      requestSeq: 3,
      targetLower: '0xabc',
    })).toBe(false);
    expect(shouldApplyUserPageDeepScanResponse({
      activeRequestSeq: 3,
      currentViewAddress: '0xDEF',
      isMounted: true,
      requestSeq: 3,
      targetLower: '0xabc',
    })).toBe(false);
  });

  it('limits deep-scan report telemetry samples', () => {
    expect(buildUserPageDeepScanReportSamples({
      limit: 2,
      report: {
        sampleSbtAddresses: ['sbt-1', 'sbt-2', 'sbt-3'],
        sampleCreatedSurveyIds: ['survey-1', 'survey-2', 'survey-3'],
        sampleCreatedQuestionIds: ['question-1'],
        sampleSurveyResponseIds: 'bad',
        sampleQuestionResponseIds: ['response-1', 'response-2', 'response-3'],
      },
    })).toEqual({
      sampleSbtAddresses: ['sbt-1', 'sbt-2'],
      sampleCreatedSurveyIds: ['survey-1', 'survey-2'],
      sampleCreatedQuestionIds: ['question-1'],
      sampleSurveyResponseIds: [],
      sampleQuestionResponseIds: ['response-1', 'response-2'],
    });
    expect(buildUserPageDeepScanReportSamples({ report: null })).toEqual({
      sampleSbtAddresses: [],
      sampleCreatedSurveyIds: [],
      sampleCreatedQuestionIds: [],
      sampleSurveyResponseIds: [],
      sampleQuestionResponseIds: [],
    });
  });

  it('builds deep-scan report telemetry payloads from status and report samples', () => {
    const report = {
      anyNewData: true,
      attemptedSlugs: ['alpha', 'beta'],
      coverageComplete: false,
      coverageReason: 'partial-rpc',
      failedActivitySlugs: ['beta'],
      failedSlugs: ['beta'],
      hadRpcErrors: true,
      registryEntryCount: '7',
      sampleCreatedQuestionIds: ['q1'],
      sampleCreatedSurveyIds: ['s1'],
      sampleQuestionResponseIds: ['qr1', 'qr2'],
      sampleSbtAddresses: ['0xsbt1'],
      sampleSurveyResponseIds: ['sr1'],
      scannedSlugs: ['alpha'],
      skippedSlugs: ['gamma'],
      totalCreatedQuestionsFound: '4',
      totalCreatedSurveysFound: '3',
      totalQuestionResponsesFound: '6',
      totalSbtContractsFound: '2',
      totalSurveyResponsesFound: '5',
      usedAllSessions: true,
    };
    const status = buildUserPageDeepScanReportStatus({ report });
    expect(buildUserPageDeepScanReportTelemetryPayloads({
      report,
      status,
      viewAddress: '0x00000000000000000000000000000000000000AA',
    })).toEqual({
      coldDiagPayload: {
        viewAddress: '0x00000000000000000000000000000000000000aa',
        attemptedSlugs: ['alpha', 'beta'],
        scannedSlugs: ['alpha'],
        skippedSlugs: ['gamma'],
        failedSlugs: ['beta'],
        failedActivitySlugs: ['beta'],
        anyNewData: true,
        coverageComplete: false,
        coverageReason: 'partial-rpc',
        hasUncertainUserData: true,
        hasUncertainSbtData: true,
        totalActivityFailure: false,
        totalSbtFailure: false,
        totalSkippedScan: false,
        hasCoverageGap: true,
        totalSbtContractsFound: '2',
        totalCreatedSurveysFound: '3',
        totalCreatedQuestionsFound: '4',
        totalSurveyResponsesFound: '5',
        totalQuestionResponsesFound: '6',
      },
      telemetryPayload: {
        viewAddress: '0x00000000000000000000000000000000000000aa',
        hadRpcErrors: true,
        hasUncertainUserData: true,
        hasUncertainSbtData: true,
        totalActivityFailure: false,
        totalSbtFailure: false,
        totalSkippedScan: false,
        usedAllSessions: true,
        coverageComplete: false,
        coverageReason: 'partial-rpc',
        attemptedSlugs: ['alpha', 'beta'],
        scannedSlugs: ['alpha'],
        skippedSlugs: ['gamma'],
        failedSlugs: ['beta'],
        failedActivitySlugs: ['beta'],
        registryEntryCount: 7,
        anyNewData: true,
        totalSbtContractsFound: 2,
        totalCreatedSurveysFound: 3,
        totalCreatedQuestionsFound: 4,
        totalSurveyResponsesFound: 5,
        totalQuestionResponsesFound: 6,
        sampleSbtAddresses: ['0xsbt1'],
        sampleCreatedSurveyIds: ['s1'],
        sampleCreatedQuestionIds: ['q1'],
        sampleSurveyResponseIds: ['sr1'],
        sampleQuestionResponseIds: ['qr1', 'qr2'],
      },
    });
    expect(buildUserPageDeepScanReportTelemetryPayloads({
      report: { attemptedSlugs: 'bad' },
      viewAddress: '',
    }).telemetryPayload.coverageComplete).toBeNull();
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
