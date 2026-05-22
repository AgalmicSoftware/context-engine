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
  buildSurveyResultsAggregatorPanelClassName,
  buildSurveyResultsMultichoiceOptionClassName,
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

describe('SurveyResults session resolution', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not rewrite route-owned results URLs on unmount', () => {
    const priorUrl = window.location.href;
    const pushStateSpy = jest.spyOn(window.history, 'pushState');
    try {
      window.history.replaceState({}, '', '/session/edge/questions/results');
      const subject = createSubject({
        activeSessionSlug: 'edge',
        isOpen: true,
        preventUrlChange: true,
        sessionSlug: 'edge',
        viewMode: 'questions',
      });
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
      };

      subject.componentWillUnmount();

      expect(pushStateSpy).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/session/edge/questions/results');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('removes the old SurveyResults session selector chrome while keeping header spacing intact', () => {
    const scssPath = path.join(__dirname, 'SurveyResults.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.modalHeader\s*{[\s\S]*position:\s*relative;[\s\S]*padding-right:\s*4\.5rem;/);
    expect(scss).toMatch(/\.modalHeader\s+:global\(\.close\)\s*(?:,[^{]*?)?\s*{[\s\S]*position:\s*absolute;[\s\S]*top:\s*0\.85rem;[\s\S]*right:\s*0\.85rem;[\s\S]*margin:\s*0;[\s\S]*padding:\s*0\.25rem;/);
    expect(scss).toMatch(/\.modalHeaderControls\s*{[\s\S]*margin-left:\s*auto;/);
    expect(scss).not.toMatch(/\.modalHeaderCornerActions\s*{/);
    expect(scss).not.toMatch(/\.sessionSelectorToggle\s*{/);
    expect(scss).not.toMatch(/\.sessionSelectorPopover\s*{/);
  });

  it('reads bookmarks cache using canonical explicit session aliases in the constructor', () => {
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      surveys: [],
      questions: ['q1'],
    });

    const subject = createSubject({ sessionSlug: 'DEBATE' });

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'DEBATE', { clone: false });
    expect(subject.state.bookmarkedQuestionIDs).toEqual(['q1']);
  });

  it('keeps explicit general aliases from falling through to survey-cache scans', () => {
    const listSpy = jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockReturnValue([
      {
        slug: 'edge',
        value: {
          '84532': {
            surveys: {
              'survey-1': { title: 'Edge survey' },
            },
          },
        },
      },
    ]);

    const subject = createSubject({ sessionSlug: 'general' });
    subject.state = {
      ...subject.state,
      surveyId: 'survey-1',
    };

    expect(subject.getEffectiveSlug()).toBe('');
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('keeps explicit non-general session slugs unresolved when no config exists', () => {
    const configSpy = jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug')
      .mockImplementation((slug) => {
        if (slug === 'rxc') return { slug: 'rxc', networkChainId: 84532 };
        return null;
      });

    const subject = createSubject({ sessionSlug: 'DEBATE' });

    expect(subject.getEffectiveSessionContext()).toMatchObject({
      sessionSlug: 'DEBATE',
      sessionConfig: null,
    });
    expect(configSpy).toHaveBeenCalledWith('DEBATE');
  });

  it('memoizes fallback slug scan and invalidates on surveys cache updates', () => {
    const entriesSpy = jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockReturnValue([
      {
        slug: 'edge',
        value: {
          '84532': {
            surveys: {
              '0xsurvey': { id: '0xsurvey' },
            },
          },
        },
      },
    ]);

    const subject = createSubject({
      questionResponsesNonce: 1,
      questionsCacheNonce: 2,
    });
    subject.state = {
      ...subject.state,
      surveyId: '0xSurvey',
    };

    const first = subject.getEffectiveSlug();
    const second = subject.getEffectiveSlug();

    expect(first).toBe('edge');
    expect(second).toBe('edge');
    expect(entriesSpy).toHaveBeenCalledTimes(1);
    expect(entriesSpy).toHaveBeenCalledWith('surveysCache', { cloneValues: false });

    subject.props = {
      ...subject.props,
      questionResponsesNonce: 2,
    };
    const third = subject.getEffectiveSlug();

    expect(third).toBe('edge');
    expect(entriesSpy).toHaveBeenCalledTimes(2);

    subject.handleManagedCacheUpdate({ namespace: 'surveysCache', slug: 'edge', action: 'write' });
    const fourth = subject.getEffectiveSlug();

    expect(fourth).toBe('edge');
    expect(entriesSpy).toHaveBeenCalledTimes(3);
  });

  it('fans out question reads across list scope on /session routes', () => {
    const scope = resolveSurveyResultsQuestionReadScope({
      pathname: '/session/edge/questions/results',
      search: '',
      activeSessionSlug: 'edge',
      viewMode: 'questions',
      readSessionScanScope: () => 'list',
      readSessionScanSlugs: () => ['edge', 'alpha'],
    });

    expect(scope.baseSlug).toBe('edge');
    expect(scope.questionReadSlugs).toEqual(['edge', 'alpha']);
    expect(scope.storageKeyPrefix).toBe('dg:filters:__scope__:alpha|edge');
  });

  it('keeps explicit query session pins scoped to one session in question results', () => {
    const scope = resolveSurveyResultsQuestionReadScope({
      pathname: '/questions/results',
      search: '?session=edge',
      activeSessionSlug: 'edge',
      viewMode: 'questions',
      readSessionScanScope: () => 'list',
      readSessionScanSlugs: () => ['edge', 'alpha'],
    });

    expect(scope.baseSlug).toBe('edge');
    expect(scope.questionReadSlugs).toEqual(['edge']);
    expect(scope.storageKeyPrefix).toBe('dg:filters:edge');
  });

  it('keeps pinned question results scoped to the current session even when global list scope includes more sessions', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge/questions/results');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha']);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        if (slug === 'edge') {
          return {
            '84532': {
              questions: { q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' } },
              questionResponses: { q1: { '0xedge': { answer: { value: 'edge', encrypted: false } } } },
            },
          };
        }
        if (slug === 'alpha') {
          return {
            '84532': {
              questions: { q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' } },
              questionResponses: { q2: { '0xalpha': { answer: { value: 'alpha', encrypted: false } } } },
            },
          };
        }
        return {};
      });

      const subject = createSubject({
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
        sessionSlugPinned: true,
        isOpen: true,
        viewMode: 'questions',
      });
      subject._isMounted = true;
      subject.questionFilterRef = { current: { handleApplyFilters: jest.fn() } };
      subject.setState = jest.fn((next, cb) => {
        const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
        subject.state = { ...subject.state, ...(patch || {}) };
        if (typeof cb === 'function') cb();
        return patch;
      });
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
      };

      await subject.fetchQuestionModeResponses();
      expect(subject.getQuestionReadSlugs('questions')).toEqual(['edge']);
      expect(Object.keys(subject.state.aggregatorQuestionResponses).sort()).toEqual(['q1']);
      expect(findElement(
        subject.render(),
        (node) => node?.props?.['data-testid'] === 'ce-surveyresults-session-selector-toggle'
      )).toBeNull();
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('keeps explicit query-pinned question results scoped to authoritative question bindings only', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions/results?session=demo');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo', 'alpha']);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        if (slug !== 'demo') return {};
        return {
          '84532': {
            questions: {
              qDemo: {
                id: 'qDemo',
                prompt: 'Demo question',
                type: 'freeform',
                sessionSlug: 'demo',
                sessionSlugExplicit: true,
              },
              qLeakedExplicit: {
                id: 'qLeakedExplicit',
                prompt: 'Wrong session question',
                type: 'freeform',
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
              },
              qLeakedLegacy: {
                id: 'qLeakedLegacy',
                prompt: 'Legacy leaked question',
                type: 'freeform',
                sessionSlug: 'demo',
              },
            },
            questionResponses: {
              qDemo: {
                '0xdemo': { answer: { value: 'demo', encrypted: false } },
              },
              qLeakedExplicit: {
                '0xalpha': { answer: { value: 'alpha', encrypted: false } },
              },
              qLeakedLegacy: {
                '0xlegacy': { answer: { value: 'legacy', encrypted: false } },
              },
            },
          },
        };
      });

      const subject = createSubject({
        sessionSlug: 'demo',
        activeSessionSlug: 'demo',
        sessionSlugPinned: true,
        isOpen: true,
        viewMode: 'questions',
      });
      subject._isMounted = true;
      subject.questionFilterRef = { current: { handleApplyFilters: jest.fn() } };
      subject.setState = jest.fn((next, cb) => {
        const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
        subject.state = { ...subject.state, ...(patch || {}) };
        if (typeof cb === 'function') cb();
        return patch;
      });
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
      };

      await subject.fetchQuestionModeResponses();

      expect(Object.keys(subject.state.aggregatorQuestionResponses)).toEqual(['qdemo']);
      expect(Object.keys(subject.state.questionResponses)).toEqual(['qdemo']);
      expect(subject.state.totalQuestionsCount).toBe(1);
      expect(subject.state.totalResponsesCount).toBe(1);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('keeps embedded pinned session results on legacy bucket-backed questions while excluding explicit cross-session leaks', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions/results?session=demo');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo', 'alpha']);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        if (slug !== 'demo') return {};
        return {
          '84532': {
            questions: {
              qLegacy: {
                id: 'qLegacy',
                prompt: 'Legacy demo question',
                type: 'freeform',
                sessionSlug: 'demo',
              },
              qLeakedExplicit: {
                id: 'qLeakedExplicit',
                prompt: 'Wrong session question',
                type: 'freeform',
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
              },
            },
            questionResponses: {
              qLegacy: {
                '0xdemo': { answer: { value: 'demo', encrypted: false } },
              },
              qLeakedExplicit: {
                '0xalpha': { answer: { value: 'alpha', encrypted: false } },
              },
            },
          },
        };
      });

      const subject = createSubject({
        sessionSlug: 'demo',
        activeSessionSlug: 'demo',
        sessionSlugPinned: true,
        preventUrlChange: true,
        isOpen: true,
        viewMode: 'questions',
      });
      subject._isMounted = true;
      subject.questionFilterRef = { current: { handleApplyFilters: jest.fn() } };
      subject.setState = jest.fn((next, cb) => {
        const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
        subject.state = { ...subject.state, ...(patch || {}) };
        if (typeof cb === 'function') cb();
        return patch;
      });
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
      };

      await subject.fetchQuestionModeResponses();

      expect(Object.keys(subject.state.aggregatorQuestionResponses)).toEqual(['qlegacy']);
      expect(Object.keys(subject.state.questionResponses)).toEqual(['qlegacy']);
      expect(subject.state.totalQuestionsCount).toBe(1);
      expect(subject.state.totalResponsesCount).toBe(1);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('resets stale filtered question counts when unfiltered question results refresh', async () => {
    const subject = attachStateHarness(createSubject({
      isOpen: true,
      viewMode: 'questions',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      isFilterActive: false,
      filteredQuestionsCount: 42,
      filteredResponsesCount: 9,
      questionResultsHydrated: false,
    };
    subject.getScopedQuestionNetworkData = jest.fn().mockResolvedValue({
      questions: {},
      questionResponses: {},
    });

    await subject.fetchQuestionModeResponses();

    expect(subject.state.totalQuestionsCount).toBe(0);
    expect(subject.state.totalResponsesCount).toBe(0);
    expect(subject.state.filteredQuestionsCount).toBe(0);
    expect(subject.state.filteredResponsesCount).toBe(0);
    expect(subject.state.questionResultsHydrated).toBe(true);
  });

  it('aggregates question-mode reads across list scope on /session routes', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);

      const questionCachesBySlug: Record<string, any> = {
        edge: {
          '84532': {
            questionsLatestBlock: 11,
            questionResponsesLatestBlock: 12,
            questions: {
              q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' },
            },
            questionResponses: {
              q1: {
                '0xedge': { answer: { value: 'edge', encrypted: false } },
              },
            },
          },
        },
        alpha: {
          '84532': {
            questionsLatestBlock: 21,
            questionResponsesLatestBlock: 22,
            questions: {
              q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' },
            },
            questionResponses: {
              q2: {
                '0xalpha': { answer: { value: 'alpha', encrypted: false } },
              },
            },
          },
        },
        beta: {
          '84532': {
            questionsLatestBlock: 31,
            questionResponsesLatestBlock: 32,
            questions: {
              q3: { id: 'q3', prompt: 'Beta 3', type: 'freeform' },
            },
            questionResponses: {
              q3: {
                '0xbeta': { answer: { value: 'beta', encrypted: false } },
              },
            },
          },
        },
      };

      const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        return questionCachesBySlug[String(slug)] || {};
      });

      const subject = createSubject({
        activeSessionSlug: 'edge',
        isQuestionCacheReady: true,
        isResponsesCacheReady: true,
      });
      attachStateHarness(subject);
      subject.questionFilterRef = { current: { handleApplyFilters: jest.fn() } };
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
      };

      await subject.fetchQuestionModeResponses();

      expect(Object.keys(subject.state.aggregatorQuestionResponses).sort()).toEqual(['q1', 'q2', 'q3']);
      expect(Object.keys(subject.state.questionResponses).sort()).toEqual(['q1', 'q2', 'q3']);
      expect(subject.state.totalQuestionsCount).toBe(3);
      expect(subject.state.totalResponsesCount).toBe(3);
      expect(subject.getNetworkQuestionsForCurrentContext()).toMatchObject({
        q1: expect.objectContaining({ sessionSlug: 'edge', prompt: 'Edge 1' }),
        q2: expect.objectContaining({ sessionSlug: 'alpha', prompt: 'Alpha 2' }),
        q3: expect.objectContaining({ sessionSlug: 'beta', prompt: 'Beta 3' }),
      });
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('passes the list-scope results filter storage bucket on aggregated /session question results', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        if (slug === 'edge') {
          return {
            '84532': {
              questions: {
                q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' },
              },
              questionResponses: {},
            },
          };
        }
        if (slug === 'alpha') {
          return {
            '84532': {
              questions: {
                q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' },
              },
              questionResponses: {},
            },
          };
        }
        if (slug === 'beta') {
          return {
            '84532': {
              questions: {
                q3: { id: 'q3', prompt: 'Beta 3', type: 'freeform' },
              },
              questionResponses: {},
            },
          };
        }
        return {};
      });

      const subject = createSubject({
        activeSessionSlug: 'edge',
        isOpen: true,
        isQuestionCacheReady: true,
        isResponsesCacheReady: true,
      });
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
        showQuestionFilter: true,
        questionResponses: {
          q2: {
            '0xalpha': { answer: { value: 'alpha', encrypted: false } },
          },
        },
        aggregatorQuestionResponses: {
          q2: [
            {
              responder: '0xalpha',
              questionId: 'q2',
              response: { answer: { value: 'alpha', encrypted: false } },
            },
          ],
        },
        sbtFilteredAggregatorQuestionResponses: {
          q2: [
            {
              responder: '0xalpha',
              questionId: 'q2',
              response: { answer: { value: 'alpha', encrypted: false } },
            },
          ],
        },
        totalQuestionsCount: 1,
        totalResponsesCount: 1,
      };

      const tree = subject.render();
      const questionFilterNode = findElement(
        tree,
        (node) =>
          node?.props?.resultsMode === true &&
          node?.props?.onFilter === subject.handleQuestionFilter
      );

      expect(questionFilterNode?.props?.storageKeyPrefix).toBe('dg:filters:__scope__:alpha|beta|edge');
      expect(questionFilterNode?.props?.questions).toEqual([
        expect.objectContaining({
          id: 'q2',
          prompt: 'Alpha 2',
          sessionSlug: 'alpha',
        }),
      ]);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('hydrates question results from cache before latest-block lookups resolve', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions/results?session=demo');
    try {
      let resolveLatestBlock: ((value: number) => void) | null = null;
      const latestBlockPromise = new Promise<number>((resolve) => {
        resolveLatestBlock = resolve;
      });
      jest.spyOn(contractScriptsModule.default, 'getLatestBlockNumber')
        .mockReturnValue(latestBlockPromise);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        if (slug !== 'demo') return {};
        return {
          '84532': {
            questions: {
              qLegacy: {
                id: 'qLegacy',
                prompt: 'Legacy demo question',
                type: 'freeform',
                sessionSlug: 'demo',
              },
            },
            questionResponses: {
              qLegacy: {
                '0xdemo': { answer: { value: 'demo', encrypted: false } },
              },
            },
          },
        };
      });

      const subject = createSubject({
        sessionSlug: 'demo',
        activeSessionSlug: 'demo',
        sessionSlugPinned: true,
        preventUrlChange: true,
        isOpen: true,
        viewMode: 'questions',
      });
      subject._isMounted = true;
      subject.questionFilterRef = { current: { handleApplyFilters: jest.fn() } };
      subject.setState = jest.fn((next, cb) => {
        const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
        subject.state = { ...subject.state, ...(patch || {}) };
        if (typeof cb === 'function') cb();
        return patch;
      });
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
      };

      const fetchPromise = subject.fetchResponses();
      const raceResult = await Promise.race([
        fetchPromise.then(() => 'fetch-complete'),
        new Promise((resolve) => setTimeout(() => resolve('still-waiting'), 0)),
      ]);

      expect(raceResult).toBe('fetch-complete');
      expect(subject.state.totalQuestionsCount).toBe(1);
      expect(subject.state.totalResponsesCount).toBe(1);
      expect(subject.state.networkLatestBlock).toBe(0);

      (resolveLatestBlock as any)?.(12345);
      await Promise.resolve();
      await Promise.resolve();

      expect(subject.state.networkLatestBlock).toBe(12345);
      await fetchPromise;
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('clears stale question results when the base session changes under global list scope', () => {
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);

    const subject = createSubject({
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
      isOpen: true,
      viewMode: 'questions',
    });
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.queueResultsRefresh = jest.fn();
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      questionResponses: {
        q1: { '0xedge': { answer: { value: 'edge', encrypted: false } } },
      },
      aggregatorQuestionResponses: {
        q1: [{ responder: '0xedge', questionId: 'q1', response: { answer: { value: 'edge', encrypted: false } } }],
      },
      sbtFilteredAggregatorQuestionResponses: {
        q1: [{ responder: '0xedge', questionId: 'q1', response: { answer: { value: 'edge', encrypted: false } } }],
      },
      totalQuestionsCount: 1,
      totalResponsesCount: 1,
      filteredResponsesCount: 1,
      filteredQuestionsCount: 1,
    };

    const prevProps = subject.props;
    const prevState = { ...subject.state };
    subject.props = {
      ...subject.props,
      sessionSlug: 'beta',
      activeSessionSlug: 'beta',
    };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.state.questionResponses).toEqual({});
    expect(subject.state.aggregatorQuestionResponses).toEqual({});
    expect(subject.state.sbtFilteredAggregatorQuestionResponses).toEqual({});
    expect(subject.state.totalQuestionsCount).toBe(0);
    expect(subject.state.totalResponsesCount).toBe(0);
    expect(subject.state.filteredResponsesCount).toBe(0);
    expect(subject.state.filteredQuestionsCount).toBe(0);
    expect(subject.getQuestionReadSlugs('questions')).toEqual(['beta']);
    expect(subject.queueResultsRefresh).toHaveBeenCalledWith(expect.stringContaining('question-scope-change'));
  });

  it('does not render a SurveyResults session selector', () => {
    const subject = createSubject({
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
      isOpen: true,
      viewMode: 'questions',
    });
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
    };

    const tree = subject.render();
    const selectorToggle = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-surveyresults-session-selector-toggle'
    );
    const selectorPanel = findElement(
      tree,
      (node) => node?.props?.['data-testid'] === 'ce-surveyresults-session-selector-panel'
    );

    expect(selectorToggle).toBeNull();
    expect(selectorPanel).toBeNull();
  });

  it('does not render question-results corner actions for a removed session selector', () => {
    const subject = createSubject({
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      sessionSlugPinned: true,
      isOpen: true,
      viewMode: 'questions',
    });
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
    };

    const tree = subject.render();
    const controls = findElement(
      tree,
      (node) => typeof node?.props?.className === 'string' && node.props.className.includes('modalHeaderControls')
    );
    const cornerActions = findElement(
      tree,
      (node) => typeof node?.props?.className === 'string' && node.props.className.includes('modalHeaderCornerActions')
    );
    const syncStatus = findElement(
      controls,
      (child) => typeof child?.props?.className === 'string' && child.props.className.includes('syncStatusContainer')
    );
    const selectorInControls = findElement(
      controls,
      (child) => child?.props?.['data-testid'] === 'ce-surveyresults-session-selector'
    );

    expect(syncStatus).toBeTruthy();
    expect(selectorInControls).toBeNull();
    expect(cornerActions).toBeNull();
  });

  it('canonicalizes survey display links for reserved session aliases', () => {
    const responder = '0x1111111111111111111111111111111111111111';
    const collectSurveyLinks = (sessionSlug: string) => {
      const subject = createSubject({ sessionSlug, isOpen: true, viewMode: 'survey' });
      subject.state = {
        ...subject.state,
        viewMode: 'survey',
        surveyViewMode: 'individuals',
        surveyId: '0xSurvey',
        surveyTitle: 'Session Survey',
        sbtFilteredResponses: [
          {
            responder,
            response: { responses: [] },
          },
        ],
        bookmarkedSurveyIDs: [],
        bookmarkedQuestionIDs: [],
      };

      return collectTreeNodes(
        subject.render(),
        (node) => node?.type === 'a' && typeof node?.props?.href === 'string' && node.props.href.startsWith('/survey/')
      ).map((node) => node.props.href);
    };

    const debateLinks = collectSurveyLinks('DEBATE');
    expect(debateLinks).toContain('/survey/0xSurvey?session=DEBATE');
    expect(debateLinks).toContain(`/survey/0xSurvey/${responder}?session=DEBATE`);
    expect(debateLinks).not.toContain('/survey/0xSurvey?session=rxc');
    expect(debateLinks).not.toContain(`/survey/0xSurvey/${responder}?session=rxc`);

    const generalLinks = collectSurveyLinks('general');
    expect(generalLinks).toContain('/survey/0xSurvey');
    expect(generalLinks).toContain(`/survey/0xSurvey/${responder}`);
    expect(generalLinks).not.toContain('/survey/0xSurvey?session=general');
    expect(generalLinks).not.toContain(`/survey/0xSurvey/${responder}?session=general`);
  });

  it('does not inherit the general session config for unknown non-general slugs', () => {
    const configSpy = jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug')
      .mockImplementation((slug) => {
        if (slug === '') return { slug: '', networkChainId: 84532 };
        return null;
      });

    const subject = createSubject({ sessionSlug: 'missing-session-slug' });

    expect(subject.getEffectiveSessionContext()).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
    });
    expect(configSpy).toHaveBeenCalledWith('missing-session-slug');
    expect(configSpy).not.toHaveBeenCalledWith('');
  });
});
