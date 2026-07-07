import { isPlainAnalysisObject, toAnalysisRecord, type UserPageUnknownRecord } from './userPageCoreHelpers';

export const cloneUserPageParsedResponsePayload = (value: unknown): unknown => {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => cloneUserPageParsedResponsePayload(item));
  }
  const source = value as UserPageUnknownRecord;
  const clone: UserPageUnknownRecord = {};
  Object.keys(source).forEach((key) => {
    Object.defineProperty(clone, key, {
      value: cloneUserPageParsedResponsePayload(source[key]),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  });
  return clone;
};

export const parseUserPageCachedResponsePayload = (
  rawValue: unknown,
  memo: Map<string, unknown> | null | undefined,
  memoLimit: number,
): unknown => {
  if (typeof rawValue !== 'string') return cloneUserPageParsedResponsePayload(rawValue);
  if (memo && memo.has(rawValue)) {
    return cloneUserPageParsedResponsePayload(memo.get(rawValue));
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawValue);
  } catch (_) {
    // Fail-open for malformed legacy payloads so UI can still surface a deterministic state.
    parsed = rawValue;
  }
  if (memo) {
    memo.set(rawValue, parsed);
    if (memo.size > memoLimit) {
      const oldestKey = memo.keys().next().value;
      if (oldestKey !== undefined) memo.delete(oldestKey);
    }
  }
  return cloneUserPageParsedResponsePayload(parsed);
};

export type UserPageNormalizedResponseField = UserPageUnknownRecord & {
  value?: unknown;
};

export type UserPageNormalizedQuestionResponsePayload = UserPageUnknownRecord & {
  answer: UserPageNormalizedResponseField;
  additional: UserPageNormalizedResponseField;
  __ceMalformedPayload?: boolean;
};

export const extractUserPageFirstDefinedValue = (...values: unknown[]): unknown => {
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== undefined) return values[i];
  }
  return undefined;
};

export const normalizeUserPageResponseField = (
  rawField: unknown,
  fallbackValues: unknown[] = [],
): UserPageNormalizedResponseField => {
  const base: UserPageNormalizedResponseField =
    rawField && typeof rawField === 'object' && !Array.isArray(rawField)
      ? { ...(rawField as UserPageUnknownRecord) }
      : {};
  const scalarFallback = rawField != null && typeof rawField !== 'object' ? rawField : undefined;
  const nextValue = extractUserPageFirstDefinedValue(
    base.value,
    scalarFallback,
    ...(Array.isArray(fallbackValues) ? fallbackValues : []),
  );
  if (nextValue !== undefined) base.value = nextValue;
  return base;
};

export const normalizeUserPageSingleQuestionResponsePayload = (
  rawResponse: unknown = null,
): UserPageNormalizedQuestionResponsePayload | null => {
  if (rawResponse == null) return null;

  if (typeof rawResponse !== 'object' || Array.isArray(rawResponse)) {
    return {
      answer: { value: rawResponse },
      additional: { value: '' },
    };
  }

  const rawRecord = toAnalysisRecord(rawResponse);
  const nestedResponse = isPlainAnalysisObject(rawRecord.response) ? rawRecord.response : null;
  const base = nestedResponse ? { ...rawRecord, ...nestedResponse } : { ...rawRecord };

  const answerFallback = extractUserPageFirstDefinedValue(
    base.answerValue,
    base.value,
    base.responseValue,
    base.answerText,
    base.responseText,
    base.answer == null &&
      (typeof base.response === 'string' || typeof base.response === 'number' || typeof base.response === 'boolean')
      ? base.response
      : undefined,
  );
  const additionalFallback = extractUserPageFirstDefinedValue(
    base.additionalComment,
    base.additionalComments,
    base.comment,
    base.comments,
    base.additionalText,
  );

  const normalized: UserPageNormalizedQuestionResponsePayload = {
    ...base,
    answer: normalizeUserPageResponseField(base.answer, [answerFallback]),
    additional: normalizeUserPageResponseField(base.additional, [additionalFallback]),
  };

  const hasShapeHints = !!(
    base.answer !== undefined ||
    base.additional !== undefined ||
    answerFallback !== undefined ||
    additionalFallback !== undefined ||
    base.importance !== undefined ||
    base.conviction !== undefined ||
    base.blockNumber !== undefined ||
    base.transactionIndex !== undefined ||
    base.logIndex !== undefined ||
    base.timestamp !== undefined ||
    base.arweaveTxId ||
    base.transactionHash ||
    base.txHash
  );
  if (!hasShapeHints) {
    normalized.__ceMalformedPayload = true;
  }
  return normalized;
};

export const isDisplayableUserPageResponseValue = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some((entry) => isDisplayableUserPageResponseValue(entry));
  }
  if (value && typeof value === 'object') {
    const record = toAnalysisRecord(value);
    if (Object.prototype.hasOwnProperty.call(record, 'value')) {
      return isDisplayableUserPageResponseValue(record.value);
    }
    return Object.keys(record).length > 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' && trimmed !== '*';
  }
  return value !== undefined && value !== null && value !== '*';
};

export const hasDisplayableUserPageResponsePayload = (responseObj: unknown = null): boolean => {
  const responseRecord = toAnalysisRecord(responseObj);
  if (!Object.keys(responseRecord).length) return false;
  const answer = toAnalysisRecord(responseRecord.answer);
  const additional = toAnalysisRecord(responseRecord.additional);
  return isDisplayableUserPageResponseValue(answer.value) || isDisplayableUserPageResponseValue(additional.value);
};

export const hasUserPageResponseSubmissionHints = (value: unknown = null): boolean => {
  if (value == null) return false;
  if (typeof value !== 'object') {
    return String(value).trim() !== '';
  }
  const src = toAnalysisRecord(value);
  return !!(
    src.__ceMalformedPayload === true ||
    Object.prototype.hasOwnProperty.call(src, 'answer') ||
    Object.prototype.hasOwnProperty.call(src, 'additional') ||
    src.questionId ||
    src.questionID ||
    src.arweaveTxId ||
    src.transactionHash ||
    src.txHash ||
    src.blockNumber !== undefined ||
    src.transactionIndex !== undefined ||
    src.logIndex !== undefined ||
    src.timestamp !== undefined
  );
};

export type UserPageResponseRecency = {
  bn: number;
  txi: number;
  li: number;
  ts: number;
};
export type UserPageResponseRecencyWithHints = UserPageResponseRecency & {
  hasHints: boolean;
};
export type UserPageResponseByResponderMap = Record<string, unknown>;
export type UserPageResponseBucketMap = Record<string, UserPageResponseByResponderMap>;
export type UserPageResponseRecencyBucketMap = Record<string, Record<string, UserPageResponseRecencyWithHints>>;
type UserPageQuestionResponseInfoWithRecency = UserPageUnknownRecord & {
  id?: unknown;
  _responseRecency?: unknown;
};

export const extractUserPageResponseRecency = (
  responseObj: unknown = null,
  recencyMeta: unknown = null,
): UserPageResponseRecency => {
  const meta = toAnalysisRecord(recencyMeta);
  const src = toAnalysisRecord(responseObj);
  return {
    bn: Number(meta.bn ?? meta.blockNumber ?? src.blockNumber ?? src.bn ?? 0) || 0,
    txi:
      Number(
        meta.txi ?? meta.transactionIndex ?? meta.txIndex ?? src.txi ?? src.transactionIndex ?? src.txIndex ?? 0,
      ) || 0,
    li: Number(meta.li ?? meta.logIndex ?? src.logIndex ?? src.li ?? 0) || 0,
    ts: Number(meta.ts ?? meta.timestamp ?? src.ts ?? src.timestamp ?? 0) || 0,
  };
};

export const extractUserPageResponseRecencyWithHints = (
  responseObj: unknown = null,
  recencyMeta: unknown = null,
): UserPageResponseRecencyWithHints => {
  const recency = extractUserPageResponseRecency(responseObj, recencyMeta);
  return {
    ...recency,
    hasHints: recency.bn > 0 || recency.txi > 0 || recency.li > 0 || recency.ts > 0,
  };
};

export const compareUserPageResponseRecency = (left: unknown, right: unknown): number => {
  const a = extractUserPageResponseRecency(left);
  const b = extractUserPageResponseRecency(right);
  if (a.bn !== b.bn) return a.bn - b.bn;
  if (a.txi !== b.txi) return a.txi - b.txi;
  if (a.li !== b.li) return a.li - b.li;
  if (a.ts !== b.ts) return a.ts - b.ts;
  return 0;
};

export const normalizeUserPageQuestionResponseInfoOrder = (questionResponseInfo: unknown): UserPageUnknownRecord[] => {
  const entries: UserPageQuestionResponseInfoWithRecency[] = Array.isArray(questionResponseInfo)
    ? [...(questionResponseInfo as UserPageQuestionResponseInfoWithRecency[])]
    : [];
  entries.sort((a, b) => {
    const cmp = compareUserPageResponseRecency(a._responseRecency, b._responseRecency);
    if (cmp !== 0) return cmp > 0 ? -1 : 1;
    const aId = String(a.id || '');
    const bId = String(b.id || '');
    if (aId < bId) return -1;
    if (aId > bId) return 1;
    return 0;
  });
  return entries.map((entry) => {
    const next = { ...entry };
    delete next._responseRecency;
    return next;
  });
};
