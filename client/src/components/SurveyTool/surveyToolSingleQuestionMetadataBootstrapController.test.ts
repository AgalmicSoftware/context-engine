import { resolveSingleQuestionMetadataBootstrap } from './surveyToolSingleQuestionMetadataBootstrapController';

const createCacheState = (questions: Record<string, Record<string, unknown> | null> = {}) => ({
  netIdStr: '84532',
  questionsCache: {
    '84532': {
      questions,
    },
  },
});

describe('surveyToolSingleQuestionMetadataBootstrapController', () => {
  it("returns 'skipped' when metadata exists and no refetch is needed", async () => {
    const cacheState = createCacheState({
      q1: { id: 'q1' },
    });

    await expect(
      resolveSingleQuestionMetadataBootstrap({
        questionId: 'q1',
        questionData: { id: 'q1', prompt: 'existing' },
        effectiveSingleSlug: 'edge',
        cacheState,
        forceRefetch: false,
        loginComplete: false,
        hasAccount: false,
      }),
    ).resolves.toEqual({
      status: 'skipped',
      questionData: { id: 'q1', prompt: 'existing' },
      cacheState,
    });
  });

  it('calls fetchSingleQuestionMetadataCandidates when questionData is null', async () => {
    const fetchSingleQuestionMetadataCandidates = jest.fn().mockResolvedValue({
      questionData: { id: 'q1', prompt: 'fetched' },
      effectiveSingleSlug: 'edge',
      fetchedAny: true,
      timedOutFetchCount: 0,
    });
    const resolveCacheState = jest.fn().mockResolvedValue(createCacheState());
    const normalizeSingleQuestionMetadataForCache = jest.fn().mockReturnValue({
      normalizedQuestionData: { id: 'q1', prompt: 'normalized' },
      shouldWriteQuestionPayload: false,
    });

    const result = await resolveSingleQuestionMetadataBootstrap({
      questionId: 'q1',
      questionData: null,
      effectiveSingleSlug: 'edge',
      fetchSingleQuestionMetadataCandidates,
      resolveCacheState,
      normalizeSingleQuestionMetadataForCache,
    });

    expect(fetchSingleQuestionMetadataCandidates).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error(`expected ready, got ${result.status}`);
    }

    expect(result.questionData!.prompt).toBe('normalized');
  });

  it("returns 'missing-cache-state' when cache rebind fails after fetch", async () => {
    await expect(
      resolveSingleQuestionMetadataBootstrap({
        questionId: 'q1',
        questionData: null,
        effectiveSingleSlug: 'edge',
        fetchSingleQuestionMetadataCandidates: jest.fn().mockResolvedValue({
          questionData: { id: 'q1', prompt: 'fetched' },
          effectiveSingleSlug: 'edge',
          fetchedAny: true,
          timedOutFetchCount: 0,
        }),
        resolveCacheState: jest.fn().mockResolvedValue(null),
      }),
    ).resolves.toEqual({ status: 'missing-cache-state' });
  });

  it("returns 'unavailable' with retry reason when no data fetched", async () => {
    const result = await resolveSingleQuestionMetadataBootstrap({
      questionId: 'q1',
      questionData: null,
      effectiveSingleSlug: 'edge',
      fetchSingleQuestionMetadataCandidates: jest.fn().mockResolvedValue({
        questionData: null,
        effectiveSingleSlug: 'edge',
        fetchedAny: false,
        timedOutFetchCount: 2,
      }),
      resolveCacheState: jest.fn().mockResolvedValue(createCacheState()),
    });

    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') {
      throw new Error(`expected unavailable, got ${result.status}`);
    }

    expect(result.retryReason).toBe('question-fetch-timeout');
    expect(result.timedOutFetchCount).toBe(2);
  });

  it('writes normalized data to cache when shouldWriteQuestionPayload is true', async () => {
    const normalizedQuestionData = { id: 'q1', prompt: 'normalized' };
    const writeQuestionsCache = jest.fn().mockResolvedValue(undefined);

    const result = await resolveSingleQuestionMetadataBootstrap({
      questionId: 'q1',
      questionData: null,
      effectiveSingleSlug: 'edge',
      fetchSingleQuestionMetadataCandidates: jest.fn().mockResolvedValue({
        questionData: { id: 'q1', prompt: 'fetched' },
        effectiveSingleSlug: 'edge',
        fetchedAny: true,
        timedOutFetchCount: 0,
      }),
      resolveCacheState: jest.fn().mockResolvedValue(createCacheState()),
      normalizeSingleQuestionMetadataForCache: jest.fn().mockReturnValue({
        normalizedQuestionData,
        shouldWriteQuestionPayload: true,
      }),
      writeQuestionsCache,
    });

    expect(result.status).toBe('ready');
    expect(writeQuestionsCache).toHaveBeenCalledTimes(1);
  });

  it('refetches masked metadata when loginComplete and hasAccount', async () => {
    const fetchSingleQuestionMetadataCandidates = jest.fn().mockResolvedValue({
      questionData: { id: 'q1', prompt: 'unmasked' },
      effectiveSingleSlug: 'edge',
      fetchedAny: true,
      timedOutFetchCount: 0,
    });

    const result = await resolveSingleQuestionMetadataBootstrap({
      questionId: 'q1',
      questionData: { id: 'q1', prompt: 'masked' },
      effectiveSingleSlug: 'edge',
      loginComplete: true,
      hasAccount: true,
      isMaskedQuestionPayload: jest.fn().mockReturnValue(true),
      fetchSingleQuestionMetadataCandidates,
      resolveCacheState: jest.fn().mockResolvedValue(createCacheState()),
      normalizeSingleQuestionMetadataForCache: jest.fn().mockReturnValue({
        normalizedQuestionData: { id: 'q1', prompt: 'unmasked' },
        shouldWriteQuestionPayload: false,
      }),
    });

    expect(fetchSingleQuestionMetadataCandidates).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error(`expected ready, got ${result.status}`);
    }

    expect(result.questionData!.prompt).toBe('unmasked');
  });
});
