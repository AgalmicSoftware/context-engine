import {
  buildSbtPageActionButtonClassName,
  resolveSbtPageActionFeedbackState,
  resolveSbtPageAdminActionState,
  resolveSbtPageAdminBurnButtonState,
  resolveSbtPageBurnActionPlan,
  resolveSbtPageBurnButtonState,
  resolveSbtPageBurnStatusButtonState,
  resolveSbtPageManualClaimButtonState,
  resolveSbtPageMiniActionFailureState,
  resolveSbtPageMiniActionStatusDisplayState,
  resolveSbtPageMiniBurnButtonState,
  resolveSbtPageMiniBurnPermission,
  resolveSbtPageMiniControlDisplayState,
  resolveSbtPageMiniMintActionPlan,
  resolveSbtPageMiniMintFlowDisplayState,
  resolveSbtPageMiniMintState,
  resolveSbtPageMiniOpenMintButtonState,
  resolveSbtPageMiniTokenActionDisplayState,
  resolveSbtPageMintEndDisplayState,
  resolveSbtPageMintActionPlan,
  resolveSbtPageMintFlowDisplayState,
  resolveSbtPageOpenMintButtonState,
  resolveSbtPagePasswordAlertState,
  resolveSbtPagePasswordGenerationButtonState,
  resolveSbtPagePasswordJoinButtonState,
  resolveSbtPagePendingButtonContentState,
  resolveSbtPageStatusButtonContentState,
  shouldRenderSbtPageMintButton,
} from './sbtPageActionDisplayHelpers';

describe('sbtPageActionDisplayHelpers', () => {
  it('resolves mint end and mini mint state', () => {
    expect(resolveSbtPageMintEndDisplayState({
      nowMs: Date.UTC(2026, 0, 1),
      sbtInfo: { mintingEndTime: Date.UTC(2026, 0, 2) / 1000 },
    })).toMatchObject({
      status: 'active',
      unixTS: Date.UTC(2026, 0, 2) / 1000,
    });
    expect(resolveSbtPageMintEndDisplayState({
      sbtInfo: { mintingEndTime: 0 },
    })).toEqual({
      fullMintEndDate: '',
      status: 'never',
      unixTS: 0,
    });
    expect(resolveSbtPageMiniMintState({
      burningStatus: 'idle',
      mintingStatus: 'success',
      nowSec: 100,
      sbtAddress: '0xABC',
      sbtInfo: { mintingEndTime: 0 },
    })).toEqual({
      hasTokenMini: true,
      isMintingActive: true,
      justJoined: true,
      mintStatusId: 'mintStatus-0xabc',
      shouldRenderEndedIndicator: false,
      shouldRenderLiveIndicator: true,
    });
    expect(resolveSbtPageMiniActionFailureState({
      hasTokenMini: false,
      mintingStatus: 'failure',
    })).toEqual({
      showBurnFailedStatus: false,
      showMintFailedStatus: true,
    });
  });

  it('resolves mini and full mint flow visibility', () => {
    expect(resolveSbtPageMiniMintFlowDisplayState({
      hasPasswordMint: true,
      isMintingActive: true,
      miniMintable: true,
      mintStep: 2,
    })).toMatchObject({
      shouldRenderManualPasswordFinishInput: true,
      shouldRenderOpenMintButton: false,
    });
    expect(resolveSbtPageMiniMintFlowDisplayState({
      hasInviteMint: true,
      isMintingActive: true,
      miniMintable: true,
      showMiniPasswordInput: false,
    })).toMatchObject({
      shouldRenderInviteDisclosureButton: true,
      shouldRenderInviteInput: false,
    });
    expect(resolveSbtPageMintFlowDisplayState({
      hasGroupPasswordMint: false,
      hasInviteMint: false,
      mintStep: 1,
      sbtInfo: { hasPasswordMint: true },
    })).toMatchObject({
      shouldRenderClaimCountdown: true,
      shouldRenderManualClaimStart: false,
      shouldRenderOpenMintButton: false,
    });
    expect(resolveSbtPageMintFlowDisplayState({
      hasGroupPasswordMint: true,
      mintingStatus: 'success',
    })).toMatchObject({
      shouldRenderGroupPasswordJoin: false,
      shouldSuppressMintControls: true,
    });
  });

  it('describes mini-card mint display and selected handler without invoking side effects', () => {
    expect(resolveSbtPageMiniMintActionPlan({
      isMintingActive: true,
      miniMintable: false,
    })).toEqual({
      blockedReason: 'mini-mint-unavailable',
      disabled: true,
      handlerKind: 'none',
      inertReason: 'hidden',
      isInteractive: false,
      labelKind: 'none',
      shouldRenderMintArea: false,
      viewKind: 'hidden',
    });
    expect(resolveSbtPageMiniMintActionPlan({
      hasTokenMini: true,
      isMintingActive: true,
      miniMintable: true,
    })).toMatchObject({
      blockedReason: 'already-has-token',
      shouldRenderMintArea: false,
      viewKind: 'hidden',
    });
    expect(resolveSbtPageMiniMintActionPlan({
      isMintingActive: false,
      miniMintable: true,
    })).toMatchObject({
      blockedReason: 'mint-ended',
      shouldRenderMintArea: false,
      viewKind: 'hidden',
    });
    expect(resolveSbtPageMiniMintActionPlan({
      isMintingActive: true,
      miniMintable: true,
    })).toMatchObject({
      blockedReason: 'none',
      disabled: false,
      handlerKind: 'mini-mint',
      inertReason: 'none',
      isInteractive: true,
      labelKind: 'status',
      shouldRenderMintArea: true,
      viewKind: 'open-mint-button',
    });
    expect(resolveSbtPageMiniMintActionPlan({
      isMintingActive: true,
      miniMintable: true,
      miniOpenMintButtonState: { disabled: true },
    })).toMatchObject({
      disabled: true,
      handlerKind: 'mini-mint',
      inertReason: 'disabled',
      isInteractive: false,
      viewKind: 'open-mint-button',
    });
    expect(resolveSbtPageMiniMintActionPlan({
      hasInviteMint: true,
      isMintingActive: true,
      miniMintable: true,
    })).toMatchObject({
      disabled: false,
      handlerKind: 'show-password-input',
      labelKind: 'join',
      viewKind: 'invite-disclosure',
    });
    expect(resolveSbtPageMiniMintActionPlan({
      hasInviteMint: true,
      isMintingActive: true,
      miniMintable: true,
      miniPasswordJoinButtonState: { disabled: true },
      showMiniPasswordInput: true,
    })).toMatchObject({
      disabled: true,
      handlerKind: 'claim-with-invite-code',
      inertReason: 'disabled',
      labelKind: 'join',
      viewKind: 'invite-input',
    });
    expect(resolveSbtPageMiniMintActionPlan({
      hasGroupPasswordMint: true,
      isMintingActive: true,
      miniMintable: true,
      showMiniPasswordInput: true,
    })).toMatchObject({
      handlerKind: 'mint-unlimited-with-group-password',
      labelKind: 'join',
      viewKind: 'group-password-input',
    });
    expect(resolveSbtPageMiniMintActionPlan({
      hasPasswordMint: true,
      isMintingActive: true,
      miniManualClaimButtonState: { disabled: true },
      miniMintable: true,
      showMiniPasswordInput: true,
    })).toMatchObject({
      disabled: true,
      handlerKind: 'mini-mint',
      inertReason: 'disabled',
      labelKind: 'join',
      viewKind: 'manual-password-start-input',
    });
    expect(resolveSbtPageMiniMintActionPlan({
      hasPasswordMint: true,
      isMintingActive: true,
      miniMintable: true,
      mintStep: 2,
    })).toMatchObject({
      handlerKind: 'mini-mint',
      labelKind: 'finish',
      viewKind: 'manual-password-finish-input',
    });
    expect(resolveSbtPageMiniMintActionPlan({
      hasPasswordMint: true,
      isMintingActive: true,
      miniMintable: true,
      mintStep: 1,
    })).toMatchObject({
      handlerKind: 'none',
      inertReason: 'status-only',
      isInteractive: false,
      labelKind: 'countdown',
      viewKind: 'manual-claim-countdown',
    });
  });

  it('re-opens mini-card mint display after a successful burn clears the joined mini state', () => {
    const miniMintState = resolveSbtPageMiniMintState({
      burningStatus: 'success',
      mintingStatus: 'success',
      nowSec: 100,
      sbtInfo: { mintingEndTime: 0 },
      userHasSBT: false,
    });

    expect(miniMintState.hasTokenMini).toBe(false);
    expect(resolveSbtPageMiniMintActionPlan({
      hasTokenMini: miniMintState.hasTokenMini,
      isMintingActive: miniMintState.isMintingActive,
      miniMintable: true,
    })).toMatchObject({
      blockedReason: 'none',
      handlerKind: 'mini-mint',
      shouldRenderMintArea: true,
      viewKind: 'open-mint-button',
    });
  });

  it('resolves burn and mint button state', () => {
    expect(resolveSbtPageMiniBurnPermission({
      account: '0xAdmin',
      sbtInfo: { admin: '0xadmin', burnAuth: 0 },
    })).toEqual({
      canAdminBurn: false,
      canBurnMini: true,
      canOwnerBurn: true,
    });
    expect(resolveSbtPageBurnButtonState({
      account: '0xOwner',
      sbtInfo: { burnAuth: 1 },
      userHasSBT: true,
    })).toEqual({
      canOwnerBurn: true,
      shouldRenderBurnButton: true,
    });
    expect(resolveSbtPageBurnStatusButtonState({ burningStatus: 'pending' })).toMatchObject({
      disabled: true,
      isPending: true,
    });
    expect(resolveSbtPageAdminBurnButtonState({
      burningStatus: 'idle',
      burnSearchResult: null,
    })).toMatchObject({
      disabled: true,
      isIdle: true,
    });
    expect(resolveSbtPageOpenMintButtonState({
      lastMintTxHash: '0xmint',
      mintingStatus: 'success',
    })).toMatchObject({
      canOpenMintTx: true,
      disabled: false,
      isMinted: true,
    });
  });

  it('describes primary action availability without invoking SBT side effects', () => {
    expect(resolveSbtPageMintActionPlan({
      burningStatus: 'idle',
      nowSeconds: 100,
      sbtInfo: { mintingEndTime: 0 },
      userHasSBT: true,
    })).toEqual({
      blockedReason: 'already-has-token',
      shouldRenderMintButton: false,
    });
    expect(resolveSbtPageMintActionPlan({
      burningStatus: 'success',
      nowSeconds: 100,
      sbtInfo: { mintingEndTime: 0 },
      userHasSBT: true,
    })).toEqual({
      blockedReason: 'none',
      shouldRenderMintButton: true,
    });
    expect(resolveSbtPageMintActionPlan({
      nowSeconds: 100,
      sbtInfo: { mintingEndTime: 90 },
    })).toEqual({
      blockedReason: 'mint-ended',
      shouldRenderMintButton: false,
    });
    expect(resolveSbtPageMintActionPlan({
      nowSeconds: 100,
      sbtInfo: null,
    })).toEqual({
      blockedReason: 'missing-sbt',
      shouldRenderMintButton: false,
    });
    expect(resolveSbtPageBurnActionPlan({
      account: '0xOwner',
      sbtInfo: { burnAuth: 1 },
      userHasSBT: true,
    })).toEqual({
      blockedReason: 'none',
      canOwnerBurn: true,
      shouldRenderBurnButton: true,
    });
    expect(resolveSbtPageBurnActionPlan({
      account: '0xOwner',
      sbtInfo: { burnAuth: 0 },
      userHasSBT: true,
    })).toEqual({
      blockedReason: 'owner-burn-disabled',
      canOwnerBurn: false,
      shouldRenderBurnButton: false,
    });
    expect(resolveSbtPageBurnActionPlan({
      account: '0xOwner',
      sbtInfo: { burnAuth: 1 },
      userHasSBT: false,
    })).toEqual({
      blockedReason: 'missing-token',
      canOwnerBurn: false,
      shouldRenderBurnButton: false,
    });
  });

  it('resolves status content, action feedback, and control styles', () => {
    expect(resolveSbtPagePasswordJoinButtonState({
      groupPasswordInput: ' code ',
      mintingStatus: 'idle',
    })).toEqual({ disabled: false, isPending: false });
    expect(resolveSbtPagePendingButtonContentState({
      isPending: true,
      label: 'Join',
    })).toEqual({
      label: 'Join',
      shouldRenderLabel: false,
      shouldRenderPendingIcon: true,
    });
    expect(resolveSbtPageStatusButtonContentState({
      isFailure: true,
      failureLabel: 'Denied',
    })).toMatchObject({
      failureLabel: 'Denied',
      shouldRenderFailure: true,
    });
    expect(resolveSbtPagePasswordGenerationButtonState({ passwordGenerationCount: 0 })).toEqual({
      disabled: true,
    });
    expect(resolveSbtPagePasswordAlertState({
      mintPassword: 'plain',
      showPasswordAlert: true,
    })).toEqual({ showDetectedPasswordAlert: true });
    expect(resolveSbtPageActionFeedbackState({
      burningStatus: 'failure',
      error: 'Denied',
      transactionHash: '0xerr',
    })).toMatchObject({
      showErrorTransactionHash: true,
      showTransactionError: true,
    });
    expect(resolveSbtPageManualClaimButtonState({
      manualPasswordInput: '',
      mintingStatus: 'idle',
    })).toEqual({ disabled: true, isPending: false });
    expect(resolveSbtPageMiniOpenMintButtonState({ mintingStatus: 'failure' })).toMatchObject({
      isFailure: true,
      disabled: false,
    });
    expect(resolveSbtPageMiniActionStatusDisplayState({ isFailure: true })).toEqual({
      style: { marginTop: '10px', color: 'red' },
    });
    expect(buildSbtPageActionButtonClassName({
      actionClassName: 'action',
      includeMiniClass: true,
      miniClassName: 'mini',
      variantClassName: 'primary',
    })).toBe('action primary mini');
    expect(resolveSbtPageMiniControlDisplayState({ inputMaxWidth: ' 140px ' })).toEqual({
      inputStyle: { maxWidth: '140px' },
      topMarginStyle: { marginTop: '10px' },
    });
    expect(resolveSbtPageMiniBurnButtonState({ burningStatus: 'pending' })).toEqual({
      disabled: true,
      isPending: true,
    });
    expect(resolveSbtPageMiniTokenActionDisplayState({
      burningStatus: 'idle',
      canBurnMini: true,
    })).toEqual({
      shouldRenderBurnButton: true,
      shouldRenderBurnedStatus: false,
      shouldRenderJoinedStatus: false,
    });
    expect(shouldRenderSbtPageMintButton({
      nowSeconds: 100,
      sbtInfo: { mintingEndTime: 200 },
    })).toBe(true);
    expect(resolveSbtPageAdminActionState({
      account: '0xAdmin',
      hasInviteMint: true,
      sbtInfo: { admin: '0xadmin', burnAuth: 2, hasPasswordMint: true, maxTokens: '0' },
    })).toEqual({
      canAdminBurn: true,
      hasPasswordMint: true,
      isInvite: true,
      showNoMoreInvites: false,
      showPasswordGen: true,
    });
  });
});
