import React from 'react';

type SurveyResultsAggregatorEntry = [string, unknown];

type SurveyResultsQuestionSummariesListProps = {
  entries?: SurveyResultsAggregatorEntry[];
  filterLoading?: boolean;
  renderQuestionSummary: (questionId: string, responses: unknown) => React.ReactNode;
  styleMap: Record<string, string>;
};

const SurveyResultsQuestionSummariesList = ({
  entries = [],
  filterLoading = false,
  renderQuestionSummary,
  styleMap,
}: SurveyResultsQuestionSummariesListProps): React.ReactElement => (
  <div className={styleMap.questionSummaries}>
    {entries.map(([qId, arr]: SurveyResultsAggregatorEntry) => (
      <div key={qId}>{renderQuestionSummary(qId, arr)}</div>
    ))}
    {entries.length === 0 && !filterLoading && <p>No results yet.</p>}
  </div>
);

export default SurveyResultsQuestionSummariesList;
