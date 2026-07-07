import { SurveySelector } from './SurveySelector';
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

const primeQuestionCountState = (subject: any) => {
  subject.state = {
    ...subject.state,
    loading: false,
    viewMode: 'survey',
    filteredQuestionCount: 0,
    encryptedQuestionCount: 0,
  };
};

describe('SurveySelector question counts', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('resets the question count state when the selected SurveyTool session changes in questions mode', () => {
    const prevProps = {
      activeSessionSlug: 'edge',
      sessionSlug: undefined,
      network: { id: 84532 },
      isSurveyCacheReady: true,
      isQuestionCacheReady: true,
      questionResponsesNonce: 0,
      questionsCacheNonce: 0,
    };
    const subject = new SurveySelector(prevProps);
    syncClassSetState(subject);
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      filteredQuestionCount: 5,
      encryptedQuestionCount: 2,
    };

    Object.defineProperty(subject, 'props', {
      configurable: true,
      value: {
        ...prevProps,
        sessionSlug: 'rxc',
      },
    });

    subject.componentDidUpdate(prevProps, {
      ...subject.state,
      filteredQuestionCount: 5,
      encryptedQuestionCount: 2,
    });

    expect(subject.state.filteredQuestionCount).toBe(0);
    expect(subject.state.encryptedQuestionCount).toBe(0);
  });

  it('does not compute question counts from a borrowed general network when the slug is unresolved', async () => {
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('active');
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
      .mockImplementation((slug: any) => strictLookup(slug) || generalCfg);
    const readCacheSpy = jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: {
            id: 'q1',
            prompt: 'Borrowed general question',
          },
        },
      },
    } as any);

    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      activeSessionSlug: 'missing-session-slug',
    });
    syncClassSetState(subject);
    primeQuestionCountState(subject);

    await subject.computeFilteredQuestionCount();

    expect(subject.getQuestionCountContext()).toEqual({
      slug: 'missing-session-slug',
      networkID: '',
      readSlugs: ['missing-session-slug'],
      contextKey: 'missing-session-slug|',
    });
    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(subject.state.filteredQuestionCount).toBe(0);
    expect(subject.state.encryptedQuestionCount).toBe(0);
  });

  it('does not filter question counts with borrowed general blocked ids when the slug is unresolved', async () => {
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('active');
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
      BLOCKED_QUESTION_IDS: ['q1'],
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
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: {
            id: 'q1',
            prompt: 'Question 1',
          },
          q2: {
            id: 'q2',
            prompt: 'Question 2',
          },
        },
      },
    } as any);

    const subject = new SurveySelector({
      autoOpenResults: false,
      filterState: {},
      isQuestionCacheReady: true,
      isSurveyCacheReady: true,
      singleQuestionMode: false,
      network: { id: 84532 },
      activeSessionSlug: 'missing-session-slug',
    });
    syncClassSetState(subject);
    primeQuestionCountState(subject);

    await subject.computeFilteredQuestionCount();

    expect(subject.getQuestionCountContext()).toEqual({
      slug: 'missing-session-slug',
      networkID: '84532',
      readSlugs: ['missing-session-slug'],
      contextKey: 'missing-session-slug|84532',
    });
    expect(subject.state.filteredQuestionCount).toBe(2);
    expect(subject.state.encryptedQuestionCount).toBe(0);
  });

  it('aggregates SurveySelector question counts across list scope on bare /questions routes when the base session is unresolved', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['alpha', 'beta']);
      const strictLookup = (slug: unknown) => {
        if (slug === 'alpha') return { slug: 'alpha', networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        if (slug === 'beta') return { slug: 'beta', networkChainId: 84532, BLOCKED_QUESTION_IDS: ['qblockedbeta'] };
        return null;
      };
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup as any);
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup as any);
      const readCacheSpy = jest
        .spyOn(cacheScripts, 'readCache')
        .mockImplementation(async (namespace?: string, slug?: string) => {
          if (namespace !== 'questionsCache') return {};
          if (slug === 'alpha') {
            return {
              '84532': {
                questions: {
                  q1: { id: 'q1', prompt: 'Alpha 1' },
                },
              },
            };
          }
          if (slug === 'beta') {
            return {
              '84532': {
                questions: {
                  q2: { id: 'q2', prompt: '[encrypted]' },
                  qBlockedBeta: { id: 'qBlockedBeta', prompt: 'Blocked beta' },
                },
              },
            };
          }
          return {};
        });

      const subject = new SurveySelector({
        autoOpenResults: false,
        filterState: {},
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
        singleQuestionMode: false,
        activeSessionSlug: '',
      });
      syncClassSetState(subject);
      primeQuestionCountState(subject);

      await subject.computeFilteredQuestionCount();

      expect(subject.getQuestionCountContext()).toEqual({
        slug: '',
        networkID: '84532',
        readSlugs: ['', 'alpha', 'beta'],
        contextKey: '__general__|alpha|beta|84532',
      });
      expect(readCacheSpy).toHaveBeenCalledWith('questionsCache', '');
      expect(readCacheSpy).toHaveBeenCalledWith('questionsCache', 'alpha');
      expect(readCacheSpy).toHaveBeenCalledWith('questionsCache', 'beta');
      expect(subject.state.filteredQuestionCount).toBe(2);
      expect(subject.state.encryptedQuestionCount).toBe(1);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('keeps SurveySelector question counts session-local on /session routes even when list scope includes other slugs', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      const readScopeSlugsSpy = jest
        .spyOn(sessionScanScope, 'readSessionScanSlugs')
        .mockReturnValue(['edge', 'alpha', 'beta']);
      const strictLookup = (slug: unknown) => {
        if (slug === 'edge') return { slug: 'edge', networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        if (slug === 'alpha') return { slug: 'alpha', networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        if (slug === 'beta') return { slug: 'beta', networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        return null;
      };
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup as any);
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup as any);
      const readCacheSpy = jest
        .spyOn(cacheScripts, 'readCache')
        .mockImplementation(async (namespace?: string, slug?: string) => {
          if (namespace !== 'questionsCache') return {};
          if (slug === 'edge') {
            return {
              '84532': {
                questions: {
                  q1: { id: 'q1', prompt: 'Edge 1' },
                },
              },
            };
          }
          if (slug === 'alpha') {
            return {
              '84532': {
                questions: {
                  q2: { id: 'q2', prompt: '[encrypted]' },
                },
              },
            };
          }
          if (slug === 'beta') {
            return {
              '84532': {
                questions: {
                  q3: { id: 'q3', prompt: 'Beta 3' },
                },
              },
            };
          }
          return {};
        });

      const subject = new SurveySelector({
        autoOpenResults: false,
        filterState: {},
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
        singleQuestionMode: false,
        activeSessionSlug: 'edge',
      });
      syncClassSetState(subject);
      primeQuestionCountState(subject);

      await subject.computeFilteredQuestionCount();

      expect(subject.getQuestionCountContext()).toEqual({
        slug: 'edge',
        networkID: '84532',
        readSlugs: ['edge'],
        contextKey: 'edge|84532',
      });
      expect(readCacheSpy).toHaveBeenCalledWith('questionsCache', 'edge');
      expect(readCacheSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha');
      expect(readCacheSpy).not.toHaveBeenCalledWith('questionsCache', 'beta');
      expect(readScopeSlugsSpy).not.toHaveBeenCalled();
      expect(subject.state.filteredQuestionCount).toBe(1);
      expect(subject.state.encryptedQuestionCount).toBe(0);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('dedupes SurveySelector question counts across scoped slugs before applying encrypted totals', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['alpha', 'beta']);
      const strictLookup = (slug: unknown) => {
        if (slug === 'alpha') return { slug: 'alpha', networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        if (slug === 'beta') return { slug: 'beta', networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
        return null;
      };
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup as any);
      jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup as any);
      const readCacheSpy = jest
        .spyOn(cacheScripts, 'readCache')
        .mockImplementation(async (namespace?: string, slug?: string) => {
          if (namespace !== 'questionsCache') return {};
          if (slug === 'alpha') {
            return {
              '84532': {
                questions: {
                  q1: { id: 'q1', prompt: 'Alpha question' },
                },
              },
            };
          }
          if (slug === 'beta') {
            return {
              '84532': {
                questions: {
                  q1: { id: 'q1', prompt: '[encrypted]' },
                  q2: { id: 'q2', prompt: '[encrypted]' },
                },
              },
            };
          }
          return {};
        });

      const subject = new SurveySelector({
        autoOpenResults: false,
        filterState: {},
        isQuestionCacheReady: true,
        isSurveyCacheReady: true,
        singleQuestionMode: false,
        activeSessionSlug: '',
      });
      syncClassSetState(subject);
      primeQuestionCountState(subject);

      await subject.computeFilteredQuestionCount();

      expect(subject.getQuestionCountContext()).toEqual({
        slug: '',
        networkID: '84532',
        readSlugs: ['', 'alpha', 'beta'],
        contextKey: '__general__|alpha|beta|84532',
      });
      expect(readCacheSpy).toHaveBeenCalledWith('questionsCache', '');
      expect(readCacheSpy).toHaveBeenCalledWith('questionsCache', 'alpha');
      expect(readCacheSpy).toHaveBeenCalledWith('questionsCache', 'beta');
      expect(subject.state.filteredQuestionCount).toBe(2);
      expect(subject.state.encryptedQuestionCount).toBe(1);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });
});
