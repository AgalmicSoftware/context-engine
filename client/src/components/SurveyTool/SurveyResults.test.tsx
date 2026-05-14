// Remaining broad SurveyResults coverage owns pure count helpers and display-helper constants.
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

describe('countQuestionModeResponses', () => {
  it('excludes blank freeform responses from question-mode totals', () => {
    const aggregatorByQuestion = {
      Q1: [
        { response: { answer: { value: '   ' } } },
        { response: { answer: { value: 'Visible freeform answer' } } },
      ],
    };
    const questionLookup = {
      q1: { type: 'freeform' },
    };

    expect(countQuestionModeResponses(aggregatorByQuestion, questionLookup)).toBe(1);
  });

  it('keeps blank responses for non-freeform question types', () => {
    const aggregatorByQuestion = {
      q2: [
        { response: { answer: { value: '   ' } } },
        { response: { answer: { value: 'Agree' } } },
      ],
    };
    const questionLookup = {
      q2: { type: 'binary' },
    };

    expect(countQuestionModeResponses(aggregatorByQuestion, questionLookup)).toBe(2);
  });
});

describe('hasAnyCountableSurveyAnswer', () => {
  it('returns false for freeform responses that are only blank answers', () => {
    const parsedSurveyResponse = {
      responses: [
        { questionID: 'q1', answer: { value: '   ' } },
      ],
    };
    const questionLookup = {
      q1: { type: 'freeform' },
    };

    expect(hasAnyCountableSurveyAnswer(parsedSurveyResponse, questionLookup)).toBe(false);
  });

  it('keeps encrypted placeholders countable for freeform answers', () => {
    const parsedSurveyResponse = {
      responses: [
        { questionID: 'q1', answer: { value: '*', encrypted: true } },
      ],
    };
    const questionLookup = {
      q1: { type: 'freeform' },
    };

    expect(hasAnyCountableSurveyAnswer(parsedSurveyResponse, questionLookup)).toBe(true);
  });

  it('treats answers as countable when question metadata is unavailable', () => {
    const parsedSurveyResponse = {
      responses: [
        { questionID: 'q1', answer: { value: '   ' } },
      ],
    };

    expect(hasAnyCountableSurveyAnswer(parsedSurveyResponse, {})).toBe(true);
  });
});

describe('SurveyResults display helpers', () => {
  it('builds aggregator classes and table icon styles', () => {
    expect(SURVEY_RESULTS_CLICKABLE_ICON_STYLE).toEqual({ cursor: 'pointer' });
    expect(SURVEY_RESULTS_METADATA_MISSING_STYLE).toEqual({
      fontStyle: 'italic',
      color: '#bbb',
      padding: '1rem',
    });
    expect(SURVEY_RESULTS_TABLE_CELL_STYLE).toEqual({ textAlign: 'center' });
    expect(SURVEY_RESULTS_SORTABLE_HEADER_STYLE).toEqual({
      textAlign: 'center',
      cursor: 'pointer',
    });
    expect(SURVEY_RESULTS_TABLE_BOOKMARK_STYLE).toEqual({
      marginRight: '6px',
      cursor: 'pointer',
    });
    expect(SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE).toEqual({ marginLeft: '6px' });
    expect(SURVEY_RESULTS_SURVEY_BOOKMARK_STYLE).toEqual({
      marginLeft: '8px',
      cursor: 'pointer',
    });
    expect(SURVEY_RESULTS_DOCUMENT_LINK_ICON_STYLE).toEqual({ marginRight: 4 });
    expect(SURVEY_RESULTS_MINI_BAR_SPINNER_STYLE).toEqual({ marginRight: '6px' });
    expect(SURVEY_RESULTS_MINI_PROGRESS_STYLE).toEqual({ minWidth: '100px' });
    expect(SURVEY_RESULTS_TRAILING_LABEL_STYLE).toEqual({ marginLeft: '10px' });
    expect(buildSurveyResultsAggregatorPanelClassName(styles)).toBe(
      `${styles.surveyResultsAggregatorPanel} ${styles.surveyResultsAggregatorText}`
    );
    expect(buildSurveyResultsMultichoiceOptionClassName(styles)).toBe(
      `${styles.surveyResultsFreeformAnswer} ${styles.surveyResultsMultichoiceOption}`
    );
    expect(resolveSurveyResultsSyncDetailsStyle(true)).toEqual({ display: 'block' });
    expect(resolveSurveyResultsSyncDetailsStyle(false)).toEqual({ display: undefined });
    expect(resolveSurveyResultsToggleKnobStyle(true)).toEqual({
      left: '31px',
      backgroundColor: '#4caf50',
    });
    expect(resolveSurveyResultsToggleKnobStyle(false)).toEqual({
      left: '1px',
      backgroundColor: '#fff',
    });
  });
});

describe('SurveyResults session resolution', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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

describe('SurveyResults locked responses banner', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a compact locked-response toggle while details stay collapsed by default', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      lockedResponsesDecrypting: false,
      lockedResponseDetailsOpen: false,
    };

    const toggle = subject.renderLockedResponsesToggle({
      lockedCount: 6,
      gateDetails: [
        {
          address: '0x1111111111111111111111111111111111111111',
          href: 'https://example.com/sbt/0x1111111111111111111111111111111111111111',
          label: 'Session Access Pass',
        },
      ],
    });
    const detailCard = subject.renderLockedResponsesBanner({
      lockedCount: 6,
      gateDetails: [],
    });

    const summaryToggle = findElement(
      toggle,
      (element) => element?.props?.['data-testid'] === 'ce-results-locked-toggle'
    );

    expect(summaryToggle).toBeTruthy();
    expect(summaryToggle.props['aria-label']).toBe('Show 6 locked responses');
    expect(summaryToggle.props['aria-expanded']).toBe(false);
    expect(treeHasText(summaryToggle, '6')).toBe(true);
    expect(detailCard).toBeNull();
  });

  it('shows gate links and decrypt controls when expanded', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      lockedResponsesDecrypting: false,
      lockedResponseDetailsOpen: true,
    };

    const tree = subject.renderLockedResponsesBanner({
      lockedCount: 2,
      gateDetails: [
        {
          address: '0x2222222222222222222222222222222222222222',
          href: 'https://example.com/sbt/0x2222222222222222222222222222222222222222',
          label: 'Contributor SBT',
        },
      ],
    });
    const decryptButton = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === 'ce-results-decrypt-btn'
    );
    const gateLink = findElement(
      tree,
      (element) => element?.type === 'a' && element?.props?.href === 'https://example.com/sbt/0x2222222222222222222222222222222222222222'
    );
    const markup = renderToStaticMarkup(tree);

    expect(decryptButton).toBeTruthy();
    expect(treeHasText(decryptButton, 'Decrypt')).toBe(true);
    expect(treeHasText(tree, 'Locked Responses')).toBe(true);
    expect(treeHasText(tree, '2')).toBe(true);
    expect(treeHasText(tree, 'Contributor SBT')).toBe(true);
    expect(markup).toContain('Required Group for decryption');
    expect(gateLink).toBeTruthy();
  });

  it('resolves SBT details from configured session gates before falling back to generic copy', () => {
    const subject = createSubject({
      network: { id: 84532 },
    });
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');

    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue({
      sponsored: {
        resources: {
          questionResponses: { gateId: 'contributors' },
          default: { gateId: 'contributors' },
        },
        gates: {
          contributors: {
            label: 'Contributor Access',
            sbtAddresses: ['0x1111111111111111111111111111111111111111'],
          },
        },
      },
    });
    jest.spyOn(sbtDisplayNameUtils, 'resolveSbtDisplayLabel').mockReturnValue('Contributor Pass');

    const model = subject.buildLockedGateDetails(
      [
        { questionId: 'q1' },
      ],
      {
        q1: {
          encryption: {
            enabled: true,
            gate: {
              gateId: 'contributors',
              resourceKey: 'questionResponses',
            },
          },
        },
      }
    );

    expect(model.hasGenericGateMessage).toBe(false);
    expect(model.gateDetails).toEqual([
      expect.objectContaining({
        address: '0x1111111111111111111111111111111111111111',
        label: 'Contributor Pass',
        href: buildSbtDetailPath('0x1111111111111111111111111111111111111111', 'session-slug'),
      }),
    ]);
  });

  it('can resolve named SBT links from gate sbt objects when address arrays are absent', () => {
    const subject = createSubject({
      network: { id: 84532 },
    });
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');

    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue({
      sponsored: {
        gates: {
          contributors: {
            sbts: [
              {
                address: '0x3333333333333333333333333333333333333333',
                name: 'Contributor Pass',
              },
            ],
          },
        },
      },
    });
    jest.spyOn(sbtDisplayNameUtils, 'resolveSbtDisplayLabel').mockReturnValue('');

    const model = subject.buildLockedGateDetails(
      [
        { questionId: 'q1' },
      ],
      {
        q1: {
          encryption: {
            enabled: true,
            gate: {
              gateId: 'contributors',
              resourceKey: 'questionResponses',
            },
          },
        },
      }
    );

    expect(model.hasGenericGateMessage).toBe(false);
    expect(model.gateDetails).toEqual([
      expect.objectContaining({
        address: '0x3333333333333333333333333333333333333333',
        label: 'Contributor Pass',
        href: buildSbtDetailPath('0x3333333333333333333333333333333333333333', 'session-slug'),
      }),
    ]);
  });

  it('does not show the generic decrypt message when named gate details are available', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      lockedResponseDetailsOpen: true,
    };

    const tree = subject.renderLockedResponsesBanner({
      lockedCount: 1,
      gateDetails: [
        {
          address: '0x1111111111111111111111111111111111111111',
          href: `${sbtBasePath()}/0x1111111111111111111111111111111111111111`,
          label: 'Contributor Pass',
        },
      ],
      hasGenericGateMessage: true,
    });

    expect(treeHasText(tree, 'Contributor Pass')).toBe(true);
    expect(treeHasText(tree, 'Locked responses require an eligible group. Connect an eligible account to decrypt.')).toBe(false);
  });

  it('uses terminology-aware generic decrypt messaging when gate details are unavailable', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      lockedResponseDetailsOpen: true,
    };

    const tree = subject.renderLockedResponsesBanner({
      lockedCount: 1,
      gateDetails: [],
      hasGenericGateMessage: true,
    });

    expect(treeHasText(tree, 'Locked responses require an eligible group. Connect an eligible account to decrypt.')).toBe(true);
  });

  it('uses terminology-aware decrypt failure alerts when locked responses stay encrypted', async () => {
    const subject = createSubject({
      loginComplete: true,
      account: '0xabc',
      provider: 'mock-provider',
    });
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({}));
    subject.getMemoizedLockedResponsesModel = jest.fn(() => ({
      lockedRows: [{
        key: 'row-1',
        response: { answer: {} },
        mergedResponse: { answer: { locked: true } },
      }],
    }));
    subject.decryptFieldValue = jest.fn().mockResolvedValue({ ok: false });

    await subject.handleDecryptLockedResponses();

    expect(subject.state.alertMessage).toBe('Unable to decrypt locked responses with the connected account.');
  });

  it('skips the locked banner model for self-encrypted responses without gate access rules', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
    });
    subject.getEffectiveSlug = jest.fn(() => '');
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyViewMode: 'aggregate',
      sbtFilteredResponses: [],
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xabc',
            response: {
              questionID: 'q1',
              answer: {
                value: '*',
                encrypted: true,
                encryptionAudience: 'self',
              },
            },
          },
        ],
      },
    };

    const model = subject.getMemoizedLockedResponsesModel({
      q1: { id: 'q1', type: 'freeform', encryption: { enabled: false } },
    });

    expect(model.lockedCount).toBe(0);
    expect(model.lockedRows).toEqual([]);
    expect(model.gateDetails).toEqual([]);
    expect(model.hasGenericGateMessage).toBe(false);
  });

});

describe('SurveyResults module styles', () => {
  it('keeps the results modal light while giving the locked banner its own dark high-contrast card', () => {
    const scssPath = path.join(__dirname, 'SurveyResults.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.resultsModal\s*{[\s\S]*?background-color:\s*var\(--ce-color-white\);/);
    expect(scss).toMatch(/\.modalBody\s*{[\s\S]*?color:\s*var\(--ce-color-black\) !important;/);
    expect(scss).toMatch(/\.surveyDocUrlLink\s*{[\s\S]*?background:\s*rgba\(26,\s*115,\s*232,\s*0\.08\);[\s\S]*?color:\s*#174ea6;/);
    expect(scss).toMatch(/\.aggregatorSummaryCard\s*{[\s\S]*?background-color:\s*var\(--ce-color-surface\) !important;/);
    expect(scss).not.toMatch(/\.aggregatorSummaryCard\s*{[\s\S]*?background-color:\s*#dce3f7 !important;/);
    expect(scss).toMatch(/\.surveyResultsResponseCard\s*{[\s\S]*?background:\s*rgba\(50,\s*56,\s*117,\s*0\.96\) !important;/);
    expect(scss).toMatch(/\.surveyResultsResponseCardBody\s*{[\s\S]*?padding:\s*0 !important;/);
    expect(scss).toMatch(/\.surveyResultsAggregatorPanel\s*{[\s\S]*?background:\s*rgba\(30,\s*36,\s*94,\s*0\.92\);/);
    expect(scss).toMatch(/\.lockedBanner\s*{[\s\S]*?background:\s*rgba\(23,\s*25,\s*65,\s*0\.96\);[\s\S]*?border-left:\s*4px solid rgba\(77,\s*255,\s*164,\s*0\.7\);[\s\S]*?color:\s*(?:var\(--ce-color-panel-text\)|#f4f7ff);/);
    expect(scss).toMatch(/\.lockedBannerCaret\s*{[\s\S]*?margin:\s*8px 0 0 auto;[\s\S]*?padding:\s*0;/);
    expect(scss).toMatch(/\.lockedBannerDetails\s*{[\s\S]*?border-top:\s*1px solid rgba\(255,\s*255,\s*255,\s*0\.12\);/);
    expect(scss).not.toMatch(/\.filterSummaryBox\s*{[\s\S]*?background:\s*rgba\(10,\s*14,\s*43,\s*0\.82\);/);
  });

  it('keeps survey-results controls readable on the light modal surface', () => {
    const scssPath = path.join(__dirname, 'SurveyResults.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.toggleLabel\s*{[\s\S]*?color:\s*#1f2733;/);
    expect(scss).toMatch(/\.exportAndFilterContainer\s*{[\s\S]*?background:\s*#f3f5f9;/);
    expect(scss).toMatch(/#questionFilterButton\s*{[\s\S]*?background-color:\s*#1f2733 !important;[\s\S]*?color:\s*#f8fafc !important;/);
    expect(scss).toMatch(/\.filterSummaryBox\s*{[\s\S]*?color:\s*#4b5563;/);
    expect(scss).toMatch(/\.demoResultsAtlasSurface,\s*\.demoResultsRiskMatrixSurface\s*{[\s\S]*?padding:\s*1rem;/);
    expect(scss).toMatch(/\.demoResultsAtlasSurface,\s*\.demoResultsRiskMatrixSurface\s*{[\s\S]*?border:\s*1px solid rgba\(19,\s*34,\s*86,\s*0\.2\);/);
    expect(scss).toMatch(/\.demoResultsAtlasSurface\s*{[^}]*background:\s*[^;]*linear-gradient\(180deg,[^;]*rgba\(21,\s*31,\s*74,\s*0\.98\)[^;]*rgba\(8,\s*12,\s*28,\s*0\.995\)[^;]*;/);
    expect(scss).not.toMatch(/\.demoResultsAtlasSurface\s*{[^}]*radial-gradient\(circle at top/);
    expect(scss).toMatch(/\.demoResultsRiskMatrixSurface\s*{[^}]*background:\s*[^;]*linear-gradient\(180deg,[^;]*rgba\(23,\s*25,\s*65,\s*0\.98\)[^;]*rgba\(9,\s*13,\s*30,\s*0\.995\)[^;]*;/);
  });
});

describe('SurveyResults survey-mode source signature', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('changes survey source signature when question-cache readiness changes', async () => {
    const surveyId = 'survey-id-1';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Survey One',
            questionIDs: ['q1'],
          },
        },
        surveysLatestBlock: 4,
        surveyResponsesLatestBlock: {
          [surveyId]: 5,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              responses: [
                { questionID: 'q1', answer: { value: 'A visible answer' } },
              ],
            },
          },
        },
      },
    };

    const subject = createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: false,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);
    subject.setState = jest.fn();

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();
    const notReadySignature = subject._surveyModeSourceCoarseSignature;
    expect(notReadySignature.split('::')[3]).toBe('0');

    subject.props = {
      ...subject.props,
      isQuestionCacheReady: true,
    };

    await subject.fetchSurveyModeResponses();
    const readySignature = subject._surveyModeSourceCoarseSignature;
    expect(readySignature.split('::')[3]).toBe('1');
    expect(readySignature).not.toBe(notReadySignature);
  });

  it('parses each survey responder payload once while building survey-mode views', async () => {
    const surveyId = 'survey-parse-once';
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Perf Survey',
            questionIDs: ['q1', 'q2'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            '0xAa': JSON.stringify({
              timeStamp: 10,
              responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
            }),
            '0xBb': JSON.stringify({
              timeStamp: 20,
              responses: [
                { questionID: 'q1', answer: { value: 'b1' } },
                { questionID: 'q2', answer: { value: 'b2' } },
              ],
            }),
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 7 },
        surveysLatestBlock: 9,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = createSubject({
      provider: {},
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    attachStateHarness(subject);
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).toHaveBeenCalledTimes(2);
    expect(subject.state.responses).toHaveLength(2);
    expect(subject.state.aggregateQuestionResponses.q1).toHaveLength(2);
    expect(subject.state.aggregateQuestionResponses.q2).toHaveLength(1);
  });

  it('skips survey-mode rebuild when source signature is unchanged', async () => {
    const surveyId = 'survey-noop-signature';
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Stable Survey',
            questionIDs: ['q1'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            '0xAa': JSON.stringify({
              timeStamp: 10,
              responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
            }),
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 3 },
        surveysLatestBlock: 4,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = createSubject({
      provider: {},
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    attachStateHarness(subject);
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();
    subject.setState.mockClear();
    parseSpy.mockClear();

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).not.toHaveBeenCalled();
    expect(subject.setState).not.toHaveBeenCalled();
  });

  it('rebuilds survey-mode responses when payload changes under same metadata', async () => {
    const surveyId = 'survey-signature-payload-change';
    const responder = '0xAa';
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Mutable Survey',
            questionIDs: ['q1'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: 10,
              responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
            },
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 3 },
        surveysLatestBlock: 4,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = createSubject({
      provider: {},
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    attachStateHarness(subject);
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();
    subject.setState.mockClear();
    parseSpy.mockClear();

    surveyCache['84532'].surveyResponses[surveyId][responder] = {
      timeStamp: 10,
      responses: [{ questionID: 'q1', answer: { value: 'b1' } }],
    };

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(subject.setState).toHaveBeenCalled();
    expect(subject.state.aggregateQuestionResponses.q1[0].response.answer.value).toBe('b1');
  });

  it('rebuilds survey-mode responses when payload mutates deeply in place under stable refs', async () => {
    const surveyId = 'survey-signature-deep-mutation';
    const responder = '0xAa';
    const responderPayload = {
      timeStamp: 10,
      responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
    };
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Mutable Survey',
            questionIDs: ['q1'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: responderPayload,
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 3 },
        surveysLatestBlock: 4,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = createSubject({
      provider: {},
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    attachStateHarness(subject);
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();
    subject.setState.mockClear();
    parseSpy.mockClear();

    responderPayload.responses[0].answer.value = 'b2';

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(subject.setState).toHaveBeenCalled();
    expect(subject.state.aggregateQuestionResponses.q1[0].response.answer.value).toBe('b2');
  });

  it('invalidates survey source signature when toggling away from survey mode', () => {
    const subject = createSubject({
      provider: {},
      surveyId: '0xabc',
      viewMode: 'survey',
      isOpen: false,
    });

    subject._isMounted = true;
    subject._surveyModeSourceSignature = 'edge::84532::0xabc::stable';
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyId: '0xabc',
      filterState: {},
    };
    subject.requestFetchResponses = jest.fn();
    attachStateHarness(subject);

    const prevProps = { ...subject.props };
    const prevState = { ...subject.state, viewMode: 'survey' };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject._surveyModeSourceSignature).toBe('');
  });
});

describe('SurveyResults survey document URLs', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores survey document URLs from cache in survey mode state', async () => {
    const surveyId = 'survey-id-1';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const documentURLs = [
      'https://example.com/documents/alpha',
      'https://example.com/documents/beta',
    ];
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Survey One',
            questionIDs: ['q1'],
            documentURLs,
          },
        },
        surveysLatestBlock: 4,
        surveyResponsesLatestBlock: {
          [surveyId]: 5,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              responses: [
                { questionID: 'q1', answer: { value: 'A visible answer' } },
              ],
            },
          },
        },
      },
    };

    const subject = createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);
    subject.setState = jest.fn((next) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      return patch;
    });

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.surveyDocumentURLs).toEqual(documentURLs);
  });

  it('clears stale survey document URLs when no survey is selected', async () => {
    const networkId = '84532';
    const subject = createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: '',
      surveyDocumentURLs: ['https://example.com/documents/stale'],
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.setState = jest.fn((next) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      return patch;
    });

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          [networkId]: {
            surveys: {},
            surveyResponses: {},
          },
        };
      }
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.surveyDocumentURLs).toEqual([]);
  });
});

describe('SurveyResults freeform aggregator summary', () => {
  it('renders the empty freeform state inside the SurveyResults-only aggregator panel', () => {
    const subject = createSubject();

    const tree = subject.renderFreeformAggregatorSummary([]);
    const panel = findElement(
      tree,
      (element) => typeof element?.props?.className === 'string' && element.props.className.includes('surveyResultsAggregatorPanel')
    );

    expect(panel).toBeTruthy();
    expect(treeHasText(tree, 'No freeform responses available.')).toBe(true);
  });
});

describe('SurveyResults survey-mode dedupe', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps only the latest answer per responder/question when hydrating survey-mode state', async () => {
    const surveyId = 'survey-dedupe-1';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Deduped Survey',
            questionIDs: ['q1', 'q2'],
          },
        },
        surveysLatestBlock: 7,
        surveyResponsesLatestBlock: {
          [surveyId]: 9,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: '2025-01-01T00:00:00.000Z',
              responses: [
                {
                  questionId: 'q1',
                  timeStamp: '2024-01-01T00:00:00.000Z',
                  answer: { value: 'Old answer' },
                },
                {
                  questionID: 'q1',
                  timeStamp: '2025-01-01T00:00:00.000Z',
                  answer: { value: 'Latest answer' },
                },
                {
                  questionID: 'q2',
                  timeStamp: '2025-01-02T00:00:00.000Z',
                  answer: { value: 'Second question answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
      q2: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.responses).toHaveLength(1);
    expect(subject.state.responses[0].response.responses).toHaveLength(2);
    expect(subject.state.responses[0].response.responses[0]).toEqual(expect.objectContaining({
      questionID: 'q1',
      answer: expect.objectContaining({ value: 'Latest answer' }),
    }));
    expect(subject.state.aggregateQuestionResponses.q1).toHaveLength(1);
    expect(subject.state.aggregateQuestionResponses.q1[0].response.answer.value).toBe('Latest answer');
    expect(subject.state.aggregateQuestionResponses.q2).toHaveLength(1);
  });

  it('preserves the first-seen question order when duplicate rows are interleaved', async () => {
    const surveyId = 'survey-dedupe-order';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Deduped Survey Order',
            questionIDs: ['q1', 'q2'],
          },
        },
        surveysLatestBlock: 7,
        surveyResponsesLatestBlock: {
          [surveyId]: 9,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: '2025-01-01T00:00:00.000Z',
              responses: [
                {
                  questionId: 'q1',
                  timeStamp: '2024-01-01T00:00:00.000Z',
                  answer: { value: 'Old first answer' },
                },
                {
                  questionID: 'q2',
                  timeStamp: '2024-01-02T00:00:00.000Z',
                  answer: { value: 'Second question answer' },
                },
                {
                  questionID: 'q1',
                  timeStamp: '2025-01-01T00:00:00.000Z',
                  answer: { value: 'Latest first answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
      q2: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.responses).toHaveLength(1);
    expect(
      subject.state.responses[0].response.responses.map((row: any) => row.questionID || row.questionId)
    ).toEqual(['q1', 'q2']);
    expect(subject.state.responses[0].response.responses[0]).toEqual(expect.objectContaining({
      questionID: 'q1',
      answer: expect.objectContaining({ value: 'Latest first answer' }),
    }));
  });

  it('preserves passthrough row order when duplicate question rows are collapsed around them', async () => {
    const surveyId = 'survey-dedupe-passthrough-order';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Deduped Survey Passthrough Order',
            questionIDs: ['q1', 'q2'],
          },
        },
        surveysLatestBlock: 7,
        surveyResponsesLatestBlock: {
          [surveyId]: 9,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: '2025-01-01T00:00:00.000Z',
              responses: [
                {
                  questionId: 'q1',
                  timeStamp: '2024-01-01T00:00:00.000Z',
                  answer: { value: 'Old first answer' },
                },
                {
                  kind: 'legacyMeta',
                  note: 'Keep this row between the deduped answers',
                },
                {
                  questionID: 'q1',
                  timeStamp: '2025-01-01T00:00:00.000Z',
                  answer: { value: 'Latest first answer' },
                },
                {
                  questionID: 'q2',
                  timeStamp: '2025-01-02T00:00:00.000Z',
                  answer: { value: 'Second question answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
      q2: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response: any) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.responses).toHaveLength(1);
    expect(
      subject.state.responses[0].response.responses.map(
        (row: any) => row.questionID || row.questionId || row.kind
      )
    ).toEqual(['q1', 'legacyMeta', 'q2']);
    expect(subject.state.responses[0].response.responses[0]).toEqual(expect.objectContaining({
      questionID: 'q1',
      answer: expect.objectContaining({ value: 'Latest first answer' }),
    }));
    expect(subject.state.responses[0].response.responses[1]).toEqual(expect.objectContaining({
      kind: 'legacyMeta',
      note: 'Keep this row between the deduped answers',
    }));
  });

  it('prefers a newer payload timestamp when the edited answer row has no timestamp', async () => {
    const surveyId = 'survey-dedupe-payload-timestamp';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Payload Timestamp Dedupe Survey',
            questionIDs: ['q1'],
          },
        },
        surveysLatestBlock: 7,
        surveyResponsesLatestBlock: {
          [surveyId]: 9,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: '2025-01-01T00:00:00.000Z',
              responses: [
                {
                  questionId: 'q1',
                  timeStamp: '2024-01-01T00:00:00.000Z',
                  answer: { value: 'Old answer' },
                },
                {
                  questionID: 'q1',
                  answer: { value: 'Latest answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.responses).toHaveLength(1);
    expect(subject.state.responses[0].response.responses).toEqual([
      expect.objectContaining({
        questionID: 'q1',
        answer: expect.objectContaining({ value: 'Latest answer' }),
      }),
    ]);
    expect(subject.state.aggregateQuestionResponses.q1).toEqual([
      expect.objectContaining({
        response: expect.objectContaining({
          answer: expect.objectContaining({ value: 'Latest answer' }),
        }),
      }),
    ]);
  });

  it('prefers a newer payload timestamp when the edited answer row keeps a stale row timestamp', async () => {
    const surveyId = 'survey-dedupe-stale-entry-timestamp';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Payload Wins Over Stale Entry Timestamp',
            questionIDs: ['q1'],
          },
        },
        surveysLatestBlock: 7,
        surveyResponsesLatestBlock: {
          [surveyId]: 9,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: '2025-02-01T00:00:00.000Z',
              responses: [
                {
                  questionId: 'q1',
                  timeStamp: '2025-01-15T00:00:00.000Z',
                  answer: { value: 'Old answer' },
                },
                {
                  questionID: 'q1',
                  timeStamp: '2024-01-01T00:00:00.000Z',
                  answer: { value: 'Latest answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.responses).toHaveLength(1);
    expect(subject.state.responses[0].response.responses).toEqual([
      expect.objectContaining({
        questionID: 'q1',
        answer: expect.objectContaining({ value: 'Latest answer' }),
      }),
    ]);
    expect(subject.state.aggregateQuestionResponses.q1).toEqual([
      expect.objectContaining({
        response: expect.objectContaining({
          answer: expect.objectContaining({ value: 'Latest answer' }),
        }),
      }),
    ]);
  });
});

describe('SurveyResults multichoice aggregator summary', () => {
  it('renders the empty multichoice state inside the SurveyResults-only aggregator panel', () => {
    const subject = createSubject();

    const tree = subject.renderMultichoiceAggregatorSummary([], {
      id: 'q1',
      type: 'multichoice',
      options: ['Alpha', 'Beta'],
    });
    const panel = findElement(
      tree,
      (element) => typeof element?.props?.className === 'string' && element.props.className.includes('surveyResultsAggregatorPanel')
    );

    expect(panel).toBeTruthy();
    expect(treeHasText(tree, 'No multichoice responses available.')).toBe(true);
  });

  it('renders multichoice question cards with the SurveyResults-only freeform-style summary rows', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      activeQuestionToggles: { q1: true },
      surveyId: 'survey-1',
    };

    const markup = renderToStaticMarkup(subject.renderQuestionSummary(
      'q1',
      [
        {
          responder: '0xaaa',
          timestamp: 1,
          response: { type: 'multichoice', answer: { value: ['Alpha'] } },
        },
        {
          responder: '0xaaa',
          timestamp: 2,
          response: { type: 'multichoice', answer: { value: ['Alpha', 'Beta'] } },
        },
        {
          responder: '0xbbb',
          timestamp: 1,
          response: { type: 'multichoice', answer: { value: ['Alpha'] } },
        },
      ],
      {
        q1: {
          id: 'q1',
          prompt: 'Pick some options',
          type: 'multichoice',
          options: ['Alpha', 'Beta', 'Gamma'],
        },
      }
    ));

    expect(markup).toContain('2 total responders to this multichoice question.');
    expect(markup).toContain('Alpha');
    expect(markup).toContain('2 (100.00%)');
    expect(markup).toContain('Beta');
    expect(markup).toContain('1 (50.00%)');
    expect(markup).toContain('Gamma');
    expect(markup).toContain('0 (0.00%)');
  });

  it('keeps the SurveyResults multichoice summary renderer when question metadata is still missing', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      activeQuestionToggles: { q1: true },
      surveyId: 'survey-1',
    };

    const markup = renderToStaticMarkup(subject.renderQuestionSummary(
      'q1',
      [
        {
          responder: '0xaaa',
          timestamp: 2,
          response: { type: 'multichoice', answer: { value: ['Alpha', 'Beta'] } },
        },
      ],
      {}
    ));

    expect(markup).toContain('No metadata found for this question in local cache.');
    expect(markup).toContain('1 total responders to this multichoice question.');
    expect(markup).toContain('Alpha');
    expect(markup).toContain('Beta');
  });

  it('shows the deduped latest-responder count in the question card header', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      activeQuestionToggles: { q1: true },
      surveyId: 'survey-1',
    };

    const tree = subject.renderQuestionSummary(
      'q1',
      [
        {
          responder: '0xaaa',
          timestamp: 1,
          response: { type: 'multichoice', answer: { value: ['Alpha'] } },
        },
        {
          responder: '0xaaa',
          timestamp: 2,
          response: { type: 'multichoice', answer: { value: ['Alpha', 'Beta'] } },
        },
      ],
      {
        q1: {
          id: 'q1',
          prompt: 'Pick some options',
          type: 'multichoice',
          options: ['Alpha', 'Beta'],
        },
      }
    );

    const countNode = findElement(
      tree,
      (element) => element?.props?.id === styles.responseCountNumber
    );

    expect(countNode?.props?.children).toBe(1);
  });
});

describe('SurveyResults question table counts', () => {
  it('dedupes the question-table response count by responder before sorting/display', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      questionIdSortBy: 'responses',
      questionIdSortAsc: true,
    };

    const entries = subject.getMemoizedQuestionTableEntries(
      {
        q1: [
          {
            responder: '0xaaa',
            timestamp: 1,
            response: { answer: { value: 'Old answer' } },
          },
          {
            responder: '0xaaa',
            timestamp: 2,
            response: { answer: { value: 'Latest answer' } },
          },
          {
            responder: '0xbbb',
            timestamp: 1,
            response: { answer: { value: 'Other responder' } },
          },
        ],
      },
      {
        q1: {
          prompt: 'Question one',
          type: 'freeform',
        },
      }
    );

    expect(entries).toEqual([
      expect.objectContaining({
        questionId: 'q1',
        responsesCount: 2,
      }),
    ]);
  });
});

describe('SurveyResults filter summary counts', () => {
  it('shows hydrated filtered counts while question-mode sync is still catching up', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      totalQuestionsCount: 33,
      totalResponsesCount: 88,
      filteredQuestionsCount: 17,
      filteredResponsesCount: 29,
      questionResultsHydrated: true,
      networkLatestBlock: 100,
      questionLocalBlock: 40,
      responseLocalBlock: 25,
      questionResponses: {
        q1: {
          '0xaaa': { answer: { value: 'Visible answer' } },
        },
      },
      aggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xaaa',
            response: { answer: { value: 'Visible answer' } },
          },
        ],
      },
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xaaa',
            response: { answer: { value: 'Visible answer' } },
          },
        ],
      },
    };

    const tree = subject.render();
    const summaryNode = findElement(
      tree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('filterSummaryText')
    );
    const spinnerNodes = collectTreeNodes(
      summaryNode,
      (element) => element?.props?.icon?.iconName === 'spinner'
    );

    expect(summaryNode).toBeTruthy();
    expect(treeHasText(summaryNode, '17')).toBe(true);
    expect(treeHasText(summaryNode, '29')).toBe(true);
    expect(spinnerNodes).toHaveLength(0);
  });

  it('keeps the summary spinners while counts have not hydrated yet', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
      filteredQuestionsCount: null,
      filteredResponsesCount: 0,
      questionResultsHydrated: false,
      networkLatestBlock: 100,
      questionLocalBlock: 0,
      responseLocalBlock: 0,
      questionResponses: {},
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
    };

    const tree = subject.render();
    const summaryNode = findElement(
      tree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('filterSummaryText')
    );
    const spinnerNodes = collectTreeNodes(
      summaryNode,
      (element) => element?.props?.icon?.iconName === 'spinner'
    );

    expect(summaryNode).toBeTruthy();
    expect(spinnerNodes).toHaveLength(2);
  });

  it('clamps stale filtered summary counts so they never exceed the visible totals', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
      filteredQuestionsCount: 42,
      filteredResponsesCount: 7,
      questionResultsHydrated: true,
      networkLatestBlock: 100,
      questionLocalBlock: 100,
      responseLocalBlock: 100,
      questionResponses: {},
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
    };

    const tree = subject.render();
    const summaryNode = findElement(
      tree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('filterSummaryText')
    );
    expect(summaryNode).toBeTruthy();
    expect(treeHasText(summaryNode, 'Questions:')).toBe(true);
    expect(treeHasText(summaryNode, 'Responses:')).toBe(true);
    expect(treeHasText(summaryNode, '42')).toBe(false);
    expect(treeHasText(summaryNode, '7')).toBe(false);
  });
});

describe('SurveyResults demo results views', () => {
  it('shows the demo results switcher only for demo question results', () => {
    const nonDemoSubject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      sessionSlug: 'edge',
    });
    nonDemoSubject.state = {
      ...nonDemoSubject.state,
      viewMode: 'questions',
    };

    const nonDemoTree = nonDemoSubject.render();
    const nonDemoNav = findElement(
      nonDemoTree,
      (element) => element?.props?.['data-testid'] === 'ce-surveyresults-demo-view-nav'
    );
    expect(nonDemoNav).toBeNull();

    const demoSubject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      sessionSlug: 'demo',
    });
    demoSubject.state = {
      ...demoSubject.state,
      viewMode: 'questions',
    };

    const demoTree = demoSubject.render();
    const demoNav = findElement(
      demoTree,
      (element) => element?.props?.['data-testid'] === 'ce-surveyresults-demo-view-nav'
    );
    const headerControls = findElement(
      demoTree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('modalHeaderControls')
    );
    const headerControlChildren = normalizeChildren(headerControls?.props?.children);
    const syncIndex = headerControlChildren.findIndex(
      (child) =>
        typeof child?.props?.className === 'string' &&
        child.props.className.includes('syncStatusContainer')
    );
    const demoNavIndex = headerControlChildren.findIndex(
      (child) => child?.props?.['data-testid'] === 'ce-surveyresults-demo-view-nav'
    );

    expect(demoNav).toBeTruthy();
    expect(treeHasText(demoNav, 'Report')).toBe(true);
    expect(treeHasText(demoNav, 'Breakdown')).toBe(true);
    expect(treeHasText(demoNav, 'Atlas')).toBe(true);
    expect(treeHasText(demoNav, 'Risk Matrix')).toBe(true);
    expect(syncIndex).toBeGreaterThanOrEqual(0);
    expect(demoNavIndex).toBeGreaterThan(syncIndex);
  });

  it('switches the demo modal surface from the top bar buttons and maps report to Polis', async () => {
    const subject = attachStateHarness(createSubject({
      isOpen: true,
      viewMode: 'questions',
      sessionSlug: 'demo',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      totalQuestionsCount: 4,
      totalResponsesCount: 7,
      filteredQuestionsCount: 4,
      filteredResponsesCount: 7,
      questionResultsHydrated: true,
      networkLatestBlock: 50,
      questionLocalBlock: 50,
      responseLocalBlock: 50,
      questionResponses: {
        q1: {
          '0xaaa': { answer: { value: 'Visible answer' } },
        },
      },
      aggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xaaa',
            response: { answer: { value: 'Visible answer' } },
          },
        ],
      },
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xaaa',
            response: { answer: { value: 'Visible answer' } },
          },
        ],
      },
    };

    const { rerender } = renderSubjectTree(subject);
    const rerenderSubject = () => rerender(
      <MemoryRouter>
        {subject.render()}
      </MemoryRouter>
    );

    const demoNav = screen.getByTestId('ce-surveyresults-demo-view-nav');
    expect(within(demoNav).getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
      'Report',
      'Atlas',
      'Breakdown',
      'Risk Matrix',
    ]);

    expect(screen.getByTestId('ce-surveyresults-demo-view-report')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('ce-surveyresults-demo-surface-report')).not.toBeInTheDocument();
    expect(mockPolisReport).not.toHaveBeenCalled();

    const reportButton = screen.getByTestId('ce-surveyresults-demo-view-report');
    const atlasButton = screen.getByTestId('ce-surveyresults-demo-view-atlas');
    const breakdownButton = screen.getByTestId('ce-surveyresults-demo-view-breakdown');
    const riskMatrixButton = screen.getByTestId('ce-surveyresults-demo-view-riskMatrix');

    expect(reportButton.compareDocumentPosition(atlasButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(atlasButton.compareDocumentPosition(breakdownButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(breakdownButton.compareDocumentPosition(riskMatrixButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(reportButton);
    rerenderSubject();

    await waitFor(() => {
      expect(screen.getByTestId('ce-surveyresults-demo-surface-report')).toBeInTheDocument();
    });
    expect(mockPolisReport).toHaveBeenCalled();
    expect(subject.state.demoResultsViewMode).toBe('report');
    expect(screen.getByTestId('ce-surveyresults-demo-view-report')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(reportButton);
    rerenderSubject();

    await waitFor(() => {
      expect(screen.queryByTestId('ce-surveyresults-demo-surface-report')).not.toBeInTheDocument();
    });
    expect(subject.state.demoResultsViewMode).toBe('raw');
    expect(screen.getByTestId('ce-surveyresults-demo-view-report')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(breakdownButton);
    rerenderSubject();

    await waitFor(() => {
      expect(screen.getByTestId('surveyresults-demo-breakdown-view')).toBeInTheDocument();
    });
    expect(subject.state.demoResultsViewMode).toBe('breakdown');

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-riskMatrix'));
    rerenderSubject();

    const riskMatrixView = await screen.findByTestId('surveyresults-demo-risk-matrix-view');
    expect(riskMatrixView).toBeInTheDocument();
    expect(riskMatrixView.closest(`.${styles.demoResultsRiskMatrixSurface}`)).not.toBeNull();
    expect(subject.state.demoResultsViewMode).toBe('riskMatrix');

    fireEvent.click(riskMatrixView);
    rerenderSubject();

    await waitFor(() => {
      expect(screen.getByTestId('surveyresults-demo-atlas-view')).toHaveTextContent('atlas-node-1');
    });
    expect(subject.state.demoResultsViewMode).toBe('atlas');
    expect(screen.getByTestId('ce-surveyresults-demo-view-atlas')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('SurveyResults.resolveSummaryQuestionType', () => {
  it('infers freeform from response.answer.type when question metadata is missing', () => {
    const subject = createSubject();

    expect(subject.resolveSummaryQuestionType(undefined, [
      {
        response: { answer: { type: 'freeform', value: 'Legacy freeform answer' } },
      },
    ])).toBe('freeform');
  });

  it('normalizes legacy text response.answer.type to freeform when question metadata is null', () => {
    const subject = createSubject();

    expect(subject.resolveSummaryQuestionType(null, [
      {
        response: { answer: { type: 'text', value: 'Legacy text answer' } },
      },
    ])).toBe('freeform');
  });
});

describe('SurveyResults.getMemoizedViewableResponsesCount', () => {
  it('excludes blank freeform answers and encrypted placeholders', () => {
    const subject = createSubject();
    const responses = [
      { response: { answer: { value: '   ', encrypted: false } } },
      { response: { answer: { value: 'Visible freeform answer', encrypted: false } } },
      { response: { answer: { value: '*', encrypted: true } } },
    ];

    expect(subject.getMemoizedViewableResponsesCount(responses, 'freeform')).toBe(1);
  });

  it('does not exclude blank answers for non-freeform questions', () => {
    const subject = createSubject();
    const responses = [
      { response: { answer: { value: '   ', encrypted: false } } },
      { response: { answer: { value: 'Agree', encrypted: false } } },
      { response: { answer: { value: '*', encrypted: true } } },
    ];

    expect(subject.getMemoizedViewableResponsesCount(responses, 'binary')).toBe(2);
  });

  it('uses question type in memoization for the same responses array', () => {
    const subject = createSubject();
    const responses = [
      { response: { answer: { value: '   ', encrypted: false } } },
      { response: { answer: { value: 'Visible answer', encrypted: false } } },
    ];

    const freeformCount = subject.getMemoizedViewableResponsesCount(responses, 'freeform');
    const binaryCount = subject.getMemoizedViewableResponsesCount(responses, 'binary');

    expect(freeformCount).toBe(1);
    expect(binaryCount).toBe(2);
    expect(freeformCount).not.toBe(binaryCount);
  });

  it('does not count malformed rows that have no answer payload', () => {
    const subject = createSubject();
    const responses = [
      { response: null },
      { response: {} },
      { response: { answer: { value: 'Visible answer', encrypted: false } } },
    ];

    expect(subject.getMemoizedViewableResponsesCount(responses, 'freeform')).toBe(1);
  });
});

describe('SurveyResults freeform summary rendering', () => {
  it('omits "0 encrypted responses not shown." when no encrypted responses exist', () => {
    const subject = createSubject();
    const responses = [
      {
        responder: '0x1111111111111111111111111111111111111111',
        timestamp: 1,
        response: { answer: { value: '   ', encrypted: false } },
      },
      {
        responder: '0x2222222222222222222222222222222222222222',
        timestamp: 1,
        response: { answer: { value: 'Visible freeform answer', encrypted: false } },
      },
    ];

    const markup = renderToStaticMarkup(subject.renderFreeformAggregatorSummary(responses));
    expect(markup).toContain('1 total responses. 1 blank not shown.');
    expect(markup).not.toContain('0 encrypted responses not shown.');
    expect(markup).toContain('Visible freeform answer');
  });
});

describe('SurveyResults Polis report props', () => {
  it('passes scoped question scan progress through to PolisReport', () => {
    const progress = {
      slug: 'edge',
      phase: 'scan',
      totalBlocks: 120,
      requestedTotalBlocks: 120,
      scannedBlocks: 30,
      remainingBlocks: 90,
    };
    const subject = createSubject({
      isOpen: true,
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
      questionScanProgress: progress,
      sessionSlug: 'demo',
      activeSessionSlug: 'demo',
      viewMode: 'questions',
    });
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      demoResultsViewMode: 'report',
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
    };

    const tree = subject.render();
    const polisNode = findElement(
      tree,
      (candidate) => (
        candidate?.props?.questionScanProgress === progress &&
        candidate?.props?.isQuestionCacheReady === false &&
        candidate?.props?.isResponsesCacheReady === false &&
        candidate?.props?.disclaimersActive === true
      )
    );

    expect(polisNode).toBeTruthy();
    expect(polisNode.props.questionScanProgress).toBe(progress);
  });
});

describe('SurveyResults survey/response links', () => {
  it('encodes survey IDs in /survey/:id links', () => {
    const surveyId = 'survey id/with spaces?and=query';
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
      surveyViewMode: 'aggregate',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const surveyLink = findElement(
      tree,
      (element) => element?.type === 'a' && element?.props?.href && element.props.href.startsWith(`/survey/${encodeURIComponent(surveyId)}`)
    );
    expect(surveyLink).toBeTruthy();
  });

  it('appends session query to survey links when an effective slug exists', () => {
    const surveyId = 'survey id/with spaces?and=query';
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
      sessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
      surveyViewMode: 'aggregate',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const surveyLink = findElement(
      tree,
      (element) => (
        element?.type === 'a' &&
        element?.props?.href &&
        element.props.href.startsWith(`/survey/${encodeURIComponent(surveyId)}`) &&
        element.props.href.includes(`session=${encodeURIComponent('edge')}`)
      )
    );
    expect(surveyLink).toBeTruthy();
  });

  it('encodes responder addresses in /u/:address links', () => {
    const surveyId = 'survey id/with spaces?and=query';
    const responder = '0xabc123/def456?foo=bar';
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
      surveyViewMode: 'individuals',
      responses: [
        {
          responder,
          surveyId,
          response: { responses: [] },
        },
      ],
      sbtFilteredResponses: [
        {
          responder,
          surveyId,
          response: { responses: [] },
        },
      ],
    };

    const tree = subject.render();
    const responderLink = findElement(
      tree,
      (element) => element?.type === 'a' && element?.props?.href === `/u/${encodeURIComponent(responder)}`
    );
    expect(responderLink).toBeTruthy();
  });

  it('renders only the latest answer row in expanded survey individual view for duplicate question updates', async () => {
    const surveyId = 'survey-individual-dedupe';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Individual Dedupe Survey',
            questionIDs: ['q1'],
          },
        },
        surveysLatestBlock: 4,
        surveyResponsesLatestBlock: {
          [surveyId]: 5,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: '2025-01-01T00:00:00.000Z',
              responses: [
                {
                  questionId: 'q1',
                  timeStamp: '2024-01-01T00:00:00.000Z',
                  answer: { value: 'Old answer' },
                },
                {
                  questionID: 'q1',
                  timeStamp: '2025-01-01T00:00:00.000Z',
                  answer: { value: 'Latest answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
      network: { id: Number(networkId) },
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
      surveyViewMode: 'individuals',
      activeToggles: { 0: true },
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Question one',
        type: 'freeform',
      },
    }));
    subject.getScopedQuestionNetworkDataSync = jest.fn(() => ({
      questions: {
        q1: {
          id: 'q1',
          prompt: 'Question one',
          type: 'freeform',
        },
      },
      questionResponses: {},
      questionsLatestBlock: 0,
      questionResponsesLatestBlock: 0,
    }));
    subject.parseResponse = jest.fn((response) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();
    const singleResponseNodes = collectTreeNodes(
      subject.render(),
      (element) => (
        typeof element?.type === 'function' &&
        element?.props?.aggregatorResponseMode === false
      )
    );

    expect(singleResponseNodes).toHaveLength(1);
    expect(singleResponseNodes[0].props).toEqual(expect.objectContaining({
      response: expect.objectContaining({
        questionID: 'q1',
        answer: expect.objectContaining({ value: 'Latest answer' }),
      }),
    }));
  });

  it('renders survey document URL links in the modal header when available', () => {
    const surveyId = 'survey-id-with-docs';
    const docUrl = 'https://example.com/docs/survey-reference';
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
      surveyTitle: 'Survey with docs',
      surveyDocumentURLs: [docUrl],
      surveyViewMode: 'aggregate',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const docLink = findElement(
      tree,
      (element) =>
        element?.type === 'a' &&
        element?.props?.href === docUrl &&
        element?.props?.target === '_blank'
    );

    expect(docLink).toBeTruthy();
  });

  it('does not render survey document URL links in question view', () => {
    const docUrl = 'https://example.com/docs/question-view-hidden';
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyDocumentURLs: [docUrl],
      aggregateQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const docLink = findElement(
      tree,
      (element) => element?.type === 'a' && element?.props?.href === docUrl
    );

    expect(docLink).toBeNull();
  });
});

describe('SurveyResults export/view controls', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults export area to collapsed', () => {
    const subject = createSubject();
    expect(subject.state.exportAreaOpen).toBe(false);
  });

  it('toggleExportArea flips exportAreaOpen state', () => {
    const subject = attachStateHarness(createSubject());

    subject.toggleExportArea();
    expect(subject.state.exportAreaOpen).toBe(true);

    subject.toggleExportArea();
    expect(subject.state.exportAreaOpen).toBe(false);
  });

  it('renders the survey view mode toggle switch without legacy view buttons', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      surveyViewMode: 'individuals',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const toggleSwitch = findElement(
      tree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('toggleSwitch')
    );
    expect(toggleSwitch).toBeTruthy();

    expect(treeHasText(tree, 'Individual')).toBe(true);
    expect(treeHasText(tree, 'Aggregate')).toBe(true);
    expect(treeHasText(tree, 'Individuals View')).toBe(false);
    expect(treeHasText(tree, 'Aggregate View')).toBe(false);
  });

  it('passes the light-surface filter button variant to survey-mode SBT filters', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      surveyViewMode: 'aggregate',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
      filterState: { sbtFilter: {} },
    };

    const tree = subject.render();
    const surveyFilter = findElement(
      tree,
      (element) =>
        element?.props?.autoExpand === false &&
        element?.props?.buttonSurface === 'light'
    );

    expect(surveyFilter).toBeTruthy();
  });

  it('suppresses the embedded SBTFilter loading overlay in survey results', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      surveyViewMode: 'aggregate',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
      filterState: { sbtFilter: {} },
    };

    const tree = subject.render();
    const surveyFilter = findElement(
      tree,
      (element) =>
        element?.props?.autoExpand === false &&
        element?.props?.buttonSurface === 'light'
    );

    expect(surveyFilter).toBeTruthy();
    expect(surveyFilter.props.hideLoadingOverlay).toBe(true);
  });

  it('renders the current export options list', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      exportAreaOpen: true,
      exportType: 'csv-questions-and-responses',
      aggregateQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();

    expect(treeHasText(tree, 'CSV: Questions')).toBe(true);
    expect(treeHasText(tree, 'CSV: Questions + Responses')).toBe(true);
    expect(treeHasText(tree, 'JSON: Questions')).toBe(true);
    expect(treeHasText(tree, 'JSON: Questions + Responses')).toBe(true);
    expect(treeHasText(tree, 'Polis Report')).toBe(false);
  });

  it('exports survey-response CSV from current individual payloads with metadata fallbacks and latest-row dedupe', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'survey',
      sessionName: 'Demo Session',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyViewMode: 'individuals',
      sbtFilteredResponses: [
        {
          responder: '0xAbC',
          timeStamp: '2024-01-01T00:00:00.000Z',
          response: JSON.stringify({
            responses: [
              {
                questionId: 'Q1',
                answer: { value: ['Alpha'], encrypted: false },
                additional: { value: 'Old note', encrypted: false },
                importance: 1,
              },
            ],
          }),
        },
        {
          responder: { address: '0xAbC' },
          response: {
            responses: [
              {
                questionID: 'q1',
                timeStamp: '2025-01-01T00:00:00.000Z',
                answer: { value: ['Alpha', 'Gamma'], encrypted: false, hash: 'hash-1' },
                additional: { value: 'Latest note', encrypted: false, hash: 'add-hash-1' },
                conviction: 7,
              },
            ],
          },
        },
        {
          responder: '0xDef',
          response: {
            responses: [
              {
                questionId: 'q2',
                timeStamp: '2025-02-02T00:00:00.000Z',
                answer: { value: '*', encrypted: true },
                additional: { value: '', encrypted: false },
                importance: 4,
              },
            ],
          },
        },
      ],
    };

    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Question One',
        type: 'multichoice',
        options: ['Alpha', 'Beta', 'Gamma'],
      },
      q2: {
        id: 'q2',
        prompt: 'Question Two',
        type: 'freeform',
      },
    }));

    const csv = subject.generateResponsesCSV();
    const lines = csv.split('\n');

    expect(lines[0]).toBe('responderAddress,questionID,questionPrompt,type,options,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp');
    expect(lines[1]).toBe('"0xAbC","q1","Question One","multichoice","Alpha;Beta;Gamma","7","Alpha, Gamma","hash-1","Latest note","false","false","add-hash-1","2025-01-01T00:00:00.000Z"');
    expect(lines[2]).toBe('"0xDef","q2","Question Two","freeform","","4","*","","","true","false","","2025-02-02T00:00:00.000Z"');
    expect(csv).not.toContain('Old note');
  });

  it('exports aggregate response CSV from mixed object/string payloads using current question metadata', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xAbC',
            response: JSON.stringify({
              questionId: 'Q1',
              timeStamp: '2024-03-01T00:00:00.000Z',
              answer: { value: ['Alpha'], encrypted: false },
              importance: 1,
            }),
          },
          {
            responder: { address: '0xAbC' },
            response: {
              questionID: 'q1',
              timeStamp: '2025-03-01T00:00:00.000Z',
              answer: { value: ['Alpha', 'Gamma'], encrypted: false, hash: 'ans-hash' },
              additional: { value: 'Current note', encrypted: false, hash: 'add-hash' },
              conviction: 9,
            },
          },
        ],
      },
    };

    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Aggregate Question',
        type: 'multichoice',
        options: ['Alpha', 'Beta', 'Gamma'],
      },
    }));

    const csv = subject.generateResponsesCSV();
    const lines = csv.split('\n');

    expect(lines[0]).toBe('questionID,questionPrompt,type,options,responderAddress,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp');
    expect(lines[1]).toBe('"q1","Aggregate Question","multichoice","Alpha;Beta;Gamma","0xAbC","9","Alpha, Gamma","ans-hash","Current note","false","false","add-hash","2025-03-01T00:00:00.000Z"');
    expect(lines).toHaveLength(2);
  });

  it('exports results JSON for the current filtered question view', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
      sessionSlug: 'demo',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyTitle: 'Demo Survey',
      totalQuestionsCount: 2,
      filteredQuestionsCount: 1,
      totalResponsesCount: 5,
      filteredResponsesCount: 2,
      filterState: {
        sbtFilter: {
          selectedTraits: ['builder'],
        },
      },
      sbtFilteredAggregatorQuestionResponses: {
        q1: [{ responder: '0xabc', response: { answer: { value: 'Agree' } } }],
      },
      sbtFilteredResponses: [
        {
          responder: '0xabc',
          response: {
            responses: [{ questionId: 'q1', answer: { value: 'Agree' } }],
          },
        },
      ],
    };

    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'Q1',
        prompt: 'Prompt One',
        type: 'multichoice',
        tags: ['governance', 'ai'],
        options: ['Alpha', 'Beta'],
      },
    }));

    const exported = JSON.parse(subject.generateResultsJSON());

    expect(exported.sessionSlug).toBe('demo');
    expect(exported.viewMode).toBe('questions');
    expect(exported.surveyTitle).toBe('Demo Survey');
    expect(exported.counts).toEqual({
      totalQuestions: 2,
      filteredQuestions: 1,
      totalResponses: 5,
      filteredResponses: 2,
    });
    expect(exported.filterState).toEqual({
      sbtFilter: {
        selectedTraits: ['builder'],
      },
    });
    expect(exported.filteredQuestions).toEqual([
      {
        id: 'Q1',
        prompt: 'Prompt One',
        type: 'multichoice',
        tags: ['governance', 'ai'],
        options: ['Alpha', 'Beta'],
      },
    ]);
    expect(exported.filteredQuestionResponses.q1).toHaveLength(1);
    expect(exported.filteredResponses).toHaveLength(1);
    expect(typeof exported.exportedAt).toBe('string');
  });

  it('exports question-only JSON without response payloads', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
      sessionSlug: 'edge',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyTitle: 'Edge Survey',
      totalQuestionsCount: 3,
      filteredQuestionsCount: 2,
      totalResponsesCount: 7,
      filteredResponsesCount: 4,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [{ responder: '0xabc', response: { answer: { value: 'Agree' } } }],
      },
      sbtFilteredResponses: [
        {
          responder: '0xdef',
          response: {
            responses: [{ questionId: 'q2', answer: { value: 'Disagree' } }],
          },
        },
      ],
    };

    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'Q1',
        prompt: 'Prompt One',
        type: 'binary',
        tags: ['governance'],
        options: [],
      },
      q2: {
        id: 'Q2',
        prompt: 'Prompt Two',
        type: 'freeform',
        tags: ['safety'],
        options: [],
      },
    }));

    const exported = JSON.parse(subject.generateQuestionsJSON());

    expect(exported.filteredQuestions).toEqual([
      {
        id: 'Q1',
        prompt: 'Prompt One',
        type: 'binary',
        tags: ['governance'],
        options: [],
      },
      {
        id: 'Q2',
        prompt: 'Prompt Two',
        type: 'freeform',
        tags: ['safety'],
        options: [],
      },
    ]);
    expect(exported.filteredQuestionResponses).toBeUndefined();
    expect(exported.filteredResponses).toBeUndefined();
  });

  it('downloads current json exports through the active download path', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      exportType: 'json-questions-and-responses',
      alertMessage: '',
    };
    subject.getExportBaseFileName = jest.fn(() => 'contextEngine_questionResults');
    subject.generateResultsJSON = jest.fn(() => '{"ok":true}');

    const originalCreateObjectURL = window.URL.createObjectURL;
    const createObjectURLMock = jest.fn(() => 'blob:test-export');
    window.URL.createObjectURL = createObjectURLMock as any;
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement('a');
    const anchorClickSpy = jest.spyOn(anchor, 'click').mockImplementation(() => {});
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: any) => (
      String(tagName).toLowerCase() === 'a' ? anchor : originalCreateElement(tagName)
    )) as any);

    subject.downloadCSV();

    expect(subject.generateResultsJSON).toHaveBeenCalledTimes(1);
    expect(subject.setState).not.toHaveBeenCalled();
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(anchor.getAttribute('href')).toBe('blob:test-export');
    expect(anchor.getAttribute('download')).toMatch(/^contextEngine_questionResults_.*\.json$/);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(anchor);
    expect(removeChildSpy).toHaveBeenCalledWith(anchor);
    expect(subject.state.alertMessage).toBe('');

    createElementSpy.mockRestore();
    anchorClickSpy.mockRestore();
    removeChildSpy.mockRestore();
    appendChildSpy.mockRestore();
    if (originalCreateObjectURL) {
      window.URL.createObjectURL = originalCreateObjectURL;
    } else {
      delete (window.URL as any).createObjectURL;
    }
  });

  it('downloads question-only csv exports through the active download path', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      exportType: 'csv-questions',
      alertMessage: '',
    };
    subject.getExportBaseFileName = jest.fn(() => 'contextEngine_filteredQuestions');
    subject.generateQuestionsCSV = jest.fn(() => '"questionID","prompt","type","tags","options"\n"q1","Prompt","binary","",""');

    const originalCreateObjectURL = window.URL.createObjectURL;
    const createObjectURLMock = jest.fn(() => 'blob:test-export');
    window.URL.createObjectURL = createObjectURLMock as any;
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement('a');
    const anchorClickSpy = jest.spyOn(anchor, 'click').mockImplementation(() => {});
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: any) => (
      String(tagName).toLowerCase() === 'a' ? anchor : originalCreateElement(tagName)
    )) as any);

    subject.downloadCSV();

    expect(subject.generateQuestionsCSV).toHaveBeenCalledTimes(1);
    expect(subject.setState).not.toHaveBeenCalled();
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(anchor.getAttribute('href')).toBe('blob:test-export');
    expect(anchor.getAttribute('download')).toMatch(/^contextEngine_filteredQuestions_.*\.csv$/);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(anchor);
    expect(removeChildSpy).toHaveBeenCalledWith(anchor);
    expect(subject.state.alertMessage).toBe('');

    createElementSpy.mockRestore();
    anchorClickSpy.mockRestore();
    removeChildSpy.mockRestore();
    appendChildSpy.mockRestore();
    if (originalCreateObjectURL) {
      window.URL.createObjectURL = originalCreateObjectURL;
    } else {
      delete (window.URL as any).createObjectURL;
    }
  });

  it('rejects unknown export types through the invalid-export fallback', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      exportType: 'Legacy Removed Export',
    };

    subject.downloadCSV();

    expect(subject.state.alertMessage).toBe('Invalid export type selected.');
  });
});

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
    expect(reason).toContain('modal-open');
    expect(reason).toContain('cache-ready');
    expect(reason).toContain('responses-cache-ready');
  });
});

describe('SurveyResults bookmark cache writes', () => {
  it('uses clone:false reads when mutating survey/question bookmarks in results view', async () => {
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      surveys: [],
      questions: [],
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(true);

    const subject = attachStateHarness(createSubject({
      activeSessionSlug: 'edge',
    }));
    subject.getEffectiveSlug = jest.fn(() => 'edge');

    subject.toggleSurveyBookmark('s1');
    subject.toggleQuestionBookmark('q1');
    await Promise.resolve();

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    expect(writeSpy).toHaveBeenCalledTimes(2);
  });

  it('does not mutate live bookmarkedFilters cache when filter write fails', async () => {
    const liveCache = { bookmarkedFilters: ['existing-filter'] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue(liveCache);
    jest.spyOn(cacheScripts, 'writeCache').mockRejectedValue(new Error('write failed'));

    const subject = createSubject({
      activeSessionSlug: 'edge',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      filterState: { types: ['radio'] },
    };

    await subject.handleBookmarkFilter();

    expect(liveCache.bookmarkedFilters).toEqual(['existing-filter']);
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

  it('polls question-mode results across list scope on /session routes', () => {
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

      expect(changed).toBe(true);
      expect(subject.state.questionLocalBlock).toBe(11);
      expect(subject.state.responseLocalBlock).toBe(13);
      expect(subject.state.cachedQuestionsCount).toBe(2);
      expect(subject.queueResultsRefresh).toHaveBeenCalledWith('poll-local-storage-change');
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
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

    expect(latestSpy).toHaveBeenCalledTimes(2);
    expect(maxInFlight).toBe(1);
    expect(subject.pollLocalStorageForUpdates).toHaveBeenCalledTimes(2);
    expect(subject.requestFetchResponses).toHaveBeenCalledTimes(2);
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
