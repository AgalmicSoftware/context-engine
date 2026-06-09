import React from 'react';

import SurveyResultsQuestionListCard from './SurveyResultsQuestionListCard';
import type { SurveyResultsQuestionListDisplayPlan } from './surveyResultsQuestionSummaryStatusController';

type SurveyResultsQuestionListPanelProps = {
  activeQuestionToggles?: Record<string, unknown>;
  onToggleQuestionList: () => void;
  questionListDisplay: SurveyResultsQuestionListDisplayPlan;
  renderQuestionTable: () => React.ReactNode;
  styleMap: Record<string, string>;
  surveyViewMode?: string;
  tableWrapperRef?: React.Ref<HTMLDivElement>;
  trailingLabelStyle?: React.CSSProperties;
  viewMode?: string;
};

const SurveyResultsQuestionListPanel = ({
  activeQuestionToggles = {},
  onToggleQuestionList,
  questionListDisplay,
  renderQuestionTable,
  styleMap,
  surveyViewMode = '',
  tableWrapperRef,
  trailingLabelStyle,
  viewMode = '',
}: SurveyResultsQuestionListPanelProps): React.ReactElement | null => {
  const isSurveyAggregateQuestionList = viewMode === 'survey' && surveyViewMode === 'aggregate';
  const isQuestionModeQuestionList = viewMode === 'questions';
  if (!isSurveyAggregateQuestionList && !isQuestionModeQuestionList) {
    return null;
  }

  return (
    <SurveyResultsQuestionListCard
      isOpen={!!activeQuestionToggles.__questionList__}
      onToggle={onToggleQuestionList}
      questionTableNode={questionListDisplay.shouldRenderQuestionTable ? renderQuestionTable() : null}
      showEmptyState={questionListDisplay.showEmptyState}
      styleMap={styleMap}
      tableWrapperRef={isSurveyAggregateQuestionList ? tableWrapperRef : undefined}
      title={isSurveyAggregateQuestionList ? ' View & Sort Questions' : 'View & Sort Questions'}
      trailingLabelStyle={trailingLabelStyle}
    />
  );
};

export default SurveyResultsQuestionListPanel;
