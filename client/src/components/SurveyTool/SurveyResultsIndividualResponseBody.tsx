import React from 'react';

import SingleQuestionResponse from './SingleQuestionResponse';
import { getSurveyResponseQuestionId } from './surveyResultsHelpers.js';

export type SurveyResultsIndividualResponseRecord = Record<string, unknown>;

export type SurveyResultsIndividualQuestionRecord = SurveyResultsIndividualResponseRecord & {
  id?: unknown;
  prompt?: React.ReactNode;
  sessionSlug?: unknown;
  type?: unknown;
};

export type SurveyResultsIndividualEncryptedFieldRecord = SurveyResultsIndividualResponseRecord & {
  encrypted?: unknown;
  encryptedPortion?: unknown;
  value?: unknown;
};

export type SurveyResultsIndividualAnswerRecord = SurveyResultsIndividualResponseRecord & {
  additional?: SurveyResultsIndividualEncryptedFieldRecord | null;
  answer?: SurveyResultsIndividualEncryptedFieldRecord | null;
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

export type SurveyResultsIndividualResponsePayload = SurveyResultsIndividualResponseRecord & {
  responses?: SurveyResultsIndividualAnswerRecord[];
};

export type SurveyResultsIndividualResponseListEntry = SurveyResultsIndividualResponseRecord & {
  response?: SurveyResultsIndividualResponsePayload | null;
  responder: string;
  surveyId?: unknown;
};

export type SurveyResultsIndividualResponseCardDisplayProps = Partial<
  Record<
    | 'aggregatorContainerClassName'
    | 'aggregatorFreeformAnswerClassName'
    | 'aggregatorParagraphClassName'
    | 'aggregatorTextClassName'
    | 'bodyClassName'
    | 'containerClassName'
    | 'iconButtonClassName'
    | 'linksContainerClassName',
    string
  >
>;

export type SurveyResultsIndividualLockedResponseKeyArgs = {
  questionId?: unknown;
  responder?: unknown;
  response?: SurveyResultsIndividualAnswerRecord | null;
  surveyId?: unknown;
};

export type SurveyResultsIndividualDecryptedOverrideArgs = {
  key: string;
  response: SurveyResultsIndividualAnswerRecord;
};

export type SurveyResultsIndividualResponseDisplayRow = {
  activeSessionSlug: string;
  displayResponse: SurveyResultsIndividualAnswerRecord | null;
  isOwnResponse: boolean;
  question: SurveyResultsIndividualQuestionRecord;
  questionId: string;
  rowKey: number;
};

export type SurveyResultsIndividualResponseBodyProps = {
  account?: string;
  applyDecryptedOverrideToResponse: (
    args: SurveyResultsIndividualDecryptedOverrideArgs,
  ) => SurveyResultsIndividualAnswerRecord | null;
  currentSurveyId?: string;
  effectiveSlug?: string;
  getFallbackQuestion: (questionId: unknown, mode?: unknown) => SurveyResultsIndividualQuestionRecord;
  getLockedResponseKey: (args: SurveyResultsIndividualLockedResponseKeyArgs) => string;
  getResponseCardProps: () => SurveyResultsIndividualResponseCardDisplayProps;
  network?: SurveyResultsIndividualResponseRecord | null;
  preNetworkQuestions?: Record<string, SurveyResultsIndividualQuestionRecord>;
  questionResponsesNonce?: unknown;
  questionsCacheNonce?: unknown;
  response?: SurveyResultsIndividualResponseListEntry;
  sbtCacheRevision?: unknown;
  styleMap: Record<string, string>;
};

const toIndividualAnswerRecord = (value: unknown): SurveyResultsIndividualAnswerRecord | null =>
  value && typeof value === 'object' ? (value as SurveyResultsIndividualAnswerRecord) : null;

const toIndividualAnswerRows = (value: unknown): SurveyResultsIndividualAnswerRecord[] =>
  Array.isArray(value)
    ? value.map(toIndividualAnswerRecord).filter((row): row is SurveyResultsIndividualAnswerRecord => !!row)
    : [];

const toDisplayString = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

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
  const responseRows = toIndividualAnswerRows(response.response?.responses);

  return responseRows.map((answerItem, aIndex) => {
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
      activeSessionSlug: toDisplayString(question?.sessionSlug) || effectiveSlug,
      displayResponse,
      isOwnResponse: account.toLowerCase() === response.responder.toLowerCase(),
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
