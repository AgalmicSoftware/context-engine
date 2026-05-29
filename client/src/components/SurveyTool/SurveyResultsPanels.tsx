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
  showQuickRefresh?: boolean;
  showQuestionSpinner: boolean;
  questionProgress: number;
  questionColor: string;
  questionBarText: string;
  showQuestionRemainingSpinner?: boolean;
  showResponseSpinner: boolean;
  responseProgress: number;
  responseColor: string;
  responseBarText: string;
  showResponseRemainingSpinner?: boolean;
  miniBarSpinnerStyle: React.CSSProperties;
  miniProgressStyle: React.CSSProperties;
  remainingSpinnerStyle: React.CSSProperties;
};

const renderSurveyResultsSyncBarText = (
  barText: string,
  showRemainingSpinner: boolean,
  remainingSpinnerStyle: React.CSSProperties
): React.ReactNode => (
  showRemainingSpinner ? (
    <>
      {barText}{' '}
      <FontAwesomeIcon icon={faSpinner} spin style={remainingSpinnerStyle} />
    </>
  ) : (
    barText
  )
);

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
  showQuickRefresh = !isSynced,
  showQuestionSpinner,
  questionProgress,
  questionColor,
  questionBarText,
  showQuestionRemainingSpinner = false,
  showResponseSpinner,
  responseProgress,
  responseColor,
  responseBarText,
  showResponseRemainingSpinner = false,
  miniBarSpinnerStyle,
  miniProgressStyle,
  remainingSpinnerStyle,
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
                <div className={styles.miniBarFraction}>
                  {renderSurveyResultsSyncBarText(
                    questionBarText,
                    showQuestionRemainingSpinner,
                    remainingSpinnerStyle
                  )}
                </div>
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
              <div className={styles.miniBarFraction}>
                {renderSurveyResultsSyncBarText(
                  responseBarText,
                  showResponseRemainingSpinner,
                  remainingSpinnerStyle
                )}
              </div>
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
