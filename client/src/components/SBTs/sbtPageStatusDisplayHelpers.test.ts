import {
  buildSbtPageActionButtonClassName,
  buildSbtPageAdminFallbackPatch,
  formatSbtPageBlockCount,
  hasUsableSbtPageScanProgress,
  isActiveSbtPageScanProgress,
  resolveSbtPageActionFeedbackState,
  resolveSbtPageHolderScanActive,
  resolveSbtPageManualClaimButtonState,
  resolveSbtPageMiniActionStatusDisplayState,
  resolveSbtPageMiniBurnButtonState,
  resolveSbtPageMiniBurnPermission,
  resolveSbtPageMiniControlDisplayState,
  resolveSbtPageMiniOpenMintButtonState,
  resolveSbtPageMiniTokenActionDisplayState,
  resolveSbtPageMintFlowDisplayState,
  resolveSbtPageBurnButtonState,
  resolveSbtPageBurnStatusButtonState,
  resolveSbtPageOpenMintButtonState,
  resolveSbtPagePasswordAlertState,
  resolveSbtPagePasswordGenerationButtonState,
  resolveSbtPagePasswordJoinButtonState,
  resolveSbtPagePendingButtonContentState,
  resolveSbtPageRemainingBlocksCount,
  resolveSbtPageRelevantInfoDisplayState,
  resolveSbtPageRelevantInfoLists,
  resolveSbtPageAdminActionState,
  resolveSbtPageAdminBurnButtonState,
  resolveSbtPageAdminCreatorAddresses,
  resolveSbtPageBurnAuthLabel,
  resolveSbtPageMaxTokensDisplay,
  resolveSbtPageStatusButtonContentState,
  shouldRenderSbtPageMintButton,
} from './sbtPageHelpers';

describe('sbtPageHelpers status and display helpers', () => {
  it('detects usable and active SBT scan progress', () => {
    expect(hasUsableSbtPageScanProgress(null)).toBe(false);
    expect(hasUsableSbtPageScanProgress({ totalBlocks: 10 })).toBe(true);
    expect(hasUsableSbtPageScanProgress({ currentBlock: 5, latestBlock: 5 })).toBe(true);
    expect(hasUsableSbtPageScanProgress({ remainingBlocks: 0 })).toBe(true);

    expect(isActiveSbtPageScanProgress({ remainingBlocks: 2 })).toBe(true);
    expect(isActiveSbtPageScanProgress({ remainingBlocks: 0 })).toBe(false);
    expect(isActiveSbtPageScanProgress({ totalBlocks: 10, scannedBlocks: 9 })).toBe(true);
    expect(isActiveSbtPageScanProgress({ totalBlocks: 10, scannedBlocks: 10 })).toBe(false);
    expect(isActiveSbtPageScanProgress({ currentBlock: 5, latestBlock: 6 })).toBe(true);
    expect(isActiveSbtPageScanProgress({ currentBlock: 6, latestBlock: 6 })).toBe(false);
    expect(resolveSbtPageHolderScanActive()).toBe(false);
    expect(resolveSbtPageHolderScanActive({ hasActiveScanProgress: true })).toBe(true);
    expect(resolveSbtPageHolderScanActive({ loadingMintersBurners: true })).toBe(true);
    expect(resolveSbtPageHolderScanActive({ loadingMintedFilter: true })).toBe(true);
    expect(resolveSbtPageHolderScanActive({ sbtScanInProgress: true })).toBe(true);
    expect(resolveSbtPageHolderScanActive({ sbtScanPending: true })).toBe(true);
    expect(formatSbtPageBlockCount(12345.6)).toBe('12,345.6');
    expect(formatSbtPageBlockCount('bad')).toBe('-');
    expect(resolveSbtPageRemainingBlocksCount({ remainingBlocks: 12.5 })).toBe(12.5);
    expect(resolveSbtPageRemainingBlocksCount({ totalBlocks: 20, scannedBlocks: 7 })).toBe(13);
    expect(resolveSbtPageRemainingBlocksCount({ totalBlocks: 5, scannedBlocks: 8 })).toBe(0);
    expect(resolveSbtPageRemainingBlocksCount({ totalBlocks: 'bad', scannedBlocks: 1 })).toBeNaN();
    expect(resolveSbtPageBurnAuthLabel('AdminOnly')).toBe('Admin Only');
    expect(resolveSbtPageBurnAuthLabel('OwnerOnly')).toBe('Owner Only');
    expect(resolveSbtPageBurnAuthLabel(2)).toBe('Both');
    expect(resolveSbtPageBurnAuthLabel('3')).toBe('?');
    expect(resolveSbtPageBurnAuthLabel(null)).toBe('?');
    expect(resolveSbtPageMaxTokensDisplay('0')).toBe('∞');
    expect(resolveSbtPageMaxTokensDisplay(0)).toBe('0');
    expect(resolveSbtPageMaxTokensDisplay(25)).toBe('25');
    expect(resolveSbtPageMaxTokensDisplay(null)).toBe('-');
    expect(
      buildSbtPageAdminFallbackPatch({
        adminAddress: ' 0xAdmin ',
        ownerAddress: '0xOwner',
        zeroAddress: '0x0000000000000000000000000000000000000000',
      }),
    ).toEqual({
      admin: '0xAdmin',
      admin_: '0xAdmin',
      creator: '0xAdmin',
      deployer: '0xAdmin',
    });
    expect(
      buildSbtPageAdminFallbackPatch({
        adminAddress: '0x0000000000000000000000000000000000000000',
        existingCreator: '0xCreator',
        existingDeployer: '0xDeployer',
        ownerAddress: ' 0xOwner ',
        zeroAddress: '0x0000000000000000000000000000000000000000',
      }),
    ).toEqual({
      admin: '0xOwner',
      admin_: '0xOwner',
    });
    expect(
      buildSbtPageAdminFallbackPatch({
        adminAddress: '',
        ownerAddress: '0x0000000000000000000000000000000000000000',
        zeroAddress: '0x0000000000000000000000000000000000000000',
      }),
    ).toEqual({});
    expect(
      resolveSbtPageAdminCreatorAddresses({
        admin_: '0xAdminUnderscore',
        creator: '0xCreator',
        deployer: '0xDeployer',
      }),
    ).toEqual({
      adminAddress: '0xAdminUnderscore',
      creatorAddress: '0xCreator',
    });
    expect(
      resolveSbtPageAdminCreatorAddresses({
        deployer: '0xDeployer',
      }),
    ).toEqual({
      adminAddress: '0xDeployer',
      creatorAddress: '0xDeployer',
    });
    expect(resolveSbtPageAdminCreatorAddresses(null)).toEqual({
      adminAddress: '',
      creatorAddress: '',
    });
    expect(
      resolveSbtPageMiniBurnPermission({
        account: '0xADMIN',
        sbtInfo: { admin: '0xadmin', burnAuth: 0 },
        userIsSbtAdmin: false,
      }),
    ).toEqual({
      canAdminBurn: false,
      canBurnMini: true,
      canOwnerBurn: true,
    });
    expect(
      resolveSbtPageMiniBurnPermission({
        account: '0xUSER',
        sbtInfo: { admin_: '0xadmin', burnAuth: 0 },
        userIsSbtAdmin: true,
      }),
    ).toEqual({
      canAdminBurn: true,
      canBurnMini: true,
      canOwnerBurn: false,
    });
    expect(
      resolveSbtPageMiniBurnPermission({
        account: '0xUSER',
        sbtInfo: { burnAuth: 1 },
        userIsSbtAdmin: false,
      }),
    ).toMatchObject({
      canBurnMini: true,
      canOwnerBurn: true,
    });
    expect(
      resolveSbtPageMiniBurnPermission({
        account: '',
        sbtInfo: { burnAuth: 0 },
        userIsSbtAdmin: false,
      }),
    ).toEqual({
      canAdminBurn: false,
      canBurnMini: false,
      canOwnerBurn: false,
    });
    expect(
      resolveSbtPageBurnButtonState({
        account: '0xADMIN',
        sbtInfo: { admin: '0xadmin', burnAuth: 0 },
        userHasSBT: true,
      }),
    ).toEqual({
      canOwnerBurn: true,
      shouldRenderBurnButton: true,
    });
    expect(
      resolveSbtPageBurnButtonState({
        account: '0xUSER',
        sbtInfo: { burnAuth: 1 },
        userHasSBT: true,
      }),
    ).toEqual({
      canOwnerBurn: true,
      shouldRenderBurnButton: true,
    });
    expect(
      resolveSbtPageBurnButtonState({
        account: '0xUSER',
        sbtInfo: { burnAuth: 1 },
        userHasSBT: false,
      }),
    ).toEqual({
      canOwnerBurn: false,
      shouldRenderBurnButton: false,
    });
    expect(
      resolveSbtPageBurnButtonState({
        account: '0xUSER',
        sbtInfo: { admin_: '0xadmin', burnAuth: 0 },
        userHasSBT: true,
      }),
    ).toEqual({
      canOwnerBurn: false,
      shouldRenderBurnButton: false,
    });
    expect(
      resolveSbtPageBurnStatusButtonState({
        burningStatus: 'idle',
      }),
    ).toEqual({
      disabled: false,
      isFailure: false,
      isIdle: true,
      isPending: false,
      isSuccess: false,
    });
    expect(
      resolveSbtPageBurnStatusButtonState({
        burningStatus: 'pending',
      }),
    ).toEqual({
      disabled: true,
      isFailure: false,
      isIdle: false,
      isPending: true,
      isSuccess: false,
    });
    expect(
      resolveSbtPageBurnStatusButtonState({
        burningStatus: 'success',
      }),
    ).toEqual({
      disabled: false,
      isFailure: false,
      isIdle: false,
      isPending: false,
      isSuccess: true,
    });
    expect(
      resolveSbtPageBurnStatusButtonState({
        burningStatus: 'failure',
      }),
    ).toEqual({
      disabled: false,
      isFailure: true,
      isIdle: false,
      isPending: false,
      isSuccess: false,
    });
    expect(
      resolveSbtPageBurnStatusButtonState({
        burningStatus: '',
      }),
    ).toMatchObject({
      disabled: true,
    });
    expect(
      resolveSbtPageAdminBurnButtonState({
        burnSearchResult: { tokenId: '1' },
        burningStatus: 'idle',
      }),
    ).toEqual({
      disabled: false,
      isFailure: false,
      isIdle: true,
      isPending: false,
      isSuccess: false,
    });
    expect(
      resolveSbtPageAdminBurnButtonState({
        burnSearchResult: null,
        burningStatus: 'idle',
      }),
    ).toMatchObject({
      disabled: true,
      isIdle: true,
    });
    expect(
      resolveSbtPageAdminBurnButtonState({
        burnSearchResult: { tokenId: '1' },
        burningStatus: 'pending',
      }),
    ).toMatchObject({
      disabled: true,
      isPending: true,
    });
    expect(
      resolveSbtPageOpenMintButtonState({
        burningStatus: 'idle',
        lastMintTxHash: '0xtx',
        mintLowerLabel: 'collect',
        mintingStatus: 'success',
      }),
    ).toEqual({
      canOpenMintTx: true,
      disabled: false,
      isFailure: false,
      isIdle: false,
      isMinted: true,
      isPending: false,
      readinessDescriptor: {
        canOpenMintTx: true,
        hasMintTransactionHash: true,
        isBurnCleared: false,
        isMinted: true,
        isPending: false,
      },
      title: 'View collect transaction',
    });
    expect(
      resolveSbtPageOpenMintButtonState({
        burningStatus: 'idle',
        lastMintTxHash: '',
        mintingStatus: 'success',
      }),
    ).toEqual({
      canOpenMintTx: false,
      disabled: true,
      isFailure: false,
      isIdle: false,
      isMinted: true,
      isPending: false,
      readinessDescriptor: {
        canOpenMintTx: false,
        hasMintTransactionHash: false,
        isBurnCleared: false,
        isMinted: true,
        isPending: false,
      },
      title: undefined,
    });
    expect(
      resolveSbtPageOpenMintButtonState({
        burningStatus: 'success',
        lastMintTxHash: '0xtx',
        mintingStatus: 'success',
      }),
    ).toEqual({
      canOpenMintTx: false,
      disabled: false,
      isFailure: false,
      isIdle: false,
      isMinted: false,
      isPending: false,
      readinessDescriptor: {
        canOpenMintTx: false,
        hasMintTransactionHash: true,
        isBurnCleared: true,
        isMinted: false,
        isPending: false,
      },
      title: undefined,
    });
    expect(
      resolveSbtPageOpenMintButtonState({
        mintingStatus: 'idle',
      }),
    ).toMatchObject({
      disabled: false,
      isIdle: true,
      isPending: false,
    });
    expect(
      resolveSbtPageOpenMintButtonState({
        mintingStatus: 'pending',
      }),
    ).toMatchObject({
      disabled: true,
      isMinted: false,
      isPending: true,
    });
    expect(
      resolveSbtPageOpenMintButtonState({
        mintingStatus: 'failure',
      }),
    ).toMatchObject({
      disabled: false,
      isFailure: true,
      isPending: false,
    });
    expect(
      resolveSbtPagePasswordJoinButtonState({
        groupPasswordInput: '  secret ',
        mintingStatus: 'idle',
      }),
    ).toEqual({
      disabled: false,
      isPending: false,
    });
    expect(
      resolveSbtPagePasswordJoinButtonState({
        groupPasswordInput: '   ',
        mintingStatus: 'idle',
      }),
    ).toEqual({
      disabled: true,
      isPending: false,
    });
    expect(
      resolveSbtPagePasswordJoinButtonState({
        groupPasswordInput: 'secret',
        mintingStatus: 'pending',
      }),
    ).toEqual({
      disabled: true,
      isPending: true,
    });
    expect(
      resolveSbtPagePendingButtonContentState({
        isPending: false,
        label: 'Join',
      }),
    ).toEqual({
      label: 'Join',
      shouldRenderLabel: true,
      shouldRenderPendingIcon: false,
    });
    expect(
      resolveSbtPagePendingButtonContentState({
        isPending: true,
        label: 'Join',
      }),
    ).toEqual({
      label: 'Join',
      shouldRenderLabel: false,
      shouldRenderPendingIcon: true,
    });
    expect(
      resolveSbtPageStatusButtonContentState({
        idleLabel: 'Join',
        isIdle: true,
        successLabel: 'Minted',
      }),
    ).toEqual({
      failureLabel: 'Failed',
      idleLabel: 'Join',
      shouldRenderFailure: false,
      shouldRenderIdleLabel: true,
      shouldRenderPendingIcon: false,
      shouldRenderSuccess: false,
      successLabel: 'Minted',
    });
    expect(
      resolveSbtPageStatusButtonContentState({
        isFailure: true,
        isPending: true,
        isSuccess: true,
      }),
    ).toMatchObject({
      shouldRenderFailure: true,
      shouldRenderIdleLabel: false,
      shouldRenderPendingIcon: true,
      shouldRenderSuccess: true,
    });
    expect(
      resolveSbtPagePasswordGenerationButtonState({
        passwordGenerationCount: 3,
      }),
    ).toEqual({
      disabled: false,
    });
    expect(
      resolveSbtPagePasswordGenerationButtonState({
        passwordGenerationCount: '2',
      }),
    ).toEqual({
      disabled: false,
    });
    expect(
      resolveSbtPagePasswordGenerationButtonState({
        passwordGenerationCount: 0,
      }),
    ).toEqual({
      disabled: true,
    });
    expect(
      resolveSbtPagePasswordGenerationButtonState({
        passwordGenerationCount: '',
      }),
    ).toEqual({
      disabled: true,
    });
    expect(
      resolveSbtPagePasswordAlertState({
        mintPassword: 'local-code',
        showPasswordAlert: true,
      }),
    ).toEqual({
      showDetectedPasswordAlert: true,
    });
    expect(
      resolveSbtPagePasswordAlertState({
        mintPassword: '',
        sbtMintPassword: 'prop-code',
        showPasswordAlert: true,
      }),
    ).toEqual({
      showDetectedPasswordAlert: true,
    });
    expect(
      resolveSbtPagePasswordAlertState({
        mintPassword: 'local-code',
        sbtMintPassword: 'prop-code',
        showPasswordAlert: false,
      }),
    ).toEqual({
      showDetectedPasswordAlert: false,
    });
    expect(
      resolveSbtPageActionFeedbackState({
        burningStatus: 'idle',
        lastMintTxHash: '0xmint',
        mintingStatus: 'success',
      }),
    ).toEqual({
      showBurnSuccess: false,
      showErrorTransactionHash: false,
      showMintSuccess: true,
      showTransactionError: false,
    });
    expect(
      resolveSbtPageActionFeedbackState({
        burningStatus: 'success',
        lastBurnTxHash: '0xburn',
        lastMintTxHash: '0xmint',
        mintingStatus: 'success',
      }),
    ).toEqual({
      showBurnSuccess: true,
      showErrorTransactionHash: false,
      showMintSuccess: false,
      showTransactionError: false,
    });
    expect(
      resolveSbtPageActionFeedbackState({
        burningStatus: 'idle',
        lastMintTxHash: '',
        mintingStatus: 'success',
      }),
    ).toMatchObject({
      showMintSuccess: false,
    });
    expect(
      resolveSbtPageActionFeedbackState({
        burningStatus: 'failure',
        error: 'Denied',
        mintingStatus: 'idle',
        transactionHash: '0xfail',
      }),
    ).toEqual({
      showBurnSuccess: false,
      showErrorTransactionHash: true,
      showMintSuccess: false,
      showTransactionError: true,
    });
    expect(
      resolveSbtPageActionFeedbackState({
        burningStatus: 'failure',
        error: '',
        mintingStatus: 'idle',
        transactionHash: '0xfail',
      }),
    ).toMatchObject({
      showErrorTransactionHash: false,
      showTransactionError: false,
    });
    expect(
      resolveSbtPageManualClaimButtonState({
        manualPasswordInput: ' code ',
        mintingStatus: 'idle',
      }),
    ).toEqual({
      disabled: false,
      isPending: false,
    });
    expect(
      resolveSbtPageManualClaimButtonState({
        manualPasswordInput: '   ',
        mintingStatus: 'idle',
      }),
    ).toEqual({
      disabled: true,
      isPending: false,
    });
    expect(
      resolveSbtPageManualClaimButtonState({
        manualPasswordInput: 'code',
        mintingStatus: 'pending',
      }),
    ).toEqual({
      disabled: true,
      isPending: true,
    });
    expect(
      resolveSbtPageMiniOpenMintButtonState({
        mintingStatus: 'idle',
      }),
    ).toEqual({
      disabled: false,
      isFailure: false,
      isIdle: true,
      isPending: false,
      isSuccess: false,
    });
    expect(
      resolveSbtPageMiniOpenMintButtonState({
        mintingStatus: 'pending',
      }),
    ).toEqual({
      disabled: true,
      isFailure: false,
      isIdle: false,
      isPending: true,
      isSuccess: false,
    });
    expect(
      resolveSbtPageMiniOpenMintButtonState({
        mintingStatus: 'failure',
      }),
    ).toEqual({
      disabled: false,
      isFailure: true,
      isIdle: false,
      isPending: false,
      isSuccess: false,
    });
    expect(
      resolveSbtPageMiniOpenMintButtonState({
        mintingStatus: 'success',
      }),
    ).toEqual({
      disabled: false,
      isFailure: false,
      isIdle: false,
      isPending: false,
      isSuccess: true,
    });
    expect(resolveSbtPageMiniActionStatusDisplayState()).toEqual({
      style: { marginTop: '10px' },
    });
    expect(resolveSbtPageMiniActionStatusDisplayState({ isFailure: true })).toEqual({
      style: { marginTop: '10px', color: 'red' },
    });
    expect(
      buildSbtPageActionButtonClassName({
        actionClassName: 'action-button',
        variantClassName: 'mint-button',
      }),
    ).toBe('action-button mint-button');
    expect(
      buildSbtPageActionButtonClassName({
        actionClassName: 'action-button',
        includeMiniClass: true,
        miniClassName: 'mini-button',
        variantClassName: 'mint-button',
      }),
    ).toBe('action-button mint-button mini-button');
    expect(resolveSbtPageMiniControlDisplayState()).toEqual({
      inputStyle: {},
      topMarginStyle: { marginTop: '10px' },
    });
    expect(resolveSbtPageMiniControlDisplayState({ inputMaxWidth: ' 140px ' })).toEqual({
      inputStyle: { maxWidth: '140px' },
      topMarginStyle: { marginTop: '10px' },
    });
    expect(
      resolveSbtPageMiniBurnButtonState({
        burningStatus: 'pending',
      }),
    ).toEqual({
      disabled: true,
      isPending: true,
    });
    expect(
      resolveSbtPageMiniBurnButtonState({
        burningStatus: 'idle',
      }),
    ).toEqual({
      disabled: false,
      isPending: false,
    });
    expect(
      resolveSbtPageMiniTokenActionDisplayState({
        burningStatus: 'success',
        canBurnMini: true,
      }),
    ).toEqual({
      shouldRenderBurnButton: false,
      shouldRenderBurnedStatus: true,
      shouldRenderJoinedStatus: false,
    });
    expect(
      resolveSbtPageMiniTokenActionDisplayState({
        burningStatus: 'idle',
        canBurnMini: true,
      }),
    ).toEqual({
      shouldRenderBurnButton: true,
      shouldRenderBurnedStatus: false,
      shouldRenderJoinedStatus: false,
    });
    expect(
      resolveSbtPageMiniTokenActionDisplayState({
        burningStatus: 'idle',
        canBurnMini: false,
      }),
    ).toEqual({
      shouldRenderBurnButton: false,
      shouldRenderBurnedStatus: false,
      shouldRenderJoinedStatus: true,
    });
    expect(
      shouldRenderSbtPageMintButton({
        burningStatus: 'idle',
        nowSeconds: 100,
        sbtInfo: { mintingEndTime: 0 },
        userHasSBT: true,
      }),
    ).toBe(false);
    expect(
      shouldRenderSbtPageMintButton({
        burningStatus: 'success',
        nowSeconds: 100,
        sbtInfo: { mintingEndTime: 0 },
        userHasSBT: true,
      }),
    ).toBe(true);
    expect(
      shouldRenderSbtPageMintButton({
        burningStatus: 'idle',
        nowSeconds: 100,
        sbtInfo: null,
        userHasSBT: false,
      }),
    ).toBe(false);
    expect(
      shouldRenderSbtPageMintButton({
        burningStatus: 'idle',
        nowSeconds: 100,
        sbtInfo: { mintingEndTime: 90 },
        userHasSBT: false,
      }),
    ).toBe(false);
    expect(
      shouldRenderSbtPageMintButton({
        burningStatus: 'idle',
        nowSeconds: 100,
        sbtInfo: { mintingEndTime: '101' },
        userHasSBT: false,
      }),
    ).toBe(true);
    expect(
      shouldRenderSbtPageMintButton({
        burningStatus: 'idle',
        nowSeconds: 100,
        sbtInfo: { mintingEndTime: undefined },
        userHasSBT: false,
      }),
    ).toBe(true);
    expect(
      resolveSbtPageAdminActionState({
        account: '0xADMIN',
        hasInviteMint: true,
        sbtInfo: {
          admin: '0xadmin',
          burnAuth: 2,
          hasPasswordMint: true,
          maxTokens: '0',
        },
      }),
    ).toEqual({
      canAdminBurn: true,
      hasPasswordMint: true,
      isInvite: true,
      showNoMoreInvites: false,
      showPasswordGen: true,
    });
    expect(
      resolveSbtPageAdminActionState({
        account: '0xUSER',
        hasInviteMint: false,
        sbtInfo: {
          admin_: '0xadmin',
          burnAuth: 0,
          hasPasswordMint: true,
          maxTokens: '5',
        },
      }),
    ).toEqual({
      canAdminBurn: false,
      hasPasswordMint: true,
      isInvite: false,
      showNoMoreInvites: true,
      showPasswordGen: false,
    });
    expect(
      resolveSbtPageAdminActionState({
        sbtInfo: {
          burnAuth: 1,
          hasPasswordMint: false,
          maxTokens: '0',
        },
      }),
    ).toMatchObject({
      canAdminBurn: false,
      hasPasswordMint: false,
      showNoMoreInvites: false,
      showPasswordGen: false,
    });
    expect(
      resolveSbtPageMintFlowDisplayState({
        hasGroupPasswordMint: true,
        hasInviteMint: true,
        mintingStatus: 'pending',
        mintStep: 0,
        sbtInfo: { hasPasswordMint: true },
      }),
    ).toMatchObject({
      shouldRenderGroupPasswordJoin: true,
      shouldRenderInviteJoin: false,
      shouldSuppressMintControls: false,
    });
    expect(
      resolveSbtPageMintFlowDisplayState({
        hasGroupPasswordMint: true,
        mintingStatus: 'success',
        sbtInfo: { hasPasswordMint: true },
      }),
    ).toMatchObject({
      shouldRenderGroupPasswordJoin: false,
      shouldSuppressMintControls: true,
    });
    expect(
      resolveSbtPageMintFlowDisplayState({
        hasInviteMint: true,
        mintingStatus: 'success',
        sbtInfo: { hasPasswordMint: true },
      }),
    ).toMatchObject({
      shouldRenderInviteJoin: false,
      shouldSuppressMintControls: true,
    });
    expect(
      resolveSbtPageMintFlowDisplayState({
        mintStep: 0,
        sbtInfo: { hasPasswordMint: false },
      }),
    ).toMatchObject({
      shouldRenderOpenMintButton: true,
      shouldRenderManualClaimStart: false,
    });
    expect(
      resolveSbtPageMintFlowDisplayState({
        mintStep: 2,
        sbtInfo: { hasPasswordMint: true },
      }),
    ).toMatchObject({
      shouldRenderManualClaimFinish: true,
      shouldRenderOpenMintButton: false,
    });
    expect(
      resolveSbtPageMintFlowDisplayState({
        mintStep: 3,
        sbtInfo: { hasPasswordMint: true },
      }),
    ).toMatchObject({
      shouldRenderClaimSuccess: true,
      shouldRenderManualClaimFinish: false,
    });
    expect(
      resolveSbtPageRelevantInfoLists({
        sbtInfo: {
          documentIDHashes: ['hash-a', null, 3],
          documentURLs: ['https://example.test/doc', 7],
          tags: ['tag-a', undefined],
        },
      }),
    ).toEqual({
      documentIDHashes: ['hash-a', '', '3'],
      documentURLs: ['https://example.test/doc', '7'],
      tags: ['tag-a', ''],
    });
    expect(
      resolveSbtPageRelevantInfoLists({
        sbtInfo: {
          docURL: 'https://example.test/single-doc',
          documents: [{ href: 'https://example.test/object-doc' }],
        },
      }).documentURLs,
    ).toEqual(['https://example.test/single-doc', 'https://example.test/object-doc']);
    expect(
      resolveSbtPageRelevantInfoLists({
        sbtInfo: null,
      }),
    ).toEqual({
      documentIDHashes: [],
      documentURLs: [],
      tags: [],
    });
    expect(
      resolveSbtPageRelevantInfoDisplayState({
        documentIDHashes: ['hash-a'],
        documentURLs: [],
        tags: ['tag-a'],
      }),
    ).toEqual({
      shouldRenderDocumentIdHashes: true,
      shouldRenderDocumentUrls: false,
      shouldRenderTags: true,
    });
    expect(
      resolveSbtPageRelevantInfoDisplayState({
        documentIDHashes: 'bad',
        documentURLs: null,
        tags: [],
      }),
    ).toEqual({
      shouldRenderDocumentIdHashes: false,
      shouldRenderDocumentUrls: false,
      shouldRenderTags: false,
    });
  });
});
