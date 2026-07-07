type PendingQuestionMetadataRecord = Record<string, unknown>;

export const isPendingQuestionMetadataPlaceholder = (value: unknown): boolean =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (value as PendingQuestionMetadataRecord).__ceQuestionMetadataPending === true;

export const filterPendingQuestionMetadataPlaceholders = <T>(questions: T[] | null | undefined): T[] => {
  const normalizedQuestions = Array.isArray(questions) ? questions : [];
  return normalizedQuestions.filter((question) => !isPendingQuestionMetadataPlaceholder(question));
};
