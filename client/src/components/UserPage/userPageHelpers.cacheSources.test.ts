import {
  buildUserPageCacheSourcePresence,
  buildUserPageCacheSourceSnapshot,
  buildUserPageNamespaceSourceMembershipSignature,
  buildUserPageResponseSectionDeriveMemoPlan,
  buildUserPageResponseSectionDeriveSignature,
  buildUserPageSbtSectionDeriveMemoPlan,
  buildUserPageSbtSectionDeriveSignature,
  buildUserPageUnifiedCacheAggregateMemoKey,
  buildUserPageUnifiedCacheAggregateMemoPlan,
  readUserPageCacheSourcePresence,
  readUserPageCacheSourceSnapshot,
  readUserPageNamespaceSourceEntries,
} from './userPageHelpers';

describe('userPageHelpers cache source helpers', () => {
  it('builds sorted namespace source membership signatures', () => {
    const listNamespaceSlugs = jest.fn((namespace: unknown) =>
      namespace === 'questionsCache' ? ['Beta', 'general', 'alpha', '', 'Alpha'] : 'bad',
    );

    expect(
      buildUserPageNamespaceSourceMembershipSignature({
        listNamespaceSlugs,
        namespace: 'questionsCache',
      }),
    ).toBe('alpha,alpha,beta,general,general');
    expect(listNamespaceSlugs).toHaveBeenCalledWith('questionsCache');

    expect(
      buildUserPageNamespaceSourceMembershipSignature({
        listNamespaceSlugs,
        namespace: 'missing',
      }),
    ).toBe('');
  });

  it('reads namespace source entries from object cache nodes only', () => {
    const listNamespaceSlugs = jest.fn((namespace: unknown) =>
      namespace === 'userCache' ? ['Alpha', '', 'Beta', 'ArrayNode'] : 'bad',
    );
    const peekCache = jest.fn((namespace: string, slug: string) => {
      if (namespace !== 'userCache') return null;
      if (slug === 'Alpha') return { alpha: true };
      if (slug === '') return { general: true };
      if (slug === 'ArrayNode') return ['not', 'plain'];
      return null;
    });

    expect(
      readUserPageNamespaceSourceEntries({
        listNamespaceSlugs,
        namespace: 'userCache',
        peekCache,
      }),
    ).toEqual([
      { slug: 'Alpha', data: { alpha: true } },
      { slug: '', data: { general: true } },
    ]);
    expect(peekCache).toHaveBeenCalledWith('userCache', 'Alpha', { clone: false });
    expect(peekCache).toHaveBeenCalledWith('userCache', '', { clone: false });
    expect(
      readUserPageNamespaceSourceEntries({
        listNamespaceSlugs,
        namespace: 'missing',
        peekCache,
      }),
    ).toEqual([]);
  });

  it('reads cache source presence from the expected namespaces', () => {
    const hasNamespaceEntries = jest.fn(
      (namespace: unknown) => namespace === 'surveysCache' || namespace === 'userCache',
    );

    expect(readUserPageCacheSourcePresence({ hasNamespaceEntries })).toEqual({
      hasSurveysCache: true,
      hasQuestionsCache: false,
      hasSbtCache: false,
      hasUserCache: true,
    });
    expect(hasNamespaceEntries.mock.calls.map(([namespace]) => namespace)).toEqual([
      'surveysCache',
      'questionsCache',
      'sbtCache',
      'userCache',
    ]);
  });

  it('reads full cache source snapshots from namespace readers', () => {
    const hasNamespaceEntries = jest.fn((namespace: unknown) => namespace !== 'sbtCache');
    const listNamespaceSlugs = jest.fn((namespace: unknown) => {
      if (namespace === 'surveysCache') return ['General', 'Alpha'];
      if (namespace === 'questionsCache') return ['Beta'];
      if (namespace === 'userCache') return ['User'];
      return [];
    });

    expect(
      readUserPageCacheSourceSnapshot({
        hasNamespaceEntries,
        listNamespaceSlugs,
      }),
    ).toEqual({
      hasSurveysCache: true,
      hasQuestionsCache: true,
      hasSbtCache: false,
      hasUserCache: true,
      hasQuestionSources: true,
      hasSbtSources: true,
      hasSurveySources: true,
      questionSourcesSignature: 'beta|user',
      sbtSourcesSignature: '|user',
      surveySourcesSignature: 'alpha,general|beta|user',
      membershipSignature: 'alpha,general||beta||||user',
    });
  });

  it('builds cache source snapshots from namespace presence and signatures', () => {
    expect(
      buildUserPageCacheSourcePresence({
        hasQuestionsCache: 1 as unknown as boolean,
        hasSbtCache: '' as unknown as boolean,
        hasSurveysCache: 'yes' as unknown as boolean,
        hasUserCache: null as unknown as boolean,
      }),
    ).toEqual({
      hasQuestionsCache: true,
      hasSbtCache: false,
      hasSurveysCache: true,
      hasUserCache: false,
    });
    expect(
      buildUserPageCacheSourceSnapshot({
        hasQuestionsCache: true,
        hasSbtCache: false,
        hasSurveysCache: false,
        hasUserCache: true,
        questionsNamespaceSignature: 'questions',
        sbtNamespaceSignature: 'sbts',
        surveysNamespaceSignature: 'surveys',
        userNamespaceSignature: 'users',
      }),
    ).toEqual({
      hasQuestionsCache: true,
      hasSbtCache: false,
      hasSurveysCache: false,
      hasUserCache: true,
      hasQuestionSources: true,
      hasSbtSources: true,
      hasSurveySources: true,
      questionSourcesSignature: 'questions|users',
      sbtSourcesSignature: 'sbts|users',
      surveySourcesSignature: 'surveys|questions|users',
      membershipSignature: 'surveys||questions||sbts||users',
    });

    expect(buildUserPageCacheSourceSnapshot()).toMatchObject({
      hasQuestionSources: false,
      hasSbtSources: false,
      hasSurveySources: false,
      membershipSignature: '||||||',
    });
  });

  it('builds cache aggregate and section derive signatures', () => {
    expect(
      buildUserPageUnifiedCacheAggregateMemoKey({
        networkID: 84532,
        questionResponsesNonce: 2,
        sbtCacheRevision: 3,
        sourceMembershipSignature: 'surveys|questions',
        viewAddressLower: '0xabc',
      }),
    ).toBe('0xabc|84532|2|3|surveys|questions');

    expect(buildUserPageUnifiedCacheAggregateMemoKey()).toBe('||0|0|');

    const aggregate = { combinedQuestions: { q1: { id: 'q1' } } };
    expect(
      buildUserPageUnifiedCacheAggregateMemoPlan({
        currentAggregateMemo: aggregate,
        currentAggregateMemoKey: '0xabc|84532|2|3|surveys|questions',
        networkID: 84532,
        questionResponsesNonce: 2,
        sbtCacheRevision: 3,
        sourceMembershipSignature: 'surveys|questions',
        viewAddressLower: '0xabc',
      }),
    ).toEqual({
      aggregate,
      aggregateMemoKey: '0xabc|84532|2|3|surveys|questions',
      canReuseAggregate: true,
    });

    expect(
      buildUserPageUnifiedCacheAggregateMemoPlan({
        currentAggregateMemo: aggregate,
        currentAggregateMemoKey: 'old-key',
        networkID: 84532,
        questionResponsesNonce: 2,
        sbtCacheRevision: 4,
        sourceMembershipSignature: 'surveys|questions',
        viewAddressLower: '0xabc',
      }),
    ).toEqual({
      aggregate: null,
      aggregateMemoKey: '0xabc|84532|2|4|surveys|questions',
      canReuseAggregate: false,
    });

    expect(
      buildUserPageResponseSectionDeriveSignature({
        account: ' 0xABC ',
        networkID: 84532,
        questionResponsesNonce: 4,
        responseGateAccessGeneration: 5,
        responseGateAccessStatusVersion: 6,
        sourceSignature: 'questions',
        viewAddressLower: '0xdef',
      }),
    ).toBe('0xdef|84532|questions|4|0xabc|5|6');

    expect(buildUserPageResponseSectionDeriveSignature()).toBe('|||0||0|0');

    const responseMemo = {
      gateSnapshot: { pendingKeys: ['session-a:questionResponses'] },
      result: { questionResponseInfo: [{ id: 'q1' }] },
      signature: '0xdef|84532|questions|4|0xabc|5|6',
    };
    expect(
      buildUserPageResponseSectionDeriveMemoPlan({
        account: ' 0xABC ',
        currentMemo: responseMemo,
        networkID: 84532,
        questionResponsesNonce: 4,
        responseGateAccessGeneration: 5,
        responseGateAccessStatusVersion: 6,
        sourceSignature: 'questions',
        viewAddressLower: '0xdef',
      }),
    ).toEqual({
      canReuseMemo: true,
      gateSnapshot: responseMemo.gateSnapshot,
      result: responseMemo.result,
      signature: '0xdef|84532|questions|4|0xabc|5|6',
    });
    expect(
      buildUserPageResponseSectionDeriveMemoPlan({
        account: ' 0xABC ',
        currentMemo: responseMemo,
        force: true,
        networkID: 84532,
        questionResponsesNonce: 4,
        responseGateAccessGeneration: 5,
        responseGateAccessStatusVersion: 6,
        sourceSignature: 'questions',
        viewAddressLower: '0xdef',
      }),
    ).toEqual({
      canReuseMemo: false,
      gateSnapshot: null,
      result: null,
      signature: '0xdef|84532|questions|4|0xabc|5|6',
    });

    expect(
      buildUserPageSbtSectionDeriveSignature({
        networkID: 11155420,
        sbtCacheRevision: 9,
        sourceSignature: 'sbt',
        viewAddressLower: '0xaaa',
      }),
    ).toBe('0xaaa|11155420|sbt|9');

    const sbtMemo = {
      result: { sbtList: [{ tokenId: '1' }] },
      signature: '0xaaa|11155420|sbt|9',
    };
    expect(
      buildUserPageSbtSectionDeriveMemoPlan({
        currentMemo: sbtMemo,
        networkID: 11155420,
        sbtCacheRevision: 9,
        sourceSignature: 'sbt',
        viewAddressLower: '0xaaa',
      }),
    ).toEqual({
      canReuseMemo: true,
      gateSnapshot: null,
      result: sbtMemo.result,
      signature: '0xaaa|11155420|sbt|9',
    });
    expect(
      buildUserPageSbtSectionDeriveMemoPlan({
        currentMemo: sbtMemo,
        networkID: 11155420,
        sbtCacheRevision: 10,
        sourceSignature: 'sbt',
        viewAddressLower: '0xaaa',
      }),
    ).toEqual({
      canReuseMemo: false,
      gateSnapshot: null,
      result: null,
      signature: '0xaaa|11155420|sbt|10',
    });
    expect(buildUserPageSbtSectionDeriveSignature()).toBe('|||0');
  });
});
