import React from 'react';
import { Progress } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSyncAlt } from '@fortawesome/free-solid-svg-icons';

import styles from './SurveyResults.module.scss';
import SurveyResultsSyncDetailsDisplay from './SurveyResultsSyncDetailsDisplay';
import type { SurveyResultsSyncStatusDisplayPlan } from './surveyResultsSyncStatusController';

type SurveyResultsSyncStatusPanelArgs = {
  isSynced: boolean;
  isSyncingOrLoading: boolean;
  syncStatusText: string;
  showLongSyncNotice: boolean;
  syncDetailsOpen: boolean;
  syncDetailsStyle: React.CSSProperties;
  onToggleSyncDetails: () => void;
  onManualRefresh: () => void;
  viewMode: string;
  showQuestionSpinner: boolean;
  questionProgress: number;
  questionColor: string;
  questionBarText: React.ReactNode;
  showResponseSpinner: boolean;
  responseProgress: number;
  responseColor: string;
  responseBarText: React.ReactNode;
  miniBarSpinnerStyle: React.CSSProperties;
  miniProgressStyle: React.CSSProperties;
};

export const renderSurveyResultsSyncStatusPanel = ({
  isSynced,
  isSyncingOrLoading,
  syncStatusText,
  showLongSyncNotice,
  syncDetailsOpen,
  syncDetailsStyle,
  onToggleSyncDetails,
  onManualRefresh,
  viewMode,
  showQuestionSpinner,
  questionProgress,
  questionColor,
  questionBarText,
  showResponseSpinner,
  responseProgress,
  responseColor,
  responseBarText,
  miniBarSpinnerStyle,
  miniProgressStyle,
  remainingSpinnerStyle,
}: SurveyResultsSyncStatusPanelArgs) => {
  const { isSynced, isSyncingOrLoading, syncStatusText, showLongSyncNotice, showQuickRefresh } = syncStatusDisplay;

  return (
    <div className={styles.syncStatusContainer}>
      <button
        type="button"
        className={styles.syncStatus__simple}
        onClick={onToggleSyncDetails}
        aria-expanded={!!syncDetailsOpen}
        aria-label="Toggle sync details"
      >
        {isSynced ? (
          <span className={styles.syncStatus__indicator_synced}></span>
        ) : (
          <FontAwesomeIcon icon={faSpinner} spin={isSyncingOrLoading} />
        )}
        <span>
          {syncStatusText}
          {showLongSyncNotice}
        </span>
      </button>
      {showQuickRefresh && (
        <button
          type="button"
          className={styles.syncStatus__quickRefresh}
          onClick={onManualRefresh}
          title="Refresh Now"
          aria-label="Refresh sync data"
        >
          <FontAwesomeIcon icon={faSyncAlt} />
        </button>
      )}
      <SurveyResultsSyncDetailsDisplay
        miniBarSpinnerStyle={miniBarSpinnerStyle}
        miniProgressStyle={miniProgressStyle}
        onManualRefresh={onManualRefresh}
        remainingSpinnerStyle={remainingSpinnerStyle}
        syncDetailsStyle={syncDetailsStyle}
        syncStatusDisplay={syncStatusDisplay}
      />
    </div>
  );
};

export const renderSurveyResultsFilterSummary = ({
  displayedTotalQuestionsCount,
  displayedTotalResponsesCount,
  normalizedFilteredQuestionsCount,
  normalizedFilteredResponsesCount,
  filterLoading,
  areSummaryCountsHydrated,
}: SurveyResultsFilterSummaryArgs) => (
  <div className={styles.filterSummaryBox}>
    <p className={styles.filterSummaryText}>
      Questions: <strong>{displayedTotalQuestionsCount}</strong> ‎  Filtered:{' '}
      <strong>
        {filterLoading || !areSummaryCountsHydrated ? (
          <FontAwesomeIcon icon={faSpinner} spin />
        ) : (
          normalizedFilteredQuestionsCount
        )}
      </strong>
      <br />
      Responses: <strong>{displayedTotalResponsesCount}</strong> ‎  Filtered:{' '}
      <strong>
        {filterLoading || !areSummaryCountsHydrated ? (
          <FontAwesomeIcon icon={faSpinner} spin />
        ) : (
          normalizedFilteredResponsesCount
        )}
      </strong>
    </p>
  </div>
);
