import {
  buildQuestionFilterAiApplyBasePatch,
  buildQuestionFilterAiApplyFailurePatch,
  buildQuestionFilterAiApplyErrorPatch,
  buildQuestionFilterAiApplyNoCandidatesPatch,
  buildQuestionFilterAiApplySuccessPatch,
  buildQuestionFilterAiApplyingPatch,
  buildQuestionFilterAiCombinePatch,
  buildQuestionFilterAiDraftQueryPatch,
  buildQuestionFilterAiElapsedPatch,
  buildQuestionFilterAiRankingCountPatch,
  buildQuestionFilterBookmarkFeedbackPatch,
  buildQuestionFilterBookmarkStatusPatch,
  buildQuestionFilterCachedResponsesPatch,
  buildQuestionFilterCopyUrlSuccessPatch,
  buildQuestionFilterFilteredQuestionsCountPatch,
  buildQuestionFilterFilterLoadingPatch,
  buildQuestionFilterLoadInputTogglePatch,
  buildQuestionFilterNotRespondedStatusPatch,
  buildQuestionFilterPendingSelectedTypesPatch,
  buildQuestionFilterRemoveAiPatch,
  buildQuestionFilterRemoveTopQuestionsPatch,
  buildQuestionFilterRespondedStatusPatch,
  buildQuestionFilterSbtItemRemovalState,
  buildQuestionFilterSbtLocalStatePatch,
  buildQuestionFilterSelectedTagsPatch,
  buildQuestionFilterStateFromComponentState,
  buildQuestionFilterTopQuestionsCountPatch,
  buildQuestionFilterUrlInputPatch,
  isQuestionFilterStateDefault,
  normalizeAiIdList,
  normalizeFilterSelectionList,
  normalizePositiveInt,
  normalizeResponseStatusFilterState,
  normalizeSbtFilterLocalState,
} from './questionFilterHelpers.js';

describe('questionFilterHelpers.normalizePositiveInt', () => {
  it('keeps positive integer input and falls back for invalid values', () => {
    expect(normalizePositiveInt('12', 10)).toBe(12);
    expect(normalizePositiveInt('0', 10)).toBe(10);
    expect(normalizePositiveInt('-2', 10)).toBe(10);
    expect(normalizePositiveInt('abc', 10)).toBe(10);
  });
});

describe('questionFilterHelpers.normalizeAiIdList', () => {
  it('trims ids and dedupes case-insensitively while preserving first spelling', () => {
    expect(normalizeAiIdList([' Q1 ', 'q1', '', 'Q2', null])).toEqual(['Q1', 'Q2']);
  });

  it('returns an empty list for non-array input', () => {
    expect(normalizeAiIdList('q1')).toEqual([]);
  });
});

describe('questionFilterHelpers.normalizeResponseStatusFilterState', () => {
  it('drops response-status filters when no wallet account is connected', () => {
    expect(
      normalizeResponseStatusFilterState({
        account: '',
        filterByResponded: true,
        filterByNotResponded: true,
      }),
    ).toEqual({
      filterByResponded: false,
      filterByNotResponded: false,
    });
  });

  it('keeps response-status filters when an account is available', () => {
    expect(
      normalizeResponseStatusFilterState({
        account: '0xabc',
        filterByResponded: true,
        filterByNotResponded: false,
      }),
    ).toEqual({
      filterByResponded: true,
      filterByNotResponded: false,
    });
  });
});

describe('questionFilterHelpers filter state normalization', () => {
  it('copies selected type/tag arrays and drops non-array values', () => {
    const source = ['binary', 'freeform'];
    const normalized = normalizeFilterSelectionList(source);

    expect(normalized).toEqual(['binary', 'freeform']);
    expect(normalized).not.toBe(source);
    expect(normalizeFilterSelectionList('binary')).toEqual([]);
  });

  it('copies SBT local filter records and drops null or array values', () => {
    const source = {
      selectedSBTGroupsCreator: [{ address: '0x1' }],
    };
    const normalized = normalizeSbtFilterLocalState(source);

    expect(normalized).toEqual(source);
    expect(normalized).not.toBe(source);
    expect(normalizeSbtFilterLocalState(null)).toBeNull();
    expect(normalizeSbtFilterLocalState([])).toBeNull();
  });
});

describe('questionFilterHelpers.isQuestionFilterStateDefault', () => {
  const defaultFilterState = {
    topQuestions: null,
    questionTypes: [],
    sbtFilter: null,
    aiFilter: null,
    aiTopN: null,
    aiCombine: false,
    selectedTags: [],
    responseStatus: null,
  };

  it('treats the component default filter shape and empty SBT lists as default', () => {
    expect(isQuestionFilterStateDefault(null)).toBe(true);
    expect(isQuestionFilterStateDefault(defaultFilterState)).toBe(true);
    expect(
      isQuestionFilterStateDefault({
        ...defaultFilterState,
        sbtFilter: {
          selectedSBTGroupsCreator: [],
          excludedSBTGroupsCreator: [],
          selectedSBTGroupsResponder: [],
          excludedSBTGroupsResponder: [],
          selectedSBTGroups: [],
          excludedSBTGroups: [],
        },
        responseStatus: {
          responded: true,
          notResponded: true,
        },
      }),
    ).toBe(true);
  });

  it('detects active filter state across each supported filter family', () => {
    expect(
      isQuestionFilterStateDefault({
        ...defaultFilterState,
        topQuestions: { count: 10, by: 'responses' },
      }),
    ).toBe(false);
    expect(
      isQuestionFilterStateDefault({
        ...defaultFilterState,
        questionTypes: ['freeform'],
      }),
    ).toBe(false);
    expect(
      isQuestionFilterStateDefault({
        ...defaultFilterState,
        selectedTags: ['alpha'],
      }),
    ).toBe(false);
    expect(
      isQuestionFilterStateDefault({
        ...defaultFilterState,
        sbtFilter: { selectedSBTGroups: [{ address: '0x1' }] },
      }),
    ).toBe(false);
    expect(
      isQuestionFilterStateDefault({
        ...defaultFilterState,
        aiFilter: 'rank this',
      }),
    ).toBe(false);
    expect(
      isQuestionFilterStateDefault({
        ...defaultFilterState,
        aiTopN: 5,
      }),
    ).toBe(false);
    expect(
      isQuestionFilterStateDefault({
        ...defaultFilterState,
        aiCombine: true,
      }),
    ).toBe(false);
    expect(
      isQuestionFilterStateDefault({
        ...defaultFilterState,
        responseStatus: { responded: true, notResponded: false },
      }),
    ).toBe(false);
  });

  it('preserves legacy non-default handling for partial empty objects', () => {
    expect(isQuestionFilterStateDefault({})).toBe(false);
    expect(
      isQuestionFilterStateDefault({
        ...defaultFilterState,
        questionTypes: undefined,
      }),
    ).toBe(false);
    expect(
      isQuestionFilterStateDefault({
        ...defaultFilterState,
        selectedTags: undefined,
      }),
    ).toBe(false);
  });
});

describe('questionFilterHelpers.buildQuestionFilterStateFromComponentState', () => {
  const baseState = {
    selectedTypes: [],
    selectedTags: [],
    sbtFilterLocalState: null,
    showTopQuestions: false,
    showTopQuestionsByResponses: false,
    topQuestionsCount: 10,
    aiFilterApplied: false,
    aiSearchQuery: '',
    aiAppliedTopN: null,
    aiCombineWithOtherFilters: false,
    filterByResponded: false,
    filterByNotResponded: false,
  };

  it('projects component state to the serializable filter state shape', () => {
    expect(
      buildQuestionFilterStateFromComponentState({
        ...baseState,
        selectedTypes: ['freeform'],
        selectedTags: ['alpha'],
        sbtFilterLocalState: { selectedSBTGroups: [{ address: '0x1' }] },
        showTopQuestionsByResponses: true,
        topQuestionsCount: 5,
      }),
    ).toEqual({
      topQuestions: { count: 5, by: 'responses' },
      questionTypes: ['freeform'],
      sbtFilter: { selectedSBTGroups: [{ address: '0x1' }] },
      aiFilter: null,
      aiTopN: null,
      aiCombine: false,
      selectedTags: ['alpha'],
      responseStatus: null,
    });
  });

  it('prefers importance top questions over response top questions and normalizes active AI filters', () => {
    expect(
      buildQuestionFilterStateFromComponentState(
        {
          ...baseState,
          showTopQuestions: true,
          showTopQuestionsByResponses: true,
          topQuestionsCount: 3,
          aiFilterApplied: true,
          aiSearchQuery: ' rank this ',
          aiAppliedTopN: 'bad',
          aiCombineWithOtherFilters: true,
          filterByResponded: true,
        },
        12,
      ),
    ).toEqual({
      topQuestions: { count: 3, by: 'importance' },
      questionTypes: [],
      sbtFilter: null,
      aiFilter: ' rank this ',
      aiTopN: 12,
      aiCombine: true,
      selectedTags: [],
      responseStatus: { responded: true, notResponded: false },
    });
  });

  it('suppresses AI and response-status filters when their active-state rules are not met', () => {
    expect(
      buildQuestionFilterStateFromComponentState({
        ...baseState,
        aiFilterApplied: true,
        aiSearchQuery: '   ',
        aiAppliedTopN: 4,
        aiCombineWithOtherFilters: true,
        filterByResponded: true,
        filterByNotResponded: true,
      }),
    ).toMatchObject({
      aiFilter: null,
      aiTopN: null,
      aiCombine: false,
      responseStatus: null,
    });
  });
});

describe('questionFilterHelpers.buildQuestionFilterSbtItemRemovalState', () => {
  const makeState = () => ({
    selectedSBTGroupsCreator: [{ address: '0xAa' }, { address: '0xBb' }],
    excludedSBTGroupsCreator: [{ address: '0xCc' }],
    selectedSBTGroupsResponder: [{ address: '0xDd' }],
    excludedSBTGroupsResponder: [{ address: '0xEe' }],
    selectedSBTGroups: [{ address: '0xFf' }],
    excludedSBTGroups: [{ address: '0x11' }],
  });

  it('removes SBT filter entries by role and address case-insensitively', () => {
    expect(
      buildQuestionFilterSbtItemRemovalState(makeState(), {
        role: 'creatorInclude',
        sbtAddress: '0xaa',
      }).selectedSBTGroupsCreator,
    ).toEqual([{ address: '0xBb' }]);
    expect(
      buildQuestionFilterSbtItemRemovalState(makeState(), {
        role: 'creatorExclude',
        sbtAddress: '0xcc',
      }).excludedSBTGroupsCreator,
    ).toEqual([]);
    expect(
      buildQuestionFilterSbtItemRemovalState(makeState(), {
        role: 'responderInclude',
        sbtAddress: '0xdd',
      }).selectedSBTGroupsResponder,
    ).toEqual([]);
    expect(
      buildQuestionFilterSbtItemRemovalState(makeState(), {
        role: 'responderExclude',
        sbtAddress: '0xee',
      }).excludedSBTGroupsResponder,
    ).toEqual([]);
    expect(
      buildQuestionFilterSbtItemRemovalState(makeState(), {
        role: 'include',
        sbtAddress: '0xff',
      }).selectedSBTGroups,
    ).toEqual([]);
    expect(
      buildQuestionFilterSbtItemRemovalState(makeState(), {
        role: 'exclude',
        sbtAddress: '0x11',
      }).excludedSBTGroups,
    ).toEqual([]);
  });

  it('copies the local state and leaves unknown roles untouched', () => {
    const state = makeState();
    const next = buildQuestionFilterSbtItemRemovalState(state, {
      role: 'unknown',
      sbtAddress: '0xaa',
    });

    expect(next).toEqual(state);
    expect(next).not.toBe(state);
    expect(
      buildQuestionFilterSbtItemRemovalState(null, {
        role: 'include',
        sbtAddress: '0xaa',
      }),
    ).toEqual({});
  });
});

describe('questionFilterHelpers bookmark state patches', () => {
  it('normalizes current-filter bookmark status patches', () => {
    expect(buildQuestionFilterBookmarkStatusPatch('yes')).toEqual({
      isCurrentFilterBookmarked: true,
    });
    expect(buildQuestionFilterBookmarkStatusPatch(0)).toEqual({
      isCurrentFilterBookmarked: false,
    });
  });

  it('normalizes bookmark feedback patches', () => {
    expect(buildQuestionFilterBookmarkFeedbackPatch(true)).toEqual({
      filterBookmarkedFeedback: true,
    });
    expect(buildQuestionFilterBookmarkFeedbackPatch(null)).toEqual({
      filterBookmarkedFeedback: false,
    });
  });
});

describe('questionFilterHelpers status state patches', () => {
  it('builds AI elapsed and error patches', () => {
    expect(buildQuestionFilterAiElapsedPatch(3)).toEqual({
      aiApplyingElapsedSec: 3,
    });
    expect(buildQuestionFilterAiElapsedPatch(null)).toEqual({
      aiApplyingElapsedSec: 0,
    });
    expect(buildQuestionFilterAiApplyErrorPatch('Enter a query')).toEqual({
      aiApplyError: 'Enter a query',
    });
    expect(buildQuestionFilterAiDraftQueryPatch(' find this ')).toEqual({
      aiDraftQuery: ' find this ',
      aiApplyError: '',
    });
    expect(buildQuestionFilterAiRankingCountPatch('4', 10)).toEqual({
      aiRankingCount: 4,
      aiApplyError: '',
    });
    expect(buildQuestionFilterAiRankingCountPatch('bad', 10)).toEqual({
      aiRankingCount: 10,
      aiApplyError: '',
    });
    expect(buildQuestionFilterAiCombinePatch(true)).toEqual({
      aiCombineWithOtherFilters: true,
      aiApplyError: '',
    });
    expect(buildQuestionFilterAiCombinePatch('true')).toEqual({
      aiCombineWithOtherFilters: false,
      aiApplyError: '',
    });
    expect(buildQuestionFilterAiApplyingPatch()).toEqual({
      aiApplying: true,
      aiApplyError: '',
    });
    expect(buildQuestionFilterAiApplyFailurePatch('failed')).toEqual({
      aiApplying: false,
      aiApplyError: 'failed',
    });
    expect(buildQuestionFilterAiApplyBasePatch({ query: 'alpha', topN: 3 })).toEqual({
      aiApplying: false,
      aiSearchQuery: 'alpha',
      aiDraftQuery: 'alpha',
      aiRankingCount: 3,
      aiAppliedTopN: 3,
      aiApplyError: '',
    });
    expect(buildQuestionFilterAiApplyNoCandidatesPatch({ query: 'alpha', topN: 3 })).toEqual({
      aiApplying: false,
      aiSearchQuery: 'alpha',
      aiDraftQuery: 'alpha',
      aiRankingCount: 3,
      aiAppliedTopN: 3,
      aiApplyError: '',
      aiFilterApplied: false,
      aiRankedQuestionIds: [],
      aiLastAppliedSignature: '',
    });
    expect(
      buildQuestionFilterAiApplySuccessPatch({
        applySignature: 'sig',
        rankedQuestionIds: ['Q1', 'q1', 'Q2'],
        query: 'alpha',
        topN: 3,
      }),
    ).toEqual({
      aiApplying: false,
      aiSearchQuery: 'alpha',
      aiDraftQuery: 'alpha',
      aiRankingCount: 3,
      aiAppliedTopN: 3,
      aiApplyError: '',
      aiFilterApplied: true,
      aiRankedQuestionIds: ['Q1', 'Q2'],
      aiLastAppliedSignature: 'sig',
    });
    expect(buildQuestionFilterRemoveAiPatch()).toEqual({
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
  });

  it('builds filter loading, copy success, and count patches', () => {
    expect(buildQuestionFilterFilterLoadingPatch(true)).toEqual({
      filterLoading: true,
    });
    expect(buildQuestionFilterFilterLoadingPatch(null)).toEqual({
      filterLoading: null,
    });
    expect(buildQuestionFilterCopyUrlSuccessPatch(1)).toEqual({
      copiedUrlSuccess: true,
    });
    expect(buildQuestionFilterCopyUrlSuccessPatch('')).toEqual({
      copiedUrlSuccess: false,
    });
    expect(buildQuestionFilterFilteredQuestionsCountPatch(7)).toEqual({
      filteredQuestionsCount: 7,
    });
    expect(buildQuestionFilterPendingSelectedTypesPatch(['text', 'radio'])).toEqual({
      pendingSelectedTypes: ['text', 'radio'],
    });
    expect(buildQuestionFilterSelectedTagsPatch(['alpha', 'beta'])).toEqual({
      selectedTags: ['alpha', 'beta'],
    });
    expect(buildQuestionFilterTopQuestionsCountPatch(5)).toEqual({
      pendingTopQuestionsCount: 5,
    });
    expect(buildQuestionFilterTopQuestionsCountPatch('7')).toEqual({
      pendingTopQuestionsCount: 7,
    });
    expect(buildQuestionFilterTopQuestionsCountPatch(0)).toEqual({
      pendingTopQuestionsCount: 10,
    });
    expect(buildQuestionFilterTopQuestionsCountPatch(Number.NaN)).toEqual({
      pendingTopQuestionsCount: 10,
    });
    expect(buildQuestionFilterTopQuestionsCountPatch('not-a-number')).toEqual({
      pendingTopQuestionsCount: 10,
    });
    expect(buildQuestionFilterTopQuestionsCountPatch('0', 3)).toEqual({
      pendingTopQuestionsCount: 3,
    });
    expect(buildQuestionFilterRemoveTopQuestionsPatch()).toEqual({
      pendingShowTopQuestions: false,
      pendingShowTopQuestionsByResponses: false,
    });
    expect(buildQuestionFilterRespondedStatusPatch(false)).toEqual({
      filterByResponded: false,
    });
    expect(buildQuestionFilterNotRespondedStatusPatch(false)).toEqual({
      filterByNotResponded: false,
    });
  });

  it('preserves cache response and SBT local state payloads by reference', () => {
    const cachedQuestionResponses = { q1: { responder: '0x1' } };
    const sbtFilterLocalState = { selectedSBTGroups: [{ address: '0x1' }] };

    expect(buildQuestionFilterCachedResponsesPatch(cachedQuestionResponses)).toEqual({
      cachedQuestionResponses,
    });
    expect(buildQuestionFilterCachedResponsesPatch(cachedQuestionResponses).cachedQuestionResponses).toBe(
      cachedQuestionResponses,
    );
    expect(buildQuestionFilterSbtLocalStatePatch(sbtFilterLocalState)).toEqual({
      sbtFilterLocalState,
    });
  });

  it('builds load-filter input and visibility patches', () => {
    expect(buildQuestionFilterUrlInputPatch('filter=abc')).toEqual({
      filterUrlInput: 'filter=abc',
    });
    expect(buildQuestionFilterLoadInputTogglePatch({ showLoadInput: false })).toEqual({
      showLoadInput: true,
    });
    expect(buildQuestionFilterLoadInputTogglePatch({ showLoadInput: true })).toEqual({
      showLoadInput: false,
    });
    expect(buildQuestionFilterLoadInputTogglePatch({ showLoadInput: 'open' })).toEqual({
      showLoadInput: false,
    });
  });
});
