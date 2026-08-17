import { createSurveyQuestionsProgressRuntime } from './surveyQuestionsProgressRuntime';
import type { SurveyQuestionsLegacyRecord } from './surveyQuestionsTypes';

const createContext = (overrides: SurveyQuestionsLegacyRecord = {}) => ({
  buildBookmarkedQuestionsState: jest.fn((questions = []) => ({ bookmarkedQuestions: new Set(questions) })),
  buildClearedTransientSubmitFeedbackState: jest.fn(() => ({ submissionError: null })),
  buildEditStatsState: jest.fn((input) => ({ editStats: input })),
  buildEmptyResponseFieldState: jest.fn(() => ({ value: '' })),
  buildInitialSurveyResponseQuestionIds: jest.fn(() => ['q1']),
  buildInitializedSurveyResponseState: jest.fn((input) => [{ answers: { q1: { value: '' } }, input }]),
  buildQuestionPoolPendingSubmitFeedbackMessage: jest.fn(({ pendingCount }) => `Waiting on ${pendingCount} questions`),
  buildSurveyQuestionPoolLoadState: jest.fn(() => ({ isIncomplete: false, pendingCount: 0 })),
  buildTransientSubmitFeedbackState: jest.fn(({ message }) => ({ submissionError: message })),
  computeModifiedQuestionsCount: jest.fn(() => 2),
  engine: { id: 'engine' },
  fetchQuestionPool: jest.fn(() => Promise.resolve()),
  getCurrentRenderedQuestionIds: jest.fn(() => ['q1']),
  getPendingEditStats: jest.fn(() => ({ encrypted: 1, total: 3 })),
  getRuntimeStrategy: jest.fn(() => ({})),
  handleStartFresh: jest.fn(),
  inst: {
    _emptySubmitTimer: null,
    _isMounted: true,
  },
  normalizeTransientSubmitFeedbackDurationMs: jest.fn((value) => value),
  peekCacheSync: jest.fn(() => null),
  propsRef: {
    current: {
      isStandalone: false,
      questionID: 'q1',
      questionPool: [{ id: 'q1' }],
      singleQuestionMode: false,
      surveyIndex: 0,
    },
  },
  readCache: jest.fn(() => Promise.resolve({ questions: ['q1'] })),
  readRenderedQuestionIds: jest.fn(({ getRenderedQuestionIds }) => getRenderedQuestionIds()),
  resolveDiffBaselineSlice: jest.fn(() => ({ answers: {} })),
  resolveEffectiveSlug: jest.fn(() => 'edge'),
  setState: jest.fn(),
  shouldSurveyAutoStartFresh: jest.fn(() => false),
  stateRef: {
    current: {
      encryptedModifiedCount: 0,
      hasEncryptedChanges: false,
      isDirty: false,
      isSubmitting: false,
      modifiedCount: 0,
      pileDiscardedEdits: false,
      questionPool: [{ id: 'q1' }],
      questionPoolExpectedIds: ['q1', 'q2'],
      questionPoolPendingIds: ['q2'],
      submittedSinceLastEdit: false,
      submissionComplete: true,
      surveysResponseState: [{ answers: { q1: { value: 'answer' } } }],
      userHasResponse: true,
    },
  },
  surveyLog: {
    error: jest.fn(),
    warn: jest.fn(),
  },
  writeCacheOptimistic: jest.fn(() => Promise.resolve()),
  ...overrides,
});

describe('surveyQuestionsProgressRuntime', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads bookmarks from async cache when no sync cache exists', async () => {
    const context = createContext();
    const runtime = createSurveyQuestionsProgressRuntime(context);

    await runtime.loadBookmarks();

    expect(context.peekCacheSync).toHaveBeenCalledWith('bookmarksCache', 'edge');
    expect(context.readCache).toHaveBeenCalledWith('bookmarksCache', 'edge');
    expect(context.buildBookmarkedQuestionsState).toHaveBeenCalledWith(['q1']);
    expect(context.setState).toHaveBeenCalledWith({ bookmarkedQuestions: new Set(['q1']) });
  });

  it('toggles bookmarks optimistically and persists the updated cache object', () => {
    const context = createContext({
      peekCacheSync: jest.fn(() => ({ questions: ['q1'] })),
    });
    const runtime = createSurveyQuestionsProgressRuntime(context);

    runtime.handleBookmarkToggle('q2');

    expect(context.buildBookmarkedQuestionsState).toHaveBeenCalledWith(['q1', 'q2']);
    expect(context.setState).toHaveBeenCalledWith({ bookmarkedQuestions: new Set(['q1', 'q2']) });
    expect(context.writeCacheOptimistic).toHaveBeenCalledWith('bookmarksCache', 'edge', {
      questions: ['q1', 'q2'],
    });
  });

  it('persists and restores bookmarks for an anonymous visitor', async () => {
    let persistedBookmarks: { questions: string[] } | null = null;
    const anonymousContext = createContext({
      peekCacheSync: jest.fn(() => persistedBookmarks),
      propsRef: {
        current: {
          account: '',
          isStandalone: true,
          questionID: 'q-anonymous',
          questionPool: [{ id: 'q-anonymous' }],
          singleQuestionMode: true,
          surveyIndex: 0,
        },
      },
      writeCacheOptimistic: jest.fn((_cacheName, _slug, value) => {
        persistedBookmarks = value;
        return Promise.resolve();
      }),
    });

    createSurveyQuestionsProgressRuntime(anonymousContext).handleBookmarkToggle('q-anonymous');

    expect(anonymousContext.setState).toHaveBeenCalledWith({ bookmarkedQuestions: new Set(['q-anonymous']) });
    expect(persistedBookmarks).toEqual({ questions: ['q-anonymous'] });

    const reloadContext = createContext({
      peekCacheSync: jest.fn(() => persistedBookmarks),
      propsRef: anonymousContext.propsRef,
    });
    await createSurveyQuestionsProgressRuntime(reloadContext).loadBookmarks();

    expect(reloadContext.readCache).not.toHaveBeenCalled();
    expect(reloadContext.setState).toHaveBeenCalledWith({ bookmarkedQuestions: new Set(['q-anonymous']) });
  });

  it('recalculates edit stats from pending stats and relatches completed clean responses', () => {
    const context = createContext({
      getPendingEditStats: jest.fn(() => ({ encrypted: 0, total: 0 })),
    });
    const runtime = createSurveyQuestionsProgressRuntime(context);

    runtime.recalculateEditStats();

    expect(context.buildEditStatsState).toHaveBeenCalledWith({
      encryptedModifiedCount: 0,
      hasEncryptedChanges: false,
      isDirty: false,
      modifiedCount: 0,
      shouldRelatchSubmitted: true,
      shouldResetSubmitted: false,
    });
    expect(context.setState).toHaveBeenCalledWith({
      editStats: expect.objectContaining({
        shouldRelatchSubmitted: true,
      }),
    });
  });

  it('initializes response state from question pool and rendered ids', () => {
    const context = createContext();
    const runtime = createSurveyQuestionsProgressRuntime(context);

    expect(runtime.initializeSurveyResponseState()).toEqual([
      {
        answers: { q1: { value: '' } },
        input: expect.objectContaining({
          questionPoolIds: ['q1'],
          renderedQuestionIds: ['q1'],
          surveyIndex: 0,
        }),
      },
    ]);
    expect(context.buildInitialSurveyResponseQuestionIds).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: 'q1',
        questionPoolIds: ['q1'],
        stateQuestionPool: [{ id: 'q1' }],
      }),
    );
  });

  it('shows and clears transient submit feedback using the configured duration', () => {
    jest.useFakeTimers();
    const context = createContext();
    const runtime = createSurveyQuestionsProgressRuntime(context);

    runtime.showTransientSubmitFeedback('Review required', 25);

    expect(context.setState).toHaveBeenCalledWith({ submissionError: 'Review required' });
    expect(context.normalizeTransientSubmitFeedbackDurationMs).toHaveBeenCalledWith(25);
    jest.runOnlyPendingTimers();
    expect(context.setState).toHaveBeenLastCalledWith({ submissionError: null });
    expect(context.inst._emptySubmitTimer).toBeNull();
  });

  it('blocks submit while the question pool is incomplete and triggers a refresh', () => {
    const showTransientSubmitFeedback = jest.fn();
    const context = createContext({
      buildSurveyQuestionPoolLoadState: jest.fn(() => ({ isIncomplete: true, pendingCount: 2 })),
      getRuntimeStrategy: jest.fn(() => ({
        showTransientSubmitFeedback,
      })),
    });
    const runtime = createSurveyQuestionsProgressRuntime(context);

    expect(runtime.maybeBlockSubmitUntilQuestionPoolComplete()).toBe(true);

    expect(context.buildQuestionPoolPendingSubmitFeedbackMessage).toHaveBeenCalledWith({ pendingCount: 2 });
    expect(showTransientSubmitFeedback).toHaveBeenCalledWith(context.engine, 'Waiting on 2 questions', 2000);
    expect(context.fetchQuestionPool).toHaveBeenCalledTimes(1);
  });
});
