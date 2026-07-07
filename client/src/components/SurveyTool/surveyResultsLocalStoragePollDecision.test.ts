import {
  buildSurveyResultsLocalStoragePollCountPlan,
  buildSurveyResultsLocalStoragePollPatchPlan,
} from './surveyResultsLocalStoragePollDecision';

describe('surveyResultsLocalStoragePollDecision', () => {
  it('builds coarse signatures and skips in-flight polling when blocks did not change', () => {
    const plan = buildSurveyResultsLocalStoragePollCountPlan({
      currentSurveyId: 'survey-1',
      fetchInFlight: true,
      localQBlock: 1,
      localRespBlock: 2,
      localSBlock: 3,
      netLatest: 9,
      questionLocalBlock: 1,
      questionRefVersion: 4,
      responseLocalBlock: 2,
      surveyLocalBlock: 3,
      surveyResponsesRefVersion: 5,
      viewMode: 'survey',
    });

    expect(plan).toEqual({
      blockOrRespChanged: false,
      coarseSignature: 'survey|survey-1|1|2|3|4|5',
      netLatest: 9,
      shouldForceCountRescan: false,
      shouldReturnFalseForInFlight: true,
      useCachedCounts: true,
    });
  });

  it('forces count rescans when the coarse signature changes or stable cycles hit the cadence', () => {
    expect(
      buildSurveyResultsLocalStoragePollCountPlan({
        forceRescanEvery: 6,
        previousCoarseSignature: 'old',
        stableCycles: 1,
        viewMode: 'questions',
      }).shouldForceCountRescan,
    ).toBe(true);

    const stablePlan = buildSurveyResultsLocalStoragePollCountPlan({
      forceRescanEvery: 6,
      previousCoarseSignature: 'questions||0|0|0|0|0',
      stableCycles: 12,
      viewMode: 'questions',
    });
    expect(stablePlan.shouldForceCountRescan).toBe(true);
  });

  it('returns unchanged-signature no-op patch plans', () => {
    expect(
      buildSurveyResultsLocalStoragePollPatchPlan({
        coarseSignature: 'sig',
        localSurveyResponsesCount: 2,
        netLatest: 9,
        newQuestionsCount: 1,
        previousDetailedSignature: 'sig|1|2|9',
      }),
    ).toEqual({
      cachedQuestionsCount: 1,
      cachedSurveyResponsesCount: 2,
      detailedSignature: 'sig|1|2|9',
      shouldApplyPatch: false,
      shouldReturnFalseForUnchangedSignature: true,
    });
  });

  it('builds state patch fields when blocks or counts changed', () => {
    expect(
      buildSurveyResultsLocalStoragePollPatchPlan({
        blockOrRespChanged: true,
        cachedQuestionsCount: 1,
        cachedSurveyResponsesCount: 2,
        coarseSignature: 'sig',
        localQBlock: 10,
        localRespBlock: 11,
        localSBlock: 12,
        localSurveyResponsesCount: 4,
        netLatest: 20,
        newQuestionsCount: 3,
        previousDetailedSignature: 'previous',
      }),
    ).toEqual({
      cachedQuestionsCount: 3,
      cachedSurveyResponsesCount: 4,
      detailedSignature: 'sig|3|4|20',
      patch: {
        cachedQuestionsCount: 3,
        cachedSurveyResponsesCount: 4,
        networkLatestBlock: 20,
        questionLocalBlock: 10,
        responseLocalBlock: 11,
        surveyLocalBlock: 12,
      },
      shouldApplyPatch: true,
      shouldReturnFalseForUnchangedSignature: false,
    });
  });
});
