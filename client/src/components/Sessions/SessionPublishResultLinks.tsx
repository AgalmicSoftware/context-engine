import React from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import type { SessionWizardPublishMetadataDisplayState } from './sessionWizardPublishReadiness';
import type { PublishedPendingSbtLink } from './sessionWizardPublishLinks';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

type RegisterTxEntry = {
  hash: string;
  action: string;
};

type SessionPublishResultLinksProps = {
  adminUrl: string;
  adminUrlStatus: string;
  onCopyAdminUrl: () => void;
  publishMetadataDisplayState: SessionWizardPublishMetadataDisplayState;
  publishedPendingSbtLinks: PublishedPendingSbtLink[];
  registerExplorerBaseUrl: string;
  registerTxs: RegisterTxEntry[];
  sessionUrl: string;
  status: string;
};

const SessionPublishResultLinks = ({
  adminUrl,
  adminUrlStatus,
  onCopyAdminUrl,
  publishMetadataDisplayState,
  publishedPendingSbtLinks,
  registerExplorerBaseUrl,
  registerTxs,
  sessionUrl,
  status,
}: SessionPublishResultLinksProps): React.ReactElement => (
  <>
    {publishMetadataDisplayState.showMetadataUri ? (
      <div className={styles.linkRow}>
        <span className={styles.linkLabel}>{publishMetadataDisplayState.metadataUriLabel}:</span>
        <span data-testid={E2E_TESTIDS.WIZARD_METADATA_URI}>{publishMetadataDisplayState.metadataUri}</span>
      </div>
    ) : null}
    {publishMetadataDisplayState.showManualMetadataUri ? (
      <div className={styles.linkRow}>
        <span className={styles.linkLabel}>Manual metadata URI:</span>
        <span>{publishMetadataDisplayState.manualMetadataDisplayUri}</span>
      </div>
    ) : null}
    {publishMetadataDisplayState.showArweaveTx ? (
      <div className={styles.linkRow}>
        <span className={styles.linkLabel}>Arweave tx:</span>
        <a href={publishMetadataDisplayState.effectiveMetadataGatewayUrl} target="_blank" rel="noopener noreferrer">
          {publishMetadataDisplayState.effectiveMetadataGatewayUrl}
        </a>
      </div>
    ) : null}
    {registerTxs.length > 0 ? (
      <div>
        <div className={styles.linkRow}>
          <span className={styles.linkLabel}>Register txs:</span>
          <span>{registerTxs.length}</span>
        </div>
        {registerTxs.map((entry) => {
          const txUrl = registerExplorerBaseUrl ? `${registerExplorerBaseUrl}/tx/${entry.hash}` : '';
          return (
            <div
              key={entry.hash}
              className={styles.linkRow}
              data-testid={E2E_TESTIDS.WIZARD_REGISTER_TX}
              data-ce-tx-hash={entry.hash}
              data-ce-tx-action={entry.action}
            >
              <span className={styles.linkLabel}>{entry.action}:</span>
              {txUrl ? (
                <a href={txUrl} target="_blank" rel="noopener noreferrer">
                  {txUrl}
                </a>
              ) : (
                <span>{entry.hash}</span>
              )}
            </div>
          );
        })}
      </div>
    ) : null}
    {sessionUrl ? (
      <div className={styles.linkRow}>
        <span className={styles.linkLabel}>Session URL:</span>
        <a href={sessionUrl} target="_blank" rel="noopener noreferrer">
          {sessionUrl}
        </a>
      </div>
    ) : null}
    {adminUrl ? (
      <div className={styles.linkRow}>
        <span className={styles.linkLabel}>Admin URL:</span>
        <a href={adminUrl} target="_blank" rel="noopener noreferrer" data-testid={E2E_TESTIDS.WIZARD_ADMIN_URL}>
          {adminUrl}
        </a>
        <Button type="button" size="sm" className={styles.actionButton} onClick={onCopyAdminUrl}>
          <FontAwesomeIcon icon={faCopy} /> Copy
        </Button>
      </div>
    ) : null}
    {publishedPendingSbtLinks.map((entry) => (
      <div
        key={entry.address}
        className={styles.linkRow}
        data-testid="ce-wizard-published-sbt-link"
        data-ce-sbt-address={entry.address}
      >
        <span className={styles.linkLabel}>SBT:</span>
        <a href={entry.href} target="_blank" rel="noopener noreferrer">
          {entry.label}
        </a>
      </div>
    ))}
    {adminUrlStatus ? <div className={styles.copyStatus}>{adminUrlStatus}</div> : null}
    {status ? <div className={styles.statusNote}>{status}</div> : null}
  </>
);

export default SessionPublishResultLinks;
