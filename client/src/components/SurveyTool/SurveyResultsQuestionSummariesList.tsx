import React from 'react';

import { buildSurveyResultsQuestionSummariesListDisplayPlan } from './surveyResultsQuestionSummaryStatusController';

type SurveyResultsAggregatorEntry = [string, unknown];

type SurveyResultsQuestionSummariesListProps = {
  emptyMessage?: string;
  entries?: SurveyResultsAggregatorEntry[];
  errorMessage?: React.ReactNode;
  filterLoading?: boolean;
  renderQuestionSummary: (questionId: string, responses: unknown) => React.ReactNode;
  styleMap: Record<string, string>;
};

const SurveyResultsQuestionSummariesList = ({
  emptyMessage = 'No results yet.',
  entries = [],
  errorMessage = '',
  filterLoading = false,
  renderQuestionSummary,
  styleMap,
}: SurveyResultsQuestionSummariesListProps): React.ReactElement => {
  const displayPlan = buildSurveyResultsQuestionSummariesListDisplayPlan({
    emptyMessage,
    entries,
    errorMessage,
    filterLoading,
  });

  return (
    <div className={styleMap.questionSummaries}>
      {displayPlan.showSummaries &&
        displayPlan.entries.map(([qId, arr]: SurveyResultsAggregatorEntry) => (
          <div key={qId}>{renderQuestionSummary(qId, arr)}</div>
        ))}
      {displayPlan.showError && <p>{displayPlan.errorMessage as React.ReactNode}</p>}
      {displayPlan.showEmptyState && <p>{displayPlan.emptyMessage}</p>}
    </div>
  );
};

export default SurveyResultsQuestionSummariesList;
