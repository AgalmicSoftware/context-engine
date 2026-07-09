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

describe('QuestionFilter pipeline and autosave helpers', () => {
  it('returns original merged question refs when filters and ranking are inactive', () => {
    const sharedQuestions = [
      { id: 'q1', prompt: 'Q1' },
      { id: 'q2', prompt: 'Q2' },
    ];
    const sharedResponses = {};
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

    instance.state = {
      ...instance.state,
      mergedQuestions: sharedQuestions,
      selectedTypes: sharedTypes,
      sortByImportance: false,
      sbtFilteredQuestions: null,
      showTopQuestions: false,
      topQuestionsCount: 10,
      showTopQuestionsByResponses: false,
      selectedTags: sharedTags,
      aiSearchQuery: '',
      pendingSelectedTypes: sharedTypes,
      pendingSortByImportance: false,
      pendingSbtFilteredQuestions: null,
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
    };

    const immediate = instance.buildFilterPipelineResult(false);
    const pending = instance.buildFilterPipelineResult(true);

    expect(immediate.finalQuestions).toBe(sharedQuestions);
    expect(immediate.count).toBe(2);
    expect(pending.finalQuestions).toBe(sharedQuestions);
    expect(pending.count).toBe(2);
  });

  it('keeps the inactive filter pipeline memo stable across response payload churn', () => {
    const sharedQuestions = [
      { id: 'q1', prompt: 'Q1' },
      { id: 'q2', prompt: 'Q2' },
    ];
    const firstResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' } };
    const secondResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"no"}}' } };

    const instance = new QuestionFilter({
      questions: sharedQuestions,
      questionResponses: firstResponses,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    });

    instance.state = {
      ...instance.state,
      mergedQuestions: sharedQuestions,
      selectedTypes: [],
      sortByImportance: false,
      sbtFilteredQuestions: null,
      showTopQuestions: false,
      topQuestionsCount: 10,
      showTopQuestionsByResponses: false,
      selectedTags: [],
      aiSearchQuery: '',
      filterByResponded: false,
      filterByNotResponded: false,
      pendingSelectedTypes: [],
      pendingSortByImportance: false,
      pendingSbtFilteredQuestions: null,
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
    };

    const first = instance.buildFilterPipelineResult(true);
    instance.props = {
      ...instance.props,
      questionResponses: secondResponses,
      questionResponsesNonce: 12,
    };
    const second = instance.buildFilterPipelineResult(true);

    expect(second).toBe(first);
    expect(second.finalQuestions).toBe(sharedQuestions);
  });

  it('preserves tie order and score fields across top and sort ranking paths', () => {
    const sharedQuestions = [
      { id: 'q1', prompt: 'Q1' },
      { id: 'q2', prompt: 'Q2' },
      { id: 'q3', prompt: 'Q3' },
    ];
    const sharedResponses = {};
    const statsByQuestion = new Map([
      ['q1', { responseCount: 7, totalImportance: 9 }],
      ['q2', { responseCount: 7, totalImportance: 9 }],
      ['q3', { responseCount: 1, totalImportance: 3 }],
    ]);

    const instance = new QuestionFilter({
      questions: sharedQuestions,
      questionResponses: sharedResponses,
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    });
    instance.getMemoizedQuestionResponseStats = jest.fn(() => statsByQuestion);
    instance.state = {
      ...instance.state,
      mergedQuestions: sharedQuestions,
      selectedTypes: [],
      sortByImportance: false,
      sbtFilteredQuestions: null,
      showTopQuestions: false,
      topQuestionsCount: 2,
      showTopQuestionsByResponses: true,
      selectedTags: [],
      aiSearchQuery: '',
    };

    const topByResponses = instance.buildFilterPipelineResult(false);
    expect(topByResponses.finalQuestions.map((q: any) => q.id)).toEqual(['q1', 'q2']);
    expect(topByResponses.finalQuestions.map((q: any) => q.totalResponses)).toEqual([7, 7]);

    instance.state = {
      ...instance.state,
      showTopQuestionsByResponses: false,
      sortByImportance: true,
      topQuestionsCount: 10,
    };
    instance._filterPipelineMemo = null;

    const sortedByImportance = instance.buildFilterPipelineResult(false);
    expect(sortedByImportance.finalQuestions.map((q: any) => q.id)).toEqual(['q1', 'q2', 'q3']);
    expect(sortedByImportance.finalQuestions.map((q: any) => q.totalImportance)).toEqual([9, 9, 3]);
  });

  it('ignores AI subset when Top X mode is active', () => {
    const sharedQuestions = [
      { id: 'q1', prompt: 'Q1' },
      { id: 'q2', prompt: 'Q2' },
      { id: 'q3', prompt: 'Q3' },
    ];
    const statsByQuestion = new Map([
      ['q1', { responseCount: 9, totalImportance: 9 }],
      ['q2', { responseCount: 1, totalImportance: 1 }],
      ['q3', { responseCount: 8, totalImportance: 8 }],
    ]);

    const instance = new QuestionFilter({
      questions: sharedQuestions,
      questionResponses: {},
      questionsCacheNonce: 7,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    });
    instance.getMemoizedQuestionResponseStats = jest.fn(() => statsByQuestion);
    instance.state = {
      ...instance.state,
      mergedQuestions: sharedQuestions,
      selectedTypes: [],
      sortByImportance: false,
      sbtFilteredQuestions: null,
      showTopQuestions: false,
      topQuestionsCount: 2,
      showTopQuestionsByResponses: true,
      selectedTags: [],
      aiSearchQuery: 'wallet security',
      aiFilterApplied: true,
      aiRankedQuestionIds: ['q2'],
    };

    const topByResponses = instance.buildFilterPipelineResult(false);
    expect(topByResponses.finalQuestions.map((q: any) => q.id)).toEqual(['q1', 'q3']);
    expect(topByResponses.finalQuestions.map((q: any) => q.totalResponses)).toEqual([9, 8]);
  });

  it('skips response sync when questionResponsesNonce changes but response-driven filters are inactive', () => {
    const sharedQuestions = [{ id: 'q1', prompt: 'Q1' }];
    const currentResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' } };
    const prevResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"no"}}' } };
    const sharedTypes: any[] = [];
    const sharedTags: any[] = [];

    const instance = new QuestionFilter({
      questions: sharedQuestions,
      questionResponses: prevResponses,
      questionsCacheNonce: 5,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    });

    instance.handleApplyFilters = jest.fn();
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
      questionResponses: currentResponses,
      questionResponsesNonce: 12,
    };

    instance.componentDidUpdate(prevProps, instance.state);

    expect(instance.handleApplyFilters).not.toHaveBeenCalled();
    expect(instance.setState).not.toHaveBeenCalled();
    expect(instance.state.cachedQuestionResponses).toEqual(prevResponses);
  });

  it('re-runs response sync when questionResponsesNonce changes and response-driven filters are active', () => {
    const sharedQuestions = [{ id: 'q1', prompt: 'Q1' }];
    const currentResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' } };
    const prevResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"no"}}' } };

    const instance = new QuestionFilter({
      questions: sharedQuestions,
      questionResponses: prevResponses,
      questionsCacheNonce: 5,
      questionResponsesNonce: 11,
      filterState: {},
      isQuestionCacheReady: true,
    });

    instance.handleApplyFilters = jest.fn();
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
      pendingSelectedTypes: [],
      pendingSortByImportance: true,
      pendingSbtFilteredQuestions: null,
      aiSearchQuery: '',
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
    };

    const prevProps = { ...instance.props };
    instance.props = {
      ...instance.props,
      questionResponses: currentResponses,
      questionResponsesNonce: 12,
    };

    instance.componentDidUpdate(prevProps, instance.state);

    expect(instance.handleApplyFilters).toHaveBeenCalled();
    expect(instance.state.cachedQuestionResponses).toEqual(currentResponses);
  });

  it('uses incoming questionResponses props when nonce is unchanged', () => {
    const sharedQuestions = [{ id: 'q1', type: 'binary', prompt: 'Q1' }];
    const cachedResponses = { q1: { '0x1': '{"conviction":2}' } };
    const churnedResponses = { q1: { '0x1': '{"conviction":99}' } };

    const instance = new QuestionFilter({
      questions: sharedQuestions,
      questionResponses: cachedResponses,
      questionsCacheNonce: 5,
      questionResponsesNonce: 12,
      filterState: {},
      isQuestionCacheReady: true,
    });

    instance.mergeQuestionsWithCache = jest.fn(() => sharedQuestions);
    instance.handleApplyFilters = jest.fn();
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
      cachedQuestionResponses: cachedResponses,
      mergedQuestions: sharedQuestions,
      pendingSelectedTypes: [],
      pendingSortByImportance: true,
      pendingSbtFilteredQuestions: null,
      aiSearchQuery: '',
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
    };

    const first = instance.buildFilterPipelineResult(true);
    expect(first.finalQuestions[0].totalImportance).toBe(2);

    const prevProps = { ...instance.props };
    instance.props = {
      ...instance.props,
      questionResponses: churnedResponses,
      questionResponsesNonce: 12,
    };

    instance.componentDidUpdate(prevProps, instance.state);
    expect(instance.setState).toHaveBeenCalledTimes(1);
    expect(instance.state.cachedQuestionResponses).toBe(churnedResponses);

    const second = instance.buildFilterPipelineResult(true);
    expect(second.finalQuestions[0].totalImportance).toBe(99);
  });

  it('uses live response props in results mode when nonce is unchanged', () => {
    const sharedQuestions = [{ id: 'q1', type: 'binary', prompt: 'Q1' }];
    const cachedResponses = { q1: { '0x1': '{"conviction":2}' } };
    const refreshedResponses = { q1: { '0x1': '{"conviction":99}' } };

    const instance = new QuestionFilter({
      resultsMode: true,
      questions: sharedQuestions,
      questionResponses: cachedResponses,
      questionsCacheNonce: 5,
      questionResponsesNonce: 12,
      filterState: {},
      isQuestionCacheReady: true,
    });

    instance.state = {
      ...instance.state,
      cachedQuestionResponses: cachedResponses,
      mergedQuestions: sharedQuestions,
      pendingSelectedTypes: [],
      pendingSortByImportance: true,
      pendingSbtFilteredQuestions: null,
      aiSearchQuery: '',
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
    };

    const first = instance.buildFilterPipelineResult(true);
    expect(first.finalQuestions[0].totalImportance).toBe(2);

    instance.props = {
      ...instance.props,
      questionResponses: refreshedResponses,
      questionResponsesNonce: 12,
    };

    const second = instance.buildFilterPipelineResult(true);
    expect(second.finalQuestions[0].totalImportance).toBe(99);
  });

  it('batches question and response cache updates into one apply pass', () => {
    const currentQuestions = [{ id: 'q1', prompt: 'current' }];
    const prevQuestions = [{ id: 'q1', prompt: 'prev' }];
    const currentResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"yes"}}' } };
    const prevResponses = { q1: { '0x1': '{"type":"binary","answer":{"value":"no"}}' } };

    const instance = new QuestionFilter({
      questions: prevQuestions,
      questionResponses: prevResponses,
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
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    instance.state = {
      ...instance.state,
      pendingSelectedTypes: [],
      pendingSortByImportance: true,
      pendingSbtFilteredQuestions: null,
      aiSearchQuery: '',
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
      cachedQuestionResponses: prevResponses,
    };

    const prevState = { ...instance.state };
    const prevProps = { ...instance.props };
    instance.props = {
      ...instance.props,
      questions: currentQuestions,
      questionResponses: currentResponses,
      questionsCacheNonce: 8,
      questionResponsesNonce: 12,
    };

    instance.componentDidUpdate(prevProps, prevState);

    expect(instance.setState).toHaveBeenCalledTimes(1);
    expect(instance.handleApplyFilters).toHaveBeenCalledTimes(1);
    expect(instance.state.mergedQuestions).toEqual(currentQuestions);
    expect(instance.state.cachedQuestionResponses).toEqual(currentResponses);
  });

  it('treats refreshed question objects as changed even when IDs are identical', () => {
    const onFilter = jest.fn();
    const instance = new QuestionFilter({ onFilter });
    instance.handleApplyFilters = jest.fn();
    instance.buildFilterState = jest.fn(() => ({}));
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    const prevQuestion = { id: 'q1', prompt: 'old prompt' };
    const nextQuestion = { id: 'q1', prompt: 'new prompt' };
    const sharedSbtState = { includedSBTs: ['s1'] };
    instance.state = {
      ...instance.state,
      pendingSbtFilteredQuestions: [prevQuestion],
      sbtFilterLocalState: sharedSbtState,
    };

    instance.handleFilteredQuestions([nextQuestion], sharedSbtState);

    expect(instance.handleApplyFilters).toHaveBeenCalled();
    expect(onFilter).toHaveBeenCalledWith([nextQuestion], expect.any(Object));
  });

  it('syncs external filter state when payloads are larger than compare cap', () => {
    const sharedQuestions = [{ id: 'q1', prompt: 'Q1' }];
    const sharedResponses = {};
    const sharedTypes: any[] = [];
    const sharedTags: any[] = [];
    const largeTagsPrev = Array.from({ length: 900 }, (_, idx) => `tag-${idx}`);
    const largeTagsNext = [...largeTagsPrev];
    largeTagsNext[largeTagsNext.length - 1] = 'tag-final-updated';

    const prevFilterState = {
      selectedTags: largeTagsPrev,
      sbtFilter: { includedSBTs: ['0xabc'], excludedSBTs: [], onlyVerifiedHumans: false },
    };
    const nextFilterState = {
      selectedTags: largeTagsNext,
      sbtFilter: { includedSBTs: ['0xabc'], excludedSBTs: [], onlyVerifiedHumans: false },
    };

    const instance = new QuestionFilter({
      questions: sharedQuestions,
      questionResponses: sharedResponses,
      questionsCacheNonce: 5,
      questionResponsesNonce: 11,
      filterState: nextFilterState,
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
      questionResponses: sharedResponses,
      questionsCacheNonce: 5,
      questionResponsesNonce: 11,
      filterState: prevFilterState,
      isQuestionCacheReady: true,
    };

    instance.componentDidUpdate(prevProps, instance.state);

    expect(instance.syncExternalFilterState).toHaveBeenCalledWith(nextFilterState);
  });

  it('syncs external filter state when the parent mutates the same filterState object in place', () => {
    const sharedQuestions = [{ id: 'q1', prompt: 'Q1' }];
    const sharedResponses = {};
    const sharedTypes: any[] = [];
    const sharedTags: any[] = [];
    const sharedFilterState = {
      selectedTags: ['alpha'],
      sbtFilter: { includedSBTs: ['0xabc'], excludedSBTs: [], onlyVerifiedHumans: false },
    };

    const instance = new QuestionFilter({
      questions: sharedQuestions,
      questionResponses: sharedResponses,
      questionsCacheNonce: 5,
      questionResponsesNonce: 11,
      filterState: sharedFilterState,
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
      questionResponses: sharedResponses,
      questionsCacheNonce: 5,
      questionResponsesNonce: 11,
      filterState: sharedFilterState,
      isQuestionCacheReady: true,
    };

    sharedFilterState.selectedTags = ['beta'];
    instance.props = {
      ...instance.props,
      filterState: sharedFilterState,
    };

    instance.componentDidUpdate(prevProps, instance.state);

    expect(instance.syncExternalFilterState).toHaveBeenCalledWith(sharedFilterState);

    const prevPropsSecondPass = {
      ...instance.props,
      filterState: sharedFilterState,
    };
    sharedFilterState.selectedTags = ['gamma'];
    sharedFilterState.sbtFilter.includedSBTs = ['0xdef'];
    instance.props = {
      ...instance.props,
      filterState: sharedFilterState,
    };

    instance.componentDidUpdate(prevPropsSecondPass, instance.state);

    expect(instance.syncExternalFilterState).toHaveBeenCalledTimes(2);
    expect(instance.syncExternalFilterState).toHaveBeenNthCalledWith(2, sharedFilterState);
  });

  it('does not autosave filter state for unrelated updates', () => {
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      filterType: 'results',
      enableLocalStorage: true,
      unrelatedProp: 'next',
    });

    instance._allowFilterStateAutosave = true;
    instance._loadingFilterStateFromCache = false;
    instance.mergeQuestionsWithCache = jest.fn();
    instance.handleApplyFilters = jest.fn();
    instance.syncExternalFilterState = jest.fn();
    instance.saveFilterStateToLocalStorage = jest.fn();
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    const prevState = {
      ...instance.state,
      filterLoading: true,
    };
    instance.state = {
      ...instance.state,
      filterLoading: false,
    };
    const prevProps = {
      ...instance.props,
      unrelatedProp: 'prev',
    };

    instance.componentDidUpdate(prevProps, prevState);

    expect(instance.saveFilterStateToLocalStorage).not.toHaveBeenCalled();
  });

  it('autosaves when relevant filter fields change', () => {
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      filterType: 'results',
      enableLocalStorage: true,
    });
    instance._allowFilterStateAutosave = true;
    instance._loadingFilterStateFromCache = false;

    const prevProps = { ...instance.props };
    const prevState = {
      ...instance.state,
      selectedTags: [],
    };
    instance.state = {
      ...instance.state,
      selectedTags: ['alpha'],
    };

    expect(instance.shouldAutosaveFilterState(prevProps, prevState)).toBe(true);
  });

  it('skips unchanged persisted payloads using stable save signature tracking', async () => {
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      filterType: 'results',
      enableLocalStorage: true,
    });

    instance.buildFilterState = jest.fn(() => ({
      selectedTags: ['alpha'],
      questionTypes: [],
      topQuestions: null,
      sbtFilter: null,
      aiFilter: null,
    }));

    instance.saveFilterStateToLocalStorage();
    await Promise.resolve();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(instance._lastSavedFilterStateSignature.startsWith('edge|questionFilterState_results|')).toBe(true);

    writeSpy.mockClear();
    instance.saveFilterStateToLocalStorage();
    await Promise.resolve();
    expect(writeSpy).not.toHaveBeenCalled();

    peekSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it('writes again when slug changes even if filter payload is unchanged', async () => {
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      filterType: 'results',
      enableLocalStorage: true,
    });

    instance.saveFilterStateToLocalStorage();
    await Promise.resolve();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenLastCalledWith('filters', 'edge', expect.any(Object));

    writeSpy.mockClear();
    instance.props = {
      ...instance.props,
      activeSessionSlug: 'edge-two',
    };

    instance.saveFilterStateToLocalStorage();
    await Promise.resolve();
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenLastCalledWith('filters', 'edge-two', expect.any(Object));

    peekSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it('loads persisted filter state from the storageKeyPrefix scope bucket when provided', async () => {
    const scopeSlug = '__scope__:alpha|beta|edge';
    await writeCache('filters', scopeSlug, {
      questionFilterState_questions: {
        selectedTags: ['alpha'],
      },
    });

    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      filterType: 'questions',
      enableLocalStorage: true,
      storageKeyPrefix: `dg:filters:${scopeSlug}`,
    });
    instance._isMounted = true;
    instance.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(instance.state, instance.props) : next;
      instance.state = { ...instance.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });

    const didRestore = await instance.loadFilterStateFromLocalStorage();

    expect(didRestore).toBe(true);
    expect(instance.state.selectedTags).toEqual(['alpha']);
  });

  it('writes autosaved filter state into the storageKeyPrefix scope bucket when provided', async () => {
    const scopeSlug = '__scope__:alpha|beta|edge';
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({});
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const instance = new QuestionFilter({
      activeSessionSlug: 'edge',
      filterType: 'questions',
      enableLocalStorage: true,
      storageKeyPrefix: `dg:filters:${scopeSlug}`,
    });

    instance.state = {
      ...instance.state,
      selectedTags: ['beta'],
    };

    instance.saveFilterStateToLocalStorage();
    await Promise.resolve();

    expect(writeSpy).toHaveBeenCalledWith(
      'filters',
      scopeSlug,
      expect.objectContaining({
        questionFilterState_questions: expect.objectContaining({
          selectedTags: ['beta'],
        }),
      }),
    );

    peekSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it('invalidates filter pipeline memo on response nonce ticks with stable refs', () => {
    const sharedQuestions = [{ id: 'q1', type: 'binary', prompt: 'Q1' }];
    const sharedResponses = {
      q1: {
        '0x1': '{"conviction":2}',
      },
    };

    const instance = new QuestionFilter({
      questionResponses: sharedResponses,
      questionResponsesNonce: 10,
      questionsCacheNonce: 20,
    });

    instance.state = {
      ...instance.state,
      mergedQuestions: sharedQuestions,
      pendingSelectedTypes: [],
      pendingSortByImportance: true,
      pendingSbtFilteredQuestions: null,
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
      aiSearchQuery: '',
    };

    instance.parseResponse = jest.fn(() => ({ conviction: 2 }));

    const first = instance.buildFilterPipelineResult(true);
    const second = instance.buildFilterPipelineResult(true);
    expect(second).toBe(first);
    expect(instance.parseResponse).toHaveBeenCalledTimes(1);

    instance.props = {
      ...instance.props,
      questionResponsesNonce: 11,
    };

    const third = instance.buildFilterPipelineResult(true);
    expect(third).not.toBe(second);
    expect(instance.parseResponse).toHaveBeenCalledTimes(2);
  });

  it('reuses response stats when non-response filter knobs change with stable response refs', () => {
    const sharedQuestions = [{ id: 'q1', type: 'binary', prompt: 'Q1' }];
    const sharedResponses = {
      q1: {
        '0x1': '{"conviction":2}',
      },
    };

    const instance = new QuestionFilter({
      questionResponses: sharedResponses,
      questionResponsesNonce: 10,
      questionsCacheNonce: 20,
    });

    instance.state = {
      ...instance.state,
      mergedQuestions: sharedQuestions,
      pendingSelectedTypes: [],
      pendingSortByImportance: true,
      pendingSbtFilteredQuestions: null,
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
      aiSearchQuery: '',
    };

    instance.parseResponse = jest.fn(() => ({ conviction: 2 }));

    instance.buildFilterPipelineResult(true);
    expect(instance.parseResponse).toHaveBeenCalledTimes(1);

    instance.state = {
      ...instance.state,
      pendingSelectedTypes: ['binary'],
    };
    instance.buildFilterPipelineResult(true);

    expect(instance.parseResponse).toHaveBeenCalledTimes(1);
  });

  it('skips response parsing when no response-based sort is active', () => {
    const sharedQuestions = [{ id: 'q1', type: 'binary', prompt: 'Q1' }];
    const sharedResponses = {
      q1: {
        '0x1': '{"conviction":2}',
      },
    };

    const instance = new QuestionFilter({
      questionResponses: sharedResponses,
      questionResponsesNonce: 10,
      questionsCacheNonce: 20,
    });

    instance.state = {
      ...instance.state,
      mergedQuestions: sharedQuestions,
      pendingSelectedTypes: [],
      pendingSortByImportance: false,
      pendingSbtFilteredQuestions: null,
      pendingShowTopQuestions: false,
      pendingTopQuestionsCount: 10,
      pendingShowTopQuestionsByResponses: false,
      selectedTags: [],
      aiSearchQuery: '',
    };

    instance.parseResponse = jest.fn(() => ({ conviction: 2 }));

    const result = instance.buildFilterPipelineResult(true);

    expect(result.finalQuestions).toHaveLength(1);
    expect(instance.parseResponse).not.toHaveBeenCalled();
  });

  it('suppresses duplicate filter callback emissions for equivalent payload + filter state', () => {
    const onFilter = jest.fn();
    const onFilterStateChange = jest.fn();
    const instance = new QuestionFilter({
      onFilter,
      onFilterStateChange,
    });

    const payloadA = [{ id: 'q1' }, { id: 'q2' }];
    const payloadB = [{ id: 'q1' }, { id: 'q2' }];
    const filterStateA = { questionTypes: ['binary'] };
    const filterStateB = { questionTypes: ['binary'] };

    instance.emitFilterCallbacks(payloadA, filterStateA);
    instance.emitFilterCallbacks(payloadB, filterStateB);

    expect(onFilter).toHaveBeenCalledTimes(1);
    expect(onFilterStateChange).toHaveBeenCalledTimes(1);
  });

  it('emits filter callbacks when payload content changes with same question ids', () => {
    const onFilter = jest.fn();
    const onFilterStateChange = jest.fn();
    const instance = new QuestionFilter({
      onFilter,
      onFilterStateChange,
    });

    const payloadA = [{ id: 'q1', prompt: 'old prompt' }];
    const payloadB = [{ id: 'q1', prompt: 'new prompt' }];
    const filterState = { questionTypes: ['binary'] };

    instance.emitFilterCallbacks(payloadA, filterState);
    instance.emitFilterCallbacks(payloadB, filterState);

    expect(onFilter).toHaveBeenCalledTimes(2);
    expect(onFilterStateChange).toHaveBeenCalledTimes(2);
  });

  it('emits filter callbacks when response payload changes but counts stay the same', () => {
    const onFilter = jest.fn();
    const onFilterStateChange = jest.fn();
    const instance = new QuestionFilter({
      onFilter,
      onFilterStateChange,
    });

    const payloadA = {
      filteredQuestions: [{ id: 'q1', prompt: 'q1' }],
      filteredResponsesByQuestion: {
        q1: [{ responder: '0x1', response: '{"answer":"old"}' }],
      },
    };
    const payloadB = {
      filteredQuestions: [{ id: 'q1', prompt: 'q1' }],
      filteredResponsesByQuestion: {
        q1: [{ responder: '0x1', response: '{"answer":"new"}' }],
      },
    };
    const filterState = { questionTypes: ['binary'] };

    instance.emitFilterCallbacks(payloadA, filterState);
    instance.emitFilterCallbacks(payloadB, filterState);

    expect(onFilter).toHaveBeenCalledTimes(2);
    expect(onFilterStateChange).toHaveBeenCalledTimes(2);
  });

  it('suppresses duplicate count emissions when filtered count is unchanged', () => {
    const onCountUpdate = jest.fn();
    const instance = new QuestionFilter({
      onCountUpdate,
      isQuestionCacheReady: true,
    });

    instance.emitCountUpdate(4, 0);
    instance.emitCountUpdate(4, 0);
    instance.emitCountUpdate(5, 0);

    expect(onCountUpdate).toHaveBeenCalledTimes(2);
    expect(onCountUpdate).toHaveBeenNthCalledWith(1, 4, 0);
    expect(onCountUpdate).toHaveBeenNthCalledWith(2, 5, 0);
  });

  it('emits encrypted count alongside total count and dedupes on both', () => {
    const onCountUpdate = jest.fn();
    const instance = new QuestionFilter({
      onCountUpdate,
      isQuestionCacheReady: true,
    });

    instance.emitCountUpdate(10, 3);
    instance.emitCountUpdate(10, 3); // duplicate — suppressed
    instance.emitCountUpdate(10, 2); // encrypted count changed — emitted

    expect(onCountUpdate).toHaveBeenCalledTimes(2);
    expect(onCountUpdate).toHaveBeenNthCalledWith(1, 10, 3);
    expect(onCountUpdate).toHaveBeenNthCalledWith(2, 10, 2);
  });
});
