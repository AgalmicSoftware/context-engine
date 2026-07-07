type UnknownRecord = Record<string, unknown>;

type ResponseField = {
  value?: unknown;
  encrypted?: unknown;
  encryptedPortion?: unknown;
} & UnknownRecord;

type ResponseRow = {
  questionID?: unknown;
  questionId?: unknown;
  answer?: ResponseField | null;
  additional?: ResponseField | null;
  importance?: unknown;
  importanceEncrypted?: unknown;
  conviction?: unknown;
  convictionEncrypted?: unknown;
} & UnknownRecord;

export const areEnvelopesEquivalent = (
  envA: unknown,
  envB: unknown,
  isEncryptedA = false,
  isEncryptedB = false,
): boolean => {
  const a = typeof envA === 'string' ? envA : '';
  const b = typeof envB === 'string' ? envB : '';
  if (a && b) return a === b;
  if (!a && !b) return !!isEncryptedA && !!isEncryptedB;
  return false;
};

const mergeDecryptedViewedResponseField = (
  prevResp: ResponseRow | null | undefined,
  latestResp: ResponseRow | null | undefined,
  fieldKey: 'answer' | 'additional',
) => {
  const prev = prevResp && typeof prevResp === 'object' ? prevResp : null;
  const next = latestResp && typeof latestResp === 'object' ? latestResp : null;
  if (!prev || !next) return latestResp;

  const prevField = prev[fieldKey] && typeof prev[fieldKey] === 'object' ? (prev[fieldKey] as ResponseField) : {};
  const nextField = next[fieldKey] && typeof next[fieldKey] === 'object' ? (next[fieldKey] as ResponseField) : {};

  const prevValue = prevField.value;
  const nextValue = nextField.value;
  const prevEnv = typeof prevField.encryptedPortion === 'string' ? prevField.encryptedPortion : '';
  const nextEnv = typeof nextField.encryptedPortion === 'string' ? nextField.encryptedPortion : '';
  const prevIsDecrypted = prevValue !== '*' && prevValue !== undefined && prevValue !== null;
  const nextIsMasked = nextValue === '*' && (!!nextField.encrypted || !!nextEnv);

  if (!prevIsDecrypted || !nextIsMasked) return latestResp;
  if (!areEnvelopesEquivalent(prevEnv, nextEnv, prevField.encrypted === true, nextField.encrypted === true)) {
    return latestResp;
  }

  return {
    ...latestResp,
    [fieldKey]: {
      ...nextField,
      value: prevValue,
    },
  };
};

const mergeDecryptedViewedResponseRating = (
  prevResp: ResponseRow | null | undefined,
  latestResp: ResponseRow | null | undefined,
  ratingKey: 'importance' | 'conviction',
  envelopeKey: 'importanceEncrypted' | 'convictionEncrypted',
) => {
  const prev = prevResp && typeof prevResp === 'object' ? prevResp : null;
  const next = latestResp && typeof latestResp === 'object' ? latestResp : null;
  if (!prev || !next) return latestResp;

  const prevValue = prev[ratingKey];
  const nextValue = next[ratingKey];
  const prevEnv = typeof prev[envelopeKey] === 'string' ? prev[envelopeKey] : '';
  const nextEnv = typeof next[envelopeKey] === 'string' ? next[envelopeKey] : '';

  const prevIsDecrypted =
    prevValue !== '*' && prevValue !== undefined && prevValue !== null && typeof prevValue !== 'object';
  const nextIsMasked = (nextValue === '*' || nextValue === undefined || nextValue === null) && !!nextEnv;

  if (!prevIsDecrypted || !nextIsMasked) return latestResp;
  if (!prevEnv || !nextEnv || prevEnv !== nextEnv) return latestResp;

  return { ...latestResp, [ratingKey]: prevValue };
};

export function mergeDecryptedViewedResponse(
  prevViewed: UnknownRecord | null | undefined,
  latestViewed: UnknownRecord | null | undefined,
) {
  const prev = prevViewed && typeof prevViewed === 'object' ? prevViewed : null;
  const next = latestViewed && typeof latestViewed === 'object' ? latestViewed : null;
  if (!prev || !next) return latestViewed;

  if (Array.isArray(next.responses) && Array.isArray(prev.responses)) {
    const prevByQid = new Map<string, ResponseRow>();
    (prev.responses as ResponseRow[]).forEach((row) => {
      const id = String(row?.questionID || row?.questionId || '')
        .trim()
        .toLowerCase();
      if (id) prevByQid.set(id, row);
    });
    const mergedResponses = (next.responses as ResponseRow[]).map((row) => {
      const id = String(row?.questionID || row?.questionId || '')
        .trim()
        .toLowerCase();
      const prevResp = id ? prevByQid.get(id) : null;
      let merged = mergeDecryptedViewedResponseField(prevResp, row, 'answer');
      merged = mergeDecryptedViewedResponseField(prevResp, merged as ResponseRow, 'additional');
      merged = mergeDecryptedViewedResponseRating(prevResp, merged as ResponseRow, 'importance', 'importanceEncrypted');
      merged = mergeDecryptedViewedResponseRating(prevResp, merged as ResponseRow, 'conviction', 'convictionEncrypted');
      return merged;
    });
    return { ...next, responses: mergedResponses };
  }

  let merged = mergeDecryptedViewedResponseField(prev as ResponseRow, next as ResponseRow, 'answer');
  merged = mergeDecryptedViewedResponseField(prev as ResponseRow, merged as ResponseRow, 'additional');
  merged = mergeDecryptedViewedResponseRating(
    prev as ResponseRow,
    merged as ResponseRow,
    'importance',
    'importanceEncrypted',
  );
  merged = mergeDecryptedViewedResponseRating(
    prev as ResponseRow,
    merged as ResponseRow,
    'conviction',
    'convictionEncrypted',
  );
  return merged;
}
