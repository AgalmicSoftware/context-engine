import React from 'react';

import SurveyResultsFilterSummary from './SurveyResultsFilterSummary';
import SurveyResultsIndividualResponseBody, {
  type SurveyResultsIndividualDecryptedOverrideArgs,
  type SurveyResultsIndividualLockedResponseKeyArgs,
  type SurveyResultsIndividualQuestionRecord,
  type SurveyResultsIndividualResponseCardDisplayProps,
  type SurveyResultsIndividualResponseListEntry,
  type SurveyResultsIndividualResponseRecord,
  type SurveyResultsIndividualAnswerRecord,
} from './SurveyResultsIndividualResponseBody';
import SurveyResultsIndividualResponsesList from './SurveyResultsIndividualResponsesList';
import SurveyResultsQuestionListPanel from './SurveyResultsQuestionListPanel';
import SurveyResultsQuestionSummariesPanel from './SurveyResultsQuestionSummariesPanel';
import SurveyResultsStatusMessages from './SurveyResultsStatusMessages';
import SurveyResultsSurveyViewModeToggle from './SurveyResultsSurveyViewModeToggle';
import type {
  SurveyResultsCacheReadinessDisplayPlan,
} from './surveyResultsCacheReadinessDisplayPlan';

type SurveyResultsEntry = [string, unknown];

export type SurveyResultsDisplayPanelsArgs = {
  account?: string;
  activeQuestionToggles?: Record<string, unknown>;
  activeToggles?: Record<string, unknown>;
  alertMessage?: React.ReactNode;
  applyDecryptedOverrideToResponse: (
    args: SurveyResultsIndividualDecryptedOverrideArgs
  ) => SurveyResultsIndividualAnswerRecord | null;
  cacheReadinessDisplay: SurveyResultsCacheReadinessDisplayPlan;
  currentSurveyId?: string;
  effectiveSlug?: string;
  filterControlsNode?: React.ReactNode;
  filterLoading?: boolean;
  getFallbackQuestion: (questionId: unknown, mode?: unknown) => SurveyResultsIndividualQuestionRecord;
  getLockedResponseKey: (args: SurveyResultsIndividualLockedResponseKeyArgs) => string;
  getResponseCardProps: () => SurveyResultsIndividualResponseCardDisplayProps;
  lockedResponsesBannerNode?: React.ReactNode;
  network?: SurveyResultsIndividualResponseRecord | null;
  onSurveyViewModeKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onSurveyViewModeToggle: () => void;
  onToggleQuestionList: () => void;
  onToggleResponse: (responseId: string) => void;
  preNetworkQuestions?: Record<string, SurveyResultsIndividualQuestionRecord>;
  questionModeEntries?: SurveyResultsEntry[];
  questionResponsesNonce?: unknown;
  questionsCacheNonce?: unknown;
  renderQuestionSummary: (questionId: string, responses: unknown) => React.ReactNode;
  renderQuestionTable: () => React.ReactNode;
  responses?: SurveyResultsIndividualResponseListEntry[];
  sbtCacheRevision?: unknown;
  styleMap: Record<string, string>;
  surveyAggregateEntries?: SurveyResultsEntry[];
  surveyViewMode?: string;
  tableWrapperRef?: React.Ref<HTMLDivElement>;
  toggleKnobStyle?: React.CSSProperties;
  trailingLabelStyle?: React.CSSProperties;
  viewMode?: string;
};

export const renderSurveyResultsDisplayPanels = ({
  account = '',
  activeQuestionToggles = {},
  activeToggles = {},
  alertMessage = '',
  applyDecryptedOverrideToResponse,
  cacheReadinessDisplay,
  currentSurveyId = '',
  effectiveSlug = '',
  filterControlsNode = null,
  filterLoading = false,
  getFallbackQuestion,
  getLockedResponseKey,
  getResponseCardProps,
  lockedResponsesBannerNode = null,
  network,
  onSurveyViewModeKeyDown,
  onSurveyViewModeToggle,
  onToggleQuestionList,
  onToggleResponse,
  preNetworkQuestions = {},
  questionModeEntries = [],
  questionResponsesNonce,
  questionsCacheNonce,
  renderQuestionSummary,
  renderQuestionTable,
  responses = [],
  sbtCacheRevision,
  styleMap,
  surveyAggregateEntries = [],
  surveyViewMode = '',
  tableWrapperRef,
  toggleKnobStyle,
  trailingLabelStyle,
  viewMode = '',
}: SurveyResultsDisplayPanelsArgs): React.ReactElement => {
  const {
    filterSummaryDisplay,
    questionListDisplay,
  } = cacheReadinessDisplay;

  return (
  <>
    <SurveyResultsStatusMessages
      alertMessage={alertMessage}
      filterLoading={filterLoading}
      styleMap={styleMap}
    />

    {viewMode === 'survey' && (
      <SurveyResultsSurveyViewModeToggle
        isAggregate={surveyViewMode === 'aggregate'}
        knobStyle={toggleKnobStyle}
        onKeyDown={onSurveyViewModeKeyDown}
        onToggle={onSurveyViewModeToggle}
        styleMap={styleMap}
        trailingLabelStyle={trailingLabelStyle}
      />
    )}

    {lockedResponsesBannerNode}

    <SurveyResultsQuestionListPanel
      activeQuestionToggles={activeQuestionToggles}
      onToggleQuestionList={onToggleQuestionList}
      questionListDisplay={questionListDisplay}
      renderQuestionTable={renderQuestionTable}
      styleMap={styleMap}
      surveyViewMode={surveyViewMode}
      tableWrapperRef={tableWrapperRef}
      trailingLabelStyle={trailingLabelStyle}
      viewMode={viewMode}
    />

    <SurveyResultsFilterSummary
      displayedTotalQuestionsCount={filterSummaryDisplay.displayedTotalQuestionsCount ?? 0}
      displayedTotalResponsesCount={filterSummaryDisplay.displayedTotalResponsesCount ?? 0}
      normalizedFilteredQuestionsCount={filterSummaryDisplay.normalizedFilteredQuestionsCount ?? 0}
      normalizedFilteredResponsesCount={filterSummaryDisplay.normalizedFilteredResponsesCount ?? 0}
      showFilteredCountSpinner={!!filterSummaryDisplay.showFilteredCountSpinner}
    />

    {filterControlsNode}

    {viewMode === 'survey' && surveyViewMode === 'individuals' && (
      <SurveyResultsIndividualResponsesList
        activeToggles={activeToggles}
        currentSurveyId={currentSurveyId}
        effectiveSlug={effectiveSlug}
        filterLoading={filterLoading}
        onToggleResponse={onToggleResponse}
        renderResponseBody={(response: SurveyResultsIndividualResponseListEntry) => (
          <SurveyResultsIndividualResponseBody
            account={account}
            applyDecryptedOverrideToResponse={applyDecryptedOverrideToResponse}
            currentSurveyId={currentSurveyId}
            effectiveSlug={effectiveSlug}
            getFallbackQuestion={getFallbackQuestion}
            getLockedResponseKey={getLockedResponseKey}
            getResponseCardProps={getResponseCardProps}
            network={network}
            preNetworkQuestions={preNetworkQuestions}
            questionResponsesNonce={questionResponsesNonce}
            questionsCacheNonce={questionsCacheNonce}
            response={response}
            sbtCacheRevision={sbtCacheRevision}
            styleMap={styleMap}
          />
        )}
        responses={responses}
        styleMap={styleMap}
      />
    )}

    <SurveyResultsQuestionSummariesPanel
      filterLoading={filterLoading}
      questionModeEntries={questionModeEntries}
      renderQuestionSummary={renderQuestionSummary}
      styleMap={styleMap}
      surveyAggregateEntries={surveyAggregateEntries}
      surveyViewMode={surveyViewMode}
      viewMode={viewMode}
    />
  </>
  );
};
