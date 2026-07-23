import React from 'react';
import { toStr } from '../../utilities/shared/primitives.js';
import styles from './AdminPage.module.scss';
import { buildAdminChainRegistryDisplay, shortAddress } from './adminPageSessionDisplayHelpers';

type AdminPageSessionMetadataSummaryProps = {
  groupMetadata: Record<string, any>;
  isWorkerCanonical: boolean;
  workerUrl: string;
  allowedOriginCount: number;
  allowedOriginsReported: boolean;
  metadataSlugDisplay: string;
  metadataSessionUrl: string;
  metadataAdminAddress: string;
  metadataAdminUrl: string;
  metadataUriValue: string;
  metadataUriUrl: string;
  metadataLoadStateLabel: string;
};

const AdminPageSessionMetadataSummary = ({
  groupMetadata,
  isWorkerCanonical,
  workerUrl,
  allowedOriginCount,
  allowedOriginsReported,
  metadataSlugDisplay,
  metadataSessionUrl,
  metadataAdminAddress,
  metadataAdminUrl,
  metadataUriValue,
  metadataUriUrl,
  metadataLoadStateLabel,
}: AdminPageSessionMetadataSummaryProps): React.ReactElement => (
  <div className={styles.metadataGrid}>
    <div className={styles.metadataItem}>
      <span>Slug</span>
      <span>
        {metadataSessionUrl ? (
          <a href={metadataSessionUrl} target="_blank" rel="noreferrer" className={styles.metadataLink}>
            {metadataSlugDisplay}
          </a>
        ) : (
          metadataSlugDisplay
        )}
      </span>
    </div>
    <div className={styles.metadataItem}>
      <span>Session name</span>
      <span>{toStr(groupMetadata.sessionName || '').trim() || '—'}</span>
    </div>
    {isWorkerCanonical ? (
      <>
        <div className={styles.metadataItem} data-testid="ce-admin-worker-authority">
          <span>Authority</span>
          <span>Cloudflare Session Worker</span>
        </div>
        <div className={styles.metadataItem}>
          <span>Worker URL</span>
          <span>{workerUrl || '—'}</span>
        </div>
        <div className={styles.metadataItem}>
          <span>Canonical config</span>
          <span>
            {toStr(groupMetadata.configRevision || groupMetadata.workerCanonicalPublicationRevision).trim() ||
              'Readback loaded'}
          </span>
        </div>
        <div className={styles.metadataItem}>
          <span>Allowed origins / CORS</span>
          <span>
            {!allowedOriginsReported
              ? 'Not reported'
              : allowedOriginCount
                ? `${allowedOriginCount} allowed origin${allowedOriginCount === 1 ? '' : 's'}`
                : 'Open CORS'}
          </span>
        </div>
        <div className={styles.metadataItem}>
          <span>Storage / encryption</span>
          <span>
            {toStr(groupMetadata.sessionModeProfile?.storage?.backend || 'cloudflare')} /{' '}
            {toStr(groupMetadata.sessionModeProfile?.encryption?.mode || 'none')}
          </span>
        </div>
      </>
    ) : (
      <div className={styles.metadataItem}>
        <span>Chain / Registry</span>
        <span>
          {buildAdminChainRegistryDisplay({
            chainId: groupMetadata.networkChainId || groupMetadata.__registry?.chainId || '',
            registryChainId: groupMetadata.__registry?.registryChainId || groupMetadata.registryChainId || '',
          })}
        </span>
      </div>
    )}
    <div className={styles.metadataItem}>
      <span>Admin</span>
      <span>
        {metadataAdminUrl ? (
          <a href={metadataAdminUrl} target="_blank" rel="noreferrer" className={styles.metadataLink}>
            {shortAddress(metadataAdminAddress) || metadataAdminAddress}
          </a>
        ) : (
          '—'
        )}
      </span>
    </div>
    {!isWorkerCanonical ? (
      <>
        <div className={styles.metadataItem}>
          <span>Metadata URI</span>
          <span>
            {metadataUriUrl ? (
              <a href={metadataUriUrl} target="_blank" rel="noreferrer" className={styles.metadataLink}>
                {metadataUriValue}
              </a>
            ) : (
              '—'
            )}
          </span>
        </div>
        <div className={styles.metadataItem}>
          <span>Metadata source</span>
          <span>{metadataLoadStateLabel}</span>
        </div>
      </>
    ) : null}
  </div>
);

export default AdminPageSessionMetadataSummary;
