import { ensureQuestionsNet, mergeQuestionResponses } from './surveyToolCacheState.js';
import { normalizeQuestionIdKey } from './surveyToolSignatures.js';
import { buildPileResponseCounts, loadPileScopeCacheSnapshot } from './surveyPileScopeCacheData';

describe('surveyPileScopeCacheData', () => {
  it('loads and merges pile scope caches while honoring blocked ids and question dedupe', async () => {
    const readQuestionsCacheAsync = jest.fn(async (scopeSlug) => {
      if (scopeSlug === 'edge') {
        return {
          '84532': {
            questions: {
              q1: { id: 'q1', prompt: 'Edge one', creator: '0x111', tags: ['edge'] },
              qdup: { id: 'qdup', prompt: 'Edge duplicate', creator: '0x222' },
              qblocked: { id: 'qblocked', prompt: 'Blocked edge question' },
              qpending: {
                id: 'qpending',
                prompt: '[encrypted]',
                __ceQuestionMetadataPending: true,
              },
            },
            questionResponses: {
              q1: {
                '0xAbC': { answer: { value: 'edge-response' } },
              },
            },
            pendingQuestionMetadata: {
              edgePendingA: {},
              edgePendingB: {},
            },
          },
        };
      }

      return {
        '84532': {
          questions: {
            QDUP: { id: 'Qdup', prompt: 'Other duplicate should be ignored', creator: '0x333' },
            q2: { id: 'q2', prompt: 'Other two', tags: ['other'] },
          },
          questionResponses: {
            Q1: {
              '0xdef': { answer: { value: 'other-response' } },
            },
            q2: {
              '0x999': { answer: { value: 'other-two' } },
            },
          },
          pendingQuestionMetadata: {
            otherPending: {},
          },
        },
      };
    });
    const getHighlightedQuestionIdsSet = jest.fn<Set<string>, [string]>((scopeSlug) =>
      scopeSlug === 'edge' ? new Set(['Q1']) : new Set(['q2']),
    );
    const getBlockedQuestionIdsSet = jest.fn<Set<string>, [string]>((scopeSlug) =>
      scopeSlug === 'edge' ? new Set(['qblocked']) : new Set(),
    );

    await expect(
      loadPileScopeCacheSnapshot({
        scopeSlugs: ['edge', 'other'],
        networkIdStr: '84532',
        readQuestionsCacheAsync,
        ensureQuestionsNet,
        getHighlightedQuestionIdsSet,
        mergeQuestionResponses,
        getBlockedQuestionIdsSet,
        normalizeQuestionIdKey,
      }),
    ).resolves.toEqual({
      allResponses: {
        q1: {
          '0xabc': { answer: { value: 'edge-response' } },
          '0xdef': { answer: { value: 'other-response' } },
        },
        q2: {
          '0x999': { answer: { value: 'other-two' } },
        },
      },
      allQuestions: [
        {
          id: 'q1',
          prompt: 'Edge one',
          creator: '0x111',
          tags: ['edge'],
          sessionSlug: 'edge',
        },
        {
          id: 'qdup',
          prompt: 'Edge duplicate',
          creator: '0x222',
          tags: [],
          sessionSlug: 'edge',
        },
        {
          id: 'q2',
          prompt: 'Other two',
          creator: '',
          tags: ['other'],
          sessionSlug: 'other',
        },
      ],
      highlightedQuestionIds: new Set(['q1', 'q2']),
      pendingMetadataCount: 3,
    });

    expect(readQuestionsCacheAsync).toHaveBeenNthCalledWith(1, 'edge');
    expect(readQuestionsCacheAsync).toHaveBeenNthCalledWith(2, 'other');
  });

  it('builds pile response counts from merged responder maps', () => {
    expect(
      buildPileResponseCounts({
        questionResponses: {
          q1: {
            '0xabc': { answer: { value: 'one' } },
            '0xdef': { answer: { value: 'two' } },
          },
          q2: {},
        },
      }),
    ).toEqual({
      q1: 2,
      q2: 0,
    });
  });
});
