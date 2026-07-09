import { QuestionFilter as QuestionFilterComponent } from './QuestionFilter';
import {
  QUESTION_FILTER_ACTIONS_STYLE,
  QUESTION_FILTER_BOOKMARK_FEEDBACK_STYLE,
  QUESTION_FILTER_DISABLED_TEXT_SPACING_STYLE,
  QUESTION_FILTER_ENCRYPTED_COUNT_LOCK_STYLE,
  QUESTION_FILTER_MODAL_HEADER_ROW_STYLE,
  QUESTION_FILTER_MODAL_TITLE_ROW_STYLE,
  QUESTION_FILTER_SBT_SPINNER_STYLE,
  buildQuestionFilterAiCombineRowClassName,
  buildQuestionFilterDisabledSectionClassName,
  buildQuestionFilterSectionIconClassName,
  buildQuestionFilterTagBubbleClassName,
  buildQuestionFilterTypeButtonClassName,
  buildQuestionFilterTypePillClassName,
  resolveQuestionFilterBookmarkIconStyle,
  resolveQuestionFilterClearIconStyle,
  resolveQuestionFilterCopyIconStyle,
  resolveQuestionFilterEncryptedCountBadgeStyle,
  resolveQuestionFilterInlineVisibilityStyle,
  resolveQuestionFilterSectionBodyStyle,
  resolveQuestionFilterSectionHeaderStyle,
} from './questionFilterDisplayHelpers';
import GateTooltip from '../Gates/GateTooltip';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import { serializeFilterState as serializeFilterStateStrict } from '../../utilities/survey/filterStateUtils.js';
import { isFreeformBlankAnswer } from '../../utilities/survey/freeformAnswerUtils.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import styles from './QuestionFilter.module.scss';

jest.mock('../SBTs/SBTFilter', () => () => null);
jest.mock('../Shared/AudioInput/AudioInput', () => () => null);

type TreeNode = any;
type TreePredicate = (node: TreeNode) => boolean;
type QuestionFilterProps = Record<string, any>;
const QuestionFilter: any = QuestionFilterComponent;
const cacheScripts: any = cacheScriptsModule;
const { initCacheManager, listNamespaceEntriesSync, readCache, removeCache, writeCache } = cacheScripts as any;
const serializeFilterState: any = serializeFilterStateStrict;

const MANAGED_NAMESPACES = ['questionsCache', 'surveysCache', 'bookmarksCache', 'filters', 'sbtCache', 'userCache'];

const clearManagedCaches = async () => {
  await initCacheManager();
  for (const namespace of MANAGED_NAMESPACES) {
    const entries = listNamespaceEntriesSync(namespace);
    await Promise.all(entries.map((entry: any) => removeCache(namespace, entry?.slug || '')));
    await removeCache(namespace, '');
  }
};

const findElement = (node: TreeNode, predicate: TreePredicate): TreeNode | null => {
  const stack: TreeNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push(current[i]);
      }
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const getNodeText = (node: TreeNode): string => {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (typeof node !== 'object') return '';
  return getNodeText(node?.props?.children);
};

describe('QuestionFilter cache helpers', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearManagedCaches();
  });

  it('merges cached questions from canonical string net keys', async () => {
    await writeCache('questionsCache', '', {
      '1': {
        questions: {
          q2: { id: 'q2', prompt: 'Cached question' },
        },
      },
    });

    const props = { activeSessionSlug: '', network: { id: 1 } };
    const sourceQuestions = [{ id: 'q1', prompt: 'Existing question' }];

    const merged = QuestionFilter.prototype.mergeQuestionsWithCache.call({ props }, sourceQuestions);

    expect(merged).toHaveLength(2);
    expect(merged.find((q: any) => q.id === 'q2')).toBeTruthy();

    const stored = await readCache('questionsCache', '');
    expect(stored['1']).toBeDefined();
  });

  it('loads cached question responses into state', async () => {
    await writeCache('questionsCache', '', {
      '1': {
        questionResponses: {
          q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' },
        },
      },
    });

    const setState = jest.fn();
    const props = { activeSessionSlug: '', network: { id: 1 } };

    QuestionFilter.prototype.loadQuestionResponsesFromLocalStorage.call({
      props,
      setState,
    });

    expect(setState).toHaveBeenCalledWith({
      cachedQuestionResponses: {
        q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' },
      },
    });
  });

  it('supports canonical activeSessionSlug cache scope', async () => {
    await writeCache('questionsCache', 'edge', {
      '1': {
        questions: {
          q9: { id: 'q9', prompt: 'Edge question' },
        },
      },
    });

    const props = { activeSessionSlug: 'edge', network: { id: 1 } };
    const merged = QuestionFilter.prototype.mergeQuestionsWithCache.call({ props }, []);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 'q9', prompt: 'Edge question' });
  });

  it('uses canonical bookmarkedFilters field for checks and writes', async () => {
    const slug = 'edge';
    const filterState = { foo: 'bar' };
    const serialized = serializeFilterState(filterState);

    const instance = new QuestionFilter({ activeSessionSlug: slug });
    instance._isMounted = true;
    instance.buildFilterState = () => filterState;
    instance.setState = jest.fn((next, cb) => {
      if (typeof cb === 'function') cb();
      return next;
    });

    await writeCache('filters', slug, { bookmarkedFilters: [serialized] });
    instance.checkIfCurrentFilterIsBookmarked();
    expect(instance.setState).toHaveBeenCalledWith({ isCurrentFilterBookmarked: true });

    instance.setState.mockClear();
    await writeCache('filters', slug, { filters: [serialized] });
    instance.checkIfCurrentFilterIsBookmarked();
    expect(instance.setState).toHaveBeenCalledWith({ isCurrentFilterBookmarked: true });

    await writeCache('filters', slug, {});
    instance.handleBookmarkCurrentFilter();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const stored = await readCache('filters', slug);
    expect(Array.isArray(stored?.bookmarkedFilters)).toBe(true);
    expect(stored.bookmarkedFilters).toContain(serialized);

    clearTimeout(instance.bookmarkFeedbackTimeout);
  });

  it('reads filters cache with clone:false before bookmarking current filter', async () => {
    const slug = 'edge';
    const filterState = { foo: 'bar' };
    const instance = new QuestionFilter({ activeSessionSlug: slug });
    instance._isMounted = true;
    instance.buildFilterState = () => filterState;
    instance.checkIfCurrentFilterIsBookmarked = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      if (typeof cb === 'function') cb();
      return next;
    });
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);

    instance.handleBookmarkCurrentFilter();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(peekSpy).toHaveBeenCalledWith('filters', slug, { clone: false });
    expect(writeSpy).toHaveBeenCalledWith('filters', slug, expect.any(Object));
    peekSpy.mockRestore();
    writeSpy.mockRestore();
    clearTimeout(instance.bookmarkFeedbackTimeout);
  });

  it('does not show bookmark success feedback when writeCache resolves false', async () => {
    const slug = 'edge';
    const filterState = { foo: 'bar' };
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(false);

    const instance = new QuestionFilter({ activeSessionSlug: slug });
    instance._isMounted = true;
    instance.buildFilterState = () => filterState;
    instance.checkIfCurrentFilterIsBookmarked = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      if (typeof cb === 'function') cb();
      return next;
    });

    instance.handleBookmarkCurrentFilter();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(writeSpy).toHaveBeenCalledWith('filters', slug, expect.any(Object));
    expect(instance.checkIfCurrentFilterIsBookmarked).not.toHaveBeenCalled();
    expect(instance.setState).not.toHaveBeenCalledWith(expect.objectContaining({ filterBookmarkedFeedback: true }));

    writeSpy.mockRestore();
  });

  it('does not set bookmark state when the computed bookmark match is unchanged', async () => {
    const slug = 'edge';
    const filterState = { foo: 'bar' };
    const serialized = serializeFilterState(filterState);

    await writeCache('filters', slug, { bookmarkedFilters: [serialized] });

    const instance = new QuestionFilter({ activeSessionSlug: slug });
    instance._isMounted = true;
    instance.buildFilterState = () => filterState;
    instance.state = {
      ...instance.state,
      isCurrentFilterBookmarked: true,
    };
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    instance.checkIfCurrentFilterIsBookmarked();

    expect(instance.setState).not.toHaveBeenCalled();
  });

  it('does not re-run expensive question/response sync when nonces and refs are unchanged', () => {
    const sharedQuestions = [{ id: 'q1', prompt: 'Q1' }];
    const sharedResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' } };
    const sharedTypes: any[] = [];
    const sharedTags: any[] = [];

    const instance = new QuestionFilter({
      questions: sharedQuestions,
      questionResponses: sharedResponses,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    });

    instance.mergeQuestionsWithCache = jest.fn(() => sharedQuestions);
    instance.handleApplyFilters = jest.fn();
    instance.syncExternalFilterState = jest.fn();
    instance.computeFilteredQuestionsCount = jest.fn();
    instance.saveFilterStateToLocalStorage = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      if (typeof cb === 'function') cb();
      return next;
    });
    instance.state = {
      ...instance.state,
      pendingSelectedTypes: sharedTypes,
      pendingSortByImportance: true,
      pendingSbtFilteredQuestions: null,
      aiSearchQuery: '',
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: sharedTags,
    };

    const prevProps = {
      questions: sharedQuestions,
      questionResponses: sharedResponses,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    };

    instance.componentDidUpdate(prevProps, instance.state);

    expect(instance.mergeQuestionsWithCache).not.toHaveBeenCalled();
    expect(instance.handleApplyFilters).not.toHaveBeenCalled();
    expect(instance.setState).not.toHaveBeenCalled();
  });

  it('re-runs question sync when question ref changes despite stable nonce', () => {
    const sharedResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' } };
    const currentQuestions = [{ id: 'q1', prompt: 'Q1 (current)' }];
    const prevQuestions = [{ id: 'q1', prompt: 'Q1 (prev)' }];
    const sharedTypes: any[] = [];
    const sharedTags: any[] = [];

    const instance = new QuestionFilter({
      questions: prevQuestions,
      questionResponses: sharedResponses,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    });

    instance.mergeQuestionsWithCache = jest.fn(() => currentQuestions);
    instance.handleApplyFilters = jest.fn();
    instance.syncExternalFilterState = jest.fn();
    instance.computeFilteredQuestionsCount = jest.fn();
    instance.saveFilterStateToLocalStorage = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      if (typeof cb === 'function') cb();
      return next;
    });
    instance.state = {
      ...instance.state,
      pendingSelectedTypes: sharedTypes,
      pendingSortByImportance: false,
      pendingSbtFilteredQuestions: null,
      aiSearchQuery: '',
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: sharedTags,
    };

    const prevProps = { ...instance.props };
    instance.props = {
      ...instance.props,
      questions: currentQuestions,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
    };

    instance.componentDidUpdate(prevProps, instance.state);

    expect(instance.mergeQuestionsWithCache).toHaveBeenCalledWith(currentQuestions);
    expect(instance.handleApplyFilters).toHaveBeenCalled();
  });

  it('skips question sync when question ref changes but merged content is unchanged', () => {
    const sharedResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' } };
    const currentQuestions = [{ id: 'q1', prompt: 'Q1' }];
    const prevQuestions = [{ id: 'q1', prompt: 'Q1' }];
    const sharedTypes: any[] = [];
    const sharedTags: any[] = [];

    const instance = new QuestionFilter({
      questions: currentQuestions,
      questionResponses: sharedResponses,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    });

    instance.mergeQuestionsWithCache = jest.fn(() => [{ id: 'q1', prompt: 'Q1' }]);
    instance.handleApplyFilters = jest.fn();
    instance.syncExternalFilterState = jest.fn();
    instance.computeFilteredQuestionsCount = jest.fn();
    instance.saveFilterStateToLocalStorage = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      if (typeof cb === 'function') cb();
      return next;
    });
    instance.state = {
      ...instance.state,
      pendingSelectedTypes: sharedTypes,
      pendingSortByImportance: false,
      pendingSbtFilteredQuestions: null,
      aiSearchQuery: '',
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: sharedTags,
    };

    const prevProps = {
      questions: prevQuestions,
      questionResponses: sharedResponses,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    };

    instance.componentDidUpdate(prevProps, instance.state);

    expect(instance.mergeQuestionsWithCache).toHaveBeenCalledWith(currentQuestions);
    expect(instance.setState).not.toHaveBeenCalled();
    expect(instance.handleApplyFilters).not.toHaveBeenCalled();
  });

  it('resets stale filters when external filter state is cleared to null', () => {
    const instance = new QuestionFilter({
      questions: [{ id: 'q1', prompt: 'Q1' }],
      questionResponses: {},
      filterState: {
        questionTypes: ['binary'],
        selectedTags: ['alpha'],
      },
      isQuestionCacheReady: true,
    });

    instance.handleApplyFilters = jest.fn();
    instance.checkIfCurrentFilterIsBookmarked = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.state = {
      ...instance.state,
      selectedTypes: ['binary'],
      pendingSelectedTypes: ['binary'],
      selectedTags: ['alpha'],
      aiSearchQuery: 'stale query',
      aiDraftQuery: 'stale query',
      aiAppliedTopN: 3,
      aiFilterApplied: true,
      aiRankedQuestionIds: ['q1'],
      aiCombineWithOtherFilters: true,
    };

    instance.syncExternalFilterState(null);

    expect(instance.state.selectedTypes).toEqual([]);
    expect(instance.state.pendingSelectedTypes).toEqual([]);
    expect(instance.state.selectedTags).toEqual([]);
    expect(instance.state.aiSearchQuery).toBe('');
    expect(instance.state.aiFilterApplied).toBe(false);
    expect(instance.state.aiRankedQuestionIds).toEqual([]);
    expect(instance.handleApplyFilters).toHaveBeenCalledWith(true);
    expect(instance.checkIfCurrentFilterIsBookmarked).toHaveBeenCalled();
  });

  it('rejects malformed pasted filter strings without resetting current filters', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const instance = new QuestionFilter({
      questions: [{ id: 'q1', prompt: 'Q1' }],
      questionResponses: {},
      filterState: {},
      isQuestionCacheReady: true,
    });

    instance.handleApplyFilters = jest.fn();
    instance.queueAutoApplyAiFilter = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.state = {
      ...instance.state,
      filterUrlInput: 'not-valid-base64',
      selectedTypes: ['binary'],
      pendingSelectedTypes: ['binary'],
      selectedTags: ['alpha'],
    };

    try {
      instance.handleLoadFilter();

      expect(alertSpy).toHaveBeenCalledWith('Could not load filter from the provided string. Please check the format.');
      expect(instance.state.selectedTypes).toEqual(['binary']);
      expect(instance.state.pendingSelectedTypes).toEqual(['binary']);
      expect(instance.state.selectedTags).toEqual(['alpha']);
      expect(instance.handleApplyFilters).not.toHaveBeenCalled();
      expect(instance.queueAutoApplyAiFilter).not.toHaveBeenCalled();
    } finally {
      alertSpy.mockRestore();
    }
  });

  it('skips response sync when response ref changes but payload is unchanged', () => {
    const sharedQuestions = [{ id: 'q1', prompt: 'Q1' }];
    const currentResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' } };
    const prevResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' } };
    const sharedTypes: any[] = [];
    const sharedTags: any[] = [];

    const instance = new QuestionFilter({
      questions: sharedQuestions,
      questionResponses: currentResponses,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    });

    instance.mergeQuestionsWithCache = jest.fn(() => sharedQuestions);
    instance.handleApplyFilters = jest.fn();
    instance.syncExternalFilterState = jest.fn();
    instance.computeFilteredQuestionsCount = jest.fn();
    instance.saveFilterStateToLocalStorage = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      if (typeof cb === 'function') cb();
      return next;
    });
    instance.state = {
      ...instance.state,
      pendingSelectedTypes: sharedTypes,
      pendingSortByImportance: false,
      pendingSbtFilteredQuestions: null,
      aiSearchQuery: '',
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: sharedTags,
    };

    const prevProps = {
      questions: sharedQuestions,
      questionResponses: prevResponses,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    };

    instance.componentDidUpdate(prevProps, instance.state);

    expect(instance.setState).not.toHaveBeenCalled();
    expect(instance.handleApplyFilters).not.toHaveBeenCalled();
  });

  it('clears response-status filters when the connected account disconnects', async () => {
    const sharedQuestions = [{ id: 'q1', prompt: 'Q1' }];
    const sharedResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' } };
    const instance = new QuestionFilter({
      account: '0xabc',
      enableLocalStorage: true,
      questions: sharedQuestions,
      questionResponses: sharedResponses,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    });

    instance.handleApplyFilters = jest.fn();
    instance.syncExternalFilterState = jest.fn();
    instance.computeFilteredQuestionsCount = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.state = {
      ...instance.state,
      mergedQuestions: sharedQuestions,
      filterByResponded: true,
      filterByNotResponded: false,
      pendingSelectedTypes: [],
      pendingSortByImportance: false,
      pendingSbtFilteredQuestions: null,
      aiSearchQuery: '',
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
    };

    const prevProps = { ...instance.props };
    const prevState = { ...instance.state };
    instance.props = {
      ...instance.props,
      account: '',
    };

    instance.componentDidUpdate(prevProps, prevState);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const stored = await readCache('filters', '');

    expect(instance.setState).toHaveBeenCalledWith(
      {
        filterByResponded: false,
        filterByNotResponded: false,
      },
      expect.any(Function),
    );
    expect(instance.state.filterByResponded).toBe(false);
    expect(instance.state.filterByNotResponded).toBe(false);
    expect(instance.handleApplyFilters).toHaveBeenCalledWith(true);
    expect(stored?.questionFilterState_questions).toMatchObject({
      filterByResponded: false,
      filterByNotResponded: false,
    });
  });

  it('reapplies response-status filters when the connected account changes', () => {
    const sharedQuestions = [{ id: 'q1', prompt: 'Q1' }];
    const sharedResponses = {
      q1: {
        '0xabc': '{"type":"binary","answer":{"value":"yes"}}',
        '0xdef': '{"type":"binary","answer":{"value":"no"}}',
      },
    };
    const filterState = {};
    const instance = new QuestionFilter({
      account: '0xabc',
      questions: sharedQuestions,
      questionResponses: sharedResponses,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState,
      isQuestionCacheReady: true,
    });

    instance.handleApplyFilters = jest.fn();
    instance.queueAutoApplyAiFilter = jest.fn();
    instance.syncExternalFilterState = jest.fn();
    instance.computeFilteredQuestionsCount = jest.fn();
    instance.saveFilterStateToLocalStorage = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.state = {
      ...instance.state,
      mergedQuestions: sharedQuestions,
      filterByResponded: true,
      filterByNotResponded: false,
      pendingSelectedTypes: [],
      pendingSortByImportance: false,
      pendingSbtFilteredQuestions: null,
      aiSearchQuery: '',
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
    };

    const prevProps = { ...instance.props };
    const prevState = { ...instance.state };
    instance.props = {
      ...instance.props,
      account: '0xdef',
      filterState,
    };

    instance.componentDidUpdate(prevProps, prevState);

    expect(instance.setState).not.toHaveBeenCalled();
    expect(instance.handleApplyFilters).toHaveBeenCalledWith(true);
    expect(instance.queueAutoApplyAiFilter).toHaveBeenCalledWith('update:account-change');
  });

  it('does not restore persisted response-status filters when no account is connected', async () => {
    await writeCache('filters', '', {
      questionFilterState_questions: {
        selectedTypes: [],
        selectedTags: [],
        filterByResponded: true,
        filterByNotResponded: false,
      },
    });

    const instance = new QuestionFilter({
      account: '',
      enableLocalStorage: true,
      filterState: {},
      questions: [{ id: 'q1', prompt: 'Q1' }],
      questionResponses: {},
      isQuestionCacheReady: true,
    });

    instance.handleApplyFilters = jest.fn();
    instance.queueAutoApplyAiFilter = jest.fn();
    instance.computeFilteredQuestionsCount = jest.fn();
    instance.checkIfCurrentFilterIsBookmarked = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    await instance.componentDidMount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const stored = await readCache('filters', '');

    expect(instance.state.filterByResponded).toBe(false);
    expect(instance.state.filterByNotResponded).toBe(false);
    expect(stored?.questionFilterState_questions).toMatchObject({
      filterByResponded: false,
      filterByNotResponded: false,
    });
  });

  it('ignores URL response-status filters when no account is connected', async () => {
    const instance = new QuestionFilter({
      account: '',
      filterState: {
        responseStatus: {
          responded: true,
          notResponded: false,
        },
      },
      questions: [{ id: 'q1', prompt: 'Q1' }],
      questionResponses: {},
      isQuestionCacheReady: true,
    });

    instance.handleApplyFilters = jest.fn();
    instance.queueAutoApplyAiFilter = jest.fn();
    instance.computeFilteredQuestionsCount = jest.fn();
    instance.checkIfCurrentFilterIsBookmarked = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    await instance.componentDidMount();

    expect(instance.state.filterByResponded).toBe(false);
    expect(instance.state.filterByNotResponded).toBe(false);
  });
});
