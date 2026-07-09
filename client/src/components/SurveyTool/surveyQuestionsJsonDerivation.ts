import { getConvictionFromResponse, getImportanceFromResponse } from './surveyToolUtils';

type UnknownRecord = Record<string, unknown>;
type IndexedValue = Record<string | number, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const buildSurveyQuestionsJson = ({
  singleQuestionMode = false,
  questionPool = [],
}: {
  singleQuestionMode?: boolean;
  questionPool?: unknown;
} = {}) => {
  if (singleQuestionMode) {
    return (questionPool as IndexedValue | null | undefined)?.[0] || {};
  }
  return questionPool || [];
};

export const shouldUseSubmittedResponseJson = ({
  viewAddress = '',
  responderAddress = '',
  parsedViewAddressAnswers = null,
  isEditing = true,
  userAnswers = null,
}: {
  viewAddress?: unknown;
  responderAddress?: unknown;
  parsedViewAddressAnswers?: unknown;
  isEditing?: unknown;
  userAnswers?: unknown;
} = {}) => !!(((viewAddress || responderAddress) && parsedViewAddressAnswers) || (!isEditing && userAnswers));

const withConvictionImportance = (response: UnknownRecord) => {
  const convictionValue = getConvictionFromResponse(response);
  const importanceValue = getImportanceFromResponse(response);
  return {
    ...response,
    conviction: convictionValue !== null ? convictionValue : null,
    importance: importanceValue !== null ? importanceValue : null,
  };
};

export const buildSubmittedResponseJson = ({
  rawResponse = null,
  singleQuestionMode = false,
}: {
  rawResponse?: unknown;
  singleQuestionMode?: boolean;
} = {}) => {
  if (!rawResponse) return {};

  if (singleQuestionMode) {
    if (isRecord(rawResponse)) {
      return withConvictionImportance(rawResponse);
    }
    return rawResponse;
  }

  if (isRecord(rawResponse) && Array.isArray(rawResponse.responses)) {
    const baseConviction = getConvictionFromResponse(rawResponse);
    const baseImportance = getImportanceFromResponse(rawResponse);
    const processed: UnknownRecord & {
      conviction?: unknown;
      importance?: unknown;
      responses: unknown[];
    } = {
      ...rawResponse,
      responses: rawResponse.responses.map((response) => withConvictionImportance(response as UnknownRecord)),
    };
    if (baseConviction !== null && processed.conviction === undefined) {
      processed.conviction = baseConviction;
    }
    if (baseImportance !== null && processed.importance === undefined) {
      processed.importance = baseImportance;
    }
    return processed;
  }

  return rawResponse;
};

export const buildSurveyDefinitionJson = ({
  isStandalone = false,
  singleQuestionMode = false,
  surveys = null,
  surveyIndex = null,
  questionPool = [],
}: {
  isStandalone?: boolean;
  singleQuestionMode?: boolean;
  surveys?: unknown;
  surveyIndex?: unknown;
  questionPool?: unknown;
} = {}) => {
  if (isStandalone || singleQuestionMode || !surveys || surveyIndex === null) {
    return {};
  }

  const currentSurvey = (surveys as IndexedValue)[surveyIndex as string | number];
  if (!currentSurvey) {
    return {};
  }

  const surveyDetails = { ...(currentSurvey as UnknownRecord) };

  if (Array.isArray(surveyDetails.questionIDs) && Array.isArray(questionPool)) {
    const questionMap = new Map(
      questionPool.map((question) => {
        const questionRecord = question as UnknownRecord & { id: { toLowerCase: () => string } };
        return [questionRecord.id.toLowerCase(), question];
      }),
    );

    surveyDetails.questions = surveyDetails.questionIDs.map((id) => {
      const questionData = questionMap.get((id as { toLowerCase: () => string }).toLowerCase());
      return questionData || { id, error: 'Question details not found in pool' };
    });

    delete surveyDetails.questionIDs;
  }

  return surveyDetails;
};
