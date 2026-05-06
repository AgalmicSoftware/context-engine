import {
  applyUserPageOwnershipSignal,
  getActiveUserPageChainNode,
  getPrioritizedUserPageChainNodes,
  getPrioritizedUserPageNetworkCacheNodes,
  getUserPageOwnershipCountMaps,
  hasMeaningfulUserPageOwnershipCounts,
  readUserPageNetworkCache,
  readUserPageOwnershipCount,
  upsertUserPageResponseByRecency,
  writeUserPageResponseSourceSlug,
  writeUserPageSourceSlug,
} from './userPageCacheHelpers';
import type {
  UserPageResponseBucketMap,
  UserPageResponseRecencyBucketMap,
} from './userPageResponseHelpers';

describe('userPageCacheHelpers', () => {
  it('reads ownership count maps and applies viewer ownership signals', () => {
    const entry = {
      countsLoaded: false,
      mintedCountByAddress: {
        '0xabc': 2,
      },
      burnedCountByAddress: {
        '0xabc': 1,
      },
    };

    expect(getUserPageOwnershipCountMaps(entry)).toEqual({
      mintedCountMap: { '0xabc': 2 },
      burnedCountMap: { '0xabc': 1 },
    });
    expect(hasMeaningfulUserPageOwnershipCounts(entry, '0xABC')).toBe(true);
    expect(hasMeaningfulUserPageOwnershipCounts({ countsLoaded: true, mintedCountByAddress: {} }, '')).toBe(true);
    expect(hasMeaningfulUserPageOwnershipCounts({}, '0xabc')).toBe(false);
    expect(readUserPageOwnershipCount({ '0xabc': '3' }, '0xABC')).toBe(3);
    expect(readUserPageOwnershipCount({ '0xabc': -2 }, '0xABC')).toBe(0);
    expect(readUserPageOwnershipCount(null, '0xABC')).toBe(0);

    const aggregate = {
      mintedSet: new Set<string>(),
      burnedSet: new Set<string>(['0xabc']),
    };
    applyUserPageOwnershipSignal(aggregate, entry, '0xABC');
    expect(aggregate.mintedSet.has('0xabc')).toBe(true);
    expect(aggregate.burnedSet.has('0xabc')).toBe(false);

    const burnedAggregate = {
      mintedSet: new Set<string>(),
      burnedSet: new Set<string>(),
    };
    applyUserPageOwnershipSignal(burnedAggregate, {
      countsLoaded: false,
      mintedCountByAddress: { '0xabc': 1 },
      burnedCountByAddress: { '0xabc': 2 },
    }, '0xABC');
    expect(burnedAggregate.mintedSet.has('0xabc')).toBe(false);
    expect(burnedAggregate.burnedSet.has('0xabc')).toBe(true);
  });

  it('normalizes cache source slugs and preserves existing entries unless replacing', () => {
    const sourceSlugById: Record<string, string> = {};
    writeUserPageSourceSlug(sourceSlugById, '  SurveyA  ', ' Session-One ');
    writeUserPageSourceSlug(sourceSlugById, '  SurveyA  ', 'ignored');
    writeUserPageSourceSlug(sourceSlugById, '  SurveyA  ', 'general', { replace: true });
    writeUserPageSourceSlug(sourceSlugById, '', 'missing');

    expect(sourceSlugById).toEqual({
      '  surveya  ': '',
    });

    const responseSourceSlugByKey: Record<string, string> = {};
    writeUserPageResponseSourceSlug(responseSourceSlugByKey, ' SurveyA ', ' 0xABC ', ' Session-One ');
    writeUserPageResponseSourceSlug(responseSourceSlugByKey, ' SurveyA ', ' 0xABC ', 'ignored');
    writeUserPageResponseSourceSlug(responseSourceSlugByKey, ' SurveyA ', ' 0xABC ', ' Session-Two ', {
      replace: true,
    });
    writeUserPageResponseSourceSlug(responseSourceSlugByKey, ' SurveyA ', '', 'missing');

    expect(responseSourceSlugByKey).toEqual({
      'surveya|0xabc': 'session-two',
    });
  });

  it('upserts user-page responses by recency while tracking source slugs', () => {
    const responses: UserPageResponseBucketMap = {};
    const responseRecencyMeta: UserPageResponseRecencyBucketMap = {};
    const sourceSlugById: Record<string, string> = {};
    const responseSourceSlugByKey: Record<string, string> = {};

    upsertUserPageResponseByRecency({
      id: ' SurveyA ',
      responder: ' 0xABC ',
      responseRecencyMeta,
      responses,
      responseSourceSlugByKey,
      responseValue: { answer: 'old' },
      sourceSlugById,
      metaValue: { blockNumber: 10, transactionIndex: 1 },
      slug: 'alpha',
    });
    upsertUserPageResponseByRecency({
      id: 'surveya',
      responder: '0xabc',
      responseRecencyMeta,
      responses,
      responseSourceSlugByKey,
      responseValue: { answer: 'older' },
      sourceSlugById,
      metaValue: { blockNumber: 9 },
      slug: 'ignored',
    });

    expect(responses.surveya['0xabc']).toEqual({ answer: 'old' });
    expect(sourceSlugById.surveya).toBe('alpha');
    expect(responseSourceSlugByKey['surveya|0xabc']).toBe('alpha');

    upsertUserPageResponseByRecency({
      id: 'surveya',
      responder: '0xabc',
      responseRecencyMeta,
      responses,
      responseSourceSlugByKey,
      responseValue: { answer: 'newer' },
      sourceSlugById,
      metaValue: { blockNumber: 11 },
      slug: 'beta',
    });

    expect(responses.surveya['0xabc']).toEqual({ answer: 'newer' });
    expect(responseRecencyMeta.surveya['0xabc']).toMatchObject({ bn: 11, hasHints: true });
    expect(sourceSlugById.surveya).toBe('beta');
    expect(responseSourceSlugByKey['surveya|0xabc']).toBe('beta');
  });

  it('merges active network cache buckets after fallback buckets', () => {
    expect(readUserPageNetworkCache(null, 84532)).toEqual({});
    expect(readUserPageNetworkCache({
      '11155420': {
        surveys: { a: 'global-a' },
        questionResponses: { q1: 'op' },
        ignored: { value: true },
      },
      '84532': {
        surveys: { a: 'base-a', b: 'base-b' },
        questionResponses: { q2: 'base' },
        questionResponsesMeta: { q2: { blockNumber: 2 } },
      },
    }, 84532)).toEqual({
      surveys: { a: 'base-a', b: 'base-b' },
      questionResponses: { q1: 'op', q2: 'base' },
      questionResponsesMeta: { q2: { blockNumber: 2 } },
    });
  });

  it('prioritizes active network and chain cache nodes while skipping invalid nodes', () => {
    const cacheObj = {
      '11155420': { surveys: { op: true } },
      '84532': { surveys: { base: true } },
      empty: null,
    };
    expect(getPrioritizedUserPageNetworkCacheNodes(cacheObj, 84532)).toEqual([
      { key: '84532', value: { surveys: { base: true } } },
      { key: '11155420', value: { surveys: { op: true } } },
    ]);
    expect(getPrioritizedUserPageNetworkCacheNodes(null, 84532)).toEqual([]);

    const userNode = {
      '11155420': { data: { sbts: ['op-sbt'] } },
      '84532': { data: { sbts: ['base-sbt'] } },
      ignored: 'bad',
    };
    expect(getPrioritizedUserPageChainNodes(userNode, 84532)).toEqual([
      { chainKey: '84532', node: { data: { sbts: ['base-sbt'] } } },
      { chainKey: '11155420', node: { data: { sbts: ['op-sbt'] } } },
    ]);
    expect(getPrioritizedUserPageChainNodes(undefined, 84532)).toEqual([]);
  });

  it('merges active user-page chain data before fallback chain data', () => {
    const userNode = {
      '11155420': {
        data: {
          sbts: ['op-sbt'],
          createdSurveys: ['op-survey'],
          surveyResponses: ['op-response'],
        },
      },
      '84532': {
        data: {
          sbts: ['base-sbt'],
          createdQuestions: ['base-question'],
          questionResponses: ['base-response'],
        },
      },
      ignored: { data: 'bad' },
    };

    expect(getActiveUserPageChainNode(userNode, 84532)).toEqual({
      data: {
        sbts: ['base-sbt', 'op-sbt'],
        createdSurveys: ['op-survey'],
        createdQuestions: ['base-question'],
        surveyResponses: ['op-response'],
        questionResponses: ['base-response'],
      },
    });
    expect(getActiveUserPageChainNode({
      '84532': { data: {} },
    }, 84532)).toEqual({
      data: {
        sbts: [],
        createdSurveys: [],
        createdQuestions: [],
        surveyResponses: [],
        questionResponses: [],
      },
    });
    expect(getActiveUserPageChainNode(null, 84532)).toBeNull();
  });
});
