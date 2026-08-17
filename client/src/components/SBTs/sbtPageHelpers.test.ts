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

    expect(refreshSbtData).not.toHaveBeenCalled();
  });
});
