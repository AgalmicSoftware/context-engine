import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCopy, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SBTPage.module.scss';

type SbtPageCopyIconState = {
  shouldRenderCopiedIcon?: boolean;
  shouldRenderDefaultIcon?: boolean;
};

type SbtPageOpenMintUrlCardProps = {
  copyIconState: SbtPageCopyIconState;
  onCopy: React.MouseEventHandler<HTMLButtonElement>;
  openMintAutoJoinUrl: string;
};

const SbtPageOpenMintUrlCard = ({
  copyIconState,
  onCopy,
  openMintAutoJoinUrl,
}: SbtPageOpenMintUrlCardProps): React.ReactElement => (
  <div className={styles.autoMintUrlCard} data-testid={E2E_TESTIDS.SBT_PAGE_OPEN_MINT_URL}>
    <h4>URL Where Anyone Can Join</h4>
    <p className={styles.autoMintUrlHelp}>Share this session link to trigger the open-mint flow for this group.</p>
    <div className={styles.autoMintUrlRow}>
      <span className={styles.autoMintUrlText} title={openMintAutoJoinUrl}>
        {openMintAutoJoinUrl}
      </span>
      <button
        type="button"
        className={styles.autoMintUrlButton}
        onClick={onCopy}
        aria-label="Copy open mint URL"
        title="Copy open mint URL"
      >
        {copyIconState.shouldRenderCopiedIcon && <FontAwesomeIcon icon={faCheck} />}
        {copyIconState.shouldRenderDefaultIcon && <FontAwesomeIcon icon={faCopy} />}
      </button>
      <a
        href={openMintAutoJoinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.autoMintUrlButton}
        aria-label="Open open mint URL"
        title="Open open mint URL"
      >
        <FontAwesomeIcon icon={faExternalLinkAlt} />
      </a>
    </div>
  </div>
);

export default SbtPageOpenMintUrlCard;
