jest.mock('../web3/chainGateway.js', () => ({
  __esModule: true,
  normalizeSessionSlug: jest.fn((value = '') =>
    String(value || '')
      .trim()
      .toLowerCase(),
  ),
}));

const {
  createInitialProfileScanReport,
  createProfileScanFanoutPlan,
  resolveProfileScanAttemptedCoverageSlugs,
} = require('./profileScanReportHelpers.js');

describe('profileScanReportHelpers', () => {
  it('enables list-scope fanout only for explicit non-legacy profile scan modes', () => {
    expect(
      createProfileScanFanoutPlan({
        scopeContext: { scope: 'list' },
        allSessionsMode: {
          legacyAllSessions: false,
          useAllSessionsSbtScan: true,
          useAllSessionsSurveyActivityScan: false,
          useAllSessionsQuestionActivityScan: true,
          useAllSessionsScan: false,
        },
      }),
    ).toMatchObject({
      isListScope: true,
      allowListScopeSbtFanout: true,
      allowListScopeSurveyActivityFanout: false,
      allowListScopeQuestionActivityFanout: true,
      allowListScopeAnyFanout: true,
      useAllSessionsScan: true,
      shouldHydrateRegistry: true,
    });

    expect(
      createProfileScanFanoutPlan({
        scopeContext: { scope: 'list' },
        allSessionsMode: {
          legacyAllSessions: true,
          useAllSessionsSbtScan: true,
          useAllSessionsSurveyActivityScan: true,
          useAllSessionsQuestionActivityScan: true,
          useAllSessionsScan: true,
        },
      }),
    ).toMatchObject({
      allowListScopeSbtFanout: false,
      allowListScopeSurveyActivityFanout: false,
      allowListScopeQuestionActivityFanout: false,
      allowListScopeAnyFanout: false,
      useAllSessionsScan: false,
      shouldHydrateRegistry: true,
    });
  });

  it('uses the global all-session setting outside list scope', () => {
    expect(
      createProfileScanFanoutPlan({
        scopeContext: { scope: 'active' },
        allSessionsMode: { useAllSessionsScan: true },
      }),
    ).toMatchObject({
      isListScope: false,
      allowListScopeAnyFanout: false,
      useAllSessionsScan: true,
      shouldHydrateRegistry: true,
    });
  });

  it('pins attempted coverage to the allowed list when list fanout is active', () => {
    const fanoutPlan = createProfileScanFanoutPlan({
      scopeContext: { scope: 'list' },
      allSessionsMode: {
        useAllSessionsSbtScan: true,
      },
    });

    const result = resolveProfileScanAttemptedCoverageSlugs({
      fanoutPlan,
      scopeContext: {
        scope: 'list',
        list: ['Alpha', 'Beta', 'Alpha'],
        activeSlug: 'Fallback',
      },
      allSlugs: ['registry-a', 'registry-b'],
    });

    expect(result.listScopeCoverageSlugs).toEqual(['alpha', 'beta']);
    expect(result.attemptedCoverageSlugs).toEqual(['alpha', 'beta']);
    expect(result.attemptedCoverageSlugSet.has('alpha')).toBe(true);
    expect(result.attemptedCoverageSlugSet.has('registry-a')).toBe(false);
  });

  it('builds the initial profile scan report without mutating plan arrays', () => {
    const relevantSlugs = ['alpha'];
    const report = createInitialProfileScanReport({
      targetLower: '0xabc',
      profileScanPlan: {
        usedAllSessions: true,
        coverageComplete: false,
        coverageReason: 'registry-timeout',
        registryEntryCount: 4,
        relevantSlugs,
        rawAllSlugCount: 7,
        activeChainSlugCount: 2,
        scopedFallbackSlugCount: 1,
        prioritizedGeneralFirst: true,
        scanOrdering: 'registry',
      },
      allSessionsMode: {
        useAllSessionsSbtScan: true,
        useAllSessionsSurveyActivityScan: true,
        useAllSessionsQuestionActivityScan: false,
        useAllSessionsActivityScan: true,
      },
      fanoutPlan: {
        allowListScopeSbtFanout: true,
      },
      attemptedCoverageSlugs: ['alpha', 'beta'],
      slugFetchTimeoutMs: 12000,
      sbtFetchTimeoutMs: 8000,
      activityFetchTimeoutMs: 9000,
      activityLookbackBlocks: 500,
      sbtBurstSize: 3,
    });

    expect(report).toMatchObject({
      targetAddress: '0xabc',
      usedAllSessions: true,
      useAllSessionsSbtScan: true,
      useAllSessionsSurveyActivityScan: true,
      useAllSessionsQuestionActivityScan: false,
      useAllSessionsActivityScan: true,
      listScopeSbtFanout: true,
      attemptedSlugs: ['alpha', 'beta'],
      hadRpcErrors: true,
      coverageComplete: false,
      coverageReason: 'registry-timeout',
      registryEntryCount: 4,
      rawAllSlugCount: 7,
      activeChainSlugCount: 2,
      scopedFallbackSlugCount: 1,
      relevantSlugs: ['alpha'],
      prioritizedGeneralFirst: true,
      scanOrdering: 'registry',
      slugFetchTimeoutMs: 12000,
      sbtFetchTimeoutMs: 8000,
      activityFetchTimeoutMs: 9000,
      activityLookbackBlocks: 500,
      sbtBurstSize: 3,
    });

    report.relevantSlugs.push('mutated');
    expect(relevantSlugs).toEqual(['alpha']);
  });
});
