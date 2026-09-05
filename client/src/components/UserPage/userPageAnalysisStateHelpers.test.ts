import {
  buildUserPageAnalysisAiOptions,
  buildUserPageAnalysisElapsedStatePatch,
  buildUserPageAnalysisErrorStatePatch,
  buildUserPageAnalysisFingerprint,
  buildUserPageAnalysisResetStatePatch,
  buildUserPageAnalysisResultStatePatch,
  buildUserPageTooltipTargetIds,
  extractUserPageAnalysisAdditionalComment,
  extractUserPageAnalysisImportance,
  formatAnalysisCacheAge,
  getUserPageErrorMessage,
  normalizeUserAnalysisResult,
  resolveUserPageAnalysisCacheStatusState,
  resolveUserPageAnalysisModalDisplayState,
  resolveUserPageFullProfileModalDisplayState,
  sortUserAnalysisKeys,
} from './userPageAnalysisStateHelpers';

describe('userPageAnalysisStateHelpers', () => {
  it('canonicalizes inputs and builds stable fingerprints', async () => {
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
    expect(first).toBe(second);
  });

  it('formats cache age and analysis modal display state', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);
    try {
      expect(formatAnalysisCacheAge(null)).toBe('');
      expect(formatAnalysisCacheAge(1_710_000_000_000 - 5 * 60 * 1000)).toBe('5m ago');
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

    expect(
      resolveUserPageAnalysisModalDisplayState({
        analysisDetails: 'detail',
        analysisHistoricalFigure: 'Ada Lovelace',
        analysisHistoricalReasoning: 'reasoning',
        analyzing: false,
      }),
    ).toEqual({
      shouldRenderAnalysisBody: true,
      shouldRenderAnalyzing: false,
      shouldRenderDetails: true,
      shouldRenderError: false,
      shouldRenderHistoricalAlignment: true,
      shouldRenderHistoricalFigure: true,
      shouldRenderHistoricalReasoning: true,
    });
  });

  it('builds profile modal and tooltip display state', () => {
    expect(
      resolveUserPageFullProfileModalDisplayState({
        account: '0xabc',
        explorerUrl: 'https://explorer.test/address/0xabc',
        minimized: false,
        propViewAddress: '0xABC',
        surveyResponseInfo: [{ id: 'survey-1' }],
      }),
    ).toEqual({
      shouldRenderBookmarksLink: true,
      shouldRenderModalActions: true,
      shouldRenderSurveyEmptyText: false,
      shouldRenderSurveyList: true,
      shouldRenderSurveySpinner: false,
    });

    expect(buildUserPageTooltipTargetIds('0xABCDEF123456')).toMatchObject({
      addrFragment: 'abcdef',
      analyzeBtnWrapId: 'analyzeBtnWrap_abcdef',
      surveySpinnerId: 'surveySpinner_abcdef',
    });
  });

  it('normalizes result patches and error state', () => {
    expect(getUserPageErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getUserPageErrorMessage({ message: 123 }, 'fallback')).toBe('fallback');
    expect(normalizeUserAnalysisResult(null)).toEqual({
      name: 'User Analysis',
      summary: '',
      details: '',
      historicalAlignment: {
        figure: '',
        reasoning: '',
      },
    });
    expect(
      buildUserPageAnalysisResultStatePatch({
        cachedAt: '1710000000000',
        includeElapsed: true,
        includeError: true,
        includeModal: true,
        result: {
          name: 'Cached',
          summary: 'Summary',
          details: 'Details',
          historicalAlignment: {
            figure: 'Ada',
            reasoning: 'Reason',
          },
        },
        servedFromCache: true,
      }),
    ).toMatchObject({
      showAnalysisModal: true,
      aiAnalysis: 'Summary',
      analysisDetails: 'Details',
      analysisName: 'Cached',
      analysisHistoricalFigure: 'Ada',
      analysisHistoricalReasoning: 'Reason',
      analysisElapsedMs: 0,
      analysisError: '',
      analyzing: false,
      analysisServedFromCache: true,
      analysisCachedAt: 1710000000000,
    });
    expect(buildUserPageAnalysisResetStatePatch({ analyzing: 'yes' }).analyzing).toBe(false);
    expect(buildUserPageAnalysisElapsedStatePatch({ nowMs: 1250, startedAt: 1000 })).toEqual({
      analysisElapsedMs: 250,
    });
    expect(buildUserPageAnalysisErrorStatePatch({ message: 'Try again' })).toMatchObject({
      analysisError: 'Try again',
      analyzing: false,
      showAnalysisModal: true,
    });
  });

  it('builds AI options and visible response analysis fields', () => {
    const sessionConfig = {
      ai: { provider: 'openai' },
      corsWorkerUrl: 'https://worker.example',
    };
    const context = { account: '0x123', chainId: 84532 };
    expect(
      buildUserPageAnalysisAiOptions({
        analysisSession: {
          slug: 'analysis-session',
          sessionConfig,
          status: 'allowed',
          reason: 'selected',
        },
        context,
      }),
    ).toEqual({
      context,
      sessionSlug: 'analysis-session',
      sessionConfig,
      throwOnError: true,
      sessionSelection: {
        gateStatus: 'allowed',
        reason: 'selected',
      },
    });
    expect(
      extractUserPageAnalysisAdditionalComment({
        additionalComment: { value: '*' },
        additionalComments: { value: 'extra context' },
      }),
    ).toBe('extra context');
    expect(extractUserPageAnalysisImportance({ meta: { importance: 2 } })).toBe(2);
    expect(extractUserPageAnalysisImportance({ answer: { conviction: { encrypted: true } } })).toBeUndefined();
  });
});
