import { isFreeformBlankAnswer } from '../../utilities/survey/freeformAnswerUtils.js';
import { normalizeSurveyResultsBlockNumber } from './surveyResultsBlockNumbers.js';

type UnknownRecord = Record<string, unknown>;
type BuildSurveyResultsFilterLoadingUpdateArgs = {
  loading?: unknown;
  pendingValue?: unknown;
  stateFilterLoading?: unknown;
};
type BuildSurveyResultsFilterLoadingStatePatchArgs = {
  nextLoading?: unknown;
  prevState?: unknown;
};
type BuildSurveyResultsQuestionFilterCountPatchArgs = {
  count?: unknown;
  props?: unknown;
  state?: unknown;
};
type BuildSurveyResultsCommittedFilterStatePatchArgs = {
  filterState?: unknown;
  statePatch?: unknown;
};
type BuildSurveyResultsQuestionFilterPatchArgs = {
  filteredQuestions?: unknown;
  filteredResponsesByQuestion?: unknown;
  isSurveyAggregate?: unknown;
  isSurveyIndividuals?: unknown;
  networkQuestions?: unknown;
  sourceMap?: unknown;
  totalResponsesCount?: unknown;
};
type BuildSurveyResultsFilteredResponsesPatchArgs = {
  filteredResponses?: unknown;
  networkQuestions?: unknown;
  surveyViewMode?: unknown;
  totalResponsesCount?: unknown;
  viewMode?: unknown;
};
export type SurveyResultsFilteredResponsesPatchPlan = {
  patch: UnknownRecord | null;
  status: 'apply' | 'invalid-aggregator' | 'invalid-array';
};
type BuildSurveyResultsLocalStoragePollPatchArgs = {
  cachedQuestionsCount?: unknown;
  cachedSurveyResponsesCount?: unknown;
  networkLatestBlock?: unknown;
  questionLocalBlock?: unknown;
  responseLocalBlock?: unknown;
  surveyLocalBlock?: unknown;
};
type BuildSurveyResultsRefreshStatusWritePlanArgs = {
  isMounted?: unknown;
  latestBlock?: unknown;
  writeNetworkLatestBlock?: unknown;
};
type BuildSurveyResultsViewModeResetPatchArgs = {
  questionResultsHydrated?: unknown;
  surveyId?: unknown;
  surveyResultsHydrated?: unknown;
  viewMode?: unknown;
};
type BuildSurveyResultsRefreshStatusSequencePlanArgs = BuildSurveyResultsRefreshStatusWritePlanArgs & {
  followUpEffects?: readonly unknown[] | unknown;
};
export type SurveyResultsRefreshStatusSequenceEffect =
  | {
      kind: 'state-patch';
      keys: string[];
      target: { latestBlock?: unknown };
    }
  | {
      kind: 'follow-up';
      effect: string;
    };

export type SurveyResultsResponseField = UnknownRecord & {
  value?: unknown;
  hash?: unknown;
  encrypted?: unknown;
  timestamp?: unknown;
  timeStamp?: unknown;
  type?: unknown;
};

export type SurveyResultsAnswerRow = UnknownRecord & {
  questionID?: unknown;
  questionId?: unknown;
  timestamp?: unknown;
  timeStamp?: unknown;
  answer?: SurveyResultsResponseField | unknown;
  additional?: SurveyResultsResponseField | unknown;
  prompt?: unknown;
  type?: unknown;
  questionType?: unknown;
  conviction?: unknown;
  importance?: unknown;
};

export type SurveyResultsSurveyResponsePayload = UnknownRecord & {
  responses?: SurveyResultsAnswerRow[] | unknown;
  timestamp?: unknown;
  timeStamp?: unknown;
};

export type SurveyResultsAggregateRow = UnknownRecord & {
  responder?: unknown;
  questionId?: unknown;
  response?: unknown;
  timestamp?: unknown;
  mergedResponse?: unknown;
};

export type SurveyResultsAggregator = Record<string, SurveyResultsAggregateRow[] | unknown>;
export type SurveyResultsIndividualAggregator = Record<string, SurveyResultsAggregateRow[]>;
export type SurveyResultsQuestionLookupEntry = UnknownRecord & { type?: unknown };
export type SurveyResultsQuestionLookup = Record<string, SurveyResultsQuestionLookupEntry | undefined>;
export type SurveyResultsStringifiedAggregator = Record<string, Record<string, unknown>[]>;
export type SurveyResultsFilterQuestionRecord = UnknownRecord & {
  creator?: unknown;
  id?: unknown;
  prompt?: unknown;
  type?: unknown;
};

type SurveyQuestionResponseCandidate = {
  index: number;
  entryTimestampMs: number;
  payloadTimestampMs: number;
  aggregateTimestampMs: number;
};

type SurveyResponseNormalizationEntry = {
  index: number;
  orderIndex: number;
  row: unknown;
};

type SurveyResponseLatestEntry = SurveyResponseNormalizationEntry & SurveyQuestionResponseCandidate;

export {
  buildSurveyResultsAlertMessagePatch,
  buildSurveyResultsBookmarkFeedbackPatch,
  buildSurveyResultsBookmarkedQuestionIdsPatch,
  buildSurveyResultsBookmarkedSurveyIdsPatch,
  buildSurveyResultsBooleanTogglePatch,
  buildSurveyResultsCsvFileNamePatch,
  buildSurveyResultsDemoAtlasNodePatch,
  buildSurveyResultsDemoAtlasOpenPatch,
  buildSurveyResultsDemoViewSelectPatch,
  buildSurveyResultsExportTypePatch,
  buildSurveyResultsFilterActivePatch,
  buildSurveyResultsKeyedTogglePatch,
  buildSurveyResultsQuestionIdSortPatch,
  buildSurveyResultsSurveyViewModePatch,
  buildSurveyResultsViewStatePatch,
} from './surveyResultsDisplayPatchHelpers';
export type {
  BuildSurveyResultsBooleanTogglePatchArgs,
  BuildSurveyResultsDemoViewSelectPatchArgs,
  BuildSurveyResultsKeyedTogglePatchArgs,
  BuildSurveyResultsQuestionIdSortPatchArgs,
} from './surveyResultsDisplayPatchHelpers';

export const buildSurveyResultsFilterLoadingUpdate = ({
  loading = false,
  pendingValue = null,
  stateFilterLoading = false,
}: BuildSurveyResultsFilterLoadingUpdateArgs = {}) => {
  const nextLoading = !!loading;
  const baseline = pendingValue != null ? pendingValue : !!stateFilterLoading;
  const shouldQueueState = baseline !== nextLoading;
  return {
    nextLoading,
    nextPendingValue: shouldQueueState ? nextLoading : pendingValue,
    shouldQueueState,
  };
};

export const buildSurveyResultsFilterLoadingStatePatch = ({
  nextLoading = false,
  prevState = {},
}: BuildSurveyResultsFilterLoadingStatePatchArgs = {}): { filterLoading: boolean } | null => {
  const normalizedNextLoading = !!nextLoading;
  const stateRecord = prevState && typeof prevState === 'object' ? (prevState as UnknownRecord) : {};
  return stateRecord.filterLoading === normalizedNextLoading ? null : { filterLoading: normalizedNextLoading };
};

export const stringifySurveyResultsAggregatorResponses = (
  aggregatorObj: unknown,
): SurveyResultsStringifiedAggregator => {
  const out: SurveyResultsStringifiedAggregator = {};
  if (!aggregatorObj || typeof aggregatorObj !== 'object') return out;
  const aggregatorRecord = aggregatorObj as Record<string, unknown>;
  Object.keys(aggregatorRecord).forEach((questionId) => {
    const rows = Array.isArray(aggregatorRecord[questionId]) ? aggregatorRecord[questionId] : [];
    out[questionId] = rows.map((item) => ({
      ...(item as Record<string, unknown>),
      response:
        typeof (item as Record<string, unknown>).response === 'string'
          ? (item as Record<string, unknown>).response
          : JSON.stringify((item as Record<string, unknown>).response),
    }));
  });
  return out;
};

export const buildSurveyResultsQuestionFilterQuestions = ({
  networkQuestionsById = {},
  questionResponses = {},
}: {
  networkQuestionsById?: Record<string, SurveyResultsFilterQuestionRecord>;
  questionResponses?: unknown;
} = {}): SurveyResultsFilterQuestionRecord[] => {
  const responseRecord = Object(questionResponses || {}) as Record<string, unknown>;
  return Object.keys(responseRecord).map((questionId) => {
    const lowerQuestionId = String(questionId || '').toLowerCase();
    const questionData = networkQuestionsById[lowerQuestionId];
    return questionData || { id: lowerQuestionId || questionId, creator: '', type: '', prompt: '' };
  });
};

export const buildSurveyResultsQuestionFilterCountPatch = ({
  count,
  props = {},
  state = {},
}: BuildSurveyResultsQuestionFilterCountPatchArgs = {}): { filteredQuestionsCount: unknown } | null => {
  const propsRecord = props && typeof props === 'object' ? (props as UnknownRecord) : {};
  const stateRecord = state && typeof state === 'object' ? (state as UnknownRecord) : {};

  if (!propsRecord.isQuestionCacheReady) return null;

  const baseMap =
    stateRecord.viewMode === 'survey' && stateRecord.surveyViewMode === 'aggregate'
      ? stateRecord.aggregateQuestionResponses || {}
      : stateRecord.aggregatorQuestionResponses || {};
  const baseQuestions = Object.keys(Object(baseMap)).length;

  const hasAnyResponses =
    baseQuestions > 0 ||
    Object.keys(Object(stateRecord.questionResponses || {})).length > 0 ||
    Object.keys(Object(stateRecord.sbtFilteredAggregatorQuestionResponses || {})).length > 0;

  if (count === 0 && (!hasAnyResponses || stateRecord.filterLoading || !propsRecord.isResponsesCacheReady)) {
    return null;
  }

  if (count === stateRecord.filteredQuestionsCount) return null;
  return buildSurveyResultsFilteredQuestionsCountPatch(count);
};

export const buildSurveyResultsQuestionScopeResetPatch = () => ({
  questionResponses: {},
  aggregatorQuestionResponses: {},
  sbtFilteredAggregatorQuestionResponses: {},
  totalQuestionsCount: 0,
  totalResponsesCount: 0,
  filteredResponsesCount: 0,
  filteredQuestionsCount: 0,
  questionResultsHydrated: false,
});

const toSurveyResultsHelperRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const pruneSurveyResultsResponseAggregator = (value: unknown): UnknownRecord => {
  const pruned: UnknownRecord = {};
  Object.entries(toSurveyResultsHelperRecord(value)).forEach(([key, rows]) => {
    if (Array.isArray(rows) && rows.length > 0) pruned[key] = rows;
  });
  return pruned;
};

const countSurveyResultsDistinctResponders = (aggregator: unknown): number => {
  const responders = new Set<string>();
  Object.values(toSurveyResultsHelperRecord(aggregator)).forEach((rows) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      const responder = toSurveyResultsHelperRecord(row).responder;
      if (typeof responder === 'string' && responder) responders.add(responder.toLowerCase());
    });
  });
  return responders.size;
};

export const buildSurveyResultsCommittedFilterStatePatch = ({
  filterState = {},
  statePatch = {},
}: BuildSurveyResultsCommittedFilterStatePatchArgs = {}): UnknownRecord => ({
  ...toSurveyResultsHelperRecord(statePatch),
  filterState,
});

export const buildSurveyResultsQuestionFilterPatch = ({
  filteredQuestions = [],
  filteredResponsesByQuestion = null,
  isSurveyAggregate = false,
  isSurveyIndividuals = false,
  networkQuestions = {},
  sourceMap = {},
  totalResponsesCount = 0,
}: BuildSurveyResultsQuestionFilterPatchArgs = {}): UnknownRecord => {
  const questionList = Array.isArray(filteredQuestions) ? filteredQuestions : [];
  const finalFilteredQCount = questionList.length;
  const statePatch: UnknownRecord = {
    filteredQuestionsCount: finalFilteredQCount,
  };

  if (isSurveyIndividuals) return statePatch;

  const sourceRecord = toSurveyResultsHelperRecord(sourceMap);
  const filteredResponseRecord = toSurveyResultsHelperRecord(filteredResponsesByQuestion);
  const allowedIds = new Set<string>(
    questionList.map((question) => String(toSurveyResultsHelperRecord(question).id || '').toLowerCase()),
  );
  const nextFilteredAggregator: UnknownRecord = {};

  Object.keys(sourceRecord).forEach((questionId) => {
    if (!allowedIds.has(String(questionId || '').toLowerCase())) return;
    if (filteredResponsesByQuestion && Object.prototype.hasOwnProperty.call(filteredResponseRecord, questionId)) {
      const rows = filteredResponseRecord[questionId] || [];
      if (Array.isArray(rows) && rows.length > 0) nextFilteredAggregator[questionId] = rows;
      return;
    }
    nextFilteredAggregator[questionId] = sourceRecord[questionId];
  });

  statePatch.sbtFilteredAggregatorQuestionResponses = nextFilteredAggregator;
  const maxResponseCount = Number(totalResponsesCount) || 0;
  if (isSurveyAggregate) {
    statePatch.filteredResponsesCount = Math.min(
      countSurveyResultsDistinctResponders(nextFilteredAggregator),
      maxResponseCount,
    );
  } else {
    statePatch.filteredResponsesCount = Math.min(
      countQuestionModeResponses(
        nextFilteredAggregator,
        toSurveyResultsHelperRecord(networkQuestions) as SurveyResultsQuestionLookup,
      ),
      maxResponseCount,
    );
  }
  return statePatch;
};

export const buildSurveyResultsFilteredResponsesPatchPlan = ({
  filteredResponses = null,
  networkQuestions = {},
  surveyViewMode = '',
  totalResponsesCount = 0,
  viewMode = '',
}: BuildSurveyResultsFilteredResponsesPatchArgs = {}): SurveyResultsFilteredResponsesPatchPlan => {
  const isSurveyMode = viewMode === 'survey';
  const isSurveyIndividuals = isSurveyMode && surveyViewMode === 'individuals';
  if (isSurveyIndividuals) {
    if (!Array.isArray(filteredResponses)) {
      return {
        patch: { sbtFilteredResponses: [], filteredResponsesCount: 0 },
        status: 'invalid-array',
      };
    }
    return {
      patch: {
        sbtFilteredResponses: filteredResponses,
        filteredResponsesCount: filteredResponses.length,
      },
      status: 'apply',
    };
  }

  if (!filteredResponses || typeof filteredResponses !== 'object') {
    return {
      patch: null,
      status: 'invalid-aggregator',
    };
  }

  const pruned = pruneSurveyResultsResponseAggregator(filteredResponses);
  const maxResponseCount = Number(totalResponsesCount) || 0;
  const filteredResponsesCount = isSurveyMode
    ? Math.min(countSurveyResultsDistinctResponders(pruned), maxResponseCount)
    : Math.min(
        countQuestionModeResponses(
          pruned,
          toSurveyResultsHelperRecord(networkQuestions) as SurveyResultsQuestionLookup,
        ),
        maxResponseCount,
      );

  return {
    patch: {
      sbtFilteredAggregatorQuestionResponses: pruned,
      filteredResponsesCount,
    },
    status: 'apply',
  };
};

export const buildSurveyResultsEmptySurveyModePatch = () => ({
  responses: [],
  sbtFilteredResponses: [],
  aggregateQuestionResponses: {},
  sbtFilteredAggregatorQuestionResponses: {},
  surveyTitle: '',
  surveyDocumentURLs: [],
  totalQuestionsCount: 0,
  totalResponsesCount: 0,
  filteredQuestionsCount: 0,
  filteredResponsesCount: 0,
  surveyResultsHydrated: true,
});

export const buildSurveyResultsSurveyModeHydratedPatch = ({
  aggregateQuestionResponses,
  filteredResponsesCount,
  responses,
  sbtFilteredAggregatorQuestionResponses,
  sbtFilteredResponses,
  surveyDocumentURLs,
  surveyTitle,
  totalQuestionsCount,
  totalResponsesCount,
}: {
  aggregateQuestionResponses: unknown;
  filteredResponsesCount: unknown;
  responses: unknown;
  sbtFilteredAggregatorQuestionResponses: unknown;
  sbtFilteredResponses: unknown;
  surveyDocumentURLs: unknown;
  surveyTitle: unknown;
  totalQuestionsCount: unknown;
  totalResponsesCount: unknown;
}) => ({
  aggregateQuestionResponses,
  sbtFilteredAggregatorQuestionResponses,
  sbtFilteredResponses,
  surveyTitle,
  surveyDocumentURLs,
  totalQuestionsCount,
  totalResponsesCount,
  filteredQuestionsCount: totalQuestionsCount,
  responses,
  filteredResponsesCount,
  surveyResultsHydrated: true,
});

export const buildSurveyResultsFilteredQuestionModeHydratedPatch = ({
  aggregatorQuestionResponses,
  currentFilteredQuestionsCount,
  currentFilteredResponsesCount,
  initialFilteredCount,
  questionResponses,
  sbtFilteredAggregatorQuestionResponses,
  totalQuestionsCount,
  totalResponsesCount,
}: {
  aggregatorQuestionResponses: unknown;
  currentFilteredQuestionsCount: unknown;
  currentFilteredResponsesCount: unknown;
  initialFilteredCount: number;
  questionResponses: unknown;
  sbtFilteredAggregatorQuestionResponses: unknown;
  totalQuestionsCount: number;
  totalResponsesCount: number;
}) => ({
  aggregatorQuestionResponses,
  sbtFilteredAggregatorQuestionResponses: sbtFilteredAggregatorQuestionResponses || aggregatorQuestionResponses,
  questionResponses,
  totalQuestionsCount,
  totalResponsesCount,
  filteredQuestionsCount:
    typeof currentFilteredQuestionsCount === 'number'
      ? Math.min(currentFilteredQuestionsCount, totalQuestionsCount)
      : totalQuestionsCount,
  filteredResponsesCount:
    typeof currentFilteredResponsesCount === 'number' ? currentFilteredResponsesCount : initialFilteredCount,
  questionResultsHydrated: true,
});

export const buildSurveyResultsUnfilteredQuestionModeHydratedPatch = ({
  aggregatorQuestionResponses,
  filteredResponsesCount,
  questionResponses,
  totalQuestionsCount,
  totalResponsesCount,
}: {
  aggregatorQuestionResponses: unknown;
  filteredResponsesCount: number;
  questionResponses: unknown;
  totalQuestionsCount: number;
  totalResponsesCount: number;
}) => ({
  aggregatorQuestionResponses,
  sbtFilteredAggregatorQuestionResponses: aggregatorQuestionResponses,
  questionResponses,
  totalQuestionsCount,
  totalResponsesCount,
  filteredQuestionsCount: totalQuestionsCount,
  filteredResponsesCount,
  questionResultsHydrated: true,
});

export const buildSurveyResultsNetworkLatestBlockPatch = (networkLatestBlock: unknown) => ({
  networkLatestBlock: normalizeSurveyResultsBlockNumber(networkLatestBlock),
});

export const buildSurveyResultsViewModeResetPatch = ({
  questionResultsHydrated = false,
  surveyId = '',
  surveyResultsHydrated = false,
  viewMode = '',
}: BuildSurveyResultsViewModeResetPatchArgs = {}) => ({
  questionLocalBlock: 0,
  responseLocalBlock: 0,
  surveyLocalBlock: 0,
  refreshTargetQuestionBlock: 0,
  refreshTargetResponseBlock: 0,
  refreshTargetSurveyBlock: 0,
  questionResultsHydrated: viewMode === 'questions' ? false : questionResultsHydrated,
  surveyResultsHydrated: viewMode === 'survey' ? false : surveyResultsHydrated,
  demoResultsViewMode: 'raw',
  demoResultsAtlasNodeId: null,
  surveyId: viewMode === 'questions' ? '' : surveyId,
});

export const buildSurveyResultsSurveyIdPropChangePatch = (surveyId: unknown) => ({
  surveyId,
  viewMode: 'survey',
  surveyLocalBlock: 0,
  refreshTargetSurveyBlock: 0,
  surveyResultsHydrated: false,
  demoResultsViewMode: 'raw',
  demoResultsAtlasNodeId: null,
});

export const buildSurveyResultsSurveyIdStateChangePatch = () => ({
  surveyLocalBlock: 0,
  refreshTargetSurveyBlock: 0,
  surveyResultsHydrated: false,
  demoResultsViewMode: 'raw',
  demoResultsAtlasNodeId: null,
});

export const buildSurveyResultsLocalStoragePollPatch = ({
  cachedQuestionsCount = 0,
  cachedSurveyResponsesCount = 0,
  networkLatestBlock = 0,
  questionLocalBlock = 0,
  responseLocalBlock = 0,
  surveyLocalBlock = 0,
}: BuildSurveyResultsLocalStoragePollPatchArgs = {}) => ({
  questionLocalBlock,
  responseLocalBlock,
  surveyLocalBlock,
  cachedQuestionsCount,
  cachedSurveyResponsesCount,
  networkLatestBlock,
});

export const buildSurveyResultsRefreshTargetBlocksPatch = (latestBlock: unknown) => ({
  refreshTargetQuestionBlock: latestBlock,
  refreshTargetResponseBlock: latestBlock,
  refreshTargetSurveyBlock: latestBlock,
});

const normalizeRefreshStatusFollowUpEffects = (followUpEffects: readonly unknown[] | unknown = []): string[] => {
  if (!Array.isArray(followUpEffects)) return [];
  return followUpEffects.map((effect) => String(effect || '').trim()).filter(Boolean);
};

export const buildSurveyResultsRefreshStatusSequencePlan = ({
  isMounted = true,
  latestBlock,
  writeNetworkLatestBlock = false,
  followUpEffects = [],
}: BuildSurveyResultsRefreshStatusSequencePlanArgs = {}) => {
  const target = {
    latestBlock,
  };

  if (isMounted === false) {
    return {
      blockedReason: 'unmounted' as const,
      dispatchEligibility: 'blocked' as const,
      orderedEffects: [] as SurveyResultsRefreshStatusSequenceEffect[],
      shouldDispatchFollowUp: false,
      shouldWrite: false,
      statePatch: null,
      target,
    };
  }

  const refreshTargetPatch = buildSurveyResultsRefreshTargetBlocksPatch(latestBlock);
  const statePatch =
    writeNetworkLatestBlock === true
      ? {
          ...buildSurveyResultsNetworkLatestBlockPatch(latestBlock),
          ...refreshTargetPatch,
        }
      : refreshTargetPatch;
  const orderedEffects: SurveyResultsRefreshStatusSequenceEffect[] = [
    {
      kind: 'state-patch',
      keys: Object.keys(statePatch),
      target,
    },
    ...normalizeRefreshStatusFollowUpEffects(followUpEffects).map((effect) => ({
      kind: 'follow-up' as const,
      effect,
    })),
  ];

  return {
    blockedReason: '' as const,
    dispatchEligibility: 'eligible' as const,
    orderedEffects,
    shouldDispatchFollowUp: true,
    shouldWrite: true,
    statePatch,
    target,
  };
};

export const buildSurveyResultsRefreshStatusWritePlan = (args: BuildSurveyResultsRefreshStatusWritePlanArgs = {}) => {
  const { blockedReason, shouldWrite, statePatch, target } = buildSurveyResultsRefreshStatusSequencePlan(args);

  return {
    blockedReason,
    shouldWrite,
    statePatch,
    target,
  };
};

export const buildSurveyResultsFilteredQuestionsCountPatch = (filteredQuestionsCount: unknown) => ({
  filteredQuestionsCount,
});

export const buildSurveyResultsLockedResponsesDecryptingPatch = (lockedResponsesDecrypting: unknown) => ({
  lockedResponsesDecrypting: !!lockedResponsesDecrypting,
  alertMessage: '',
});

export const buildSurveyResultsLockedResponsesDecryptCompletePatch = ({
  anyDecrypted = false,
  decryptedResponseOverrides = {},
  walletLowerLabel = 'wallet',
}: {
  anyDecrypted?: unknown;
  decryptedResponseOverrides?: unknown;
  walletLowerLabel?: unknown;
} = {}) => ({
  lockedResponsesDecrypting: false,
  decryptedResponseOverrides,
  ...(anyDecrypted
    ? {}
    : {
        alertMessage: `Unable to decrypt locked responses with the connected ${String(walletLowerLabel || 'wallet')}.`,
      }),
});

export const toggleSurveyResultsLockedResponseDetailsPatch = (
  prevState: {
    lockedResponseDetailsOpen?: unknown;
  } = {},
) => ({
  lockedResponseDetailsOpen: !prevState.lockedResponseDetailsOpen,
});

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const normalizeSignatureValue = (value: unknown, trail: WeakSet<object> = new WeakSet<object>()): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return `__bigint:${value.toString(10)}`;
  if (typeof value !== 'object') return value;
  if (trail.has(value)) return '__circular__';
  trail.add(value);
  if (Array.isArray(value)) {
    const arr = value.map((entry) => normalizeSignatureValue(entry, trail));
    trail.delete(value);
    return arr;
  }
  const record = value as UnknownRecord;
  const out: UnknownRecord = {};
  Object.keys(record)
    .sort()
    .forEach((key) => {
      out[key] = normalizeSignatureValue(record[key], trail);
    });
  trail.delete(value);
  return out;
};

export const stableSerializeSignatureValue = (value: unknown): string => {
  try {
    return JSON.stringify(normalizeSignatureValue(value));
  } catch (_) {
    try {
      return String(value);
    } catch (_) {
      return '[[unserializable]]';
    }
  }
};

export const mixSurveySignatureHash = (seed: unknown, text: unknown): number => {
  let hash = Number(seed) >>> 0;
  const input = String(text || '');
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 16777619) >>> 0;
  }
  return hash >>> 0;
};

export const buildSurveyResponderPayloadSignature = (payload: unknown): string => {
  if (typeof payload === 'string') return `s:${payload}`;
  return `o:${stableSerializeSignatureValue(payload)}`;
};

export const buildSurveyRespondersSignature = (surveyResponsesByResponder: UnknownRecord = {}): string => {
  const responders = Object.keys(surveyResponsesByResponder || {}).sort((a, b) => String(a).localeCompare(String(b)));
  let hash = 2166136261;
  responders.forEach((responder) => {
    const responderLower = String(responder || '').toLowerCase();
    hash = mixSurveySignatureHash(hash, responderLower);
    hash = mixSurveySignatureHash(hash, buildSurveyResponderPayloadSignature(surveyResponsesByResponder?.[responder]));
  });
  return `${responders.length}:${hash >>> 0}`;
};

const surveyResponderPayloadRefIds = new WeakMap<object, number>();
let surveyResponderPayloadRefSeq = 1;

export const getSurveyResponderPayloadRefId = (value: unknown): string => {
  if (!value || typeof value !== 'object') {
    return `p:${typeof value}:${String(value)}`;
  }
  const objectValue = value as object;
  let refId = surveyResponderPayloadRefIds.get(objectValue);
  if (!refId) {
    refId = surveyResponderPayloadRefSeq;
    surveyResponderPayloadRefSeq += 1;
    surveyResponderPayloadRefIds.set(objectValue, refId);
  }
  return `o:${refId}`;
};

export const buildSurveyRespondersPayloadRefSignature = (surveyResponsesByResponder: UnknownRecord = {}): string => {
  const responders = Object.keys(surveyResponsesByResponder || {}).sort((a, b) => String(a).localeCompare(String(b)));
  let hash = 2166136261;
  responders.forEach((responder) => {
    const responderLower = String(responder || '').toLowerCase();
    hash = mixSurveySignatureHash(hash, responderLower);
    const payload = surveyResponsesByResponder?.[responder];
    if (typeof payload === 'string') {
      hash = mixSurveySignatureHash(hash, `s:${payload.length}:${payload}`);
      return;
    }
    hash = mixSurveySignatureHash(hash, getSurveyResponderPayloadRefId(payload));
    const payloadResponses = isRecord(payload) && Array.isArray(payload.responses) ? payload.responses : [];
    hash = mixSurveySignatureHash(hash, `r:${payloadResponses.length}`);
    payloadResponses.forEach((entry) => {
      hash = mixSurveySignatureHash(hash, getSurveyResponderPayloadRefId(entry));
    });
  });
  return `${responders.length}:${hash >>> 0}`;
};

export const INVALID_RESPONSE_TIMESTAMP = Number.NEGATIVE_INFINITY;

export const normalizeResponseTimestampMs = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return INVALID_RESPONSE_TIMESTAMP;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return INVALID_RESPONSE_TIMESTAMP;
    return Math.abs(value) < 1e12 ? Math.floor(value * 1000) : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return INVALID_RESPONSE_TIMESTAMP;
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric)) return INVALID_RESPONSE_TIMESTAMP;
      return Math.abs(numeric) < 1e12 ? Math.floor(numeric * 1000) : numeric;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? INVALID_RESPONSE_TIMESTAMP : parsed;
  }
  return INVALID_RESPONSE_TIMESTAMP;
};

export const getSurveyResponseQuestionId = (row: unknown = {}): string => {
  if (!isRecord(row)) return '';
  return String(row.questionID || row.questionId || '')
    .trim()
    .toLowerCase();
};

export const getSurveyResponseEntryTimestampMs = (row: unknown = {}): number => {
  if (!isRecord(row)) return INVALID_RESPONSE_TIMESTAMP;
  return normalizeResponseTimestampMs(row.timestamp ?? row.timeStamp);
};

export const getSurveyResponsePayloadTimestampMs = (payload: unknown = {}): number => {
  if (!isRecord(payload)) return INVALID_RESPONSE_TIMESTAMP;
  return normalizeResponseTimestampMs(payload.timestamp ?? payload.timeStamp);
};

export const getSurveyResponseAggregateTimestampMs = (row: unknown = {}, payload: unknown = {}): number => {
  const entryTimestamp = getSurveyResponseEntryTimestampMs(row);
  const payloadTimestamp = getSurveyResponsePayloadTimestampMs(payload);
  // Current client edits can advance only the top-level payload timestamp.
  // Effective recency must include that value so stale answer rows do not win.
  if (entryTimestamp === INVALID_RESPONSE_TIMESTAMP && payloadTimestamp === INVALID_RESPONSE_TIMESTAMP) {
    return 0;
  }
  if (entryTimestamp === INVALID_RESPONSE_TIMESTAMP) return payloadTimestamp;
  if (payloadTimestamp === INVALID_RESPONSE_TIMESTAMP) return entryTimestamp;
  return Math.max(entryTimestamp, payloadTimestamp);
};

export const isSurveyQuestionResponseNewer = (
  candidate: SurveyQuestionResponseCandidate,
  existing: SurveyQuestionResponseCandidate,
): boolean => {
  // Compare effective recency first, then payload recency, and finally preserve
  // later array order within the same payload revision.
  if (candidate.aggregateTimestampMs !== existing.aggregateTimestampMs) {
    return candidate.aggregateTimestampMs > existing.aggregateTimestampMs;
  }
  if (candidate.payloadTimestampMs !== existing.payloadTimestampMs) {
    return candidate.payloadTimestampMs > existing.payloadTimestampMs;
  }
  if (
    candidate.payloadTimestampMs !== INVALID_RESPONSE_TIMESTAMP &&
    candidate.payloadTimestampMs === existing.payloadTimestampMs
  ) {
    return candidate.index >= existing.index;
  }
  if (candidate.entryTimestampMs !== existing.entryTimestampMs) {
    return candidate.entryTimestampMs > existing.entryTimestampMs;
  }
  return candidate.index >= existing.index;
};

export const normalizeSurveyResponsePayloadByQuestionId = (payload: unknown): unknown => {
  const source = isRecord(payload) ? payload : null;
  if (!source) return payload;
  if (!Array.isArray(source.responses)) return { ...source };

  const payloadTimestampMs = getSurveyResponsePayloadTimestampMs(source);
  const passthroughRows: SurveyResponseNormalizationEntry[] = [];
  const latestByQuestionId = new Map<string, SurveyResponseLatestEntry>();

  source.responses.forEach((row, index) => {
    const clonedRow = isRecord(row) ? { ...row } : row;
    const questionId = getSurveyResponseQuestionId(row);
    if (!questionId) {
      passthroughRows.push({
        index,
        orderIndex: index,
        row: clonedRow,
      });
      return;
    }

    const candidate: SurveyResponseLatestEntry = {
      index,
      orderIndex: index,
      row: clonedRow,
      entryTimestampMs: getSurveyResponseEntryTimestampMs(row),
      payloadTimestampMs,
      aggregateTimestampMs: getSurveyResponseAggregateTimestampMs(row, source),
    };
    const existing = latestByQuestionId.get(questionId);
    if (!existing || isSurveyQuestionResponseNewer(candidate, existing)) {
      latestByQuestionId.set(questionId, {
        ...candidate,
        orderIndex: existing?.orderIndex ?? index,
      });
    }
  });

  const normalizedResponses = [...passthroughRows, ...Array.from(latestByQuestionId.values())]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((entry) => entry.row);

  return {
    ...source,
    responses: normalizedResponses,
  };
};

export const buildSurveyResultsIndividualResponseAggregator = (
  individualResponses: unknown,
): SurveyResultsIndividualAggregator => {
  const responseRows = Array.isArray(individualResponses) ? (individualResponses as SurveyResultsAggregateRow[]) : [];
  if (responseRows.length === 0) return {};

  const aggregator: SurveyResultsIndividualAggregator = {};

  responseRows.forEach((response) => {
    const parsedResponse = normalizeSurveyResponsePayloadByQuestionId(
      response.response,
    ) as SurveyResultsSurveyResponsePayload | null;
    if (!parsedResponse || !Array.isArray(parsedResponse.responses)) return;

    parsedResponse.responses.forEach((answerItem) => {
      const questionId = getSurveyResponseQuestionId(answerItem);
      if (!questionId) return;

      if (!aggregator[questionId]) {
        aggregator[questionId] = [];
      }

      aggregator[questionId].push({
        responder: String(response.responder || '').toLowerCase(),
        questionId,
        response: answerItem,
        timestamp: getSurveyResponseAggregateTimestampMs(answerItem, parsedResponse),
      });
    });
  });

  return aggregator;
};

const normalizeTsToMs = (val: unknown): number => {
  if (val == null) return NaN;
  if (typeof val === 'number') return val < 1e12 ? Math.floor(val * 1000) : val;
  if (typeof val === 'string') {
    if (/^\d+$/.test(val)) {
      const n = parseInt(val, 10);
      return n < 1e12 ? n * 1000 : n;
    }
    const d = Date.parse(val);
    return Number.isNaN(d) ? NaN : d;
  }
  return NaN;
};

const readTimestampValue = (value: unknown): unknown =>
  isRecord(value) ? (value.timestamp ?? value.timeStamp) : undefined;

const readAnswerTimestampValue = (value: unknown): unknown => {
  if (!isRecord(value)) return undefined;
  return isRecord(value.answer) ? (value.answer.timestamp ?? value.answer.timeStamp) : undefined;
};

export const pickTimestampMs = (primary: unknown, fallback1: unknown, fallback2: unknown): number => {
  const candidates = [
    readTimestampValue(primary),
    readAnswerTimestampValue(primary),
    readTimestampValue(fallback1),
    readTimestampValue(fallback2),
  ].filter((candidate) => candidate !== undefined && candidate !== null);

  for (const candidate of candidates) {
    const ms = normalizeTsToMs(candidate);
    if (!Number.isNaN(ms)) return ms;
  }
  return Number.NEGATIVE_INFINITY;
};

export const formatTsForCsv = (ms: unknown): string =>
  typeof ms === 'number' && ms > 0 && Number.isFinite(ms) ? new Date(ms).toISOString() : '';

export const countQuestionModeResponses = (
  aggregatorByQuestion: SurveyResultsAggregator = {},
  questionLookup: SurveyResultsQuestionLookup = {},
): number => {
  let total = 0;
  Object.keys(aggregatorByQuestion || {}).forEach((questionId) => {
    const rows = Array.isArray(aggregatorByQuestion[questionId])
      ? (aggregatorByQuestion[questionId] as SurveyResultsAggregateRow[])
      : [];
    const questionType = String(questionLookup?.[String(questionId || '').toLowerCase()]?.type || '').toLowerCase();
    rows.forEach((row) => {
      const parsedResponse = row?.response;
      if (isFreeformBlankAnswer(questionType, parsedResponse)) return;
      total += 1;
    });
  });
  return total;
};

export const hasAnyCountableSurveyAnswer = (
  parsedSurveyResponse: unknown,
  questionLookup: SurveyResultsQuestionLookup = {},
): boolean => {
  const answers =
    isRecord(parsedSurveyResponse) && Array.isArray(parsedSurveyResponse.responses)
      ? parsedSurveyResponse.responses
      : [];
  if (answers.length === 0) return false;
  for (let i = 0; i < answers.length; i += 1) {
    const answer = answers[i];
    const qid = getSurveyResponseQuestionId(answer);
    const questionType = String(questionLookup?.[qid]?.type || '').toLowerCase();
    if (isFreeformBlankAnswer(questionType, answer)) continue;
    return true;
  }
  return false;
};
