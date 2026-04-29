export type ResponseSlice = {
  answers: Record<string, any>;
  importance: Record<string, any>;
  conviction: Record<string, any>;
  additionalComments: Record<string, any>;
};

export type IndexedKeyMap = Map<string, string[]>;

export interface ChangedFieldsOrchestrationParams {
  surveyIndex: number;
  currentSlice: ResponseSlice;
  isLoggedIn: boolean;
  isLoadingResponse: boolean;
  scopedIds: Set<string>;
  userAnswers: any;
}

export interface ChangedFieldsDiffCache {
  surveyIndex: number;
  currentSlice: ResponseSlice;
  baselineSlice: ResponseSlice;
  currentSliceSignature: string;
  baselineSliceSignature: string;
  allowLocalCache: boolean;
  idsScopeKey: string;
  idsScopeMode: string;
  result: { changedQids: Set<string>; changedMap: Record<string, Record<string, number>> };
}

export interface ChangedFieldsOrchestrationDeps {
  resolveDiffBaselineSlice: (allowLocalCache: boolean) => ResponseSlice;
  getIndexedQuestionEntryKeys: (source: Record<string, any> | null | undefined) => IndexedKeyMap | null;
  getDefaultResponseEncryptionAudience: () => any;
  normalizeResponseEncryptionAudience: (audience: any, qid: string) => any;
  getDefaultResponseEncryptionAudienceForQid: (qid: string) => any;
  resolveFieldEncryptionGateId: (field: any, qid: string | null, fieldKey: string) => any;
  normalizeFieldAudienceMode: (mode: any, fieldKey: string, field: any) => any;
  valuesEqual: (left: unknown, right: unknown) => boolean;
  buildSurveyResponseSliceSignature: (slice: ResponseSlice, opts?: { normalizedIdFilter?: Set<string> | null }) => string;
  buildRatingEnvelopeQidSetFromUserAnswers: (userAnswers: any) => Set<string>;
  hasMeaningfulFieldValue: (value: any) => boolean;
  bumpPerfCounter: (name: string) => void;
}

export interface ChangedFieldsOrchestrationResult {
  result: { changedQids: Set<string>; changedMap: Record<string, Record<string, number>> };
  newCache: ChangedFieldsDiffCache;
}

export const buildIndexedQuestionEntryKeys = (
  source: Record<string, any> | null | undefined,
  normalizeKey: (key: string) => string,
): IndexedKeyMap | null => {
  if (!source || typeof source !== 'object') return null;
  const byNormalizedQid: IndexedKeyMap = new Map();
  Object.keys(source).forEach((rawKey) => {
    const normalizedKey = normalizeKey(rawKey);
    if (!normalizedKey) return;
    const existing = byNormalizedQid.get(normalizedKey);
    if (existing) existing.push(rawKey);
    else byNormalizedQid.set(normalizedKey, [rawKey]);
  });
  return byNormalizedQid;
};

export const orchestrateGetChangedQidsAndFields = (
  params: ChangedFieldsOrchestrationParams,
  deps: ChangedFieldsOrchestrationDeps,
  existingCache: ChangedFieldsDiffCache | null,
): ChangedFieldsOrchestrationResult => {
  deps.bumpPerfCounter('getChangedQidsAndFieldsCount');
  const allowLocalCache = !params.isLoadingResponse && !params.isLoggedIn;
  const baselineSlice = deps.resolveDiffBaselineSlice(allowLocalCache);

  const scopedIds = params.scopedIds;
  const hasScopedIds = scopedIds.size > 0;
  let ids = scopedIds;
  let idsScopeKey = '';
  let idsScopeMode = hasScopedIds ? 'scope' : 'slice';
  if (hasScopedIds) {
    idsScopeKey = `scope:${Array.from(scopedIds).sort().join('|')}`;
  }

  let signatureMemo: {
    filter: Set<string> | null;
    value: { currentSliceSignature: string; baselineSliceSignature: string };
  } | null = null;
  const getSliceSignatures = (normalizedIdFilter: Set<string> | null = null) => {
    if (signatureMemo && signatureMemo.filter === normalizedIdFilter) {
      return signatureMemo.value;
    }
    const value = {
      currentSliceSignature: deps.buildSurveyResponseSliceSignature(params.currentSlice, { normalizedIdFilter }),
      baselineSliceSignature: deps.buildSurveyResponseSliceSignature(baselineSlice, { normalizedIdFilter }),
    };
    signatureMemo = { filter: normalizedIdFilter, value };
    return value;
  };

  if (
    hasScopedIds &&
    existingCache &&
    existingCache.surveyIndex === params.surveyIndex &&
    existingCache.allowLocalCache === allowLocalCache &&
    existingCache.idsScopeMode === 'scope' &&
    existingCache.idsScopeKey === idsScopeKey &&
    existingCache.result
  ) {
    if (
      existingCache.currentSlice === params.currentSlice &&
      existingCache.baselineSlice === baselineSlice
    ) {
      deps.bumpPerfCounter('noopSkipCount');
      return { result: existingCache.result, newCache: existingCache };
    }
    const {
      currentSliceSignature,
      baselineSliceSignature,
    } = getSliceSignatures(scopedIds);
    if (
      existingCache.currentSliceSignature === currentSliceSignature &&
      existingCache.baselineSliceSignature === baselineSliceSignature
    ) {
      deps.bumpPerfCounter('noopSkipCount');
      return { result: existingCache.result, newCache: existingCache };
    }
  } else if (
    !hasScopedIds &&
    existingCache &&
    existingCache.surveyIndex === params.surveyIndex &&
    existingCache.allowLocalCache === allowLocalCache &&
    existingCache.idsScopeMode === 'slice' &&
    existingCache.result &&
    existingCache.currentSlice === params.currentSlice &&
    existingCache.baselineSlice === baselineSlice
  ) {
    deps.bumpPerfCounter('noopSkipCount');
    return { result: existingCache.result, newCache: existingCache };
  }

  if (!hasScopedIds) {
    const idsFromSlices = new Set<string>();
    const addNormalizedIds = (source: Record<string, any> | null | undefined) => {
      const indexed = deps.getIndexedQuestionEntryKeys(source);
      if (!indexed) return;
      indexed.forEach((_keys, normalizedQid) => {
        if (normalizedQid) idsFromSlices.add(normalizedQid);
      });
    };
    addNormalizedIds(baselineSlice.answers);
    addNormalizedIds(params.currentSlice.answers);
    addNormalizedIds(baselineSlice.additionalComments);
    addNormalizedIds(params.currentSlice.additionalComments);
    addNormalizedIds(baselineSlice.importance);
    addNormalizedIds(params.currentSlice.importance);
    addNormalizedIds(baselineSlice.conviction);
    addNormalizedIds(params.currentSlice.conviction);
    ids = idsFromSlices;
    idsScopeKey = `slice:${Array.from(idsFromSlices).sort().join('|')}`;
    idsScopeMode = 'slice';
    if (
      existingCache &&
      existingCache.surveyIndex === params.surveyIndex &&
      existingCache.allowLocalCache === allowLocalCache &&
      existingCache.idsScopeMode === idsScopeMode &&
      existingCache.idsScopeKey === idsScopeKey &&
      existingCache.result
    ) {
      if (
        existingCache.currentSlice === params.currentSlice &&
        existingCache.baselineSlice === baselineSlice
      ) {
        deps.bumpPerfCounter('noopSkipCount');
        return { result: existingCache.result, newCache: existingCache };
      }
      const normalizedIdFilter = ids.size > 0 ? ids : null;
      const {
        currentSliceSignature,
        baselineSliceSignature,
      } = getSliceSignatures(normalizedIdFilter);
      if (
        existingCache.currentSliceSignature === currentSliceSignature &&
        existingCache.baselineSliceSignature === baselineSliceSignature
      ) {
        deps.bumpPerfCounter('noopSkipCount');
        return { result: existingCache.result, newCache: existingCache };
      }
    }
  }

  const ratingEnvelopeQids = deps.buildRatingEnvelopeQidSetFromUserAnswers(params.userAnswers);
  const baselineAnswerKeysByQid = deps.getIndexedQuestionEntryKeys(baselineSlice.answers);
  const currentAnswerKeysByQid = deps.getIndexedQuestionEntryKeys(params.currentSlice.answers);
  const baselineAdditionalKeysByQid = deps.getIndexedQuestionEntryKeys(baselineSlice.additionalComments);
  const currentAdditionalKeysByQid = deps.getIndexedQuestionEntryKeys(params.currentSlice.additionalComments);
  const baselineImportanceKeysByQid = deps.getIndexedQuestionEntryKeys(baselineSlice.importance);
  const currentImportanceKeysByQid = deps.getIndexedQuestionEntryKeys(params.currentSlice.importance);
  const baselineConvictionKeysByQid = deps.getIndexedQuestionEntryKeys(baselineSlice.conviction);
  const currentConvictionKeysByQid = deps.getIndexedQuestionEntryKeys(params.currentSlice.conviction);

  const defaultAudience = deps.getDefaultResponseEncryptionAudience();
  const result = computeChangedQidsAndFields({
    ids,
    baselineSlice,
    currentSlice: params.currentSlice,
    baselineAnswerKeys: baselineAnswerKeysByQid,
    currentAnswerKeys: currentAnswerKeysByQid,
    baselineAdditionalKeys: baselineAdditionalKeysByQid,
    currentAdditionalKeys: currentAdditionalKeysByQid,
    baselineImportanceKeys: baselineImportanceKeysByQid,
    currentImportanceKeys: currentImportanceKeysByQid,
    baselineConvictionKeys: baselineConvictionKeysByQid,
    currentConvictionKeys: currentConvictionKeysByQid,
    ratingEnvelopeQids,
    valuesEqual: deps.valuesEqual,
    hasMeaningfulFieldValue: deps.hasMeaningfulFieldValue,
    resolveAudience: (field, qid) => {
      if (field && typeof field === 'object' && field.encryptionAudience) {
        return deps.normalizeResponseEncryptionAudience(field.encryptionAudience, qid as string);
      }
      return qid ? deps.getDefaultResponseEncryptionAudienceForQid(qid) : defaultAudience;
    },
    resolveGateId: (field, qid, fieldKey) => deps.resolveFieldEncryptionGateId(field, qid, fieldKey),
    resolveAudienceMode: (field, fieldKey) => deps.normalizeFieldAudienceMode(field?.audienceMode, fieldKey, field),
  });
  const normalizedIdFilter = ids.size > 0 ? ids : null;
  const {
    currentSliceSignature,
    baselineSliceSignature,
  } = getSliceSignatures(normalizedIdFilter);
  return {
    result,
    newCache: {
      surveyIndex: params.surveyIndex,
      currentSlice: params.currentSlice,
      baselineSlice,
      currentSliceSignature,
      baselineSliceSignature,
      allowLocalCache,
      idsScopeKey,
      idsScopeMode,
      result,
    },
  };
};

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
  if (!source) return {};

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
  if (!source) return null;
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
