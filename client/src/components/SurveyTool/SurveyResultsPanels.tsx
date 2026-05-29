import React from 'react';
import { Progress } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSyncAlt } from '@fortawesome/free-solid-svg-icons';

import styles from './SurveyResults.module.scss';

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
}: SurveyResultsSyncStatusPanelArgs) => (
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
    {!isSynced && (
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
    <div
      className={styles.syncStatus__details}
      style={syncDetailsStyle}
    >
      <div className={styles.miniBarContainer}>
        {viewMode === 'questions' && (
          <div className={styles.miniBarLine}>
            <div className={styles.miniBarLabel}>Questions:</div>
            {showQuestionSpinner ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin style={miniBarSpinnerStyle} />
                <div className={styles.miniBarFraction}>Loading...</div>
              </>
            ) : (
              <>
                <Progress
                  value={questionProgress}
                  color={questionColor}
                  style={miniProgressStyle}
                  className={styles.miniProgress}
                />
                <div className={styles.miniBarFraction}>{questionBarText}</div>
              </>
            )}
          </div>
        )}

        <div className={styles.miniBarLine}>
          <div className={styles.miniBarLabel}>Responses:</div>
          {showResponseSpinner ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin style={miniBarSpinnerStyle} />
              <div className={styles.miniBarFraction}>Loading...</div>
            </>
          ) : (
            <>
              <Progress
                value={responseProgress}
                color={responseColor}
                style={miniProgressStyle}
                className={styles.miniProgress}
              />
              <div className={styles.miniBarFraction}>{responseBarText}</div>
            </>
          )}
        </div>
      </div>
      <div
        className={styles.syncStatus__refreshAction}
        onClick={onManualRefresh}
        title="Refresh Data from Cache/Chain"
      >
        <FontAwesomeIcon icon={faSyncAlt} />
        <span>Refresh Now</span>
      </div>
    </div>
  </div>
);

type SurveyResultsFilterSummaryArgs = {
  displayedTotalQuestionsCount: number;
  displayedTotalResponsesCount: number;
  normalizedFilteredQuestionsCount: React.ReactNode;
  normalizedFilteredResponsesCount: React.ReactNode;
  showFilteredCountSpinner: boolean;
};

export const renderSurveyResultsFilterSummary = ({
  displayedTotalQuestionsCount,
  displayedTotalResponsesCount,
  normalizedFilteredQuestionsCount,
  normalizedFilteredResponsesCount,
  showFilteredCountSpinner,
}: SurveyResultsFilterSummaryArgs) => (
  <div className={styles.filterSummaryBox}>
    <p className={styles.filterSummaryText}>
      Questions: <strong>{displayedTotalQuestionsCount}</strong> ‎  Filtered:{' '}
      <strong>
        {showFilteredCountSpinner ? (
          <FontAwesomeIcon icon={faSpinner} spin />
        ) : (
          normalizedFilteredQuestionsCount
        )}
      </strong>
      <br />
      Responses: <strong>{displayedTotalResponsesCount}</strong> ‎  Filtered:{' '}
      <strong>
        {showFilteredCountSpinner ? (
          <FontAwesomeIcon icon={faSpinner} spin />
        ) : (
          normalizedFilteredResponsesCount
        )}
      </strong>
    </p>
  </div>
);
