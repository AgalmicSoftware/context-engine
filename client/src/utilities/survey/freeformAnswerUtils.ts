type CacheRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is CacheRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const normalizeQuestionType = (questionType: unknown): string => {
  if (typeof questionType !== 'string') return '';
  return questionType.trim().toLowerCase();
};

const readAnswerValue = (parsedResponse: unknown): unknown => {
  if (!isRecord(parsedResponse)) return undefined;
  const answer = parsedResponse.answer;
  if (!isRecord(answer)) return undefined;
  return answer.value;
};

export const isFreeformBlankAnswer = (questionType: unknown, parsedResponse: unknown): boolean => {
  const normalizedQuestionType = normalizeQuestionType(questionType);
  if (!normalizedQuestionType) return false;
  if (normalizedQuestionType !== 'freeform') return false;
  const answerValue = readAnswerValue(parsedResponse);
  return typeof answerValue === 'string' && answerValue.trim() === '';
};
