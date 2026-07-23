import type { UnknownRecord } from './surveyToolTypes';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';

type SubmittedQuestionResponse = UnknownRecord & {
  answer?: UnknownRecord;
  questionID?: string;
};

type SubmittedSurveyResponse = UnknownRecord & {
  responses?: SubmittedQuestionResponse[];
};

type SubmitTransaction = UnknownRecord & {
  hash?: unknown;
  transactionHash?: unknown;
  wait?: () => Promise<unknown>;
};

const isObjectRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function resolveSurveySubmitSessionTarget({
  sessionSlug,
  sessionConfig,
}: {
  sessionSlug: unknown;
  sessionConfig: unknown;
}): string | UnknownRecord {
  const slug = String(sessionSlug || '')
    .trim()
    .toLowerCase();
  const config = isObjectRecord(sessionConfig) ? sessionConfig : {};
  const projection = resolveSessionCapabilityProjection(config);
  if (projection.source === 'invalid_profile' || projection.source === 'missing') {
    throw new Error('The session mode profile is missing, invalid, or unsupported.');
  }
  if (!projection.isWorkerCanonical) return slug;
  return {
    ...config,
    slug: String(config.slug || slug)
      .trim()
      .toLowerCase(),
  };
}

export interface FilteredSubmitPayload {
  questionIds: string[];
  questionResponses: SubmittedQuestionResponse[];
  surveyId: string;
  surveyResponse: SubmittedSurveyResponse | null;
}

export function filterChangedResponsesForSubmit(opts: {
  data: unknown;
  changedSet: Set<string>;
  singleQuestionMode: boolean;
  isStandalone: boolean;
  surveyId: string;
  HashZero: string;
}): FilteredSubmitPayload {
  const { data, changedSet, singleQuestionMode, isStandalone, surveyId, HashZero } = opts;
  const dataRecord = isObjectRecord(data) ? (data as SubmittedSurveyResponse & SubmittedQuestionResponse) : null;

  if (singleQuestionMode) {
    const qid = typeof dataRecord?.questionID === 'string' ? dataRecord.questionID : '';
    if (!dataRecord || !qid || !changedSet.has(qid)) {
      throw new Error('No new or changed responses to submit.');
    }
    return {
      questionIds: [qid],
      questionResponses: [dataRecord],
      surveyId: HashZero,
      surveyResponse: null,
    };
  }

  const all = Array.isArray(dataRecord?.responses) ? dataRecord.responses : [];
  const filtered = all.filter((response) => response && response.questionID && changedSet.has(response.questionID));

  if (filtered.length === 0) {
    throw new Error('No new or changed responses to submit.');
  }

  return {
    questionIds: filtered.map((response) => response.questionID || ''),
    questionResponses: filtered,
    surveyId: isStandalone ? HashZero : surveyId,
    surveyResponse: isStandalone ? null : { ...(dataRecord || {}), responses: filtered },
  };
}

export function ensureIdentifierHash(
  value: unknown,
  deps: {
    hashIdentifier?: (v: unknown) => string;
    isHexString?: (v: unknown, len: number) => boolean;
    id?: (v: string) => string;
    HashZero: string;
    warn?: (msg: string, err?: unknown) => void;
  },
): string {
  const { hashIdentifier, isHexString, id, HashZero, warn } = deps;

  try {
    if (typeof hashIdentifier === 'function') {
      return hashIdentifier(value);
    }
  } catch (error) {
    warn?.('SurveyTool: fallback', error);
  }

  try {
    if (typeof isHexString === 'function' && isHexString(value, 32)) {
      return String(value).toLowerCase();
    }
  } catch (error) {
    warn?.('SurveyTool: fallback', error);
  }

  const stringValue = value === null || value === undefined ? '' : String(value);
  if (stringValue.trim() === '') return HashZero;
  if (typeof id !== 'function') {
    throw new Error('ensureIdentifierHash: id() is required for non-empty values');
  }
  return id(stringValue);
}

export interface SubmitReceiptResult {
  receipt: unknown;
  submittedPayloadMeta: {
    __ceQuestionResponses: SubmittedQuestionResponse[];
    __ceSurveyResponse: SubmittedSurveyResponse | null;
    __ceSurveyId: string | null;
    __ceSubmissionGroupKey: string;
  };
}

type NormalizedSubmitReceipt = UnknownRecord & SubmitReceiptResult['submittedPayloadMeta'];

export async function normalizeSubmitReceipt(
  tx: unknown,
  opts: {
    questionResponses: SubmittedQuestionResponse[];
    surveyResponse: SubmittedSurveyResponse | null;
    surveyId: string | null;
    submissionGroupKey: string;
    deepClone: <T>(obj: T) => T;
  },
): Promise<NormalizedSubmitReceipt> {
  const { questionResponses, surveyResponse, surveyId, submissionGroupKey, deepClone } = opts;

  const submittedPayloadMeta: SubmitReceiptResult['submittedPayloadMeta'] = {
    __ceQuestionResponses: deepClone(questionResponses || []),
    __ceSurveyResponse: surveyResponse ? deepClone(surveyResponse) : null,
    __ceSurveyId: surveyId || null,
    __ceSubmissionGroupKey: submissionGroupKey,
  };

  const txRecord = isObjectRecord(tx) ? (tx as SubmitTransaction) : null;

  if (txRecord && typeof txRecord.wait === 'function') {
    const receipt = await txRecord.wait();
    const receiptRecord = isObjectRecord(receipt) ? receipt : null;
    if (!receipt || (receiptRecord && receiptRecord.status !== undefined && receiptRecord.status !== 1)) {
      throw new Error('Submission failed on-chain.');
    }
    return { ...(receiptRecord || {}), ...submittedPayloadMeta };
  }

  if (typeof tx === 'string' && tx.startsWith('0x') && tx.length >= 66) {
    return { transactionHash: tx, ...submittedPayloadMeta };
  }

  if (txRecord && (txRecord.transactionHash || txRecord.hash)) {
    return { ...txRecord, ...submittedPayloadMeta };
  }

  if (
    txRecord?.workerCanonicalSubmission === true &&
    Array.isArray(txRecord.storageRefs) &&
    txRecord.storageRefs.length > 0
  ) {
    return { ...txRecord, ...submittedPayloadMeta };
  }

  throw new Error('No transaction was sent.');
}
