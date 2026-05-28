type ResolveSbtPageMintEndDisplayStateArgs = {
  nowMs?: unknown;
  sbtInfo?: unknown;
};
type ResolveSbtPageMiniMintStateArgs = {
  burningStatus?: unknown;
  mintingStatus?: unknown;
  nowSec?: unknown;
  sbtAddress?: unknown;
  sbtInfo?: unknown;
  userHasSBT?: unknown;
};
type ResolveSbtPageMiniActionFailureStateArgs = {
  burningStatus?: unknown;
  hasTokenMini?: unknown;
  mintingStatus?: unknown;
};
export type SbtPageMintEndDisplayState = {
  fullMintEndDate: string;
  status: 'active' | 'expired' | 'never';
  unixTS: number | string;
};
type SbtPageMiniMintState = {
  hasTokenMini: boolean;
  isMintingActive: boolean;
  justJoined: boolean;
  mintStatusId: string;
  shouldRenderEndedIndicator: boolean;
  shouldRenderLiveIndicator: boolean;
};
type SbtPageMiniActionFailureState = {
  showBurnFailedStatus: boolean;
  showMintFailedStatus: boolean;
};
type ResolveSbtPageMiniBurnPermissionArgs = {
  account?: unknown;
  sbtInfo?: unknown;
  userIsSbtAdmin?: unknown;
};
type ResolveSbtPageBurnButtonStateArgs = {
  account?: unknown;
  sbtInfo?: unknown;
  userHasSBT?: unknown;
};
type SbtPageBurnButtonState = {
  canOwnerBurn: boolean;
  shouldRenderBurnButton: boolean;
};
type SbtPageBurnActionBlockedReason =
  | 'none'
  | 'missing-sbt'
  | 'missing-token'
  | 'owner-burn-disabled';
type SbtPageBurnActionPlan = SbtPageBurnButtonState & {
  blockedReason: SbtPageBurnActionBlockedReason;
};
type ResolveSbtPageBurnStatusButtonStateArgs = {
  burningStatus?: unknown;
};
type SbtPageBurnStatusButtonState = {
  disabled: boolean;
  isFailure: boolean;
  isIdle: boolean;
  isPending: boolean;
  isSuccess: boolean;
};
type ResolveSbtPageAdminBurnButtonStateArgs = ResolveSbtPageBurnStatusButtonStateArgs & {
  burnSearchResult?: unknown;
};
type ResolveSbtPageOpenMintButtonStateArgs = {
  burningStatus?: unknown;
  lastMintTxHash?: unknown;
  mintLowerLabel?: unknown;
  mintingStatus?: unknown;
};
type SbtPageOpenMintButtonState = {
  canOpenMintTx: boolean;
  disabled: boolean;
  isFailure: boolean;
  isIdle: boolean;
  isMinted: boolean;
  isPending: boolean;
  title?: string;
};
type ResolveSbtPagePasswordJoinButtonStateArgs = {
  groupPasswordInput?: unknown;
  mintingStatus?: unknown;
};
type SbtPagePasswordJoinButtonState = {
  disabled: boolean;
  isPending: boolean;
};
type ResolveSbtPagePendingButtonContentStateArgs = {
  isPending?: unknown;
  label?: unknown;
};
type SbtPagePendingButtonContentState = {
  label: string;
  shouldRenderLabel: boolean;
  shouldRenderPendingIcon: boolean;
};
type ResolveSbtPageStatusButtonContentStateArgs = {
  failureLabel?: unknown;
  idleLabel?: unknown;
  isFailure?: unknown;
  isIdle?: unknown;
  isPending?: unknown;
  isSuccess?: unknown;
  successLabel?: unknown;
};
type SbtPageStatusButtonContentState = {
  failureLabel: string;
  idleLabel: string;
  shouldRenderFailure: boolean;
  shouldRenderIdleLabel: boolean;
  shouldRenderPendingIcon: boolean;
  shouldRenderSuccess: boolean;
  successLabel: string;
};
type ResolveSbtPagePasswordGenerationButtonStateArgs = {
  passwordGenerationCount?: unknown;
};
type SbtPagePasswordGenerationButtonState = {
  disabled: boolean;
};
type ResolveSbtPagePasswordAlertStateArgs = {
  mintPassword?: unknown;
  sbtMintPassword?: unknown;
  showPasswordAlert?: unknown;
};
type SbtPagePasswordAlertState = {
  showDetectedPasswordAlert: boolean;
};
type ResolveSbtPageActionFeedbackStateArgs = {
  burningStatus?: unknown;
  error?: unknown;
  lastBurnTxHash?: unknown;
  lastMintTxHash?: unknown;
  mintingStatus?: unknown;
  transactionHash?: unknown;
};
type SbtPageActionFeedbackState = {
  showBurnSuccess: boolean;
  showErrorTransactionHash: boolean;
  showMintSuccess: boolean;
  showTransactionError: boolean;
};
type ResolveSbtPageManualClaimButtonStateArgs = {
  manualPasswordInput?: unknown;
  mintingStatus?: unknown;
};
type SbtPageManualClaimButtonState = {
  disabled: boolean;
  isPending: boolean;
};
type ResolveSbtPageMiniOpenMintButtonStateArgs = {
  mintingStatus?: unknown;
};
type ResolveSbtPageMiniActionStatusDisplayStateArgs = {
  isFailure?: unknown;
};
type BuildSbtPageActionButtonClassNameArgs = {
  actionClassName?: unknown;
  includeMiniClass?: unknown;
  miniClassName?: unknown;
  variantClassName?: unknown;
};
type SbtPageMiniActionStatusDisplayState = {
  style: Record<string, string>;
};
type ResolveSbtPageMiniControlDisplayStateArgs = {
  inputMaxWidth?: unknown;
};
type SbtPageMiniControlDisplayState = {
  inputStyle: Record<string, string>;
  topMarginStyle: Record<string, string>;
};
type SbtPageMiniOpenMintButtonState = {
  disabled: boolean;
  isFailure: boolean;
  isIdle: boolean;
  isPending: boolean;
  isSuccess: boolean;
};
type ResolveSbtPageMiniMintFlowDisplayStateArgs = {
  hasGroupPasswordMint?: unknown;
  hasInviteMint?: unknown;
  hasPasswordMint?: unknown;
  hasTokenMini?: unknown;
  isMintingActive?: unknown;
  miniMintable?: unknown;
  mintStep?: unknown;
  showMiniPasswordInput?: unknown;
};
type SbtPageMiniMintFlowDisplayState = {
  shouldRenderGroupPasswordDisclosureButton: boolean;
  shouldRenderGroupPasswordInput: boolean;
  shouldRenderInviteDisclosureButton: boolean;
  shouldRenderInviteInput: boolean;
  shouldRenderManualClaimCountdown: boolean;
  shouldRenderManualClaimSuccess: boolean;
  shouldRenderManualPasswordDisclosureButton: boolean;
  shouldRenderManualPasswordFinishInput: boolean;
  shouldRenderManualPasswordStartInput: boolean;
  shouldRenderOpenMintButton: boolean;
};
type ResolveSbtPageMiniBurnButtonStateArgs = {
  burningStatus?: unknown;
};
type SbtPageMiniBurnButtonState = {
  disabled: boolean;
  isPending: boolean;
};
type ResolveSbtPageMiniTokenActionDisplayStateArgs = {
  burningStatus?: unknown;
  canBurnMini?: unknown;
};
type SbtPageMiniTokenActionDisplayState = {
  shouldRenderBurnButton: boolean;
  shouldRenderBurnedStatus: boolean;
  shouldRenderJoinedStatus: boolean;
};
type ResolveSbtPageAdminActionStateArgs = {
  account?: unknown;
  hasInviteMint?: unknown;
  sbtInfo?: unknown;
};
type ResolveSbtPageMintFlowDisplayStateArgs = {
  hasGroupPasswordMint?: unknown;
  hasInviteMint?: unknown;
  mintingStatus?: unknown;
  mintStep?: unknown;
  sbtInfo?: unknown;
};
type SbtPageAdminActionState = {
  canAdminBurn: boolean;
  hasPasswordMint: boolean;
  isInvite: boolean;
  showNoMoreInvites: boolean;
  showPasswordGen: boolean;
};
type SbtPageMintFlowDisplayState = {
  shouldRenderClaimCountdown: boolean;
  shouldRenderClaimSuccess: boolean;
  shouldRenderGroupPasswordJoin: boolean;
  shouldRenderInviteJoin: boolean;
  shouldRenderManualClaimFinish: boolean;
  shouldRenderManualClaimStart: boolean;
  shouldRenderOpenMintButton: boolean;
  shouldSuppressMintControls: boolean;
};
type ShouldRenderSbtPageMintButtonArgs = {
  burningStatus?: unknown;
  nowSeconds?: unknown;
  sbtInfo?: unknown;
  userHasSBT?: unknown;
};
type SbtPageMintActionBlockedReason =
  | 'none'
  | 'already-has-token'
  | 'mint-ended'
  | 'missing-sbt';
type SbtPageMintActionPlan = {
  blockedReason: SbtPageMintActionBlockedReason;
  shouldRenderMintButton: boolean;
};
type SbtPageMiniBurnPermission = {
  canAdminBurn: boolean;
  canBurnMini: boolean;
  canOwnerBurn: boolean;
};

const isSbtPageActionRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

export const resolveSbtPageMintEndDisplayState = ({
  nowMs = Date.now(),
  sbtInfo = null,
}: ResolveSbtPageMintEndDisplayStateArgs = {}): SbtPageMintEndDisplayState | null => {
  const info = isSbtPageActionRecord(sbtInfo) ? sbtInfo : null;
  if (!info) return null;
  const unixTS = info.mintingEndTime as number | string;
  if (unixTS) {
    const endTime = Number(unixTS) * 1000;
    return {
      fullMintEndDate: new Date(endTime).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
      status: endTime > Number(nowMs) ? 'active' : 'expired',
      unixTS,
    };
  }
  if (unixTS === 0) {
    return {
      fullMintEndDate: '',
      status: 'never',
      unixTS,
    };
  }
  return null;
};

export const resolveSbtPageMiniMintState = ({
  burningStatus = '',
  mintingStatus = '',
  nowSec = Math.floor(Date.now() / 1000),
  sbtAddress = '',
  sbtInfo = null,
  userHasSBT = false,
}: ResolveSbtPageMiniMintStateArgs = {}): SbtPageMiniMintState => {
  const info = isSbtPageActionRecord(sbtInfo) ? sbtInfo : {};
  const mintingEndTime = info.mintingEndTime;
  const mintingEndTimeNumber = Number(mintingEndTime);
  const isMintingActive = mintingEndTime === 0 || mintingEndTimeNumber > Number(nowSec);
  const justJoined = mintingStatus === 'success' && burningStatus !== 'success';
  return {
    hasTokenMini: !!userHasSBT || justJoined,
    isMintingActive,
    justJoined,
    mintStatusId: `mintStatus-${String(sbtAddress || '').toLowerCase()}`,
    shouldRenderEndedIndicator: !isMintingActive,
    shouldRenderLiveIndicator: isMintingActive,
  };
};

export const resolveSbtPageMiniActionFailureState = ({
  burningStatus = '',
  hasTokenMini = false,
  mintingStatus = '',
}: ResolveSbtPageMiniActionFailureStateArgs = {}): SbtPageMiniActionFailureState => ({
  showBurnFailedStatus: burningStatus === 'failure' && !!hasTokenMini,
  showMintFailedStatus: mintingStatus === 'failure' && !hasTokenMini,
});

export const resolveSbtPageMiniMintFlowDisplayState = ({
  hasGroupPasswordMint = false,
  hasInviteMint = false,
  hasPasswordMint = false,
  hasTokenMini = false,
  isMintingActive = false,
  miniMintable = false,
  mintStep = 0,
  showMiniPasswordInput = false,
}: ResolveSbtPageMiniMintFlowDisplayStateArgs = {}): SbtPageMiniMintFlowDisplayState => {
  const canRenderMintFlow = !hasTokenMini && !!isMintingActive && !!miniMintable;
  const isGroupPasswordFlow = canRenderMintFlow && !!hasGroupPasswordMint;
  const isInviteFlow = canRenderMintFlow && !isGroupPasswordFlow && !!hasInviteMint;
  const isManualPasswordFlow = canRenderMintFlow && !isGroupPasswordFlow && !isInviteFlow && !!hasPasswordMint;
  const step = mintStep as number;
  const inputVisible = !!showMiniPasswordInput;
  return {
    shouldRenderGroupPasswordDisclosureButton: isGroupPasswordFlow && !inputVisible,
    shouldRenderGroupPasswordInput: isGroupPasswordFlow && inputVisible,
    shouldRenderInviteDisclosureButton: isInviteFlow && !inputVisible,
    shouldRenderInviteInput: isInviteFlow && inputVisible,
    shouldRenderManualClaimCountdown: isManualPasswordFlow && step === 1,
    shouldRenderManualClaimSuccess: isManualPasswordFlow && step >= 3,
    shouldRenderManualPasswordDisclosureButton: isManualPasswordFlow && step === 0 && !inputVisible,
    shouldRenderManualPasswordFinishInput: isManualPasswordFlow && step === 2,
    shouldRenderManualPasswordStartInput: isManualPasswordFlow && step === 0 && inputVisible,
    shouldRenderOpenMintButton: canRenderMintFlow && !isGroupPasswordFlow && !isInviteFlow && !isManualPasswordFlow,
  };
};

export const resolveSbtPageMiniBurnPermission = ({
  account = '',
  sbtInfo = null,
  userIsSbtAdmin = false,
}: ResolveSbtPageMiniBurnPermissionArgs = {}): SbtPageMiniBurnPermission => {
  const info = isSbtPageActionRecord(sbtInfo) ? sbtInfo : {};
  const userAddressLower = account ? String(account).toLowerCase() : null;
  const adminAddr = info.admin || info.admin_;
  const adminAddrLower = adminAddr ? String(adminAddr).toLowerCase() : '';
  const burnAuth = info.burnAuth;
  const canOwnerBurn = (
    burnAuth === 1 ||
    burnAuth === 2 ||
    (burnAuth === 0 && !!adminAddr && adminAddrLower === userAddressLower)
  );
  const canAdminBurn = !!userIsSbtAdmin && (burnAuth === 0 || burnAuth === 2);
  return {
    canAdminBurn,
    canBurnMini: canOwnerBurn || canAdminBurn,
    canOwnerBurn,
  };
};

export const resolveSbtPageBurnButtonState = ({
  account = '',
  sbtInfo = null,
  userHasSBT = false,
}: ResolveSbtPageBurnButtonStateArgs = {}): SbtPageBurnButtonState => {
  const info = isSbtPageActionRecord(sbtInfo) ? sbtInfo : {};
  const userAddressLower = account ? String(account).toLowerCase() : null;
  const adminAddr = String(info.admin || info.admin_ || '');
  const canOwnerBurn = !!userHasSBT && (
    info.burnAuth === 1 ||
    info.burnAuth === 2 ||
    (info.burnAuth === 0 && !!adminAddr && adminAddr.toLowerCase() === userAddressLower) ||
    (info.burnAuth === 1 && !!userHasSBT)
  );
  return {
    canOwnerBurn,
    shouldRenderBurnButton: !!userHasSBT && canOwnerBurn,
  };
};

export const resolveSbtPageBurnActionPlan = ({
  account = '',
  sbtInfo = null,
  userHasSBT = false,
}: ResolveSbtPageBurnButtonStateArgs = {}): SbtPageBurnActionPlan => {
  if (!sbtInfo) {
    return {
      blockedReason: 'missing-sbt',
      canOwnerBurn: false,
      shouldRenderBurnButton: false,
    };
  }
  const burnButtonState = resolveSbtPageBurnButtonState({
    account,
    sbtInfo,
    userHasSBT,
  });
  if (burnButtonState.shouldRenderBurnButton) {
    return {
      ...burnButtonState,
      blockedReason: 'none',
    };
  }
  return {
    ...burnButtonState,
    blockedReason: userHasSBT ? 'owner-burn-disabled' : 'missing-token',
  };
};

export const resolveSbtPageBurnStatusButtonState = ({
  burningStatus = '',
}: ResolveSbtPageBurnStatusButtonStateArgs = {}): SbtPageBurnStatusButtonState => ({
  disabled: burningStatus !== 'idle' && burningStatus !== 'success' && burningStatus !== 'failure',
  isFailure: burningStatus === 'failure',
  isIdle: burningStatus === 'idle',
  isPending: burningStatus === 'pending',
  isSuccess: burningStatus === 'success',
});

export const resolveSbtPageAdminBurnButtonState = ({
  burningStatus = '',
  burnSearchResult = null,
}: ResolveSbtPageAdminBurnButtonStateArgs = {}): SbtPageBurnStatusButtonState => {
  const statusButtonState = resolveSbtPageBurnStatusButtonState({ burningStatus });
  return {
    ...statusButtonState,
    disabled: statusButtonState.disabled || !burnSearchResult,
  };
};

export const resolveSbtPageOpenMintButtonState = ({
  burningStatus = '',
  lastMintTxHash = '',
  mintLowerLabel = 'mint',
  mintingStatus = '',
}: ResolveSbtPageOpenMintButtonStateArgs = {}): SbtPageOpenMintButtonState => {
  const isMinted = mintingStatus === 'success' && burningStatus !== 'success';
  const canOpenMintTx = !!(isMinted && lastMintTxHash);
  const isPending = mintingStatus === 'pending';
  return {
    canOpenMintTx,
    disabled: isPending || (isMinted && !canOpenMintTx),
    isFailure: mintingStatus === 'failure',
    isIdle: mintingStatus === 'idle',
    isMinted,
    isPending,
    title: canOpenMintTx ? `View ${String(mintLowerLabel || 'mint')} transaction` : undefined,
  };
};

export const resolveSbtPagePasswordJoinButtonState = ({
  groupPasswordInput = '',
  mintingStatus = '',
}: ResolveSbtPagePasswordJoinButtonStateArgs = {}): SbtPagePasswordJoinButtonState => {
  const isPending = mintingStatus === 'pending';
  return {
    disabled: isPending || String(groupPasswordInput || '').trim() === '',
    isPending,
  };
};

export const resolveSbtPagePendingButtonContentState = ({
  isPending = false,
  label = '',
}: ResolveSbtPagePendingButtonContentStateArgs = {}): SbtPagePendingButtonContentState => {
  const pending = !!isPending;
  return {
    label: String(label || ''),
    shouldRenderLabel: !pending,
    shouldRenderPendingIcon: pending,
  };
};

export const resolveSbtPageStatusButtonContentState = ({
  failureLabel = 'Failed',
  idleLabel = '',
  isFailure = false,
  isIdle = false,
  isPending = false,
  isSuccess = false,
  successLabel = '',
}: ResolveSbtPageStatusButtonContentStateArgs = {}): SbtPageStatusButtonContentState => ({
  failureLabel: String(failureLabel || ''),
  idleLabel: String(idleLabel || ''),
  shouldRenderFailure: !!isFailure,
  shouldRenderIdleLabel: !!isIdle,
  shouldRenderPendingIcon: !!isPending,
  shouldRenderSuccess: !!isSuccess,
  successLabel: String(successLabel || ''),
});

export const resolveSbtPagePasswordGenerationButtonState = ({
  passwordGenerationCount = null,
}: ResolveSbtPagePasswordGenerationButtonStateArgs = {}): SbtPagePasswordGenerationButtonState => ({
  disabled: !passwordGenerationCount || (passwordGenerationCount as number) <= 0,
});

export const resolveSbtPagePasswordAlertState = ({
  mintPassword = '',
  sbtMintPassword = '',
  showPasswordAlert = false,
}: ResolveSbtPagePasswordAlertStateArgs = {}): SbtPagePasswordAlertState => ({
  showDetectedPasswordAlert: !!(showPasswordAlert && (mintPassword || sbtMintPassword)),
});

export const resolveSbtPageActionFeedbackState = ({
  burningStatus = '',
  error = null,
  lastBurnTxHash = '',
  lastMintTxHash = '',
  mintingStatus = '',
  transactionHash = '',
}: ResolveSbtPageActionFeedbackStateArgs = {}): SbtPageActionFeedbackState => {
  const showTransactionError = !!error && (mintingStatus === 'failure' || burningStatus === 'failure');
  return {
    showBurnSuccess: burningStatus === 'success' && !!lastBurnTxHash,
    showErrorTransactionHash: showTransactionError && !!transactionHash,
    showMintSuccess: mintingStatus === 'success' && !!lastMintTxHash && burningStatus !== 'success',
    showTransactionError,
  };
};

export const resolveSbtPageManualClaimButtonState = ({
  manualPasswordInput = '',
  mintingStatus = '',
}: ResolveSbtPageManualClaimButtonStateArgs = {}): SbtPageManualClaimButtonState => {
  const isPending = mintingStatus === 'pending';
  return {
    disabled: isPending || String(manualPasswordInput || '').trim() === '',
    isPending,
  };
};

export const resolveSbtPageMiniOpenMintButtonState = ({
  mintingStatus = '',
}: ResolveSbtPageMiniOpenMintButtonStateArgs = {}): SbtPageMiniOpenMintButtonState => {
  const isPending = mintingStatus === 'pending';
  return {
    disabled: isPending,
    isFailure: mintingStatus === 'failure',
    isIdle: mintingStatus === 'idle',
    isPending,
    isSuccess: mintingStatus === 'success',
  };
};

export const resolveSbtPageMiniActionStatusDisplayState = ({
  isFailure = false,
}: ResolveSbtPageMiniActionStatusDisplayStateArgs = {}): SbtPageMiniActionStatusDisplayState => ({
  style: {
    marginTop: '10px',
    ...(isFailure ? { color: 'red' } : {}),
  },
});

export const buildSbtPageActionButtonClassName = ({
  actionClassName = '',
  includeMiniClass = false,
  miniClassName = '',
  variantClassName = '',
}: BuildSbtPageActionButtonClassNameArgs = {}): string => ([
  String(actionClassName || ''),
  String(variantClassName || ''),
  includeMiniClass ? String(miniClassName || '') : '',
].filter(Boolean).join(' '));

export const resolveSbtPageMiniControlDisplayState = ({
  inputMaxWidth = '',
}: ResolveSbtPageMiniControlDisplayStateArgs = {}): SbtPageMiniControlDisplayState => {
  const maxWidth = String(inputMaxWidth || '').trim();
  return {
    inputStyle: maxWidth ? { maxWidth } : {},
    topMarginStyle: { marginTop: '10px' },
  };
};

export const resolveSbtPageMiniBurnButtonState = ({
  burningStatus = '',
}: ResolveSbtPageMiniBurnButtonStateArgs = {}): SbtPageMiniBurnButtonState => {
  const isPending = burningStatus === 'pending';
  return {
    disabled: isPending,
    isPending,
  };
};

export const resolveSbtPageMiniTokenActionDisplayState = ({
  burningStatus = '',
  canBurnMini = false,
}: ResolveSbtPageMiniTokenActionDisplayStateArgs = {}): SbtPageMiniTokenActionDisplayState => {
  const shouldRenderBurnedStatus = burningStatus === 'success';
  const shouldRenderBurnButton = !shouldRenderBurnedStatus && !!canBurnMini;
  return {
    shouldRenderBurnButton,
    shouldRenderBurnedStatus,
    shouldRenderJoinedStatus: !shouldRenderBurnedStatus && !shouldRenderBurnButton,
  };
};

export const resolveSbtPageMintActionPlan = ({
  burningStatus = '',
  nowSeconds = 0,
  sbtInfo = null,
  userHasSBT = false,
}: ShouldRenderSbtPageMintButtonArgs = {}): SbtPageMintActionPlan => {
  if (userHasSBT && burningStatus !== 'success') {
    return {
      blockedReason: 'already-has-token',
      shouldRenderMintButton: false,
    };
  }
  if (!sbtInfo) {
    return {
      blockedReason: 'missing-sbt',
      shouldRenderMintButton: false,
    };
  }
  const mintingEndTime = (sbtInfo as { mintingEndTime?: unknown })?.mintingEndTime;
  if (mintingEndTime !== 0 && Number(mintingEndTime) < Number(nowSeconds || 0)) {
    return {
      blockedReason: 'mint-ended',
      shouldRenderMintButton: false,
    };
  }
  return {
    blockedReason: 'none',
    shouldRenderMintButton: true,
  };
};

export const shouldRenderSbtPageMintButton = ({
  burningStatus = '',
  nowSeconds = 0,
  sbtInfo = null,
  userHasSBT = false,
}: ShouldRenderSbtPageMintButtonArgs = {}): boolean => {
  return resolveSbtPageMintActionPlan({
    burningStatus,
    nowSeconds,
    sbtInfo,
    userHasSBT,
  }).shouldRenderMintButton;
};

export const resolveSbtPageAdminActionState = ({
  account = '',
  hasInviteMint = false,
  sbtInfo = null,
}: ResolveSbtPageAdminActionStateArgs = {}): SbtPageAdminActionState => {
  const info = isSbtPageActionRecord(sbtInfo) ? sbtInfo : {};
  const adminAddr = String(info.admin || info.admin_ || '');
  const hasPasswordMint = !!info.hasPasswordMint;
  const showPasswordGen = hasPasswordMint && info.maxTokens === '0';
  const showNoMoreInvites = hasPasswordMint && info.maxTokens !== '0';
  return {
    canAdminBurn: (
      (info.burnAuth === 0 || info.burnAuth === 2) &&
      adminAddr.toLowerCase() === String(account || '').toLowerCase()
    ),
    hasPasswordMint,
    isInvite: !!hasInviteMint,
    showNoMoreInvites,
    showPasswordGen,
  };
};

export const resolveSbtPageMintFlowDisplayState = ({
  hasGroupPasswordMint = false,
  hasInviteMint = false,
  mintingStatus = '',
  mintStep = 0,
  sbtInfo = null,
}: ResolveSbtPageMintFlowDisplayStateArgs = {}): SbtPageMintFlowDisplayState => {
  const hasSuccessfulMint = mintingStatus === 'success';
  const isGroupPasswordFlow = !!hasGroupPasswordMint;
  const isInviteFlow = !isGroupPasswordFlow && !!hasInviteMint;
  const info = isSbtPageActionRecord(sbtInfo) ? sbtInfo : {};
  const hasPasswordMint = !!info.hasPasswordMint;
  const shouldRenderOpenMintButton = !isGroupPasswordFlow && !isInviteFlow && !hasPasswordMint;
  const shouldRenderManualClaimFlow = !isGroupPasswordFlow && !isInviteFlow && hasPasswordMint;
  const step = Number(mintStep || 0);
  return {
    shouldRenderClaimCountdown: shouldRenderManualClaimFlow && step === 1,
    shouldRenderClaimSuccess: shouldRenderManualClaimFlow && step === 3,
    shouldRenderGroupPasswordJoin: isGroupPasswordFlow && !hasSuccessfulMint,
    shouldRenderInviteJoin: isInviteFlow && !hasSuccessfulMint,
    shouldRenderManualClaimFinish: shouldRenderManualClaimFlow && step === 2,
    shouldRenderManualClaimStart: shouldRenderManualClaimFlow && step === 0,
    shouldRenderOpenMintButton,
    shouldSuppressMintControls: (isGroupPasswordFlow || isInviteFlow) && hasSuccessfulMint,
  };
};
