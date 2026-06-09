import React from 'react';

import SurveyResultsQuestionSummariesList from './SurveyResultsQuestionSummariesList';

type SurveyResultsEntry = [string, unknown];

type SurveyResultsQuestionSummariesPanelProps = {
  filterLoading?: boolean;
  questionModeEntries?: SurveyResultsEntry[];
  renderQuestionSummary: (questionId: string, responses: unknown) => React.ReactNode;
  styleMap: Record<string, string>;
  surveyAggregateEntries?: SurveyResultsEntry[];
  surveyViewMode?: string;
  viewMode?: string;
};

const SurveyResultsQuestionSummariesPanel = ({
  filterLoading = false,
  questionModeEntries = [],
  renderQuestionSummary,
  styleMap,
  surveyAggregateEntries = [],
  surveyViewMode = '',
  viewMode = '',
}: SurveyResultsQuestionSummariesPanelProps): React.ReactElement | null => {
  if (viewMode === 'survey' && surveyViewMode === 'aggregate') {
    return (
      <SurveyResultsQuestionSummariesList
        entries={surveyAggregateEntries}
        filterLoading={filterLoading}
        renderQuestionSummary={renderQuestionSummary}
        styleMap={styleMap}
      />
    );
  }

  if (viewMode === 'questions') {
    return (
      <SurveyResultsQuestionSummariesList
        entries={questionModeEntries}
        filterLoading={filterLoading}
        renderQuestionSummary={renderQuestionSummary}
        styleMap={styleMap}
      />
    );
  }

  return null;
};

export default SurveyResultsQuestionSummariesPanel;
