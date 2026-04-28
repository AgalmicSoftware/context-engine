import {
  buildPileLoadResultPlan,
  buildPileQuestionLoadState,
  buildPileVisibleTransitionPlan,
  shouldSkipPileFilterStateUpdate,
  sortPileQuestionsByPriority,
  splitPileMaskedQuestions,
} from './surveyPileQuestionFlow.js';

describe('surveyPileQuestionFlow', () => {
  it('sorts highlighted questions first, unanswered second, and answered last', () => {
    expect(sortPileQuestionsByPriority({
      questions: [
        { id: 'q1', prompt: 'Q1' },
        { id: 'q2', prompt: 'Q2' },
        { id: 'q3', prompt: 'Q3' },
      ],
      questionResponses: {
        q1: { '0xabc': { answer: { value: 'yes' } } },
      },
      responseCounts: {
        q1: 10,
        q2: 5,
        q3: 2,
      },
      highlightedQuestionIds: new Set(['q3']),
      account: '0xAbC',
    }).map((question) => String(question.id))).toEqual(['q3', 'q2', 'q1']);
  });

  it('splits masked pile questions away from visible ones', () => {
    expect(splitPileMaskedQuestions({
      questions: [
        { id: 'q1', prompt: '[encrypted]', promptDecrypted: false },
        { id: 'q2', prompt: 'Visible question', promptDecrypted: true },
      ],
    })).toEqual({
      hiddenQuestions: [{ id: 'q1', prompt: '[encrypted]', promptDecrypted: false }],
      visibleQuestions: [{ id: 'q2', prompt: 'Visible question', promptDecrypted: true }],
      hasHiddenGatedQuestions: true,
    });
  });

  it('builds pile loading state that settles to gated/empty once visible cards are absent', () => {
    expect(buildPileQuestionLoadState({
      visibleQuestions: [],
      hiddenQuestions: [{ id: 'q1', prompt: '[encrypted]', promptDecrypted: false }],
      settleUnreadyEmpty: false,
      isQuestionCacheReady: false,
      recentRateLimit: false,
    })).toEqual({
      hasHiddenGatedQuestions: true,
      loading: false,
    });

    expect(buildPileQuestionLoadState({
      visibleQuestions: [],
      hiddenQuestions: [],
      settleUnreadyEmpty: true,
      isQuestionCacheReady: false,
      recentRateLimit: false,
    })).toEqual({
      hasHiddenGatedQuestions: false,
      loading: false,
    });
  });

  it('builds unfiltered pile transition plans with clamped active indexes', () => {
    expect(buildPileVisibleTransitionPlan({
      previousPileQuestions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }],
      previousActivePileIndex: 2,
      nextVisibleQuestions: [{ id: 'q4' }],
      areQuestionListsEquivalent: (left, right) => JSON.stringify(left) === JSON.stringify(right),
    })).toEqual({
      pileChanged: true,
      indexChanged: true,
      clampedIndex: 0,
      nextVisibleForHydration: [{ id: 'q4' }],
      nextActiveIndexForHydration: 0,
    });
  });

  it('skips pile filter state updates when visible ids, hidden gating, and filter signatures match', () => {
    expect(shouldSkipPileFilterStateUpdate({
      nextVisibleSignature: '1:abc',
      currentVisibleSignature: '1:abc',
      nextHiddenGated: false,
      currentHiddenGated: false,
      nextFilterSignature: 'f:1',
      currentFilterSignature: 'f:1',
    })).toBe(true);

    expect(shouldSkipPileFilterStateUpdate({
      nextVisibleSignature: '1:abc',
      currentVisibleSignature: '2:def',
      nextHiddenGated: false,
      currentHiddenGated: false,
      nextFilterSignature: 'f:1',
      currentFilterSignature: 'f:1',
    })).toBe(false);
  });

  it('builds unfiltered pile load result plans with next-state patches and hydration signatures', () => {
    expect(buildPileLoadResultPlan({
      previousAllQuestionsForFilter: [{ id: 'q1' }],
      previousPileQuestions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }],
      previousActivePileIndex: 2,
      previousHasHiddenGatedQuestions: false,
      previousLoading: true,
      sortedQuestions: [{ id: 'q4' }, { id: 'q5' }],
      sortedVisibleQuestions: [{ id: 'q4' }],
      hiddenQuestions: [],
      hasHiddenGatedQuestions: false,
      isFilterActive: false,
      filterSig: '',
      questionResponses: {
        q4: { '0xabc': { answer: { value: 'yes' } } },
      },
      account: '0xAbC',
      settleUnreadyEmpty: false,
      isQuestionCacheReady: true,
      recentRateLimit: false,
      areQuestionListsEquivalent: (left, right) => JSON.stringify(left) === JSON.stringify(right),
      buildQuestionListSignature: (questions) => questions.map((question) => String(question.id)).join('|') || 'empty',
      getPileVisibleQuestionIds: (questions) => questions.map((question) => String(question.id)),
      buildPileVisibleResponseSignature: (_responses, visibleIds, account) => `${account}:${visibleIds.join(',')}`,
    })).toEqual({
      nextState: {
        allQuestionsForFilter: [{ id: 'q4' }, { id: 'q5' }],
        hasHiddenGatedQuestions: false,
        loading: false,
        pileQuestions: [{ id: 'q4' }],
        activePileIndex: 0,
      },
      nextLoading: false,
      nextVisibleForHydration: [{ id: 'q4' }],
      nextActiveIndexForHydration: 0,
      shouldUpdateState: true,
      shouldIncrementPileQuestionsGeneration: true,
      resultSignature: 'f0::::q4|q5::q4::0::0xabc:q4',
    });
  });

  it('keeps filtered pile load plans pinned to the existing visible window when only metadata stays the same', () => {
    expect(buildPileLoadResultPlan({
      previousAllQuestionsForFilter: [{ id: 'q1' }],
      previousPileQuestions: [{ id: 'q1' }],
      previousActivePileIndex: 0,
      previousHasHiddenGatedQuestions: false,
      previousLoading: false,
      sortedQuestions: [{ id: 'q1' }],
      sortedVisibleQuestions: [],
      hiddenQuestions: [],
      hasHiddenGatedQuestions: false,
      isFilterActive: true,
      filterSig: 'type:freeform',
      questionResponses: {
        q1: { '0xabc': { answer: { value: 'yes' } } },
      },
      account: '0xabc',
      settleUnreadyEmpty: true,
      isQuestionCacheReady: true,
      recentRateLimit: false,
      areQuestionListsEquivalent: (left, right) => JSON.stringify(left) === JSON.stringify(right),
      buildQuestionListSignature: (questions) => questions.map((question) => String(question.id)).join('|') || 'empty',
      getPileVisibleQuestionIds: (questions) => questions.map((question) => String(question.id)),
      buildPileVisibleResponseSignature: (_responses, visibleIds, account) => `${account}:${visibleIds.join(',')}`,
    })).toEqual({
      nextState: {
        allQuestionsForFilter: [{ id: 'q1' }],
        hasHiddenGatedQuestions: false,
        loading: false,
      },
      nextLoading: false,
      nextVisibleForHydration: [{ id: 'q1' }],
      nextActiveIndexForHydration: 0,
      shouldUpdateState: false,
      shouldIncrementPileQuestionsGeneration: false,
      resultSignature: 'f1::type:freeform::q1::empty::0::0xabc:q1',
    });
  });
});
