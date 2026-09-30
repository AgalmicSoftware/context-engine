import { normalizeQuestionIdKey } from './surveyToolSignatures';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const consentSignature = (value: unknown, responderName?: unknown): string => {
  const record = asRecord(value);
  const source = asRecord(record.source);
  const includeAi = record.includeAiProvenance === true || (record.includeAiProvenance !== false && !!record.source);
  const includeComparison =
    record.includePredictionComparison === true ||
    (record.includePredictionComparison !== false && !!record.predictionComparison);
  return JSON.stringify([
    String(responderName ?? record.responderName ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 160),
    includeAi,
    includeComparison,
    ...(includeAi
      ? [
          String(source.platform || 'other'),
          String(source.modelId || ''),
          String(record.promptVersion || ''),
          String(record.questionSetHash || ''),
        ]
      : []),
  ]);
};

export const getChangedInterviewConsentQids = (provenance: unknown, userAnswers: unknown): Set<string> => {
  const saved = asRecord(userAnswers);
  const responses = Array.isArray(saved.responses) ? saved.responses : [saved];
  const savedById = new Map(
    responses.map((value) => {
      const response = asRecord(value);
      return [normalizeQuestionIdKey(response.questionID || response.questionId || response.id), response] as const;
    }),
  );
  const changed = new Set<string>();
  Object.entries(asRecord(provenance)).forEach(([id, record]) => {
    const qid = normalizeQuestionIdKey(id);
    const response = savedById.get(qid) || {};
    if (qid && consentSignature(record) !== consentSignature(response.interviewProvenance, response.responderName))
      changed.add(qid);
  });
  return changed;
};
