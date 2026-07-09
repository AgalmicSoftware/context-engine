import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookmark, faCheck, faCopy, faExpand, faExternalLinkAlt, faLock } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SBTPage.module.scss';

type SbtPageCopyIconState = {
  shouldRenderCopiedIcon?: boolean;
  shouldRenderDefaultIcon?: boolean;
};

type SbtPageIdentityPanelProps = {
  addressDisplay: React.ReactNode;
  bookmarkIconStyle?: React.CSSProperties;
  contractCopyIconState: SbtPageCopyIconState;
  descriptionLockIconStyle?: React.CSSProperties;
  descriptionText?: string;
  explorerUrl: string;
  imageAlt: string;
  imageUrl: string;
  nameText: string;
  onBookmark: React.MouseEventHandler<HTMLButtonElement>;
  onContractCopy: React.MouseEventHandler<HTMLButtonElement>;
  onImageError?: React.ReactEventHandler<HTMLImageElement>;
  onImageOpen: React.MouseEventHandler<HTMLDivElement>;
  showDescriptionLockIcon?: boolean;
  tokenUriHref?: string;
};

const SbtPageIdentityPanel = ({
  addressDisplay,
  bookmarkIconStyle,
  contractCopyIconState,
  descriptionLockIconStyle,
  descriptionText = '',
  explorerUrl,
  imageAlt,
  imageUrl,
  nameText,
  onBookmark,
  onContractCopy,
  onImageError,
  onImageOpen,
  showDescriptionLockIcon = false,
  tokenUriHref = '',
}: SbtPageIdentityPanelProps): React.ReactElement => (
  <div className={styles.leftColumn}>
    <div className={styles.bookmarkIcon}>
      <button onClick={onBookmark} className={styles.bookmarkButton} style={bookmarkIconStyle}>
        <FontAwesomeIcon icon={faBookmark} />
      </button>
      <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className={styles.contractLink}>
        {addressDisplay}
      </a>
      <button onClick={onContractCopy} className={styles.copyButton}>
        {contractCopyIconState.shouldRenderCopiedIcon && <FontAwesomeIcon icon={faCheck} />}
        {contractCopyIconState.shouldRenderDefaultIcon && <FontAwesomeIcon icon={faCopy} />}
      </button>
      {tokenUriHref && (
        <a
          href={tokenUriHref}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.copyButton}
          title="Open token metadata"
        >
          <FontAwesomeIcon icon={faExternalLinkAlt} />
        </a>
      )}
    </div>
    <div className={styles.image}>
      <div className={styles.imageWrapper} onClick={onImageOpen}>
        <img src={imageUrl} alt={imageAlt} data-testid={E2E_TESTIDS.SBT_PAGE_IMAGE} onError={onImageError} />
        <div className={styles.expandOverlay}>
          <FontAwesomeIcon icon={faExpand} />
        </div>
      </div>
    </div>
    <div className={styles.description}>
      <h1 data-testid={E2E_TESTIDS.SBT_PAGE_NAME}>{nameText}</h1>
      {descriptionText ? (
        <p data-testid={E2E_TESTIDS.SBT_PAGE_DESCRIPTION}>
          {showDescriptionLockIcon ? <FontAwesomeIcon icon={faLock} style={descriptionLockIconStyle} /> : null}
          {descriptionText}
        </p>
      ) : null}
    </div>
  </div>
);

export default SbtPageIdentityPanel;
