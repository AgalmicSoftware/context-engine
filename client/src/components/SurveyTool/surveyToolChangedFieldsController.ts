export type ResponseSlice = {
  answers: Record<string, any>;
  importance: Record<string, any>;
  conviction: Record<string, any>;
  additionalComments: Record<string, any>;
};

export type IndexedKeyMap = Map<string, string[]>;

const getMatchingKeys = (
  source: Record<string, any> | null,
  indexed: IndexedKeyMap | null,
  qidLower: string,
): string[] => {
  if (!source || typeof source !== 'object' || !indexed) return [];
  return indexed.get(qidLower) || [];
};

export const pickBestField = (
  source: Record<string, any> | null,
  indexed: IndexedKeyMap | null,
  qidLower: string,
  hasMeaningfulFieldValue: (value: any) => boolean,
): Record<string, any> => {
  const matchingKeys = getMatchingKeys(source, indexed, qidLower);
  if (matchingKeys.length === 0) return {};

  let exactValue: Record<string, any> | undefined;
  let firstMeaningfulValue: Record<string, any> | undefined;
  let firstEncryptedValue: Record<string, any> | undefined;
  let lastValue: Record<string, any> = {};
  for (let i = 0; i < matchingKeys.length; i += 1) {
    const key = matchingKeys[i];
    const value = source[key];
    const normalizedValue = (value || {}) as Record<string, any>;
    lastValue = normalizedValue;
    if (key === qidLower && hasMeaningfulFieldValue(value)) return normalizedValue;
    if (typeof firstMeaningfulValue === 'undefined' && hasMeaningfulFieldValue(value)) {
      firstMeaningfulValue = normalizedValue;
    }
    if (typeof exactValue === 'undefined' && key === qidLower) {
      exactValue = normalizedValue;
    }
    if (
      typeof firstEncryptedValue === 'undefined' &&
      value &&
      (value.encrypted || value.encryptedPortion)
    ) {
      firstEncryptedValue = normalizedValue;
    }
  }
  if (typeof firstMeaningfulValue !== 'undefined') return firstMeaningfulValue;
  if (typeof exactValue !== 'undefined') return exactValue;
  if (typeof firstEncryptedValue !== 'undefined') return firstEncryptedValue;
  return lastValue;
};

export const pickBestNumber = (
  source: Record<string, any> | null,
  indexed: IndexedKeyMap | null,
  qidLower: string,
): number | null => {
  const matchingKeys = getMatchingKeys(source, indexed, qidLower);
  if (matchingKeys.length === 0) return null;
  const toNum = (v: any) => (
    v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v)
  );
  const exactKey = matchingKeys.find((key) => key === qidLower);
  const exactNum = toNum(exactKey ? source[exactKey] : undefined);
  if (exactNum !== null) return exactNum;
  for (let i = 0; i < matchingKeys.length; i += 1) {
    const nextNum = toNum(source[matchingKeys[i]]);
    if (nextNum !== null) return nextNum;
  }
  return null;
};

export const computeChangedQidsAndFields = ({
  ids,
  baselineSlice,
  currentSlice,
  baselineAnswerKeys,
  currentAnswerKeys,
  baselineAdditionalKeys,
  currentAdditionalKeys,
  baselineImportanceKeys,
  currentImportanceKeys,
  baselineConvictionKeys,
  currentConvictionKeys,
  ratingEnvelopeQids,
  valuesEqual,
  hasMeaningfulFieldValue,
  resolveAudience,
  resolveGateId,
  resolveAudienceMode,
}: {
  ids: Set<string>;
  baselineSlice: ResponseSlice;
  currentSlice: ResponseSlice;
  baselineAnswerKeys: IndexedKeyMap | null;
  currentAnswerKeys: IndexedKeyMap | null;
  baselineAdditionalKeys: IndexedKeyMap | null;
  currentAdditionalKeys: IndexedKeyMap | null;
  baselineImportanceKeys: IndexedKeyMap | null;
  currentImportanceKeys: IndexedKeyMap | null;
  baselineConvictionKeys: IndexedKeyMap | null;
  currentConvictionKeys: IndexedKeyMap | null;
  ratingEnvelopeQids: Set<string>;
  valuesEqual: (left: unknown, right: unknown) => boolean;
  hasMeaningfulFieldValue: (value: any) => boolean;
  resolveAudience: (field: any, qid: string | null) => any;
  resolveGateId: (field: any, qid: string | null, fieldKey: string) => any;
  resolveAudienceMode: (field: any, fieldKey: string) => any;
}): { changedQids: Set<string>; changedMap: Record<string, Record<string, number>> } => {
  const changedQids = new Set<string>();
  const changedMap: Record<string, Record<string, number>> = {};

  ids.forEach((qId) => {
    const bAns = pickBestField(
      baselineSlice.answers,
      baselineAnswerKeys,
      qId,
      hasMeaningfulFieldValue,
    );
    const cAns = pickBestField(
      currentSlice.answers,
      currentAnswerKeys,
      qId,
      hasMeaningfulFieldValue,
    );
    const bAdd = pickBestField(
      baselineSlice.additionalComments,
      baselineAdditionalKeys,
      qId,
      hasMeaningfulFieldValue,
    );
    const cAdd = pickBestField(
      currentSlice.additionalComments,
      currentAdditionalKeys,
      qId,
      hasMeaningfulFieldValue,
    );
    const bImpN = pickBestNumber(baselineSlice.importance, baselineImportanceKeys, qId);
    const cImpN = pickBestNumber(currentSlice.importance, currentImportanceKeys, qId);
    const bConvN = pickBestNumber(baselineSlice.conviction, baselineConvictionKeys, qId);
    const cConvN = pickBestNumber(currentSlice.conviction, currentConvictionKeys, qId);

    // valuesEqual('*','*') -> unchanged; arrays/nums handled
    const ansChanged = !valuesEqual(bAns.value, cAns.value);
    const addChanged = !valuesEqual(bAdd.value, cAdd.value);

    const qLower = String(qId || '').trim().toLowerCase();
    const baselineAnswerEncrypted = !!(
      bAns &&
      (bAns.encrypted || bAns.encryptedPortion || bAns.value === '*')
    );
    const baselineAdditionalEncrypted = !!(
      bAdd &&
      (bAdd.encrypted || bAdd.encryptedPortion || bAdd.value === '*')
    );
    const currentAnswerEncrypted = !!(
      cAns &&
      (cAns.encrypted || cAns.encryptedPortion || cAns.value === '*')
    );
    const currentAdditionalEncrypted = !!(
      cAdd &&
      (cAdd.encrypted || cAdd.encryptedPortion || cAdd.value === '*')
    );
    const responseEncrypted =
      baselineAnswerEncrypted ||
      baselineAdditionalEncrypted ||
      currentAnswerEncrypted ||
      currentAdditionalEncrypted;
    const ratingEncrypted = qLower ? ratingEnvelopeQids.has(qLower) : false;
    const allowMissingRatings = responseEncrypted || ratingEncrypted;
    const missingCurrentImportance = cImpN === null && bImpN !== null;
    const missingCurrentConviction = cConvN === null && bConvN !== null;

    const impChanged = (bImpN !== cImpN) && !(allowMissingRatings && missingCurrentImportance);
    const convChanged = (bConvN !== cConvN) && !(allowMissingRatings && missingCurrentConviction);

    const ansHasContent = hasMeaningfulFieldValue(bAns) || hasMeaningfulFieldValue(cAns);
    const addHasContent = hasMeaningfulFieldValue(bAdd) || hasMeaningfulFieldValue(cAdd);

    // include encryption-flag deltas only when a field actually has content
    const encAnsChanged = ansHasContent && (!!bAns.encrypted !== !!cAns.encrypted);
    const encAddChanged = addHasContent && (!!bAdd.encrypted !== !!cAdd.encrypted);

    const bAnsAudience = resolveAudience(bAns, qId);
    const cAnsAudience = resolveAudience(cAns, qId);
    const bAddAudience = resolveAudience(bAdd, qId);
    const cAddAudience = resolveAudience(cAdd, qId);
    const bAnsGateId = resolveGateId(bAns, qId, 'answer');
    const cAnsGateId = resolveGateId(cAns, qId, 'answer');
    const bAddGateId = resolveGateId(bAdd, qId, 'additional');
    const cAddGateId = resolveGateId(cAdd, qId, 'additional');
    const bAddAudienceMode = resolveAudienceMode(bAdd, 'additional');
    const cAddAudienceMode = resolveAudienceMode(cAdd, 'additional');
    const ansAudienceChanged = ansHasContent && !!cAns.encrypted && bAnsAudience !== cAnsAudience;
    const addAudienceChanged = addHasContent && !!cAdd.encrypted && bAddAudience !== cAddAudience;
    const ansGateChanged = ansHasContent && !!cAns.encrypted && String(bAnsGateId || '') !== String(cAnsGateId || '');
    const addGateChanged = addHasContent && !!cAdd.encrypted && String(bAddGateId || '') !== String(cAddGateId || '');
    const addAudienceModeChanged = addHasContent && bAddAudienceMode !== cAddAudienceMode;

    if (
      ansChanged ||
      addChanged ||
      impChanged ||
      convChanged ||
      encAnsChanged ||
      encAddChanged ||
      ansAudienceChanged ||
      addAudienceChanged ||
      ansGateChanged ||
      addGateChanged ||
      addAudienceModeChanged
    ) {
      changedQids.add(qId);
      changedMap[qId] = {
        ...(ansChanged ? { answer: 1 } : null),
        ...(addChanged ? { additional: 1 } : null),
        ...(impChanged ? { importance: 1 } : null),
        ...(convChanged ? { conviction: 1 } : null),
        ...((encAnsChanged || ansAudienceChanged || ansGateChanged) ? { encryptedAnswer: 1 } : null),
        ...((encAddChanged || addAudienceChanged || addGateChanged || addAudienceModeChanged) ? { encryptedAdditional: 1 } : null),
      };
    }
  });

  return { changedQids, changedMap };
};
