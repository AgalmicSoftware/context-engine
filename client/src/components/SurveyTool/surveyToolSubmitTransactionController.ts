export interface FilteredSubmitPayload {
  questionIds: string[];
  questionResponses: any[];
  surveyId: string;
  surveyResponse: any | null;
}

export function filterChangedResponsesForSubmit(opts: {
  data: any;
  changedSet: Set<string>;
  singleQuestionMode: boolean;
  isStandalone: boolean;
  surveyId: string;
  HashZero: string;
}): FilteredSubmitPayload {
  const {
    data,
    changedSet,
    singleQuestionMode,
    isStandalone,
    surveyId,
    HashZero,
  } = opts;

  if (singleQuestionMode) {
    const qid = data && data.questionID;
    if (!qid || !changedSet.has(qid)) {
      throw new Error('No new or changed responses to submit.');
    }
    return {
      questionIds: [qid],
      questionResponses: [data],
      surveyId: HashZero,
      surveyResponse: null,
    };
  }

  const all = (data && Array.isArray(data.responses)) ? data.responses : [];
  const filtered = all.filter((response: any) => (
    response && response.questionID && changedSet.has(response.questionID)
  ));

  if (filtered.length === 0) {
    throw new Error('No new or changed responses to submit.');
  }

  return {
    questionIds: filtered.map((response: any) => response.questionID),
    questionResponses: filtered,
    surveyId: isStandalone ? HashZero : surveyId,
    surveyResponse: isStandalone ? null : { ...data, responses: filtered },
  };
}

export function ensureIdentifierHash(
  value: any,
  deps: {
    hashIdentifier?: (v: any) => string;
    isHexString?: (v: any, len: number) => boolean;
    id?: (v: string) => string;
    HashZero: string;
    warn?: (msg: string, err?: unknown) => void;
  },
): string {
  const {
    hashIdentifier,
    isHexString,
    id,
    HashZero,
    warn,
  } = deps;

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

  const stringValue = (value === null || value === undefined) ? '' : String(value);
  if (stringValue.trim() === '') return HashZero;
  if (typeof id !== 'function') {
    throw new Error('ensureIdentifierHash: id() is required for non-empty values');
  }
  return id(stringValue);
}

export interface SubmitReceiptResult {
  receipt: any;
  submittedPayloadMeta: {
    __ceQuestionResponses: any[];
    __ceSurveyResponse: any | null;
    __ceSurveyId: string | null;
    __ceSubmissionGroupKey: string;
  };
}

export async function normalizeSubmitReceipt(
  tx: any,
  opts: {
    questionResponses: any[];
    surveyResponse: any | null;
    surveyId: string | null;
    submissionGroupKey: string;
    deepClone: (obj: any) => any;
  },
): Promise<any> {
  const {
    questionResponses,
    surveyResponse,
    surveyId,
    submissionGroupKey,
    deepClone,
  } = opts;

  const submittedPayloadMeta: SubmitReceiptResult['submittedPayloadMeta'] = {
    __ceQuestionResponses: deepClone(questionResponses || []),
    __ceSurveyResponse: surveyResponse ? deepClone(surveyResponse) : null,
    __ceSurveyId: surveyId || null,
    __ceSubmissionGroupKey: submissionGroupKey,
  };

  if (tx && typeof tx.wait === 'function') {
    const receipt = await tx.wait();
    if (!receipt || (receipt.status !== undefined && receipt.status !== 1)) {
      throw new Error('Submission failed on-chain.');
    }
    return { ...receipt, ...submittedPayloadMeta };
  }

  if (typeof tx === 'string' && tx.startsWith('0x') && tx.length >= 66) {
    return { transactionHash: tx, ...submittedPayloadMeta };
  }

  if (tx && (tx.transactionHash || tx.hash)) {
    return { ...tx, ...submittedPayloadMeta };
  }

  throw new Error('No transaction was sent.');
}
