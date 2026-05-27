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
}: SbtPageMiniCardProps): React.ReactElement => {
  let miniMintArea: React.ReactNode = null;

  if (!hasTokenMini) {
    if (miniMintable) {
      if (hasGroupPasswordMint) {
        if (miniMintFlowDisplayState.shouldRenderGroupPasswordDisclosureButton) {
          miniMintArea = (
            <button
              onClick={onShowMiniPasswordInput}
              className={miniMintActionButtonClassName}
              style={miniControlTopMarginStyle}
            >
              Join
            </button>
          );
        } else if (miniMintFlowDisplayState.shouldRenderGroupPasswordInput) {
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
                disabled={miniPasswordJoinButtonState.disabled}
                className={miniMintActionButtonClassName}
              >
                {renderPendingButtonContent(miniPasswordJoinContentState)}
              </button>
            </div>
          );
        }
      } else if (hasInviteMint) {
        if (miniMintFlowDisplayState.shouldRenderInviteDisclosureButton) {
          miniMintArea = (
            <button
              onClick={onShowMiniPasswordInput}
              className={miniMintActionButtonClassName}
              style={miniControlTopMarginStyle}
            >
              Join
            </button>
          );
        } else if (miniMintFlowDisplayState.shouldRenderInviteInput) {
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
                disabled={miniPasswordJoinButtonState.disabled}
                className={miniMintActionButtonClassName}
              >
                {renderPendingButtonContent(miniPasswordJoinContentState)}
              </button>
            </div>
          );
        }
      } else if (hasPasswordMint) {
        if (miniMintFlowDisplayState.shouldRenderManualPasswordDisclosureButton) {
          miniMintArea = (
            <button
              onClick={onShowMiniPasswordInput}
              className={miniMintActionButtonClassName}
              style={miniControlTopMarginStyle}
            >
              Join
            </button>
          );
        } else if (miniMintFlowDisplayState.shouldRenderManualPasswordStartInput) {
          miniMintArea = (
            <div className={styles.miniMintPasswordArea} style={miniControlTopMarginStyle}>
              <input
                type="text"
                className={styles.miniPasswordInput}
                value={manualPasswordInput}
                onChange={onManualPasswordInputChange}
                placeholder="Password"
                disabled={miniManualClaimButtonState.isPending}
                style={miniPasswordControlInputStyle}
              />
              <button
                onClick={onMiniMint}
                disabled={miniManualClaimButtonState.disabled}
                className={miniMintActionButtonClassName}
              >
                {renderPendingButtonContent(miniManualClaimStartContentState)}
              </button>
            </div>
          );
        } else if (miniMintFlowDisplayState.shouldRenderManualClaimCountdown) {
          miniMintArea = (
            <div className={styles.miniActionStatus} style={miniActionStatusStyle}>
              Wait: {claimCountdown}s
            </div>
          );
        } else if (miniMintFlowDisplayState.shouldRenderManualPasswordFinishInput) {
          miniMintArea = (
            <div className={styles.miniMintPasswordArea} style={miniControlTopMarginStyle}>
              <input
                type="text"
                className={styles.miniPasswordInput}
                value={manualPasswordInput}
                onChange={onManualPasswordInputChange}
                placeholder="Password"
                disabled={miniManualClaimButtonState.isPending}
              />
              <button
                onClick={onMiniMint}
                disabled={miniManualClaimButtonState.disabled}
                className={miniMintActionButtonClassName}
              >
                {renderPendingButtonContent(miniManualClaimFinishContentState)}
              </button>
            </div>
          );
        } else if (miniMintFlowDisplayState.shouldRenderManualClaimSuccess) {
          miniMintArea = <div className={styles.miniActionStatus} style={miniActionStatusStyle}>{`${mintedLabel}!`}</div>;
        }
      } else if (miniMintFlowDisplayState.shouldRenderOpenMintButton) {
        miniMintArea = (
          <button
            onClick={onMiniMint}
            className={miniMintActionButtonClassName}
            style={miniControlTopMarginStyle}
            disabled={miniOpenMintButtonState.disabled}
          >
            {renderPendingButtonContent(miniOpenMintButtonContentState)}
          </button>
        );
      }
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
    miniMintArea = <div className={styles.miniActionStatus} style={miniActionStatusStyle}>Joined!</div>;
  }

  if (miniActionFailureState.showMintFailedStatus) {
    miniMintArea = <div className={styles.miniActionStatus} style={miniActionFailureStatusStyle}>{mintFailedLabel}</div>;
  }
  if (miniActionFailureState.showBurnFailedStatus) {
    miniMintArea = <div className={styles.miniActionStatus} style={miniActionFailureStatusStyle}>{`${burnLabel} Failed`}</div>;
  }

  return (
    <div
      className={styles.sbtItem}
      style={cardStyle}
      role="button"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={onCardKeyDown}
    >
      <div className={styles.iconOverlay}>
        {shouldRenderLiveIndicator && (
          <div className={styles.liveIndicator} id={mintStatusId} aria-label={`${mintingLabel} Live`}></div>
        )}
        {shouldRenderEndedIndicator && (
          <div className={styles.endedIndicator} id={mintStatusId} aria-label={`${mintingLabel} Ended`}></div>
        )}
        <CETooltip
          placement="top"
          target={mintStatusId}
          trigger="hover focus click"
          className={styles.tooltipBubble}
          innerClassName={styles.tooltipInner}
        >
          {isMintingActive ? `${mintingLabel} Live` : `${mintingLabel} Ended`}
        </CETooltip>
        {showLockIcon && (
          <FontAwesomeIcon icon={faLock} className={styles.lockIcon} />
        )}
      </div>
      <div
        className={styles.miniImageContainer}
        data-featured-card-ignore-nav="true"
      >
        <img
          src={imageUrl}
          alt={sbtName}
          className={styles.sbtImage}
          data-testid={E2E_TESTIDS.SBT_PAGE_IMAGE}
          onError={onImageError}
        />
      </div>
      <p className={styles.miniSbtName}>{sbtName}</p>
      {showMiniSbtAddress ? (
        <p className={styles.miniSbtAddress}>{getShortenedAddress(sbtAddress, false)}</p>
      ) : null}
      {miniMintArea}
    </div>
  );
};

export default SbtPageMiniCard;
