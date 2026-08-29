import type { ResponseSlice, UnknownRecord } from './surveyToolTypes';

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

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
    const includeAiProvenance = interviewProvenanceRecord.includeAiProvenance !== false;
    const responderName = String(interviewProvenanceRecord.responderName || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 160);
    const interviewProvenance = includeAiProvenance && rawInterviewProvenance && typeof rawInterviewProvenance === 'object'
      ? {
          version: 1,
          source: {
            platform: String(interviewSource.platform || 'other').slice(0, 64),
            modelId: String(interviewSource.modelId || '').slice(0, 256),
            verification: 'self_reported',
          },
          promptVersion: String(rawInterviewProvenance.promptVersion || '').slice(0, 128),
          questionSetHash: String(rawInterviewProvenance.questionSetHash || '').slice(0, 256),
          originalPrediction: rawInterviewProvenance.originalPrediction || null,
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
