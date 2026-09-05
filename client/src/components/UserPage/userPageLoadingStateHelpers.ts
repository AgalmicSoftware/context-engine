import { isPlainAnalysisObject, type UserPageUnknownRecord } from './userPageCoreHelpers';
import { buildUserPageDeepScanRefreshCarryPatch } from './userPageDeepScanHelpers';

type UserPageLengthLike = {
  length: number;
};

export type BuildUserPageSectionLoadingEmptyStateArgs = {
  isQuestionLoadingAny?: unknown;
  isSbtLoadingAny?: unknown;
  isSurveyLoadingAny?: unknown;
  isSurveyReady?: unknown;
  isQuestionReady?: unknown;
  loadingQuestions?: unknown;
  loadingSurveys?: unknown;
  questionCreationInfo?: UserPageLengthLike;
  questionDeepScanLoadingActive?: unknown;
  questionResponseInfo?: UserPageLengthLike;
  sbtList?: UserPageLengthLike;
  surveyCreationInfo?: UserPageLengthLike;
  surveyDeepScanLoadingActive?: unknown;
  surveyResponseInfo?: UserPageLengthLike;
};

export type BuildUserPageUncertainEmptyTextArgs = {
  hasUncertainSbtData?: unknown;
  hasUncertainUserData?: unknown;
  sbtLabel?: unknown;
  sbtsLowerLabel?: unknown;
};

export type ShouldRetryUserPageQuestionDataArgs = {
  hasUncertainUserData?: unknown;
  holdQuestionLoading?: unknown;
  questionSection?: unknown;
};

export type BuildUserPageUncertaintyLoadingFlagsArgs = {
  hasQuestionSources?: unknown;
  hasSbtSources?: unknown;
  hasSurveySources?: unknown;
  keepQuestionLoadingDuringDeepScan?: unknown;
  keepSurveyLoadingDuringDeepScan?: unknown;
  prevState?: unknown;
  uncertainResources?: unknown;
};

export type UserPageUncertaintyLoadingFlags = {
  hasGateUncertainty: boolean;
  hasQuestionGateUncertainty: boolean;
  hasSurveyGateUncertainty: boolean;
  keepQuestionLoadingDuringDeepScan: boolean;
  keepQuestionLoadingFromUserUncertainty: boolean;
  keepSbtLoadingFromUserUncertainty: boolean;
  keepSurveyLoadingDuringDeepScan: boolean;
  keepSurveyLoadingFromUserUncertainty: boolean;
  preserveUserDataUncertainty: boolean;
};

export type UserPageCacheRefreshStatePatchPlan = {
  loadingDiag: UserPageUnknownRecord;
  statePatch: UserPageUnknownRecord | null;
  uncertaintyFlags: UserPageUncertaintyLoadingFlags;
};

export type BuildUserPageUserStatsMergePatchArgs = {
  prevUserStats?: unknown;
  userStatsPatch?: unknown;
};

export type BuildUserPageCacheRefreshStatePatchArgs = {
  aggregatePresent?: unknown;
  deepScanCarryPatch?: unknown;
  deepScanProgressRows?: unknown;
  deepScanTooltipLines?: unknown;
  hasQuestionSources?: unknown;
  hasSbtSources?: unknown;
  hasSurveySources?: unknown;
  holdQuestionLoading?: unknown;
  holdSbtLoading?: unknown;
  holdSurveyLoading?: unknown;
  isDeepScanLoadingEnabledForSection?: ((section?: unknown) => unknown) | null;
  keepQuestionLoadingDuringDeepScan?: unknown;
  keepSurveyLoadingDuringDeepScan?: unknown;
  markLoading?: unknown;
  prevState?: unknown;
  questionSection?: unknown;
  sbtSection?: unknown;
  surveySection?: unknown;
  uncertainResources?: unknown;
};

export type BuildUserPageRenderLoadingStateArgs = {
  isDeepScanLoadingEnabledForSection?: ((section?: unknown) => unknown) | null;
  isDeepScanning?: unknown;
  isQuestionCacheReady?: unknown;
  isResponsesCacheReady?: unknown;
  isSBTCacheReady?: unknown;
  isSurveyCacheReady?: unknown;
  loadingQuestions?: unknown;
  loadingSBTs?: unknown;
  loadingSurveys?: unknown;
};

export type ResolveUserPageAiActionAvailabilityArgs = {
  aiAvailable?: unknown;
  disabledByCache?: unknown;
  walletLabel?: unknown;
};

export type ResolveUserPageAnalyzeButtonDisplayStateArgs = {
  aiActionAvailability?: Partial<UserPageAiActionAvailability> | null;
  analyzing?: unknown;
};

export type ResolveUserPageCompareButtonDisplayStateArgs = {
  aiActionAvailability?: Partial<UserPageAiActionAvailability> | null;
  collapseOpen?: unknown;
};

export type ResolveUserPageAiActionPlanArgs = {
  aiAvailable?: unknown;
  analyzing?: unknown;
  collapseOpen?: unknown;
  disabledByCache?: unknown;
  walletLabel?: unknown;
};

export type BuildUserPageCacheRefreshDisplayStateArgs = BuildUserPageRenderLoadingStateArgs &
  BuildUserPageSectionLoadingEmptyStateArgs &
  BuildUserPageUncertainEmptyTextArgs & {
    aiAvailable?: unknown;
    analyzing?: unknown;
    collapseOpen?: unknown;
    hasUncertainGateAccess?: unknown;
    walletLabel?: unknown;
  };

export type ResolveUserPageCacheReadinessDisplayPlanArgs = {
  disabledByCache?: unknown;
  hasAnyLoading?: unknown;
  hasVisibleData?: unknown;
};

export type ResolveUserPageSectionToggleDisplayStateArgs = {
  open?: unknown;
};

export type UserPageCacheActionKind = 'disabled' | 'enabled';
export type UserPageCacheDisplayKind = 'idle' | 'loading' | 'stale-or-cache-miss';

export type UserPageSectionLoadingEmptyState = {
  questionResponsesLoadingEmpty: boolean;
  questionsCreatedLoadingEmpty: boolean;
  sbtSectionLoadingEmpty: boolean;
  surveyResponsesLoadingEmpty: boolean;
  surveysCreatedLoadingEmpty: boolean;
};

export type UserPageUncertainEmptyText = {
  questionResponsesEmptyText: string;
  sbtEmptyText: string;
};

export type UserPageRenderLoadingState = {
  disabledByCache: boolean;
  isQuestionLoadingAny: boolean;
  isQuestionReady: boolean;
  isResponsesReady: boolean;
  isSBTReady: boolean;
  isSbtLoadingAny: boolean;
  isSurveyLoadingAny: boolean;
  isSurveyReady: boolean;
  questionDeepScanLoadingActive: boolean;
  surveyDeepScanLoadingActive: boolean;
};

export type UserPageAiActionAvailability = {
  disabled: boolean;
  title?: string;
};

export type UserPageAnalyzeButtonDisplayState = {
  ariaBusy: 'false' | 'true';
  disabled: boolean;
  label: string;
  shouldRenderAnalyzing: boolean;
  title?: string;
};

export type UserPageCompareButtonDisplayState = {
  disabled: boolean;
  shouldRenderCollapseClosedIcon: boolean;
  shouldRenderCollapseOpenIcon: boolean;
  title?: string;
};

export type UserPageAiActionPlan = {
  aiActionAvailability: UserPageAiActionAvailability;
  analyzeButtonDisplayState: UserPageAnalyzeButtonDisplayState;
  compareButtonDisplayState: UserPageCompareButtonDisplayState;
};

export type UserPageCacheRefreshDisplayState = {
  aiActionPlan: UserPageAiActionPlan;
  cacheActionKind: UserPageCacheActionKind;
  cacheDisplayKind: UserPageCacheDisplayKind;
  hasAnyLoading: boolean;
  hasGatedOrDecryptDisplayFallback: boolean;
  hasMissingDataFallback: boolean;
  hasVisibleData: boolean;
  loadingIndicators: {
    questionResponses: boolean;
    questionsCreated: boolean;
    sbt: boolean;
    surveyResponses: boolean;
    surveysCreated: boolean;
  };
  loadingState: UserPageRenderLoadingState;
  sectionLoadingEmptyState: UserPageSectionLoadingEmptyState;
  uncertainEmptyText: UserPageUncertainEmptyText;
};

export type UserPageCacheReadinessDisplayPlan = {
  cacheActionKind: UserPageCacheActionKind;
  cacheDisplayKind: UserPageCacheDisplayKind;
  hasMissingDataFallback: boolean;
};

export type UserPageSectionToggleDisplayState = {
  isOpen: boolean;
  shouldRenderClosedIcon: boolean;
  shouldRenderOpenIcon: boolean;
};

export const buildUserPageRenderLoadingState = ({
  isDeepScanLoadingEnabledForSection = null,
  isDeepScanning = false,
  isQuestionCacheReady = false,
  isResponsesCacheReady = false,
  isSBTCacheReady = false,
  isSurveyCacheReady = false,
  loadingQuestions = false,
  loadingSBTs = false,
  loadingSurveys = false,
}: BuildUserPageRenderLoadingStateArgs = {}): UserPageRenderLoadingState => {
  const isSBTReady = !!isSBTCacheReady;
  const isSurveyReady = !!isSurveyCacheReady;
  const isQuestionReady = !!isQuestionCacheReady;
  const isResponsesReady = !!isResponsesCacheReady;
  const deepScanActive = !!isDeepScanning;
  const sectionEnabled =
    typeof isDeepScanLoadingEnabledForSection === 'function' ? isDeepScanLoadingEnabledForSection : () => false;
  const surveyDeepScanLoadingActive = !!(sectionEnabled('surveys') && deepScanActive);
  const questionDeepScanLoadingActive = !!(sectionEnabled('questions') && deepScanActive);
  return {
    disabledByCache: !(isSBTReady && isSurveyReady && isQuestionReady && isResponsesReady),
    isQuestionLoadingAny: !!loadingQuestions || !isQuestionReady || !isResponsesReady || questionDeepScanLoadingActive,
    isQuestionReady,
    isResponsesReady,
    isSBTReady,
    isSbtLoadingAny: !!loadingSBTs || !isSBTReady || deepScanActive,
    isSurveyLoadingAny: !!loadingSurveys || !isSurveyReady || !isResponsesReady || surveyDeepScanLoadingActive,
    isSurveyReady,
    questionDeepScanLoadingActive,
    surveyDeepScanLoadingActive,
  };
};

export const resolveUserPageAiActionAvailability = ({
  aiAvailable = null,
  disabledByCache = false,
  walletLabel = 'wallet',
}: ResolveUserPageAiActionAvailabilityArgs = {}): UserPageAiActionAvailability => {
  if (aiAvailable === false) {
    return {
      disabled: true,
      title: `AI not available — connect a ${String(walletLabel || 'wallet')} or use a session with sponsored AI`,
    };
  }
  if (disabledByCache) {
    return {
      disabled: true,
      title: 'Available when the user page fully loads.',
    };
  }
  return {
    disabled: false,
    title: undefined,
  };
};

export const resolveUserPageAnalyzeButtonDisplayState = ({
  aiActionAvailability = null,
  analyzing = false,
}: ResolveUserPageAnalyzeButtonDisplayStateArgs = {}): UserPageAnalyzeButtonDisplayState => {
  const shouldRenderAnalyzing = !!analyzing;
  return {
    ariaBusy: shouldRenderAnalyzing ? 'true' : 'false',
    disabled: shouldRenderAnalyzing || !!aiActionAvailability?.disabled,
    label: shouldRenderAnalyzing ? 'Analyzing' : 'Analyze',
    shouldRenderAnalyzing,
    title: aiActionAvailability?.title,
  };
};

export const resolveUserPageCompareButtonDisplayState = ({
  aiActionAvailability = null,
  collapseOpen = false,
}: ResolveUserPageCompareButtonDisplayStateArgs = {}): UserPageCompareButtonDisplayState => {
  const shouldRenderCollapseOpenIcon = !!collapseOpen;
  return {
    disabled: !!aiActionAvailability?.disabled,
    shouldRenderCollapseClosedIcon: !shouldRenderCollapseOpenIcon,
    shouldRenderCollapseOpenIcon,
    title: aiActionAvailability?.title,
  };
};

export const resolveUserPageAiActionPlan = ({
  aiAvailable = null,
  analyzing = false,
  collapseOpen = false,
  disabledByCache = false,
  walletLabel = 'wallet',
}: ResolveUserPageAiActionPlanArgs = {}): UserPageAiActionPlan => {
  const aiActionAvailability = resolveUserPageAiActionAvailability({
    aiAvailable,
    disabledByCache,
    walletLabel,
  });
  return {
    aiActionAvailability,
    analyzeButtonDisplayState: resolveUserPageAnalyzeButtonDisplayState({
      aiActionAvailability,
      analyzing,
    }),
    compareButtonDisplayState: resolveUserPageCompareButtonDisplayState({
      aiActionAvailability,
      collapseOpen,
    }),
  };
};

export const resolveUserPageSectionToggleDisplayState = ({
  open = false,
}: ResolveUserPageSectionToggleDisplayStateArgs = {}): UserPageSectionToggleDisplayState => {
  const isOpen = !!open;
  return {
    isOpen,
    shouldRenderClosedIcon: !isOpen,
    shouldRenderOpenIcon: isOpen,
  };
};

export const buildUserPageSectionLoadingEmptyState = ({
  isQuestionLoadingAny = false,
  isQuestionReady = false,
  isSbtLoadingAny = false,
  isSurveyLoadingAny = false,
  isSurveyReady = false,
  loadingQuestions = false,
  loadingSurveys = false,
  questionCreationInfo = [],
  questionDeepScanLoadingActive = false,
  questionResponseInfo = [],
  sbtList = [],
  surveyCreationInfo = [],
  surveyDeepScanLoadingActive = false,
  surveyResponseInfo = [],
}: BuildUserPageSectionLoadingEmptyStateArgs = {}): UserPageSectionLoadingEmptyState => ({
  sbtSectionLoadingEmpty: Boolean(isSbtLoadingAny && sbtList.length === 0),
  surveyResponsesLoadingEmpty: Boolean(isSurveyLoadingAny && surveyResponseInfo.length === 0),
  surveysCreatedLoadingEmpty: Boolean(
    (loadingSurveys || !isSurveyReady || surveyDeepScanLoadingActive) && surveyCreationInfo.length === 0,
  ),
  questionResponsesLoadingEmpty: Boolean(isQuestionLoadingAny && questionResponseInfo.length === 0),
  questionsCreatedLoadingEmpty: Boolean(
    (loadingQuestions || !isQuestionReady || questionDeepScanLoadingActive) && questionCreationInfo.length === 0,
  ),
});

export const buildUserPageUncertainEmptyText = ({
  hasUncertainSbtData = false,
  hasUncertainUserData = false,
  sbtLabel = 'SBT',
  sbtsLowerLabel = 'SBTs',
}: BuildUserPageUncertainEmptyTextArgs = {}): UserPageUncertainEmptyText => ({
  questionResponsesEmptyText: hasUncertainUserData
    ? 'Question responses may be incomplete due scan/RPC issues. Try refresh.'
    : 'No question responses found.',
  sbtEmptyText: hasUncertainSbtData
    ? `${String(sbtLabel)} results may be incomplete due scan/RPC issues. Try refresh.`
    : `No ${String(sbtsLowerLabel)} found.`,
});

const readUserPageDisplayLength = (value: UserPageLengthLike | undefined): number => {
  const length = Number(value?.length || 0);
  return Number.isFinite(length) && length > 0 ? length : 0;
};

export const resolveUserPageCacheReadinessDisplayPlan = ({
  disabledByCache = false,
  hasAnyLoading = false,
  hasVisibleData = false,
}: ResolveUserPageCacheReadinessDisplayPlanArgs = {}): UserPageCacheReadinessDisplayPlan => {
  const isLoading = !!hasAnyLoading;
  const hasData = !!hasVisibleData;
  return {
    cacheActionKind: disabledByCache ? 'disabled' : 'enabled',
    cacheDisplayKind: isLoading ? 'loading' : hasData ? 'idle' : 'stale-or-cache-miss',
    hasMissingDataFallback: !isLoading && !hasData,
  };
};

export const buildUserPageCacheRefreshDisplayState = ({
  aiAvailable = null,
  analyzing = false,
  collapseOpen = false,
  hasUncertainGateAccess = false,
  hasUncertainSbtData = false,
  hasUncertainUserData = false,
  isDeepScanLoadingEnabledForSection = null,
  isDeepScanning = false,
  isQuestionCacheReady = false,
  isResponsesCacheReady = false,
  isSBTCacheReady = false,
  isSurveyCacheReady = false,
  loadingQuestions = false,
  loadingSBTs = false,
  loadingSurveys = false,
  questionCreationInfo = [],
  questionResponseInfo = [],
  sbtLabel = 'SBT',
  sbtList = [],
  sbtsLowerLabel = 'SBTs',
  surveyCreationInfo = [],
  surveyResponseInfo = [],
  walletLabel = 'wallet',
}: BuildUserPageCacheRefreshDisplayStateArgs = {}): UserPageCacheRefreshDisplayState => {
  const loadingState = buildUserPageRenderLoadingState({
    isDeepScanLoadingEnabledForSection,
    isDeepScanning,
    isQuestionCacheReady,
    isResponsesCacheReady,
    isSBTCacheReady,
    isSurveyCacheReady,
    loadingQuestions,
    loadingSBTs,
    loadingSurveys,
  });
  const hasVisibleData = [
    questionCreationInfo,
    questionResponseInfo,
    sbtList,
    surveyCreationInfo,
    surveyResponseInfo,
  ].some((value) => readUserPageDisplayLength(value) > 0);
  const aiActionPlan = resolveUserPageAiActionPlan({
    aiAvailable,
    analyzing,
    collapseOpen,
    // Analysis operates on the visible profile snapshot. Do not leave it blocked by an
    // unrelated cache lane once useful profile data has already been hydrated.
    disabledByCache: loadingState.disabledByCache && !hasVisibleData,
    walletLabel,
  });
  const sectionLoadingEmptyState = buildUserPageSectionLoadingEmptyState({
    isQuestionLoadingAny: loadingState.isQuestionLoadingAny,
    isQuestionReady: loadingState.isQuestionReady,
    isSbtLoadingAny: loadingState.isSbtLoadingAny,
    isSurveyLoadingAny: loadingState.isSurveyLoadingAny,
    isSurveyReady: loadingState.isSurveyReady,
    loadingQuestions,
    loadingSurveys,
    questionCreationInfo,
    questionDeepScanLoadingActive: loadingState.questionDeepScanLoadingActive,
    questionResponseInfo,
    sbtList,
    surveyCreationInfo,
    surveyDeepScanLoadingActive: loadingState.surveyDeepScanLoadingActive,
    surveyResponseInfo,
  });
  const uncertainEmptyText = buildUserPageUncertainEmptyText({
    hasUncertainSbtData,
    hasUncertainUserData,
    sbtLabel,
    sbtsLowerLabel,
  });
  const hasAnyLoading =
    loadingState.isQuestionLoadingAny || loadingState.isSbtLoadingAny || loadingState.isSurveyLoadingAny;
  const cacheReadinessDisplayPlan = resolveUserPageCacheReadinessDisplayPlan({
    disabledByCache: loadingState.disabledByCache,
    hasAnyLoading,
    hasVisibleData,
  });

  return {
    aiActionPlan,
    cacheActionKind: cacheReadinessDisplayPlan.cacheActionKind,
    cacheDisplayKind: cacheReadinessDisplayPlan.cacheDisplayKind,
    hasAnyLoading,
    hasGatedOrDecryptDisplayFallback: !!hasUncertainGateAccess || !!hasUncertainUserData,
    hasMissingDataFallback: cacheReadinessDisplayPlan.hasMissingDataFallback,
    hasVisibleData,
    loadingIndicators: {
      questionResponses: loadingState.isQuestionLoadingAny,
      questionsCreated: loadingState.isQuestionLoadingAny,
      sbt: loadingState.isSbtLoadingAny,
      surveyResponses: loadingState.isSurveyLoadingAny,
      surveysCreated: loadingState.isSurveyLoadingAny,
    },
    loadingState,
    sectionLoadingEmptyState,
    uncertainEmptyText,
  };
};

export const shouldRetryUserPageQuestionData = ({
  hasUncertainUserData = false,
  holdQuestionLoading = false,
  questionSection = null,
}: ShouldRetryUserPageQuestionDataArgs = {}): boolean => {
  if (!hasUncertainUserData) return false;
  if (holdQuestionLoading || !questionSection) return true;
  const section = isPlainAnalysisObject(questionSection) ? questionSection : {};
  const questionResponseInfo = section.questionResponseInfo;
  return !Array.isArray(questionResponseInfo) || questionResponseInfo.length === 0;
};

export const buildUserPageUncertaintyLoadingFlags = ({
  hasQuestionSources = false,
  hasSbtSources = false,
  hasSurveySources = false,
  keepQuestionLoadingDuringDeepScan = false,
  keepSurveyLoadingDuringDeepScan = false,
  prevState = null,
  uncertainResources = null,
}: BuildUserPageUncertaintyLoadingFlagsArgs = {}): UserPageUncertaintyLoadingFlags => {
  const prev = isPlainAnalysisObject(prevState) ? prevState : {};
  const resources = uncertainResources instanceof Set ? uncertainResources : new Set<string>();
  const preserveUserDataUncertainty = !!prev.hasUncertainUserData;
  const hasSurveyGateUncertainty = resources.has('surveyResponses');
  const hasQuestionGateUncertainty = resources.has('questionResponses');
  return {
    hasGateUncertainty: hasSurveyGateUncertainty || hasQuestionGateUncertainty,
    hasQuestionGateUncertainty,
    hasSurveyGateUncertainty,
    keepQuestionLoadingDuringDeepScan: !!keepQuestionLoadingDuringDeepScan,
    keepQuestionLoadingFromUserUncertainty:
      preserveUserDataUncertainty && (!!prev.isDeepScanning || !hasQuestionSources),
    keepSbtLoadingFromUserUncertainty: preserveUserDataUncertainty && (!!prev.isDeepScanning || !hasSbtSources),
    keepSurveyLoadingDuringDeepScan: !!keepSurveyLoadingDuringDeepScan,
    keepSurveyLoadingFromUserUncertainty: preserveUserDataUncertainty && (!!prev.isDeepScanning || !hasSurveySources),
    preserveUserDataUncertainty,
  };
};

export const buildUserPageUserStatsMergePatch = ({
  prevUserStats = {},
  userStatsPatch = {},
}: BuildUserPageUserStatsMergePatchArgs = {}): UserPageUnknownRecord | null => {
  const patch = isPlainAnalysisObject(userStatsPatch) ? userStatsPatch : {};
  if (Object.keys(patch).length === 0) return null;
  const previous = isPlainAnalysisObject(prevUserStats) ? prevUserStats : {};
  return { ...previous, ...patch };
};

const readRefreshSectionCount = (section: unknown, key: string): number | string => {
  if (!isPlainAnalysisObject(section)) return 'N/A (held)';
  const maybeLength = (section[key] as UserPageLengthLike | undefined)?.length;
  return maybeLength ?? 'N/A (held)';
};

const readRefreshSectionLength = (section: UserPageUnknownRecord, key: string): number => {
  const length = Number((section[key] as UserPageLengthLike | undefined)?.length || 0);
  return Number.isFinite(length) && length > 0 ? length : 0;
};

export const buildUserPageCacheRefreshStatePatch = ({
  aggregatePresent = false,
  deepScanCarryPatch = undefined,
  deepScanProgressRows = null,
  deepScanTooltipLines = null,
  hasQuestionSources = false,
  hasSbtSources = false,
  hasSurveySources = false,
  holdQuestionLoading = false,
  holdSbtLoading = false,
  holdSurveyLoading = false,
  isDeepScanLoadingEnabledForSection = null,
  keepQuestionLoadingDuringDeepScan = undefined,
  keepSurveyLoadingDuringDeepScan = undefined,
  markLoading = false,
  prevState = null,
  questionSection = null,
  sbtSection = null,
  surveySection = null,
  uncertainResources = null,
}: BuildUserPageCacheRefreshStatePatchArgs = {}): UserPageCacheRefreshStatePatchPlan => {
  const prev = isPlainAnalysisObject(prevState) ? prevState : {};
  const sectionDeepScanLoadingEnabled =
    typeof isDeepScanLoadingEnabledForSection === 'function' ? isDeepScanLoadingEnabledForSection : null;
  const resolvedKeepQuestionLoadingDuringDeepScan =
    keepQuestionLoadingDuringDeepScan == null
      ? !!sectionDeepScanLoadingEnabled?.('questions')
      : !!keepQuestionLoadingDuringDeepScan;
  const resolvedKeepSurveyLoadingDuringDeepScan =
    keepSurveyLoadingDuringDeepScan == null
      ? !!sectionDeepScanLoadingEnabled?.('surveys')
      : !!keepSurveyLoadingDuringDeepScan;
  const resolvedDeepScanCarryPatch =
    deepScanCarryPatch === undefined
      ? buildUserPageDeepScanRefreshCarryPatch({
          deepScanProgressRows,
          deepScanTooltipLines,
          prevState: prev,
        })
      : deepScanCarryPatch;
  const next: UserPageUnknownRecord = {};
  const userStatsPatch: UserPageUnknownRecord = {};
  const uncertaintyFlags = buildUserPageUncertaintyLoadingFlags({
    hasQuestionSources,
    hasSbtSources,
    hasSurveySources,
    keepQuestionLoadingDuringDeepScan: resolvedKeepQuestionLoadingDuringDeepScan,
    keepSurveyLoadingDuringDeepScan: resolvedKeepSurveyLoadingDuringDeepScan,
    prevState: prev,
    uncertainResources,
  });
  const {
    hasGateUncertainty,
    hasQuestionGateUncertainty,
    hasSurveyGateUncertainty,
    keepQuestionLoadingFromUserUncertainty,
    keepSbtLoadingFromUserUncertainty,
    keepSurveyLoadingFromUserUncertainty,
    preserveUserDataUncertainty,
  } = uncertaintyFlags;

  next.hasUncertainGateAccess = hasGateUncertainty;

  const survey = isPlainAnalysisObject(surveySection) ? surveySection : null;
  if (survey) {
    next.surveyResponseInfo = survey.surveyResponseInfo;
    next.surveyCreationInfo = survey.surveyCreationInfo;
    next.detailedSurveyResponses = survey.detailedSurveyResponses;
    userStatsPatch.surveysResponded = survey.surveysResponded;
    userStatsPatch.surveysCreated = survey.surveysCreated;
    next.loadingSurveys =
      (keepSurveyLoadingFromUserUncertainty ||
        hasSurveyGateUncertainty ||
        (resolvedKeepSurveyLoadingDuringDeepScan && !!prev.isDeepScanning)) &&
      readRefreshSectionLength(survey, 'surveyResponseInfo') === 0;
  } else if (holdSurveyLoading || markLoading || !aggregatePresent) {
    next.loadingSurveys = true;
  }

  const question = isPlainAnalysisObject(questionSection) ? questionSection : null;
  if (question) {
    next.questionCreationInfo = question.questionCreationInfo;
    next.questionResponseInfo = question.questionResponseInfo;
    next.detailedQuestionResponses = question.detailedQuestionResponses;
    userStatsPatch.questionsCreated = question.questionsCreated;
    userStatsPatch.questionsResponded = question.questionsResponded;
    next.loadingQuestions =
      (keepQuestionLoadingFromUserUncertainty ||
        hasQuestionGateUncertainty ||
        (resolvedKeepQuestionLoadingDuringDeepScan && !!prev.isDeepScanning)) &&
      readRefreshSectionLength(question, 'questionResponseInfo') === 0;
  } else if (holdQuestionLoading || markLoading || !aggregatePresent) {
    next.loadingQuestions = true;
  }

  const sbt = isPlainAnalysisObject(sbtSection) ? sbtSection : null;
  if (sbt) {
    next.sbtList = sbt.sbtList;
    userStatsPatch.badgesReceived = sbt.badgesReceived;
    next.loadingSBTs = keepSbtLoadingFromUserUncertainty && readRefreshSectionLength(sbt, 'sbtList') === 0;
  } else if (holdSbtLoading || markLoading || !aggregatePresent) {
    next.loadingSBTs = true;
  }

  if (isPlainAnalysisObject(resolvedDeepScanCarryPatch)) {
    Object.assign(next, resolvedDeepScanCarryPatch);
  }

  const userStatsMergePatch = buildUserPageUserStatsMergePatch({
    prevUserStats: prev.userStats,
    userStatsPatch,
  });
  if (userStatsMergePatch) {
    next.userStats = userStatsMergePatch;
  }

  return {
    loadingDiag: {
      prevIsDeepScanning: prev.isDeepScanning,
      prevHasUncertainUserData: prev.hasUncertainUserData,
      preserveUserDataUncertainty,
      keepSurveyLoadingDuringDeepScan: resolvedKeepSurveyLoadingDuringDeepScan,
      keepSurveyLoadingFromUserUncertainty,
      hasSurveyGateUncertainty,
      keepQuestionLoadingDuringDeepScan: resolvedKeepQuestionLoadingDuringDeepScan,
      keepQuestionLoadingFromUserUncertainty,
      hasQuestionGateUncertainty,
      loadingSurveys: next.loadingSurveys,
      loadingQuestions: next.loadingQuestions,
      loadingSBTs: next.loadingSBTs,
      surveyResponseCount: readRefreshSectionCount(surveySection, 'surveyResponseInfo'),
      questionResponseCount: readRefreshSectionCount(questionSection, 'questionResponseInfo'),
      sbtCount: readRefreshSectionCount(sbtSection, 'sbtList'),
    },
    statePatch: Object.keys(next).length > 0 ? next : null,
    uncertaintyFlags,
  };
};
