import React from 'react';
import { Button, Input } from 'reactstrap';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SessionWizard.module.scss';

type SponsoredBundleStatus = {
  message?: React.ReactNode;
  requiresKey?: boolean;
  retryable?: boolean;
  tone?: string;
};

type SessionWizardSponsoredStatusProps = {
  decryptionKey?: string;
  onDecryptionKeyChange?: (value: string) => void;
  onRetry: () => void;
  onSubmitDecryptionKey?: () => void;
  status?: SponsoredBundleStatus | null;
};

const getSponsoredBundleStatusToneClassName = (tone?: string): string => {
  if (tone === 'success') return styles.sponsoredBundleStatusSuccess;
  if (tone === 'error') return styles.sponsoredBundleStatusError;
  return styles.sponsoredBundleStatusInfo;
};

const SessionWizardSponsoredStatus = ({
  decryptionKey = '',
  onDecryptionKeyChange = () => undefined,
  onRetry,
  onSubmitDecryptionKey = () => undefined,
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
        {status.requiresKey ? (
          <form
            className={styles.copyFieldRow}
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitDecryptionKey();
            }}
          >
            <Input
              type="password"
              autoComplete="off"
              aria-label="Sponsored bundle decryption key"
              data-testid={E2E_TESTIDS.WIZARD_SPONSORED_KEY_INPUT}
              value={decryptionKey}
              onChange={(event) => onDecryptionKeyChange(event.target.value)}
            />
            <Button
              type="submit"
              size="sm"
              color="secondary"
              outline
              disabled={!decryptionKey.trim()}
              data-testid={E2E_TESTIDS.WIZARD_SPONSORED_KEY_APPLY}
            >
              Apply key
            </Button>
          </form>
        ) : null}
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
