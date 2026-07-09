import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faSpinner } from '@fortawesome/free-solid-svg-icons';

import styles from './SurveyResults.module.scss';
import { t } from '../../utilities/ui/terminology.js';

type LockedGateDetail = {
  address: string;
  href: string;
  label: React.ReactNode;
};

type LockedResponsesModel = {
  gateDetails?: LockedGateDetail[];
  hasGenericGateMessage?: boolean;
  lockedCount?: number;
};

export const SurveyResultsLockedResponsesToggle = ({
  isOpen = false,
  lockedModel = null,
  onToggleDetails,
}: {
  isOpen?: boolean;
  lockedModel?: LockedResponsesModel | null;
  onToggleDetails?: () => void;
}): React.ReactNode => {
  const lockedCount = Number(lockedModel?.lockedCount || 0);
  if (lockedCount <= 0) return null;

  const lockedLabel = `${lockedCount} locked response${lockedCount === 1 ? '' : 's'}`;

  return (
    <button
      type="button"
      className={[styles.lockedSummaryToggle, isOpen ? styles.lockedSummaryToggleOpen : ''].filter(Boolean).join(' ')}
      onClick={onToggleDetails}
      aria-expanded={isOpen}
      aria-controls="ce-results-locked-details"
      aria-label={`${isOpen ? 'Hide' : 'Show'} ${lockedLabel}`}
      title={lockedLabel}
      data-testid="ce-results-locked-toggle"
    >
      <span className={styles.lockedSummaryCount}>{lockedCount}</span>
      <FontAwesomeIcon icon={faLock} className={styles.lockedSummaryIcon} />
    </button>
  );
};

export const SurveyResultsLockedResponsesBanner = ({
  decrypting = false,
  isOpen = false,
  lockedModel = null,
  onDecrypt,
}: {
  decrypting?: boolean;
  isOpen?: boolean;
  lockedModel?: LockedResponsesModel | null;
  onDecrypt?: () => void;
}): React.ReactNode => {
  const lockedCount = Number(lockedModel?.lockedCount || 0);
  if (lockedCount <= 0) return null;

  const gateDetails = Array.isArray(lockedModel?.gateDetails) ? lockedModel.gateDetails : [];
  if (!isOpen) return null;

  return (
    <div id="ce-results-locked-details" className={styles.lockedBanner} data-testid="ce-results-locked-banner">
      <div className={styles.lockedBannerTop}>
        <div className={styles.lockedBannerCopy}>
          <div className={styles.lockedBannerTitleRow}>
            <FontAwesomeIcon icon={faLock} className={styles.lockedBannerIcon} />
            <h3 className={styles.lockedBannerHeadline}>{lockedCount} Locked Responses</h3>
          </div>
          <p className={styles.lockedBannerSubtext}>Encrypted responses are present in this result set.</p>
        </div>
        <Button
          type="button"
          className={styles.lockedBannerDecryptButton}
          onClick={onDecrypt}
          data-testid="ce-results-decrypt-btn"
          disabled={decrypting}
        >
          {decrypting && <FontAwesomeIcon icon={faSpinner} spin className={styles.lockedBannerButtonSpinner} />}
          Decrypt
        </Button>
      </div>

      <div className={styles.lockedBannerDetails}>
        {gateDetails.length > 0 && (
          <>
            <p className={styles.lockedBannerGateIntro}>
              {`Required ${gateDetails.length === 1 ? t('sbt') : t('sbts')} for decryption`}
            </p>
            <div className={styles.lockedBannerGateList}>
              {gateDetails.map((detail) => (
                <a
                  key={detail.address}
                  href={detail.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.lockedBannerGateLink}
                >
                  {detail.label}
                </a>
              ))}
            </div>
          </>
        )}
        {lockedModel?.hasGenericGateMessage && gateDetails.length === 0 && (
          <p className={styles.lockedBannerGenericMessage}>
            {`Locked responses require an eligible ${t('sbtLower')}. Connect an eligible ${t('walletLower')} to decrypt.`}
          </p>
        )}
      </div>
    </div>
  );
};
