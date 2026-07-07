import type { UnknownRecord } from './surveyToolTypes';

export type ResponseFieldState = UnknownRecord & {
  value?: unknown;
  encrypted?: unknown;
  encryptedPortion?: unknown;
  encryptionAudience?: unknown;
  audienceMode?: unknown;
};

export type ResponseSlice = {
  answers: Record<string, ResponseFieldState>;
  importance: Record<string, unknown>;
  conviction: Record<string, unknown>;
  additionalComments: Record<string, ResponseFieldState>;
};

export type IndexedKeyMap = Map<string, string[]>;
type ChangedFieldMap = Record<string, Record<string, number>>;

export interface ChangedFieldsOrchestrationParams {
  surveyIndex: number;
  currentSlice: ResponseSlice;
  isLoggedIn: boolean;
  isLoadingResponse: boolean;
  scopedIds: Set<string>;
  userAnswers: unknown;
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
  result: { changedQids: Set<string>; changedMap: ChangedFieldMap };
}

export interface ChangedFieldsOrchestrationDeps {
  resolveDiffBaselineSlice: (allowLocalCache: boolean) => ResponseSlice;
  getIndexedQuestionEntryKeys: (source: Record<string, unknown> | null | undefined) => IndexedKeyMap | null;
  getDefaultResponseEncryptionAudience: () => unknown;
  normalizeResponseEncryptionAudience: (audience: unknown, qid: string) => unknown;
  getDefaultResponseEncryptionAudienceForQid: (qid: string) => unknown;
  resolveFieldEncryptionGateId: (field: ResponseFieldState, qid: string | null, fieldKey: string) => unknown;
  normalizeFieldAudienceMode: (mode: unknown, fieldKey: string, field: ResponseFieldState) => unknown;
  valuesEqual: (left: unknown, right: unknown) => boolean;
  buildSurveyResponseSliceSignature: (
    slice: ResponseSlice,
    opts?: { normalizedIdFilter?: Set<string> | null },
  ) => string;
  buildRatingEnvelopeQidSetFromUserAnswers: (userAnswers: unknown) => Set<string>;
  hasMeaningfulFieldValue: (value: unknown) => boolean;
  bumpPerfCounter: (name: string) => void;
}

export interface ChangedFieldsOrchestrationResult {
  result: { changedQids: Set<string>; changedMap: ChangedFieldMap };
  newCache: ChangedFieldsDiffCache;
}

export interface PendingEditStatsParams {
  idx: number;
  currentSlice: ResponseSlice;
  userAnswers: unknown;
  existingCache: PendingEditStatsCache | null;
  diffCacheRef: unknown;
  questionPool: unknown;
  pileQuestions: unknown;
  questionId: string | null | undefined;
}

export interface PendingEditStatsCache {
  idx: number;
  diffCacheRef: unknown;
  currentSlice: ResponseSlice;
  userAnswers: unknown;
  questionPool: unknown;
  pileQuestions: unknown;
  questionId: string | null | undefined;
  result: { total: number; encrypted: number };
}

export interface PendingEditStatsDeps {
  getChangedQidsAndFields: (idx: number) => {
    changedQids: Set<string>;
    changedMap: ChangedFieldMap;
  };
  isQuestionLockedForResponse: (qid: string) => boolean;
  buildRatingEnvelopeQidSetFromUserAnswers: (userAnswers: unknown) => Set<string>;
}

export interface PendingEditStatsResult {
  result: { total: number; encrypted: number };
  newCache: PendingEditStatsCache;
}

export const buildIndexedQuestionEntryKeys = (
  source: Record<string, unknown> | null | undefined,
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
    if (existingCache.currentSlice === params.currentSlice && existingCache.baselineSlice === baselineSlice) {
      deps.bumpPerfCounter('noopSkipCount');
      return { result: existingCache.result, newCache: existingCache };
    }
    const { currentSliceSignature, baselineSliceSignature } = getSliceSignatures(scopedIds);
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
    const addNormalizedIds = (source: Record<string, unknown> | null | undefined) => {
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
      if (existingCache.currentSlice === params.currentSlice && existingCache.baselineSlice === baselineSlice) {
        deps.bumpPerfCounter('noopSkipCount');
        return { result: existingCache.result, newCache: existingCache };
      }
      const normalizedIdFilter = ids.size > 0 ? ids : null;
      const { currentSliceSignature, baselineSliceSignature } = getSliceSignatures(normalizedIdFilter);
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
  const { currentSliceSignature, baselineSliceSignature } = getSliceSignatures(normalizedIdFilter);
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

export const computePendingEditStats = (
  params: PendingEditStatsParams,
  deps: PendingEditStatsDeps,
): PendingEditStatsResult => {
  const pendingCache = params.existingCache;
  if (
    pendingCache &&
    pendingCache.idx === params.idx &&
    pendingCache.diffCacheRef === params.diffCacheRef &&
    pendingCache.currentSlice === params.currentSlice &&
    pendingCache.userAnswers === params.userAnswers &&
    pendingCache.questionPool === params.questionPool &&
    pendingCache.pileQuestions === params.pileQuestions &&
    pendingCache.questionId === params.questionId &&
    pendingCache.result
  ) {
    return { result: pendingCache.result, newCache: pendingCache };
  }

  const { changedQids, changedMap } = deps.getChangedQidsAndFields(params.idx);
  const total = changedQids.size;

  const ratingEnvelopeQids =
    total > 0 ? deps.buildRatingEnvelopeQidSetFromUserAnswers(params.userAnswers) : new Set<string>();

  let encrypted = 0;
  if (total > 0) {
    for (const qId of changedQids) {
      const qLower = String(qId || '')
        .trim()
        .toLowerCase();
      const fields = changedMap[qId] || {};
      const aEnc = (fields.answer || fields.encryptedAnswer) && !!params.currentSlice.answers?.[qId]?.encrypted;
      const dEnc =
        (fields.additional || fields.encryptedAdditional) && !!params.currentSlice.additionalComments?.[qId]?.encrypted;
      const questionLocked = deps.isQuestionLockedForResponse(qId);
      const baselineRatingEncrypted = qLower ? ratingEnvelopeQids.has(qLower) : false;
      const ratingEnc =
        (fields.importance || fields.conviction) &&
        (baselineRatingEncrypted ||
          questionLocked ||
          !!params.currentSlice.answers?.[qId]?.encrypted ||
          !!params.currentSlice.additionalComments?.[qId]?.encrypted);
      if (aEnc || dEnc || ratingEnc) encrypted += 1;
    }
  }

  const result = { total, encrypted };
  return {
    result,
    newCache: {
      idx: params.idx,
      diffCacheRef: params.diffCacheRef,
      currentSlice: params.currentSlice,
      userAnswers: params.userAnswers,
      questionPool: params.questionPool,
      pileQuestions: params.pileQuestions,
      questionId: params.questionId,
      result,
    },
  };
};

const getMatchingKeys = (
  source: Record<string, unknown> | null,
  indexed: IndexedKeyMap | null,
  qidLower: string,
): string[] => {
  if (!source || typeof source !== 'object' || !indexed) return [];
  return indexed.get(qidLower) || [];
};

export const pickBestField = (
  source: Record<string, unknown> | null,
  indexed: IndexedKeyMap | null,
  qidLower: string,
  hasMeaningfulFieldValue: (value: unknown) => boolean,
): ResponseFieldState => {
  const matchingKeys = getMatchingKeys(source, indexed, qidLower);
  if (matchingKeys.length === 0) return {};
  if (!source) return {};

  let exactValue: ResponseFieldState | undefined;
  let firstMeaningfulValue: ResponseFieldState | undefined;
  let firstEncryptedValue: ResponseFieldState | undefined;
  let lastValue: ResponseFieldState = {};
  for (let i = 0; i < matchingKeys.length; i += 1) {
    const key = matchingKeys[i];
    const value = source[key];
    const normalizedValue = (value || {}) as ResponseFieldState;
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
      (normalizedValue.encrypted || normalizedValue.encryptedPortion)
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
  source: Record<string, unknown> | null,
  indexed: IndexedKeyMap | null,
  qidLower: string,
): number | null => {
  const matchingKeys = getMatchingKeys(source, indexed, qidLower);
  if (matchingKeys.length === 0) return null;
  if (!source) return null;
  const toNum = (v: unknown) => (v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));
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
  hasMeaningfulFieldValue: (value: unknown) => boolean;
  resolveAudience: (field: ResponseFieldState, qid: string | null) => unknown;
  resolveGateId: (field: ResponseFieldState, qid: string | null, fieldKey: string) => unknown;
  resolveAudienceMode: (field: ResponseFieldState, fieldKey: string) => unknown;
}): { changedQids: Set<string>; changedMap: ChangedFieldMap } => {
  const changedQids = new Set<string>();
  const changedMap: ChangedFieldMap = {};

  ids.forEach((qId) => {
    const bAns = pickBestField(baselineSlice.answers, baselineAnswerKeys, qId, hasMeaningfulFieldValue);
    const cAns = pickBestField(currentSlice.answers, currentAnswerKeys, qId, hasMeaningfulFieldValue);
    const bAdd = pickBestField(baselineSlice.additionalComments, baselineAdditionalKeys, qId, hasMeaningfulFieldValue);
    const cAdd = pickBestField(currentSlice.additionalComments, currentAdditionalKeys, qId, hasMeaningfulFieldValue);
    const bImpN = pickBestNumber(baselineSlice.importance, baselineImportanceKeys, qId);
    const cImpN = pickBestNumber(currentSlice.importance, currentImportanceKeys, qId);
    const bConvN = pickBestNumber(baselineSlice.conviction, baselineConvictionKeys, qId);
    const cConvN = pickBestNumber(currentSlice.conviction, currentConvictionKeys, qId);

    // valuesEqual('*','*') -> unchanged; arrays/nums handled
    const ansChanged = !valuesEqual(bAns.value, cAns.value);
    const addChanged = !valuesEqual(bAdd.value, cAdd.value);

    const qLower = String(qId || '')
      .trim()
      .toLowerCase();
    const baselineAnswerEncrypted = !!(bAns && (bAns.encrypted || bAns.encryptedPortion || bAns.value === '*'));
    const baselineAdditionalEncrypted = !!(bAdd && (bAdd.encrypted || bAdd.encryptedPortion || bAdd.value === '*'));
    const currentAnswerEncrypted = !!(cAns && (cAns.encrypted || cAns.encryptedPortion || cAns.value === '*'));
    const currentAdditionalEncrypted = !!(cAdd && (cAdd.encrypted || cAdd.encryptedPortion || cAdd.value === '*'));
    const responseEncrypted =
      baselineAnswerEncrypted || baselineAdditionalEncrypted || currentAnswerEncrypted || currentAdditionalEncrypted;
    const ratingEncrypted = qLower ? ratingEnvelopeQids.has(qLower) : false;
    const allowMissingRatings = responseEncrypted || ratingEncrypted;
    const missingCurrentImportance = cImpN === null && bImpN !== null;
    const missingCurrentConviction = cConvN === null && bConvN !== null;

    const impChanged = bImpN !== cImpN && !(allowMissingRatings && missingCurrentImportance);
    const convChanged = bConvN !== cConvN && !(allowMissingRatings && missingCurrentConviction);

    const ansHasContent = hasMeaningfulFieldValue(bAns) || hasMeaningfulFieldValue(cAns);
    const addHasContent = hasMeaningfulFieldValue(bAdd) || hasMeaningfulFieldValue(cAdd);

    // include encryption-flag deltas only when a field actually has content
    const encAnsChanged = ansHasContent && !!bAns.encrypted !== !!cAns.encrypted;
    const encAddChanged = addHasContent && !!bAdd.encrypted !== !!cAdd.encrypted;

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
        ...(encAnsChanged || ansAudienceChanged || ansGateChanged ? { encryptedAnswer: 1 } : null),
        ...(encAddChanged || addAudienceChanged || addGateChanged || addAudienceModeChanged
          ? { encryptedAdditional: 1 }
          : null),
      };
    }
  });

  return { changedQids, changedMap };
};
