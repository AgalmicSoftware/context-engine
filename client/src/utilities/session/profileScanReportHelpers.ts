import { normalizeSessionSlug } from '../web3/contractScripts.js';
import { getAllowedSessionSlugs } from './sessionScanScope.js';

type ProfileScanScopeContext = {
  activeSlug?: unknown;
  list?: unknown;
  scope?: unknown;
};

type ProfileAllSessionsMode = {
  legacyAllSessions?: boolean;
  useAllSessionsActivityScan?: boolean;
  useAllSessionsQuestionActivityScan?: boolean;
  useAllSessionsSbtScan?: boolean;
  useAllSessionsScan?: boolean;
  useAllSessionsSurveyActivityScan?: boolean;
};

type ProfileScanPlan = {
  activeChainSlugCount?: unknown;
  coverageComplete?: boolean;
  coverageReason?: unknown;
  hadLoadErrors?: unknown;
  prioritizedGeneralFirst?: unknown;
  rawAllSlugCount?: unknown;
  registryEntryCount?: unknown;
  relevantSlugs?: unknown;
  scanOrdering?: unknown;
  scopedFallbackSlugCount?: unknown;
  usedAllSessions?: boolean;
};

export type ProfileScanFanoutPlan = {
  isListScope: boolean;
  allowListScopeSbtFanout: boolean;
  allowListScopeSurveyActivityFanout: boolean;
  allowListScopeQuestionActivityFanout: boolean;
  allowListScopeAnyFanout: boolean;
  useAllSessionsScan: boolean;
  shouldHydrateRegistry: boolean;
};

export const createProfileScanFanoutPlan = ({
  scopeContext = {},
  allSessionsMode = {},
}: {
  scopeContext?: ProfileScanScopeContext | null;
  allSessionsMode?: ProfileAllSessionsMode | null;
} = {}): ProfileScanFanoutPlan => {
  const scope = scopeContext || {};
  const mode = allSessionsMode || {};
  const isListScope = scope.scope === 'list';
  const allowListScopeSbtFanout = isListScope && !mode.legacyAllSessions && mode.useAllSessionsSbtScan === true;
  const allowListScopeSurveyActivityFanout =
    isListScope && !mode.legacyAllSessions && mode.useAllSessionsSurveyActivityScan === true;
  const allowListScopeQuestionActivityFanout =
    isListScope && !mode.legacyAllSessions && mode.useAllSessionsQuestionActivityScan === true;
  const allowListScopeAnyFanout =
    allowListScopeSbtFanout || allowListScopeSurveyActivityFanout || allowListScopeQuestionActivityFanout;
  const useAllSessionsScan = isListScope ? allowListScopeAnyFanout : mode.useAllSessionsScan === true;
  const shouldHydrateRegistry = mode.useAllSessionsScan === true || isListScope;

  return {
    isListScope,
    allowListScopeSbtFanout,
    allowListScopeSurveyActivityFanout,
    allowListScopeQuestionActivityFanout,
    allowListScopeAnyFanout,
    useAllSessionsScan,
    shouldHydrateRegistry,
  };
};

export const resolveProfileScanAttemptedCoverageSlugs = ({
  fanoutPlan = createProfileScanFanoutPlan(),
  scopeContext = {},
  allSlugs = [],
}: {
  fanoutPlan?: ProfileScanFanoutPlan;
  scopeContext?: ProfileScanScopeContext | null;
  allSlugs?: string[];
} = {}): {
  listScopeCoverageSlugs: string[];
  attemptedCoverageSlugs: string[];
  attemptedCoverageSlugSet: Set<string>;
} => {
  const scope = scopeContext || {};
  const listScopeCoverageSlugs = fanoutPlan.isListScope
    ? Array.from(
        new Set(
          getAllowedSessionSlugs('list', scope.list, scope.activeSlug).map((slug) => normalizeSessionSlug(slug || '')),
        ),
      )
    : [];
  const attemptedCoverageSlugs =
    fanoutPlan.allowListScopeAnyFanout && listScopeCoverageSlugs.length > 0
      ? listScopeCoverageSlugs
      : [...(Array.isArray(allSlugs) ? allSlugs : [])];
  const attemptedCoverageSlugSet = new Set(attemptedCoverageSlugs.map((slug) => normalizeSessionSlug(slug || '')));

  return {
    listScopeCoverageSlugs,
    attemptedCoverageSlugs,
    attemptedCoverageSlugSet,
  };
};

export const createInitialProfileScanReport = ({
  targetLower = '',
  profileScanPlan = {},
  allSessionsMode = {},
  fanoutPlan = createProfileScanFanoutPlan(),
  attemptedCoverageSlugs = [],
  slugFetchTimeoutMs = 0,
  sbtFetchTimeoutMs = 0,
  activityFetchTimeoutMs = 0,
  activityLookbackBlocks = 0,
  sbtBurstSize = 1,
}: {
  targetLower?: string;
  profileScanPlan?: ProfileScanPlan | null;
  allSessionsMode?: ProfileAllSessionsMode | null;
  fanoutPlan?: ProfileScanFanoutPlan;
  attemptedCoverageSlugs?: string[];
  slugFetchTimeoutMs?: unknown;
  sbtFetchTimeoutMs?: unknown;
  activityFetchTimeoutMs?: unknown;
  activityLookbackBlocks?: unknown;
  sbtBurstSize?: unknown;
} = {}) => {
  const plan = profileScanPlan || {};
  const mode = allSessionsMode || {};
  return {
    targetAddress: targetLower,
    usedAllSessions: !!plan.usedAllSessions,
    useAllSessionsSbtScan: !!(plan.usedAllSessions && mode.useAllSessionsSbtScan),
    useAllSessionsSurveyActivityScan: !!(plan.usedAllSessions && mode.useAllSessionsSurveyActivityScan),
    useAllSessionsQuestionActivityScan: !!(plan.usedAllSessions && mode.useAllSessionsQuestionActivityScan),
    useAllSessionsActivityScan: !!(plan.usedAllSessions && mode.useAllSessionsActivityScan),
    listScopeSbtFanout: !!fanoutPlan.allowListScopeSbtFanout,
    listScopeSurveyActivityFanout: !!fanoutPlan.allowListScopeSurveyActivityFanout,
    listScopeQuestionActivityFanout: !!fanoutPlan.allowListScopeQuestionActivityFanout,
    attemptedSlugs: [...(Array.isArray(attemptedCoverageSlugs) ? attemptedCoverageSlugs : [])],
    scannedSlugs: [],
    skippedSlugs: [],
    skippedSlugReasons: {},
    failedSlugs: [],
    failedActivitySlugs: [],
    allActivityFailed: false,
    allSbtFailed: false,
    hadRpcErrors: plan.coverageComplete === false,
    anyNewData: false,
    coverageComplete: plan.coverageComplete !== false,
    coverageReason: String(plan.coverageReason || ''),
    registryEntryCount: Number(plan.registryEntryCount || 0),
    hadLoadErrors: !!plan.hadLoadErrors,
    rawAllSlugCount: Number(plan.rawAllSlugCount || 0),
    activeChainSlugCount: Number(plan.activeChainSlugCount || 0),
    scopedFallbackSlugCount: Number(plan.scopedFallbackSlugCount || 0),
    relevantSlugs: Array.isArray(plan.relevantSlugs) ? [...plan.relevantSlugs] : [],
    prioritizedGeneralFirst: !!plan.prioritizedGeneralFirst,
    scanOrdering: String(plan.scanOrdering || ''),
    slugFetchTimeoutMs: Number(slugFetchTimeoutMs || 0),
    sbtFetchTimeoutMs: Number(sbtFetchTimeoutMs || 0),
    activityFetchTimeoutMs: Number(activityFetchTimeoutMs || 0),
    activityLookbackBlocks: Number(activityLookbackBlocks || 0),
    sbtBurstSize: Number(sbtBurstSize || 1),
    totalSbtContractsFound: 0,
    totalCreatedSurveysFound: 0,
    totalCreatedQuestionsFound: 0,
    totalSurveyResponsesFound: 0,
    totalQuestionResponsesFound: 0,
    sampleSbtAddresses: [],
    sampleCreatedSurveyIds: [],
    sampleCreatedQuestionIds: [],
    sampleSurveyResponseIds: [],
    sampleQuestionResponseIds: [],
  };
};
