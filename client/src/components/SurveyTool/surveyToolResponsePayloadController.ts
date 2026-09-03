import type { ResponseSlice, UnknownRecord } from './surveyToolTypes';

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const hasOwn = (value: UnknownRecord, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

const buildStableComparableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(buildStableComparableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as UnknownRecord)
      .sort()
      .reduce<UnknownRecord>((result, key) => {
        result[key] = buildStableComparableValue((value as UnknownRecord)[key]);
        return result;
      }, {});
  }
  return value === undefined ? null : value;
};

const responseValuesMatch = (left: unknown, right: unknown): boolean =>
  JSON.stringify(buildStableComparableValue(left)) === JSON.stringify(buildStableComparableValue(right));

const buildRedactedComparisonValue = (): UnknownRecord => ({
  redacted: true,
  reason: 'encrypted_field',
});

const normalizeResearchCoverageCount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.min(1_000_000, Math.floor(number));
};

const buildSubmittedResearchCoverage = (value: unknown): UnknownRecord | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const coverage = asRecord(value);
  const searchScopeNote = String(coverage.searchScopeNote || '')
    .trim()
    .slice(0, 500);
  return {
    historyChatsSearched: normalizeResearchCoverageCount(coverage.historyChatsSearched),
    historyChatsUsed: normalizeResearchCoverageCount(coverage.historyChatsUsed),
    memoryItemsSearched: normalizeResearchCoverageCount(coverage.memoryItemsSearched),
    memoryItemsUsed: normalizeResearchCoverageCount(coverage.memoryItemsUsed),
    connectedSourcesSearched: normalizeResearchCoverageCount(coverage.connectedSourcesSearched),
    connectedSourcesUsed: normalizeResearchCoverageCount(coverage.connectedSourcesUsed),
    userStatementsUsed: normalizeResearchCoverageCount(coverage.userStatementsUsed),
    ...(searchScopeNote ? { searchScopeNote } : {}),
  };
};

type ResponseFieldState = UnknownRecord & {
  value?: unknown;
  encrypted?: unknown;
  hash?: unknown;
  encryptedPortion?: unknown;
  audienceMode?: unknown;
};

type SurveyResponsePayloadState = Omit<ResponseSlice, 'answers' | 'additionalComments'> & {
  answers?: Record<string, ResponseFieldState> | null;
  additionalComments?: Record<string, ResponseFieldState> | null;
  interviewProvenance?: Record<string, UnknownRecord> | null;
};

export const captureInterviewPredictionComparisonSubmissions = (
  slice: ResponseSlice,
  questionIds: Iterable<string>,
): ResponseSlice => {
  const provenance = asRecord(slice.interviewProvenance);
  let nextProvenance: UnknownRecord | null = null;

  for (const rawQuestionId of questionIds) {
    const questionId = String(rawQuestionId || '');
    const record = asRecord(provenance[questionId]);
    if (record.includePredictionComparison !== true) continue;

    if (!nextProvenance) nextProvenance = { ...provenance };
    nextProvenance[questionId] = {
      ...record,
      submissionValueSnapshot: {
        answer: asRecord(slice.answers?.[questionId]).value ?? '',
        additionalComments: asRecord(slice.additionalComments?.[questionId]).value ?? '',
      },
    };
  }

  return nextProvenance ? { ...slice, interviewProvenance: nextProvenance } : slice;
};

type ResponseQuestionSource = UnknownRecord & {
  id: string;
  type?: unknown;
  prompt?: unknown;
  sessionName?: unknown;
};

type SurveyMetadataForJson = {
  surveyTitle: string | null;
  sessionName: string;
};

type ResponsePayloadField = UnknownRecord & {
  value: unknown;
  encrypted: boolean;
  encryptionAudience?: unknown;
  encryptionGateId?: unknown;
  audienceMode?: unknown;
  hash: unknown;
  encryptedPortion: unknown;
};

type ResponsePayloadEntry = UnknownRecord & {
  questionID: string;
  responder?: string;
  type?: unknown;
  prompt: string;
  conviction: number | null;
  importance: number | null;
  answer: ResponsePayloadField;
  additional: ResponsePayloadField;
  interviewProvenance?: UnknownRecord;
  responderName?: string;
};

type ResponsePayload = UnknownRecord & {
  responses?: ResponsePayloadEntry[];
  answer?: ResponsePayloadField;
  additional?: ResponsePayloadField;
};

export interface BuildResponsePayloadOptions {
  // Mode flags
  isStandalone: boolean;
  singleQuestionMode: boolean;

  // Survey identity
  surveyId: string | undefined;
  account: string;
  surveyIndex: number;

  // State slices
  surveyResponseState: ResponseSlice | null;
  questionPool: unknown[];
  pileQuestions: unknown[];

  // DI callbacks (from the class instance)
  resolveFieldEncryptionAudience: (field: ResponseFieldState, qid: string, fieldKey: string) => unknown;
  getQuestionEncryptionGates: (q: ResponseQuestionSource) => unknown[];
  resolveFieldEncryptionGateId: (field: ResponseFieldState, qid: string | null, fieldKey: string) => unknown;
  normalizeFieldAudienceMode: (mode: unknown, fieldKey: string, field: ResponseFieldState) => unknown;
  getSurveyMetadataForJson: (surveyHash: string) => SurveyMetadataForJson | null;
  resolveSessionContext: () => { sessionName: string };

  // Imported helpers (already pure, just pass them through)
  getConvictionFromSlice: (state: ResponseSlice, qid: string) => number | null;
  getImportanceFromSlice: (state: ResponseSlice, qid: string) => number | null;
  sanitizeQuestionPromptForResponsePayload: (q: ResponseQuestionSource, opts: { isLocked: boolean }) => string;
}

export const buildResponsePayload = (opts: BuildResponsePayloadOptions): ResponsePayload => {
  let surveyIndex = opts.surveyIndex;
  surveyIndex = opts.isStandalone || opts.singleQuestionMode ? 0 : surveyIndex;
  void surveyIndex;

  const surveyHash = opts.isStandalone || opts.singleQuestionMode ? undefined : opts.surveyId;

  const surveyResponseState = opts.surveyResponseState as SurveyResponsePayloadState | null;
  const poolFromState = Array.isArray(opts.questionPool) ? (opts.questionPool as ResponseQuestionSource[]) : [];
  const pilePool = Array.isArray(opts.pileQuestions) ? (opts.pileQuestions as ResponseQuestionSource[]) : [];

  if (!surveyResponseState) return {};

  let candidateQuestions: ResponseQuestionSource[] = [];
  if (poolFromState.length > 0) {
    candidateQuestions = poolFromState;
  } else if (pilePool.length > 0) {
    candidateQuestions = pilePool;
  } else {
    const ids = new Set([
      ...Object.keys(surveyResponseState.answers || {}),
      ...Object.keys(surveyResponseState.additionalComments || {}),
      ...Object.keys(surveyResponseState.importance || {}),
      ...Object.keys(surveyResponseState.conviction || {}),
    ]);
    candidateQuestions = Array.from(ids).map((id) => ({ id, type: 'freeform', prompt: '' }));
  }

  const hasMainAnswer = (ans: unknown) =>
    ans !== undefined && ans !== null && ans !== '' && (!Array.isArray(ans) || ans.length > 0);

  const hasAdditional = (val: unknown) => {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') return Object.keys(val).length > 0;
    return true;
  };
  const hasConviction = (qid: string) => opts.getConvictionFromSlice(surveyResponseState, qid) !== null;

  const shouldFilterByAnswered = opts.isStandalone || opts.singleQuestionMode || poolFromState.length === 0;

  const answeredQuestions = shouldFilterByAnswered
    ? candidateQuestions.filter((q) => {
        const a = surveyResponseState.answers?.[q.id]?.value;
        const add = surveyResponseState.additionalComments?.[q.id]?.value;
        return hasMainAnswer(a) || hasAdditional(add) || hasConviction(q.id);
      })
    : candidateQuestions;

  const responses = answeredQuestions.map((q) => {
    const answer = surveyResponseState.answers?.[q.id] || {};
    const additional = surveyResponseState.additionalComments?.[q.id] || {};
    const answerAudience = opts.resolveFieldEncryptionAudience(answer, q.id, 'answer');
    const additionalAudience = opts.resolveFieldEncryptionAudience(additional, q.id, 'additional');
    const additionalHasContent = hasAdditional(additional.value);
    const additionalEncrypted = additionalHasContent && !!additional.encrypted;
    const conviction = opts.getConvictionFromSlice(surveyResponseState, q.id);
    const importance = opts.getImportanceFromSlice(surveyResponseState, q.id);
    const importanceForPayload = importance !== null ? importance : conviction;
    const rawInterviewProvenance = surveyResponseState.interviewProvenance?.[q.id];
    const interviewProvenanceRecord = asRecord(rawInterviewProvenance);
    const interviewSource = asRecord(interviewProvenanceRecord.source);
    const researchCoverage = buildSubmittedResearchCoverage(interviewSource.researchCoverage);
    const includeAiProvenance = interviewProvenanceRecord.includeAiProvenance !== false;
    const includePredictionComparison = interviewProvenanceRecord.includePredictionComparison === true;
    const originalPrediction = asRecord(interviewProvenanceRecord.originalPrediction);
    const submissionValueSnapshot = asRecord(interviewProvenanceRecord.submissionValueSnapshot);
    const responderName = String(interviewProvenanceRecord.responderName || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 160);
    const originalComparisonValues = {
      answer: hasOwn(originalPrediction, 'answer') ? originalPrediction.answer : null,
      additionalComments: hasOwn(originalPrediction, 'additionalComments') ? originalPrediction.additionalComments : '',
      importance: hasOwn(originalPrediction, 'importance') ? originalPrediction.importance : null,
      conviction: hasOwn(originalPrediction, 'conviction') ? originalPrediction.conviction : null,
    };
    const submittedComparisonValues = {
      answer: hasOwn(submissionValueSnapshot, 'answer') ? submissionValueSnapshot.answer : (answer.value ?? ''),
      additionalComments: hasOwn(submissionValueSnapshot, 'additionalComments')
        ? submissionValueSnapshot.additionalComments
        : (additional.value ?? ''),
      importance: importance !== null ? importance : null,
      conviction: conviction !== null ? conviction : null,
    };
    const comparisonFields = ['answer', 'additionalComments', 'importance', 'conviction'] as const;
    const changedFields = comparisonFields.filter(
      (field) => !responseValuesMatch(originalComparisonValues[field], submittedComparisonValues[field]),
    );
    const redactedFields = [
      ...(answer.encrypted ? ['answer'] : []),
      ...(additionalEncrypted ? ['additionalComments'] : []),
    ];
    const safeOriginalPrediction = includePredictionComparison
      ? {
          answer: answer.encrypted ? buildRedactedComparisonValue() : originalComparisonValues.answer,
          additionalComments: additionalEncrypted
            ? buildRedactedComparisonValue()
            : originalComparisonValues.additionalComments,
          importance: originalComparisonValues.importance,
          conviction: originalComparisonValues.conviction,
          confidence: hasOwn(originalPrediction, 'confidence') ? originalPrediction.confidence : null,
          evidence: redactedFields.length > 0 ? '' : String(originalPrediction.evidence || ''),
        }
      : null;
    const predictionComparison = includePredictionComparison
      ? {
          version: 1,
          original: safeOriginalPrediction,
          submitted: {
            answer: answer.encrypted ? buildRedactedComparisonValue() : submittedComparisonValues.answer,
            additionalComments: additionalEncrypted
              ? buildRedactedComparisonValue()
              : submittedComparisonValues.additionalComments,
            importance: submittedComparisonValues.importance,
            conviction: submittedComparisonValues.conviction,
          },
          changedFields,
          redactedFields,
        }
      : null;
    const interviewProvenance =
      (includeAiProvenance || includePredictionComparison) &&
      rawInterviewProvenance &&
      typeof rawInterviewProvenance === 'object'
        ? {
            version: 1,
            ...(includeAiProvenance
              ? {
                  source: {
                    platform: String(interviewSource.platform || 'other').slice(0, 64),
                    modelId: String(interviewSource.modelId || '').slice(0, 256),
                    verification: 'self_reported',
                    ...(researchCoverage ? { researchCoverage } : {}),
                  },
                  promptVersion: String(rawInterviewProvenance.promptVersion || '').slice(0, 128),
                  questionSetHash: String(rawInterviewProvenance.questionSetHash || '').slice(0, 256),
                }
              : {}),
            ...(safeOriginalPrediction ? { originalPrediction: safeOriginalPrediction } : {}),
            ...(predictionComparison ? { predictionComparison } : {}),
            appliedAt: Number(rawInterviewProvenance.appliedAt || 0) || null,
          }
        : null;

    return {
      questionID: q.id,
      responder: opts.account,
      type: q.type,
      prompt: opts.sanitizeQuestionPromptForResponsePayload(q, {
        isLocked: opts.getQuestionEncryptionGates(q).length > 0,
      }),
      conviction: conviction !== null ? conviction : null,
      importance: importanceForPayload !== null ? importanceForPayload : null,
      answer: {
        value: answer.value !== undefined ? answer.value : '',
        encrypted: !!answer.encrypted,
        encryptionAudience: answerAudience,
        encryptionGateId: answer.encrypted ? opts.resolveFieldEncryptionGateId(answer, q.id, 'answer') : null,
        audienceMode: 'explicit',
        hash: answer.hash || '',
        encryptedPortion: answer.encrypted ? answer.encryptedPortion || '' : '',
      },
      additional: {
        value: additional.value !== undefined ? additional.value : '',
        encrypted: additionalEncrypted,
        encryptionAudience: additionalAudience,
        encryptionGateId: additionalEncrypted
          ? opts.resolveFieldEncryptionGateId(additional, q.id, 'additional')
          : null,
        audienceMode: opts.normalizeFieldAudienceMode(additional?.audienceMode, 'additional', additional),
        hash: additional.hash || '',
        encryptedPortion: additionalEncrypted ? additional.encryptedPortion || '' : '',
      },
      ...(responderName ? { responderName } : {}),
      ...(interviewProvenance ? { interviewProvenance } : {}),
    };
  });

  if (opts.singleQuestionMode) {
    let sessionName = '';
    const qInPool = poolFromState[0];
    if (qInPool?.sessionName) {
      sessionName = qInPool.sessionName as string;
    } else {
      const context = opts.resolveSessionContext();
      sessionName = context?.sessionName || '';
    }

    if (responses.length > 0) {
      return {
        timeStamp: Date.now(),
        sessionName,
        ...responses[0],
      };
    }

    const q = candidateQuestions[0];
    if (q) {
      return {
        timeStamp: Date.now(),
        sessionName,
        questionID: q.id,
        type: q.type,
        prompt: opts.sanitizeQuestionPromptForResponsePayload(q, {
          isLocked: opts.getQuestionEncryptionGates(q).length > 0,
        }),
        conviction: null,
        importance: null,
        answer: { value: '', encrypted: false, hash: '', encryptedPortion: '' },
        additional: { value: '', encrypted: false, hash: '', encryptedPortion: '' },
      };
    }

    return {};
  }

  let surveyTitle = null;
  let sessionName = '';

  if (surveyHash) {
    const meta = opts.getSurveyMetadataForJson(surveyHash);
    surveyTitle = meta?.surveyTitle || null;
    sessionName = meta?.sessionName || '';
  } else {
    const context = opts.resolveSessionContext();
    if (context?.sessionName) sessionName = context.sessionName;
  }

  return {
    ...(surveyTitle ? { surveyTitle } : {}),
    ...(surveyHash !== undefined && { surveyID: surveyHash }),
    responder: opts.account,
    timeStamp: Date.now(),
    sessionName,
    responses,
  };
};
