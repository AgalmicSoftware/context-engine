import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard } from '@fortawesome/free-solid-svg-icons';
import { Input } from 'reactstrap';
import { adminArweavePort } from '../../domains/storage/adminArweavePorts.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from '../Admin/AdminPage.module.scss';

type SponsorHandoffResultProps = {
  shareKey: string;
  shareTxId: string;
  shareUrl: string;
  onCopy: (value: unknown, successLabel: string) => unknown;
};

const resolveShareTxUrl = (shareTxId: string): string => {
  if (!shareTxId) return '';
  const normalized = adminArweavePort.normalizeArweaveUrl(shareTxId);
  return normalized === shareTxId ? `https://ar-io.dev/${shareTxId}` : normalized;
};

const CopyButton = ({ ariaLabel, onClick, title }: { ariaLabel: string; onClick: () => unknown; title: string }) => (
  <button
    type="button"
    className={`${styles.heroCardInputActionButton} ${styles.heroCardInputIconButton}`}
    onClick={onClick}
    title={title}
    aria-label={ariaLabel}
  >
    <FontAwesomeIcon icon={faClipboard} />
  </button>
);

export const SponsorHandoffResult = ({ shareKey, shareTxId, shareUrl, onCopy }: SponsorHandoffResultProps) => {
  if (!shareUrl) return null;
  const shareTxUrl = resolveShareTxUrl(shareTxId);
  return (
    <>
      <div className={styles.heroCardInputShell}>
        <Input
          value={shareUrl}
          readOnly
          className={styles.heroCardInput}
          aria-label="Sponsored share URL"
          data-testid={E2E_TESTIDS.SPONSOR_SHARE_URL}
        />
        <div className={styles.heroCardInputActions}>
          <CopyButton
            onClick={() => onCopy(shareUrl, 'Copied sponsored URL')}
            title="Copy sponsored URL"
            ariaLabel="Copy sponsored URL"
          />
        </div>
      </div>
      <div className={styles.heroCardInputShell}>
        <Input
          value={shareKey}
          type="password"
          readOnly
          autoComplete="off"
          className={styles.heroCardInput}
          aria-label="Sponsored decryption key"
          data-testid={E2E_TESTIDS.SPONSOR_SHARE_KEY}
        />
        <div className={styles.heroCardInputActions}>
          <CopyButton
            onClick={() => onCopy(shareKey, 'Copied sponsored decryption key')}
            title="Copy sponsored decryption key"
            ariaLabel="Copy sponsored decryption key"
          />
        </div>
      </div>
      <div className={styles.panelHint}>
        Send this key through a separate channel. The recipient enters it after opening the sponsored URL.
      </div>
      {shareTxId ? (
        <div className={styles.statusNote} data-testid={E2E_TESTIDS.SPONSOR_TX_ID}>
          Arweave tx:{' '}
          <a href={shareTxUrl} target="_blank" rel="noreferrer">
            {shareTxId}
          </a>
        </div>
      ) : null}
    </>
  );
};
