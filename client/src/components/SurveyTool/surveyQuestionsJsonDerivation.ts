import {
  getConvictionFromResponse,
  getImportanceFromResponse,
} from './surveyToolUtils.js';

type UnknownRecord = Record<string, any>;

export const buildSurveyQuestionsJson = ({
  singleQuestionMode = false,
  questionPool = [],
}: {
  singleQuestionMode?: boolean;
  questionPool?: any;
} = {}) => {
  if (singleQuestionMode) {
    return questionPool?.[0] || {};
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
  viewAddress?: any;
  responderAddress?: any;
  parsedViewAddressAnswers?: any;
  isEditing?: any;
  userAnswers?: any;
} = {}) => !!(
  ((viewAddress || responderAddress) && parsedViewAddressAnswers) ||
  (!isEditing && userAnswers)
);

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
  rawResponse?: any;
  singleQuestionMode?: boolean;
} = {}) => {
  if (!rawResponse) return {};

  if (singleQuestionMode) {
    if (typeof rawResponse === 'object' && rawResponse !== null && !Array.isArray(rawResponse)) {
      return withConvictionImportance(rawResponse);
    }
    return rawResponse;
  }

  if (rawResponse && Array.isArray(rawResponse.responses)) {
    const baseConviction = getConvictionFromResponse(rawResponse);
    const baseImportance = getImportanceFromResponse(rawResponse);
    const processed = {
      ...rawResponse,
      responses: rawResponse.responses.map((response: UnknownRecord) => withConvictionImportance(response)),
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
  surveys?: any;
  surveyIndex?: any;
  questionPool?: any;
} = {}) => {
  if (isStandalone || singleQuestionMode || !surveys || surveyIndex === null) {
    return {};
  }

  const currentSurvey = surveys[surveyIndex];
  if (!currentSurvey) {
    return {};
  }

  const surveyDetails = { ...currentSurvey };

  if (Array.isArray(surveyDetails.questionIDs) && Array.isArray(questionPool)) {
    const questionMap = new Map(questionPool.map((question) => [question.id.toLowerCase(), question]));

    surveyDetails.questions = surveyDetails.questionIDs.map((id: any) => {
      const questionData = questionMap.get(id.toLowerCase());
      return questionData || { id, error: 'Question details not found in pool' };
    });

    delete surveyDetails.questionIDs;
  }

  return surveyDetails;
};
