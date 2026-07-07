import React from 'react';

import styles from './SurveyResults.module.scss';

type FreeformDisplayedResponse = {
  additional?: string;
  responder?: unknown;
  value?: unknown;
};

export type FreeformAggregatorSummaryModel = {
  blankCount?: number;
  displayedResponses?: FreeformDisplayedResponse[];
  encryptedCount?: number;
  totalResponses?: number;
};

type MultichoiceSummaryOption = {
  count: number;
  key: string;
  label: string;
};

export type MultichoiceAggregatorSummaryModel = {
  options?: MultichoiceSummaryOption[];
  totalResponders?: number;
};

const aggregatorPanelClassName = `${styles.surveyResultsAggregatorPanel} ${styles.surveyResultsAggregatorText}`;
const multichoiceOptionClassName = `${styles.surveyResultsFreeformAnswer} ${styles.surveyResultsMultichoiceOption}`;

export const SurveyResultsFreeformAggregatorSummary = ({
  summary = {},
}: {
  summary?: FreeformAggregatorSummaryModel;
}): React.ReactElement => {
  const totalResponses = Number(summary.totalResponses || 0);
  const encryptedCount = Number(summary.encryptedCount || 0);
  const blankCount = Number(summary.blankCount || 0);
  const displayedResponses = Array.isArray(summary.displayedResponses) ? summary.displayedResponses : [];

  if (totalResponses === 0 && encryptedCount === 0 && blankCount === 0) {
    return <SurveyResultsAggregatorEmptyState>No freeform responses available.</SurveyResultsAggregatorEmptyState>;
  }

  const parts = [`${totalResponses} total responses.`];
  if (encryptedCount > 0) {
    parts.push(`${encryptedCount} encrypted responses not shown.`);
  }
  if (blankCount > 0) {
    parts.push(`${blankCount} blank not shown.`);
  }

  return (
    <div className={aggregatorPanelClassName}>
      <p className={styles.surveyResultsAggregatorParagraph}>{parts.join(' ')}</p>
      {displayedResponses.map((item, index) => (
        <div
          key={`freeform-${item.responder || ''}-${index}`}
          className={styles.surveyResultsFreeformAnswer}
        >
          {typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}
          {item.additional && (
            <div className={styles.surveyResultsFreeformAdditionalComment}>
              <em>Comment:</em> {item.additional}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const SurveyResultsMultichoiceAggregatorSummary = ({
  summary = {},
}: {
  summary?: MultichoiceAggregatorSummaryModel;
}): React.ReactElement => {
  const options = Array.isArray(summary.options) ? summary.options : [];
  const totalResponders = Number(summary.totalResponders || 0);

  if (options.length === 0) {
    return (
      <div className={aggregatorPanelClassName}>
        <p className={styles.surveyResultsAggregatorParagraph}>
          No multichoice options are defined for this question.
        </p>
      </div>
    );
  }

  if (totalResponders === 0) {
    return <SurveyResultsAggregatorEmptyState>No multichoice responses available.</SurveyResultsAggregatorEmptyState>;
  }

  return (
    <div className={aggregatorPanelClassName}>
      <p className={styles.surveyResultsAggregatorParagraph}>
        {totalResponders} total responders to this multichoice question.
      </p>
      {options.map((option) => {
        const percent = ((option.count / totalResponders) * 100).toFixed(2);
        return (
          <div
            key={option.key}
            className={multichoiceOptionClassName}
          >
            <span className={styles.surveyResultsMultichoiceOptionLabel}>{option.label}</span>
            <span className={styles.surveyResultsMultichoiceOptionStats}>
              {option.count} ({percent}%)
            </span>
          </div>
        );
      })}
    </div>
  );
};
