import {
  resolveSbtPagePasswordExportControlsState,
  resolveSbtPagePasswordExportSelection,
  resolveSbtPagePasswordInventoryDisplayState,
} from './sbtPagePasswordExportHelpers';

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
type SbtPageBurnActionBlockedReason = 'none' | 'missing-sbt' | 'missing-token' | 'owner-burn-disabled';
export type SbtPageBurnActionPlan = SbtPageBurnButtonState & {
  blockedReason: SbtPageBurnActionBlockedReason;
};
type ResolveSbtPageBurnStatusButtonStateArgs = {
  burningStatus?: unknown;
};
export type SbtPageBurnStatusButtonState = {
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
  readinessDescriptor: SbtPageOpenMintReadinessDescriptor;
  title?: string;
};
type SbtPageOpenMintReadinessDescriptor = {
  canOpenMintTx: boolean;
  hasMintTransactionHash: boolean;
  isBurnCleared: boolean;
  isMinted: boolean;
  isPending: boolean;
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
export type SbtPagePendingButtonContentState = {
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
export type SbtPageStatusButtonContentState = {
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
export type SbtPageManualClaimButtonState = {
  disabled: boolean;
  isPending: boolean;
};
type ResolveSbtPageManualClaimActionRequestArgs = {
  claimCountdown?: unknown;
  finishLabel?: unknown;
  manualPasswordInput?: unknown;
  mintFlowDisplayState?: Partial<SbtPageMintFlowDisplayState> | null;
  mintingStatus?: unknown;
  startLabel?: unknown;
  successLabel?: unknown;
};
export type SbtPageManualClaimActionRequestViewKind =
  | 'hidden'
  | 'manual-claim-countdown'
  | 'manual-claim-success'
  | 'manual-password-finish-input'
  | 'manual-password-start-input';
export type SbtPageManualClaimActionRequest = {
  buttonState: SbtPageManualClaimButtonState;
  contentState: SbtPagePendingButtonContentState;
  disabled: boolean;
  handlerKind: 'handle-mint-force-refresh' | 'none';
  inputType: 'text';
  inputValue: string;
  mintArgs: [true];
  placeholder: string;
  shouldRenderInputAction: boolean;
  shouldRenderStatus: boolean;
  statusText: string;
  viewKind: SbtPageManualClaimActionRequestViewKind;
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
type ResolveSbtPageMiniMintActionPlanArgs = ResolveSbtPageMiniMintFlowDisplayStateArgs & {
  miniManualClaimButtonState?: { disabled?: unknown } | null;
  miniOpenMintButtonState?: { disabled?: unknown } | null;
  miniPasswordJoinButtonState?: { disabled?: unknown } | null;
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
export type SbtPageMiniMintActionBlockedReason =
  'none' | 'already-has-token' | 'mini-mint-unavailable' | 'mint-ended' | 'no-visible-action';
export type SbtPageMiniMintActionHandlerKind =
  'none' | 'claim-with-invite-code' | 'mini-mint' | 'mint-unlimited-with-group-password' | 'show-password-input';
export type SbtPageMiniMintActionInertReason = 'none' | 'disabled' | 'hidden' | 'status-only';
export type SbtPageMiniMintActionLabelKind = 'none' | 'countdown' | 'finish' | 'join' | 'minted' | 'status';
export type SbtPageMiniMintActionViewKind =
  | 'hidden'
  | 'group-password-disclosure'
  | 'group-password-input'
  | 'invite-disclosure'
  | 'invite-input'
  | 'manual-claim-countdown'
  | 'manual-claim-success'
  | 'manual-password-disclosure'
  | 'manual-password-finish-input'
  | 'manual-password-start-input'
  | 'open-mint-button';
export type SbtPageMiniMintActionPlan = {
  blockedReason: SbtPageMiniMintActionBlockedReason;
  disabled: boolean;
  handlerKind: SbtPageMiniMintActionHandlerKind;
  inertReason: SbtPageMiniMintActionInertReason;
  isInteractive: boolean;
  labelKind: SbtPageMiniMintActionLabelKind;
  shouldRenderMintArea: boolean;
  viewKind: SbtPageMiniMintActionViewKind;
};
type ResolveSbtPageMiniManualClaimActionRequestArgs = {
  claimCountdown?: unknown;
  finishLabel?: unknown;
  manualPasswordInput?: unknown;
  miniMintActionPlan?: Partial<SbtPageMiniMintActionPlan> | null;
  mintingStatus?: unknown;
  startLabel?: unknown;
  successLabel?: unknown;
};
export type SbtPageMiniManualClaimActionRequestViewKind =
  | 'hidden'
  | 'manual-claim-countdown'
  | 'manual-claim-success'
  | 'manual-password-finish-input'
  | 'manual-password-start-input';
export type SbtPageMiniManualClaimActionRequest = {
  buttonState: SbtPageManualClaimButtonState;
  contentState: SbtPagePendingButtonContentState;
  disabled: boolean;
  handlerKind: 'mini-mint' | 'none';
  inputDisabled: boolean;
  inputType: 'text';
  inputValue: string;
  placeholder: string;
  shouldRenderInputAction: boolean;
  shouldRenderStatus: boolean;
  statusText: string;
  viewKind: SbtPageMiniManualClaimActionRequestViewKind;
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
type ResolveSbtPageMiniCardDisplayStateArgs = {
  account?: unknown;
  actionClassName?: unknown;
  burnLabel?: unknown;
  burningStatus?: unknown;
  burnButtonClassName?: unknown;
  claimCountdown?: unknown;
  groupPasswordInput?: unknown;
  hasGroupPasswordMint?: unknown;
  hasInviteMint?: unknown;
  manualPasswordInput?: unknown;
  mintedLabel?: unknown;
  miniButtonClassName?: unknown;
  miniMintable?: unknown;
  mintButtonClassName?: unknown;
  mintingStatus?: unknown;
  mintStep?: unknown;
  nowSec?: unknown;
  sbtAddress?: unknown;
  sbtInfo?: unknown;
  showMiniPasswordInput?: unknown;
  userHasSBT?: unknown;
  userIsSbtAdmin?: unknown;
};
type SbtPageMiniCardDisplayState = SbtPageMiniMintState & {
  miniActionFailureState: SbtPageMiniActionFailureState;
  miniActionFailureStatusDisplayState: SbtPageMiniActionStatusDisplayState;
  miniActionStatusDisplayState: SbtPageMiniActionStatusDisplayState;
  miniBurnActionButtonClassName: string;
  miniBurnActionPlan: {
    blockedReason: 'none' | 'hidden';
    shouldRenderMiniBurnButton: boolean;
  };
  miniBurnButtonState: SbtPageMiniBurnButtonState | null;
  miniBurnContentState: SbtPagePendingButtonContentState | null;
  miniControlDisplayState: SbtPageMiniControlDisplayState;
  miniInviteControlDisplayState: SbtPageMiniControlDisplayState;
  miniManualClaimActionRequest: SbtPageMiniManualClaimActionRequest;
  miniMintActionButtonClassName: string;
  miniMintActionPlan: SbtPageMiniMintActionPlan;
  miniOpenMintButtonState: SbtPageMiniOpenMintButtonState;
  miniPasswordControlDisplayState: SbtPageMiniControlDisplayState;
  miniPasswordJoinButtonState: SbtPagePasswordJoinButtonState;
  miniPasswordJoinContentState: SbtPagePendingButtonContentState;
  miniTokenActionDisplayState: SbtPageMiniTokenActionDisplayState | null;
};
type ResolveSbtPageAdminActionStateArgs = {
  account?: unknown;
  hasInviteMint?: unknown;
  sbtInfo?: unknown;
};
type ResolveSbtPageAdminActionDisplayPlanArgs = ResolveSbtPageAdminActionStateArgs & {
  adminGeneratedPasswords?: unknown;
  burnedLabel?: unknown;
  burningStatus?: unknown;
  burnLabel?: unknown;
  burnSearchResult?: unknown;
  cachedPasswords?: unknown;
  includePreviousPasswords?: unknown;
  passwordGenerationCount?: unknown;
  sbtLabel?: unknown;
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
export type SbtPageAdminActionDisplayPlan = SbtPageAdminActionState & {
  adminBurnButtonContentState: SbtPageStatusButtonContentState;
  adminBurnStatusButtonState: SbtPageBurnStatusButtonState;
  adminGeneratedPasswordList: string[];
  cachedPasswordList: string[];
  combinedPasswords: string[];
  effectiveIncludePreviousPasswords: unknown;
  onlyCachedPasswords: boolean;
  passwordExportControlsState: ReturnType<typeof resolveSbtPagePasswordExportControlsState>;
  passwordGenerationButtonState: SbtPagePasswordGenerationButtonState;
  passwordInventoryDisplayState: ReturnType<typeof resolveSbtPagePasswordInventoryDisplayState>;
  passwordsToExport: string[];
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
type SbtPageMintActionBlockedReason = 'none' | 'already-has-token' | 'mint-ended' | 'missing-sbt';
type SbtPageMintActionPlan = {
  blockedReason: SbtPageMintActionBlockedReason;
  shouldRenderMintButton: boolean;
};
type SbtPageMiniBurnPermission = {
  canAdminBurn: boolean;
  canBurnMini: boolean;
  canOwnerBurn: boolean;
};

const isSbtPageActionRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const coerceSbtPageBurnAuth = (burnAuth: unknown): number => {
  const burnAuthNumber = Number(burnAuth);
  return Number.isFinite(burnAuthNumber) ? burnAuthNumber : Number.NaN;
};

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

const buildHiddenMiniMintActionPlan = (
  blockedReason: SbtPageMiniMintActionBlockedReason,
): SbtPageMiniMintActionPlan => ({
  blockedReason,
  disabled: true,
  handlerKind: 'none',
  inertReason: 'hidden',
  isInteractive: false,
  labelKind: 'none',
  shouldRenderMintArea: false,
  viewKind: 'hidden',
});

const buildMiniMintActionPlan = ({
  disabled = false,
  handlerKind,
  labelKind,
  viewKind,
}: {
  disabled?: boolean;
  handlerKind: Exclude<SbtPageMiniMintActionHandlerKind, 'none'>;
  labelKind: Exclude<SbtPageMiniMintActionLabelKind, 'none'>;
  viewKind: Exclude<SbtPageMiniMintActionViewKind, 'hidden'>;
}): SbtPageMiniMintActionPlan => ({
  blockedReason: 'none',
  disabled,
  handlerKind,
  inertReason: disabled ? 'disabled' : 'none',
  isInteractive: !disabled,
  labelKind,
  shouldRenderMintArea: true,
  viewKind,
});

const buildMiniMintStatusActionPlan = ({
  labelKind,
  viewKind,
}: {
  labelKind: 'countdown' | 'minted';
  viewKind: 'manual-claim-countdown' | 'manual-claim-success';
}): SbtPageMiniMintActionPlan => ({
  blockedReason: 'none',
  disabled: false,
  handlerKind: 'none',
  inertReason: 'status-only',
  isInteractive: false,
  labelKind,
  shouldRenderMintArea: true,
  viewKind,
});

export const resolveSbtPageMiniMintActionPlan = ({
  hasGroupPasswordMint = false,
  hasInviteMint = false,
  hasPasswordMint = false,
  hasTokenMini = false,
  isMintingActive = false,
  miniManualClaimButtonState = null,
  miniMintable = false,
  miniOpenMintButtonState = null,
  miniPasswordJoinButtonState = null,
  mintStep = 0,
  showMiniPasswordInput = false,
}: ResolveSbtPageMiniMintActionPlanArgs = {}): SbtPageMiniMintActionPlan => {
  if (hasTokenMini) {
    return buildHiddenMiniMintActionPlan('already-has-token');
  }
  if (!miniMintable) {
    return buildHiddenMiniMintActionPlan('mini-mint-unavailable');
  }
  if (!isMintingActive) {
    return buildHiddenMiniMintActionPlan('mint-ended');
  }

  const flow = resolveSbtPageMiniMintFlowDisplayState({
    hasGroupPasswordMint,
    hasInviteMint,
    hasPasswordMint,
    hasTokenMini,
    isMintingActive,
    miniMintable,
    mintStep,
    showMiniPasswordInput,
  });

  if (flow.shouldRenderGroupPasswordDisclosureButton) {
    return buildMiniMintActionPlan({
      handlerKind: 'show-password-input',
      labelKind: 'join',
      viewKind: 'group-password-disclosure',
    });
  }
  if (flow.shouldRenderGroupPasswordInput) {
    return buildMiniMintActionPlan({
      disabled: !!miniPasswordJoinButtonState?.disabled,
      handlerKind: 'mint-unlimited-with-group-password',
      labelKind: 'join',
      viewKind: 'group-password-input',
    });
  }
  if (flow.shouldRenderInviteDisclosureButton) {
    return buildMiniMintActionPlan({
      handlerKind: 'show-password-input',
      labelKind: 'join',
      viewKind: 'invite-disclosure',
    });
  }
  if (flow.shouldRenderInviteInput) {
    return buildMiniMintActionPlan({
      disabled: !!miniPasswordJoinButtonState?.disabled,
      handlerKind: 'claim-with-invite-code',
      labelKind: 'join',
      viewKind: 'invite-input',
    });
  }
  if (flow.shouldRenderManualPasswordDisclosureButton) {
    return buildMiniMintActionPlan({
      handlerKind: 'show-password-input',
      labelKind: 'join',
      viewKind: 'manual-password-disclosure',
    });
  }
  if (flow.shouldRenderManualPasswordStartInput) {
    return buildMiniMintActionPlan({
      disabled: !!miniManualClaimButtonState?.disabled,
      handlerKind: 'mini-mint',
      labelKind: 'join',
      viewKind: 'manual-password-start-input',
    });
  }
  if (flow.shouldRenderManualClaimCountdown) {
    return buildMiniMintStatusActionPlan({
      labelKind: 'countdown',
      viewKind: 'manual-claim-countdown',
    });
  }
  if (flow.shouldRenderManualPasswordFinishInput) {
    return buildMiniMintActionPlan({
      disabled: !!miniManualClaimButtonState?.disabled,
      handlerKind: 'mini-mint',
      labelKind: 'finish',
      viewKind: 'manual-password-finish-input',
    });
  }
  if (flow.shouldRenderManualClaimSuccess) {
    return buildMiniMintStatusActionPlan({
      labelKind: 'minted',
      viewKind: 'manual-claim-success',
    });
  }
  if (flow.shouldRenderOpenMintButton) {
    return buildMiniMintActionPlan({
      disabled: !!miniOpenMintButtonState?.disabled,
      handlerKind: 'mini-mint',
      labelKind: 'status',
      viewKind: 'open-mint-button',
    });
  }

  return buildHiddenMiniMintActionPlan('no-visible-action');
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
  const burnAuth = coerceSbtPageBurnAuth(info.burnAuth);
  const canOwnerBurn =
    burnAuth === 1 || burnAuth === 2 || (burnAuth === 0 && !!adminAddr && adminAddrLower === userAddressLower);
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
  const burnAuth = coerceSbtPageBurnAuth(info.burnAuth);
  const canOwnerBurn =
    !!userHasSBT &&
    (burnAuth === 1 ||
      burnAuth === 2 ||
      (burnAuth === 0 && !!adminAddr && adminAddr.toLowerCase() === userAddressLower));
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
  const isBurnCleared = burningStatus === 'success';
  const isMinted = mintingStatus === 'success' && !isBurnCleared;
  const canOpenMintTx = !!(isMinted && lastMintTxHash);
  const isPending = mintingStatus === 'pending';
  return {
    canOpenMintTx,
    disabled: isPending || (isMinted && !canOpenMintTx),
    isFailure: mintingStatus === 'failure',
    isIdle: mintingStatus === 'idle',
    isMinted,
    isPending,
    readinessDescriptor: {
      canOpenMintTx,
      hasMintTransactionHash: !!lastMintTxHash,
      isBurnCleared,
      isMinted,
      isPending,
    },
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

export const resolveSbtPageManualClaimActionRequest = ({
  claimCountdown = '',
  finishLabel = 'Finish Claim',
  manualPasswordInput = '',
  mintFlowDisplayState = null,
  mintingStatus = '',
  startLabel = 'Start Claim',
  successLabel = '',
}: ResolveSbtPageManualClaimActionRequestArgs = {}): SbtPageManualClaimActionRequest => {
  const buttonState = resolveSbtPageManualClaimButtonState({
    manualPasswordInput,
    mintingStatus,
  });
  const buildInputAction = (
    label: unknown,
    viewKind: 'manual-password-finish-input' | 'manual-password-start-input',
  ): SbtPageManualClaimActionRequest => ({
    buttonState,
    contentState: resolveSbtPagePendingButtonContentState({
      isPending: buttonState.isPending,
      label,
    }),
    disabled: buttonState.disabled,
    handlerKind: 'handle-mint-force-refresh',
    inputType: 'text',
    inputValue: String(manualPasswordInput || ''),
    mintArgs: [true],
    placeholder: 'Claim Code',
    shouldRenderInputAction: true,
    shouldRenderStatus: false,
    statusText: '',
    viewKind,
  });
  const hiddenRequest: SbtPageManualClaimActionRequest = {
    buttonState,
    contentState: resolveSbtPagePendingButtonContentState({ label: '' }),
    disabled: true,
    handlerKind: 'none',
    inputType: 'text',
    inputValue: String(manualPasswordInput || ''),
    mintArgs: [true],
    placeholder: 'Claim Code',
    shouldRenderInputAction: false,
    shouldRenderStatus: false,
    statusText: '',
    viewKind: 'hidden',
  };

  if (mintFlowDisplayState?.shouldRenderManualClaimStart) {
    return buildInputAction(startLabel, 'manual-password-start-input');
  }
  if (mintFlowDisplayState?.shouldRenderClaimCountdown) {
    return {
      ...hiddenRequest,
      disabled: false,
      statusText: `Waiting period: ${String(claimCountdown || '')} seconds`,
      shouldRenderStatus: true,
      viewKind: 'manual-claim-countdown',
    };
  }
  if (mintFlowDisplayState?.shouldRenderManualClaimFinish) {
    return buildInputAction(finishLabel, 'manual-password-finish-input');
  }
  if (mintFlowDisplayState?.shouldRenderClaimSuccess) {
    return {
      ...hiddenRequest,
      disabled: false,
      statusText: String(successLabel || ''),
      shouldRenderStatus: true,
      viewKind: 'manual-claim-success',
    };
  }
  return hiddenRequest;
};

export const resolveSbtPageMintButtonDisplayState = ({
  burningStatus = '',
  claimCountdown = '',
  groupPasswordInput = '',
  hasGroupPasswordMint = false,
  hasInviteMint = false,
  lastMintTxHash = '',
  manualPasswordInput = '',
  mintedLabel = 'Minted',
  mintLowerLabel = 'mint',
  mintingStatus = '',
  mintStep = 0,
  nowSeconds = Math.floor(Date.now() / 1000),
  sbtInfo = null,
  sbtMintedSuccessLabel = 'SBT successfully minted!',
  userHasSBT = false,
}: ResolveSbtPageMintButtonDisplayStateArgs = {}): SbtPageMintButtonDisplayState => {
  const mintActionPlan = resolveSbtPageMintActionPlan({
    burningStatus,
    nowSeconds,
    sbtInfo,
    userHasSBT,
  });
  const passwordJoinButtonState = resolveSbtPagePasswordJoinButtonState({
    groupPasswordInput,
    mintingStatus,
  });
  const passwordJoinContentState = resolveSbtPagePendingButtonContentState({
    isPending: passwordJoinButtonState.isPending,
    label: 'Join',
  });
  const mintFlowDisplayState = resolveSbtPageMintFlowDisplayState({
    hasGroupPasswordMint,
    hasInviteMint,
    mintingStatus,
    mintStep,
    sbtInfo,
  });
  const manualClaimActionRequest = resolveSbtPageManualClaimActionRequest({
    claimCountdown,
    manualPasswordInput,
    mintFlowDisplayState,
    mintingStatus,
    successLabel: sbtMintedSuccessLabel,
  });
  const openMintButtonState = resolveSbtPageOpenMintButtonState({
    burningStatus,
    lastMintTxHash,
    mintLowerLabel,
    mintingStatus,
  });
  const openMintButtonContentState = resolveSbtPageStatusButtonContentState({
    idleLabel: 'Join',
    isFailure: openMintButtonState.isFailure,
    isIdle: openMintButtonState.isIdle,
    isPending: openMintButtonState.isPending,
    isSuccess: openMintButtonState.isMinted,
    successLabel: mintedLabel,
  });

  return {
    manualClaimActionRequest,
    mintActionPlan,
    mintFlowDisplayState,
    openMintButtonContentState,
    openMintButtonState,
    passwordJoinButtonState,
    passwordJoinContentState,
  };
};

export const resolveSbtPageFullActionDisplayPlan = ({
  account = '',
  actionClassName = '',
  burnedLabel = 'Burned',
  burningStatus = '',
  burnButtonClassName = '',
  burnLabel = 'Burn',
  claimCountdown = '',
  groupPasswordInput = '',
  hasGroupPasswordMint = false,
  hasInviteMint = false,
  lastMintTxHash = '',
  manualPasswordInput = '',
  mintedLabel = 'Minted',
  mintButtonClassName = '',
  mintLowerLabel = 'mint',
  mintingStatus = '',
  mintStep = 0,
  nowSeconds = Math.floor(Date.now() / 1000),
  sbtInfo = null,
  sbtMintedSuccessLabel = 'SBT successfully minted!',
  userHasSBT = false,
}: ResolveSbtPageFullActionDisplayPlanArgs = {}): SbtPageFullActionDisplayPlan => {
  const mintButtonDisplayState = resolveSbtPageMintButtonDisplayState({
    burningStatus,
    claimCountdown,
    groupPasswordInput,
    hasGroupPasswordMint,
    hasInviteMint,
    lastMintTxHash,
    manualPasswordInput,
    mintedLabel,
    mintLowerLabel,
    mintingStatus,
    mintStep,
    nowSeconds,
    sbtInfo,
    sbtMintedSuccessLabel,
    userHasSBT,
  });
  const burnActionPlan = resolveSbtPageBurnActionPlan({
    account,
    sbtInfo,
    userHasSBT,
  });
  const burnStatusButtonState = resolveSbtPageBurnStatusButtonState({
    burningStatus,
  });
  const burnButtonContentState = resolveSbtPageStatusButtonContentState({
    idleLabel: burnLabel,
    isFailure: burnStatusButtonState.isFailure,
    isIdle: burnStatusButtonState.isIdle,
    isPending: burnStatusButtonState.isPending,
    isSuccess: burnStatusButtonState.isSuccess,
    successLabel: burnedLabel,
  });

  return {
    burnActionButtonClassName: buildSbtPageActionButtonClassName({
      actionClassName,
      variantClassName: burnButtonClassName,
    }),
    burnActionPlan,
    burnButtonContentState,
    burnStatusButtonState,
    mintActionButtonClassName: buildSbtPageActionButtonClassName({
      actionClassName,
      variantClassName: mintButtonClassName,
    }),
    mintButtonDisplayState,
    shouldRenderBurnSurface: burnActionPlan.shouldRenderBurnButton,
    shouldRenderMintSurface: mintButtonDisplayState.mintActionPlan.shouldRenderMintButton,
  };
};

export const resolveSbtPageMiniManualClaimActionRequest = ({
  claimCountdown = '',
  finishLabel = 'Finish',
  manualPasswordInput = '',
  miniMintActionPlan = null,
  mintingStatus = '',
  startLabel = 'Join',
  successLabel = 'Minted',
}: ResolveSbtPageMiniManualClaimActionRequestArgs = {}): SbtPageMiniManualClaimActionRequest => {
  const buttonState = resolveSbtPageManualClaimButtonState({
    manualPasswordInput,
    mintingStatus,
  });
  const hiddenRequest: SbtPageMiniManualClaimActionRequest = {
    buttonState,
    contentState: resolveSbtPagePendingButtonContentState({ label: '' }),
    disabled: true,
    handlerKind: 'none',
    inputDisabled: buttonState.isPending,
    inputType: 'text',
    inputValue: String(manualPasswordInput || ''),
    placeholder: 'Password',
    shouldRenderInputAction: false,
    shouldRenderStatus: false,
    statusText: '',
    viewKind: 'hidden',
  };
  const buildInputAction = (
    label: unknown,
    viewKind: 'manual-password-finish-input' | 'manual-password-start-input',
  ): SbtPageMiniManualClaimActionRequest => ({
    ...hiddenRequest,
    contentState: resolveSbtPagePendingButtonContentState({
      isPending: buttonState.isPending,
      label,
    }),
    disabled: !!miniMintActionPlan?.disabled,
    handlerKind: 'mini-mint',
    shouldRenderInputAction: true,
    viewKind,
  });

  if (miniMintActionPlan?.viewKind === 'manual-password-start-input') {
    return buildInputAction(startLabel, 'manual-password-start-input');
  }
  if (miniMintActionPlan?.viewKind === 'manual-password-finish-input') {
    return buildInputAction(finishLabel, 'manual-password-finish-input');
  }
  if (miniMintActionPlan?.viewKind === 'manual-claim-countdown') {
    return {
      ...hiddenRequest,
      disabled: false,
      statusText: `Wait: ${String(claimCountdown || '')}s`,
      shouldRenderStatus: true,
      viewKind: 'manual-claim-countdown',
    };
  }
  if (miniMintActionPlan?.viewKind === 'manual-claim-success') {
    return {
      ...hiddenRequest,
      disabled: false,
      statusText: `${String(successLabel || '')}!`,
      shouldRenderStatus: true,
      viewKind: 'manual-claim-success',
    };
  }
  return hiddenRequest;
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
    ...(isFailure ? { color: 'var(--ce-status-danger-text)' } : {}),
  },
});

export const buildSbtPageActionButtonClassName = ({
  actionClassName = '',
  includeMiniClass = false,
  miniClassName = '',
  variantClassName = '',
}: BuildSbtPageActionButtonClassNameArgs = {}): string =>
  [String(actionClassName || ''), String(variantClassName || ''), includeMiniClass ? String(miniClassName || '') : '']
    .filter(Boolean)
    .join(' ');

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
  if (mintingEndTime !== 0 && Number(mintingEndTime) <= Number(nowSeconds || 0)) {
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
  const burnAuth = coerceSbtPageBurnAuth(info.burnAuth);
  const hasPasswordMint = !!info.hasPasswordMint;
  const showPasswordGen = hasPasswordMint && info.maxTokens === '0';
  const showNoMoreInvites = hasPasswordMint && info.maxTokens !== '0';
  return {
    canAdminBurn: (burnAuth === 0 || burnAuth === 2) && adminAddr.toLowerCase() === String(account || '').toLowerCase(),
    hasPasswordMint,
    isInvite: !!hasInviteMint,
    showNoMoreInvites,
    showPasswordGen,
  };
};

export const resolveSbtPageAdminActionDisplayPlan = ({
  account = '',
  adminGeneratedPasswords = [],
  burnedLabel = 'Burned',
  burningStatus = '',
  burnLabel = 'Burn',
  burnSearchResult = null,
  cachedPasswords = [],
  hasInviteMint = false,
  includePreviousPasswords = false,
  passwordGenerationCount = null,
  sbtInfo = null,
  sbtLabel = 'SBT',
}: ResolveSbtPageAdminActionDisplayPlanArgs = {}): SbtPageAdminActionDisplayPlan => {
  const adminActionState = resolveSbtPageAdminActionState({
    account,
    hasInviteMint,
    sbtInfo,
  });
  const passwordExportSelection = resolveSbtPagePasswordExportSelection({
    adminGeneratedPasswords,
    cachedPasswords,
    includePreviousPasswords,
  });
  const passwordExportControlsState = resolveSbtPagePasswordExportControlsState({
    adminGeneratedPasswordList: passwordExportSelection.adminGeneratedPasswordList,
    effectiveIncludePreviousPasswords: passwordExportSelection.effectiveIncludePreviousPasswords,
    onlyCachedPasswords: passwordExportSelection.onlyCachedPasswords,
  });
  const adminBurnStatusButtonState = resolveSbtPageAdminBurnButtonState({
    burnSearchResult,
    burningStatus,
  });
  const adminBurnButtonContentState = resolveSbtPageStatusButtonContentState({
    idleLabel: `${String(burnLabel || 'Burn')} ${String(sbtLabel || 'SBT')}`,
    isFailure: adminBurnStatusButtonState.isFailure,
    isIdle: adminBurnStatusButtonState.isIdle,
    isPending: adminBurnStatusButtonState.isPending,
    isSuccess: adminBurnStatusButtonState.isSuccess,
    successLabel: burnedLabel,
  });
  const passwordGenerationButtonState = resolveSbtPagePasswordGenerationButtonState({
    passwordGenerationCount,
  });
  const passwordInventoryDisplayState = resolveSbtPagePasswordInventoryDisplayState({
    combinedPasswords: passwordExportSelection.combinedPasswords,
    showNoMoreInvites: adminActionState.showNoMoreInvites,
    showPasswordGen: adminActionState.showPasswordGen,
  });

  return {
    ...adminActionState,
    ...passwordExportSelection,
    adminBurnButtonContentState,
    adminBurnStatusButtonState,
    passwordExportControlsState,
    passwordGenerationButtonState,
    passwordInventoryDisplayState,
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
