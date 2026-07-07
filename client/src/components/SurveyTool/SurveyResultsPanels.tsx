import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSyncAlt } from '@fortawesome/free-solid-svg-icons';

import styles from './SurveyResults.module.scss';
import SurveyResultsSyncDetailsDisplay from './SurveyResultsSyncDetailsDisplay';
import type { SurveyResultsSyncStatusDisplayPlan } from './surveyResultsSyncStatusController';

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
