import { toStr } from '../../utilities/shared/primitives.js';

type ResponseStatusFilterStateInput = {
  filterByResponded?: unknown;
  filterByNotResponded?: unknown;
  account?: unknown;
};

export type ResponseStatusFilterState = {
  filterByResponded: boolean;
  filterByNotResponded: boolean;
};

export type SbtFilterLocalState = Record<string, unknown>;

export const normalizePositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const DEFAULT_TOP_QUESTIONS_COUNT = 10;

export const normalizeAiIdList = (ids: unknown = []): string[] => {
  const source = Array.isArray(ids) ? ids : [];
  const seen = new Set<string>();
  const out: string[] = [];
  source.forEach((id) => {
    const text = String(id || '').trim();
    if (!text) return;
    const lower = text.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    out.push(text);
  });
  return out;
};

export const normalizeResponseStatusFilterState = ({
  filterByResponded = false,
  filterByNotResponded = false,
  account = '',
}: ResponseStatusFilterStateInput = {}): ResponseStatusFilterState => {
  // Response-status filters are wallet-scoped. When no wallet is connected,
  // drop them instead of preserving a latent filter for a future reconnect.
  if (!toStr(account).trim()) {
    return {
      filterByResponded: false,
      filterByNotResponded: false,
    };
  }
  return {
    filterByResponded: !!filterByResponded,
    filterByNotResponded: !!filterByNotResponded,
  };
};

export const normalizeFilterSelectionList = (value: unknown): unknown[] => (Array.isArray(value) ? [...value] : []);

export const normalizeSbtFilterLocalState = (value: unknown): SbtFilterLocalState | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as SbtFilterLocalState) } : null;

export const isQuestionFilterStateDefault = (filterStateToTest: unknown): boolean => {
  if (!filterStateToTest) {
    return true;
  }

  const filterState = filterStateToTest as {
    aiCombine?: unknown;
    aiFilter?: unknown;
    aiTopN?: unknown;
    questionTypes?: unknown;
    responseStatus?: { responded?: unknown; notResponded?: unknown } | null;
    sbtFilter?: unknown;
    selectedTags?: unknown;
    topQuestions?: unknown;
  };
  const isTopQuestionsDefault = filterState.topQuestions === null;
  const isQuestionTypesDefault = Array.isArray(filterState.questionTypes) && filterState.questionTypes.length === 0;

  const sbtFilter = filterState.sbtFilter as Record<string, { length?: number } | undefined> | null | undefined;
  let isSbtFilterDefault = sbtFilter === null;
  if (sbtFilter && typeof sbtFilter === 'object') {
    const allSbtListsEmpty =
      (!sbtFilter.selectedSBTGroupsCreator || sbtFilter.selectedSBTGroupsCreator.length === 0) &&
      (!sbtFilter.excludedSBTGroupsCreator || sbtFilter.excludedSBTGroupsCreator.length === 0) &&
      (!sbtFilter.selectedSBTGroupsResponder || sbtFilter.selectedSBTGroupsResponder.length === 0) &&
      (!sbtFilter.excludedSBTGroupsResponder || sbtFilter.excludedSBTGroupsResponder.length === 0) &&
      (!sbtFilter.selectedSBTGroups || sbtFilter.selectedSBTGroups.length === 0) &&
      (!sbtFilter.excludedSBTGroups || sbtFilter.excludedSBTGroups.length === 0);
    isSbtFilterDefault = allSbtListsEmpty;
  }

  const isAiFilterDefault = filterState.aiFilter === null || filterState.aiFilter === '';
  const isAiTopNDefault = filterState.aiTopN == null;
  const isAiCombineDefault = filterState.aiCombine !== true;
  const isSelectedTagsDefault = Array.isArray(filterState.selectedTags) && filterState.selectedTags.length === 0;
  const responseStatus = filterState.responseStatus;
  const responded = responseStatus?.responded === true;
  const notResponded = responseStatus?.notResponded === true;
  const isResponseStatusDefault =
    responseStatus === null ||
    responseStatus === undefined ||
    (!responded && !notResponded) ||
    (responded && notResponded);

  return (
    isTopQuestionsDefault &&
    isQuestionTypesDefault &&
    isSbtFilterDefault &&
    isAiFilterDefault &&
    isAiTopNDefault &&
    isAiCombineDefault &&
    isSelectedTagsDefault &&
    isResponseStatusDefault
  );
};

export const buildQuestionFilterStateFromComponentState = (state: unknown = {}, defaultAiTopN = 10) => {
  const stateRecord = state as {
    aiAppliedTopN?: unknown;
    aiCombineWithOtherFilters?: unknown;
    aiFilterApplied?: unknown;
    aiSearchQuery?: unknown;
    filterByNotResponded?: unknown;
    filterByResponded?: unknown;
    sbtFilterLocalState?: unknown;
    selectedTags?: unknown;
    selectedTypes?: unknown;
    showTopQuestions?: unknown;
    showTopQuestionsByResponses?: unknown;
    topQuestionsCount?: unknown;
  };
  let topQuestionsValue: { count: unknown; by: string } | null = null;
  if (stateRecord.showTopQuestions) {
    topQuestionsValue = { count: stateRecord.topQuestionsCount, by: 'importance' };
  } else if (stateRecord.showTopQuestionsByResponses) {
    topQuestionsValue = { count: stateRecord.topQuestionsCount, by: 'responses' };
  }

  const aiFilterIsActive = !!stateRecord.aiFilterApplied && String(stateRecord.aiSearchQuery || '').trim() !== '';
  const filterByResponded = stateRecord.filterByResponded === true;
  const filterByNotResponded = stateRecord.filterByNotResponded === true;
  const responseStatus =
    (filterByResponded || filterByNotResponded) && !(filterByResponded && filterByNotResponded)
      ? { responded: filterByResponded, notResponded: filterByNotResponded }
      : null;

  return {
    topQuestions: topQuestionsValue,
    questionTypes: stateRecord.selectedTypes,
    sbtFilter: stateRecord.sbtFilterLocalState,
    aiFilter: aiFilterIsActive ? stateRecord.aiSearchQuery : null,
    aiTopN: aiFilterIsActive ? normalizePositiveInt(stateRecord.aiAppliedTopN, defaultAiTopN) : null,
    aiCombine: aiFilterIsActive && stateRecord.aiCombineWithOtherFilters === true,
    selectedTags: stateRecord.selectedTags,
    responseStatus,
  };
};

export const buildQuestionFilterSbtItemRemovalState = (
  localStateInput: unknown = {},
  item: { role?: unknown; sbtAddress?: unknown } = {},
): SbtFilterLocalState => {
  const localState =
    localStateInput && typeof localStateInput === 'object' ? (localStateInput as SbtFilterLocalState) : {};
  const updatedState: SbtFilterLocalState = { ...localState };
  const role = String(item?.role || '');
  const sbtAddress = String(item?.sbtAddress || '');
  const roleKeyByName: Record<string, string> = {
    creatorInclude: 'selectedSBTGroupsCreator',
    creatorExclude: 'excludedSBTGroupsCreator',
    responderInclude: 'selectedSBTGroupsResponder',
    responderExclude: 'excludedSBTGroupsResponder',
    include: 'selectedSBTGroups',
    exclude: 'excludedSBTGroups',
  };
  const listKey = roleKeyByName[role];
  const list = listKey ? updatedState[listKey] : null;
  if (Array.isArray(list)) {
    updatedState[listKey] = list.filter(
      (entry) => (entry as { address: string }).address.toLowerCase() !== sbtAddress.toLowerCase(),
    );
  }
  return updatedState;
};

export const buildQuestionFilterBookmarkStatusPatch = (isBookmarked: unknown) => ({
  isCurrentFilterBookmarked: !!isBookmarked,
});

export const buildQuestionFilterBookmarkFeedbackPatch = (filterBookmarkedFeedback: unknown) => ({
  filterBookmarkedFeedback: !!filterBookmarkedFeedback,
});

export const buildQuestionFilterAiElapsedPatch = (aiApplyingElapsedSec: unknown) => ({
  aiApplyingElapsedSec: Number(aiApplyingElapsedSec || 0),
});

export const buildQuestionFilterAiApplyErrorPatch = (aiApplyError: unknown) => ({
  aiApplyError,
});

export const buildQuestionFilterAiDraftQueryPatch = (aiDraftQuery: unknown) => ({
  aiDraftQuery: String(aiDraftQuery || ''),
  aiApplyError: '',
});

export const buildQuestionFilterAiRankingCountPatch = (aiRankingCount: unknown, fallback: number) => ({
  aiRankingCount: normalizePositiveInt(aiRankingCount, fallback),
  aiApplyError: '',
});

export const buildQuestionFilterAiCombinePatch = (aiCombineWithOtherFilters: unknown) => ({
  aiCombineWithOtherFilters: aiCombineWithOtherFilters === true,
  aiApplyError: '',
});

export const buildQuestionFilterAiApplyingPatch = () => ({
  aiApplying: true,
  aiApplyError: '',
});

export const buildQuestionFilterAiApplyFailurePatch = (aiApplyError: unknown) => ({
  aiApplying: false,
  aiApplyError,
});

export const buildQuestionFilterAiApplyBasePatch = ({
  query = '',
  topN = 0,
}: { query?: unknown; topN?: unknown } = {}) => ({
  aiApplying: false,
  aiSearchQuery: query,
  aiDraftQuery: query,
  aiRankingCount: topN,
  aiAppliedTopN: topN,
  aiApplyError: '',
});

export const buildQuestionFilterAiApplyNoCandidatesPatch = ({
  query = '',
  topN = 0,
}: { query?: unknown; topN?: unknown } = {}) => ({
  ...buildQuestionFilterAiApplyBasePatch({ query, topN }),
  aiFilterApplied: false,
  aiRankedQuestionIds: [],
  aiLastAppliedSignature: '',
});

export const buildQuestionFilterAiApplySuccessPatch = ({
  applySignature = '',
  rankedQuestionIds = [],
  query = '',
  topN = 0,
}: {
  applySignature?: unknown;
  rankedQuestionIds?: unknown;
  query?: unknown;
  topN?: unknown;
} = {}) => ({
  ...buildQuestionFilterAiApplyBasePatch({ query, topN }),
  aiFilterApplied: true,
  aiRankedQuestionIds: normalizeAiIdList(rankedQuestionIds),
  aiLastAppliedSignature: applySignature,
});

export const buildQuestionFilterRemoveAiPatch = () => ({
  aiSearchQuery: '',
  aiDraftQuery: '',
  aiAppliedTopN: null,
  aiFilterApplied: false,
  aiCombineWithOtherFilters: false,
  aiRankedQuestionIds: [],
  aiApplying: false,
  aiApplyError: '',
  aiLastAppliedSignature: '',
});

export const buildQuestionFilterFilterLoadingPatch = (filterLoading: unknown) => ({
  filterLoading,
});

export const buildQuestionFilterCopyUrlSuccessPatch = (copiedUrlSuccess: unknown) => ({
  copiedUrlSuccess: !!copiedUrlSuccess,
});

export const buildQuestionFilterFilteredQuestionsCountPatch = (filteredQuestionsCount: unknown) => ({
  filteredQuestionsCount,
});

export const buildQuestionFilterPendingSelectedTypesPatch = (pendingSelectedTypes: unknown) => ({
  pendingSelectedTypes,
});

export const buildQuestionFilterSelectedTagsPatch = (selectedTags: unknown) => ({
  selectedTags,
});

export const buildQuestionFilterTopQuestionsCountPatch = (
  pendingTopQuestionsCount: unknown,
  fallback = DEFAULT_TOP_QUESTIONS_COUNT,
) => ({
  pendingTopQuestionsCount: normalizePositiveInt(pendingTopQuestionsCount, fallback),
});

export const buildQuestionFilterRemoveTopQuestionsPatch = () => ({
  pendingShowTopQuestions: false,
  pendingShowTopQuestionsByResponses: false,
});

export const buildQuestionFilterRespondedStatusPatch = (filterByResponded: unknown) => ({
  filterByResponded,
});

export const buildQuestionFilterNotRespondedStatusPatch = (filterByNotResponded: unknown) => ({
  filterByNotResponded,
});

export const buildQuestionFilterCachedResponsesPatch = (cachedQuestionResponses: unknown) => ({
  cachedQuestionResponses,
});

export const buildQuestionFilterSbtLocalStatePatch = (sbtFilterLocalState: unknown) => ({
  sbtFilterLocalState,
});

export const buildQuestionFilterUrlInputPatch = (filterUrlInput: unknown) => ({
  filterUrlInput,
});

export const buildQuestionFilterLoadInputTogglePatch = (
  state: { showLoadInput?: unknown } | null | undefined = {},
) => ({
  showLoadInput: !state?.showLoadInput,
});
