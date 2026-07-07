import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';

import styles from './SBTPage.module.scss';
import {
  resolveSbtPageStatusButtonContentState,
  type SbtPageMiniManualClaimActionRequest,
  type SbtPageMiniMintActionPlan,
} from './sbtPageActionDisplayHelpers';

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
  isFailure?: boolean;
  isIdle?: boolean;
  isPending?: boolean;
  isSuccess?: boolean;
};

type SbtPageMiniActionFailureState = {
  showBurnFailedStatus?: boolean;
  showMintFailedStatus?: boolean;
};

type SbtPageMiniTokenActionDisplayState = {
  shouldRenderBurnButton?: boolean;
  shouldRenderBurnedStatus?: boolean;
  shouldRenderJoinedStatus?: boolean;
};

export type SbtPageMiniActionAreaProps = {
  burnLabel: string;
  burnedLabel: string;
  groupPasswordInput?: string;
  hasTokenMini?: boolean;
  miniActionFailureState: SbtPageMiniActionFailureState;
  miniActionFailureStatusStyle?: React.CSSProperties;
  miniActionStatusStyle?: React.CSSProperties;
  miniBurnActionButtonClassName: string;
  miniBurnButtonState?: SbtPageButtonState | null;
  miniBurnContentState?: SbtPagePendingContentState | null;
  miniControlTopMarginStyle?: React.CSSProperties;
  miniInviteInputStyle?: React.CSSProperties;
  miniManualClaimActionRequest: SbtPageMiniManualClaimActionRequest;
  miniMintActionPlan: SbtPageMiniMintActionPlan;
  miniMintActionButtonClassName: string;
  miniOpenMintButtonState: SbtPageButtonState;
  miniPasswordControlInputStyle?: React.CSSProperties;
  miniPasswordJoinButtonState: SbtPageButtonState;
  miniPasswordJoinContentState: SbtPagePendingContentState;
  miniTokenActionDisplayState?: SbtPageMiniTokenActionDisplayState | null;
  mintFailedLabel: string;
  mintedLabel: string;
  onClaimWithInviteCode: React.MouseEventHandler<HTMLButtonElement>;
  onGroupPasswordInputChange: React.ChangeEventHandler<HTMLInputElement>;
  onManualPasswordInputChange: React.ChangeEventHandler<HTMLInputElement>;
  onMiniBurn: React.MouseEventHandler<HTMLButtonElement>;
  onMiniMint: React.MouseEventHandler<HTMLButtonElement>;
  onMintUnlimitedWithGroupPassword: React.MouseEventHandler<HTMLButtonElement>;
  onShowMiniPasswordInput: React.MouseEventHandler<HTMLButtonElement>;
};

const renderPendingButtonContent = (contentState: SbtPagePendingContentState): React.ReactNode => (
  <>
    {contentState.shouldRenderIdleLabel && contentState.idleLabel}
    {contentState.shouldRenderPendingIcon && <FontAwesomeIcon icon={faSpinner} spin />}
    {contentState.shouldRenderLabel && contentState.label}
    {contentState.shouldRenderFailure && (
      <>
        {contentState.failureLabel} <FontAwesomeIcon icon={faTimes} />
      </>
    )}
    {contentState.shouldRenderSuccess && (
      <>
        {contentState.successLabel} <FontAwesomeIcon icon={faCheck} />
      </>
    )}
  </>
);

const SbtPageMiniActionArea = ({
  burnLabel,
  burnedLabel,
  groupPasswordInput = '',
  hasTokenMini = false,
  miniActionFailureState,
  miniActionFailureStatusStyle,
  miniActionStatusStyle,
  miniBurnActionButtonClassName,
  miniBurnButtonState = null,
  miniBurnContentState = null,
  miniControlTopMarginStyle,
  miniInviteInputStyle,
  miniManualClaimActionRequest,
  miniMintActionPlan,
  miniMintActionButtonClassName,
  miniOpenMintButtonState,
  miniPasswordControlInputStyle,
  miniPasswordJoinButtonState,
  miniPasswordJoinContentState,
  miniTokenActionDisplayState = null,
  mintFailedLabel,
  mintedLabel,
  onClaimWithInviteCode,
  onGroupPasswordInputChange,
  onManualPasswordInputChange,
  onMiniBurn,
  onMiniMint,
  onMintUnlimitedWithGroupPassword,
  onShowMiniPasswordInput,
}: SbtPageMiniActionAreaProps): React.ReactElement => {
  let miniMintArea: React.ReactNode = null;
  const miniOpenMintButtonContentState = resolveSbtPageStatusButtonContentState({
    idleLabel: 'Join',
    isFailure: miniOpenMintButtonState.isFailure,
    isIdle: miniOpenMintButtonState.isIdle,
    isPending: miniOpenMintButtonState.isPending,
    isSuccess: miniOpenMintButtonState.isSuccess,
    successLabel: mintedLabel,
  });

  if (!hasTokenMini && miniMintActionPlan.shouldRenderMintArea) {
    if (
      miniMintActionPlan.viewKind === 'group-password-disclosure' ||
      miniMintActionPlan.viewKind === 'invite-disclosure' ||
      miniMintActionPlan.viewKind === 'manual-password-disclosure'
    ) {
      miniMintArea = (
        <button
          onClick={onShowMiniPasswordInput}
          className={miniMintActionButtonClassName}
          style={miniControlTopMarginStyle}
        >
          Join
        </button>
      );
    } else if (miniMintActionPlan.viewKind === 'group-password-input') {
      miniMintArea = (
        <div className={styles.miniMintPasswordArea} style={miniControlTopMarginStyle}>
          <input
            type="password"
            className={styles.miniPasswordInput}
            value={groupPasswordInput || ''}
            onChange={onGroupPasswordInputChange}
            placeholder="Password"
            disabled={miniPasswordJoinButtonState.isPending}
            style={miniPasswordControlInputStyle}
          />
          <button
            onClick={onMintUnlimitedWithGroupPassword}
            disabled={miniMintActionPlan.disabled}
            className={miniMintActionButtonClassName}
          >
            {renderPendingButtonContent(miniPasswordJoinContentState)}
          </button>
        </div>
      );
    } else if (miniMintActionPlan.viewKind === 'invite-input') {
      miniMintArea = (
        <div className={styles.miniMintPasswordArea} style={miniControlTopMarginStyle}>
          <input
            type="password"
            className={styles.miniPasswordInput}
            value={groupPasswordInput || ''}
            onChange={onGroupPasswordInputChange}
            placeholder="Invite Code"
            disabled={miniPasswordJoinButtonState.isPending}
            style={miniInviteInputStyle}
          />
          <button
            onClick={onClaimWithInviteCode}
            disabled={miniMintActionPlan.disabled}
            className={miniMintActionButtonClassName}
          >
            {renderPendingButtonContent(miniPasswordJoinContentState)}
          </button>
        </div>
      );
    } else if (miniManualClaimActionRequest.shouldRenderInputAction) {
      miniMintArea = (
        <div className={styles.miniMintPasswordArea} style={miniControlTopMarginStyle}>
          <input
            type={miniManualClaimActionRequest.inputType}
            className={styles.miniPasswordInput}
            value={miniManualClaimActionRequest.inputValue}
            onChange={onManualPasswordInputChange}
            placeholder={miniManualClaimActionRequest.placeholder}
            disabled={miniManualClaimActionRequest.inputDisabled}
            style={
              miniManualClaimActionRequest.viewKind === 'manual-password-start-input'
                ? miniPasswordControlInputStyle
                : undefined
            }
          />
          <button
            onClick={onMiniMint}
            disabled={miniManualClaimActionRequest.disabled}
            className={miniMintActionButtonClassName}
          >
            {renderPendingButtonContent(miniManualClaimActionRequest.contentState)}
          </button>
        </div>
      );
    } else if (miniManualClaimActionRequest.viewKind === 'manual-claim-countdown') {
      miniMintArea = (
        <div className={styles.miniActionStatus} style={miniActionStatusStyle}>
          {miniManualClaimActionRequest.statusText}
        </div>
      );
    } else if (miniManualClaimActionRequest.viewKind === 'manual-claim-success') {
      miniMintArea = (
        <div className={styles.miniActionStatus} style={miniActionStatusStyle}>
          {miniManualClaimActionRequest.statusText}
        </div>
      );
    } else if (miniMintActionPlan.viewKind === 'open-mint-button') {
      miniMintArea = (
        <button
          onClick={onMiniMint}
          className={miniMintActionButtonClassName}
          style={miniControlTopMarginStyle}
          disabled={miniMintActionPlan.disabled}
        >
          {renderPendingButtonContent(miniOpenMintButtonContentState)}
        </button>
      );
    }
  } else if (miniTokenActionDisplayState?.shouldRenderBurnedStatus) {
    miniMintArea = <div className={styles.miniActionStatus} style={miniActionStatusStyle}>{`${burnedLabel}!`}</div>;
  } else if (miniTokenActionDisplayState?.shouldRenderBurnButton && miniBurnButtonState && miniBurnContentState) {
    miniMintArea = (
      <button
        onClick={onMiniBurn}
        className={miniBurnActionButtonClassName}
        style={miniControlTopMarginStyle}
        disabled={miniBurnButtonState.disabled}
      >
        {renderPendingButtonContent(miniBurnContentState)}
      </button>
    );
  } else if (miniTokenActionDisplayState?.shouldRenderJoinedStatus) {
    miniMintArea = (
      <div className={styles.miniActionStatus} style={miniActionStatusStyle}>
        Joined!
      </div>
    );
  }

  if (miniActionFailureState.showMintFailedStatus) {
    miniMintArea = (
      <div className={styles.miniActionStatus} style={miniActionFailureStatusStyle}>
        {mintFailedLabel}
      </div>
    );
  }
  if (miniActionFailureState.showBurnFailedStatus) {
    miniMintArea = (
      <div className={styles.miniActionStatus} style={miniActionFailureStatusStyle}>{`${burnLabel} Failed`}</div>
    );
  }

  return <>{miniMintArea}</>;
};

export default SbtPageMiniActionArea;
