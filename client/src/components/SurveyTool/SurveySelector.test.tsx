import { LazyCreateQuestionsAndSurveys, LazySurveyResults, SurveySelector } from './SurveySelector';
import { normalizeSurveyToolFilterState, serializeSurveyToolFilterState } from './surveyToolUtils.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';

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
    expect(patch.filterState).toEqual(normalizeSurveyToolFilterState({ questionTypes: ['rating'] }));
  });

  it('does not read SurveySelector survey list from a borrowed general network when the slug is unresolved', async () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug: unknown) =>
      String(slug || '')
        .trim()
        .toLowerCase() === ''
        ? generalCfg
        : null;
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup as any);
    jest
      .spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault')
      .mockImplementation((slug: any) => (strictLookup(slug) || generalCfg) as any);
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

  it('preserves session query params and hash when applying a SurveySelector filter', () => {
    const priorUrl = window.location.href;
    window.history.replaceState(
      {},
      '',
      '/questions?session=edge&sessionSlug=alias&sessionId=0xabc&sid=short&chainId=84532&view=list#question-list',
    );
    try {
      const subject = new SurveySelector({
        autoOpenResults: false,
        filterState: {},
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
        filterState: {},
        showLongLoading: false,
        loading: false,
      };
      subject._filterStateSig = '';
      syncClassSetState(subject);

      const nextFilterState = normalizeSurveyToolFilterState({ questionTypes: ['rating'] });
      subject.handleFilteredQuestionsWithState([], nextFilterState);

      const params = new URLSearchParams(window.location.search);
      expect(window.location.pathname).toBe('/questions');
      expect(params.get('session')).toBe('edge');
      expect(params.get('sessionSlug')).toBe('alias');
      expect(params.get('sessionId')).toBe('0xabc');
      expect(params.get('sid')).toBe('short');
      expect(params.get('chainId')).toBe('84532');
      expect(params.get('view')).toBe('list');
      expect(params.get('filter')).toBe(serializeSurveyToolFilterState(nextFilterState));
      expect(window.location.hash).toBe('#question-list');
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('removes only the filter query param when clearing a SurveySelector filter', () => {
    const priorUrl = window.location.href;
    const activeFilterState = normalizeSurveyToolFilterState({ questionTypes: ['rating'] });
    const activeFilter = serializeSurveyToolFilterState(activeFilterState);
    window.history.replaceState(
      {},
      '',
      `/questions?session=edge&sessionSlug=alias&sessionId=0xabc&sid=short&chainId=84532&filter=${activeFilter}#question-list`,
    );
    try {
      const subject = new SurveySelector({
        autoOpenResults: false,
        filterState: activeFilterState,
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
        filterState: activeFilterState,
        showLongLoading: false,
        loading: false,
      };
      subject._filterStateSig = activeFilter;
      syncClassSetState(subject);

      subject.handleFilteredQuestionsWithState([], {});

      const params = new URLSearchParams(window.location.search);
      expect(window.location.pathname).toBe('/questions');
      expect(params.get('session')).toBe('edge');
      expect(params.get('sessionSlug')).toBe('alias');
      expect(params.get('sessionId')).toBe('0xabc');
      expect(params.get('sid')).toBe('short');
      expect(params.get('chainId')).toBe('84532');
      expect(params.has('filter')).toBe(false);
      expect(window.location.hash).toBe('#question-list');
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
      activeSessionSlug: '',
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
    const resultsNode = findElement(tree, (candidate) => candidate?.type === LazySurveyResults);

    expect(resultsNode).toBeTruthy();
    expect(resultsNode.props.networkChainId).toBe(11155420);
  });

  it('renders the survey authoring surface through the lazy chunk boundary', () => {
    const sessionConfig = { slug: 'edge', networkChainId: 11155420 };
    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 11155420 },
      networkChainId: 11155420,
      activeSessionSlug: 'edge',
      sessionName: 'Edge Session',
      sessionConfig,
      cache: { questions: {} },
      updateCache: jest.fn(),
      toggleLoginModal: jest.fn(),
    });
    subject.state = {
      ...subject.state,
      loading: false,
      createSurveyMode: true,
      showResults: false,
      showLongLoading: false,
      surveys: [{ id: '0xsurvey', title: 'Survey', questionIDs: ['0xq'] }],
      selectedSurveyIndex: 0,
    };

    const tree = subject.render();
    const authoringNode = findElement(tree, (candidate) => candidate?.type === LazyCreateQuestionsAndSurveys);

    expect(authoringNode).toBeTruthy();
    expect(authoringNode.props.expanded).toBe(true);
    expect(authoringNode.props.sessionConfig).toBe(sessionConfig);
    expect(authoringNode.props.sessionName).toBe('Edge Session');
    expect(authoringNode.props.surveyIndex).toBe(0);
  });
});
