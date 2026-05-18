import SurveyTool from './SurveyTool';
import { SurveyQuestions } from './SurveyQuestions';
import { PileViewMode } from './SurveyPileViewMode';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

describe('SurveyTool unresolved slug cache guards', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not write fetched question payloads into a borrowed general network cache when the slug is unresolved', async () => {
    const slug = 'missing-session-slug';
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (inputSlug) => (
      String(inputSlug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((inputSlug) => (
      strictLookup(inputSlug) || generalCfg
    ));

    await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
    await cacheScripts.writeCache('questionsCache', slug, {
      '84532': {
        questions: {
          qGeneral: {
            id: 'qGeneral',
            prompt: 'Borrowed general prompt',
          },
        },
        questionResponses: {},
      },
    });

    try {
      const subject = new SurveyQuestions({
        singleQuestionMode: true,
        isStandalone: false,
        surveyIndex: 0,
        questionID: 'q1',
        sessionSlug: slug,
        activeSessionSlug: '',
      });

      subject.cacheQuestionPayloadForSlug(slug, 'q1', {
        id: 'q1',
        prompt: 'Fetched prompt',
        type: 'freeform',
      });

      const questionsCache = await cacheScripts.readCache('questionsCache', slug);
      expect(questionsCache?.['84532']?.questions?.qGeneral).toEqual(expect.objectContaining({
        id: 'qGeneral',
        prompt: 'Borrowed general prompt',
      }));
      expect(questionsCache?.['84532']?.questions?.q1).toBeUndefined();
    } finally {
      await cacheScripts.removeCache('questionsCache', slug).catch(() => null);
    }
  });

  it('does not warm pile state from a borrowed general network cache when the slug is unresolved', () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return {
        '84532': {
          questions: {
            q1: { id: 'q1', type: 'freeform', prompt: 'Borrowed general prompt' },
          },
          questionResponses: {},
        },
      };
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      account: '',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      isQuestionCacheReady: true,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'missing-session-slug', { clone: false });
    expect(subject.state.pileQuestions).toEqual([]);
    expect(subject.state.allQuestionsForFilter).toEqual([]);
    expect(subject.state.loading).toBe(true);
    expect(subject.state.hasHiddenGatedQuestions).toBe(false);
  });

  it('does not load/sort pile questions from a borrowed general network cache when the slug is unresolved', async () => {
    const generalCfg = {
      slug: '',
      networkChainId: 84532,
    };
    const strictLookup = (slug) => (
      String(slug || '').trim().toLowerCase() === ''
        ? generalCfg
        : null
    );
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
    jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation((slug) => (
      strictLookup(slug) || generalCfg
    ));
    const readCacheSpy = jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      '84532': {
        questions: {
          q1: { id: 'q1', type: 'freeform', prompt: 'Borrowed general prompt' },
        },
        questionResponses: {},
      },
    });

    const shell = new SurveyTool({
      minifiedMode: 'pile',
      account: '',
      sessionSlug: 'missing-session-slug',
      activeSessionSlug: '',
      isQuestionCacheReady: true,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
    });
    const pileElement = shell.render();
    const subject = new PileViewMode(pileElement.props);

    subject.state = {
      ...subject.state,
      loading: true,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      filterState: {},
      isFilterActive: false,
      submissionComplete: false,
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      decryptingByKey: {},
    };
    subject.setState = jest.fn((update, cb) => {
      const patch = typeof update === 'function' ? update(subject.state, subject.props) : update;
      if (patch && typeof patch === 'object') {
        subject.state = { ...subject.state, ...patch };
      }
      if (typeof cb === 'function') cb();
      return patch;
    });
    subject.initializeResponseState = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateLocalCacheAnswersForRenderedIds = jest.fn((cb) => {
      if (typeof cb === 'function') cb();
    });
    subject.rehydrateDraftForRenderedIds = jest.fn();

    await subject.loadAndSortQuestions();

    expect(readCacheSpy).not.toHaveBeenCalled();
    expect(subject.state.loading).toBe(false);
    expect(subject.state.pileQuestions).toEqual([]);
    expect(subject.state.allQuestionsForFilter).toEqual([]);
    expect(subject.initializeResponseState).not.toHaveBeenCalled();
  });
});
