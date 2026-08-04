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

describe('userPageBookmarkHelpers', () => {
  it('matches bookmark entries by legacy string and object address forms', () => {
    const address = '0x00000000000000000000000000000000000000aa';
    const addressLower = address.toLowerCase();

    expect(isBookmarkUserEntry({ address, nickname: 'Alice' })).toBe(true);
    expect(isBookmarkUserEntry(address)).toBe(false);
    expect(isBookmarkUserObjectForAddress({ address: address.toUpperCase() }, addressLower)).toBe(true);
    expect(
      isBookmarkUserObjectForAddress({ address: '0x00000000000000000000000000000000000000bb' }, addressLower),
    ).toBe(false);
    expect(isBookmarkValueForAddress(address.toUpperCase(), addressLower)).toBe(true);
    expect(isBookmarkValueForAddress({ address: address.toUpperCase() }, addressLower)).toBe(true);
    expect(isBookmarkValueForAddress({ address: '0x00000000000000000000000000000000000000bb' }, addressLower)).toBe(
      false,
    );
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
    expect(
      resolveUserPageBookmarkStatus({
        address,
        users: ['0x00000000000000000000000000000000000000bb', { address: address.toUpperCase(), nickname: 'Alpha' }],
      }),
    ).toEqual({
      bookmarked: true,
      nickname: 'Alpha',
    });
    expect(
      resolveUserPageBookmarkStatus({
        address,
        users: [address.toUpperCase()],
      }),
    ).toEqual({
      bookmarked: true,
      nickname: null,
    });
    expect(
      resolveUserPageBookmarkStatus({
        address,
        users: [{ address, nickname: '' }],
      }),
    ).toEqual({
      bookmarked: true,
      nickname: null,
    });
    expect(
      resolveUserPageBookmarkStatus({
        address,
        users: null,
      }),
    ).toEqual({
      bookmarked: false,
      nickname: null,
    });
    expect(
      buildUserPageBookmarkStatusStateUpdate({
        bookmarked: true,
        nickname: 'Alpha',
        state: {
          bookmarked: false,
          nicknameInput: '',
        },
      }),
    ).toEqual({
      bookmarked: true,
      nicknameInput: 'Alpha',
    });
    expect(
      buildUserPageBookmarkStatusStateUpdate({
        bookmarked: true,
        nickname: null,
        state: {
          bookmarked: true,
          nicknameInput: 'Existing',
        },
      }),
    ).toBeNull();
  });

  it('resolves cached bookmark nicknames with optional trimming', () => {
    const address = '0x00000000000000000000000000000000000000aa';
    const users = [
      { address: '0x00000000000000000000000000000000000000bb', nickname: 'Other' },
      { address: address.toUpperCase(), nickname: '  Alpha  ' },
    ];

    expect(resolveUserPageBookmarkNickname({ address, users })).toBe('  Alpha  ');
    expect(resolveUserPageBookmarkNickname({ address, users, trim: true })).toBe('Alpha');
    expect(
      resolveUserPageBookmarkNickname({
        address,
        users: [{ address, nickname: '   ' }],
        trim: true,
      }),
    ).toBe('');
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
    expect(created.bookmarksCache.users).toEqual([
      {
        address: '0x00000000000000000000000000000000000000cc',
        nickname: 'Gamma',
      },
    ]);
    expect(
      applyUserPageBookmarkNicknameSave({
        address: '0x00000000000000000000000000000000000000dd',
        bookmarksCache: { users: [], surveys: [], questions: [], filters: [] },
        nickname: '',
      }).stillBookmarked,
    ).toBe(false);
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
    expect(objectAdd.bookmarksCache.users).toEqual([
      {
        address,
        nickname: 'Meta Nick',
        username: 'meta.eth',
        networkId: '11155420',
      },
    ]);
  });
});
