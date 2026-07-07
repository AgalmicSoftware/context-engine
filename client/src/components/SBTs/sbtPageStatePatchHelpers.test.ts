import {
  buildSbtPageAddressChangeResetMintUiPatch,
  buildSbtPageAdminInviteSuccessPatch,
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
  buildSbtPageErrorPatch,
  buildSbtPageExportFormatPatch,
  buildSbtPageIncludePreviousPasswordsPatch,
  buildSbtPageInitialState,
  buildSbtPageIntervalIdPatch,
  buildSbtPageLoadInfoLoadingStartPatch,
  buildSbtPageLoadingMintersBurnersPatch,
  buildSbtPageLogScanProgressPatch,
  buildSbtPageMiniPasswordInputPatch,
  buildSbtPageMintCountdownPatch,
  buildSbtPageMintFailurePatch,
  buildSbtPageMintPasswordClearPatch,
  buildSbtPageMintPasswordPrefillPatch,
  buildSbtPageMintPendingPatch,
  buildSbtPageMintSuccessPatch,
  buildSbtPageMintedModalInitialFilterPatch,
  buildSbtPageMintedModalVisibilityPatch,
  buildSbtPageNetworkUpdatePatch,
  buildSbtPagePasswordClaimStartSuccessPatch,
  buildSbtPagePasswordGenerationCountPatch,
  buildSbtPagePasswordInputValuePatch,
  buildSbtPagePasswordMintInputPatch,
  buildSbtPageRelevantInfoPatch,
  buildSbtPageResolvedSessionSlugPatch,
  buildSbtPageSbtInfoPatch,
} from './sbtPageStatePatchHelpers';

describe('sbtPageStatePatchHelpers', () => {
  it('builds initial state and generic state patches', () => {
    expect(buildSbtPageInitialState({ network: { id: 84532 } })).toEqual(
      expect.objectContaining({
        sbtInfo: null,
        userHasSBT: false,
        network: { id: 84532 },
        mintedAddresses: [],
        burnedAddresses: [],
        showStats: true,
        loadingMintersBurners: true,
        displayImageFallbackKey: '',
        displayImageFallbackIndex: 0,
      }),
    );
    expect(
      buildSbtPageBooleanTogglePatch({
        state: { showStats: true },
        stateKey: 'showStats',
      }),
    ).toEqual({ showStats: false });
    expect(buildSbtPageAddressChangeResetMintUiPatch({ sbtAddressChanged: false })).toBeNull();
    expect(buildSbtPageAddressChangeResetMintUiPatch({ sbtAddressChanged: true })).toEqual({
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
    expect(buildSbtPageAddressChangeResetMintUiPatch({ forceReset: true })).toEqual({
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
        resetMintUiState: { mintStep: 0 },
      }),
    ).toEqual({ mintStep: 0, network: { id: 10 } });
    expect(buildSbtPageErrorPatch({ error: 'boom' })).toEqual({ error: 'boom' });
    expect(buildSbtPageCachedPasswordsPatch({ cachedPasswords: ['a'] })).toEqual({ cachedPasswords: ['a'] });
    expect(buildSbtPageBookmarkedPatch({ bookmarked: 'yes' })).toEqual({ bookmarked: false });
  });

  it('builds mint and burn status patches', () => {
    expect(buildSbtPageMintFailurePatch({ error: 'fail' })).toEqual({
      error: 'fail',
      mintingStatus: 'failure',
    });
    expect(buildSbtPageMintPendingPatch({ clearError: true })).toEqual({
      mintingStatus: 'pending',
      lastTransactionType: 'mint',
      error: null,
    });
    expect(
      buildSbtPageMintSuccessPatch({
        clearManualPassword: true,
        mintStep: 2,
        txHash: '0xmint',
      }),
    ).toEqual({
      mintingStatus: 'success',
      transactionHash: '0xmint',
      lastTransactionType: 'mint',
      lastMintTxHash: '0xmint',
      mintStep: 2,
      manualPasswordInput: '',
    });
    expect(
      buildSbtPageBurnFailurePatch({
        error: 'burn failed',
        resetBurnSearch: true,
      }),
    ).toEqual({
      error: 'burn failed',
      burningStatus: 'failure',
      burnSearchInput: '',
      burnSearchResult: null,
      burnSearchType: null,
    });
    expect(buildSbtPageBurnPendingPatch()).toEqual({
      burningStatus: 'pending',
      lastTransactionType: 'burn',
    });
    expect(buildSbtPageBurnSuccessPatch({ resetBurnSearch: true, txHash: '0xburn' })).toEqual({
      burningStatus: 'success',
      transactionHash: '0xburn',
      lastTransactionType: 'burn',
      lastBurnTxHash: '0xburn',
      burnSearchInput: '',
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
        address: '0xA',
        resultType: 'holder',
        tokenId: 1,
      }),
    ).toEqual({
      burnSearchResult: {
        address: '0xA',
        tokenId: 1,
      },
      burnSearchType: 'holder',
    });
  });

  it('builds loading, modal, and display data patches', () => {
    expect(buildSbtPageMintedModalVisibilityPatch({ visible: true })).toEqual({ showModal: true });
    expect(
      buildSbtPageMintedModalInitialFilterPatch({
        buildAddressListSignature: () => 'sig',
        netHolders: ['0xA'],
      }),
    ).toEqual({
      filteredMintedUsers: ['0xA'],
      filteredMintedUsersSignature: 'sig',
      mintingAddressesFilterInitialized: true,
      loadingMintedFilter: false,
    });
    expect(buildSbtPageLoadingMintersBurnersPatch({ loading: true })).toEqual({
      loadingMintersBurners: true,
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
    expect(buildSbtPageMintCountdownPatch({ countdown: 3 })).toEqual({ mintCountdown: 3 });
    expect(buildSbtPageIntervalIdPatch({ intervalId: 7 })).toEqual({ intervalId: 7 });
    expect(buildSbtPageSbtInfoPatch({ sbtInfo: { address: '0xA' } })).toEqual({
      sbtInfo: { address: '0xA' },
    });
    expect(buildSbtPageResolvedSessionSlugPatch({ slug: 'alpha' })).toEqual({
      resolvedSessionSlug: 'alpha',
    });
    expect(buildSbtPageRelevantInfoPatch({ sbtLabel: 'Badge' })).toEqual({
      relevantQuestions: ['What is the purpose of this Badge?', 'How can I use this Badge?'],
      relevantDocuments: ['Badge Whitepaper', 'Community Guidelines'],
    });
    expect(
      buildSbtPageLogScanProgressPatch({
        progress: { phase: 'scan' },
        slug: 'alpha',
      }),
    ).toEqual({ logScanProgress: { phase: 'scan', slug: 'alpha' } });
  });

  it('builds password and admin patches', () => {
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
      buildSbtPagePasswordInputValuePatch({
        inputField: 'unknown',
        inputValue: null,
      }),
    ).toEqual({ groupPasswordInput: '' });
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
    expect(buildSbtPageAdminInviteSuccessPatch({ passwordList: ['one'] })).toEqual({
      adminGeneratedPasswords: ['one'],
      passwordGenerationCount: '',
    });
    expect(buildSbtPageExportFormatPatch({ exportFormat: null })).toEqual({ exportFormat: '' });
    expect(buildSbtPageIncludePreviousPasswordsPatch({ includePreviousPasswords: true })).toEqual({
      includePreviousPasswords: true,
    });
    expect(buildSbtPagePasswordGenerationCountPatch({ value: '12' })).toEqual({
      passwordGenerationCount: 12,
    });
    expect(buildSbtPageCopiedAddressPatch()).toEqual({ copiedAddress: null });
    expect(buildSbtPageCopiedErrorPatch({ copied: true })).toEqual({ copiedError: true });
    expect(buildSbtPageMiniPasswordInputPatch({ visible: true })).toEqual({
      showMiniPasswordInput: true,
    });
  });

  it('builds document modal patches', () => {
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
  });
});
