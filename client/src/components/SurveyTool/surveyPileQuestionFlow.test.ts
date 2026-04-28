import {
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
});
