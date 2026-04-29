import { QuestionsDashboard } from './SurveySelector';
import { SurveyQuestions } from './SurveyQuestions';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';

const syncClassSetState = (subject: any) => {
  subject.setState = jest.fn((next: any, cb?: () => void) => {
    const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject.setState;
};

const mockPeekQuestionsCache = (questionCachesBySlug: Record<string, any>) =>
  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace?: string, slug?: string) => {
    if (namespace !== 'questionsCache') return {};
    return questionCachesBySlug[String(slug || '')] || {};
  });

const buildQuestionMapByIdLower = (questions: any[]) =>
  new Map<string, any>(questions.map((q: any) => [String(q.id).toLowerCase(), q] as [string, any]));

const makeLegacySessionConfig = (slug: unknown, extra: Record<string, unknown> = {}) => ({
  slug: String(slug || ''),
  networkChainId: 84532,
  __registry: {
    registryChainId: 84532,
    sessionIdHex: '0x00112233445566778899aabbccddeeff',
  },
  ...extra,
});

const findFirstNodeByType = (node: any, targetType: any): any => {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFirstNodeByType(child, targetType);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (node?.type === targetType) return node;
  return findFirstNodeByType(node?.props?.children, targetType);
};

describe('QuestionsDashboard', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('reloads QuestionsDashboard when questionResponsesNonce ticks', () => {
    const subject = new QuestionsDashboard({
      activeSessionSlug: 'edge',
      network: { id: 84532 },
      isQuestionCacheReady: true,
      questionsCacheNonce: 4,
      questionResponsesNonce: 8,
      questionScanProgress: null,
    });
    subject.loadQuestions = jest.fn();

    const prevProps = {
      ...subject.props,
      questionResponsesNonce: 7,
    };

    subject.componentDidUpdate(prevProps);

    expect(subject.loadQuestions).toHaveBeenCalledTimes(1);
  });

  it('reloads QuestionsDashboard when scoped hydration progress advances', () => {
    const subject = new QuestionsDashboard({
      activeSessionSlug: 'edge',
      network: { id: 84532 },
      isQuestionCacheReady: true,
      questionsCacheNonce: 4,
      questionResponsesNonce: 8,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 5,
        hydratedQuestions: 3,
      },
    });
    subject.loadQuestions = jest.fn();

    const prevProps = {
      ...subject.props,
      questionScanProgress: {
        slug: 'edge',
        phase: 'hydrate',
        discoveredQuestions: 5,
        hydratedQuestions: 2,
      },
    };

    subject.componentDidUpdate(prevProps);

    expect(subject.loadQuestions).toHaveBeenCalledTimes(1);
  });

  it('uses the provided question pool when the scoped cache has no questions', () => {
    mockPeekQuestionsCache({
      '': {
        '11155420': {
          questions: {},
          questionResponses: {},
        },
      },
    });
    const onFilteredQuestionCountUpdate = jest.fn();
    const subject = new QuestionsDashboard({
      sessionSlug: '',
      activeSessionSlug: 'demo',
      network: { id: 11155420 },
      isQuestionCacheReady: true,
      questionPool: [
        { id: 'demo-q1', prompt: 'Demo prompt 1', source: 'demo-polis-data' },
        { id: 'demo-q2', prompt: 'Demo prompt 2', source: 'demo-polis-data' },
      ],
      onFilteredQuestionCountUpdate,
    });
    syncClassSetState(subject);

    subject.loadQuestions({ resetFilteredQuestions: true });

    expect(subject.state.questions).toEqual([
      expect.objectContaining({ id: 'demo-q1', prompt: 'Demo prompt 1', sessionSlug: '' }),
      expect.objectContaining({ id: 'demo-q2', prompt: 'Demo prompt 2', sessionSlug: '' }),
    ]);
    expect(subject.state.filteredQuestions).toHaveLength(2);
    expect(onFilteredQuestionCountUpdate).toHaveBeenCalledWith(2, 0);
  });

  it('aggregates QuestionsDashboard questions across list scope with dedupe, blocklists, and session slugs', () => {
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);
    const strictLookup = (slug: unknown) => {
      if (slug === 'edge') return makeLegacySessionConfig(slug, { BLOCKED_QUESTION_IDS: ['qblockedprimary'] });
      if (slug === 'alpha') return makeLegacySessionConfig(slug, { BLOCKED_QUESTION_IDS: ['qblockedalpha'] });
      return makeLegacySessionConfig(slug, { BLOCKED_QUESTION_IDS: [] });
    };
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup as any);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup as any);

    const questionCachesBySlug: Record<string, any> = {
      edge: {
        '84532': {
          questions: {
            q1: { prompt: 'Primary 1' },
            QDup: { prompt: 'Primary duplicate winner' },
            qBlockedPrimary: { prompt: 'Blocked primary' },
          },
          questionResponses: {},
        },
      },
      alpha: {
        '84532': {
          questions: {
            q2: { prompt: 'Alpha 2' },
            qdup: { prompt: 'Alpha duplicate loser' },
            qBlockedAlpha: { prompt: 'Blocked alpha' },
          },
          questionResponses: {},
        },
      },
      beta: {
        '84532': {
          questions: {
            q3: { prompt: 'Beta 3' },
          },
          questionResponses: {},
        },
      },
    };
    const peekSpy = mockPeekQuestionsCache(questionCachesBySlug);

    const subject = new QuestionsDashboard({
      activeSessionSlug: 'edge',
      network: { id: 84532 },
      onFilteredQuestionCountUpdate: jest.fn(),
    });
    syncClassSetState(subject);

    subject.loadQuestions();

    const idsLower = subject.state.questions.map((q: any) => String(q.id).toLowerCase());
    expect(idsLower).toEqual(expect.arrayContaining(['q1', 'qdup', 'q2', 'q3']));
    expect(subject.state.questions).toHaveLength(4);
    expect(idsLower).not.toContain('qblockedprimary');
    expect(idsLower).not.toContain('qblockedalpha');
    expect(idsLower.filter((id: string) => id === 'qdup')).toHaveLength(1);

    const byIdLower = buildQuestionMapByIdLower(subject.state.questions);
    expect(byIdLower.get('q1')?.sessionSlug).toBe('edge');
    expect(byIdLower.get('qdup')?.sessionSlug).toBe('edge');
    expect(byIdLower.get('q2')?.sessionSlug).toBe('alpha');
    expect(byIdLower.get('q3')?.sessionSlug).toBe('beta');

    expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
    expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
    expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
  });

  it('aggregates QuestionsDashboard questions across all scope using getAllSessionSlugs', () => {
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('all');
    const readScopeSlugsSpy = jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['ignored']);
    const allSlugsSpy = jest
      .spyOn(contractScriptsModule, 'getAllSessionSlugs')
      .mockReturnValue(['edge', 'gamma', 'delta']);
    const strictLookup = (slug: unknown) => {
      if (slug === 'delta') return makeLegacySessionConfig(slug, { BLOCKED_QUESTION_IDS: ['qblockeddelta'] });
      return makeLegacySessionConfig(slug, { BLOCKED_QUESTION_IDS: [] });
    };
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup as any);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup as any);

    const questionCachesBySlug: Record<string, any> = {
      edge: {
        '84532': {
          questions: {
            q1: { prompt: 'Edge 1' },
          },
          questionResponses: {},
        },
      },
      gamma: {
        '84532': {
          questions: {
            Q1: { prompt: 'Gamma duplicate loser' },
            q2: { prompt: 'Gamma 2' },
          },
          questionResponses: {},
        },
      },
      delta: {
        '84532': {
          questions: {
            q3: { prompt: 'Delta 3' },
            qBlockedDelta: { prompt: 'Blocked delta' },
          },
          questionResponses: {},
        },
      },
    };
    mockPeekQuestionsCache(questionCachesBySlug);

    const subject = new QuestionsDashboard({
      activeSessionSlug: 'edge',
      network: { id: 84532 },
      onFilteredQuestionCountUpdate: jest.fn(),
    });
    syncClassSetState(subject);

    subject.loadQuestions();

    const idsLower = subject.state.questions.map((q: any) => String(q.id).toLowerCase());
    expect(subject.state.questions).toHaveLength(3);
    expect(idsLower).toEqual(expect.arrayContaining(['q1', 'q2', 'q3']));
    expect(idsLower).not.toContain('qblockeddelta');
    expect(idsLower.filter((id: string) => id === 'q1')).toHaveLength(1);

    const byIdLower = buildQuestionMapByIdLower(subject.state.questions);
    expect(byIdLower.get('q1')?.sessionSlug).toBe('edge');
    expect(byIdLower.get('q2')?.sessionSlug).toBe('gamma');
    expect(byIdLower.get('q3')?.sessionSlug).toBe('delta');

    expect(allSlugsSpy).toHaveBeenCalledTimes(1);
    expect(readScopeSlugsSpy).not.toHaveBeenCalled();
  });

  it('keeps QuestionsDashboard session-local on /session routes even when list scope includes other slugs', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      const readScopeSlugsSpy = jest
        .spyOn(sessionScanScope, 'readSessionScanSlugs')
        .mockReturnValue(['edge', 'alpha', 'beta']);
      const strictLookup = (slug: unknown) => makeLegacySessionConfig(slug, { BLOCKED_QUESTION_IDS: [] });
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup as any);
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup as any);

      const questionCachesBySlug: Record<string, any> = {
        edge: {
          '84532': {
            questions: {
              q1: { prompt: 'Edge 1' },
            },
            questionResponses: {},
          },
        },
        alpha: {
          '84532': {
            questions: {
              q2: { prompt: 'Alpha 2' },
            },
            questionResponses: {},
          },
        },
        beta: {
          '84532': {
            questions: {
              q3: { prompt: 'Beta 3' },
            },
            questionResponses: {},
          },
        },
      };
      const peekSpy = mockPeekQuestionsCache(questionCachesBySlug);

      const subject = new QuestionsDashboard({
        activeSessionSlug: 'edge',
        network: { id: 84532 },
        onFilteredQuestionCountUpdate: jest.fn(),
      });
      syncClassSetState(subject);

      subject.loadQuestions();

      const idsLower = subject.state.questions.map((q: any) => String(q.id).toLowerCase());
      expect(idsLower).toEqual(['q1']);
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
      expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
      expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
      expect(readScopeSlugsSpy).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('aggregates QuestionsDashboard questions across list scope on bare /questions routes when the base session is unresolved', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      const readScopeSlugsSpy = jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['alpha', 'beta']);
      const strictLookup = (slug: unknown) => {
        if (slug === 'alpha' || slug === 'beta') {
          return makeLegacySessionConfig(slug, { BLOCKED_QUESTION_IDS: [] });
        }
        return null;
      };
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup as any);
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup as any);

      const questionCachesBySlug: Record<string, any> = {
        alpha: {
          '84532': {
            questions: {
              q1: { prompt: 'Alpha 1' },
            },
            questionResponses: {},
          },
        },
        beta: {
          '84532': {
            questions: {
              q2: { prompt: 'Beta 2' },
            },
            questionResponses: {},
          },
        },
      };
      const peekSpy = mockPeekQuestionsCache(questionCachesBySlug);

      const subject = new QuestionsDashboard({
        activeSessionSlug: '',
        network: null,
        onFilteredQuestionCountUpdate: jest.fn(),
      });
      syncClassSetState(subject);

      subject.loadQuestions();

      const idsLower = subject.state.questions.map((q: any) => String(q.id).toLowerCase());
      expect(idsLower).toEqual(['q1', 'q2']);
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', '', { clone: false });
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
      expect(readScopeSlugsSpy).toHaveBeenCalledTimes(1);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('refreshes QuestionsDashboard filtered questions and count when the inherited base session changes inside the same list scope', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo', 'alpha']);
      const strictLookup = (slug: unknown) => {
        if (slug === 'demo' || slug === 'alpha') {
          return makeLegacySessionConfig(slug, { BLOCKED_QUESTION_IDS: [] });
        }
        return null;
      };
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup as any);
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup as any);

      const questionCachesBySlug: Record<string, any> = {
        demo: {
          '84532': {
            questions: {
              qDemo: { id: 'qDemo', prompt: 'Demo 1' },
            },
            questionResponses: {},
          },
        },
        alpha: {
          '84532': {
            questions: {
              qAlpha: { id: 'qAlpha', prompt: 'Alpha 1' },
            },
            questionResponses: {},
          },
        },
      };
      mockPeekQuestionsCache(questionCachesBySlug);

      const onFilteredQuestionCountUpdate = jest.fn();
      const subject = new QuestionsDashboard({
        activeSessionSlug: 'demo',
        network: { id: 84532 },
        onFilteredQuestionCountUpdate,
      });
      syncClassSetState(subject);

      subject.loadQuestions();
      expect(subject.state.filteredQuestions.map((q: any) => String(q.id))).toEqual(['qDemo', 'qAlpha']);

      onFilteredQuestionCountUpdate.mockClear();
      Object.defineProperty(subject, 'props', {
        configurable: true,
        value: {
          ...subject.props,
          activeSessionSlug: 'alpha',
        },
      });

      subject.loadQuestions();

      expect(subject.state.filteredQuestions.map((q: any) => String(q.id))).toEqual(['qAlpha', 'qDemo']);
      expect(onFilteredQuestionCountUpdate).toHaveBeenCalledWith(2, 0);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('keeps QuestionsDashboard session-local on query-pinned survey routes even when list scope includes other slugs', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/survey/0xsurvey?session=edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      const readScopeSlugsSpy = jest
        .spyOn(sessionScanScope, 'readSessionScanSlugs')
        .mockReturnValue(['edge', 'alpha', 'beta']);
      const strictLookup = (slug: unknown) => makeLegacySessionConfig(slug, { BLOCKED_QUESTION_IDS: [] });
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup as any);
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup as any);

      const questionCachesBySlug: Record<string, any> = {
        edge: {
          '84532': {
            questions: {
              q1: { prompt: 'Edge 1' },
            },
            questionResponses: {},
          },
        },
        alpha: {
          '84532': {
            questions: {
              q2: { prompt: 'Alpha 2' },
            },
            questionResponses: {},
          },
        },
        beta: {
          '84532': {
            questions: {
              q3: { prompt: 'Beta 3' },
            },
            questionResponses: {},
          },
        },
      };
      const peekSpy = mockPeekQuestionsCache(questionCachesBySlug);

      const subject = new QuestionsDashboard({
        activeSessionSlug: 'edge',
        sessionSlug: 'edge',
        network: { id: 84532 },
        onFilteredQuestionCountUpdate: jest.fn(),
      });
      syncClassSetState(subject);

      subject.loadQuestions();

      const idsLower = subject.state.questions.map((q: any) => String(q.id).toLowerCase());
      expect(idsLower).toEqual(['q1']);
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
      expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
      expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
      expect(readScopeSlugsSpy).not.toHaveBeenCalled();
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('does not read QuestionsDashboard caches from a borrowed general network when the slug is unresolved', () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
      BLOCKED_QUESTION_IDS: ['qgeneral'],
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
      .mockImplementation((slug: any) => strictLookup(slug) || generalCfg);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      '84532': {
        questions: {
          qGeneral: { prompt: 'Borrowed general prompt' },
        },
        questionResponses: {},
      },
    });
    const onFilteredQuestionCountUpdate = jest.fn();

    const subject = new QuestionsDashboard({
      activeSessionSlug: 'missing-session-slug',
      sessionSlug: 'missing-session-slug',
      onFilteredQuestionCountUpdate,
    });
    syncClassSetState(subject);

    subject.loadQuestions();

    expect(subject.state.questions).toEqual([]);
    expect(subject.state.filteredQuestions).toEqual([]);
    expect(subject.state.questionResponses).toEqual({});
    expect(onFilteredQuestionCountUpdate).toHaveBeenCalledWith(0, 0);
    expect(peekSpy).not.toHaveBeenCalled();
  });

  it('forwards hideEmbeddedDebugUi from QuestionsDashboard to standalone SurveyQuestions', () => {
    const subject = new QuestionsDashboard({
      hideEmbeddedDebugUi: true,
      account: '0xabc',
      network: { id: 84532 },
      provider: {},
      loginComplete: true,
      onPendingStatsChange: jest.fn(),
      questionFilterRef: { current: null },
      activeSessionSlug: 'edge',
      sessionSlug: 'edge',
    });
    subject.state = {
      ...subject.state,
      filterLoading: false,
      questions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
      filteredQuestions: [{ id: 'q1', type: 'freeform', prompt: 'Q1' }],
    };

    const tree = subject.render();
    const surveyQuestionsNode = findFirstNodeByType(tree, SurveyQuestions);

    expect(surveyQuestionsNode).toBeTruthy();
    expect(surveyQuestionsNode?.props?.hideEmbeddedDebugUi).toBe(true);
  });
});
