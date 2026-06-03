import { resolveSingleQuestionCacheBootstrap } from './surveyToolSingleQuestionCacheBootstrapController';

type TestQuestionsCache = Record<string, {
  questions: Record<string, Record<string, unknown>>;
}>;

const ensureQuestionsNet = (cache: unknown, netId: string): TestQuestionsCache => {
  const nextCache = {
    ...((cache && typeof cache === 'object') ? cache as TestQuestionsCache : {}),
  };

  nextCache[netId] = nextCache[netId] || { questions: {} };
  nextCache[netId].questions = nextCache[netId].questions || {};

  return nextCache;
};

describe('surveyToolSingleQuestionCacheBootstrapController', () => {
  it("returns 'ready' when cache state resolves immediately and no recent payload exists", async () => {
    const questionData = { id: 'q1', prompt: 'test' };

    await expect(resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      resolveCacheState: jest.fn().mockResolvedValue({
        netIdStr: '84532',
        questionsCache: {
          '84532': {
            questions: {
              q1: questionData,
            },
          },
        },
      }),
      readRecentPayload: jest.fn().mockReturnValue(null),
    })).resolves.toEqual({
      status: 'ready',
      cacheState: {
        netIdStr: '84532',
        questionsCache: {
          '84532': {
            questions: {
              q1: questionData,
            },
          },
        },
      },
      questionData,
      recentPayloadForAccount: null,
    });
  });

  it("returns 'ready' and merges recent payload into cached data when both exist", async () => {
    const writeQuestionsCache = jest.fn();

    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      account: '0xabc',
      resolveCacheState: jest.fn().mockResolvedValue({
        netIdStr: '84532',
        questionsCache: {
          '84532': {
            questions: {
              q1: { id: 'q1', prompt: 'old' },
            },
          },
        },
      }),
      readRecentPayload: jest.fn().mockReturnValue({ prompt: 'newer', creator: '0xabc' }),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      pickBetterQuestionPayload: jest.fn((_current, next) => next),
      areQuestionPayloadsEquivalent: jest.fn().mockReturnValue(false),
      writeQuestionsCache,
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error(`expected ready, got ${result.status}`);
    }

    expect(result.questionData!.prompt).toBe('newer');
    expect(writeQuestionsCache).toHaveBeenCalledTimes(1);
  });

  it('restores encrypted gated recent question payloads over stale cached shells', async () => {
    const writeQuestionsCache = jest.fn();
    const questionsCache = {
      '84532': {
        questions: {
          q1: {
            id: 'q1',
            prompt: 'stale plaintext shell',
            tags: ['old-tag'],
          },
        },
      },
    };
    const recentPayload = {
      prompt: {
        value: '*',
        encrypted: true,
        encryptedPortion: 'cipher-prompt',
      },
      encryption: {
        enabled: true,
        gates: [{ id: 'gate-alpha', type: 'sbt' }],
      },
      tags: ['gated'],
    };

    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      account: '0xabc',
      resolveCacheState: jest.fn().mockResolvedValue({
        netIdStr: '84532',
        questionsCache,
      }),
      readRecentPayload: jest.fn().mockReturnValue(recentPayload),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      pickBetterQuestionPayload: jest.fn((_current, next) => next),
      areQuestionPayloadsEquivalent: jest.fn().mockReturnValue(false),
      writeQuestionsCache,
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error(`expected ready, got ${result.status}`);
    }

    expect(result.questionData).toEqual({
      ...recentPayload,
      id: 'q1',
    });
    expect(writeQuestionsCache).toHaveBeenCalledWith('edge', {
      '84532': {
        questions: {
          q1: {
            ...recentPayload,
            id: 'q1',
          },
        },
      },
    });
  });

  it("returns 'missing-cache-state' when no cache and no recent payload", async () => {
    await expect(resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue(null),
    })).resolves.toEqual({ status: 'missing-cache-state' });
  });

  it("returns 'seeded-from-recent' with fallbackNetId when cache is missing but recent payload exists", async () => {
    const updateCacheAtomic = jest.fn(async (_key, _slug, updater) => updater({}));

    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      responderAddress: '0xresp',
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue({ prompt: 'from-recent', creator: '' }),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      resolveBootstrapNetworkId: jest.fn().mockReturnValue('84532'),
      updateCacheAtomic,
      ensureQuestionsNet: jest.fn(ensureQuestionsNet),
    });

    expect(result.status).toBe('seeded-from-recent');
    if (result.status !== 'seeded-from-recent') {
      throw new Error(`expected seeded-from-recent, got ${result.status}`);
    }

    expect(result.shouldBootstrapViewedResponse).toBe(true);
    expect(result.fallbackNetId).toBe('84532');
    expect(result.cacheState).not.toBeNull();
  });

  it("returns 'seeded-from-recent' with null cacheState when fallbackNetId is empty", async () => {
    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue({ prompt: 'recent' }),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      resolveBootstrapNetworkId: jest.fn().mockReturnValue(''),
    });

    expect(result.status).toBe('seeded-from-recent');
    if (result.status !== 'seeded-from-recent') {
      throw new Error(`expected seeded-from-recent, got ${result.status}`);
    }

    expect(result.fallbackNetId).toBe('');
    expect(result.cacheState).toBeNull();
  });

  it('seeds recent payload into cache when cached qData is missing for the questionId', async () => {
    const writeQuestionsCache = jest.fn();

    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      resolveCacheState: jest.fn().mockResolvedValue({
        netIdStr: '84532',
        questionsCache: {
          '84532': {
            questions: {},
          },
        },
      }),
      readRecentPayload: jest.fn().mockReturnValue({ prompt: 'seeded' }),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      writeQuestionsCache,
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error(`expected ready, got ${result.status}`);
    }

    expect(result.questionData!.prompt).toBe('seeded');
    expect(writeQuestionsCache).toHaveBeenCalled();
  });

  it('normalizes creator and tags on seeded question data', async () => {
    const updateCacheAtomic = jest.fn(async (_key, _slug, updater) => updater({}));

    const result = await resolveSingleQuestionCacheBootstrap({
      questionId: 'q1',
      effectiveSingleSlug: 'edge',
      resolveCacheState: jest.fn().mockResolvedValue(null),
      readRecentPayload: jest.fn().mockReturnValue({ prompt: 'test' }),
      canUseRecentPayload: jest.fn().mockReturnValue(true),
      resolveBootstrapNetworkId: jest.fn().mockReturnValue('84532'),
      updateCacheAtomic,
      ensureQuestionsNet: jest.fn(ensureQuestionsNet),
    });

    expect(result.status).toBe('seeded-from-recent');
    if (result.status !== 'seeded-from-recent') {
      throw new Error(`expected seeded-from-recent, got ${result.status}`);
    }

    expect(result.questionData.creator).toBe('');
    expect(Array.isArray(result.questionData.tags)).toBe(true);
  });
});
