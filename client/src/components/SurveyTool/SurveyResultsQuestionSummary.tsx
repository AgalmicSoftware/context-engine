import React from 'react';

import { isFreeformBlankAnswer } from '../../utilities/survey/freeformAnswerUtils.js';
import SingleQuestionResponse from './SingleQuestionResponse';
import {
  SurveyResultsFreeformAggregatorSummary,
  SurveyResultsMultichoiceAggregatorSummary,
} from './SurveyResultsAggregatorSummaries';
import SurveyResultsQuestionSummaryCard from './SurveyResultsQuestionSummaryCard';
import {
  buildSurveyResultsFreeformSummaryModel,
  buildSurveyResultsMultichoiceSummaryModel,
  getSurveyResultsLatestResponsesByResponder,
  resolveSurveyResultsSummaryQuestionType,
} from './surveyResultsSummaryModels';
import {
  buildSurveyResultsQuestionSummaryDisplayPlan,
  getSurveyResultsQuestionCardDomId,
} from './surveyResultsQuestionSummaryStatusController';

type SurveyResultsRecord = Record<string, unknown>;

type SurveyResultsResponseCardClassNames = {
  aggregatorContainerClassName: string;
  aggregatorFreeformAnswerClassName: string;
  aggregatorParagraphClassName: string;
  aggregatorTextClassName: string;
  bodyClassName: string;
  containerClassName: string;
  iconButtonClassName: string;
  linksContainerClassName: string;
};

type SurveyResultsSummaryAnswerField = SurveyResultsRecord & {
  encrypted?: unknown;
  value?: unknown;
};

type SurveyResultsSummaryResponsePayload = SurveyResultsRecord & {
  additional?: SurveyResultsSummaryAnswerField | null;
  answer?: SurveyResultsSummaryAnswerField | null;
  questionType?: unknown;
  type?: unknown;
};

type SurveyResultsSummaryResponseRow = SurveyResultsRecord & {
  response?: SurveyResultsSummaryResponsePayload | unknown;
  responder?: unknown;
};

type SurveyResultsDisplayResponseRecord = SurveyResultsRecord & {
  additional?: SurveyResultsSummaryAnswerField | null;
  answer?: SurveyResultsSummaryAnswerField | null;
  conviction?: unknown;
  convictionEncrypted?: unknown;
  importance?: unknown;
  importanceEncrypted?: unknown;
  prompt?: unknown;
  questionID?: unknown;
  questionId?: unknown;
  timeStamp?: unknown;
  timestamp?: unknown;
  type?: unknown;
};

type SurveyResultsQuestionSummaryRenderModel = {
  bookmarked: boolean;
  displayResponses: SurveyResultsRecord[];
  domId: string;
  isActive: boolean;
  metadataMissing: boolean;
  question: SurveyResultsRecord | null;
  questionPrompt: React.ReactNode;
  resolvedQuestionType: string;
  viewableResponsesCount: number;
};

type SurveyResultsQuestionSummaryProps = {
  activeQuestionToggles?: SurveyResultsRecord;
  activeSessionSlug?: string;
  applyDecryptedOverrideToResponse: (args: {
    key?: unknown;
    response?: SurveyResultsDisplayResponseRecord | null;
  }) => unknown;
  bookmarkedQuestionIDs?: unknown[];
  bookmarkIconStyle?: React.CSSProperties;
  getFallbackQuestion: (questionId: unknown, mode?: unknown) => SurveyResultsRecord;
  getLockedResponseKey: (args: {
    questionId?: unknown;
    responder?: unknown;
    response?: SurveyResultsDisplayResponseRecord | null;
    surveyId?: unknown;
  }) => string;
  getResponseCardProps: () => SurveyResultsResponseCardClassNames;
  metadataMissingStyle?: React.CSSProperties;
  network?: SurveyResultsRecord | null;
  networkQuestions?: Record<string, SurveyResultsRecord>;
  onToggleBookmark: (questionId: string) => void;
  onToggleSummary: (questionId: string) => void;
  questionId: string;
  questionResponsesNonce?: unknown;
  questionsCacheNonce?: unknown;
  responses?: unknown;
  sbtCacheRevision?: unknown;
  styleMap: Record<string, string>;
  surveyId?: unknown;
};

const toRecord = (value: unknown): SurveyResultsRecord =>
  value && typeof value === 'object' ? (value as SurveyResultsRecord) : {};

const normalizeResponseRows = (responses: unknown): SurveyResultsSummaryResponseRow[] =>
  Array.isArray(responses) ? (responses as SurveyResultsSummaryResponseRow[]) : [];

export const countSurveyResultsViewableResponses = (responses: unknown, questionType: unknown = ''): number => {
  const normalizedQuestionType = String(questionType || '').toLowerCase();
  return getSurveyResultsLatestResponsesByResponder(normalizeResponseRows(responses)).reduce((acc: number, row) => {
    const parsedResponse =
      row?.response && typeof row.response === 'object' ? (row.response as SurveyResultsSummaryResponsePayload) : null;
    if (!parsedResponse || !parsedResponse.answer) {
      return acc;
    }
    if (isFreeformBlankAnswer(normalizedQuestionType, parsedResponse)) {
      return acc;
    }
    const isEncryptedPlaceholder = parsedResponse.answer.encrypted === true && parsedResponse.answer.value === '*';
    return isEncryptedPlaceholder ? acc : acc + 1;
  }, 0);
};

export const buildSurveyResultsQuestionSummaryRenderModel = ({
  activeQuestionToggles = {},
  applyDecryptedOverrideToResponse,
  bookmarkedQuestionIDs = [],
  getLockedResponseKey,
  networkQuestions = {},
  questionId,
  responses,
  surveyId,
}: Pick<
  SurveyResultsQuestionSummaryProps,
  | 'activeQuestionToggles'
  | 'applyDecryptedOverrideToResponse'
  | 'bookmarkedQuestionIDs'
  | 'getLockedResponseKey'
  | 'networkQuestions'
  | 'questionId'
  | 'responses'
  | 'surveyId'
>): SurveyResultsQuestionSummaryRenderModel => {
  const lowerQId = String(questionId || '').toLowerCase();
  const question = networkQuestions[lowerQId] || null;
  const questionDisplay = buildSurveyResultsQuestionSummaryDisplayPlan({
    question,
    questionId,
  });
  const displayResponses = normalizeResponseRows(responses).map((row) => {
    const rowRecord = toRecord(row);
    const rowResponse = rowRecord.response as SurveyResultsDisplayResponseRecord | null;
    const key = getLockedResponseKey({
      responder: rowRecord.responder,
      questionId,
      surveyId,
      response: rowResponse,
    });
    return {
      ...rowRecord,
      response: applyDecryptedOverrideToResponse({
        response: rowResponse,
        key,
      }),
    };
  });
  const resolvedQuestionType = resolveSurveyResultsSummaryQuestionType(question, displayResponses);

  return {
    bookmarked: bookmarkedQuestionIDs.includes(questionId),
    displayResponses,
    domId: getSurveyResultsQuestionCardDomId(questionId),
    isActive: !!activeQuestionToggles[questionId],
    metadataMissing: questionDisplay.metadataMissing,
    question,
    questionPrompt: questionDisplay.questionPrompt as React.ReactNode,
    resolvedQuestionType,
    viewableResponsesCount: countSurveyResultsViewableResponses(displayResponses, resolvedQuestionType),
  };
};

const SurveyResultsQuestionSummary = ({
  activeQuestionToggles = {},
  activeSessionSlug = '',
  applyDecryptedOverrideToResponse,
  bookmarkedQuestionIDs = [],
  bookmarkIconStyle,
  getFallbackQuestion,
  getLockedResponseKey,
  getResponseCardProps,
  metadataMissingStyle,
  network,
  networkQuestions = {},
  onToggleBookmark,
  onToggleSummary,
  questionId,
  questionResponsesNonce,
  questionsCacheNonce,
  responses = [],
  sbtCacheRevision,
  styleMap,
  surveyId = '',
}: SurveyResultsQuestionSummaryProps): React.ReactElement => {
  const model = buildSurveyResultsQuestionSummaryRenderModel({
    activeQuestionToggles,
    applyDecryptedOverrideToResponse,
    bookmarkedQuestionIDs,
    getLockedResponseKey,
    networkQuestions,
    questionId,
    responses,
    surveyId,
  });
  const questionForResponse = model.question || getFallbackQuestion(questionId, 'summary');
  const responseActiveSessionSlug = String(toRecord(questionForResponse).sessionSlug || activeSessionSlug || '');

  return (
    <SurveyResultsQuestionSummaryCard
      key={questionId}
      bookmarked={model.bookmarked}
      bookmarkIconStyle={bookmarkIconStyle}
      domId={model.domId}
      isActive={model.isActive}
      metadataMissing={model.metadataMissing}
      metadataMissingStyle={metadataMissingStyle}
      onToggleBookmark={() => onToggleBookmark(questionId)}
      onToggleSummary={() => onToggleSummary(questionId)}
      questionPrompt={model.questionPrompt}
      renderDefaultSummary={() => (
        <SingleQuestionResponse
          aggregatorResponseMode={true}
          question={questionForResponse}
          allResponses={model.displayResponses}
          network={network}
          activeSessionSlug={responseActiveSessionSlug}
          questionResponsesNonce={questionResponsesNonce}
          questionsCacheNonce={questionsCacheNonce}
          sbtCacheRevision={sbtCacheRevision}
          {...getResponseCardProps()}
        />
      )}
      renderFreeformSummary={() => (
        <SurveyResultsFreeformAggregatorSummary
          summary={buildSurveyResultsFreeformSummaryModel(model.displayResponses)}
        />
      )}
      renderMultichoiceSummary={() => (
        <SurveyResultsMultichoiceAggregatorSummary
          summary={buildSurveyResultsMultichoiceSummaryModel(model.displayResponses, model.question)}
        />
      )}
      resolvedQuestionType={model.resolvedQuestionType}
      styleMap={styleMap}
      viewableResponsesCount={model.viewableResponsesCount}
    />
  );
};

export default SurveyResultsQuestionSummary;
