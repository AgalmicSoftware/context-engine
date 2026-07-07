export type SurveyResultsLocalStoragePollCountPlan = {
  blockOrRespChanged: boolean;
  coarseSignature: string;
  netLatest: number;
  shouldForceCountRescan: boolean;
  shouldReturnFalseForInFlight: boolean;
  useCachedCounts: boolean;
};

export type BuildSurveyResultsLocalStoragePollCountPlanArgs = {
  cachedQuestionsCount?: unknown;
  cachedSurveyResponsesCount?: unknown;
  currentSurveyId?: unknown;
  fetchInFlight?: unknown;
  forceRescanEvery?: unknown;
  localQBlock?: unknown;
  localRespBlock?: unknown;
  localSBlock?: unknown;
  netLatest?: unknown;
  previousCoarseSignature?: unknown;
  questionLocalBlock?: unknown;
  questionRefVersion?: unknown;
  responseLocalBlock?: unknown;
  stableCycles?: unknown;
  surveyLocalBlock?: unknown;
  surveyResponsesRefVersion?: unknown;
  viewMode?: unknown;
};

export type SurveyResultsLocalStoragePollPatchPlan = {
  cachedQuestionsCount: number;
  cachedSurveyResponsesCount: number;
  detailedSignature: string;
  patch?: {
    cachedQuestionsCount: number;
    cachedSurveyResponsesCount: number;
    networkLatestBlock: number;
    questionLocalBlock: number;
    responseLocalBlock: number;
    surveyLocalBlock: number;
  };
  shouldApplyPatch: boolean;
  shouldReturnFalseForUnchangedSignature: boolean;
};

export type BuildSurveyResultsLocalStoragePollPatchPlanArgs = {
  blockOrRespChanged?: unknown;
  cachedQuestionsCount?: unknown;
  cachedSurveyResponsesCount?: unknown;
  coarseSignature?: unknown;
  localQBlock?: unknown;
  localRespBlock?: unknown;
  localSBlock?: unknown;
  localSurveyResponsesCount?: unknown;
  netLatest?: unknown;
  newQuestionsCount?: unknown;
  previousDetailedSignature?: unknown;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const buildSurveyResultsLocalStoragePollCountPlan = ({
  currentSurveyId = '',
  fetchInFlight = false,
  forceRescanEvery = 0,
  localQBlock = 0,
  localRespBlock = 0,
  localSBlock = 0,
  netLatest = 0,
  previousCoarseSignature = '',
  questionLocalBlock = 0,
  questionRefVersion = 0,
  responseLocalBlock = 0,
  stableCycles = 0,
  surveyLocalBlock = 0,
  surveyResponsesRefVersion = 0,
  viewMode = '',
}: BuildSurveyResultsLocalStoragePollCountPlanArgs = {}): SurveyResultsLocalStoragePollCountPlan => {
  const surveyId = String(currentSurveyId || '');
  const coarseSignature = [
    String(viewMode || ''),
    surveyId,
    toNumber(localQBlock),
    toNumber(localRespBlock),
    toNumber(localSBlock),
    toNumber(questionRefVersion),
    surveyId ? toNumber(surveyResponsesRefVersion) : 0,
  ].join('|');
  const blockOrRespChanged =
    toNumber(localQBlock) !== toNumber(questionLocalBlock) ||
    toNumber(localRespBlock) !== toNumber(responseLocalBlock) ||
    toNumber(localSBlock) !== toNumber(surveyLocalBlock);
  const inFlight = !!fetchInFlight;
  if (inFlight && !blockOrRespChanged) {
    return {
      blockOrRespChanged,
      coarseSignature,
      netLatest: toNumber(netLatest),
      shouldForceCountRescan: false,
      shouldReturnFalseForInFlight: true,
      useCachedCounts: true,
    };
  }

  const stableCycleCount = Math.max(0, toNumber(stableCycles));
  const forceEvery = toNumber(forceRescanEvery);
  const forceRescanOnStableCycle = stableCycleCount > 0 && forceEvery > 0 && stableCycleCount % forceEvery === 0;
  const coarseSignatureUnchanged = coarseSignature === String(previousCoarseSignature || '');
  const shouldForceCountRescan = !inFlight && (!coarseSignatureUnchanged || forceRescanOnStableCycle);

  return {
    blockOrRespChanged,
    coarseSignature,
    netLatest: toNumber(netLatest),
    shouldForceCountRescan,
    shouldReturnFalseForInFlight: false,
    useCachedCounts: inFlight,
  };
};

export const buildSurveyResultsLocalStoragePollPatchPlan = ({
  blockOrRespChanged = false,
  cachedQuestionsCount = 0,
  cachedSurveyResponsesCount = 0,
  coarseSignature = '',
  localQBlock = 0,
  localRespBlock = 0,
  localSBlock = 0,
  localSurveyResponsesCount = 0,
  netLatest = 0,
  newQuestionsCount = 0,
  previousDetailedSignature = '',
}: BuildSurveyResultsLocalStoragePollPatchPlanArgs = {}): SurveyResultsLocalStoragePollPatchPlan => {
  const nextQuestionsCount = toNumber(newQuestionsCount);
  const nextSurveyResponsesCount = toNumber(localSurveyResponsesCount);
  const nextNetLatest = toNumber(netLatest);
  const detailedSignature = [
    String(coarseSignature || ''),
    nextQuestionsCount,
    nextSurveyResponsesCount,
    nextNetLatest,
  ].join('|');
  if (detailedSignature === String(previousDetailedSignature || '')) {
    return {
      cachedQuestionsCount: nextQuestionsCount,
      cachedSurveyResponsesCount: nextSurveyResponsesCount,
      detailedSignature,
      shouldApplyPatch: false,
      shouldReturnFalseForUnchangedSignature: true,
    };
  }

  const questionCountChanged = nextQuestionsCount !== toNumber(cachedQuestionsCount);
  const surveyResponseCountChanged = nextSurveyResponsesCount !== toNumber(cachedSurveyResponsesCount);
  const shouldApplyPatch = !!blockOrRespChanged || questionCountChanged || surveyResponseCountChanged;
  return {
    cachedQuestionsCount: nextQuestionsCount,
    cachedSurveyResponsesCount: nextSurveyResponsesCount,
    detailedSignature,
    ...(shouldApplyPatch
      ? {
          patch: {
            questionLocalBlock: toNumber(localQBlock),
            responseLocalBlock: toNumber(localRespBlock),
            surveyLocalBlock: toNumber(localSBlock),
            cachedQuestionsCount: nextQuestionsCount,
            cachedSurveyResponsesCount: nextSurveyResponsesCount,
            networkLatestBlock: nextNetLatest,
          },
        }
      : {}),
    shouldApplyPatch,
    shouldReturnFalseForUnchangedSignature: false,
  };
};
