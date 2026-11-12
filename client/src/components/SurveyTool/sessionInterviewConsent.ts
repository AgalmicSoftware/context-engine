import { normalizeQuestionIdKey } from './surveyToolSignatures';

export type InterviewConsentOverrides = {
  includeAiProvenance?: boolean;
  includePredictionComparison?: boolean;
  includeResponderName?: boolean;
  // Also keep the AI's drafted text where only the session's config admins can read it.
  includeDraftText?: boolean;
  // The research detail shown when the participant chose; a later config can't widen it.
  researchDetail?: 'minimal' | 'full';
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
    // A saved response says so with draftTextConsent; without it, the text was never kept.
    includeDraftText:
      record.includeDraftText === true || (record.includeDraftText !== false && record.draftTextConsent === true),
  };
};

type ConsentDraft = { questionId: string };

/** The consent boxes' states over these drafts: saved choices where saved, else these defaults. */
export const summarizeInterviewConsent = ({
  drafts,
  saved,
  overrides,
  defaults,
}: {
  drafts: ConsentDraft[];
  saved: Record<string, Record<string, unknown>>;
  overrides: InterviewConsentOverrides;
  defaults: { ai: boolean; comparison: boolean; name: boolean; draftText: boolean };
}) => {
  const choice = (read: (record: Record<string, unknown>) => boolean, fallback: boolean, override?: boolean) =>
    summarizeConsentChoice(
      drafts.map((draft) => (saved[draft.questionId] ? read(saved[draft.questionId]) : fallback)),
      override,
    );
  return {
    aiChoice: choice(
      (record) => resolveConsentFlags(record).includeAiProvenance,
      defaults.ai,
      overrides.includeAiProvenance,
    ),
    comparisonChoice: choice(
      (record) => resolveConsentFlags(record).includePredictionComparison,
      defaults.comparison,
      overrides.includePredictionComparison,
    ),
    nameChoice: choice((record) => !!record.responderName, defaults.name, overrides.includeResponderName),
    draftTextChoice: choice(
      (record) => resolveConsentFlags(record).includeDraftText,
      defaults.draftText,
      overrides.includeDraftText,
    ),
    hasSavedName: drafts.some((draft) => !!saved[draft.questionId]?.responderName),
    hasSavedAi: drafts.some((draft) => resolveConsentFlags(saved[draft.questionId]).includeAiProvenance),
  };
};

export const consentSignature = (value: unknown, responderName?: unknown): string => {
  const record = asRecord(value);
  const source = asRecord(record.source);
  const {
    includeAiProvenance: includeAi,
    includePredictionComparison: includeComparison,
    includeDraftText,
  } = resolveConsentFlags(record);
  return JSON.stringify([
    String(responderName ?? record.responderName ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 160),
    includeAi,
    includeComparison,
    includeComparison && includeDraftText,
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

const SAVED_CONSENT_KEYS = ['consentSavedAt', 'consentStorageRefId', 'consentReadAuthority'];
const AI_ATTRIBUTION_KEYS = ['source', 'promptVersion', 'questionSetHash'];
const PREDICTION_RESEARCH_KEYS = [
  'questionId',
  'selection',
  'originalPrediction',
  'predictionRevisions',
  'userEditedFields',
  'unselectedDrafts',
  'submissionValueSnapshot',
  'predictionComparison',
  'researchTier',
  'draftOrigin',
  'predictionCondition',
  'blindAnswer',
  'revealedAt',
  'confidenceMeaning',
  'includeDraftText',
  'draftTextConsent',
];
const DRAFT_TEXT_KEYS = ['includeDraftText', 'draftTextConsent'];

// Undoing or restoring edits never makes a response more disclosing: a name, AI attribution
// or research consent that was withdrawn stays withdrawn from the consent it had before.
export const keepConsentWithdrawals = (before: unknown, attempted: unknown): Record<string, unknown> | null => {
  const prior = asRecord(before);
  const tried = asRecord(attempted);
  if (!Object.keys(prior).length || !Object.keys(tried).length) return null;
  const priorFlags = resolveConsentFlags(prior);
  const triedFlags = resolveConsentFlags(tried);
  const withdrawName = !!prior.responderName && !tried.responderName;
  const withdrawAi = priorFlags.includeAiProvenance && !triedFlags.includeAiProvenance;
  const withdrawResearch = priorFlags.includePredictionComparison && !triedFlags.includePredictionComparison;
  const withdrawDraftText = priorFlags.includeDraftText && !triedFlags.includeDraftText;
  if (!withdrawName && !withdrawAi && !withdrawResearch && !withdrawDraftText) return null;
  const kept: Record<string, unknown> = {
    ...prior,
    version: 1,
    includeAiProvenance: priorFlags.includeAiProvenance && !withdrawAi,
    includePredictionComparison: priorFlags.includePredictionComparison && !withdrawResearch,
  };
  [
    ...SAVED_CONSENT_KEYS,
    ...(withdrawName ? ['responderName'] : []),
    ...(withdrawAi ? AI_ATTRIBUTION_KEYS : []),
    ...(withdrawResearch ? PREDICTION_RESEARCH_KEYS : []),
    ...(withdrawDraftText ? DRAFT_TEXT_KEYS : []),
  ].forEach((key) => delete kept[key]);
  return kept;
};
