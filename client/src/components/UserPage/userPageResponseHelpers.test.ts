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

describe('userPageResponseHelpers', () => {
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
      10,
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
    expect(
      normalizeUserPageSingleQuestionResponsePayload({
        response: {
          value: 'nested answer',
          additionalComment: 'nested note',
        },
        blockNumber: 50,
      }),
    ).toEqual(
      expect.objectContaining({
        value: 'nested answer',
        blockNumber: 50,
        answer: { value: 'nested answer' },
        additional: { value: 'nested note' },
      }),
    );
    expect(normalizeUserPageSingleQuestionResponsePayload({ arbitrary: 'legacy' })).toEqual(
      expect.objectContaining({
        arbitrary: 'legacy',
        answer: {},
        additional: {},
        __ceMalformedPayload: true,
      }),
    );
  });

  it('detects displayable response values and submission hints', () => {
    expect(isDisplayableUserPageResponseValue('*')).toBe(false);
    expect(isDisplayableUserPageResponseValue('  ')).toBe(false);
    expect(isDisplayableUserPageResponseValue(['*', { value: 'yes' }])).toBe(true);
    expect(isDisplayableUserPageResponseValue({ nested: true })).toBe(true);

    expect(
      hasDisplayableUserPageResponsePayload({
        answer: { value: '*' },
        additional: { value: 'comment' },
      }),
    ).toBe(true);
    expect(
      hasDisplayableUserPageResponsePayload({
        answer: { value: '*' },
        additional: { value: '' },
      }),
    ).toBe(false);

    expect(hasUserPageResponseSubmissionHints('answer')).toBe(true);
    expect(hasUserPageResponseSubmissionHints('  ')).toBe(false);
    expect(hasUserPageResponseSubmissionHints({ answer: {} })).toBe(true);
    expect(hasUserPageResponseSubmissionHints({ transactionHash: '0xabc' })).toBe(true);
    expect(hasUserPageResponseSubmissionHints({})).toBe(false);
  });

  it('extracts and compares response recency fields with metadata precedence', () => {
    expect(
      extractUserPageResponseRecency(
        {
          blockNumber: 10,
          transactionIndex: 2,
          logIndex: 4,
          timestamp: 100,
        },
        {
          bn: 11,
          txi: 1,
          li: 3,
          ts: 200,
        },
      ),
    ).toEqual({
      bn: 11,
      txi: 1,
      li: 3,
      ts: 200,
    });
    expect(
      extractUserPageResponseRecency({
        bn: 'bad',
        txIndex: 5,
      }),
    ).toEqual({
      bn: 0,
      txi: 5,
      li: 0,
      ts: 0,
    });
    expect(
      extractUserPageResponseRecencyWithHints(
        {
          timestamp: 0,
        },
        {
          bn: 12,
        },
      ),
    ).toEqual({
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
    expect(
      compareUserPageResponseRecency(
        { blockNumber: 10, transactionIndex: 1 },
        { blockNumber: 10, transactionIndex: 3 },
      ),
    ).toBe(-2);
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
});
