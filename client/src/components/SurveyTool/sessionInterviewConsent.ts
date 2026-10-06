import { normalizeQuestionIdKey } from './surveyToolSignatures';

export type InterviewConsentOverrides = {
  includeAiProvenance?: boolean;
  includePredictionComparison?: boolean;
  includeResponderName?: boolean;
};

export const summarizeConsentChoice = (values: boolean[], override?: boolean) => ({
  checked: override ?? (values.length > 0 && values.every(Boolean)),
  mixed: override === undefined && values.some(Boolean) && values.some((value) => !value),
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

// Consent recency follows the saved response, never the time of an AI prediction.
export const buildSavedInterviewConsent = (value: unknown, metadata: unknown = null) => {
  const record = asRecord(value);
  const meta = asRecord(metadata);
  const timestamp = Number(meta.ts ?? meta.timestamp ?? record._responseTimestamp ?? record.timeStamp ?? 0) || 0;
  return {
    ...asRecord(record.interviewProvenance),
    responderName: record.responderName || '',
    consentSavedAt: timestamp > 0 && timestamp < 1e12 ? timestamp * 1000 : timestamp,
    consentStorageRefId: String(meta.storageRefId ?? record._responseStorageRefId ?? ''),
    ...(record._consentOwnRead === true ? { consentReadAuthority: 'own' } : {}),
  };
};

export const resolveConsentFlags = (value: unknown) => {
  const record = asRecord(value);
  return {
    includeAiProvenance:
      record.includeAiProvenance === true || (record.includeAiProvenance !== false && !!record.source),
    includePredictionComparison:
      record.includePredictionComparison === true ||
      (record.includePredictionComparison !== false && !!record.predictionComparison),
  };
};

export const consentSignature = (value: unknown, responderName?: unknown): string => {
  const record = asRecord(value);
  const source = asRecord(record.source);
  const { includeAiProvenance: includeAi, includePredictionComparison: includeComparison } =
    resolveConsentFlags(record);
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

export const getChangedInterviewConsentQids = (
  provenance: unknown,
  userAnswers: unknown,
  savedConsent: unknown = null,
): Set<string> => {
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
    const response = savedById.get(qid);
    const baseline = asRecord(savedConsent);
    if (!response && !Object.hasOwn(baseline, qid)) return;
    const savedSignature = Object.hasOwn(baseline, qid)
      ? consentSignature(baseline[qid])
      : consentSignature(response?.interviewProvenance, response?.responderName);
    if (qid && consentSignature(record) !== savedSignature) changed.add(qid);
  });
  return changed;
};
