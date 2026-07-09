import {
  buildSbtFilterSbtCacheMemoKey,
  buildSbtFilterSbtEntryCachePatch,
  getCachedSbtFilterQuestionEntry,
  getCachedSbtFilterQuestionResponseMap,
  readMemoizedSbtFilterSbtCacheBySlug,
  readMemoizedSbtFilterSbtNetBucketBySlug,
  readSbtFilterQuestionsCacheBySlug,
  readSbtFilterQuestionsNetBucketBySlug,
  readSbtFilterSbtCacheBySlug,
  unifySbtFilterAggregatorWithAllLocalQuestions,
} from './sbtFilterHelpers';

describe('sbtFilterHelpers cache helpers', () => {
  it('reads filter cache buckets and merges local questions through injected cache readers', () => {
    const readCache = jest.fn((namespace: string, slug: string) => ({
      namespace,
      slug,
      84532: {
        questions: {
          q1: { id: 'q1', creator: '0xCreator' },
          q2: { id: 'q2', creator: '0xOther' },
        },
        questionResponses: {
          q1: { '0xResponder': { answer: 'yes' } },
        },
      },
    }));

    const questionCache = readSbtFilterQuestionsCacheBySlug(' alpha ', readCache);
    const sbtCache = readSbtFilterSbtCacheBySlug(' alpha ', readCache);
    const netBucket = readSbtFilterQuestionsNetBucketBySlug(' alpha ', 84532, readCache);

    expect(readCache).toHaveBeenCalledWith('questionsCache', ' alpha ', { clone: false });
    expect(readCache).toHaveBeenCalledWith('sbtCache', ' alpha ', { clone: false });
    expect(questionCache.slug).toBe(' alpha ');
    expect(sbtCache.namespace).toBe('sbtCache');
    expect(getCachedSbtFilterQuestionEntry(netBucket, 'q1')).toEqual({
      id: 'q1',
      creator: '0xCreator',
    });
    expect(getCachedSbtFilterQuestionResponseMap(netBucket, 'q1')).toEqual({
      '0xResponder': { answer: 'yes' },
    });
    expect(
      unifySbtFilterAggregatorWithAllLocalQuestions([{ id: 'q1' }], 84532, 'questions', ' alpha ', readCache),
    ).toEqual([{ id: 'q1' }, { id: 'q2', creator: '0xOther' }]);
    expect(unifySbtFilterAggregatorWithAllLocalQuestions([{ id: 'q1' }], '', 'questions', 'alpha', readCache)).toEqual([
      { id: 'q1' },
    ]);
  });

  it('builds SBT entry cache patches without mutating existing cache buckets', () => {
    const rawCache = {
      untouched: true,
      '84532': {
        otherNetValue: 'keep',
        sbtList: {
          '0xabc': {
            name: 'Old',
            mintedAddresses: ['0x1'],
          },
          '0xdef': {
            name: 'Other',
          },
        },
      },
    };

    expect(
      buildSbtFilterSbtEntryCachePatch({
        rawCache,
        netKey: 84532,
        sbtAddress: '0xabc',
        entryPatch: {
          countsLoaded: true,
          mintedAddresses: ['0x2'],
        },
      }),
    ).toEqual({
      untouched: true,
      '84532': {
        otherNetValue: 'keep',
        sbtList: {
          '0xabc': {
            name: 'Old',
            mintedAddresses: ['0x2'],
            countsLoaded: true,
          },
          '0xdef': {
            name: 'Other',
          },
        },
      },
    });
    expect(rawCache['84532'].sbtList['0xabc'].mintedAddresses).toEqual(['0x1']);
    expect(
      buildSbtFilterSbtEntryCachePatch({
        rawCache,
        netKey: '',
        sbtAddress: '0xabc',
        entryPatch: { countsLoaded: true },
      }),
    ).toBeNull();
  });

  it('memoizes SBT cache reads by slug and resolves net buckets from the memo', () => {
    const rawCache = {
      '84532': {
        sbtList: {
          '0xabc': { countsLoaded: true },
        },
      },
    };
    const cacheBySlug = new Map<string, Record<string, unknown>>();
    const readSbtCacheBySlug = jest.fn(() => rawCache);

    const first = readMemoizedSbtFilterSbtCacheBySlug({
      cacheBySlug,
      readSbtCacheBySlug,
      slugForCache: 'alpha',
    });
    const second = readMemoizedSbtFilterSbtCacheBySlug({
      cacheBySlug,
      readSbtCacheBySlug,
      slugForCache: 'alpha',
    });
    const netBucket = readMemoizedSbtFilterSbtNetBucketBySlug({
      cacheBySlug,
      netKeyForCache: 84532,
      readSbtCacheBySlug,
      slugForCache: 'alpha',
    });

    expect(first).toBe(rawCache);
    expect(second).toBe(first);
    expect(netBucket).toBe(rawCache['84532']);
    expect(buildSbtFilterSbtCacheMemoKey('alpha')).toBe('dg:sbtCache:alpha');
    expect(buildSbtFilterSbtCacheMemoKey(null)).toBe('dg:sbtCache:');
    expect(readSbtCacheBySlug).toHaveBeenCalledTimes(1);
    expect(readSbtCacheBySlug).toHaveBeenCalledWith('alpha');
  });
});
