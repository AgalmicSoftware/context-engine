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
  questionTotalsLoading?: boolean;
  responseTotalsLoading?: boolean;
};

const Loading = () => <FontAwesomeIcon icon={faSpinner} spin title="Loading" />;

const SurveyResultsFilterSummary = ({
  displayedTotalQuestionsCount,
  displayedTotalResponsesCount,
  normalizedFilteredQuestionsCount,
  normalizedFilteredResponsesCount,
  showFilteredCountSpinner,
  questionTotalsLoading = false,
  responseTotalsLoading = false,
}: SurveyResultsFilterSummaryProps): React.ReactElement => (
  <div className={styles.filterSummaryBox}>
    <p className={styles.filterSummaryText}>
      Questions: <strong>{questionTotalsLoading ? <Loading /> : displayedTotalQuestionsCount}</strong>
      {' ‎  '}
      Filtered:{' '}
      <strong>
        {showFilteredCountSpinner || questionTotalsLoading ? <Loading /> : normalizedFilteredQuestionsCount}
      </strong>
      <br />
      Responses: <strong>{responseTotalsLoading ? <Loading /> : displayedTotalResponsesCount}</strong>
      {' ‎  '}
      Filtered:{' '}
      <strong>
        {showFilteredCountSpinner || responseTotalsLoading ? <Loading /> : normalizedFilteredResponsesCount}
      </strong>
    </p>
  </div>
);

export default SurveyResultsFilterSummary;
