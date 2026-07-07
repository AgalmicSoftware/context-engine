import React from 'react';
import { Progress } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSyncAlt } from '@fortawesome/free-solid-svg-icons';

import styles from './SurveyResults.module.scss';
import type {
  SurveyResultsSyncStatusDisplayPlan,
  SurveyResultsSyncStatusTrackPlan,
} from './surveyResultsSyncStatusController';

type SurveyResultsSyncTrackRowProps = {
  label: string;
  miniBarSpinnerStyle: React.CSSProperties;
  miniProgressStyle: React.CSSProperties;
  remainingSpinnerStyle: React.CSSProperties;
  track: SurveyResultsSyncStatusTrackPlan;
};

type SurveyResultsSyncDetailsDisplayProps = {
  onManualRefresh: () => void;
  syncDetailsStyle: React.CSSProperties;
  syncStatusDisplay: Pick<SurveyResultsSyncStatusDisplayPlan, 'question' | 'response' | 'viewMode'>;
} & Pick<SurveyResultsSyncTrackRowProps, 'miniBarSpinnerStyle' | 'miniProgressStyle' | 'remainingSpinnerStyle'>;

const renderSurveyResultsSyncBarText = (
  barText: string,
  showRemainingSpinner: boolean,
  remainingSpinnerStyle: React.CSSProperties,
): React.ReactNode =>
  showRemainingSpinner ? (
    <>
      {barText} <FontAwesomeIcon icon={faSpinner} spin style={remainingSpinnerStyle} />
    </>
  ) : (
    barText
  );

export const SurveyResultsSyncTrackRow = ({
  label,
  miniBarSpinnerStyle,
  miniProgressStyle,
  remainingSpinnerStyle,
  track,
}: SurveyResultsSyncTrackRowProps): React.ReactElement => (
  <div className={styles.miniBarLine}>
    <div className={styles.miniBarLabel}>{label}</div>
    {track.showSpinner ? (
      <>
        <FontAwesomeIcon icon={faSpinner} spin style={miniBarSpinnerStyle} />
        <div className={styles.miniBarFraction}>Loading...</div>
      </>
    ) : (
      <>
        <Progress
          value={track.progress}
          color={track.color}
          style={miniProgressStyle}
          className={styles.miniProgress}
        />
        <div className={styles.miniBarFraction}>
          {renderSurveyResultsSyncBarText(track.label, track.showRemainingSpinner, remainingSpinnerStyle)}
        </div>
      </>
    )}
  </div>
);

const SurveyResultsSyncDetailsDisplay = ({
  miniBarSpinnerStyle,
  miniProgressStyle,
  onManualRefresh,
  remainingSpinnerStyle,
  syncDetailsStyle,
  syncStatusDisplay,
}: SurveyResultsSyncDetailsDisplayProps): React.ReactElement => {
  const { question, response, viewMode } = syncStatusDisplay;

  return (
    <div className={styles.syncStatus__details} style={syncDetailsStyle}>
      <div className={styles.miniBarContainer}>
        {viewMode === 'questions' && (
          <SurveyResultsSyncTrackRow
            label="Questions:"
            miniBarSpinnerStyle={miniBarSpinnerStyle}
            miniProgressStyle={miniProgressStyle}
            remainingSpinnerStyle={remainingSpinnerStyle}
            track={question}
          />
        )}

        <SurveyResultsSyncTrackRow
          label="Responses:"
          miniBarSpinnerStyle={miniBarSpinnerStyle}
          miniProgressStyle={miniProgressStyle}
          remainingSpinnerStyle={remainingSpinnerStyle}
          track={response}
        />
      </div>
      <div className={styles.syncStatus__refreshAction} onClick={onManualRefresh} title="Refresh Data from Cache/Chain">
        <FontAwesomeIcon icon={faSyncAlt} />
        <span>Refresh Now</span>
      </div>
    </div>
  );
};

export default SurveyResultsSyncDetailsDisplay;
