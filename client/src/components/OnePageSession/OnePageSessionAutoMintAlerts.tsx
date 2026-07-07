import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faImage, faQuestionCircle, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';
import { Alert } from 'reactstrap';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import styles from './OnePageSession.module.scss';

type UnknownRecord = Record<string, unknown>;

type AutoMintTarget = {
  sbt?: unknown;
};

type AutoMintStatusValue = {
  error?: React.ReactNode;
  name?: React.ReactNode;
  status?: unknown;
};

export type OnePageSessionAutoMintAlertsProps = {
  autoMintCountdown: number | null;
  autoMintStatuses: Record<string, AutoMintStatusValue>;
  autoMintTargets: AutoMintTarget[];
  basePath: string;
  dismissedLoginBanner: boolean;
  dismissedStatusItems: UnknownRecord;
  effectiveSlug: string;
  expandedImages: UnknownRecord;
  needsLoginForAutoMint: boolean;
  sbtImages: Record<string, string>;
  sbtNames: Record<string, React.ReactNode>;
  onCancelAutoMintCountdown: () => void;
  onDismissLoginBanner: () => void;
  onDismissStatusItem: (addrKey: string) => void;
  onKickoffAutoMintIfNeeded: () => void;
  onToggleStatusImagePreview: (addrKey: string) => void;
};

const statusKey = (addrKey: string): string => (addrKey || '').toLowerCase();

const resolveFirstTargetName = ({
  autoMintTargets,
  sbtNames,
}: {
  autoMintTargets: AutoMintTarget[];
  sbtNames: Record<string, React.ReactNode>;
}): React.ReactNode => {
  const firstTargetAddrLower =
    autoMintTargets && autoMintTargets[0] && autoMintTargets[0].sbt ? String(autoMintTargets[0].sbt).toLowerCase() : '';
  return firstTargetAddrLower ? sbtNames[firstTargetAddrLower] : null;
};

const isTerminalAutoMintError = (error: React.ReactNode): boolean =>
  !!error &&
  /max(imum)?\s*(tokens?\s*)?mint|supply\s*exhaust|mint.*expir|period.*end|group\s*limit/i.test(String(error));

const renderStatusIcon = (status: string): React.ReactNode => {
  if (status === 'pending') return <FontAwesomeIcon icon={faSpinner} spin />;
  if (status === 'success') return <FontAwesomeIcon icon={faCheck} />;
  if (status === 'failed') return <FontAwesomeIcon icon={faTimes} />;
  return <FontAwesomeIcon icon={faQuestionCircle} />;
};

const OnePageSessionAutoMintAlerts = ({
  autoMintCountdown,
  autoMintStatuses,
  autoMintTargets,
  basePath,
  dismissedLoginBanner,
  dismissedStatusItems,
  effectiveSlug,
  expandedImages,
  needsLoginForAutoMint,
  sbtImages,
  sbtNames,
  onCancelAutoMintCountdown,
  onDismissLoginBanner,
  onDismissStatusItem,
  onKickoffAutoMintIfNeeded,
  onToggleStatusImagePreview,
}: OnePageSessionAutoMintAlertsProps) => {
  const alertCloseClass = styles.alertCloseButton || 'sbt-alert-close-btn';
  const firstTargetName = resolveFirstTargetName({ autoMintTargets, sbtNames });
  const statusEntries = Object.entries(autoMintStatuses || {});

  return (
    <>
      {needsLoginForAutoMint && (
        <Alert
          color="warning"
          className={styles.sbtMintStatusItem}
          data-testid={E2E_TESTIDS.SESSION_AUTO_MINT_LOGIN_BANNER}
          style={{
            position: 'sticky',
            top: 0,
            marginBottom: '12px',
            fontWeight: '600',
            fontSize: '1.5em',
          }}
          isOpen={!dismissedLoginBanner}
          fade={false}
          toggle={onDismissLoginBanner}
          closeClassName={alertCloseClass}
        >
          {`Login to Join ${t('sbt')}:`}&nbsp;
          {firstTargetName ? (
            firstTargetName
          ) : (
            <FontAwesomeIcon icon={faSpinner} spin aria-label="loading group name" />
          )}
        </Alert>
      )}

      {autoMintCountdown !== null && (
        <Alert
          color="info"
          className={styles.sbtMintStatusItem}
          isOpen={true}
          fade={false}
          data-testid={E2E_TESTIDS.SESSION_AUTO_MINT_COUNTDOWN}
          style={{ fontSize: '1.15rem', fontWeight: 600 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
              Joining group in {autoMintCountdown}...
            </span>
            <button
              className="btn btn-outline-light"
              style={{ padding: '4px 16px', cursor: 'pointer', marginLeft: '12px', fontSize: '1rem' }}
              onClick={onCancelAutoMintCountdown}
            >
              Cancel
            </button>
          </div>
        </Alert>
      )}

      {statusEntries.length > 0 && (
        <div className={styles.sbtMintBannerContainer}>
          {statusEntries.map(([addrKey, statusValue]) => {
            const key = statusKey(addrKey);
            const status = String(statusValue.status || '')
              .trim()
              .toLowerCase();
            const color =
              status === 'success'
                ? 'success'
                : status === 'failed'
                  ? 'danger'
                  : status === 'skipped'
                    ? 'secondary'
                    : 'info';
            const isOpen = !dismissedStatusItems[key];
            const isExpanded = !!expandedImages[key];
            const sbtImage = sbtImages[key];
            const isTerminalError = isTerminalAutoMintError(statusValue.error);
            const statusIcon = renderStatusIcon(status);

            return (
              <Alert
                key={addrKey}
                color={color}
                className={styles.sbtMintStatusItem}
                isOpen={isOpen}
                fade={false}
                data-testid={E2E_TESTIDS.SESSION_AUTO_MINT_STATUS}
                data-ce-sbt-address={key || undefined}
                data-ce-status={status || undefined}
                toggle={() => onDismissStatusItem(addrKey)}
                closeClassName={alertCloseClass}
                style={{ fontSize: '1.15rem', fontWeight: 600 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {statusIcon}
                    <span>
                      <a
                        href={`${basePath}${buildSbtDetailPath(addrKey, effectiveSlug)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: 'underline', color: 'inherit' }}
                      >
                        {statusValue.name || addrKey}
                      </a>
                    </span>
                    {sbtImage && (
                      <button
                        onClick={() => onToggleStatusImagePreview(addrKey)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          opacity: 0.7,
                          marginLeft: '5px',
                          padding: '0 5px',
                        }}
                        title={isExpanded ? 'Hide Preview' : 'Show Preview'}
                      >
                        {sbtImage ? (
                          <img
                            src={sbtImage}
                            alt={t('sbt')}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            style={{
                              height: '24px',
                              width: '24px',
                              borderRadius: '4px',
                              objectFit: 'cover',
                              verticalAlign: 'middle',
                            }}
                          />
                        ) : (
                          <FontAwesomeIcon icon={faImage} />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {statusValue.error && (
                  <div style={{ fontSize: '0.9em', marginTop: '4px', marginLeft: '26px', fontWeight: 400 }}>
                    {statusValue.error}
                  </div>
                )}

                {status === 'failed' && !isTerminalError && (
                  <div style={{ marginTop: '6px', marginLeft: '26px' }}>
                    <button
                      className="btn btn-sm btn-outline-dark"
                      style={{ padding: '2px 10px', border: '1px solid rgba(0,0,0,0.2)', cursor: 'pointer' }}
                      onClick={onKickoffAutoMintIfNeeded}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {isExpanded && sbtImage && (
                  <div style={{ marginTop: '10px', marginLeft: '26px' }}>
                    <img
                      src={sbtImage}
                      alt={`${t('sbt')} Preview`}
                      style={{ maxHeight: '100px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)' }}
                    />
                  </div>
                )}
              </Alert>
            );
          })}
        </div>
      )}
    </>
  );
};

export default OnePageSessionAutoMintAlerts;
