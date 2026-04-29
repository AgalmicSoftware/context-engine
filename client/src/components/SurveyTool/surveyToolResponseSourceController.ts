type ResponseSlice = {
  answers: Record<string, any>;
  importance: Record<string, any>;
  conviction: Record<string, any>;
  additionalComments: Record<string, any>;
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

const normalizeQuestionId = (value: unknown): string => (
  String(value || '').trim().toLowerCase()
);

const buildLatestResponseByQuestionId = (latest: any): Map<string, any> => {
  const latestByQid = new Map<string, any>();
  const add = (responseObject: any) => {
    const id = normalizeQuestionId(
      responseObject?.questionID
      || responseObject?.questionId
      || responseObject?.questionIDHash
    );
    if (!id) return;
    latestByQid.set(id, responseObject);
  };

  if (latest && typeof latest === 'object') {
    if (Array.isArray(latest.responses)) latest.responses.forEach(add);
    else add(latest);
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
  const existingCache = (
    userAnswersSliceCache
    && typeof userAnswersSliceCache === 'object'
  ) ? userAnswersSliceCache : {
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

  if (
    existingCache.source === userAnswers
    && existingCache.value
  ) {
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

  const {
    slice: userAnswerSlice,
    nextCache,
  } = resolveSurveyUserAnswersSlice({
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
  editBaseline?: any;
  renderedIds?: unknown[];
  buildSliceFromUserAnswers?: (sourceAnswers: unknown) => any;
  valuesEqual?: (left: unknown, right: unknown) => boolean;
} = {}) => {
  if (!latest || !editBaseline || typeof buildSliceFromUserAnswers !== 'function') {
    return false;
  }

  const latestSlice = buildSliceFromUserAnswers(latest);
  const latestByQid = buildLatestResponseByQuestionId(latest);

  for (const rawQid of Array.isArray(renderedIds) ? renderedIds : []) {
    const qid = String(rawQid || '');
    const normalizedQid = normalizeQuestionId(rawQid);
    const baseAns = editBaseline.answers?.[qid];
    const chainAns = latestSlice?.answers?.[qid];

    const baseAdd = editBaseline.additionalComments?.[qid];
    const chainAdd = latestSlice?.additionalComments?.[qid];
    const baselineAnswerEncrypted = !!(baseAns && (
      baseAns.encrypted
      || baseAns.encryptedPortion
      || baseAns.value === '*'
    ));
    const baselineAdditionalEncrypted = !!(baseAdd && (
      baseAdd.encrypted
      || baseAdd.encryptedPortion
      || baseAdd.value === '*'
    ));
    const baselineResponseEncrypted = baselineAnswerEncrypted || baselineAdditionalEncrypted;

    const latestRespObj = normalizedQid ? (latestByQid.get(normalizedQid) || null) : null;
    const latestRatingEncrypted = !!(
      latestRespObj && (
        (typeof latestRespObj.importanceEncrypted === 'string' && latestRespObj.importanceEncrypted) ||
        (typeof latestRespObj.convictionEncrypted === 'string' && latestRespObj.convictionEncrypted)
      )
    );

    if (!valuesEqual(baseAns?.value, chainAns?.value)) return false;
    if (!valuesEqual(baseAdd?.value, chainAdd?.value)) return false;

    if (
      editBaseline.importance
      && Object.prototype.hasOwnProperty.call(editBaseline.importance, qid)
    ) {
      const baseImp = Number(editBaseline.importance[qid]);
      const chainImp = latestSlice?.importance
        && Object.prototype.hasOwnProperty.call(latestSlice.importance, qid)
        ? Number(latestSlice.importance[qid])
        : null;
      if (chainImp === null) {
        if (!baselineResponseEncrypted && !latestRatingEncrypted) return false;
      } else if (baseImp !== chainImp) {
        return false;
      }
    }

    if (
      editBaseline.conviction
      && Object.prototype.hasOwnProperty.call(editBaseline.conviction, qid)
    ) {
      const baseConv = Number(editBaseline.conviction[qid]);
      const chainConv = latestSlice?.conviction
        && Object.prototype.hasOwnProperty.call(latestSlice.conviction, qid)
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
