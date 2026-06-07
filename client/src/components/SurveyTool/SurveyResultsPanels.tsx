import React from 'react';
import { Progress } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSyncAlt } from '@fortawesome/free-solid-svg-icons';

import styles from './SurveyResults.module.scss';
import type {
  SurveyResultsSyncStatusDisplayPlan,
} from './surveyResultsSyncStatusController';

type SurveyResultsSyncStatusPanelArgs = {
  syncStatusDisplay: SurveyResultsSyncStatusDisplayPlan;
  syncDetailsOpen: boolean;
  syncDetailsStyle: React.CSSProperties;
  onToggleSyncDetails: () => void;
  onManualRefresh: () => void;
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
  syncStatusDisplay,
  syncDetailsOpen,
  syncDetailsStyle,
  onToggleSyncDetails,
  onManualRefresh,
  miniBarSpinnerStyle,
  miniProgressStyle,
  remainingSpinnerStyle,
}: SurveyResultsSyncStatusPanelArgs) => {
  const {
    isSynced,
    isSyncingOrLoading,
    syncStatusText,
    showLongSyncNotice,
    showQuickRefresh,
    viewMode,
    question,
    response,
  } = syncStatusDisplay;

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
    <div
      className={styles.syncStatus__details}
      style={syncDetailsStyle}
    >
      <div className={styles.miniBarContainer}>
        {viewMode === 'questions' && (
          <div className={styles.miniBarLine}>
            <div className={styles.miniBarLabel}>Questions:</div>
            {question.showSpinner ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin style={miniBarSpinnerStyle} />
                <div className={styles.miniBarFraction}>Loading...</div>
              </>
            ) : (
              <>
                <Progress
                  value={question.progress}
                  color={question.color}
                  style={miniProgressStyle}
                  className={styles.miniProgress}
                />
                <div className={styles.miniBarFraction}>
                  {renderSurveyResultsSyncBarText(
                    question.label,
                    question.showRemainingSpinner,
                    remainingSpinnerStyle
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className={styles.miniBarLine}>
          <div className={styles.miniBarLabel}>Responses:</div>
          {response.showSpinner ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin style={miniBarSpinnerStyle} />
              <div className={styles.miniBarFraction}>Loading...</div>
            </>
          ) : (
            <>
              <Progress
                value={response.progress}
                color={response.color}
                style={miniProgressStyle}
                className={styles.miniProgress}
              />
              <div className={styles.miniBarFraction}>
                {renderSurveyResultsSyncBarText(
                  response.label,
                  response.showRemainingSpinner,
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
};
