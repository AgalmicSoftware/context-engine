const normalizeQuestionType = (questionType: any): string => {
  if (typeof questionType !== 'string') return '';
  return questionType.trim().toLowerCase();
};

export const isFreeformBlankAnswer = (questionType: any, parsedResponse: any): boolean => {
  const normalizedQuestionType = normalizeQuestionType(questionType);
  if (!normalizedQuestionType) return false;
  if (normalizedQuestionType !== 'freeform') return false;
  const answerValue = parsedResponse?.answer?.value;
  return typeof answerValue === 'string' && answerValue.trim() === '';
};
