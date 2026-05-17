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
  buildUserPageAnalysisElapsedStatePatch,
  buildUserPageAnalysisModalStatePatch,
  buildUserPageAnalysisQuestions,
  buildUserPageAnalysisResetStatePatch,
  buildUserPageAnalysisResultStatePatch,
  buildUserPageAnalysisSbts,
  buildUserPageAnalysisSurveys,
  buildUserPageAddressContextResetStatePatch,
  buildUserPageAiAvailabilityStatePatch,
  buildUserPageBookmarkStatusStateUpdate,
  buildUserPageBooleanTogglePatch,
  buildUserPageCacheRefreshInputSignature,
  buildUserPageCacheLoadingHoldFlags,
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
  buildUserPageFullProfileModalStatePatch,
  buildUserPageMissingAddressCacheStatePatch,
  buildUserPageMissingAddressCacheStateUpdate,
  buildUserPageNicknameEditCancelStatePatch,
  buildUserPageNicknameEditOpenStatePatch,
  buildUserPageNicknameInputStatePatch,
  buildUserPageNicknameSaveStatePatch,
  buildUserPageNoSbtVisibleTelemetryState,
  buildUserPageProfileEditVisibility,
  buildUserPageRenderLoadingState,
  buildUserPageCreatedQuestionWrapperClassName,
  buildUserPageHeaderBookmarkClassName,
  buildUserPageRootClassName,
  buildUserPageSbtSection,
  buildUserPageSectionLoadingEmptyState,
  buildUserPageSelectedTabStatePatch,
  buildUserPageSurveyExpansionTogglePatch,
  buildUserPageTooltipTargetIds,
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
  getUserPageErrorMessage,
  hasDisplayableUserPageResponsePayload,
  hasUserPageResponseSubmissionHints,
  isBookmarkUserEntry,
  isBookmarkUserObjectForAddress,
  isBookmarkValueForAddress,
  isDisplayableUserPageResponseValue,
  isPlainAnalysisObject,
  isUserPageGateAccessContext,
  isUserPageSbtAggregateEntry,
  normalizeUserPageDeepScanProgressRows,
  normalizeUserPageDeepScanTooltipLines,
  normalizeUserAnalysisResult,
  normalizeUserPageBookmarksCache,
  normalizeUserPageQuestionResponseInfoOrder,
  normalizeUserPageResponseField,
  normalizeUserPageSingleQuestionResponsePayload,
  mergeUserPageQueuedCacheRefreshFlags,
  parseUserPageCachedResponsePayload,
  readBoolishUserPageTelemetryFlag,
  readUserPageOwnershipCount,
  readUserPageAnalysisCacheEntry,
  readUserPageDirectNetworkCacheBucket,
  readUserPageNetworkCache,
  resolveUserPageAnalysisCacheStatusState,
  resolveUserPageAnalysisModalDisplayState,
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

// Remaining broad userPageHelpers coverage owns analysis, display-state, bookmark, and deep-scan helpers that still share mixed setup.
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

});
