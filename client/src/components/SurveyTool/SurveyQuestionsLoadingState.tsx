import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import type { SurveyQuestionsFullLoadingProgressState } from './surveyQuestionsTypes.js';
import styles from './SurveyTool.module.scss';

type SurveyQuestionsLoadingStateProps = {
  progressState: SurveyQuestionsFullLoadingProgressState;
};

const SurveyQuestionsLoadingState = ({ progressState }: SurveyQuestionsLoadingStateProps): React.ReactElement => (
  <div className={styles.loadingContainer}>
    <FontAwesomeIcon icon={faSpinner} spin />
    <div className={styles.fullLoadingHeadline}>Loading questions...</div>
    {progressState.hasFullLoadingProgress && (
      <div className={styles.fullLoadingProgressWrap}>
        <div className={styles.fullLoadingProgressMeta}>
          <span>{progressState.metaLeftText}</span>
          <span>{progressState.metaRightText}</span>
        </div>
        <div className={styles.fullLoadingProgressBar}>
          <div className={styles.fullLoadingProgressFill} style={progressState.fillStyle} />
        </div>
      </div>
    )}
  </div>
);

export default SurveyQuestionsLoadingState;
