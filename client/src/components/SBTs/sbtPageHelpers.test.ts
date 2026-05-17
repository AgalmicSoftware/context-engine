import {
  applySbtPageHistorySummaryFallback,
  buildSessionRoutePath,
  buildSbtPageDirectMetadataContext,
  collectAutoMintPairsFromSearchParams,
  decodeSbtPageJsonDataUri,
  buildSbtPageAddressListSignatureMemoState,
  buildSbtPageAddressChangeResetMintUiPatch,
  buildSbtPageAddressOccurrenceMap,
  buildSbtPageAdminInviteSuccessPatch,
  buildSbtPageAutoMintCleanPath,
  buildSbtPageBookmarkedPatch,
  buildSbtPageBooleanTogglePatch,
  buildSbtPageBurnFailurePatch,
  buildSbtPageBurnPendingPatch,
  buildSbtPageBurnSearchInputPatch,
  buildSbtPageBurnSearchResultPatch,
  buildSbtPageBurnSuccessPatch,
  buildSbtPageCachedPasswordsPatch,
  buildSbtPageClaimCountdownCompletePatch,
  buildSbtPageClaimCountdownTickPatch,
  buildSbtPageCopiedAddressPatch,
  buildSbtPageCopiedErrorPatch,
  buildSbtPageDetailsPayload,
  buildSbtPageDocModalContentPatch,
  buildSbtPageDocModalErrorPatch,
  buildSbtPageDocModalOpenPatch,
  buildSbtPageDocModalResetPatch,
  buildSbtPageEncryptedEnvelopeDecryptKey,
  buildSbtPageEncryptedEnvelopeFingerprint,
  buildSbtPageErrorPatch,
  buildSbtPageExportFormatPatch,
  buildSbtPageExplorerUrl,
  buildSbtPageHolderListSignature,
  buildSbtPageInitialState,
  buildSbtPageIncludePreviousPasswordsPatch,
  buildSbtPageNetworkUpdatePatch,
  buildSbtPageLoadInfoLoadingStartPatch,
  buildSbtPageLoadInfoRequestKey,
  buildSbtPageLoadInfoStartLogContext,
  buildSbtPageIntervalIdPatch,
  buildSbtPageLoadingMintersBurnersPatch,
  buildSbtPageLogScanProgressPatch,
  buildSbtPageLocalBurnSuccessPatch,
  buildSbtPageLocalMintSuccessPatch,
  buildSbtPageModalFilteredMintedUsersPatch,
  buildSbtPageMintFailurePatch,
  buildSbtPageMintedModalInitialFilterPatch,
  buildSbtPageMintedModalVisibilityPatch,
  buildSbtPageMintCountdownPatch,
  buildSbtPageMintPendingPatch,
  buildSbtPageMintSuccessPatch,
  buildSbtPageMiniPasswordInputPatch,
  buildSbtPageNextFilteredHolderRows,
  buildSbtPageNetHoldersMemoState,
  buildSbtPageOpenMintAutoJoinUrl,
  buildSbtPagePasswordExportFile,
  buildSbtPagePasswordExportRows,
  buildSbtPagePasswordInviteLink,
  buildSbtPagePasswordInputValuePatch,
  buildSbtPageMintPasswordClearPatch,
  buildSbtPageMintPasswordPrefillPatch,
  buildSbtPagePasswordClaimStartSuccessPatch,
  buildSbtPagePasswordGenerationCountPatch,
  buildSbtPagePasswordMintInputPatch,
  buildSbtPageAccountDerivedStatePatch,
  buildSbtPagePrimaryMetadataStatePatch,
  buildSbtPageRefreshOptions,
  buildSbtPageRelevantInfoPatch,
  buildSbtPageResolvedSessionSlugPatch,
  buildSbtPageSbtInfoPatch,
  buildSbtPageSessionSbtAddresses,
  buildSbtPageSessionSbtAddressesMemoState,
  coerceSbtPageEpochSeconds,
  coerceSbtPageStringArrayValue,
  computeSbtPageNetCounts,
  computeSbtPageNetHoldersList,
  deriveSbtPageCacheNetKey,
  decodeSbtPageInviteInput,
  encodeSbtPageGroupPasswordForUrl,
  expandSbtPageAddressListFromCountMap,
  findSbtPageCachedEntryAcrossGroups,
  findNestedInteractiveElement,
  generateSbtPageRandomPasswords,
  getBlockExplorerBaseUrl,
  getCurrentSbtAddressInfo,
  getDisplayImageFallbackCandidateCount,
  getDisplayImageRenderState,
  getDisplayImageUrlCandidates,
  getErrorMessage,
  getExplicitSbtPageSessionSlug,
  getNextDisplayImageFallbackState,
  hasSbtPageAutoMintFlag,
  hasExplicitSbtPageSessionSlugProp,
  isRecord,
  isSbtPageImageLikeUri,
  mergeSbtPageBurnEvidenceIntoPreservedHolderState,
  normalizeSbtPageLoadInfoOptions,
  normalizeSbtInviteCode,
  normalizeSbtPageCanonicalMetadataHref,
  normalizeSbtPageHistorySummary,
  needsSbtPageDirectMetadataHydration,
  needsSbtPageTokenUriFields,
  readSbtPageCacheBySlug,
  resolveSbtPageEffectiveSessionSlug,
  resolveSbtPageMetadataHydrationMode,
  resolveSbtPageMiniActionFailureState,
  resolveSbtPageMiniMintFlowDisplayState,
  resolveSbtPageMiniMintState,
  resolveSbtPageOwnerLookupFallbackDecision,
  resolveSbtPageOwnerLookupTokenCount,
  resolveSbtPagePasswordExportControlsState,
  resolveSbtPagePasswordExportSelection,
  resolveSbtPagePasswordInventoryDisplayState,
  resolveSbtPageCachedGroupPasswordHash,
  resolveSbtPageGroupPasswordMintState,
  resolveSbtPageSessionSlugFromInfo,
  resolveSbtPageActiveBlockTimeMs,
  resolveSbtPageActiveChainId,
  resolveSbtPageAddressLinkState,
  resolveSbtPageChainMetadataReadNeeds,
  resolveSbtPageCopyableErrorText,
  resolveSbtPageCountdownDisplaySeconds,
  resolveSbtPageRecoveryCacheChainId,
  resolveSbtPageSessionSbtAddressCache,
  resolveSbtPageMintEndDisplayState,
  resolveSbtPageShouldRefreshCounts,
  resolveSbtPageUrlAutoMintIntent,
  resolveSbtPageUserAdminStatus,
  resolveSbtPageSessionDisplayConfig,
  resolveSbtPageSessionDisplayLabel,
  resolveSbtAddress,
  resolveSbtAddressString,
  resolveSbtChainId,
  resolveDisplayImageHref,
  resolveSbtPageTokenMetadataHref,
  sanitizeSbtPageMintedTokensOverride,
  shouldRunSbtPagePropListAutoMint,
  shouldRunSbtPagePropPasswordAutoMint,
  normalizeSbtPageCountMap,
  toStringList,
} from './sbtPageHelpers';

type ArweaveRuntimeGlobals = typeof globalThis & {
  CE_ARWEAVE_AR_IO_URL?: unknown;
  CE_ARWEAVE_DIRECT_TO_AR_IO?: unknown;
  CE_ARWEAVE_GATEWAY_URL?: unknown;
  CE_ARWEAVE_GATEWAYS?: unknown;
};

// This broad suite intentionally keeps cross-cutting SBT page helper coverage whose assertions still share broad setup or state-patch ownership.
describe('sbtPageHelpers', () => {
  const arweaveGlobals = globalThis as ArweaveRuntimeGlobals;
  const originalArweaveGlobals = {
    CE_ARWEAVE_AR_IO_URL: arweaveGlobals.CE_ARWEAVE_AR_IO_URL,
    CE_ARWEAVE_DIRECT_TO_AR_IO: arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO,
    CE_ARWEAVE_GATEWAY_URL: arweaveGlobals.CE_ARWEAVE_GATEWAY_URL,
    CE_ARWEAVE_GATEWAYS: arweaveGlobals.CE_ARWEAVE_GATEWAYS,
  };

  afterEach(() => {
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = originalArweaveGlobals.CE_ARWEAVE_AR_IO_URL;
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = originalArweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO;
    arweaveGlobals.CE_ARWEAVE_GATEWAY_URL = originalArweaveGlobals.CE_ARWEAVE_GATEWAY_URL;
    arweaveGlobals.CE_ARWEAVE_GATEWAYS = originalArweaveGlobals.CE_ARWEAVE_GATEWAYS;
  });

  it('normalizes records, string lists, errors, and session routes', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(toStringList(['a', null, 2])).toEqual(['a', '', '2']);
    expect(toStringList('bad')).toEqual([]);
    expect(buildSbtPageInitialState({ network: { id: 84532 } })).toEqual(expect.objectContaining({
      sbtInfo: null,
      userHasSBT: false,
      network: { id: 84532 },
      mintedAddresses: [],
      burnedAddresses: [],
      showStats: true,
      showActions: true,
      loadingMintersBurners: true,
      mintingStatus: 'idle',
      burningStatus: 'idle',
      exportFormat: 'json',
      hasGroupPasswordMint: false,
      hasInviteMint: false,
      docModalOpen: false,
      resolvedSessionSlug: null,
      displayImageFallbackKey: '',
      displayImageFallbackIndex: 0,
    }));
    expect(buildSbtPageBooleanTogglePatch({
      state: { showStats: false },
      stateKey: 'showStats',
    })).toEqual({ showStats: true });
    expect(buildSbtPageBooleanTogglePatch({
      state: { showActions: 'open' },
      stateKey: 'showActions',
    })).toEqual({ showActions: false });
    expect(buildSbtPageAddressChangeResetMintUiPatch({
      sbtAddressChanged: false,
    })).toBeNull();
    expect(buildSbtPageAddressChangeResetMintUiPatch({
      sbtAddressChanged: true,
    })).toEqual({
      showMiniPasswordInput: false,
      mintStep: 0,
      mintingStatus: 'idle',
      burningStatus: 'idle',
      manualPasswordInput: '',
      groupPasswordInput: '',
      mintPassword: '',
      showPasswordAlert: false,
      error: null,
    });
    expect(buildSbtPageNetworkUpdatePatch({
      network: { id: 10 },
      resetMintUiState: {
        network: { id: 1 },
        mintStep: 0,
      },
    })).toEqual({
      network: { id: 10 },
      mintStep: 0,
    });
    expect(buildSbtPageMintFailurePatch({ error: 'Nope' })).toEqual({
      error: 'Nope',
      mintingStatus: 'failure',
    });
    expect(buildSbtPageMintFailurePatch()).toEqual({
      error: null,
      mintingStatus: 'failure',
    });
    expect(buildSbtPageMintPendingPatch()).toEqual({
      mintingStatus: 'pending',
      lastTransactionType: 'mint',
    });
    expect(buildSbtPageMintPendingPatch({ clearError: true })).toEqual({
      mintingStatus: 'pending',
      lastTransactionType: 'mint',
      error: null,
    });
    expect(buildSbtPageMintSuccessPatch({ txHash: '0xmint' })).toEqual({
      mintingStatus: 'success',
      transactionHash: '0xmint',
      lastTransactionType: 'mint',
      lastMintTxHash: '0xmint',
    });
    expect(buildSbtPageMintSuccessPatch({
      clearManualPassword: true,
      mintStep: 3,
      txHash: '0xclaim',
    })).toEqual({
      mintingStatus: 'success',
      transactionHash: '0xclaim',
      lastTransactionType: 'mint',
      lastMintTxHash: '0xclaim',
      mintStep: 3,
      manualPasswordInput: '',
    });
    expect(buildSbtPageBurnFailurePatch({ error: 'Denied' })).toEqual({
      error: 'Denied',
      burningStatus: 'failure',
    });
    expect(buildSbtPageBurnFailurePatch({
      error: 'Denied',
      resetBurnSearch: true,
    })).toEqual({
      error: 'Denied',
      burningStatus: 'failure',
      burnSearchInput: '',
      burnSearchResult: null,
      burnSearchType: null,
    });
    expect(buildSbtPageBurnPendingPatch()).toEqual({
      burningStatus: 'pending',
      lastTransactionType: 'burn',
    });
    expect(buildSbtPageBurnSuccessPatch({ txHash: '0xburn' })).toEqual({
      burningStatus: 'success',
      transactionHash: '0xburn',
      lastTransactionType: 'burn',
      lastBurnTxHash: '0xburn',
    });
    expect(buildSbtPageBurnSuccessPatch({
      resetBurnSearch: true,
      txHash: '0xadminburn',
    })).toEqual({
      burningStatus: 'success',
      transactionHash: '0xadminburn',
      lastTransactionType: 'burn',
      lastBurnTxHash: '0xadminburn',
      burnSearchInput: '',
      burnSearchResult: null,
      burnSearchType: null,
    });
    expect(buildSbtPageBurnSearchInputPatch({ input: '  token  ' })).toEqual({
      burnSearchInput: '  token  ',
      burnSearchResult: null,
      burnSearchType: null,
    });
    expect(buildSbtPageBurnSearchInputPatch({ input: null })).toEqual({
      burnSearchInput: '',
      burnSearchResult: null,
      burnSearchType: null,
    });
    expect(buildSbtPageBurnSearchResultPatch({
      address: '0xOwner',
      resultType: 'tokenId',
      tokenId: '12',
    })).toEqual({
      burnSearchResult: {
        address: '0xOwner',
        tokenId: '12',
      },
      burnSearchType: 'tokenId',
    });
    expect(buildSbtPageErrorPatch({ error: 'Plain error' })).toEqual({
      error: 'Plain error',
    });
    expect(buildSbtPageErrorPatch()).toEqual({
      error: null,
    });
    expect(buildSbtPageCachedPasswordsPatch({ cachedPasswords: ['one'] })).toEqual({
      cachedPasswords: ['one'],
    });
    expect(buildSbtPageMintedModalVisibilityPatch({ visible: true })).toEqual({
      showModal: true,
    });
    expect(buildSbtPageMintedModalVisibilityPatch({ visible: 'true' })).toEqual({
      showModal: false,
    });
    expect(buildSbtPageMintedModalInitialFilterPatch({
      buildAddressListSignature: () => 'holders-signature',
      netHolders: ['0xA'],
    })).toEqual({
      filteredMintedUsers: ['0xA'],
      filteredMintedUsersSignature: 'holders-signature',
      mintingAddressesFilterInitialized: true,
      loadingMintedFilter: false,
    });
    expect(buildSbtPageMintedModalInitialFilterPatch({
      buildAddressListSignature: () => 'empty',
      netHolders: 'bad',
    })).toEqual({
      filteredMintedUsers: [],
      filteredMintedUsersSignature: 'empty',
      mintingAddressesFilterInitialized: true,
      loadingMintedFilter: false,
    });
    expect(buildSbtPageLoadingMintersBurnersPatch({ loading: true })).toEqual({
      loadingMintersBurners: true,
    });
    expect(buildSbtPageLoadInfoLoadingStartPatch()).toEqual({
      loadingMintersBurners: true,
      logScanProgress: null,
    });
    expect(buildSbtPageLoadInfoLoadingStartPatch({
      hasExplicitSlug: true,
      normalizedExplicitSlug: 'alpha',
    })).toEqual({
      loadingMintersBurners: true,
      logScanProgress: null,
      resolvedSessionSlug: 'alpha',
    });
    expect(buildSbtPageMintCountdownPatch({ countdown: '1d 0h 0m 0s' })).toEqual({
      mintCountdown: '1d 0h 0m 0s',
    });
    expect(buildSbtPageMintCountdownPatch()).toEqual({
      mintCountdown: null,
    });
    expect(buildSbtPageIntervalIdPatch({ intervalId: 12 })).toEqual({
      intervalId: 12,
    });
    const info = { name: 'Alpha' };
    expect(buildSbtPageSbtInfoPatch({ sbtInfo: info })).toEqual({
      sbtInfo: info,
    });
    expect(buildSbtPageResolvedSessionSlugPatch({ slug: 'alpha-session' })).toEqual({
      resolvedSessionSlug: 'alpha-session',
    });
    expect(buildSbtPageRelevantInfoPatch({ sbtLabel: 'Badge' })).toEqual({
      relevantQuestions: ['What is the purpose of this Badge?', 'How can I use this Badge?'],
      relevantDocuments: ['Badge Whitepaper', 'Community Guidelines'],
    });
    expect(buildSbtPageRelevantInfoPatch({ sbtLabel: '' })).toEqual({
      relevantQuestions: ['What is the purpose of this SBT?', 'How can I use this SBT?'],
      relevantDocuments: ['SBT Whitepaper', 'Community Guidelines'],
    });
    expect(buildSbtPageLogScanProgressPatch({
      progress: { scanned: 1 },
      slug: 'alpha-session',
    })).toEqual({
      logScanProgress: {
        scanned: 1,
        slug: 'alpha-session',
      },
    });
    expect(buildSbtPageBookmarkedPatch({ bookmarked: true })).toEqual({
      bookmarked: true,
    });
    expect(buildSbtPagePasswordMintInputPatch({
      inputField: 'groupPasswordInput',
      inputValue: 'invite-token',
    })).toEqual({
      groupPasswordInput: 'invite-token',
      mintingStatus: 'idle',
      mintStep: 0,
      error: null,
    });
    expect(buildSbtPagePasswordMintInputPatch({
      inputField: 'manualPasswordInput',
      inputValue: 'claim-code',
    })).toEqual({
      manualPasswordInput: 'claim-code',
      mintingStatus: 'idle',
      mintStep: 0,
      error: null,
    });
    expect(buildSbtPagePasswordMintInputPatch({
      inputField: 'unknown',
      inputValue: null,
    })).toEqual({
      groupPasswordInput: '',
      mintingStatus: 'idle',
      mintStep: 0,
      error: null,
    });
    expect(buildSbtPagePasswordInputValuePatch({
      inputField: 'groupPasswordInput',
      inputValue: 'invite-token',
    })).toEqual({
      groupPasswordInput: 'invite-token',
    });
    expect(buildSbtPagePasswordInputValuePatch({
      inputField: 'manualPasswordInput',
      inputValue: 'claim-code',
    })).toEqual({
      manualPasswordInput: 'claim-code',
    });
    expect(buildSbtPagePasswordInputValuePatch({
      inputField: 'unknown',
      inputValue: null,
    })).toEqual({
      groupPasswordInput: '',
    });
    expect(buildSbtPageMintPasswordPrefillPatch({
      currentGroupPasswordInput: 'existing-group',
      finalPasswordToUse: 'plain-password',
    })).toEqual({
      mintPassword: 'plain-password',
      manualPasswordInput: 'plain-password',
      groupPasswordInput: 'existing-group',
      mintStep: 0,
      showPasswordAlert: true,
    });
    expect(buildSbtPageMintPasswordPrefillPatch({
      currentGroupPasswordInput: 'existing-group',
      finalPasswordToUse: 'invite:raw',
      invitePayload: { inviteCode: 'code-1' },
    })).toEqual({
      mintPassword: '',
      manualPasswordInput: '',
      groupPasswordInput: 'code-1',
      mintStep: 0,
      showPasswordAlert: false,
    });
    expect(buildSbtPageMintPasswordClearPatch()).toEqual({
      mintPassword: '',
      manualPasswordInput: '',
      showPasswordAlert: false,
    });
    expect(buildSbtPagePasswordClaimStartSuccessPatch({ txHash: '0xcommit' })).toEqual({
      mintStep: 1,
      mintingStatus: 'idle',
      transactionHash: '0xcommit',
    });
    const generatedPasswords = ['one', 'two'];
    expect(buildSbtPageAdminInviteSuccessPatch({
      passwordList: generatedPasswords,
    })).toEqual({
      adminGeneratedPasswords: generatedPasswords,
      passwordGenerationCount: '',
    });
    expect(buildSbtPageAdminInviteSuccessPatch({
      passwordList: 'bad',
    })).toEqual({
      adminGeneratedPasswords: [],
      passwordGenerationCount: '',
    });
    expect(buildSbtPageExportFormatPatch({ exportFormat: 'csv' })).toEqual({
      exportFormat: 'csv',
    });
    expect(buildSbtPageExportFormatPatch({ exportFormat: null })).toEqual({
      exportFormat: '',
    });
    expect(buildSbtPageIncludePreviousPasswordsPatch({ includePreviousPasswords: true })).toEqual({
      includePreviousPasswords: true,
    });
    expect(buildSbtPageIncludePreviousPasswordsPatch({ includePreviousPasswords: 'true' })).toEqual({
      includePreviousPasswords: false,
    });
    expect(buildSbtPagePasswordGenerationCountPatch({ value: '12' })).toEqual({
      passwordGenerationCount: 12,
    });
    expect(buildSbtPagePasswordGenerationCountPatch({ value: '' })).toEqual({
      passwordGenerationCount: '',
    });
    expect(buildSbtPageCopiedAddressPatch({ addressType: 'contract' })).toEqual({
      copiedAddress: 'contract',
    });
    expect(buildSbtPageCopiedAddressPatch()).toEqual({
      copiedAddress: null,
    });
    expect(buildSbtPageCopiedErrorPatch({ copied: true })).toEqual({
      copiedError: true,
    });
    expect(buildSbtPageCopiedErrorPatch({ copied: 1 })).toEqual({
      copiedError: false,
    });
    expect(buildSbtPageMiniPasswordInputPatch({ visible: true })).toEqual({
      showMiniPasswordInput: true,
    });
    expect(buildSbtPageMiniPasswordInputPatch({ visible: 'true' })).toEqual({
      showMiniPasswordInput: false,
    });
    expect(buildSbtPageDocModalResetPatch()).toEqual({
      docModalOpen: false,
      docModalLoading: false,
      docModalError: '',
      docModalContent: '',
      docModalName: '',
      docModalBlobUrl: '',
    });
    expect(buildSbtPageDocModalOpenPatch({
      loading: true,
      name: 'Decrypting',
    })).toEqual({
      docModalOpen: true,
      docModalLoading: true,
      docModalError: '',
      docModalContent: '',
      docModalName: 'Decrypting',
      docModalBlobUrl: '',
    });
    expect(buildSbtPageDocModalOpenPatch({
      error: 'Connect first.',
      name: 'Encrypted document',
    })).toEqual({
      docModalOpen: true,
      docModalLoading: false,
      docModalError: 'Connect first.',
      docModalContent: '',
      docModalName: 'Encrypted document',
      docModalBlobUrl: '',
    });
    expect(buildSbtPageDocModalContentPatch({
      blobUrl: 'blob:doc',
      content: null,
      error: undefined,
      name: 'Payload',
    })).toEqual({
      docModalLoading: false,
      docModalError: '',
      docModalContent: '',
      docModalName: 'Payload',
      docModalBlobUrl: 'blob:doc',
    });
    expect(buildSbtPageDocModalErrorPatch({ error: 'Failed' })).toEqual({
      docModalLoading: false,
      docModalError: 'Failed',
    });
    expect(coerceSbtPageStringArrayValue(['a', null, 2])).toEqual(['a', 'null', '2']);
    expect(coerceSbtPageStringArrayValue(' ["a",2] ')).toEqual(['a', '2']);
    expect(coerceSbtPageStringArrayValue(' not json ')).toEqual(['not json']);
    expect(coerceSbtPageStringArrayValue('')).toEqual([]);
    expect(coerceSbtPageStringArrayValue({})).toEqual([]);
    expect(buildSbtPageEncryptedEnvelopeFingerprint({
      nameEnvelope: {},
      tagsEnvelope: 'tags',
      imageEnvelope: null,
    })).toBe('nt');
    expect(buildSbtPageEncryptedEnvelopeDecryptKey({
      metaKey: 'meta',
      activeAccount: '0xA',
      envelopeFingerprint: 'nt',
    })).toBe('meta:0xA:nt');
    expect(resolveSbtPageCachedGroupPasswordHash({
      preferCountsOnly: true,
      groupPasswordHashLoaded: true,
      groupPasswordHash: '0xhash',
    })).toEqual({
      groupPasswordHash: '0xhash',
      shouldReuseCachedGroupPasswordHash: true,
    });
    expect(resolveSbtPageCachedGroupPasswordHash({
      preferCountsOnly: false,
      groupPasswordHashLoaded: true,
      groupPasswordHash: '0xhash',
    })).toEqual({
      groupPasswordHash: null,
      shouldReuseCachedGroupPasswordHash: false,
    });
    expect(resolveSbtPageGroupPasswordMintState({
      groupPasswordHash: '0xhash',
      hashZero: '0x0',
      hasPasswordMint: true,
    })).toEqual({
      hasGroupHash: true,
      hasInviteMint: true,
      hasGroupPasswordMint: false,
    });
    expect(resolveSbtPageGroupPasswordMintState({
      groupPasswordHash: '0xhash',
      hashZero: '0x0',
      hasPasswordMint: false,
    })).toEqual({
      hasGroupHash: true,
      hasInviteMint: false,
      hasGroupPasswordMint: true,
    });
    expect(resolveSbtPageGroupPasswordMintState({
      groupPasswordHash: '0x0',
      hashZero: '0x0',
      hasPasswordMint: true,
    })).toEqual({
      hasGroupHash: false,
      hasInviteMint: false,
      hasGroupPasswordMint: false,
    });
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getErrorMessage({ message: 'plain' }, 'fallback')).toBe('plain');
    expect(getErrorMessage('', 'fallback')).toBe('fallback');
    expect(resolveSbtPageCopyableErrorText('plain error')).toBe('plain error');
    expect(resolveSbtPageCopyableErrorText({ message: 'object error' })).toBe('object error');
    expect(resolveSbtPageCopyableErrorText('')).toBe('');
    expect(buildSessionRoutePath(' Edge Session ', '/base/')).toBe('/base/session/Edge%20Session');
  });

  it('normalizes SBT history summaries and epoch second values', () => {
    expect(coerceSbtPageEpochSeconds(1710000000000)).toBe(1710000000);
    expect(coerceSbtPageEpochSeconds('42')).toBe(42);
    expect(coerceSbtPageEpochSeconds(-1)).toBe(0);
    expect(coerceSbtPageEpochSeconds('bad')).toBe(0);

    expect(normalizeSbtPageHistorySummary({
      totalMinted: '0005',
      totalBurned: 1,
      activeSupply: '004',
      currentHolderCount: '4',
      historicalHolderCount: '005',
    })).toEqual({
      totalMinted: '5',
      totalBurned: '1',
      activeSupply: '4',
      currentHolderCount: '4',
      historicalHolderCount: '5',
    });
    expect(normalizeSbtPageHistorySummary({
      totalMinted: '5',
      totalBurned: 'not-a-number',
      activeSupply: '4',
      currentHolderCount: '4',
      historicalHolderCount: '5',
    })).toBeNull();
    expect(normalizeSbtPageHistorySummary(null)).toBeNull();
  });

  it('applies SBT history summary fallbacks without clobbering existing state on invalid values', () => {
    expect(applySbtPageHistorySummaryFallback({
      summaryValue: { currentHolderCount: '04', totalMinted: '0007' },
      sourceLabel: 'summary-cache',
    })).toEqual({
      mintedTokensOverride: '4',
      mintedTokensSource: 'summary-cache',
      ownerLookupUpperBound: '7',
    });

    expect(applySbtPageHistorySummaryFallback({
      mintedTokensOverride: '3',
      mintedTokensSource: 'summary-group',
      ownerLookupUpperBound: '8',
      summaryValue: { currentHolderCount: 'bad', totalMinted: null },
      sourceLabel: 'ignored',
    })).toEqual({
      mintedTokensOverride: '3',
      mintedTokensSource: 'summary-group',
      ownerLookupUpperBound: '8',
    });
  });

  it('detects whether cached SBT metadata still needs token URI hydration', () => {
    const complete = {
      tokenURI: 'ar://Sng0VG2vetgNPITw5mtvt6om-fBCNu3KI5GZAYeEttY',
      image: 'https://example.test/badge.png',
      mintingEndTime: 0,
      burnAuth: 0,
      hasPasswordMint: false,
      maxTokens: '0',
      admin: '0x00000000000000000000000000000000000000a2',
    };

    expect(needsSbtPageTokenUriFields(complete)).toBe(false);
    expect(needsSbtPageTokenUriFields({
      ...complete,
      documentURLs: [],
    })).toBe(false);
    expect(needsSbtPageTokenUriFields({
      ...complete,
      image: '',
      documentURLs: [],
      encryptedFields: { image: { ciphertext: 'locked' } },
    })).toBe(false);
    expect(needsSbtPageTokenUriFields({
      ...complete,
      docURL: 'https://example.test/source',
    })).toBe(false);
    expect(needsSbtPageTokenUriFields({
      ...complete,
      admin: '0x0000000000000000000000000000000000000000',
    })).toBe(true);
    expect(needsSbtPageTokenUriFields({
      ...complete,
      tokenURI: '',
    })).toBe(true);
    expect(needsSbtPageTokenUriFields(null)).toBe(true);

    expect(needsSbtPageDirectMetadataHydration({})).toBe(true);
    expect(needsSbtPageDirectMetadataHydration(complete)).toBe(false);
    expect(needsSbtPageDirectMetadataHydration(null)).toBe(true);
  });

  it('resolves SBT addresses and chain ids from direct and list-shaped props', () => {
    expect(resolveSbtAddress('0xA')).toBe('0xA');
    expect(resolveSbtAddress({ sbtAddress: '0xB' })).toBe('0xB');
    expect(resolveSbtAddress([{ nope: 'x' }, { sbtAddress: '0xC' }])).toBe('0xC');
    expect(resolveSbtAddressString({ sbtAddress: '0xD' })).toBe('0xD');
    expect(getCurrentSbtAddressInfo({ SBTAddress: '0xAbC' })).toEqual({
      original: '0xAbC',
      lower: '0xabc',
    });
    expect(getCurrentSbtAddressInfo({
      SBTAddress: [{ nope: 'x' }, { sbtAddress: '0xDef' }],
    })).toEqual({
      original: '0xDef',
      lower: '0xdef',
    });
    expect(resolveSbtChainId({ chainID: '84532' })).toBe(84532);
    expect(resolveSbtChainId([{ chainId: 0 }, { chainId: 10 }])).toBe(10);
    expect(resolveSbtChainId('bad')).toBeNull();
  });

  it('resolves address-link renderability without changing zero-address guards', () => {
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const validAddress = ' 0x1111111111111111111111111111111111111111 ';
    const isAddress = jest.fn((value: string) => value.startsWith('0x1111'));

    expect(resolveSbtPageAddressLinkState({ address: validAddress, isAddress, zeroAddress })).toEqual({
      isRenderable: true,
      isZeroAddress: false,
      normalized: validAddress.trim(),
    });
    expect(resolveSbtPageAddressLinkState({ address: zeroAddress, isAddress, zeroAddress })).toEqual({
      isRenderable: false,
      isZeroAddress: true,
      normalized: zeroAddress,
    });
    expect(resolveSbtPageAddressLinkState({ address: '0x2222', isAddress, zeroAddress })).toMatchObject({
      isRenderable: false,
      isZeroAddress: false,
      normalized: '0x2222',
    });
    expect(resolveSbtPageAddressLinkState({ address: '', isAddress, zeroAddress })).toMatchObject({
      isRenderable: false,
      normalized: '',
    });
  });

  it('resolves active and recovery chain ids by page precedence', () => {
    const getSessionChainId = jest.fn((slug: string) => (slug === 'alpha' ? 11155420 : null));

    expect(resolveSbtPageActiveChainId({
      getSessionChainId,
      propNetwork: { id: 10 },
      sbtInfo: { chainID: 84532 },
      sessionSlug: 'alpha',
      stateNetwork: { id: 84532 },
    })).toBe(84532);
    expect(resolveSbtPageActiveChainId({
      getSessionChainId,
      propNetwork: { id: 10 },
      sbtInfo: { chainID: 84532 },
      sessionSlug: 'alpha',
      stateNetwork: { id: 0 },
    })).toBe(10);
    expect(resolveSbtPageActiveChainId({
      getSessionChainId,
      sbtInfo: { chainId: '84532' },
      sessionSlug: 'alpha',
    })).toBe(84532);
    expect(resolveSbtPageActiveChainId({
      getSessionChainId,
      sessionSlug: 'alpha',
    })).toBe(11155420);
    expect(resolveSbtPageActiveChainId()).toBeNull();

    expect(resolveSbtPageRecoveryCacheChainId({
      getSessionChainId,
      propNetwork: { id: 10 },
      propSBTAddress: { chainId: 11155420 },
      sbtInfo: { chainID: 84532 },
      sessionSlug: 'alpha',
    })).toBe(84532);
    expect(resolveSbtPageRecoveryCacheChainId({
      getSessionChainId,
      propNetwork: { id: 10 },
      propSBTAddress: { chainId: 11155420 },
      sessionSlug: 'alpha',
    })).toBe(11155420);
    expect(resolveSbtPageRecoveryCacheChainId({
      getSessionChainId,
      propNetwork: { id: 10 },
      sessionSlug: 'alpha',
    })).toBe(11155420);
    expect(resolveSbtPageRecoveryCacheChainId({
      getSessionChainId: () => null,
      propNetwork: { id: 10 },
    })).toBe(10);
  });

  it('derives cache net keys and direct metadata contexts from slug and chain hints', () => {
    const getSessionChainId = jest.fn((slug: unknown) => (
      String(slug || '').trim().toLowerCase() === 'alpha' ? 11155420 : null
    ));

    expect(deriveSbtPageCacheNetKey({
      currentNetwork: { id: 10 },
      getSessionChainId,
      infoHint: { chainID: 84532 },
      netKeyHint: 777,
      slugForCache: 'alpha',
    })).toBe('11155420');
    expect(deriveSbtPageCacheNetKey({
      currentNetwork: { id: 10 },
      getSessionChainId,
      infoHint: { chainId: '84532' },
      slugForCache: 'missing',
    })).toBe('84532');
    expect(deriveSbtPageCacheNetKey({
      currentNetwork: { id: 10 },
      getSessionChainId,
      netKeyHint: '84532',
      slugForCache: 'missing',
    })).toBe('84532');
    expect(deriveSbtPageCacheNetKey({
      currentNetwork: { id: 10 },
      getSessionChainId,
      slugForCache: 'missing',
    })).toBe('10');
    expect(deriveSbtPageCacheNetKey()).toBe('');

    expect(buildSbtPageDirectMetadataContext({
      currentNetwork: { id: 10 },
      getSessionChainId,
      infoHint: { chainID: 84532 },
      slugForRead: ' Alpha ',
    })).toEqual({ slug: 'Alpha', networkChainId: 11155420 });
    expect(buildSbtPageDirectMetadataContext({
      infoHint: { chainId: '84532' },
      slugForRead: '',
    })).toEqual({ networkChainId: 84532 });
    expect(buildSbtPageDirectMetadataContext()).toBe('');
  });

  it('reads SBT page cache buckets and folds legacy numeric net keys into the active key', async () => {
    const legacyNode = { sbtList: { '0xsbt': { slug: 'alpha' } } };
    const readCache = jest.fn(async () => ({
      '084532': legacyNode,
    }));

    await expect(readSbtPageCacheBySlug({
      netKeyForCache: '84532',
      readCache,
      slugForCache: 'alpha',
    })).resolves.toEqual({
      '084532': legacyNode,
      '84532': legacyNode,
    });
    expect(readCache).toHaveBeenCalledWith('sbtCache', 'alpha');

    await expect(readSbtPageCacheBySlug({
      netKeyForCache: '84532',
      readCache: () => {
        throw new Error('cache unavailable');
      },
      slugForCache: null,
    })).resolves.toEqual({});
  });

  it('finds cached SBT entries across session cache namespaces with exclusion support', () => {
    const addressLower = '0x00000000000000000000000000000000000000aa';
    const alphaEntry = { slug: ' Alpha ', sbtInfo: { name: 'Alpha' } };
    const betaEntry = { sbtInfo: { name: 'Beta' } };
    const listNamespaceEntriesSync = jest.fn(() => [
      {
        slug: 'alpha',
        value: {
          84532: {
            sbtList: {
              [addressLower]: alphaEntry,
            },
          },
        },
      },
      {
        slug: 'beta',
        value: {
          11155420: {
            sbtList: {
              [addressLower]: betaEntry,
            },
          },
        },
      },
    ]);

    expect(findSbtPageCachedEntryAcrossGroups({
      addressLower: addressLower.toUpperCase(),
      listNamespaceEntriesSync,
    })).toEqual({
      slug: 'Alpha',
      entry: alphaEntry,
      netKey: '84532',
    });
    expect(findSbtPageCachedEntryAcrossGroups({
      addressLower,
      excludeSlug: 'alpha',
      listNamespaceEntriesSync,
    })).toEqual({
      slug: 'beta',
      entry: betaEntry,
      netKey: '11155420',
    });
    expect(findSbtPageCachedEntryAcrossGroups({
      addressLower,
      listNamespaceEntriesSync: () => {
        throw new Error('cache unavailable');
      },
    })).toBeNull();
  });

  it('resolves metadata hydration ownership flags', () => {
    const refreshSbtData = jest.fn();

    expect(resolveSbtPageMetadataHydrationMode({
      forceEventFetch: false,
      isSBTCacheReady: false,
      refreshSbtData,
    })).toEqual({
      usingCentralHydration: true,
      parentOwnsInitialRefresh: true,
    });
    expect(resolveSbtPageMetadataHydrationMode({
      forceEventFetch: true,
      isSBTCacheReady: false,
      refreshSbtData,
    })).toEqual({
      usingCentralHydration: true,
      parentOwnsInitialRefresh: false,
    });
    expect(resolveSbtPageMetadataHydrationMode({
      forceEventFetch: false,
      isSBTCacheReady: false,
      refreshSbtData: null,
    })).toEqual({
      usingCentralHydration: false,
      parentOwnsInitialRefresh: false,
    });
  });

  it('builds forced SBT refresh options', () => {
    const onProgress = jest.fn();

    expect(buildSbtPageRefreshOptions({
      forceEventFetch: false,
      onProgress,
      preferCountsOnly: true,
    })).toBeUndefined();
    expect(buildSbtPageRefreshOptions({
      forceEventFetch: true,
    })).toEqual({ forceCounts: true });
    expect(buildSbtPageRefreshOptions({
      forceEventFetch: true,
      onProgress,
      preferCountsOnly: true,
    })).toEqual({
      forceCounts: true,
      countsOnly: true,
      onProgress,
    });
    expect(resolveSbtPageShouldRefreshCounts({
      burnedAddresses: [],
      countsLoaded: false,
      forceEventFetch: false,
      mintedAddresses: [],
      mintedTokensOverride: null,
    })).toBe(true);
    expect(resolveSbtPageShouldRefreshCounts({
      burnedAddresses: [],
      countsLoaded: true,
      forceEventFetch: false,
      mintedAddresses: [],
      mintedTokensOverride: null,
    })).toBe(false);
    expect(resolveSbtPageShouldRefreshCounts({
      burnedAddresses: [],
      countsLoaded: true,
      forceEventFetch: true,
      mintedAddresses: ['0x1'],
      mintedTokensOverride: { '0x1': 1 },
    })).toBe(true);
    expect(resolveSbtPageShouldRefreshCounts({
      burnedAddresses: [],
      countsLoaded: false,
      forceEventFetch: false,
      mintedAddresses: [],
      mintedTokensOverride: { total: 1 },
    })).toBe(false);
    expect(resolveSbtPageOwnerLookupFallbackDecision({
      burnedAddresses: [],
      countsLoaded: false,
      mintedAddresses: [],
      ownerLookupTokenCount: 3,
      preferCountsOnly: false,
      requireCountsNotLoaded: true,
    })).toBe(true);
    expect(resolveSbtPageOwnerLookupFallbackDecision({
      burnedAddresses: [],
      countsLoaded: true,
      mintedAddresses: [],
      ownerLookupTokenCount: 3,
      preferCountsOnly: false,
      requireCountsNotLoaded: true,
    })).toBe(false);
    expect(resolveSbtPageOwnerLookupFallbackDecision({
      burnedAddresses: [],
      mintedAddresses: ['0x1'],
      ownerLookupTokenCount: 3,
      preferCountsOnly: false,
    })).toBe(false);
    expect(resolveSbtPageOwnerLookupFallbackDecision({
      burnedAddresses: [],
      mintedAddresses: [],
      ownerLookupTokenCount: 3,
      preferCountsOnly: true,
    })).toBe(false);
    expect(resolveSbtPageOwnerLookupFallbackDecision({
      burnedAddresses: [],
      mintedAddresses: [],
      ownerLookupTokenCount: 0,
      preferCountsOnly: false,
    })).toBe(false);
    expect(resolveSbtPageOwnerLookupTokenCount({
      mintedTokensOverride: '7',
      ownerLookupUpperBound: '5',
    })).toBe(5);
    expect(resolveSbtPageOwnerLookupTokenCount({
      mintedTokensOverride: '7',
      ownerLookupUpperBound: 'bad',
    })).toBe(7);
    expect(resolveSbtPageOwnerLookupTokenCount({
      mintedTokensOverride: null,
      ownerLookupUpperBound: null,
    })).toBeNaN();
  });

  it('builds primary metadata state patches with admin status', () => {
    expect(resolveSbtPageUserAdminStatus({
      account: '0xAdmin',
      sbtInfo: { admin: '0xadmin' },
    })).toBe(true);
    expect(resolveSbtPageUserAdminStatus({
      account: '0xAdmin',
      sbtInfo: { admin_: '0xother' },
    })).toBe(false);
    expect(resolveSbtPageUserAdminStatus({
      account: '',
      sbtInfo: { admin: '0xadmin' },
    })).toBe('');
    const nextInfo = { admin: '0xAdmin' };
    expect(buildSbtPagePrimaryMetadataStatePatch({
      account: '0xadmin',
      extraState: { loadingMintersBurners: false },
      nextSbtInfo: nextInfo,
      prevSbtInfo: { stale: true },
    })).toEqual({
      sbtInfo: nextInfo,
      userIsSbtAdmin: true,
      loadingMintersBurners: false,
    });
    expect(buildSbtPagePrimaryMetadataStatePatch({
      account: '0xadmin',
      nextSbtInfo: { admin_: '0xOther' },
      prevSbtInfo: { stale: true },
    })).toEqual({
      sbtInfo: { admin_: '0xOther' },
      userIsSbtAdmin: false,
    });
    expect(buildSbtPagePrimaryMetadataStatePatch({
      account: '0xadmin',
      nextSbtInfo: null,
      prevSbtInfo: { stale: true },
    })).toEqual({
      sbtInfo: { stale: true },
      userIsSbtAdmin: '',
    });
  });

  it('builds account-derived holder and admin state patches', () => {
    const holder = '0x00000000000000000000000000000000000000aa';
    const other = '0x00000000000000000000000000000000000000bb';

    expect(buildSbtPageAccountDerivedStatePatch({
      account: holder,
      state: {
        mintedAddresses: [holder, holder, other],
        burnedAddresses: [holder],
        sbtInfo: { admin_: holder },
        userHasSBT: false,
        userIsSbtAdmin: false,
      },
    })).toEqual({
      userHasSBT: true,
      userIsSbtAdmin: true,
    });

    expect(buildSbtPageAccountDerivedStatePatch({
      account: holder,
      state: {
        mintedAddresses: [holder],
        burnedAddresses: [],
        sbtInfo: { admin: other },
        userHasSBT: true,
        userIsSbtAdmin: false,
      },
    })).toBeNull();

    expect(buildSbtPageAccountDerivedStatePatch({
      account: '',
      state: {
        mintedAddresses: [holder],
        burnedAddresses: [],
        sbtInfo: { admin: holder },
        userHasSBT: true,
        userIsSbtAdmin: true,
      },
    })).toEqual({
      userHasSBT: false,
      userIsSbtAdmin: '',
    });
  });

  it('builds local mint success holder patches', () => {
    const holder = '0x00000000000000000000000000000000000000aa';
    const other = '0x00000000000000000000000000000000000000bb';

    expect(buildSbtPageLocalMintSuccessPatch({
      addrLower: holder,
      prevState: {
        mintedAddresses: [other],
        burnedAddresses: [holder, other],
      },
    })).toEqual({
      mintedAddresses: [other, holder],
      burnedAddresses: [other],
      userHasSBT: true,
    });

    expect(buildSbtPageLocalMintSuccessPatch({
      addrLower: '',
      prevState: {
        mintedAddresses: [other],
        burnedAddresses: [holder],
      },
    })).toBeNull();
  });

  it('builds local burn success holder patches', () => {
    const holder = '0x00000000000000000000000000000000000000aa';
    const other = '0x00000000000000000000000000000000000000bb';

    expect(buildSbtPageLocalBurnSuccessPatch({
      addrLower: holder,
      prevState: {
        mintedAddresses: [holder, other],
        burnedAddresses: [],
        filteredMintedUsers: [holder, other],
        showModal: true,
      },
    })).toEqual({
      burnedAddresses: [holder],
      userHasSBT: false,
      filteredMintedUsers: [other],
      filteredMintedUsersSignature: buildSbtPageHolderListSignature([other]),
    });

    expect(buildSbtPageLocalBurnSuccessPatch({
      addrLower: holder,
      prevState: {
        mintedAddresses: [holder],
        burnedAddresses: [],
        filteredMintedUsers: [holder],
        filteredMintedUsersSignature: 'prev',
      },
    })).toEqual({
      burnedAddresses: [holder],
      userHasSBT: false,
      filteredMintedUsers: [],
      filteredMintedUsersSignature: buildSbtPageHolderListSignature([]),
    });

    expect(buildSbtPageLocalBurnSuccessPatch({
      addrLower: holder,
      prevState: {
        mintedAddresses: [holder],
        burnedAddresses: [],
        filteredMintedUsersSignature: 'prev',
      },
    })).toEqual({
      burnedAddresses: [holder],
      userHasSBT: false,
      filteredMintedUsers: [],
      filteredMintedUsersSignature: 'prev',
    });
  });

  it('resolves mint end display states', () => {
    const futureUnix = 1900000000;
    const pastUnix = 1700000000;
    expect(resolveSbtPageMintEndDisplayState({
      nowMs: 1800000000000,
      sbtInfo: { mintingEndTime: futureUnix },
    })).toEqual({
      fullMintEndDate: new Date(futureUnix * 1000).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'active',
      unixTS: futureUnix,
    });
    expect(resolveSbtPageMintEndDisplayState({
      nowMs: 1800000000000,
      sbtInfo: { mintingEndTime: pastUnix },
    })).toEqual({
      fullMintEndDate: new Date(pastUnix * 1000).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'expired',
      unixTS: pastUnix,
    });
    expect(resolveSbtPageMintEndDisplayState({
      sbtInfo: { mintingEndTime: 0 },
    })).toEqual({
      fullMintEndDate: '',
      status: 'never',
      unixTS: 0,
    });
    expect(resolveSbtPageMintEndDisplayState({
      sbtInfo: { mintingEndTime: null },
    })).toBeNull();
    expect(resolveSbtPageMiniMintState({
      burningStatus: 'idle',
      mintingStatus: 'success',
      nowSec: 1800000000,
      sbtAddress: '0xABC',
      sbtInfo: { mintingEndTime: 1900000000 },
      userHasSBT: false,
    })).toEqual({
      hasTokenMini: true,
      isMintingActive: true,
      justJoined: true,
      mintStatusId: 'mintStatus-0xabc',
      shouldRenderEndedIndicator: false,
      shouldRenderLiveIndicator: true,
    });
    expect(resolveSbtPageMiniMintState({
      burningStatus: 'success',
      mintingStatus: 'success',
      nowSec: 1800000000,
      sbtAddress: '0xABC',
      sbtInfo: { mintingEndTime: 1700000000 },
      userHasSBT: false,
    })).toMatchObject({
      hasTokenMini: false,
      isMintingActive: false,
      justJoined: false,
      shouldRenderEndedIndicator: true,
      shouldRenderLiveIndicator: false,
    });
    expect(resolveSbtPageMiniMintState({
      nowSec: 1800000000,
      sbtInfo: { mintingEndTime: 0 },
      userHasSBT: true,
    })).toMatchObject({
      hasTokenMini: true,
      isMintingActive: true,
    });
    expect(resolveSbtPageMiniActionFailureState({
      hasTokenMini: false,
      mintingStatus: 'failure',
    })).toEqual({
      showBurnFailedStatus: false,
      showMintFailedStatus: true,
    });
    expect(resolveSbtPageMiniActionFailureState({
      burningStatus: 'failure',
      hasTokenMini: true,
      mintingStatus: 'success',
    })).toEqual({
      showBurnFailedStatus: true,
      showMintFailedStatus: false,
    });
    expect(resolveSbtPageMiniActionFailureState({
      burningStatus: 'failure',
      hasTokenMini: false,
      mintingStatus: 'failure',
    })).toEqual({
      showBurnFailedStatus: false,
      showMintFailedStatus: true,
    });
  });

  it('resolves mini-card mint flow display states', () => {
    expect(resolveSbtPageMiniMintFlowDisplayState({
      hasGroupPasswordMint: true,
      hasInviteMint: true,
      isMintingActive: true,
      miniMintable: true,
      showMiniPasswordInput: false,
    })).toMatchObject({
      shouldRenderGroupPasswordDisclosureButton: true,
      shouldRenderInviteDisclosureButton: false,
      shouldRenderOpenMintButton: false,
    });
    expect(resolveSbtPageMiniMintFlowDisplayState({
      hasGroupPasswordMint: true,
      isMintingActive: true,
      miniMintable: true,
      showMiniPasswordInput: true,
    })).toMatchObject({
      shouldRenderGroupPasswordDisclosureButton: false,
      shouldRenderGroupPasswordInput: true,
    });
    expect(resolveSbtPageMiniMintFlowDisplayState({
      hasInviteMint: true,
      isMintingActive: true,
      miniMintable: true,
      showMiniPasswordInput: true,
    })).toMatchObject({
      shouldRenderInviteDisclosureButton: false,
      shouldRenderInviteInput: true,
    });
    expect(resolveSbtPageMiniMintFlowDisplayState({
      hasPasswordMint: true,
      isMintingActive: true,
      miniMintable: true,
      mintStep: 0,
      showMiniPasswordInput: false,
    })).toMatchObject({
      shouldRenderManualPasswordDisclosureButton: true,
      shouldRenderManualPasswordStartInput: false,
    });
    expect(resolveSbtPageMiniMintFlowDisplayState({
      hasPasswordMint: true,
      isMintingActive: true,
      miniMintable: true,
      mintStep: 2,
      showMiniPasswordInput: false,
    })).toMatchObject({
      shouldRenderManualPasswordFinishInput: true,
      shouldRenderManualPasswordStartInput: false,
    });
    expect(resolveSbtPageMiniMintFlowDisplayState({
      hasPasswordMint: true,
      isMintingActive: true,
      miniMintable: true,
      mintStep: 4,
    })).toMatchObject({
      shouldRenderManualClaimSuccess: true,
      shouldRenderOpenMintButton: false,
    });
    expect(resolveSbtPageMiniMintFlowDisplayState({
      isMintingActive: true,
      miniMintable: true,
    })).toMatchObject({
      shouldRenderOpenMintButton: true,
    });
    expect(resolveSbtPageMiniMintFlowDisplayState({
      isMintingActive: false,
      miniMintable: true,
    })).toMatchObject({
      shouldRenderOpenMintButton: false,
    });
  });

  it('scales active block time with a safe multiplier', () => {
    const getChainBlockTimeMs = jest.fn(() => 2000);

    expect(resolveSbtPageActiveBlockTimeMs({
      activeChainId: 84532,
      getChainBlockTimeMs,
      multiplier: 2.5,
    })).toBe(5000);
    expect(resolveSbtPageActiveBlockTimeMs({
      activeChainId: 84532,
      getChainBlockTimeMs,
      multiplier: 'bad',
    })).toBe(2000);
    expect(getChainBlockTimeMs).toHaveBeenCalledWith(84532);
  });

  it('coerces claim countdown milliseconds to display seconds', () => {
    expect(resolveSbtPageCountdownDisplaySeconds(5000)).toBe(5);
    expect(resolveSbtPageCountdownDisplaySeconds(4999)).toBe(5);
    expect(resolveSbtPageCountdownDisplaySeconds(0)).toBe(0);
    expect(resolveSbtPageCountdownDisplaySeconds(-1)).toBe(0);
    expect(resolveSbtPageCountdownDisplaySeconds('bad')).toBeNaN();
    expect(buildSbtPageClaimCountdownTickPatch({
      remainingMs: 4001,
    })).toEqual({
      claimCountdown: 5,
    });
    expect(buildSbtPageClaimCountdownCompletePatch({
      waitMs: 5000,
    })).toEqual({
      mintStep: 2,
      claimCountdown: 5,
    });
  });

  it('builds session SBT address lists and cache keys from page context', () => {
    const result = buildSbtPageSessionSbtAddresses({
      stateSbtAddress: '0x00000000000000000000000000000000000000AA',
      routeSbtAddress: '0x00000000000000000000000000000000000000bb',
      propSBTAddress: { sbtAddress: '0x00000000000000000000000000000000000000cc' },
      sessionSlug: 'Example',
      sessionConfig: {
        defaultFeaturedSBTs: [
          '0x00000000000000000000000000000000000000d1',
          '0x00000000000000000000000000000000000000AA',
          'not-an-address',
        ],
        featured_SBTs_LIST: [
          '0x00000000000000000000000000000000000000E2',
          '',
        ],
      },
    });

    expect(result.addresses).toEqual([
      '0x00000000000000000000000000000000000000aa',
      '0x00000000000000000000000000000000000000bb',
      '0x00000000000000000000000000000000000000cc',
      '0x00000000000000000000000000000000000000d1',
      '0x00000000000000000000000000000000000000e2',
    ]);
    expect(result.cacheKey).toBe([
      '0x00000000000000000000000000000000000000aa',
      '0x00000000000000000000000000000000000000bb',
      '0x00000000000000000000000000000000000000cc',
      'example',
      '0x00000000000000000000000000000000000000d1,0x00000000000000000000000000000000000000aa,not-an-address',
      '0x00000000000000000000000000000000000000e2',
    ].join('|'));

    const previousAddresses = ['0x00000000000000000000000000000000000000ff'];
    const reused = resolveSbtPageSessionSbtAddressCache({
      addresses: result.addresses,
      cacheKey: result.cacheKey,
      previousAddresses,
      previousCacheKey: result.cacheKey,
    });
    expect(reused).toEqual({
      addresses: previousAddresses,
      cacheKey: result.cacheKey,
      reusedPrevious: true,
    });
    expect(reused.addresses).toBe(previousAddresses);

    const refreshed = resolveSbtPageSessionSbtAddressCache({
      addresses: result.addresses,
      cacheKey: result.cacheKey,
      previousAddresses,
      previousCacheKey: 'old-cache-key',
    });
    expect(refreshed).toEqual({
      addresses: result.addresses,
      cacheKey: result.cacheKey,
      reusedPrevious: false,
    });
    expect(refreshed.addresses).toBe(result.addresses);

    const memoState = buildSbtPageSessionSbtAddressesMemoState({
      stateSbtAddress: '0x00000000000000000000000000000000000000AA',
      routeSbtAddress: '0x00000000000000000000000000000000000000bb',
      propSBTAddress: { sbtAddress: '0x00000000000000000000000000000000000000cc' },
      sessionSlug: 'Example',
      sessionConfig: {
        defaultFeaturedSBTs: [
          '0x00000000000000000000000000000000000000d1',
          '0x00000000000000000000000000000000000000AA',
          'not-an-address',
        ],
        featured_SBTs_LIST: [
          '0x00000000000000000000000000000000000000E2',
          '',
        ],
      },
      previousAddresses,
      previousCacheKey: result.cacheKey,
    });
    expect(memoState).toEqual({
      addresses: previousAddresses,
      cacheKey: result.cacheKey,
      reusedPrevious: true,
    });
    expect(memoState.addresses).toBe(previousAddresses);
  });

  it('builds load-SBT-info request keys from address, session, network, account, and cache revision', () => {
    expect(buildSbtPageLoadInfoRequestKey({
      account: '0x00000000000000000000000000000000000000Ff',
      activeSlug: ' Example Session ',
      network: { id: '11155420' },
      sbtAddressInput: [{ nope: 'x' }, { sbtAddress: '0x00000000000000000000000000000000000000Aa' }],
      sbtCacheRevision: '7',
    })).toBe([
      '0x00000000000000000000000000000000000000aa',
      'Example Session',
      '11155420',
      '0x00000000000000000000000000000000000000ff',
      '7',
    ].join('|'));

    expect(buildSbtPageLoadInfoRequestKey({
      account: null,
      activeSlug: null,
      network: { id: 'bad' },
      sbtAddressInput: null,
      sbtCacheRevision: 'bad',
    })).toBe('||0||0');
    expect(buildSbtPageLoadInfoStartLogContext({
      account: '0x00000000000000000000000000000000000000Ff',
      addrLower: '0x00000000000000000000000000000000000000aa',
      forceEventFetch: true,
      initialSlug: 'example',
      network: { id: 84532 },
      normalizedExplicitSlug: null,
      preferCountsOnly: false,
      sbtAddressOriginalCase: '0x00000000000000000000000000000000000000AA',
    })).toEqual({
      address: '0x00000000000000000000000000000000000000AA',
      addrLower: '0x00000000000000000000000000000000000000aa',
      explicitSlug: null,
      initialSlug: 'example',
      forceEventFetch: true,
      preferCountsOnly: false,
      account: '0x00000000000000000000000000000000000000ff',
      networkId: 84532,
    });
  });

  it('builds open-mint auto-join URLs only for ungated SBTs', () => {
    const sbtAddress = '0x00000000000000000000000000000000000000a1';
    const baseArgs = {
      basePath: '/ce/',
      origin: 'http://localhost/',
      propSBTAddress: sbtAddress,
      sbtInfo: { hasPasswordMint: false },
      sessionSlug: 'edge',
    };

    expect(buildSbtPageOpenMintAutoJoinUrl(baseArgs)).toBe(
      `http://localhost/ce/session/edge?sbt=${encodeURIComponent(sbtAddress)}&auto=1`
    );
    expect(buildSbtPageOpenMintAutoJoinUrl({
      ...baseArgs,
      addressOverride: '0x00000000000000000000000000000000000000b2',
    })).toBe(
      'http://localhost/ce/session/edge?sbt=0x00000000000000000000000000000000000000b2&auto=1'
    );
    expect(buildSbtPageOpenMintAutoJoinUrl({
      ...baseArgs,
      sessionSlug: 'general',
    })).toBe(`http://localhost/ce/session?sbt=${encodeURIComponent(sbtAddress)}&auto=1`);
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, sbtInfo: { hasPasswordMint: true } })).toBe('');
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, hasInviteMint: true })).toBe('');
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, hasGroupPasswordMint: true })).toBe('');
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, groupPasswordHash: '0x123' })).toBe('');
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, propSBTAddress: 'bad-address' })).toBe('');
    expect(buildSbtPageOpenMintAutoJoinUrl({ ...baseArgs, origin: '' })).toBe('');
  });

  it('resolves explicit SBT page session slugs from props and metadata', () => {
    expect(hasExplicitSbtPageSessionSlugProp({ sessionSlug: 'alpha' })).toBe(true);
    expect(hasExplicitSbtPageSessionSlugProp({ slug: 'beta' })).toBe(true);
    expect(hasExplicitSbtPageSessionSlugProp({})).toBe(false);
    expect(getExplicitSbtPageSessionSlug({ sessionSlug: 'alpha', slug: 'beta' })).toBe('alpha');
    expect(getExplicitSbtPageSessionSlug({ slug: 'beta' })).toBe('beta');
    expect(getExplicitSbtPageSessionSlug({})).toBeNull();
    expect(resolveSbtPageSessionSlugFromInfo({
      sessionSlug: 'beta',
      sessionSlugExplicit: false,
    })).toBeNull();
    expect(resolveSbtPageSessionSlugFromInfo({
      sessionSlug: 'beta',
      sessionSlugExplicit: true,
    })).toBe('beta');
    expect(resolveSbtPageSessionSlugFromInfo({ sessionSlug: 'beta' })).toBe('beta');
    expect(resolveSbtPageSessionSlugFromInfo({})).toBeNull();
    expect(resolveSbtPageEffectiveSessionSlug({
      props: { sessionSlug: 'explicit' },
      resolvedSessionSlug: 'resolved',
      sbtInfo: { sessionName: 'Demo' },
    })).toBe('explicit');
    expect(resolveSbtPageEffectiveSessionSlug({
      props: {},
      resolvedSessionSlug: 'resolved',
      sbtInfo: { sessionName: 'Demo' },
    })).toBe('resolved');
    expect(resolveSbtPageEffectiveSessionSlug({
      props: {},
      resolvedSessionSlug: null,
      sbtInfo: { sessionSlug: 'from-info' },
    })).toBe('from-info');
    expect(resolveSbtPageEffectiveSessionSlug({
      props: { slug: 'fallback' },
      resolvedSessionSlug: null,
      sbtInfo: {},
    })).toBe('fallback');
  });

  it('resolves SBTPage session display config and labels', () => {
    const readSessionConfig = jest.fn((slug: string) => (
      slug === 'known-session' ? { sessionName: 'Known Session' } : null
    ));
    const readDemoSessionConfig = jest.fn(() => ({ sessionName: 'Demo Session' }));

    expect(resolveSbtPageSessionDisplayConfig({
      getDemoSessionConfigBySlug: readDemoSessionConfig,
      getSessionConfigBySlugOrDefault: readSessionConfig,
      sessionSlugRaw: 'known-session',
    })).toEqual({ sessionName: 'Known Session' });
    expect(readSessionConfig).toHaveBeenCalledWith('known-session');
    expect(readDemoSessionConfig).not.toHaveBeenCalled();

    expect(resolveSbtPageSessionDisplayConfig({
      getDemoSessionConfigBySlug: readDemoSessionConfig,
      getSessionConfigBySlugOrDefault: readSessionConfig,
      sessionSlugRaw: 'missing',
    })).toEqual({ sessionName: 'Demo Session' });
    expect(readDemoSessionConfig).toHaveBeenCalledWith('missing', { allowDemoFallback: true });

    expect(resolveSbtPageSessionDisplayConfig({
      getSessionConfigBySlugOrDefault: () => {
        throw new Error('broken');
      },
      sessionSlugRaw: 'known-session',
    })).toBeNull();
    expect(resolveSbtPageSessionDisplayLabel({
      sessionConfig: { sessionName: '  Label Name  ' },
      sessionSlugRaw: 'known-session',
    })).toBe('Label Name');
    expect(resolveSbtPageSessionDisplayLabel({
      sessionConfig: {},
      sessionSlugRaw: 'known-session',
    })).toBe('known-session');
    expect(resolveSbtPageSessionDisplayLabel({
      sessionConfig: {},
      sessionSlugRaw: '',
    })).toBe('General');
  });

  it('resolves block explorer urls and nested interactive targets', () => {
    expect(getBlockExplorerBaseUrl({
      blockExplorers: { default: { url: 'https://explorer.example/' } },
    })).toBe('https://explorer.example');
    expect(getBlockExplorerBaseUrl(null)).toBe('');
    expect(buildSbtPageExplorerUrl({
      network: { blockExplorers: { default: { url: 'https://explorer.example/' } } },
      value: '0xabc',
      kind: 'address',
    })).toBe('https://explorer.example/address/0xabc');
    expect(buildSbtPageExplorerUrl({ value: '0xtx', kind: 'tx' })).toBe(
      'https://sepolia.etherscan.io/tx/0xtx'
    );
    expect(buildSbtPageDetailsPayload({
      sbtInfo: { name: 'Alpha', address: '0xOld' },
      address: '0xNew',
    })).toEqual({
      name: 'Alpha',
      address: '0xNew',
    });

    const closest = jest.fn(() => 'button-node');
    expect(findNestedInteractiveElement({ closest } as unknown as EventTarget)).toBe('button-node');
    expect(closest).toHaveBeenCalledWith('button, a, input, [role="button"]');
    expect(findNestedInteractiveElement(null)).toBeNull();
  });
});
