import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import styles from './SurveyResults.module.scss';

export type SurveyResultsFilterSummaryProps = {
  displayedTotalQuestionsCount: number;
  displayedTotalResponsesCount: number;
  normalizedFilteredQuestionsCount: React.ReactNode;
  normalizedFilteredResponsesCount: React.ReactNode;
  showFilteredCountSpinner: boolean;
};

const SurveyResultsFilterSummary = ({
  displayedTotalQuestionsCount,
  displayedTotalResponsesCount,
  normalizedFilteredQuestionsCount,
  normalizedFilteredResponsesCount,
  showFilteredCountSpinner,
}: SurveyResultsFilterSummaryProps): React.ReactElement => (
  <div className={styles.filterSummaryBox}>
    <p className={styles.filterSummaryText}>
      Questions: <strong>{displayedTotalQuestionsCount}</strong>
      {' \u200e  '}
      Filtered:{' '}
      <strong>
        {showFilteredCountSpinner ? <FontAwesomeIcon icon={faSpinner} spin /> : normalizedFilteredQuestionsCount}
      </strong>
      <br />
      Responses: <strong>{displayedTotalResponsesCount}</strong>
      {' \u200e  '}
      Filtered:{' '}
      <strong>
        {showFilteredCountSpinner ? <FontAwesomeIcon icon={faSpinner} spin /> : normalizedFilteredResponsesCount}
      </strong>
    </p>
  </div>
);

export default SurveyResultsFilterSummary;
