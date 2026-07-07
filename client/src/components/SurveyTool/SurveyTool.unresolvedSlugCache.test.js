import { screen } from '@testing-library/react';

import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import { resolveQuestionPayloadCacheWriteContext } from './surveyToolUtils.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

const MISSING_SLUG = 'missing-session-slug';

const borrowedGeneralQuestionsCache = {
  84532: {
    questions: {
      q1: { id: 'q1', type: 'freeform', prompt: 'Borrowed general prompt' },
      qGeneral: { id: 'qGeneral', type: 'freeform', prompt: 'Borrowed general prompt' },
    },
    questionResponses: {},
  },
};

const setupUnresolvedSessionLookup = () => {
  const generalCfg = {
    slug: '',
    networkChainId: 84532,
  };
  const strictLookup = jest.fn((slug) =>
    String(slug || '')
      .trim()
      .toLowerCase() === ''
      ? generalCfg
      : null,
  );
  jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault')
    .mockImplementation((slug) => strictLookup(slug) || generalCfg);
  return strictLookup;
};

const renderUnresolvedPile = (props = {}) =>
  renderSurveyPileViewMode({
    minifiedMode: 'pile',
    account: '',
    sessionSlug: MISSING_SLUG,
    activeSessionSlug: '',
    isQuestionCacheReady: true,
    questionResponsesNonce: 1,
    questionsCacheNonce: 1,
    onFilterChange: jest.fn(),
    network: null,
    networkChainId: null,
    runtimeStrategy: createPileViewRuntimeStrategy(),
    ...props,
  });

describe('SurveyTool unresolved slug cache guards', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('does not write fetched question payloads into a borrowed general network cache when the slug is unresolved', () => {
    const strictLookup = setupUnresolvedSessionLookup();

    const cacheWriteContext = resolveQuestionPayloadCacheWriteContext(
      {
        activeSessionSlug: '',
        sessionSlug: MISSING_SLUG,
        network: null,
        networkChainId: null,
      },
      MISSING_SLUG,
    );

    // port note: dropped direct cacheQuestionPayloadForSlug invocation; the
    // no-write guard is the unresolved cache-write context returning no network
    // id before that method reads or writes questionsCache. ensureQuestionCached
    // unresolved write-through is covered in SurveyTool.singleQuestionCacheWrites.
    expect(cacheWriteContext).toMatchObject({
      sessionSlug: MISSING_SLUG,
      sessionConfig: null,
      networkId: null,
      networkIdStr: '',
      error: `Session config not found for "${MISSING_SLUG}".`,
    });
    expect(strictLookup).toHaveBeenCalledWith(MISSING_SLUG);
    expect(strictLookup).not.toHaveBeenCalledWith('');
  });

  it('does not warm pile state from a borrowed general network cache when the slug is unresolved', () => {
    setupUnresolvedSessionLookup();
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace !== 'questionsCache') return {};
      return borrowedGeneralQuestionsCache;
    });

    renderUnresolvedPile();

    expect(screen.queryByText('Borrowed general prompt')).toBeNull();
    expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', MISSING_SLUG, { clone: false });
  });

  it('does not load/sort pile questions from a borrowed general network cache when the slug is unresolved', () => {
    setupUnresolvedSessionLookup();
    const readCacheSpy = jest
      .spyOn(cacheScripts, 'readCache')
      .mockImplementation((namespace) =>
        Promise.resolve(namespace === 'questionsCache' ? borrowedGeneralQuestionsCache : {}),
      );

    renderUnresolvedPile();

    expect(screen.getByText(/Loading\.\.\./)).toBeInTheDocument();
    expect(screen.queryByText('Borrowed general prompt')).toBeNull();
    expect(readCacheSpy.mock.calls.filter(([namespace]) => namespace === 'questionsCache')).toEqual([]);
  });
});
