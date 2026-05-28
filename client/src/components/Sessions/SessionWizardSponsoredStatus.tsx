import React from 'react';
import { Button } from 'reactstrap';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SessionWizard.module.scss';

type SponsoredBundleStatus = {
  message?: React.ReactNode;
  retryable?: boolean;
  tone?: string;
};

type SessionWizardSponsoredStatusProps = {
  onRetry: () => void;
  status?: SponsoredBundleStatus | null;
};

const getSponsoredBundleStatusToneClassName = (tone?: string): string => {
  if (tone === 'success') return styles.sponsoredBundleStatusSuccess;
  if (tone === 'error') return styles.sponsoredBundleStatusError;
  return styles.sponsoredBundleStatusInfo;
};

const SessionWizardSponsoredStatus = ({
  onRetry,
  status = null,
}: SessionWizardSponsoredStatusProps): React.ReactElement | null => {
  if (!status) return null;

  return (
    <div
      className={`${styles.statusNote} ${styles.sponsoredBundleStatus} ${getSponsoredBundleStatusToneClassName(status.tone)}`}
      data-testid={E2E_TESTIDS.WIZARD_SPONSORED_STATUS}
    >
      <div className={styles.sponsoredBundleStatusContent}>
        <span>{status.message}</span>
        {status.retryable ? (
          <Button
            type="button"
            size="sm"
            color="secondary"
            outline
            className={styles.sponsoredBundleRetryButton}
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export { getSponsoredBundleStatusToneClassName };
export default SessionWizardSponsoredStatus;
