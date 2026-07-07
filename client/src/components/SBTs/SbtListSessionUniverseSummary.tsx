import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';

import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import styles from './SBTsList.module.scss';

type ChipLoadingStatus = {
  progressText?: string;
  chipBlockProgressText?: string;
};

type SbtListSessionUniverseSummaryProps = {
  testId: string;
  summarySlugs?: string[];
  chipProgressVisibilityBySlug?: Record<string, unknown>;
  chipLoadingStatusBySlug?: Record<string, ChipLoadingStatus | null | undefined>;
  labelForSessionSlug: (slug: string) => React.ReactNode;
  buildSessionRouteHref: (slug: string) => string;
  onOpenSessionChip: (slug: string, event: React.MouseEvent<HTMLButtonElement>) => void;
};

const SbtListSessionUniverseSummary = ({
  testId,
  summarySlugs = [],
  chipProgressVisibilityBySlug = {},
  chipLoadingStatusBySlug = {},
  labelForSessionSlug,
  buildSessionRouteHref,
  onOpenSessionChip,
}: SbtListSessionUniverseSummaryProps): React.ReactElement => {
  const previewSlugs = summarySlugs.slice(0, 4);
  const overflowCount = Math.max(0, summarySlugs.length - previewSlugs.length);

  return (
    <div className={styles.sessionUniverseCollapsedSummary} data-testid={testId}>
      <span className={styles.sessionUniverseCollapsedLabel}>Selected ({summarySlugs.length})</span>
      <div className={styles.sessionUniverseCollapsedChips}>
        {previewSlugs.map((slugRaw: string) => {
          const normalized = normalizeSessionSlug(slugRaw || '');
          const sessionLabel = labelForSessionSlug(normalized);
          const isLoading = !!chipProgressVisibilityBySlug[normalized];
          const chipLoadingStatus = chipLoadingStatusBySlug[normalized] || null;
          const showCollapsedProgress = chipLoadingStatus != null && isLoading;
          const sessionRouteHref = buildSessionRouteHref(normalized);
          const collapsedChipClass = [
            styles.sessionUniverseCollapsedChip,
            isLoading ? styles.sessionUniverseCollapsedChipLoading : styles.sessionUniverseCollapsedChipLoaded,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <span
              key={`collapsed-${normalized || 'general'}`}
              className={collapsedChipClass}
              data-testid={`session-collapsed-chip-${normalized || 'general'}`}
              data-session-loading={isLoading ? 'true' : 'false'}
              title={showCollapsedProgress ? chipLoadingStatus.progressText : undefined}
            >
              <span className={styles.sessionUniverseCollapsedChipBody}>
                <span className={styles.sessionUniverseCollapsedChipName}>{sessionLabel}</span>
                {showCollapsedProgress && (
                  <span
                    className={styles.sessionUniverseCollapsedChipProgress}
                    data-testid={`session-collapsed-chip-progress-${normalized || 'general'}`}
                  >
                    {chipLoadingStatus.chipBlockProgressText}
                  </span>
                )}
              </span>
              {sessionRouteHref && (
                <button
                  type="button"
                  className={styles.sessionUniverseCollapsedChipOpen}
                  data-testid={`session-collapsed-chip-open-${normalized || 'general'}`}
                  aria-label={`Open session ${sessionLabel} in new tab`}
                  title={`Open session ${sessionLabel} in new tab`}
                  onClick={(event) => onOpenSessionChip(normalized, event)}
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} />
                </button>
              )}
            </span>
          );
        })}
        {!previewSlugs.length && <span className={styles.sessionUniverseCollapsedOverflow}>No sessions selected</span>}
        {overflowCount > 0 && <span className={styles.sessionUniverseCollapsedOverflow}>+{overflowCount} more</span>}
      </div>
    </div>
  );
};

export default SbtListSessionUniverseSummary;
