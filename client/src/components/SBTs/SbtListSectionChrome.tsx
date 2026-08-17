import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import styles from './SBTsList.module.scss';
import {
  buildSbtListLoadingGroupStatusClassName,
  buildSbtListLoadingProgressFillClassName,
  resolveSbtListLoadingProgressFillStyle,
} from './sbtListHelpers';

type SbtListInitialLoaderStatus = {
  displayName: string;
  hasLatest: boolean;
  progressPct: number;
  progressText: string;
  scanInProgress: boolean;
  slug: string;
  statusLabel: string;
};

export const SbtListInitialLoader = ({
  loadingLabel,
  loadingSessionStatuses = [],
}: {
  loadingLabel: string;
  loadingSessionStatuses?: SbtListInitialLoaderStatus[];
}): React.ReactElement => (
  <div className={styles.initialLoader}>
    <div className={styles.loadingHeader}>
      <FontAwesomeIcon icon={faSpinner} spin className={styles.loadingSpinner} />
      <div className={styles.loadingTitle}>{loadingLabel}</div>
    </div>
    {loadingSessionStatuses.length > 0 && (
      <div className={styles.loadingGroupList}>
        {loadingSessionStatuses.map((group) => (
          <div key={group.slug} className={styles.loadingGroupRow}>
            <div className={styles.loadingGroupHeader}>
              <span className={styles.loadingGroupName}>{group.displayName}</span>
              <span
                className={buildSbtListLoadingGroupStatusClassName({
                  activeClassName: styles.loadingStatusActive,
                  baseClassName: styles.loadingGroupStatus,
                  pendingClassName: styles.loadingStatusPending,
                  scanInProgress: group.scanInProgress,
                })}
              >
                {group.statusLabel}
              </span>
            </div>
            <div className={styles.loadingGroupMeta}>
              {group.progressText}
              {!group.hasLatest && <FontAwesomeIcon icon={faSpinner} spin className={styles.loadingGroupSpinner} />}
            </div>
            <div
              className={styles.loadingProgressBar}
              role="progressbar"
              aria-valuenow={group.hasLatest ? group.progressPct : 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={buildSbtListLoadingProgressFillClassName({
                  baseClassName: styles.loadingProgressFill,
                  hasLatest: group.hasLatest,
                  indeterminateClassName: styles.loadingProgressIndeterminate,
                })}
                style={resolveSbtListLoadingProgressFillStyle({
                  hasLatest: group.hasLatest,
                  progressPct: group.progressPct,
                })}
              />
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

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
      <FontAwesomeIcon icon={faSpinner} spin className={styles.sectionCornerSpinner} data-testid={spinnerId} />
    )}
  </div>
);

export const SbtListSectionBody = ({
  children,
  emptyLabel,
  hasItems = false,
  loadingHint = null,
  wrapClassName = '',
}: {
  children?: React.ReactNode;
  emptyLabel: React.ReactNode;
  hasItems?: boolean;
  loadingHint?: React.ReactNode;
  wrapClassName?: string;
}): React.ReactElement => {
  if (hasItems) {
    const content = <>{children}</>;
    return wrapClassName ? <div className={wrapClassName}>{content}</div> : content;
  }
  if (loadingHint) return <>{loadingHint}</>;
  return <div className={styles.sectionEmptyHint}>{emptyLabel}</div>;
};

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
