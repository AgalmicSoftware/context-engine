import React from 'react';

import styles from './SurveyResults.module.scss';
import type {
  FreeformAggregatorSummaryModel,
  MultichoiceAggregatorSummaryModel,
} from './SurveyResultsAggregatorSummaries';

const aggregatorPanelClassName = `${styles.surveyResultsAggregatorPanel} ${styles.surveyResultsAggregatorText}`;
const multichoiceOptionClassName = `${styles.surveyResultsFreeformAnswer} ${styles.surveyResultsMultichoiceOption}`;

type SurveyResultsAggregatorEmptyStateProps = {
  children: React.ReactNode;
};

export const SurveyResultsAggregatorEmptyState = ({
  children,
}: SurveyResultsAggregatorEmptyStateProps): React.ReactElement => (
  <div className={aggregatorPanelClassName}>
    <p className={styles.surveyResultsAggregatorParagraph}>{children}</p>
  </div>
);

export const buildSurveyResultsFreeformSummaryLabel = ({
  blankCount = 0,
  encryptedCount = 0,
  totalResponses = 0,
}: Pick<FreeformAggregatorSummaryModel, 'blankCount' | 'encryptedCount' | 'totalResponses'>): string => {
  const parts = [`${Number(totalResponses || 0)} total responses.`];
  if (Number(encryptedCount || 0) > 0) {
    parts.push(`${Number(encryptedCount || 0)} encrypted responses not shown.`);
  }
  if (Number(blankCount || 0) > 0) {
    parts.push(`${Number(blankCount || 0)} blank not shown.`);
  }
  return parts.join(' ');
};

type SurveyResultsFreeformSummaryDisplayProps = {
  summary: FreeformAggregatorSummaryModel;
};

export const SurveyResultsFreeformSummaryDisplay = ({
  summary,
}: SurveyResultsFreeformSummaryDisplayProps): React.ReactElement => {
  const displayedResponses = Array.isArray(summary.displayedResponses) ? summary.displayedResponses : [];

  return (
    <div className={aggregatorPanelClassName}>
      <p className={styles.surveyResultsAggregatorParagraph}>{buildSurveyResultsFreeformSummaryLabel(summary)}</p>
      {displayedResponses.map((item, index) => (
        <div key={`freeform-${item.responder || ''}-${index}`} className={styles.surveyResultsFreeformAnswer}>
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

type SurveyResultsMultichoiceDistributionDisplayProps = {
  summary: MultichoiceAggregatorSummaryModel;
};

export const SurveyResultsMultichoiceDistributionDisplay = ({
  summary,
}: SurveyResultsMultichoiceDistributionDisplayProps): React.ReactElement => {
  const options = Array.isArray(summary.options) ? summary.options : [];
  const totalResponders = Number(summary.totalResponders || 0);

  return (
    <div className={aggregatorPanelClassName}>
      <p className={styles.surveyResultsAggregatorParagraph}>
        {totalResponders} total responders to this multichoice question.
      </p>
      {options.map((option) => {
        const percent = ((option.count / totalResponders) * 100).toFixed(2);
        return (
          <div key={option.key} className={multichoiceOptionClassName}>
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
