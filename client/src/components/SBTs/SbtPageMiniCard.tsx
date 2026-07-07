import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faLock,
  faSpinner,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import styles from './SBTPage.module.scss';
import SbtPageMiniActionArea, { type SbtPageMiniActionAreaProps } from './SbtPageMiniActionArea';
import SbtPageMiniCardDisplay from './SbtPageMiniCardDisplay';

type SbtPagePendingContentState = {
  failureLabel?: string;
  idleLabel?: string;
  label?: string;
  shouldRenderFailure?: boolean;
  shouldRenderIdleLabel?: boolean;
  shouldRenderLabel?: boolean;
  shouldRenderPendingIcon?: boolean;
  shouldRenderSuccess?: boolean;
  successLabel?: string;
};

type SbtPageButtonState = {
  disabled?: boolean;
  isPending?: boolean;
};

type SbtPageMiniMintFlowDisplayState = Record<string, boolean | undefined>;

type SbtPageMiniActionFailureState = {
  showBurnFailedStatus?: boolean;
  showMintFailedStatus?: boolean;
};

type SbtPageMiniTokenActionDisplayState = {
  shouldRenderBurnButton?: boolean;
  shouldRenderBurnedStatus?: boolean;
  shouldRenderJoinedStatus?: boolean;
};

type SbtPageMiniCardProps = {
  burnLabel: string;
  burnedLabel: string;
  cardStyle?: React.CSSProperties;
  claimCountdown?: number | string;
  groupPasswordInput?: string;
  hasGroupPasswordMint?: boolean;
  hasInviteMint?: boolean;
  hasPasswordMint?: boolean;
  hasTokenMini?: boolean;
  imageUrl: string;
  isMintingActive?: boolean;
  manualPasswordInput?: string;
  miniActionFailureState: SbtPageMiniActionFailureState;
  miniActionFailureStatusStyle?: React.CSSProperties;
  miniActionStatusStyle?: React.CSSProperties;
  miniBurnActionButtonClassName: string;
  miniBurnButtonState?: SbtPageButtonState | null;
  miniBurnContentState?: SbtPagePendingContentState | null;
  miniControlTopMarginStyle?: React.CSSProperties;
  miniInviteInputStyle?: React.CSSProperties;
  miniManualClaimButtonState: SbtPageButtonState;
  miniManualClaimFinishContentState: SbtPagePendingContentState;
  miniManualClaimStartContentState: SbtPagePendingContentState;
  miniMintActionButtonClassName: string;
  miniMintFlowDisplayState: SbtPageMiniMintFlowDisplayState;
  miniMintable?: boolean;
  miniOpenMintButtonContentState: SbtPagePendingContentState;
  miniOpenMintButtonState: SbtPageButtonState;
  miniPasswordControlInputStyle?: React.CSSProperties;
  miniPasswordJoinButtonState: SbtPageButtonState;
  miniPasswordJoinContentState: SbtPagePendingContentState;
  miniTokenActionDisplayState?: SbtPageMiniTokenActionDisplayState | null;
  mintFailedLabel: string;
  mintStatusId: string;
  mintedLabel: string;
  mintingLabel: string;
  onCardClick: React.MouseEventHandler<HTMLDivElement>;
  onCardKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  onClaimWithInviteCode: React.MouseEventHandler<HTMLButtonElement>;
  onGroupPasswordInputChange: React.ChangeEventHandler<HTMLInputElement>;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
  onManualPasswordInputChange: React.ChangeEventHandler<HTMLInputElement>;
  onMiniBurn: React.MouseEventHandler<HTMLButtonElement>;
  onMiniMint: React.MouseEventHandler<HTMLButtonElement>;
  onMintUnlimitedWithGroupPassword: React.MouseEventHandler<HTMLButtonElement>;
  onShowMiniPasswordInput: React.MouseEventHandler<HTMLButtonElement>;
  sbtAddress: string;
  sbtName: string;
  shouldRenderEndedIndicator?: boolean;
  shouldRenderLiveIndicator?: boolean;
  showLockIcon?: boolean;
  showMiniSbtAddress?: boolean;
};

const renderPendingButtonContent = (contentState: SbtPagePendingContentState): React.ReactNode => (
  <>
    {contentState.shouldRenderIdleLabel && contentState.idleLabel}
    {contentState.shouldRenderPendingIcon && <FontAwesomeIcon icon={faSpinner} spin />}
    {contentState.shouldRenderLabel && contentState.label}
    {contentState.shouldRenderFailure && (
      <>{contentState.failureLabel} <FontAwesomeIcon icon={faTimes} /></>
    )}
    {contentState.shouldRenderSuccess && (
      <>{contentState.successLabel} <FontAwesomeIcon icon={faCheck} /></>
    )}
  </>
);

const SbtPageMiniCard = ({
  burnLabel,
  burnedLabel,
  cardStyle,
  claimCountdown = '',
  groupPasswordInput = '',
  hasGroupPasswordMint = false,
  hasInviteMint = false,
  hasPasswordMint = false,
  hasTokenMini = false,
  imageUrl,
  isMintingActive = false,
  manualPasswordInput = '',
  miniActionFailureState,
  miniActionFailureStatusStyle,
  miniActionStatusStyle,
  miniBurnActionButtonClassName,
  miniBurnButtonState = null,
  miniBurnContentState = null,
  miniControlTopMarginStyle,
  miniInviteInputStyle,
  miniManualClaimButtonState,
  miniManualClaimFinishContentState,
  miniManualClaimStartContentState,
  miniMintActionButtonClassName,
  miniMintFlowDisplayState,
  miniMintable = false,
  miniOpenMintButtonContentState,
  miniOpenMintButtonState,
  miniPasswordControlInputStyle,
  miniPasswordJoinButtonState,
  miniPasswordJoinContentState,
  miniTokenActionDisplayState = null,
  mintFailedLabel,
  mintStatusId,
  mintedLabel,
  mintingLabel,
  onCardClick,
  onCardKeyDown,
  onClaimWithInviteCode,
  onGroupPasswordInputChange,
  onImageError,
  onManualPasswordInputChange,
  onMiniBurn,
  onMiniMint,
  onMintUnlimitedWithGroupPassword,
  onShowMiniPasswordInput,
  sbtAddress,
  sbtName,
  shouldRenderEndedIndicator = false,
  shouldRenderLiveIndicator = false,
  showLockIcon = false,
  showMiniSbtAddress = false,
}: SbtPageMiniCardProps): React.ReactElement => (
  <div
    className={styles.sbtItem}
    style={cardStyle}
    role="button"
    tabIndex={0}
    onClick={onCardClick}
    onKeyDown={onCardKeyDown}
  >
    <SbtPageMiniCardDisplay
      imageUrl={imageUrl}
      isMintingActive={isMintingActive}
      mintStatusId={mintStatusId}
      mintingLabel={mintingLabel}
      onImageError={onImageError}
      sbtAddress={sbtAddress}
      sbtName={sbtName}
      shouldRenderEndedIndicator={shouldRenderEndedIndicator}
      shouldRenderLiveIndicator={shouldRenderLiveIndicator}
      showLockIcon={showLockIcon}
      showMiniSbtAddress={showMiniSbtAddress}
    />
    <SbtPageMiniActionArea
      burnLabel={burnLabel}
      burnedLabel={burnedLabel}
      groupPasswordInput={groupPasswordInput}
      hasTokenMini={hasTokenMini}
      miniActionFailureState={miniActionFailureState}
      miniActionFailureStatusStyle={miniActionFailureStatusStyle}
      miniActionStatusStyle={miniActionStatusStyle}
      miniBurnActionButtonClassName={miniBurnActionButtonClassName}
      miniBurnButtonState={miniBurnButtonState}
      miniBurnContentState={miniBurnContentState}
      miniControlTopMarginStyle={miniControlTopMarginStyle}
      miniInviteInputStyle={miniInviteInputStyle}
      miniManualClaimActionRequest={miniManualClaimActionRequest}
      miniMintActionPlan={miniMintActionPlan}
      miniMintActionButtonClassName={miniMintActionButtonClassName}
      miniOpenMintButtonState={miniOpenMintButtonState}
      miniPasswordControlInputStyle={miniPasswordControlInputStyle}
      miniPasswordJoinButtonState={miniPasswordJoinButtonState}
      miniPasswordJoinContentState={miniPasswordJoinContentState}
      miniTokenActionDisplayState={miniTokenActionDisplayState}
      mintFailedLabel={mintFailedLabel}
      mintedLabel={mintedLabel}
      onClaimWithInviteCode={onClaimWithInviteCode}
      onGroupPasswordInputChange={onGroupPasswordInputChange}
      onManualPasswordInputChange={onManualPasswordInputChange}
      onMiniBurn={onMiniBurn}
      onMiniMint={onMiniMint}
      onMintUnlimitedWithGroupPassword={onMintUnlimitedWithGroupPassword}
      onShowMiniPasswordInput={onShowMiniPasswordInput}
    />
  </div>
);

export default SbtPageMiniCard;
