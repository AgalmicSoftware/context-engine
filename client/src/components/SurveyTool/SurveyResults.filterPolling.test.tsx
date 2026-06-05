import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import ConnectedSurveyResults, {
  SURVEY_RESULTS_CLICKABLE_ICON_STYLE,
  SURVEY_RESULTS_DOCUMENT_LINK_ICON_STYLE,
  SURVEY_RESULTS_METADATA_MISSING_STYLE,
  SURVEY_RESULTS_MINI_BAR_SPINNER_STYLE,
  SURVEY_RESULTS_MINI_PROGRESS_STYLE,
  SURVEY_RESULTS_SORTABLE_HEADER_STYLE,
  SURVEY_RESULTS_SURVEY_BOOKMARK_STYLE,
  SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE,
  SURVEY_RESULTS_TABLE_BOOKMARK_STYLE,
  SURVEY_RESULTS_TABLE_CELL_STYLE,
  SURVEY_RESULTS_TRAILING_LABEL_STYLE,
  countQuestionModeResponses,
  hasAnyCountableSurveyAnswer,
  resolveSurveyResultsSyncDetailsStyle,
  resolveSurveyResultsToggleKnobStyle,
} from './SurveyResults';
import styles from './SurveyResults.module.scss';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import * as sessionScanScopeModule from '../../utilities/session/sessionScanScope.js';
import { resolveSurveyResultsQuestionReadScope } from './surveyResultsSessionResolution.js';
import { sbtBasePath } from '../../utilities/ui/terminology.js';

type TreeNode = any;
type TreePredicate = (node: TreeNode) => boolean;
type SurveyResultsProps = Record<string, any>;
const cacheScripts: any = cacheScriptsModule;
const sessionScanScope: any = sessionScanScopeModule;

const mockSbtFilter = jest.fn((..._args: any[]) => null);
jest.mock('../SBTs/SBTFilter', () => (props: any) => {
  mockSbtFilter(props);
  return null;
});
jest.mock('./QuestionFilter', () => () => null);
const mockPolisReport = jest.fn((..._args: any[]) => null);
jest.mock('../PolisReport/PolisReport', () => (props: any) => {
  mockPolisReport(props);
  return null;
});
const mockSingleQuestionResponse = jest.fn((..._args: any[]) => null);
jest.mock('./SingleQuestionResponse', () => (props: any) => {
  mockSingleQuestionResponse(props);
  return null;
});
const mockDemoAnalysisWorkspace = jest.fn((..._args: any[]) => null);
jest.mock('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace', () => ({
  __esModule: true,
  default: (props: any) => {
    mockDemoAnalysisWorkspace(props);
    return <div data-testid="surveyresults-demo-breakdown-view">Demo Breakdown View</div>;
  },
}));
const mockDebateMap = jest.fn((..._args: any[]) => null);
jest.mock('../DebateMap/DebateMap', () => ({
  __esModule: true,
  default: (props: any) => {
    mockDebateMap(props);
    return (
      <div data-testid="surveyresults-demo-atlas-view">
        Demo Atlas View
        {props?.requestedModalNodeId ? `:${props.requestedModalNodeId}` : ''}
      </div>
    );
  },
}));
const mockRiskMatrix = jest.fn((..._args: any[]) => null);
jest.mock('../MainContent/RiskMatrix', () => ({
  __esModule: true,
  default: (props: any) => {
    mockRiskMatrix(props);
    return (
      <button
        type="button"
        data-testid="surveyresults-demo-risk-matrix-view"
        onClick={() => props?.onOpenAtlasNode?.('atlas-node-1')}
      >
        Demo Risk Matrix View
      </button>
    );
  },
}));

const SurveyResults: any = (ConnectedSurveyResults as any).WrappedComponent;

const createSubject = (props: SurveyResultsProps = {}): any =>
  new SurveyResults({
    network: { id: 84532 },
    ...props,
  });

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushMicrotasks = async (cycles = 3): Promise<void> => {
  for (let i = 0; i < cycles; i += 1) {
    await new Promise<void>((resolve) => {
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(resolve);
        return;
      }
      Promise.resolve().then(resolve);
    });
  }
};

const attachStateHarness = (subject: any): any => {
  subject.setState = jest.fn((updater, cb) => {
    const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject;
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

const collectTreeNodes = (
  node: TreeNode,
  predicate: TreePredicate,
  acc: TreeNode[] = []
): TreeNode[] => {
  if (node == null) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => collectTreeNodes(child, predicate, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  return collectTreeNodes(node?.props?.children, predicate, acc);
};

const normalizeChildren = (children: TreeNode): TreeNode[] => {
  if (children == null) return [];
  if (Array.isArray(children)) return children.filter(Boolean);
  return [children].filter(Boolean);
};

const renderSubjectTree = (subject: any) => (
  render(
    <MemoryRouter>
      {subject.render()}
    </MemoryRouter>
  )
);

beforeEach(() => {
  mockSbtFilter.mockClear();
  mockPolisReport.mockClear();
  mockSingleQuestionResponse.mockClear();
  mockDemoAnalysisWorkspace.mockClear();
  mockDebateMap.mockClear();
  mockRiskMatrix.mockClear();
});

const treeHasText = (node: TreeNode, text: string): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

describe('SurveyResults filter state synchronization', () => {
  it('suppresses duplicate filter commit callbacks for no-op patches', () => {
    const onFilterChange = jest.fn();
    const onUrlUpdate = jest.fn();
    const subject = attachStateHarness(createSubject({
      onFilterChange,
      onFilterStateChangeForUrlUpdate: onUrlUpdate,
      isQuestionCacheReady: true,
    }));

    subject.commitResultsFilterState(
      { filteredQuestionsCount: subject.state.filteredQuestionsCount },
      {}
    );
    expect(subject.setState).not.toHaveBeenCalled();
    expect(onFilterChange).not.toHaveBeenCalled();
    expect(onUrlUpdate).not.toHaveBeenCalled();

    subject.commitResultsFilterState(
      { filteredQuestionsCount: 3 },
      { questionTypes: ['binary'] }
    );
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onUrlUpdate).toHaveBeenCalledTimes(1);

    subject.commitResultsFilterState(
      { filteredQuestionsCount: 3 },
      { questionTypes: ['binary'] }
    );
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
  });

  it('re-notifies URL filter state when results modal reopens with unchanged filters', () => {
    const onFilterChange = jest.fn();
    const onUrlUpdate = jest.fn();
    const filterState = { questionTypes: ['binary'] };
    const subject = attachStateHarness(createSubject({
      onFilterChange,
      onFilterStateChangeForUrlUpdate: onUrlUpdate,
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isOpen: true,
      filterState,
      preventUrlChange: true,
    }));
    subject.resetLocalStoragePollingBackoff = jest.fn();
    subject.updateLocalStoragePollingState = jest.fn();
    subject.queueResultsRefresh = jest.fn();

    subject.notifyFilterStateCommitted(filterState);
    expect(onUrlUpdate).toHaveBeenCalledTimes(1);

    const prevProps = { ...subject.props, isOpen: false, filterState };
    subject.props = { ...subject.props, isOpen: true, filterState };

    subject.componentDidUpdate(prevProps, subject.state);

    expect(onUrlUpdate).toHaveBeenCalledTimes(2);
  });

  it('coalesces modal-open state writes for filter sync and count updates', () => {
    const subject = createSubject({
      onFilterStateChangeForUrlUpdate: jest.fn(),
      filteredQuestionsCount: 3,
      filterState: { questionTypes: ['binary'] },
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isOpen: true,
      preventUrlChange: true,
    });
    subject.state = {
      ...subject.state,
      filteredQuestionsCount: 1,
      filterState: { questionTypes: ['rating'] },
      viewMode: 'questions',
      surveyId: '',
    };
    attachStateHarness(subject);
    subject.resetLocalStoragePollingBackoff = jest.fn();
    subject.updateLocalStoragePollingState = jest.fn();
    subject.updateParentWithCurrentFiltersForUrl = jest.fn();
    subject.queueResultsRefresh = jest.fn();

    const prevProps = {
      ...subject.props,
      isOpen: false,
      filteredQuestionsCount: 1,
      filterState: { questionTypes: ['rating'] },
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
    };

    subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.setState).toHaveBeenCalledTimes(1);
    expect(subject.setState.mock.calls[0][0]).toMatchObject({
      filteredQuestionsCount: 3,
      filterState: { questionTypes: ['binary'] },
    });
    expect(subject.updateParentWithCurrentFiltersForUrl).toHaveBeenCalledTimes(1);
    expect(subject.queueResultsRefresh).toHaveBeenCalledTimes(1);
    expect(subject.queueResultsRefresh.mock.calls[0][0]).toContain('modal-open');
  });

  it('queues one combined refresh when modal-open and cache-ready reasons arrive together', () => {
    const subject = createSubject({
      filterState: {},
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isOpen: true,
      preventUrlChange: true,
    });
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyId: '',
    };
    attachStateHarness(subject);
    subject.resetLocalStoragePollingBackoff = jest.fn();
    subject.updateLocalStoragePollingState = jest.fn();
    subject.updateParentWithCurrentFiltersForUrl = jest.fn();
    subject.queueResultsRefresh = jest.fn();

    const prevProps = {
      ...subject.props,
      isOpen: false,
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
      filterState: {},
    };

    subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.queueResultsRefresh).toHaveBeenCalledTimes(1);
    const reason = subject.queueResultsRefresh.mock.calls[0][0];
    expect(reason).toBe('modal-open|cache-ready|responses-cache-ready');
  });
});

describe('SurveyResults bookmark cache writes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('uses clone:false reads when mutating survey/question bookmarks in results view', async () => {
    const liveBookmarksCache = {
      surveys: ['existing-survey'],
      questions: ['existing-question'],
    };
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(liveBookmarksCache);
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);

    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject.getEffectiveSlug = jest.fn(() => 'edge');

    subject.toggleSurveyBookmark('s1');
    subject.toggleQuestionBookmark('q1');
    await flushMicrotasks();

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    expect(writeSpy).toHaveBeenCalledTimes(2);
    expect(writeSpy).toHaveBeenNthCalledWith(1, 'bookmarksCache', 'edge', {
      surveys: ['existing-survey', 's1'],
      questions: ['existing-question'],
    });
    expect(writeSpy).toHaveBeenNthCalledWith(2, 'bookmarksCache', 'edge', {
      surveys: ['existing-survey'],
      questions: ['existing-question', 'q1'],
    });
    expect(liveBookmarksCache).toEqual({
      surveys: ['existing-survey'],
      questions: ['existing-question'],
    });
    expect(subject.state.bookmarkedSurveyIDs).toEqual(['existing-survey', 's1']);
    expect(subject.state.bookmarkedQuestionIDs).toEqual(['existing-question', 'q1']);
  });

  it('normalizes malformed survey bookmark lists before writing to the active slug', async () => {
    const malformedCache = {
      surveys: 'bad-surveys',
      questions: ['existing-question'],
      otherField: 'discarded',
    };
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(malformedCache);
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject.getEffectiveSlug = jest.fn(() => 'edge');

    subject.toggleSurveyBookmark('s1');
    await flushMicrotasks();

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', {
      otherField: 'discarded',
      surveys: ['s1'],
      questions: ['existing-question'],
    });
    expect(malformedCache).toEqual({
      surveys: 'bad-surveys',
      questions: ['existing-question'],
      otherField: 'discarded',
    });
    expect(subject.state.bookmarkedSurveyIDs).toEqual(['s1']);
  });

  it('applies question bookmark removal state even when the async cache write fails', async () => {
    const writeError = new Error('bookmark write failed');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      surveys: ['s1'],
      questions: ['q1'],
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockRejectedValue(writeError);
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject.getEffectiveSlug = jest.fn(() => 'edge');

    try {
      subject.toggleQuestionBookmark('q1');
      await flushMicrotasks();

      expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', {
        surveys: ['s1'],
        questions: [],
      });
      expect(subject.state.bookmarkedQuestionIDs).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[surveys]',
        '[SurveyResults] Error saving bookmarksCache:',
        writeError
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('orders survey bookmark identity, cache read, write dispatch, and parent state application', async () => {
    const events: string[] = [];
    const liveBookmarksCache = {
      surveys: [],
      questions: ['existing-question'],
    };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation(() => {
      events.push('peek');
      return liveBookmarksCache;
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockImplementation(async () => {
      events.push('write');
      return true;
    });
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    const originalSetState = subject.setState;
    subject.setState = jest.fn((updater, cb) => {
      events.push('setState');
      return originalSetState(updater, cb);
    });
    subject.getEffectiveSlug = jest.fn(() => {
      events.push('slug');
      return 'edge';
    });
    events.length = 0;

    subject.toggleSurveyBookmark('s-ordered');
    await flushMicrotasks();

    expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', {
      surveys: ['s-ordered'],
      questions: ['existing-question'],
    });
    expect(subject.state.bookmarkedSurveyIDs).toEqual(['s-ordered']);
    expect(events.slice(0, 4)).toEqual(['slug', 'peek', 'write', 'setState']);
  });

  it('normalizes malformed question bookmark lists before writing to the active slug', async () => {
    const malformedCache = {
      surveys: ['existing-survey'],
      questions: 'bad-questions',
      otherField: 'kept',
    };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(malformedCache);
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject.getEffectiveSlug = jest.fn(() => 'edge');

    subject.toggleQuestionBookmark('q2');
    await flushMicrotasks();

    expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', {
      surveys: ['existing-survey'],
      questions: ['q2'],
      otherField: 'kept',
    });
    expect(malformedCache).toEqual({
      surveys: ['existing-survey'],
      questions: 'bad-questions',
      otherField: 'kept',
    });
    expect(subject.state.bookmarkedQuestionIDs).toEqual(['q2']);
  });

  it('applies plan-derived survey bookmark removals through the parent write path', async () => {
    const liveBookmarksCache = {
      surveys: ['s-remove', 's-keep'],
      questions: ['existing-question'],
      otherField: 'kept',
    };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(liveBookmarksCache);
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject.getEffectiveSlug = jest.fn(() => 'edge');

    subject.toggleSurveyBookmark('s-remove');
    await flushMicrotasks();

    expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', {
      surveys: ['s-keep'],
      questions: ['existing-question'],
      otherField: 'kept',
    });
    expect(liveBookmarksCache).toEqual({
      surveys: ['s-remove', 's-keep'],
      questions: ['existing-question'],
      otherField: 'kept',
    });
    expect(subject.state.bookmarkedSurveyIDs).toEqual(['s-keep']);
  });

  it('falls back to default bookmark cache when the sync cache read throws', async () => {
    const readError = new Error('bookmark read failed');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation(() => {
      throw readError;
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject.getEffectiveSlug = jest.fn(() => 'edge');

    try {
      subject.toggleSurveyBookmark('s-read-fallback');
      await flushMicrotasks();

      expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', {
        surveys: ['s-read-fallback'],
        questions: [],
      });
      expect(subject.state.bookmarkedSurveyIDs).toEqual(['s-read-fallback']);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[surveys]',
        '[SurveyResults] Error reading bookmarksCache:',
        readError
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('preserves current empty-slug bookmark write identity when no effective slug is available', async () => {
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      surveys: [],
      questions: [],
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: '',
    }));
    subject.getEffectiveSlug = jest.fn(() => '');

    subject.toggleQuestionBookmark('q-empty-slug');
    await flushMicrotasks();

    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('bookmarksCache', '', { clone: false });
    expect(writeSpy).toHaveBeenCalledWith('bookmarksCache', '', {
      surveys: [],
      questions: ['q-empty-slug'],
    });
    expect(subject.state.bookmarkedQuestionIDs).toEqual(['q-empty-slug']);
  });

  it('keeps survey bookmark write failures state-applied and allows a later successful retry', async () => {
    const liveBookmarksCache = {
      surveys: ['existing-survey'],
      questions: ['existing-question'],
    };
    const writeError = new Error('survey bookmark write failed');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(liveBookmarksCache);
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache')
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce(true);
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject.getEffectiveSlug = jest.fn(() => 'edge');

    try {
      subject.toggleSurveyBookmark('s-fail');
      await flushMicrotasks();

      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenLastCalledWith('bookmarksCache', 'edge', {
        surveys: ['existing-survey', 's-fail'],
        questions: ['existing-question'],
      });
      expect(subject.state.bookmarkedSurveyIDs).toEqual(['existing-survey', 's-fail']);
      expect(liveBookmarksCache).toEqual({
        surveys: ['existing-survey'],
        questions: ['existing-question'],
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[surveys]',
        '[SurveyResults] Error saving bookmarksCache:',
        writeError
      );

      subject.toggleSurveyBookmark('s-retry');
      await flushMicrotasks();

      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy).toHaveBeenLastCalledWith('bookmarksCache', 'edge', {
        surveys: ['existing-survey', 's-retry'],
        questions: ['existing-question'],
      });
      expect(subject.state.bookmarkedSurveyIDs).toEqual(['existing-survey', 's-retry']);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('blocks filter bookmark writes when the results view is unmounted', async () => {
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject._isMounted = false;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      filterState: { types: ['radio'] },
    };
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync');
    const readSpy = jest.spyOn(cacheScripts, 'readCache');
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache');

    await subject.handleBookmarkFilter();

    expect(peekSpy).not.toHaveBeenCalled();
    expect(readSpy).not.toHaveBeenCalled();
    expect(writeSpy).not.toHaveBeenCalled();
    expect(subject.getEffectiveSlug).not.toHaveBeenCalled();
    expect(subject.setState).not.toHaveBeenCalled();
  });

  it('writes eligible filter bookmarks to the active slug and toggles success feedback', async () => {
    jest.useFakeTimers();
    const filterState = { types: ['radio'], tags: ['alpha'] };
    const existingFiltersCache = { bookmarkedFilters: ['existing-filter'], otherField: 'kept' };
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(existingFiltersCache);
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      filterBookmarkedFeedback: false,
      filterState,
    };

    try {
      await subject.handleBookmarkFilter();

      expect(peekSpy).toHaveBeenCalledWith('filters', 'edge', { clone: false });
      expect(writeSpy).toHaveBeenCalledWith('filters', 'edge', {
        otherField: 'kept',
        bookmarkedFilters: ['existing-filter', filterState],
      });
      expect(existingFiltersCache).toEqual({
        bookmarkedFilters: ['existing-filter'],
        otherField: 'kept',
      });
      expect(subject.state.filterBookmarkedFeedback).toBe(true);

      jest.runOnlyPendingTimers();

      expect(subject.state.filterBookmarkedFeedback).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to async filter cache reads before writing bookmark payloads', async () => {
    const filterState = { types: ['multichoice'], tags: ['fallback'] };
    const readFiltersCache = { bookmarkedFilters: ['from-read'], persisted: true };
    const events: string[] = [];
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation(() => {
      events.push('peek');
      return null;
    });
    const readSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(async () => {
      events.push('read');
      return readFiltersCache;
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockImplementation(async () => {
      events.push('write');
      return true;
    });
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    const originalSetState = subject.setState;
    subject.setState = jest.fn((updater, cb) => {
      events.push('setState');
      return originalSetState(updater, cb);
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => {
      events.push('slug');
      return 'edge';
    });
    subject.state = {
      ...subject.state,
      filterBookmarkedFeedback: false,
      filterState,
    };
    events.length = 0;

    await subject.handleBookmarkFilter();

    expect(peekSpy).toHaveBeenCalledWith('filters', 'edge', { clone: false });
    expect(readSpy).toHaveBeenCalledWith('filters', 'edge');
    expect(writeSpy).toHaveBeenCalledWith('filters', 'edge', {
      bookmarkedFilters: ['from-read', filterState],
      persisted: true,
    });
    expect(readFiltersCache).toEqual({
      bookmarkedFilters: ['from-read'],
      persisted: true,
    });
    expect(subject.state.filterBookmarkedFeedback).toBe(true);
    expect(events.slice(0, 4)).toEqual(['slug', 'peek', 'read', 'write']);
    expect(events).toContain('setState');
  });

  it('initializes invalid bookmarked filter cache shape without changing the target identity', async () => {
    const filterState = { types: ['slider'], range: [1, 5] };
    const invalidCache = {
      bookmarkedFilters: 'not-an-array',
      otherField: 'kept',
    };
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(invalidCache);
    const readSpy = jest.spyOn(cacheScripts, 'readCache');
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);
    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      filterState,
    };

    await subject.handleBookmarkFilter();

    expect(peekSpy).toHaveBeenCalledWith('filters', 'edge', { clone: false });
    expect(readSpy).not.toHaveBeenCalled();
    expect(writeSpy).toHaveBeenCalledWith('filters', 'edge', {
      bookmarkedFilters: [filterState],
      otherField: 'kept',
    });
    expect(invalidCache).toEqual({
      bookmarkedFilters: 'not-an-array',
      otherField: 'kept',
    });
  });

  it('does not mutate live bookmarkedFilters cache when filter write fails', async () => {
    const liveCache = { bookmarkedFilters: ['existing-filter'] };
    const writeError = new Error('write failed');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(liveCache);
    jest.spyOn(cacheScripts, 'writeCache').mockRejectedValue(writeError);

    const subject = createSubject({
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      filterState: { types: ['radio'] },
    };

    try {
      await subject.handleBookmarkFilter();

      expect(liveCache.bookmarkedFilters).toEqual(['existing-filter']);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[surveys]',
        'Error saving bookmarked filters cache:',
        writeError
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('keeps failed filter bookmark writes inert and allows a later successful retry', async () => {
    jest.useFakeTimers();
    const liveCache = { bookmarkedFilters: ['existing-filter'] };
    const writeError = new Error('write failed');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(liveCache);
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache')
      .mockRejectedValueOnce(writeError)
      .mockResolvedValueOnce(true);

    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      filterBookmarkedFeedback: false,
      filterState: { types: ['radio'] },
    };

    try {
      await subject.handleBookmarkFilter();

      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenLastCalledWith('filters', 'edge', {
        bookmarkedFilters: ['existing-filter', { types: ['radio'] }],
      });
      expect(subject.state.filterBookmarkedFeedback).toBe(false);
      expect(liveCache.bookmarkedFilters).toEqual(['existing-filter']);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[surveys]',
        'Error saving bookmarked filters cache:',
        writeError
      );

      subject.state = {
        ...subject.state,
        filterState: { types: ['slider'] },
      };

      await subject.handleBookmarkFilter();

      expect(writeSpy).toHaveBeenCalledTimes(2);
      expect(writeSpy).toHaveBeenLastCalledWith('filters', 'edge', {
        bookmarkedFilters: ['existing-filter', { types: ['slider'] }],
      });
      expect(subject.state.filterBookmarkedFeedback).toBe(true);

      jest.runOnlyPendingTimers();

      expect(subject.state.filterBookmarkedFeedback).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
      jest.useRealTimers();
    }
  });
});

describe('SurveyResults fallback questions', () => {
  it('reuses stable fallback question objects per question and mode', () => {
    const subject = createSubject({});

    const summaryA = subject.getStableFallbackQuestion('q-missing', 'summary');
    const summaryB = subject.getStableFallbackQuestion('q-missing', 'summary');
    const individualA = subject.getStableFallbackQuestion('q-missing', 'individual');
    const individualB = subject.getStableFallbackQuestion('q-missing', 'individual');

    expect(summaryA).toBe(summaryB);
    expect(summaryA).toEqual({ id: 'q-missing', prompt: 'Unknown question' });
    expect(individualA).toBe(individualB);
    expect(individualA).toEqual({
      id: 'q-missing',
      creator: '',
      type: '',
      prompt: '',
    });
    expect(individualA).not.toBe(summaryA);
  });
});

describe('SurveyResults question-mode polling and filter state', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('invalidates question-filter question memo on nonce ticks with stable refs', () => {
    const subject = createSubject({
      questionResponsesNonce: 30,
      questionsCacheNonce: 40,
    });

    const sharedQuestionResponses = {
      q1: { '0x1': { response: true } },
    };
    const sharedNetworkQuestions = {
      q1: { id: 'q1', creator: '0x1', type: 'binary', prompt: 'Q1' },
    };

    subject.state = {
      ...subject.state,
      questionResponses: sharedQuestionResponses,
    };

    const first = subject.getMemoizedQuestionFilterQuestions(sharedNetworkQuestions);
    const second = subject.getMemoizedQuestionFilterQuestions(sharedNetworkQuestions);
    expect(second).toBe(first);

    subject.props = { ...subject.props, questionResponsesNonce: 31 };
    const third = subject.getMemoizedQuestionFilterQuestions(sharedNetworkQuestions);
    expect(third).not.toBe(second);

    subject.props = { ...subject.props, questionsCacheNonce: 41 };
    const fourth = subject.getMemoizedQuestionFilterQuestions(sharedNetworkQuestions);
    expect(fourth).not.toBe(third);
  });

  it('starts and stops local storage polling idempotently', () => {
    const subject = createSubject({
      isOpen: true,
    });

    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    subject._isMounted = true;
    subject.isDocumentHidden = jest.fn(() => false);
    subject.pollLocalStorageForUpdates = jest.fn();

    subject.startLocalStoragePolling();
    subject.startLocalStoragePolling();
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(subject._localStoragePollingIntervalId).toBeTruthy();

    subject.stopLocalStoragePolling();
    subject.stopLocalStoragePolling();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(subject._localStoragePollingIntervalId).toBeNull();
  });

  it('skips surveys cache reads during question-mode polling', () => {
    const subject = createSubject({
      isOpen: true,
    });

    const questionBucket = {
      questionsLatestBlock: 5,
      questionResponsesLatestBlock: 7,
      questions: { q1: { id: 'q1' } },
      questionResponses: {},
    };

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'questionsCache') return { '84532': questionBucket };
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveyResponses: {},
            surveyResponsesLatestBlock: {},
          },
        };
      }
      return {};
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyId: '',
      networkLatestBlock: 0,
      questionLocalBlock: 5,
      responseLocalBlock: 7,
      surveyLocalBlock: 0,
      cachedQuestionsCount: 1,
      cachedSurveyResponsesCount: 0,
    };
    subject.maybeRefreshNetworkLatestBlockFromPolling = jest.fn();
    subject._lastPolledQuestionsRef = questionBucket.questions;
    subject._lastPolledSurveyResponsesRef = null;
    subject._lastPolledQuestionRefVersion = 2;
    subject._lastPolledSurveyResponsesRefVersion = 0;
    subject._lastLocalStoragePollCoarseSignature = 'questions||5|7|0|2|0';
    subject._lastLocalStoragePollDetailedSignature = 'questions||5|7|0|2|0|1|0|0';

    const changed = subject.pollLocalStorageForUpdates();

    expect(changed).toBe(false);
    const surveyCacheCalls = peekSpy.mock.calls.filter((args) => args[0] === 'surveysCache');
    expect(surveyCacheCalls).toHaveLength(0);
    peekSpy.mockRestore();
  });

  it('polls question cache using networkChainId when wallet network is unavailable', () => {
    const subject = attachStateHarness(createSubject({
      isOpen: true,
      network: null,
      networkChainId: 84532,
    }));

    const questionBucket = {
      questionsLatestBlock: 5,
      questionResponsesLatestBlock: 7,
      questions: { q1: { id: 'q1' }, q2: { id: 'q2' } },
      questionResponses: {},
    };
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'questionsCache') return { '84532': questionBucket };
      return {};
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyId: '',
      networkLatestBlock: 0,
      questionLocalBlock: 0,
      responseLocalBlock: 0,
      surveyLocalBlock: 0,
      cachedQuestionsCount: 0,
      cachedSurveyResponsesCount: 0,
    };
    subject.maybeRefreshNetworkLatestBlockFromPolling = jest.fn();
    subject.queueResultsRefresh = jest.fn();

    const changed = subject.pollLocalStorageForUpdates();

    expect(changed).toBe(true);
    expect(subject.state.cachedQuestionsCount).toBe(2);
    expect(subject.queueResultsRefresh).toHaveBeenCalledWith('poll-local-storage-change');
    peekSpy.mockRestore();
  });

  it('fetches and renders question results using networkChainId without wallet network', async () => {
    const subject = createSubject({
      network: null,
      networkChainId: 84532,
    });
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      networkLatestBlock: 1,
    };
    subject.fetchQuestionModeResponses = jest.fn(async () => undefined);
    subject.fetchSurveyModeResponses = jest.fn(async () => undefined);

    await subject.fetchResponses();

    expect(subject.fetchQuestionModeResponses).toHaveBeenCalledTimes(1);
    expect(subject.fetchSurveyModeResponses).not.toHaveBeenCalled();
    expect(subject.renderQuestionIDsTable({ q1: [] }, { q1: { id: 'q1', prompt: 'Prompt' } })).not.toBeNull();
  });

  it('suppresses no-op filter activity state writes', () => {
    const subject = createSubject({});
    subject.state = {
      ...subject.state,
      isFilterActive: true,
    };
    subject.setState = jest.fn();

    subject.handleFilterActivityChange(true);
    expect(subject.setState).not.toHaveBeenCalled();

    subject.handleFilterActivityChange(false);
    expect(subject.setState).toHaveBeenCalledTimes(1);
  });

  it('suppresses no-op filter-loading state writes while still notifying parent', () => {
    const parentSetFilterLoading = jest.fn();
    const subject = createSubject({
      setFilterLoading: parentSetFilterLoading,
    });
    subject.state = {
      ...subject.state,
      filterLoading: true,
    };
    subject.setState = jest.fn();

    subject.setFilterLoading(true);
    expect(subject.setState).not.toHaveBeenCalled();
    expect(parentSetFilterLoading).toHaveBeenCalledWith(true);

    subject.setFilterLoading(false);
    expect(subject.setState).toHaveBeenCalledTimes(1);
    expect(parentSetFilterLoading).toHaveBeenCalledWith(false);
  });

  it('applies rapid filter-loading flips in call order before state commits', () => {
    const parentSetFilterLoading = jest.fn();
    const subject = createSubject({
      setFilterLoading: parentSetFilterLoading,
    });
    subject.state = {
      ...subject.state,
      filterLoading: false,
    };
    const queuedStateOps: Array<{ next: any; cb?: (() => void) | undefined }> = [];
    subject.setState = jest.fn((next, cb) => {
      queuedStateOps.push({ next, cb });
    });

    subject.setFilterLoading(true);
    subject.setFilterLoading(false);

    expect(subject.setState).toHaveBeenCalledTimes(2);
    expect(parentSetFilterLoading).toHaveBeenNthCalledWith(1, true);
    expect(parentSetFilterLoading).toHaveBeenNthCalledWith(2, false);

    queuedStateOps.forEach(({ next, cb }) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
    });

    expect(subject.state.filterLoading).toBe(false);
  });

  it('keeps question-mode polling scoped to the /session route slug', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha']);

      const edgeBucket = {
        questionsLatestBlock: 5,
        questionResponsesLatestBlock: 7,
        questions: { q1: { id: 'q1' } },
        questionResponses: {},
      };
      const alphaBucket = {
        questionsLatestBlock: 11,
        questionResponsesLatestBlock: 13,
        questions: { q2: { id: 'q2' } },
        questionResponses: {},
      };

      const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any, slug: any) => {
        if (namespace === 'questionsCache') {
          if (slug === 'edge') return { '84532': edgeBucket };
          if (slug === 'alpha') return { '84532': alphaBucket };
        }
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace === 'surveysCache') {
          return {
            '84532': {
              surveyResponses: {},
              surveyResponsesLatestBlock: {},
            },
          };
        }
        return {};
      });

      const subject = createSubject({
        isOpen: true,
        activeSessionSlug: 'edge',
      });
      subject._isMounted = true;
      attachStateHarness(subject);
      subject.queueResultsRefresh = jest.fn();
      subject.maybeRefreshNetworkLatestBlockFromPolling = jest.fn();
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
        surveyId: '',
        networkLatestBlock: 0,
        questionLocalBlock: 5,
        responseLocalBlock: 7,
        surveyLocalBlock: 0,
        cachedQuestionsCount: 1,
        cachedSurveyResponsesCount: 0,
      };

      const changed = subject.pollLocalStorageForUpdates();

      expect(changed).toBe(false);
      expect(subject.state.questionLocalBlock).toBe(5);
      expect(subject.state.responseLocalBlock).toBe(7);
      expect(subject.state.cachedQuestionsCount).toBe(1);
      expect(subject.queueResultsRefresh).not.toHaveBeenCalled();
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
      expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
      expect(peekSpy.mock.calls.filter((args) => args[0] === 'surveysCache')).toHaveLength(0);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('coalesces rapid nonce ticks to at most one queued rerun', async () => {
    const subject = createSubject({
      isOpen: true,
      provider: {},
      questionResponsesNonce: 1,
    });

    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.pollLocalStorageForUpdates = jest.fn();
    subject.requestFetchResponses = jest.fn();
    attachStateHarness(subject);

    const first = createDeferred<number>();
    let inFlight = 0;
    let maxInFlight = 0;
    const latestSpy = jest
      .spyOn((contractScriptsModule as any).default, 'getLatestBlockNumber')
      .mockImplementationOnce(() => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return first.promise.finally(() => {
          inFlight -= 1;
        });
      })
      .mockImplementationOnce(() => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return Promise.resolve(102).finally(() => {
          inFlight -= 1;
        });
      });

    const firstRunPromise = subject.handleNonceTick();
    subject.handleNonceTick();
    subject.handleNonceTick();
    expect(latestSpy).toHaveBeenCalledTimes(1);

    first.resolve(101);
    await firstRunPromise;
    await flushMicrotasks();

    expect(latestSpy).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(1);
    expect(subject.pollLocalStorageForUpdates).toHaveBeenCalledTimes(2);
    expect(subject.requestFetchResponses).toHaveBeenCalledTimes(2);
  });

  it('nonce tick writes refresh status targets before parent polling follow-up', async () => {
    const calls: string[] = [];
    const subject = createSubject({
      isOpen: true,
      provider: { id: 'provider' },
      questionResponsesNonce: 1,
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.pollLocalStorageForUpdates = jest.fn(() => {
      calls.push('poll');
      return false;
    });
    subject.resetLocalStoragePollingBackoff = jest.fn(() => calls.push('reset'));
    subject.queueResultsRefresh = jest.fn(() => calls.push('queue'));
    attachStateHarness(subject);
    jest
      .spyOn((contractScriptsModule as any).default, 'getLatestBlockNumber')
      .mockResolvedValue(234);

    await subject.runNonceTickRefresh();
    await flushMicrotasks();

    expect((contractScriptsModule as any).default.getLatestBlockNumber).toHaveBeenCalledWith(
      subject.props.provider,
      'edge'
    );
    expect(subject.state.networkLatestBlock).toBe(234);
    expect(subject.state.refreshTargetQuestionBlock).toBe(234);
    expect(subject.state.refreshTargetResponseBlock).toBe(234);
    expect(subject.state.refreshTargetSurveyBlock).toBe(234);
    expect(subject.setState).toHaveBeenCalledWith(
      {
        networkLatestBlock: 234,
        refreshTargetQuestionBlock: 234,
        refreshTargetResponseBlock: 234,
        refreshTargetSurveyBlock: 234,
      },
      expect.any(Function)
    );
    expect(calls).toEqual(['poll', 'reset', 'queue']);
    expect(subject.queueResultsRefresh).toHaveBeenCalledWith('nonce-tick');
  });

  it('skips refresh status writes and polling follow-up when nonce refresh unmounts before write', async () => {
    const subject = createSubject({
      isOpen: true,
      provider: {},
      questionResponsesNonce: 1,
    });
    subject._isMounted = false;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.setState = jest.fn();
    subject.pollLocalStorageForUpdates = jest.fn();
    subject.resetLocalStoragePollingBackoff = jest.fn();
    subject.queueResultsRefresh = jest.fn();
    jest
      .spyOn((contractScriptsModule as any).default, 'getLatestBlockNumber')
      .mockResolvedValue(345);

    await subject.runNonceTickRefresh();
    await flushMicrotasks();

    expect(subject.setState).not.toHaveBeenCalled();
    expect(subject.pollLocalStorageForUpdates).not.toHaveBeenCalled();
    expect(subject.resetLocalStoragePollingBackoff).not.toHaveBeenCalled();
    expect(subject.queueResultsRefresh).not.toHaveBeenCalled();
    expect(subject.state.refreshTargetQuestionBlock).toBe(0);
    expect(subject.state.refreshTargetResponseBlock).toBe(0);
    expect(subject.state.refreshTargetSurveyBlock).toBe(0);
  });

  it('recovers refresh status writes after a nonce latest-block failure', async () => {
    const calls: string[] = [];
    const subject = createSubject({
      isOpen: true,
      provider: {},
      questionResponsesNonce: 1,
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.pollLocalStorageForUpdates = jest.fn(() => {
      calls.push('poll');
      return false;
    });
    subject.resetLocalStoragePollingBackoff = jest.fn((reason) => calls.push(`reset:${reason}`));
    subject.queueResultsRefresh = jest.fn((reason) => calls.push(`queue:${reason}`));
    attachStateHarness(subject);
    jest
      .spyOn((contractScriptsModule as any).default, 'getLatestBlockNumber')
      .mockRejectedValueOnce(new Error('latest block failed'))
      .mockResolvedValueOnce(456);

    await subject.runNonceTickRefresh();
    await flushMicrotasks();

    expect(subject.setState).not.toHaveBeenCalled();
    expect(subject.pollLocalStorageForUpdates).not.toHaveBeenCalled();
    expect(calls).toEqual(['reset:nonce-tick-fallback', 'queue:nonce-tick-fallback']);
    expect(subject.state.refreshTargetQuestionBlock).toBe(0);
    expect(subject.state.refreshTargetResponseBlock).toBe(0);
    expect(subject.state.refreshTargetSurveyBlock).toBe(0);

    calls.length = 0;
    jest.clearAllMocks();
    subject._isMounted = true;

    await subject.runNonceTickRefresh();
    await flushMicrotasks();

    expect(subject.state.networkLatestBlock).toBe(456);
    expect(subject.state.refreshTargetQuestionBlock).toBe(456);
    expect(subject.state.refreshTargetResponseBlock).toBe(456);
    expect(subject.state.refreshTargetSurveyBlock).toBe(456);
    expect(subject.pollLocalStorageForUpdates).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['poll', 'reset:nonce-tick', 'queue:nonce-tick']);
  });

  it('preserves a queued nonce retry after latest-block failure and recovers status writes', async () => {
    const calls: string[] = [];
    const subject = createSubject({
      isOpen: true,
      provider: {},
      questionResponsesNonce: 1,
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.pollLocalStorageForUpdates = jest.fn(() => {
      calls.push('poll');
      return false;
    });
    subject.resetLocalStoragePollingBackoff = jest.fn((reason) => calls.push(`reset:${reason}`));
    subject.queueResultsRefresh = jest.fn((reason) => calls.push(`queue:${reason}`));
    attachStateHarness(subject);

    const first = createDeferred<number>();
    jest
      .spyOn((contractScriptsModule as any).default, 'getLatestBlockNumber')
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(654);

    const firstRunPromise = subject.handleNonceTick();
    subject.handleNonceTick();
    expect(subject._nonceTickInFlight).toBe(true);
    expect(subject._nonceTickQueued).toBe(true);

    first.reject(new Error('latest block failed'));
    await firstRunPromise;
    await flushMicrotasks();

    expect(subject._nonceTickInFlight).toBe(false);
    expect(subject._nonceTickQueued).toBe(false);
    expect(subject.state.networkLatestBlock).toBe(654);
    expect(subject.state.refreshTargetQuestionBlock).toBe(654);
    expect(subject.state.refreshTargetResponseBlock).toBe(654);
    expect(subject.state.refreshTargetSurveyBlock).toBe(654);
    expect((contractScriptsModule as any).default.getLatestBlockNumber).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([
      'reset:nonce-tick-fallback',
      'queue:nonce-tick-fallback',
      'poll',
      'reset:nonce-tick',
      'queue:nonce-tick',
    ]);
  });

  it('manual refresh dispatches question refresh ports before shell polling follow-up', async () => {
    const calls: string[] = [];
    const subject = createSubject({
      isOpen: true,
      provider: {},
      refreshQuestionMetadata: jest.fn(async () => calls.push('metadata')),
      refreshQuestionResponses: jest.fn(async () => calls.push('responses')),
    });
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
    };
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.resetLocalStoragePollingBackoff = jest.fn(() => calls.push('reset'));
    subject.pollLocalStorageForUpdates = jest.fn(() => {
      calls.push('poll');
      return false;
    });
    subject.queueResultsRefresh = jest.fn(() => calls.push('queue'));
    attachStateHarness(subject);
    jest
      .spyOn((contractScriptsModule as any).default, 'getLatestBlockNumber')
      .mockResolvedValue(123);

    await subject.handleManualRefresh();
    await flushMicrotasks();

    expect(subject.state.refreshTargetQuestionBlock).toBe(123);
    expect(subject.state.refreshTargetResponseBlock).toBe(123);
    expect(subject.state.refreshTargetSurveyBlock).toBe(123);
    expect(subject.props.refreshQuestionMetadata).toHaveBeenCalledTimes(1);
    expect(subject.props.refreshQuestionResponses).toHaveBeenCalledTimes(1);
    expect(subject.resetLocalStoragePollingBackoff).toHaveBeenCalledWith('manual-refresh');
    expect(subject.queueResultsRefresh).toHaveBeenCalledWith('manual-refresh');
    expect(calls).toEqual(['metadata', 'responses', 'reset', 'poll', 'queue']);
  });

  it('manual survey refresh writes target status before survey dispatch and polling follow-up', async () => {
    const calls: string[] = [];
    const subject = createSubject({
      isOpen: true,
      provider: { id: 'provider' },
      refreshSurveyResponsesByID: jest.fn(async (surveyId: string) => {
        calls.push(`survey:${surveyId}`);
      }),
    });
    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: '0xABC',
    };
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.resetLocalStoragePollingBackoff = jest.fn((reason) => calls.push(`reset:${reason}`));
    subject.pollLocalStorageForUpdates = jest.fn(() => {
      calls.push('poll');
      return false;
    });
    subject.queueResultsRefresh = jest.fn((reason) => calls.push(`queue:${reason}`));
    subject.setState = jest.fn((patch, cb) => {
      calls.push(`setState:${Object.keys(patch || {}).join(',')}`);
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    jest
      .spyOn((contractScriptsModule as any).default, 'getLatestBlockNumber')
      .mockResolvedValue(321);

    await subject.handleManualRefresh();
    await flushMicrotasks();

    expect((contractScriptsModule as any).default.getLatestBlockNumber).toHaveBeenCalledWith(
      subject.props.provider,
      'edge'
    );
    expect(subject.setState).toHaveBeenCalledWith(
      {
        refreshTargetQuestionBlock: 321,
        refreshTargetResponseBlock: 321,
        refreshTargetSurveyBlock: 321,
      },
      expect.any(Function)
    );
    expect(subject.props.refreshSurveyResponsesByID).toHaveBeenCalledWith('0xabc');
    expect(subject.state.refreshTargetQuestionBlock).toBe(321);
    expect(subject.state.refreshTargetResponseBlock).toBe(321);
    expect(subject.state.refreshTargetSurveyBlock).toBe(321);
    expect(calls).toEqual([
      'setState:refreshTargetQuestionBlock,refreshTargetResponseBlock,refreshTargetSurveyBlock',
      'survey:0xabc',
      'reset:manual-refresh',
      'poll',
      'queue:manual-refresh',
    ]);
  });

  it('manual refresh keeps missing latest block as a parent-owned status write', async () => {
    const calls: string[] = [];
    const subject = createSubject({
      isOpen: true,
      provider: {},
      refreshQuestionMetadata: jest.fn(async () => calls.push('metadata')),
      refreshQuestionResponses: jest.fn(async () => calls.push('responses')),
    });
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
    };
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.resetLocalStoragePollingBackoff = jest.fn((reason) => calls.push(`reset:${reason}`));
    subject.pollLocalStorageForUpdates = jest.fn(() => {
      calls.push('poll');
      return false;
    });
    subject.queueResultsRefresh = jest.fn((reason) => calls.push(`queue:${reason}`));
    attachStateHarness(subject);
    jest
      .spyOn((contractScriptsModule as any).default, 'getLatestBlockNumber')
      .mockResolvedValue(undefined);

    await subject.handleManualRefresh();
    await flushMicrotasks();

    expect(subject.setState).toHaveBeenCalledWith(
      {
        refreshTargetQuestionBlock: undefined,
        refreshTargetResponseBlock: undefined,
        refreshTargetSurveyBlock: undefined,
      },
      expect.any(Function)
    );
    expect(subject.props.refreshQuestionMetadata).toHaveBeenCalledTimes(1);
    expect(subject.props.refreshQuestionResponses).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      'metadata',
      'responses',
      'reset:manual-refresh',
      'poll',
      'queue:manual-refresh',
    ]);
  });

  it('manual survey refresh keeps dispatch inert when the survey target is missing', async () => {
    const calls: string[] = [];
    const subject = createSubject({
      isOpen: true,
      provider: {},
      refreshSurveyResponsesByID: jest.fn(async () => calls.push('survey')),
    });
    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: '',
    };
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.resetLocalStoragePollingBackoff = jest.fn((reason) => calls.push(`reset:${reason}`));
    subject.pollLocalStorageForUpdates = jest.fn(() => {
      calls.push('poll');
      return false;
    });
    subject.queueResultsRefresh = jest.fn((reason) => calls.push(`queue:${reason}`));
    attachStateHarness(subject);
    jest
      .spyOn((contractScriptsModule as any).default, 'getLatestBlockNumber')
      .mockResolvedValue(222);

    await subject.handleManualRefresh();
    await flushMicrotasks();

    expect(subject.state.refreshTargetQuestionBlock).toBe(222);
    expect(subject.state.refreshTargetResponseBlock).toBe(222);
    expect(subject.state.refreshTargetSurveyBlock).toBe(222);
    expect(subject.props.refreshSurveyResponsesByID).not.toHaveBeenCalled();
    expect(calls).toEqual([
      'reset:manual-refresh',
      'poll',
      'queue:manual-refresh',
    ]);
  });

  it('manual refresh does not short-circuit already current refresh target blocks', async () => {
    const calls: string[] = [];
    const subject = createSubject({
      isOpen: true,
      provider: {},
      refreshQuestionMetadata: jest.fn(async () => calls.push('metadata')),
      refreshQuestionResponses: jest.fn(async () => calls.push('responses')),
    });
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      refreshTargetQuestionBlock: 777,
      refreshTargetResponseBlock: 777,
      refreshTargetSurveyBlock: 777,
    };
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.resetLocalStoragePollingBackoff = jest.fn((reason) => calls.push(`reset:${reason}`));
    subject.pollLocalStorageForUpdates = jest.fn(() => {
      calls.push('poll');
      return false;
    });
    subject.queueResultsRefresh = jest.fn((reason) => calls.push(`queue:${reason}`));
    attachStateHarness(subject);
    jest
      .spyOn((contractScriptsModule as any).default, 'getLatestBlockNumber')
      .mockResolvedValue(777);

    await subject.handleManualRefresh();
    await flushMicrotasks();

    expect(subject.setState).toHaveBeenCalledWith(
      {
        refreshTargetQuestionBlock: 777,
        refreshTargetResponseBlock: 777,
        refreshTargetSurveyBlock: 777,
      },
      expect.any(Function)
    );
    expect(subject.props.refreshQuestionMetadata).toHaveBeenCalledTimes(1);
    expect(subject.props.refreshQuestionResponses).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      'metadata',
      'responses',
      'reset:manual-refresh',
      'poll',
      'queue:manual-refresh',
    ]);
  });
});

describe('SurveyResults modal and polling behavior', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('clears response parse memo when the modal closes', () => {
    const subject = createSubject({
      isOpen: false,
      preventUrlChange: true,
    });
    subject._isMounted = true;
    subject._responseParseMemo.set('payload', { answer: 'cached' });
    subject.stopLocalStoragePolling = jest.fn();
    subject.resetLocalStoragePollingBackoff = jest.fn();
    subject.updateLocalStoragePollingState = jest.fn();
    subject.queueResultsRefresh = jest.fn();
    subject.handleNonceTick = jest.fn();
    attachStateHarness(subject);

    const prevProps = { ...subject.props, isOpen: true };
    const prevState = { ...subject.state };
    subject.componentDidUpdate(prevProps, prevState);

    expect(subject._responseParseMemo.size).toBe(0);
  });

  it('keeps latest-block retries active when coarse polling signature is unchanged', () => {
    const subject = createSubject({
      isOpen: true,
      network: { id: 84532 },
    });

    const questionBucket: any = {
      questionsLatestBlock: 5,
      questionResponsesLatestBlock: 7,
      questions: { q1: { id: 'q1' } },
      questionResponses: {},
    };
    const surveyBucket: any = {
      surveyResponses: {},
      surveyResponsesLatestBlock: {},
    };

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'questionsCache') return { '84532': questionBucket };
      if (namespace === 'surveysCache') return { '84532': surveyBucket };
      return {};
    });

    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyId: '',
      networkLatestBlock: 0,
      questionLocalBlock: 5,
      responseLocalBlock: 7,
      surveyLocalBlock: 0,
      cachedQuestionsCount: 1,
      cachedSurveyResponsesCount: 0,
    };
    subject.maybeRefreshNetworkLatestBlockFromPolling = jest.fn();
    subject._lastPolledQuestionsRef = questionBucket.questions;
    subject._lastPolledSurveyResponsesRef = surveyBucket.surveyResponses;
    subject._lastPolledQuestionRefVersion = 2;
    subject._lastPolledSurveyResponsesRefVersion = 3;
    subject._lastLocalStoragePollCoarseSignature = 'questions||5|7|0|2|3';
    subject._lastLocalStoragePollDetailedSignature = 'questions||5|7|0|2|3|1|0|0';

    const changed = subject.pollLocalStorageForUpdates();

    expect(changed).toBe(false);
    expect(subject.maybeRefreshNetworkLatestBlockFromPolling).toHaveBeenCalledTimes(1);
    peekSpy.mockRestore();
  });

  it('detects in-place question count mutations on forced stable-cycle rescans', () => {
    const subject = attachStateHarness(createSubject({
      isOpen: true,
      network: { id: 84532 },
    }));

    const questionBucket: any = {
      questionsLatestBlock: 5,
      questionResponsesLatestBlock: 7,
      questions: { q1: { id: 'q1' } },
      questionResponses: {},
    };
    const surveyBucket: any = {
      surveyResponses: {},
      surveyResponsesLatestBlock: {},
    };

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'questionsCache') return { '84532': questionBucket };
      if (namespace === 'surveysCache') return { '84532': surveyBucket };
      return {};
    });

    subject.queueResultsRefresh = jest.fn();
    subject.maybeRefreshNetworkLatestBlockFromPolling = jest.fn();
    subject._isMounted = true;
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyId: '',
      networkLatestBlock: 0,
      questionLocalBlock: 5,
      responseLocalBlock: 7,
      surveyLocalBlock: 0,
      cachedQuestionsCount: 1,
      cachedSurveyResponsesCount: 0,
    };
    subject._lastPolledQuestionsRef = questionBucket.questions;
    subject._lastPolledSurveyResponsesRef = surveyBucket.surveyResponses;
    subject._lastPolledQuestionRefVersion = 2;
    subject._lastPolledSurveyResponsesRefVersion = 3;
    subject._localStoragePollingStableCycles = 6;
    subject._lastLocalStoragePollCoarseSignature = 'questions||5|7|0|2|3';
    subject._lastLocalStoragePollDetailedSignature = 'questions||5|7|0|2|3|1|0|0';

    questionBucket.questions.q2 = { id: 'q2' };
    const changed = subject.pollLocalStorageForUpdates();

    expect(changed).toBe(true);
    expect(subject.state.cachedQuestionsCount).toBe(2);
    expect(subject.queueResultsRefresh).toHaveBeenCalledWith('poll-local-storage-change');
    peekSpy.mockRestore();
  });

  it('resolves locked-response gate labels against each question session in aggregated results', () => {
    const gateSbt = '0x9999999999999999999999999999999999999999';
    const displaySpy = jest.spyOn(sbtDisplayNameUtils, 'resolveSbtDisplayLabel')
      .mockImplementation(({ preferredSlug, address }: any) => `${preferredSlug}:${address}`);

    const subject = createSubject({
      activeSessionSlug: 'edge',
      network: { id: 84532 },
      networkChainId: 84532,
    });
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
    };

    const details = subject.buildLockedGateDetails(
      [{ questionId: 'q2' }],
      {
        q2: {
          id: 'q2',
          sessionSlug: 'alpha',
          encryption: {
            enabled: true,
            gates: [{ label: 'Alpha Gate', sbtAddress: gateSbt }],
          },
        },
      }
    );

    expect(details).toEqual({
      gateDetails: [
        {
          address: gateSbt,
          label: `alpha:${gateSbt}`,
          href: buildSbtDetailPath(gateSbt, 'alpha'),
        },
      ],
      hasGenericGateMessage: false,
    });
    expect(displaySpy).toHaveBeenCalledWith(expect.objectContaining({
      address: gateSbt,
      preferredSlug: 'alpha',
      chainId: 84532,
      fallback: 'short',
    }));
  });

  it('coalesces queued results refreshes into one fetch request per tick', async () => {
    const subject = createSubject({
      isOpen: true,
      network: { id: 84532 },
    });
    subject._isMounted = true;
    subject.requestFetchResponses = jest.fn();
    subject.isDocumentHidden = jest.fn(() => true);

    subject.queueResultsRefresh('a');
    subject.queueResultsRefresh('b');
    subject.queueResultsRefresh('c');
    await Promise.resolve();

    expect(subject.requestFetchResponses).toHaveBeenCalledTimes(1);
  });

  it('drops queued RAF refresh when the results modal closes before frame flush', async () => {
    const subject = createSubject({
      isOpen: true,
      network: { id: 84532 },
    });
    const rafCallbacks: Array<(timestamp: number) => void> = [];
    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: any) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });

    subject._isMounted = true;
    subject.requestFetchResponses = jest.fn();
    subject.shouldUseAnimationFrameForRefreshCoalescing = jest.fn(() => true);

    subject.queueResultsRefresh('queued-while-open');
    await Promise.resolve();

    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(rafCallbacks).toHaveLength(1);

    subject.props = { ...subject.props, isOpen: false };
    rafCallbacks[0](0);

    expect(subject.requestFetchResponses).not.toHaveBeenCalled();
    expect(subject._queuedResultsRefreshReasons.size).toBe(0);
  });

  it('backs off polling from 2s to 4s to 12s and resets after a detected change', () => {
    const subject = createSubject({
      isOpen: true,
      network: { id: 84532 },
    });

    jest.useFakeTimers();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    let pollCount = 0;
    subject._isMounted = true;
    subject.isDocumentHidden = jest.fn(() => false);
    subject.pollLocalStorageForUpdates = jest.fn(() => {
      pollCount += 1;
      return pollCount === 3;
    });

    subject.startLocalStoragePolling();
    jest.advanceTimersByTime(2000);
    jest.advanceTimersByTime(4000);
    jest.advanceTimersByTime(12000);

    const delays = setTimeoutSpy.mock.calls.map((args) => Number(args[1]));
    expect(delays).toContain(2000);
    expect(delays).toContain(4000);
    expect(delays).toContain(12000);
    expect(delays[delays.length - 1]).toBe(2000);
  });
});
