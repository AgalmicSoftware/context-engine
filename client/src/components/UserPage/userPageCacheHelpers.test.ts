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

describe('userPageCacheHelpers', () => {
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
});
