import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import styles from './SBTsList.module.scss';

export const SbtListSectionTitle = ({
  label,
  showSpinner = false,
  spinnerId,
}: {
  label: React.ReactNode;
  showSpinner?: boolean;
  spinnerId: string;
}): React.ReactElement => (
  <div className={styles.sectionTitleRow}>
    <h2 className={styles.sectionTitle}>{label}</h2>
    {showSpinner && (
      <FontAwesomeIcon
        icon={faSpinner}
        spin
        className={styles.sectionCornerSpinner}
        data-testid={spinnerId}
      />
    )}
  </div>
);

export const SbtListSectionLoadingHint = ({
  allSessionsMode = false,
  blocksLeft = null,
}: {
  allSessionsMode?: boolean;
  blocksLeft?: number | null;
}): React.ReactElement => (
  <div className={styles.sectionLoadingHint}>
    <span>Loading…</span>
    {!allSessionsMode && typeof blocksLeft === 'number' && (
      <span className={styles.sectionLoadingBlocks}>Blocks left: {blocksLeft}</span>
    )}
  </div>
);
