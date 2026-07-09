import {
  areQuestionPayloadsEquivalent,
  canUseRecentQuestionPayloadForAccount,
  ensureQuestionsNet,
  ensureSurveysNet,
  mergeSurveyToolCachePatchIntoSurveysCache,
  hasCacheHydratedFlag,
  isIncomingResponseMetaNewer,
  mergeQuestionResponses,
  mergeSurveyResponsePayloads,
  readQuestionsCache,
  readQuestionsCacheAsync,
  readQuestionsCacheRef,
  readRecentQuestionPayload,
  readSurveysCache,
  readSurveysCacheAsync,
  readSurveysCacheRef,
  stampResponsePayloadWithMeta,
  toResponseRecencyMeta,
  writeQuestionsCache,
  writeSurveysCache,
} from './surveyToolCacheState.js';
import { peekCacheSync, readCache, writeCacheOptimistic } from '../../utilities/cache/cacheScripts.js';

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  peekCacheSync: jest.fn(() => null),
  readCache: jest.fn(async () => null),
  writeCacheOptimistic: jest.fn(() => Promise.resolve()),
}));

const mockedPeekCacheSync = peekCacheSync as jest.MockedFunction<typeof peekCacheSync>;
const mockedReadCache = readCache as jest.MockedFunction<typeof readCache>;
const mockedWriteCacheOptimistic = writeCacheOptimistic as jest.MockedFunction<typeof writeCacheOptimistic>;

describe('surveyToolCacheState', () => {
  beforeEach(() => {
    mockedPeekCacheSync.mockReset();
    mockedReadCache.mockReset();
    mockedWriteCacheOptimistic.mockReset();
    mockedPeekCacheSync.mockReturnValue(null);
    mockedReadCache.mockResolvedValue(null);
    mockedWriteCacheOptimistic.mockResolvedValue(undefined as never);
    window.sessionStorage.clear();
  });

  it('reads and writes scoped question/survey caches through cacheScripts', async () => {
    mockedPeekCacheSync.mockImplementation((namespace, _slug, opts) => {
      const cloneOption = (opts as { clone?: boolean } | undefined)?.clone;
      if (namespace === 'questionsCache' && cloneOption === false) return {} as never;
      if (namespace === 'surveysCache' && cloneOption === false) return {} as never;
      if (namespace === 'questionsCache') return { questions: { q1: { id: 'q1' } } } as never;
      if (namespace === 'surveysCache') return { surveys: { s1: { id: 's1' } } } as never;
      return null as never;
    });
    mockedReadCache.mockImplementation(async (namespace) => {
      if (namespace === 'questionsCache') return { questions: { q2: { id: 'q2' } } } as never;
      if (namespace === 'surveysCache') return { surveys: { s2: { id: 's2' } } } as never;
      return null as never;
    });

    expect(readQuestionsCache('edge')).toEqual({ questions: { q1: { id: 'q1' } } });
    expect(readQuestionsCacheRef('edge')).toEqual({});
    expect(await readQuestionsCacheAsync('edge')).toEqual({ questions: { q2: { id: 'q2' } } });

    expect(readSurveysCache('edge')).toEqual({ surveys: { s1: { id: 's1' } } });
    expect(readSurveysCacheRef('edge')).toEqual({});
    expect(await readSurveysCacheAsync('edge')).toEqual({ surveys: { s2: { id: 's2' } } });

    writeQuestionsCache('edge', { next: true });
    writeSurveysCache('edge', { next: true });

    expect(mockedPeekCacheSync).toHaveBeenNthCalledWith(1, 'questionsCache', 'edge');
    expect(mockedPeekCacheSync).toHaveBeenNthCalledWith(2, 'questionsCache', 'edge', { clone: false });
    expect(mockedReadCache).toHaveBeenNthCalledWith(1, 'questionsCache', 'edge');
    expect(mockedPeekCacheSync).toHaveBeenNthCalledWith(3, 'surveysCache', 'edge');
    expect(mockedPeekCacheSync).toHaveBeenNthCalledWith(4, 'surveysCache', 'edge', { clone: false });
    expect(mockedReadCache).toHaveBeenNthCalledWith(2, 'surveysCache', 'edge');
    expect(mockedWriteCacheOptimistic).toHaveBeenNthCalledWith(1, 'questionsCache', 'edge', { next: true });
    expect(mockedWriteCacheOptimistic).toHaveBeenNthCalledWith(2, 'surveysCache', 'edge', { next: true });
  });

  it('merges question responses by normalized question and responder ids', () => {
    expect(
      mergeQuestionResponses(
        {
          q1: { '0xabc': { answer: 'old' } },
        },
        {
          Q1: { '0xDEF': { answer: 'new' } },
          q2: { '0xABC': { answer: 'two' } },
        },
      ),
    ).toEqual({
      q1: {
        '0xabc': { answer: 'old' },
        '0xdef': { answer: 'new' },
      },
      q2: {
        '0xabc': { answer: 'two' },
      },
    });
  });

  it('reads recent question payloads only while they are fresh and account-matched', () => {
    const now = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

    try {
      window.sessionStorage.setItem(
        'dg:recentQuestionPayloads',
        JSON.stringify({
          q1: {
            savedAtMs: now - 1_000,
            creator: '0xAbC',
            responseJSON: { questionID: 'q1' },
          },
          stale: {
            savedAtMs: now - 13 * 60 * 60 * 1000,
            creator: '0xabc',
          },
        }),
      );

      expect(readRecentQuestionPayload('Q1')).toEqual({
        creator: '0xAbC',
        responseJSON: { questionID: 'q1' },
        id: 'q1',
      });
      expect(readRecentQuestionPayload('stale')).toBeNull();
      expect(canUseRecentQuestionPayloadForAccount(readRecentQuestionPayload('q1'), '0xabc')).toBe(true);
      expect(canUseRecentQuestionPayloadForAccount(readRecentQuestionPayload('q1'), '0xdef')).toBe(false);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('tracks cache hydration and payload equivalence without mutating content', () => {
    expect(hasCacheHydratedFlag({ cacheHasLoaded: true })).toBe(true);
    expect(hasCacheHydratedFlag({ cacheHasLoaded: false })).toBe(false);
    expect(
      areQuestionPayloadsEquivalent({ id: 'q1', responseJSON: { ok: true } }, { id: 'q1', responseJSON: { ok: true } }),
    ).toBe(true);
    expect(areQuestionPayloadsEquivalent({ id: 'q1' }, { id: 'q2' })).toBe(false);
  });

  it('initializes per-network question and survey cache buckets lazily', () => {
    expect(ensureQuestionsNet({}, '84532')).toEqual({
      '84532': {
        questionsLatestBlock: 0,
        questions: {},
        questionResponses: {},
        questionResponsesLatestBlock: 0,
      },
    });
    expect(ensureSurveysNet({}, '84532')).toEqual({
      '84532': {
        surveysLatestBlock: 0,
        surveys: {},
        surveyResponses: {},
        surveyResponsesLatestBlock: {},
      },
    });
  });

  it('merges SurveyTool cache patches into the active surveys cache bucket', () => {
    const existing = {
      '84532': {
        surveysLatestBlock: 10,
        surveys: {
          s1: { id: 's1', title: 'Existing' },
        },
        surveyResponses: {
          s1: {
            '0xabc': { responses: [{ questionID: 'q1', answer: 'old' }] },
          },
        },
        surveyResponsesLatestBlock: {
          s1: 10,
        },
      },
    };

    const result = mergeSurveyToolCachePatchIntoSurveysCache(existing, '84532', {
      surveys: {
        s2: { id: 's2', title: 'New' },
      },
      surveyResponses: {
        s1: {
          '0xdef': { responses: [{ questionID: 'q1', answer: 'new' }] },
        },
      },
      surveyResponsesLatestBlock: {
        s1: 12,
      },
    });

    expect(result).toBe(existing);
    expect(result['84532']).toEqual({
      surveysLatestBlock: 10,
      surveys: {
        s1: { id: 's1', title: 'Existing' },
        s2: { id: 's2', title: 'New' },
      },
      surveyResponses: {
        s1: {
          '0xdef': { responses: [{ questionID: 'q1', answer: 'new' }] },
        },
      },
      surveyResponsesLatestBlock: {
        s1: 12,
      },
    });
    expect(
      mergeSurveyToolCachePatchIntoSurveysCache({}, '', {
        surveys: { s1: { id: 's1' } },
      }),
    ).toEqual({});
  });

  it('compares and stamps response recency metadata in block/log order', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    try {
      expect(
        toResponseRecencyMeta({
          blockNumber: 10,
          transactionIndex: 2,
          logIndex: 1,
          timestamp: 1234,
          transactionHash: '0xhash',
        }),
      ).toEqual({
        bn: 10,
        txi: 2,
        li: 1,
        ts: 1234,
        transactionHash: '0xhash',
      });

      expect(
        isIncomingResponseMetaNewer(
          { blockNumber: 11, transactionIndex: 0, logIndex: 0, timestamp: 1200 },
          { blockNumber: 10, transactionIndex: 9, logIndex: 9, timestamp: 1300 },
        ),
      ).toBe(true);

      expect(
        stampResponsePayloadWithMeta(
          { responseJSON: { ok: true } },
          { blockNumber: 12, transactionIndex: 3, logIndex: 4, timestamp: 5678, transactionHash: '0xabc' },
        ),
      ).toEqual({
        responseJSON: { ok: true },
        blockNumber: 12,
        transactionIndex: 3,
        logIndex: 4,
        timestamp: 5678,
        transactionHash: '0xabc',
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('merges survey response payload rows by normalized question id', () => {
    expect(
      mergeSurveyResponsePayloads(
        {
          responses: [
            { questionID: 'Q1', answer: 'old' },
            { questionID: 'Q2', answer: 'keep' },
          ],
          preserved: true,
        },
        {
          responses: [
            { questionID: 'q1', answer: 'new' },
            { questionID: 'q3', answer: 'add' },
          ],
          incoming: true,
        },
      ),
    ).toEqual({
      preserved: true,
      incoming: true,
      responses: [
        { questionID: 'q1', answer: 'new' },
        { questionID: 'Q2', answer: 'keep' },
        { questionID: 'q3', answer: 'add' },
      ],
    });
  });
});
