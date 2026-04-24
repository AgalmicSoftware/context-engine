import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ConnectedSurveyResults, {
  countQuestionModeResponses,
  hasAnyCountableSurveyAnswer,
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
      expect(subject.getQuestionReadSlugs('questions')).toEqual(['edge', 'alpha']);
      expect(Object.keys(subject.state.aggregatorQuestionResponses).sort()).toEqual(['q1', 'q2']);
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
    expect(subject.getQuestionReadSlugs('questions')).toEqual(['beta', 'edge', 'alpha']);
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
    expect(scss).toMatch(/\.demoResultsAtlasSurface\s*{[\s\S]*?padding:\s*1rem;/);
    expect(scss).toMatch(/\.demoResultsAtlasSurface\s*{[\s\S]*?border:\s*1px solid rgba\(19,\s*34,\s*86,\s*0\.2\);/);
    expect(scss).toMatch(/\.demoResultsAtlasSurface\s*{[^}]*background:\s*[^;]*rgba\(18,\s*28,\s*67,\s*0\.96\)[^;]*rgba\(8,\s*12,\s*28,\s*0\.995\)[^;]*;/);
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

    expect(screen.getByTestId('ce-surveyresults-demo-view-report')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('ce-surveyresults-demo-surface-report')).not.toBeInTheDocument();
    expect(mockPolisReport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-report'));
    rerenderSubject();

    await waitFor(() => {
      expect(screen.getByTestId('ce-surveyresults-demo-surface-report')).toBeInTheDocument();
    });
    expect(mockPolisReport).toHaveBeenCalled();
    expect(subject.state.demoResultsViewMode).toBe('report');
    expect(screen.getByTestId('ce-surveyresults-demo-view-report')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-report'));
    rerenderSubject();

    await waitFor(() => {
      expect(screen.queryByTestId('ce-surveyresults-demo-surface-report')).not.toBeInTheDocument();
    });
    expect(subject.state.demoResultsViewMode).toBe('raw');
    expect(screen.getByTestId('ce-surveyresults-demo-view-report')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-breakdown'));
    rerenderSubject();

    await waitFor(() => {
      expect(screen.getByTestId('surveyresults-demo-breakdown-view')).toBeInTheDocument();
    });
    expect(subject.state.demoResultsViewMode).toBe('breakdown');

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-riskMatrix'));
    rerenderSubject();

    const riskMatrixView = await screen.findByTestId('surveyresults-demo-risk-matrix-view');
    expect(riskMatrixView).toBeInTheDocument();
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
      exportType: '.csv',
      aggregateQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();

    expect(treeHasText(tree, '.csv')).toBe(true);
    expect(treeHasText(tree, '.json')).toBe(true);
    expect(treeHasText(tree, 'CSV (Responses)')).toBe(false);
    expect(treeHasText(tree, 'CSV (Questions)')).toBe(false);
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
