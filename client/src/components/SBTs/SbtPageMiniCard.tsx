import React from 'react';

import styles from './SBTPage.module.scss';
import SbtPageMiniActionArea, { type SbtPageMiniActionAreaProps } from './SbtPageMiniActionArea';
import SbtPageMiniCardDisplay from './SbtPageMiniCardDisplay';

type SbtPageMiniCardProps = SbtPageMiniActionAreaProps & {
  cardStyle?: React.CSSProperties;
  imageUrl: string;
  isMintingActive?: boolean;
  mintStatusId: string;
  mintingLabel: string;
  onCardClick: React.MouseEventHandler<HTMLDivElement>;
  onCardKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
  sbtAddress: string;
  sbtName: string;
  shouldRenderEndedIndicator?: boolean;
  shouldRenderLiveIndicator?: boolean;
  showLockIcon?: boolean;
  showMiniSbtAddress?: boolean;
};

const SbtPageMiniCard = ({
  burnLabel,
  burnedLabel,
  cardStyle,
  groupPasswordInput = '',
  hasTokenMini = false,
  imageUrl,
  isMintingActive = false,
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
