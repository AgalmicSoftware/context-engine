import {
  buildSbtPageActionButtonClassName,
  resolveSbtPageActionFeedbackState,
  resolveSbtPageAdminActionDisplayPlan,
  resolveSbtPageAdminActionState,
  resolveSbtPageAdminBurnButtonState,
  resolveSbtPageBurnActionPlan,
  resolveSbtPageBurnButtonState,
  resolveSbtPageBurnStatusButtonState,
  resolveSbtPageManualClaimActionRequest,
  resolveSbtPageManualClaimButtonState,
  resolveSbtPageMiniActionFailureState,
  resolveSbtPageMiniActionStatusDisplayState,
  resolveSbtPageMiniBurnButtonState,
  resolveSbtPageMiniBurnPermission,
  resolveSbtPageMiniCardDisplayState,
  resolveSbtPageMiniControlDisplayState,
  resolveSbtPageMiniManualClaimActionRequest,
  resolveSbtPageMiniMintActionPlan,
  resolveSbtPageMiniMintFlowDisplayState,
  resolveSbtPageMiniMintState,
  resolveSbtPageMiniOpenMintButtonState,
  resolveSbtPageMiniTokenActionDisplayState,
  resolveSbtPageMintEndDisplayState,
  resolveSbtPageMintActionPlan,
  resolveSbtPageMintButtonDisplayState,
  resolveSbtPageMintFlowDisplayState,
  resolveSbtPageFullActionDisplayPlan,
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
    expect(
      resolveSbtPageMintEndDisplayState({
        nowMs: Date.UTC(2026, 0, 1),
        sbtInfo: { mintingEndTime: Date.UTC(2026, 0, 2) / 1000 },
      }),
    ).toMatchObject({
      status: 'active',
      unixTS: Date.UTC(2026, 0, 2) / 1000,
    });
    expect(
      resolveSbtPageMintEndDisplayState({
        sbtInfo: { mintingEndTime: 0 },
      }),
    ).toEqual({
      fullMintEndDate: '',
      status: 'never',
      unixTS: 0,
    });
    expect(
      resolveSbtPageMiniMintState({
        burningStatus: 'idle',
        mintingStatus: 'success',
        nowSec: 100,
        sbtAddress: '0xABC',
        sbtInfo: { mintingEndTime: 0 },
      }),
    ).toEqual({
      hasTokenMini: true,
      isMintingActive: true,
      justJoined: true,
      mintStatusId: 'mintStatus-0xabc',
      shouldRenderEndedIndicator: false,
      shouldRenderLiveIndicator: true,
    });
    expect(
      resolveSbtPageMiniActionFailureState({
        hasTokenMini: false,
        mintingStatus: 'failure',
      }),
    ).toEqual({
      showBurnFailedStatus: false,
      showMintFailedStatus: true,
    });
  });

  it('resolves mini and full mint flow visibility', () => {
    expect(
      resolveSbtPageMiniMintFlowDisplayState({
        hasPasswordMint: true,
        isMintingActive: true,
        miniMintable: true,
        mintStep: 2,
      }),
    ).toMatchObject({
      shouldRenderManualPasswordFinishInput: true,
      shouldRenderOpenMintButton: false,
    });
    expect(
      resolveSbtPageMiniMintFlowDisplayState({
        hasInviteMint: true,
        isMintingActive: true,
        miniMintable: true,
        showMiniPasswordInput: false,
      }),
    ).toMatchObject({
      shouldRenderInviteDisclosureButton: true,
      shouldRenderInviteInput: false,
    });
    expect(
      resolveSbtPageMintFlowDisplayState({
        hasGroupPasswordMint: false,
        hasInviteMint: false,
        mintStep: 1,
        sbtInfo: { hasPasswordMint: true },
      }),
    ).toMatchObject({
      shouldRenderClaimCountdown: true,
      shouldRenderManualClaimStart: false,
      shouldRenderOpenMintButton: false,
    });
    expect(
      resolveSbtPageMintFlowDisplayState({
        hasGroupPasswordMint: true,
        mintingStatus: 'success',
      }),
    ).toMatchObject({
      shouldRenderGroupPasswordJoin: false,
      shouldSuppressMintControls: true,
    });
  });

  it('describes mini-card mint display and selected handler without invoking side effects', () => {
    expect(
      resolveSbtPageMiniMintActionPlan({
        isMintingActive: true,
        miniMintable: false,
      }),
    ).toEqual({
      blockedReason: 'mini-mint-unavailable',
      disabled: true,
      handlerKind: 'none',
      inertReason: 'hidden',
      isInteractive: false,
      labelKind: 'none',
      shouldRenderMintArea: false,
      viewKind: 'hidden',
    });
    expect(
      resolveSbtPageMiniMintActionPlan({
        hasTokenMini: true,
        isMintingActive: true,
        miniMintable: true,
      }),
    ).toMatchObject({
      blockedReason: 'already-has-token',
      shouldRenderMintArea: false,
      viewKind: 'hidden',
    });
    expect(
      resolveSbtPageMiniMintActionPlan({
        isMintingActive: false,
        miniMintable: true,
      }),
    ).toMatchObject({
      blockedReason: 'mint-ended',
      shouldRenderMintArea: false,
      viewKind: 'hidden',
    });
    expect(
      resolveSbtPageMiniMintActionPlan({
        isMintingActive: true,
        miniMintable: true,
      }),
    ).toMatchObject({
      blockedReason: 'none',
      disabled: false,
      handlerKind: 'mini-mint',
      inertReason: 'none',
      isInteractive: true,
      labelKind: 'status',
      shouldRenderMintArea: true,
      viewKind: 'open-mint-button',
    });
    expect(
      resolveSbtPageMiniMintActionPlan({
        isMintingActive: true,
        miniMintable: true,
        miniOpenMintButtonState: { disabled: true },
      }),
    ).toMatchObject({
      disabled: true,
      handlerKind: 'mini-mint',
      inertReason: 'disabled',
      isInteractive: false,
      viewKind: 'open-mint-button',
    });
    expect(
      resolveSbtPageMiniMintActionPlan({
        hasInviteMint: true,
        isMintingActive: true,
        miniMintable: true,
      }),
    ).toMatchObject({
      disabled: false,
      handlerKind: 'show-password-input',
      labelKind: 'join',
      viewKind: 'invite-disclosure',
    });
    expect(
      resolveSbtPageMiniMintActionPlan({
        hasInviteMint: true,
        isMintingActive: true,
        miniMintable: true,
        miniPasswordJoinButtonState: { disabled: true },
        showMiniPasswordInput: true,
      }),
    ).toMatchObject({
      disabled: true,
      handlerKind: 'claim-with-invite-code',
      inertReason: 'disabled',
      labelKind: 'join',
      viewKind: 'invite-input',
    });
    expect(
      resolveSbtPageMiniMintActionPlan({
        hasGroupPasswordMint: true,
        isMintingActive: true,
        miniMintable: true,
        showMiniPasswordInput: true,
      }),
    ).toMatchObject({
      handlerKind: 'mint-unlimited-with-group-password',
      labelKind: 'join',
      viewKind: 'group-password-input',
    });
    expect(
      resolveSbtPageMiniMintActionPlan({
        hasPasswordMint: true,
        isMintingActive: true,
        miniManualClaimButtonState: { disabled: true },
        miniMintable: true,
        showMiniPasswordInput: true,
      }),
    ).toMatchObject({
      disabled: true,
      handlerKind: 'mini-mint',
      inertReason: 'disabled',
      labelKind: 'join',
      viewKind: 'manual-password-start-input',
    });
    expect(
      resolveSbtPageMiniMintActionPlan({
        hasPasswordMint: true,
        isMintingActive: true,
        miniMintable: true,
        mintStep: 2,
      }),
    ).toMatchObject({
      handlerKind: 'mini-mint',
      labelKind: 'finish',
      viewKind: 'manual-password-finish-input',
    });
    expect(
      resolveSbtPageMiniMintActionPlan({
        hasPasswordMint: true,
        isMintingActive: true,
        miniMintable: true,
        mintStep: 1,
      }),
    ).toMatchObject({
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
    expect(
      resolveSbtPageMiniMintActionPlan({
        hasTokenMini: miniMintState.hasTokenMini,
        isMintingActive: miniMintState.isMintingActive,
        miniMintable: true,
      }),
    ).toMatchObject({
      blockedReason: 'none',
      handlerKind: 'mini-mint',
      shouldRenderMintArea: true,
      viewKind: 'open-mint-button',
    });
  });

  it('describes mini-card manual claim action identity without owning execution', () => {
    expect(
      resolveSbtPageMiniManualClaimActionRequest({
        manualPasswordInput: 'mini-code',
        miniMintActionPlan: {
          disabled: false,
          viewKind: 'manual-password-start-input',
        },
        mintingStatus: 'idle',
      }),
    ).toMatchObject({
      disabled: false,
      handlerKind: 'mini-mint',
      inputDisabled: false,
      inputType: 'text',
      inputValue: 'mini-code',
      placeholder: 'Password',
      shouldRenderInputAction: true,
      shouldRenderStatus: false,
      viewKind: 'manual-password-start-input',
      buttonState: {
        disabled: false,
        isPending: false,
      },
      contentState: {
        label: 'Join',
        shouldRenderLabel: true,
        shouldRenderPendingIcon: false,
      },
    });

    expect(
      resolveSbtPageMiniManualClaimActionRequest({
        manualPasswordInput: 'mini-code',
        miniMintActionPlan: {
          disabled: true,
          viewKind: 'manual-password-finish-input',
        },
        mintingStatus: 'pending',
      }),
    ).toMatchObject({
      disabled: true,
      handlerKind: 'mini-mint',
      inputDisabled: true,
      shouldRenderInputAction: true,
      viewKind: 'manual-password-finish-input',
      buttonState: {
        disabled: true,
        isPending: true,
      },
      contentState: {
        label: 'Finish',
        shouldRenderLabel: false,
        shouldRenderPendingIcon: true,
      },
    });
  });

  it('describes mini-card manual claim status-only requests', () => {
    expect(
      resolveSbtPageMiniManualClaimActionRequest({
        claimCountdown: 12,
        miniMintActionPlan: { viewKind: 'manual-claim-countdown' },
      }),
    ).toMatchObject({
      disabled: false,
      handlerKind: 'none',
      shouldRenderInputAction: false,
      shouldRenderStatus: true,
      statusText: 'Wait: 12s',
      viewKind: 'manual-claim-countdown',
    });

    expect(
      resolveSbtPageMiniManualClaimActionRequest({
        miniMintActionPlan: { viewKind: 'manual-claim-success' },
        successLabel: 'Collected',
      }),
    ).toMatchObject({
      disabled: false,
      handlerKind: 'none',
      shouldRenderInputAction: false,
      shouldRenderStatus: true,
      statusText: 'Collected!',
      viewKind: 'manual-claim-success',
    });
  });

  it('describes the mini-card display state without action callbacks', () => {
    const passwordJoin = resolveSbtPageMiniCardDisplayState({
      actionClassName: 'action',
      burnButtonClassName: 'burn',
      groupPasswordInput: 'group-code',
      hasGroupPasswordMint: true,
      miniButtonClassName: 'mini',
      miniMintable: true,
      mintButtonClassName: 'mint',
      mintingStatus: 'idle',
      sbtAddress: '0xABC',
      sbtInfo: { mintingEndTime: 0 },
    });

    expect(passwordJoin).toMatchObject({
      hasTokenMini: false,
      isMintingActive: true,
      miniBurnActionButtonClassName: 'action burn mini',
      miniMintActionButtonClassName: 'action mint mini',
      miniMintActionPlan: {
        handlerKind: 'show-password-input',
        viewKind: 'group-password-disclosure',
      },
      miniPasswordJoinButtonState: {
        disabled: false,
        isPending: false,
      },
      mintStatusId: 'mintStatus-0xabc',
    });
    expect(passwordJoin.miniManualClaimActionRequest).toMatchObject({
      handlerKind: 'none',
      shouldRenderInputAction: false,
      viewKind: 'hidden',
    });
    expect(passwordJoin.miniBurnButtonState).toBeNull();
    expect(passwordJoin.miniBurnContentState).toBeNull();
    expect(passwordJoin.miniTokenActionDisplayState).toBeNull();

    const manualClaim = resolveSbtPageMiniCardDisplayState({
      actionClassName: 'action',
      burnButtonClassName: 'burn',
      claimCountdown: 12,
      manualPasswordInput: 'mini-code',
      miniButtonClassName: 'mini',
      miniMintable: true,
      mintButtonClassName: 'mint',
      mintingStatus: 'pending',
      sbtAddress: '0xABC',
      sbtInfo: { hasPasswordMint: true, mintingEndTime: 0 },
      showMiniPasswordInput: true,
    });

    expect(manualClaim.miniMintActionPlan).toMatchObject({
      disabled: true,
      handlerKind: 'mini-mint',
      viewKind: 'manual-password-start-input',
    });
    expect(manualClaim.miniManualClaimActionRequest).toMatchObject({
      disabled: true,
      handlerKind: 'mini-mint',
      inputDisabled: true,
      inputValue: 'mini-code',
      shouldRenderInputAction: true,
      viewKind: 'manual-password-start-input',
    });

    const manualClaimSuccess = resolveSbtPageMiniCardDisplayState({
      manualPasswordInput: 'mini-code',
      mintedLabel: 'Collected',
      miniMintable: true,
      mintStep: 3,
      sbtAddress: '0xABC',
      sbtInfo: { hasPasswordMint: true, mintingEndTime: 0 },
      showMiniPasswordInput: true,
    });
    expect(manualClaimSuccess.miniManualClaimActionRequest).toMatchObject({
      handlerKind: 'none',
      shouldRenderStatus: true,
      statusText: 'Collected!',
      viewKind: 'manual-claim-success',
    });

    const tokenBurn = resolveSbtPageMiniCardDisplayState({
      account: '0xOwner',
      actionClassName: 'action',
      burnButtonClassName: 'burn',
      burnLabel: 'Burn',
      miniButtonClassName: 'mini',
      mintButtonClassName: 'mint',
      mintingStatus: 'success',
      sbtAddress: '0xABC',
      sbtInfo: {
        admin: '0xAdmin',
        burnAuth: 1,
        mintingEndTime: 0,
      },
      userHasSBT: true,
    });

    expect(tokenBurn).toMatchObject({
      hasTokenMini: true,
      miniBurnActionPlan: {
        blockedReason: 'none',
        shouldRenderMiniBurnButton: true,
      },
      miniBurnButtonState: {
        disabled: false,
        isPending: false,
      },
      miniBurnContentState: {
        label: 'Burn',
        shouldRenderLabel: true,
        shouldRenderPendingIcon: false,
      },
      miniMintActionPlan: {
        blockedReason: 'already-has-token',
        viewKind: 'hidden',
      },
      miniTokenActionDisplayState: {
        shouldRenderBurnButton: true,
      },
    });
  });

  it('resolves burn and mint button state', () => {
    expect(
      resolveSbtPageMiniBurnPermission({
        account: '0xAdmin',
        sbtInfo: { admin: '0xadmin', burnAuth: 0 },
      }),
    ).toEqual({
      canAdminBurn: false,
      canBurnMini: true,
      canOwnerBurn: true,
    });
    expect(
      resolveSbtPageMiniBurnPermission({
        account: '0xOwner',
        sbtInfo: { burnAuth: '2' },
        userIsSbtAdmin: true,
      }),
    ).toEqual({
      canAdminBurn: true,
      canBurnMini: true,
      canOwnerBurn: true,
    });
    expect(
      resolveSbtPageMiniBurnPermission({
        account: '0xOwner',
        sbtInfo: { burnAuth: 'not-a-number' },
        userIsSbtAdmin: true,
      }),
    ).toEqual({
      canAdminBurn: false,
      canBurnMini: false,
      canOwnerBurn: false,
    });
    expect(
      resolveSbtPageBurnButtonState({
        account: '0xOwner',
        sbtInfo: { burnAuth: '1' },
        userHasSBT: true,
      }),
    ).toEqual({
      canOwnerBurn: true,
      shouldRenderBurnButton: true,
    });
    expect(resolveSbtPageBurnStatusButtonState({ burningStatus: 'pending' })).toMatchObject({
      disabled: true,
      isPending: true,
    });
    expect(
      resolveSbtPageAdminBurnButtonState({
        burningStatus: 'idle',
        burnSearchResult: null,
      }),
    ).toMatchObject({
      disabled: true,
      isIdle: true,
    });
    expect(
      resolveSbtPageOpenMintButtonState({
        lastMintTxHash: '0xmint',
        mintingStatus: 'success',
      }),
    ).toMatchObject({
      canOpenMintTx: true,
      disabled: false,
      isMinted: true,
    });
  });

  it('describes primary action availability without invoking SBT side effects', () => {
    expect(
      resolveSbtPageMintActionPlan({
        burningStatus: 'idle',
        nowSeconds: 100,
        sbtInfo: { mintingEndTime: 0 },
        userHasSBT: true,
      }),
    ).toEqual({
      blockedReason: 'already-has-token',
      shouldRenderMintButton: false,
    });
    expect(
      resolveSbtPageMintActionPlan({
        burningStatus: 'success',
        nowSeconds: 100,
        sbtInfo: { mintingEndTime: 0 },
        userHasSBT: true,
      }),
    ).toEqual({
      blockedReason: 'none',
      shouldRenderMintButton: true,
    });
    expect(
      resolveSbtPageMintActionPlan({
        nowSeconds: 100,
        sbtInfo: { mintingEndTime: 90 },
      }),
    ).toEqual({
      blockedReason: 'mint-ended',
      shouldRenderMintButton: false,
    });
    expect(
      resolveSbtPageMintActionPlan({
        nowSeconds: 100,
        sbtInfo: { mintingEndTime: 100 },
      }),
    ).toEqual({
      blockedReason: 'mint-ended',
      shouldRenderMintButton: false,
    });
    expect(
      resolveSbtPageMintActionPlan({
        nowSeconds: 100,
        sbtInfo: null,
      }),
    ).toEqual({
      blockedReason: 'missing-sbt',
      shouldRenderMintButton: false,
    });
    expect(
      resolveSbtPageBurnActionPlan({
        account: '0xOwner',
        sbtInfo: { burnAuth: 1 },
        userHasSBT: true,
      }),
    ).toEqual({
      blockedReason: 'none',
      canOwnerBurn: true,
      shouldRenderBurnButton: true,
    });
    expect(
      resolveSbtPageBurnActionPlan({
        account: '0xOwner',
        sbtInfo: { burnAuth: 0 },
        userHasSBT: true,
      }),
    ).toEqual({
      blockedReason: 'owner-burn-disabled',
      canOwnerBurn: false,
      shouldRenderBurnButton: false,
    });
    expect(
      resolveSbtPageBurnActionPlan({
        account: '0xOwner',
        sbtInfo: { burnAuth: 1 },
        userHasSBT: false,
      }),
    ).toEqual({
      blockedReason: 'missing-token',
      canOwnerBurn: false,
      shouldRenderBurnButton: false,
    });
  });

  it('builds the full mint button display descriptor without dispatch ownership', () => {
    const hidden = resolveSbtPageMintButtonDisplayState({
      burningStatus: 'idle',
      nowSeconds: 100,
      sbtInfo: { mintingEndTime: 0 },
      userHasSBT: true,
    });
    expect(hidden.mintActionPlan).toEqual({
      blockedReason: 'already-has-token',
      shouldRenderMintButton: false,
    });
    expect(hidden.openMintButtonState.readinessDescriptor).toMatchObject({
      canOpenMintTx: false,
      hasMintTransactionHash: false,
    });

    const openMint = resolveSbtPageMintButtonDisplayState({
      burningStatus: 'idle',
      lastMintTxHash: '0xmint',
      mintLowerLabel: 'claim',
      mintedLabel: 'Claimed',
      mintingStatus: 'success',
      nowSeconds: 100,
      sbtInfo: { mintingEndTime: 0 },
    });
    expect(openMint.mintActionPlan).toEqual({
      blockedReason: 'none',
      shouldRenderMintButton: true,
    });
    expect(openMint.mintFlowDisplayState.shouldRenderOpenMintButton).toBe(true);
    expect(openMint.openMintButtonState).toMatchObject({
      canOpenMintTx: true,
      disabled: false,
      title: 'View claim transaction',
    });
    expect(openMint.openMintButtonContentState).toMatchObject({
      shouldRenderSuccess: true,
      successLabel: 'Claimed',
    });
  });

  it('builds the full action display plan without execution callbacks', () => {
    const plan = resolveSbtPageFullActionDisplayPlan({
      account: '0xOwner',
      actionClassName: 'action',
      burnedLabel: 'Removed',
      burningStatus: 'idle',
      burnButtonClassName: 'burn',
      burnLabel: 'Remove',
      groupPasswordInput: 'group-code',
      hasGroupPasswordMint: true,
      mintButtonClassName: 'mint',
      mintingStatus: 'idle',
      nowSeconds: 100,
      sbtInfo: {
        burnAuth: 1,
        mintingEndTime: 0,
      },
      userHasSBT: true,
    });

    expect(plan).toMatchObject({
      burnActionButtonClassName: 'action burn',
      burnActionPlan: {
        blockedReason: 'none',
        shouldRenderBurnButton: true,
      },
      burnButtonContentState: {
        idleLabel: 'Remove',
        shouldRenderIdleLabel: true,
        successLabel: 'Removed',
      },
      mintActionButtonClassName: 'action mint',
      mintButtonDisplayState: {
        mintActionPlan: {
          blockedReason: 'already-has-token',
          shouldRenderMintButton: false,
        },
        passwordJoinButtonState: {
          disabled: false,
          isPending: false,
        },
      },
      shouldRenderBurnSurface: true,
      shouldRenderMintSurface: false,
    });

    expect(
      resolveSbtPageFullActionDisplayPlan({
        nowSeconds: 100,
        sbtInfo: null,
      }),
    ).toMatchObject({
      burnActionPlan: {
        blockedReason: 'missing-sbt',
        shouldRenderBurnButton: false,
      },
      mintButtonDisplayState: {
        mintActionPlan: {
          blockedReason: 'missing-sbt',
          shouldRenderMintButton: false,
        },
      },
      shouldRenderBurnSurface: false,
      shouldRenderMintSurface: false,
    });
  });

  it('resolves status content, action feedback, and control styles', () => {
    expect(
      resolveSbtPagePasswordJoinButtonState({
        groupPasswordInput: ' code ',
        mintingStatus: 'idle',
      }),
    ).toEqual({ disabled: false, isPending: false });
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
        isFailure: true,
        failureLabel: 'Denied',
      }),
    ).toMatchObject({
      failureLabel: 'Denied',
      shouldRenderFailure: true,
    });
    expect(resolveSbtPagePasswordGenerationButtonState({ passwordGenerationCount: 0 })).toEqual({
      disabled: true,
    });
    expect(
      resolveSbtPagePasswordAlertState({
        mintPassword: 'plain',
        showPasswordAlert: true,
      }),
    ).toEqual({ showDetectedPasswordAlert: true });
    expect(
      resolveSbtPageActionFeedbackState({
        burningStatus: 'failure',
        error: 'Denied',
        transactionHash: '0xerr',
      }),
    ).toMatchObject({
      showErrorTransactionHash: true,
      showTransactionError: true,
    });
    expect(
      resolveSbtPageManualClaimButtonState({
        manualPasswordInput: '',
        mintingStatus: 'idle',
      }),
    ).toEqual({ disabled: true, isPending: false });
    expect(resolveSbtPageMiniOpenMintButtonState({ mintingStatus: 'failure' })).toMatchObject({
      isFailure: true,
      disabled: false,
    });
    expect(resolveSbtPageMiniActionStatusDisplayState({ isFailure: true })).toEqual({
      style: { marginTop: '10px', color: 'red' },
    });
    expect(
      buildSbtPageActionButtonClassName({
        actionClassName: 'action',
        includeMiniClass: true,
        miniClassName: 'mini',
        variantClassName: 'primary',
      }),
    ).toBe('action primary mini');
    expect(resolveSbtPageMiniControlDisplayState({ inputMaxWidth: ' 140px ' })).toEqual({
      inputStyle: { maxWidth: '140px' },
      topMarginStyle: { marginTop: '10px' },
    });
    expect(resolveSbtPageMiniBurnButtonState({ burningStatus: 'pending' })).toEqual({
      disabled: true,
      isPending: true,
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
      shouldRenderSbtPageMintButton({
        nowSeconds: 100,
        sbtInfo: { mintingEndTime: 200 },
      }),
    ).toBe(true);
    expect(
      resolveSbtPageAdminActionState({
        account: '0xAdmin',
        hasInviteMint: true,
        sbtInfo: { admin: '0xadmin', burnAuth: '2', hasPasswordMint: true, maxTokens: '0' },
      }),
    ).toEqual({
      canAdminBurn: true,
      hasPasswordMint: true,
      isInvite: true,
      showNoMoreInvites: false,
      showPasswordGen: true,
    });
  });

  it('keeps action feedback display passive across success, missing hash, and error states', () => {
    expect(
      resolveSbtPageActionFeedbackState({
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
        lastBurnTxHash: '0xburn',
        lastMintTxHash: '0xmint',
        burningStatus: 'success',
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
        lastMintTxHash: '',
        mintingStatus: 'success',
      }),
    ).toMatchObject({
      showMintSuccess: false,
    });
    expect(
      resolveSbtPageActionFeedbackState({
        error: new Error('Denied'),
        mintingStatus: 'idle',
        transactionHash: '0xerr',
      }),
    ).toMatchObject({
      showErrorTransactionHash: false,
      showTransactionError: false,
    });
    expect(
      resolveSbtPageActionFeedbackState({
        error: new Error('Denied'),
        mintingStatus: 'failure',
        transactionHash: '0xerr',
      }),
    ).toMatchObject({
      showErrorTransactionHash: true,
      showTransactionError: true,
    });
  });

  it('builds the admin action display plan without admin execution callbacks', () => {
    const plan = resolveSbtPageAdminActionDisplayPlan({
      account: '0xAdmin',
      adminGeneratedPasswords: ['new-code'],
      burnedLabel: 'Removed',
      burningStatus: 'pending',
      burnLabel: 'Remove',
      burnSearchResult: { tokenId: '7' },
      cachedPasswords: ['old-code'],
      hasInviteMint: true,
      includePreviousPasswords: true,
      passwordGenerationCount: 0,
      sbtInfo: {
        admin: '0xadmin',
        burnAuth: 2,
        hasPasswordMint: true,
        maxTokens: '0',
      },
      sbtLabel: 'Badge',
    });

    expect(plan).toMatchObject({
      adminBurnButtonContentState: {
        idleLabel: 'Remove Badge',
        shouldRenderPendingIcon: true,
        successLabel: 'Removed',
      },
      adminBurnStatusButtonState: {
        disabled: true,
        isPending: true,
      },
      canAdminBurn: true,
      combinedPasswords: ['old-code', 'new-code'],
      effectiveIncludePreviousPasswords: true,
      hasPasswordMint: true,
      isInvite: true,
      passwordExportControlsState: {
        effectiveIncludePreviousPasswordsChecked: true,
        renderIncludePreviousCheckbox: true,
        showCachedPasswordsIncludedNote: false,
      },
      passwordGenerationButtonState: {
        disabled: true,
      },
      passwordInventoryDisplayState: {
        shouldRenderGeneratedPasswordList: true,
        shouldRenderPasswordGenerationSection: true,
      },
      passwordsToExport: ['old-code', 'new-code'],
      showPasswordGen: true,
    });

    expect(
      resolveSbtPageAdminActionDisplayPlan({
        cachedPasswords: ['cached-code'],
        includePreviousPasswords: false,
        sbtInfo: {
          hasPasswordMint: true,
          maxTokens: '2',
        },
      }),
    ).toMatchObject({
      canAdminBurn: false,
      combinedPasswords: ['cached-code'],
      passwordExportControlsState: {
        effectiveIncludePreviousPasswordsChecked: true,
        renderIncludePreviousCheckbox: false,
        showCachedPasswordsIncludedNote: true,
      },
      passwordInventoryDisplayState: {
        shouldRenderPreviousPasswordsSection: true,
      },
      showNoMoreInvites: true,
    });
  });

  it('keeps open-mint transaction actions disabled or hidden when status is not viewable', () => {
    expect(
      resolveSbtPageOpenMintButtonState({
        lastMintTxHash: '0xmint',
        mintingStatus: 'pending',
      }),
    ).toMatchObject({
      canOpenMintTx: false,
      disabled: true,
      isPending: true,
      readinessDescriptor: {
        canOpenMintTx: false,
        hasMintTransactionHash: true,
        isBurnCleared: false,
        isMinted: false,
        isPending: true,
      },
    });

    expect(
      resolveSbtPageOpenMintButtonState({
        lastMintTxHash: '',
        mintingStatus: 'success',
      }),
    ).toMatchObject({
      canOpenMintTx: false,
      disabled: true,
      isMinted: true,
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
        lastMintTxHash: '0xmint',
        mintingStatus: 'success',
      }),
    ).toMatchObject({
      canOpenMintTx: false,
      disabled: false,
      isMinted: false,
      readinessDescriptor: {
        canOpenMintTx: false,
        hasMintTransactionHash: true,
        isBurnCleared: true,
        isMinted: false,
        isPending: false,
      },
      title: undefined,
    });
  });

  it('describes manual claim action identity without owning mint execution', () => {
    expect(
      resolveSbtPageManualClaimActionRequest({
        manualPasswordInput: 'claim-code',
        mintFlowDisplayState: { shouldRenderManualClaimStart: true },
        mintingStatus: 'idle',
      }),
    ).toMatchObject({
      disabled: false,
      handlerKind: 'handle-mint-force-refresh',
      inputType: 'text',
      inputValue: 'claim-code',
      mintArgs: [true],
      placeholder: 'Claim Code',
      shouldRenderInputAction: true,
      shouldRenderStatus: false,
      viewKind: 'manual-password-start-input',
      buttonState: {
        disabled: false,
        isPending: false,
      },
      contentState: {
        label: 'Start Claim',
        shouldRenderLabel: true,
        shouldRenderPendingIcon: false,
      },
    });

    expect(
      resolveSbtPageManualClaimActionRequest({
        manualPasswordInput: 'claim-code',
        mintFlowDisplayState: { shouldRenderManualClaimFinish: true },
        mintingStatus: 'pending',
      }),
    ).toMatchObject({
      disabled: true,
      handlerKind: 'handle-mint-force-refresh',
      shouldRenderInputAction: true,
      viewKind: 'manual-password-finish-input',
      buttonState: {
        disabled: true,
        isPending: true,
      },
      contentState: {
        label: 'Finish Claim',
        shouldRenderLabel: false,
        shouldRenderPendingIcon: true,
      },
    });
  });

  it('describes manual claim countdown and success as status-only requests', () => {
    expect(
      resolveSbtPageManualClaimActionRequest({
        claimCountdown: 12,
        mintFlowDisplayState: { shouldRenderClaimCountdown: true },
      }),
    ).toMatchObject({
      disabled: false,
      handlerKind: 'none',
      shouldRenderInputAction: false,
      shouldRenderStatus: true,
      statusText: 'Waiting period: 12 seconds',
      viewKind: 'manual-claim-countdown',
    });

    expect(
      resolveSbtPageManualClaimActionRequest({
        mintFlowDisplayState: { shouldRenderClaimSuccess: true },
        successLabel: 'SBT successfully minted!',
      }),
    ).toMatchObject({
      disabled: false,
      handlerKind: 'none',
      shouldRenderInputAction: false,
      shouldRenderStatus: true,
      statusText: 'SBT successfully minted!',
      viewKind: 'manual-claim-success',
    });
  });
});
