type UnknownRecord = Record<string, unknown>;

type ResponseFieldState = UnknownRecord & {
  value?: unknown;
  encrypted?: unknown;
  encryptedPortion?: unknown;
};

type ResponseSlice = {
  answers: Record<string, ResponseFieldState>;
  importance: Record<string, unknown>;
  conviction: Record<string, unknown>;
  additionalComments: Record<string, ResponseFieldState>;
};

type LatestResponseRecord = UnknownRecord & {
  questionID?: unknown;
  questionId?: unknown;
  questionIDHash?: unknown;
  importanceEncrypted?: unknown;
  convictionEncrypted?: unknown;
  responses?: unknown[];
};

type SliceCache = {
  source: unknown;
  value: unknown;
} | null;

const buildEmptyResponseSlice = (): ResponseSlice => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

const normalizeQuestionId = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const isObjectRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asResponseSlice = (value: unknown): ResponseSlice | null =>
  isObjectRecord(value) ? (value as ResponseSlice) : null;

const asLatestResponseRecord = (value: unknown): LatestResponseRecord | null =>
  isObjectRecord(value) ? (value as LatestResponseRecord) : null;

const buildLatestResponseByQuestionId = (latest: unknown): Map<string, LatestResponseRecord> => {
  const latestByQid = new Map<string, LatestResponseRecord>();
  const add = (rawResponseObject: unknown) => {
    const responseObject = asLatestResponseRecord(rawResponseObject);
    if (!responseObject) return;

    const id = normalizeQuestionId(
      responseObject.questionID || responseObject.questionId || responseObject.questionIDHash,
    );
    if (!id) return;
    latestByQid.set(id, responseObject);
  };

  const latestRecord = asLatestResponseRecord(latest);
  if (latestRecord) {
    if (Array.isArray(latestRecord.responses)) latestRecord.responses.forEach(add);
    else add(latestRecord);
  }

  return latestByQid;
};

export const resolveSurveyUserAnswersSlice = ({
  userAnswers = null,
  userAnswersSliceCache = null,
  buildSliceFromUserAnswers = () => null,
}: {
  userAnswers?: unknown;
  userAnswersSliceCache?: SliceCache;
  buildSliceFromUserAnswers?: (sourceAnswers: unknown) => unknown;
} = {}) => {
  const existingCache =
    userAnswersSliceCache && typeof userAnswersSliceCache === 'object'
      ? userAnswersSliceCache
      : {
          source: null,
          value: null,
        };

  if (!userAnswers || typeof buildSliceFromUserAnswers !== 'function') {
    return {
      slice: null,
      nextCache: existingCache,
      reusedMemo: false,
    };
  }

  if (existingCache.source === userAnswers && existingCache.value) {
    return {
      slice: existingCache.value,
      nextCache: existingCache,
      reusedMemo: true,
    };
  }

  const built = buildSliceFromUserAnswers(userAnswers);
  return {
    slice: built && typeof built === 'object' ? built : null,
    nextCache: {
      source: userAnswers,
      value: built && typeof built === 'object' ? built : null,
    },
    reusedMemo: false,
  };
};

export const resolveSurveyBaselineSourceSlice = ({
  editBaseline = null,
  allowLocalCache = false,
  userAnswers = null,
  userAnswersSliceCache = null,
  buildSliceFromUserAnswers = () => null,
  buildSliceFromLocalCache = () => null,
}: {
  editBaseline?: unknown;
  allowLocalCache?: boolean;
  userAnswers?: unknown;
  userAnswersSliceCache?: SliceCache;
  buildSliceFromUserAnswers?: (sourceAnswers: unknown) => unknown;
  buildSliceFromLocalCache?: () => unknown;
} = {}) => {
  if (editBaseline && typeof editBaseline === 'object') {
    return {
      baselineSlice: editBaseline,
      nextUserAnswersSliceCache: userAnswersSliceCache,
      source: 'edit-baseline',
    };
  }

  const { slice: userAnswerSlice, nextCache } = resolveSurveyUserAnswersSlice({
    userAnswers,
    userAnswersSliceCache,
    buildSliceFromUserAnswers,
  });

  if (userAnswerSlice && typeof userAnswerSlice === 'object') {
    return {
      baselineSlice: userAnswerSlice,
      nextUserAnswersSliceCache: nextCache,
      source: 'user-answers',
    };
  }

  if (allowLocalCache && typeof buildSliceFromLocalCache === 'function') {
    const localCacheSlice = buildSliceFromLocalCache();
    if (localCacheSlice && typeof localCacheSlice === 'object') {
      return {
        baselineSlice: localCacheSlice,
        nextUserAnswersSliceCache: nextCache,
        source: 'local-cache',
      };
    }
  }

  return {
    baselineSlice: buildEmptyResponseSlice(),
    nextUserAnswersSliceCache: nextCache,
    source: 'empty',
  };
};

export const areSurveyResponsesConsistent = ({
  latest = null,
  editBaseline = null,
  renderedIds = [],
  buildSliceFromUserAnswers = () => null,
  valuesEqual = (left: unknown, right: unknown) => left === right,
}: {
  latest?: unknown;
  editBaseline?: unknown;
  renderedIds?: unknown[];
  buildSliceFromUserAnswers?: (sourceAnswers: unknown) => unknown;
  valuesEqual?: (left: unknown, right: unknown) => boolean;
} = {}) => {
  if (!latest || !editBaseline || typeof buildSliceFromUserAnswers !== 'function') {
    return false;
  }

  const baselineSlice = asResponseSlice(editBaseline);
  const latestSlice = asResponseSlice(buildSliceFromUserAnswers(latest));
  if (!baselineSlice || !latestSlice) return false;

  const latestByQid = buildLatestResponseByQuestionId(latest);

  for (const rawQid of Array.isArray(renderedIds) ? renderedIds : []) {
    const qid = String(rawQid || '');
    const normalizedQid = normalizeQuestionId(rawQid);
    const baseAns = baselineSlice.answers?.[qid];
    const chainAns = latestSlice.answers?.[qid];

    const baseAdd = baselineSlice.additionalComments?.[qid];
    const chainAdd = latestSlice.additionalComments?.[qid];
    const baselineAnswerEncrypted = !!(
      baseAns &&
      (baseAns.encrypted || baseAns.encryptedPortion || baseAns.value === '*')
    );
    const baselineAdditionalEncrypted = !!(
      baseAdd &&
      (baseAdd.encrypted || baseAdd.encryptedPortion || baseAdd.value === '*')
    );
    const baselineResponseEncrypted = baselineAnswerEncrypted || baselineAdditionalEncrypted;

    const latestRespObj = normalizedQid ? latestByQid.get(normalizedQid) || null : null;
    const latestRatingEncrypted = !!(
      latestRespObj &&
      ((typeof latestRespObj.importanceEncrypted === 'string' && latestRespObj.importanceEncrypted) ||
        (typeof latestRespObj.convictionEncrypted === 'string' && latestRespObj.convictionEncrypted))
    );

    if (!valuesEqual(baseAns?.value, chainAns?.value)) return false;
    if (!valuesEqual(baseAdd?.value, chainAdd?.value)) return false;

    if (baselineSlice.importance && Object.prototype.hasOwnProperty.call(baselineSlice.importance, qid)) {
      const baseImp = Number(baselineSlice.importance[qid]);
      const chainImp =
        latestSlice.importance && Object.prototype.hasOwnProperty.call(latestSlice.importance, qid)
          ? Number(latestSlice.importance[qid])
          : null;
      if (chainImp === null) {
        if (!baselineResponseEncrypted && !latestRatingEncrypted) return false;
      } else if (baseImp !== chainImp) {
        return false;
      }
    }

    if (baselineSlice.conviction && Object.prototype.hasOwnProperty.call(baselineSlice.conviction, qid)) {
      const baseConv = Number(baselineSlice.conviction[qid]);
      const chainConv =
        latestSlice.conviction && Object.prototype.hasOwnProperty.call(latestSlice.conviction, qid)
          ? Number(latestSlice.conviction[qid])
          : null;
      if (chainConv === null) {
        if (!baselineResponseEncrypted && !latestRatingEncrypted) return false;
      } else if (baseConv !== chainConv) {
        return false;
      }
    }
  }

  return true;
};
