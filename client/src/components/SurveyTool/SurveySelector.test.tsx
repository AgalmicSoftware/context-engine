import { SurveySelector } from './SurveySelector';
import { normalizeSurveyToolFilterState } from './surveyToolUtils.js';
import ConnectedSurveyResults from './SurveyResults';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';
import styles from './SurveyTool.module.scss';
import { renderToStaticMarkup } from 'react-dom/server';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const syncClassSetState = (subject: any) => {
  subject.setState = jest.fn((next: any, cb?: () => void) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    if (patch && typeof patch === 'object') {
      subject.state = { ...subject.state, ...patch };
    }
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject.setState;
};

const findElement = (node: any, predicate: (candidate: any) => boolean): any => {
  const stack = [node];
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

const nodeHasClassName = (node: any, className: string): boolean => {
  const value = node?.props?.className;
  if (typeof value !== 'string') return false;
  return value.split(/\s+/).includes(className);
};

const countElements = (node: any, predicate: (candidate: any) => boolean): number => {
  let count = 0;
  const stack = [node];
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
    if (predicate(current)) count += 1;
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return count;
};

const treeHasText = (node: any, text: string): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

describe('SurveySelector', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('coalesces SurveySelector auto-open and filter-state sync into one state patch', () => {
    const subject = new SurveySelector({
      autoOpenResults: true,
      filterState: { questionTypes: ['rating'] },
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      questionsCacheNonce: 4,
    });
    subject.fetchSurveys = jest.fn();
    subject.computeFilteredQuestionCount = jest.fn();
    subject.state = {
      ...subject.state,
      showResults: false,
      filterState: { questionTypes: ['binary'] },
      showLongLoading: false,
      loading: false,
    };
    subject._filterStateSig = '';
    syncClassSetState(subject);

    const prevProps = {
      ...subject.props,
      autoOpenResults: false,
      filterState: { questionTypes: ['binary'] },
      questionsCacheNonce: 4,
    };

    subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.setState).toHaveBeenCalledTimes(1);
    const patch = (subject.setState as jest.Mock).mock.calls[0][0];
    expect(patch).toMatchObject({ showResults: true });
    expect(patch.filterState).toEqual(
      normalizeSurveyToolFilterState({ questionTypes: ['rating'] })
    );
  });

  it('does not read SurveySelector survey list from a borrowed general network when the slug is unresolved', async () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug: unknown) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup as any);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug: any) => (
      (strictLookup(slug) || generalCfg) as any
    ));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const readCacheSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace: string) => {
      if (namespace === 'surveysCache') {
        return {
          '84532': {
            surveys: {
              '0xsurvey': {
                id: '0xsurvey',
                surveyID: '0xsurvey',
                title: 'Borrowed Survey',
                questionIDs: ['q1'],
              },
            },
          },
        };
      }
      return null as any;
    });

    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
    });
    subject.updateSelectedSurvey = jest.fn();
    subject.state = {
      ...subject.state,
      surveys: [{ id: 'stale-survey', title: 'Stale Survey', questionIDs: ['q1'] }],
      showLongLoading: false,
      loading: false,
    };
    syncClassSetState(subject);
    readCacheSpy.mockClear();

    await subject.fetchSurveys();

    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(subject.state.surveys).toEqual([]);
    expect(subject.state.loading).toBe(false);
    expect(subject.updateSelectedSurvey).not.toHaveBeenCalled();
  });

  it('ignores semantically unchanged external filter props after a local clear so header clear does not snap back', () => {
    const activeFilter = { responseStatus: { responded: true, notResponded: false } };
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: activeFilter,
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      questionsCacheNonce: 4,
      questionResponsesNonce: 2,
    });
    subject.fetchSurveys = jest.fn();
    subject.computeFilteredQuestionCount = jest.fn();
    subject.state = {
      ...subject.state,
      showResults: false,
      showLongLoading: false,
      loading: false,
      filterState: {},
    };
    subject._filterStateSig = '';
    syncClassSetState(subject);

    const prevProps = {
      ...subject.props,
      filterState: { responseStatus: { responded: true, notResponded: false } },
    };
    Object.defineProperty(subject, 'props', {
      configurable: true,
      value: {
        ...subject.props,
        filterState: { responseStatus: { responded: true, notResponded: false } },
      },
    });

    subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.setState).not.toHaveBeenCalled();
    expect(subject.state.filterState).toEqual({});
    expect(subject._filterStateSig).toBe('');
  });

  it('forces SurveySelector results closed via closeShowResults when currently open', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      questionsCacheNonce: 4,
      preventUrlChange: true,
    });
    subject.fetchSurveys = jest.fn();
    subject.computeFilteredQuestionCount = jest.fn();
    subject.state = {
      ...subject.state,
      showResults: true,
      viewMode: 'questions',
    };
    syncClassSetState(subject);

    subject.closeShowResults();

    expect(subject.setState).toHaveBeenCalledTimes(1);
    expect(subject.setState).toHaveBeenCalledWith({ showResults: false });
    expect(subject.state.showResults).toBe(false);
  });

  it('keeps SurveySelector showLongLoading clear semantics when cache is ready and loading is false', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/surveys');
    try {
      const subject = new SurveySelector({
        autoOpenResults: false,
        filterState: {},
        isQuestionCacheReady: false,
        isSurveyCacheReady: true,
        singleQuestionMode: false,
        network: { id: 84532 },
        activeSessionSlug: 'edge',
        questionsCacheNonce: 4,
      });
      subject.fetchSurveys = jest.fn();
      subject.computeFilteredQuestionCount = jest.fn();
      subject.state = {
        ...subject.state,
        showLongLoading: true,
        loading: false,
      };
      subject._filterStateSig = '';
      syncClassSetState(subject);

      const prevProps = {
        ...subject.props,
        filterState: subject.props.filterState,
        questionsCacheNonce: subject.props.questionsCacheNonce,
      };

      subject.componentDidUpdate(prevProps, subject.state);

      expect(subject.setState).toHaveBeenCalledTimes(1);
      expect((subject.setState as jest.Mock).mock.calls[0][0]).toEqual({ showLongLoading: false });
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('recomputes SurveySelector question count on questionResponsesNonce tick', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
      questionsCacheNonce: 4,
      questionResponsesNonce: 2,
    });
    subject.fetchSurveys = jest.fn();
    subject.computeFilteredQuestionCount = jest.fn();
    subject.state = {
      ...subject.state,
      showLongLoading: false,
      loading: false,
    };

    const prevProps = {
      ...subject.props,
      questionResponsesNonce: 1,
    };

    subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.computeFilteredQuestionCount).toHaveBeenCalledTimes(1);
  });

  it('recomputes SurveySelector question count when only networkChainId changes', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      networkChainId: 84532,
      activeSessionSlug: 'edge',
      questionsCacheNonce: 4,
      questionResponsesNonce: 2,
    });
    subject.fetchSurveys = jest.fn();
    subject.computeFilteredQuestionCount = jest.fn();
    subject.clearStickyQuestionCountSnapshot = jest.fn();
    subject.state = {
      ...subject.state,
      showLongLoading: false,
      loading: false,
    };
    syncClassSetState(subject);

    const prevProps = {
      ...subject.props,
      networkChainId: 84531,
    };

    subject.componentDidUpdate(prevProps, subject.state);

    expect(subject.clearStickyQuestionCountSnapshot).toHaveBeenCalledTimes(1);
    expect(subject.fetchSurveys).toHaveBeenCalledTimes(1);
    expect(subject.computeFilteredQuestionCount).toHaveBeenCalledTimes(1);
  });

  it('passes the session chain through when SurveySelector opens SurveyResults', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      networkChainId: 11155420,
      activeSessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      showResults: true,
      showLongLoading: false,
    };

    const tree = subject.render();
    const resultsNode = findElement(tree, (candidate) => candidate?.type === ConnectedSurveyResults);

    expect(resultsNode).toBeTruthy();
    expect(resultsNode.props.networkChainId).toBe(11155420);
  });

  it('renders SurveySelector selected-survey doc link when document URLs exist', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'survey',
      showLongLoading: false,
      surveys: [
        {
          id: 'survey-with-docs',
          title: 'Survey with docs',
          documentURLs: [
            'https://example.com/docs/one',
            'https://example.com/docs/two',
          ],
        },
      ],
      selectedSurveyIndex: 0,
    };
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.areSurveySpecificQuestionsLoaded = jest.fn(() => true);

    const tree = subject.render();
    const docLink = findElement(
      tree,
      (element) => element?.type === 'a' && element?.props?.href === 'https://example.com/docs/one'
    );

    expect(docLink).toBeTruthy();
    expect(docLink?.props?.title).toBe('2 documents');
  });

  it('renders SurveySelector dropdown survey-entry doc link when document URLs exist', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'survey',
      showLongLoading: false,
      surveys: [
        {
          id: 'survey-with-docs',
          title: 'Survey with docs',
          documentURLs: [
            'https://example.com/docs/one',
            'https://example.com/docs/two',
          ],
        },
      ],
      selectedSurveyIndex: null,
    };
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.areSurveySpecificQuestionsLoaded = jest.fn(() => true);

    const tree = subject.render();
    const docLink = findElement(
      tree,
      (element) => (
        element?.type === 'a' &&
        element?.props?.href === 'https://example.com/docs/one' &&
        nodeHasClassName(element, 'surveyItemDocLink')
      )
    );

    expect(docLink).toBeTruthy();
    expect(docLink?.props?.title).toBe('2 documents');
  });

  it('shows the questions selector encrypted count only while the dropdown is open', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      filteredQuestionCount: 12,
      encryptedQuestionCount: 1,
      showLongLoading: false,
      selectorDropdownOpen: false,
    };
    syncClassSetState(subject);
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.handleFilteredQuestionCountUpdate(12, 1);

    const closedTree = subject.render();
    const questionToggle = findElement(
      closedTree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_TOGGLE
    );
    const closedEncryptedCountBadge = findElement(
      closedTree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_ENCRYPTED_COUNT
    );

    expect(questionToggle).toBeTruthy();
    expect(closedEncryptedCountBadge).toBeNull();

    subject.state = {
      ...subject.state,
      selectorDropdownOpen: true,
    };

    const openTree = subject.render();
    const openEncryptedCountBadge = findElement(
      openTree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_ENCRYPTED_COUNT
    );

    expect(openEncryptedCountBadge).toBeTruthy();
    expect(openEncryptedCountBadge?.props?.['data-ce-encrypted-question-count']).toBe('1');
    expect(treeHasText(openEncryptedCountBadge, '1')).toBe(true);
  });

  it('keeps the last valid questions selector count visible while same-session loading is active', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    syncClassSetState(subject);
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      filteredQuestionCount: 12,
      encryptedQuestionCount: 1,
      showLongLoading: false,
      selectorDropdownOpen: false,
    };

    subject.handleFilteredQuestionCountUpdate(12, 1);

    Object.defineProperty(subject, 'props', {
      configurable: true,
      value: {
        ...subject.props,
        isQuestionCacheReady: false,
      },
    });
    subject.state = {
      ...subject.state,
      loading: true,
      filteredQuestionCount: 0,
      encryptedQuestionCount: 0,
      showLongLoading: true,
    };

    const tree = subject.render();
    const questionToggle = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_TOGGLE
    );
    const questionToggleCount = findElement(
      questionToggle,
      (element) => nodeHasClassName(element, styles.questionSelectorCount)
    );
    const loadingSpinner = findElement(
      questionToggle,
      (element) => element?.props?.icon?.iconName === 'spinner'
    );

    expect(questionToggle).toBeTruthy();
    expect(questionToggleCount).toBeTruthy();
    expect(loadingSpinner).toBeTruthy();
    expect(treeHasText(questionToggle, 'Loading...')).toBe(true);
    expect(renderToStaticMarkup(questionToggleCount)).toContain('(12)');
    expect(renderToStaticMarkup(questionToggleCount)).not.toContain('(0)');
  });

  it('shows an immediate Loading label for the questions selector while question cache bootstrap is still pending', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: false,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    syncClassSetState(subject);
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      filteredQuestionCount: 0,
      encryptedQuestionCount: 0,
      showLongLoading: false,
      selectorDropdownOpen: false,
    };

    const tree = subject.render();
    const questionToggle = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_TOGGLE
    );

    expect(questionToggle).toBeTruthy();
    expect(treeHasText(questionToggle, 'Loading...')).toBe(true);
  });

  it('keeps the open questions dropdown row aligned to the sticky count and encrypted badge while loading', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    syncClassSetState(subject);
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      filteredQuestionCount: 12,
      encryptedQuestionCount: 1,
      showLongLoading: false,
      selectorDropdownOpen: true,
    };

    subject.handleFilteredQuestionCountUpdate(12, 1);

    Object.defineProperty(subject, 'props', {
      configurable: true,
      value: {
        ...subject.props,
        isQuestionCacheReady: false,
      },
    });
    subject.state = {
      ...subject.state,
      loading: false,
      filteredQuestionCount: 0,
      encryptedQuestionCount: 0,
      selectorDropdownOpen: true,
    };

    const tree = subject.render();
    const encryptedCountBadge = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_ENCRYPTED_COUNT
    );
    const loadingSpinnerCount = countElements(
      tree,
      (element) => element?.props?.icon?.iconName === 'spinner'
    );
    const stickyCountNodeTotal = countElements(
      tree,
      (element) => (
        nodeHasClassName(element, styles.questionSelectorCount) &&
        renderToStaticMarkup(element).includes('(12)')
      )
    );

    expect(loadingSpinnerCount).toBeGreaterThanOrEqual(2);
    expect(stickyCountNodeTotal).toBeGreaterThanOrEqual(2);
    expect(encryptedCountBadge).toBeTruthy();
    expect(encryptedCountBadge?.props?.['data-ce-encrypted-question-count']).toBe('1');
    expect(treeHasText(encryptedCountBadge, '1')).toBe(true);
  });

  it('does not reuse the sticky questions selector count after a session switch', () => {
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'edge',
    });
    syncClassSetState(subject);
    subject.fetchSurveys = jest.fn();
    subject.computeFilteredQuestionCount = jest.fn();
    subject.getParsedQuestionsCacheForRender = jest.fn(() => ({}));
    subject.state = {
      ...subject.state,
      loading: false,
      viewMode: 'questions',
      filteredQuestionCount: 12,
      encryptedQuestionCount: 1,
      showLongLoading: false,
      selectorDropdownOpen: false,
    };

    subject.handleFilteredQuestionCountUpdate(12, 1);

    const prevProps = { ...subject.props };
    Object.defineProperty(subject, 'props', {
      configurable: true,
      value: {
        ...subject.props,
        activeSessionSlug: 'alpha',
        isQuestionCacheReady: false,
      },
    });
    subject.state = {
      ...subject.state,
      loading: true,
      filteredQuestionCount: 0,
      encryptedQuestionCount: 0,
      showLongLoading: true,
    };

    subject.componentDidUpdate(prevProps, subject.state);

    const tree = subject.render();
    const questionToggle = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_TOGGLE
    );
    const questionToggleCount = findElement(
      questionToggle,
      (element) => nodeHasClassName(element, styles.questionSelectorCount)
    );
    const encryptedCountBadge = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === E2E_TESTIDS.SURVEY_QUESTIONS_ENCRYPTED_COUNT
    );

    expect(questionToggle).toBeTruthy();
    expect(questionToggleCount).toBeTruthy();
    expect(renderToStaticMarkup(questionToggleCount)).not.toContain('(12)');
    expect(renderToStaticMarkup(questionToggleCount)).toContain('(0)');
    expect(encryptedCountBadge).toBeNull();
  });

});
