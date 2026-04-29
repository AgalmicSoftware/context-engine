import {
  fetchSingleQuestionMetadataCandidates,
  normalizeSingleQuestionMetadataForCache,
  resolveSingleQuestionCacheState,
} from './surveyToolSingleQuestionMetadataController';

describe('surveyToolSingleQuestionMetadataController', () => {
  it('resolves cache state from the network bucket that already contains the question', async () => {
    const cache = {
      '84532': {
        questions: {},
      },
      '11155420': {
        questions: {
          q1: { id: 'q1', prompt: 'Prompt from alt network' },
        },
      },
    };

    await expect(resolveSingleQuestionCacheState({
      slug: 'edge',
      questionId: 'q1',
      resolveQuestionBootstrapContext: jest.fn(() => ({ networkIdStr: '' })),
      readQuestionsCacheAsync: jest.fn().mockResolvedValue(cache),
      ensureQuestionsNet: jest.fn((rawCache) => rawCache),
    })).resolves.toEqual({
      netIdStr: '11155420',
      questionsCache: cache,
    });
  });

  it('recovers single-question metadata from a timed-out pending fetch', async () => {
    const payload = { id: 'q1', prompt: 'Recovered prompt' };

    await expect(fetchSingleQuestionMetadataCandidates({
      initialQuestionData: null,
      effectiveSingleSlug: 'edge',
      fetchCandidateSlugs: ['edge'],
      fetchTimeoutMs: 5,
      fetchTimeoutRecoveryMs: 50,
      getQuestionData: async () => new Promise((resolve) => {
        setTimeout(() => resolve(payload), 15);
      }),
      pickBetterQuestionPayload: (_current, next) => next,
      isMaskedQuestionPayload: () => false,
    })).resolves.toEqual({
      questionData: payload,
      effectiveSingleSlug: 'edge',
      fetchedAny: true,
      timedOutFetchCount: 1,
    });
  });

  it('normalizes question metadata before cache write-through', () => {
    expect(normalizeSingleQuestionMetadataForCache({
      questionId: 'Q1',
      questionData: {
        prompt: 'Prompt',
      },
      existingCachedQuestionData: null,
      pickBetterQuestionPayload: (_current, next) => next,
      areQuestionPayloadsEquivalent: () => false,
    })).toEqual({
      normalizedQuestionData: {
        id: 'q1',
        prompt: 'Prompt',
        creator: '',
        tags: [],
      },
      shouldWriteQuestionPayload: true,
    });
  });
});
