import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';

import CETooltip from '../Shared/CETooltip';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import styles from './SBTPage.module.scss';

type SbtPageMiniCardDisplayProps = {
  imageUrl: string;
  isMintingActive?: boolean;
  mintStatusId: string;
  mintingLabel: string;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
  sbtAddress: string;
  sbtName: string;
  shouldRenderEndedIndicator?: boolean;
  shouldRenderLiveIndicator?: boolean;
  showLockIcon?: boolean;
  showMiniSbtAddress?: boolean;
};

const SbtPageMiniCardDisplay = ({
  imageUrl,
  isMintingActive = false,
  mintStatusId,
  mintingLabel,
  onImageError,
  sbtAddress,
  sbtName,
  shouldRenderEndedIndicator = false,
  shouldRenderLiveIndicator = false,
  showLockIcon = false,
  showMiniSbtAddress = false,
}: SbtPageMiniCardDisplayProps): React.ReactElement => (
  <>
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
      {showLockIcon && <FontAwesomeIcon icon={faLock} className={styles.lockIcon} />}
    </div>
    <div className={styles.miniImageContainer} data-featured-card-ignore-nav="true">
      <img
        src={imageUrl}
        alt={sbtName}
        className={styles.sbtImage}
        data-testid={E2E_TESTIDS.SBT_PAGE_IMAGE}
        onError={onImageError}
      />
    </div>
    <p className={styles.miniSbtName}>{sbtName}</p>
    {showMiniSbtAddress ? <p className={styles.miniSbtAddress}>{getShortenedAddress(sbtAddress, false)}</p> : null}
  </>
);

export default SbtPageMiniCardDisplay;
