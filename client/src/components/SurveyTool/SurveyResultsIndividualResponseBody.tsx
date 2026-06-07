import React from 'react';

import SingleQuestionResponse from './SingleQuestionResponse';
import { getSurveyResponseQuestionId } from './surveyResultsHelpers.js';

type SurveyResultsRecord = Record<string, any>;

export type SurveyResultsIndividualResponseListEntry = SurveyResultsRecord & {
  responder: string;
  surveyId?: unknown;
};

export type SurveyResultsIndividualResponseDisplayRow = {
  activeSessionSlug: string;
  displayResponse: SurveyResultsRecord | null;
  isOwnResponse: boolean;
  question: SurveyResultsRecord;
  questionId: string;
  rowKey: number;
};

export type SurveyResultsIndividualResponseBodyProps = {
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
  response?: SurveyResultsIndividualResponseListEntry;
  sbtCacheRevision?: unknown;
  styleMap: Record<string, string>;
};

export const buildSurveyResultsIndividualResponseDisplayRows = ({
  account = '',
  applyDecryptedOverrideToResponse,
  currentSurveyId = '',
  effectiveSlug = '',
  getFallbackQuestion,
  getLockedResponseKey,
  preNetworkQuestions = {},
  response = { responder: '' },
}: Pick<
  SurveyResultsIndividualResponseBodyProps,
  | 'account'
  | 'applyDecryptedOverrideToResponse'
  | 'currentSurveyId'
  | 'effectiveSlug'
  | 'getFallbackQuestion'
  | 'getLockedResponseKey'
  | 'preNetworkQuestions'
  | 'response'
>): SurveyResultsIndividualResponseDisplayRow[] => {
  const parsedResponse = response.response as SurveyResultsRecord | undefined;
  const responseRows = Array.isArray(parsedResponse?.responses)
    ? parsedResponse?.responses as SurveyResultsRecord[]
    : [];

  return responseRows.map((answerItem: SurveyResultsRecord, aIndex: number) => {
    const questionId = getSurveyResponseQuestionId(answerItem);
    const question = preNetworkQuestions[questionId] || getFallbackQuestion(questionId, 'individual');
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

    return {
      activeSessionSlug: question?.sessionSlug || effectiveSlug,
      displayResponse,
      isOwnResponse: account?.toLowerCase() === response.responder?.toLowerCase(),
      question,
      questionId,
      rowKey: aIndex,
    };
  });
};

const SurveyResultsIndividualResponseBody = ({
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
}: SurveyResultsIndividualResponseBodyProps): React.ReactElement => {
  const displayRows = buildSurveyResultsIndividualResponseDisplayRows({
    account,
    applyDecryptedOverrideToResponse,
    currentSurveyId,
    effectiveSlug,
    getFallbackQuestion,
    getLockedResponseKey,
    preNetworkQuestions,
    response,
  });

  if (displayRows.length === 0) {
    return <p>No question-level responses found for this user.</p>;
  }

  return (
    <>
      {displayRows.map((row) => (
        <div key={row.rowKey} className={styleMap.surveyResultsOverride}>
          <SingleQuestionResponse
            aggregatorResponseMode={false}
            question={row.question}
            response={row.displayResponse}
            mode="fullscreen"
            isOwnResponse={row.isOwnResponse}
            network={network}
            activeSessionSlug={row.activeSessionSlug}
            questionResponsesNonce={questionResponsesNonce}
            questionsCacheNonce={questionsCacheNonce}
            sbtCacheRevision={sbtCacheRevision}
            {...getResponseCardProps()}
          />
        </div>
      ))}
    </>
  );
};

export default SurveyResultsIndividualResponseBody;
