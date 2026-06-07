import React from 'react';

import SingleQuestionResponse from './SingleQuestionResponse';
import SurveyResultsIndividualResponsesList from './SurveyResultsIndividualResponsesList';
import {
  renderSurveyResultsFilterSummary,
} from './SurveyResultsPanels';
import SurveyResultsQuestionListPanel from './SurveyResultsQuestionListPanel';
import SurveyResultsQuestionSummariesList from './SurveyResultsQuestionSummariesList';
import SurveyResultsStatusMessages from './SurveyResultsStatusMessages';
import SurveyResultsSurveyViewModeToggle from './SurveyResultsSurveyViewModeToggle';
import type {
  SurveyResultsCacheReadinessDisplayPlan,
} from './surveyResultsCacheReadinessDisplayPlan';
import { getSurveyResponseQuestionId } from './surveyResultsHelpers.js';

type SurveyResultsRecord = Record<string, any>;
type SurveyResultsEntry = [string, unknown];
type SurveyResultsResponseListEntry = SurveyResultsRecord & {
  responder: string;
  surveyId?: unknown;
};

type SurveyResultsDisplayPanelsArgs = {
  account?: string;
  activeQuestionToggles?: SurveyResultsRecord;
  activeToggles?: SurveyResultsRecord;
  alertMessage?: React.ReactNode;
  applyDecryptedOverrideToResponse: (args: SurveyResultsRecord) => SurveyResultsRecord | null;
  cacheReadinessDisplay: SurveyResultsCacheReadinessDisplayPlan;
  currentSurveyId?: string;
  effectiveSlug?: string;
  filterControlsNode?: React.ReactNode;
  filterLoading?: boolean;
  getFallbackQuestion: (questionId: unknown, mode?: unknown) => SurveyResultsRecord;
  getLockedResponseKey: (args: SurveyResultsRecord) => string;
  getResponseCardProps: () => SurveyResultsRecord;
  lockedResponsesBannerNode?: React.ReactNode;
  network?: SurveyResultsRecord | null;
  onSurveyViewModeKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onSurveyViewModeToggle: () => void;
  onToggleQuestionList: () => void;
  onToggleResponse: (index: number) => void;
  preNetworkQuestions?: Record<string, SurveyResultsRecord>;
  questionModeEntries?: SurveyResultsEntry[];
  questionResponsesNonce?: unknown;
  questionsCacheNonce?: unknown;
  renderQuestionSummary: (questionId: string, responses: unknown) => React.ReactNode;
  renderQuestionTable: () => React.ReactNode;
  responses?: SurveyResultsResponseListEntry[];
  sbtCacheRevision?: unknown;
  styleMap: Record<string, string>;
  surveyAggregateEntries?: SurveyResultsEntry[];
  surveyViewMode?: string;
  tableWrapperRef?: React.Ref<HTMLDivElement>;
  toggleKnobStyle?: React.CSSProperties;
  trailingLabelStyle?: React.CSSProperties;
  viewMode?: string;
};

const renderIndividualResponseBody = ({
  account = '',
  applyDecryptedOverrideToResponse,
  currentSurveyId = '',
  effectiveSlug = '',
  getFallbackQuestion,
  getLockedResponseKey,
  getResponseCardProps,
  network,
  preNetworkQuestions = {},
  questionResponsesNonce,
  questionsCacheNonce,
  response = { responder: '' },
  sbtCacheRevision,
  styleMap,
}: {
  account?: string;
  applyDecryptedOverrideToResponse: (args: SurveyResultsRecord) => SurveyResultsRecord | null;
  currentSurveyId?: string;
  effectiveSlug?: string;
  getFallbackQuestion: (questionId: unknown, mode?: unknown) => SurveyResultsRecord;
  getLockedResponseKey: (args: SurveyResultsRecord) => string;
  getResponseCardProps: () => SurveyResultsRecord;
  network?: SurveyResultsRecord | null;
  preNetworkQuestions?: Record<string, SurveyResultsRecord>;
  questionResponsesNonce?: unknown;
  questionsCacheNonce?: unknown;
  response?: SurveyResultsResponseListEntry;
  sbtCacheRevision?: unknown;
  styleMap: Record<string, string>;
}): React.ReactNode => {
  const parsedResponse = response.response as SurveyResultsRecord | undefined;
  const responseRows = Array.isArray(parsedResponse?.responses)
    ? parsedResponse?.responses as SurveyResultsRecord[]
    : [];

  if (responseRows.length === 0) {
    return <p>No question-level responses found for this user.</p>;
  }

  return responseRows.map((answerItem: SurveyResultsRecord, aIndex: number) => {
    const questionId = getSurveyResponseQuestionId(answerItem);
    const questionData = preNetworkQuestions[questionId] || getFallbackQuestion(questionId, 'individual');
    const responseKey = getLockedResponseKey({
      responder: response?.responder,
      questionId,
      surveyId: response?.surveyId || currentSurveyId,
      response: answerItem,
    });
    const displayResponse = applyDecryptedOverrideToResponse({
      response: answerItem,
      key: responseKey,
    });
    return (
      <div key={aIndex} className={styleMap.surveyResultsOverride}>
        <SingleQuestionResponse
          aggregatorResponseMode={false}
          question={questionData}
          response={displayResponse}
          mode="fullscreen"
          isOwnResponse={
            account?.toLowerCase() ===
            response.responder?.toLowerCase()
          }
          network={network}
          activeSessionSlug={questionData?.sessionSlug || effectiveSlug}
          questionResponsesNonce={questionResponsesNonce}
          questionsCacheNonce={questionsCacheNonce}
          sbtCacheRevision={sbtCacheRevision}
          {...getResponseCardProps()}
        />
      </div>
    );
  });
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

    {renderSurveyResultsFilterSummary({
      displayedTotalQuestionsCount: filterSummaryDisplay.displayedTotalQuestionsCount ?? 0,
      displayedTotalResponsesCount: filterSummaryDisplay.displayedTotalResponsesCount ?? 0,
      normalizedFilteredQuestionsCount: filterSummaryDisplay.normalizedFilteredQuestionsCount ?? 0,
      normalizedFilteredResponsesCount: filterSummaryDisplay.normalizedFilteredResponsesCount ?? 0,
      showFilteredCountSpinner: !!filterSummaryDisplay.showFilteredCountSpinner,
    })}

    {filterControlsNode}

    {viewMode === 'survey' && surveyViewMode === 'individuals' && (
      <SurveyResultsIndividualResponsesList
        activeToggles={activeToggles}
        currentSurveyId={currentSurveyId}
        effectiveSlug={effectiveSlug}
        filterLoading={filterLoading}
        onToggleResponse={onToggleResponse}
        renderResponseBody={(response: SurveyResultsResponseListEntry) => renderIndividualResponseBody({
          account,
          applyDecryptedOverrideToResponse,
          currentSurveyId,
          effectiveSlug,
          getFallbackQuestion,
          getLockedResponseKey,
          getResponseCardProps,
          network,
          preNetworkQuestions,
          questionResponsesNonce,
          questionsCacheNonce,
          response,
          sbtCacheRevision,
          styleMap,
        })}
        responses={responses}
        styleMap={styleMap}
      />
    )}

    {viewMode === 'survey' && surveyViewMode === 'aggregate' && (
      <SurveyResultsQuestionSummariesList
        entries={surveyAggregateEntries}
        filterLoading={filterLoading}
        renderQuestionSummary={renderQuestionSummary}
        styleMap={styleMap}
      />
    )}

    {viewMode === 'questions' && (
      <SurveyResultsQuestionSummariesList
        entries={questionModeEntries}
        filterLoading={filterLoading}
        renderQuestionSummary={renderQuestionSummary}
        styleMap={styleMap}
      />
    )}
  </>
  );
};
