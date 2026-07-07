import {
  buildUserPageAnalysisCacheEntry,
  buildUserPageAnalysisCacheReadDescriptor,
  buildUserPageAnalysisCacheWritePayload,
  buildUserPageAnalysisCreatedQuestions,
  buildUserPageAnalysisCreatedSurveys,
  buildUserPageAnalysisFingerprint,
  buildUserPageAnalysisQuestions,
  buildUserPageAnalysisSbts,
  buildUserPageAnalysisSurveys,
  buildUserPageSbtSection,
  formatAnalysisCacheAge,
  isPlainAnalysisObject,
  readUserPageAnalysisCacheThroughPort,
  readUserPageAnalysisCreatedSurveyCachesThroughPort,
  readUserPageAnalysisCacheEntry,
  readUserPageDirectNetworkCacheBucket,
  resolveUserPageAnalysisCacheStatusState,
  sortUserAnalysisKeys,
  toAnalysisCacheBucket,
  toAnalysisRecord,
  writeUserPageAnalysisCacheThroughPort,
} from './userPageHelpers';

describe('userPageHelpers analysis cache helpers', () => {
  it('coerces analysis objects and sorts canonical keys', () => {
    expect(isPlainAnalysisObject({ a: 1 })).toBe(true);
    expect(isPlainAnalysisObject([['a', 1]])).toBe(false);
    expect(toAnalysisRecord({ a: 1 })).toEqual({ a: 1 });
    expect(toAnalysisRecord(null)).toEqual({});
    expect(toAnalysisCacheBucket(['kept'])).toEqual(['kept']);
    expect(
      sortUserAnalysisKeys({
        z: 1,
        a: { y: 2, x: 1 },
        list: [{ b: 2, a: 1 }],
      }),
    ).toEqual({
      a: { x: 1, y: 2 },
      list: [{ a: 1, b: 2 }],
      z: 1,
    });
  });

  it('builds stable user analysis fingerprints from canonical inputs', async () => {
    const first = await buildUserPageAnalysisFingerprint({
      version: 1,
      userData: { b: 2, a: { y: 1, x: 2 } },
      address: ' 0xABC ',
      networkId: 84532,
      sessionSlug: 'alpha',
      provider: ' OpenAI ',
      model: ' gpt-5 ',
    });
    const second = await buildUserPageAnalysisFingerprint({
      version: 1,
      userData: { a: { x: 2, y: 1 }, b: 2 },
      address: '0xabc',
      networkId: '84532',
      sessionSlug: 'alpha',
      provider: 'openai',
      model: 'gpt-5',
    });
    const changedVersion = await buildUserPageAnalysisFingerprint({
      version: 2,
      userData: { a: { x: 2, y: 1 }, b: 2 },
      address: '0xabc',
      networkId: '84532',
      sessionSlug: 'alpha',
      provider: 'openai',
      model: 'gpt-5',
    });

    expect(first).toBe(second);
    expect(first).not.toBe(changedVersion);
  });

  it('formats analysis cache age labels', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);
    try {
      expect(formatAnalysisCacheAge(null)).toBe('');
      expect(formatAnalysisCacheAge(1_710_000_000_000 - 10_000)).toBe('just now');
      expect(formatAnalysisCacheAge(1_710_000_000_000 - 5 * 60 * 1000)).toBe('5m ago');
      expect(formatAnalysisCacheAge(1_710_000_000_000 - 2 * 60 * 60 * 1000)).toBe('2h ago');
      expect(formatAnalysisCacheAge(1_710_000_000_000 - 3 * 24 * 60 * 60 * 1000)).toBe('3d ago');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('resolves analysis cache status display state', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);
    try {
      expect(
        resolveUserPageAnalysisCacheStatusState({
          analysisCachedAt: 1_710_000_000_000 - 5 * 60 * 1000,
          analysisServedFromCache: false,
        }),
      ).toEqual({
        analysisCacheAge: '',
        shouldRenderAnalysisCacheStatus: false,
      });
      expect(
        resolveUserPageAnalysisCacheStatusState({
          analysisCachedAt: null,
          analysisServedFromCache: true,
        }),
      ).toEqual({
        analysisCacheAge: '',
        shouldRenderAnalysisCacheStatus: false,
      });
      expect(
        resolveUserPageAnalysisCacheStatusState({
          analysisCachedAt: 1_710_000_000_000 - 5 * 60 * 1000,
          analysisServedFromCache: true,
        }),
      ).toEqual({
        analysisCacheAge: '5m ago',
        shouldRenderAnalysisCacheStatus: true,
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('reads valid analysis cache entries and rejects stale or mismatched entries', () => {
    const now = 1710000000000;
    const validEntry = {
      version: 1,
      fingerprint: 'fingerprint-a',
      networkId: '84532',
      address: '0xabc',
      expiresAt: now + 1000,
      result: { summary: 'cached' },
    };
    const cacheObj = {
      84532: {
        '0xabc': {
          'fingerprint-a': validEntry,
        },
      },
    };
    const readArgs = {
      addressLower: '0xabc',
      cacheObj,
      cacheVersion: 1,
      fingerprint: 'fingerprint-a',
      networkId: '84532',
      now,
    };

    expect(readUserPageAnalysisCacheEntry(readArgs)).toBe(validEntry);
    expect(
      readUserPageAnalysisCacheEntry({
        ...readArgs,
        cacheObj: { 84532: { '0xabc': { 'fingerprint-a': { ...validEntry, version: 0 } } } },
      }),
    ).toBeNull();
    expect(
      readUserPageAnalysisCacheEntry({
        ...readArgs,
        cacheObj: { 84532: { '0xabc': { 'fingerprint-a': { ...validEntry, fingerprint: 'other' } } } },
      }),
    ).toBeNull();
    expect(
      readUserPageAnalysisCacheEntry({
        ...readArgs,
        cacheObj: { 84532: { '0xabc': { 'fingerprint-a': { ...validEntry, networkId: '10' } } } },
      }),
    ).toBeNull();
    expect(
      readUserPageAnalysisCacheEntry({
        ...readArgs,
        cacheObj: { 84532: { '0xabc': { 'fingerprint-a': { ...validEntry, address: '0xdef' } } } },
      }),
    ).toBeNull();
    expect(
      readUserPageAnalysisCacheEntry({
        ...readArgs,
        cacheObj: { 84532: { '0xabc': { 'fingerprint-a': { ...validEntry, expiresAt: now } } } },
      }),
    ).toBeNull();
    expect(
      readUserPageAnalysisCacheEntry({
        ...readArgs,
        fingerprint: 'missing',
      }),
    ).toBeNull();
  });

  it('describes analysis cache read identity without reading cache data', () => {
    expect(
      buildUserPageAnalysisCacheReadDescriptor({
        addressLower: ' 0xABC ',
        fingerprint: 'fingerprint-a',
        networkId: 84532,
        sessionSlug: ' Session-A ',
      }),
    ).toEqual({
      action: 'read',
      addressLower: '0xabc',
      fingerprint: 'fingerprint-a',
      networkId: '84532',
      sessionSlug: ' Session-A ',
    });
    expect(
      buildUserPageAnalysisCacheReadDescriptor({
        addressLower: '0xabc',
        fingerprint: 'fingerprint-a',
        forceRefresh: true,
        networkId: 84532,
        sessionSlug: 'session-a',
      }),
    ).toEqual({
      action: 'skip-force-refresh',
      addressLower: '0xabc',
      fingerprint: 'fingerprint-a',
      networkId: '84532',
      sessionSlug: 'session-a',
    });
  });

  it('reads analysis cache entries through an injected port without owning state', () => {
    const now = 1710000000000;
    const validEntry = {
      version: 1,
      fingerprint: 'fingerprint-a',
      networkId: '84532',
      address: '0xabc',
      expiresAt: now + 1000,
      result: { summary: 'cached' },
    };
    const descriptor = buildUserPageAnalysisCacheReadDescriptor({
      addressLower: ' 0xABC ',
      fingerprint: 'fingerprint-a',
      networkId: 84532,
      sessionSlug: 'session-a',
    });
    const peekCache = jest.fn(() => ({
      84532: {
        '0xabc': {
          'fingerprint-a': validEntry,
        },
      },
    }));

    expect(
      readUserPageAnalysisCacheThroughPort({
        cacheVersion: 1,
        descriptor,
        now,
        peekCache,
      }),
    ).toEqual({
      descriptor,
      entry: validEntry,
      status: 'hit',
    });
    expect(peekCache).toHaveBeenCalledWith('analysisCache', 'session-a', { clone: false });

    expect(
      readUserPageAnalysisCacheThroughPort({
        cacheVersion: 1,
        descriptor: {
          ...descriptor,
          fingerprint: 'missing',
        },
        now,
        peekCache,
      }),
    ).toMatchObject({
      entry: null,
      status: 'miss',
    });
    expect(
      readUserPageAnalysisCacheThroughPort({
        descriptor: {
          ...descriptor,
          action: 'skip-force-refresh',
        },
        peekCache,
      }),
    ).toMatchObject({
      entry: null,
      status: 'skipped',
    });
    expect(
      readUserPageAnalysisCacheThroughPort({
        descriptor: {
          ...descriptor,
          sessionSlug: '',
        },
        peekCache,
      }),
    ).toMatchObject({
      entry: null,
      status: 'skipped',
    });

    const thrown = new Error('cache read failed');
    const throwingPeek = jest.fn(() => {
      throw thrown;
    });
    expect(
      readUserPageAnalysisCacheThroughPort({
        descriptor,
        peekCache: throwingPeek,
      }),
    ).toEqual({
      descriptor,
      entry: null,
      error: thrown,
      status: 'error',
    });
  });

  it('builds analysis cache entries and prunes expired siblings during writes', () => {
    const cachedAt = 1710000000000;
    const entry = buildUserPageAnalysisCacheEntry({
      addressLower: '0xabc',
      aiContext: { provider: 'openai', model: 'gpt-5' },
      cachedAt,
      cacheVersion: 2,
      fingerprint: 'fingerprint-new',
      networkId: '84532',
      result: { summary: 'fresh summary' },
      sessionSlug: 'edge',
      ttlMs: 1000,
    });

    expect(entry).toMatchObject({
      version: 2,
      fingerprint: 'fingerprint-new',
      cachedAt,
      expiresAt: cachedAt + 1000,
      address: '0xabc',
      networkId: '84532',
      aiContext: {
        sessionSlug: 'edge',
        provider: 'openai',
        model: 'gpt-5',
      },
      result: {
        summary: 'fresh summary',
      },
    });

    const staleSibling = { fingerprint: 'stale', expiresAt: cachedAt - 1 };
    const liveSibling = { fingerprint: 'live', expiresAt: cachedAt + 1 };
    const next = buildUserPageAnalysisCacheWritePayload({
      addressLower: '0xabc',
      cachedAt,
      currentCache: {
        84532: {
          '0xabc': {
            stale: staleSibling,
            live: liveSibling,
          },
          '0xdef': {
            keep: { expiresAt: cachedAt + 1 },
          },
        },
        other: { untouched: true },
      },
      entry,
      fingerprint: 'fingerprint-new',
      networkId: '84532',
    });

    expect(next).toEqual({
      84532: {
        '0xabc': {
          live: liveSibling,
          'fingerprint-new': entry,
        },
        '0xdef': {
          keep: { expiresAt: cachedAt + 1 },
        },
      },
      other: { untouched: true },
    });
  });

  it('writes analysis cache entries through injected ports without owning analysis state', async () => {
    const cachedAt = 1710000000000;
    const staleSibling = { fingerprint: 'stale', expiresAt: cachedAt - 1 };
    const liveSibling = { fingerprint: 'live', expiresAt: cachedAt + 1 };
    const currentCache = {
      84532: {
        '0xabc': {
          stale: staleSibling,
          live: liveSibling,
        },
      },
      other: { untouched: true },
    };
    const peekCache = jest.fn(() => currentCache);
    const writeCache = jest.fn(async () => true);

    const result = await writeUserPageAnalysisCacheThroughPort({
      addressLower: '0xabc',
      aiContext: { provider: 'openai', model: 'gpt-5' },
      cachedAt,
      cacheVersion: 2,
      fingerprint: 'fingerprint-new',
      networkId: '84532',
      peekCache,
      result: { summary: 'fresh summary' },
      sessionSlug: 'edge',
      ttlMs: 1000,
      writeCache,
    });

    expect(result.status).toBe('written');
    expect(result.entry).toMatchObject({
      version: 2,
      fingerprint: 'fingerprint-new',
      cachedAt,
      expiresAt: cachedAt + 1000,
      address: '0xabc',
      networkId: '84532',
      result: {
        summary: 'fresh summary',
      },
    });
    expect(result.payload).toEqual({
      84532: {
        '0xabc': {
          live: liveSibling,
          'fingerprint-new': result.entry,
        },
      },
      other: { untouched: true },
    });
    expect(peekCache).toHaveBeenCalledWith('analysisCache', 'edge', { clone: false });
    expect(writeCache).toHaveBeenCalledWith('analysisCache', 'edge', result.payload);

    const skipped = await writeUserPageAnalysisCacheThroughPort({
      addressLower: '0xabc',
      fingerprint: '',
      networkId: '84532',
      peekCache,
      sessionSlug: 'edge',
      writeCache,
    });
    expect(skipped).toEqual({
      entry: null,
      payload: null,
      status: 'skipped',
    });

    const thrown = new Error('write failed');
    const throwingWrite = jest.fn(async () => {
      throw thrown;
    });
    await expect(
      writeUserPageAnalysisCacheThroughPort({
        addressLower: '0xabc',
        cachedAt,
        fingerprint: 'fingerprint-new',
        networkId: '84532',
        peekCache,
        sessionSlug: 'edge',
        writeCache: throwingWrite,
      }),
    ).resolves.toMatchObject({
      error: thrown,
      status: 'error',
    });
  });

  it('reads created-survey analysis caches through an injected port', () => {
    const surveysCache = { 84532: { surveys: { s1: { id: 's1' } } } };
    const questionsCache = { 84532: { questions: { q1: { id: 'q1' } } } };
    const peekCache = jest.fn((namespace: string) => (namespace === 'surveysCache' ? surveysCache : questionsCache));

    expect(
      readUserPageAnalysisCreatedSurveyCachesThroughPort({
        networkID: 84532,
        peekCache,
        sessionSlug: '',
      }),
    ).toEqual({
      networkID: '84532',
      questionsCache,
      sessionSlug: '',
      status: 'read',
      surveysCache,
    });
    expect(peekCache.mock.calls).toEqual([
      ['surveysCache', '', { clone: false }],
      ['questionsCache', '', { clone: false }],
    ]);

    expect(
      readUserPageAnalysisCreatedSurveyCachesThroughPort({
        networkID: '',
        peekCache,
        sessionSlug: 'edge',
      }),
    ).toEqual({
      networkID: '',
      questionsCache: {},
      sessionSlug: 'edge',
      status: 'skipped',
      surveysCache: {},
    });

    const thrown = new Error('created survey cache read failed');
    const throwingPeek = jest.fn(() => {
      throw thrown;
    });
    expect(
      readUserPageAnalysisCreatedSurveyCachesThroughPort({
        networkID: 84532,
        peekCache: throwingPeek,
        sessionSlug: 'edge',
      }),
    ).toEqual({
      error: thrown,
      networkID: '84532',
      questionsCache: {},
      sessionSlug: 'edge',
      status: 'error',
      surveysCache: {},
    });
  });

  it('builds analysis created-content samples from direct network caches', () => {
    const surveysCache = {
      84532: {
        surveys: {
          survey_a: {
            questionIDs: ['Q_A', 'Q_B', 'Q_missing'],
          },
        },
      },
    };
    const questionsCache = {
      84532: {
        questions: {
          q_a: { id: 'q_a', type: 'text', prompt: 'Prompt A' },
          q_b: { type: 'number', prompt: 'Prompt B' },
        },
      },
    };

    expect(readUserPageDirectNetworkCacheBucket(surveysCache, 84532)).toBe(surveysCache[84532]);
    expect(readUserPageDirectNetworkCacheBucket(surveysCache, '')).toEqual({});
    expect(
      buildUserPageAnalysisCreatedQuestions([{ id: 'q1', type: 'text', prompt: 'Question one', ignored: true }]),
    ).toEqual([{ id: 'q1', type: 'text', prompt: 'Question one' }]);
    expect(
      buildUserPageAnalysisCreatedSurveys({
        networkID: 84532,
        questionsCache,
        surveyCreationInfo: [{ id: 'survey_a', title: 'Survey A', questionsCount: 3 }],
        surveysCache,
      }),
    ).toEqual([
      {
        surveyId: 'survey_a',
        title: 'Survey A',
        questionsCount: 3,
        sampleQuestions: [
          { id: 'q_a', type: 'text', prompt: 'Prompt A' },
          { id: 'q_b', type: 'number', prompt: 'Prompt B' },
          { id: 'q_missing' },
        ],
      },
    ]);
  });

  it('builds analysis SBT, question, and survey response inputs', () => {
    expect(
      buildUserPageAnalysisSbts({
        getSbtDisplayName: (sbtInfo) => (sbtInfo as any)?.title,
        sbtList: [{ sbtInfo: { title: 'Alpha Badge', sbtAddress: '0xA' } }, { name: 'Missing Address', sbtInfo: {} }],
      }),
    ).toEqual([{ name: 'Alpha Badge', address: '0xA' }]);

    const derivedSbtSection = buildUserPageSbtSection({
      aggregate: {
        sbtAggregate: {
          '0xBadgeA': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(),
            sbtAddress: '0xBadgeA',
            sbtInfo: { title: 'Alpha Badge' },
            slug: 'alpha',
          },
          '0xBadgeB': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(),
            sbtAddress: '0x1234567890abcdef',
            sbtInfo: {},
            slug: 'beta',
          },
          '0xBadgeC': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(['0xviewer']),
            sbtInfo: { title: 'Burned Badge' },
          },
          '0xBadgeD': {
            mintedSet: new Set(['0xviewer']),
            burnedSet: new Set(),
            sbtInfo: { title: 'Hidden Badge', unlisted: true },
          },
        },
      },
      getSbtDisplayName: (sbtInfo) => (sbtInfo as any)?.title,
      getShortenedAddress: (address) => `short:${address}`,
      translate: () => 'Badge',
      viewAddressLower: '0xviewer',
    });
    expect(derivedSbtSection.sbtList).toEqual([
      {
        sbtInfo: {
          title: 'Alpha Badge',
          name: 'Alpha Badge',
          sbtAddress: '0xBadgeA',
        },
        slug: 'alpha',
      },
      {
        sbtInfo: {
          name: 'Badge short:0x1234567890abcdef',
          sbtAddress: '0x1234567890abcdef',
        },
        slug: 'beta',
      },
    ]);
    expect(derivedSbtSection.badgesReceived).toBe(2);
    expect(derivedSbtSection.telemetry).toEqual({
      signature: '0xviewer|4|3|2',
      payload: {
        viewAddress: '0xviewer',
        aggregateSbtAddresses: 4,
        heldAggregateSbtCount: 3,
        derivedSbtCount: 2,
        derivedSbtSample: ['0xbadgea', '0x1234567890abcdef'],
      },
    });
    expect(
      buildUserPageSbtSection({
        aggregate: { sbtAggregate: {} },
        viewAddressLower: '0xviewer',
      }).telemetry,
    ).toBeNull();

    expect(
      buildUserPageAnalysisQuestions({
        detailedQuestionResponses: {
          q1: {
            answer: { value: ['yes'] },
            additionalComments: 'Useful context',
            importance: { value: 'high' },
          },
          q2: { answer: { value: '*' } },
        },
        questionResponseInfo: [
          { id: 'q1', type: 'multi', prompt: 'Question one' },
          { id: 'q2', type: 'text', prompt: 'Encrypted' },
        ],
      }),
    ).toEqual([
      {
        id: 'q1',
        type: 'multi',
        prompt: 'Question one',
        answer: ['yes'],
        importance: { value: 'high' },
        additionalComment: 'Useful context',
      },
    ]);

    expect(
      buildUserPageAnalysisSurveys({
        detailedSurveyResponses: {
          s1: [
            {
              questionData: { prompt: 'Prompt one', type: 'text' },
              responseData: {
                answer: { value: 'answer one' },
                additionalComment: { value: 'Survey note' },
              },
            },
            {
              questionData: { prompt: 'Hidden prompt' },
              responseData: { answer: { value: '*' } },
            },
          ],
        },
        surveyResponseInfo: [{ id: 's1', title: 'Survey one' }],
      }),
    ).toEqual([
      {
        surveyId: 's1',
        title: 'Survey one',
        answeredCount: 1,
        sample: [
          {
            prompt: 'Prompt one',
            type: 'text',
            answer: 'answer one',
            importance: undefined,
            additionalComment: 'Survey note',
          },
        ],
        additionalCommentsSample: ['Survey note'],
      },
    ]);
  });
});
