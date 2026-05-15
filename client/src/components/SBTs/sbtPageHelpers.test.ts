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
  buildSbtPageCopiedAddressPatch,
  buildSbtPageCopiedErrorPatch,
  buildSbtPageDocModalContentPatch,
  buildSbtPageDocModalErrorPatch,
  buildSbtPageDocModalOpenPatch,
  buildSbtPageDocModalResetPatch,
  buildSbtPageEncryptedEnvelopeDecryptKey,
  buildSbtPageEncryptedEnvelopeFingerprint,
  buildSbtPageEncryptedMetadataDecryptPlan,
  buildSbtPageErrorPatch,
  buildSbtPageExportFormatPatch,
  buildSbtPageInitialState,
  buildSbtPageIncludePreviousPasswordsPatch,
  buildSbtPageNetworkUpdatePatch,
  buildSbtPageLoadInfoLoadingStartPatch,
  buildSbtPageIntervalIdPatch,
  buildSbtPageLoadingMintersBurnersPatch,
  buildSbtPageLogScanProgressPatch,
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
  buildSbtPagePasswordExportFile,
  buildSbtPagePasswordExportRows,
  buildSbtPagePasswordInviteLink,
  buildSbtPagePasswordInputValuePatch,
  buildSbtPageMintPasswordClearPatch,
  buildSbtPageMintPasswordPrefillPatch,
  buildSbtPagePasswordClaimStartSuccessPatch,
  buildSbtPagePasswordGenerationCountPatch,
  buildSbtPagePasswordMintInputPatch,
  buildSbtPageRelevantInfoPatch,
  buildSbtPageResolvedSessionSlugPatch,
  buildSbtPageSbtInfoPatch,
  coerceSbtPageEpochSeconds,
  coerceSbtPageStringArrayValue,
  computeSbtPageNetCounts,
  computeSbtPageNetHoldersList,
  deriveSbtPageCacheNetKey,
  decodeSbtPageInviteInput,
  encodeSbtPageGroupPasswordForUrl,
  expandSbtPageAddressListFromCountMap,
  findSbtPageCachedEntryAcrossGroups,
  generateSbtPageRandomPasswords,
  getCurrentSbtAddressInfo,
  getDisplayImageFallbackCandidateCount,
  getDisplayImageRenderState,
  getDisplayImageUrlCandidates,
  getErrorMessage,
  getNextDisplayImageFallbackState,
  hasSbtPageAutoMintFlag,
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
  resolveSbtPageMetadataHydrationMode,
  resolveSbtPagePasswordExportControlsState,
  resolveSbtPagePasswordExportSelection,
  resolveSbtPagePasswordInventoryDisplayState,
  resolveSbtPageCachedGroupPasswordHash,
  resolveSbtPageGroupPasswordMintState,
  resolveSbtPageActiveChainId,
  resolveSbtPageAddressLinkState,
  resolveSbtPageChainMetadataReadNeeds,
  resolveSbtPageCopyableErrorText,
  resolveSbtPageRecoveryCacheChainId,
  resolveSbtPageUrlAutoMintIntent,
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
    expect(buildSbtPageInitialState({ network: { id: 84532 } })).toEqual(
      expect.objectContaining({
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
        encryptedRecoveryEnabled: false,
        encryptedRecoveryStatus: 'idle',
        hasGroupPasswordMint: false,
        hasInviteMint: false,
        docModalOpen: false,
        resolvedSessionSlug: null,
        displayImageFallbackKey: '',
        displayImageFallbackIndex: 0,
      }),
    );
    expect(
      buildSbtPageBooleanTogglePatch({
        state: { showStats: false },
        stateKey: 'showStats',
      }),
    ).toEqual({ showStats: true });
    expect(
      buildSbtPageBooleanTogglePatch({
        state: { showActions: 'open' },
        stateKey: 'showActions',
      }),
    ).toEqual({ showActions: false });
    expect(
      buildSbtPageAddressChangeResetMintUiPatch({
        sbtAddressChanged: false,
      }),
    ).toBeNull();
    expect(
      buildSbtPageAddressChangeResetMintUiPatch({
        sbtAddressChanged: true,
      }),
    ).toEqual({
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
    expect(
      buildSbtPageNetworkUpdatePatch({
        network: { id: 10 },
        resetMintUiState: {
          network: { id: 1 },
          mintStep: 0,
        },
      }),
    ).toEqual({
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
    expect(
      buildSbtPageMintSuccessPatch({
        clearManualPassword: true,
        mintStep: 3,
        txHash: '0xclaim',
      }),
    ).toEqual({
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
    expect(
      buildSbtPageBurnFailurePatch({
        error: 'Denied',
        resetBurnSearch: true,
      }),
    ).toEqual({
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
    expect(
      buildSbtPageBurnSuccessPatch({
        resetBurnSearch: true,
        txHash: '0xadminburn',
      }),
    ).toEqual({
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
    expect(
      buildSbtPageBurnSearchResultPatch({
        address: '0xOwner',
        resultType: 'tokenId',
        tokenId: '12',
      }),
    ).toEqual({
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
    expect(
      buildSbtPageMintedModalInitialFilterPatch({
        buildAddressListSignature: () => 'holders-signature',
        netHolders: ['0xA'],
      }),
    ).toEqual({
      filteredMintedUsers: ['0xA'],
      filteredMintedUsersSignature: 'holders-signature',
      mintingAddressesFilterInitialized: true,
      loadingMintedFilter: false,
    });
    expect(
      buildSbtPageMintedModalInitialFilterPatch({
        buildAddressListSignature: () => 'empty',
        netHolders: 'bad',
      }),
    ).toEqual({
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
    expect(
      buildSbtPageLoadInfoLoadingStartPatch({
        hasExplicitSlug: true,
        normalizedExplicitSlug: 'alpha',
      }),
    ).toEqual({
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
    expect(
      buildSbtPageLogScanProgressPatch({
        progress: { scanned: 1 },
        slug: 'alpha-session',
      }),
    ).toEqual({
      logScanProgress: {
        scanned: 1,
        slug: 'alpha-session',
      },
    });
    expect(buildSbtPageBookmarkedPatch({ bookmarked: true })).toEqual({
      bookmarked: true,
    });
    expect(
      buildSbtPagePasswordMintInputPatch({
        inputField: 'groupPasswordInput',
        inputValue: 'invite-token',
      }),
    ).toEqual({
      groupPasswordInput: 'invite-token',
      mintingStatus: 'idle',
      mintStep: 0,
      error: null,
    });
    expect(
      buildSbtPagePasswordMintInputPatch({
        inputField: 'manualPasswordInput',
        inputValue: 'claim-code',
      }),
    ).toEqual({
      manualPasswordInput: 'claim-code',
      mintingStatus: 'idle',
      mintStep: 0,
      error: null,
    });
    expect(
      buildSbtPagePasswordMintInputPatch({
        inputField: 'unknown',
        inputValue: null,
      }),
    ).toEqual({
      groupPasswordInput: '',
      mintingStatus: 'idle',
      mintStep: 0,
      error: null,
    });
    expect(
      buildSbtPagePasswordInputValuePatch({
        inputField: 'groupPasswordInput',
        inputValue: 'invite-token',
      }),
    ).toEqual({
      groupPasswordInput: 'invite-token',
    });
    expect(
      buildSbtPagePasswordInputValuePatch({
        inputField: 'manualPasswordInput',
        inputValue: 'claim-code',
      }),
    ).toEqual({
      manualPasswordInput: 'claim-code',
    });
    expect(
      buildSbtPagePasswordInputValuePatch({
        inputField: 'unknown',
        inputValue: null,
      }),
    ).toEqual({
      groupPasswordInput: '',
    });
    expect(
      buildSbtPageMintPasswordPrefillPatch({
        currentGroupPasswordInput: 'existing-group',
        finalPasswordToUse: 'plain-password',
      }),
    ).toEqual({
      mintPassword: 'plain-password',
      manualPasswordInput: 'plain-password',
      groupPasswordInput: 'existing-group',
      mintStep: 0,
      showPasswordAlert: true,
    });
    expect(
      buildSbtPageMintPasswordPrefillPatch({
        currentGroupPasswordInput: 'existing-group',
        finalPasswordToUse: 'invite:raw',
        invitePayload: { inviteCode: 'code-1' },
      }),
    ).toEqual({
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
    expect(
      buildSbtPageAdminInviteSuccessPatch({
        passwordList: generatedPasswords,
      }),
    ).toEqual({
      adminGeneratedPasswords: generatedPasswords,
      passwordGenerationCount: '',
    });
    expect(
      buildSbtPageAdminInviteSuccessPatch({
        passwordList: 'bad',
      }),
    ).toEqual({
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
    expect(
      buildSbtPageDocModalOpenPatch({
        loading: true,
        name: 'Decrypting',
      }),
    ).toEqual({
      docModalOpen: true,
      docModalLoading: true,
      docModalError: '',
      docModalContent: '',
      docModalName: 'Decrypting',
      docModalBlobUrl: '',
    });
    expect(
      buildSbtPageDocModalOpenPatch({
        error: 'Connect first.',
        name: 'Encrypted document',
      }),
    ).toEqual({
      docModalOpen: true,
      docModalLoading: false,
      docModalError: 'Connect first.',
      docModalContent: '',
      docModalName: 'Encrypted document',
      docModalBlobUrl: '',
    });
    expect(
      buildSbtPageDocModalContentPatch({
        blobUrl: 'blob:doc',
        content: null,
        error: undefined,
        name: 'Payload',
      }),
    ).toEqual({
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
    expect(
      buildSbtPageEncryptedEnvelopeFingerprint({
        nameEnvelope: {},
        tagsEnvelope: 'tags',
        imageEnvelope: null,
      }),
    ).toBe('nt');
    expect(
      buildSbtPageEncryptedEnvelopeDecryptKey({
        metaKey: 'meta',
        activeAccount: '0xA',
        envelopeFingerprint: 'nt',
      }),
    ).toBe('meta:0xA:nt');
    expect(
      buildSbtPageEncryptedMetadataDecryptPlan({
        activeAccount: '0xA',
        hasLitKey: true,
        metaKey: 'session:84532:0xsbt',
        sbtInfo: {
          encryptedFields: {
            name: 'name-envelope',
            description: 'desc-envelope',
            tags: 'tags-envelope',
            documentURLs: 'docs-envelope',
            image: { storage: 'lit-arweave', txId: 'image-tx' },
          },
          nameEncrypted: 'legacy-name-envelope',
          encryptedImage: 'legacy-image-envelope',
        },
      }),
    ).toEqual({
      alreadyTried: false,
      canAttemptDecrypt: true,
      decryptKey: 'session:84532:0xsbt:0xA:ndtui',
      descriptionEnvelope: 'desc-envelope',
      documentUrlsEnvelope: 'docs-envelope',
      envelopeFingerprint: 'ndtui',
      hasEncryptedMetadata: true,
      imageEnvelope: { storage: 'lit-arweave', txId: 'image-tx' },
      nameEnvelope: 'name-envelope',
      shouldEnterDecryptBoundary: true,
      tagsEnvelope: 'tags-envelope',
    });
    expect(
      buildSbtPageEncryptedMetadataDecryptPlan({
        activeAccount: '0xA',
        decryptTriedByKey: { 'session:84532:0xsbt:0xA:d': true },
        hasLitKey: true,
        metaKey: 'session:84532:0xsbt',
        sbtInfo: {
          descriptionEncrypted: 'desc-envelope',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        alreadyTried: true,
        canAttemptDecrypt: false,
        decryptKey: 'session:84532:0xsbt:0xA:d',
        descriptionEnvelope: 'desc-envelope',
        hasEncryptedMetadata: true,
        shouldEnterDecryptBoundary: false,
      }),
    );
    expect(
      buildSbtPageEncryptedMetadataDecryptPlan({
        activeAccount: '',
        hasLitKey: false,
        metaKey: 'session:84532:0xsbt',
        sbtInfo: {
          encryptedDescription: 'desc-envelope',
          docUrlsEncrypted: 'docs-envelope',
          imageEncrypted: 'image-envelope',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        canAttemptDecrypt: false,
        decryptKey: 'session:84532:0xsbt::dui',
        descriptionEnvelope: 'desc-envelope',
        documentUrlsEnvelope: 'docs-envelope',
        hasEncryptedMetadata: true,
        imageEnvelope: 'image-envelope',
        shouldEnterDecryptBoundary: true,
      }),
    );
    expect(
      buildSbtPageEncryptedMetadataDecryptPlan({
        activeAccount: '0xA',
        hasLitKey: true,
        metaKey: 'session:84532:0xsbt',
        sbtInfo: {
          name: 'Public badge',
        },
      }),
    ).toEqual(
      expect.objectContaining({
        canAttemptDecrypt: false,
        decryptKey: 'session:84532:0xsbt:0xA:',
        envelopeFingerprint: '',
        hasEncryptedMetadata: false,
        shouldEnterDecryptBoundary: false,
      }),
    );
    expect(
      resolveSbtPageCachedGroupPasswordHash({
        preferCountsOnly: true,
        groupPasswordHashLoaded: true,
        groupPasswordHash: '0xhash',
      }),
    ).toEqual({
      groupPasswordHash: '0xhash',
      shouldReuseCachedGroupPasswordHash: true,
    });
    expect(
      resolveSbtPageCachedGroupPasswordHash({
        preferCountsOnly: false,
        groupPasswordHashLoaded: true,
        groupPasswordHash: '0xhash',
      }),
    ).toEqual({
      groupPasswordHash: null,
      shouldReuseCachedGroupPasswordHash: false,
    });
    expect(
      resolveSbtPageGroupPasswordMintState({
        groupPasswordHash: '0xhash',
        hashZero: '0x0',
        hasPasswordMint: true,
      }),
    ).toEqual({
      hasGroupHash: true,
      hasInviteMint: true,
      hasGroupPasswordMint: false,
    });
    expect(
      resolveSbtPageGroupPasswordMintState({
        groupPasswordHash: '0xhash',
        hashZero: '0x0',
        hasPasswordMint: false,
      }),
    ).toEqual({
      hasGroupHash: true,
      hasInviteMint: false,
      hasGroupPasswordMint: true,
    });
    expect(
      resolveSbtPageGroupPasswordMintState({
        groupPasswordHash: '0x0',
        hashZero: '0x0',
        hasPasswordMint: true,
      }),
    ).toEqual({
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

    expect(
      normalizeSbtPageHistorySummary({
        totalMinted: '0005',
        totalBurned: 1,
        activeSupply: '004',
        currentHolderCount: '4',
        historicalHolderCount: '005',
      }),
    ).toEqual({
      totalMinted: '5',
      totalBurned: '1',
      activeSupply: '4',
      currentHolderCount: '4',
      historicalHolderCount: '5',
    });
    expect(
      normalizeSbtPageHistorySummary({
        totalMinted: '5',
        totalBurned: 'not-a-number',
        activeSupply: '4',
        currentHolderCount: '4',
        historicalHolderCount: '5',
      }),
    ).toBeNull();
    expect(normalizeSbtPageHistorySummary(null)).toBeNull();
  });

  it('applies SBT history summary fallbacks without clobbering existing state on invalid values', () => {
    expect(
      applySbtPageHistorySummaryFallback({
        summaryValue: { currentHolderCount: '04', totalMinted: '0007' },
        sourceLabel: 'summary-cache',
      }),
    ).toEqual({
      mintedTokensOverride: '4',
      mintedTokensSource: 'summary-cache',
      ownerLookupUpperBound: '7',
    });

    expect(
      applySbtPageHistorySummaryFallback({
        mintedTokensOverride: '3',
        mintedTokensSource: 'summary-group',
        ownerLookupUpperBound: '8',
        summaryValue: { currentHolderCount: 'bad', totalMinted: null },
        sourceLabel: 'ignored',
      }),
    ).toEqual({
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
    expect(
      needsSbtPageTokenUriFields({
        ...complete,
        documentURLs: [],
      }),
    ).toBe(false);
    expect(
      needsSbtPageTokenUriFields({
        ...complete,
        image: '',
        documentURLs: [],
        encryptedFields: { image: { ciphertext: 'locked' } },
      }),
    ).toBe(false);
    expect(
      needsSbtPageTokenUriFields({
        ...complete,
        docURL: 'https://example.test/source',
      }),
    ).toBe(false);
    expect(
      needsSbtPageTokenUriFields({
        ...complete,
        admin: '0x0000000000000000000000000000000000000000',
      }),
    ).toBe(true);
    expect(
      needsSbtPageTokenUriFields({
        ...complete,
        tokenURI: '',
      }),
    ).toBe(true);
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
    expect(
      getCurrentSbtAddressInfo({
        SBTAddress: [{ nope: 'x' }, { sbtAddress: '0xDef' }],
      }),
    ).toEqual({
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

    expect(
      resolveSbtPageActiveChainId({
        getSessionChainId,
        propNetwork: { id: 10 },
        sbtInfo: { chainID: 84532 },
        sessionSlug: 'alpha',
        stateNetwork: { id: 84532 },
      }),
    ).toBe(84532);
    expect(
      resolveSbtPageActiveChainId({
        getSessionChainId,
        propNetwork: { id: 10 },
        sbtInfo: { chainID: 84532 },
        sessionSlug: 'alpha',
        stateNetwork: { id: 0 },
      }),
    ).toBe(10);
    expect(
      resolveSbtPageActiveChainId({
        getSessionChainId,
        sbtInfo: { chainId: '84532' },
        sessionSlug: 'alpha',
      }),
    ).toBe(84532);
    expect(
      resolveSbtPageActiveChainId({
        getSessionChainId,
        sessionSlug: 'alpha',
      }),
    ).toBe(11155420);
    expect(resolveSbtPageActiveChainId()).toBeNull();

    expect(
      resolveSbtPageRecoveryCacheChainId({
        getSessionChainId,
        propNetwork: { id: 10 },
        propSBTAddress: { chainId: 11155420 },
        sbtInfo: { chainID: 84532 },
        sessionSlug: 'alpha',
      }),
    ).toBe(84532);
    expect(
      resolveSbtPageRecoveryCacheChainId({
        getSessionChainId,
        propNetwork: { id: 10 },
        propSBTAddress: { chainId: 11155420 },
        sessionSlug: 'alpha',
      }),
    ).toBe(11155420);
    expect(
      resolveSbtPageRecoveryCacheChainId({
        getSessionChainId,
        propNetwork: { id: 10 },
        sessionSlug: 'alpha',
      }),
    ).toBe(11155420);
    expect(
      resolveSbtPageRecoveryCacheChainId({
        getSessionChainId: () => null,
        propNetwork: { id: 10 },
      }),
    ).toBe(10);
  });

  it('derives cache net keys and direct metadata contexts from slug and chain hints', () => {
    const getSessionChainId = jest.fn((slug: unknown) =>
      String(slug || '')
        .trim()
        .toLowerCase() === 'alpha'
        ? 11155420
        : null,
    );

    expect(
      deriveSbtPageCacheNetKey({
        currentNetwork: { id: 10 },
        getSessionChainId,
        infoHint: { chainID: 84532 },
        netKeyHint: 777,
        slugForCache: 'alpha',
      }),
    ).toBe('11155420');
    expect(
      deriveSbtPageCacheNetKey({
        currentNetwork: { id: 10 },
        getSessionChainId,
        infoHint: { chainId: '84532' },
        slugForCache: 'missing',
      }),
    ).toBe('84532');
    expect(
      deriveSbtPageCacheNetKey({
        currentNetwork: { id: 10 },
        getSessionChainId,
        netKeyHint: '84532',
        slugForCache: 'missing',
      }),
    ).toBe('84532');
    expect(
      deriveSbtPageCacheNetKey({
        currentNetwork: { id: 10 },
        getSessionChainId,
        slugForCache: 'missing',
      }),
    ).toBe('10');
    expect(deriveSbtPageCacheNetKey()).toBe('');

    expect(
      buildSbtPageDirectMetadataContext({
        currentNetwork: { id: 10 },
        getSessionChainId,
        infoHint: { chainID: 84532 },
        slugForRead: ' Alpha ',
      }),
    ).toEqual({ slug: 'Alpha', networkChainId: 11155420 });
    expect(
      buildSbtPageDirectMetadataContext({
        infoHint: { chainId: '84532' },
        slugForRead: '',
      }),
    ).toEqual({ networkChainId: 84532 });
    expect(buildSbtPageDirectMetadataContext()).toBe('');
  });

  it('reads SBT page cache buckets and folds legacy numeric net keys into the active key', async () => {
    const legacyNode = { sbtList: { '0xsbt': { slug: 'alpha' } } };
    const readCache = jest.fn(async () => ({
      '084532': legacyNode,
    }));

    await expect(
      readSbtPageCacheBySlug({
        netKeyForCache: '84532',
        readCache,
        slugForCache: 'alpha',
      }),
    ).resolves.toEqual({
      '084532': legacyNode,
      '84532': legacyNode,
    });
    expect(readCache).toHaveBeenCalledWith('sbtCache', 'alpha');

    await expect(
      readSbtPageCacheBySlug({
        netKeyForCache: '84532',
        readCache: () => {
          throw new Error('cache unavailable');
        },
        slugForCache: null,
      }),
    ).resolves.toEqual({});
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

    expect(
      findSbtPageCachedEntryAcrossGroups({
        addressLower: addressLower.toUpperCase(),
        listNamespaceEntriesSync,
      }),
    ).toEqual({
      slug: 'Alpha',
      entry: alphaEntry,
      netKey: '84532',
    });
    expect(
      findSbtPageCachedEntryAcrossGroups({
        addressLower,
        excludeSlug: 'alpha',
        listNamespaceEntriesSync,
      }),
    ).toEqual({
      slug: 'beta',
      entry: betaEntry,
      netKey: '11155420',
    });
    expect(
      findSbtPageCachedEntryAcrossGroups({
        addressLower,
        listNamespaceEntriesSync: () => {
          throw new Error('cache unavailable');
        },
      }),
    ).toBeNull();
  });

  it('resolves metadata hydration ownership flags', () => {
    const refreshSbtData = jest.fn();

    expect(
      resolveSbtPageMetadataHydrationMode({
        forceEventFetch: false,
        isSBTCacheReady: false,
        refreshSbtData,
      }),
    ).toEqual({
      usingCentralHydration: true,
      parentOwnsInitialRefresh: true,
    });
    expect(
      resolveSbtPageMetadataHydrationMode({
        forceEventFetch: true,
        isSBTCacheReady: false,
        refreshSbtData,
      }),
    ).toEqual({
      usingCentralHydration: true,
      parentOwnsInitialRefresh: false,
    });
    expect(
      resolveSbtPageMetadataHydrationMode({
        forceEventFetch: false,
        isSBTCacheReady: false,
        refreshSbtData: null,
      }),
    ).toEqual({
      usingCentralHydration: false,
      parentOwnsInitialRefresh: false,
    });
  });

  it('keeps cache-ready metadata hydration inert while preserving the central refresh boundary', () => {
    const refreshSbtData = jest.fn();

    expect(
      resolveSbtPageMetadataHydrationMode({
        forceEventFetch: false,
        isSBTCacheReady: true,
        refreshSbtData,
      }),
    ).toEqual({
      usingCentralHydration: true,
      parentOwnsInitialRefresh: false,
    });

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





  it('reads queued localStorage JSON before stored JSON with fallback guards', () => {
    const fallback = { empty: true };
    const storageRef = {
      getItem: jest.fn((key: string) => (key === 'saved' ? '{"stored":true}' : 'not-json')),
    };
    const queuedWrites = new Map<string, string>([
      ['saved', '{"queued":true}'],
    ]);

    expect(readSbtPageQueuedOrStoredLocalStorageJson({
      fallback,
      key: 'saved',
      queuedWrites,
      storageRef,
    })).toEqual({ queued: true });
    expect(storageRef.getItem).not.toHaveBeenCalledWith('saved');
    expect(readSbtPageQueuedOrStoredLocalStorageJson({
      fallback,
      key: 'saved',
      queuedWrites: new Map(),
      storageRef,
    })).toEqual({ stored: true });
    expect(readSbtPageQueuedOrStoredLocalStorageJson({
      fallback,
      key: 'bad',
      storageRef,
    })).toBe(fallback);
    expect(readSbtPageQueuedOrStoredLocalStorageJson({
      fallback,
      key: '',
      storageRef,
    })).toBe(fallback);
    expect(readSbtPageQueuedOrStoredLocalStorageJson({
      fallback,
      key: 'saved',
      storageRef: null,
    })).toBe(fallback);
    expect(serializeSbtPageLocalStorageJsonWrite({
      key: 'saved',
      value: { ok: true },
    })).toEqual({
      storageKey: 'saved',
      nextJson: '{"ok":true}',
    });
    expect(serializeSbtPageLocalStorageJsonWrite({
      key: '',
      value: { ok: true },
    })).toBeNull();
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(serializeSbtPageLocalStorageJsonWrite({
      key: 'circular',
      value: circular,
    })).toBeNull();
    expect(resolveSbtPageLocalStorageJsonWriteDecision({
      cachedJson: '{"ok":true}',
      currentRaw: '',
      nextJson: '{"ok":true}',
    })).toBe('skip');
    expect(resolveSbtPageLocalStorageJsonWriteDecision({
      cachedJson: '',
      currentRaw: '{"ok":true}',
      nextJson: '{"ok":true}',
    })).toBe('adopt');
    expect(resolveSbtPageLocalStorageJsonWriteDecision({
      cachedJson: '',
      currentRaw: '',
      nextJson: '{"ok":true}',
    })).toBe('write');
  });

  it('appends transaction hashes to the lower-cased user cache bucket', () => {
    const txCache = { '0xabc': ['0xold'] };

    expect(appendSbtPageTransactionHash({
      cacheObj: txCache,
      txHash: '0xnew',
      userAddress: '0xABC',
    })).toEqual({
      shouldWrite: true,
      txCache: { '0xabc': ['0xold', '0xnew'] },
    });
    expect(appendSbtPageTransactionHash({
      cacheObj: {},
      txHash: '0xfresh',
      userAddress: '0xDEF',
    })).toEqual({
      shouldWrite: true,
      txCache: { '0xdef': ['0xfresh'] },
    });
    expect(appendSbtPageTransactionHash({
      cacheObj: {},
      txHash: '0xignored',
      userAddress: '',
    })).toEqual({
      shouldWrite: false,
      txCache: {},
    });
    expect(() => appendSbtPageTransactionHash({
      cacheObj: { '0xabc': 'bad-shape' },
      txHash: '0xnew',
      userAddress: '0xABC',
    })).toThrow();
  });

  it('appends SBT bookmarks without duplicating existing addresses', () => {
    expect(appendSbtPageBookmark({
      bookmarksObj: {},
      sbtAddress: '0xSBT',
    })).toEqual({
      bookmarks: { sbts: ['0xSBT'] },
      shouldWrite: true,
    });

    const existing = { sbts: ['0xSBT'] };
    expect(appendSbtPageBookmark({
      bookmarksObj: existing,
      sbtAddress: '0xSBT',
    })).toEqual({
      bookmarks: existing,
      shouldWrite: false,
    });
    expect(appendSbtPageBookmark({
      bookmarksObj: {},
      sbtAddress: '',
    })).toEqual({
      bookmarks: {},
      shouldWrite: false,
    });
    expect(() => appendSbtPageBookmark({
      bookmarksObj: { sbts: 'bad-shape' },
      sbtAddress: '0xSBT',
    })).toThrow();
  });

  it('resolves password export selection from cached and generated codes', () => {
    expect(resolveSbtPagePasswordExportSelection({
      cachedPasswords: ['cached-one'],
      adminGeneratedPasswords: [],
      includePreviousPasswords: false,
    })).toMatchObject({
      onlyCachedPasswords: true,
      effectiveIncludePreviousPasswords: true,
      passwordsToExport: ['cached-one'],
    });
    expect(resolveSbtPagePasswordExportSelection({
      cachedPasswords: ['cached-one'],
      adminGeneratedPasswords: ['admin-one'],
      includePreviousPasswords: false,
    }).passwordsToExport).toEqual(['admin-one']);
    expect(resolveSbtPagePasswordExportSelection({
      cachedPasswords: ['cached-one'],
      adminGeneratedPasswords: ['admin-one'],
      includePreviousPasswords: true,
    }).passwordsToExport).toEqual(['cached-one', 'admin-one']);
    expect(resolveSbtPagePasswordExportSelection({
      cachedPasswords: 'bad',
      adminGeneratedPasswords: [2, null, 'admin-two'],
    }).adminGeneratedPasswordList).toEqual(['2', '', 'admin-two']);
    expect(resolveSbtPagePasswordExportControlsState({
      adminGeneratedPasswordList: ['admin-one'],
      effectiveIncludePreviousPasswords: true,
      onlyCachedPasswords: false,
    })).toEqual({
      effectiveIncludePreviousPasswordsChecked: true,
      renderIncludePreviousCheckbox: true,
      showCachedPasswordsIncludedNote: false,
    });
    expect(resolveSbtPagePasswordExportControlsState({
      adminGeneratedPasswordList: [],
      effectiveIncludePreviousPasswords: true,
      onlyCachedPasswords: true,
    })).toEqual({
      effectiveIncludePreviousPasswordsChecked: true,
      renderIncludePreviousCheckbox: false,
      showCachedPasswordsIncludedNote: true,
    });
    expect(resolveSbtPagePasswordExportControlsState({
      adminGeneratedPasswordList: [],
      effectiveIncludePreviousPasswords: false,
      onlyCachedPasswords: false,
    })).toEqual({
      effectiveIncludePreviousPasswordsChecked: false,
      renderIncludePreviousCheckbox: false,
      showCachedPasswordsIncludedNote: false,
    });
    expect(resolveSbtPagePasswordInventoryDisplayState({
      combinedPasswords: ['cached-one'],
      showNoMoreInvites: false,
      showPasswordGen: true,
    })).toEqual({
      shouldRenderGeneratedPasswordList: true,
      shouldRenderNoMoreInvitesEmptyState: false,
      shouldRenderPasswordGenerationSection: true,
      shouldRenderPreviousPasswordsSection: false,
    });
    expect(resolveSbtPagePasswordInventoryDisplayState({
      combinedPasswords: ['cached-one'],
      showNoMoreInvites: true,
      showPasswordGen: false,
    })).toEqual({
      shouldRenderGeneratedPasswordList: false,
      shouldRenderNoMoreInvitesEmptyState: false,
      shouldRenderPasswordGenerationSection: false,
      shouldRenderPreviousPasswordsSection: true,
    });
    expect(resolveSbtPagePasswordInventoryDisplayState({
      combinedPasswords: [],
      showNoMoreInvites: true,
      showPasswordGen: false,
    })).toEqual({
      shouldRenderGeneratedPasswordList: false,
      shouldRenderNoMoreInvitesEmptyState: true,
      shouldRenderPasswordGenerationSection: false,
      shouldRenderPreviousPasswordsSection: false,
    });
  });

  it('builds password export rows and files', () => {
    const encodeGroupPassword = (code: string) => `enc:${code}`;

    expect(encodeSbtPageGroupPasswordForUrl(' One Two ', {
      normalizeGroupPasswordInput: (raw) => String(raw || '').trim().toLowerCase(),
      encodeGroupPasswordForUrl: (raw) => `encoded:${raw}`,
    })).toBe('encoded:one two');
    expect(buildSbtPagePasswordInviteLink({
      baseUrl: 'https://app.example',
      code: 'one two',
      demoPath: '/s/alpha',
      encodeGroupPassword,
      isInvite: true,
      sbtAddr: '0xabc',
      sbtBasePathValue: '/sbt',
    })).toBe('https://app.example/s/alpha?auto=1&sbt=0xabc&gp=enc%3Aone%20two');
    expect(buildSbtPagePasswordInviteLink({
      baseUrl: 'https://app.example',
      code: 'pw1',
      isInvite: false,
      sbtAddr: '0xdef',
      sbtBasePathValue: '/sbt',
    })).toBe('https://app.example/sbt/0xdef/pw1');

    const inviteRows = buildSbtPagePasswordExportRows({
      baseUrl: 'https://app.example',
      codeLabel: 'groupPassword',
      demoPath: '/s/alpha',
      encodeGroupPassword,
      isInvite: true,
      passwordsToExport: ['one two'],
      sbtAddr: '0xabc',
      sbtBasePathValue: '/sbt',
    });

    expect(inviteRows).toEqual([{
      groupPassword: 'one two',
      inviteLink: 'https://app.example/s/alpha?auto=1&sbt=0xabc&gp=enc%3Aone%20two',
    }]);

    const passwordRows = buildSbtPagePasswordExportRows({
      baseUrl: 'https://app.example',
      codeLabel: 'password',
      isInvite: false,
      passwordsToExport: ['pw1'],
      sbtAddr: '0xdef',
      sbtBasePathValue: '/sbt',
    });
    expect(passwordRows).toEqual([{
      password: 'pw1',
      inviteLink: 'https://app.example/sbt/0xdef/pw1',
    }]);

    expect(buildSbtPagePasswordExportFile({
      codeLabel: 'password',
      date: '2026-05-05',
      fileLabel: 'passwords',
      format: 'csv',
      rows: passwordRows,
      sbtSymbolOrName: 'ALPHA',
    })).toEqual({
      content: 'index,password,inviteLink\n0,pw1,https://app.example/sbt/0xdef/pw1',
      fileName: 'ALPHA_passwords_2026-05-05.csv',
      mimeType: 'text/csv',
    });

    expect(buildSbtPagePasswordExportFile({
      codeLabel: 'groupPassword',
      date: '2026-05-05',
      fileLabel: 'group-passwords',
      format: 'json',
      rows: inviteRows,
      sbtSymbolOrName: 'ALPHA',
    })).toMatchObject({
      content: JSON.stringify(inviteRows, null, 2),
      fileName: 'ALPHA_group-passwords_2026-05-05.json',
      mimeType: 'application/json',
    });

    expect(buildSbtPagePasswordExportFile({ format: 'txt' })).toBeNull();
  });

  it('generates unique 16-byte hex passwords using injected random sources', () => {
    let browserCall = 0;
    const browserPasswords = generateSbtPageRandomPasswords({
      count: 2,
      getRandomValues: (arr) => {
        arr.fill(browserCall === 0 ? 1 : 2);
        browserCall += 1;
        return arr;
      },
      randomBytes: () => {
        throw new Error('fallback should not be used');
      },
    });

    expect(browserPasswords).toEqual([
      '01010101010101010101010101010101',
      '02020202020202020202020202020202',
    ]);

    let fallbackCall = 0;
    expect(generateSbtPageRandomPasswords({
      count: 2,
      getRandomValues: null,
      randomBytes: () => {
        fallbackCall += 1;
        return new Uint8Array(16).fill(fallbackCall === 1 ? 3 : 4);
      },
    })).toEqual([
      '03030303030303030303030303030303',
      '04040404040404040404040404040404',
    ]);

    expect(generateSbtPageRandomPasswords({
      count: 'bad',
      randomBytes: () => new Uint8Array(16),
    })).toEqual([]);
  });

  it('decodes JSON data URIs and detects image-like URIs', () => {
    expect(decodeSbtPageJsonDataUri(
      `data:application/json,${encodeURIComponent(JSON.stringify({ name: 'Badge' }))}`
    )).toEqual({ name: 'Badge' });
    expect(decodeSbtPageJsonDataUri(
      `data:application/json;base64,${Buffer.from(JSON.stringify({ name: 'Encoded' })).toString('base64')}`
    )).toEqual({ name: 'Encoded' });
    expect(decodeSbtPageJsonDataUri('data:application/json,not-json')).toBeNull();
    expect(decodeSbtPageJsonDataUri('https://example.test/metadata.json')).toBeNull();

    expect(isSbtPageImageLikeUri('data:image/png;base64,abc')).toBe(true);
    expect(isSbtPageImageLikeUri('https://example.test/image.PNG')).toBe(true);
    expect(isSbtPageImageLikeUri('https://example.test/render?format=webp')).toBe(true);
    expect(isSbtPageImageLikeUri('https://example.test/metadata.json')).toBe(false);
    expect(isSbtPageImageLikeUri('not a url')).toBe(false);
  });

  it('normalizes token metadata links while rejecting images and data URIs', () => {
    const txId = 'Sng0VG2vetgNPITw5mtvt6om-fBCNu3KI5GZAYeEttY';
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = 'https://ar-io.dev';

    expect(normalizeSbtPageCanonicalMetadataHref(`ar://${txId}`)).toBe(`https://ar-io.dev/${txId}`);
    expect(normalizeSbtPageCanonicalMetadataHref('data:application/json,%7B%7D')).toBe('');
    expect(normalizeSbtPageCanonicalMetadataHref('https://cdn.example.test/preview.png')).toBe('');
    expect(normalizeSbtPageCanonicalMetadataHref('https://example.test/metadata.json')).toBe(
      'https://example.test/metadata.json'
    );
  });

  it('resolves embedded token metadata links by SBT-specific field precedence', () => {
    const sbtTxId = 'GfaX7MhJndTePSYdECj8VJmFQ5m2KDtDMU8fHgUTw24';
    const sessionTxId = 'ue3Ek_Mh1ypNvvCaGlfrntt_8HxJ9CDiwDlG06uoTpY';
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = 'https://ar-io.dev';
    const dataUriPayload = Buffer.from(JSON.stringify({
      tokenURI: `ar://${sbtTxId}`,
      metadataUri: `ar://${sessionTxId}`,
      uri: 'https://cdn.example.test/banner.webp',
    }), 'utf8').toString('base64');

    const href = resolveSbtPageTokenMetadataHref(`data:application/json;base64,${dataUriPayload}`);

    expect(href).toBe(`https://ar-io.dev/${sbtTxId}`);
    expect(href).not.toContain(sessionTxId);
  });

  it('uses later embedded metadata fields when earlier token fields are image-like', () => {
    const txId = '4kpvO6qf-tN4l0R9vQh-Sz6ekU2xq9j5qM4R1X3vZkA';
    const dataUriPayload = Buffer.from(JSON.stringify({
      tokenURI: 'https://cdn.example.test/also-image.jpg',
      uri: 'https://cdn.example.test/banner.webp',
      metadataUri: `ar://${txId}`,
    }), 'utf8').toString('base64');

    const href = resolveSbtPageTokenMetadataHref(`data:application/json;base64,${dataUriPayload}`);

    expect(href).toContain(txId);
    expect(href).not.toContain('also-image.jpg');
    expect(resolveSbtPageTokenMetadataHref(`data:application/json,${encodeURIComponent(JSON.stringify({
      tokenURI: 'https://cdn.example.test/also-image.jpg',
      uri: 'https://cdn.example.test/banner.webp',
    }))}`)).toBe('');
  });

  it('builds display image candidates and falls back to the default image', () => {
    const defaultImage = '/static/default-sbt.png';
    const imageUrl = 'https://example.test/badge.png';

    expect(getDisplayImageUrlCandidates({ image: imageUrl })).toEqual([imageUrl]);
    expect(resolveDisplayImageHref({ image: imageUrl }, defaultImage)).toBe(imageUrl);
    expect(resolveDisplayImageHref({ image: '' }, defaultImage)).toBe(defaultImage);
    expect(getDisplayImageRenderState({ image: '' }, {}, defaultImage)).toEqual({
      sourceKey: '',
      candidates: [],
      activeIndex: 0,
      src: defaultImage,
      canRetry: false,
    });
  });

  it('resolves on-chain metadata read needs without changing fast-path guards', () => {
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    const completeInfo = {
      admin: '0x1111111111111111111111111111111111111111',
      burnAuth: 1,
      hasPasswordMint: false,
      maxTokens: '25',
      mintingEndTime: 0,
    };

    expect(resolveSbtPageChainMetadataReadNeeds({ info: completeInfo, zeroAddress })).toEqual({
      needAdmin: false,
      needBurn: false,
      needEnd: false,
      needHasPw: false,
      needMax: false,
      shouldRead: false,
    });
    expect(resolveSbtPageChainMetadataReadNeeds({
      info: { ...completeInfo, burnAuthNeedsOnChainRefresh: true },
      zeroAddress,
    }).needBurn).toBe(true);
    expect(resolveSbtPageChainMetadataReadNeeds({
      info: { ...completeInfo, admin: zeroAddress },
      zeroAddress,
    }).needAdmin).toBe(true);
    expect(resolveSbtPageChainMetadataReadNeeds({
      info: { ...completeInfo, maxTokens: null, mintingEndTime: undefined, hasPasswordMint: undefined },
      zeroAddress,
    })).toMatchObject({
      needEnd: true,
      needHasPw: true,
      needMax: true,
      shouldRead: true,
    });
  });

  it('tracks display image fallback state across Arweave gateway candidates', () => {
    const txId = 'DqYBh1qm9GvaTOGkF5R7abnLoB3OPiXNNBcTsYPtlRc';
    arweaveGlobals.CE_ARWEAVE_DIRECT_TO_AR_IO = true;
    arweaveGlobals.CE_ARWEAVE_AR_IO_URL = 'https://ar-io.dev';

    const image = `ar://${txId}`;
    const firstState = getDisplayImageRenderState({ image }, {}, '/default.png');
    expect(firstState.sourceKey).toBe(image);
    expect(firstState.activeIndex).toBe(0);
    expect(firstState.src).toBe(`https://ar-io.dev/${txId}`);
    expect(firstState.canRetry).toBe(true);

    const fallbackState = getDisplayImageRenderState(
      { image },
      {
        displayImageFallbackKey: image,
        displayImageFallbackIndex: 1,
      },
      '/default.png'
    );
    expect(fallbackState.activeIndex).toBe(1);
    expect(fallbackState.src).toBe(`https://arweave.net/${txId}`);

    const staleFallbackState = getDisplayImageRenderState(
      { image },
      {
        displayImageFallbackKey: 'https://example.test/old.png',
        displayImageFallbackIndex: 1,
      },
      '/default.png'
    );
    expect(staleFallbackState.activeIndex).toBe(0);
    expect(staleFallbackState.src).toBe(`https://ar-io.dev/${txId}`);
  });

  it('builds the next display image fallback state only from the active failed candidate', () => {
    expect(getDisplayImageFallbackCandidateCount(['a', 'b'])).toBe(2);
    expect(getDisplayImageFallbackCandidateCount('bad')).toBe(0);
    expect(getNextDisplayImageFallbackState(
      { sourceKey: 'image-a', activeIndex: 0, maxIndex: 2 },
      {}
    )).toEqual({
      displayImageFallbackKey: 'image-a',
      displayImageFallbackIndex: 1,
    });
    expect(getNextDisplayImageFallbackState(
      { sourceKey: 'image-a', activeIndex: 1, maxIndex: 2 },
      { displayImageFallbackKey: 'image-a', displayImageFallbackIndex: 1 }
    )).toEqual({
      displayImageFallbackKey: 'image-a',
      displayImageFallbackIndex: 2,
    });
    expect(getNextDisplayImageFallbackState(
      { sourceKey: 'image-a', activeIndex: 1, maxIndex: 2 },
      { displayImageFallbackKey: 'image-a', displayImageFallbackIndex: 0 }
    )).toBeNull();
  });

  it('builds holder occurrence maps, net counts, holder lists, and signatures', () => {
    expect(Array.from(buildSbtPageAddressOccurrenceMap(['0xA', '0xa', '', null]).entries())).toEqual([
      ['0xa', 2],
    ]);
    expect(Array.from(computeSbtPageNetCounts(['0xA', '0xB'], ['0xa']).entries())).toEqual([
      ['0xa', 0],
      ['0xb', 1],
    ]);
    expect(computeSbtPageNetHoldersList(['0xA', '0xB', '0xA'], ['0xa'])).toEqual(['0xa', '0xb']);
    expect(buildSbtPageHolderListSignature(['0xA', '0xB'])).toBe(
      buildSbtPageHolderListSignature(['0xa', '0xb'])
    );
    expect(buildSbtPageHolderListSignature(['0xA', '0xB'])).not.toBe(
      buildSbtPageHolderListSignature(['0xB', '0xA'])
    );
    const list = ['0xA', '0xB'];
    const firstMemoState = buildSbtPageAddressListSignatureMemoState({ list });
    expect(firstMemoState.signature).toBe(buildSbtPageHolderListSignature(list));
    const buildSignature = jest.fn(() => 'unused');
    const reusedMemoState = buildSbtPageAddressListSignatureMemoState({
      buildAddressListSignature: buildSignature,
      list,
      memo: firstMemoState.memo,
    });
    expect(reusedMemoState).toEqual(firstMemoState);
    expect(buildSignature).not.toHaveBeenCalled();
    expect(buildSbtPageAddressListSignatureMemoState({
      buildAddressListSignature: () => '',
      list: ['0xC'],
    }).signature).toBe('1:0');
    const minted = ['0xA', '0xB', '0xA'];
    const burned = ['0xa'];
    const firstNetState = buildSbtPageNetHoldersMemoState({
      burnedAddresses: burned,
      mintedAddresses: minted,
    });
    expect(firstNetState.netHolders).toEqual(['0xa', '0xb']);
    const computeNetHolders = jest.fn(() => ['unused']);
    const sameRefNetState = buildSbtPageNetHoldersMemoState({
      burnedAddresses: burned,
      computeNetHoldersList: computeNetHolders,
      memo: firstNetState.memo,
      mintedAddresses: minted,
    });
    expect(sameRefNetState).toEqual(firstNetState);
    expect(computeNetHolders).not.toHaveBeenCalled();
    const sameSignatureNetState = buildSbtPageNetHoldersMemoState({
      burnedAddresses: [...burned],
      computeNetHoldersList: computeNetHolders,
      memo: firstNetState.memo,
      mintedAddresses: [...minted],
    });
    expect(sameSignatureNetState.netHolders).toEqual(firstNetState.netHolders);
    expect(computeNetHolders).not.toHaveBeenCalled();
    expect(buildSbtPageModalFilteredMintedUsersPatch({
      filtered: [],
      isHolderScanActive: true,
      state: {
        filteredMintedUsers: ['0xA'],
        loadingMintedFilter: true,
      },
    })).toEqual({ loadingMintedFilter: false });
    expect(buildSbtPageModalFilteredMintedUsersPatch({
      buildAddressListSignature: () => 'next',
      filtered: ['0xB'],
      state: {
        filteredMintedUsersSignature: 'prev',
        loadingMintedFilter: true,
      },
    })).toEqual({
      filteredMintedUsers: ['0xB'],
      filteredMintedUsersSignature: 'next',
      loadingMintedFilter: false,
    });
    expect(buildSbtPageModalFilteredMintedUsersPatch({
      buildAddressListSignature: () => 'same',
      filtered: ['0xC'],
      state: {
        filteredMintedUsersSignature: 'same',
        loadingMintedFilter: false,
      },
    })).toBeNull();
  });

  it('normalizes minted-token overrides and count-map address expansion', () => {
    expect(sanitizeSbtPageMintedTokensOverride(3)).toBe('3');
    expect(sanitizeSbtPageMintedTokensOverride('4')).toBe('4');
    expect(sanitizeSbtPageMintedTokensOverride(-1)).toBeNull();
    expect(sanitizeSbtPageMintedTokensOverride(1.5)).toBeNull();
    expect(normalizeSbtPageCountMap({ '0xA': 2.9, '0xB': '1', '0xC': 0 })).toEqual({
      '0xa': 2,
      '0xb': 1,
    });
    expect(expandSbtPageAddressListFromCountMap({ '0xA': 2, '0xB': 1 })).toEqual(['0xa', '0xa', '0xb']);
    expect(expandSbtPageAddressListFromCountMap({}, ['0xFALLBACK'])).toEqual(['0xfallback']);
    expect(expandSbtPageAddressListFromCountMap(null, ['0xFALLBACK'])).toEqual(['0xfallback']);
  });

  it('normalizes invite codes and auto-mint query pairs', () => {
    expect(normalizeSbtInviteCode(' inv:abc ')).toBe('abc');
    expect(normalizeSbtInviteCode('INV: abc ')).toBe('abc');
    expect(normalizeSbtInviteCode('invite:def')).toBe('def');
    expect(normalizeSbtInviteCode(' raw ')).toBe('raw');
    expect(normalizeSbtInviteCode('')).toBe('');
    const decodeInvite = jest.fn((code: string) => (
      code === 'abc' ? { nonce: 'nonce-1', signature: 'sig-1' } : null
    ));
    expect(decodeSbtPageInviteInput(' inv:abc ', decodeInvite)).toEqual({
      inviteCode: 'abc',
      nonce: 'nonce-1',
      signature: 'sig-1',
    });
    expect(decodeInvite).toHaveBeenCalledWith('abc');
    expect(decodeSbtPageInviteInput('', decodeInvite)).toBeNull();
    expect(decodeSbtPageInviteInput('raw', decodeInvite)).toBeNull();

    expect(collectAutoMintPairsFromSearchParams('sbt=0xA&gp=secret&auto=1')).toEqual({
      globalAuto: true,
      pairs: [{ sbt: '0xA', gp: 'secret', inv: null, auto: true }],
    });
    expect(collectAutoMintPairsFromSearchParams('sbt1=0xA&gp1=a&auto1=1&sbt2=0xB&inv2=b')).toEqual({
      globalAuto: false,
      pairs: [
        { sbt: '0xA', gp: 'a', inv: null, auto: true },
        { sbt: '0xB', gp: null, inv: 'b', auto: false },
      ],
    });
    expect(hasSbtPageAutoMintFlag('?sbt=0xA&auto=1')).toBe(true);
    expect(hasSbtPageAutoMintFlag('sbt1=0xA&auto1=1')).toBe(true);
    expect(hasSbtPageAutoMintFlag('sbt=0xA&auto=0')).toBe(false);
    expect(buildSbtPageAutoMintCleanPath(
      'https://example.test/sbt/0xA?auto=1&sbt=0xA&gp=secret&keep=yes#section'
    )).toBe('/sbt/0xA?keep=yes');
    expect(buildSbtPageAutoMintCleanPath(
      'https://example.test/sbt/0xA?auto1=1&sbt1=0xA&gp1=secret&keep=yes'
    )).toBe('/sbt/0xA?keep=yes');
    expect(buildSbtPageAutoMintCleanPath('https://example.test/sbt/0xA?keep=yes')).toBeNull();
  });

  it('resolves URL auto-mint intent from scoped and legacy query params', () => {
    const propsIn = {
      SBTAddress: '0x00000000000000000000000000000000000000AA',
      loginComplete: true,
    };
    const state = { userHasSBT: false, mintingStatus: 'idle' };

    expect(resolveSbtPageUrlAutoMintIntent({
      propsIn,
      searchRaw: '?sbt=0x00000000000000000000000000000000000000aa&gp=secret&auto=1',
      state,
    })).toEqual({
      currentSbtAddress: propsIn.SBTAddress,
      targetInvite: null,
      targetPassword: 'secret',
      targetCode: 'secret',
      shouldAttemptAuto: true,
      autoKey: 'autoMint:unknown-chain:general:0x00000000000000000000000000000000000000aa:success',
    });
    expect(resolveSbtPageUrlAutoMintIntent({
      propsIn,
      searchRaw: '?inv=invite-code&auto=1',
      state,
    })?.targetInvite).toBe('invite-code');
    expect(resolveSbtPageUrlAutoMintIntent({
      propsIn,
      searchRaw: '?sbt=0x00000000000000000000000000000000000000bb&gp=secret&auto=1',
      state,
    })?.shouldAttemptAuto).toBe(false);
    expect(resolveSbtPageUrlAutoMintIntent({
      propsIn,
      searchRaw: '?sbt=0x00000000000000000000000000000000000000aa&gp=secret&auto=1',
      sessionStorageRef: { getItem: () => 'done' },
      state,
    })?.shouldAttemptAuto).toBe(false);
    expect(resolveSbtPageUrlAutoMintIntent({
      propsIn: { ...propsIn, loginComplete: false },
      searchRaw: '?sbt=0x00000000000000000000000000000000000000aa&gp=secret&auto=1',
      state,
    })?.shouldAttemptAuto).toBe(false);
    expect(resolveSbtPageUrlAutoMintIntent({
      propsIn: {},
      searchRaw: '?auto=1',
      state,
    })).toBeNull();
  });

  it('resolves prop-driven auto-mint gates', () => {
    expect(shouldRunSbtPagePropPasswordAutoMint({
      autoMintingMode: true,
      mintingStatus: 'idle',
      sbtInfo: { address: '0xSBT' },
      sbtMintPassword: 'secret',
      userHasSBT: false,
    })).toBe(true);
    expect(shouldRunSbtPagePropPasswordAutoMint({
      autoMintingMode: true,
      mintingStatus: 'pending',
      sbtInfo: { address: '0xSBT' },
      sbtMintPassword: 'secret',
      userHasSBT: false,
    })).toBe(false);
    expect(shouldRunSbtPagePropPasswordAutoMint({
      autoMintingMode: true,
      mintingStatus: 'idle',
      sbtInfo: { address: '0xSBT' },
      sbtMintPassword: ['secret'],
      userHasSBT: false,
    })).toBe(false);
    expect(shouldRunSbtPagePropPasswordAutoMint({
      autoMintingMode: true,
      mintingStatus: 'idle',
      sbtInfo: null,
      sbtMintPassword: 'secret',
      userHasSBT: false,
    })).toBe(false);
    expect(shouldRunSbtPagePropListAutoMint({
      autoMintingMode: true,
      hasAttemptedListMint: false,
      loginComplete: true,
      sbtMintPassword: ['one', 'two'],
    })).toBe(true);
    expect(shouldRunSbtPagePropListAutoMint({
      autoMintingMode: true,
      hasAttemptedListMint: true,
      loginComplete: true,
      sbtMintPassword: ['one', 'two'],
    })).toBe(false);
    expect(shouldRunSbtPagePropListAutoMint({
      autoMintingMode: true,
      hasAttemptedListMint: false,
      loginComplete: true,
      sbtMintPassword: 'one',
    })).toBe(false);
  });

  it('builds next filtered holder rows while preserving narrowed filters', () => {
    expect(buildSbtPageNextFilteredHolderRows({
      prevFilteredRows: ['0xA', '0xB'],
      prevNetHolders: ['0xA', '0xB'],
      nextNetHolders: ['0xC'],
      replaceRows: true,
    })).toEqual(['0xc']);
    expect(buildSbtPageNextFilteredHolderRows({
      prevFilteredRows: ['0xA'],
      prevNetHolders: ['0xA', '0xB'],
      nextNetHolders: ['0xA', '0xC'],
      replaceRows: true,
    })).toEqual(['0xa']);
  });

  it('merges new burn evidence into preserved holder state', () => {
    expect(mergeSbtPageBurnEvidenceIntoPreservedHolderState(
      ['0xA', '0xA', '0xB'],
      ['0xB'],
      ['0xA', '0xB'],
      ['0xA', '0xB']
    )).toEqual({
      mintedAddresses: ['0xa', '0xa', '0xb'],
      burnedAddresses: ['0xb', '0xa'],
      burnDiscovered: true,
    });
    expect(mergeSbtPageBurnEvidenceIntoPreservedHolderState(
      ['0xA'],
      [],
      ['0xA'],
      []
    ).burnDiscovered).toBe(false);
  });

  it('normalizes load-SBT-info options from booleans and option records', () => {
    expect(normalizeSbtPageLoadInfoOptions(true)).toEqual({
      forceEventFetch: true,
      preferCountsOnly: false,
    });
    expect(normalizeSbtPageLoadInfoOptions({ force: true, countsOnly: true })).toEqual({
      forceEventFetch: true,
      preferCountsOnly: true,
    });
    expect(normalizeSbtPageLoadInfoOptions({ forceEventFetch: true, preferCountsOnly: false })).toEqual({
      forceEventFetch: true,
      preferCountsOnly: false,
    });
    expect(normalizeSbtPageLoadInfoOptions(['bad'])).toEqual({
      forceEventFetch: false,
      preferCountsOnly: false,
    });
  });
});
