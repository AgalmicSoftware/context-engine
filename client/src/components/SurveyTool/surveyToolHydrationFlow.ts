import { normalizeQuestionIdKey } from './surveyToolSignatures.js';

type UnknownRecord = Record<string, unknown>;

type ResponseSlice = {
  answers?: Record<string, unknown> | null;
  importance?: Record<string, unknown> | null;
  conviction?: Record<string, unknown> | null;
  additionalComments?: Record<string, unknown> | null;
} & UnknownRecord;

type DraftPayload = {
  answers?: Record<string, unknown> | null;
  baseline?: Record<string, unknown> | null;
} & UnknownRecord;

type DraftHydrationApplyArgs = {
  targetSlice?: ResponseSlice | null;
  questionId?: string;
  draftEntry?: unknown;
  allowOverwrite?: boolean;
};

type BuildDraftHydrationStateArgs = {
  renderedQuestionIds?: Iterable<unknown> | unknown[];
  draft?: DraftPayload | null;
  prevSlice?: ResponseSlice | null;
  prevBaseline?: ResponseSlice | null;
  allowOverwrite?: boolean;
  cloneBaseline?: ((baseline: ResponseSlice | null | undefined) => ResponseSlice) | null;
  applyDraftEntryToSlice?: ((args: DraftHydrationApplyArgs) => boolean) | null;
};

type CachedQuestionResponses = Record<string, unknown>;

type CachedResponseApplyArgs = {
  targetSlice?: ResponseSlice | null;
  questionId?: string;
  response?: unknown;
  parseValue?: ((value: unknown) => unknown) | null;
};

type BuildCacheHydrationSliceArgs = {
  renderedQuestionIds?: Iterable<unknown> | unknown[];
  mergedQuestionResponses?: CachedQuestionResponses | null;
  account?: unknown;
  parseResponse?: ((raw: unknown) => unknown) | null;
  applyCachedResponseEntryToSlice?: ((args: CachedResponseApplyArgs) => boolean) | null;
  parseValue?: ((value: unknown) => unknown) | null;
};

const buildEmptyResponseSlice = (): ResponseSlice => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

export const buildDraftHydrationState = ({
  renderedQuestionIds = [],
  draft = null,
  prevSlice = null,
  prevBaseline = null,
  allowOverwrite = false,
  cloneBaseline = null,
  applyDraftEntryToSlice = null,
}: BuildDraftHydrationStateArgs = {}) => {
  const normalizedPrevSlice = prevSlice && typeof prevSlice === 'object' ? prevSlice : buildEmptyResponseSlice();
  const nextSlice: ResponseSlice = {
    answers: { ...((normalizedPrevSlice.answers as Record<string, unknown>) || {}) },
    importance: { ...((normalizedPrevSlice.importance as Record<string, unknown>) || {}) },
    conviction: { ...((normalizedPrevSlice.conviction as Record<string, unknown>) || {}) },
    additionalComments: { ...((normalizedPrevSlice.additionalComments as Record<string, unknown>) || {}) },
  };
  const nextBaseline: ResponseSlice = typeof cloneBaseline === 'function'
    ? cloneBaseline(prevBaseline && typeof prevBaseline === 'object' ? prevBaseline : buildEmptyResponseSlice())
    : buildEmptyResponseSlice();

  let changed = false;
  let baselineChanged = false;
  const answers = draft && typeof draft === 'object' ? draft.answers || {} : {};
  const baseline = draft && typeof draft === 'object' ? draft.baseline || {} : {};

  Array.from(renderedQuestionIds || []).forEach((rawQuestionId) => {
    const questionId = normalizeQuestionIdKey(rawQuestionId);
    if (!questionId || typeof applyDraftEntryToSlice !== 'function') return;

    const answerEntry = (answers && typeof answers === 'object') ? answers[questionId] : null;
    if (answerEntry && applyDraftEntryToSlice({
      targetSlice: nextSlice,
      questionId,
      draftEntry: answerEntry,
      allowOverwrite,
    })) {
      changed = true;
    }

    const baselineEntry = (baseline && typeof baseline === 'object') ? baseline[questionId] : null;
    if (baselineEntry && applyDraftEntryToSlice({
      targetSlice: nextBaseline,
      questionId,
      draftEntry: baselineEntry,
      allowOverwrite,
    })) {
      baselineChanged = true;
    }
  });

  return {
    nextSlice,
    nextBaseline,
    changed,
    baselineChanged,
  };
};

export const buildCacheHydrationSlice = ({
  renderedQuestionIds = [],
  mergedQuestionResponses = null,
  account = '',
  parseResponse = null,
  applyCachedResponseEntryToSlice = null,
  parseValue = null,
}: BuildCacheHydrationSliceArgs = {}) => {
  const slice = buildEmptyResponseSlice();
  const normalizedAccount = String(account || '').toLowerCase();
  const responses = mergedQuestionResponses && typeof mergedQuestionResponses === 'object'
    ? mergedQuestionResponses
    : {};
  let changed = false;

  Array.from(renderedQuestionIds || []).forEach((rawQuestionId) => {
    const questionId = normalizeQuestionIdKey(rawQuestionId);
    if (!questionId || typeof applyCachedResponseEntryToSlice !== 'function') return;

    const questionMap = responses[questionId];
    if (!questionMap || typeof questionMap !== 'object') return;

    const rawResponse = normalizedAccount ? questionMap[normalizedAccount] : null;
    if (!rawResponse) return;

    const parsedResponse = typeof parseResponse === 'function'
      ? parseResponse(rawResponse)
      : rawResponse;
    if (!parsedResponse || typeof parsedResponse !== 'object') return;
    if (!parsedResponse.answer || !parsedResponse.additional) return;

    if (applyCachedResponseEntryToSlice({
      targetSlice: slice,
      questionId,
      response: parsedResponse,
      parseValue,
    })) {
      changed = true;
    }
  });

  return { slice, changed };
};
