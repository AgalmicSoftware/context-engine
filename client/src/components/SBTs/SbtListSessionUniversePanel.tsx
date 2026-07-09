import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp, faCog, faSpinner } from '@fortawesome/free-solid-svg-icons';

import SessionChipSelector from '../Shared/SessionChipSelector';
import styles from './SBTsList.module.scss';
import SbtListSessionUniverseSummary from './SbtListSessionUniverseSummary';
import { buildSbtListSessionUniversePanelClassName } from './sbtListDisplayHelpers';
import type { SbtListSessionSelectorOption } from './sbtListSessionSelectorDisplayHelpers';

type SbtListSessionUniversePanelChipLoadingStatus = {
  chipBlockProgressText?: string;
  progressText?: string;
};

type SbtListSessionUniversePanelProps = {
  buildSessionRouteHref: (slug: string) => string;
  canShowMoreSessions: boolean;
  chipLoadingStatusBySlug: Record<string, SbtListSessionUniversePanelChipLoadingStatus | null | undefined>;
  chipProgressVisibilityBySlug: Record<string, unknown>;
  hideSessionUniverseSummary: boolean;
  isOpen: boolean;
  isUniverseCollapsed: boolean;
  labelForSessionSlug: (slug: string) => React.ReactNode;
  onOpenSessionChip: (slug: string, optionOrEvent?: unknown, maybeEvent?: unknown) => void;
  onShowMoreSessions: () => unknown;
  onToggleSessionChip: (slug: string, option: unknown) => void;
  onToggleSessionSettings: () => unknown;
  onToggleUniverseCollapsed: () => unknown;
  remainingHiddenSessionCount: number;
  selectedSummarySlugs: string[];
  selectorPanelId: string;
  sessionSelectorOptions: SbtListSessionSelectorOption[];
  showMoreSessionsLoading: boolean;
  showUniverseSpinner: boolean;
  usesFallbackSessionSettingsToggle: boolean;
};

const SbtListSessionUniversePanel = ({
  buildSessionRouteHref,
  canShowMoreSessions,
  chipLoadingStatusBySlug,
  chipProgressVisibilityBySlug,
  hideSessionUniverseSummary,
  isOpen,
  isUniverseCollapsed,
  labelForSessionSlug,
  onOpenSessionChip,
  onShowMoreSessions,
  onToggleSessionChip,
  onToggleSessionSettings,
  onToggleUniverseCollapsed,
  remainingHiddenSessionCount,
  selectedSummarySlugs,
  selectorPanelId,
  sessionSelectorOptions,
  showMoreSessionsLoading,
  showUniverseSpinner,
  usesFallbackSessionSettingsToggle,
}: SbtListSessionUniversePanelProps): React.ReactElement => {
  const renderHeaderActions = (): React.ReactNode => (
    <div className={styles.sessionUniverseHeaderActions}>
      {showUniverseSpinner && (
        <FontAwesomeIcon
          icon={faSpinner}
          spin
          className={styles.sessionUniverseSpinner}
          data-testid="session-universe-spinner"
        />
      )}
      {usesFallbackSessionSettingsToggle && (
        <button
          type="button"
          className={styles.sessionUniverseSettingsButton}
          aria-label={isOpen ? 'Hide session selector' : 'Show session selector'}
          aria-controls={selectorPanelId}
          aria-expanded={isOpen}
          data-testid="session-selector-toggle"
          onClick={onToggleSessionSettings}
        >
          <FontAwesomeIcon icon={faCog} />
        </button>
      )}
      {isOpen && (
        <button
          type="button"
          className={styles.sessionUniverseToggle}
          aria-label={isUniverseCollapsed ? 'Expand session universe' : 'Collapse session universe'}
          aria-expanded={!isUniverseCollapsed}
          onClick={onToggleUniverseCollapsed}
        >
          <FontAwesomeIcon icon={isUniverseCollapsed ? faChevronDown : faChevronUp} />
          <span>{isUniverseCollapsed ? 'Expand' : 'Collapse'}</span>
        </button>
      )}
    </div>
  );

  const renderCollapsedSummary = (testId: string): React.ReactNode => (
    <SbtListSessionUniverseSummary
      testId={testId}
      summarySlugs={selectedSummarySlugs}
      chipProgressVisibilityBySlug={chipProgressVisibilityBySlug}
      chipLoadingStatusBySlug={chipLoadingStatusBySlug}
      labelForSessionSlug={labelForSessionSlug}
      buildSessionRouteHref={buildSessionRouteHref}
      onOpenSessionChip={onOpenSessionChip}
    />
  );

  if (!isOpen) {
    return (
      <div
        className={buildSbtListSessionUniversePanelClassName({
          baseClassName: styles.sessionUniversePanel,
          closedClassName: styles.sessionUniversePanelClosed,
          isClosed: true,
        })}
      >
        <div className={styles.sessionUniverseHeader}>
          <span>Sessions</span>
          {renderHeaderActions()}
        </div>
        {!hideSessionUniverseSummary && renderCollapsedSummary('session-selector-summary')}
      </div>
    );
  }

  return (
    <div className={styles.sessionUniversePanel} data-testid="session-selector-panel" id={selectorPanelId}>
      <div className={styles.sessionUniverseHeader}>
        <span>Sessions</span>
        {renderHeaderActions()}
      </div>
      {!hideSessionUniverseSummary &&
        isUniverseCollapsed &&
        renderCollapsedSummary('session-universe-collapsed-summary')}
      {!isUniverseCollapsed && (
        <div className={styles.sessionUniverseChips}>
          <SessionChipSelector
            options={sessionSelectorOptions}
            onToggle={onToggleSessionChip}
            onOpen={onOpenSessionChip}
          />
        </div>
      )}
      {!isUniverseCollapsed && canShowMoreSessions && (
        <div className={styles.sessionUniverseShowMoreRow}>
          <button
            type="button"
            className={styles.sessionUniverseShowMoreButton}
            onClick={onShowMoreSessions}
            disabled={showMoreSessionsLoading}
          >
            {showMoreSessionsLoading && (
              <FontAwesomeIcon icon={faSpinner} spin className={styles.sessionUniverseShowMoreSpinner} />
            )}
            Show More Sessions ({remainingHiddenSessionCount})
          </button>
        </div>
      )}
    </div>
  );
};

export default SbtListSessionUniversePanel;
